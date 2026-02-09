const parse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (err) {
    console.error('[redisStore] failed to parse value', { value, err });
    return null;
  }
};

const scanKeys = async (redis, pattern) => {
  const keys = [];
  for await (const key of redis.scanIterator({ MATCH: pattern })) {
    keys.push(key);
  }
  return keys;
};

const createRedisStore = (redis) => {
  const key = {
    player: (id) => `player:${id}`,
    match: (id) => `match:${id}`,
    lobby: (id) => `lobby:${id}`,
  };

  const get = async (redisKey) => parse(await redis.get(redisKey));
  const set = (redisKey, value) => redis.set(redisKey, JSON.stringify(value));
  const del = (redisKey) => redis.del(redisKey);

  const listByPattern = async (pattern) => {
    const keys = await scanKeys(redis, pattern);
    if (!keys.length) return [];
    const values = await redis.mGet(keys);
    return values.map(parse).filter(Boolean);
  };

  return {
    // Players
    savePlayer: (player) => set(key.player(player.id), player),
    getPlayer: (playerId) => get(key.player(playerId)),
    removePlayer: (playerId) => del(key.player(playerId)),
    listPlayers: () => listByPattern('player:*'),

    // Matches
    saveMatch: (match) => set(key.match(match.gameId), match),
    getMatch: (gameId) => get(key.match(gameId)),
    removeMatch: (gameId) => del(key.match(gameId)),
    listMatches: () => listByPattern('match:*'),

    // Lobbies
    saveLobby: (lobby) => set(key.lobby(lobby.gameId), lobby),
    getLobby: (gameId) => get(key.lobby(gameId)),
    removeLobby: (gameId) => del(key.lobby(gameId)),
    listLobbies: () => listByPattern('lobby:*'),
  };
};

module.exports = { createRedisStore };
