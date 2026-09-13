const config = require('../config/config');
const antigravityService = require('../services/antigravity.service');
const websocketService = require('../services/websocket.service');
const { getLocalIPs } = require('../utils/network.utils');

class HealthController {
  // GET /api/health
  async getHealth(req, res) {
    const probe = await antigravityService.probeHealth(2500);
    res.json({
      status: probe.reachable && websocketService.ideWsConnected ? 'healthy' : 'degraded',
      antigravityRest: {
        reachable: probe.reachable,
        latencyMs: probe.latency,
        url: config.ANTIGRAVITY_REST_URL,
        error: probe.error || null,
      },
      antigravityWs: {
        connected: websocketService.ideWsConnected,
        reconnectAttempts: websocketService.reconnectAttempts,
        url: config.ANTIGRAVITY_WS_URL,
      },
      clientsConnected: websocketService.getClientCount(),
      toggles: antigravityService.getCachedToggles(),
      localIps: getLocalIPs(),
      port: config.PORT,
    });
  }

  // GET /api/status (Cached toggles)
  getStatus(req, res) {
    res.json({
      success: true,
      ...antigravityService.getCachedToggles(),
    });
  }

  // GET /api/info (Network & Server URLs)
  getInfo(req, res) {
    res.json({
      port: config.PORT,
      localIps: getLocalIPs(),
      antigravityRestUrl: config.ANTIGRAVITY_REST_URL,
      antigravityWsUrl: config.ANTIGRAVITY_WS_URL,
    });
  }

  // GET /api/history
  getHistory(req, res) {
    res.json({ history: websocketService.getHistory() });
  }
}

module.exports = new HealthController();
