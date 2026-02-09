#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const [, , rawName] = process.argv;

if (!rawName) {
  console.error('Usage: npm run module -- <moduleName>');
  process.exit(1);
}

const moduleName = rawName.trim();
const moduleDir = path.join(__dirname, '..', 'src', 'modules', moduleName);

const pascal = (str) => str.charAt(0).toUpperCase() + str.slice(1);

if (fs.existsSync(moduleDir)) {
  console.error(`Module "${moduleName}" already exists at ${moduleDir}`);
  process.exit(1);
}

fs.mkdirSync(moduleDir, { recursive: true });

const routesTemplate = `const express = require('express');
const { createService } = require('./services');

const basePath = '/${moduleName}';

const createRoutes = (deps = {}) => {
  const router = express.Router();
  const service = deps.service || createService(deps);

  router.get('/health', (_req, res) => res.json({ status: 'ok', module: '${moduleName}' }));

  router.get('/', async (_req, res) => {
    const items = await service.list();
    res.json({ items });
  });

  router.post('/', async (req, res) => {
    const created = await service.create(req.body || {});
    res.status(201).json(created);
  });

  router.get('/:id', async (req, res) => {
    const item = await service.get(req.params.id);
    if (!item) return res.status(404).json({ error: 'not found' });
    res.json(item);
  });

  router.put('/:id', async (req, res) => {
    const updated = await service.update(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'not found' });
    res.json(updated);
  });

  router.delete('/:id', async (req, res) => {
    const removed = await service.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  });

  return router;
};

module.exports = { createRoutes, basePath };
`;

const servicesTemplate = `const createService = (_deps = {}) => {
  // Replace with real data access logic; defaults are in-memory placeholders
  let memoryStore = new Map();

  return {
    list: async () => Array.from(memoryStore.values()),
    get: async (id) => memoryStore.get(id) || null,
    create: async (input) => {
      const id = input.id || Math.random().toString(36).slice(2, 9);
      const record = { id, ...input };
      memoryStore.set(id, record);
      return record;
    },
    update: async (id, input) => {
      if (!memoryStore.has(id)) return null;
      const record = { ...memoryStore.get(id), ...input, id };
      memoryStore.set(id, record);
      return record;
    },
    remove: async (id) => memoryStore.delete(id),
  };
};

module.exports = { createService };
`;

fs.writeFileSync(path.join(moduleDir, 'routes.js'), routesTemplate, 'utf8');
fs.mkdirSync(path.join(moduleDir, 'services'), { recursive: true });
fs.writeFileSync(path.join(moduleDir, 'services', 'index.js'), servicesTemplate, 'utf8');

console.log(`Created module "${moduleName}" at ${moduleDir}`);
console.log(`Routes exposed at /${moduleName} by default (override basePath in routes.js if needed).`);
