/**
 * Cleanup service for managing Redis TTL and expired data
 * Ensures ephemeral game state doesn't persist indefinitely
 */
class CleanupService {
  constructor(redis, playerService, roomService) {
    this.redis = redis;
    this.playerService = playerService;
    this.roomService = roomService;
    this.cleanupInterval = null;
  }

  /**
   * Start periodic cleanup job
   * @param {number} intervalMs - Cleanup interval in milliseconds (default: 5 minutes)
   */
  start(intervalMs = 5 * 60 * 1000) {
    console.log('[Cleanup] Starting cleanup service...');
    
    // Run immediately on start
    this.runCleanup();

    // Schedule periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.runCleanup();
    }, intervalMs);
  }

  /**
   * Stop cleanup service
   */
  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('[Cleanup] Cleanup service stopped');
    }
  }

  /**
   * Run cleanup tasks
   */
  async runCleanup() {
    try {
      console.log('[Cleanup] Running cleanup tasks...');

      await Promise.all([
        this.cleanupExpiredPlayers(),
        this.cleanupEmptyRooms(),
        this.cleanupStaleRoomMappings(),
      ]);

      console.log('[Cleanup] Cleanup completed');
    } catch (error) {
      console.error('[Cleanup] Cleanup error:', error);
    }
  }

  /**
   * Remove players whose TTL has expired
   */
  async cleanupExpiredPlayers() {
    try {
      const playerIds = await this.redis.sMembers('players:active');
      let cleaned = 0;

      for (const playerId of playerIds) {
        const exists = await this.redis.exists(`player:${playerId}`);
        if (!exists) {
          // Player data expired but still in active set
          await this.redis.sRem('players:active', playerId);
          
          // Clean up their room mapping
          const roomId = await this.redis.get(`player:${playerId}:room`);
          if (roomId) {
            await this.roomService.leaveRoom(roomId, playerId);
          }
          
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[Cleanup] Removed ${cleaned} expired players`);
      }
    } catch (error) {
      console.error('[Cleanup] Expired players cleanup error:', error);
    }
  }

  /**
   * Remove empty rooms
   */
  async cleanupEmptyRooms() {
    try {
      const roomIds = await this.redis.sMembers('rooms:active');
      let cleaned = 0;

      for (const roomId of roomIds) {
        const room = await this.roomService.getRoom(roomId);
        
        if (!room || room.players.length === 0) {
          await this.roomService.deleteRoom(roomId);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[Cleanup] Removed ${cleaned} empty rooms`);
      }
    } catch (error) {
      console.error('[Cleanup] Empty rooms cleanup error:', error);
    }
  }

  /**
   * Clean up stale player-room mappings
   */
  async cleanupStaleRoomMappings() {
    try {
      const pattern = 'player:*:room';
      const keys = await this.redis.keys(pattern);
      let cleaned = 0;

      for (const key of keys) {
        const roomId = await this.redis.get(key);
        const playerId = key.split(':')[1];

        // Check if room still exists
        const roomExists = roomId ? await this.redis.exists(`room:${roomId}`) : false;
        
        // Check if player still exists
        const playerExists = await this.redis.exists(`player:${playerId}`);

        if (!roomExists || !playerExists) {
          await this.redis.del(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`[Cleanup] Removed ${cleaned} stale room mappings`);
      }
    } catch (error) {
      console.error('[Cleanup] Stale mappings cleanup error:', error);
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    try {
      const [activePlayers, activeRooms, roomMappings] = await Promise.all([
        this.redis.sCard('players:active'),
        this.redis.sCard('rooms:active'),
        this.redis.keys('player:*:room').then((keys) => keys.length),
      ]);

      return {
        activePlayers,
        activeRooms,
        roomMappings,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[Cleanup] Stats error:', error);
      return null;
    }
  }
}

/**
 * Factory function to create CleanupService
 */
async function createCleanupService(redis, playerService, roomService) {
  return new CleanupService(redis, playerService, roomService);
}

module.exports = { CleanupService, createCleanupService };
