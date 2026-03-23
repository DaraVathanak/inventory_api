const mysql = require("mysql2/promise");

let pool = null;

function getTimezoneOffset() {
  const offset = -new Date().getTimezoneOffset();
  const sign   = offset >= 0 ? "+" : "-";
  const abs    = Math.abs(offset);
  const h      = String(Math.floor(abs / 60)).padStart(2, "0");
  const m      = String(abs % 60).padStart(2, "0");
  return `${sign}${h}:${m}`;
}

async function connectDB() {
  if (pool) return pool;

  const host     = process.env.DB_HOST     || "localhost";
  const port     = parseInt(process.env.DB_PORT || "3306", 10);
  const database = process.env.DB_NAME     || "inventory";
  const user     = process.env.DB_USER     || "root";
  const password = process.env.DB_PASSWORD || "";
  const useSSL   = process.env.DB_SSL === "true";

  const sslConfig = useSSL ? { ssl: { rejectUnauthorized: true } } : {};

  // Only create DB locally — TiDB/cloud creates it for you
  if (!useSSL) {
    const tempConn = await mysql.createConnection({ host, port, user, password });
    await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await tempConn.end();
    console.log(`🗄️   Database '${database}' ready.`);
  } else {
    // For TiDB/cloud — create DB using SSL connection
    const tempConn = await mysql.createConnection({
      host, port, user, password, ...sslConfig,
    });
    await tempConn.execute(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
    await tempConn.end();
    console.log(`🗄️   Database '${database}' ready.`);
  }

  pool = mysql.createPool({
    host, port, database, user, password,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    timezone:           "local",
    ...sslConfig,
  });

  const conn = await pool.getConnection();
  const offset = getTimezoneOffset();
  await conn.execute(`SET time_zone = '${offset}'`);
  conn.release();
  console.log(`✅  MySQL connected → ${host}:${port}/${database}`);
  return pool;
}

async function getPool() {
  if (!pool) await connectDB();
  return pool;
}

async function query(sql, params = []) {
  const p = await getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

module.exports = { connectDB, getPool, query };