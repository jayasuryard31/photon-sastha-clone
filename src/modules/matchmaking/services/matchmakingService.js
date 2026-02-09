const { createRedisStore } = require('./redisStore');

const generateGameId = () => `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const createMatchmakingService = ({ redis }) => {
  const store = createRedisStore(redis);

  const buildPlayer = (socketId, payload = {}) => ({
    id: socketId,
    username: payload.username || `player-${socketId.slice(0, 5)}`,
    position: payload.position || { x: 0, y: 0 },
    score: payload.score ?? 0,
    room: payload.room || null,
  });

  const saveLobbyAndMatch = async (lobby) => {
    await store.saveLobby(lobby);
    await store.saveMatch({
      gameId: lobby.gameId,
      players: lobby.players,
      room: lobby.room,
      status: lobby.status || 'active',
      masterClientId: lobby.hostId,
    });
  };

  const registerPlayer = async (socketId, payload = {}) => {
    const existing = await store.getPlayer(socketId);
    const player = existing ? { ...existing, ...payload, id: socketId } : buildPlayer(socketId, payload);
    await store.savePlayer(player);
    return player;
  };

  const updatePlayerPosition = async (socketId, delta = { x: 0, y: 0 }) => {
    const player = await store.getPlayer(socketId);
    if (!player) return null;
    player.position = {
      x: (player.position?.x || 0) + (delta.x || 0),
      y: (player.position?.y || 0) + (delta.y || 0),
    };
    await store.savePlayer(player);
    return player;
  };

  const assignPlayerRoom = async (socketId, room) => {
    const player = await store.getPlayer(socketId);
    const base = player || buildPlayer(socketId, {});
    const withRoom = { ...base, room };
    await store.savePlayer(withRoom);
    return withRoom;
  };

  const createLobby = async (hostId) => {
    const gameId = generateGameId();
    const lobby = { gameId, room: `room:${gameId}`, hostId, players: [hostId], status: 'open' };
    await saveLobbyAndMatch(lobby);
    await assignPlayerRoom(hostId, lobby.room);
    return lobby;
  };

  const joinLobby = async (gameId, playerId) => {
    const lobby = await store.getLobby(gameId);
    if (!lobby) return null;

    if (!lobby.players.includes(playerId)) {
      lobby.players.push(playerId);
    }
    await saveLobbyAndMatch(lobby);
    await assignPlayerRoom(playerId, lobby.room);
    return lobby;
  };

  const removePlayerFromLobbies = async (playerId) => {
    const lobbies = await store.listLobbies();
    for (const lobby of lobbies) {
      const idx = lobby.players.indexOf(playerId);
      if (idx === -1) continue;

      lobby.players.splice(idx, 1);
      let newHostId = lobby.hostId;

      if (lobby.hostId === playerId) {
        newHostId = lobby.players[0] || null;
        lobby.hostId = newHostId;
      }

      if (!lobby.players.length) {
        await store.removeLobby(lobby.gameId);
        await store.removeMatch(lobby.gameId);
        return { lobby: null, removed: true, deleted: true, newHostId: null };
      }

      await saveLobbyAndMatch(lobby);
      return { lobby, removed: true, deleted: false, newHostId };
    }
    return { lobby: null, removed: false, deleted: false, newHostId: null };
  };

  const getGameState = async () => {
    const [players, matches, lobbies] = await Promise.all([
      store.listPlayers(),
      store.listMatches(),
      store.listLobbies(),
    ]);

    return {
      players: players.reduce((acc, player) => {
        acc[player.id] = player;
        return acc;
      }, {}),
      matches,
      lobbies,
      isGameActive: matches.some((m) => m.status === 'active'),
    };
  };

  const endMatch = async (gameId) => {
    const match = await store.getMatch(gameId);
    if (!match) return null;
    const updated = { ...match, status: 'ended' };
    await store.saveMatch(updated);
    await store.removeLobby(gameId);
    return updated;
  };

  return {
    registerPlayer,
    getPlayer: (socketId) => store.getPlayer(socketId),
    updatePlayerPosition,
    removePlayer: (socketId) => store.removePlayer(socketId),
    assignPlayerRoom,
    createLobby,
    joinLobby,
    removePlayerFromLobbies,
    getGameState,
    listLobbies: () => store.listLobbies(),
    listMatches: () => store.listMatches(),
    getMatch: (gameId) => store.getMatch(gameId),
    endMatch,
  };
};

module.exports = { createMatchmakingService };
