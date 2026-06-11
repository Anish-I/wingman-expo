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
  fetchChatHistory,
  fetchFlow,
  fetchFlows,
  fetchMe,
  patchFlow,
  runFlow as runFlowRequest,
  runUiCritique,
  sendChat,
  sendChatStream,
  updateFlow as updateFlowRequest,
} from '@/features/wingman/api';
import {
  type AppIntegration,
  type AuthSession,
  type AuthStage,
  type Briefing,
  type CurrentUser,
  type FlowDetail,
  type FlowItem,
  type FlowRunResult,
  type FlowUpdateInput,
  type UiCritiqueReport,
  type ActivityEvent,
  type ChatMessage,
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
  briefing: Briefing | null;
  apps: AppIntegration[];
  flows: FlowItem[];
  events: ActivityEvent[];
  chatMessages: ChatMessage[];
  settings: WingmanSettings;
  connectedAppsCount: number;
  activeFlowsCount: number;
  /** True while the first data load for the current session is in flight. */
  dataLoading: boolean;
  /** Non-null when the last data load failed (server unreachable, etc.). */
  dataError: string | null;
  completeOnboarding: () => void;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  createAccount: (account: { name: string; email: string; password: string }) => Promise<AuthResult>;
  signOut: () => void;
  beginConnection: (appId: string) => Promise<void>;
  refreshData: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => void;
  createFlow: () => Promise<FlowItem | null>;
  getFlowDetail: (id: string) => Promise<FlowDetail | null>;
  updateFlow: (id: string, input: FlowUpdateInput) => Promise<FlowItem | null>;
  runFlow: (id: string) => Promise<FlowRunResult | null>;
  toggleFlow: (id: string, nextValue: boolean) => Promise<void>;
  setPushEnabled: (value: boolean) => void;
  setMemoryEnabled: (value: boolean) => void;
  setQuietHours: (value: string) => void;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  streamChatMessage: (message: string) => Promise<AuthResult>;
  clearChatThread: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  critiqueUi: (payload: { screenId: string; theme: string; viewport: { width: number; height: number } }) => Promise<UiCritiqueReport>;
};

const WingmanContext = React.createContext<WingmanContextValue | null>(null);

