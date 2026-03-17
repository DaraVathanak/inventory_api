require("dotenv").config();
const bcrypt = require("bcryptjs");
const { v4: uuid } = require("uuid");
const { connectDB, query } = require("./db");

const hash = (pw) => bcrypt.hashSync(pw, 10);
const daysFromNow = (d) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split("T")[0];
};

async function seed() {
  await connectDB();
  console.log("🌱  Seeding database…");

  // Clear in FK-safe order
  await query("SET FOREIGN_KEY_CHECKS = 0");
  for (const t of [
    "expiry_alert","feedback","shipment","payment",
    "order_item","`order`","customer","product",
    "warehouse","supplier","category","manager","report","admin",
  ]) {
    await query(`DELETE FROM ${t}`);
  }
  await query("SET FOREIGN_KEY_CHECKS = 1");

  // Admin
  const adminId = uuid();
  await query(
    "INSERT INTO admin (admin_id, username, password_hash, security_level) VALUES (?, ?, ?, ?)",
    [adminId, "admin", hash("admin123"), "super"]
  );

  // Manager
  await query(
    "INSERT INTO manager (manager_id, admin_id, username, password_hash, department, access_level) VALUES (?, ?, ?, ?, ?, ?)",
    [uuid(), adminId, "manager", hash("manager123"), "Operations", "full"]
  );

  // Categories
  const cats = {};
  for (const [name, desc] of [
    ["Electronics",     "Electronic components and devices"],
    ["Food",            "Perishable food products"],
    ["Pharmaceuticals", "Medicines and health products"],
    ["Clothing",        "Apparel and accessories"],
  ]) {
    const id = uuid();
    cats[name] = id;
    await query("INSERT INTO category (category_id, category_name, description) VALUES (?, ?, ?)", [id, name, desc]);
  }

  // Suppliers
  const sups = {};
  for (const [name, contact, cat] of [
    ["TechSource Ltd",  "Alice Wong",  "Electronics"],
    ["FreshFarm Co",    "Bob Carter",  "Food"],
    ["MediSupply Inc",  "Carol Smith", "Pharmaceuticals"],
    ["StyleWear Group", "David Lee",   "Clothing"],
  ]) {
    const id = uuid();
    sups[name] = id;
    await query(
      "INSERT INTO supplier (supplier_id, company_name, contact_person, category_type) VALUES (?, ?, ?, ?)",
      [id, name, contact, cat]
    );
  }

  // Warehouses
  const whs = {};
  for (const [name, addr, cap, used] of [
    ["Warehouse Alpha", "10 Industrial Ave, City A", 5000, 2100],
    ["Warehouse Beta",  "88 Logistics Rd, City B",   3000, 1800],
  ]) {
    const id = uuid();
    whs[name] = id;
    await query(
      "INSERT INTO warehouse (warehouse_id, location_name, address, capacity, used) VALUES (?, ?, ?, ?, ?)",
      [id, name, addr, cap, used]
    );
  }

  // Products
  for (const [sku, name, price, stock, reorder, sup, wh, cat, exp] of [
    ["SKU-ELEC-001", "Arduino Mega 2560",    45.99, 120, 20,  "TechSource Ltd",  "Warehouse Alpha", "Electronics",     null],
    ["SKU-ELEC-002", "Raspberry Pi 4 (4GB)", 75.00, 8,   15,  "TechSource Ltd",  "Warehouse Alpha", "Electronics",     null],
    ["SKU-FOOD-001", "Organic Wheat Flour",   3.50, 500, 100, "FreshFarm Co",    "Warehouse Beta",  "Food",            daysFromNow(10)],
    ["SKU-FOOD-002", "Premium Olive Oil",    12.99, 200,  50, "FreshFarm Co",    "Warehouse Beta",  "Food",            daysFromNow(25)],
    ["SKU-FOOD-003", "Long-Life Milk 1L",     1.80, 350,  80, "FreshFarm Co",    "Warehouse Beta",  "Food",            daysFromNow(5)],
    ["SKU-MED-001",  "Paracetamol 500mg",     8.25, 600, 100, "MediSupply Inc",  "Warehouse Alpha", "Pharmaceuticals", daysFromNow(20)],
    ["SKU-MED-002",  "Vitamin C 1000mg",     14.50,  12,  30, "MediSupply Inc",  "Warehouse Alpha", "Pharmaceuticals", daysFromNow(60)],
    ["SKU-CLO-001",  "Cotton T-Shirt L",     19.99, 300,  40, "StyleWear Group", "Warehouse Beta",  "Clothing",        null],
    ["SKU-CLO-002",  "Denim Jeans 32x32",    49.99,   5,  20, "StyleWear Group", "Warehouse Beta",  "Clothing",        null],
  ]) {
    await query(
      "INSERT INTO product (sku_id, name, unit_price, stock_quantity, reorder_point, supplier_id, warehouse_id, category_id, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [sku, name, price, stock, reorder, sups[sup], whs[wh], cats[cat], exp || null]
    );
  }

  // Customers
  const custs = {};
  for (const [name, contact, address] of [
    ["Emma Johnson",  "+1-555-0101", "1 Oak St, Springfield"],
    ["Liam Nguyen",   "+1-555-0202", "42 Maple Ave, Shelbyville"],
    ["Sara Al-Farsi", "+1-555-0303", "7 Pine Rd, Capital City"],
  ]) {
    const id = uuid();
    custs[name] = id;
    await query("INSERT INTO customer (customer_id, name, contact, address) VALUES (?, ?, ?, ?)", [id, name, contact, address]);
  }

  // Orders + items
  const orderIds = [];
  for (const [cid, total, status, items] of [
    [custs["Emma Johnson"],  91.98, "delivered",  [["SKU-ELEC-001", 2, 45.99]]],
    [custs["Liam Nguyen"],   12.99, "processing", [["SKU-FOOD-002", 1, 12.99]]],
    [custs["Sara Al-Farsi"], 49.99, "pending",    [["SKU-CLO-002",  1, 49.99]]],
  ]) {
    const oid = uuid();
    orderIds.push(oid);
    await query(
      "INSERT INTO `order` (order_id, customer_id, total_amount, status) VALUES (?, ?, ?, ?)",
      [oid, cid, total, status]
    );
    for (const [sku, qty, price] of items) {
      await query(
        "INSERT INTO order_item (order_id, sku_id, quantity, unit_price) VALUES (?, ?, ?, ?)",
        [oid, sku, qty, price]
      );
    }
  }

  // Payments
  await query(
    "INSERT INTO payment (payment_id, order_id, payment_method, transaction_status, amount) VALUES (?, ?, ?, ?, ?)",
    [uuid(), orderIds[0], "credit_card",   "completed", 91.98]
  );
  await query(
    "INSERT INTO payment (payment_id, order_id, payment_method, transaction_status, amount) VALUES (?, ?, ?, ?, ?)",
    [uuid(), orderIds[1], "bank_transfer", "pending",   12.99]
  );

  // Shipment
  await query(
    "INSERT INTO shipment (tracking_number, order_id, carrier, shipment_date, status) VALUES (?, ?, ?, ?, ?)",
    ["TRK-00001", orderIds[0], "FedEx", new Date().toISOString().split("T")[0], "delivered"]
  );

  // Feedback
  await query(
    "INSERT INTO feedback (feedback_id, order_id, customer_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
    [uuid(), orderIds[0], custs["Emma Johnson"], 5, "Fast delivery and great quality!"]
  );

  // Report
  await query(
    "INSERT INTO report (report_id, admin_id, date, summary, type) VALUES (?, ?, ?, ?, ?)",
    [uuid(), adminId, new Date().toISOString().split("T")[0], "March weekly summary: 3 orders, $154.96 revenue.", "weekly"]
  );

  console.log("\n✅  Seed complete.");
  console.log("   Admin   → username: admin    / password: admin123");
  console.log("   Manager → username: manager  / password: manager123\n");
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });