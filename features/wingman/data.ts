import { wingmanColors } from '@/features/wingman/theme';

export const pipVariants = [
  '404',
  'alert',
  'angry',
  'business',
  'calendar',
  'checkmark',
  'clap',
  'coding',
  'coffee',
  'cool',
  'crying',
  'dab',
  'eating',
  'excited',
  'fail',
  'flying',
  'gg',
  'happy',
  'headband',
  'hypnotized',
  'love',
  'ninja',
  'overwhelmed',
  'question',
  'sad',
  'sleeping',
  'surprised',
  'thinking',
  'thumbsup',
  'wave',
  'worried',
] as const;

export type PipVariant = (typeof pipVariants)[number];
export type AuthStage = 'onboarding' | 'sign-in' | 'authenticated';

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: 'Pro';
};

export type AuthSession = {
  token: string;
  user: CurrentUser;
};

export type DemoAuthCredentials = {
  name?: string;
  email: string;
  password: string;
};

export type ChatMessage = {
  id: string;
  from: 'pip' | 'user';
  text: string;
  status?: string;
  streaming?: boolean;
  toolHints?: string[];
  oauthCta?: { app: string; url: string };
};

export const wingmanSupportLinks = {
  helpCenter: 'https://wingman.dev/help',
  privacyPolicy: 'https://wingman.dev/privacy',
  contactEmail: 'pip@wingman.dev',
} as const;

export type AppIntegration = {
  id: string;
  name: string;
  category: string;
  emoji: string;
  color: string;
  connected: boolean;
};

export type BriefingItem = {
  id: string;
  time: string;
  title: string;
  subtitle: string;
  emoji: string;
  color: string;
};

export type Briefing = {
  greeting: string;
  chips: string[];
  items: BriefingItem[];
};

export type UiCritiqueReport = {
  score: number;
  verdict: 'pass' | 'revise' | 'fail';
  findings: string[];
  recommendations: string[];
  affectedSurfaces: string[];
};

export type FlowItem = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  trigger: string;
  runs: number;
  color: string;
  active: boolean;
};

export type ActivityEvent = {
  id: string;
  when: string;
  title: string;
  subtitle: string;
  pip: PipVariant;
  color: string;
};

export type OnboardingScene = {
  id: string;
  pip: PipVariant;
  eyebrow: string;
  title: string;
  body: string;
  bg: string;
  accent: string;
  chips?: string[];
  sample?: string;
  reply?: string;
  apps?: { name: string; emoji: string; color: string }[];
  flows?: { emoji: string; title: string; time: string }[];
  points?: { icon: string; label: string }[];
};

const palette = wingmanColors.light;

export const onboardingScenes: OnboardingScene[] = [
  {
    id: 'hello',
    pip: 'wave',
    eyebrow: 'Meet your wingman',
    title: "Hi, I'm Pip!",
    body: 'Your personal pigeon, ready to run errands across every app you use just by text.',
    bg: palette.sky100,
    accent: palette.sky500,
    chips: ['Coo!', 'Hello there', 'Ready to help'],
  },
  {
    id: 'text',
    pip: 'excited',
    eyebrow: 'One inbox to rule them all',
    title: "Just text. I'll handle the rest.",
    body: "No more app-hopping. Tell me what you need in plain English and I'll wing it to the right place.",
    bg: palette.sun200,
    accent: palette.sun500,
    sample: 'remind me to defrost chicken at 6',
    reply: "Got it! I'll nudge you at 6:00 PM.",
  },
  {
    id: 'apps',
    pip: 'business',
    eyebrow: '1,000+ apps wired in',
    title: 'Connect once. Use everywhere.',
    body: "Gmail, Calendar, Slack, Spotify, Notion, Linear, GitHub. I plug into them so you don't have to.",
    bg: palette.lav100,
    accent: palette.lav500,
    apps: [
      { name: 'Gmail', emoji: '📧', color: '#EA4335' },
      { name: 'Calendar', emoji: '📆', color: '#F5A623' },
      { name: 'Notion', emoji: '📝', color: '#1B2240' },
      { name: 'Spotify', emoji: '🎵', color: '#1DB954' },
    ],
  },
  {
    id: 'flows',
    pip: 'clap',
    eyebrow: 'Automations on autopilot',
    title: 'Set it and forget it.',
    body: "I'll send you a morning digest, text before your meetings, or nudge the team when a PR is stale.",
    bg: palette.coral100,
    accent: palette.coral500,
    flows: [
      { emoji: '📧', title: 'Morning digest', time: '8:00 AM' },
      { emoji: '📆', title: 'Calendar brief', time: 'Nightly' },
      { emoji: '🐙', title: 'PR notifier', time: 'On activity' },
    ],
  },
  {
    id: 'privacy',
    pip: 'ninja',
    eyebrow: 'Your data, your rules',
    title: 'Private by default.',
    body: 'End-to-end encrypted. I only touch the apps you connect, and I forget what you tell me to.',
    bg: palette.mint100,
    accent: palette.mint500,
    points: [
      { icon: 'lock-closed', label: 'End-to-end encrypted' },
      { icon: 'eye-off', label: 'Never sold, never shared' },
      { icon: 'trash', label: 'Delete memory any time' },
    ],
  },
];

