# Photon PUN Multiplayer Backend

A **Node.js** multiplayer game backend inspired by **Photon Unity Networking (PUN)**, built with **Express**, **Socket.IO**, and **Redis**. This system provides lobby management, room-based matchmaking, real-time player synchronization, and RPC-style messaging for multiplayer games.

---

## 🚀 Features

### Core Photon PUN Concepts
- **Lobby System**: Automatic lobby entry on connection, room discovery, and matchmaking
- **Room Lifecycle**: Create, join, leave rooms with state management
- **Player Management**: Automatic player registration and metadata tracking
- **RPC System**: Real-time RPC-style messaging (All, Others, Master, Specific targets)
- **Game Start Logic**: Automatic game start when RPC target (player count) is reached
- **Event System**: Photon-style events (OnJoinedRoom, OnPlayerEnterRoom, OnPlayerLeftRoom, OnDisconnected)
- **Sync/Ping System**: Real-time state synchronization and latency checks

### Technical Features
- **Redis-Backed**: All state stored in Redis with TTL for ephemeral data
- **Horizontally Scalable**: Stateless design for multi-instance deployment
- **REST + WebSocket APIs**: HTTP endpoints for lobby operations, WebSocket for real-time events
- **Auto-Cleanup**: Background service removes expired players and empty rooms
- **Modular Architecture**: Clean separation of services (Player, Room, Lobby, RPC, Cleanup)

---

## 📋 Prerequisites

- **Node.js** 16+
- **Docker** & **Docker Compose** (for Redis)
- **npm**

---

## 🛠️ Installation

```bash
# Clone repository
git clone <repo-url>
cd photon-sastha-clone

# Install dependencies
npm install

# Start Redis (via Docker Compose)
docker compose up -d

# Start server
npm start
```

The server will run on `http://localhost:3000`

---

## 🎮 API Documentation

### REST Endpoints

#### Lobby Operations

**Get Available Rooms**
```http
GET /api/lobby/rooms
```
Returns all available rooms (waiting, not full, not locked).

**Get Lobby State**
```http
GET /api/lobby/state
```
Returns complete lobby state (all rooms and players).

**Get Lobby Statistics**
```http
GET /api/lobby/stats
```
Returns lobby statistics (room counts, player counts, etc.).

**Create Room**
```http
POST /api/lobby/room/create
Content-Type: application/json

{
  "roomName": "My Room",
  "maxPlayers": 4,
  "playerId": "socket-id",
  "metadata": { "mode": "deathmatch" }
}
```

**Join Specific Room**
```http
POST /api/lobby/room/join
Content-Type: application/json

{
  "roomId": "room-uuid",
  "playerId": "socket-id"
}
```

**Join Random Room**
```http
POST /api/lobby/room/join/random
Content-Type: application/json

{
  "playerId": "socket-id",
  "createIfNone": true
}
```
Auto-creates a room if none are available (when `createIfNone: true`).

**Leave Room**
```http
POST /api/lobby/room/leave
Content-Type: application/json

{
  "playerId": "socket-id"
}
```

**Get Room Details**
```http
GET /api/lobby/room/:roomId
```

**Search Rooms**
```http
GET /api/lobby/search?state=waiting&notFull=true&notLocked=true
```
Query parameters:
- `state`: Room state (waiting/in-game)
- `minPlayers`: Minimum player count
- `maxPlayers`: Maximum player count
- `notFull`: Only rooms with space
- `notLocked`: Only unlocked rooms

---

### WebSocket Events

#### Connection & Lobby

**Client → Server:**
```javascript
// Connect with optional username
const socket = io('http://localhost:3000', {
  query: { username: 'Player1' }
});
```

**Server → Client:**
```javascript
// On connection, receive lobby state
socket.on('lobby:joined', (data) => {
  console.log('Joined lobby:', data.playerId);
  console.log('Lobby state:', data.lobbyState);
});

// Lobby updates
socket.on('lobby:updated', (lobbyState) => {
  console.log('Lobby updated:', lobbyState);
});

socket.on('lobby:stats', (stats) => {
  console.log('Lobby stats:', stats);
});
```

---

#### Room Events

**Create Room**
```javascript
socket.emit('room:create', {
  roomName: 'Epic Battle',
  maxPlayers: 4,
  metadata: { map: 'desert', mode: 'ctf' }
});
```

**Join Specific Room**
```javascript
socket.emit('room:join', { roomId: 'room-uuid' });
```

**Join Random Room**
```javascript
socket.emit('room:join:random', { createIfNone: true });
```

**Leave Room**
```javascript
socket.emit('room:leave');
```

---

#### Room Lifecycle Events

**OnJoinedRoom** - When local player joins a room
```javascript
socket.on('room:joined', (data) => {
  console.log('Joined room:', data.room);
  console.log('Role:', data.role); // 'creator' or 'player'
  console.log('Players:', data.players);
});
```

**OnPlayerEnterRoom** - When another player joins
```javascript
socket.on('room:player:enter', (data) => {
  console.log('New player entered:', data.player);
  console.log('Room ID:', data.roomId);
});
```

**OnPlayerLeftRoom** - When a player voluntarily leaves
```javascript
socket.on('room:player:left', (data) => {
  console.log('Player left:', data.player);
  console.log('Room ID:', data.roomId);
});
```

**OnDisconnected** - When a player disconnects unexpectedly
```javascript
socket.on('room:player:disconnected', (data) => {
  console.log('Player disconnected:', data.player);
  console.log('Room ID:', data.roomId);
});
```

**Game Start** - Triggered when RPC target (player count) is reached
```javascript
socket.on('game:start', (data) => {
  console.log('Game starting!');
  console.log('Room ID:', data.roomId);
  console.log('Players:', data.players);
  console.log('Timestamp:', data.timestamp);
});
```

