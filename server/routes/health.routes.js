const express = require('express');
const healthController = require('../controllers/health.controller');

const router = express.Router();

router.get('/health', (req, res) => healthController.getHealth(req, res));
router.get('/status', (req, res) => healthController.getStatus(req, res));
router.get('/info', (req, res) => healthController.getInfo(req, res));
router.get('/history', (req, res) => healthController.getHistory(req, res));

module.exports = router;
