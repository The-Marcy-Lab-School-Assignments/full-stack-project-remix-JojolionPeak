jest.mock("../models/accountModel");

const accountModel = require("../models/accountModel");
const {
  listAccounts,
  getAccount,
  createAccount,
  deleteAccount,
} = require("../controllers/accountControllers");

const makeReq = (overrides = {}) => ({
  user:   { id: "user-1" },
  params: {},
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

describe("listAccounts", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns accounts for the authenticated user", async () => {
    const fakeAccounts = [
      { id: "acc-1", accountName: "Checking", type: "depository" },
      { id: "acc-2", accountName: "Savings",  type: "depository" },
    ];
    accountModel.listForUser.mockResolvedValue(fakeAccounts);

    const res = makeRes();
    await listAccounts(makeReq(), res, next);
    expect(res.json).toHaveBeenCalledWith(fakeAccounts);
    expect(accountModel.listForUser).toHaveBeenCalledWith("user-1");
  });

  test("returns an empty array when user has no accounts", async () => {
    accountModel.listForUser.mockResolvedValue([]);
    const res = makeRes();
    await listAccounts(makeReq(), res, next);
    expect(res.json).toHaveBeenCalledWith([]);
  });
});

describe("getAccount", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 404 when account does not exist", async () => {
    accountModel.findById.mockResolvedValue(null);
    const res = makeRes();
    await getAccount(makeReq({ params: { id: "nonexistent" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Account not found." });
  });

  test("returns 403 when account belongs to a different user", async () => {
    accountModel.findById.mockResolvedValue({ id: "acc-1", userId: "user-2" });
    const res = makeRes();
    await getAccount(makeReq({ params: { id: "acc-1" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("returns account data when user is the owner", async () => {
    accountModel.findById.mockResolvedValue({
      id: "acc-1", userId: "user-1", accountName: "Checking", type: "depository",
    });
    const res = makeRes();
    await getAccount(makeReq({ params: { id: "acc-1" } }), res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ id: "acc-1", accountName: "Checking" })
    );
    expect(res.json.mock.calls[0][0]).not.toHaveProperty("userId");
  });
});

describe("createAccount", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 400 when account_name is missing", async () => {
    const res = makeRes();
    await createAccount(makeReq({ body: { type: "depository" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "account_name and type are required." });
  });

  test("returns 400 when type is missing", async () => {
    const res = makeRes();
    await createAccount(makeReq({ body: { account_name: "Checking" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 400 when type is invalid", async () => {
    const res = makeRes();
    await createAccount(makeReq({ body: { account_name: "Checking", type: "fake-type" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("returns 400 when balance is not a number", async () => {
    const res = makeRes();
    await createAccount(makeReq({
      body: { account_name: "Checking", type: "depository", current_balance: "not a number" },
    }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("creates account and returns 201 on valid input", async () => {
    const fakeAccount = { id: "acc-new", accountName: "Checking", type: "depository" };
    accountModel.create.mockResolvedValue(fakeAccount);

    const res = makeRes();
    await createAccount(makeReq({
      body: { account_name: "Checking", type: "depository" },
    }), res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeAccount);
  });
});

describe("deleteAccount", () => {
  beforeEach(() => jest.clearAllMocks());

  test("returns 404 when account does not exist", async () => {
    accountModel.findById.mockResolvedValue(null);
    const res = makeRes();
    await deleteAccount(makeReq({ params: { id: "ghost-account" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("returns 403 when account belongs to a different user", async () => {
    accountModel.findById.mockResolvedValue({ id: "acc-1", userId: "user-2" });
    const res = makeRes();
    await deleteAccount(makeReq({ params: { id: "acc-1" } }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("deletes and returns the account when user is the owner", async () => {
    accountModel.findById.mockResolvedValue({ id: "acc-1", userId: "user-1" });
    accountModel.remove.mockResolvedValue({ id: "acc-1", accountName: "Checking" });

    const res = makeRes();
    await deleteAccount(makeReq({ params: { id: "acc-1" } }), res, next);
    expect(accountModel.remove).toHaveBeenCalledWith("acc-1");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: "acc-1" }));
  });
});