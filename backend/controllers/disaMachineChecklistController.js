const sql = require('../db');

// ==========================================
//   1. GET CHECKLIST DETAILS (OPERATOR DASHBOARD)
// ==========================================
exports.getChecklistDetails = async (req, res) => {
  try {
    const { date, disaMachine } = req.query;

    // Safely filters out deleted items so they disappear from the Operator UI
    const checklistResult = await sql.query`
      SELECT 
          M.MasterId, 
          M.SlNo, 
          M.CheckPointDesc, 
          M.CheckMethod, 
          ISNULL(T.IsDone, 0) as IsDone, 
          ISNULL(T.IsHoliday, 0) as IsHoliday,
          ISNULL(T.IsVatCleaning, 0) as IsVatCleaning,
          ISNULL(T.IsPreventiveMaintenance, 0) as IsPreventiveMaintenance,
          ISNULL(T.ReadingValue, '') as ReadingValue,
          T.AssignedHOD,
          T.OperatorSignature -- Send signature to frontend to pre-fill pad
      FROM MachineChecklist_Master M
      LEFT JOIN MachineChecklist_Trans T 
          ON M.MasterId = T.MasterId 
          AND T.LogDate = ${date}
          AND T.DisaMachine = ${disaMachine}
      WHERE M.IsDeleted = 0 OR M.IsDeleted IS NULL
      ORDER BY M.SlNo ASC
    `;

    // Fetch HODs for the main dropdown
    const hodsResult = await sql.query`SELECT username as OperatorName FROM dbo.Users WHERE role = 'hod' ORDER BY username`;

    // Fetch Supervisors for the NC Report Responsibility dropdown
    const supervisorsResult = await sql.query`SELECT username as OperatorName FROM dbo.Users WHERE role = 'supervisor' OR role = 'admin' ORDER BY username`;

    const reportsResult = await sql.query`
      SELECT * FROM dbo.DisaNonConformanceReport 
      WHERE ReportDate = ${date} AND DisaMachine = ${disaMachine}
    `;

    res.json({
      checklist: checklistResult.recordset,
      operators: hodsResult.recordset,
      supervisors: supervisorsResult.recordset, 
      reports: reportsResult.recordset
    });

  } catch (err) {
    console.error('Error fetching details:', err);
    res.status(500).send(err.message);
  }
};

// ==========================================
//   2. BATCH SUBMIT CHECKLIST
// ==========================================
exports.saveBatchChecklist = async (req, res) => {
  try {
    // 'sign' is now the assigned HOD name
    const { items, sign, date, disaMachine, operatorSignature } = req.body;
    if (!items || !date || !disaMachine) return res.status(400).send("Data missing");

    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      for (const item of items) {
        const request = new sql.Request(transaction);

        const checkRes = await request.query`
            SELECT COUNT(*) as count FROM MachineChecklist_Trans 
            WHERE MasterId = ${item.MasterId} AND LogDate = ${date} AND DisaMachine = ${disaMachine}
        `;

        const isDoneVal = item.IsDone ? 1 : 0;
        const isHolidayVal = item.IsHoliday ? 1 : 0;
        const isVatVal = item.IsVatCleaning ? 1 : 0;
        const isPrevMaintVal = item.IsPreventiveMaintenance ? 1 : 0;
        const readingVal = item.ReadingValue || '';

        const writeRequest = new sql.Request(transaction);

        if (checkRes.recordset[0].count > 0) {
          await writeRequest.query`
            UPDATE MachineChecklist_Trans 
            SET IsDone = ${isDoneVal}, IsHoliday = ${isHolidayVal}, IsVatCleaning = ${isVatVal}, IsPreventiveMaintenance = ${isPrevMaintVal},
                ReadingValue = ${readingVal}, AssignedHOD = ${sign}, OperatorSignature = ${operatorSignature}, LastUpdated = GETDATE()
            WHERE MasterId = ${item.MasterId} AND LogDate = ${date} AND DisaMachine = ${disaMachine}
          `;
        } else {
          await writeRequest.query`
            INSERT INTO MachineChecklist_Trans (MasterId, LogDate, IsDone, IsHoliday, IsVatCleaning, IsPreventiveMaintenance, ReadingValue, AssignedHOD, OperatorSignature, DisaMachine)
            VALUES (${item.MasterId}, ${date}, ${isDoneVal}, ${isHolidayVal}, ${isVatVal}, ${isPrevMaintVal}, ${readingVal}, ${sign}, ${operatorSignature}, ${disaMachine})
          `;
        }
      }

      await transaction.commit();
      res.json({ success: true });

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error('Error saving batch:', err);
    res.status(500).send(err.message);
  }
};

