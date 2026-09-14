let Redis;
try {
  Redis = require('ioredis');
} catch {
  Redis = null;
}

const config = require('../config/db.config');

class RedisClient {
  constructor() {
    this.client = null;
    this.isAvailable = false;
    this.isInitialized = false;
    // In-memory fallback map if Redis is not running
    this.memoryFallback = new Map();
  }

  async init() {
    if (this.isInitialized) return this.isAvailable;
    this.isInitialized = true;

    if (!Redis) {
      console.warn('[Redis] ioredis package not found, using in-memory cache.');
      return false;
    }

    try {
      if (config.redis.url) {
        this.client = new Redis(config.redis.url, {
          connectTimeout: config.redis.connectTimeout,
          maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
          retryStrategy: config.redis.retryStrategy,
          lazyConnect: true,
        });
      } else {
        this.client = new Redis({
          host: config.redis.host,
          port: config.redis.port,
          password: config.redis.password,
          connectTimeout: config.redis.connectTimeout,
          maxRetriesPerRequest: config.redis.maxRetriesPerRequest,
          retryStrategy: config.redis.retryStrategy,
          lazyConnect: true,
        });
      }

      this.client.on('error', (err) => {
        // Suppress repeated connection logs after initial warning
        if (this.isAvailable) {
          console.warn(`[Redis] Connection warning: ${err.message}`);
          this.isAvailable = false;
        }
      });

      await this.client.connect();
      console.log(`[Redis] ✅ Connected to Redis at ${config.redis.host}:${config.redis.port}`);
      this.isAvailable = true;
      return true;
    } catch (err) {
      console.warn(`[Redis] ⚠️ Redis not reachable (${err.message}). Using resilient in-memory cache fallback.`);
      this.isAvailable = false;
      return false;
    }
  }

  // --- Ephemeral Pairing Codes (TTL in seconds, default 90) ---
  async setPairingCode(code, data, ttlSeconds = 90) {
    const key = `pair:${code}`;
    const payload = JSON.stringify(data);

    if (this.isAvailable && this.client) {
      try {
        await this.client.set(key, payload, 'EX', ttlSeconds);
        return true;
      } catch (err) {
        console.warn(`[Redis] setPairingCode error: ${err.message}`);
      }
    }

    // Memory fallback
    this.memoryFallback.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async getPairingCode(code) {
    const key = `pair:${code}`;

    if (this.isAvailable && this.client) {
      try {
        const raw = await this.client.get(key);
        if (raw) return JSON.parse(raw);
      } catch (err) {
        console.warn(`[Redis] getPairingCode error: ${err.message}`);
      }
    }

    // Memory fallback
    const entry = this.memoryFallback.get(key);
    if (entry) {
      if (Date.now() > entry.expiresAt) {
        this.memoryFallback.delete(key);
        return null;
      }
      return entry.data;
    }
    return null;
  }

  async delPairingCode(code) {
    const key = `pair:${code}`;
    if (this.isAvailable && this.client) {
      try {
        await this.client.del(key);
      } catch {}
    }
    this.memoryFallback.delete(key);
  }

  // --- Scoped Sessions (TTL in seconds, default 24h = 86400) ---
  async cacheSession(sessionId, sessionData, ttlSeconds = 86400) {
    const key = `session:${sessionId}`;
    const payload = JSON.stringify(sessionData);

    if (this.isAvailable && this.client) {
      try {
        await this.client.set(key, payload, 'EX', ttlSeconds);
        return true;
      } catch (err) {
        console.warn(`[Redis] cacheSession error: ${err.message}`);
      }
    }

    // Memory fallback
    this.memoryFallback.set(key, {
      data: sessionData,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return true;
  }

  async getCachedSession(sessionId) {
    const key = `session:${sessionId}`;

    if (this.isAvailable && this.client) {
      try {
        const raw = await this.client.get(key);
        if (raw) return JSON.parse(raw);
      } catch (err) {
        console.warn(`[Redis] getCachedSession error: ${err.message}`);
      }
    }

    // Memory fallback
    const entry = this.memoryFallback.get(key);
    if (entry) {
      if (Date.now() > entry.expiresAt) {
        this.memoryFallback.delete(key);
        return null;
      }
      return entry.data;
    }
    return null;
  }

  async delCachedSession(sessionId) {
    const key = `session:${sessionId}`;
    if (this.isAvailable && this.client) {
      try {
        await this.client.del(key);
      } catch {}
    }
    this.memoryFallback.delete(key);
  }

  async close() {
    if (this.client) {
      await this.client.quit().catch(() => {});
      this.isAvailable = false;
    }
  }
}

module.exports = new RedisClient();
