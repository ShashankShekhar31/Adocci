require("dotenv").config();  

const pool = require("./db");

async function createTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analyses (
        id SERIAL PRIMARY KEY,
        filename TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        task TEXT,
        apps JSON,
        steps JSON,
        issues JSON,
        suggestions JSON,
        productivity_score INT
      );
    `);

    console.log("Table created successfully");
    process.exit();
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

createTable();