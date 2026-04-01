const sql = require('../db');

const mouldController = {
  getMouldDetails: async (req, res) => {
    try {
      const { date, disa } = req.query;

      const masterRes = await sql.query`
        SELECT * FROM UnpouredMould_Master 
        WHERE IsDeleted = 0 ORDER BY SlNo ASC
      `;

      const transRes = await sql.query`
        SELECT * FROM UnPouredMouldDetails 
        WHERE RecordDate = ${date} AND DisaMachine = ${disa}
      `;

      const masterCols = masterRes.recordset.map(row => ({
        key: `custom_${row.MasterId}`,
        id: row.MasterId,
        label: row.ReasonName,
        group: row.Department,
        isCustom: true
      }));

      const shiftData = { 1: { customValues: {} }, 2: { customValues: {} }, 3: { customValues: {} } };

      transRes.recordset.forEach(row => {
          if (shiftData[row.Shift]) {
              const s = shiftData[row.Shift];
              // 🔥 UPDATED: If the DB value is 0, send a '-' back to the frontend
              s.patternChange = row.PatternChange === 0 ? '-' : row.PatternChange;
              s.heatCodeChange = row.HeatCodeChange === 0 ? '-' : row.HeatCodeChange;
              s.mouldBroken = row.MouldBroken === 0 ? '-' : row.MouldBroken;
              s.amcCleaning = row.AmcCleaning === 0 ? '-' : row.AmcCleaning;
              s.mouldCrush = row.MouldCrush === 0 ? '-' : row.MouldCrush;
              s.coreFalling = row.CoreFalling === 0 ? '-' : row.CoreFalling;
              s.sandDelay = row.SandDelay === 0 ? '-' : row.SandDelay;
              s.drySand = row.DrySand === 0 ? '-' : row.DrySand;
              s.nozzleChange = row.NozzleChange === 0 ? '-' : row.NozzleChange;
              s.nozzleLeakage = row.NozzleLeakage === 0 ? '-' : row.NozzleLeakage;
              s.spoutPocking = row.SpoutPocking === 0 ? '-' : row.SpoutPocking;
              s.stRod = row.StRod === 0 ? '-' : row.StRod;
              s.qcVent = row.QcVent === 0 ? '-' : row.QcVent;
              s.outMould = row.OutMould === 0 ? '-' : row.OutMould;
              s.lowMg = row.LowMg === 0 ? '-' : row.LowMg;
              s.gradeChange = row.GradeChange === 0 ? '-' : row.GradeChange;
              s.msiProblem = row.MsiProblem === 0 ? '-' : row.MsiProblem;
              s.brakeDown = row.BrakeDown === 0 ? '-' : row.BrakeDown;
              s.wom = row.Wom === 0 ? '-' : row.Wom;
              s.devTrail = row.DevTrail === 0 ? '-' : row.DevTrail;
              s.powerCut = row.PowerCut === 0 ? '-' : row.PowerCut;
              s.plannedOff = row.PlannedOff === 0 ? '-' : row.PlannedOff;
              s.vatCleaning = row.VatCleaning === 0 ? '-' : row.VatCleaning;
              s.others = row.Others === 0 ? '-' : row.Others;
              s.operatorSignature = row.OperatorSignature || '';
          }
      });

      const customRes = await sql.query`
        SELECT columnId, value, Shift FROM UnPouredCustomValues 
        WHERE RecordDate = ${date} AND DisaMachine = ${disa}
      `;
      
      customRes.recordset.forEach(row => {
          if (shiftData[row.Shift]) {
             // 🔥 UPDATED: Also send '-' for custom columns
             shiftData[row.Shift].customValues[row.columnId] = row.value === 0 ? '-' : row.value;
          }
      });

      res.json({ masterCols, shiftsData: shiftData });
    } catch (err) {
      console.error('Error fetching mould details:', err);
      res.status(500).send('Server Error');
    }
  },

  saveMouldDetails: async (req, res) => {
    try {
      const { date, disa, shiftsData } = req.body;
      
      const transaction = new sql.Transaction();
      await transaction.begin();

      try {
        const deleteReq = new sql.Request(transaction);
        await deleteReq.query`DELETE FROM UnPouredMouldDetails WHERE RecordDate = ${date} AND DisaMachine = ${disa}`;
        
        const deleteCustom = new sql.Request(transaction);
        await deleteCustom.query`DELETE FROM UnPouredCustomValues WHERE RecordDate = ${date} AND DisaMachine = ${disa}`;

        const getVal = (val) => parseInt(val) || 0;

        for (const shift of [1, 2, 3]) {
          const data = shiftsData[shift];
          if (!data) continue;

          const writeReq = new sql.Request(transaction);
          await writeReq.query`
              INSERT INTO UnPouredMouldDetails (
                RecordDate, DisaMachine, Shift, 
                PatternChange, HeatCodeChange, MouldBroken, AmcCleaning, MouldCrush, CoreFalling,
                SandDelay, DrySand, NozzleChange, NozzleLeakage, SpoutPocking, StRod,
                QcVent, OutMould, LowMg, GradeChange, MsiProblem, BrakeDown, Wom, DevTrail,
                PowerCut, PlannedOff, VatCleaning, Others, RowTotal, OperatorSignature
              ) VALUES (
                ${date}, ${disa}, ${shift}, 
                ${getVal(data.patternChange)}, ${getVal(data.heatCodeChange)}, ${getVal(data.mouldBroken)}, ${getVal(data.amcCleaning)}, ${getVal(data.mouldCrush)}, ${getVal(data.coreFalling)},
                ${getVal(data.sandDelay)}, ${getVal(data.drySand)}, ${getVal(data.nozzleChange)}, ${getVal(data.nozzleLeakage)}, ${getVal(data.spoutPocking)}, ${getVal(data.stRod)},
                ${getVal(data.qcVent)}, ${getVal(data.outMould)}, ${getVal(data.lowMg)}, ${getVal(data.gradeChange)}, ${getVal(data.msiProblem)},
                ${getVal(data.brakeDown)}, ${getVal(data.wom)}, ${getVal(data.devTrail)},
                ${getVal(data.powerCut)}, ${getVal(data.plannedOff)}, ${getVal(data.vatCleaning)}, ${getVal(data.others)}, ${getVal(data.rowTotal)},
                ${data.operatorSignature || null}
              )
            `;

          if (data.customValues) {
            for (const [colId, val] of Object.entries(data.customValues)) {
                const numVal = parseInt(val) || 0;
                if (numVal > 0) {
                    const customWriteReq = new sql.Request(transaction);
                    await customWriteReq.query`
                        INSERT INTO UnPouredCustomValues (RecordDate, DisaMachine, Shift, columnId, value) 
                        VALUES (${date}, ${disa}, ${shift}, ${parseInt(colId)}, ${numVal})
                    `;
                }
            }
          }
        }
        await transaction.commit();
        res.json({ success: true });
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } catch (err) {
      console.error('Error saving details:', err);
      res.status(500).send('Server Error');
    }
  },

  getBulkData: async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        
        let query = `SELECT * FROM UnPouredMouldDetails`;
        let cQuery = `SELECT * FROM UnPouredCustomValues`;

        if (fromDate && toDate) {
            query += ` WHERE RecordDate BETWEEN '${fromDate}' AND '${toDate}'`;
            cQuery += ` WHERE RecordDate BETWEEN '${fromDate}' AND '${toDate}'`;
        }
        
        const result = await sql.query(query);
        const cResult = await sql.query(cQuery);

        let qfHistory = [];
        try {
           const qfRes = await sql.query`SELECT qfValue, date FROM UnpouredMouldQFvalues WHERE formName = 'unpoured-mould-details' ORDER BY date DESC, id DESC`;
           qfHistory = qfRes.recordset;
        } catch(e) {
           console.error("UnpouredMouldQFvalues fetch error");
        }

        const mergedRecords = result.recordset.map(r => {
            const cVals = {};
            cResult.recordset
                .filter(cv => String(cv.RecordDate) === String(r.RecordDate) && cv.DisaMachine === r.DisaMachine && cv.Shift === r.Shift)
                .forEach(cv => { cVals[cv.columnId] = cv.value; });
            return { ...r, customValues: cVals };
        });

        res.json({ records: mergedRecords, qfHistory });
    } catch (error) {
        console.error("Error fetching bulk data:", error);
        res.status(500).json({ error: "Failed to fetch bulk data" });
    }
  },

  getSummaryData: async (req, res) => {
      const { date } = req.query;
      if (!date) return res.status(400).json({ error: "Date is required" });

      try {
          const result = await sql.query`
              WITH DailyProduction AS (
                  SELECT 
                      r.disa,
                      p.mouldCounterNo,
                      p.poured,
                      r.shift,
                      ROW_NUMBER() OVER(PARTITION BY r.disa ORDER BY p.id ASC) as rn_asc,
                      ROW_NUMBER() OVER(PARTITION BY r.disa ORDER BY p.id DESC) as rn_desc
                  FROM DisamaticProductReport r
                  INNER JOIN DisamaticProduction p ON r.id = p.reportId
                  WHERE r.reportDate = ${date} AND p.mouldCounterNo > 0
              ),
              Aggregated AS (
                  SELECT 
                      disa,
                      MAX(CASE WHEN rn_asc = 1 THEN mouldCounterNo END) as mouldCounterOpen,
                      MAX(CASE WHEN rn_desc = 1 THEN mouldCounterNo END) as mouldCounterClose,
                      SUM(CASE WHEN rn_desc > 1 THEN ISNULL(poured, 0) ELSE 0 END) as totalPoured
                  FROM DailyProduction
                  GROUP BY disa
              ),
              DelaysData AS (
                  SELECT 
                      r.disa,
                      SUM(d.durationMinutes) AS totalDelayMinutes
                  FROM DisamaticProductReport r
                  LEFT JOIN DisamaticDelays d ON r.id = d.reportId
                  WHERE r.reportDate = ${date}
                  GROUP BY r.disa
              ),
              ShiftCount AS (
                  SELECT 
                      disa,
                      COUNT(DISTINCT shift) AS activeShifts
                  FROM DisamaticProductReport
                  WHERE reportDate = ${date}
                  GROUP BY disa
              )
              SELECT 
                  d.disa,
                  a.mouldCounterClose,
                  a.mouldCounterOpen,
                  (ISNULL(a.mouldCounterClose, 0) - ISNULL(a.mouldCounterOpen, 0)) AS producedMould,
                  ISNULL(a.totalPoured, 0) AS pouredMould,
                  ISNULL(del.totalDelayMinutes, 0) AS totalDelayMinutes,
                  ISNULL(sc.activeShifts, 0) AS activeShifts
              FROM (VALUES ('I'), ('II'), ('III'), ('IV')) AS d(disa)
              LEFT JOIN Aggregated a ON d.disa = a.disa
              LEFT JOIN DelaysData del ON d.disa = del.disa
              LEFT JOIN ShiftCount sc ON d.disa = sc.disa
          `;

          let qfHistory = [];
          try {
             const qfRes = await sql.query`SELECT qfValue, date FROM UnpouredMouldQFvalues WHERE formName = 'unpoured-mould-details' ORDER BY date DESC, id DESC`;
             qfHistory = qfRes.recordset;
          } catch(e) {
             console.error("UnpouredMouldQFvalues fetch error");
          }

          const responseData = result.recordset.map(row => {
              const produced = row.producedMould > 0 ? row.producedMould : 0;
              const poured = row.pouredMould || 0;
              const delaysMins = row.totalDelayMinutes || 0;
              
              const unpoured = produced - poured;
              const percentage = produced > 0 ? ((unpoured / produced) * 100).toFixed(2) : 0;
              
              const baseHours = (row.activeShifts || 0) * 8; 
              const runningHours = Math.max(0, baseHours - (delaysMins / 60)).toFixed(2);
              
              const producedMhr = runningHours > 0 ? (produced / runningHours).toFixed(2) : 0;
              const pouredMhr = runningHours > 0 ? (poured / runningHours).toFixed(2) : 0;

              return {
                  disa: row.disa,
                  mouldCounterClose: row.mouldCounterClose || "-",
                  mouldCounterOpen: row.mouldCounterOpen || "-",
                  producedMould: produced,
                  pouredMould: poured,
                  unpouredMould: unpoured,
                  percentage: percentage,
                  delays: delaysMins,
                  producedMhr: producedMhr,
                  pouredMhr: pouredMhr,
                  runningHours: runningHours
              };
          });

          res.status(200).json({ summary: responseData, qfHistory });
      } catch (error) {
          console.error("Error fetching summary data:", error);
          res.status(500).json({ summary: [], qfHistory: [] });
      }
  },

  saveSummaryData: async (req, res) => {
      const { date, summaryData } = req.body;
      try {
          const transaction = new sql.Transaction();
          await transaction.begin();

          try {
              const deleteReq = new sql.Request(transaction);
              await deleteReq.query`DELETE FROM UnpouredMouldSummary WHERE reportDate = ${date}`;

              for (const row of summaryData) {
                  const mClose = String(row.mouldCounterClose || '-');
                  const mOpen = String(row.mouldCounterOpen || '-');
                  const pMould = parseInt(row.producedMould) || 0;
                  const pouredM = parseInt(row.pouredMould) || 0;
                  const uMould = parseInt(row.unpouredMould) || 0;
                  const perc = parseFloat(row.percentage) || 0;
                  const delys = parseInt(row.delays) || 0;
                  const prodMhr = parseFloat(row.producedMhr) || 0;
                  const pouredMhr = parseFloat(row.pouredMhr) || 0;
                  const rHours = parseFloat(row.runningHours) || 0;

                  const insertReq = new sql.Request(transaction);
                  await insertReq.query`
                      INSERT INTO UnpouredMouldSummary 
                      (reportDate, disa, mouldCounterClose, mouldCounterOpen, producedMould, pouredMould, unpouredMould, percentage, delays, producedMhr, pouredMhr, runningHours)
                      VALUES (${date}, ${row.disa}, ${mClose}, ${mOpen}, ${pMould}, ${pouredM}, ${uMould}, ${perc}, ${delys}, ${prodMhr}, ${pouredMhr}, ${rHours})
                  `;
              }

              await transaction.commit();
              res.status(200).json({ message: "Summary Data Saved Successfully!" });
          } catch(err) {
              await transaction.rollback();
              throw err;
          }
      } catch (error) {
          console.error("Error saving summary:", error);
          res.status(500).json({ error: "Failed to save summary data" });
      }
  }
};

module.exports = mouldController;