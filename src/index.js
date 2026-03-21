require("dotenv").config();
const express = require("express");
const cors    = require("cors");
const path    = require("path");
const jwt     = require("jsonwebtoken");
const { connectDB } = require("./database/db");

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing or invalid Authorization header." });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Token expired or invalid." });
  }
}

const authRoutes     = require("./routes/auth");
const usersRoutes    = require("./routes/users");
const productsRoutes = require("./routes/products");
const ordersRoutes   = require("./routes/orders");
const { suppliers, warehouses, categories, customers,
        payments, shipments, feedback, reports } = require("./routes/resources");
const { router: expiryRouter, startExpiryJob } = require("./jobs/expiryAlert");
const restockLogRoutes = require("./routes/restock");

const app  = express();
const PORT = process.env.PORT || 3000;

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.use(cors());
app.use(express.json());

// Public
app.use("/api/v1/auth", authRoutes);

// Protected
app.use("/api/v1/users",         authenticate, usersRoutes);
app.use("/api/v1/products",      authenticate, productsRoutes);
app.use("/api/v1/orders",        authenticate, ordersRoutes);
app.use("/api/v1/suppliers",     authenticate, suppliers);
app.use("/api/v1/warehouses",    authenticate, warehouses);
app.use("/api/v1/categories",    authenticate, categories);
app.use("/api/v1/customers",     authenticate, customers);
app.use("/api/v1/payments",      authenticate, payments);
app.use("/api/v1/shipments",     authenticate, shipments);
app.use("/api/v1/feedback",      authenticate, feedback);
app.use("/api/v1/reports",       authenticate, reports);
app.use("/api/v1/expiry-alerts", authenticate, expiryRouter);
app.use("/api/v1/restock-log",   authenticate, restockLogRoutes);

app.get("/health", (req, res) =>
  res.json({ status: "ok", db: "mysql", timestamp: new Date().toISOString() })
);
app.use((req, res) =>
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found.` })
);
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error.", error: err.message });
});

async function start() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`\n🚀  Inventory API  →  http://localhost:${PORT}`);
    console.log(`   Base URL : http://localhost:${PORT}/api/v1`);
    console.log(`   Images   : http://localhost:${PORT}/uploads/<filename>\n`);
    startExpiryJob();
  });
}

start().catch((e) => { console.error(e); process.exit(1); });