**Room Left Confirmation**
```javascript
socket.on('room:left', (data) => {
  console.log('Left room:', data.roomId);
});
```

---

#### RPC & Synchronization

**Send RPC**
```javascript
socket.emit('rpc', {
  rpcName: 'player:shoot',
  params: { target: 'enemy1', weapon: 'rifle' },
  target: 'others', // 'all' | 'others' | 'master' | 'specific'
  specificTargets: [] // For 'specific' target type
});
```

**Receive RPC**
```javascript
socket.on('rpc', (data) => {
  console.log('RPC received:', data.rpcName);
  console.log('Parameters:', data.params);
  console.log('Sender:', data.senderId);
  console.log('Timestamp:', data.timestamp);
});
```

**Send Sync (Position/State Update)**
```javascript
socket.emit('sync', {
  position: { x: 100, y: 200, z: 50 },
  rotation: { x: 0, y: 180, z: 0 },
  velocity: { x: 5, y: 0, z: 0 },
  timestamp: Date.now()
});
```

**Send Player State**
```javascript
socket.emit('player:state', {
  health: 80,
  ammo: 25,
  isAlive: true,
  score: 150
});
```

**Ping/Pong (Latency Check)**
```javascript
socket.emit('ping');

socket.on('pong', (data) => {
  const latency = Date.now() - data.timestamp;
  console.log('Latency:', latency, 'ms');
});
```

---

#### Error Handling

```javascript
socket.on('error', (data) => {
  console.error('Error:', data.message);
});
```

---

## 🏗️ Architecture

### Services

- **PlayerService**: Manages player connections, metadata, and state
- **RoomService**: Handles room creation, joining, leaving, and state management
- **LobbyService**: Manages lobby state and room discovery
- **RPCService**: Handles RPC-style messaging between players
- **CleanupService**: Periodic cleanup of expired data (runs every 5 minutes)

### Redis Data Structure

```
player:{playerId}               - Player metadata (TTL: 1 hour)
players:active                  - Set of active player IDs
player:{playerId}:room          - Player's current room ID
room:{roomId}                   - Room data (TTL: 2 hours)
rooms:active                    - Set of active room IDs
```

### Room States
- `waiting`: Room is open for players to join
- `in-game`: Game has started (RPC target reached)
- `closed`: Room is closed

### RPC Target Types
- `all`: Send to all players in room (including sender)
- `others`: Send to all except sender
- `master`: Send to room creator
- `specific`: Send to specific player IDs

---

## 🧪 Testing

```bash
# Run tests
npm test

# Run in watch mode
npm run dev
```

Example socket client test included in `scripts/example-socket-client.js`

---

## 🐳 Docker

```bash
# Start all services (Redis + RedisInsight)
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

Redis UI (RedisInsight) available at `http://localhost:8001`

---

## 📦 Project Structure

```
src/
├── config/
│   ├── index.js              # Configuration
│   └── redisClient.js        # Redis client factory
├── services/
│   ├── playerService.js      # Player management
│   ├── roomService.js        # Room management
│   ├── lobbyService.js       # Lobby operations
│   ├── rpcService.js         # RPC messaging
│   └── cleanupService.js     # Data cleanup
├── sockets/
│   └── photonHandlers.js     # Socket.IO event handlers
├── modules/
│   └── lobby/
│       └── route.js          # Lobby REST endpoints
├── routes/
│   └── index.js              # Route loader
└── server.js                 # Entry point
```

---

## 🔧 Configuration

Edit `src/config/index.js`:

```javascript
module.exports = {
  port: process.env.PORT || 3000,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
```

---

## 🎯 Use Cases

This backend is suitable for:
- **2D/3D multiplayer games** (Unity, Godot, Phaser, Three.js)
- **Turn-based games** (chess, card games, board games)
- **Real-time action games** (shooters, battle royales, racing)
- **Casual multiplayer games** (trivia, party games)
- **Mobile multiplayer games** (iOS, Android)

---

## 📝 Development Workflow

### Add a New Module

```bash
npm run module
# Follow prompts to generate module structure
```

### Module Structure
```
src/modules/<moduleName>/
├── route.js        # REST endpoints
└── service.js      # Business logic
```

Routes are auto-mounted at `/api/<moduleName>`

---

## 🚦 Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "mode": "photon-multiplayer",
  "services": ["player", "room", "lobby", "rpc"]
}
```

---

## 🔒 Security Notes

- **Production**: Set proper CORS origin
- **Authentication**: Add JWT or session-based auth for production
- **Rate Limiting**: Implement rate limiting on endpoints
- **Input Validation**: Validate all client inputs
- **Redis Security**: Use password-protected Redis in production

---

## 📚 Photon PUN Comparison

| Feature | Photon PUN | This Backend |
|---------|-----------|--------------|
| Lobby System | ✅ | ✅ |
| Room Management | ✅ | ✅ |
| RPC Messaging | ✅ | ✅ |
| Player Properties | ✅ | ✅ (via metadata) |
| Room Properties | ✅ | ✅ (via metadata) |
| Master Client | ✅ | ✅ (room creator) |
| Auto-Matchmaking | ✅ | ✅ (join random) |
| Custom Events | ✅ | ✅ (via RPC) |
| Hosting | Cloud | Self-hosted |

---

## 🤝 Contributing

Contributions welcome! Please follow:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📄 License

ISC

---

## 🙏 Acknowledgments

- Inspired by [Photon Unity Networking (PUN)](https://www.photonengine.com/pun)
- Built for the multiplayer game development community

---

## 📞 Support

For issues and questions, please open a GitHub issue.

---

**Built with ❤️ for multiplayer game developers**