export const appLibrary: AppIntegration[] = [
  { id: 'gmail', name: 'Gmail', category: 'Communication', emoji: '📧', color: '#EA4335', connected: true },
  { id: 'slack', name: 'Slack', category: 'Communication', emoji: '💬', color: '#611F69', connected: true },
  { id: 'calendar', name: 'Calendar', category: 'Productivity', emoji: '📆', color: '#F5A623', connected: true },
  { id: 'notion', name: 'Notion', category: 'Productivity', emoji: '📝', color: '#1B2240', connected: false },
  { id: 'linear', name: 'Linear', category: 'Development', emoji: '⚡', color: '#5E6AD2', connected: false },
  { id: 'github', name: 'GitHub', category: 'Development', emoji: '🐙', color: '#1B2240', connected: true },
  { id: 'spotify', name: 'Spotify', category: 'Entertainment', emoji: '🎵', color: '#1DB954', connected: false },
  { id: 'dropbox', name: 'Dropbox', category: 'Cloud', emoji: '☁️', color: '#0061FF', connected: false },
];

export const initialFlows: FlowItem[] = [
  {
    id: 'digest',
    emoji: '📧',
    title: 'Morning email digest',
    description: 'Top 5 messages from your inbox',
    trigger: 'Weekdays 8:00 AM',
    runs: 42,
    color: palette.sky500,
    active: true,
  },
  {
    id: 'calendar-brief',
    emoji: '📆',
    title: 'Calendar brief',
    description: "Tomorrow's meetings every night",
    trigger: 'Nightly 9:30 PM',
    runs: 128,
    color: palette.sun400,
    active: true,
  },
  {
    id: 'standup',
    emoji: '💬',
    title: 'Standup nudge',
    description: "Ten minutes before, with yesterday's work",
    trigger: 'Weekdays 9:20 AM',
    runs: 0,
    color: palette.lav500,
    active: false,
  },
  {
    id: 'sample-inbox-triage',
    emoji: '📬',
    title: 'Sample: inbox triage',
    description: 'Summarize urgent Gmail threads and post a Slack digest',
    trigger: 'Weekdays 8:30 AM',
    runs: 0,
    color: palette.mint500,
    active: false,
  },
  {
    id: 'pr-notifier',
    emoji: '🐙',
    title: 'GitHub PR notifier',
    description: 'Ping when reviewed or merged',
    trigger: 'On activity',
    runs: 17,
    color: palette.ink,
    active: true,
  },
  {
    id: 'birthday',
    emoji: '🎂',
    title: 'Birthday pings',
    description: '48 hours ahead from your contacts',
    trigger: '48 hours before',
    runs: 0,
    color: palette.coral500,
    active: false,
  },
];

