const sql = require("../db");

// 1. GET ALL DELAYS
exports.getAllDelays = async (req, res) => {
  try {
    const result = await sql.query`
      SELECT id, reasonName, createdAt 
      FROM DelaysReason 
      ORDER BY id ASC
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching delays:", error);
    res.status(500).json({ error: "Failed to fetch delays" });
  }
};

// 2. ADD DELAY
exports.addDelay = async (req, res) => {
  const { reasonName } = req.body;

  if (!reasonName) {
    return res.status(400).json({ error: "Reason name is required." });
  }

  try {
    await sql.query`
      INSERT INTO DelaysReason (reasonName, createdAt) 
      VALUES (${reasonName}, GETDATE())
    `;
    res.status(201).json({ message: "Delay reason added successfully!" });
  } catch (error) {
    console.error("Error adding delay:", error);
    res.status(500).json({ error: "Failed to add delay reason" });
  }
};

// 3. UPDATE DELAY
exports.updateDelay = async (req, res) => {
  const { id } = req.params;
  const { reasonName } = req.body;

  if (!reasonName) {
    return res.status(400).json({ error: "Reason name is required." });
  }

  try {
    await sql.query`
      UPDATE DelaysReason 
      SET reasonName = ${reasonName} 
      WHERE id = ${id}
    `;
    res.status(200).json({ message: "Delay reason updated successfully!" });
  } catch (error) {
    console.error("Error updating delay:", error);
    res.status(500).json({ error: "Failed to update delay reason" });
  }
};

// 4. DELETE DELAY
exports.deleteDelay = async (req, res) => {
  const { id } = req.params;

  try {
    await sql.query`DELETE FROM DelaysReason WHERE id = ${id}`;
    res.status(200).json({ message: "Delay reason deleted successfully!" });
  } catch (error) {
    console.error("Error deleting delay:", error);
    res.status(500).json({ error: "Failed to delete delay reason" });
  }
};