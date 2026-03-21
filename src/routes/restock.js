const router = require("express").Router();
const { query } = require("../database/db");

// GET /api/v1/restock-log
router.get("/", async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit || "100", 10);
    const sku_id = req.query.sku_id || null;

    let rows;
    if (sku_id) {
      rows = await query(`
        SELECT r.*, c.category_name, p.image_url
        FROM restock_log r
        LEFT JOIN product p  ON r.sku_id = p.sku_id
        LEFT JOIN category c ON p.category_id = c.category_id
        WHERE r.sku_id = ?
        ORDER BY r.restocked_at DESC
        LIMIT ${limit}
      `, [sku_id]);
    } else {
      rows = await query(`
        SELECT r.*, c.category_name, p.image_url
        FROM restock_log r
        LEFT JOIN product p  ON r.sku_id = p.sku_id
        LEFT JOIN category c ON p.category_id = c.category_id
        ORDER BY r.restocked_at DESC
        LIMIT ${limit}
      `);
    }

    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST /api/v1/restock-log
router.post("/", async (req, res) => {
  try {
    const { sku_id, product_name, quantity_added,
            stock_before, stock_after, note } = req.body;

    if (!sku_id || !quantity_added || stock_before == null || stock_after == null)
      return res.status(400).json({ message: "sku_id, quantity_added, stock_before, stock_after are required." });

    const restocked_by = req.user?.username ?? "unknown";

    await query(`
      INSERT INTO restock_log
        (sku_id, product_name, quantity_added, stock_before, stock_after, restocked_by, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [sku_id, product_name, quantity_added, stock_before, stock_after, restocked_by, note || null]);

    const [row] = await query("SELECT * FROM restock_log ORDER BY id DESC LIMIT 1");
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/v1/restock-log — clear all history (admin only)
router.delete("/", async (req, res) => {
  try {
    await query("DELETE FROM restock_log");
    res.status(204).end();
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/v1/restock-log/:id — delete single record
router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM restock_log WHERE id = ?", [req.params.id]);
    res.status(204).end();
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;

// DELETE /api/v1/restock-log — clear all history
router.delete("/", async (req, res) => {
  try {
    await query("DELETE FROM restock_log");
    res.status(204).end();
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// DELETE /api/v1/restock-log/:id — delete single record
router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM restock_log WHERE id = ?", [req.params.id]);
    res.status(204).end();
  } catch (e) { res.status(500).json({ message: e.message }); }
});