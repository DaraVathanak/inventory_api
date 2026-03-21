require("dotenv").config();
const { connectDB, query } = require("./db");

async function migrate() {
  await connectDB();
  console.log("🔧  Adding last_login to manager and employee tables…");

  await query("ALTER TABLE manager  ADD COLUMN IF NOT EXISTS last_login DATETIME").catch(() =>
    query("ALTER TABLE manager  ADD COLUMN last_login DATETIME").catch(() => {})
  );
  await query("ALTER TABLE employee ADD COLUMN IF NOT EXISTS last_login DATETIME").catch(() =>
    query("ALTER TABLE employee ADD COLUMN last_login DATETIME").catch(() => {})
  );

  console.log("✅  Done.");
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });