/**
 * controllers/transactionControllers.js
 *
 * GET    /api/transactions      — paginated list for a date range
 * POST   /api/transactions      — create a transaction
 * PUT    /api/transactions/:id  — update a transaction (owner only)
 * DELETE /api/transactions/:id  — delete a transaction (owner only)
 */

const pool = require("../db/pool");
const transactionModel = require("../models/transactionModel");

const VALID_TYPES = ["expense", "income"];
const VALID_STATUSES = ["pending", "complete"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve and validate the `from` and `to` query params.
 * If absent, defaults to the current calendar month.
 */
const resolveDateRange = (query) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  const from = query.from || `${year}-${month}-01`;
  const to =
    query.to ||
    `${year}-${month}-${new Date(year, now.getMonth() + 1, 0).getDate()}`;

  return { from, to };
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/transactions
 * Query params: from, to, type, status, category_id, account_id, page, limit
 */
const listTransactions = async (req, res, next) => {
  try {
    const { from, to } = resolveDateRange(req.query);
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const type = req.query.type || undefined;
    const status = req.query.status || undefined;
    const categoryId = req.query.category_id || undefined;
    const accountId = req.query.account_id || undefined;

    if (type && !VALID_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ error: `type must be one of: ${VALID_TYPES.join(", ")}.` });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({
          error: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
        });
    }

    const { data, total } = await transactionModel.listByDateRange(
      req.user.id,
      { from, to, type, status, categoryId, accountId, page, limit }
    );

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        hasMore: page * limit < total,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/transactions
 * Body: { amount, type, date,
 *         status?, description?, merchant?,
 *         category_id?, account_id?, authorized_date? }
 */
const createTransaction = async (req, res, next) => {
  try {
    const {
      amount,
      type,
      status,
      description,
      merchant,
      category_id,
      account_id,
      date,
      authorized_date,
    } = req.body;

    if (isNaN(parseFloat(amount)) || parseFloat(amount) === 0) {
      return res
        .status(400)
        .json({ error: "Amount must be a non-zero number!" });
    }

    if (!amount || !type || !date) {
      return res
        .status(400)
        .json({ error: "Amount, Type, and Date are required!" });
    }

    if (!VALID_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ error: `Type must be one of: ${VALID_TYPES.join(", ")}!` });
    }

    // if (isNaN(parseFloat(amount)) || parseFloat(amount) === 0) {
    //   return res
    //     .status(400)
    //     .json({ error: "Amount must be a non-zero number!" });
    // }

    if (status && !VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({
          error: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
        });
    }

    const transaction = await transactionModel.create(req.user.id, {
      amount: parseFloat(amount),
      type,
      status,
      description,
      merchant,
      categoryId: category_id || null,
      accountId: account_id || null,
      date,
      authorizedDate: authorized_date || null,
    });

    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/transactions/:id
 * Partial update — only provided fields are changed.
 */
const updateTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Confirm the transaction exists and pull user_id for the ownership check
    // in a single query. user_id is intentionally excluded from TX_SELECT to
    // keep the public response clean, so we query the raw table here.
    const ownerCheck = await pool.query(
      "SELECT user_id FROM transactions WHERE id = $1",
      [id]
    );

    if (!ownerCheck.rows[0]) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    if (ownerCheck.rows[0].user_id !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Forbidden. You can only edit your own transactions." });
    }

    const {
      amount,
      type,
      status,
      description,
      merchant,
      category_id,
      account_id,
      date,
      authorized_date,
    } = req.body;

    if (type && !VALID_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ error: `type must be one of: ${VALID_TYPES.join(", ")}.` });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res
        .status(400)
        .json({
          error: `status must be one of: ${VALID_STATUSES.join(", ")}.`,
        });
    }

    if (
      amount !== undefined &&
      (isNaN(parseFloat(amount)) || parseFloat(amount) === 0)
    ) {
      return res
        .status(400)
        .json({ error: "amount must be a non-zero number." });
    }

    const updated = await transactionModel.update(id, {
      amount: amount !== undefined ? parseFloat(amount) : undefined,
      type,
      status,
      description,
      merchant,
      categoryId: category_id,
      accountId: account_id,
      date,
      authorizedDate: authorized_date,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/transactions/:id
 */
const deleteTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Ownership check — pull user_id from the raw table
    const ownerCheck = await pool.query(
      "SELECT user_id FROM transactions WHERE id = $1",
      [id]
    );

    if (!ownerCheck.rows[0]) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    if (ownerCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({
        error: "Forbidden. You can only delete your own transactions.",
      });
    }

    const deleted = await transactionModel.remove(id);
    res.json(deleted);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};