export const initialEvents: ActivityEvent[] = [
  {
    id: 'event-1',
    when: 'Just now',
    pip: 'clap',
    title: 'Sent email to Maya',
    subtitle: 'Subject: Design review feedback',
    color: palette.sky500,
  },
  {
    id: 'event-2',
    when: '12m ago',
    pip: 'calendar',
    title: 'Scheduled lunch with Ben',
    subtitle: 'Tomorrow 12:00 PM at Pizzeria Sirenetta',
    color: palette.sun500,
  },
  {
    id: 'event-3',
    when: '1h ago',
    pip: 'checkmark',
    title: 'Reminder set',
    subtitle: '"Defrost chicken" at 6:00 PM today',
    color: palette.mint500,
  },
  {
    id: 'event-4',
    when: 'This morning',
    pip: 'business',
    title: 'Morning digest sent',
    subtitle: 'Top 5 emails, 2 still need a reply',
    color: palette.sky500,
  },
  {
    id: 'event-5',
    when: 'Yesterday',
    pip: 'coding',
    title: 'PR #428 merged',
    subtitle: 'wingman-app/main by @maya',
    color: palette.lav500,
  },
];

export const initialMessages: ChatMessage[] = [
  { id: 'message-1', from: 'pip', text: 'Coo! What are we tackling today?' },
  { id: 'message-2', from: 'user', text: 'Remind me to defrost chicken at 6pm', status: 'Sent' },
  { id: 'message-3', from: 'pip', text: "Done! I'll text you at 6:00 PM." },
];

export const quickReplies = [
  { id: 'reply-1', label: 'Remind me…', icon: 'time', color: palette.sun500, prompt: 'Remind me to stretch at 4pm' },
  { id: 'reply-2', label: 'Send an email', icon: 'mail', color: palette.sky500, prompt: 'Draft an email to Maya about the design review' },
  { id: 'reply-3', label: 'Play my focus mix', icon: 'music', color: palette.mint500, prompt: 'Play my focus mix' },
  { id: 'reply-4', label: "What's on today?", icon: 'sparkles', color: palette.lav500, prompt: "What's on today?" },
] as const;

export const replyPool = [
  'Coo! Handled.',
  "I'll wing it over to you.",
  'Got it - done!',
] as const;

export const reactionMap = [
  { keywords: ['love', 'heart', '❤', '💕'], pip: 'love', color: palette.coral500, hint: 'aww!' },
  { keywords: ['meeting', 'calendar', 'schedule', 'book', 'event'], pip: 'calendar', color: palette.sun500, hint: 'checking calendar…' },
  { keywords: ['music', 'play', 'song', 'spotify', 'playlist'], pip: 'headband', color: palette.mint500, hint: 'feel the beat' },
  { keywords: ['coffee', 'lunch', 'eat', 'dinner', 'food'], pip: 'coffee', color: palette.coral500, hint: 'hungry?' },
  { keywords: ['code', 'github', 'pr', 'pull request', 'bug'], pip: 'coding', color: palette.lav500, hint: 'on it' },
  { keywords: ['tired', 'bed', 'sleep', 'night'], pip: 'sleeping', color: palette.lav500, hint: 'cozy…' },
  { keywords: ['thanks', 'thank you', 'ty'], pip: 'clap', color: palette.mint500, hint: 'anytime!' },
  { keywords: ['excited', 'yay', 'woo', 'lets go', "let's go"], pip: 'excited', color: palette.sun500, hint: 'lets gooo' },
  { keywords: ['sorry', 'oops', 'bad'], pip: 'sad', color: palette.sky600, hint: "it's ok" },
  { keywords: ['ninja', 'secret', 'private', 'hide'], pip: 'ninja', color: palette.ink, hint: '🤫' },
  { keywords: ['cool', 'nice', 'sweet', 'awesome'], pip: 'cool', color: palette.sky600, hint: 'b-)' },
] as const satisfies readonly {
  keywords: readonly string[];
  pip: PipVariant;
  color: string;
  hint: string;
}[];

export function detectReaction(text: string) {
  const normalized = text.toLowerCase();

  for (const entry of reactionMap) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry;
    }
  }

  return {
    pip: 'happy' as PipVariant,
    color: palette.sky500,
    hint: null,
  };
}
