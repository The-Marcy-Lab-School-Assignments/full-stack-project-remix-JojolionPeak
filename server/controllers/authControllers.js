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
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
};

/**
 * Build and sign a JWT containing only the user's id.
 * Keeping the payload minimal ensures the cookie stays well under
 * the 4 kb browser limit — especially important when avatarUrl is
 * a large base64 string rather than a URL.
 * @param {object} user — { id }
 * @returns {string} signed JWT
 */
const signToken = (user) =>
  jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// Constant-time dummy hash used when a user is not found.
// Ensures the bcrypt comparison always runs regardless of whether the email
// exists, preventing timing-based email enumeration.
const DUMMY_HASH =
  "$2b$12$invalidhashfortimingprotectionxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

// ─── Validation Helpers ───────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normaliseEmail = (email) =>
  typeof email === "string" ? email.toLowerCase().trim() : "";

const validateEmail = (email) => EMAIL_REGEX.test(email);

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
    failureRedirect: `${process.env.CLIENT_URL}/auth?error=oauth_failed`,
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

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normEmail = normaliseEmail(email);

    // Always fetch the user then always run bcrypt, even when no user exists.
    // This keeps response time constant and prevents timing-based email enumeration.
    const user = await userModel.findByEmail(normEmail);
    const hashToCompare = user?.passwordHash || DUMMY_HASH;
    const validPassword = await bcrypt.compare(password, hashToCompare);

    if (!user || !user.passwordHash || !validPassword) {
      return res.status(401).json({ error: "Invalid credentials." });
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

    if (!displayName || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    // ── Input validation ──────────────────────────────────────────────────────

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
      // Prevents bcrypt CPU-DoS via huge strings
      return res.status(400).json({ error: "Password must be 128 characters or fewer." });
    }

    // ── Uniqueness check ──────────────────────────────────────────────────────

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
      res.clearCookie(COOKIE_NAME, cookieOptions);
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