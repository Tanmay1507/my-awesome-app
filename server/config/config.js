const path = require('path');
const os = require('os');
const fs = require('fs');

// Auto-load .env file if available
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath) && process.loadEnvFile) {
  try {
    process.loadEnvFile(envPath);
  } catch {}
}

module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '0.0.0.0',
  ANTIGRAVITY_REST_URL: process.env.ANTIGRAVITY_REST_URL || 'http://127.0.0.1:5000',
  ANTIGRAVITY_WS_URL: process.env.ANTIGRAVITY_WS_URL || 'ws://127.0.0.1:9812',
  BRAIN_DIR: process.env.BRAIN_DIR || process.env.ANTIGRAVITY_BRAIN_DIR || path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain'),
  PUBLIC_DIR: path.join(__dirname, '../../public'),
  MAX_HISTORY: 100,
  HEARTBEAT_INTERVAL_MS: 25000,
};

