const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { config } = require('./config');
const { buildRouter } = require('./routes');
const { setupSocket } = require('./sockets');
const { createRedisClient } = require('./config/redisClient');
const { createMatchmakingService } = require('./modules/matchmaking/services/matchmakingService');

(async () => {
  const app = express();
  app.use(express.json());

  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
  });

  const redis = await createRedisClient();
  const matchmakingService = createMatchmakingService({ redis });

  app.get('/health', (_req, res) => res.status(200).send('ok'));
  app.use('/api', buildRouter({ io, matchmakingService }));

  setupSocket(io, { matchmakingService });

  const shutdown = async () => {
    console.log('\n[server] shutting down');
    await redis.quit();
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  server.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
  });
})().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
