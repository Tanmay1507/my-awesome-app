const express = require('express');
const promptController = require('../controllers/prompt.controller');

const router = express.Router();

router.post('/', (req, res) => promptController.sendPrompt(req, res));
router.get('/latest', (req, res) => promptController.getLatestPrompt(req, res));
router.post('/clear', (req, res) => promptController.clearLatestPrompt(req, res));

module.exports = router;
