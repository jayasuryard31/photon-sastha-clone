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

if (fs.existsSync(moduleDir)) {
  console.error(`Module "${moduleName}" already exists at ${moduleDir}`);
  process.exit(1);
}

fs.mkdirSync(moduleDir, { recursive: true });

const routeTemplate = (name) => `const express = require('express');
const { createService } = require('./service');

const basePath = '/${name}';
const router = express.Router();
const servicePromise = createService();

router.get('/', async (_req, res) => {
  try {
    const service = await servicePromise;
    const data = await service.getData();
    res.status(200).json(data);
  } catch (err) {
    console.error('[${name}] get failed', err);
    res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = { router, basePath };
`;

const serviceTemplate = (name) => `const createService = async () => {
  // Replace with real data source or Redis logic
  const getData = async () => ({ message: 'hello from ${name}', ts: new Date().toISOString() });
  return { getData };
};

module.exports = { createService };
`;

fs.writeFileSync(path.join(moduleDir, 'route.js'), routeTemplate(moduleName), 'utf8');
fs.writeFileSync(path.join(moduleDir, 'service.js'), serviceTemplate(moduleName), 'utf8');

console.log(`Created module "${moduleName}" at ${moduleDir}`);
console.log(`Mounted at /${moduleName} by default (override basePath in route.js if needed).`);
