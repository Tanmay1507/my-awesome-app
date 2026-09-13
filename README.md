# 🚀 Antigravity Mobile Remote Controller (MVP)

A lightweight, mobile-responsive web application and bridge server designed to remotely prompt, control, and monitor your local **Google Antigravity IDE** from your smartphone (iOS Safari / Android Chrome).

Inspired by modern, tactile OLED dark UI designs, featuring high-contrast typography, interactive bento action cards, real-time activity stream, and instant phone pairing.

---

## 📱 Features

- **OLED Dark Bento Aesthetic**: Minimalist deep black (`#000000`) theme with tactile rounded cards (`rounded-[26px]`), circular SVG rings, and glassmorphic floating input dock.
- **Bi-directional WebSocket Relay**: Relays live agent tokens, thoughts, and tool execution logs from `ws://127.0.0.1:9812` to your phone with exponential backoff auto-reconnect.
- **Action Toggles**:
  - `⚡ Auto-Run`: Fast toggle for autonomous tool execution.
  - `🛡️ Auto-Allow`: Fast toggle for permission bypass.
- **Terminal & Prompt Stream**:
  - Live syntax-highlighted code blocks with one-tap copy.
  - Auto-scroll lock with floating "Jump to latest" button.
  - Quick prompt chips (`Run Tests`, `Git Status`, `Auto-Fix`, `Status`).
- **Resilience & Safety**:
  - Explicit warning banner when Antigravity port 5000 is unreachable.
  - 25-second WebSocket heartbeat / ping-pong to prevent mobile browsers from dropping the connection while idling.
- **Instant Pairing**:
  - Built-in QR code generator in the settings modal for instantaneous phone connection over local Wi-Fi.
  - PWA-ready: "Add to Home Screen" on iOS Safari and Android Chrome for a full-screen app experience.

---

## 🛠️ Prerequisites

Ensure Google Antigravity IDE is running locally with its companion automation extension:
- **REST Port**: `http://127.0.0.1:5000`
- **WebSocket Port**: `ws://127.0.0.1:9812`

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Bridge Server
```bash
npm start
```
*(Or for auto-reload during development: `npm run dev`)*

When started, the server outputs your local and network URLs:
```text
======================================================
🚀 Antigravity Mobile Remote Bridge Server Active!
======================================================
💻 Local:            http://localhost:3000
📱 Mobile (Wi-Fi):   http://192.168.1.15:3000
⚡ Upstream REST:    http://127.0.0.1:5000
📡 Upstream WS:      ws://127.0.0.1:9812
======================================================
```

---

## 📱 Connecting Your Phone

### Option A: Local Wi-Fi (Same Network)
1. Ensure your phone is connected to the same Wi-Fi network as your computer.
2. Open `http://localhost:3000` on your desktop browser.
3. Click the **Sliders / Settings** icon (`⚙️` / `Sliders`) in the top-right header to view the **QR Code**.
4. Scan the QR code with your phone camera (or manually open `http://<YOUR_LOCAL_IP>:3000` in Safari or Chrome).

### Option B: Cellular / Remote Access (via Ngrok)
To access Antigravity Remote while outside your home network or on cellular data:
```bash
npx ngrok http 3000
```
Copy the generated `https://xxxx.ngrok-free.app` URL and open it on your phone.

### Option C: Cloudflare Tunnel (Free & No Account Needed)
```bash
npx untun@latest tunnel http://localhost:3000
```

---

## 📲 Add to Home Screen (PWA Mode)
- **iOS (Safari)**: Tap the **Share** button (box with arrow pointing up) → tap **Add to Home Screen** → tap **Add**.
- **Android (Chrome)**: Tap the three-dot menu `⋮` → tap **Add to Home screen** / **Install app**.

---

## 📂 Codebase Architecture

```text
├── server.js              # Express HTTP server + WebSocket relay + backoff + health probe
├── public/
│   ├── index.html         # Single Page Mobile Web UI (Tailwind CDN, Lucide, Marked, Highlight.js, QR)
│   ├── manifest.json      # PWA Web App Manifest
│   └── icon.svg           # High-resolution vector app icon
├── package.json           # Dependencies: express, ws, cors
└── README.md
```
