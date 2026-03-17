const express = require("express");
const { v4: uuid } = require("uuid");
const { query, getPool } = require("../database/db");

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

// ── Suppliers ─────────────────────────────────────────────────────────────────
const suppliers = express.Router();
suppliers.get("/", async (req, res) => {
  try { res.json(await query("SELECT * FROM supplier ORDER BY company_name")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
suppliers.get("/:id", async (req, res) => {
  try {
    const [row] = await query("SELECT * FROM supplier WHERE supplier_id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ message: "Supplier not found." });
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
suppliers.post("/", async (req, res) => {
  try {
    const { company_name, contact_person, email, phone, category_type, status = "active" } = req.body;
    if (!company_name) return res.status(400).json({ message: "company_name is required." });
    const id = uuid();
    await query("INSERT INTO supplier (supplier_id, company_name, contact_person, email, phone, category_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, company_name, contact_person||null, email||null, phone||null, category_type||null, status]);
    const [row] = await query("SELECT * FROM supplier WHERE supplier_id = ?", [id]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
suppliers.patch("/:id", async (req, res) => {
  try {
    const allowed = ["company_name","contact_person","email","phone","category_type","status"];
    const fields = allowed.filter(k => k in req.body);
    if (fields.length) await query(
      `UPDATE supplier SET ${fields.map(f=>`${f}=?`).join(",")} WHERE supplier_id=?`,
      [...fields.map(f=>req.body[f]), req.params.id]
    );
    const [row] = await query("SELECT * FROM supplier WHERE supplier_id = ?", [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
suppliers.delete("/:id", async (req, res) => {
  await query("DELETE FROM supplier WHERE supplier_id = ?", [req.params.id]);
  res.status(204).end();
});

// ── Warehouses ────────────────────────────────────────────────────────────────
const warehouses = express.Router();
warehouses.get("/", async (req, res) => {
  try { res.json(await query("SELECT * FROM warehouse ORDER BY location_name")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
warehouses.get("/:id", async (req, res) => {
  try {
    const [row] = await query("SELECT * FROM warehouse WHERE warehouse_id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ message: "Warehouse not found." });
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
warehouses.post("/", async (req, res) => {
  try {
    const { location_name, address, capacity=0, used=0, manager } = req.body;
    if (!location_name) return res.status(400).json({ message: "location_name is required." });
    const id = uuid();
    await query("INSERT INTO warehouse (warehouse_id, location_name, address, capacity, used, manager) VALUES (?, ?, ?, ?, ?, ?)",
      [id, location_name, address||null, capacity, used, manager||null]);
    const [row] = await query("SELECT * FROM warehouse WHERE warehouse_id = ?", [id]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
warehouses.patch("/:id", async (req, res) => {
  try {
    const allowed = ["location_name","address","capacity","used","manager"];
    const fields = allowed.filter(k => k in req.body);
    if (fields.length) await query(
      `UPDATE warehouse SET ${fields.map(f=>`${f}=?`).join(",")} WHERE warehouse_id=?`,
      [...fields.map(f=>req.body[f]), req.params.id]
    );
    const [row] = await query("SELECT * FROM warehouse WHERE warehouse_id = ?", [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
warehouses.delete("/:id", async (req, res) => {
  await query("DELETE FROM warehouse WHERE warehouse_id = ?", [req.params.id]);
  res.status(204).end();
});

// ── Categories ────────────────────────────────────────────────────────────────
const categories = express.Router();
categories.get("/", async (req, res) => {
  try { res.json(await query("SELECT * FROM category ORDER BY category_name")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
categories.post("/", async (req, res) => {
  try {
    const { category_name, description } = req.body;
    if (!category_name) return res.status(400).json({ message: "category_name is required." });
    const id = uuid();
    await query("INSERT INTO category (category_id, category_name, description) VALUES (?, ?, ?)",
      [id, category_name, description||null]);
    const [row] = await query("SELECT * FROM category WHERE category_id = ?", [id]);
    res.status(201).json(row);
  } catch (e) { res.status(e.code==="ER_DUP_ENTRY"?409:500).json({ message: e.message }); }
});
categories.patch("/:id", async (req, res) => {
  try {
    const { category_name, description } = req.body;
    const fields = []; const vals = [];
    if (category_name) { fields.push("category_name=?"); vals.push(category_name); }
    if (description !== undefined) { fields.push("description=?"); vals.push(description); }
    if (fields.length) await query(`UPDATE category SET ${fields.join(",")} WHERE category_id=?`, [...vals, req.params.id]);
    const [row] = await query("SELECT * FROM category WHERE category_id = ?", [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
categories.delete("/:id", async (req, res) => {
  await query("DELETE FROM category WHERE category_id = ?", [req.params.id]);
  res.status(204).end();
});

// ── Customers ─────────────────────────────────────────────────────────────────
const customers = express.Router();
customers.get("/", async (req, res) => {
  try { res.json(await query("SELECT * FROM customer ORDER BY name")); }
  catch (e) { res.status(500).json({ message: e.message }); }
});
customers.get("/:id", async (req, res) => {
  try {
    const [row] = await query("SELECT * FROM customer WHERE customer_id = ?", [req.params.id]);
    if (!row) return res.status(404).json({ message: "Customer not found." });
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
customers.post("/", async (req, res) => {
  try {
    const { name, contact, address } = req.body;
    if (!name) return res.status(400).json({ message: "name is required." });
    const id = uuid();
    await query("INSERT INTO customer (customer_id, name, contact, address) VALUES (?, ?, ?, ?)",
      [id, name, contact||null, address||null]);
    const [row] = await query("SELECT * FROM customer WHERE customer_id = ?", [id]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
customers.patch("/:id", async (req, res) => {
  try {
    const allowed = ["name","contact","address"];
    const fields = allowed.filter(k => k in req.body);
    if (fields.length) await query(
      `UPDATE customer SET ${fields.map(f=>`${f}=?`).join(",")} WHERE customer_id=?`,
      [...fields.map(f=>req.body[f]), req.params.id]
    );
    const [row] = await query("SELECT * FROM customer WHERE customer_id = ?", [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
customers.delete("/:id", async (req, res) => {
  await query("DELETE FROM customer WHERE customer_id = ?", [req.params.id]);
  res.status(204).end();
});

// ── Payments ──────────────────────────────────────────────────────────────────
const payments = express.Router();
payments.get("/", async (req, res) => {
  try {
    const filter = req.query.order_id ? "WHERE order_id = ?" : "";
    const params = req.query.order_id ? [req.query.order_id] : [];
    res.json(await query(`SELECT * FROM payment ${filter} ORDER BY created_at DESC`, params));
  } catch (e) { res.status(500).json({ message: e.message }); }
});
payments.post("/", async (req, res) => {
  try {
    const { order_id, payment_method, transaction_status="pending", amount } = req.body;
    if (!order_id||!payment_method||amount==null)
      return res.status(400).json({ message: "order_id, payment_method, and amount required." });
    const id = uuid();
    await query("INSERT INTO payment (payment_id, order_id, payment_method, transaction_status, amount) VALUES (?, ?, ?, ?, ?)",
      [id, order_id, payment_method, transaction_status, amount]);
    const [row] = await query("SELECT * FROM payment WHERE payment_id = ?", [id]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
payments.patch("/:id", async (req, res) => {
  try {
    const { transaction_status } = req.body;
    if (!transaction_status) return res.status(400).json({ message: "transaction_status required." });
    await query("UPDATE payment SET transaction_status=? WHERE payment_id=?", [transaction_status, req.params.id]);
    const [row] = await query("SELECT * FROM payment WHERE payment_id = ?", [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Shipments ─────────────────────────────────────────────────────────────────
const shipments = express.Router();
shipments.get("/", async (req, res) => {
  try { res.json(await query(
    "SELECT s.*, o.status AS order_status FROM shipment s LEFT JOIN `order` o ON s.order_id=o.order_id ORDER BY s.shipment_date DESC"
  )); } catch (e) { res.status(500).json({ message: e.message }); }
});
shipments.post("/", async (req, res) => {
  try {
    const { order_id, carrier, shipment_date, status="pending" } = req.body;
    if (!order_id) return res.status(400).json({ message: "order_id required." });
    const tn = `TRK-${uuid().slice(0,8).toUpperCase()}`;
    await query("INSERT INTO shipment (tracking_number, order_id, carrier, shipment_date, status) VALUES (?, ?, ?, ?, ?)",
      [tn, order_id, carrier||null, shipment_date||null, status]);
    const [row] = await query("SELECT * FROM shipment WHERE tracking_number = ?", [tn]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
shipments.patch("/:tracking", async (req, res) => {
  try {
    const allowed = ["status","carrier","shipment_date"];
    const fields = allowed.filter(k => k in req.body);
    if (fields.length) await query(
      `UPDATE shipment SET ${fields.map(f=>`${f}=?`).join(",")} WHERE tracking_number=?`,
      [...fields.map(f=>req.body[f]), req.params.tracking]
    );
    const [row] = await query("SELECT * FROM shipment WHERE tracking_number = ?", [req.params.tracking]);
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Feedback ──────────────────────────────────────────────────────────────────
const feedback = express.Router();
feedback.get("/", async (req, res) => {
  try { res.json(await query(
    "SELECT f.*, c.name AS customer_name FROM feedback f LEFT JOIN customer c ON f.customer_id=c.customer_id ORDER BY f.timestamp DESC"
  )); } catch (e) { res.status(500).json({ message: e.message }); }
});
feedback.post("/", async (req, res) => {
  try {
    const { order_id, customer_id, rating, comment } = req.body;
    if (!rating||rating<1||rating>5) return res.status(400).json({ message: "rating must be 1-5." });
    const id = uuid();
    await query("INSERT INTO feedback (feedback_id, order_id, customer_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
      [id, order_id||null, customer_id||null, rating, comment||null]);
    const [row] = await query("SELECT * FROM feedback WHERE feedback_id = ?", [id]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
feedback.delete("/:id", async (req, res) => {
  await query("DELETE FROM feedback WHERE feedback_id = ?", [req.params.id]);
  res.status(204).end();
});

// ── Reports ───────────────────────────────────────────────────────────────────
const reports = express.Router();
reports.get("/", async (req, res) => {
  try {
    const where = req.query.type ? "WHERE r.type=?" : "";
    const params = req.query.type ? [req.query.type] : [];
    res.json(await query(
      `SELECT r.*, a.username AS admin_username FROM report r LEFT JOIN admin a ON r.admin_id=a.admin_id ${where} ORDER BY r.date DESC`,
      params
    ));
  } catch (e) { res.status(500).json({ message: e.message }); }
});
reports.get("/:id", async (req, res) => {
  try {
    const [row] = await query(
      "SELECT r.*, a.username AS admin_username FROM report r LEFT JOIN admin a ON r.admin_id=a.admin_id WHERE r.report_id=?",
      [req.params.id]
    );
    if (!row) return res.status(404).json({ message: "Report not found." });
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
reports.post("/", requireAdmin, async (req, res) => {
  try {
    const { date, summary, type } = req.body;
    if (!type||!["weekly","monthly","custom"].includes(type))
      return res.status(400).json({ message: "type must be weekly, monthly, or custom." });
    const id = uuid();
    await query("INSERT INTO report (report_id, admin_id, date, summary, type) VALUES (?, ?, ?, ?, ?)",
      [id, req.user.id, date||new Date().toISOString().split("T")[0], summary||null, type]);
    const [row] = await query("SELECT * FROM report WHERE report_id = ?", [id]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});
reports.delete("/:id", requireAdmin, async (req, res) => {
  await query("DELETE FROM report WHERE report_id = ?", [req.params.id]);
  res.status(204).end();
});

module.exports = { suppliers, warehouses, categories, customers, payments, shipments, feedback, reports };