const { createRedisClient } = require('../config/redisClient');

/**
 * PlayerService - Manages player connections, metadata, and state
 * Stores temporary player data in Redis with TTL
 */
class PlayerService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.PLAYER_TTL = 3600; // 1 hour TTL for player data
  }

  /**
   * Register a new player on connection
   * @param {string} playerId - Unique player ID (socket.id)
   * @param {object} metadata - Player metadata (username, avatar, etc.)
   */
  async registerPlayer(playerId, metadata = {}) {
    const playerData = {
      playerId,
      connectedAt: Date.now(),
      currentRoom: null,
      ...metadata,
    };

    await this.redis.setEx(
      `player:${playerId}`,
      this.PLAYER_TTL,
      JSON.stringify(playerData)
    );

    // Add to active players set
    await this.redis.sAdd('players:active', playerId);

    return playerData;
  }

  /**
   * Get player data
   */
  async getPlayer(playerId) {
    const data = await this.redis.get(`player:${playerId}`);
    return data ? JSON.parse(data) : null;
  }

  /**
   * Update player metadata
   */
  async updatePlayer(playerId, updates) {
    const player = await this.getPlayer(playerId);
    if (!player) return null;

    const updated = { ...player, ...updates };
    await this.redis.setEx(
      `player:${playerId}`,
      this.PLAYER_TTL,
      JSON.stringify(updated)
    );

    return updated;
  }

  /**
   * Set player's current room
   */
  async setPlayerRoom(playerId, roomId) {
    return this.updatePlayer(playerId, { currentRoom: roomId });
  }

  /**
   * Get all active players
   */
  async getActivePlayers() {
    const playerIds = await this.redis.sMembers('players:active');
    const players = await Promise.all(
      playerIds.map((id) => this.getPlayer(id))
    );
    return players.filter(Boolean);
  }

  /**
   * Remove player on disconnect
   */
  async removePlayer(playerId) {
    const player = await this.getPlayer(playerId);
    
    // Remove from active players
    await this.redis.sRem('players:active', playerId);
    
    // Delete player data
    await this.redis.del(`player:${playerId}`);
    
    return player;
  }

  /**
   * Refresh player TTL (keep-alive)
   */
  async refreshPlayer(playerId) {
    await this.redis.expire(`player:${playerId}`, this.PLAYER_TTL);
  }
}

/**
 * Factory function to create PlayerService with Redis client
 */
async function createPlayerService() {
  const redis = await createRedisClient();
  return new PlayerService(redis);
}

module.exports = { PlayerService, createPlayerService };
