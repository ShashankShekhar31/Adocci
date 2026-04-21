const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "screen_analyzer",
  password: "Shashank@31",
  port: 5432,
});

module.exports = pool;