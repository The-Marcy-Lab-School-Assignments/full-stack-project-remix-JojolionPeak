/**
 * controllers/summaryControllers.js
 *
 * GET /api/summary              — totals, % change, top 5 purchases
 * GET /api/summary/by-category  — spending breakdown by category
 * GET /api/summary/range        — totals + breakdown for a custom date window
 */

const transactionModel = require("../models/transactionModel");

// ─── Date Range Utilities ─────────────────────────────────────────────────────

/**
 * Given a timeframe string, return { currentFrom, currentTo, previousFrom, previousTo }
 * as ISO date strings ('YYYY-MM-DD').
 *
 * "Current" means the period that includes today.
 * "Previous" means the identical-length period immediately before it.
 *
 * For 'all', previousFrom/previousTo are null — no comparison is possible.
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
        currentFrom: fmt(today),
        currentTo: fmt(today),
        previousFrom: fmt(yesterday),
        previousTo: fmt(yesterday),
      };
    }

    case "week": {
      // Week = Mon–Sun
      const dayOfWeek = today.getDay(); // 0=Sun
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
        currentFrom: fmt(thisMonday),
        currentTo: fmt(thisSunday),
        previousFrom: fmt(lastMonday),
        previousTo: fmt(lastSunday),
      };
    }

    case "month": {
      const y = today.getFullYear();
      const m = today.getMonth(); // 0-indexed
      const firstOfThisMonth = new Date(y, m, 1);
      const lastOfThisMonth = new Date(y, m + 1, 0);
      const firstOfLastMonth = new Date(y, m - 1, 1);
      const lastOfLastMonth = new Date(y, m, 0);

      return {
        currentFrom: fmt(firstOfThisMonth),
        currentTo: fmt(lastOfThisMonth),
        previousFrom: fmt(firstOfLastMonth),
        previousTo: fmt(lastOfLastMonth),
      };
    }

    case "year": {
      const y = today.getFullYear();
      return {
        currentFrom: `${y}-01-01`,
        currentTo: `${y}-12-31`,
        previousFrom: `${y - 1}-01-01`,
        previousTo: `${y - 1}-12-31`,
      };
    }

    case "all":
    default: {
      return {
        currentFrom: "1900-01-01",
        currentTo: fmt(today),
        previousFrom: null,
        previousTo: null,
      };
    }
  }
};

/**
 * Calculate the % change between two values.
 * Returns null when either value is unavailable (e.g. all-time view).
 * Returns null when previous is 0 to avoid division-by-zero.
 */
const percentChange = (current, previous) => {
  if (previous === null || previous === undefined || previous === 0)
    return null;
  return parseFloat((((current - previous) / previous) * 100).toFixed(2));
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/summary?timeframe=month
 */
const getSummary = async (req, res, next) => {
  try {
    const timeframe = req.query.timeframe || "month";
    const validTimeframes = ["day", "week", "month", "year", "all"];

    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        error: `timeframe must be one of: ${validTimeframes.join(", ")}.`,
      });
    }

    const { currentFrom, currentTo, previousFrom, previousTo } =
      getDateRanges(timeframe);
    const userId = req.user.id;

    // Fetch current period aggregates in parallel
    const [currentAgg, topPurchases] = await Promise.all([
      transactionModel.aggregateByDateRange(userId, currentFrom, currentTo),
      transactionModel.topExpenses(userId, currentFrom, currentTo, 5),
    ]);

    // FIX: totalExpenses is already negative, so use addition to get true net
    const currentNetFlow = currentAgg.totalIncome + currentAgg.totalExpenses;

    // Previous period (null for all-time)
    let previousAgg = null;
    let expensePctChange = null;
    let incomePctChange = null;
    let netFlowPctChange = null;

    if (previousFrom && previousTo) {
      previousAgg = await transactionModel.aggregateByDateRange(
        userId,
        previousFrom,
        previousTo
      );

      // FIX: same signed-amount correction for previous period
      const previousNetFlow =
        previousAgg.totalIncome + previousAgg.totalExpenses;

      expensePctChange = percentChange(
        currentAgg.totalExpenses,
        previousAgg.totalExpenses
      );
      incomePctChange = percentChange(
        currentAgg.totalIncome,
        previousAgg.totalIncome
      );
      netFlowPctChange = percentChange(currentNetFlow, previousNetFlow);
    }

    res.json({
      timeframe,
      current: {
        from: currentFrom,
        to: currentTo,
        totalExpenses: currentAgg.totalExpenses,
        totalIncome: currentAgg.totalIncome,
        netFlow: parseFloat(currentNetFlow.toFixed(2)),
        transactionCount: currentAgg.transactionCount,
      },
      previous: previousAgg
        ? {
            from: previousFrom,
            to: previousTo,
            totalExpenses: previousAgg.totalExpenses,
            totalIncome: previousAgg.totalIncome,
            // FIX: same signed-amount correction in the response shape
            netFlow: parseFloat(
              (previousAgg.totalIncome + previousAgg.totalExpenses).toFixed(2)
            ),
          }
        : null,
      expensePercentChange: expensePctChange,
      incomePercentChange: incomePctChange,
      netFlowPercentChange: netFlowPctChange,
      topPurchases,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/summary/by-category?timeframe=month&type=expense
 */
const getSummaryByCategory = async (req, res, next) => {
  try {
    const timeframe = req.query.timeframe || "month";
    const type = req.query.type || undefined;

    const { currentFrom, currentTo } = getDateRanges(timeframe);

    const categories = await transactionModel.aggregateByCategory(
      req.user.id,
      currentFrom,
      currentTo,
      type
    );

    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/summary/range
 * Query params: from (required), to (required)
 *
 * Returns totals, net savings, transaction count, top 5 expenses,
 * and a full category breakdown for any arbitrary date window.
 * Unlike GET /api/summary, there is no "previous period" comparison —
 * the caller controls the window entirely.
 */
const getSummaryByRange = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res
        .status(400)
        .json({ error: "from and to query parameters are required (YYYY-MM-DD)." });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(from) || !dateRegex.test(to)) {
      return res
        .status(400)
        .json({ error: "from and to must be valid dates in YYYY-MM-DD format." });
    }

    if (new Date(from) > new Date(to)) {
      return res
        .status(400)
        .json({ error: "from must not be later than to." });
    }

    const [totals, byCategory, topExpensesList] = await Promise.all([
      transactionModel.aggregateByDateRange(req.user.id, from, to),
      transactionModel.aggregateByCategory(req.user.id, from, to),
      transactionModel.topExpenses(req.user.id, from, to, 5),
    ]);

    res.json({
      from,
      to,
      totalIncome:      totals.totalIncome,
      totalExpenses:    totals.totalExpenses,
      netSavings:       totals.totalIncome + totals.totalExpenses,
      transactionCount: totals.transactionCount,
      topExpenses:      topExpensesList,
      byCategory,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getSummary, getSummaryByCategory, getSummaryByRange };