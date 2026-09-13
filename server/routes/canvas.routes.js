const express = require('express');
const canvasController = require('../controllers/canvas.controller');

const router = express.Router();

router.get('/session', (req, res) => canvasController.getSession(req, res));
router.get('/plan', (req, res) => canvasController.getPlan(req, res));
router.get('/conversations', (req, res) => canvasController.getConversations(req, res));
router.post('/switch/:id', (req, res) => canvasController.switchConversation(req, res));
router.post('/new', (req, res) => canvasController.startNewChat(req, res));


module.exports = router;
