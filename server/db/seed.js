require("dotenv").config();
const bcrypt = require("bcryptjs");
const pool = require("./pool");

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Simple UUID v4 generator using the built-in crypto module (no extra dependency)
const { randomUUID } = require("crypto");

// ─── Schema ───────────────────────────────────────────────────────────────────

const createTables = `

  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  -- Drop in reverse dependency order
  DROP TABLE IF EXISTS transactions CASCADE;
  DROP TABLE IF EXISTS accounts      CASCADE;
  DROP TABLE IF EXISTS categories    CASCADE;
  DROP TABLE IF EXISTS users         CASCADE;
  DROP TABLE IF EXISTS token_denylist CASCADE;

  -- Users created via Google OAuth
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
    google_id TEXT UNIQUE,
    email TEXT UNIQUE NOT NULL,
  
    password_hash TEXT,
  
    display_name TEXT NOT NULL,
    avatar_url TEXT,
  
    created_at TIMESTAMP DEFAULT NOW()
  );

  -- Categories: user_id IS NULL means it's a global default available to everyone
  CREATE TABLE categories (
    id      UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID  REFERENCES users(id) ON DELETE CASCADE,
    name    TEXT  NOT NULL,
    icon    TEXT,
    color   TEXT,
    type    TEXT  CHECK (type IN ('expense', 'income', 'both')) NOT NULL
  );

  -- Accounts: one user can have many accounts (checking, savings, credit, etc.)
  CREATE TABLE accounts (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    plaid_account_id    TEXT          UNIQUE,        -- NULL for manual accounts
    plaid_item_id       TEXT,                         -- NULL for manual accounts

    institution_name    TEXT,
    account_name        TEXT          NOT NULL,
    mask                TEXT,                         -- last 4 digits
    type                TEXT          NOT NULL CHECK (type IN ('depository', 'credit', 'loan', 'investment', 'other')),
    subtype             TEXT,                         -- checking, savings, credit card, etc.

    current_balance     NUMERIC(12,2),
    available_balance   NUMERIC(12,2),

    created_at          TIMESTAMPTZ   DEFAULT NOW()
  );

  -- Transactions: the core entity
  -- amount is signed: positive = income/credit, negative = expense/debit
  CREATE TABLE transactions (
    id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id           UUID           REFERENCES accounts(id) ON DELETE SET NULL,
    category_id          UUID           REFERENCES categories(id) ON DELETE SET NULL,

    amount               NUMERIC(12,2)  NOT NULL,     -- positive = income, negative = expense
    type                 TEXT           NOT NULL CHECK (type IN ('expense', 'income')),
    status               TEXT           NOT NULL DEFAULT 'complete' CHECK (status IN ('pending', 'complete')),

    description          TEXT,
    merchant             TEXT,

    date                 DATE           NOT NULL,
    authorized_date      DATE,

    source               TEXT           NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'plaid')),

    plaid_transaction_id TEXT           UNIQUE,        -- NULL for manual entries
    plaid_category       TEXT,                          -- raw automated category string from Plaid

    provider_metadata    JSONB,                         -- arbitrary provider payload

    created_at           TIMESTAMPTZ    DEFAULT NOW(),
    updated_at           TIMESTAMPTZ    DEFAULT NOW()
  );

   -- ─── Indexes ───────────────────────────────────────────────────────────────

  -- Optimizes:
  -- WHERE user_id = ?
  -- ORDER BY date DESC
  -- LIMIT pagination
  CREATE INDEX idx_transactions_user_date
  ON transactions(user_id, date DESC);

  -- Optimizes account lookups by user
  CREATE INDEX idx_accounts_user
  ON accounts(user_id);

  -- Optimizes joins/filtering by account_id
  CREATE INDEX idx_transactions_account
  ON transactions(account_id);

  CREATE TABLE token_denylist (
  jti        TEXT PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL
  );
  
  CREATE INDEX idx_denylist_expires_at
  ON token_denylist(expires_at);
`;

// ─── Global Default Categories ────────────────────────────────────────────────
// user_id is omitted (NULL) so every user sees these in their category picker.

