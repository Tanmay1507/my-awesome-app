# 🗺️ GRAPHPY — Codebase Architecture Reference

> Auto-generated reference map for `my-awesome-app` (Antigravity Mobile Remote Bridge)

---

## 📦 Project Overview

This is a **Node.js Express + WebSocket bridge server** paired with a **React Native / Expo mobile app**.  
The server acts as a relay between a mobile client and the Antigravity IDE extension running locally on the desktop.

```
Mobile App (Expo/React Native)
        │
        │  WebSocket (ws://<local-ip>:3000/ws)
        │  REST API  (http://<local-ip>:3000/api/...)
        ▼
  [ Bridge Server ] ← → [ Antigravity IDE Extension ]
   server.js                REST: http://127.0.0.1:5000
                            WS:   ws://127.0.0.1:9812
```

---

## 🗂️ File & Module Dependency Graph

```
server.js  (Entry Point)
│
├── server/config/config.js          ← All env/port constants
│
├── server/routes/index.js           ← Root API router  (/api/*)
│   ├── /prompt  → prompt.routes.js  → prompt.controller.js
│   ├── /action  → action.routes.js  → action.controller.js
│   ├── /canvas  → canvas.routes.js  → canvas.controller.js
│   └── /        → health.routes.js  → health.controller.js
│
└── server/services/websocket.service.js  ← WebSocket hub (init'd here)
    ├── server/services/antigravity.service.js  ← REST proxy to IDE port 5000
    └── server/services/transcript.service.js   ← Brain dir file watcher (JSONL parser)
```

---

## 📄 File-by-File Reference

### `server.js` — Entry Point

| Role       | Details                                                        |
| ---------- | -------------------------------------------------------------- |
| Framework  | Express + `http.createServer()`                                |
| Middleware | `cors`, `express.json`, `express.urlencoded`, `express.static` |
| Mounts     | `app.use('/api', apiRoutes)`                                   |
| WS init    | `websocketService.init(server)`                                |
| Exports    | `{ app, server }`                                              |

---

### `server/config/config.js` — Configuration

| Key                     | Default                 |
| ----------------------- | ----------------------- |
| `PORT`                  | `3000`                  |
| `HOST`                  | `0.0.0.0`               |
| `ANTIGRAVITY_REST_URL`  | `http://127.0.0.1:5000` |
| `ANTIGRAVITY_WS_URL`    | `ws://127.0.0.1:9812`   |
| `PUBLIC_DIR`            | `../../public`          |
| `MAX_HISTORY`           | `100`                   |
| `HEARTBEAT_INTERVAL_MS` | `25000`                 |

---

### `server/services/websocket.service.js` — WebSocket Hub

**Singleton exported via `module.exports = new WebSocketService()`**

| Method                    | Description                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `init(server)`            | Creates WSS on `/ws`, sets up heartbeat, connects to IDE WS, inits transcript watcher |
| `setupClientListeners()`  | Handles mobile client connection; sends `bridge_init` on connect                      |
| `connectToIdeWebSocket()` | Connects upstream to `ws://127.0.0.1:9812`; relays messages to all mobile clients     |
| `scheduleReconnect()`     | Exponential backoff (max 10s + 500ms jitter)                                          |
| `startHeartbeat()`        | Pings all mobile clients every 25s; terminates dead connections                       |
| `broadcast(data)`         | Sends JSON to all OPEN mobile clients                                                 |
| `addToHistory(event)`     | Ring buffer (max 100 events)                                                          |
| `getHistory()`            | Returns copy of ring buffer                                                           |
| `getClientCount()`        | Returns `wss.clients.size`                                                            |

**Events subscribed from `transcriptService`:**

- `new_items` → broadcasts `{ type: 'transcript_items', items }`
- `plan_updated` → broadcasts `{ type: 'plan_update', ...planData }`