const AUTH_STAGE_KEY = 'wingman.auth-stage';
const SESSION_KEY = 'wingman.session';

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
  // No fake seed data — every list starts empty and is filled from the backend.
  const [briefing, setBriefing] = React.useState<Briefing | null>(null);
  const [apps, setApps] = React.useState<AppIntegration[]>([]);
  const [flows, setFlows] = React.useState<FlowItem[]>([]);
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
  const [chatMessages, setChatMessages] = React.useState<ChatMessage[]>([]);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);
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

  const clearData = React.useCallback(() => {
    setBriefing(null);
    setApps([]);
    setFlows([]);
    setEvents([]);
    setChatMessages([]);
    setDataError(null);
  }, []);

  const clearSession = React.useCallback(() => {
    setSession(null);
    setCurrentUser(null);
    clearData();
    setAuthStage('sign-in');
  }, [clearData]);

  const refreshData = React.useCallback(async () => {
    if (!session?.token) {
      return;
    }
    setDataLoading(true);
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
      setDataError(null);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
        return;
      }
      // Honest failure: surface the error, do not invent data.
      setDataError(error instanceof Error ? error.message : 'Could not reach the Wingman server.');
    } finally {
      setDataLoading(false);
    }
  }, [clearSession, session?.token]);

  React.useEffect(() => {
    writeLocalStorage(AUTH_STAGE_KEY, authStage);
  }, [authStage]);

  React.useEffect(() => {
    writeLocalStorage(SESSION_KEY, session ? JSON.stringify(session) : null);
  }, [session]);

  React.useEffect(() => {
    if (!session?.token) {
      setCurrentUser(null);
      clearData();
      return;
    }
    void refreshData();
  }, [clearData, refreshData, session?.token]);

  // Load the persisted chat thread once per session establishment. Kept out of
  // refreshData so a post-chat refresh never clobbers an in-progress reply.
  React.useEffect(() => {
    if (!session?.token) return;
    const token = session.token;
    let cancelled = false;
    void (async () => {
      try {
        const { messages } = await fetchChatHistory(token);
        if (!cancelled) setChatMessages(messages);
      } catch {
        // A history failure shouldn't block the app; the thread stays empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.token]);

  const persistSession = React.useCallback((nextSession: AuthSession) => {
    setSession(nextSession);
    setCurrentUser(nextSession.user);
    setAuthStage('authenticated');
  }, []);

  const signInWithPassword = React.useCallback(async (email: string, password: string): Promise<AuthResult> => {
    try {
      const result = await demoLogin({ email, password });
      persistSession(result.session);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign-in failed.';
      // Real auth: a wrong password (or any failure) is a real failure.
      return { ok: false, error: message === 'Unauthorized' ? 'Wrong email or password.' : message };
    }
  }, [persistSession]);

  const createAccount = React.useCallback(async (account: { name: string; email: string; password: string }): Promise<AuthResult> => {
    try {
      const result = await demoCreateAccount(account);
      persistSession(result.session);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Could not create the account.' };
    }
  }, [persistSession]);

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
    try {
      const response = await patchFlow(session.token, id, nextValue);
      setFlows((currentFlows) => currentFlows.map((flow) => (flow.id === id ? response.flow : flow)));
      const activityResponse = await fetchActivity(session.token);
      setEvents(activityResponse.items);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
      } else {
        throw error;
      }
    }
  }, [clearSession, session?.token]);

  const createFlow = React.useCallback(async () => {
    if (!session?.token) {
      return null;
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
      }
      return null;
    }
  }, [clearSession, session?.token]);

  const getFlowDetail = React.useCallback(async (id: string): Promise<FlowDetail | null> => {
    if (!session?.token) {
      return null;
    }
    try {
      const response = await fetchFlow(session.token, id);
      return response.flow;
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
      }
      return null;
    }
  }, [clearSession, session?.token]);

  const updateFlow = React.useCallback(async (id: string, input: FlowUpdateInput): Promise<FlowItem | null> => {
    if (!session?.token) {
      return null;
    }
    try {
      const response = await updateFlowRequest(session.token, id, input);
      setFlows((currentFlows) => currentFlows.map((flow) => (flow.id === id ? response.flow : flow)));
      return response.flow;
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
        return null;
      }
      throw error;
    }
  }, [clearSession, session?.token]);

  const runFlow = React.useCallback(async (id: string): Promise<FlowRunResult | null> => {
    if (!session?.token) {
      return null;
    }
    try {
      const response = await runFlowRequest(session.token, id);
      // A run bumps the counter and logs activity server-side — pull the fresh state.
      await refreshData();
      return response.result;
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
        return null;
      }
      throw error;
    }
  }, [clearSession, refreshData, session?.token]);

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
    briefing,
    apps,
    flows,
    events,
    chatMessages,
    settings,
    connectedAppsCount,
    activeFlowsCount,
    dataLoading,
    dataError,
    completeOnboarding: () => setAuthStage('sign-in'),
    signInWithPassword,
    createAccount,
    signOut: clearSession,
    beginConnection,
    refreshData,
    setThemeMode,
    createFlow,
    getFlowDetail,
    updateFlow,
    runFlow,
    toggleFlow,
    setPushEnabled: (value) => setSettings((currentSettings) => ({ ...currentSettings, pushEnabled: value })),
    setMemoryEnabled: (value) => setSettings((currentSettings) => ({ ...currentSettings, memoryEnabled: value })),
    setQuietHours: (value) => setSettings((currentSettings) => ({ ...currentSettings, quietHours: value })),
    setChatMessages,
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
