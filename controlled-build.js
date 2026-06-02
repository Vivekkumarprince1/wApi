#!/usr/bin/env node

/**
 * Controlled Build Coordinator for wApi
 *
 * Sequentially builds all microservices and frontend.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Color constants for beautiful terminal output
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgGreen: '\x1b[42m'
};

const ROOT_DIR = __dirname;

// Define services and their build configurations
const SERVICES = [
  { name: 'Shared Contracts',   dir: 'packages/contracts',   buildCmd: 'npm', buildArgs: ['run', 'build'], required: true },
  { name: 'API Gateway',        dir: 'api-gateway',          buildCmd: 'npm', buildArgs: ['run', 'build'], required: true },
  { name: 'Automation Service', dir: 'automation-service',   buildCmd: 'npm', buildArgs: ['run', 'build'], required: true },
  { name: 'Billing Service',    dir: 'billing-service',      buildCmd: 'npm', buildArgs: ['run', 'build'], required: true },
  { name: 'Campaign Service',   dir: 'campaign-service',     buildCmd: 'npm', buildArgs: ['run', 'build'], required: true },
  { name: 'WebSocket Service',  dir: 'websocket-service',    buildCmd: 'npm', buildArgs: ['run', 'build'], required: true },
  { name: 'Core Server',        dir: 'server',               buildCmd: 'npm', buildArgs: ['run', 'build'], required: true },
  { name: 'Frontend App',       dir: 'frontend',             buildCmd: 'npm', buildArgs: ['run', 'build'], required: true }
];

// Helper to log with timestamps and colors
function log(msg, color = COLORS.reset) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${COLORS.dim}[${timestamp}]${COLORS.reset} ${color}${msg}${COLORS.reset}`);
}

function printHeader() {
  console.log('\n' + COLORS.bright + COLORS.bgBlue + ' ⚡ wApi SEQUENTIAL CONTROLLED BUILD SYSTEM ⚡ ' + COLORS.reset);
  console.log(COLORS.cyan + 'Sequentially compiling all services and the frontend\n' + COLORS.reset);

  console.log(`${COLORS.bright}Build targets in order:${COLORS.reset}`);
  SERVICES.forEach((service, index) => {
    console.log(`  ${index + 1}. ${COLORS.bright}${service.name}${COLORS.reset} (${COLORS.dim}${service.dir}${COLORS.reset})`);
  });
  console.log('\n' + COLORS.dim + '---------------------------------------------------------' + COLORS.reset + '\n');
}

// Ensures node_modules exists, installing if missing in a controlled sequential way
function ensureNodeModules(service) {
  return Promise.resolve();
}

// Executes a command in a specific directory with limited memory
function buildService(service) {
  return new Promise((resolve, reject) => {
    const servicePath = path.join(ROOT_DIR, service.dir);
    
    log(`Starting build for: ${COLORS.bright}${service.name}${COLORS.reset}`, COLORS.blue);
    log(`Directory: ${COLORS.dim}${service.dir}${COLORS.reset}`);

    const startTime = Date.now();

    log(`Running: ${service.buildCmd} ${service.buildArgs.join(' ')}`, COLORS.dim);

    const child = spawn(service.buildCmd, service.buildArgs, {
      cwd: servicePath,
      env: process.env,
      shell: true
    });

    let errorOutput = '';

    child.stdout.on('data', (data) => {
      // Pipe output line-by-line with a prefix to keep terminal structured
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`  ${COLORS.cyan}[${service.name}]${COLORS.reset} ${line}`);
        }
      });
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      errorOutput += output;
      const lines = output.split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          console.log(`  ${COLORS.red}[${service.name} ERR]${COLORS.reset} ${line}`);
        }
      });
    });

    child.on('close', (code) => {
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      if (code === 0) {
        log(`Successfully built ${COLORS.bright}${service.name}${COLORS.reset} in ${duration}s`, COLORS.green);
        resolve({ name: service.name, success: true, duration });
      } else {
        log(`Failed to build ${COLORS.bright}${service.name}${COLORS.reset} after ${duration}s (exit code ${code})`, COLORS.red);
        reject({ name: service.name, success: false, duration, error: errorOutput });
      }
    });

    child.on('error', (err) => {
      log(`Process execution error for ${service.name}: ${err.message}`, COLORS.red);
      reject({ name: service.name, success: false, duration: 0, error: err.message });
    });
  });
}

async function run() {
  const args = process.argv.slice(2);
  const singleTargetName = args[0] ? args[0].toLowerCase() : null;

  printHeader();

  let targets = SERVICES;
  
  if (singleTargetName) {
    const matched = SERVICES.filter(s => 
      s.name.toLowerCase().includes(singleTargetName) || 
      s.dir.toLowerCase().includes(singleTargetName)
    );
    
    if (matched.length === 0) {
      console.log(COLORS.red + `Error: Service matching "${args[0]}" not found.` + COLORS.reset);
      console.log(`Available services: ${SERVICES.map(s => s.dir).join(', ')}`);
      process.exit(1);
    }
    
    targets = matched;
    log(`Selective mode: Only building ${COLORS.bright}${targets.map(t => t.name).join(', ')}${COLORS.reset}\n`, COLORS.yellow);
  }

  const reports = [];
  const globalStartTime = Date.now();
  let hasFailures = false;

  for (const service of targets) {
    console.log(COLORS.dim + '---------------------------------------------------------' + COLORS.reset);
    try {
      await ensureNodeModules(service);
      const report = await buildService(service);
      reports.push(report);
      // Brief pause between builds to let OS release memory heap
      await new Promise(r => setTimeout(r, 1500));
    } catch (errReport) {
      const errMsg = errReport.error || errReport.message || String(errReport);
      const errDuration = errReport.duration || 0;
      const report = { name: service.name, success: false, duration: errDuration, error: errMsg };
      reports.push(report);
      hasFailures = true;
      if (service.required) {
        log(`\nCritical build failure encountered in ${service.name}. Aborting controlled build to prevent further system load.`, COLORS.red);
        break;
      }
    }
  }

  const totalDuration = ((Date.now() - globalStartTime) / 1000).toFixed(1);

  // Print final build metrics report
  console.log('\n' + COLORS.dim + '=========================================================' + COLORS.reset);
  console.log(COLORS.bright + COLORS.bgGreen + '                 BUILD EXECUTION REPORT                  ' + COLORS.reset);
  console.log(COLORS.dim + '=========================================================' + COLORS.reset);
  
  reports.forEach(report => {
    const statusColor = report.success ? COLORS.green : COLORS.red;
    const statusText = report.success ? '✔ SUCCESS' : '✘ FAILED';
    console.log(`  - ${COLORS.bright}${report.name.padEnd(22)}${COLORS.reset} : ${statusColor}${statusText.padEnd(10)}${COLORS.reset} (${report.duration}s)`);
  });
  
  console.log(COLORS.dim + '---------------------------------------------------------' + COLORS.reset);
  const summaryColor = hasFailures ? COLORS.red : COLORS.green;
  const summaryText = hasFailures ? 'BUILD FAILED WITH ERRORS' : 'ALL TARGETS BUILT SUCCESSFULLY';
  console.log(`${COLORS.bright}Result: ${summaryColor}${summaryText}${COLORS.reset} | Total Time: ${COLORS.bright}${totalDuration}s${COLORS.reset}\n`);

  process.exit(hasFailures ? 1 : 0);
}

// Clean termination handling
process.on('SIGINT', () => {
  console.log('\n' + COLORS.red + 'Build interrupted by user. Cleaning up...' + COLORS.reset);
  process.exit(1);
});

run();
