const sql = require('../db');

exports.getChecklistDetails = async (req, res) => {
  try {
    const { date, disaMachine } = req.query;

    // 🔥 FIX: Added "OR M.IsDeleted IS NULL" for safety
    const checklistResult = await sql.query`
      SELECT 
          M.MasterId, M.SlNo, M.CheckPointDesc, 
          ISNULL(T.IsDone, 0) as IsDone, ISNULL(T.IsNA, 0) as IsNA, 
          ISNULL(T.IsHoliday, 0) as IsHoliday, ISNULL(T.IsVatCleaning, 0) as IsVatCleaning,
          ISNULL(T.IsPreventiveMaintenance, 0) as IsPreventiveMaintenance,
          T.[Sign] as SupervisorName, T.SupervisorSignature, T.AssignedHOF, T.HOFSignature
      FROM BottomLevelAudit_Master M
      LEFT JOIN BottomLevelAudit_Trans T 
          ON M.MasterId = T.MasterId AND T.LogDate = ${date} AND T.DisaMachine = ${disaMachine}
      WHERE M.IsDeleted = 0 OR M.IsDeleted IS NULL
      ORDER BY M.SlNo ASC
    `;

    const supervisorsResult = await sql.query`SELECT username as OperatorName FROM dbo.DisaUsersTable WHERE role = 'supervisor' ORDER BY username`;
    const hofResult = await sql.query`SELECT username as OperatorName FROM dbo.DisaUsersTable WHERE role = 'hof' ORDER BY username`;

    const reportsResult = await sql.query`
      SELECT * FROM dbo.BottomLevelAudit_NCR 
      WHERE ReportDate = ${date} AND DisaMachine = ${disaMachine}
    `;

    res.json({ checklist: checklistResult.recordset, supervisors: supervisorsResult.recordset, hofs: hofResult.recordset, reports: reportsResult.recordset });
  } catch (err) {
    console.error("Error in getChecklistDetails:", err);
    res.status(500).send(err.message);
  }
};

exports.saveBatchChecklist = async (req, res) => {
  try {
    const { items, sign, assignedHOF, date, disaMachine } = req.body;
    if (!items || !date || !disaMachine) return res.status(400).send("Data missing");

    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      for (const item of items) {
        const request = new sql.Request(transaction);
        const checkRes = await request.query`SELECT COUNT(*) as count FROM BottomLevelAudit_Trans WHERE MasterId = ${item.MasterId} AND LogDate = ${date} AND DisaMachine = ${disaMachine}`;

        const isDoneVal = item.IsDone ? 1 : 0; const isNaVal = item.IsNA ? 1 : 0;
        const isHolidayVal = item.IsHoliday ? 1 : 0; const isVatVal = item.IsVatCleaning ? 1 : 0;
        const isPrevMaintVal = item.IsPreventiveMaintenance ? 1 : 0;

        const writeRequest = new sql.Request(transaction);

        if (checkRes.recordset[0].count > 0) {
          await writeRequest.query`
            UPDATE BottomLevelAudit_Trans 
            SET IsDone = ${isDoneVal}, IsNA = ${isNaVal}, IsHoliday = ${isHolidayVal}, IsVatCleaning = ${isVatVal}, IsPreventiveMaintenance = ${isPrevMaintVal},
                [Sign] = ${sign}, AssignedHOF = ${assignedHOF}, LastUpdated = GETDATE()
            WHERE MasterId = ${item.MasterId} AND LogDate = ${date} AND DisaMachine = ${disaMachine}
          `;
        } else {
          await writeRequest.query`
            INSERT INTO BottomLevelAudit_Trans (MasterId, LogDate, DisaMachine, IsDone, IsNA, IsHoliday, IsVatCleaning, IsPreventiveMaintenance, [Sign], AssignedHOF)
            VALUES (${item.MasterId}, ${date}, ${disaMachine}, ${isDoneVal}, ${isNaVal}, ${isHolidayVal}, ${isVatVal}, ${isPrevMaintVal}, ${sign}, ${assignedHOF})
          `;
        }
      }
      await transaction.commit();
      res.json({ success: true });
    } catch (err) { await transaction.rollback(); throw err; }
  } catch (err) {
    console.error("Error in saveBatchChecklist:", err);
    res.status(500).send(err.message);
  }
};

exports.saveNCReport = async (req, res) => {
  try {
    const { checklistId, slNo, reportDate, ncDetails, correction, rootCause, correctiveAction, targetDate, responsibility, sign, disaMachine } = req.body;

    await sql.query`
      INSERT INTO BottomLevelAudit_NCR (
        MasterId, ReportDate, DisaMachine, NonConformityDetails, Correction, 
        RootCause, CorrectiveAction, TargetDate, Responsibility, [Sign], Status
      )
      VALUES (
        ${checklistId}, ${reportDate}, ${disaMachine}, ${ncDetails}, ${correction}, 
        ${rootCause}, ${correctiveAction}, ${targetDate}, ${responsibility}, ${sign}, 'Pending'
      )
    `;

    const checkRow = await sql.query`SELECT COUNT(*) as count FROM BottomLevelAudit_Trans WHERE MasterId = ${checklistId} AND LogDate = ${reportDate} AND DisaMachine = ${disaMachine}`;

    if (checkRow.recordset[0].count > 0) {
      await sql.query`UPDATE BottomLevelAudit_Trans SET IsDone = 0, IsNA = 0, IsHoliday = 0, IsVatCleaning = 0, IsPreventiveMaintenance = 0, [Sign] = ${sign} WHERE MasterId = ${checklistId} AND LogDate = ${reportDate} AND DisaMachine = ${disaMachine}`;
    } else {
      await sql.query`INSERT INTO BottomLevelAudit_Trans (MasterId, LogDate, DisaMachine, IsDone, IsNA, IsHoliday, IsVatCleaning, IsPreventiveMaintenance, [Sign]) VALUES (${checklistId}, ${reportDate}, ${disaMachine}, 0, 0, 0, 0, 0, ${sign})`;
    }
    res.json({ success: true });
  } catch (err) {
    console.error("Error in saveNCReport:", err);
    res.status(500).send(err.message);
  }
};

exports.getMonthlyReport = async (req, res) => {
  try {
    const { month, year, disaMachine } = req.query;

    const checklistResult = await sql.query`
      SELECT MasterId, DAY(LogDate) as DayVal, IsDone, IsNA, IsHoliday, IsVatCleaning, IsPreventiveMaintenance, [Sign] as SupervisorName, SupervisorSignature, AssignedHOF, HOFSignature
      FROM BottomLevelAudit_Trans
      WHERE MONTH(LogDate) = ${month} AND YEAR(LogDate) = ${year} AND DisaMachine = ${disaMachine}
    `;

    const ncResult = await sql.query`
      SELECT ReportId, ReportDate, NonConformityDetails, Correction, RootCause, CorrectiveAction, TargetDate, Responsibility, [Sign], Status, SupervisorSignature
      FROM BottomLevelAudit_NCR
      WHERE MONTH(ReportDate) = ${month} AND YEAR(ReportDate) = ${year} AND DisaMachine = ${disaMachine}
      ORDER BY ReportDate ASC
    `;

    // 🔥 FETCH QF HISTORY
    let qfHistory = [];
    try {
        const qfRes = await sql.query`SELECT qfValue, date FROM BottomLevelAuditQFvalues WHERE formName = 'lpa' ORDER BY date DESC, id DESC`;
        qfHistory = qfRes.recordset;
    } catch(e) { console.error("BottomLevelAuditQFvalues fetch error"); }

    res.json({ monthlyLogs: checklistResult.recordset, ncReports: ncResult.recordset, qfHistory });
  } catch (err) {
    console.error("Error in getMonthlyReport:", err);
    res.status(500).send(err.message);
  }
};

