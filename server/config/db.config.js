const fs = require('fs');
const path = require('path');

// Auto-load .env file if available
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath) && process.loadEnvFile) {
  try {
    process.loadEnvFile(envPath);
  } catch {}
}

module.exports = {
  mysql: {
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'antigravity_db',
    connectionLimit: parseInt(process.env.MYSQL_POOL_LIMIT || '10', 10),
    connectTimeout: 3000,
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL || undefined,
    connectTimeout: 3000,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) return null; // stop reconnecting after 3 tries
      return Math.min(times * 200, 1000);
    },
  },
};
