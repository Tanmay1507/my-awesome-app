const http = require('http');
const express = require('express');
const cors = require('cors');

const config = require('./server/config/config');
const apiRoutes = require('./server/routes');
const websocketService = require('./server/services/websocket.service');
const { getLocalIPs } = require('./server/utils/network.utils');

// Initialize Express App
const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(config.PUBLIC_DIR));

// Mount Modular API Routes
app.use('/api', apiRoutes);

// Create HTTP Server Instance
const server = http.createServer(app);

// Initialize WebSocket Relay & Heartbeat Service
websocketService.init(server);

// Start Server Listening
server.listen(config.PORT, config.HOST, () => {
  const localIps = getLocalIPs();
  console.log(`\n======================================================`);
  console.log(`🚀 Antigravity Mobile Remote Bridge Server Active!`);
  console.log(`======================================================`);
  console.log(`💻 Local:            http://localhost:${config.PORT}`);
  localIps.forEach((ip) => {
    console.log(`📱 Mobile (Wi-Fi):   http://${ip}:${config.PORT}`);
  });
  console.log(`⚡ Upstream REST:    ${config.ANTIGRAVITY_REST_URL}`);
  console.log(`📡 Upstream WS:      ${config.ANTIGRAVITY_WS_URL}`);
  console.log(`======================================================\n`);
});

module.exports = { app, server };
