/**
 * controllers/summaryControllers.js
 *
 * GET /api/summary              — totals, % change, top 5 purchases
 * GET /api/summary/by-category  — spending breakdown by category
 * GET /api/summary/range        — totals + breakdown for a custom date window
 *
 * All endpoints support an optional ?account_id= query parameter.
 * When provided, results are scoped to that account only.
 * Ownership is verified server-side — users cannot read other users' accounts.
 */

const transactionModel = require("../models/transactionModel");
const accountModel     = require("../models/accountModel");

// ─── Security: Account Ownership Validation ───────────────────────────────────

/**
 * Validate that the given accountId exists and belongs to the requesting user.
 * Returns the account object on success, or throws a structured error object
 * that the caller can forward directly to res.status().json().
 *
 * This is intentionally strict:
 * - Non-UUID strings are rejected before hitting the DB.
 * - Accounts belonging to other users return 403, not 404,
 *   to avoid leaking whether an account ID exists.
 *
 * @param {string} accountId
 * @param {string} userId
 * @returns {{ account: object }|{ status: number, error: string }}
 */
const validateAccountOwnership = async (accountId, userId) => {
  // Reject obviously malformed UUIDs before touching the DB.
  // This prevents both SQL injection attempts and unnecessary queries.
  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(accountId)) {
    return { status: 400, error: "Invalid account_id format." };
  }

  const account = await accountModel.findById(accountId);

  if (!account) {
    // Return 403 rather than 404 to avoid confirming whether the ID exists.
    return { status: 403, error: "Forbidden." };
  }

  if (account.userId !== userId) {
    return { status: 403, error: "Forbidden." };
  }

  return { account };
};

// ─── Date Range Utilities ─────────────────────────────────────────────────────

/**
 * Given a timeframe string, return { currentFrom, currentTo, previousFrom, previousTo }
 * as ISO date strings ('YYYY-MM-DD').
 *
 * Supported timeframes: day | week | month | quarter | year | all
 *
 * "Current" means the period that includes today.
 * "Previous" means the identical-length period immediately before it.
 * For 'all', previousFrom/previousTo are null.
 */
const getDateRanges = (timeframe) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fmt = (d) => d.toISOString().split("T")[0];

  switch (timeframe) {
    case "day": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        currentFrom:  fmt(today),
        currentTo:    fmt(today),
        previousFrom: fmt(yesterday),
        previousTo:   fmt(yesterday),
      };
    }

    case "week": {
      // Week = Mon–Sun
      const dayOfWeek   = today.getDay(); // 0 = Sun
      const daysFromMon = (dayOfWeek + 6) % 7;

      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - daysFromMon);
      const thisSunday = new Date(thisMonday);
      thisSunday.setDate(thisMonday.getDate() + 6);

      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);

      return {
        currentFrom:  fmt(thisMonday),
        currentTo:    fmt(thisSunday),
        previousFrom: fmt(lastMonday),
        previousTo:   fmt(lastSunday),
      };
    }

    case "month": {
      const y = today.getFullYear();
      const m = today.getMonth(); // 0-indexed

      return {
        currentFrom:  fmt(new Date(y, m, 1)),
        currentTo:    fmt(new Date(y, m + 1, 0)),
        previousFrom: fmt(new Date(y, m - 1, 1)),
        previousTo:   fmt(new Date(y, m, 0)),
      };
    }

    case "quarter": {
      // Calendar quarters: Q1=Jan–Mar, Q2=Apr–Jun, Q3=Jul–Sep, Q4=Oct–Dec
      const y        = today.getFullYear();
      const m        = today.getMonth(); // 0-indexed
      const quarter  = Math.floor(m / 3); // 0-indexed quarter

      const currentQStart  = new Date(y, quarter * 3, 1);
      const currentQEnd    = new Date(y, quarter * 3 + 3, 0);

      // Previous quarter (handles Q1 → Q4 of prior year)
      const prevQStart = new Date(currentQStart);
      prevQStart.setMonth(prevQStart.getMonth() - 3);
      const prevQEnd = new Date(currentQStart);
      prevQEnd.setDate(prevQEnd.getDate() - 1);

      return {
        currentFrom:  fmt(currentQStart),
        currentTo:    fmt(currentQEnd),
        previousFrom: fmt(prevQStart),
        previousTo:   fmt(prevQEnd),
      };
    }

    case "year": {
      const y = today.getFullYear();
      return {
        currentFrom:  `${y}-01-01`,
        currentTo:    `${y}-12-31`,
        previousFrom: `${y - 1}-01-01`,
        previousTo:   `${y - 1}-12-31`,
      };
    }

    case "all":
    default: {
      return {
        currentFrom:  "1900-01-01",
        currentTo:    fmt(today),
        previousFrom: null,
        previousTo:   null,
      };
    }
  }
};