**Incoming WS message types from mobile:**
| Message Type | Action |
|---|---|
| `ping` | Responds with `pong` |
| `send_prompt` | Calls `antigravityService.sendCommand()`, acks with `prompt_ack` |
| `toggle` (auto_run / auto_allow) | Calls toggle methods on `antigravityService`, acks with `toggle_ack` |

---

### `server/services/transcript.service.js` — Brain File Watcher

**Singleton exported via `module.exports = new TranscriptService()`**  
Extends `EventEmitter`.

**State:**
| Property | Type | Purpose |
|---|---|---|
| `baseBrainDir` | string | `~/.gemini/antigravity-ide/brain` |
| `activeConversationId` | string or null | Currently tracked conversation UUID |
| `activeConversationDir` | string or null | Full path to convo dir |
| `transcriptPath` | string or null | Path to `transcript.jsonl` |
| `lastProcessedOffset` | number | Byte offset for incremental reads |
| `cachedItems` | array | Parsed transcript items |
| `cachedPlan` | string | `implementation_plan.md` content |
| `cachedWalkthrough` | string | `walkthrough.md` content |
| `_conversationPinned` | bool | Prevents auto-jumping on new convo creation |

**Methods:**
| Method | Description |
|---|---|
| `init()` | Finds active convo, loads transcript + artifacts, pins convo, starts polling |
| `findActiveConversation()` | Scans `brain/` dir for most recently modified `transcript.jsonl` |
| `getActiveTitle()` | Derives title from `implementation_plan.md`, first user message, session ID |
| `getConversationList()` | Returns sorted array of all convos with `{id, title, preview, isActive, updatedAt}` |
| `switchConversation(targetId)` | Explicitly switches active convo; re-pins and reloads |
| `parseTranscriptLine(line)` | Parses one JSONL line into `user`, `agent`, or `tool_result` item |
| `loadInitialTranscript()` | Reads entire transcript; populates `cachedItems` |
| `loadArtifacts()` | Reads `implementation_plan.md` + `walkthrough.md` into cache |
| `checkForUpdates()` | Reads new bytes since `lastProcessedOffset`; emits `new_items` |
| `checkArtifactUpdates()` | Diffs cached vs disk artifacts; emits `plan_updated` |
| `startWatching()` | Polls `checkForUpdates()` every **800ms** |
| `getState()` | Returns `{ conversationId, conversationTitle, conversations, items, plan, walkthrough }` |
| `stop()` | Clears poll interval |

**Parsed item shapes:**

```js
// type: 'user'
{ id, stepIndex, type: 'user', role: 'user', text, timestamp }

// type: 'agent'
{ id, stepIndex, type: 'agent', role: 'agent', thinking, content, toolCalls: [{name, action, summary, args}], timestamp }

// type: 'tool_result'
{ id, stepIndex, type: 'tool_result', role: 'system', toolName, status, exitCode, summary, timestamp }
```

---

### `server/services/antigravity.service.js` — IDE REST Proxy

**Singleton exported via `module.exports = new AntigravityService()`**

| Method                   | HTTP Target               | Description                               |
| ------------------------ | ------------------------- | ----------------------------------------- |
| `probeHealth(timeoutMs)` | `GET /license_status`     | Checks if IDE is reachable (2.5s timeout) |
| `sendCommand(prompt)`    | `POST /send_command`      | Forwards prompt text to IDE               |
| `toggleAutoRun()`        | `POST /toggle_auto_run`   | Toggles auto-run, caches state            |
| `toggleAutoAllow()`      | `POST /toggle_auto_allow` | Toggles auto-allow, caches state          |
| `sendDecision(decision)` | `POST /send_command`      | Sends run/reject/allow decision           |
| `getCachedToggles()`     | —                         | Returns `{ auto_run, auto_allow, usage }` |

---

## 🛣️ REST API Routes

### `/api/prompt/*`

