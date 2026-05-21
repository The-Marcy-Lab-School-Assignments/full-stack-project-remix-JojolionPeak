# Mementos — Personal Finance Tracker

> **Take control of your money. No subscriptions, no ads, no noise.**

---

## Mission Statement

Mementos is a personal finance tracker built for people who want clarity without complexity. Most budgeting apps are bloated, expensive, or require handing your bank credentials to a third party you've never heard of. Mementos is different: it's a clean, self-hosted web app that lets you manually track your accounts and transactions, visualize your spending, and understand where your money actually goes — with an optional path to automated bank syncing via Plaid when you're ready.

This is for the person who has wondered "where did my paycheck go?" more than once. It's for the freelancer juggling multiple income streams, the recent grad trying to build their first budget, and anyone who wants a single place to see their full financial picture without a monthly fee.

---

## Table of Contents

- [Mission Statement](#mission-statement)
- [MVP User Stories](#mvp-user-stories)
- [Tech Stack](#tech-stack)
- [Schema Diagram](#schema-diagram)
- [API Contract](#api-contract)
- [Setup Instructions](#setup-instructions)
- [Roadmap](#roadmap)

---

## MVP User Stories

**Authentication**
- A user can create an account with a display name, email, and password
- A user can log in with their email and password
- A user can sign in with Google via OAuth
- A user can log out and have their session securely cleared
- A user can view their own profile (name, avatar)
- A user can update their display name or password
- A user can delete their account

**Accounts**
- A user can view all of their financial accounts (checking, savings, credit, etc.)
- A user can add a new account with a name, institution, type, and starting balance
- A user can edit an existing account's details
- A user can delete an account (their transactions are preserved, just unlinked)
- A user can see the current and available balance for each account

**Transactions**
- A user can view a paginated, filterable list of transactions
- A user can filter transactions by date range, type (income/expense), status, category, and account
- A user can add a new transaction manually with a date, amount, description, merchant, category, and account
- A user can edit an existing transaction
- A user can delete a transaction
- A user can mark a transaction as "pending" or "complete"

**Categories**
- A user can browse a set of global default categories (Food & Dining, Housing, Salary, etc.)
- A user can create their own custom categories with a name, icon, color, and type
- A user can delete their own custom categories

**Dashboard & Summary** *(coming soon — see Roadmap)*
- A user can see their total income and expenses for the current month at a glance
- A user can compare this month's spending to last month
- A user can see a breakdown of their spending by category
- A user can see their top 5 largest expenses for a given period

---

## Tech Stack

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | PostgreSQL |
| ORM / Query | `pg` (raw SQL with parameterized queries) |
| Authentication | JWT (HttpOnly cookies) + Passport.js (Google OAuth 2.0) |
| Password Hashing | bcryptjs |
| Dev Server | nodemon |

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 |
| Routing | React Router v7 |
| Build Tool | Vite |
| Styling | Tailwind CSS v4 + custom CSS design tokens |
| HTTP Client | Axios |
| Fonts | DM Serif Display, DM Mono (Google Fonts) |

### Infrastructure
| Concern | Approach |
|---|---|
| Auth flow | Stateless JWT stored in HttpOnly `SameSite=Strict` cookies |
| API Proxy (dev) | Vite proxy forwards `/api` requests to Express on port 3000 |
| Seed data | `seed.js` script — drops/recreates all tables and inserts sample data |
| Environment | `.env` files (never committed); `dotenv` for loading |

---

## Schema Diagram

```
┌──────────────────────────────────────────────────┐
│                      users                       │
├──────────────┬───────────────────────────────────┤
│ id           │ UUID (PK, gen_random_uuid())       │
│ google_id    │ TEXT (UNIQUE, nullable)            │
│ email        │ TEXT (UNIQUE, NOT NULL)            │
│ password_hash│ TEXT (nullable — OAuth users only) │
│ display_name │ TEXT (NOT NULL)                    │
│ avatar_url   │ TEXT (nullable)                    │
│ created_at   │ TIMESTAMP                          │
└──────────────┴───────────────────────────────────┘
        │
        │ 1 ──────────────────────── ∞
        ▼
┌──────────────────────────────────────────────────┐
│                    categories                    │
├──────────────┬───────────────────────────────────┤
│ id           │ UUID (PK)                          │
│ user_id      │ UUID (FK → users, nullable)        │
│              │  NULL = global default category    │
│ name         │ TEXT (NOT NULL)                    │
│ icon         │ TEXT (emoji)                       │
│ color        │ TEXT (hex)                         │
│ type         │ TEXT CHECK ('expense','income',    │
│              │             'both') NOT NULL       │
└──────────────┴───────────────────────────────────┘

        │ (user) 1 ──────────────────────── ∞
        ▼
┌──────────────────────────────────────────────────┐
│                     accounts                     │
├──────────────┬───────────────────────────────────┤
│ id           │ UUID (PK)                          │
│ user_id      │ UUID (FK → users, NOT NULL)        │
│ plaid_account_id │ TEXT (UNIQUE, nullable)        │
│ plaid_item_id│ TEXT (nullable)                    │
│ institution_name │ TEXT                           │
│ account_name │ TEXT (NOT NULL)                    │
│ mask         │ TEXT (last 4 digits)               │
│ type         │ TEXT CHECK ('depository','credit', │
│              │   'loan','investment','other')      │
│ subtype      │ TEXT (checking, savings, etc.)     │
│ current_balance   │ NUMERIC(12,2)                 │
│ available_balance │ NUMERIC(12,2)                 │
│ created_at   │ TIMESTAMPTZ                        │
└──────────────┴───────────────────────────────────┘
        │
        │ 1 ──────────────────────── ∞
        ▼
┌──────────────────────────────────────────────────┐
│                   transactions                   │
├──────────────┬───────────────────────────────────┤
│ id           │ UUID (PK)                          │
│ user_id      │ UUID (FK → users, NOT NULL)        │
│ account_id   │ UUID (FK → accounts, SET NULL)     │
│ category_id  │ UUID (FK → categories, SET NULL)   │
│ amount       │ NUMERIC(12,2) NOT NULL             │
│              │  positive = income, negative = exp │
│ type         │ TEXT CHECK ('expense','income')     │
│ status       │ TEXT CHECK ('pending','complete')   │
│ description  │ TEXT                               │
│ merchant     │ TEXT                               │
│ date         │ DATE (NOT NULL)                    │
│ authorized_date │ DATE                            │
│ source       │ TEXT CHECK ('manual','plaid')       │
│ plaid_transaction_id │ TEXT (UNIQUE, nullable)    │
│ plaid_category │ TEXT                             │
│ provider_metadata │ JSONB                         │
│ created_at   │ TIMESTAMPTZ                        │
│ updated_at   │ TIMESTAMPTZ                        │
└──────────────┴───────────────────────────────────┘
```

**Indexes**
- `idx_transactions_user_date` on `(user_id, date DESC)` — primary query pattern
- `idx_accounts_user` on `(user_id)` — account list lookups
- `idx_transactions_account` on `(account_id)` — account-scoped transaction views

---

## API Contract

All API routes return JSON. Auth-protected routes (marked 🔒) require a valid `token` cookie, set automatically at login/signup. Error responses follow `{ "error": "human-readable message" }`.

---

### Auth

#### `POST /api/auth/signup`
Create a new local account.

**Request body**
```json
{
  "displayName": "Alice Johnson",
  "email": "alice@example.com",
  "password": "supersecret"
}
```

**Response `201`**
```json
{
  "id": "uuid",
  "email": "alice@example.com",
  "displayName": "Alice Johnson",
  "avatarUrl": null
}
```
Sets `token` cookie. Errors: `400` missing fields, `409` email already in use.

---

#### `POST /api/auth/login`
Log in with email and password.

**Request body**
```json
{ "email": "alice@example.com", "password": "supersecret" }
```

**Response `200`**
```json
{
  "id": "uuid",
  "email": "alice@example.com",
  "displayName": "Alice Johnson",
  "avatarUrl": null
}
```
Sets `token` cookie. Errors: `401` invalid credentials.

---

#### `GET /auth/google`
Redirects the browser to Google's OAuth consent screen. No request body needed.

#### `GET /auth/google/callback`
Google redirects here after the user grants consent. Sets `token` cookie and redirects the browser to `/dashboard`.

---

#### `GET /api/auth/me`
🔒 Returns the currently authenticated user's profile.

**Response `200`**
```json
{
  "id": "uuid",
  "email": "alice@example.com",
  "displayName": "Alice Johnson",
  "avatarUrl": "https://...",
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```
Errors: `401` not authenticated.

---

#### `POST /api/auth/logout`
🔒 Clears the `token` cookie.

**Response `200`**
```json
{ "message": "Logged out." }
```

---

### Users

#### `PATCH /api/users/:id`
🔒 Update the authenticated user's profile. All fields are optional.

**Request body** (any subset)
```json
{
  "displayName": "Alice K. Johnson",
  "newPassword": "evenmoresecret"
}
```

**Response `200`** — updated user object.
Errors: `403` if `:id` doesn't match the authenticated user.

---

#### `DELETE /api/users/:id`
🔒 Permanently delete the user account. Cascades to all their accounts, transactions, and custom categories.

**Response `200`** — deleted user snapshot.

---

### Accounts

All account routes are 🔒 auth-protected.

#### `GET /api/accounts`
List all accounts for the current user, newest first.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "accountName": "Total Checking",
    "institutionName": "Chase",
    "mask": "4821",
    "type": "depository",
    "subtype": "checking",
    "currentBalance": 3240.55,
    "availableBalance": 3240.55,
    "createdAt": "2026-05-01T00:00:00.000Z"
  }
]
```

---

#### `GET /api/accounts/:id`
Get a single account by ID.

**Response `200`** — single account object (same shape as above).
Errors: `404` not found, `403` not owned by the current user.

---

#### `POST /api/accounts`
Create a new manual account.

**Request body**
```json
{
  "accountName": "Savings",
  "institutionName": "Chase",
  "type": "depository",
  "subtype": "savings",
  "mask": "7703",
  "currentBalance": 5000.00,
  "availableBalance": 5000.00
}
```
`accountName` and `type` are required.

**Response `201`** — newly created account object.

---

#### `PATCH /api/accounts/:id`
Partial update of an account. Only provided fields are changed.

**Request body** — any subset of the create fields.

**Response `200`** — updated account object.
Errors: `403` not owned, `404` not found.

---

#### `DELETE /api/accounts/:id`
Delete an account. Associated transactions have their `account_id` set to `NULL` — they are preserved.

**Response `200`**
```json
{ "id": "uuid", "accountName": "Savings", "type": "depository" }
```

---

### Transactions

All transaction routes are 🔒 auth-protected.

#### `GET /api/transactions`
List transactions with filtering and pagination.

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | `YYYY-MM-DD` | ✅ | Start date (inclusive) |
| `to` | `YYYY-MM-DD` | ✅ | End date (inclusive) |
| `type` | `expense` \| `income` | — | Filter by type |
| `status` | `pending` \| `complete` | — | Filter by status |
| `categoryId` | UUID | — | Filter by category |
| `accountId` | UUID | — | Filter by account |
| `page` | integer | — | Page number (default: 1) |
| `limit` | integer | — | Results per page (default: 20) |

**Response `200`**
```json
{
  "data": [
    {
      "id": "uuid",
      "accountId": "uuid",
      "amount": -62.40,
      "type": "expense",
      "status": "complete",
      "description": "Weekly groceries",
      "merchant": "Whole Foods",
      "date": "2026-05-03",
      "authorizedDate": null,
      "source": "manual",
      "createdAt": "...",
      "updatedAt": "...",
      "category": {
        "id": "uuid",
        "name": "Food & Dining",
        "icon": "🍔",
        "color": "#FF6B6B"
      },
      "account": {
        "id": "uuid",
        "accountName": "Gold Card",
        "institutionName": "American Express",
        "mask": "1009",
        "type": "credit",
        "subtype": "credit card"
      }
    }
  ],
  "total": 47,
  "page": 1,
  "limit": 20
}
```

---

#### `POST /api/transactions`
Create a new transaction manually.

**Request body**
```json
{
  "amount": -74.20,
  "type": "expense",
  "status": "complete",
  "description": "Weekly groceries",
  "merchant": "Whole Foods",
  "categoryId": "uuid",
  "accountId": "uuid",
  "date": "2026-05-03",
  "authorizedDate": null
}
```
`amount`, `type`, and `date` are required. Use a negative `amount` for expenses, positive for income.

**Response `201`** — full transaction object with category and account embedded.

---

#### `PUT /api/transactions/:id`
Update a transaction. All fields are optional (partial update supported).

**Request body** — any subset of the create fields.

**Response `200`** — updated transaction object.
Errors: `403` not owned, `404` not found.

---

#### `DELETE /api/transactions/:id`
Delete a transaction permanently.

**Response `200`**
```json
{
  "id": "uuid",
  "amount": -74.20,
  "type": "expense",
  "status": "complete",
  "description": "Weekly groceries",
  "merchant": "Whole Foods",
  "date": "2026-05-03"
}
```

---

### Summary / Dashboard

All summary routes are 🔒 auth-protected.

#### `GET /api/summary`
Aggregate totals for a given period, including a comparison to the preceding period of equal length and the top 5 expenses.

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | `YYYY-MM-DD` | ✅ | Period start |
| `to` | `YYYY-MM-DD` | ✅ | Period end |

**Response `200`**
```json
{
  "current": {
    "totalIncome": 4500.00,
    "totalExpenses": -2521.69,
    "transactionCount": 11,
    "netSavings": 1978.31,
    "topExpenses": [ "...transaction objects..." ]
  },
  "previous": {
    "totalIncome": 5100.00,
    "totalExpenses": -2430.34,
    "transactionCount": 13,
    "netSavings": 2669.66
  }
}
```

---

#### `GET /api/summary/range`
Same shape as `/api/summary` — use for any arbitrary custom date range.

**Query parameters** — same as `/api/summary`.

---

#### `GET /api/summary/by-category`
Spending breakdown grouped by category, with each category's share of the total.

**Query parameters**

| Param | Type | Required | Description |
|---|---|---|---|
| `from` | `YYYY-MM-DD` | ✅ | Start date |
| `to` | `YYYY-MM-DD` | ✅ | End date |
| `type` | `expense` \| `income` | — | Filter by transaction type |

**Response `200`**
```json
[
  {
    "name": "Housing",
    "icon": "🏠",
    "color": "#45B7D1",
    "type": "expense",
    "total": 1800.00,
    "percentage": 71.39
  },
  {
    "name": "Food & Dining",
    "icon": "🍔",
    "color": "#FF6B6B",
    "type": "expense",
    "total": 266.65,
    "percentage": 10.57
  }
]
```

---

### Categories

All category routes are 🔒 auth-protected.

#### `GET /api/categories`
List all categories available to the user: global defaults (visible to everyone) plus their own custom categories. Sorted by type, then name.

**Response `200`**
```json
[
  {
    "id": "uuid",
    "name": "Food & Dining",
    "icon": "🍔",
    "color": "#FF6B6B",
    "type": "expense",
    "isCustom": false
  },
  {
    "id": "uuid",
    "name": "My Freelance Work",
    "icon": "💻",
    "color": "#A78BFA",
    "type": "income",
    "isCustom": true
  }
]
```

---

#### `POST /api/categories`
Create a custom category for the current user.

**Request body**
```json
{
  "name": "Pet Care",
  "icon": "🐾",
  "color": "#F59E0B",
  "type": "expense"
}
```
`name` and `type` are required. `icon` and `color` are optional.

**Response `201`** — newly created category with `"isCustom": true`.

---

#### `DELETE /api/categories/:id`
Delete a custom category. Only the owning user can delete their categories. Global defaults cannot be deleted by anyone.

**Response `200`**
```json
{ "id": "uuid", "name": "Pet Care", "type": "expense" }
```
Errors: `403` not owned or is a global category, `404` not found.

---

## Setup Instructions

### Prerequisites
- Node.js v20+
- PostgreSQL 14+
- A Google Cloud project with OAuth 2.0 credentials *(optional — only needed for Google sign-in)*

---

### 1. Clone the repository

```bash
git clone https://github.com/your-username/mementos.git
cd mementos
```

---

### 2. Install backend dependencies

```bash
cd server
npm install
```

Create a `.env` file inside `server/`:

```env
PORT=3000
NODE_ENV=development

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mementos_dev
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=a_very_long_random_secret_string
JWT_EXPIRES_IN=7d

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback

# Frontend URL (for CORS and OAuth redirect)
CLIENT_URL=http://localhost:5173
```

---

### 3. Create the database

```bash
psql -U postgres -c "CREATE DATABASE mementos_dev;"
```

---

### 4. Seed the database

The seed script drops and recreates all tables, inserts 17 global categories, and creates 3 sample users with accounts and realistic transactions spread across the current and previous month.

```bash
node db/seed.js
```

**Sample users created:**

| Name | Email | Password |
|---|---|---|
| Alice Johnson | alice@example.com | password123 |
| Bob Martinez | bob@example.com | password123 |
| Carol Kim | carol@example.com | password123 |

---

### 5. Start the backend

```bash
npm run dev
# Running at http://localhost:3000
```

---

### 6. Install and start the frontend

```bash
cd ../client
npm install
npm run dev
# Running at http://localhost:5173
```

The Vite dev server proxies all `/api` requests to Express on port 3000, so cookies work correctly without any CORS configuration needed on your end.

---

### 7. Open the app

Visit [http://localhost:5173](http://localhost:5173) and log in with one of the seed accounts above, or sign up fresh.

---

## Roadmap

Planned features in rough priority order.

---

### Plaid Integration — Automatic Bank Syncing

The single biggest quality-of-life improvement. Users will connect their real bank accounts through [Plaid Link](https://plaid.com/docs/link/) and have transactions sync automatically — ending the need for manual entry.

The database schema already has the necessary columns reserved: `plaid_account_id`, `plaid_item_id`, `plaid_transaction_id`, `plaid_category`, and `provider_metadata` (JSONB for arbitrary Plaid payloads). Planned work:

- Plaid Link UI flow and public-token exchange endpoint
- `TRANSACTIONS_SYNC` webhook listener for real-time updates
- Smart duplicate detection when Plaid transactions overlap with manual entries
- Periodic balance refresh for connected accounts
- Visual badge distinguishing Plaid-synced vs. manual transactions

---

### Summary / Dashboard Page

A dedicated view giving users their most important financial signals at a glance, without hunting through transaction lists:

- **Monthly snapshot card** — total income, total expenses, net savings, and a delta vs. the previous month
- **Spending by category chart** — donut or bar chart powered by `/api/summary/by-category`
- **Top 5 expenses** — the biggest purchases in the selected period so nothing sneaks by
- **Daily spend trend** — a line chart showing how spending accumulated across the month
- **Custom date range picker** — analyze any period, not just the current month

---

### Categories Management Page

A dedicated UI for managing categories rather than doing it inline:

- Browse all global defaults with their icons and colors
- Create, rename, recolor, and delete custom categories
- See a mini spending summary per category for the current month
- Custom sort order via drag-and-drop

---

### CSV Import

Upload a bank statement export and have Mementos parse it into transactions. A review/mapping step lets users confirm before committing — the fastest way to backfill months of history without needing Plaid.

---

### Budgets

Set a monthly spending target per category. The dashboard would show progress bars and notify users when they're approaching or over their limit, turning Mementos from a tracking tool into a planning one.

---

### Multi-currency Support

Store a `currency` field on accounts and transactions. Users with accounts in multiple currencies (common for travelers and remote workers) would see transactions in their original currency alongside an optional converted total.

---

### Mobile App

The frontend design system (DM Mono, CSS variables, design tokens) was built with portability in mind. A React Native app sharing the same backend API would let users log transactions on the go — the most natural moment to capture spending is right when it happens.

---

*Built with ☕ and a few too many open tabs.*