const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { config } = require('./config');
const { buildRouter } = require('./routes');
const { setupSocket } = require('./sockets');
const { createRedisClient } = require('./config/redisClient');
const morgan = require('morgan');

(async () => {
  const app = express();
  app.use(morgan('combined'));
  app.use(express.json());

  const server = createServer(app);
  const io = new Server(server, {
    cors: { origin: config.corsOrigin, methods: ['GET', 'POST'] },
  });

  const redis = await createRedisClient();

  app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', mode: 'template' }));
  app.use('/api', buildRouter({ io }));

  setupSocket(io);

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
