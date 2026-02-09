/**
 * RPCService - Handles RPC-style messaging between players
 * Photon PUN-inspired RPC system for real-time game synchronization
 */
class RPCService {
  constructor(io, roomService) {
    this.io = io;
    this.roomService = roomService;
  }

  /**
   * RPC Target Types
   */
  static TARGETS = {
    ALL: 'all', // Send to all players in room (including sender)
    OTHERS: 'others', // Send to all except sender
    MASTER: 'master', // Send to room creator/master
    SPECIFIC: 'specific', // Send to specific player(s)
  };

  /**
   * Send RPC to room
   * @param {string} roomId - Room ID
   * @param {string} rpcName - RPC event name
   * @param {object} params - RPC parameters
   * @param {string} target - Target type (all/others/master/specific)
   * @param {string} senderId - Sender player ID
   * @param {string[]} specificTargets - Specific player IDs (for SPECIFIC target)
   */
  async sendRPC(roomId, rpcName, params, target, senderId, specificTargets = []) {
    const room = await this.roomService.getRoom(roomId);
    
    if (!room) {
      throw new Error('Room not found');
    }

    const rpcPayload = {
      rpcName,
      params,
      senderId,
      timestamp: Date.now(),
      roomId,
    };

    switch (target) {
      case RPCService.TARGETS.ALL:
        // Send to all players in room
        room.players.forEach((playerId) => {
          this.io.to(playerId).emit('rpc', rpcPayload);
        });
        break;

      case RPCService.TARGETS.OTHERS:
        // Send to all except sender
        room.players
          .filter((playerId) => playerId !== senderId)
          .forEach((playerId) => {
            this.io.to(playerId).emit('rpc', rpcPayload);
          });
        break;

      case RPCService.TARGETS.MASTER:
        // Send to room creator
        this.io.to(room.creatorId).emit('rpc', rpcPayload);
        break;

      case RPCService.TARGETS.SPECIFIC:
        // Send to specific players
        specificTargets
          .filter((playerId) => room.players.includes(playerId))
          .forEach((playerId) => {
            this.io.to(playerId).emit('rpc', rpcPayload);
          });
        break;

      default:
        throw new Error('Invalid RPC target');
    }

    return rpcPayload;
  }

  /**
   * Broadcast to entire room
   */
  async broadcastToRoom(roomId, eventName, data) {
    const room = await this.roomService.getRoom(roomId);
    
    if (!room) {
      return;
    }

    room.players.forEach((playerId) => {
      this.io.to(playerId).emit(eventName, data);
    });
  }

  /**
   * Send ping/sync event
   * Used for position updates, state sync, latency checks
   */
  async sendSync(roomId, syncData, senderId, toOthersOnly = true) {
    return this.sendRPC(
      roomId,
      'sync',
      syncData,
      toOthersOnly ? RPCService.TARGETS.OTHERS : RPCService.TARGETS.ALL,
      senderId
    );
  }

  /**
   * Handle player position/state update
   */
  async syncPlayerState(roomId, playerId, state) {
    return this.sendRPC(
      roomId,
      'player:state',
      { playerId, state },
      RPCService.TARGETS.OTHERS,
      playerId
    );
  }

  /**
   * Send custom game event to room
   */
  async sendGameEvent(roomId, eventName, eventData, senderId) {
    return this.sendRPC(
      roomId,
      `game:${eventName}`,
      eventData,
      RPCService.TARGETS.ALL,
      senderId
    );
  }
}

module.exports = { RPCService };
