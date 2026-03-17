const cron = require("node-cron");
const { query } = require("../database/db");

const ALERT_DAYS = () => parseInt(process.env.EXPIRY_ALERT_DAYS || "30", 10);

async function runExpiryCheck() {
  const days = ALERT_DAYS();
  const expiring = await query(`
    SELECT p.sku_id, p.name, p.stock_quantity, p.expiry_date,
           DATEDIFF(p.expiry_date, CURDATE()) AS days_left,
           s.company_name  AS supplier_name,
           w.location_name AS warehouse_name,
           c.category_name
    FROM product p
    LEFT JOIN supplier s  ON p.supplier_id  = s.supplier_id
    LEFT JOIN warehouse w ON p.warehouse_id = w.warehouse_id
    LEFT JOIN category c  ON p.category_id  = c.category_id
    WHERE p.expiry_date IS NOT NULL
      AND p.expiry_date >= CURDATE()
      AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
    ORDER BY p.expiry_date ASC
  `, [days]);

  for (const p of expiring) {
    await query(`
      INSERT INTO expiry_alert (sku_id, expiry_date, days_left, alerted_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE days_left = VALUES(days_left), alerted_at = NOW()
    `, [p.sku_id, p.expiry_date, p.days_left]);
  }

  if (expiring.length > 0) {
    console.log(`[expiry-alert] ⚠  ${expiring.length} product(s) expiring within ${days} days:`);
    expiring.forEach(p => console.log(`   • ${p.name} (${p.sku_id}) — ${p.days_left} day(s) left`));
  }
  return expiring;
}

function startExpiryJob() {
  console.log(`[expiry-alert] Scheduler started — runs daily at 08:00`);
  runExpiryCheck();
  cron.schedule("0 8 * * *", () => {
    console.log("[expiry-alert] Daily check running…");
    runExpiryCheck();
  });
}

// ── Express router ────────────────────────────────────────────────────────────
const router = require("express").Router();

router.get("/", async (req, res) => {
  try {
    const days = parseInt(req.query.days || process.env.EXPIRY_ALERT_DAYS || "30", 10);
    const alerts = await query(`
      SELECT p.sku_id, p.name, p.stock_quantity, p.expiry_date,
             DATEDIFF(p.expiry_date, CURDATE()) AS days_left,
             s.company_name  AS supplier_name,
             w.location_name AS warehouse_name,
             c.category_name,
             ea.alerted_at
      FROM product p
      LEFT JOIN supplier s     ON p.supplier_id  = s.supplier_id
      LEFT JOIN warehouse w    ON p.warehouse_id = w.warehouse_id
      LEFT JOIN category c     ON p.category_id  = c.category_id
      LEFT JOIN expiry_alert ea ON p.sku_id = ea.sku_id AND p.expiry_date = ea.expiry_date
      WHERE p.expiry_date IS NOT NULL
        AND p.expiry_date >= CURDATE()
        AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY p.expiry_date ASC
    `, [days]);
    res.json({ alert_window_days: days, count: alerts.length, alerts });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post("/check", async (req, res) => {
  try {
    const results = await runExpiryCheck();
    res.json({ triggered_at: new Date().toISOString(), count: results.length, alerts: results });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = { router, startExpiryJob };