const express = require('express');
const promptRoutes = require('./prompt.routes');
const actionRoutes = require('./action.routes');
const healthRoutes = require('./health.routes');
const canvasRoutes = require('./canvas.routes');
const authRoutes = require('./auth.routes');
const relayRoutes = require('./relay.routes');

const router = express.Router();

// Mount individual route modules
router.use('/auth', authRoutes);
router.use('/relay', relayRoutes);
router.use('/prompt', promptRoutes);
router.use('/action', actionRoutes);
router.use('/canvas', canvasRoutes);
router.use('/', healthRoutes);

module.exports = router;

