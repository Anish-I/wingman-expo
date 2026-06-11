# Wingman — Run & Debug Runbook

How to run the app and server, and debug them, on **Android**, **iOS**, and **Web**.

> **Two things that cause 90% of "it doesn't work":**
> 1. **The app talks to the server on port `3002`.** On a real device/emulator the app must reach your dev machine's IP — `localhost` means the *device itself*, not your PC. See [Networking](#networking-the-api-url-read-this-first).
> 2. **Native voice (mic) and native push need a _dev-client build_, not Expo Go.** They ship native code. Expo Go will run the UI but those features no-op. See [Dev client vs Expo Go](#dev-client-vs-expo-go).

---

## 0. Prerequisites

| Need | Notes |
| --- | --- |
| Node 22 + npm | Server is ESM/Node 22. |
| A Postgres DB | Local Docker (below) **or** the hosted Supabase `DATABASE_URL`. |
| `server/.env` | Copy `server/.env.example` → `server/.env`, fill `DATABASE_URL` (+ keys as needed). |
| **Android:** Android Studio | SDK + an emulator (AVD), or a physical phone with USB debugging. |
| **iOS:** macOS + Xcode | A macOS VM (or Mac) with Xcode + Command Line Tools. iOS builds run there; simulator works in the VM. See [iOS](#run-on-ios). |
| Apple Developer acct | Only for installing on a **physical** iPhone / TestFlight / App Store. Simulator needs none. |

The repo: server lives in `wingman-expo/server`, the app in `wingman-expo/`.

---

## 1. Start the backend (do this first, always)

The app degrades to seed data if the server is down, so if screens look "fake," the server isn't reachable.

```powershell
cd wingman-expo\server
# one-time: copy env and fill DATABASE_URL (+ OPENAI/Supabase/Composio keys as needed)
copy .env.example .env
npm install

# Option A — local throwaway Postgres in Docker (port 5433):
npm run db:up        # starts postgres:17-alpine; DATABASE_URL in .env.example already points here
# Option B — use the hosted Supabase DB: set DATABASE_URL to the SESSION pooler (:5432) in .env

npm run dev          # Fastify on http://localhost:3002 (tsx watch = auto-reload on save)
```

**Verify it's up:**
```powershell
curl http://localhost:3002/health      # -> {"ok":true,...}
```

- Stop local DB when done: `npm run db:down`.
- Secrets (`OPENAI_API_KEY`, Supabase keys, `COMPOSIO_*`, `VAPID_*`) live in `server/.env` and are never committed. Without `OPENAI_API_KEY` the LLM falls back to a mock; without Composio keys no app tools load — chat + flows still work.

---

## 2. Networking: the API URL (READ THIS FIRST)

The app picks its backend URL in [`features/wingman/api.ts`](features/wingman/api.ts) `getApiBaseUrl()`, in this order:

1. **`EXPO_PUBLIC_API_URL`** env var — if set, always wins.
2. On **native**, the host Metro is served from + `:3002` (i.e. your PC's LAN IP, auto-detected).
3. Fallback **`http://localhost:3002`** (this is what **web** uses).

What that means per target:

| Target | What the app hits | What you must do |
| --- | --- | --- |
| **Web** | `localhost:3002` | Nothing — server on same machine. ✅ |
| **Physical device** (Expo Go or dev client over LAN) | `http://<your-PC-LAN-IP>:3002` (auto) | PC + phone on **same Wi-Fi**; allow Node through the **Windows Firewall**. |
| **Android emulator** | `localhost:3002` → resolves to the *emulator*, not your PC ❌ | Set `EXPO_PUBLIC_API_URL=http://10.0.2.2:3002` (the emulator's alias for host localhost). |
| **iOS simulator** | `localhost:3002` → the Mac host | Works as-is on the Mac. ✅ |

Set the override in `wingman-expo/.env.local`:
```
EXPO_PUBLIC_API_URL=http://10.0.2.2:3002      # Android emulator example
```
`EXPO_PUBLIC_*` vars are inlined at build time — **restart Metro** after changing them.

---

## 3. Dev client vs Expo Go

This project has native modules: `expo-dev-client`, `expo-notifications`, **`expo-speech-recognition`** (voice). Because of those:

- **Expo Go** = fine for most UI/JS iteration, but **native voice and native push will not work** in it.
- **Dev client** = a custom build of *your* app (with its native modules) that still hot-reloads JS like Expo Go. **Required to test mic dictation and push on device.**

You only rebuild the dev client when **native** code/config changes (adding a native module, editing `app.json` plugins). Pure JS/TS changes just hot-reload.

---

## 4. Run on Web

```powershell
cd wingman-expo
npm install
npm run web            # expo start --web ; opens http://localhost:8081
```

- Voice dictation works here (browser Web Speech API). Mic prompt only appears over `localhost` or HTTPS.
- Web Push works over `localhost` (and HTTPS in prod) — not plain HTTP.
- If OAuth callbacks misbehave, make sure `FRONTEND_URL` in `server/.env` matches the web origin you're actually using.

**Debug (Web):**
- Browser **DevTools** (F12): Console for JS errors, **Network** tab to watch calls to `:3002` (check status + CORS).
- A red **CORS** error on the chat stream means the server didn't send `Access-Control-Allow-Origin` — confirm the server reloaded (the SSE CORS fix lives in [`server/src/chat/sse.ts`](server/src/chat/sse.ts)).
- "Request timed out. Check that the Wingman server is running." = server down or wrong URL.

---

## 5. Run on Android

### Emulator or physical device — dev client (recommended)
```powershell
cd wingman-expo
npm install
npm run android        # expo run:android — builds the native app + installs + launches
```
- First run compiles native code (slow). After that, JS hot-reloads; only re-run when native changes.
- Physical device: enable **USB debugging**, plug in, accept the prompt. Confirm with `adb devices`.
- Emulator: start an AVD in Android Studio first (or it'll pick one).
- Remember the [networking](#networking-the-api-url-read-this-first) rule: emulator needs `EXPO_PUBLIC_API_URL=http://10.0.2.2:3002`; physical device uses the auto LAN IP (same Wi-Fi + firewall open).

### Already have a dev client installed? Just start the JS server
```powershell
npm run start:dev-client     # expo start --dev-client --host lan
```

**Debug (Android):**
- **Logs:** the Metro terminal shows JS logs. For native logs: `adb logcat` (filter: `adb logcat *:E ReactNativeJS:V`).
- **Dev menu:** shake the device or `adb shell input keyevent 82`; or press `m` in the Metro terminal. Enable **Fast Refresh**, open the **debugger**, toggle the **perf monitor** from here.
- **Voice not working?** Make sure it's a **dev-client** build (not Expo Go), grant the mic permission, and ensure the device has Google's speech service. Errors surface inline above the composer.
- **Push not arriving?** Needs the dev-client build + a real device (not emulator), permission granted, and `extra.eas.projectId` present in `app.json` (it is). Test endpoint: `POST /push/test`.

---

## 6. Run on iOS

Build iOS from **macOS** (your Mac VM). One-time setup in the VM: install **Xcode** from the App Store, then `xcode-select --install` (Command Line Tools) and open Xcode once to accept the license.

### Simulator (fastest loop)
```bash
cd wingman-expo
npm install
npm run ios            # expo run:ios — builds + boots the iOS Simulator
```
- First build compiles native code (slow); afterwards JS hot-reloads — only re-run on native/plugin changes.
- Simulator hits `localhost:3002` directly (server on the same macOS). If your server runs on the **Windows host** instead of in the VM, point the app at the host: `EXPO_PUBLIC_API_URL=http://<windows-host-IP>:3002` in `.env.local`.
- ⚠️ The Simulator has **no microphone and no push** — those two test only on a **physical iPhone**. Everything else (chat, flows, UI) works in the Simulator.

### Physical iPhone
```bash
npm run ios:device     # expo run:ios --device — pick the connected iPhone
```
- Needs an **Apple Developer account** and the device trusted/signed (Xcode handles signing).
- VM caveat: USB passthrough of an iPhone into a macOS VM can be flaky. If it won't connect, the clean alternative is **EAS Build** (cloud) — no local device wiring:
  ```bash
  npm i -g eas-cli && eas login
  eas build:configure                              # creates eas.json (none yet)
  eas build --profile development --platform ios   # install the dev client via QR/link
  ```
  Then run `npm run start:dev-client` and the installed dev client connects to Metro.

### Already have a dev client installed? Just start the JS server
```bash
npm run start:dev-client     # expo start --dev-client --host lan
```

**Debug (iOS):**
- Metro terminal for JS logs; **Safari → Develop → [device/simulator] → JS context** for console/inspection.
- Native logs via **Console.app** or Xcode's device console.
- Dev menu: `⌘D` (simulator) / shake (device) / press `m` in Metro.
- Networking: simulator → `localhost` (or host IP if server is on Windows); physical device → auto LAN IP (same Wi-Fi, server reachable, firewall open).

---

## 7. Command quick-reference

| Goal | Command (run in…) |
| --- | --- |
| Start server (auto-reload) | `npm run dev` (server/) |
| Local Postgres up / down | `npm run db:up` / `npm run db:down` (server/) |
| Server typecheck / tests | `npm run typecheck` · `npm test` (server/) |
| Web | `npm run web` (wingman-expo/) |
| Android (build+run dev client) | `npm run android` (wingman-expo/) |
| iOS simulator (Mac) | `npm run ios` (wingman-expo/) |
| JS server for existing dev client | `npm run start:dev-client` (wingman-expo/) |
| App typecheck | `npx tsc --noEmit` (wingman-expo/) |
| Rebuild after native/plugin change | re-run `npm run android` / `npm run ios` (or new EAS build) |

---

## 8. Troubleshooting

| Symptom | Likely cause → fix |
| --- | --- |
| Screens show generic/seed data | Server down or unreachable → start it, check `/health`, fix the API URL. |
| "Request timed out…" toast | Wrong API URL for the target (esp. Android emulator → `10.0.2.2`) or firewall blocking `:3002`. |
| CORS error on chat (web) | Server not reloaded after the SSE fix, or wrong origin → restart `npm run dev`. |
| Mic does nothing on device | Running in **Expo Go** instead of a **dev client**, or mic permission denied → rebuild with `npm run android`/`ios`, grant permission. |
| Mic works on web, not native | Expected if not on a dev client; native voice ships native code (rebuild needed). |
| Push never arrives | Emulator/simulator (use real device), permission off, not a dev client, or web-push over plain HTTP (needs HTTPS in prod). |
| Native module "not found" / crash on launch | Added a native dep without rebuilding → re-run `npm run android`/`ios`. |
| Changed `EXPO_PUBLIC_API_URL`, no effect | It's inlined at build time → **restart Metro** (and rebuild for native). |
| Android build can't find device | `adb devices` empty → enable USB debugging / start an AVD. |

---

*Server: Fastify on `:3002` ([`server/src/index.ts`](server/src/index.ts)). App API contract: [`features/wingman/api.ts`](features/wingman/api.ts). Env reference: [`server/.env.example`](server/.env.example). Build progress: [`BUILD_PLAN.md`](BUILD_PLAN.md).*
