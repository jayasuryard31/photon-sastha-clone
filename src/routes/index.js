const express = require('express');
const fs = require('fs');
const path = require('path');

const moduleRoot = path.join(__dirname, '..', 'modules');

const capitalize = (str = '') => str.charAt(0).toUpperCase() + str.slice(1);

const isRouterInstance = (mod) =>
  typeof mod === 'function' && typeof mod.use === 'function' && Array.isArray(mod.stack);

const findRoutesFile = (moduleDir) => {
  const candidates = ['routes.js', 'route.js', 'index.js'];
  for (const file of candidates) {
    const full = path.join(moduleDir, file);
    if (fs.existsSync(full)) return full;
  }
  return null;
};

const loadModuleRouters = (deps) => {
  if (!fs.existsSync(moduleRoot)) return [];

  const entries = fs.readdirSync(moduleRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const moduleDir = path.join(moduleRoot, entry.name);
      const routesPath = findRoutesFile(moduleDir);
      if (!routesPath) return null;

      try {
        const mod = require(routesPath);

        // Detect router exports
        if (isRouterInstance(mod)) {
          const basePath = mod.basePath || `/${entry.name}`;
          return { basePath, router: mod };
        }

        if (mod && isRouterInstance(mod.router)) {
          const basePath = mod.basePath || `/${entry.name}`;
          return { basePath, router: mod.router };
        }

        const createRoutes =
          (typeof mod === 'function' && !isRouterInstance(mod) && mod) ||
          mod.createRoutes ||
          mod[`create${capitalize(entry.name)}Routes`] ||
          mod.default;

        const routerInstance =
          (isRouterInstance(createRoutes) && createRoutes) ||
          (typeof createRoutes === 'function' ? createRoutes(deps) : null);

        if (!routerInstance) return null;

        const basePath = mod.basePath || `/${entry.name}`;
        return { basePath, router: routerInstance };
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
