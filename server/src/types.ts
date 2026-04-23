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

export type ActivityEvent = {
  id: string;
  when: string;
  title: string;
  subtitle: string;
  pip: string;
  color: string;
  createdAt: string;
};

export type Flow = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  trigger: string;
  runs: number;
  color: string;
  active: boolean;
  appSlug: string;
};

export type AppConnection = {
  id: string;
  slug: string;
  name: string;
  category: string;
  emoji: string;
  color: string;
  connected: boolean;
  connectedAt?: string;
};

export type CalendarEvent = {
  id: string;
  userId: string;
  title: string;
  startIso: string;
  endIso: string;
  subtitle: string;
  emoji: string;
  color: string;
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
