const { WebSocketServer, WebSocket } = require('ws');
const config = require('../config/config');
const antigravityService = require('./antigravity.service');
const transcriptService = require('./transcript.service');

class WebSocketService {
  constructor() {
    this.wss = null;
    this.upstreamWs = null;
    this.reconnectTimer = null;
    this.reconnectAttempts = 0;
    this.ideWsConnected = false;
    this.eventHistory = [];
    this.heartbeatInterval = null;
  }

  // Initialize with HTTP server instance
  init(server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupClientListeners();
    this.startHeartbeat();
    this.connectToIdeWebSocket();

    // Initialize real-time brain transcript watcher
    transcriptService.init();
    transcriptService.on('new_items', (newItems) => {
      this.broadcast({
        type: 'transcript_items',
        items: newItems,
        timestamp: new Date().toISOString(),
      });
    });

    transcriptService.on('plan_updated', (planData) => {
      this.broadcast({
        type: 'plan_update',
        ...planData,
        timestamp: new Date().toISOString(),
      });
    });
  }

  // Ring buffer history
  addToHistory(event) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > config.MAX_HISTORY) {
      this.eventHistory.shift();
    }
  }

  getHistory() {
    return [...this.eventHistory];
  }

  // Broadcast payload to all connected mobile clients
  broadcast(data) {
    if (!this.wss) return;
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  // Setup mobile client connection handling
  setupClientListeners() {
    this.wss.on('connection', (clientWs, req) => {
      clientWs.isAlive = true;
      const clientIp = req.socket.remoteAddress;
      console.log(`[Client Connected] IP: ${clientIp} (Total clients: ${this.wss.clients.size})`);

      const canvasState = transcriptService.getState();

      // Send initial handshake state & full agent canvas trajectory
      clientWs.send(JSON.stringify({
        type: 'bridge_init',
        ideWsConnected: this.ideWsConnected,
        ideRestReachable: antigravityService.isRestReachable,
        toggles: antigravityService.getCachedToggles(),
        conversationId: canvasState.conversationId,
        conversationTitle: canvasState.conversationTitle,
        conversations: canvasState.conversations,
        canvasItems: canvasState.items,
        plan: canvasState.plan,
        walkthrough: canvasState.walkthrough,
        history: this.eventHistory.slice(-40),
        timestamp: new Date().toISOString(),
      }));

      clientWs.on('pong', () => {
        clientWs.isAlive = true;
      });

      clientWs.on('message', async (rawMsg) => {
        try {
          const data = JSON.parse(rawMsg.toString());
          if (data.type === 'ping') {
            clientWs.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          } else if (data.type === 'send_prompt' && data.prompt) {
            try {
              const resData = await antigravityService.sendCommand(data.prompt);
              clientWs.send(JSON.stringify({ type: 'prompt_ack', success: true, data: resData }));
            } catch (err) {
              clientWs.send(JSON.stringify({ type: 'prompt_ack', success: false, error: err.message }));
            }
          } else if (data.type === 'toggle' && data.action) {
            try {
              const resData = data.action === 'auto_run'
                ? await antigravityService.toggleAutoRun()
                : await antigravityService.toggleAutoAllow();
              clientWs.send(JSON.stringify({ type: 'toggle_ack', success: true, data: resData }));
            } catch (err) {
              clientWs.send(JSON.stringify({ type: 'toggle_ack', success: false, error: err.message }));
            }
          }
        } catch {
          // Ignore invalid messages
        }
      });

      clientWs.on('close', () => {
        console.log(`[Client Disconnected] Remaining clients: ${this.wss.clients.size}`);
      });
    });
  }

  // Connect to Antigravity IDE upstream WebSocket
  connectToIdeWebSocket() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    console.log(`[Bridge WS] Connecting to Antigravity IDE at ${config.ANTIGRAVITY_WS_URL}...`);

    try {
      this.upstreamWs = new WebSocket(config.ANTIGRAVITY_WS_URL);

      this.upstreamWs.on('open', () => {
        console.log('✅ [Bridge WS] Connected to Antigravity IDE WebSocket.');
        this.ideWsConnected = true;
        this.reconnectAttempts = 0;

        const statusMsg = {
          type: 'bridge_status',
          ideWsConnected: true,
          reconnectAttempts: 0,
          timestamp: new Date().toISOString(),
        };
        this.addToHistory(statusMsg);
        this.broadcast(statusMsg);
      });

      this.upstreamWs.on('message', (data) => {
        let parsed = null;
        const text = data.toString();
        try {
          parsed = JSON.parse(text);
        } catch {
          parsed = { type: 'raw_log', message: text };
        }

        if (!parsed.timestamp) parsed.timestamp = new Date().toISOString();

        this.addToHistory(parsed);
        this.broadcast(parsed);
      });

      this.upstreamWs.on('close', (code, reason) => {
        if (this.ideWsConnected) {
          console.warn(`⚠️ [Bridge WS] Antigravity IDE WebSocket disconnected (code: ${code}, reason: ${reason || 'none'}).`);
        }
        this.ideWsConnected = false;
        this.upstreamWs = null;

        this.broadcast({
          type: 'bridge_status',
          ideWsConnected: false,
          reconnectAttempts: this.reconnectAttempts + 1,
          timestamp: new Date().toISOString(),
        });

        this.scheduleReconnect();
      });

      this.upstreamWs.on('error', (err) => {
        if (err.code === 'ECONNREFUSED') {
          if (this.reconnectAttempts === 0) {
            console.log(`⏳ [Bridge WS] Waiting for Antigravity IDE on ${config.ANTIGRAVITY_WS_URL} (extension starting up)...`);
          }
        } else {
          console.error(`❌ [Bridge WS] Upstream error: ${err.message}`);
        }
      });
    } catch (err) {
      console.error(`❌ [Bridge WS] Exception connecting: ${err.message}`);
      this.scheduleReconnect();
    }
  }

  // Exponential backoff reconnection
  scheduleReconnect() {
    this.reconnectAttempts += 1;
    const backoffDelay = Math.min(1000 * Math.pow(2, Math.min(this.reconnectAttempts - 1, 3)), 10000);
    const jitter = Math.floor(Math.random() * 500);
    const totalDelay = backoffDelay + jitter;

    console.log(`⏳ [Bridge WS] Retrying connection in ${(totalDelay / 1000).toFixed(1)}s (attempt ${this.reconnectAttempts})...`);

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connectToIdeWebSocket();
    }, totalDelay);
  }

  // Heartbeat ping-pong to keep mobile clients alive
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;
      this.wss.clients.forEach((clientWs) => {
        if (clientWs.isAlive === false) {
          console.log('[Heartbeat] Terminating inactive client socket');
          return clientWs.terminate();
        }
        clientWs.isAlive = false;
        clientWs.ping();
      });
    }, config.HEARTBEAT_INTERVAL_MS);
  }

  getClientCount() {
    return this.wss ? this.wss.clients.size : 0;
  }
}

module.exports = new WebSocketService();
