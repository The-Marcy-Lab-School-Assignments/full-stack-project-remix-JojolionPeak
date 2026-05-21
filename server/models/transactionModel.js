/**
 * models/transactionModel.js
 *
 * All SQL that touches the `transactions` table lives here.
 * Every query JOINs to `categories` and `accounts` so the response always
 * includes category and account metadata — the frontend never needs a second fetch.
 */

const pool = require("../db/pool");

// ─── Shared SELECT fragment ───────────────────────────────────────────────────
// Reused across list / findById so column aliasing stays consistent.
const TX_SELECT = `
  t.id,
  t.account_id       AS "accountId",
  t.amount,
  t.type,
  t.status,
  t.description,
  t.merchant,
  t.date,
  t.authorized_date  AS "authorizedDate",
  t.source,
  t.created_at       AS "createdAt",
  t.updated_at       AS "updatedAt",
  JSON_BUILD_OBJECT(
    'id',    c.id,
    'name',  c.name,
    'icon',  c.icon,
    'color', c.color
  ) AS category,
  CASE
    WHEN t.account_id IS NULL THEN NULL
    ELSE JSON_BUILD_OBJECT(
      'id',              a.id,
      'accountName',     a.account_name,
      'institutionName', a.institution_name,
      'mask',            a.mask,
      'type',            a.type,
      'subtype',         a.subtype
    )
  END AS account
`;

/**
 * List a user's transactions within a date range, with optional filters.
 * Returns results paginated and sorted newest-first.
 *
 * @param {string}  userId
 * @param {object}  opts
 * @param {string}  opts.from         — ISO date string 'YYYY-MM-DD'
 * @param {string}  opts.to           — ISO date string 'YYYY-MM-DD'
 * @param {string}  [opts.type]       — 'expense' | 'income'
 * @param {string}  [opts.status]     — 'pending' | 'complete'
 * @param {string}  [opts.categoryId] — UUID filter
 * @param {string}  [opts.accountId]  — UUID filter
 * @param {number}  [opts.page=1]
 * @param {number}  [opts.limit=20]
 * @returns {{ data: object[], total: number }}
 */
const listByDateRange = async (
  userId,
  { from, to, type, status, categoryId, accountId, page = 1, limit = 20 }
) => {
  const offset = (page - 1) * limit;
  const params = [userId, from, to];
  const filters = [`t.user_id = $1`, `t.date >= $2`, `t.date <= $3`];

  if (type) {
    params.push(type);
    filters.push(`t.type = $${params.length}`);
  }

  if (status) {
    params.push(status);
    filters.push(`t.status = $${params.length}`);
  }

  if (categoryId) {
    params.push(categoryId);
    filters.push(`t.category_id = $${params.length}`);
  }

  if (accountId) {
    params.push(accountId);
    filters.push(`t.account_id = $${params.length}`);
  }

  const where = filters.join(" AND ");

  // Count total matching rows for pagination metadata
  const countResult = await pool.query(
    `SELECT COUNT(*) FROM transactions t WHERE ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Fetch the page
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT ${TX_SELECT}
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts   a ON t.account_id  = a.id
     WHERE ${where}
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT $${params.length - 1}
     OFFSET $${params.length}`,
    params
  );

  return { data: rows, total };
};

/**
 * Find a single transaction by ID.
 * Used by update/delete to verify the transaction exists.
 * @param {string} id — UUID
 * @returns {object|null}
 */
const findById = async (id) => {
  const { rows } = await pool.query(
    `SELECT ${TX_SELECT}
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts   a ON t.account_id  = a.id
     WHERE t.id = $1`,
    [id]
  );
  return rows[0] || null;
};

/**
 * Return the top N expense transactions by absolute amount for a user within a date range.
 * Used by the summary endpoint to populate the "Top 5 Purchases" card.
 *
 * @param {string} userId
 * @param {string} from  — 'YYYY-MM-DD'
 * @param {string} to    — 'YYYY-MM-DD'
 * @param {number} [limit=5]
 * @returns {object[]}
 */
const topExpenses = async (userId, from, to, limit = 5) => {
  const { rows } = await pool.query(
    `SELECT ${TX_SELECT}
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts   a ON t.account_id  = a.id
     WHERE t.user_id = $1
       AND t.type    = 'expense'
       AND t.date   >= $2
       AND t.date   <= $3
     ORDER BY t.amount ASC
     LIMIT $4`,
    [userId, from, to, limit]
  );
  return rows;
};

/**
 * Aggregate total income and total expenses for a user within a date range.
 * Returns zeroes rather than null when no transactions exist.
 *
 * @param {string} userId
 * @param {string} from  — 'YYYY-MM-DD'
 * @param {string} to    — 'YYYY-MM-DD'
 * @returns {{ totalExpenses: number, totalIncome: number, transactionCount: number }}
 */
