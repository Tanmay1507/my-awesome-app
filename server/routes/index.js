const express = require('express');
const promptRoutes = require('./prompt.routes');
const actionRoutes = require('./action.routes');
const healthRoutes = require('./health.routes');
const canvasRoutes = require('./canvas.routes');

const router = express.Router();

// Mount individual route modules
router.use('/prompt', promptRoutes);
router.use('/action', actionRoutes);
router.use('/canvas', canvasRoutes);
router.use('/', healthRoutes);

module.exports = router;
