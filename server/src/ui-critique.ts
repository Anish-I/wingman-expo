import type { UiCritiqueReport } from './types.js';

export function buildUiCritique(input: {
  screenId: string;
  theme: string;
  viewport: { width: number; height: number } | null;
}): UiCritiqueReport {
  const findingsByScreen: Record<string, string[]> = {
    home: [
      'Hero should stay the dominant anchor, with briefing cards secondary.',
      'Quick actions should never visually outweigh the main Ask Pip entry point.',
    ],
    chat: [
      'Composer and quick replies should keep the lowest interaction latency on screen.',
      'Calendar actions should show tool-backed confirmation rather than generic success copy.',
    ],
    apps: [
      'Connected state should read instantly with stronger status hierarchy.',
      'Calendar should stay near the top of the connectable app list during the first milestone.',
    ],
    flows: [
      'Unavailable non-calendar flows should read as roadmap, not broken functionality.',
      'The primary CTA should focus on calendar-based automations in the first milestone.',
    ],
    settings: [
      'Developer-only tools should stay visually separated from user-facing settings.',
      'Demo auth details should be easy to copy without dominating the page.',
    ],
    'onboarding-auth': [
      'Create-account and sign-in should feel like one coherent sequence.',
      'The last-slide CTA should point to create-account without looking like the final product destination.',
    ],
  };

  const screenFindings = findingsByScreen[input.screenId] ?? [
    'This surface should preserve the Wingman sticker-card system and clear single-primary-action hierarchy.',
  ];

  const recommendations = [
    'Keep brand hierarchy: editorial display type, crisp sticker cards, and one obvious primary action.',
    'Reduce any placeholder or roadmap language that could be mistaken for shipped functionality.',
    `Validate at ${input.theme} theme and ${input.viewport?.width ?? 0}x${input.viewport?.height ?? 0} viewport before sign-off.`,
  ];

  return {
    score: input.screenId === 'chat' ? 89 : 92,
    verdict: input.screenId === 'chat' ? 'revise' : 'pass',
    findings: screenFindings,
    recommendations,
    affectedSurfaces: [input.screenId],
  };
}
