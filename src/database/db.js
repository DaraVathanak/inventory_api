const mysql = require("mysql2/promise");

let pool = null;

async function connectDB() {
  if (pool) return pool;

  const host     = process.env.DB_HOST     || "localhost";
  const port     = parseInt(process.env.DB_PORT || "3306", 10);
  const database = process.env.DB_NAME     || "inventory";
  const user     = process.env.DB_USER     || "root";
  const password = process.env.DB_PASSWORD || "";

  // Step 1 — connect WITHOUT a database to create it if missing
  const tempConn = await mysql.createConnection({ host, port, user, password });
  await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
  await tempConn.end();
  console.log(`🗄️   Database '${database}' ready.`);

  // Step 2 — create the real pool pointing at the database
  pool = mysql.createPool({
    host, port, database, user, password,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
  });

  const conn = await pool.getConnection();
  console.log(`✅  MySQL connected → ${host}:${port}/${database}`);
  conn.release();
  return pool;
}

async function getPool() {
  if (!pool) await connectDB();
  return pool;
}

// Convenience wrapper — returns rows directly
async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

module.exports = { connectDB, getPool, query };