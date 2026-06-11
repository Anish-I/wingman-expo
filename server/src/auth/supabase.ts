import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Auth (GoTrue) adapter.
 *
 * Backend-mediated: the server creates/signs-in users against Supabase Auth and
 * verifies the access-token JWT on each request. The frontend keeps its existing
 * shape — it just carries a real Supabase JWT as the bearer token now.
 *
 * We create users via the admin API with `email_confirm: true` so signup is
 * instant (the project has mailer autoconfirm off), and sign in with the anon
 * client to mint a session. When the env isn't configured, `enabled` is false
 * and callers fall back to the legacy scrypt/session auth.
 */

export type AuthedIdentity = { id: string; email: string; name: string };

export type SupabaseAuth = {
  enabled: boolean;
  signUp(name: string, email: string, password: string): Promise<{ ok: true; identity: AuthedIdentity } | { ok: false; error: string }>;
  signIn(email: string, password: string): Promise<{ ok: true; token: string; refreshToken: string; identity: AuthedIdentity } | { ok: false; error: string }>;
  verifyToken(token: string): Promise<AuthedIdentity | null>;
  deleteUser(id: string): Promise<void>;
};

function nameFrom(metadata: Record<string, unknown> | undefined, email: string | undefined): string {
  const n = metadata?.name;
  if (typeof n === 'string' && n.trim()) return n.trim();
  return email?.split('@')[0] ?? 'there';
}

export function createSupabaseAuth(env: {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}): SupabaseAuth {
  const url = env.SUPABASE_URL?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const enabled = Boolean(url && anonKey && serviceKey);

  if (!enabled) {
    return {
      enabled: false,
      async signUp() { return { ok: false, error: 'Supabase Auth is not configured.' }; },
      async signIn() { return { ok: false, error: 'Supabase Auth is not configured.' }; },
      async verifyToken() { return null; },
      async deleteUser() { /* no-op */ },
    };
  }

  // Admin client (service role) — create/confirm users and verify JWTs.
  const admin: SupabaseClient = createClient(url!, serviceKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  // Anon client — exchange email/password for a session (never persisted server-side).
  const anon: SupabaseClient = createClient(url!, anonKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    enabled: true,

    async signUp(name, email, password) {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });
      if (error || !data.user) {
        return { ok: false, error: error?.message ?? 'Could not create the account.' };
      }
      return {
        ok: true,
        identity: { id: data.user.id, email: data.user.email ?? email, name },
      };
    },

    async signIn(email, password) {
      const { data, error } = await anon.auth.signInWithPassword({ email, password });
      if (error || !data.session || !data.user) {
        return { ok: false, error: error?.message ?? 'Incorrect email or password.' };
      }
      return {
        ok: true,
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        identity: {
          id: data.user.id,
          email: data.user.email ?? email,
          name: nameFrom(data.user.user_metadata, data.user.email),
        },
      };
    },

    async verifyToken(token) {
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) return null;
      return {
        id: data.user.id,
        email: data.user.email ?? '',
        name: nameFrom(data.user.user_metadata, data.user.email),
      };
    },

    async deleteUser(id) {
      await admin.auth.admin.deleteUser(id).catch(() => { /* best-effort */ });
    },
  };
}
