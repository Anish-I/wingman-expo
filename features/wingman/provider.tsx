import React from 'react';
import { useColorScheme } from 'react-native';

import {
  beginAppConnection,
  clearChat,
  createFlow as createFlowRequest,
  deleteAccount as deleteAccountRequest,
  demoCreateAccount,
  demoLogin,
  fetchActivity,
  fetchApps,
  fetchBriefing,
  fetchFlows,
  fetchMe,
  patchFlow,
  runUiCritique,
  sendChat,
  sendChatStream,
} from '@/features/wingman/api';
import {
  type AppIntegration,
  type AuthSession,
  type AuthStage,
  type Briefing,
  type CurrentUser,
  type DemoAuthCredentials,
  type FlowItem,
  type UiCritiqueReport,
  type ActivityEvent,
  type ChatMessage,
  appLibrary,
  initialEvents,
  initialFlows,
  initialMessages,
} from '@/features/wingman/data';
import {
  type ResolvedTheme,
  type ThemeMode,
  type WingmanColors,
  wingmanColors,
} from '@/features/wingman/theme';

type WingmanSettings = {
  pushEnabled: boolean;
  quietHours: string;
  memoryEnabled: boolean;
};

type AuthResult = {
  ok: boolean;
  error?: string;
};

type WingmanContextValue = {
  hydrated: boolean;
  authStage: AuthStage;
  themeMode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  colors: WingmanColors;
  currentUser: CurrentUser | null;
  session: AuthSession | null;
  fakeAccount: Required<DemoAuthCredentials> & { name: string };
  briefing: Briefing | null;
  apps: AppIntegration[];
  flows: FlowItem[];
  events: ActivityEvent[];
  chatMessages: ChatMessage[];
  settings: WingmanSettings;
  connectedAppsCount: number;
  activeFlowsCount: number;
  completeOnboarding: () => void;
  signIn: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  createFakeAccount: (account: { name: string; email: string; password: string }) => Promise<AuthResult>;
  beginConnection: (appId: string) => Promise<void>;
  refreshData: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => void;
  createFlow: () => Promise<FlowItem | null>;
  toggleFlow: (id: string, nextValue: boolean) => Promise<void>;
  setPushEnabled: (value: boolean) => void;
  setMemoryEnabled: (value: boolean) => void;
  setQuietHours: (value: string) => void;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendChatMessage: (message: string) => Promise<AuthResult & { assistantMessage?: string }>;
  streamChatMessage: (message: string) => Promise<AuthResult>;
  clearChatThread: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  critiqueUi: (payload: { screenId: string; theme: string; viewport: { width: number; height: number } }) => Promise<UiCritiqueReport>;
};

const WingmanContext = React.createContext<WingmanContextValue | null>(null);

const AUTH_STAGE_KEY = 'wingman.auth-stage';
const SESSION_KEY = 'wingman.session';

const defaultFakeAccount = {
  name: 'Sam Ortega',
  email: 'sam@wingman.dev',
  password: 'pigeon123',
};

function isLocalDemoToken(token: string) {
  return token.startsWith('local-demo-token:');
}

function createLocalDemoSession(account: { name?: string; email: string }): AuthSession {
  const email = account.email.trim().toLowerCase();
  const name = account.name?.trim() || defaultFakeAccount.name;

  return {
    token: `local-demo-token:${Date.now()}`,
    user: {
      id: `local-demo:${email}`,
      name,
      email,
      phone: '+1 (555) 123-4567',
      tier: 'Pro',
    },
  };
}

const defaultBriefing: Briefing = {
  greeting: 'Morning, Sam!',
  chips: ['0 meetings', '0 flows running', '0 apps connected'],
  items: [],
};

function createLocalDraftFlow(): FlowItem {
  const createdAt = Date.now();

  return {
    id: `local-flow-${createdAt}`,
    emoji: '✨',
    title: 'New workflow',
    description: 'Customize the trigger, apps, and actions',
    trigger: 'Manual trigger',
    runs: 0,
    color: wingmanColors.light.sky500,
    active: false,
  };
}

function createLocalFlowActivity(flow: FlowItem): ActivityEvent {
  return {
    id: `local-activity-${Date.now()}`,
    when: 'Just now',
    title: 'Created flow',
    subtitle: flow.title,
    pip: 'clap',
    color: flow.color,
  };
}

const memoryStorage = new Map<string, string>();

function getStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}

function readLocalStorage(key: string) {
  const storage = getStorage();
  try {
    if (storage) return storage.getItem(key);
  } catch {
    return memoryStorage.get(key) ?? null;
  }
  return memoryStorage.get(key) ?? null;
}

