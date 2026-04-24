require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

pool.on("connect", () => {
  console.log("Connected to DB");
});

pool.on("error", (err) => {
  console.error("Unexpected DB error:", err);
});

module.exports = pool;