const cron = require('node-cron');
const { snapshotActivePhones } = require('./usageLedgerService');
const { logger } = require('../utils/logger');

class UsageLedgerCron {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null;
  }

  start() {
    this.cronJob = cron.schedule('30 0 * * *', async () => {
      await this.executeSnapshot();
    });

    logger.info('[UsageLedgerCron] Cron job started - runs daily at 00:30 UTC');
  }

  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info('[UsageLedgerCron] Cron job stopped');
    }
  }

  async executeSnapshot() {
    if (this.isRunning) {
      logger.warn('[UsageLedgerCron] Previous snapshot still running, skipping');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = new Date();

    try {
      await snapshotActivePhones();
      logger.info('[UsageLedgerCron] Active phone snapshot complete');
    } catch (error) {
      logger.error('[UsageLedgerCron] Snapshot failed:', error);
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new UsageLedgerCron();
