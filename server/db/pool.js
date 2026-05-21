const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Surface connection errors immediately rather than silently failing on first query
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌  Failed to connect to PostgreSQL:", err.message);
    process.exit(1);
  }
  console.log("✅  Connected to PostgreSQL:", process.env.DB_NAME);
  release();
});

module.exports = pool;