function writeLocalStorage(key: string, value: string | null) {
  const storage = getStorage();
  if (value == null) {
    try {
      if (storage) storage.removeItem(key);
    } catch {
      // Memory storage is still cleared below.
    }
    memoryStorage.delete(key);
    return;
  }
  try {
    if (storage) storage.setItem(key, value);
  } catch {
    // Keep the in-memory fallback as the source of truth for this session.
  }
  memoryStorage.set(key, value);
}

export function WingmanProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [hydrated, setHydrated] = React.useState(typeof window === 'undefined' ? false : true);
  const [authStage, setAuthStage] = React.useState<AuthStage>('onboarding');
  const [themeMode, setThemeMode] = React.useState<ThemeMode>('light');
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [currentUser, setCurrentUser] = React.useState<CurrentUser | null>(null);
  const [briefing, setBriefing] = React.useState<Briefing | null>(defaultBriefing);
  const [apps, setApps] = React.useState<AppIntegration[]>(appLibrary);
  const [flows, setFlows] = React.useState<FlowItem[]>(initialFlows);
  const [events, setEvents] = React.useState<ActivityEvent[]>(initialEvents);
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>(initialMessages);
  const [fakeAccount, setFakeAccount] = React.useState(defaultFakeAccount);
  const [settings, setSettings] = React.useState<WingmanSettings>({
    pushEnabled: true,
    quietHours: '10pm - 7am',
    memoryEnabled: true,
  });

  const resolvedTheme: ResolvedTheme = themeMode === 'auto' ? systemScheme : themeMode;
  const colors = wingmanColors[resolvedTheme];
  const connectedAppsCount = apps.filter((app) => app.connected).length;
  const activeFlowsCount = flows.filter((flow) => flow.active).length;

  React.useEffect(() => {
    const storedSession = readLocalStorage(SESSION_KEY);
    const storedStage = readLocalStorage(AUTH_STAGE_KEY) as AuthStage | null;

    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession) as AuthSession;
        setSession(parsed);
        setCurrentUser(parsed.user);
        setAuthStage('authenticated');
      } catch {
        setSession(null);
        setCurrentUser(null);
        setAuthStage(storedStage ?? 'sign-in');
      }
    } else {
      setAuthStage(storedStage ?? 'onboarding');
    }

    setHydrated(true);
  }, []);

  const restoreDemoFallbackData = React.useCallback(() => {
    setBriefing(defaultBriefing);
    setApps(appLibrary);
    setFlows(initialFlows);
    setEvents(initialEvents);
  }, []);

  const clearSession = React.useCallback(() => {
    setSession(null);
    setCurrentUser(null);
    restoreDemoFallbackData();
    setAuthStage('sign-in');
  }, [restoreDemoFallbackData]);

  const refreshData = React.useCallback(async () => {
    if (!session?.token) {
      return;
    }
    if (isLocalDemoToken(session.token)) {
      restoreDemoFallbackData();
      return;
    }
    try {
      const [meResponse, appsResponse, flowsResponse, activityResponse, briefingResponse] = await Promise.all([
        fetchMe(session.token),
        fetchApps(session.token),
        fetchFlows(session.token),
        fetchActivity(session.token),
        fetchBriefing(session.token),
      ]);

      setCurrentUser(meResponse.user);
      setApps(appsResponse.items);
      setFlows(flowsResponse.items);
      setEvents(activityResponse.items);
      setBriefing(briefingResponse);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
        return;
      }
      restoreDemoFallbackData();
    }
  }, [clearSession, restoreDemoFallbackData, session?.token]);

  React.useEffect(() => {
    writeLocalStorage(AUTH_STAGE_KEY, authStage);
  }, [authStage]);

  React.useEffect(() => {
    writeLocalStorage(SESSION_KEY, session ? JSON.stringify(session) : null);
  }, [session]);

  React.useEffect(() => {
    if (!session?.token) {
      setCurrentUser(null);
      restoreDemoFallbackData();
      return;
    }

    void refreshData();
  }, [refreshData, restoreDemoFallbackData, session?.token]);

  const persistSession = React.useCallback((nextSession: AuthSession) => {
    setSession(nextSession);
    setCurrentUser(nextSession.user);
    setAuthStage('authenticated');
    setFakeAccount((current) => ({
      ...current,
      name: nextSession.user.name,
      email: nextSession.user.email,
    }));
  }, []);

  const persistLocalDemoSession = React.useCallback((account: { name?: string; email: string }) => {
    const localSession = createLocalDemoSession(account);
    persistSession(localSession);
    restoreDemoFallbackData();
    return localSession;
  }, [persistSession, restoreDemoFallbackData]);

  const signIn = React.useCallback(async () => {
    try {
      const result = await demoLogin({
        email: fakeAccount.email,
        password: fakeAccount.password,
      });
      persistSession(result.session);
    } catch {
      persistLocalDemoSession(fakeAccount);
    }
  }, [fakeAccount, persistLocalDemoSession, persistSession]);

  const signInWithPassword = React.useCallback(async (email: string, password: string) => {
    try {
      const result = await demoLogin({ email, password });
      persistSession(result.session);
      return { ok: true } satisfies AuthResult;
    } catch {
      persistLocalDemoSession({ name: fakeAccount.name, email });
      setFakeAccount((current) => ({
        ...current,
        email: email.trim().toLowerCase(),
        password,
      }));
      return { ok: true } satisfies AuthResult;
    }
  }, [fakeAccount.name, persistLocalDemoSession, persistSession]);

  const createFakeAccount = React.useCallback(async (account: { name: string; email: string; password: string }) => {
    try {
      const result = await demoCreateAccount(account);
      persistSession(result.session);
      setFakeAccount({
        name: account.name,
        email: account.email.trim().toLowerCase(),
        password: account.password,
      });
      return { ok: true } satisfies AuthResult;
    } catch {
      persistLocalDemoSession(account);
      setFakeAccount({
        name: account.name,
        email: account.email.trim().toLowerCase(),
        password: account.password,
      });
      return { ok: true } satisfies AuthResult;
    }
  }, [persistLocalDemoSession, persistSession]);

  const beginConnection = React.useCallback(async (appId: string) => {
    if (!session?.token) {
      throw new Error('Sign in before connecting apps.');
    }
    try {
      await beginAppConnection(session.token, appId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
      }
      throw error;
    }
  }, [clearSession, session?.token]);

  const toggleFlow = React.useCallback(async (id: string, nextValue: boolean) => {
    if (!session?.token) {
      return;
    }
    if (isLocalDemoToken(session.token)) {
      setFlows((currentFlows) => currentFlows.map((flow) => (
        flow.id === id ? { ...flow, active: nextValue } : flow
      )));
      return;
    }
    try {
      const response = await patchFlow(session.token, id, nextValue);
      setFlows((currentFlows) => currentFlows.map((flow) => (flow.id === id ? response.flow : flow)));
      const activityResponse = await fetchActivity(session.token);
      setEvents(activityResponse.items);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
      }
    }
  }, [clearSession, session?.token]);

  const createFlow = React.useCallback(async () => {
    if (!session?.token) {
      return null;
    }
    if (isLocalDemoToken(session.token)) {
      const flow = createLocalDraftFlow();
      setFlows((currentFlows) => [flow, ...currentFlows]);
      setEvents((currentEvents) => [createLocalFlowActivity(flow), ...currentEvents]);
      return flow;
    }
    try {
      const response = await createFlowRequest(session.token);
      setFlows((currentFlows) => [response.flow, ...currentFlows]);
      const activityResponse = await fetchActivity(session.token);
      setEvents(activityResponse.items);
      return response.flow;
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
        return null;
      }
      const flow = createLocalDraftFlow();
      setFlows((currentFlows) => [flow, ...currentFlows]);
      setEvents((currentEvents) => [createLocalFlowActivity(flow), ...currentEvents]);
      return flow;
    }
  }, [clearSession, session?.token]);

  const streamChatMessage = React.useCallback(async (message: string): Promise<AuthResult> => {
    if (!session?.token) {
      return { ok: false, error: 'Sign in to chat with Pip.' };
    }
    const pipId = `pip-${Date.now()}`;
    setChatMessages((prev) => [
      ...prev,
      { id: pipId, from: 'pip', text: '', streaming: true, toolHints: [] },
    ]);
    const updatePipMessage = (patch: (current: ChatMessage) => ChatMessage) => {
      setChatMessages((prev) => prev.map((m) => (m.id === pipId ? patch(m) : m)));
    };
    let assembledText = '';
    let sawAnyEvent = false;
    try {
      for await (const event of sendChatStream(session.token, message)) {
        sawAnyEvent = true;
        if (event.type === 'token') {
          assembledText += event.text;
          updatePipMessage((m) => ({ ...m, text: (m.text ?? '') + event.text }));
        } else if (event.type === 'tool_call') {
          updatePipMessage((m) => ({ ...m, toolHints: [...(m.toolHints ?? []), event.call.name] }));
        } else if (event.type === 'tool_result' && event.meta?.kind === 'connection_required' && event.meta.oauthUrl && event.meta.appSlug) {
          updatePipMessage((m) => ({ ...m, oauthCta: { app: event.meta!.appSlug!, url: event.meta!.oauthUrl! } }));
        } else if (event.type === 'final') {
          if (event.content) assembledText = event.content;
          updatePipMessage((m) => ({ ...m, text: event.content || assembledText || m.text || 'Pip is thinking…', streaming: false }));
        } else if (event.type === 'error') {
          updatePipMessage((m) => ({ ...m, text: event.message || 'Something went sideways.', streaming: false }));
          return { ok: false, error: event.message };
        }
      }
      if (!sawAnyEvent || !assembledText) {
        // Fallback path that bypasses the streaming generator entirely.
        try {
          const direct = await sendChat(session.token, message);
          if (direct.assistantMessage) {
            updatePipMessage((m) => ({ ...m, text: direct.assistantMessage, streaming: false }));
            if (direct.action?.type === 'connection_required' && direct.action.appSlug && direct.action.oauthUrl) {
              updatePipMessage((m) => ({ ...m, oauthCta: { app: direct.action.appSlug!, url: direct.action.oauthUrl! } }));
            }
            await refreshData();
            return { ok: true };
          }
        } catch { /* fall through to generic finalizer below */ }
      }
      updatePipMessage((m) => ({ ...m, text: m.text || assembledText || "Pip didn't say anything. Try again?", streaming: false }));
      await refreshData();
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Chat stream failed.');
      if (error.message === 'Unauthorized') {
        clearSession();
      }
      updatePipMessage((m) => ({ ...m, text: error.message, streaming: false }));
      return { ok: false, error: error.message };
    }
  }, [clearSession, refreshData, session?.token, setChatMessages]);

  const clearChatThread = React.useCallback(async () => {
    if (!session?.token) return;
    try { await clearChat(session.token); } catch { /* non-fatal */ }
    setChatMessages([]);
  }, [session?.token]);

  const deleteAccount = React.useCallback(async () => {
    if (!session?.token) return;
    try { await deleteAccountRequest(session.token); } catch { /* still sign out */ }
    clearSession();
  }, [clearSession, session?.token]);

  const sendChatMessage = React.useCallback(async (message: string) => {
    if (!session?.token) {
      return {
        ok: false,
        error: 'Sign in to chat with Pip.',
      } as const;
    }

    try {
      const response = await sendChat(session.token, message);
      await refreshData();
      return {
        ok: true,
        assistantMessage: response.assistantMessage,
      } as const;
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Chat failed.',
      } as const;
    }
  }, [clearSession, refreshData, session?.token]);

  const critiqueUi = React.useCallback(async (payload: { screenId: string; theme: string; viewport: { width: number; height: number } }) => {
    if (!session?.token) {
      throw new Error('Sign in first.');
    }
    try {
      return await runUiCritique(session.token, payload);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
      }
      throw error;
    }
  }, [clearSession, session?.token]);

  const value: WingmanContextValue = {
    hydrated,
    authStage,
    themeMode,
    resolvedTheme,
    colors,
    currentUser,
    session,
    fakeAccount,
    briefing,
    apps,
    flows,
    events,
    chatMessages,
    settings,
    connectedAppsCount,
    activeFlowsCount,
    completeOnboarding: () => setAuthStage('sign-in'),
    signIn,
    signInWithPassword,
    createFakeAccount,
    beginConnection,
    refreshData,
    setThemeMode,
    createFlow,
    toggleFlow,
    setPushEnabled: (value) => setSettings((currentSettings) => ({ ...currentSettings, pushEnabled: value })),
    setMemoryEnabled: (value) => setSettings((currentSettings) => ({ ...currentSettings, memoryEnabled: value })),
    setQuietHours: (value) => setSettings((currentSettings) => ({ ...currentSettings, quietHours: value })),
    setChatMessages,
    sendChatMessage,
    streamChatMessage,
    clearChatThread,
    deleteAccount,
    critiqueUi,
  };

  return (
    <WingmanContext.Provider value={value}>
      {children}
    </WingmanContext.Provider>
  );
}

export function useWingman() {
  const context = React.useContext(WingmanContext);

  if (!context) {
    throw new Error('useWingman must be used inside a WingmanProvider');
  }

  return context;
}
