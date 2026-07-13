import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";

const preferredPort = Number.parseInt(process.env.PORT || "3200", 10);
const maxAttempts = 20;
const devLockPath = new URL("../.next/dev/lock", import.meta.url);

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function getActiveDevServer() {
  try {
    const lock = JSON.parse(await readFile(devLockPath, "utf8"));
    if (lock.pid && isProcessRunning(lock.pid)) {
      return lock;
    }
  } catch {
    return null;
  }

  return null;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "::");
  });
}

const activeDevServer = await getActiveDevServer();
if (activeDevServer) {
  const url = activeDevServer.appUrl || `http://localhost:${activeDevServer.port || preferredPort}`;
  console.log(`[career-portal] Dev server already running at ${url} (PID ${activeDevServer.pid}).`);
  process.exit(0);
}

let selectedPort = preferredPort;
for (let offset = 0; offset < maxAttempts; offset += 1) {
  const port = preferredPort + offset;
  if (await isPortAvailable(port)) {
    selectedPort = port;
    break;
  }
}

if (selectedPort !== preferredPort) {
  console.log(`[career-portal] Port ${preferredPort} is busy. Starting dev server on ${selectedPort}.`);
}

const child = spawn("next", ["dev", "-p", String(selectedPort), "--webpack"], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
