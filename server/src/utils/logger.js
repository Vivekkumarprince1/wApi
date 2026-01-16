// Simple logger wrapper to keep consistent logging across services
// Uses console.* under the hood; swap to pino/winston later if needed.

function formatArgs(level, args) {
  const ts = new Date().toISOString();
  return [`[${ts}] [${level}]`, ...args];
}

const logger = {
  info: (...args) => console.info(...formatArgs('INFO', args)),
  warn: (...args) => console.warn(...formatArgs('WARN', args)),
  error: (...args) => console.error(...formatArgs('ERROR', args)),
  debug: (...args) => {
    if (process.env.DEBUG) {
      console.debug(...formatArgs('DEBUG', args));
    }
  },
};

module.exports = { logger };
