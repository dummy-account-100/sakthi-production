const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const sql = require("../db"); // Adjust path based on your folder structure

router.post("/login", async (req, res) => {
  const { employeeId, password } = req.body;

  if (!employeeId || !password) {
    return res.status(400).json({ error: "Employee ID and password are required." });
  }

  try {
    const result = await sql.query`SELECT * FROM DisaUsersTable WHERE employeeId = ${employeeId}`;
    const user = result.recordset[0];

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // 🔥 THE FIX: Trim invisible spaces added by SQL Server
    const dbPasswordHash = user.password.trim(); 
    
    // Compare the typed password with the cleaned-up hash
    const isMatch = await bcrypt.compare(password, dbPasswordHash);

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, employeeId: user.employeeId },
      process.env.JWT_SECRET || "fallback_secret_key_change_me",
      { expiresIn: "1d" }
    );

    res.status(200).json({
      id: user.id,
      username: user.username,
      employeeId: user.employeeId,
      role: user.role,
      token: token
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
module.exports = router;