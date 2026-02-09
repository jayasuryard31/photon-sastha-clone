const { createGameEventHandlers } = require('./gameHandlers');

const createNoopService = () => ({
  registerPlayer: async () => null,
  updatePlayerPosition: async () => null,
  removePlayer: async () => null,
  removePlayerFromLobbies: async () => ({ removed: false }),
  assignPlayerRoom: async () => null,
  createLobby: async () => null,
  joinLobby: async () => null,
  getGameState: async () => ({ players: {}, matches: [], lobbies: [], isGameActive: false }),
  listMatches: async () => [],
  listLobbies: async () => [],
});

const setupSocket = (io, deps = {}) => {
  const fallbackService = createNoopService();
  const handlers = createGameEventHandlers({ matchmakingService: deps.matchmakingService || fallbackService });

  io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    handlers.gameEventHandlers(socket, io);

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = { setupSocket };
