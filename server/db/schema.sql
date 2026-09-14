-- Antigravity Mobile Remote Database Schema (MySQL)

CREATE DATABASE IF NOT EXISTS antigravity_db;
USE antigravity_db;

-- 1. Users Table (GitHub OAuth accounts)
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

-- 2. Agent Devices Table (Desktop IDE Agent instances)
CREATE TABLE IF NOT EXISTS agent_devices (
  device_token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  agent_name VARCHAR(150) DEFAULT 'Desktop Agent',
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Scoped 24h Sessions Table (Bound phone + desktop sessions)
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