| Method | Path                 | Description                                                    |
| ------ | -------------------- | -------------------------------------------------------------- |
| POST   | `/api/prompt/`       | Forwards user prompt to IDE; broadcasts `user_prompt` WS event |
| GET    | `/api/prompt/latest` | Returns last submitted prompt                                  |
| POST   | `/api/prompt/clear`  | Clears stored latest prompt                                    |

### `/api/action/*`

| Method | Path                          | Body / Params                             | Description                                              |
| ------ | ----------------------------- | ----------------------------------------- | -------------------------------------------------------- |
| POST   | `/api/action/decision`        | `{ decision }`                            | Forwards decision, broadcasts `permission_decision_made` |
| GET    | `/api/action/latest_decision` | —                                         | Polled by workbench JS                                   |
| POST   | `/api/action/clear_decision`  | —                                         | Clears stored decision                                   |
| POST   | `/api/action/pending_step`    | `{ hasPending, title, commandText, ... }` | Stores pending step; broadcasts `step_requires_input`    |
| GET    | `/api/action/pending_step`    | —                                         | Returns current pending step                             |
| POST   | `/api/action/:type`           | `:type = auto_run or auto_allow`          | Proxies toggle; broadcasts `toggle_updated`              |

### `/api/canvas/*`

| Method | Path                        | Description                                             |
| ------ | --------------------------- | ------------------------------------------------------- |
| GET    | `/api/canvas/session`       | Full transcript state + items                           |
| GET    | `/api/canvas/plan`          | `implementation_plan.md` + `walkthrough.md`             |
| GET    | `/api/canvas/conversations` | All conversation list                                   |
| POST   | `/api/canvas/switch/:id`    | Switch active convo; broadcasts `conversation_switched` |
| POST   | `/api/canvas/new`           | Sends `/new_chat` to IDE                                |

### `/api/*` (Health)

| Method | Path           | Description                                       |
| ------ | -------------- | ------------------------------------------------- |
| GET    | `/api/health`  | Full health check (REST + WS + clients + toggles) |
| GET    | `/api/status`  | Cached toggle values only                         |
| GET    | `/api/info`    | Local IPs + upstream URLs                         |
| GET    | `/api/history` | Ring buffer of last 100 WS events                 |

---

## 🔌 WebSocket Event Types

### Server → Mobile Client

| Event Type                 | When Sent                                            | Key Payload Fields                                                                 |
| -------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `bridge_init`              | On client connect                                    | `ideWsConnected`, `canvasItems`, `conversations`, `plan`, `walkthrough`, `history` |
| `bridge_status`            | IDE WS connects/disconnects                          | `ideWsConnected`, `reconnectAttempts`                                              |
| `transcript_items`         | New transcript lines detected                        | `items: [...]`                                                                     |
| `plan_update`              | `implementation_plan.md` or `walkthrough.md` changes | `type`, `content`                                                                  |
| `conversation_switched`    | Canvas switch                                        | `conversationId`, `canvasItems`, `plan`, `walkthrough`                             |
| `toggle_updated`           | Toggle changed via REST                              | `action`, `state`                                                                  |
| `permission_decision_made` | Decision submitted                                   | `decision`                                                                         |
| `step_requires_input`      | Workbench posts pending step                         | `pendingStep`                                                                      |
| `user_prompt`              | Prompt forwarded to IDE                              | `prompt`                                                                           |
| `prompt_ack`               | After `send_prompt` WS message                       | `success`, `data` or `error`                                                       |
| `toggle_ack`               | After `toggle` WS message                            | `success`, `data` or `error`                                                       |
| `pong`                     | In response to mobile `ping`                         | `timestamp`                                                                        |

### Mobile Client → Server (WS)

| Message Type  | Payload                                  | Response     |
| ------------- | ---------------------------------------- | ------------ |
| `ping`        | —                                        | `pong`       |
| `send_prompt` | `{ prompt }`                             | `prompt_ack` |
| `toggle`      | `{ action: 'auto_run' or 'auto_allow' }` | `toggle_ack` |

