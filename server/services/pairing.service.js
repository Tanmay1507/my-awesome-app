const crypto = require('crypto');
const mysqlClient = require('../db/mysql.client');
const redisClient = require('../db/redis.client');

class PairingService {
  constructor() {
    // In-memory fallback stores
    this.registeredAgents = new Map();
    this.pairingCodes = new Map();
    this.activeSessions = new Map();

    // Initialize MySQL & Redis clients asynchronously
    mysqlClient.init().catch(() => {});
    redisClient.init().catch(() => {});

    // Periodic cleanup for memory fallback
    setInterval(() => this.cleanupExpired(), 10000);
  }

  // Register local desktop agent with device token
  async registerAgent({ deviceToken, userId, agentName = 'Desktop Agent' }) {
    if (!deviceToken) {
      deviceToken = `dt_${crypto.randomBytes(12).toString('hex')}`;
    }
    const agent = {
      deviceToken,
      userId: userId || 'usr_tanmay',
      agentName,
      registeredAt: Date.now(),
    };

    this.registeredAgents.set(deviceToken, agent);

    // Persist to MySQL if available
    if (mysqlClient.isAvailable) {
      try {
        await mysqlClient.query(
          `INSERT INTO agent_devices (device_token, user_id, agent_name)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             agent_name = VALUES(agent_name),
             last_seen_at = CURRENT_TIMESTAMP`,
          [agent.deviceToken, agent.userId, agent.agentName]
        );
      } catch (err) {
        console.warn(`[PairingService] MySQL agent save warning: ${err.message}`);
      }
    }

    return agent;
  }

  // Generate an ephemeral 6-digit pairing code (TTL: 90 seconds)
  async generatePairingCode(deviceToken) {
    let agent = this.registeredAgents.get(deviceToken);
    if (!agent && mysqlClient.isAvailable) {
      try {
        const rows = await mysqlClient.query('SELECT * FROM agent_devices WHERE device_token = ? LIMIT 1', [deviceToken]);
        if (rows && rows.length > 0) {
          agent = {
            deviceToken: rows[0].device_token,
            userId: rows[0].user_id,
            agentName: rows[0].agent_name,
          };
          this.registeredAgents.set(deviceToken, agent);
        }
      } catch {}
    }

    if (!agent) {
      agent = { deviceToken, userId: 'usr_tanmay', agentName: 'Desktop Agent' };
      this.registeredAgents.set(deviceToken, agent);
    }

    // Generate numeric 6-digit code (e.g. 748291)
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const ttlSeconds = 90;
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const entry = {
      code,
      deviceToken,
      userId: agent.userId,
      agentName: agent.agentName,
      expiresAt,
      ttlSeconds,
    };

    // 1. Store in Redis with 90s TTL
    await redisClient.setPairingCode(code, entry, ttlSeconds);

    // 2. Memory backup
    this.pairingCodes.set(code, entry);

    return entry;
  }

