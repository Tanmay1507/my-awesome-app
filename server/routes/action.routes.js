const express = require('express');
const actionController = require('../controllers/action.controller');

const router = express.Router();

router.post('/decision', (req, res) => actionController.handleDecision(req, res));
router.get('/latest_decision', (req, res) => actionController.getLatestDecision(req, res));
router.post('/clear_decision', (req, res) => actionController.clearDecision(req, res));
router.post('/pending_step', (req, res) => actionController.handlePendingStep(req, res));
router.get('/pending_step', (req, res) => actionController.getPendingStep(req, res));
router.post('/:type', (req, res) => actionController.handleAction(req, res));

module.exports = router;

