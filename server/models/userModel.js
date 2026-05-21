/**
 * models/userModel.js
 *
 * All SQL that touches the `users` table lives here.
 * Controllers call these functions — they never write raw SQL.
 */

const pool = require("../db/pool");

/**
 * Find a user by their Google ID.
 * Called during the OAuth callback to check if the user already exists.
 * @param {string} googleId
 * @returns {object|null} user row or null
 */
const findByGoogleId = async (googleId) => {
  const { rows } = await pool.query(
    `SELECT id, email, display_name AS "displayName", avatar_url AS "avatarUrl", created_at AS "createdAt"
     FROM users
     WHERE google_id = $1`,
    [googleId]
  );
  return rows[0] || null;
};

/**
 * Find a user by their internal UUID.
 * Used by GET /api/auth/me to confirm the token subject still exists in the DB.
 * @param {string} id — UUID
 * @returns {object|null} user row or null
 */
const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, email, display_name AS "displayName", avatar_url AS "avatarUrl", created_at AS "createdAt"
     FROM users
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Create a new user from their Google profile.
 * Called during the OAuth callback when the user signs in for the first time.
 * @param {object} profile — { googleId, email, displayName, avatarUrl }
 * @returns {object} newly created user row
 */
const create = async ({ googleId, email, displayName, avatarUrl }) => {
  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, display_name, avatar_url)
     VALUES ($1, $2, $3, $4)
     RETURNING id, google_id, email, display_name AS "displayName", avatar_url AS "avatarUrl", created_at AS "createdAt"`,
    [googleId, email, displayName, avatarUrl]
  );
  return rows[0];
};

/**
 * Delete a user by ID.
 * ON DELETE CASCADE in the schema handles removing their transactions and custom categories.
 * @param {string} id — UUID
 * @returns {object|null} deleted user row or null if not found
 */
const remove = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM users
     WHERE id = $1
     RETURNING id, email, display_name AS "displayName"`,
    [id]
  );
  return rows[0] || null;
};

const findByEmail = async (email) => {
  const { rows } = await pool.query(
    `SELECT
      id,
      email,
      password_hash AS "passwordHash",
      display_name AS "displayName",
      avatar_url AS "avatarUrl"
     FROM users
     WHERE email = $1`,
    [email]
  );

  return rows[0] || null;
};

const createLocalUser = async ({
  displayName,
  email,
  passwordHash
}) => {
  const { rows } = await pool.query(
    `INSERT INTO users (
      display_name,
      email,
      password_hash
    )
    VALUES ($1, $2, $3)
    RETURNING
    display_name AS "displayName",
      email,
      id,
      avatar_url AS "avatarUrl"`,
    [displayName, email, passwordHash]
  );

  return rows[0];
};

const updateUser = async (id, { displayName, newPassword, avatarUrl }) => {
  const setClauses = [];
  const params = [];

  if (displayName) {
    params.push(displayName);
    setClauses.push(`display_name = $${params.length}`);
  }

  if (newPassword) {
    const bcrypt = require("bcryptjs");
    const hash = await bcrypt.hash(newPassword, 12);
    params.push(hash);
    setClauses.push(`password_hash = $${params.length}`);
  }

  if (avatarUrl !== undefined) {
    params.push(avatarUrl);
    setClauses.push(`avatar_url = $${params.length}`);
  }

  if (setClauses.length === 0) return null;

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE users
     SET ${setClauses.join(", ")}
     WHERE id = $${params.length}
     RETURNING id, email, display_name AS "displayName", avatar_url AS "avatarUrl"`,
    params
  );
  return rows[0] || null;
};

module.exports = { findByGoogleId, findById, create, remove, createLocalUser, findByEmail, updateUser };