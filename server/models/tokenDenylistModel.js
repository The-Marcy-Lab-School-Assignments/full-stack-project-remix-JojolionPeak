/**
 * models/tokenDenylistModel.js
 *
 * Manages the token_denylist table.
 * A token whose jti appears here is rejected by the authenticate middleware
 * regardless of its cryptographic validity.
 */

const pool = require("../db/pool");

/**
 * Add a token to the denylist.
 * Called on logout and account deletion.
 * @param {string} jti
 * @param {number} exp — Unix timestamp in seconds (from JWT payload)
 */
const add = async (jti, exp) => {
  const expiresAt = new Date(exp * 1000);
  await pool.query(
    `INSERT INTO token_denylist (jti, expires_at)
     VALUES ($1, $2)
     ON CONFLICT (jti) DO NOTHING`,
    [jti, expiresAt]
  );
};

/**
 * Check whether a token has been revoked.
 * @param {string} jti
 * @returns {boolean}
 */
const isRevoked = async (jti) => {
  const { rows } = await pool.query(
    `SELECT 1
     FROM token_denylist
     WHERE jti = $1
       AND expires_at > NOW()`,
    [jti]
  );
  return rows.length > 0;
};

/**
 * Delete all expired denylist entries.
 * @returns {number} rows deleted
 */
const purgeExpired = async () => {
  const { rowCount } = await pool.query(
    `DELETE FROM token_denylist WHERE expires_at <= NOW()`
  );
  return rowCount;
};

module.exports = { add, isRevoked, purgeExpired };