/**
 * Given a custom date range [from, to], compute the immediately preceding
 * period of identical duration.
 *
 * Example: Jan 1 → Jan 15 (15 days) → Dec 17 → Dec 31
 *
 * @param {string} from — 'YYYY-MM-DD'
 * @param {string} to   — 'YYYY-MM-DD'
 * @returns {{ previousFrom: string, previousTo: string }}
 */
const getPreviousCustomRange = (from, to) => {
  const fromDate = new Date(from);
  const toDate   = new Date(to);

  // Duration in whole days (inclusive)
  const durationMs   = toDate.getTime() - fromDate.getTime();
  const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24)) + 1;

  const prevTo   = new Date(fromDate);
  prevTo.setDate(prevTo.getDate() - 1);

  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (durationDays - 1));

  const fmt = (d) => d.toISOString().split("T")[0];
  return { previousFrom: fmt(prevFrom), previousTo: fmt(prevTo) };
};

/**
 * Calculate the % change between two values.
 * Returns null when comparison is not meaningful (previous = 0 or null).
 */
const percentChange = (current, previous) => {
  if (previous === null || previous === undefined || previous === 0) return null;
  return parseFloat((((current - previous) / Math.abs(previous)) * 100).toFixed(2));
};

// ─── Input Sanitization ───────────────────────────────────────────────────────

const VALID_TIMEFRAMES = ["day", "week", "month", "quarter", "year", "all"];
const DATE_REGEX       = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate and parse a date string. Returns null on invalid input.
 * Prevents garbage dates from reaching the DB.
 */
