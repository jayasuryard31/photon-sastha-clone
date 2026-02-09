# Multiplayer Game Backend

Node.js + Express + Socket.io backend for multiplayer games. State is held in Redis (in-memory) and exposed over REST and websockets with a modular, pluggable architecture.

## Requirements

- Node.js 18+
- Redis instance (default: redis://localhost:6379)

## Quick start

```bash
npm install
npm start        # run server
# or
npm run dev      # nodemon
```

Environment (optional overrides):

- `PORT` (default 3000)
- `REDIS_URL` (default redis://localhost:6379)
- `CORS_ORIGIN` (default *)

Health check: `GET /health`

## Project layout

```
src/
   server.js                 # App entrypoint and wiring
   config/
      index.js                # Env config
      redisClient.js          # Redis client factory
   modules/
      matchmaking/
         routes.js             # REST routes (basePath: /)
         services/
            redisStore.js       # Redis persistence helpers
            matchmakingService.js
   routes/
      index.js                # Auto-loads module routers
   sockets/
      index.js                # Socket.io bootstrap
      gameHandlers.js         # Socket event handlers (uses matchmaking service)
   tasks/
      index.js                # Placeholder for background jobs
scripts/
   generate-module.js        # Module scaffolder
test/
   sockets.test.js|ts        # Socket smoke tests
package.json
README.md
```

## Modules and auto-routing

- Each module lives under `src/modules/<name>/` and should export `createRoutes(deps)` and optional `basePath` from `routes.js`.
- The route aggregator auto-mounts every module at `basePath` (defaults to `/<name>` if not provided). The matchmaking module sets `basePath = '/'` to keep existing URLs.

## Generate a module

Create a new module with a default CRUD-style REST surface and in-memory service stub:

```bash
npm run module -- leaderboard
```

This creates:

```
src/modules/leaderboard/
   routes.js      # health + CRUD endpoints mounted at /leaderboard (by default)
   services/
      index.js     # simple in-memory service; adapt to Redis or other deps
```

You can change `basePath` inside the generated `routes.js` if you need a different mount point.

## Sockets

- Socket namespace is the default `/`.
- Key events: `player:join`, `player:move`, `queue:join`, `lobby:join`, disconnect handling.
- Socket handlers depend on the Redis-backed matchmaking service for player/lobby state.

## Testing

```bash
npm test
```

The included socket test is a smoke check for client connection; extend as needed.

## Contributing

Pull requests are welcome. Keep modules self-contained (routes + services) and prefer Redis-backed stores for shared state.