/**
 * controllers/authControllers.js
 *
 * Handles the Google OAuth flow and JWT cookie lifecycle.
 *
 * Flow:
 *   1. GET /auth/google          → Passport redirects to Google
 *   2. GET /auth/google/callback → Passport callback; we issue a JWT and redirect
 *   3. GET /api/auth/me          → Returns the token owner's profile
 *   4. POST /api/auth/logout     → Clears the JWT cookie
 */

const jwt = require("jsonwebtoken");
const passport = require("passport");
const userModel = require("../models/userModel");
const bcrypt = require("bcryptjs");

// ─── JWT Cookie Config ────────────────────────────────────────────────────────

const COOKIE_NAME = "token";

const cookieOptions = {
  httpOnly: true, // not accessible from JS
  secure: process.env.NODE_ENV === "production", // HTTPS only in prod
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

/**
 * Build and sign a JWT containing the user's public profile fields.
 * @param {object} user — { id, email, displayName, avatarUrl }
 * @returns {string} signed JWT
 */
const signToken = (user) =>
  jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// ─── Controller Functions ─────────────────────────────────────────────────────

/**
 * GET /auth/google
 * Kicks off the OAuth flow. Passport handles the redirect — no body needed.
 */
const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email"],
});

/**
 * GET /auth/google/callback
 * Passport has already validated the code and attached req.user (the DB row).
 * We sign a JWT, set it as a cookie, and redirect the browser to the dashboard.
 */
const googleCallback = [
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed`,
  }),
  (req, res) => {
    const token = signToken(req.user);
    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.redirect(`${process.env.CLIENT_URL}/dashboard`);
  },
];

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await userModel.findByEmail(email);

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        error: "Invalid credentials.",
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid credentials.",
      });
    }

    const token = signToken(user);

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

    if (!displayName || !email || !password ) {
      return res.status(400).json({
        error: "All fields are required.",
      });
    }

    const existingUser = await userModel.findByEmail(email);

    if (existingUser) {
      return res.status(409).json({
        error: "Email already in use.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await userModel.createLocalUser({
      displayName,
      email,
      passwordHash
    });

    const token = signToken(user);

    res.cookie(COOKIE_NAME, token, cookieOptions);

    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Returns the authenticated user's profile.
 * The `authenticate` middleware has already verified the token and set req.user.
 * We re-fetch from the DB to confirm the account still exists.
 */
const getMe = async (req, res, next) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) {
      res.clearCookie(COOKIE_NAME);
      return res.status(401).json({ error: "Account not found." });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 * Clears the JWT cookie. Because JWTs are stateless, this is the full
 * "invalidation" — the token becomes unreachable from the browser.
 */
const logout = (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: 0 });
  res.send({ message: "Logged out." });
};

module.exports = { googleAuth, googleCallback, login, signup, getMe, logout };
