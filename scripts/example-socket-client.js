#!/usr/bin/env node
// Simple demo client to exercise the template Socket.io events.
const { io } = require('socket.io-client');

const url = process.env.SOCKET_URL || 'http://localhost:3000';
const socket = io(url, { transports: ['websocket'] });

socket.on('connect', () => {
  console.log('[client] connected', socket.id);
  socket.emit('demo:ping');
  socket.emit('demo:set', { message: 'hello from client' });
});

socket.on('demo:pong', (payload) => {
  console.log('[client] pong', payload);
});

socket.on('demo:state', (state) => {
  console.log('[client] state', state);
});

socket.on('disconnect', () => console.log('[client] disconnected'));
