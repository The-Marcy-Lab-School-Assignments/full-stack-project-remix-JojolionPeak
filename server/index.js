/**
 * index.js
 *
 * Express application entry point.
 *
 * Responsibilities:
 *  - Load environment variables
 *  - Validate required env vars before anything else
 *  - Configure middleware (CORS, JSON parsing, cookie parsing, logging)
 *  - Configure Passport Google OAuth strategy
 *  - Mount all route groups
 *  - Global error handler
 *  - Start the HTTP server
 */

require("dotenv").config();

// ─── Environment Validation ───────────────────────────────────────────────────
// Fail fast if required secrets are missing. This prevents silent failures
// where jwt.sign() would use 'undefined' as the secret, allowing token forgery.

if (!process.env.JWT_SECRET) {
  console.error("❌  JWT_SECRET is not set. Exiting.");
  process.exit(1);
}

if (!process.env.DATABASE_URL && !(process.env.DB_HOST && process.env.DB_NAME)) {
  console.error("❌  Database connection env vars are not set. Exiting.");
  process.exit(1);
}

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const pool = require("./db/pool");
const logRoutes = require("./middleware/logRoutes");
const authenticate = require("./middleware/authenticate");

const authControllers = require("./controllers/authControllers");
const userControllers = require("./controllers/userControllers");
const accountControllers = require("./controllers/accountControllers");
const transactionControllers = require("./controllers/transactionControllers");
const summaryControllers = require("./controllers/summaryControllers");
const categoryControllers = require("./controllers/categoryControllers");
const cleanupJob = require("./cleanupJob");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL, // e.g. http://localhost:5173
    credentials: true, // allow cookies to be sent cross-origin
  })
);

// Reject request bodies larger than 10 kb — prevents memory-exhaustion attacks
// and stops attackers from sending huge strings to bcrypt (CPU DoS vector).
app.use(express.json({ limit: "10kb" }));
app.use(cookieParser());
app.use(logRoutes);
app.use(passport.initialize());

// ─── Rate Limiters ────────────────────────────────────────────────────────────

// Strict limiter for login — 10 attempts per IP per 15 minutes.
// Blocks brute-force password attacks.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts. Please wait 15 minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Tighter limiter for signup — 5 attempts per IP per 15 minutes.
// Signup abuse is cheaper to execute than login abuse, so a lower cap is safer.
const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: "Too many sign-up attempts. Please wait 15 minutes and try again." },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API limiter — generous enough for normal use but blocks scripted abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Passport: Google OAuth Strategy ─────────────────────────────────────────
//
// When Google redirects back, Passport calls this verify callback with the
// user's profile. We find-or-create the user in our DB and pass them to `done`.
// Passport then attaches the returned object to req.user.

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const userModel = require("./models/userModel");

        const googleId = profile.id;
        const email = profile.emails?.[0]?.value || "";
        const displayName = profile.displayName || "";
        const avatarUrl = profile.photos?.[0]?.value || "";

        // Check if this Google account has signed in before
        let user = await userModel.findByGoogleId(googleId);

        if (!user) {
          // First sign-in — create an account
          user = await userModel.create({
            googleId,
            email,
            displayName,
            avatarUrl,
          });
        } else {
          // Refresh the avatar URL on every login so stale URLs self-heal
          user = await userModel.updateUser(user.id, { avatarUrl });
        }

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// ─── Routes ───────────────────────────────────────────────────────────────────

// General API rate limiter applied to all /api routes
app.use("/api/", apiLimiter);

// OAuth — not prefixed with /api because these are browser redirects
app.get("/auth/google", authControllers.googleAuth);
app.get("/auth/google/callback", ...authControllers.googleCallback);

// Auth API — dedicated rate limiters on login/signup to block brute-force
app.get("/api/auth/me", authenticate, authControllers.getMe);
app.post("/api/auth/signup", signupLimiter, authControllers.signup);
app.post("/api/auth/login",  loginLimiter,  authControllers.login);
app.post("/api/auth/logout", authenticate,  authControllers.logout);

// Users
app.delete("/api/users/:id", authenticate, userControllers.deleteUser);
app.patch("/api/users/:id",  authenticate, userControllers.updateUser);

// Accounts (all auth-required)
app.get("/api/accounts",     authenticate, accountControllers.listAccounts);
app.get("/api/accounts/:id", authenticate, accountControllers.getAccount);
app.post("/api/accounts",    authenticate, accountControllers.createAccount);
app.patch("/api/accounts/:id",  authenticate, accountControllers.updateAccount);
app.delete("/api/accounts/:id", authenticate, accountControllers.deleteAccount);

// Transactions (all auth-required)
app.get(
  "/api/transactions",
  authenticate,
  transactionControllers.listTransactions
);
app.post(
  "/api/transactions",
  authenticate,
  transactionControllers.createTransaction
);
app.put(
  "/api/transactions/:id",
  authenticate,
  transactionControllers.updateTransaction
);
app.delete(
  "/api/transactions/:id",
  authenticate,
  transactionControllers.deleteTransaction
);

// Summary / Dashboard (all auth-required)
app.get("/api/summary", authenticate, summaryControllers.getSummary);
app.get(
  "/api/summary/range",
  authenticate,
  summaryControllers.getSummaryByRange
);
app.get(
  "/api/summary/by-category",
  authenticate,
  summaryControllers.getSummaryByCategory
);

// Categories (all auth-required)
app.get("/api/categories",     authenticate, categoryControllers.listCategories);
app.post("/api/categories",    authenticate, categoryControllers.createCategory);
app.delete(
  "/api/categories/:id",
  authenticate,
  categoryControllers.deleteCategory
);

// ─── Serve Frontend ────────────────────────────────────────────────────────────
//
// Express serves the Vite-built React app from frontend/dist.
// Any request that didn't match an /api route above gets index.html,
// letting React Router handle client-side navigation.

const path = require("path");

app.use(express.static(path.join(__dirname, "../frontend/dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/dist", "index.html"));
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────

app.use((req, res) => {
  res
    .status(404)
    .json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
//
// Any controller that calls next(err) lands here.
// This prevents unhandled promise rejections from crashing the server.

app.use((err, req, res, next) => {
  // eslint-disable-line no-unused-vars
  console.error("🔥  Unhandled error:", err);

  // Postgres unique-constraint violation (e.g. duplicate email)
  if (err.code === "23505") {
    return res
      .status(409)
      .json({ error: "A record with that value already exists." });
  }

  // Postgres foreign-key violation
  if (err.code === "23503") {
    return res.status(400).json({ error: "Referenced record does not exist." });
  }

  // Postgres check-constraint violation (e.g. invalid type)
  if (err.code === "23514") {
    return res.status(400).json({ error: "Invalid value provided." });
  }

  res
    .status(500)
    .json({ error: "Internal server error. Please try again later." });
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀  Server running at http://localhost:${PORT}`);
  // Start background jobs only after the server is successfully listening
  cleanupJob.start();
});