  // Verify pairing request from mobile app
  // 1. Checks code existence & expiration in Redis / Memory (<90s)
  // 2. Checks if mobile user account matches agent user account
  // 3. Creates 24-hour scoped session and saves in Redis + MySQL
  async verifyAndPair({ code, mobileUserId, mobileUserToken }) {
    const cleanCode = (code || '').toString().trim().replace(/[-\s]/g, '');

    // Check Redis first, then memory fallback
    let entry = await redisClient.getPairingCode(cleanCode);
    if (!entry) {
      entry = this.pairingCodes.get(cleanCode);
    }

    if (!entry) {
      return {
        success: false,
        error: 'INVALID_CODE',
        message: 'Invalid pairing code. Please check the code in your desktop terminal.',
      };
    }

    if (Date.now() > entry.expiresAt) {
      await redisClient.delPairingCode(cleanCode);
      this.pairingCodes.delete(cleanCode);
      return {
        success: false,
        error: 'CODE_EXPIRED',
        message: 'Pairing code has expired. A fresh code has been generated on your desktop.',
      };
    }

    // Security Check: Verify matching accounts (agent account vs mobile GitHub account)
    if (entry.userId && mobileUserId && entry.userId !== mobileUserId) {
      return {
        success: false,
        error: 'ACCOUNT_MISMATCH',
        message: `Account mismatch! Desktop agent belongs to account "${entry.userId}", but mobile app is signed in as "${mobileUserId}". Please log into the same GitHub account.`,
      };
    }

    // Consume pairing code immediately
    await redisClient.delPairingCode(cleanCode);
    this.pairingCodes.delete(cleanCode);

    // Create 24-Hour Scoped Session
    const sessionId = `sess_${crypto.randomBytes(16).toString('hex')}`;
    const sessionTtlSeconds = 24 * 60 * 60; // 24 hours
    const expiresAt = Date.now() + sessionTtlSeconds * 1000;

    const session = {
      sessionId,
      userId: entry.userId,
      deviceToken: entry.deviceToken,
      agentName: entry.agentName,
      mobileUserId,
      createdAt: Date.now(),
      expiresAt,
      expiresAtFormatted: new Date(expiresAt).toISOString(),
    };

    // 1. Cache in Redis with 24h TTL
    await redisClient.cacheSession(sessionId, session, sessionTtlSeconds);

    // 2. Memory backup
    this.activeSessions.set(sessionId, session);

    // 3. Persist to MySQL
    if (mysqlClient.isAvailable) {
      try {
        await mysqlClient.query(
          `INSERT INTO sessions (session_id, user_id, device_token, agent_name, mobile_user_id, created_at, expires_at, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
          [session.sessionId, session.userId, session.deviceToken, session.agentName, session.mobileUserId, session.createdAt, session.expiresAt]
        );
      } catch (err) {
        console.warn(`[PairingService] MySQL session save warning: ${err.message}`);
      }
    }

    return {
      success: true,
      session,
      message: 'Successfully paired! Scoped 24-hour session established.',
    };
  }

  // Validate an active session token
  async validateSession(sessionId) {
    if (!sessionId) return null;

    // 1. Check Redis cache
    const cached = await redisClient.getCachedSession(sessionId);
    if (cached) {
      if (Date.now() > cached.expiresAt) {
        await redisClient.delCachedSession(sessionId);
        return null;
      }
      return cached;
    }

    // 2. Check Memory
    const memSession = this.activeSessions.get(sessionId);
    if (memSession) {
      if (Date.now() > memSession.expiresAt) {
        this.activeSessions.delete(sessionId);
        return null;
      }
      return memSession;
    }

    // 3. Check MySQL
    if (mysqlClient.isAvailable) {
      try {
        const rows = await mysqlClient.query(
          'SELECT * FROM sessions WHERE session_id = ? AND is_active = 1 LIMIT 1',
          [sessionId]
        );
        if (rows && rows.length > 0) {
          const row = rows[0];
          if (Date.now() > row.expires_at) {
            return null;
          }
          const session = {
            sessionId: row.session_id,
            userId: row.user_id,
            deviceToken: row.device_token,
            agentName: row.agent_name,
            mobileUserId: row.mobile_user_id,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
          };
          this.activeSessions.set(sessionId, session);
          await redisClient.cacheSession(sessionId, session, Math.floor((row.expires_at - Date.now()) / 1000));
          return session;
        }
      } catch {}
    }

    return null;
  }

  // Revoke / disconnect session
  async revokeSession(sessionId) {
    await redisClient.delCachedSession(sessionId);
    this.activeSessions.delete(sessionId);
    if (mysqlClient.isAvailable) {
      try {
        await mysqlClient.query('UPDATE sessions SET is_active = 0 WHERE session_id = ?', [sessionId]);
      } catch {}
    }
  }

  // Periodic cleanup of expired entries in memory
  cleanupExpired() {
    const now = Date.now();
    for (const [code, entry] of this.pairingCodes.entries()) {
      if (now > entry.expiresAt) {
        this.pairingCodes.delete(code);
      }
    }
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now > session.expiresAt) {
        this.activeSessions.delete(sessionId);
      }
    }
  }
}

module.exports = new PairingService();
