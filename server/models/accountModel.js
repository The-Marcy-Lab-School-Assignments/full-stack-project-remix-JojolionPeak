/**
 * models/accountModel.js
 *
 * All SQL that touches the `accounts` table lives here.
 */

const pool = require("../db/pool");

// ─── Shared SELECT fragment ───────────────────────────────────────────────────

const ACCOUNT_SELECT = `
  id,
  plaid_account_id    AS "plaidAccountId",
  plaid_item_id       AS "plaidItemId",
  institution_name    AS "institutionName",
  account_name        AS "accountName",
  mask,
  type,
  subtype,
  current_balance     AS "currentBalance",
  available_balance   AS "availableBalance",
  created_at          AS "createdAt"
`;

/**
 * List all accounts belonging to a user, newest first.
 * @param {string} userId — UUID of the authenticated user
 * @returns {object[]}
 */
const listForUser = async (userId) => {
  const { rows } = await pool.query(
    `SELECT ${ACCOUNT_SELECT}
     FROM accounts
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
};

/**
 * Find a single account by ID.
 * Returns the raw user_id alongside the aliased fields so controllers
 * can do ownership checks without a second query.
 * @param {string} id — UUID
 * @returns {object|null}
 */
const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT ${ACCOUNT_SELECT}, user_id AS "userId"
     FROM accounts
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Create a manual account for a user.
 * Plaid fields (plaid_account_id, plaid_item_id) are intentionally excluded —
 * those are only set by the Plaid ingestion pipeline.
 *
 * @param {string} userId
 * @param {object} fields — { accountName, institutionName, mask, type, subtype,
 *                            currentBalance, availableBalance }
 * @returns {object} newly created account row
 */
const create = async (
  userId,
  {
    accountName,
    institutionName,
    mask,
    type,
    subtype,
    currentBalance,
    availableBalance,
  }
) => {
  const { rows } = await pool.query(
    `INSERT INTO accounts
       (user_id, account_name, institution_name, mask, type, subtype,
        current_balance, available_balance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${ACCOUNT_SELECT}`,
    [
      userId,
      accountName,
      institutionName || null,
      mask || null,
      type,
      subtype || null,
      currentBalance ?? null,
      availableBalance ?? null,
    ]
  );
  return rows[0];
};

/**
 * Update an existing account (partial update).
 * Only fields that are explicitly provided will be changed.
 * The controller must verify ownership before calling this.
 *
 * @param {string} id — account UUID
 * @param {object} fields — any subset of the create fields
 * @returns {object|null} updated account row
 */
const update = async (id, fields) => {
  const allowedFields = {
    accountName: "account_name",
    institutionName: "institution_name",
    mask: "mask",
    type: "type",
    subtype: "subtype",
    currentBalance: "current_balance",
    availableBalance: "available_balance",
  };

  const setClauses = [];
  const params = [];

  for (const [jsKey, dbCol] of Object.entries(allowedFields)) {
    if (fields[jsKey] !== undefined) {
      params.push(fields[jsKey]);
      setClauses.push(`${dbCol} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) {
    return findById(id);
  }

  params.push(id);
  const { rows } = await pool.query(
    `UPDATE accounts
     SET ${setClauses.join(", ")}
     WHERE id = $${params.length}
     RETURNING ${ACCOUNT_SELECT}`,
    params
  );
  return rows[0] || null;
};

/**
 * Delete an account by ID.
 * ON DELETE SET NULL in the schema preserves associated transactions.
 * The controller must verify ownership before calling this.
 * @param {string} id — UUID
 * @returns {object|null} deleted row snapshot
 */
const remove = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM accounts
     WHERE id = $1
     RETURNING id, account_name AS "accountName", type`,
    [id]
  );
  return rows[0] || null;
};

module.exports = { listForUser, findById, create, update, remove };
