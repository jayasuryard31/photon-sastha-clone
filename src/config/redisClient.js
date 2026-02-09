const { createClient } = require('redis');
const { config } = require('./index');

const createRedisClient = async (url = config.redisUrl) => {
  const client = createClient({ url });

  client.on('error', (err) => {
    console.error('[redis] client error', err);
  });

  await client.connect();
  console.log(`[redis] connected to ${url}`);
  return client;
};

module.exports = { createRedisClient };
