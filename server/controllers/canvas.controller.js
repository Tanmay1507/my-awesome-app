const transcriptService = require('../services/transcript.service');
const websocketService = require('../services/websocket.service');
const antigravityService = require('../services/antigravity.service');

class CanvasController {
  // Get active session items and conversation info
  getSession(req, res) {
    try {
      const state = transcriptService.getState();
      res.json({
        success: true,
        conversationId: state.conversationId,
        conversationTitle: state.conversationTitle,
        conversations: state.conversations,
        itemsCount: state.items.length,
        items: state.items,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Get list of all agent conversations
  getConversations(req, res) {
    try {
      const state = transcriptService.getState();
      res.json({
        success: true,
        activeId: state.conversationId,
        activeTitle: state.conversationTitle,
        conversations: state.conversations,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Switch active conversation by ID
  switchConversation(req, res) {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'Conversation ID required.' });
    }

    try {
      const switched = transcriptService.switchConversation(id);
      if (!switched) {
        return res.status(404).json({ success: false, error: `Conversation ${id} not found.` });
      }

      const state = transcriptService.getState();

      // Broadcast switch to all connected mobile clients
      websocketService.broadcast({
        type: 'conversation_switched',
        conversationId: state.conversationId,
        conversationTitle: state.conversationTitle,
        conversations: state.conversations,
        canvasItems: state.items,
        plan: state.plan,
        walkthrough: state.walkthrough,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        conversationId: state.conversationId,
        conversationTitle: state.conversationTitle,
        itemsCount: state.items.length,
        items: state.items,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Start new conversation remotely
  async startNewChat(req, res) {
    try {
      // Trigger new chat in Antigravity IDE
      const data = await antigravityService.sendCommand('/new_chat');
      res.json({ success: true, message: 'New conversation requested in Antigravity IDE', data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  getPlan(req, res) {
    try {
      const state = transcriptService.getState();
      res.json({
        success: true,
        conversationId: state.conversationId,
        conversationTitle: state.conversationTitle,
        plan: state.plan,
        walkthrough: state.walkthrough,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new CanvasController();

