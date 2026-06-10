const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

// Microservices Configuration
const SERVICES = [
  { name: 'api-gateway', dir: 'services/api-gateway', cmd: 'npm run dev', color: '\x1b[36m' }, // API Gateway (Cyan)
  { name: 'auth-service', dir: 'services/auth-service', cmd: 'npm run dev', color: '\x1b[32m' }, // Auth (Green)
  { name: 'campaign-service', dir: 'services/campaign-service', cmd: 'npm run dev', color: '\x1b[35m' }, // Campaigns (Magenta)
  { name: 'billing-service', dir: 'services/billing-service', cmd: 'npm run dev', color: '\x1b[33m' }, // Billing (Yellow)
  { name: 'service-provider', dir: 'services/service-provider', cmd: 'npm run dev', color: '\x1b[34m' }, // Service Provider (Blue)
  { name: 'automation-service', dir: 'services/automation-service', cmd: 'npm run dev', color: '\x1b[31m' }, // Automation (Red)
  { name: 'chat-service', dir: 'services/chat-service', cmd: 'npm run dev', color: '\x1b[94m' }, // Chat (Bright Blue)
  { name: 'contact-service', dir: 'services/contact-service', cmd: 'npm run dev', color: '\x1b[92m' }, // Contact (Bright Green)
  { name: 'webhook-ingestor', dir: 'services/webhook-ingestor', cmd: 'npm run dev', color: '\x1b[95m' }, // Webhook Ingestor (Bright Magenta)
  { name: 'websocket-gateway', dir: 'services/websocket-gateway', cmd: 'npm run dev', color: '\x1b[96m' }, // Websocket Gateway (Bright Cyan)
  { name: 'admin-portal', dir: 'apps/admin-portal', cmd: 'npm run dev', color: '\x1b[37m' }, // Admin Portal (White)
  { name: 'frontend', dir: 'apps/frontend', cmd: 'npm run dev', color: '\x1b[90m' } // Frontend NextJS (Gray)
];

const runningProcesses = {};
const logMuted = {};
let globalLogs = true;

// Initialize log settings
SERVICES.forEach(s => {
  logMuted[s.name] = false;
});

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m'
};

function formatPrefix(service) {
  return `${service.color}[${service.name}]${colors.reset}`;
}

function startService(service) {
  const servicePath = path.join(__dirname, service.dir);
  console.log(`${formatPrefix(service)} Starting with command: "${service.cmd}"...`);

  const [cmd, ...args] = service.cmd.split(' ');

  // Spawn inside a detached process group to allow killing entire process trees
  const child = spawn(cmd, args, {
    cwd: servicePath,
    shell: true,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  runningProcesses[service.name] = {
    child,
    startTime: Date.now(),
    status: 'RUNNING',
    pid: child.pid
  };

  // Route stdout logs
  child.stdout.on('data', (data) => {
    if (!globalLogs || logMuted[service.name]) return;
    const output = data.toString();
    const lines = output.split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`${formatPrefix(service)} ${line}`);
      }
    });
  });

  // Route stderr logs
  child.stderr.on('data', (data) => {
    if (!globalLogs || logMuted[service.name]) return;
    const output = data.toString();
    const lines = output.split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        const lowerLine = line.toLowerCase();
        // Check if this stderr output is a warning/notice rather than a crash error
        const isWarning = lowerLine.includes('warning') || 
                          lowerLine.includes('deprecation') || 
                          (lowerLine.includes('kafkajs') && lowerLine.includes('"level":"warn"')) || 
                          (lowerLine.includes('cloudinary') && lowerLine.includes('missing')) ||
                          lowerLine.includes('deprecated') ||
                          lowerLine.includes('reserved schema pathname');

        if (isWarning) {
          console.log(`${formatPrefix(service)} \x1b[33m[WARN]\x1b[0m ${line}`);
        } else {
          console.log(`${formatPrefix(service)} \x1b[31m[ERROR]\x1b[0m ${line}`);
        }
      }
    });
  });

  child.on('close', (code) => {
    if (runningProcesses[service.name] && runningProcesses[service.name].status !== 'STOPPED') {
      console.log(`${formatPrefix(service)} Process exited with code ${code}. Restarting in 3s...`);
      runningProcesses[service.name].status = 'CRASHED';
      setTimeout(() => {
        if (runningProcesses[service.name] && runningProcesses[service.name].status === 'CRASHED') {
          startService(service);
        }
      }, 3000);
    }
  });

  child.on('error', (err) => {
    console.error(`${formatPrefix(service)} Failed to start process:`, err.message);
  });
}

function stopService(serviceName) {
  const proc = runningProcesses[serviceName];
  if (!proc || proc.status === 'STOPPED') return Promise.resolve();

  proc.status = 'STOPPED';
  console.log(`Stopping service "${serviceName}" (killing process group -${proc.pid})...`);

  return new Promise((resolve) => {
    try {
      // Kill entire process tree by passing negative PID (process group leader)
      process.kill(-proc.pid, 'SIGINT');
    } catch (e) {
      // Fallback direct kill if group kill fails
      try { proc.child.kill('SIGINT'); } catch (err) {}
    }

    // Force terminate after 2 seconds if still running
    const forceTimeout = setTimeout(() => {
      try {
        process.kill(-proc.pid, 'SIGKILL');
      } catch (e) {}
      resolve();
    }, 2000);

    proc.child.on('close', () => {
      clearTimeout(forceTimeout);
      console.log(`✓ Service "${serviceName}" stopped cleanly.`);
      resolve();
    });
  });
}

