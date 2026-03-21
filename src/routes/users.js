const router  = require("express").Router();
const bcrypt  = require("bcryptjs");
const { v4: uuid } = require("uuid");
const { query } = require("../database/db");

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required." });
  }
  next();
}

// ── Combined list ─────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const admins = await query(
      "SELECT admin_id AS id, username, security_level, NULL AS department, NULL AS access_level, NULL AS position, NULL AS full_name, DATE_FORMAT(CONVERT_TZ(last_login, '+00:00', @@session.time_zone), '%Y-%m-%dT%H:%i:%s') AS last_login, 'admin' AS role FROM admin"
    );
    const managers = await query(
      "SELECT manager_id AS id, username, NULL AS security_level, department, access_level, NULL AS position, NULL AS full_name, DATE_FORMAT(CONVERT_TZ(last_login, '+00:00', @@session.time_zone), '%Y-%m-%dT%H:%i:%s') AS last_login, 'manager' AS role FROM manager"
    );
    const employees = await query(
      "SELECT employee_id AS id, username, NULL AS security_level, NULL AS department, NULL AS access_level, position, full_name, DATE_FORMAT(CONVERT_TZ(last_login, '+00:00', @@session.time_zone), '%Y-%m-%dT%H:%i:%s') AS last_login, 'employee' AS role FROM employee"
    ).catch(() => []);
    res.json([...admins, ...managers, ...employees]);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// ── Admins ────────────────────────────────────────────────────────────────────
router.get("/admins", requireAdmin, async (req, res) => {
  try {
    res.json(await query("SELECT admin_id, username, security_level, last_login, created_at FROM admin"));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post("/admins", requireAdmin, async (req, res) => {
  try {
    const { username, password, security_level = "standard" } = req.body;
    if (!username || !password) return res.status(400).json({ message: "username and password required." });
    const id = uuid();
    await query(
      "INSERT INTO admin (admin_id, username, password_hash, security_level) VALUES (?, ?, ?, ?)",
      [id, username, bcrypt.hashSync(password, 10), security_level]
    );
    const [row] = await query("SELECT admin_id, username, security_level FROM admin WHERE admin_id = ?", [id]);
    res.status(201).json(row);
  } catch (e) {
    res.status(e.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      message: e.code === "ER_DUP_ENTRY" ? "Username already exists." : e.message,
    });
  }
});

router.patch("/admins/:id", requireAdmin, async (req, res) => {
  try {
    const { security_level, password } = req.body;
    const sets = []; const params = [];
    if (security_level) { sets.push("security_level = ?"); params.push(security_level); }
    if (password)       { sets.push("password_hash = ?"); params.push(bcrypt.hashSync(password, 10)); }
    if (!sets.length) return res.status(400).json({ message: "Nothing to update." });
    params.push(req.params.id);
    await query(`UPDATE admin SET ${sets.join(", ")} WHERE admin_id = ?`, params);
    const [row] = await query("SELECT admin_id, username, security_level FROM admin WHERE admin_id = ?", [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete("/admins/:id", requireAdmin, async (req, res) => {
  await query("DELETE FROM admin WHERE admin_id = ?", [req.params.id]);
  res.status(204).end();
});

// ── Managers ──────────────────────────────────────────────────────────────────
router.get("/managers", async (req, res) => {
  try {
    res.json(await query(
      `SELECT m.manager_id, m.username, m.department, m.access_level, m.created_at,
              a.username AS admin_username
       FROM manager m LEFT JOIN admin a ON m.admin_id = a.admin_id`
    ));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post("/managers", requireAdmin, async (req, res) => {
  try {
    const { username, password, department, access_level = "read" } = req.body;
    if (!username || !password) return res.status(400).json({ message: "username and password required." });
    const id = uuid();
    await query(
      "INSERT INTO manager (manager_id, admin_id, username, password_hash, department, access_level) VALUES (?, ?, ?, ?, ?, ?)",
      [id, req.user.id, username, bcrypt.hashSync(password, 10), department || null, access_level]
    );
    const [row] = await query("SELECT manager_id, username, department, access_level FROM manager WHERE manager_id = ?", [id]);
    res.status(201).json(row);
  } catch (e) {
    res.status(e.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      message: e.code === "ER_DUP_ENTRY" ? "Username already exists." : e.message,
    });
  }
});

router.patch("/managers/:id", requireAdmin, async (req, res) => {
  try {
    const { department, access_level, password } = req.body;
    const sets = []; const params = [];
    if (department)   { sets.push("department = ?");    params.push(department); }
    if (access_level) { sets.push("access_level = ?");  params.push(access_level); }
    if (password)     { sets.push("password_hash = ?"); params.push(bcrypt.hashSync(password, 10)); }
    if (!sets.length) return res.status(400).json({ message: "Nothing to update." });
    params.push(req.params.id);
    await query(`UPDATE manager SET ${sets.join(", ")} WHERE manager_id = ?`, params);
    const [row] = await query("SELECT manager_id, username, department, access_level FROM manager WHERE manager_id = ?", [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete("/managers/:id", requireAdmin, async (req, res) => {
  await query("DELETE FROM manager WHERE manager_id = ?", [req.params.id]);
  res.status(204).end();
});

// ── Employees ─────────────────────────────────────────────────────────────────
router.get("/employees", async (req, res) => {
  try {
    res.json(await query(
      `SELECT e.employee_id, e.username, e.full_name, e.position, e.created_at,
              a.username AS admin_username
       FROM employee e LEFT JOIN admin a ON e.admin_id = a.admin_id`
    ));
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post("/employees", requireAdmin, async (req, res) => {
  try {
    const { username, password, full_name, position } = req.body;
    if (!username || !password) return res.status(400).json({ message: "username and password required." });
    const id = uuid();
    await query(
      "INSERT INTO employee (employee_id, admin_id, username, password_hash, full_name, position) VALUES (?, ?, ?, ?, ?, ?)",
      [id, req.user.id, username, bcrypt.hashSync(password, 10), full_name || null, position || null]
    );
    const [row] = await query("SELECT employee_id, username, full_name, position FROM employee WHERE employee_id = ?", [id]);
    res.status(201).json(row);
  } catch (e) {
    res.status(e.code === "ER_DUP_ENTRY" ? 409 : 500).json({
      message: e.code === "ER_DUP_ENTRY" ? "Username already exists." : e.message,
    });
  }
});

router.patch("/employees/:id", requireAdmin, async (req, res) => {
  try {
    const { full_name, position, password } = req.body;
    const sets = []; const params = [];
    if (full_name) { sets.push("full_name = ?"); params.push(full_name); }
    if (position)  { sets.push("position = ?");  params.push(position); }
    if (password)  { sets.push("password_hash = ?"); params.push(bcrypt.hashSync(password, 10)); }
    if (!sets.length) return res.status(400).json({ message: "Nothing to update." });
    params.push(req.params.id);
    await query(`UPDATE employee SET ${sets.join(", ")} WHERE employee_id = ?`, params);
    const [row] = await query("SELECT employee_id, username, full_name, position FROM employee WHERE employee_id = ?", [req.params.id]);
    res.json(row);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.delete("/employees/:id", requireAdmin, async (req, res) => {
  await query("DELETE FROM employee WHERE employee_id = ?", [req.params.id]);
  res.status(204).end();
});

module.exports = router;