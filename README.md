# Wingman

A personal AI assistant you talk to as **Pip** — a warm, proactive companion that remembers your day-to-day and takes real action across your apps. Wingman is an Expo (React Native) app backed by a small, self-hostable Node service.

> Status: working end-to-end. Real auth + persistence, durable per-user memory, and a bounded Composio tool layer are live. App builds and runs on iOS (simulator + device) and web.

---

## What Wingman is

- **Chat with Pip.** You message Pip in natural language; Pip replies and *acts* by calling tools instead of just describing what it would do.
- **Pip remembers you.** An Obsidian-style persistent memory keeps a compact profile (preferences, people, routines) plus a rolling daily log, recalled into every conversation — so context survives across sessions and restarts.
- **Pip uses your apps.** Through [Composio](https://composio.dev), Pip can read and act on connected apps (Gmail, Calendar, Slack, Notion, GitHub, …). Tools are loaded *based on what you've connected and what you're asking* — never the whole catalog.
- **Flows (in progress).** Reusable automations ("every weekday 8am, summarize unread Gmail → post to #standup"), authored by Pip or built visually, and run on a schedule.

---

## Architecture

```
┌──────────────────────────┐         HTTP / SSE          ┌────────────────────────────┐
│  Expo app (Pip UI)        │ ─────────────────────────▶ │  Fastify server (port 3002)  │
│  features/wingman/*        │  auth · chat · apps · flows │  server/src/*                │
│  app/* (expo-router)       │ ◀───────────────────────── │                              │
└──────────────────────────┘                             │  ┌────────────────────────┐  │
        EXPO_PUBLIC_API_URL                               │  │ SqliteStore (1 file DB) │  │
        → http://localhost:3002                           │  │  users·sessions·apps    │  │
                                                          │  │  flows·activities·cal   │  │
                                                          │  │  chat_messages·memory   │  │
                                                          │  └────────────────────────┘  │
                                                          │  Orchestrator (LLM loop)     │
                                                          │   ├─ builtin tools           │
                                                          │   ├─ memory (inject + remember)│
                                                          │   └─ Composio (bounded)      │
                                                          └────────────────────────────┘
                                                                    │
                                                          OpenAI (gpt-5.5) · Composio API
```

On iOS/Android the app uses buffered `POST /chat`; on web it uses the `POST /chat/stream` SSE endpoint.

---

## Tech stack

| Layer | Choice |
| --- | --- |
| App | Expo SDK 54, React Native 0.81, expo-router, TypeScript |
| Server | Fastify 5, TypeScript (ESM), Node 22, `tsx` |
| Storage | **SQLite** via `better-sqlite3` (WAL, single file, zero infra) |
| Auth | scrypt password hashing + random session tokens (Bearer) |
| LLM | OpenAI (`gpt-5.5`) with a mock provider fallback for tests/dev |
| Tools | Composio (`@composio/core`) + local builtin tools |
| Tests | `node:test` + `tsx` (no external services) |

Why SQLite, not Postgres: this is a single-process app and the goal is *simple, easy infra*. SQLite is a single file with nothing to run or deploy. Revisit only for multi-instance/serverless hosting.

---

## Project structure

```
wingman-expo/
├─ app/                      # expo-router routes (tabs, onboarding, flow-builder, …)
├─ features/wingman/         # the app's screens, provider, API client, theme
│  ├─ api.ts                 #   backend contract (base URL, endpoints, SSE parsing)
│  ├─ provider.tsx           #   session, data fetching, chat state
│  └─ *-screen.tsx           #   home, chat, apps, flows, activity, settings, …
├─ assets/                   # Pip art + motion frames
└─ server/
   └─ src/
      ├─ index.ts            # Fastify routes (auth, chat, apps, flows, activity, briefing)
      ├─ store.ts            # SqliteStore — all persistence + auth + chat history + memory
      ├─ db/sqlite.ts        # schema + WAL/foreign_keys, schema-on-boot
      ├─ chat/orchestrator.ts# LLM tool-calling loop; injects memory into the system prompt
      ├─ memory (in store)   # profile + daily_log markdown docs, `remember` tool
      ├─ tools/
      │  ├─ builtin.ts       # calendar/briefing/connect/remember tools
      │  ├─ registry.ts      # bounded, context-filtered tool list (builtin + Composio)
      │  └─ composio.ts      # Composio adapter (connect + execute)
      └─ llm/                # provider selection, OpenAI + mock providers
```

---

## How the core pieces work

### Persistence & auth
`SqliteStore` owns one SQLite file (`server/.data/wingman.db`, gitignored). Accounts use scrypt-hashed passwords; sessions are random Bearer tokens. All data — apps, flows, activities, calendar, chat history, memory — is **per user** and survives server restarts.

### Memory (Obsidian-style)
Each user has two markdown docs in `memory_docs`:
- **`profile`** — durable facts: preferences, people, routines, timezone.
- **`daily_log`** — a rolling list of day-to-day notes.

Both are injected into Pip's system prompt every turn, so Pip recalls you even in a brand-new thread. Pip saves things by calling the **`remember`** tool. (Verified: after clearing the chat *and* restarting the server, Pip still recalls a stated preference.)

### Composio (bounded by context)
The tool registry loads Composio tools **only for the apps you've connected**, narrows them by the intent of your message, caps the count per turn, and caches tool definitions. If an action needs an app you haven't connected, Pip returns a connect link instead of guessing.

Real connections require per-toolkit `authConfigId`s created in the Composio dashboard, supplied via `COMPOSIO_AUTH_CONFIGS`. Builtin tools (calendar/briefing/memory) work without any Composio setup.

---

## Getting started

### 1. Backend
```bash
cd server
cp .env.example .env        # set OPENAI_API_KEY (and COMPOSIO_API_KEY when ready)
npm install
npm run dev                 # Fastify on http://localhost:3002
```
Health check: `curl http://localhost:3002/health` → `{"ok":true,...}`

### 2. App
```bash
# from repo root
echo "EXPO_PUBLIC_API_URL=http://localhost:3002" > .env.local
npm install
npm run ios                 # build + run on iOS simulator (Xcode toolchain)
# or: npm run web / npm run android
```

### 3. Tests
```bash
cd server && npm test       # 24 tests: auth, isolation, chat durability, memory, registry
npm run typecheck
```

---

## Environment (`server/.env`)

| Var | Purpose |
| --- | --- |
| `PORT` | Server port (default 3002) |
| `OPENAI_API_KEY` | Enables the real LLM (falls back to mock if empty) |
| `LLM_MODEL` | Default `gpt-5.5` |
| `COMPOSIO_API_KEY` | Enables the Composio runtime |
| `COMPOSIO_AUTH_CONFIGS` | `gmail=ac_x,googlecalendar=ac_y,…` — per-toolkit auth config ids from the Composio dashboard |
| `FRONTEND_URL` | Used to build OAuth callback links |

---

## Roadmap

One primitive underlies the next three features: **steps with templated inputs/outputs.**

1. **Memory tagging at scale** — a `memories` table with LLM-assigned tags (`#preference`, `#person:Mara`, `#project:launch`) alongside the docs; hybrid retrieval (tags + recency + salience) and periodic LLM consolidation/pruning.
2. **Recipes — join APIs on command** — named server-side `{input, steps[]}` where each step templates the previous step's output (e.g. `triage_inbox` = `gmail.list_unread → summarize → slack.post`), exposed to the LLM as a single tool and executed deterministically.
3. **LLM-built concrete flows** — a flow is data: `{trigger, steps[], conditions}` stored as JSON on the `flows` table. Pip authors flows from natural language; the visual flow-builder edits the same schema; a runner + scheduler execute them, log to activity, and a dry-run validates before save.

---

## Notes

- `better-sqlite3` is synchronous — keep transactions short, never across LLM/tool calls.
- The app degrades gracefully to seed data if the backend is unreachable, so a lean/empty backend never breaks the UI.
- `/ios` and `/android` native dirs and `server/.data/` are gitignored.
