/**
 * index.js
 *
 * Express application entry point.
 *
 * Responsibilities:
 *  - Load environment variables
 *  - Configure middleware (CORS, JSON parsing, cookie parsing, logging)
 *  - Configure Passport Google OAuth strategy
 *  - Mount all route groups
 *  - Global error handler
 *  - Start the HTTP server
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const pool = require("./db/pool");
const logRoutes = require("./middleware/logRoutes");
const authenticate = require("./middleware/authenticate");

const authControllers = require("./controllers/authControllers");
const userControllers = require("./controllers/userControllers");
const accountControllers = require("./controllers/accountControllers");
const transactionControllers = require("./controllers/transactionControllers");
const summaryControllers = require("./controllers/summaryControllers");
const categoryControllers = require("./controllers/categoryControllers");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(
  cors({
    origin: process.env.CLIENT_URL, // e.g. http://localhost:5173
    credentials: true, // allow cookies to be sent cross-origin
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(logRoutes);
app.use(passport.initialize());

// DEV ONLY — remove before production
if (process.env.NODE_ENV === "development") {
  app.get("/dev/login/:email", async (req, res) => {
    const jwt = require("jsonwebtoken");

    const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [
      req.params.email,
    ]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "User not found" });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? "none"
          : "lax",
    });
    res.json({ message: `Logged in as ${user.email}`, id: user.id });
  });
}

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

// OAuth — not prefixed with /api because these are browser redirects
app.get("/auth/google", authControllers.googleAuth);
app.get("/auth/google/callback", ...authControllers.googleCallback);

// Auth API
app.get("/api/auth/me", authenticate, authControllers.getMe);
app.post("/api/auth/signup", authControllers.signup);
app.post("/api/auth/login", authControllers.login);
app.post("/api/auth/logout", authControllers.logout);

// Users
app.delete("/api/users/:id", authenticate, userControllers.deleteUser);
app.patch("/api/users/:id", authenticate, userControllers.updateUser);

// Accounts (all auth-required)
app.get("/api/accounts", authenticate, accountControllers.listAccounts);
app.get("/api/accounts/:id", authenticate, accountControllers.getAccount);
app.post("/api/accounts", authenticate, accountControllers.createAccount);
app.patch("/api/accounts/:id", authenticate, accountControllers.updateAccount);
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
app.get("/api/categories", authenticate, categoryControllers.listCategories);
app.post("/api/categories", authenticate, categoryControllers.createCategory);
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
});