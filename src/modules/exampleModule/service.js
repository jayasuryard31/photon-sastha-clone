const redisClient = require('../../config/redisClient');

const createExampleService = async () => {
    const redis = await redisClient.createRedisClient();

    const getData = async () => {
        // Example of using Redis; replace with real logic
        const cachedData = await redis.get('example:data');
        if (cachedData) {
            return JSON.parse(cachedData);
        }

        const data = { message: 'Hello from example service', ts: new Date().toISOString() };
        await redis.set('example:data', JSON.stringify(data), { EX: 60 }); // Cache for 60 seconds
        return data;
    };

    return {
        getData,
    };
};

module.exports = { createExampleService };
