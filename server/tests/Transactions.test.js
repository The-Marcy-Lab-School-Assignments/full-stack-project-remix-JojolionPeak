jest.mock("../models/transactionModel");
jest.mock("../models/accountModel");
jest.mock("../db/pool");

const transactionModel = require("../models/transactionModel");
const accountModel = require("../models/accountModel");
const pool = require("../db/pool");

const {
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} = require("../controllers/transactionControllers");

const makeReq = (overrides = {}) => ({
  user:   { id: "user-1" },
  params: {},
  query:  {},
  body:   {},
  ...overrides,
});

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

const next = jest.fn();

const fakeTx = {
  id:        "tx-1",
  accountId: "acc-1",
  amount:    -50,
  type:      "expense",
  status:    "complete",
  merchant:  "Whole Foods",
  date:      "2026-05-01",
};

describe("listTransactions", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns paginated transactions for the authenticated user", async () => {
    transactionModel.listByDateRange.mockResolvedValue({ data: [fakeTx], total: 1 });
    const res = makeRes();
    await listTransactions(makeReq(), res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: [fakeTx] })
    );
  });

  test("returns 400 when type filter is invalid", async () => {
    const res = makeRes();
    await listTransactions(makeReq({ query: { type: "transfer" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 400 when status filter is invalid", async () => {
    const res = makeRes();
    await listTransactions(makeReq({ query: { status: "cancelled" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("caps limit at 100 regardless of what is passed", async () => {
    transactionModel.listByDateRange.mockResolvedValue({ data: [], total: 0 });
    const res = makeRes();
    await listTransactions(makeReq({ query: { limit: "9999" } }), res, next);
    expect(transactionModel.listByDateRange).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ limit: 100 })
    );
  });

  test("floors page at 1 when a negative value is passed", async () => {
    transactionModel.listByDateRange.mockResolvedValue({ data: [], total: 0 });
    const res = makeRes();
    await listTransactions(makeReq({ query: { page: "-5" } }), res, next);
    expect(transactionModel.listByDateRange).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ page: 1 })
    );
  });
});

describe("createTransaction", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 400 when amount is zero", async () => {
    const res = makeRes();
    await createTransaction(makeReq({ body: { amount: 0, type: "expense", date: "2026-05-01" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 400 when amount is not a number", async () => {
    const res = makeRes();
    await createTransaction(makeReq({ body: { amount: "abc", type: "expense", date: "2026-05-01" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 400 when type is invalid", async () => {
    const res = makeRes();
    await createTransaction(makeReq({ body: { amount: 50, type: "transfer", date: "2026-05-01" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 400 when merchant name exceeds 200 characters", async () => {
    const res = makeRes();
    await createTransaction(makeReq({
      body: { amount: 50, type: "expense", date: "2026-05-01", merchant: "a".repeat(201) },
    }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Merchant name must be 200 characters or fewer." });
  });

  test("returns 400 when description exceeds 500 characters", async () => {
    const res = makeRes();
    await createTransaction(makeReq({
      body: { amount: 50, type: "expense", date: "2026-05-01", description: "a".repeat(501) },
    }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Description must be 500 characters or fewer." });
  });

  test("creates transaction and returns 201 on valid input", async () => {
    transactionModel.create.mockResolvedValue(fakeTx);
    accountModel.findById.mockResolvedValue(null);

    const res = makeRes();
    await createTransaction(makeReq({
      body: { amount: -50, type: "expense", date: "2026-05-01", merchant: "Whole Foods" },
    }), res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeTx);
  });
});

describe("updateTransaction", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 404 when transaction does not exist", async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = makeRes();
    await updateTransaction(makeReq({ params: { id: "ghost-tx" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Transaction not found." });
  });

  test("returns 403 when transaction belongs to a different user", async () => {
    pool.query.mockResolvedValue({ rows: [{ user_id: "user-2" }] });
    const res = makeRes();
    await updateTransaction(makeReq({ params: { id: "tx-1" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("returns 400 when updated type is invalid", async () => {
    pool.query.mockResolvedValue({ rows: [{ user_id: "user-1" }] });
    const res = makeRes();
    await updateTransaction(makeReq({
      params: { id: "tx-1" },
      body:   { type: "transfer" },
    }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 400 when updated amount is zero", async () => {
    pool.query.mockResolvedValue({ rows: [{ user_id: "user-1" }] });
    const res = makeRes();
    await updateTransaction(makeReq({
      params: { id: "tx-1" },
      body:   { amount: 0 },
    }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("updates and returns transaction when user is the owner", async () => {
    pool.query.mockResolvedValue({ rows: [{ user_id: "user-1" }] });
    transactionModel.findById.mockResolvedValue({ ...fakeTx, accountId: null });
    transactionModel.update.mockResolvedValue({ ...fakeTx, merchant: "Trader Joes" });
    accountModel.findById.mockResolvedValue(null);

    const res = makeRes();
    await updateTransaction(makeReq({
      params: { id: "tx-1" },
      body:   { merchant: "Trader Joes" },
    }), res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ merchant: "Trader Joes" })
    );
  });
});

describe("deleteTransaction", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 404 when transaction does not exist", async () => {
    pool.query.mockResolvedValue({ rows: [] });
    const res = makeRes();
    await deleteTransaction(makeReq({ params: { id: "ghost-tx" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("returns 403 when transaction belongs to a different user", async () => {
    pool.query.mockResolvedValue({ rows: [{ user_id: "user-2" }] });
    const res = makeRes();
    await deleteTransaction(makeReq({ params: { id: "tx-1" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("deletes and returns transaction when user is the owner", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ user_id: "user-1" }] }) 
      .mockResolvedValueOnce({ rows: [{ count: "0" }] });       
    transactionModel.findById.mockResolvedValue({ ...fakeTx, accountId: null });
    transactionModel.remove.mockResolvedValue(fakeTx);
    accountModel.findById.mockResolvedValue(null);

    const res = makeRes();
    await deleteTransaction(makeReq({ params: { id: "tx-1" } }), res, next);
    expect(transactionModel.remove).toHaveBeenCalledWith("tx-1");
    expect(res.json).toHaveBeenCalledWith(fakeTx);
  });
});