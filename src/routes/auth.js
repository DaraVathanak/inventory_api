const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { query } = require("../database/db");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "username and password are required." });

    // Try admin → manager → employee
    let user = null;
    let role = null;

    const [admin] = await query("SELECT *, 'admin' AS role FROM admin WHERE username = ?", [username]);
    if (admin) { user = admin; role = "admin"; }

    if (!user) {
      const [manager] = await query("SELECT *, 'manager' AS role FROM manager WHERE username = ?", [username]);
      if (manager) { user = manager; role = "manager"; }
    }

    if (!user) {
      const [employee] = await query("SELECT *, 'employee' AS role FROM employee WHERE username = ?", [username]).catch(() => [[]]);
      if (employee) { user = employee; role = "employee"; }
    }

    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ message: "Invalid username or password." });

    const id = user.admin_id || user.manager_id || user.employee_id;

    if (role === "admin") {
      await query("UPDATE admin SET last_login = NOW() WHERE admin_id = ?", [id]);
    }

    const token = jwt.sign({ id, username: user.username, role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    const { password_hash, ...safe } = user;
    return res.json({ token, user: { ...safe, id, role } });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post("/logout", (req, res) => res.status(204).end());

module.exports = router;