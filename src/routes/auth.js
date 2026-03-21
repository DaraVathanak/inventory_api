const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { query } = require("../database/db");

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ message: "username and password are required." });

    let user = null;
    let role = null;
    let idCol = null;
    let table = null;

    // Try admin
    const [admin] = await query(
      "SELECT *, DATE_FORMAT(CONVERT_TZ(last_login, '+00:00', @@session.time_zone), '%Y-%m-%dT%H:%i:%s') AS last_login FROM admin WHERE username = ?",
      [username]
    );
    if (admin) { user = admin; role = "admin"; idCol = "admin_id"; table = "admin"; }

    // Try manager
    if (!user) {
      const [manager] = await query(
        "SELECT *, DATE_FORMAT(CONVERT_TZ(last_login, '+00:00', @@session.time_zone), '%Y-%m-%dT%H:%i:%s') AS last_login FROM manager WHERE username = ?",
        [username]
      );
      if (manager) { user = manager; role = "manager"; idCol = "manager_id"; table = "manager"; }
    }

    // Try employee
    if (!user) {
      const rows = await query(
        "SELECT *, DATE_FORMAT(CONVERT_TZ(last_login, '+00:00', @@session.time_zone), '%Y-%m-%dT%H:%i:%s') AS last_login FROM employee WHERE username = ?",
        [username]
      ).catch(() => []);
      if (rows[0]) { user = rows[0]; role = "employee"; idCol = "employee_id"; table = "employee"; }
    }

    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ message: "Invalid username or password." });

    const id = user[idCol];
    const now = new Date().toISOString();

    // Update last_login for all roles
    await query(`UPDATE ${table} SET last_login = NOW() WHERE ${idCol} = ?`, [id]);
    user.last_login = now;

    const token = jwt.sign({ id, username: user.username, role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });

    const { password_hash, ...safe } = user;
    return res.json({ token, user: { ...safe, id, role } });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.post("/logout", (req, res) => res.status(204).end());

module.exports = router;