/**
 * models/accountModel.js
 *
 * All SQL that touches the `accounts` table lives here.
 */

const pool = require("../db/pool");

// ─── Shared SELECT fragments ──────────────────────────────────────────────────

// Public fields returned to the frontend.
// plaid_account_id and plaid_item_id are intentionally excluded — they are
// internal Plaid identifiers that have no meaning to the client and should
// not be exposed in API responses.
const ACCOUNT_SELECT = `
  id,
  institution_name    AS "institutionName",
  account_name        AS "accountName",
  mask,
  type,
  subtype,
  current_balance     AS "currentBalance",
  available_balance   AS "availableBalance",
  created_at          AS "createdAt"
`;

// Internal SELECT used only by the Plaid ingestion pipeline.
// Includes plaid_account_id so upsert logic can match existing accounts.
const ACCOUNT_SELECT_INTERNAL = `
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
     FROM accounts a
     WHERE a.user_id = $1
     ORDER BY a.created_at DESC`,
    [userId]
  );
  return rows;
};

/**
 * Find a single account by ID.
 * Returns the raw user_id alongside the aliased fields so controllers
 * can do ownership checks without a second query.
 * Does NOT include plaid identifiers — use findByIdInternal for Plaid pipeline.
 * @param {string} id — UUID
 * @returns {object|null}
 */
const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT ${ACCOUNT_SELECT}, user_id AS "userId"
     FROM accounts a
     WHERE a.id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Find a single account by ID, including Plaid identifiers.
 * Used internally by the Plaid ingestion pipeline only — never returned to clients.
 * @param {string} id — UUID
 * @returns {object|null}
 */
const findByIdInternal = async (id) => {
  const { rows } = await pool.query(
    `SELECT ${ACCOUNT_SELECT_INTERNAL}, user_id AS "userId"
     FROM accounts a
     WHERE a.id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Find an account by its Plaid account ID.
 * Used by the Plaid ingestion pipeline to detect existing accounts during upsert.
 * @param {string} plaidAccountId
 * @returns {object|null}
 */
const findByPlaidAccountId = async (plaidAccountId) => {
  const { rows } = await pool.query(
    `SELECT ${ACCOUNT_SELECT_INTERNAL}, user_id AS "userId"
     FROM accounts a
     WHERE a.plaid_account_id = $1`,
    [plaidAccountId]
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
 * @returns {object} newly created account row (public fields only)
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
 * Create or update a Plaid-sourced account.
 * Used exclusively by the Plaid ingestion pipeline.
 * Matches on plaid_account_id; inserts if new, updates balances if existing.
 *
 * @param {string} userId
 * @param {object} fields — { plaidAccountId, plaidItemId, accountName,
 *                            institutionName, mask, type, subtype,
 *                            currentBalance, availableBalance }
 * @returns {object} upserted account row (internal fields included)
 */
const upsertPlaidAccount = async (
  userId,
  {
    plaidAccountId,
    plaidItemId,
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
       (user_id, plaid_account_id, plaid_item_id, account_name,
        institution_name, mask, type, subtype,
        current_balance, available_balance)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (plaid_account_id) DO UPDATE SET
       account_name        = EXCLUDED.account_name,
       institution_name    = EXCLUDED.institution_name,
       mask                = EXCLUDED.mask,
       type                = EXCLUDED.type,
       subtype             = EXCLUDED.subtype,
       current_balance     = EXCLUDED.current_balance,
       available_balance   = EXCLUDED.available_balance
     RETURNING ${ACCOUNT_SELECT_INTERNAL}`,
    [
      userId,
      plaidAccountId,
      plaidItemId || null,
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
 * @returns {object|null} updated account row (public fields only)
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

module.exports = {
  listForUser,
  findById,
  findByIdInternal,
  findByPlaidAccountId,
  create,
  upsertPlaidAccount,
  update,
  remove,
};