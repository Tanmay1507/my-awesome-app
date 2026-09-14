const config = require('../config/config');

class AntigravityService {
  constructor() {
    this.cachedToggles = {
      auto_run: false,
      auto_allow: false,
      usage: null,
    };
    this.isRestReachable = false;
    this.lastLatencyMs = null;
  }

  // Probe REST health using /license_status (does not consume queued commands)
  async probeHealth(timeoutMs = 2500) {
    const startTime = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${config.ANTIGRAVITY_REST_URL}/license_status`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      const latency = Date.now() - startTime;
      if (res.ok) {
        this.isRestReachable = true;
        this.lastLatencyMs = latency;
        return { reachable: true, latency };
      }
      this.isRestReachable = false;
      return { reachable: false, latency, error: `HTTP ${res.status}` };
    } catch (err) {
      clearTimeout(timer);
      this.isRestReachable = false;
      return { reachable: false, latency: Date.now() - startTime, error: err.message };
    }
  }

  // Forward prompt to Antigravity IDE (/send_command)
  async sendCommand(prompt) {
    const textPayload = prompt.trim();
    const res = await fetch(`${config.ANTIGRAVITY_REST_URL}/send_command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: textPayload, command: textPayload }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Antigravity Extension returned status ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // Toggle Auto-Run
  async toggleAutoRun() {
    const res = await fetch(`${config.ANTIGRAVITY_REST_URL}/toggle_auto_run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Antigravity Extension returned status ${res.status}`);
    }
    if (typeof data.auto_run === 'boolean') {
      this.cachedToggles.auto_run = data.auto_run;
    }
    return data;
  }

  // Toggle Auto-Allow
  async toggleAutoAllow() {
    const res = await fetch(`${config.ANTIGRAVITY_REST_URL}/toggle_auto_allow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Antigravity Extension returned status ${res.status}`);
    }
    if (typeof data.auto_allow === 'boolean') {
      this.cachedToggles.auto_allow = data.auto_allow;
    }
    return data;
  }

  // Send remote permission decision (run, reject, allow)
  async sendDecision(decision) {
    const actionPayload = {
      action: decision === 'reject' ? 'reject_command' : 'run_command',
      decision: decision,
      text: decision === 'reject' ? '/reject' : '/run',
      command: decision,
    };

    const res = await fetch(`${config.ANTIGRAVITY_REST_URL}/send_command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(actionPayload),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `Antigravity Extension returned status ${res.status}`);
    }
    return data;
  }

  // Get current cached toggles
  getCachedToggles() {
    return { ...this.cachedToggles };
  }
}


module.exports = new AntigravityService();
