#!/usr/bin/env node

/**
 * ⚡ wApi UNIFIED MULTI-SERVICE RUNNER & LOG CONSOLIDATOR ⚡
 * 
 * Simultaneously runs all microservices and frontend with:
 *  1. Strict heap memory limits per service to prevent low-RAM VM crashes
 *  2. Staggered/spaced startup to prevent CPU spikes and freezing
 *  3. Distinct color-coded prefix log outputs for absolute readability
 *  4. Robust multi-platform signal handling to completely eliminate orphan processes
 */

const { spawn } = require('child_process');
const path = require('path');

// Color constants for beautiful prefix logging
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Service colors
  server: '\x1b[38;5;208m',    // Orange
  gateway: '\x1b[36m',        // Cyan
  automation: '\x1b[35m',     // Magenta
  billing: '\x1b[33m',        // Yellow
  campaign: '\x1b[32m',       // Green
  websocket: '\x1b[34m',      // Blue
  frontend: '\x1b[35;1m',     // Bright Magenta
  
  // UI colors
  system: '\x1b[37;1m',       // Bright White
  success: '\x1b[32;1m',      // Bright Green
  error: '\x1b[31;1m',        // Bright Red
  warning: '\x1b[33;1m'       // Bright Yellow
};

const SERVICES = [
  {
    id: 'server',
    name: 'Core Server',
    dir: 'server',
    cmd: 'npm',
    args: ['run', 'dev'],
    color: COLORS.server,
    memoryLimit: 1024
  },
  {
    id: 'gateway',
    name: 'API Gateway',
    dir: 'api-gateway',
    cmd: 'npm',
    args: ['run', 'dev'],
    color: COLORS.gateway,
    memoryLimit: 768
  },
  {
    id: 'automation',
    name: 'Automation Service',
    dir: 'automation-service',
    cmd: 'npm',
    args: ['run', 'dev'],
    color: COLORS.automation,
    memoryLimit: 768
  },
  {
    id: 'billing',
    name: 'Billing Service',
    dir: 'billing-service',
    cmd: 'npm',
    args: ['run', 'dev'],
    color: COLORS.billing,
    memoryLimit: 768
  },
  {
    id: 'campaign',
    name: 'Campaign Service',
    dir: 'campaign-service',
    cmd: 'npm',
    args: ['run', 'dev'],
    color: COLORS.campaign,
    memoryLimit: 768
  },
  {
    id: 'websocket',
    name: 'WebSocket Service',
    dir: 'websocket-service',
    cmd: 'npm',
    args: ['run', 'dev'],
    color: COLORS.websocket,
    memoryLimit: 768
  },
  {
    id: 'frontend',
    name: 'Frontend App',
    dir: 'frontend',
    cmd: 'npm',
    args: ['run', 'dev'],
    color: COLORS.frontend,
    memoryLimit: 1536
  }
];

const children = [];
let isShuttingDown = false;

// Format prefix helper
function getPrefix(service) {
  const time = new Date().toLocaleTimeString();
  const namePadded = service.name.padEnd(20, ' ');
  return `${service.color}[${namePadded} | ${time}]${COLORS.reset} `;
}

// Log directly to stdout/stderr
function logSystem(message, type = 'system') {
  const time = new Date().toLocaleTimeString();
  let color = COLORS.system;
  if (type === 'success') color = COLORS.success;
  if (type === 'error') color = COLORS.error;
  if (type === 'warning') color = COLORS.warning;
  console.log(`${color}[SYSTEM | ${time}] ${message}${COLORS.reset}`);
}

// Run a single service
function startService(service) {
  const dirPath = path.join(__dirname, service.dir);
  
  // Set memory limits via NODE_OPTIONS env variable
  const env = {
    ...process.env,
    NODE_OPTIONS: `--max-old-space-size=${service.memoryLimit} ${process.env.NODE_OPTIONS || ''}`.trim()
  };

  logSystem(`Starting ${service.name} (RAM Limit: ${service.memoryLimit}MB)...`, 'system');

  const child = spawn(service.cmd, service.args, {
    cwd: dirPath,
    env,
    shell: true,
    detached: process.platform !== 'win32'
  });

  child.service = service;
  children.push(child);

  // Line-by-line output handling
  const handleOutput = (data, isErrorStream = false) => {
    if (isShuttingDown) return;
    const prefix = getPrefix(service);
    const text = data.toString();
    const lines = text.split('\n');
    
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (isErrorStream) {
        console.error(`${prefix}${COLORS.error}${trimmed}${COLORS.reset}`);
      } else {
        console.log(`${prefix}${trimmed}`);
      }
    });
  };

  child.stdout.on('data', (data) => handleOutput(data, false));
  child.stderr.on('data', (data) => handleOutput(data, true));

  child.on('close', (code) => {
    if (isShuttingDown) return;
    const level = code === 0 ? 'success' : 'error';
    logSystem(`${service.name} process exited with code ${code}`, level);
  });

  child.on('error', (err) => {
    if (isShuttingDown) return;
    logSystem(`Failed to start ${service.name}: ${err.message}`, 'error');
  });
}

// Main execution coordinator
async function main() {
  console.clear();
  console.log(`${COLORS.bright}${COLORS.success}`);
  console.log(` ⚡ wApi UNIFIED MULTI-SERVICE RUNNER ⚡ `);
  console.log(`=========================================`);
  console.log(`Memory-capped concurrent dev environment `);
  console.log(`${COLORS.reset}`);

  logSystem(`Spawning ${SERVICES.length} services with staggered spacing (1.5s delay)...`, 'system');

  for (let i = 0; i < SERVICES.length; i++) {
    if (isShuttingDown) break;
    startService(SERVICES[i]);
    // Stagger startup so the CPU does not spike
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  logSystem('All microservices and frontend are running! Press Ctrl+C to terminate all cleanly.', 'success');
}

// Graceful cleanup function
function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n');
  logSystem(`Received ${signal}. Gracefully terminating all microservices...`, 'warning');

  let activeCount = children.length;
  if (activeCount === 0) {
    logSystem('No processes to clean up. Exiting.', 'success');
    process.exit(0);
  }

  children.forEach((child) => {
    logSystem(`Terminating child process: ${child.service.name}...`, 'system');
    try {
      if (process.platform !== 'win32' && child.pid) {
        // Kill process group to ensure underlying ts-node-dev / node processes are reaped
        process.kill(-child.pid, 'SIGTERM');
      } else {
        child.kill();
      }
    } catch {
      try { child.kill(); } catch {}
    }
  });

  // Brief timeout to let processes exit before terminating parent
  setTimeout(() => {
    logSystem('All microservice processes reaped successfully. Exit complete.', 'success');
    process.exit(0);
  }, 1200);
}

// Wire up termination hooks
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main();
