const createGameEventHandlers = ({ matchmakingService }) => {
  const emitPlayerState = async (socket, io) => {
    const state = await matchmakingService.getGameState();
    socket.emit('game:state', state);
  };

  const createLobbyForHost = async (socket, io) => {
    if (!socket) return null;
    const lobby = await matchmakingService.createLobby(socket.id);
    if (!lobby) return null;
    socket.join(lobby.room);
    const player = await matchmakingService.assignPlayerRoom(socket.id, lobby.room);

    const payload = { gameId: lobby.gameId, players: lobby.players, room: lobby.room, masterClientId: lobby.hostId };
    socket.emit('match:found', payload);
    socket.emit('match:joined', payload);
    io.to(lobby.room).emit('player:joined', [player]);
    return payload;
  };

  const joinLobbyById = async (socket, io, gameId) => {
    if (!socket || !gameId) return null;
    const lobby = await matchmakingService.joinLobby(gameId, socket.id);
    if (!lobby) return null;

    socket.join(lobby.room);
    await matchmakingService.assignPlayerRoom(socket.id, lobby.room);

    const payload = { gameId: lobby.gameId, players: lobby.players, room: lobby.room, masterClientId: lobby.hostId };
    socket.emit('match:joined', payload);
    io.to(lobby.room).emit('match:found', payload);

    const state = await matchmakingService.getGameState();
    const roster = lobby.players.map((id) => state.players[id]).filter(Boolean);
    io.to(lobby.room).emit('player:joined', roster);
    return payload;
  };

  const gameEventHandlers = (socket, io) => {
    socket.on('player:join', async (payload = {}) => {
      const player = await matchmakingService.registerPlayer(socket.id, payload);
      await emitPlayerState(socket, io);
      socket.emit('player:joined', player);
      socket.broadcast.emit('player:joined', player);
    });

    socket.on('player:move', async (movementData = { x: 0, y: 0 }) => {
      const player = await matchmakingService.updatePlayerPosition(socket.id, movementData);
      if (!player) return;

      if (player.room) {
        io.to(player.room).emit('player:moved', { id: socket.id, position: player.position });
      } else {
        socket.broadcast.emit('player:moved', { id: socket.id, position: player.position });
      }
    });

    socket.on('queue:join', async () => {
      await createLobbyForHost(socket, io);
    });

    socket.on('lobby:join', async ({ gameId } = {}) => {
      const payload = await joinLobbyById(socket, io, gameId);
      if (!payload) {
        socket.emit('lobby:error', { error: 'lobby not found' });
      }
    });

    socket.on('queue:leave', () => {
      // No-op placeholder for future queue logic
    });

    socket.on('disconnect', async () => {
      const player = await matchmakingService.getPlayer(socket.id);
      await matchmakingService.removePlayer(socket.id);
      const lobbyUpdate = await matchmakingService.removePlayerFromLobbies(socket.id);

      if (lobbyUpdate.removed && lobbyUpdate.lobby && lobbyUpdate.newHostId) {
        io.to(lobbyUpdate.lobby.room).emit('master:changed', { gameId: lobbyUpdate.lobby.gameId, masterClientId: lobbyUpdate.newHostId });
      }

      const targetRoom = player?.room;

      if (targetRoom) {
        io.to(targetRoom).emit('player:disconnected', socket.id);
      } else {
        socket.broadcast.emit('player:disconnected', socket.id);
      }
    });
  };

  return {
    gameEventHandlers,
    getGameState: () => matchmakingService.getGameState(),
    queueJoin: (socketId, io) => {
      const socket = io.sockets?.sockets?.get(socketId);
      return createLobbyForHost(socket, io);
    },
    queueLeave: () => undefined,
    getActiveGames: () => matchmakingService.listMatches(),
    listLobbies: () => matchmakingService.listLobbies(),
  };
};

module.exports = { createGameEventHandlers };
