import type { ServerTool, ToolContext, ToolResult } from './types.js';

/**
 * Curated Gmail / Slack / Spotify step modules for the flow builder.
 *
 * Each of these is a *built-in* tool (so it passes flow validation and the runner
 * can execute it deterministically), but its body drives a real Composio action.
 * That keeps the builder's step catalog small and predictable while the actual
 * work happens over the user's connected account.
 *
 * Composio action slugs + argument names live in one place per tool (the `action`
 * + `buildArgs` below) so they're trivial to adjust if Composio's catalog drifts
 * for your project — change the constant, nothing else moves.
 */

type AppActionConfig = {
  /** Toolkit/app slug as stored in `app_connections` (e.g. 'gmail'). */
  appSlug: string;
  /** Friendly app name for messages. */
  appName: string;
  /** Composio action slug to execute (e.g. 'GMAIL_SEND_EMAIL'). */
  action: string;
  /** Map our tool args → the Composio action's expected arguments. */
  buildArgs: (args: Record<string, unknown>) => Record<string, unknown>;
  /** Short activity-log title + how to summarize the result for the user. */
  activityTitle: string;
  activityColor: string;
  /** Pip variant to show in the activity feed (must be a real pip asset). */
  activityPip: string;
  summarize: (args: Record<string, unknown>, output: string) => string;
};

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Trim a (possibly large / JSON) Composio payload down to something a flow log can show. */
function clip(output: string, max = 280): string {
  const flat = output.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Shared execution path for every app-action module: guard the connection, guard
 * that Composio is wired, run the action, log it, and fail gracefully with a
 * human message instead of throwing into the flow runner.
 */
async function runAppAction(
  cfg: AppActionConfig,
  args: Record<string, unknown>,
  ctx: ToolContext,
  callId: string,
): Promise<ToolResult> {
  const connected = (await ctx.store.getApps(ctx.userId)).some(
    (a) => a.slug === cfg.appSlug && a.connected,
  );
  if (!connected) {
    return {
      output: `${cfg.appName} isn't connected yet. Generate an OAuth link with create_app_connection({ app: "${cfg.appSlug}" }) or connect it on the Apps screen.`,
      meta: { kind: 'connection_required', appSlug: cfg.appSlug },
    };
  }

  if (!ctx.composio?.enabled) {
    return {
      output: `${cfg.appName} actions need Composio configured on the server (set COMPOSIO_API_KEY and an auth config for ${cfg.appSlug}).`,
      meta: { kind: 'connection_required', appSlug: cfg.appSlug },
    };
  }

  let output: string;
  try {
    output = await ctx.composio.execute(ctx.userId, {
      id: callId,
      name: cfg.action,
      arguments: cfg.buildArgs(args),
    });
  } catch (err) {
    return {
      output: `${cfg.appName} action failed: ${(err as Error).message}`,
      meta: { kind: 'app_action', appSlug: cfg.appSlug, action: cfg.action },
    };
  }

  await ctx.store.addActivity(ctx.userId, {
    title: cfg.activityTitle,
    subtitle: clip(cfg.summarize(args, output), 60),
    pip: cfg.activityPip,
    color: cfg.activityColor,
  });

  return {
    output: cfg.summarize(args, output),
    meta: { kind: 'app_action', appSlug: cfg.appSlug, action: cfg.action },
  };
}

// --- Gmail -----------------------------------------------------------------

export const gmailSendEmail: ServerTool = {
  definition: {
    name: 'gmail_send_email',
    description: "Send an email from the user's connected Gmail account.",
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address.' },
        subject: { type: 'string', description: 'Email subject line.' },
        body: { type: 'string', description: 'Plain-text body of the email.' },
      },
      required: ['to', 'body'],
    },
  },
  execute(args, ctx) {
    return runAppAction(
      {
        appSlug: 'gmail',
        appName: 'Gmail',
        action: 'GMAIL_SEND_EMAIL',
        buildArgs: (a) => ({
          recipient_email: str(a.to),
          subject: str(a.subject) || '(no subject)',
          body: str(a.body),
        }),
        activityTitle: 'Sent an email',
        activityColor: '#EA4335',
        activityPip: 'wave',
        summarize: (a) => `Emailed ${str(a.to) || 'recipient'}${str(a.subject) ? ` · ${str(a.subject)}` : ''}.`,
      },
      args,
      ctx,
      'gmail_send_email',
    );
  },
};

export const gmailSummarizeInbox: ServerTool = {
  definition: {
    name: 'gmail_summarize_inbox',
    description: "Fetch recent emails from the user's Gmail inbox so a flow can summarize or act on them.",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional Gmail search query (e.g. "is:unread").' },
      },
    },
  },
  execute(args, ctx) {
    return runAppAction(
      {
        appSlug: 'gmail',
        appName: 'Gmail',
        action: 'GMAIL_FETCH_EMAILS',
        buildArgs: (a) => ({
          query: str(a.query) || 'is:unread',
          max_results: 5,
        }),
        activityTitle: 'Checked Gmail',
        activityColor: '#EA4335',
        activityPip: 'thinking',
        summarize: (_a, output) => `Inbox: ${clip(output)}`,
      },
      args,
      ctx,
      'gmail_summarize_inbox',
    );
  },
};

// --- Slack -----------------------------------------------------------------

export const slackSendMessage: ServerTool = {
  definition: {
    name: 'slack_send_message',
    description: "Post a message to a Slack channel in the user's connected workspace.",
    parameters: {
      type: 'object',
      properties: {
        channel: { type: 'string', description: 'Channel name or ID (e.g. "#general" or "general").' },
        text: { type: 'string', description: 'Message text to post.' },
      },
      required: ['channel', 'text'],
    },
  },
  execute(args, ctx) {
    return runAppAction(
      {
        appSlug: 'slack',
        appName: 'Slack',
        action: 'SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL',
        buildArgs: (a) => ({
          channel: str(a.channel).replace(/^#/, ''),
          text: str(a.text),
        }),
        activityTitle: 'Posted to Slack',
        activityColor: '#4A154B',
        activityPip: 'cool',
        summarize: (a) => `Posted to ${str(a.channel) || 'Slack'}.`,
      },
      args,
      ctx,
      'slack_send_message',
    );
  },
};

// --- Spotify ---------------------------------------------------------------

export const spotifyPlay: ServerTool = {
  definition: {
    name: 'spotify_play',
    description: "Start playback on the user's connected Spotify (a track, album, or playlist).",
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to play — a track, artist, or playlist name.' },
      },
      required: ['query'],
    },
  },
  execute(args, ctx) {
    return runAppAction(
      {
        appSlug: 'spotify',
        appName: 'Spotify',
        action: 'SPOTIFY_START_RESUME_PLAYBACK',
        buildArgs: (a) => ({
          // Composio resolves a URI/context; we pass the free-text query through
          // so the action can search-and-play. Adjust to context_uri if you wire
          // an explicit search step.
          q: str(a.query),
        }),
        activityTitle: 'Started Spotify',
        activityColor: '#1DB954',
        activityPip: 'headband',
        summarize: (a) => `Playing "${str(a.query)}" on Spotify.`,
      },
      args,
      ctx,
      'spotify_play',
    );
  },
};

export const composioActionTools: Record<string, ServerTool> = {
  [gmailSendEmail.definition.name]: gmailSendEmail,
  [gmailSummarizeInbox.definition.name]: gmailSummarizeInbox,
  [slackSendMessage.definition.name]: slackSendMessage,
  [spotifyPlay.definition.name]: spotifyPlay,
};