---

## ⚠️ Code Issues Found

### 🔴 Bugs / Dead Code

| File                                                                                                        | Line        | Issue                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`transcript.service.js`](file:///e:/saas/new_app/my-awesome-app/server/services/transcript.service.js#L3)  | L3          | `readline` is imported but **never used** — dead import, safe to remove                                                                                       |
| [`action.controller.js`](file:///e:/saas/new_app/my-awesome-app/server/controllers/action.controller.js#L6) | constructor | `this.latestDecision` is **not initialized** in constructor but assigned at runtime (L52); accessing it before first decision returns `undefined`, not `null` |
| [`websocket.service.js`](file:///e:/saas/new_app/my-awesome-app/server/services/websocket.service.js#L76)   | L76-89      | Initial `clientWs.send(...)` (bridge_init) is **not wrapped in try/catch** — race condition if client disconnects instantly after handshake                   |

### 🟡 Warnings

| File                                                                                                          | Issue                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`transcript.service.js`](file:///e:/saas/new_app/my-awesome-app/server/services/transcript.service.js#L400)  | `checkForUpdates` stream has **no error handler** — `stream.on('error', ...)` is missing; file deletion/lock during poll will throw unhandled exception |
| [`transcript.service.js`](file:///e:/saas/new_app/my-awesome-app/server/services/transcript.service.js#L487)  | `stop()` is defined but **never called on process exit** — the 800ms interval will keep running; add `process.on('exit', ...)` handler                  |
| [`antigravity.service.js`](file:///e:/saas/new_app/my-awesome-app/server/services/antigravity.service.js#L66) | `toggleAutoRun/toggleAutoAllow` calls `res.json()` **before** checking `res.ok` — if non-JSON error body, the unhandled rejection propagates            |

### 🟢 Good Practices Observed

- Exponential backoff with jitter for WS reconnection ✅
- Ring buffer pattern for event history (max 100) ✅
- Conversation pinning to prevent auto-jump on prompt send ✅
- Incremental file reading via byte offset (no re-read entire file) ✅
- Heartbeat ping-pong for dead client detection + termination ✅
- Consistent singleton pattern via `module.exports = new X()` ✅
- `AbortController` for fetch timeout in `probeHealth` ✅
- Metadata stripped from transcript lines before display ✅

---

## 🧭 End-to-End Data Flow

```
1. Server starts → websocketService.init(server)
   ├── transcriptService.init()
   │   ├── findActiveConversation() → scans ~/.gemini/.../brain/ for newest transcript.jsonl
   │   ├── loadInitialTranscript() → parses full JSONL → cachedItems[]
   │   ├── loadArtifacts() → reads implementation_plan.md + walkthrough.md
   │   └── startWatching() → poll every 800ms
   └── connectToIdeWebSocket() → ws://127.0.0.1:9812

2. Mobile connects via WebSocket
   └── receives bridge_init { ideWsConnected, canvasItems, conversations, plan, walkthrough, history }

3. Agent responds (writes transcript.jsonl on disk)
   → 800ms poll detects new bytes (offset diff)
   → parseTranscriptLine() → new items
   → emit('new_items') → broadcast('transcript_items') → mobile UI updates

4. Mobile sends send_prompt (WS) or POST /api/prompt/
   → antigravityService.sendCommand()
   → POST http://127.0.0.1:5000/send_command
   → IDE processes → writes transcript.jsonl → step 3 picks it up

5. IDE sends tool approval request (workbench JS polls bridge)
   → POST /api/action/pending_step { hasPending: true, ... }
   → broadcast('step_requires_input') → mobile shows approval UI
   → Mobile POST /api/action/decision { decision: 'run' }
   → Workbench polls GET /api/action/latest_decision → executes approved command
   → POST /api/action/clear_decision (cleanup)
```
