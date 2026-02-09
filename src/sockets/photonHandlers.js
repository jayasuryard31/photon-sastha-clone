const { RPCService } = require('../services/rpcService');

/**
 * Photon PUN-inspired socket event handlers
 * Manages player connections, room lifecycle, and real-time events
 */
function createPhotonHandlers(io, services) {
  const { playerService, roomService, lobbyService } = services;
  const rpcService = new RPCService(io, roomService);

  /**
   * Handle player connection - entering the lobby
   */
  async function handleConnection(socket) {
    console.log(`[Photon] Player connected: ${socket.id}`);

    try {
      // Register player in lobby
      const player = await playerService.registerPlayer(socket.id, {
        username: socket.handshake.query.username || `Player_${socket.id.slice(0, 6)}`,
      });

      // Send lobby state
      const lobbyState = await lobbyService.getLobbyState();
      socket.emit('lobby:joined', {
        playerId: player.playerId,
        lobbyState,
      });

      // Broadcast updated lobby stats to all
      io.emit('lobby:stats', await lobbyService.getLobbyStats());
    } catch (error) {
      console.error('[Photon] Connection error:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle create room request
   */
  async function handleCreateRoom(socket, data) {
    try {
      const { roomName, maxPlayers, metadata } = data;

      if (!roomName || !maxPlayers) {
        socket.emit('error', { message: 'Room name and maxPlayers required' });
        return;
      }

      // Create room
      const room = await roomService.createRoom(
        roomName,
        maxPlayers,
        socket.id,
        metadata
      );

      // Update player's current room
      await playerService.setPlayerRoom(socket.id, room.roomId);

      // Emit OnJoinedRoom to creator
      socket.emit('room:joined', {
        room,
        role: 'creator',
        players: room.players,
      });

      // Update lobby
      io.emit('lobby:updated', await lobbyService.getLobbyState());

      console.log(`[Photon] Room created: ${room.roomId} by ${socket.id}`);
    } catch (error) {
      console.error('[Photon] Create room error:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle join specific room
   */
  async function handleJoinRoom(socket, data) {
    try {
      const { roomId } = data;

      if (!roomId) {
        socket.emit('error', { message: 'Room ID required' });
        return;
      }

      // Join room
      const room = await roomService.joinRoom(roomId, socket.id);

      // Update player's current room
      await playerService.setPlayerRoom(socket.id, room.roomId);

      // Emit OnJoinedRoom to joining player
      socket.emit('room:joined', {
        room,
        role: 'player',
        players: room.players,
      });

      // Emit OnPlayerEnterRoom to existing players
      const joiningPlayer = await playerService.getPlayer(socket.id);
      room.players
        .filter((playerId) => playerId !== socket.id)
        .forEach((playerId) => {
          io.to(playerId).emit('room:player:enter', {
            player: joiningPlayer,
            roomId: room.roomId,
          });
        });

      // Check if game should start (RPC target reached)
      if (room.currentPlayers === room.rpcTarget && room.state === 'in-game') {
        await rpcService.broadcastToRoom(room.roomId, 'game:start', {
          roomId: room.roomId,
          players: room.players,
          timestamp: Date.now(),
        });
      }

      // Update lobby
      io.emit('lobby:updated', await lobbyService.getLobbyState());

      console.log(`[Photon] Player ${socket.id} joined room ${room.roomId}`);
    } catch (error) {
      console.error('[Photon] Join room error:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle join random room
   */
  async function handleJoinRandomRoom(socket, data) {
    try {
      const { createIfNone = true } = data || {};

      // Join or create room
      const room = await roomService.joinRandomRoom(socket.id, createIfNone);

      // Update player's current room
      await playerService.setPlayerRoom(socket.id, room.roomId);

      // Determine role
      const role = room.creatorId === socket.id ? 'creator' : 'player';

      // Emit OnJoinedRoom
      socket.emit('room:joined', {
        room,
        role,
        players: room.players,
      });

      // If joined existing room, notify others
      if (role === 'player') {
        const joiningPlayer = await playerService.getPlayer(socket.id);
        room.players
          .filter((playerId) => playerId !== socket.id)
          .forEach((playerId) => {
            io.to(playerId).emit('room:player:enter', {
              player: joiningPlayer,
              roomId: room.roomId,
            });
          });
      }

      // Check if game should start
      if (room.currentPlayers === room.rpcTarget && room.state === 'in-game') {
        await rpcService.broadcastToRoom(room.roomId, 'game:start', {
          roomId: room.roomId,
          players: room.players,
          timestamp: Date.now(),
        });
      }

      // Update lobby
      io.emit('lobby:updated', await lobbyService.getLobbyState());

      console.log(`[Photon] Player ${socket.id} joined random room ${room.roomId}`);
    } catch (error) {
      console.error('[Photon] Join random room error:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle leave room
   */
  async function handleLeaveRoom(socket) {
    try {
      const room = await roomService.getRoomByPlayer(socket.id);
      
      if (!room) {
        return;
      }

      const leavingPlayer = await playerService.getPlayer(socket.id);

      // Remove from room
      const updatedRoom = await roomService.leaveRoom(room.roomId, socket.id);

      // Update player
      await playerService.setPlayerRoom(socket.id, null);

      // Emit OnPlayerLeftRoom to remaining players
      if (updatedRoom) {
        updatedRoom.players.forEach((playerId) => {
          io.to(playerId).emit('room:player:left', {
            player: leavingPlayer,
            roomId: room.roomId,
          });
        });
      }

      // Confirm to leaving player
      socket.emit('room:left', { roomId: room.roomId });

      // Update lobby
      io.emit('lobby:updated', await lobbyService.getLobbyState());

      console.log(`[Photon] Player ${socket.id} left room ${room.roomId}`);
    } catch (error) {
      console.error('[Photon] Leave room error:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle disconnect (unexpected or intentional)
   */
  async function handleDisconnect(socket) {
    try {
      console.log(`[Photon] Player disconnected: ${socket.id}`);

      // Get player's room
      const room = await roomService.getRoomByPlayer(socket.id);
      
      if (room) {
        const disconnectedPlayer = await playerService.getPlayer(socket.id);

        // Remove from room
        const updatedRoom = await roomService.leaveRoom(room.roomId, socket.id);

        // Emit OnDisconnected to remaining players
        if (updatedRoom) {
          updatedRoom.players.forEach((playerId) => {
            io.to(playerId).emit('room:player:disconnected', {
              player: disconnectedPlayer,
              roomId: room.roomId,
            });
          });
        }
      }

      // Remove player
      await playerService.removePlayer(socket.id);

      // Update lobby
      io.emit('lobby:stats', await lobbyService.getLobbyStats());
    } catch (error) {
      console.error('[Photon] Disconnect error:', error);
    }
  }

  /**
   * Handle RPC call
   */
  async function handleRPC(socket, data) {
    try {
      const { rpcName, params, target, specificTargets } = data;

      const room = await roomService.getRoomByPlayer(socket.id);
      
      if (!room) {
        socket.emit('error', { message: 'Not in a room' });
        return;
      }

      await rpcService.sendRPC(
        room.roomId,
        rpcName,
        params,
        target,
        socket.id,
        specificTargets
      );
    } catch (error) {
      console.error('[Photon] RPC error:', error);
      socket.emit('error', { message: error.message });
    }
  }

  /**
   * Handle sync/ping events
   */
  async function handleSync(socket, data) {
    try {
      const room = await roomService.getRoomByPlayer(socket.id);
      
      if (!room) {
        return;
      }

      await rpcService.sendSync(room.roomId, data, socket.id);
    } catch (error) {
      console.error('[Photon] Sync error:', error);
    }
  }

  /**
   * Handle player state update
   */
  async function handlePlayerState(socket, data) {
    try {
      const room = await roomService.getRoomByPlayer(socket.id);
      
      if (!room) {
        return;
      }

      await rpcService.syncPlayerState(room.roomId, socket.id, data);
    } catch (error) {
      console.error('[Photon] Player state error:', error);
    }
  }

  /**
   * Handle ping (latency check)
   */
  function handlePing(socket) {
    socket.emit('pong', { timestamp: Date.now() });
  }

  return {
    handleConnection,
    handleCreateRoom,
    handleJoinRoom,
    handleJoinRandomRoom,
    handleLeaveRoom,
    handleDisconnect,
    handleRPC,
    handleSync,
    handlePlayerState,
    handlePing,
  };
}

/**
 * Setup socket.io with Photon-style event handlers
 */
function setupPhotonSocket(io, services) {
  const handlers = createPhotonHandlers(io, services);

  io.on('connection', (socket) => {
    // Connection
    handlers.handleConnection(socket);

    // Room events
    socket.on('room:create', (data) => handlers.handleCreateRoom(socket, data));
    socket.on('room:join', (data) => handlers.handleJoinRoom(socket, data));
    socket.on('room:join:random', (data) => handlers.handleJoinRandomRoom(socket, data));
    socket.on('room:leave', () => handlers.handleLeaveRoom(socket));

    // RPC & Sync
    socket.on('rpc', (data) => handlers.handleRPC(socket, data));
    socket.on('sync', (data) => handlers.handleSync(socket, data));
    socket.on('player:state', (data) => handlers.handlePlayerState(socket, data));

    // Ping
    socket.on('ping', () => handlers.handlePing(socket));

    // Disconnect
    socket.on('disconnect', () => handlers.handleDisconnect(socket));
  });

  return io;
}

module.exports = { setupPhotonSocket, createPhotonHandlers };
