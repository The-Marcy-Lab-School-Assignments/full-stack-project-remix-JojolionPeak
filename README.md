# Personal Finance Tracker

## Overview

A full-stack personal finance application that lets users track their income and expenses over time. Users authenticate via Google OAuth, manually log transactions, and view spending summaries broken down by timeframe — with metrics that compare current spending against prior periods.

**What the app does:**

- Users can register and sign in via Google OAuth
- Authenticated users can manually log income and expense transactions
- Users can browse their transaction history filtered by timeframe (day, week, month, year, all-time)
- Each dashboard view displays recent transactions, the top 5 highest purchases for the selected timeframe, and a percentage-change metric comparing current spending to the previous period
- Users can create and manage custom spending categories
- Income and expenses are both tracked, with a net cash flow metric displayed per timeframe

**What you'll build:**

- A PostgreSQL database with tables for users, transactions, and categories
- A Node.js + Express REST API with MVC architecture, Google OAuth via Passport.js, and JWT-based session management
- A React + Vite frontend with a timeframe picker, dashboard summary cards, transaction list, and add/edit/delete transaction flow

---

- [Overview](#overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Initial Setup](#initial-setup)
- [Project Structure](#project-structure)
- [Phase 1: The Database](#phase-1-the-database)
  - [Schema](#schema)
  - [Seed Data](#seed-data)
  - [Phase 1 Success Checks](#phase-1-success-checks)
- [Phase 2: Backend — Models](#phase-2-backend--models)
  - [Phase 2 Success Checks](#phase-2-success-checks)
- [Phase 3: Backend — Controllers & the Server](#phase-3-backend--controllers--the-server)
  - [Phase 3 Success Checks](#phase-3-success-checks)
- [Phase 4: Frontend](#phase-4-frontend)
  - [Phase 4 Success Checks](#phase-4-success-checks)
- [API Contract](#api-contract)
  - [Auth](#auth)
  - [Users](#users)
  - [Transactions](#transactions)
  - [Summary & Dashboard](#summary--dashboard)
  - [Categories](#categories)
- [Environment Variables](#environment-variables)
- [Future Improvements](#future-improvements)

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (running locally)
- A Google Cloud project with OAuth 2.0 credentials ([setup guide](https://developers.google.com/identity/protocols/oauth2))

### Initial Setup

**1. Clone the repository.**

```sh
git clone <your-repo-url>
cd personal-finance-tracker
```

**2. The project has two top-level directories** — `client/` and `server/`. Each has its own `package.json`.

```
personal-finance-tracker/
├── client/                     # React + Vite frontend
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── context/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
└── server/                     # Node.js + Express backend
    ├── index.js
    ├── package.json
    ├── .env
    ├── db/
    │   ├── pool.js
    │   └── seed.js
    ├── middleware/
    │   ├── authenticate.js
    │   └── logRoutes.js
    ├── models/
    │   ├── userModel.js
    │   ├── transactionModel.js
    │   └── categoryModel.js
    └── controllers/
        ├── authControllers.js
        ├── userControllers.js
        ├── transactionControllers.js
        ├── summaryControllers.js
        └── categoryControllers.js
```

**3. Install server dependencies:**

```sh
cd server
npm install
```

**4. Install client dependencies:**

```sh
cd client
npm install
```

**5. Create the database:**

```sh
# Mac
createdb finance_tracker_db

# Windows
sudo -u postgres createdb finance_tracker_db
```

**6. Create your `server/.env` file** and fill in all required values. See [Environment Variables](#environment-variables) for the full list.

**7. Seed the database:**

```sh
cd server
node db/seed.js
```

**8. Start the development servers:**

In one terminal (backend):

```sh
cd server
npm run dev
```

In another terminal (frontend):

```sh
cd client
npm run dev
```

The frontend will be available at `http://localhost:5173` and the API at `http://localhost:3000`.

---

## Project Structure

### Backend — MVC Pattern

The server follows a strict Model-View-Controller pattern:

- **Models** (`models/`) — All SQL lives here. Each model file exports async functions that query the database and return results. Controllers never write raw SQL.
- **Controllers** (`controllers/`) — Each controller function handles one route. It calls model functions, handles errors, and sends the HTTP response.
- **Middleware** (`middleware/`) — Reusable logic applied across routes. `authenticate.js` protects private routes by verifying the JWT. `logRoutes.js` logs incoming requests.

### Frontend — React + Vite

The client is organized by feature:

- **`pages/`** — Top-level route components (`LoginPage`, `DashboardPage`, `TransactionsPage`, `CategoriesPage`)
- **`components/`** — Reusable UI components (`TransactionCard`, `SummaryMetric`, `TimeframePicker`, `TransactionForm`, etc.)
- **`context/`** — Global state (authenticated user, selected timeframe)
- **`hooks/`** — Custom hooks for data fetching (`useTransactions`, `useSummary`)
- **`utils/`** — Helper functions for date range calculation, currency formatting, and percent change

---

## Phase 1: The Database

Build `db/pool.js` and `db/seed.js`. Nothing else can run until the database is set up and seeded.

### Schema

Your seed file must create these three tables:

**`users`**

| Column         | Type          | Constraints        |
| -------------- | ------------- | ------------------ |
| `id`           | `UUID`        | `PRIMARY KEY`      |
| `google_id`    | `TEXT`        | `UNIQUE, NOT NULL` |
| `email`        | `TEXT`        | `UNIQUE, NOT NULL` |
| `display_name` | `TEXT`        |                    |
| `avatar_url`   | `TEXT`        |                    |
| `created_at`   | `TIMESTAMPTZ` | `DEFAULT NOW()`    |

**`categories`**

| Column    | Type   | Constraints                                                           |
| --------- | ------ | --------------------------------------------------------------------- |
| `id`      | `UUID` | `PRIMARY KEY`                                                         |
| `user_id` | `UUID` | `REFERENCES users(id) ON DELETE CASCADE` — `NULL` for global defaults |
| `name`    | `TEXT` | `NOT NULL`                                                            |
| `icon`    | `TEXT` |                                                                       |
| `color`   | `TEXT` |                                                                       |
| `type`    | `TEXT` | `CHECK (type IN ('expense', 'income', 'both'))`                       |

**`transactions`**

| Column                 | Type            | Constraints                                        |
| ---------------------- | --------------- | -------------------------------------------------- |
| `id`                   | `UUID`          | `PRIMARY KEY`                                      |
| `user_id`              | `UUID`          | `REFERENCES users(id) ON DELETE CASCADE, NOT NULL` |
| `category_id`          | `UUID`          | `REFERENCES categories(id)`                        |
| `amount`               | `NUMERIC(12,2)` | `NOT NULL`                                         |
| `type`                 | `TEXT`          | `CHECK (type IN ('expense', 'income'))`            |
| `description`          | `TEXT`          |                                                    |
| `merchant`             | `TEXT`          |                                                    |
| `date`                 | `DATE`          | `NOT NULL`                                         |
| `source`               | `TEXT`          | `DEFAULT 'manual'`                                 |
| `plaid_transaction_id` | `TEXT`          | `UNIQUE` — reserved for future Plaid integration   |
| `plaid_account_id`     | `TEXT`          | — reserved for future Plaid integration            |
| `created_at`           | `TIMESTAMPTZ`   | `DEFAULT NOW()`                                    |

> **Note on `source` and `plaid_*` columns:** These are intentionally seeded as `NULL` for all manual entries. When Plaid is integrated in a future phase, it will write into these same columns. This design means Plaid becomes a second insertion path with no changes required to existing queries.

### Seed Data

Seed at least 2 test users with a variety of transactions spread across multiple categories, types (`expense` and `income`), and dates (spread across at least 2 calendar months so timeframe comparisons return meaningful data). Also seed the global default categories so every new user has a starting set.

### Phase 1 Success Checks

Run the seed file:

```sh
node db/seed.js
```

Then verify in `psql`:

```sql
\dt                                              -- all three tables should appear
SELECT id, email, display_name FROM users;
SELECT id, name, type FROM categories;
SELECT id, amount, type, date FROM transactions LIMIT 10;
```

Don't move on until all three tables exist and contain seeded data.

---

## Phase 2: Backend — Models

Build `userModel.js`, `transactionModel.js`, and `categoryModel.js`. Each model exports async functions that run SQL queries — controllers call these functions but never write SQL themselves.

Read the [API Contract](#api-contract) to understand what shape each response needs. Work backwards: look at a response shape, then write the SQL that produces it.

Key queries to think through:

- `transactionModel.listByTimeframe(userId, from, to)` — filters by `date` range and `user_id`, returns transactions with their category name and color via a JOIN
- `transactionModel.topPurchases(userId, from, to)` — same filter, ordered by `amount DESC`, limited to 5
- `summaryModel.getSummary(userId, timeframe)` — needs to compute `SUM(amount)` for both the current and previous period; the timeframe boundaries should be calculated in a utility function before being passed to the query
- `categoryModel.listForUser(userId)` — returns global categories (`user_id IS NULL`) plus the user's custom categories

### Phase 2 Success Checks

Create a temporary `server/test.js` to verify your models directly:

```js
// server/test.js — delete after testing
require("dotenv").config();
const transactionModel = require("./models/transactionModel");

const test = async () => {
  const userId = "<a seeded user UUID>";
  const from = "2026-05-01";
  const to = "2026-05-31";

  console.log(
    "Transactions:",
    await transactionModel.listByTimeframe(userId, from, to)
  );
  console.log(
    "Top purchases:",
    await transactionModel.topPurchases(userId, from, to)
  );

  process.exit();
};
test();
```

---

## Phase 3: Backend — Controllers & the Server

Build the middleware, controllers, and `index.js`.

### Authentication

This app uses **Google OAuth 2.0** via Passport.js (`passport-google-oauth20`). The flow is:

1. User visits `GET /auth/google` → redirected to Google's consent screen
2. Google redirects back to `GET /auth/google/callback` with a code
3. Passport exchanges the code for a profile, finds or creates the user in the database, then issues a **signed JWT**
4. The JWT is sent to the client as an `HttpOnly` cookie
5. All protected routes verify the JWT via the `authenticate` middleware

Store the user's `id` (UUID) in the JWT payload. The `authenticate` middleware should attach the decoded user to `req.user`.

### JWT vs. Sessions

This project uses JWTs instead of server-side sessions. Key differences to keep in mind:

- No session store is needed — the JWT is self-contained and stateless
- Use the `jsonwebtoken` package (`jwt.sign` on login, `jwt.verify` in middleware)
- Set the JWT as an `HttpOnly`, `Secure` (in production), `SameSite=Strict` cookie so it is never accessible from JavaScript
- JWTs cannot be invalidated server-side — logout is handled by clearing the cookie on the client

### Phase 3 Success Checks

Start the server:

```sh
node index.js
```

Test the public endpoints:

```sh
# Confirm transactions endpoint requires auth
curl -s http://localhost:3000/api/transactions | jq

# Confirm categories are public
curl -s http://localhost:3000/api/categories | jq
```

For auth-protected endpoints, complete the Google OAuth flow in the browser, then copy the JWT cookie value into your curl commands using `-H "Cookie: token=<jwt>"`.

---

## Phase 4: Frontend

Build the React frontend in `client/src/`. The frontend communicates exclusively with the Express API — no direct database access.

### Pages

- **`/login`** — Google Sign-In button; redirects to `/dashboard` on success
- **`/dashboard`** — Main view: timeframe picker, summary metrics, top 5 purchases, recent transactions
- **`/transactions`** — Full paginated transaction list; add / edit / delete transaction modal
- **`/categories`** — Manage custom categories (create, delete)

### Timeframe Picker

The timeframe picker lives in a persistent header or sidebar. Selecting a new timeframe (day / week / month / year / all-time) updates a global context value. All dashboard components re-fetch when the timeframe changes.

Date boundaries are calculated in `utils/dateRanges.js` on the client and sent as `?from=` and `?to=` query parameters to the API.

### Phase 4 Success Checks

With both servers running:

- [ ] Visiting `/` redirects unauthenticated users to `/login`
- [ ] Clicking "Sign in with Google" completes OAuth and lands on `/dashboard`
- [ ] The dashboard loads and displays the current month's data by default
- [ ] Switching timeframes re-fetches and updates all dashboard metrics
- [ ] Adding a transaction via the form appears immediately in the transaction list
- [ ] Editing and deleting a transaction works and reflects in the UI without a full reload
- [ ] The % change metric correctly shows N/A for the all-time timeframe

---

## API Contract

All API routes are prefixed with `/api`. Routes marked **Auth required** expect a valid JWT cookie; they return `401` if none is present.

---

### Auth

**`GET /auth/google`**
Redirects the user to Google's OAuth consent screen. No request body.

**`GET /auth/google/callback`**
OAuth redirect URI. On success, sets the JWT cookie and redirects to `/dashboard`. On failure, redirects to `/login`.

**`GET /api/auth/me`**
Returns the currently authenticated user. **Auth required.**

**Success `200`:**

```json
{
  "id": "uuid",
  "email": "user@gmail.com",
  "displayName": "Jane Doe",
  "avatarUrl": "https://..."
}
```

**Error `401`** — no valid JWT

**`POST /api/auth/logout`**
Clears the JWT cookie.

**Success `200`:**

```json
{ "message": "Logged out." }
```

---

### Users

**`DELETE /api/users/:id`**
Delete the authenticated user's account. **Auth required.** Users may only delete their own account.

**Success `200`:**

```json
{ "id": "uuid", "email": "user@gmail.com" }
```

**Error `401`** — not logged in
**Error `403`** — attempting to delete a different user's account

---

### Transactions

**`GET /api/transactions`**
Returns the authenticated user's transactions within a date range, paginated. **Auth required.**

**Query params:**

```
?from=2026-05-01
?to=2026-05-31
?page=1
?limit=20
?type=expense          # optional: expense | income
?category_id=uuid      # optional
```

**Success `200`:**

```json
{
  "data": [
    {
      "id": "uuid",
      "amount": 42.5,
      "type": "expense",
      "description": "Lunch",
      "merchant": "Chipotle",
      "category": { "id": "uuid", "name": "Food", "color": "#FF6B6B" },
      "date": "2026-05-10"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 84,
    "hasMore": true
  }
}
```

**`POST /api/transactions`**
Create a new transaction. **Auth required.**

**Request body:**

```json
{
  "amount": 42.5,
  "type": "expense",
  "description": "Lunch",
  "merchant": "Chipotle",
  "category_id": "uuid",
  "date": "2026-05-10"
}
```

**Success `201`:** The newly created transaction object.
**Error `400`** — missing required fields
**Error `401`** — not logged in

**`PUT /api/transactions/:id`**
Update a transaction. **Auth required.** Owner only.

**Request body:** Any subset of the transaction fields.

**Success `200`:** The updated transaction object.
**Error `401`** — not logged in
**Error `403`** — not the owner
**Error `404`** — transaction not found

**`DELETE /api/transactions/:id`**
Delete a transaction. **Auth required.** Owner only.

**Success `200`:** The deleted transaction object.
**Error `401`** — not logged in
**Error `403`** — not the owner
**Error `404`** — transaction not found

---

### Summary & Dashboard

**`GET /api/summary`**
Returns aggregated spending and income metrics for the current and previous period. **Auth required.**

**Query params:**

```
?timeframe=month       # day | week | month | year | all
```

**Success `200`:**

```json
{
  "timeframe": "month",
  "current": {
    "from": "2026-05-01",
    "to": "2026-05-12",
    "totalExpenses": 1240.0,
    "totalIncome": 3500.0,
    "netFlow": 2260.0,
    "transactionCount": 23
  },
  "previous": {
    "from": "2026-04-01",
    "to": "2026-04-30",
    "totalExpenses": 980.0,
    "totalIncome": 3500.0,
    "netFlow": 2520.0
  },
  "expensePercentChange": 26.53,
  "incomePercentChange": 0.0,
  "netFlowPercentChange": -10.32,
  "topPurchases": [
    {
      "id": "uuid",
      "amount": 320.0,
      "description": "Electric bill",
      "merchant": "ConEd",
      "category": { "name": "Utilities", "color": "#4ECDC4" },
      "date": "2026-05-03"
    }
  ]
}
```

> **All-time timeframe:** `expensePercentChange`, `incomePercentChange`, and `netFlowPercentChange` will be `null`. The frontend displays "N/A" for these fields.

**`GET /api/summary/by-category`**
Returns spending broken down by category for the selected timeframe. **Auth required.**

**Query params:**

```
?timeframe=month
?type=expense          # optional: expense | income
```

**Success `200`:**

```json
{
  "categories": [
    { "name": "Food", "color": "#FF6B6B", "total": 420.0, "percentage": 33.8 },
    {
      "name": "Transport",
      "color": "#4ECDC4",
      "total": 180.0,
      "percentage": 14.5
    }
  ]
}
```

---

### Categories

**`GET /api/categories`**
Returns all global default categories plus the authenticated user's custom categories. **Auth required.**

**Success `200`:**

```json
[
  {
    "id": "uuid",
    "name": "Food",
    "icon": "🍔",
    "color": "#FF6B6B",
    "type": "expense",
    "isCustom": false
  },
  {
    "id": "uuid",
    "name": "Freelance",
    "icon": "💻",
    "color": "#A78BFA",
    "type": "income",
    "isCustom": true
  }
]
```

**`POST /api/categories`**
Create a custom category for the authenticated user. **Auth required.**

**Request body:**

```json
{ "name": "Freelance", "icon": "💻", "color": "#A78BFA", "type": "income" }
```

**Success `201`:** The newly created category object.
**Error `400`** — missing required fields
**Error `401`** — not logged in

**`DELETE /api/categories/:id`**
Delete a user-created category. **Auth required.** Users may only delete their own categories; global defaults cannot be deleted.

**Success `200`:** The deleted category object.
**Error `401`** — not logged in
**Error `403`** — attempting to delete another user's category or a global default
**Error `404`** — category not found

---

## Environment Variables

Create a `server/.env` file with the following:

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=finance_tracker_db
DB_USER=your_postgres_username
DB_PASSWORD=your_postgres_password

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# JWT
JWT_SECRET=a_long_random_secret_string
JWT_EXPIRES_IN=7d

# Server
PORT=3000
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

> **Never commit `.env` to version control.** The `.gitignore` is already configured to exclude it.

---

## Future Improvements

The following features are intentionally out of scope for the initial build but are designed into the data model so they can be added without breaking changes:

- **Plaid integration** — The `source`, `plaid_transaction_id`, and `plaid_account_id` columns on `transactions` are already in place. Plaid would become a second insertion path that writes into the same table, with no changes needed to existing queries or the frontend.
- **Budget goals** — A `budgets` table (per user, per category, per month) could be added and surfaced as a progress bar on the dashboard.
- **Recurring transactions** — A `is_recurring` flag and `recurrence_rule` column on `transactions` would support auto-logging of fixed monthly expenses.
- **CSV import** — A `POST /api/transactions/import` endpoint could accept a CSV file and bulk-insert rows with `source = 'csv'`.
- **Data export** — `GET /api/transactions/export?format=csv` for user data portability.
