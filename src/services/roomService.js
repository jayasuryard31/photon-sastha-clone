const { createRedisClient } = require('../config/redisClient');
const crypto = require('crypto');

/**
 * Generate a unique room ID
 */
function generateRoomId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * RoomService - Manages room creation, joining, leaving, and state
 * Photon PUN-inspired room lifecycle management
 */
class RoomService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.ROOM_TTL = 7200; // 2 hours TTL for room data
  }

  /**
   * Create a new room
   * @param {string} roomName - Room name
   * @param {number} maxPlayers - Max players (RPC target)
   * @param {string} creatorId - Creator player ID
   * @param {object} metadata - Additional room metadata
   */
  async createRoom(roomName, maxPlayers, creatorId, metadata = {}) {
    const roomId = generateRoomId();
    const room = {
      roomId,
      roomName,
      maxPlayers,
      currentPlayers: 1,
      state: 'waiting', // waiting | in-game | closed
      createdAt: Date.now(),
      creatorId,
      players: [creatorId],
      rpcTarget: maxPlayers, // Number of players needed to start
      locked: false,
      ...metadata,
    };

    // Store room data
    await this.redis.setEx(
      `room:${roomId}`,
      this.ROOM_TTL,
      JSON.stringify(room)
    );

    // Add to active rooms set
    await this.redis.sAdd('rooms:active', roomId);

    // Map player to room
    await this.redis.set(`player:${creatorId}:room`, roomId);

    return room;
  }

  /**
   * Get room data
   */
  async getRoom(roomId) {
    const data = await this.redis.get(`room:${roomId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Join a specific room
   * @param {string} roomId - Room ID to join
   * @param {string} playerId - Player ID joining
   */
  async joinRoom(roomId, playerId) {
    const room = await this.getRoom(roomId);
    
    if (!room) {
      throw new Error('Room not found');
    }

    if (room.locked) {
      throw new Error('Room is locked');
    }

    if (room.currentPlayers >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    if (room.players.includes(playerId)) {
      throw new Error('Player already in room');
    }

    // Add player to room
    room.players.push(playerId);
    room.currentPlayers = room.players.length;

    // Update room
    await this.redis.setEx(
      `room:${roomId}`,
      this.ROOM_TTL,
      JSON.stringify(room)
    );

    // Map player to room
    await this.redis.set(`player:${playerId}:room`, roomId);

    // Check if game should start (RPC target reached)
    if (room.currentPlayers === room.rpcTarget) {
      room.state = 'in-game';
      room.locked = true;
      await this.redis.setEx(
        `room:${roomId}`,
        this.ROOM_TTL,
        JSON.stringify(room)
      );
    }

    return room;
  }

  /**
   * Join a random available room
   * @param {string} playerId - Player ID
   * @param {boolean} createIfNone - Create room if none available
   */
  async joinRandomRoom(playerId, createIfNone = true) {
    const rooms = await this.getAvailableRooms();
    
    // Find first available room
    const availableRoom = rooms.find(
      (room) => !room.locked && room.currentPlayers < room.maxPlayers
    );

    if (availableRoom) {
      return this.joinRoom(availableRoom.roomId, playerId);
    }

    // Create new room if requested
    if (createIfNone) {
      return this.createRoom(`Room-${Date.now()}`, 4, playerId, {
        autoCreated: true,
      });
    }

    throw new Error('No available rooms');
  }

  /**
   * Leave a room
   * @param {string} roomId - Room ID
   * @param {string} playerId - Player ID leaving
   */
  async leaveRoom(roomId, playerId) {
    const room = await this.getRoom(roomId);
    
    if (!room) {
      return null;
    }

    // Remove player from room
    room.players = room.players.filter((id) => id !== playerId);
    room.currentPlayers = room.players.length;

    // Remove player-room mapping
    await this.redis.del(`player:${playerId}:room`);

    // If room is empty, delete it
    if (room.players.length === 0) {
      await this.deleteRoom(roomId);
      return null;
    }

    // Update room
    await this.redis.setEx(
      `room:${roomId}`,
      this.ROOM_TTL,
      JSON.stringify(room)
    );

    return room;
  }

  /**
   * Get all active rooms
   */
  async getAllRooms() {
    const roomIds = await this.redis.sMembers('rooms:active');
    const rooms = await Promise.all(
      roomIds.map((id) => this.getRoom(id))
    );
    return rooms.filter(Boolean);
  }

  /**
   * Get available rooms (waiting, not full, not locked)
   */
  async getAvailableRooms() {
    const rooms = await this.getAllRooms();
    return rooms.filter(
      (room) =>
        room.state === 'waiting' &&
        !room.locked &&
        room.currentPlayers < room.maxPlayers
    );
  }

  /**
   * Get room by player ID
   */
  async getRoomByPlayer(playerId) {
    const roomId = await this.redis.get(`player:${playerId}:room`);
    return roomId ? this.getRoom(roomId) : null;
  }

  /**
   * Delete a room
   */
  async deleteRoom(roomId) {
    const room = await this.getRoom(roomId);
    
    if (room) {
      // Remove player-room mappings
      for (const playerId of room.players) {
        await this.redis.del(`player:${playerId}:room`);
      }
    }

    // Remove from active rooms
    await this.redis.sRem('rooms:active', roomId);
    
    // Delete room data
    await this.redis.del(`room:${roomId}`);
  }

  /**
   * Lock a room (prevent new players)
   */
  async lockRoom(roomId) {
    const room = await this.getRoom(roomId);
    if (room) {
      room.locked = true;
      await this.redis.setEx(
        `room:${roomId}`,
        this.ROOM_TTL,
        JSON.stringify(room)
      );
    }
    return room;
  }

  /**
   * Update room state
   */
  async updateRoomState(roomId, state) {
    const room = await this.getRoom(roomId);
    if (room) {
      room.state = state;
      await this.redis.setEx(
        `room:${roomId}`,
        this.ROOM_TTL,
        JSON.stringify(room)
      );
    }
    return room;
  }

  /**
   * Refresh room TTL
   */
  async refreshRoom(roomId) {
    await this.redis.expire(`room:${roomId}`, this.ROOM_TTL);
  }
}

/**
 * Factory function to create RoomService
 */
async function createRoomService() {
  const redis = await createRedisClient();
  return new RoomService(redis);
}

module.exports = { RoomService, createRoomService };
