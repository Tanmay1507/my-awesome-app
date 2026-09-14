const crypto = require('crypto');
const mysqlClient = require('../db/mysql.client');

class AuthService {
  constructor() {
    // In-memory fallback map
    this.users = new Map();
    // Pre-seed default developer account
    const defaultUser = {
      id: 'usr_tanmay',
      username: 'tanmay1507',
      name: 'Tanmay Wagh',
      email: 'tanmay@example.com',
      avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
      provider: 'github',
    };
    this.users.set(defaultUser.id, defaultUser);
    // Initialize MySQL async
    mysqlClient.init().catch(() => {});
  }

  // Save or update user in MySQL + memory
  async persistUser(user) {
    this.users.set(user.id, user);
    if (mysqlClient.isAvailable) {
      try {
        await mysqlClient.query(
          `INSERT INTO users (id, username, name, email, avatar_url, provider)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             username = VALUES(username),
             name = VALUES(name),
             email = VALUES(email),
             avatar_url = VALUES(avatar_url)`,
          [user.id, user.username, user.name, user.email, user.avatarUrl, user.provider || 'github']
        );
      } catch (err) {
        console.warn(`[AuthService] MySQL persistUser warning: ${err.message}`);
      }
    }
  }

  // Generate a random device token for a local desktop agent
  generateDeviceToken(userId = 'usr_tanmay') {
    const randomHex = crypto.randomBytes(16).toString('hex');
    const deviceToken = `dt_${randomHex}`;
    return {
      deviceToken,
      userId,
      createdAt: new Date().toISOString(),
    };
  }

  // Exchange or simulate GitHub OAuth
  async authenticateGitHub({ code, mockUser }) {
    if (mockUser) {
      const user = {
        id: mockUser.id || `usr_${mockUser.username || 'github_user'}`,
        username: mockUser.username || 'developer',
        name: mockUser.name || 'GitHub Developer',
        email: mockUser.email || `${mockUser.username || 'dev'}@github.com`,
        avatarUrl: mockUser.avatarUrl || 'https://avatars.githubusercontent.com/u/583231?v=4',
        provider: 'github',
      };
      await this.persistUser(user);
      const token = this.generateUserToken(user.id);
      return { success: true, user, token };
    }

    // Standard GitHub OAuth code exchange if credentials are provided
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET && code) {
      try {
        const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code,
          }),
        });
        const tokenData = await tokenRes.json();
        if (tokenData.access_token) {
          const userRes = await fetch('https://api.github.com/user', {
            headers: {
              Authorization: `Bearer ${tokenData.access_token}`,
              'User-Agent': 'Antigravity-Remote',
            },
          });
          const ghUser = await userRes.json();
          const user = {
            id: `usr_gh_${ghUser.id}`,
            username: ghUser.login,
            name: ghUser.name || ghUser.login,
            email: ghUser.email,
            avatarUrl: ghUser.avatar_url,
            provider: 'github',
          };
          await this.persistUser(user);
          const token = this.generateUserToken(user.id);
          return { success: true, user, token };
        }
      } catch (err) {
        console.error('[AuthService] GitHub OAuth exchange error:', err.message);
      }
    }

    // Fallback default dev profile
    const defaultUser = this.users.get('usr_tanmay');
    await this.persistUser(defaultUser);
    const token = this.generateUserToken(defaultUser.id);
    return { success: true, user: defaultUser, token };
  }

  // Create an authentication bearer token
  generateUserToken(userId) {
    const signature = crypto.createHmac('sha256', 'antigravity_secret_key_2026').update(userId).digest('hex').slice(0, 16);
    return `auth_${userId}_${signature}`;
  }

  // Verify and decode an authentication token
  async verifyUserToken(token) {
    if (!token || !token.startsWith('auth_')) return null;
    const parts = token.split('_');
    if (parts.length < 3) return null;
    const userId = `${parts[1]}_${parts[2]}`;

    // Check memory first
    if (this.users.has(userId)) {
      return this.users.get(userId);
    }

    // Check MySQL
    if (mysqlClient.isAvailable) {
      try {
        const rows = await mysqlClient.query('SELECT * FROM users WHERE id = ? LIMIT 1', [userId]);
        if (rows && rows.length > 0) {
          const u = rows[0];
          const user = {
            id: u.id,
            username: u.username,
            name: u.name,
            email: u.email,
            avatarUrl: u.avatar_url,
            provider: u.provider,
          };
          this.users.set(user.id, user);
          return user;
        }
      } catch {}
    }

    return this.users.get(parts[1]) || {
      id: parts[1],
      username: 'developer',
      name: 'GitHub Developer',
    };
  }

  getUser(userId) {
    return this.users.get(userId) || null;
  }
}

module.exports = new AuthService();
