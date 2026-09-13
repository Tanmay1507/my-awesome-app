const antigravityService = require('../services/antigravity.service');
const websocketService = require('../services/websocket.service');

class PromptController {
  constructor() {
    this.latestPrompt = null;
  }

  async sendPrompt(req, res) {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Prompt cannot be empty.' });
    }

    const cleanPrompt = prompt.trim();
    this.latestPrompt = {
      prompt: cleanPrompt,
      id: Date.now(),
      timestamp: new Date().toISOString()
    };

    let extResult = null;
    try {
      extResult = await antigravityService.sendCommand(cleanPrompt);
    } catch (e) {
      console.warn('[Prompt] Port 5000 forward notice:', e.message);
    }

    // Broadcast user prompt event to mobile clients
    const event = {
      type: 'user_prompt',
      timestamp: new Date().toISOString(),
      prompt: cleanPrompt,
    };
    websocketService.addToHistory(event);
    websocketService.broadcast(event);

    res.json({ success: true, ...extResult, prompt: cleanPrompt });
  }

  getLatestPrompt(req, res) {
    res.json({ success: true, latestPrompt: this.latestPrompt });
  }

  clearLatestPrompt(req, res) {
    this.latestPrompt = null;
    res.json({ success: true });
  }
}

module.exports = new PromptController();
