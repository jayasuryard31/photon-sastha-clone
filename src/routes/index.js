const express = require('express');
const fs = require('fs');
const path = require('path');

const moduleRoot = path.join(__dirname, '..', 'modules');

const capitalize = (str = '') => str.charAt(0).toUpperCase() + str.slice(1);

const loadModuleRouters = (deps) => {
  if (!fs.existsSync(moduleRoot)) return [];

  const entries = fs.readdirSync(moduleRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const routesPath = path.join(moduleRoot, entry.name, 'routes.js');
      if (!fs.existsSync(routesPath)) return null;

      try {
        const mod = require(routesPath);
        const createRoutes =
          mod.createRoutes ||
          mod[`create${capitalize(entry.name)}Routes`] ||
          mod.default;

        if (typeof createRoutes !== 'function') return null;

        const basePath = mod.basePath || `/${entry.name}`;
        return { basePath, router: createRoutes(deps) };
      } catch (err) {
        console.error(`[routes] failed to load module ${entry.name}`, err);
        return null;
      }
    })
    .filter(Boolean);
};

const buildRouter = (deps) => {
  const router = express.Router();
  const moduleRouters = loadModuleRouters(deps);

  moduleRouters.forEach(({ basePath, router: moduleRouter }) => {
    router.use(basePath, moduleRouter);
  });

  return router;
};

module.exports = { buildRouter };
