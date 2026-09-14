const express = require('express');
const pairingService = require('../services/pairing.service');
const authService = require('../services/auth.service');

const router = express.Router();

// 1. Agent registers with device token
router.post('/agent/register', async (req, res) => {
  try {
    const { deviceToken, userId = 'usr_tanmay', agentName = 'Desktop Agent' } = req.body;
    const agent = await pairingService.registerAgent({ deviceToken, userId, agentName });
    const pairing = await pairingService.generatePairingCode(agent.deviceToken);
    res.json({
      success: true,
      agent,
      pairing: {
        code: pairing.code,
        expiresAt: pairing.expiresAt,
        ttlSeconds: pairing.ttlSeconds,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Agent requests a fresh pairing code (when previous expires)
router.post('/agent/pairing-code', async (req, res) => {
  try {
    const { deviceToken } = req.body;
    if (!deviceToken) {
      return res.status(400).json({ success: false, error: 'deviceToken required' });
    }
    const pairing = await pairingService.generatePairingCode(deviceToken);
    res.json({
      success: true,
      pairing: {
        code: pairing.code,
        expiresAt: pairing.expiresAt,
        ttlSeconds: pairing.ttlSeconds,
      },
    });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Phone submits 6-digit pairing code to pair with desktop agent
router.post('/phone/pair', async (req, res) => {
  try {
    const { code, mobileUserId, mobileUserToken } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, error: 'Pairing code required' });
    }

    // Verify bearer token or mobileUserId
    let resolvedUserId = mobileUserId;
    if (req.headers.authorization) {
      const token = req.headers.authorization.replace('Bearer ', '').trim();
      const verified = await authService.verifyUserToken(token);
      if (verified) resolvedUserId = verified.id;
    }

    const result = await pairingService.verifyAndPair({
      code,
      mobileUserId: resolvedUserId || 'usr_tanmay',
      mobileUserToken,
    });

    if (!result.success) {
      const statusCode = result.error === 'ACCOUNT_MISMATCH' ? 403 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Validate an existing session
router.get('/session/:sessionId', async (req, res) => {
  const session = await pairingService.validateSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ success: false, error: 'Session expired or not found' });
  }
  res.json({ success: true, session });
});

// 5. Revoke session
router.post('/session/:sessionId/revoke', async (req, res) => {
  await pairingService.revokeSession(req.params.sessionId);
  res.json({ success: true, message: 'Session revoked' });
});

module.exports = router;
