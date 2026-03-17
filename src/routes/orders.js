const router = require("express").Router();
const { v4: uuid } = require("uuid");
const { query, getPool } = require("../database/db");

router.get("/", async (req, res) => {
  try {
    const where = req.query.status ? "WHERE o.status = ?" : "";
    const params = req.query.status ? [req.query.status] : [];
    const rows = await query(
      `SELECT o.*, c.name AS customer_name FROM \`order\` o
       LEFT JOIN customer c ON o.customer_id = c.customer_id
       ${where} ORDER BY o.order_date DESC`, params
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const [order] = await query(
      `SELECT o.*, c.name AS customer_name, c.contact, c.address
       FROM \`order\` o LEFT JOIN customer c ON o.customer_id = c.customer_id
       WHERE o.order_id = ?`, [req.params.id]
    );
    if (!order) return res.status(404).json({ message: "Order not found." });
    const items = await query(
      "SELECT oi.*, p.name AS product_name FROM order_item oi JOIN product p ON oi.sku_id = p.sku_id WHERE oi.order_id = ?",
      [req.params.id]
    );
    res.json({ ...order, items });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post("/", async (req, res) => {
  try {
    const { customer_id, items = [], status = "pending" } = req.body;
    if (!items.length) return res.status(400).json({ message: "items array is required." });
    const total_amount = items.reduce((s, i) => s + (i.unit_price ?? 0) * (i.quantity ?? 1), 0);
    const oid = uuid();
    const pool = await getPool();
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
      await conn.execute(
        "INSERT INTO `order` (order_id, customer_id, total_amount, status) VALUES (?, ?, ?, ?)",
        [oid, customer_id || null, total_amount, status]
      );
      for (const item of items) {
        await conn.execute(
          "INSERT INTO order_item (order_id, sku_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
          [oid, item.sku_id, item.quantity ?? 1, item.unit_price ?? 0]
        );
      }
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
    const [created] = await query("SELECT * FROM `order` WHERE order_id = ?", [oid]);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.patch("/:id", async (req, res) => {
  try {
    const { status, total_amount } = req.body;
    const sets = []; const params = [];
    if (status)             { sets.push("status = ?");       params.push(status); }
    if (total_amount!=null) { sets.push("total_amount = ?"); params.push(total_amount); }
    if (!sets.length) return res.status(400).json({ message: "Nothing to update." });
    params.push(req.params.id);
    await query(`UPDATE \`order\` SET ${sets.join(", ")} WHERE order_id = ?`, params);
    const [updated] = await query("SELECT * FROM `order` WHERE order_id = ?", [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete("/:id", async (req, res) => {
  await query("DELETE FROM `order` WHERE order_id = ?", [req.params.id]);
  res.status(204).end();
});

module.exports = router;