const express = require('express');

const basePath = '/';

const createRoutes = ({ io, matchmakingService }) => {
  const router = express.Router();

  router.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

  router.get('/state', async (_req, res) => {
    const state = await matchmakingService.getGameState();
    res.json(state);
  });

  router.get('/matches', async (_req, res) => {
    const games = await matchmakingService.listMatches();
    res.json({ games });
  });

  router.get('/matches/:gameId', async (req, res) => {
    const match = await matchmakingService.getMatch(req.params.gameId);
    if (!match) return res.status(404).json({ error: 'not found' });
    res.json(match);
  });

  router.delete('/matches/:gameId', async (req, res) => {
    const match = await matchmakingService.endMatch(req.params.gameId);
    if (!match) return res.status(404).json({ error: 'not found' });
    res.json(match);
  });

  router.post('/queue/join', async (req, res) => {
    const { socketId } = req.body || {};
    if (!socketId) {
      return res.status(400).json({ error: 'socketId is required' });
    }

    const socket = io.sockets?.sockets?.get(socketId);
    if (!socket) {
      return res.status(404).json({ error: 'socket not connected' });
    }

    const lobby = await matchmakingService.createLobby(socketId);
    socket.join(lobby.room);
    const player = await matchmakingService.assignPlayerRoom(socketId, lobby.room);

    const payload = { gameId: lobby.gameId, players: lobby.players, room: lobby.room, masterClientId: lobby.hostId };
    socket.emit('match:found', payload);
    socket.emit('match:joined', payload);
    io.to(lobby.room).emit('player:joined', [player]);

    return res.status(200).json({ ok: true, lobby: payload });
  });

  router.post('/queue/leave', (_req, res) => res.status(200).json({ ok: true }));

  router.get('/players', async (_req, res) => {
    const state = await matchmakingService.getGameState();
    res.json({ players: Object.values(state.players) });
  });

  router.get('/lobbies', async (_req, res) => {
    const lobbies = await matchmakingService.listLobbies();
    res.json({ lobbies });
  });

  return router;
};

// Backward-compatible export for existing imports
const createMatchmakingRoutes = createRoutes;

module.exports = { createRoutes, createMatchmakingRoutes, basePath };
