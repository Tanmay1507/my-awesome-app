const express = require('express');
const authService = require('../services/auth.service');

const router = express.Router();

// GitHub OAuth or mock login endpoint
router.post('/github', async (req, res) => {
  try {
    const { code, mockUser } = req.body;
    const result = await authService.authenticateGitHub({ code, mockUser });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Quick Dev Login for testing
router.post('/dev-login', async (req, res) => {
  try {
    const { username = 'tanmay1507', name = 'Tanmay Wagh', userId = 'usr_tanmay' } = req.body;
    const result = await authService.authenticateGitHub({
      mockUser: { id: userId, username, name, avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4' }
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get current user profile from bearer token
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  const user = authService.verifyUserToken(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'Unauthorized token' });
  }
  res.json({ success: true, user });
});

module.exports = router;
