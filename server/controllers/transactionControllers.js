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
const accountModel = require("../models/accountModel");

const VALID_TYPES = ["expense", "income"];
const VALID_STATUSES = ["pending", "complete"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}.` });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}.` });
    }

    const { data, total } = await transactionModel.listByDateRange(
      req.user.id,
      { from, to, type, status, categoryId, accountId, page, limit }
    );

    res.json({
      data,
      pagination: { page, limit, total, hasMore: page * limit < total },
    });
  } catch (err) {
    next(err);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const {
      amount, type, status, description, merchant,
      category_id, account_id, date, authorized_date,
    } = req.body;

    if (isNaN(parseFloat(amount)) || parseFloat(amount) === 0) {
      return res.status(400).json({ error: "Amount must be a non-zero number!" });
    }

    if (!amount || !type || !date) {
      return res.status(400).json({ error: "Amount, Type, and Date are required!" });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Type must be one of: ${VALID_TYPES.join(", ")}!` });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}.` });
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

    // Use transaction.status (not raw body) so the model default of 'complete'
    // is respected when status was not explicitly provided.
    await adjustAccountBalance(account_id, transaction.amount, transaction.status);

    res.status(201).json(transaction);
  } catch (err) {
    next(err);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    const ownerCheck = await pool.query(
      "SELECT user_id FROM transactions WHERE id = $1",
      [id]
    );

    if (!ownerCheck.rows[0]) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    if (ownerCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden. You can only edit your own transactions." });
    }

    const {
      amount, type, status, description, merchant,
      category_id, account_id, date, authorized_date,
    } = req.body;

    if (type && !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(", ")}.` });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}.` });
    }

    if (amount !== undefined && (isNaN(parseFloat(amount)) || parseFloat(amount) === 0)) {
      return res.status(400).json({ error: "amount must be a non-zero number." });
    }

    const existing = await transactionModel.findById(id);

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

    // Read the account once and compute the full net delta in a single write.
    // Avoids the stale-read race of two sequential adjustAccountBalance calls.
    if (existing.accountId) {
      const account = await accountModel.findById(existing.accountId);
      if (account) {
        const oldAmount = parseFloat(existing.amount);
        const newAmount = parseFloat(updated.amount);
        const oldStatus = existing.status;
        const newStatus = updated.status;

        let currentDelta   = 0;
        let availableDelta = 0;

        // Reverse the old transaction
        availableDelta -= oldAmount;
        if (oldStatus === "complete") currentDelta -= oldAmount;

        // Apply the new transaction
        availableDelta += newAmount;
        if (newStatus === "complete") currentDelta += newAmount;

        const updates = {
          availableBalance: parseFloat(account.availableBalance || 0) + availableDelta,
        };
        if (currentDelta !== 0) {
          updates.currentBalance = parseFloat(account.currentBalance || 0) + currentDelta;
        }

        await accountModel.update(existing.accountId, updates);
      }
    }

    // If there are no remaining pending transactions on this account,
    // snap currentBalance to availableBalance to keep them in sync.
    await reconcileBalance(existing.accountId);

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;

    const ownerCheck = await pool.query(
      "SELECT user_id FROM transactions WHERE id = $1",
      [id]
    );

    if (!ownerCheck.rows[0]) {
      return res.status(404).json({ error: "Transaction not found." });
    }

    if (ownerCheck.rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden. You can only delete your own transactions." });
    }

    const existing = await transactionModel.findById(id);

    // Reverse using the original amount and status.
    // pending  -> only availableBalance is restored.
    // complete -> both currentBalance and availableBalance are restored.
    await adjustAccountBalance(existing.accountId, -parseFloat(existing.amount), existing.status);

    const deleted = await transactionModel.remove(id);

    // If there are no remaining pending transactions on this account,
    // snap currentBalance to availableBalance to keep them in sync.
    await reconcileBalance(existing.accountId);

    // If this was one side of a transfer, find and delete the paired transaction
    // on the other account so both sides stay in sync.
    if (existing.merchant && existing.merchant.startsWith("Transfer")) {
      const { rows: pairRows } = await pool.query(
        `SELECT id, account_id, amount, status
         FROM transactions
         WHERE user_id    = $1
           AND date       = $2
           AND ABS(amount) = ABS($3)
           AND amount     != $3
           AND merchant   LIKE 'Transfer%'
           AND id         != $4
         LIMIT 1`,
        [req.user.id, existing.date, existing.amount, id]
      );

      if (pairRows[0]) {
        const pair = pairRows[0];
        await adjustAccountBalance(pair.account_id, -parseFloat(pair.amount), pair.status);
        await pool.query("DELETE FROM transactions WHERE id = $1", [pair.id]);
        await reconcileBalance(pair.account_id);
      }
    }

    res.json(deleted);
  } catch (err) {
    next(err);
  }
};

// ─── Balance Helpers ──────────────────────────────────────────────────────────

/**
 * Adjust an account's balances based on a transaction amount and status.
 *
 * pending  — only availableBalance changes (funds reserved but not yet settled)
 * complete — both currentBalance and availableBalance change
 *
 * Pass a negative amount to reverse a transaction (e.g. on delete).
 */
const adjustAccountBalance = async (accountId, amount, status) => {
  if (!accountId) return;

  const account = await accountModel.findById(accountId);
  if (!account) return;

  const current   = parseFloat(account.currentBalance  || 0);
  const available = parseFloat(account.availableBalance || 0);
  const delta     = parseFloat(amount);

  const updates = { availableBalance: available + delta };

  if (status === "complete") {
    updates.currentBalance = current + delta;
  }

  await accountModel.update(accountId, updates);
};

/**
 * If an account has no remaining pending transactions, snap currentBalance
 * to availableBalance so the two values stay in sync.
 * Called after any update or delete that could clear the last pending tx.
 */
const reconcileBalance = async (accountId) => {
  if (!accountId) return;

  const { rows } = await pool.query(
    `SELECT COUNT(*) FROM transactions
     WHERE account_id = $1 AND status = 'pending'`,
    [accountId]
  );

  const pendingCount = parseInt(rows[0].count, 10);
  if (pendingCount > 0) return;

  const account = await accountModel.findById(accountId);
  if (!account) return;

  await accountModel.update(accountId, {
    currentBalance: parseFloat(account.availableBalance || 0),
  });
};

module.exports = {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};