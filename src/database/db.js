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

  // Step 2 — create the real pool with timezone set to local system time
  pool = mysql.createPool({
    host, port, database, user, password,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           "local", // use server's local timezone
  });

  // Step 3 — set MySQL session timezone to match Node.js process timezone
  const conn = await pool.getConnection();
  const offset = getTimezoneOffset();
  await conn.execute(`SET time_zone = '${offset}'`);
  conn.release();
  console.log(`✅  MySQL connected → ${host}:${port}/${database} (timezone: ${offset})`);
  return pool;
}

// Get current timezone offset as MySQL-compatible string e.g. "+07:00"
function getTimezoneOffset() {
  const offset = -new Date().getTimezoneOffset();
  const sign   = offset >= 0 ? "+" : "-";
  const abs    = Math.abs(offset);
  const h      = String(Math.floor(abs / 60)).padStart(2, "0");
  const m      = String(abs % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
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