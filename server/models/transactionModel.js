/**
 * models/transactionModel.js
 *
 * All SQL that touches the `transactions` table lives here.
 * Every query JOINs to `categories` and `accounts` so the response always
 * includes category and account metadata — the frontend never needs a second fetch.
 *
 * All aggregate functions accept an optional `accountId` parameter for
 * account-scoped summaries. When provided, the query is filtered to that
 * account only. The caller is responsible for verifying ownership before
 * passing an accountId here.
 */

const pool = require("../db/pool");

// ─── Shared SELECT fragment ───────────────────────────────────────────────────
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
 */
const listByDateRange = async (
  userId,
  { from, to, type, status, categoryId, accountId, page = 1, limit = 20 }
) => {
  const offset  = (page - 1) * limit;
  const params  = [userId, from, to];
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

  const countResult = await pool.query(
    `SELECT COUNT(*) FROM transactions t WHERE ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

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
 *
 * @param {string}  userId
 * @param {string}  from
 * @param {string}  to
 * @param {number}  [limit=5]
 * @param {string}  [accountId]  — optional account scope (ownership already verified by caller)
 */
const topExpenses = async (userId, from, to, limit = 5, accountId = undefined) => {
  const params  = [userId, from, to, limit];
  const filters = [
    `t.user_id = $1`,
    `t.type    = 'expense'`,
    `t.date   >= $2`,
    `t.date   <= $3`,
  ];

  if (accountId) {
    params.splice(3, 0, accountId); // insert before limit
    filters.push(`t.account_id = $4`);
    // limit is now $5
    const { rows } = await pool.query(
      `SELECT ${TX_SELECT}
       FROM transactions t
       LEFT JOIN categories c ON t.category_id = c.id
       LEFT JOIN accounts   a ON t.account_id  = a.id
       WHERE ${filters.join(" AND ")}
       ORDER BY t.amount ASC
       LIMIT $5`,
      params
    );
    return rows;
  }

  const { rows } = await pool.query(
    `SELECT ${TX_SELECT}
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     LEFT JOIN accounts   a ON t.account_id  = a.id
     WHERE ${filters.join(" AND ")}
     ORDER BY t.amount ASC
     LIMIT $4`,
    params
  );
  return rows;
};

/**
 * Aggregate total income and total expenses for a user within a date range.
 *
 * @param {string}  userId
 * @param {string}  from
 * @param {string}  to
 * @param {string}  [accountId]  — optional account scope
 * @returns {{ totalExpenses: number, totalIncome: number, transactionCount: number }}
 */
const aggregateByDateRange = async (userId, from, to, accountId = undefined) => {
  const params  = [userId, from, to];
  const filters = [`user_id = $1`, `date >= $2`, `date <= $3`];

  if (accountId) {
    params.push(accountId);
    filters.push(`account_id = $${params.length}`);
  }

  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)  AS "totalExpenses",
       COALESCE(SUM(amount) FILTER (WHERE type = 'income'),  0)  AS "totalIncome",
       COUNT(*)                                                   AS "transactionCount"
     FROM transactions
     WHERE ${filters.join(" AND ")}`,
    params
  );

  const row = rows[0];
  return {
    totalExpenses:    parseFloat(row.totalExpenses),
    totalIncome:      parseFloat(row.totalIncome),
    transactionCount: parseInt(row.transactionCount, 10),
  };
};

/**
 * Aggregate spending grouped by category for a user within a date range.
 *
 * @param {string}  userId
 * @param {string}  from
 * @param {string}  to
 * @param {string}  [type]       — 'expense' | 'income' | undefined (both)
 * @param {string}  [accountId]  — optional account scope
 * @returns {object[]}
 */
const aggregateByCategory = async (userId, from, to, type, accountId = undefined) => {
  const params = [userId, from, to];
  let typeFilter    = "";
  let accountFilter = "";

  if (type) {
    params.push(type);
    typeFilter = `AND t.type = $${params.length}`;
  }

  if (accountId) {
    params.push(accountId);
    accountFilter = `AND t.account_id = $${params.length}`;
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
         ${accountFilter}
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
       ${accountFilter}
     GROUP BY c.id, c.name, c.icon, c.color, c.type, totals.grand_total
     ORDER BY total DESC`,
    params
  );

  return rows.map((r) => ({
    name:       r.name,
    icon:       r.icon,
    color:      r.color,
    type:       r.type,
    total:      parseFloat(r.total),
    percentage: parseFloat(r.percentage),
  }));
};

/**
 * Create a new transaction.
 */
const create = async (
  userId,
  {
    amount, type, status, description, merchant,
    categoryId, accountId, date, authorizedDate,
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
      accountId     || null,
      categoryId    || null,
      amount,
      type,
      status        || "complete",
      description   || null,
      merchant      || null,
      date,
      authorizedDate || null,
    ]
  );
  return findById(insertResult.rows[0].id);
};

/**
 * Update an existing transaction (partial update).
 */
const update = async (id, fields) => {
  const allowedFields = {
    amount:        "amount",
    type:          "type",
    status:        "status",
    description:   "description",
    merchant:      "merchant",
    categoryId:    "category_id",
    accountId:     "account_id",
    date:          "date",
    authorizedDate:"authorized_date",
  };

  const setClauses = [];
  const params     = [];

  for (const [jsKey, dbCol] of Object.entries(allowedFields)) {
    if (fields[jsKey] !== undefined) {
      params.push(fields[jsKey]);
      setClauses.push(`${dbCol} = $${params.length}`);
    }
  }

  if (setClauses.length === 0) return findById(id);

  setClauses.push(`updated_at = NOW()`);
  params.push(id);

  await pool.query(
    `UPDATE transactions SET ${setClauses.join(", ")} WHERE id = $${params.length}`,
    params
  );

  return findById(id);
};

/**
 * Delete a transaction by ID.
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