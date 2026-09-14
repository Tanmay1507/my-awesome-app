let mysql;
try {
  mysql = require('mysql2/promise');
} catch {
  mysql = null;
}

const config = require('../config/db.config');

class MySQLClient {
  constructor() {
    this.pool = null;
    this.isAvailable = false;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return this.isAvailable;
    this.isInitialized = true;

    if (!mysql) {
      console.warn('[MySQL] mysql2 package not found, falling back to in-memory store.');
      return false;
    }

    try {
      this.pool = mysql.createPool(config.mysql);
      // Test connection
      const connection = await this.pool.getConnection();
      console.log(`[MySQL] ✅ Connected to MySQL database "${config.mysql.database}" at ${config.mysql.host}:${config.mysql.port}`);
      this.isAvailable = true;
      connection.release();

      // Run automatic schema initialization
      await this.runMigrations();
      return true;
    } catch (err) {
      console.warn(`[MySQL] ⚠️ MySQL not reachable (${err.message}). Using resilient in-memory storage fallback.`);
      this.isAvailable = false;
      return false;
    }
  }

  async runMigrations() {
    if (!this.isAvailable || !this.pool) return;
    try {
      // 1. Users Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          username VARCHAR(100) NOT NULL,
          name VARCHAR(150),
          email VARCHAR(255),
          avatar_url TEXT,
          provider VARCHAR(32) DEFAULT 'github',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_username (username)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Agent Devices Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS agent_devices (
          device_token VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          agent_name VARCHAR(150) DEFAULT 'Desktop Agent',
          last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_user_id (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Sessions Table
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          session_id VARCHAR(128) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          device_token VARCHAR(128) NOT NULL,
          agent_name VARCHAR(150),
          mobile_user_id VARCHAR(64),
          created_at BIGINT NOT NULL,
          expires_at BIGINT NOT NULL,
          is_active TINYINT(1) DEFAULT 1,
          INDEX idx_session_user (user_id),
          INDEX idx_session_device (device_token),
          INDEX idx_session_expires (expires_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      console.log('[MySQL] ✅ Database tables verified/migrated successfully.');
    } catch (err) {
      console.warn(`[MySQL] Table migration warning: ${err.message}`);
    }
  }

  async query(sql, params = []) {
    if (!this.isAvailable || !this.pool) {
      return null;
    }
    try {
      const [rows] = await this.pool.query(sql, params);
      return rows;
    } catch (err) {
      console.error(`[MySQL] Query error: ${err.message}`);
      return null;
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.isAvailable = false;
    }
  }
}

module.exports = new MySQLClient();
