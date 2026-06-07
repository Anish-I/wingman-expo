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

/** Input for creating a real (executable) flow. */
export type CreateFlowInput = {
  title?: string;
  description?: string;
  emoji?: string;
  color?: string;
  appSlug?: string;
  schedule?: import('./flows/types.js').FlowSchedule | null;
  steps?: import('./flows/types.js').FlowStep[];
};

/** Input for updating an existing flow. All fields optional (partial update). */
export type UpdateFlowInput = Partial<CreateFlowInput>;

/** A flow row including its executable definition (server-side use). */
export type FlowWithDefinition = Flow & {
  definition: import('./flows/types.js').FlowDefinition | null;
  lastRunAt: string | null;
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