const parseDate = (str) => {
  if (!str || !DATE_REGEX.test(str)) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : str;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/summary?timeframe=month[&account_id=uuid]
 *
 * Returns totals, % period-over-period change, and top 5 purchases.
 * When account_id is supplied, results are scoped to that account only.
 */
const getSummary = async (req, res, next) => {
  try {
    const timeframe = req.query.timeframe || "month";

    if (!VALID_TIMEFRAMES.includes(timeframe)) {
      return res.status(400).json({
        error: `timeframe must be one of: ${VALID_TIMEFRAMES.join(", ")}.`,
      });
    }

    // ── Optional account scoping with ownership check ──────────────────────
    const rawAccountId = req.query.account_id;
    let accountId      = undefined;

    if (rawAccountId) {
      const check = await validateAccountOwnership(rawAccountId, req.user.id);
      if (check.status) return res.status(check.status).json({ error: check.error });
      accountId = rawAccountId;
    }

    const { currentFrom, currentTo, previousFrom, previousTo } =
      getDateRanges(timeframe);
    const userId = req.user.id;

    const [currentAgg, topPurchases] = await Promise.all([
      transactionModel.aggregateByDateRange(userId, currentFrom, currentTo, accountId),
      transactionModel.topExpenses(userId, currentFrom, currentTo, 5, accountId),
    ]);

    const currentNetFlow = currentAgg.totalIncome + currentAgg.totalExpenses;

    let previousAgg      = null;
    let expensePctChange = null;
    let incomePctChange  = null;
    let netFlowPctChange = null;

    if (previousFrom && previousTo) {
      previousAgg = await transactionModel.aggregateByDateRange(
        userId, previousFrom, previousTo, accountId
      );

      const previousNetFlow = previousAgg.totalIncome + previousAgg.totalExpenses;

      expensePctChange = percentChange(currentAgg.totalExpenses, previousAgg.totalExpenses);
      incomePctChange  = percentChange(currentAgg.totalIncome,   previousAgg.totalIncome);
      netFlowPctChange = percentChange(currentNetFlow,           previousNetFlow);
    }

    res.json({
      timeframe,
      accountId: accountId || null,
      current: {
        from:             currentFrom,
        to:               currentTo,
        totalExpenses:    currentAgg.totalExpenses,
        totalIncome:      currentAgg.totalIncome,
        netFlow:          parseFloat(currentNetFlow.toFixed(2)),
        transactionCount: currentAgg.transactionCount,
      },
      previous: previousAgg
        ? {
            from:          previousFrom,
            to:            previousTo,
            totalExpenses: previousAgg.totalExpenses,
            totalIncome:   previousAgg.totalIncome,
            netFlow:       parseFloat(
              (previousAgg.totalIncome + previousAgg.totalExpenses).toFixed(2)
            ),
          }
        : null,
      expensePercentChange: expensePctChange,
      incomePercentChange:  incomePctChange,
      netFlowPercentChange: netFlowPctChange,
      topPurchases,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/summary/by-category?timeframe=month[&type=expense][&account_id=uuid]
 */
const getSummaryByCategory = async (req, res, next) => {
  try {
    const timeframe = req.query.timeframe || "month";
    const type      = req.query.type || undefined;

    if (!VALID_TIMEFRAMES.includes(timeframe)) {
      return res.status(400).json({
        error: `timeframe must be one of: ${VALID_TIMEFRAMES.join(", ")}.`,
      });
    }

    if (type && !["expense", "income"].includes(type)) {
      return res.status(400).json({ error: "type must be 'expense' or 'income'." });
    }

    const rawAccountId = req.query.account_id;
    let accountId      = undefined;

    if (rawAccountId) {
      const check = await validateAccountOwnership(rawAccountId, req.user.id);
      if (check.status) return res.status(check.status).json({ error: check.error });
      accountId = rawAccountId;
    }

    const { currentFrom, currentTo } = getDateRanges(timeframe);

    const categories = await transactionModel.aggregateByCategory(
      req.user.id, currentFrom, currentTo, type, accountId
    );

    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/summary/range?from=YYYY-MM-DD&to=YYYY-MM-DD[&account_id=uuid]
 *
 * Returns totals + breakdown for an arbitrary date window.
 * Also returns the calculated previous equivalent period for comparison.
 */
const getSummaryByRange = async (req, res, next) => {
  try {
    const from = parseDate(req.query.from);
    const to   = parseDate(req.query.to);

    if (!from || !to) {
      return res.status(400).json({
        error: "from and to are required and must be valid dates (YYYY-MM-DD).",
      });
    }

    if (new Date(from) > new Date(to)) {
      return res.status(400).json({ error: "from must not be later than to." });
    }

    // Cap range to 5 years to prevent excessively large DB scans
    const daysDiff =
      (new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 1827) {
      return res.status(400).json({ error: "Date range cannot exceed 5 years." });
    }

    const rawAccountId = req.query.account_id;
    let accountId      = undefined;

    if (rawAccountId) {
      const check = await validateAccountOwnership(rawAccountId, req.user.id);
      if (check.status) return res.status(check.status).json({ error: check.error });
      accountId = rawAccountId;
    }

    const { previousFrom, previousTo } = getPreviousCustomRange(from, to);
    const userId = req.user.id;

    const [totals, byCategory, topExpensesList, previousTotals, previousByCategory] =
      await Promise.all([
        transactionModel.aggregateByDateRange(userId, from, to, accountId),
        transactionModel.aggregateByCategory(userId, from, to, undefined, accountId),
        transactionModel.topExpenses(userId, from, to, 5, accountId),
        transactionModel.aggregateByDateRange(userId, previousFrom, previousTo, accountId),
        transactionModel.aggregateByCategory(userId, previousFrom, previousTo, undefined, accountId),
      ]);

    res.json({
      from,
      to,
      accountId:        accountId || null,
      totalIncome:      totals.totalIncome,
      totalExpenses:    totals.totalExpenses,
      netSavings:       totals.totalIncome + totals.totalExpenses,
      transactionCount: totals.transactionCount,
      topExpenses:      topExpensesList,
      byCategory,
      previous: {
        from:          previousFrom,
        to:            previousTo,
        totalIncome:   previousTotals.totalIncome,
        totalExpenses: previousTotals.totalExpenses,
        netSavings:    previousTotals.totalIncome + previousTotals.totalExpenses,
        byCategory:    previousByCategory,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSummary, getSummaryByCategory, getSummaryByRange };