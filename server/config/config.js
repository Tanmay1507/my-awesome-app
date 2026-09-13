const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  ANTIGRAVITY_REST_URL: process.env.ANTIGRAVITY_REST_URL || 'http://127.0.0.1:5000',
  ANTIGRAVITY_WS_URL: process.env.ANTIGRAVITY_WS_URL || 'ws://127.0.0.1:9812',
  PUBLIC_DIR: path.join(__dirname, '../../public'),
  MAX_HISTORY: 100,
  HEARTBEAT_INTERVAL_MS: 25000,
};
