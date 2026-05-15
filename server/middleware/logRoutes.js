/**
 * middleware/logRoutes.js
 *
 * Logs every incoming request to stdout.
 * Attach early in index.js so every route is covered.
 */

const logRoutes = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]  ${req.method.padEnd(6)} ${req.originalUrl}`);
  next();
};

module.exports = logRoutes;