// ==========================================
//   3. SAVE NC REPORT
// ==========================================
exports.saveNCReport = async (req, res) => {
  try {
    const {
      checklistId, slNo, reportDate, ncDetails, correction,
      rootCause, correctiveAction, targetDate, responsibility, sign, disaMachine
    } = req.body;

    await sql.query`
      INSERT INTO DisaNonConformanceReport (
        MasterId, ReportDate, NonConformityDetails, Correction, 
        RootCause, CorrectiveAction, TargetDate, Responsibility, 
        Sign, Status, DisaMachine
      )
      VALUES (
        ${checklistId}, ${reportDate}, ${ncDetails}, ${correction}, 
        ${rootCause}, ${correctiveAction}, ${targetDate}, ${responsibility}, 
        ${sign}, 'Pending', ${disaMachine}
      )
    `;

    const checkRow = await sql.query`
        SELECT COUNT(*) as count FROM MachineChecklist_Trans 
        WHERE MasterId = ${checklistId} AND LogDate = ${reportDate} AND DisaMachine = ${disaMachine}
    `;

    if (checkRow.recordset[0].count > 0) {
      await sql.query`
           UPDATE MachineChecklist_Trans SET IsDone = 0, IsHoliday = 0, IsVatCleaning = 0, IsPreventiveMaintenance = 0, Sign = ${sign} 
           WHERE MasterId = ${checklistId} AND LogDate = ${reportDate} AND DisaMachine = ${disaMachine}
       `;
    } else {
      await sql.query`
           INSERT INTO MachineChecklist_Trans (MasterId, LogDate, IsDone, IsHoliday, IsVatCleaning, IsPreventiveMaintenance, Sign, DisaMachine) 
           VALUES (${checklistId}, ${reportDate}, 0, 0, 0, 0, ${sign}, ${disaMachine})
       `;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).send(err.message);
  }
};

// ==========================================
//   4. MONTHLY REPORT & PDF GENERATION
// ==========================================
exports.getMonthlyReport = async (req, res) => {
  try {
    const { month, year, disaMachine } = req.query;

    const checklistResult = await sql.query`
      SELECT MasterId, DAY(LogDate) as DayVal, IsDone, IsHoliday, IsVatCleaning, IsPreventiveMaintenance, ReadingValue, OperatorSignature, AssignedHOD, HODSignature
      FROM MachineChecklist_Trans
      WHERE MONTH(LogDate) = ${month} AND YEAR(LogDate) = ${year} AND DisaMachine = ${disaMachine}
    `;

    // Added SupervisorSignature for the NCR payload
    const ncResult = await sql.query`
      SELECT ReportId, ReportDate, NonConformityDetails, Correction, RootCause, CorrectiveAction, TargetDate, Responsibility, Sign, Status, SupervisorSignature
      FROM DisaNonConformanceReport
      WHERE MONTH(ReportDate) = ${month} AND YEAR(ReportDate) = ${year} AND DisaMachine = ${disaMachine}
      ORDER BY ReportDate ASC
    `;

    // FETCH QF HISTORY
    let qfHistory = [];
    try {
        const qfRes = await sql.query`SELECT qfValue, date FROM MachineChecklistQFvalues WHERE formName = 'disa-operator' ORDER BY date DESC, id DESC`;
        qfHistory = qfRes.recordset;
    } catch(e) { console.error("MachineChecklistQFvalues fetch error"); }

    res.json({ monthlyLogs: checklistResult.recordset, ncReports: ncResult.recordset, qfHistory });
  } catch (err) {
    console.error("Monthly Report Error:", err);
    res.status(500).send(err.message);
  }
};

