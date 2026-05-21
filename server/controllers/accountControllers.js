/**
 * controllers/accountControllers.js
 *
 * GET    /api/accounts      — list all accounts for the authenticated user
 * GET    /api/accounts/:id  — get a single account (owner only)
 * POST   /api/accounts      — create a manual account
 * PUT    /api/accounts/:id  — update an account (owner only)
 * DELETE /api/accounts/:id  — delete an account (owner only)
 */

const accountModel = require("../models/accountModel");

const VALID_TYPES = ["depository", "credit", "loan", "investment", "other"];

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/accounts
 * Returns all accounts owned by the authenticated user.
 */
const listAccounts = async (req, res, next) => {
  try {
    const accounts = await accountModel.listForUser(req.user.id);
    res.json(accounts);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/accounts/:id
 * Returns a single account. Only the owning user may access it.
 */
const getAccount = async (req, res, next) => {
  try {
    const { id } = req.params;
    const account = await accountModel.findById(id);

    if (!account) {
      return res.status(404).json({ error: "Account not found." });
    }

    if (account.userId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Forbidden. You can only view your own accounts." });
    }

    // Strip the internal userId from the response — it isn't part of the
    // public contract and is only used above for the ownership check.
    const { userId: _userId, ...public_account } = account;
    res.json(public_account);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/accounts
 * Creates a manual account for the authenticated user.
 * Body: { account_name, type, institution_name?, mask?, subtype?,
 *         current_balance?, available_balance? }
 */
const createAccount = async (req, res, next) => {
  try {
    const {
      account_name,
      institution_name,
      mask,
      type,
      subtype,
      current_balance,
      available_balance,
    } = req.body;

    if (!account_name || !type) {
      return res
        .status(400)
        .json({ error: "account_name and type are required." });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${VALID_TYPES.join(", ")}.`,
      });
    }

    if (current_balance !== undefined && isNaN(parseFloat(current_balance))) {
      return res
        .status(400)
        .json({ error: "current_balance must be a number." });
    }

    if (
      available_balance !== undefined &&
      isNaN(parseFloat(available_balance))
    ) {
      return res
        .status(400)
        .json({ error: "available_balance must be a number." });
    }

    const account = await accountModel.create(req.user.id, {
      accountName: account_name,
      institutionName: institution_name,
      mask,
      type,
      subtype,
      currentBalance:
        current_balance !== undefined ? parseFloat(current_balance) : undefined,
      availableBalance:
        available_balance !== undefined
          ? parseFloat(available_balance)
          : undefined,
    });

    res.status(201).json(account);
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/accounts/:id
 * Partial update — only provided fields are changed.
 * Only the owning user may update an account.
 */
const updateAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await accountModel.findById(id);

    if (!existing) {
      return res.status(404).json({ error: "Account not found." });
    }

    if (existing.userId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Forbidden. You can only edit your own accounts." });
    }

    const {
      account_name,
      institution_name,
      mask,
      type,
      subtype,
      current_balance,
      available_balance,
    } = req.body;

    if (type !== undefined && !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${VALID_TYPES.join(", ")}.`,
      });
    }

    if (current_balance !== undefined && isNaN(parseFloat(current_balance))) {
      return res
        .status(400)
        .json({ error: "current_balance must be a number." });
    }

    if (
      available_balance !== undefined &&
      isNaN(parseFloat(available_balance))
    ) {
      return res
        .status(400)
        .json({ error: "available_balance must be a number." });
    }

    const updated = await accountModel.update(id, {
      accountName: account_name,
      institutionName: institution_name,
      mask,
      type,
      subtype,
      currentBalance:
        current_balance !== undefined ? parseFloat(current_balance) : undefined,
      availableBalance:
        available_balance !== undefined
          ? parseFloat(available_balance)
          : undefined,
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/accounts/:id
 * Deletes the account. Linked transactions have their account_id set to NULL
 * (enforced by ON DELETE SET NULL in the schema) so no transaction data is lost.
 */
const deleteAccount = async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await accountModel.findById(id);

    if (!existing) {
      return res.status(404).json({ error: "Account not found." });
    }

    if (existing.userId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Forbidden. You can only delete your own accounts." });
    }

    const deleted = await accountModel.remove(id);
    res.json(deleted);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
};
