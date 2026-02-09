# Multiplayer Backend Template

Minimal Node.js + Express + Socket.io template wired to Redis. Ships with a demo REST + Socket state handler to show the pattern; replace with your own modules/services.

## Prerequisites
- Node.js 18+
- Redis (provide `REDIS_URL`, or run the bundled docker-compose with the local Redis profile)

## Quick start
```bash
npm install
npm start          # runs server on PORT (default 3000)
# or
npm run dev        # nodemon
```

Environment:
- `PORT` (default 3000)
- `REDIS_URL` (default redis://localhost:6379)
- `CORS_ORIGIN` (default *)

Health: `GET /health` returns `{ status: "ok", mode: "template" }`

## REST endpoints (current)
- `GET /health` – service health
- `GET /api/exampleModule/` – returns cached example payload from Redis (`example:data`, 60s TTL)

## Socket demo (template)
- Namespace: `/`
- Events (from sockets/gameHandlers.js):
   - `demo:ping` → responds with `demo:pong { ts }`
   - `demo:set { ...partial }` → updates demo state (template only)
   - `demo:state` → emitted on connect and after `demo:set`

Example client: `node scripts/example-socket-client.js` (uses `SOCKET_URL`, default http://localhost:3000)

## Project layout
```
src/
   server.js                # App entrypoint
   config/
      index.js               # Env config
      redisClient.js         # Redis client factory
   modules/
      exampleModule/          # Example REST module using Redis cache
         route.js              # GET /api/exampleModule/
         service.js            # getData with Redis cache (key example:data)
   routes/
      index.js               # Auto-loads module routers
   sockets/
      index.js               # Socket.io bootstrap
      gameHandlers.js        # Demo socket events
   tasks/
      index.js               # Placeholder for background jobs
scripts/
   generate-module.js       # Scaffold new modules (CRUD-style)
   example-socket-client.js # Sample Socket.io client for demo events
test/
   sockets.test.js          # Socket demo smoke test
package.json
README.md
```

## Module pattern
- Each module under `src/modules/<name>/` can export a router instance (`module.exports = router`) or `{ router, basePath }`, or a factory (`createRoutes(deps)`).
- The aggregator mounts at `basePath` (default `/<name>`). ExampleModule uses `basePath = '/exampleModule'` via its router file.

## Scaffolding new modules
Generate a CRUD-style module stub:
```bash
npm run module -- myFeature
```
This creates `src/modules/myFeature/routes.js` and `services/index.js` with in-memory CRUD placeholders. Wire them to Redis or your own store.

## Docker (optional)
- `docker-compose.yml` includes app, Redis, and RedisInsight (UI on 8001). Use `--profile local-redis` to run the bundled Redis, or provide your own `REDIS_URL` for remote Redis.
   ```bash
   # with bundled Redis
   sudo docker compose --profile local-redis up --build
   # using external Redis (set REDIS_URL accordingly)
   sudo docker compose up --build
   ```

## Testing
```bash
npm test
```
Socket test asserts the demo state event; extend as you add features.

## Extend
- Replace the demo module with your own business logic, keeping the folder pattern (routes + services).
- Add more Socket.io handlers in `sockets/gameHandlers.js` and pass dependencies via `setupSocket`.
- Add background jobs under `src/tasks` as needed.