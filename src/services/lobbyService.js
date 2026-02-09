const { createRedisClient } = require('../config/redisClient');

/**
 * LobbyService - Manages lobby state and room discovery
 * Photon PUN-inspired lobby management
 */
class LobbyService {
  constructor(redisClient, roomService, playerService) {
    this.redis = redisClient;
    this.roomService = roomService;
    this.playerService = playerService;
  }

  /**
   * Get lobby state (all rooms and players)
   */
  async getLobbyState() {
    const [rooms, players] = await Promise.all([
      this.roomService.getAllRooms(),
      this.playerService.getActivePlayers(),
    ]);

    return {
      rooms: rooms.map((room) => ({
        roomId: room.roomId,
        roomName: room.roomName,
        currentPlayers: room.currentPlayers,
        maxPlayers: room.maxPlayers,
        state: room.state,
        locked: room.locked,
        rpcTarget: room.rpcTarget,
      })),
      totalRooms: rooms.length,
      totalPlayers: players.length,
      timestamp: Date.now(),
    };
  }

  /**
   * Get available rooms for matchmaking
   */
  async getAvailableRooms() {
    const rooms = await this.roomService.getAvailableRooms();
    return rooms.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      currentPlayers: room.currentPlayers,
      maxPlayers: room.maxPlayers,
      rpcTarget: room.rpcTarget,
      state: room.state,
    }));
  }

  /**
   * Get lobby statistics
   */
  async getLobbyStats() {
    const [rooms, players] = await Promise.all([
      this.roomService.getAllRooms(),
      this.playerService.getActivePlayers(),
    ]);

    const availableRooms = rooms.filter(
      (room) =>
        room.state === 'waiting' &&
        !room.locked &&
        room.currentPlayers < room.maxPlayers
    );

    const activeGames = rooms.filter((room) => room.state === 'in-game');

    return {
      totalRooms: rooms.length,
      availableRooms: availableRooms.length,
      activeGames: activeGames.length,
      totalPlayers: players.length,
      playersInLobby: players.filter((p) => !p.currentRoom).length,
      playersInRooms: players.filter((p) => p.currentRoom).length,
    };
  }

  /**
   * Search rooms by criteria
   */
  async searchRooms(criteria = {}) {
    const rooms = await this.roomService.getAllRooms();
    
    let filtered = rooms;

    if (criteria.state) {
      filtered = filtered.filter((room) => room.state === criteria.state);
    }

    if (criteria.minPlayers !== undefined) {
      filtered = filtered.filter(
        (room) => room.currentPlayers >= criteria.minPlayers
      );
    }

    if (criteria.maxPlayers !== undefined) {
      filtered = filtered.filter(
        (room) => room.currentPlayers <= criteria.maxPlayers
      );
    }

    if (criteria.notFull) {
      filtered = filtered.filter(
        (room) => room.currentPlayers < room.maxPlayers
      );
    }

    if (criteria.notLocked) {
      filtered = filtered.filter((room) => !room.locked);
    }

    return filtered.map((room) => ({
      roomId: room.roomId,
      roomName: room.roomName,
      currentPlayers: room.currentPlayers,
      maxPlayers: room.maxPlayers,
      state: room.state,
      locked: room.locked,
      rpcTarget: room.rpcTarget,
    }));
  }
}

/**
 * Factory function to create LobbyService
 */
async function createLobbyService(roomService, playerService) {
  const redis = await createRedisClient();
  return new LobbyService(redis, roomService, playerService);
}

module.exports = { LobbyService, createLobbyService };
