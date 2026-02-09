const express = require('express');

/**
 * Create Photon PUN-style lobby routes
 * REST APIs for lobby and room discovery
 */
function createLobbyRoutes(services) {
  const router = express.Router();
  const { lobbyService, roomService, playerService } = services;

  /**
   * GET /lobby/rooms
   * Get all available rooms in the lobby
   */
  router.get('/rooms', async (req, res) => {
    try {
      const rooms = await lobbyService.getAvailableRooms();
      res.json({
        success: true,
        rooms,
        count: rooms.length,
      });
    } catch (error) {
      console.error('[Lobby API] Get rooms error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /lobby/state
   * Get complete lobby state (rooms + players)
   */
  router.get('/state', async (req, res) => {
    try {
      const state = await lobbyService.getLobbyState();
      res.json({
        success: true,
        ...state,
      });
    } catch (error) {
      console.error('[Lobby API] Get state error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /lobby/stats
   * Get lobby statistics
   */
  router.get('/stats', async (req, res) => {
    try {
      const stats = await lobbyService.getLobbyStats();
      res.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error('[Lobby API] Get stats error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /lobby/room/create
   * Create a new room
   */
  router.post('/room/create', async (req, res) => {
    try {
      const { roomName, maxPlayers, playerId, metadata } = req.body;

      if (!roomName || !maxPlayers || !playerId) {
        return res.status(400).json({
          success: false,
          error: 'roomName, maxPlayers, and playerId are required',
        });
      }

      const room = await roomService.createRoom(
        roomName,
        maxPlayers,
        playerId,
        metadata
      );

      // Update player's room
      await playerService.setPlayerRoom(playerId, room.roomId);

      res.json({
        success: true,
        room,
      });
    } catch (error) {
      console.error('[Lobby API] Create room error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /lobby/room/join
   * Join a specific room
   */
  router.post('/room/join', async (req, res) => {
    try {
      const { roomId, playerId } = req.body;

      if (!roomId || !playerId) {
        return res.status(400).json({
          success: false,
          error: 'roomId and playerId are required',
        });
      }

      const room = await roomService.joinRoom(roomId, playerId);

      // Update player's room
      await playerService.setPlayerRoom(playerId, room.roomId);

      res.json({
        success: true,
        room,
      });
    } catch (error) {
      console.error('[Lobby API] Join room error:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /lobby/room/join/random
   * Join a random available room
   */
  router.post('/room/join/random', async (req, res) => {
    try {
      const { playerId, createIfNone = true } = req.body;

      if (!playerId) {
        return res.status(400).json({
          success: false,
          error: 'playerId is required',
        });
      }

      const room = await roomService.joinRandomRoom(playerId, createIfNone);

      // Update player's room
      await playerService.setPlayerRoom(playerId, room.roomId);

      res.json({
        success: true,
        room,
        wasCreated: room.creatorId === playerId,
      });
    } catch (error) {
      console.error('[Lobby API] Join random room error:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  });

  /**
   * POST /lobby/room/leave
   * Leave current room
   */
  router.post('/room/leave', async (req, res) => {
    try {
      const { playerId } = req.body;

      if (!playerId) {
        return res.status(400).json({
          success: false,
          error: 'playerId is required',
        });
      }

      const room = await roomService.getRoomByPlayer(playerId);
      
      if (!room) {
        return res.status(400).json({
          success: false,
          error: 'Player not in a room',
        });
      }

      await roomService.leaveRoom(room.roomId, playerId);
      await playerService.setPlayerRoom(playerId, null);

      res.json({
        success: true,
        message: 'Left room successfully',
      });
    } catch (error) {
      console.error('[Lobby API] Leave room error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /lobby/room/:roomId
   * Get specific room details
   */
  router.get('/room/:roomId', async (req, res) => {
    try {
      const { roomId } = req.params;
      const room = await roomService.getRoom(roomId);

      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room not found',
        });
      }

      res.json({
        success: true,
        room,
      });
    } catch (error) {
      console.error('[Lobby API] Get room error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * GET /lobby/search
   * Search rooms by criteria
   */
  router.get('/search', async (req, res) => {
    try {
      const criteria = {
        state: req.query.state,
        minPlayers: req.query.minPlayers ? parseInt(req.query.minPlayers) : undefined,
        maxPlayers: req.query.maxPlayers ? parseInt(req.query.maxPlayers) : undefined,
        notFull: req.query.notFull === 'true',
        notLocked: req.query.notLocked === 'true',
      };

      const rooms = await lobbyService.searchRooms(criteria);

      res.json({
        success: true,
        rooms,
        count: rooms.length,
      });
    } catch (error) {
      console.error('[Lobby API] Search rooms error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

module.exports = { createLobbyRoutes };
