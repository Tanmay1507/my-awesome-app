const antigravityService = require('../services/antigravity.service');
const websocketService = require('../services/websocket.service');

class ActionController {
  constructor() {
    this.pendingStep = null;
    this.latestDecision = null;
  }

  // Handle toggles (auto_run, auto_allow)
  async handleAction(req, res) {
    const actionType = req.params.type;

    try {
      let data;
      if (actionType === 'auto_run') {
        data = await antigravityService.toggleAutoRun();
      } else if (actionType === 'auto_allow') {
        data = await antigravityService.toggleAutoAllow();
      } else {
        return res.status(400).json({ success: false, error: `Unsupported action type: ${actionType}` });
      }

      // Broadcast toggle update to all clients
      const updateEvent = {
        type: 'toggle_updated',
        action: actionType,
        state: data,
        timestamp: new Date().toISOString(),
      };
      websocketService.addToHistory(updateEvent);
      websocketService.broadcast(updateEvent);

      res.json({ success: true, ...data });
    } catch (err) {
      res.status(503).json({
        success: false,
        error: 'Antigravity Extension unreachable on port 5000',
        details: err.message,
      });
    }
  }

  // Handle remote permission decisions from mobile (Run / Reject / Always / Skip)
  async handleDecision(req, res) {
    const { decision } = req.body;
    const validDecisions = ['run', 'reject', 'allow', 'always', 'skip', 'yes'];
    if (!decision || !validDecisions.includes(decision.toLowerCase())) {
      return res.status(400).json({ success: false, error: 'Decision must be run, reject, allow, always, or skip.' });
    }

    const dec = decision.toLowerCase();
    this.latestDecision = {
      decision: dec,
      id: Date.now(),
      timestamp: new Date().toISOString()
    };

    try {
      // Forward to IDE extension port 5000 if active
      await antigravityService.sendDecision(dec).catch(e => {
        // Non-fatal if 5000 is not running; workbench polls 3000 directly
      });
      
      // Clear pending step upon decision
      this.pendingStep = null;

      const event = {
        type: 'permission_decision_made',
        decision: dec,
        timestamp: new Date().toISOString(),
      };
      websocketService.addToHistory(event);
      websocketService.broadcast(event);

      res.json({ success: true, decision: dec });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Receive live notification from IDE workbench that a command/question requires approval
  handlePendingStep(req, res) {
    const { hasPending, title, commandText, options, hasSkip, hasReject } = req.body;
    
    if (hasPending) {
      this.pendingStep = {
        hasPending: true,
        title: title || 'Allow Command Execution?',
        commandText: commandText || 'Command requires approval',
        options: options || ['Yes, allow this time', 'Yes, and always allow in this conversation', 'Skip', 'Reject'],
        hasSkip: hasSkip !== false,
        hasReject: hasReject !== false,
        timestamp: new Date().toISOString(),
      };
    } else {
      this.pendingStep = null;
    }

    const event = {
      type: 'step_requires_input',
      pendingStep: this.pendingStep,
      timestamp: new Date().toISOString(),
    };
    websocketService.addToHistory(event);
    websocketService.broadcast(event);

    res.json({ success: true, pendingStep: this.pendingStep });
  }

  // Get current pending step
  getPendingStep(req, res) {
    res.json({ success: true, pendingStep: this.pendingStep });
  }

  // Get latest decision for workbench polling
  getLatestDecision(req, res) {
    res.json({ success: true, latestDecision: this.latestDecision });
  }

  // Clear latest decision once executed by workbench
  clearDecision(req, res) {
    this.latestDecision = null;
    res.json({ success: true });
  }
}

module.exports = new ActionController();

