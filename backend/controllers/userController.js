const sql = require("../db");
const bcrypt = require("bcrypt");

// ==========================================
//   1. ADD USER (Your original code preserved)
// ==========================================
exports.addUser = async (req, res) => {
  const { username, password, role, employeeId } = req.body;

  if (!username || !password || !role || !employeeId) {
    return res.status(400).json({ error: "Please provide username, employeeId, password, and role." });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    // 🔥 Changed the table name here from AppUsers to Users
    await sql.query`
      INSERT INTO DisaUsersTable (username, password, role, employeeId)
      VALUES (${username}, ${hashedPassword}, ${role}, ${employeeId})
    `;

    res.status(201).json({ message: "User added successfully!" });
  } catch (error) {
    console.error("Error adding user:", error);

    // Error number 2627 in MSSQL means Unique Constraint Violation (Username exists)
    if (error.number === 2627) {
      return res.status(400).json({ error: "Username already exists!" });
    }

    res.status(500).json({ error: "Failed to add user to database." });
  }
};

// ==========================================
//   2. GET ALL USERS (For the Admin Table)
// ==========================================
exports.getUsers = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT id, username, role, employeeId 
      FROM DisaUsersTable 
      ORDER BY id ASC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users." });
  }
};

// ==========================================
//   3. UPDATE USER (Edit Button)
// ==========================================
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, role, employeeId } = req.body;

    if (!username || !role || !employeeId) {
      return res.status(400).json({ error: "Username, employeeId, and role are required." });
    }

    await sql.query`
      UPDATE DisaUsersTable 
      SET username = ${username}, role = ${role}, employeeId = ${employeeId} 
      WHERE id = ${id}
    `;

    res.status(200).json({ message: "User updated successfully!" });
  } catch (error) {
    console.error("Error updating user:", error);

    // Same protection as your Add User: Prevent renaming to an existing username
    if (error.number === 2627) {
      return res.status(400).json({ error: "Username already exists!" });
    }

    res.status(500).json({ error: "Failed to update user." });
  }
};

// ==========================================
//   4. DELETE USER (Trash Button)
// ==========================================
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await sql.query`
      DELETE FROM DisaUsersTable 
      WHERE id = ${id}
    `;

    res.status(200).json({ message: "User deleted successfully!" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user." });
  }
};