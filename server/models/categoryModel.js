/**
 * models/categoryModel.js
 *
 * All SQL that touches the `categories` table lives here.
 */

const pool = require("../db/pool");

/**
 * List all categories available to a user:
 * global defaults (user_id IS NULL) + their own custom categories.
 * @param {string} userId — UUID of the authenticated user
 * @returns {object[]} array of category rows
 */
const listForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT
       id,
       name,
       icon,
       color,
       type,
       CASE WHEN user_id IS NULL THEN false ELSE true END AS "isCustom"
     FROM categories
     WHERE user_id IS NULL
        OR user_id = $1
     ORDER BY type, name`,
    [userId]
  );
  return rows;
};

/**
 * Find a single category by ID.
 * Used before delete to verify ownership.
 * @param {string} id — UUID
 * @returns {object|null}
 */
const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT id, user_id AS "userId", name, icon, color, type
     FROM categories
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Create a custom category for a specific user.
 * @param {string} userId — UUID
 * @param {object} fields — { name, icon, color, type }
 * @returns {object} newly created category row
 */
const create = async (userId, { name, icon, color, type }) => {
  const { rows } = await pool.query(
    `INSERT INTO categories (user_id, name, icon, color, type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, icon, color, type,
               true AS "isCustom"`,
    [userId, name, icon || null, color || null, type]
  );
  return rows[0];
};

/**
 * Delete a user's custom category by ID.
 * The controller must verify ownership before calling this.
 * @param {string} id — UUID
 * @returns {object|null} deleted row or null
 */
const remove = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM categories
     WHERE id = $1
     RETURNING id, name, type`,
    [id]
  );
  return rows[0] || null;
};

module.exports = { listForUser, findById, create, remove };