exports.getBulkData = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const request = new sql.Request();

    const masterRes = await request.query(`SELECT * FROM BottomLevelAudit_Master WHERE IsDeleted = 0 OR IsDeleted IS NULL ORDER BY SlNo ASC`);

    let transQuery = `SELECT T.*, M.CheckPointDesc, M.SlNo FROM BottomLevelAudit_Trans T INNER JOIN BottomLevelAudit_Master M ON T.MasterId = M.MasterId`;
    let ncrQuery = `SELECT * FROM BottomLevelAudit_NCR`;

    if (fromDate && toDate) {
      transQuery += ` WHERE CAST(T.LogDate AS DATE) BETWEEN @fromDate AND @toDate`;
      ncrQuery += ` WHERE CAST(ReportDate AS DATE) BETWEEN @fromDate AND @toDate`;
      request.input('fromDate', sql.Date, fromDate);
      request.input('toDate', sql.Date, toDate);
    }

    const transRes = await request.query(transQuery);
    const ncrRes = await request.query(ncrQuery);

    // 🔥 FETCH QF HISTORY
    let qfHistory = [];
    try {
        const qfRes = await request.query(`SELECT qfValue, date FROM BottomLevelAuditQFvalues WHERE formName = 'lpa' ORDER BY date DESC, id DESC`);
        qfHistory = qfRes.recordset;
    } catch(e) { console.error("BottomLevelAuditQFvalues fetch error"); }

    res.json({ master: masterRes.recordset, trans: transRes.recordset, ncr: ncrRes.recordset, qfHistory });
  } catch (error) {
    console.error("Error fetching bulk data:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
//   SUPERVISOR DASHBOARD APIS 
// ==========================================
exports.getReportsBySupervisor = async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT t1.LogDate as reportDate, t1.DisaMachine as disa, t1.[Sign] as supervisorName, 
             (SELECT TOP 1 t2.SupervisorSignature FROM BottomLevelAudit_Trans t2 WHERE t2.LogDate = t1.LogDate AND t2.DisaMachine = t1.DisaMachine AND t2.[Sign] = t1.[Sign]) as supervisorSignature
      FROM BottomLevelAudit_Trans t1
      WHERE t1.[Sign] = ${name}
      GROUP BY t1.LogDate, t1.DisaMachine, t1.[Sign]
      ORDER BY t1.LogDate DESC
    `;
    res.json(result.recordset);
  } catch (error) {
    console.error("Error in getReportsBySupervisor:", error);
    res.status(500).json({ error: "Failed to fetch supervisor reports" });
  }
};

exports.signReportBySupervisor = async (req, res) => {
  try {
    const { date, disaMachine, signature } = req.body;
    await sql.query`UPDATE BottomLevelAudit_Trans SET SupervisorSignature = ${signature} WHERE LogDate = ${date} AND DisaMachine = ${disaMachine}`;
    res.json({ message: "Signature saved successfully" });
  } catch (error) {
    console.error("Error in signReportBySupervisor:", error);
    res.status(500).json({ error: "Failed to save supervisor signature" });
  }
};

exports.getNcrReportsBySupervisor = async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT ReportId, ReportDate, DisaMachine, NonConformityDetails, Correction, RootCause, CorrectiveAction, TargetDate, Responsibility, Status, SupervisorSignature
      FROM BottomLevelAudit_NCR
      WHERE [Sign] = ${name}
      ORDER BY Status DESC, ReportDate DESC
    `;
    res.json(result.recordset);
  } catch (error) {
    console.error("Error in getNcrReportsBySupervisor:", error);
    res.status(500).json({ error: "Failed to fetch NCRs" });
  }
};

exports.signNcrBySupervisor = async (req, res) => {
  try {
    const { reportId, signature } = req.body;
    await sql.query`UPDATE BottomLevelAudit_NCR SET SupervisorSignature = ${signature}, Status = 'Completed' WHERE ReportId = ${reportId}`;
    res.json({ message: "NCR Signature saved successfully" });
  } catch (error) {
    console.error("Error in signNcrBySupervisor:", error);
    res.status(500).json({ error: "Failed to save NCR signature" });
  }
};

// ========================================== 
//   HOF DASHBOARD APIS
// ==========================================
exports.getReportsByHOF = async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT YEAR(t1.LogDate) as year, MONTH(t1.LogDate) as month, t1.DisaMachine as disa, t1.AssignedHOF as hofName, 
             (SELECT TOP 1 t2.HOFSignature FROM BottomLevelAudit_Trans t2 WHERE YEAR(t2.LogDate) = YEAR(t1.LogDate) AND MONTH(t2.LogDate) = MONTH(t1.LogDate) AND t2.DisaMachine = t1.DisaMachine AND t2.AssignedHOF = t1.AssignedHOF) as hofSignature
      FROM BottomLevelAudit_Trans t1
      WHERE t1.AssignedHOF = ${name}
      GROUP BY YEAR(t1.LogDate), MONTH(t1.LogDate), t1.DisaMachine, t1.AssignedHOF
      ORDER BY year DESC, month DESC
    `;
    res.json(result.recordset);
  } catch (error) {
    console.error("Error in getReportsByHOF:", error);
    res.status(500).json({ error: "Failed to fetch HOF reports" });
  }
};

exports.signReportByHOF = async (req, res) => {
  try {
    const { month, year, disaMachine, signature } = req.body;
    await sql.query`UPDATE BottomLevelAudit_Trans SET HOFSignature = ${signature} WHERE MONTH(LogDate) = ${month} AND YEAR(LogDate) = ${year} AND DisaMachine = ${disaMachine}`;
    res.json({ message: "Monthly Signature saved successfully" });
  } catch (error) {
    console.error("Error in signReportByHOF:", error);
    res.status(500).json({ error: "Failed to save HOF signature" });
  }
};