async function shutdownAll() {
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('SHUTTING DOWN ALL SERVICES...');
  console.log('════════════════════════════════════════════════════════════');

  const stopPromises = Object.keys(runningProcesses).map(name => stopService(name));
  await Promise.all(stopPromises);
  console.log('All microservice processes terminated and ports freed. Goodbye!');
  process.exit(0);
}

// Set up process termination signals
process.on('SIGINT', shutdownAll);
process.on('SIGTERM', shutdownAll);

// Start all configured services
console.log(`${colors.cyan}${colors.bright}════════════════════════════════════════════════════════════`);
console.log('  wApi MICROSERVICES DEVELOPMENT ORCHESTRATOR RUNNER');
console.log(`════════════════════════════════════════════════════════════${colors.reset}`);
console.log('Starting all microservices with staggered spacing (1.5s delay)...\n');

async function startAll() {
  for (let i = 0; i < SERVICES.length; i++) {
    startService(SERVICES[i]);
    // Stagger startup so the CPU does not spike
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}
startAll();

// Set up Interactive Command Console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log(`\n${colors.green}Orchestrator online. Type "help" to view interactive commands at any time.${colors.reset}\n`);

rl.on('line', async (line) => {
  const input = line.trim();
  if (!input) return;

  const parts = input.split(' ');
  const cmd = parts[0].toLowerCase();
  const arg = parts[1];

  switch (cmd) {
    case 'help':
      console.log('\nInteractive Runner Commands:');
      console.log('  status                - Live state of all 11 microservices');
      console.log('  restart <service>     - Hot-reload an individual service (e.g. restart auth-service)');
      console.log('  stop <service>        - Terminate a specific service');
      console.log('  start <service>       - Start a stopped service');
      console.log('  log <service> off/on  - Mute/Unmute console logs for a specific service');
      console.log('  logs off/on           - Mute/Unmute ALL logs to clean up input dashboard');
      console.log('  clear                 - Clear console window');
      console.log('  exit / quit           - Stop all 11 services and quit cleanly');
      break;

    case 'status':
      console.log('\n════════════════════════════════════════════════════════════');
      console.log('SERVICES STATUS DASHBOARD:');
      console.log('════════════════════════════════════════════════════════════');
      SERVICES.forEach(s => {
        const proc = runningProcesses[s.name];
        const status = proc ? proc.status : 'NOT STARTED';
        const pid = proc ? proc.pid : '-';
        const uptime = proc && proc.status === 'RUNNING' 
          ? `${Math.round((Date.now() - proc.startTime) / 1000)}s` 
          : '0s';
        const muteState = logMuted[s.name] ? 'MUTED' : 'ACTIVE';
        
        let color = colors.reset;
        if (status === 'RUNNING') color = colors.green;
        if (status === 'STOPPED') color = colors.yellow;
        if (status === 'CRASHED') color = colors.red;

        console.log(`- ${s.name.padEnd(20)} | State: ${color}${status.padEnd(10)}${colors.reset} | PID: ${String(pid).padEnd(8)} | Uptime: ${uptime.padEnd(6)} | Logs: ${muteState}`);
      });
      console.log(`Global Logs Output: ${globalLogs ? 'ENABLED' : 'DISABLED'}`);
      console.log('════════════════════════════════════════════════════════════');
      break;

    case 'restart':
      if (!arg) {
        console.log('Please specify a service name to restart.');
        break;
      }
      const restartTarget = SERVICES.find(s => s.name === arg);
      if (!restartTarget) {
        console.log(`Service "${arg}" not found. Type "status" to see valid names.`);
        break;
      }
      console.log(`Restarting service "${arg}"...`);
      await stopService(arg);
      startService(restartTarget);
      break;

    case 'stop':
      if (!arg) {
        console.log('Please specify a service name to stop.');
        break;
      }
      if (!runningProcesses[arg]) {
        console.log(`Service "${arg}" is not running.`);
        break;
      }
      await stopService(arg);
      break;

    case 'start':
      if (!arg) {
        console.log('Please specify a service name to start.');
        break;
      }
      const startTarget = SERVICES.find(s => s.name === arg);
      if (!startTarget) {
        console.log(`Service "${arg}" not found.`);
        break;
      }
      if (runningProcesses[arg] && runningProcesses[arg].status === 'RUNNING') {
        console.log(`Service "${arg}" is already running.`);
        break;
      }
      startService(startTarget);
      break;

    case 'log':
      if (!arg || !parts[2]) {
        console.log('Usage: log <service-name> on/off');
        break;
      }
      if (logMuted[arg] === undefined) {
        console.log(`Service "${arg}" not found.`);
        break;
      }
      const state = parts[2].toLowerCase();
      if (state === 'off') {
        logMuted[arg] = true;
        console.log(`Muted logs for "${arg}".`);
      } else {
        logMuted[arg] = false;
        console.log(`Unmuted logs for "${arg}".`);
      }
      break;

    case 'logs':
      if (!arg) {
        console.log('Usage: logs on/off');
        break;
      }
      if (arg.toLowerCase() === 'off') {
        globalLogs = false;
        console.log('Muted ALL microservice stdout logs. Dashboard is now clean.');
      } else {
        globalLogs = true;
        console.log('Unmuted ALL microservice stdout logs.');
      }
      break;

    case 'clear':
      console.clear();
      break;

    case 'exit':
    case 'quit':
      await shutdownAll();
      break;

    default:
      console.log(`Unknown command "${cmd}". Type "help" to see available options.`);
  }
});
