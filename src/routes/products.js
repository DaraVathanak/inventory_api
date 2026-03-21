const router  = require("express").Router();
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");
const { v4: uuid } = require("uuid");
const { query } = require("../database/db");

// ── Image upload setup ────────────────────────────────────────────────────────
const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
  },
});

// ── Routes ────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const days  = parseInt(process.env.EXPIRY_ALERT_DAYS || "30", 10);
    const where = []; const params = [];

    if (req.query.expiring === "true") {
      where.push(`p.expiry_date IS NOT NULL AND p.expiry_date >= CURDATE()
        AND p.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)`);
      params.push(days);
    }
    if (req.query.low_stock === "true") where.push("p.stock_quantity <= p.reorder_point");
    if (req.query.category_id) { where.push("p.category_id = ?"); params.push(req.query.category_id); }
    if (req.query.search) {
      where.push("(p.name LIKE ? OR p.sku_id LIKE ?)");
      params.push(`%${req.query.search}%`, `%${req.query.search}%`);
    }

    const whereClause = where.length ? "WHERE " + where.join(" AND ") : "";
    const rows = await query(`
      SELECT p.*,
             DATEDIFF(p.expiry_date, CURDATE()) AS days_left,
             s.company_name  AS supplier_name,
             w.location_name AS warehouse_name,
             c.category_name
      FROM product p
      LEFT JOIN supplier s  ON p.supplier_id  = s.supplier_id
      LEFT JOIN warehouse w ON p.warehouse_id = w.warehouse_id
      LEFT JOIN category c  ON p.category_id  = c.category_id
      ${whereClause} ORDER BY p.name
    `, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const [row] = await query(`
      SELECT p.*, DATEDIFF(p.expiry_date, CURDATE()) AS days_left,
             s.company_name AS supplier_name, w.location_name AS warehouse_name, c.category_name
      FROM product p
      LEFT JOIN supplier s  ON p.supplier_id  = s.supplier_id
      LEFT JOIN warehouse w ON p.warehouse_id = w.warehouse_id
      LEFT JOIN category c  ON p.category_id  = c.category_id
      WHERE p.sku_id = ?
    `, [req.params.id]);
    if (!row) return res.status(404).json({ message: "Product not found." });
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// POST with optional image upload
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const { name, supplier_id, warehouse_id, category_id, expiry_date, description } = req.body;
    const unit_price     = Math.max(0, Number(req.body.unit_price     ?? 0));
    const stock_quantity = Math.max(0, Math.floor(Number(req.body.stock_quantity ?? 0)));
    const reorder_point  = Math.max(0, Math.floor(Number(req.body.reorder_point  ?? 0)));
    if (!name) return res.status(400).json({ message: "name is required." });

    const sku_id    = `SKU-${uuid().slice(0,8).toUpperCase()}`;
    const image_url = req.file
      ? `/uploads/${req.file.filename}`
      : null;

    await query(`INSERT INTO product
      (sku_id, name, unit_price, stock_quantity, reorder_point,
       supplier_id, warehouse_id, category_id, expiry_date, image_url, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku_id, name, unit_price, stock_quantity, reorder_point,
       supplier_id||null, warehouse_id||null, category_id||null,
       expiry_date||null, image_url, description||null]
    );
    const [created] = await query("SELECT * FROM product WHERE sku_id = ?", [sku_id]);
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// PATCH — supports both JSON (no image) and multipart (with image)
router.patch("/:id", (req, res, next) => {
  const ct = req.headers["content-type"] || "";
  if (ct.includes("multipart/form-data")) {
    upload.single("image")(req, res, next);
  } else {
    next(); // JSON body already parsed by express.json()
  }
}, async (req, res) => {
  try {
    const allowed = ["name","unit_price","stock_quantity","reorder_point",
                     "supplier_id","warehouse_id","category_id","expiry_date","description"];

    // req.body works for both JSON and multipart
    const fields = allowed.filter(k => k in req.body);
    const values = fields.map(f => {
      const v = req.body[f];
      // Clamp numeric fields to >= 0
      if (["unit_price","stock_quantity","reorder_point"].includes(f)) {
        return Math.max(0, Number(v));
      }
      return v;
    });

    if (req.file) {
      fields.push("image_url");
      values.push(`/uploads/${req.file.filename}`);
    }

    if (!fields.length && !req.file) {
      return res.status(400).json({ message: "No fields to update." });
    }

    values.push(req.params.id);
    await query(
      `UPDATE product SET ${fields.map(f => `${f}=?`).join(",")} WHERE sku_id=?`,
      values
    );

    const [updated] = await query(`
      SELECT p.*, DATEDIFF(p.expiry_date, CURDATE()) AS days_left,
             s.company_name AS supplier_name, w.location_name AS warehouse_name, c.category_name
      FROM product p
      LEFT JOIN supplier s  ON p.supplier_id  = s.supplier_id
      LEFT JOIN warehouse w ON p.warehouse_id = w.warehouse_id
      LEFT JOIN category c  ON p.category_id  = c.category_id
      WHERE p.sku_id = ?
    `, [req.params.id]);

    if (!updated) return res.status(404).json({ message: "Product not found." });
    res.json(updated);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete("/:id", async (req, res) => {
  try {
    // Delete image file if exists
    const [row] = await query("SELECT image_url FROM product WHERE sku_id = ?", [req.params.id]);
    if (row?.image_url) {
      const filePath = path.join(__dirname, "../../", row.image_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await query("DELETE FROM product WHERE sku_id = ?", [req.params.id]);
    res.status(204).end();
  } catch (e) { res.status(500).json({ message: e.message }); }
});

module.exports = router;