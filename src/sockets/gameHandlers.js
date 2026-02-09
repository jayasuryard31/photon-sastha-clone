const createGameEventHandlers = ({ matchmakingService }) => {
  const emitState = async (socket) => {
    const state = await matchmakingService.getState();
    socket.emit('demo:state', state);
  };

  const gameEventHandlers = (socket, _io) => {
    // Send current state on connect
    emitState(socket);

    socket.on('demo:ping', () => {
      socket.emit('demo:pong', { ts: Date.now() });
    });

    socket.on('demo:set', async (payload = {}) => {
      const next = await matchmakingService.setState(payload);
      socket.emit('demo:state', next);
    });

    socket.on('disconnect', async () => {
      // Nothing to clean up in the template; placeholder for future logic
      await matchmakingService.clearState();
    });
  };

  return {
    gameEventHandlers,
    getGameState: () => matchmakingService.getState(),
    queueJoin: async () => null,
    queueLeave: () => undefined,
    getActiveGames: () => [],
    listLobbies: () => [],
  };
};

module.exports = { createGameEventHandlers };