const aggregateByDateRange = async (userId, from, to) => {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)  AS "totalExpenses",
       COALESCE(SUM(amount) FILTER (WHERE type = 'income'),  0)  AS "totalIncome",
       COUNT(*)                                                   AS "transactionCount"
     FROM transactions
     WHERE user_id = $1
       AND date   >= $2
       AND date   <= $3`,
    [userId, from, to]
  );

  const row = rows[0];
  return {
    totalExpenses: parseFloat(row.totalExpenses),
    totalIncome: parseFloat(row.totalIncome),
    transactionCount: parseInt(row.transactionCount, 10),
  };
};

/**
 * Aggregate spending grouped by category for a user within a date range.
 * Used by GET /api/summary/by-category.
 *
 * @param {string} userId
 * @param {string} from
 * @param {string} to
 * @param {string} [type]  — 'expense' | 'income' | undefined (both)
 * @returns {object[]}  [{ name, icon, color, type, total, percentage }]
 */
const aggregateByCategory = async (userId, from, to, type) => {
  const params = [userId, from, to];
  let typeFilter = "";

  if (type) {
    params.push(type);
    typeFilter = `AND t.type = $${params.length}`;
  }

  const { rows } = await pool.query(
    `WITH totals AS (
       SELECT COALESCE(SUM(ABS(amount)), 0) AS grand_total
       FROM transactions t
       WHERE t.user_id = $1
         AND t.date >= $2
         AND t.date <= $3
         AND t.category_id IS NOT NULL
         ${typeFilter}
     )
     SELECT
       c.name,
       c.icon,
       c.color,
       c.type,
       COALESCE(SUM(ABS(t.amount)), 0)                        AS total,
       ROUND(
         COALESCE(SUM(ABS(t.amount)), 0) / NULLIF(totals.grand_total, 0) * 100,
         2
       )                                                       AS percentage
     FROM transactions t
     INNER JOIN categories c ON t.category_id = c.id
     CROSS JOIN totals
     WHERE t.user_id = $1
       AND t.date >= $2
       AND t.date <= $3
       AND t.category_id IS NOT NULL
       ${typeFilter}
     GROUP BY c.id, c.name, c.icon, c.color, c.type, totals.grand_total
     ORDER BY total DESC`,
    params
  );

  return rows.map((r) => ({
    name: r.name,
    icon: r.icon,
    color: r.color,
    type: r.type,
    total: parseFloat(r.total),       // always positive — ABS applied in SQL
    percentage: parseFloat(r.percentage),
  }));
};

/**
 * Create a new transaction.
 * @param {string} userId
 * @param {object} fields — { amount, type, status?, description?, merchant?,
 *                            categoryId?, accountId?, date, authorizedDate? }
 * @returns {object} newly created transaction row (with category + account JOINs)
 */
const create = async (
  userId,
  {
    amount,
    type,
    status,
    description,
    merchant,
    categoryId,
    accountId,
    date,
    authorizedDate,
  }
) => {
  const insertResult = await pool.query(
    `INSERT INTO transactions
       (user_id, account_id, category_id, amount, type, status,
        description, merchant, date, authorized_date, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'manual')
     RETURNING id`,
    [
      userId,
      accountId || null,
      categoryId || null,
      amount,
      type,
      status || "complete",
      description || null,
      merchant || null,
      date,
      authorizedDate || null,
    ]
  );

  return findById(insertResult.rows[0].id);
};

/**
 * Update an existing transaction.
 * Only updates fields that are actually provided (partial update).
 * The controller must verify ownership before calling this.
 *
 * @param {string} id — transaction UUID
 * @param {object} fields — any subset of the create fields
 * @returns {object} updated transaction row (with category + account JOINs)
 */
const update = async (id, fields) => {
  const allowedFields = {
    amount: "amount",
    type: "type",
    status: "status",
    description: "description",
    merchant: "merchant",
    categoryId: "category_id",
    accountId: "account_id",
    date: "date",
    authorizedDate: "authorized_date",
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

  // Always stamp updated_at on any real change
  setClauses.push(`updated_at = NOW()`);

  params.push(id);
  await pool.query(
    `UPDATE transactions
     SET ${setClauses.join(", ")}
     WHERE id = $${params.length}`,
    params
  );

  return findById(id);
};

/**
 * Delete a transaction by ID.
 * The controller must verify ownership before calling this.
 * @param {string} id — UUID
 * @returns {object|null} deleted row snapshot
 */
const remove = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM transactions
     WHERE id = $1
     RETURNING id, amount, type, status, description, merchant, date`,
    [id]
  );
  return rows[0] || null;
};

module.exports = {
  listByDateRange,
  findById,
  topExpenses,
  aggregateByDateRange,
  aggregateByCategory,
  create,
  update,
  remove,
};