const globalCategories = [
  // Expense categories
  { name: "Food & Dining", icon: "🍔", color: "#FF6B6B", type: "expense" },
  { name: "Transport", icon: "🚗", color: "#4ECDC4", type: "expense" },
  { name: "Housing", icon: "🏠", color: "#45B7D1", type: "expense" },
  { name: "Utilities", icon: "⚡", color: "#96CEB4", type: "expense" },
  { name: "Healthcare", icon: "🏥", color: "#FFEAA7", type: "expense" },
  { name: "Entertainment", icon: "🎬", color: "#DDA0DD", type: "expense" },
  { name: "Shopping", icon: "🛍️", color: "#F0A500", type: "expense" },
  { name: "Education", icon: "📚", color: "#6C88C4", type: "expense" },
  { name: "Travel", icon: "✈️", color: "#FF8C69", type: "expense" },
  { name: "Subscriptions", icon: "🔄", color: "#98D8C8", type: "expense" },
  { name: "Personal Care", icon: "💆", color: "#FFB6C1", type: "expense" },
  { name: "Other Expense", icon: "📦", color: "#B0B0B0", type: "expense" },
  // Income categories
  { name: "Salary", icon: "💼", color: "#2ECC71", type: "income" },
  { name: "Freelance", icon: "💻", color: "#A78BFA", type: "income" },
  { name: "Investment", icon: "📈", color: "#F39C12", type: "income" },
  { name: "Gift", icon: "🎁", color: "#E91E63", type: "income" },
  { name: "Other Income", icon: "💰", color: "#1ABC9C", type: "income" },
];

// ─── Seed Users ───────────────────────────────────────────────────────────────
// These are fake Google OAuth users for local development.
// In production, users are only created via the OAuth callback.

const seedUsers = [
  {
    email: "alice@example.com",
    password: "password123",
    display_name: "Alice Johnson",
    avatar_url: "https://i.pravatar.cc/150?u=alice",
  },
  {
    email: "bob@example.com",
    password: "password123",
    display_name: "Bob Martinez",
    avatar_url: "https://i.pravatar.cc/150?u=bob",
  },
  {
    email: "carol@example.com",
    password: "password123",
    display_name: "Carol Kim",
    avatar_url: "https://i.pravatar.cc/150?u=carol",
  },
];

// ─── Seed Runner ─────────────────────────────────────────────────────────────

