/**
 * controllers/authControllers.js
 */

const jwt = require("jsonwebtoken");
const passport = require("passport");
const { v4: uuidv4 } = require("uuid");
const userModel = require("../models/userModel");
const denylistModel = require("../models/tokenDenylistModel");
const bcrypt = require("bcryptjs");

const COOKIE_NAME = "token";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const signToken = (user) => {
  const jti = uuidv4();
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  const token = jwt.sign(
    { id: user.id, jti },
    process.env.JWT_SECRET,
    { expiresIn }
  );
  return { token, jti };
};

const DUMMY_HASH =
  "$2b$12$invalidhashfortimingprotectionxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normaliseEmail = (email) =>
  typeof email === "string" ? email.toLowerCase().trim() : "";
const validateEmail = (email) => EMAIL_REGEX.test(email);

const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
});

const googleCallback = [
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/auth?error=oauth_failed`,
  }),
  (req, res) => {
    const { token } = signToken(req.user);
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  },
];

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normEmail = normaliseEmail(email);
    const user = await userModel.findByEmail(normEmail);
    const hashToCompare = user?.passwordHash || DUMMY_HASH;
    const validPassword = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.passwordHash || !validPassword) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const { token } = signToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions);

    res.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    });
  } catch (err) {
    next(err);
  }
};

const signup = async (req, res, next) => {
  try {
    const { displayName, email, password } = req.body;

    if (!displayName || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (typeof displayName !== "string" || displayName.trim().length === 0) {
      return res.status(400).json({ error: "Display name cannot be blank." });
    }
    if (displayName.length > 100) {
      return res.status(400).json({ error: "Display name must be 100 characters or fewer." });
    }

    const normEmail = normaliseEmail(email);
    if (!validateEmail(normEmail)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    if (password.length > 128) {
      return res.status(400).json({ error: "Password must be 128 characters or fewer." });
    }

    const existingUser = await userModel.findByEmail(normEmail);
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await userModel.createLocalUser({
      displayName: displayName.trim(),
      email: normEmail,
      passwordHash,
    });

    const { token } = signToken(user);
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      res.clearCookie(COOKIE_NAME, cookieOptions);
      return res.status(401).json({ error: "Account not found." });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res) => {
  const token = req.cookies?.token;

  if (token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded?.jti && decoded?.exp) {
        await denylistModel.add(decoded.jti, decoded.exp);
      }
    } catch (err) {
      console.error("⚠️ Failed to denylist token on logout:", err.message);
    }
  }

  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
  res.json({ message: "Logged out." });
};

module.exports = { googleAuth, googleCallback, login, signup, getMe, logout };