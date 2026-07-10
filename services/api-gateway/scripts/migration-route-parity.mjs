import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const backupRoot = path.resolve(repoRoot, '../ConnectSphere-backup/server/src');

const OLD_ROUTE_DIR = path.join(backupRoot, 'routes');
const OLD_INDEX = path.join(backupRoot, 'index.ts');
const NEW_GATEWAY_INDEX = path.join(repoRoot, 'server/src/index.ts');
const NEW_SCAN_DIRS = [
  path.join(repoRoot, 'server/src'),
  path.join(repoRoot, 'auth-service/src'),
  path.join(repoRoot, 'contact-service/src'),
  path.join(repoRoot, 'chat-service/src'),
  path.join(repoRoot, 'automation-service/src'),
  path.join(repoRoot, 'campaign-service/src'),
  path.join(repoRoot, 'billing-service/src'),
  path.join(repoRoot, 'bsp-service/src'),
  path.join(repoRoot, 'webhook-ingestor/src'),
];

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|js)$/.test(entry.name) ? [full] : [];
  });
}

function extractRoutes(file) {
  const text = fs.readFileSync(file, 'utf8');
  const routes = [];
  const routeRegex = /\b(?:router|app)\.(get|post|put|patch|delete|use)\(\s*['"`]([^'"`]+)['"`]/g;
  const nestControllerRegex = /@Controller\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
  const nestMethodRegex = /@(Get|Post|Put|Patch|Delete)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;

  let match;
  while ((match = routeRegex.exec(text))) {
    routes.push({ method: match[1].toUpperCase(), path: match[2], file });
  }

  const controllers = [...text.matchAll(nestControllerRegex)].map((m) => m[1]);
  if (controllers.length) {
    const base = controllers[controllers.length - 1] || '';
    while ((match = nestMethodRegex.exec(text))) {
      const method = match[1].toUpperCase();
      const child = match[2] || '';
      routes.push({ method, path: `${base}/${child}`.replace(/\/+/g, '/').replace(/\/$/, '') || '/', file });
    }
  }

  return routes;
}

function extractExpressMounts(indexFile) {
  const text = fs.readFileSync(indexFile, 'utf8');
  const imports = new Map();
  const importRegex = /import\s+([A-Za-z0-9_]+)\s+from\s+['"]\.\/routes\/([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(text))) {
    imports.set(match[1], path.join(OLD_ROUTE_DIR, `${match[2]}.ts`));
  }

  const mounts = new Map();
  const useRegex = /app\.use\(\s*['"`]([^'"`]+)['"`]([\s\S]*?)\);/g;
  while ((match = useRegex.exec(text))) {
    const mountPath = match[1];
    const args = match[2];
    for (const [variable, file] of imports) {
      if (new RegExp(`\\b${variable}\\b`).test(args)) {
        mounts.set(file, mountPath);
      }
    }
  }

  return mounts;
}

function extractGatewayCoverage(indexFile) {
  const text = fs.readFileSync(indexFile, 'utf8');
  const coverage = [];
  const useRegex = /app\.use\(\s*['"`]([^'"`]+)['"`]/g;
  const routeRegex = /app\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
  let match;

  while ((match = useRegex.exec(text))) {
    coverage.push({ method: 'ANY', path: match[1], prefix: true });
  }

  while ((match = routeRegex.exec(text))) {
    coverage.push({ method: match[1].toUpperCase(), path: match[2], prefix: false });
  }

  return coverage;
}

function normalize(routePath) {
  return routePath
    .replace(/\/+/g, '/')
    .replace(/\/$/, '')
    .replace(/:([A-Za-z0-9_]+)/g, ':param') || '/';
}

function joinRoute(base, child) {
  if (child === '/') return normalize(base);
  return normalize(`${base}/${child}`);
}

const oldMounts = extractExpressMounts(OLD_INDEX);
const oldRoutes = walk(OLD_ROUTE_DIR).flatMap((file) => {
  const base = oldMounts.get(file) || '';
  return extractRoutes(file).map((route) => ({
    ...route,
    fullPath: joinRoute(base, route.path),
  }));
});
const newRoutes = NEW_SCAN_DIRS.flatMap((dir) => walk(dir).flatMap(extractRoutes));
const newKeys = new Set(newRoutes.map((route) => `${route.method} ${normalize(route.path)}`));
const gatewayCoverage = extractGatewayCoverage(NEW_GATEWAY_INDEX).map((route) => ({
  ...route,
  path: normalize(route.path),
}));

function routeIsCovered(route) {
  const fullPath = normalize(route.fullPath || route.path);
  if (newKeys.has(`${route.method} ${fullPath}`)) return true;
  if (newKeys.has(`USE ${fullPath}`)) return true;

  return gatewayCoverage.some((coverage) => {
    if (coverage.method !== 'ANY' && coverage.method !== route.method) return false;
    if (coverage.prefix) {
      return fullPath === coverage.path || fullPath.startsWith(`${coverage.path}/`);
    }
    return fullPath === coverage.path;
  });
}

const missing = oldRoutes
  .filter((route) => route.method !== 'USE')
  .filter((route) => !routeIsCovered(route))
  .map((route) => ({
    method: route.method,
    path: route.fullPath,
    localPath: route.path,
    source: path.relative(backupRoot, route.file),
  }));

console.log(JSON.stringify({
  oldRouteCount: oldRoutes.length,
  newRouteCount: newRoutes.length,
  gatewayCoverageCount: gatewayCoverage.length,
  missingCount: missing.length,
  missing,
}, null, 2));

if (missing.length > 0) {
  process.exitCode = 1;
}
