/**
 * cleanupJob.js
 *
 * Deletes expired rows from token_denylist on a regular interval.
 */

const denylistModel = require("./models/tokenDenylistModel");

const INTERVAL_MS =
  parseInt(process.env.CLEANUP_INTERVAL_MS, 10) || 6 * 60 * 60 * 1000; // default 6h

const start = () => {
  setInterval(async () => {
    try {
      const deleted = await denylistModel.purgeExpired();
      if (deleted > 0) {
        console.log(`🧹 Token denylist cleanup removed ${deleted} expired entries.`);
      }
    } catch (err) {
      console.error("⚠️ Token denylist cleanup failed:", err.message);
    }
  }, INTERVAL_MS);

  console.log(`🕐 Token denylist cleanup scheduled every ${INTERVAL_MS / 1000 / 60 / 60}h`);
};

module.exports = { start };