// ==========================================
//   5. HOD DASHBOARD APIS
// ==========================================
exports.getReportsByHOD = async (req, res) => {
  try {
    const { name } = req.params;

    const result = await sql.query`
      SELECT DISTINCT LogDate as reportDate, DisaMachine as disa, AssignedHOD as hodName, MAX(HODSignature) as hodSignature
      FROM MachineChecklist_Trans 
      WHERE AssignedHOD = ${name}
      GROUP BY LogDate, DisaMachine, AssignedHOD
      ORDER BY LogDate DESC
    `;
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching HOD reports:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};

exports.signReportByHOD = async (req, res) => {
  try {
    const { date, disaMachine, signature } = req.body;

    await sql.query`
      UPDATE MachineChecklist_Trans 
      SET HODSignature = ${signature} 
      WHERE LogDate = ${date} AND DisaMachine = ${disaMachine}
    `;
    res.json({ message: "Signature saved successfully" });
  } catch (error) {
    console.error("Error saving HOD signature:", error);
    res.status(500).json({ error: "Failed to save signature" });
  }
};

// ==========================================
//   6. ADMIN BULK DATA EXPORT
// ==========================================
exports.getBulkData = async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;
    const request = new sql.Request();

    const masterRes = await request.query(`SELECT * FROM MachineChecklist_Master WHERE IsDeleted = 0 OR IsDeleted IS NULL ORDER BY SlNo ASC`);

    let transQuery = `SELECT T.*, M.CheckPointDesc, M.CheckMethod, M.SlNo FROM MachineChecklist_Trans T INNER JOIN MachineChecklist_Master M ON T.MasterId = M.MasterId`;
    let ncrQuery = `SELECT * FROM DisaNonConformanceReport`;

    if (fromDate && toDate) {
      request.input('fromDate', sql.Date, fromDate);
      request.input('toDate', sql.Date, toDate);
      transQuery += ` WHERE CAST(T.LogDate AS DATE) BETWEEN @fromDate AND @toDate`;
      ncrQuery += ` WHERE CAST(ReportDate AS DATE) BETWEEN @fromDate AND @toDate`;
    }

    const transRes = await request.query(transQuery);
    const ncrRes = await request.query(ncrQuery);

    // FETCH QF HISTORY
    let qfHistory = [];
    try {
        const qfRes = await request.query(`SELECT qfValue, date FROM MachineChecklistQFvalues WHERE formName = 'disa-operator' ORDER BY date DESC, id DESC`);
        qfHistory = qfRes.recordset;
    } catch(e) { console.error("MachineChecklistQFvalues fetch error"); }

    res.json({ master: masterRes.recordset, trans: transRes.recordset, ncr: ncrRes.recordset, qfHistory });
  } catch (error) {
    console.error("Error fetching bulk data:", error);
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
//   7. SUPERVISOR NCR APIS (NEW)
// ==========================================
exports.getNcrReportsBySupervisor = async (req, res) => {
  try {
    const { name } = req.params;
    
    // Fetch all NCRs where this supervisor is assigned the responsibility
    const result = await sql.query`
      SELECT * FROM DisaNonConformanceReport 
      WHERE Responsibility = ${name}
      ORDER BY ReportDate DESC
    `;
    
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching NCR reports:", error);
    res.status(500).json({ error: "Failed to fetch NCR reports" });
  }
};

exports.signNcrBySupervisor = async (req, res) => {
  try {
    const { reportId, signature } = req.body;
    
    // Update the NCR with the signature and mark as Completed
    await sql.query`
      UPDATE DisaNonConformanceReport 
      SET SupervisorSignature = ${signature}, Status = 'Completed'
      WHERE ReportId = ${reportId}
    `;
    
    res.json({ message: "NCR signed successfully" });
  } catch (error) {
    console.error("Error signing NCR:", error);
    res.status(500).json({ error: "Failed to sign NCR" });
  }
};