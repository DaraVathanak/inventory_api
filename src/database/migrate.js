require("dotenv").config();
const { connectDB, query } = require("./db");

async function migrate() {
  await connectDB();
  console.log("🔧  Running migrations…");

  await query(`CREATE TABLE IF NOT EXISTS admin (
    admin_id       VARCHAR(36)  NOT NULL PRIMARY KEY,
    username       VARCHAR(100) NOT NULL UNIQUE,
    password_hash  VARCHAR(255) NOT NULL,
    security_level VARCHAR(50)  NOT NULL DEFAULT 'standard',
    last_login     DATETIME,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);

  await query(`CREATE TABLE IF NOT EXISTS manager (
    manager_id    VARCHAR(36)  NOT NULL PRIMARY KEY,
    admin_id      VARCHAR(36)  NOT NULL,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    department    VARCHAR(100),
    access_level  VARCHAR(50)  NOT NULL DEFAULT 'read',
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin(admin_id) ON DELETE CASCADE
  )`);

  await query(`CREATE TABLE IF NOT EXISTS category (
    category_id   VARCHAR(36)  NOT NULL PRIMARY KEY,
    category_name VARCHAR(100) NOT NULL UNIQUE,
    description   VARCHAR(500),
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await query(`CREATE TABLE IF NOT EXISTS supplier (
    supplier_id    VARCHAR(36)  NOT NULL PRIMARY KEY,
    company_name   VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    email          VARCHAR(150),
    phone          VARCHAR(50),
    category_type  VARCHAR(100),
    status         ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await query(`CREATE TABLE IF NOT EXISTS warehouse (
    warehouse_id  VARCHAR(36)  NOT NULL PRIMARY KEY,
    location_name VARCHAR(200) NOT NULL,
    address       VARCHAR(300),
    capacity      INT          NOT NULL DEFAULT 0,
    used          INT          NOT NULL DEFAULT 0,
    manager       VARCHAR(100),
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await query(`CREATE TABLE IF NOT EXISTS product (
    sku_id         VARCHAR(50)    NOT NULL PRIMARY KEY,
    name           VARCHAR(200)   NOT NULL,
    unit_price     DECIMAL(10,2)  NOT NULL DEFAULT 0,
    stock_quantity INT            NOT NULL DEFAULT 0,
    reorder_point  INT            NOT NULL DEFAULT 0,
    supplier_id    VARCHAR(36),
    warehouse_id   VARCHAR(36),
    category_id    VARCHAR(36),
    expiry_date    DATE,
    image_url      VARCHAR(500),
    description    TEXT,
    created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id)  REFERENCES supplier(supplier_id)  ON DELETE SET NULL,
    FOREIGN KEY (warehouse_id) REFERENCES warehouse(warehouse_id) ON DELETE SET NULL,
    FOREIGN KEY (category_id)  REFERENCES category(category_id)  ON DELETE SET NULL
  )`);

  await query(`CREATE TABLE IF NOT EXISTS customer (
    customer_id VARCHAR(36)  NOT NULL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    contact     VARCHAR(100),
    address     VARCHAR(300),
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  await query(`CREATE TABLE IF NOT EXISTS \`order\` (
    order_id     VARCHAR(36)   NOT NULL PRIMARY KEY,
    customer_id  VARCHAR(36),
    order_date   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status       ENUM('pending','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
    notes        TEXT,
    created_at   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE SET NULL
  )`);

  await query(`CREATE TABLE IF NOT EXISTS order_item (
    id         INT           NOT NULL PRIMARY KEY AUTO_INCREMENT,
    order_id   VARCHAR(36)   NOT NULL,
    sku_id     VARCHAR(50)   NOT NULL,
    quantity   INT           NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES \`order\`(order_id) ON DELETE CASCADE,
    FOREIGN KEY (sku_id)   REFERENCES product(sku_id)     ON DELETE CASCADE
  )`);

  await query(`CREATE TABLE IF NOT EXISTS payment (
    payment_id         VARCHAR(36)   NOT NULL PRIMARY KEY,
    order_id           VARCHAR(36)   NOT NULL,
    payment_method     VARCHAR(50)   NOT NULL,
    transaction_status ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
    amount             DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES \`order\`(order_id) ON DELETE CASCADE
  )`);

  await query(`CREATE TABLE IF NOT EXISTS shipment (
    tracking_number VARCHAR(50)  NOT NULL PRIMARY KEY,
    order_id        VARCHAR(36)  NOT NULL,
    carrier         VARCHAR(100),
    shipment_date   DATE,
    status          ENUM('pending','in_transit','delivered','returned') NOT NULL DEFAULT 'pending',
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES \`order\`(order_id) ON DELETE CASCADE
  )`);

  await query(`CREATE TABLE IF NOT EXISTS feedback (
    feedback_id VARCHAR(36) NOT NULL PRIMARY KEY,
    order_id    VARCHAR(36),
    customer_id VARCHAR(36),
    rating      INT         NOT NULL,
    comment     TEXT,
    timestamp   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)    REFERENCES \`order\`(order_id)   ON DELETE SET NULL,
    FOREIGN KEY (customer_id) REFERENCES customer(customer_id) ON DELETE SET NULL
  )`);

  await query(`CREATE TABLE IF NOT EXISTS report (
    report_id  VARCHAR(36) NOT NULL PRIMARY KEY,
    admin_id   VARCHAR(36) NOT NULL,
    date       DATE        NOT NULL,
    summary    TEXT,
    type       ENUM('weekly','monthly','custom') NOT NULL,
    created_at DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin(admin_id) ON DELETE CASCADE
  )`);

  await query(`CREATE TABLE IF NOT EXISTS employee (
    employee_id   VARCHAR(36)  NOT NULL PRIMARY KEY,
    admin_id      VARCHAR(36)  NOT NULL,
    username      VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(200),
    position      VARCHAR(100),
    created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admin(admin_id) ON DELETE CASCADE
  )`);

  await query(`CREATE TABLE IF NOT EXISTS expiry_alert (
    id          INT         NOT NULL PRIMARY KEY AUTO_INCREMENT,
    sku_id      VARCHAR(50) NOT NULL,
    expiry_date DATE        NOT NULL,
    days_left   INT         NOT NULL,
    alerted_at  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_expiry (sku_id, expiry_date),
    FOREIGN KEY (sku_id) REFERENCES product(sku_id) ON DELETE CASCADE
  )`);

  // Safe column additions for existing tables
  const addCols = [
    ["ALTER TABLE product ADD COLUMN image_url VARCHAR(500)"],
    ["ALTER TABLE product ADD COLUMN description TEXT"],
    ["ALTER TABLE supplier ADD COLUMN email VARCHAR(150)"],
    ["ALTER TABLE supplier ADD COLUMN phone VARCHAR(50)"],
    ["ALTER TABLE warehouse ADD COLUMN manager VARCHAR(100)"],
    ["ALTER TABLE `order` ADD COLUMN notes TEXT"],
  ];
  for (const [sql] of addCols) {
    await query(sql).catch(() => {}); // ignore "column already exists"
  }

  console.log("✅  Migration complete — all tables ready.");
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });
// Note: run separately to add employee table