const seed = async () => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Create tables
    console.log("📦  Creating tables...");
    await client.query(createTables);

    // 2. Insert global categories (no user_id)
    console.log("🏷️   Seeding global categories...");
    const categoryIds = {};

    for (const cat of globalCategories) {
      const result = await client.query(
        `INSERT INTO categories (name, icon, color, type)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name`,
        [cat.name, cat.icon, cat.color, cat.type]
      );
      categoryIds[cat.name] = result.rows[0].id;
    }

    // 3. Insert seed users
    console.log("👤  Seeding users...");
    const userIds = {};

    for (const user of seedUsers) {

      let passwordHash = null;
      if (user.password) {
        passwordHash = await bcrypt.hash(user.password, 12);
      }

      
      const result = await client.query(
        `INSERT INTO users (google_id, email, password_hash, display_name, avatar_url)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email`,
        [ user.google_id ?? null, user.email, passwordHash, user.display_name, user.avatar_url]
      );
      userIds[user.email] = result.rows[0].id;
    }

    const alice = userIds["alice@example.com"];
    const bob = userIds["bob@example.com"];

    // 4. Seed accounts
    console.log("🏦  Seeding accounts...");

    const seedAccounts = [
      // ── Alice ─────────────────────────────────────────────────────────────
      {
        key: "alice_checking",
        user_id: alice,
        institution_name: "Chase",
        account_name: "Total Checking",
        mask: "4821",
        type: "depository",
        subtype: "checking",
        current_balance: 3240.55,
        available_balance: 3240.55,
      },
      {
        key: "alice_savings",
        user_id: alice,
        institution_name: "Chase",
        account_name: "Savings",
        mask: "7703",
        type: "depository",
        subtype: "savings",
        current_balance: 12800.0,
        available_balance: 12800.0,
      },
      {
        key: "alice_credit",
        user_id: alice,
        institution_name: "American Express",
        account_name: "Gold Card",
        mask: "1009",
        type: "credit",
        subtype: "credit card",
        current_balance: -945.19, // outstanding balance (negative = owed)
        available_balance: 9054.81,
      },
      // ── Bob ───────────────────────────────────────────────────────────────
      {
        key: "bob_checking",
        user_id: bob,
        institution_name: "Bank of America",
        account_name: "Advantage Banking",
        mask: "3356",
        type: "depository",
        subtype: "checking",
        current_balance: 5120.0,
        available_balance: 5120.0,
      },
      {
        key: "bob_credit",
        user_id: bob,
        institution_name: "Citi",
        account_name: "Double Cash Card",
        mask: "8842",
        type: "credit",
        subtype: "credit card",
        current_balance: -328.29, // outstanding balance (negative = owed)
        available_balance: 4671.71,
      },
    ];

    const accountIds = {};

    for (const acct of seedAccounts) {
      const result = await client.query(
        `INSERT INTO accounts
           (user_id, institution_name, account_name, mask, type, subtype,
            current_balance, available_balance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          acct.user_id,
          acct.institution_name,
          acct.account_name,
          acct.mask,
          acct.type,
          acct.subtype,
          acct.current_balance,
          acct.available_balance,
        ]
      );
      accountIds[acct.key] = result.rows[0].id;
    }

    // 5. Seed transactions
    // Spread across current month (May 2026) and previous month (Apr 2026)
    // so timeframe comparison metrics have real data to work with.
    //
    // amount is signed: positive = income, negative = expense.
    // status defaults to 'complete'; a few are seeded as 'pending' for testing.
    // plaid_category mirrors the raw category string Plaid would send.
    console.log("💸  Seeding transactions...");

    const transactions = [
      // ── Alice — April 2026 (previous month) ──────────────────────────────
      {
        user_id: alice,
        account_key: "alice_checking",
        category: "Salary",
        amount: 4500.0,
        type: "income",
        status: "complete",
        description: "April paycheck",
        merchant: "Employer Inc.",
        date: "2026-04-01",
        plaid_category: "Payroll",
      },
      {
        user_id: alice,
        account_key: "alice_checking",
        category: "Housing",
        amount: -1800.0,
        type: "expense",
        status: "complete",
        description: "April rent",
        merchant: "Landlord LLC",
        date: "2026-04-01",
        plaid_category: "Rent",
      },
      {
        user_id: alice,
        account_key: "alice_checking",
        category: "Utilities",
        amount: -95.0,
        type: "expense",
        status: "complete",
        description: "Electric bill",
        merchant: "ConEd",
        date: "2026-04-03",
        plaid_category: "Utilities",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Food & Dining",
        amount: -62.4,
        type: "expense",
        status: "complete",
        description: "Weekly groceries",
        merchant: "Whole Foods",
        date: "2026-04-05",
        plaid_category: "Groceries",
      },
      {
        user_id: alice,
        account_key: "alice_checking",
        category: "Transport",
        amount: -132.0,
        type: "expense",
        status: "complete",
        description: "Monthly MetroCard",
        merchant: "MTA",
        date: "2026-04-06",
        plaid_category: "Public Transportation",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Food & Dining",
        amount: -24.5,
        type: "expense",
        status: "complete",
        description: "Lunch",
        merchant: "Chipotle",
        date: "2026-04-09",
        plaid_category: "Restaurants",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Subscriptions",
        amount: -15.99,
        type: "expense",
        status: "complete",
        description: "Streaming service",
        merchant: "Netflix",
        date: "2026-04-10",
        plaid_category: "Digital Purchase",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Entertainment",
        amount: -45.0,
        type: "expense",
        status: "complete",
        description: "Concert tickets",
        merchant: "Ticketmaster",
        date: "2026-04-14",
        plaid_category: "Entertainment",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Food & Dining",
        amount: -88.7,
        type: "expense",
        status: "complete",
        description: "Dinner with friends",
        merchant: "Carbone",
        date: "2026-04-18",
        plaid_category: "Restaurants",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Shopping",
        amount: -120.0,
        type: "expense",
        status: "complete",
        description: "New shoes",
        merchant: "Nike",
        date: "2026-04-20",
        plaid_category: "Clothing and Accessories",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Healthcare",
        amount: -30.0,
        type: "expense",
        status: "complete",
        description: "Pharmacy",
        merchant: "CVS",
        date: "2026-04-22",
        plaid_category: "Pharmacies",
      },
      {
        user_id: alice,
        account_key: "alice_checking",
        category: "Freelance",
        amount: 600.0,
        type: "income",
        status: "complete",
        description: "Freelance project",
        merchant: "Client A",
        date: "2026-04-25",
        plaid_category: "Transfer",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Food & Dining",
        amount: -14.75,
        type: "expense",
        status: "complete",
        description: "Coffee run",
        merchant: "Blue Bottle",
        date: "2026-04-28",
        plaid_category: "Coffee Shop",
      },

      // ── Alice — May 2026 (current month) ─────────────────────────────────
      {
        user_id: alice,
        account_key: "alice_checking",
        category: "Salary",
        amount: 4500.0,
        type: "income",
        status: "complete",
        description: "May paycheck",
        merchant: "Employer Inc.",
        date: "2026-05-01",
        plaid_category: "Payroll",
      },
      {
        user_id: alice,
        account_key: "alice_checking",
        category: "Housing",
        amount: -1800.0,
        type: "expense",
        status: "complete",
        description: "May rent",
        merchant: "Landlord LLC",
        date: "2026-05-01",
        plaid_category: "Rent",
      },
      {
        user_id: alice,
        account_key: "alice_checking",
        category: "Utilities",
        amount: -110.0,
        type: "expense",
        status: "complete",
        description: "Electric bill",
        merchant: "ConEd",
        date: "2026-05-02",
        plaid_category: "Utilities",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Food & Dining",
        amount: -74.2,
        type: "expense",
        status: "complete",
        description: "Weekly groceries",
        merchant: "Whole Foods",
        date: "2026-05-03",
        plaid_category: "Groceries",
      },
      {
        user_id: alice,
        account_key: "alice_checking",
        category: "Transport",
        amount: -132.0,
        type: "expense",
        status: "complete",
        description: "Monthly MetroCard",
        merchant: "MTA",
        date: "2026-05-06",
        plaid_category: "Public Transportation",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Subscriptions",
        amount: -15.99,
        type: "expense",
        status: "complete",
        description: "Streaming service",
        merchant: "Netflix",
        date: "2026-05-10",
        plaid_category: "Digital Purchase",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Food & Dining",
        amount: -34.0,
        type: "expense",
        status: "complete",
        description: "Lunch",
        merchant: "Sweetgreen",
        date: "2026-05-07",
        plaid_category: "Restaurants",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Shopping",
        amount: -210.0,
        type: "expense",
        status: "complete",
        description: "Clothing haul",
        merchant: "Zara",
        date: "2026-05-08",
        plaid_category: "Clothing and Accessories",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Travel",
        amount: -320.0,
        type: "expense",
        status: "pending",
        description: "Flight to Chicago",
        merchant: "Delta",
        date: "2026-05-09",
        plaid_category: "Airlines and Aviation Services",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Entertainment",
        amount: -60.0,
        type: "expense",
        status: "complete",
        description: "Broadway show",
        merchant: "Telecharge",
        date: "2026-05-10",
        plaid_category: "Entertainment",
      },
      {
        user_id: alice,
        account_key: "alice_credit",
        category: "Food & Dining",
        amount: -95.5,
        type: "expense",
        status: "pending",
        description: "Dinner out",
        merchant: "Le Bernardin",
        date: "2026-05-11",
        plaid_category: "Restaurants",
      },

      // ── Bob — April 2026 ─────────────────────────────────────────────────
      {
        user_id: bob,
        account_key: "bob_checking",
        category: "Salary",
        amount: 5200.0,
        type: "income",
        status: "complete",
        description: "April paycheck",
        merchant: "Tech Corp",
        date: "2026-04-01",
        plaid_category: "Payroll",
      },
      {
        user_id: bob,
        account_key: "bob_checking",
        category: "Housing",
        amount: -2200.0,
        type: "expense",
        status: "complete",
        description: "April rent",
        merchant: "Property Mgmt",
        date: "2026-04-01",
        plaid_category: "Rent",
      },
      {
        user_id: bob,
        account_key: "bob_credit",
        category: "Food & Dining",
        amount: -45.0,
        type: "expense",
        status: "complete",
        description: "Groceries",
        merchant: "Trader Joes",
        date: "2026-04-04",
        plaid_category: "Groceries",
      },
      {
        user_id: bob,
        account_key: "bob_credit",
        category: "Subscriptions",
        amount: -13.99,
        type: "expense",
        status: "complete",
        description: "Music streaming",
        merchant: "Spotify",
        date: "2026-04-05",
        plaid_category: "Digital Purchase",
      },
      {
        user_id: bob,
        account_key: "bob_checking",
        category: "Transport",
        amount: -55.0,
        type: "expense",
        status: "complete",
        description: "Gas",
        merchant: "Shell",
        date: "2026-04-07",
        plaid_category: "Gas Stations",
      },
      {
        user_id: bob,
        account_key: "bob_checking",
        category: "Investment",
        amount: 250.0,
        type: "income",
        status: "complete",
        description: "Dividend payment",
        merchant: "Fidelity",
        date: "2026-04-15",
        plaid_category: "Investment Income",
      },
      {
        user_id: bob,
        account_key: "bob_credit",
        category: "Education",
        amount: -199.0,
        type: "expense",
        status: "complete",
        description: "Online course",
        merchant: "Udemy",
        date: "2026-04-20",
        plaid_category: "Education",
      },

      // ── Bob — May 2026 ───────────────────────────────────────────────────
      {
        user_id: bob,
        account_key: "bob_checking",
        category: "Salary",
        amount: 5200.0,
        type: "income",
        status: "complete",
        description: "May paycheck",
        merchant: "Tech Corp",
        date: "2026-05-01",
        plaid_category: "Payroll",
      },
      {
        user_id: bob,
        account_key: "bob_checking",
        category: "Housing",
        amount: -2200.0,
        type: "expense",
        status: "complete",
        description: "May rent",
        merchant: "Property Mgmt",
        date: "2026-05-01",
        plaid_category: "Rent",
      },
      {
        user_id: bob,
        account_key: "bob_credit",
        category: "Food & Dining",
        amount: -67.3,
        type: "expense",
        status: "complete",
        description: "Groceries",
        merchant: "Trader Joes",
        date: "2026-05-05",
        plaid_category: "Groceries",
      },
      {
        user_id: bob,
        account_key: "bob_checking",
        category: "Transport",
        amount: -60.0,
        type: "expense",
        status: "complete",
        description: "Gas",
        merchant: "Shell",
        date: "2026-05-06",
        plaid_category: "Gas Stations",
      },
      {
        user_id: bob,
        account_key: "bob_credit",
        category: "Subscriptions",
        amount: -13.99,
        type: "expense",
        status: "complete",
        description: "Music streaming",
        merchant: "Spotify",
        date: "2026-05-05",
        plaid_category: "Digital Purchase",
      },
      {
        user_id: bob,
        account_key: "bob_credit",
        category: "Healthcare",
        amount: -150.0,
        type: "expense",
        status: "complete",
        description: "Dentist visit",
        merchant: "Dental Care NYC",
        date: "2026-05-08",
        plaid_category: "Dentists",
      },
      {
        user_id: bob,
        account_key: "bob_credit",
        category: "Shopping",
        amount: -85.0,
        type: "expense",
        status: "pending",
        description: "Home goods",
        merchant: "IKEA",
        date: "2026-05-10",
        plaid_category: "Furniture and Hardware",
      },
    ];

    for (const tx of transactions) {
      await client.query(
        `INSERT INTO transactions
           (user_id, account_id, category_id, amount, type, status,
            description, merchant, date, source, plaid_category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'manual', $10)`,
        [
          tx.user_id,
          accountIds[tx.account_key],
          categoryIds[tx.category],
          tx.amount,
          tx.type,
          tx.status,
          tx.description,
          tx.merchant,
          tx.date,
          tx.plaid_category,
        ]
      );
    }

    await client.query("COMMIT");

    console.log("");
    console.log("✅  Seed complete!");
    console.log(`   • ${globalCategories.length} global categories`);
    console.log(`   • ${seedUsers.length} users`);
    console.log(`   • ${seedAccounts.length} accounts`);
    console.log(`   • ${transactions.length} transactions`);
    console.log("");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌  Seed failed — transaction rolled back.");
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
};

seed();
