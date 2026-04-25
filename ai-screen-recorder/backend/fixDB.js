require("dotenv").config();
const pool = require("./db");

async function fixDB() {
  try {
    await pool.query(`
      ALTER TABLE analyses 
      ADD COLUMN IF NOT EXISTS productivity_score INT;
    `);

    console.log("Column added successfully");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    process.exit();
  }
}

fixDB();