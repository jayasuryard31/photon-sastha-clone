const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { config } = require('./config');
const { buildRouter } = require('./routes');
const { setupPhotonSocket } = require('./sockets/photonHandlers');
const { createRedisClient } = require('./config/redisClient');
const { createPlayerService } = require('./services/playerService');
const { createRoomService } = require('./services/roomService');
const { createLobbyService } = require('./services/lobbyService');
const { createCleanupService } = require('./services/cleanupService');
const morgan = require('morgan');

(async () => {
  const app = express();
  app.use(morgan('combined'));
  app.use(express.json());

  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
  });

  // Initialize Redis
  const redis = await createRedisClient();

  // Initialize Photon services
  console.log('[Photon] Initializing services...');
  const playerService = await createPlayerService();
  const roomService = await createRoomService();
  const lobbyService = await createLobbyService(roomService, playerService);
  const cleanupService = await createCleanupService(redis, playerService, roomService);

  // Start cleanup service (runs every 5 minutes)
  cleanupService.start();

  const services = {
    playerService,
    roomService,
    lobbyService,
    cleanupService,
  };

  // Health check
  app.get('/health', (_req, res) => res.status(200).json({ 
    status: 'ok', 
    mode: 'photon-multiplayer',
    services: ['player', 'room', 'lobby', 'rpc'],
  }));

  // Setup Photon socket handlers
  setupPhotonSocket(io, services);

  // Setup REST API routes
  app.use('/api', buildRouter({ io, ...services }));

  const shutdown = async () => {
    console.log('\n[Photon] Shutting down...');
    cleanupService.stop();
    await redis.quit();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║        Photon PUN Multiplayer Backend - Ready           ║
╠═══════════════════════════════════════════════════════════╣
║  Server:  http://localhost:${config.port}                        ║
║  WebSocket: ws://localhost:${config.port}                        ║
║  Health:  http://localhost:${config.port}/health                 ║
║  Lobby:   http://localhost:${config.port}/api/lobby              ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
})().catch((err) => {
  console.error('[Photon] Failed to start server', err);
  process.exit(1);
});
