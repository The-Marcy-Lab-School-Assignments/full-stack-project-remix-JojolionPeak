jest.mock("../models/userModel");
jest.mock("../models/tokenDenylistModel");
jest.mock("bcryptjs");

const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");
const { signup, login } = require("../controllers/authControllers");

const makeReq = (body = {}) => ({ body, cookies: {} });

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  return res;
};

const next = jest.fn();

describe("signup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  test("returns 400 when fields are missing", async () => {
    const res = makeRes();
    await signup(makeReq({ email: "a@b.com", password: "password123" }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "All fields are required." });
  });

  test("returns 400 when email is invalid", async () => {
    const res = makeRes();
    await signup(makeReq({ displayName: "Jon", email: "not an email", password: "password123" }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Please enter a valid email address." });
  });

  test("returns 400 when password is too short", async () => {
    const res = makeRes();
    await signup(makeReq({ displayName: "Jon", email: "jon@test.com", password: "short" }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Password must be at least 8 characters." });
  });

  test("returns 400 when display name is too long", async () => {
    const res = makeRes();
    await signup(makeReq({
      displayName: "a".repeat(101),
      email: "jon@test.com",
      password: "password123",
    }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Display name must be 100 characters or fewer." });
  });

  test("returns 409 when email is already in use", async () => {
    userModel.findByEmail.mockResolvedValue({ id: "existing-user" });
    const res = makeRes();
    await signup(makeReq({ displayName: "Jon", email: "taken@test.com", password: "password123" }), res, next);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Email already in use." });
  });

  test("creates user and returns 201 on valid input", async () => {
    userModel.findByEmail.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashed-password");
    userModel.createLocalUser.mockResolvedValue({
      id: "new-user-id",
      email: "jon@test.com",
      displayName: "Jon",
      avatarUrl: null,
      isOAuthUser: false,
    });

    const res = makeRes();
    await signup(makeReq({ displayName: "Jon", email: "jon@test.com", password: "password123" }), res, next);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(userModel.createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jon@test.com", displayName: "Jon" })
    );
  });

  test("normalizes email to lowercase before saving", async () => {
    userModel.findByEmail.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue("hashed");
    userModel.createLocalUser.mockResolvedValue({
      id: "1", email: "jon@test.com", displayName: "Jon", avatarUrl: null, isOAuthUser: false,
    });

    const res = makeRes();
    await signup(makeReq({ displayName: "Jon", email: "JON@TEST.COM", password: "password123" }), res, next);
    expect(userModel.createLocalUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jon@test.com" })
    );
  });
});

describe("login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "test-secret";
  });

  test("returns 400 when email or password is missing", async () => {
    const res = makeRes();
    await login(makeReq({ email: "jon@test.com" }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Email and password are required." });
  });

  test("returns 401 when user does not exist", async () => {
    userModel.findByEmail.mockResolvedValue(null);
    bcrypt.compare.mockResolvedValue(false);
    const res = makeRes();
    await login(makeReq({ email: "nobody@test.com", password: "password123" }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials." });
  });

  test("returns 401 when password is wrong", async () => {
    userModel.findByEmail.mockResolvedValue({ id: "1", passwordHash: "hash" });
    bcrypt.compare.mockResolvedValue(false);
    const res = makeRes();
    await login(makeReq({ email: "jon@test.com", password: "wrong password" }), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid credentials." });
  });

  test("returns user data on valid credentials", async () => {
    userModel.findByEmail.mockResolvedValue({
      id: "user-1", email: "jon@test.com",
      displayName: "Jon", avatarUrl: null, passwordHash: "real-hash",
    });
    bcrypt.compare.mockResolvedValue(true);

    const res = makeRes();
    await login(makeReq({ email: "jon@test.com", password: "password123" }), res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ email: "jon@test.com", displayName: "Jon" })
    );
  });

  test("sets an httpOnly cookie on successful login", async () => {
    userModel.findByEmail.mockResolvedValue({
      id: "user-1", email: "jon@test.com",
      displayName: "Jon", avatarUrl: null, passwordHash: "real-hash",
    });
    bcrypt.compare.mockResolvedValue(true);

    const res = makeRes();
    await login(makeReq({ email: "jon@test.com", password: "password123" }), res, next);
    expect(res.cookie).toHaveBeenCalledWith(
      "token",
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    );
  });
});