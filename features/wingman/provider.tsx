import React from 'react';
import { useColorScheme } from 'react-native';

import {
  beginAppConnection,
  createFlow as createFlowRequest,
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
  createFlow: () => Promise<void>;
  toggleFlow: (id: string, nextValue: boolean) => Promise<void>;
  setPushEnabled: (value: boolean) => void;
  setMemoryEnabled: (value: boolean) => void;
  setQuietHours: (value: string) => void;
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendChatMessage: (message: string) => Promise<AuthResult & { assistantMessage?: string }>;
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

const defaultBriefing: Briefing = {
  greeting: 'Morning, Sam!',
  chips: ['0 meetings', '0 flows running', '0 apps connected'],
  items: [],
};

function readLocalStorage(key: string) {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(key);
}

function writeLocalStorage(key: string, value: string | null) {
  if (typeof window === 'undefined') {
    return;
  }
  if (value == null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, value);
}

export function WingmanProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [hydrated, setHydrated] = React.useState(typeof window === 'undefined' ? false : true);
  const [authStage, setAuthStage] = React.useState<AuthStage>('onboarding');
  const [themeMode, setThemeMode] = React.useState<ThemeMode>('light');
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [currentUser, setCurrentUser] = React.useState<CurrentUser | null>(null);
  const [briefing, setBriefing] = React.useState<Briefing | null>(defaultBriefing);
  const [apps, setApps] = React.useState<AppIntegration[]>([]);
  const [flows, setFlows] = React.useState<FlowItem[]>([]);
  const [events, setEvents] = React.useState<ActivityEvent[]>([]);
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

  const clearSession = React.useCallback(() => {
    setSession(null);
    setCurrentUser(null);
    setApps([]);
    setFlows([]);
    setEvents([]);
    setBriefing(defaultBriefing);
    setAuthStage('sign-in');
  }, []);

  const refreshData = React.useCallback(async () => {
    if (!session?.token) {
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
      throw error;
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
      setBriefing(defaultBriefing);
      setApps([]);
      setFlows([]);
      setEvents([]);
      return;
    }

    void refreshData();
  }, [refreshData, session?.token]);

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

  const signIn = React.useCallback(async () => {
    const result = await demoLogin({
      email: fakeAccount.email,
      password: fakeAccount.password,
    });
    persistSession(result.session);
  }, [fakeAccount.email, fakeAccount.password, persistSession]);

  const signInWithPassword = React.useCallback(async (email: string, password: string) => {
    try {
      const result = await demoLogin({ email, password });
      persistSession(result.session);
      return { ok: true } satisfies AuthResult;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Sign-in failed.',
      } satisfies AuthResult;
    }
  }, [persistSession]);

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
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Create-account failed.',
      } satisfies AuthResult;
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
      }
    }
  }, [clearSession, session?.token]);

  const createFlow = React.useCallback(async () => {
    if (!session?.token) {
      return;
    }
    try {
      const response = await createFlowRequest(session.token);
      setFlows((currentFlows) => [response.flow, ...currentFlows]);
      const activityResponse = await fetchActivity(session.token);
      setEvents(activityResponse.items);
    } catch (error) {
      if (error instanceof Error && error.message === 'Unauthorized') {
        clearSession();
      }
    }
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
