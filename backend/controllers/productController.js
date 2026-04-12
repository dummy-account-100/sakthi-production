const sql = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ==========================================
//           BULLETPROOF HELPERS
// ==========================================
// Prevents SQL crashes by ensuring numbers are numbers and strings are strings
const safeNum = (val) => {
  if (val === null || val === undefined || String(val).trim() === "" || String(val).trim() === "-") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const safeStr = (val) => {
  if (val === null || val === undefined || String(val).trim() === "" || String(val).trim() === "-") return "-"; // Set to default hyphen if empty
  return String(val).trim();
};

// ==========================================
//               DROPDOWN DATA
// ==========================================
exports.getComponents = async (req, res) => {
  try {
    const result = await sql.query("SELECT code, description, pouredWeight, cavity, castedWeight, isActive FROM Component ORDER BY code ASC");
    // Normalize isActive to a clean 'Active'/'Inactive' string
    const normalized = result.recordset.map(row => {
      const activeKey = Object.keys(row).find(k => k.toLowerCase() === 'isactive');
      const rawVal = activeKey ? row[activeKey] : undefined;
      let isActiveStr = 'Inactive';
      if (rawVal === true || rawVal === 1 || String(rawVal).trim().toLowerCase() === 'active') {
        isActiveStr = 'Active';
      }
      return { ...row, isActive: isActiveStr };
    });
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch components" });
  }
};

exports.getDelayReasons = async (req, res) => {
  try {
    const result = await sql.query`SELECT id, reasonName FROM DelaysReason ORDER BY reasonName`;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch delay reasons" });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const result = await sql.query`SELECT id, username as name FROM Users WHERE role = 'operator' ORDER BY username`;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch employees" });
  }
};

exports.getIncharges = async (req, res) => {
  try {
    const result = await sql.query`SELECT id, username as name FROM Users WHERE role = 'operator' ORDER BY username`;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch incharges" });
  }
};

exports.getOperators = async (req, res) => {
  try {
    const result = await sql.query`SELECT id, username as operatorName FROM Users WHERE role = 'operator' ORDER BY username`;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch operators" });
  }
};

exports.getSupervisors = async (req, res) => {
  try {
    const result = await sql.query`SELECT id, username as supervisorName FROM Users WHERE role = 'supervisor' ORDER BY username`;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch supervisors" });
  }
};

exports.getMouldHardnessRemarks = async (req, res) => {
  try {
    const result = await sql.query`SELECT id, remarkName FROM mouldHardnessRemarks ORDER BY remarkName`;
    res.status(200).json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch mould hardness remarks" });
  }
};

// ==========================================
//         FETCH LAST PERSONNEL FOR SHIFT
// ==========================================
exports.getLastPersonnel = async (req, res) => {
  const { disa, date, shift } = req.query;
  try {
    const result = await sql.query`
      SELECT TOP 1 incharge, member, ppOperator, supervisorName 
      FROM DisamaticProductReport 
      WHERE disa = ${disa} AND reportDate = ${date} AND shift = ${shift}
      ORDER BY id DESC
    `;
    res.json(result.recordset[0] || null);
  } catch (error) {
    console.error("Error fetching personnel:", error);
    res.status(500).json({ error: "Failed to fetch personnel" });
  }
};

// ==========================================
//             LAST MOULD COUNTER
// ==========================================
exports.getLastMouldCounter = async (req, res) => {
  const { disa } = req.query;
  try {
    const result = await sql.query`
      SELECT TOP 1 p.mouldCounterNo 
      FROM DisamaticProduction p
      JOIN DisamaticProductReport r ON p.reportId = r.id
      WHERE r.disa = ${disa}
      ORDER BY r.reportDate DESC, r.id DESC, p.mouldCounterNo DESC
    `;
    const lastMouldCounter = result.recordset[0]?.mouldCounterNo || 0;
    res.status(200).json({ lastMouldCounter });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch last mould counter" });
  }
};

// ==========================================
//         SUPERVISOR DASHBOARD APIS
// ==========================================
exports.getReportsBySupervisor = async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT id, reportDate, shift, disa, incharge, ppOperator, supervisorSignature 
      FROM DisamaticProductReport 
      WHERE supervisorName = ${name}
      ORDER BY reportDate DESC, id DESC
    `;
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching supervisor reports:", error);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
};

exports.signReport = async (req, res) => {
  try {
    const { reportId, signature } = req.body;
    await sql.query`
      UPDATE DisamaticProductReport 
      SET supervisorSignature = ${signature} 
      WHERE id = ${reportId}
    `;
    res.json({ message: "Signature saved successfully" });
  } catch (error) {
    console.error("Error saving signature:", error);
    res.status(500).json({ error: "Failed to save signature" });
  }
};


// ==========================================
//             FORM SUBMISSION
// ==========================================
exports.createReport = async (req, res) => {
  const {
    disa, date, shift, incharge, member, 
    ppOperator, supervisorName, maintenance, significantEvent,
    productions = [], nextShiftPlans = [], mouldHardness = [], patternTemps = [], delays = []
  } = req.body;

  try {
    const reportResult = await sql.query`
      INSERT INTO DisamaticProductReport (
        disa, reportDate, shift, incharge, member, ppOperator, supervisorName, maintenance, significantEvent
      )
      OUTPUT INSERTED.id
      VALUES (
        ${safeStr(disa)}, ${safeStr(date)}, ${safeStr(shift)}, ${safeStr(incharge)},
        ${safeStr(member)}, ${safeStr(ppOperator)}, ${safeStr(supervisorName)},
        ${safeStr(maintenance)}, ${safeStr(significantEvent)}
      )
    `;

    // 🔥 FIX 1: Must include to extract the ID from the recordset array
    const reportId = reportResult.recordset[0].id;

    if (productions.length > 0) {
      // 🔥 FIX 2: Must include to get the values from the first production row
      const firstProduced = safeNum(productions[0].produced);
      const firstPoured = safeNum(productions[0].poured); 
      
      await sql.query`
        WITH CTE AS (
          SELECT TOP 1 p.produced, p.poured
          FROM DisamaticProduction p
          INNER JOIN DisamaticProductReport r ON p.reportId = r.id
          WHERE r.disa = ${disa}
          ORDER BY r.reportDate DESC, r.id DESC, p.id DESC
        )
        UPDATE CTE SET produced = ${firstProduced}, poured = ${firstPoured}
      `;

      for (let i = 0; i < productions.length; i++) {
        const p = productions[i];
        if (safeStr(p.componentName)) {
          // Shift BOTH produced and poured values by 1 index. 
          // The last row automatically gets null (which renders as a hyphen in PDF/Admin)
          const producedValue = (i === productions.length - 1) ? null : safeNum(productions[i + 1].produced);
          const pouredValue = (i === productions.length - 1) ? null : safeNum(productions[i + 1].poured);

          await sql.query`
            INSERT INTO DisamaticProduction (
              reportId, componentName, mouldCounterNo, produced, poured,
              cycleTime, mouldsPerHour, remarks
            )
            VALUES (
              ${reportId}, ${safeStr(p.componentName)}, ${safeNum(p.mouldCounterNo)},
              ${producedValue}, ${pouredValue},
              ${safeNum(p.cycleTime)}, ${safeNum(p.mouldsPerHour)},
              ${safeStr(p.remarks)}
            )
          `;
        }
      }
    }

    if (delays.length > 0) {
      for (let d of delays) {
        if (safeStr(d.delayType)) {
          const durationTime = (safeStr(d.startTime) && safeStr(d.endTime)) ? `${d.startTime} - ${d.endTime}` : null;
          await sql.query`
            INSERT INTO DisamaticDelays (reportId, delay, durationMinutes, durationTime)
            VALUES (${reportId}, ${safeStr(d.delayType)}, ${safeNum(d.duration)}, ${durationTime})
          `;
        }
      }
    }

    const shiftOrder = ["I", "II", "III"];
    let currentShiftIndex = shiftOrder.indexOf(shift);
    let planDate = new Date(date);

    for (let i = 0; i < nextShiftPlans.length; i++) {
      const plan = nextShiftPlans[i];
      if (safeStr(plan.componentName)) {
        currentShiftIndex++;
        if (currentShiftIndex >= shiftOrder.length) {
          currentShiftIndex = 0;
          planDate.setDate(planDate.getDate() + 1);
        }
        const planShift = shiftOrder[currentShiftIndex];
        const formattedPlanDate = planDate.toISOString().split("T")[0];

        await sql.query`
          INSERT INTO DisamaticNextShiftPlan (
            reportId, planDate, planShift, componentName, plannedMoulds, remarks
          )
          VALUES (
            ${reportId}, ${formattedPlanDate}, ${planShift}, 
            ${safeStr(plan.componentName)}, ${safeNum(plan.plannedMoulds)}, ${safeStr(plan.remarks)}
          )
        `;
      }
    }

    for (let i = 0; i < mouldHardness.length; i++) {
      const h = mouldHardness[i];
      if (safeStr(h.componentName)) {
        await sql.query`
          INSERT INTO DisamaticMouldHardness (
            reportId, componentName, penetrationPP, penetrationSP, bScalePP, bScaleSP, remarks
          )
          VALUES (
            ${reportId}, ${safeStr(h.componentName)}, 
            ${safeStr(h.penetrationPP)}, ${safeStr(h.penetrationSP)}, 
            ${safeStr(h.bScalePP)}, ${safeStr(h.bScaleSP)}, 
            ${safeStr(h.remarks)}
          )
        `;
      }
    }

    for (let i = 0; i < patternTemps.length; i++) {
      const pt = patternTemps[i];
      if (safeStr(pt.componentName)) {
        await sql.query`
          INSERT INTO DisamaticPatternTemp (reportId, componentName, pp, sp, remarks)
          VALUES (${reportId}, ${safeStr(pt.componentName)}, ${safeNum(pt.pp)}, ${safeNum(pt.sp)}, ${safeStr(pt.remarks)})
        `;
      }
    }

    res.status(201).json({ message: "Report saved successfully" });

  } catch (error) {
    console.error("Error saving report:", error);
    res.status(500).json({ error: "Failed to save report", details: error.message });
  }
};

// ==========================================
//     ADMIN: BULK DATA FOR DATE RANGE (RETAINED)
// ==========================================
exports.getBulkData = async (req, res) => {
  const { fromDate, toDate } = req.query;
  try {
    const reportsRes = await sql.query`
      SELECT * FROM DisamaticProductReport
      WHERE CAST(reportDate AS DATE) BETWEEN CAST(${fromDate} AS DATE) AND CAST(${toDate} AS DATE)
      ORDER BY reportDate ASC, shift ASC, disa ASC, id ASC`;
    const reports = reportsRes.recordset;

    const result = [];
    for (const rep of reports) {
      const productions = (await sql.query`SELECT * FROM DisamaticProduction WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      const delays = (await sql.query`SELECT * FROM DisamaticDelays WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      const nextShiftPlans = (await sql.query`SELECT * FROM DisamaticNextShiftPlan WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      const mouldHardness = (await sql.query`SELECT * FROM DisamaticMouldHardness WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      const patternTemps = (await sql.query`SELECT * FROM DisamaticPatternTemp WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      result.push({ ...rep, productions, delays, nextShiftPlans, mouldHardness, patternTemps });
    }
    res.json(result);
  } catch (err) {
    console.error("getBulkData error:", err);
    res.status(500).json({ error: "Failed to fetch bulk data", details: err.message });
  }
};

// ==========================================
//     ADMIN: FETCH REPORT BY EXACT DATE (RETAINED)
// ==========================================
exports.getByDate = async (req, res) => {
  const { date, disa, shift } = req.query;
  if (!date) return res.status(400).json({ error: "date is required" });

  try {
    let reportsRes;
    if (disa && shift) {
      reportsRes = await sql.query`
        SELECT * FROM DisamaticProductReport
        WHERE CAST(reportDate AS DATE) = CAST(${date} AS DATE) AND disa = ${disa} AND shift = ${shift}
        ORDER BY id ASC`;
    } else if (disa) {
      reportsRes = await sql.query`
        SELECT * FROM DisamaticProductReport
        WHERE CAST(reportDate AS DATE) = CAST(${date} AS DATE) AND disa = ${disa}
        ORDER BY shift ASC, id ASC`;
    } else {
      reportsRes = await sql.query`
        SELECT * FROM DisamaticProductReport
        WHERE CAST(reportDate AS DATE) = CAST(${date} AS DATE)
        ORDER BY shift ASC, disa ASC, id ASC`;
    }

    const reports = reportsRes.recordset;
    const result = [];
    for (const rep of reports) {
      const productions = (await sql.query`SELECT * FROM DisamaticProduction WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      const delays = (await sql.query`SELECT * FROM DisamaticDelays WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      const nextShiftPlans = (await sql.query`SELECT * FROM DisamaticNextShiftPlan WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      const mouldHardness = (await sql.query`SELECT * FROM DisamaticMouldHardness WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      const patternTemps = (await sql.query`SELECT * FROM DisamaticPatternTemp WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      result.push({ ...rep, productions, delays, nextShiftPlans, mouldHardness, patternTemps });
    }
    res.json(result);
  } catch (err) {
    console.error("getByDate error:", err);
    res.status(500).json({ error: "Failed to fetch report by date", details: err.message });
  }
};

// ==========================================
//     ADMIN: UPDATE DISAMATIC REPORT
// ==========================================
exports.updateDisamaticReport = async (req, res) => {
  const { id } = req.params;
  const { incharge, member, ppOperator, supervisorName, significantEvent, maintenance,
    productions, delays, nextShiftPlans, mouldHardness, patternTemps } = req.body;

  try {
    // 1. Update the Main Report Table
    await sql.query`
      UPDATE DisamaticProductReport SET
        incharge = ${safeStr(incharge)},
        member = ${safeStr(member)},
        ppOperator = ${safeStr(ppOperator)},
        supervisorName = ${safeStr(supervisorName)},
        significantEvent = ${safeStr(significantEvent)},
        maintenance = ${safeStr(maintenance)}
      WHERE id = ${Number(id)}`;

    // 2. Update the Productions Array
    if (productions && productions.length > 0) {
      for (const p of productions) {
        if (p.id) {
          await sql.query`UPDATE DisamaticProduction SET
            componentName = ${safeStr(p.componentName)},
            mouldCounterNo = ${safeNum(p.mouldCounterNo)},
            produced = ${safeNum(p.produced)},
            poured = ${safeNum(p.poured)},
            cycleTime = ${safeNum(p.cycleTime)},
            mouldsPerHour = ${safeNum(p.mouldsPerHour)},
            remarks = ${safeStr(p.remarks)}
            WHERE id = ${Number(p.id)}`;
        }
      }
    }

    // 3. Update the Next Shift Plans Array 
    if (nextShiftPlans && nextShiftPlans.length > 0) {
      for (const np of nextShiftPlans) {
        if (np.id) {
          await sql.query`UPDATE DisamaticNextShiftPlan SET
            componentName = ${safeStr(np.componentName)},
            plannedMoulds = ${safeNum(np.plannedMoulds)},
            remarks = ${safeStr(np.remarks)}
            WHERE id = ${Number(np.id)}`;
        }
      }
    }

    // 4. Update the Delays Array
    if (delays && delays.length > 0) {
      for (const d of delays) {
        if (d.id) {
          await sql.query`UPDATE DisamaticDelays SET
            delay = ${safeStr(d.delay || d.delayType)},
            durationMinutes = ${safeNum(d.durationMinutes || d.duration)},
            durationTime = ${safeStr(d.durationTime)}
            WHERE id = ${Number(d.id)}`;
        }
      }
    }

    // 5. Update Mould Hardness Array
    if (mouldHardness && mouldHardness.length > 0) {
      for (const h of mouldHardness) {
        if (h.id) {
          await sql.query`UPDATE DisamaticMouldHardness SET
            componentName = ${safeStr(h.componentName)},
            penetrationPP = ${safeStr(h.penetrationPP)},
            penetrationSP = ${safeStr(h.penetrationSP)},
            bScalePP = ${safeStr(h.bScalePP)},
            bScaleSP = ${safeStr(h.bScaleSP)},
            remarks = ${safeStr(h.remarks)}
            WHERE id = ${Number(h.id)}`;
        }
      }
    }

    // 6. Update Pattern Temps Array
    if (patternTemps && patternTemps.length > 0) {
      for (const pt of patternTemps) {
        if (pt.id) {
          await sql.query`UPDATE DisamaticPatternTemp SET
            componentName = ${safeStr(pt.componentName)},
            pp = ${safeStr(pt.pp)},
            sp = ${safeStr(pt.sp)},
            remarks = ${safeStr(pt.remarks)}
            WHERE id = ${Number(pt.id)}`;
        }
      }
    }

    res.json({ message: "Report updated successfully" });
  } catch (err) {
    console.error("updateDisamaticReport error:", err);
    res.status(500).json({ error: "Failed to update report", details: err.message });
  }
};

// ==========================================
//          DOWNLOAD ALL REPORTS (PDF)
// ==========================================
// ==========================================
//          DOWNLOAD ALL REPORTS (PDF)
// ==========================================
exports.downloadAllReports = async (req, res) => {
  try {
    const { reportId, date, disa, fromDate, toDate } = req.query;

    // 🔥 1. FETCH FULL QF VALUE HISTORY FROM DATABASE 🔥
    let qfHistory = [];
    try {
      const qfRes = await sql.query`
        SELECT qfValue, date 
        FROM DisamaticReportQFvalues 
        WHERE formName = 'disamatic-report' 
        ORDER BY date DESC, id DESC
      `;
      qfHistory = qfRes.recordset;
    } catch (e) {
      console.error("DisamaticReportQFvalues table error or not found.");
    }

    let reportResult;
    
    // 🔥 2. PROPER DATE RANGE FILTERING LOGIC 🔥
    if (fromDate && toDate) {
      reportResult = await sql.query`
        SELECT * FROM DisamaticProductReport 
        WHERE CAST(reportDate AS DATE) >= CAST(${fromDate} AS DATE) 
          AND CAST(reportDate AS DATE) <= CAST(${toDate} AS DATE)
        ORDER BY reportDate ASC, shift ASC, disa ASC, id ASC
      `;
    } else if (date && disa) {
      reportResult = await sql.query`
        SELECT * FROM DisamaticProductReport 
        WHERE reportDate = ${date} AND disa = ${disa} 
        ORDER BY shift DESC, id ASC
      `;
    } else if (reportId) {
      reportResult = await sql.query`SELECT * FROM DisamaticProductReport WHERE id = ${reportId}`;
    } else {
      reportResult = await sql.query`SELECT * FROM DisamaticProductReport ORDER BY reportDate DESC, shift DESC, disa ASC, id ASC`;
    }

    const reports = reportResult.recordset;

    if (reports.length === 0) {
      return res.status(404).json({ message: "No reports found for this selection." });
    }

    const grouped = {};
    reports.forEach(r => {
      const dateStr = new Date(r.reportDate).toISOString().split('T')[0];
      const key = `${dateStr}_${r.shift}_${r.disa}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          date: r.reportDate, shift: r.shift, disa: r.disa,
          incharge: r.incharge, member: r.member, ppOperator: r.ppOperator,
          supervisorName: r.supervisorName, supervisorSignature: r.supervisorSignature, 
          reportIds: [], sigEvents: new Set(), maintenances: new Set()
        };
      }
      
      grouped[key].reportIds.push(r.id);
      grouped[key].incharge = r.incharge || grouped[key].incharge;
      grouped[key].member = r.member || grouped[key].member;
      grouped[key].ppOperator = r.ppOperator || grouped[key].ppOperator;
      grouped[key].supervisorName = r.supervisorName || grouped[key].supervisorName;
      grouped[key].supervisorSignature = r.supervisorSignature || grouped[key].supervisorSignature;
      
      if (r.significantEvent && r.significantEvent.trim() && r.significantEvent !== "-") grouped[key].sigEvents.add(r.significantEvent);
      if (r.maintenance && r.maintenance.trim() && r.maintenance !== "-") grouped[key].maintenances.add(r.maintenance);
    });

    const reportGroups = Object.values(grouped);

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    
    let fName = (fromDate && toDate) 
        ? `Disamatic_Report_${fromDate}_to_${toDate}.pdf` 
        : date && disa ? `Disamatic_Report_${date}_DISA-${disa}.pdf` : `Disamatic_Report.pdf`;
        
    res.setHeader("Content-Disposition", `inline; filename="${fName}"`);
    doc.pipe(res);

    const startX = 30;
    const pageBottom = 780; 
    const tableWidth = 535;

    const checkPageBreak = (neededHeight) => {
      if (doc.y + neededHeight > pageBottom) {
        doc.addPage();
        return true; 
      }
      return false;
    };

    const drawCellText = (text, x, y, w, h, align = 'center', font = 'Helvetica', fontSize = 9) => {
      const content = (text !== null && text !== undefined && text !== "") ? text.toString() : "-";
      const finalAlign = (content === "-") ? 'center' : align;
      const finalFont = (content === "-") ? 'Helvetica-Bold' : font;

      let currentSize = fontSize;
      doc.font(finalFont).fontSize(currentSize).fillColor('black');
      const innerWidth = w - 10; 

      let words = content.split(/[\s\n]+/);
      let maxWordWidth = Math.max(...words.map(word => doc.widthOfString(word)));
      while (maxWordWidth > innerWidth && currentSize > 4) {
        currentSize -= 0.5;
        doc.fontSize(currentSize);
        maxWordWidth = Math.max(...words.map(word => doc.widthOfString(word)));
      }

      const textHeight = doc.heightOfString(content, { width: innerWidth });
      const topPad = h > textHeight ? (h - textHeight) / 2 : 5; 
      doc.text(content, x + 5, y + topPad, { width: innerWidth, align: finalAlign });
    };

    const enforceWrap = (text, maxWidth) => {
      if (!text || text === "-") return "-";
      if (text.includes('-') && !text.includes(' ')) {
        let parts = text.split('-');
        let lines = [];
        let currentLine = parts[0];
        for (let i = 1; i < parts.length; i++) {
          let testLine = currentLine + '-' + parts[i];
          if (doc.widthOfString(testLine) > maxWidth) {
            lines.push(currentLine + '-');
            currentLine = parts[i];
          } else {
            currentLine = testLine;
          }
        }
        lines.push(currentLine);
        return lines.join('\n');
      }
      if (text.includes(',')) {
        return text.split(',').join(',\n'); 
      }
      return text;
    };

    const getFilteredData = (rawData, checkKey) => {
      return rawData.filter(row => {
        const val = row[checkKey];
        if (val === null || val === undefined) return false;
        const strVal = String(val).trim();
        return strVal !== "" && strVal !== "-";
      });
    };

    for (let i = 0; i < reportGroups.length; i++) {
      const g = reportGroups[i];
      if (i > 0) doc.addPage(); 

      // 🔥 FIND CORRECT QF VALUE FOR THIS SPECIFIC PAGE DATE 🔥
      let currentPageQfValue = "QF/07/FBP-03, Rev.No: 02 dt 01.10.2024"; // System Default
      const currentReportDate = new Date(g.date);
      currentReportDate.setHours(0, 0, 0, 0);

      for (let qf of qfHistory) {
          if (!qf.date) continue;
          const qfDate = new Date(qf.date);
          qfDate.setHours(0, 0, 0, 0);
          if (qfDate <= currentReportDate) {
              currentPageQfValue = qf.qfValue;
              break; 
          }
      }

      let currentY = 30;
      doc.rect(startX, currentY, tableWidth, 60).stroke();
      const logoPath = path.join(__dirname, 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 5, currentY + 10, { fit: [120, 40], align: 'center', valign: 'center' });
      } else {
        doc.font('Helvetica-Bold').fontSize(16).text("SAKTHI AUTO", startX + 10, currentY + 22, { width: 120, align: 'center' });
      }
      doc.moveTo(startX + 130, currentY).lineTo(startX + 130, currentY + 60).stroke();
      doc.font('Helvetica-Bold').fontSize(11).text(`DISAMATIC PRODUCTION REPORT`, startX + 130, currentY + 18, { width: 270, align: 'center' });
      doc.fontSize(11).text(`DISA - ${g.disa}`, startX + 130, currentY + 35, { width: 270, align: 'center' });

      const metaX = 400;
      doc.rect(metaX, currentY, tableWidth - 370, 60).stroke();
      doc.fontSize(9).font('Helvetica');
      doc.text(`Date      : ${new Date(g.date).toLocaleDateString('en-GB')}`, metaX + 5, currentY + 8);
      doc.moveTo(metaX, currentY + 20).lineTo(startX + tableWidth, currentY + 20).stroke();
      doc.text(`Shift      : ${g.shift}`, metaX + 5, currentY + 28);
      doc.moveTo(metaX, currentY + 40).lineTo(startX + tableWidth, currentY + 40).stroke();
      doc.text(`Incharge: ${g.incharge || "-"}`, metaX + 5, currentY + 48);
      currentY += 60; 

      doc.rect(startX, currentY, tableWidth, 25).stroke();
      doc.font('Helvetica-Bold').text("Member Present:", startX + 5, currentY + 8);
      doc.font('Helvetica').text(g.member || "-", startX + 90, currentY + 8);
      doc.font('Helvetica-Bold').text("P/P Operator:", startX + 350, currentY + 8);
      doc.font('Helvetica').text(g.ppOperator || "-", startX + 420, currentY + 8);
      currentY += 25;

      const idsList = g.reportIds.join(',');

      const drawDynamicTable = async (title, columns, dataQuery, checkKey, totalConfig = null) => {
        const result = await sql.query(dataQuery);
        const data = getFilteredData(result.recordset, checkKey);

        if (checkPageBreak(50)) currentY = 50;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('black').text(title, startX, currentY + 8);
        currentY += 22;

        const headerHeight = 25;
        let xPos = startX;
        doc.rect(startX, currentY, tableWidth, headerHeight).fillColor('#f3f4f6').stroke();
        doc.fillColor('black'); 

        columns.forEach(col => {
          drawCellText(col.label, xPos, currentY - 2, col.w, headerHeight, 'center', 'Helvetica-Bold', 8);
          doc.moveTo(xPos + col.w, currentY).lineTo(xPos + col.w, currentY + headerHeight).stroke();
          xPos += col.w;
        });
        doc.rect(startX, currentY, tableWidth, headerHeight).stroke();
        currentY += headerHeight;

        if (data.length === 0) {
          doc.rect(startX, currentY, tableWidth, 20).stroke();
          drawCellText("-", startX, currentY, tableWidth, 20);
          currentY += 20;
        } else {
          data.forEach((row, idx) => {
            const sno = idx + 1; 
            let maxH = 20; 
            let processedRow = { ...row, sno: sno.toString() };

            doc.font('Helvetica').fontSize(9);
            columns.forEach(col => {
              let val = col.key === 'sno' ? sno.toString() : (row[col.key] || "-").toString();
              if (col.key === 'componentName' || col.key === 'delay' || col.key === 'penetrationPP' || col.key === 'penetrationSP' || col.key === 'bScalePP' || col.key === 'bScaleSP') {
                 val = enforceWrap(val, col.w - 10);
                 processedRow[col.key] = val;
              }
              const textH = doc.heightOfString(val, { width: col.w - 10 }); 
              if (textH + 12 > maxH) maxH = textH + 12;
            });

            if (checkPageBreak(maxH)) currentY = 50;

            let rX = startX;
            columns.forEach(col => {
              const val = col.key === 'sno' ? sno : processedRow[col.key];
              drawCellText(val, rX, currentY, col.w, maxH, col.align || 'center');
              doc.rect(rX, currentY, col.w, maxH).stroke();
              rX += col.w;
            });
            currentY += maxH;
          });

          if (totalConfig) {
            let totals = {};
            totalConfig.sumCols.forEach(k => totals[k] = 0);
            let totalTonnage = 0;
            data.forEach(r => {
              totalConfig.sumCols.forEach(k => {
                let val = Number(r[k]);
                if (!isNaN(val)) totals[k] += val;
              });
              if (totalConfig.calcTonnage) {
                const poured = Number(r.poured) || 0;
                const weight = Number(r.pouredWeight) || 0;
                totalTonnage += (poured * weight);
              }
            });

            const rowHeight = totalConfig.calcTonnage ? 35 : 20;
            if (checkPageBreak(rowHeight)) currentY = 50;
            
            let rX = startX;
            doc.font('Helvetica-Bold').fontSize(9);
            columns.forEach(col => {
              let cellText = " "; 
              let align = 'center';
              if (col.key === totalConfig.labelCol) {
                cellText = totalConfig.labelText;
                align = 'right';
              } else if (totalConfig.sumCols.includes(col.key)) {
                cellText = totals[col.key] === 0 ? "-" : totals[col.key].toString();
              } else if (totalConfig.calcTonnage && col.key === 'remarks') {
                let tonnageStr = `Tonnage: ${totalTonnage > 0 ? (totalTonnage / 1000).toFixed(3): '-'}`; 
                let unpouredPerc = "-";
                if (totals['produced'] > 0) {
                  let unp = totals['produced'] - totals['poured'];
                  unpouredPerc = ((unp / totals['produced']) * 100).toFixed(2);
                }
                cellText = `${tonnageStr}\nUnpoured %: ${unpouredPerc}`; 
              }
              drawCellText(cellText, rX, currentY, col.w, rowHeight, align, 'Helvetica-Bold');
              doc.rect(rX, currentY, col.w, rowHeight).stroke();
              rX += col.w;
            });
            currentY += rowHeight;
          }
        }
      };

      await drawDynamicTable("Production :", [
        { label: "Mould Counter", key: "mouldCounterNo", w: 75 },
        { label: "Component Name", key: "componentName", w: 140, align: 'left' },
        { label: "Produced", key: "produced", w: 50 },
        { label: "Poured", key: "poured", w: 50 },
        { label: "Cycle Time", key: "cycleTime", w: 45 },
        { label: "Moulds/Hr", key: "mouldsPerHour", w: 45 },
        { label: "Remarks", key: "remarks", w: 130, align: 'left' }
      ], `SELECT p.*, c.pouredWeight FROM DisamaticProduction p LEFT JOIN Component c ON p.componentName = c.description WHERE p.reportId IN (${idsList}) ORDER BY p.id ASC`, 
      'componentName', 
      { labelCol: 'componentName', labelText: 'Total : ', sumCols: ['produced', 'poured'], calcTonnage: true });

      await drawDynamicTable("Next Shift Plan :", [
        { label: "S.No", key: "sno", w: 30 },
        { label: "Component Name", key: "componentName", w: 220, align: 'left' },
        { label: "Planned Moulds", key: "plannedMoulds", w: 100 },
        { label: "Remarks", key: "remarks", w: 185, align: 'left' }
      ], `SELECT * FROM DisamaticNextShiftPlan WHERE reportId IN (${idsList}) ORDER BY id ASC`, 'componentName');

      await drawDynamicTable("Delays :", [
        { label: "S.No", key: "sno", w: 30 },
        { label: "Delays (Reason)", key: "delay", w: 240, align: 'left' },
        { label: "Minutes", key: "durationMinutes", w: 100 },
        { label: "Time Range", key: "durationTime", w: 165 }
      ], `SELECT * FROM DisamaticDelays WHERE reportId IN (${idsList}) ORDER BY id ASC`, 'delay',
      { labelCol: 'delay', labelText: 'Total Minutes : ', sumCols: ['durationMinutes'] });

      await drawDynamicTable("Mould Hardness :", [
        { label: "S.No", key: "sno", w: 30 },
        { label: "Component Name", key: "componentName", w: 140, align: 'left' },
        { label: "Penetration PP", key: "penetrationPP", w: 55 },
        { label: "Penetration SP", key: "penetrationSP", w: 55 },
        { label: "B-Scale PP", key: "bScalePP", w: 55 },
        { label: "B-Scale SP", key: "bScaleSP", w: 55 },
        { label: "Remarks", key: "remarks", w: 145, align: 'left' }
      ], `SELECT * FROM DisamaticMouldHardness WHERE reportId IN (${idsList}) ORDER BY id ASC`, 'componentName');

      const ptResult = await sql.query(`SELECT * FROM DisamaticPatternTemp WHERE reportId IN (${idsList}) ORDER BY id ASC`);
      const ptData = getFilteredData(ptResult.recordset, 'componentName');
      const sigEventText = Array.from(g.sigEvents).join(' | ') || "-";

      let ptTableHeight = 15;
      let ptRowHeights = [];
      if (ptData.length === 0) {
        ptTableHeight += 20;
        ptRowHeights.push(20);
      } else {
        ptData.forEach(pt => {
          let h = 20;
          let cnH = doc.heightOfString(enforceWrap(pt.componentName, 140), { width: 140 }); 
          if (cnH + 12 > h) h = cnH + 12;
          ptTableHeight += h;
          ptRowHeights.push(h);
        });
      }

      doc.font('Helvetica').fontSize(9);
      const sigH = doc.heightOfString(sigEventText, { width: 240 }) + 35; 
      const splitBlockH = Math.max(sigH, ptTableHeight, 50);

      if (checkPageBreak(splitBlockH + 40)) currentY = 50;

      doc.rect(startX, currentY, tableWidth, 15).fillColor('#f3f4f6').stroke();
      doc.fillColor('black').font('Helvetica-Bold').fontSize(8);
      doc.text("Pattern Temp. in C°", startX + 5, currentY + 4);
      doc.text("Significant Event :", startX + 285, currentY + 4);
      doc.moveTo(startX + 280, currentY).lineTo(startX + 280, currentY + splitBlockH + 15).stroke();
      
      currentY += 15;
      const blockStartY = currentY;

      drawCellText("S.No", startX, currentY, 30, 15, 'center', 'Helvetica-Bold', 7); doc.rect(startX, currentY, 30, 15).stroke();
      drawCellText("ITEMS", startX + 30, currentY, 150, 15, 'center', 'Helvetica-Bold', 7); doc.rect(startX + 30, currentY, 150, 15).stroke();
      drawCellText("PP", startX + 180, currentY, 50, 15, 'center', 'Helvetica-Bold', 7); doc.rect(startX + 180, currentY, 50, 15).stroke();
      drawCellText("SP", startX + 230, currentY, 50, 15, 'center', 'Helvetica-Bold', 7); doc.rect(startX + 230, currentY, 50, 15).stroke();
      currentY += 15;

      if (ptData.length === 0) {
          drawCellText("-", startX, currentY, 30, 20); doc.rect(startX, currentY, 30, 20).stroke();
          drawCellText("-", startX + 30, currentY, 150, 20); doc.rect(startX + 30, currentY, 150, 20).stroke();
          drawCellText("-", startX + 180, currentY, 50, 20); doc.rect(startX + 180, currentY, 50, 20).stroke();
          drawCellText("-", startX + 230, currentY, 50, 20); doc.rect(startX + 230, currentY, 50, 20).stroke();
          currentY += 20;
      } else {
          ptData.forEach((pt, j) => {
            let rH = ptRowHeights[j];
            drawCellText(j + 1, startX, currentY, 30, rH); doc.rect(startX, currentY, 30, rH).stroke();
            drawCellText(enforceWrap(pt.componentName, 140), startX + 30, currentY, 150, rH, 'left'); doc.rect(startX + 30, currentY, 150, rH).stroke();
            drawCellText(pt.pp, startX + 180, currentY, 50, rH); doc.rect(startX + 180, currentY, 50, rH).stroke();
            drawCellText(pt.sp, startX + 230, currentY, 50, rH); doc.rect(startX + 230, currentY, 50, rH).stroke();
            currentY += rH;
          });
      }

      if (currentY < blockStartY + splitBlockH) {
          let diff = (blockStartY + splitBlockH) - currentY;
          doc.rect(startX, currentY, 30, diff).stroke();
          doc.rect(startX + 30, currentY, 150, diff).stroke();
          doc.rect(startX + 180, currentY, 50, diff).stroke();
          doc.rect(startX + 230, currentY, 50, diff).stroke();
      }

      doc.font('Helvetica').fontSize(9).text(sigEventText, startX + 285, blockStartY + 5, { width: 245 });
      doc.rect(startX + 280, blockStartY, 255, splitBlockH).stroke();
      
      currentY = blockStartY + splitBlockH;

      // ==========================================
      // 🔥 FIXED FOOTER BLOCK (Maintenance + Sign + QF)
      // ==========================================
      const maintText = Array.from(g.maintenances).join(' | ') || "-";
      const totalFooterHeight = 40 + 50; // Maintenance (40) + Sign/QF block (50)

      // Check if the entire block fits, if not, move EVERYTHING to the next page
      if (checkPageBreak(totalFooterHeight + 10)) {
        currentY = 50;
      }

      // Draw Maintenance Box
      doc.rect(startX, currentY, tableWidth, 40).stroke();
      doc.font('Helvetica-Bold').fontSize(8).text("Maintenance :", startX + 5, currentY + 5);
      doc.font('Helvetica').fontSize(9).text(maintText, startX + 5, currentY + 15, { width: tableWidth - 10 });
      currentY += 40;

      // Draw Supervisor & QF Box
      const footerHeight = 50; 
      doc.rect(startX, currentY, tableWidth, footerHeight).stroke(); 
      doc.font('Helvetica-Bold').fontSize(9).text(`Supervisor Name : ${g.supervisorName || "-"}`, startX + 330, currentY + 10);
      doc.text("Signature :", startX + 330, currentY + 30);
      
      if (g.supervisorSignature && g.supervisorSignature.startsWith("data:image")) {
        try {
          doc.image(g.supervisorSignature, startX + 385, currentY + 15, { fit: [100, 30], align: 'left', valign: 'center' });
        } catch (imgErr) {
          doc.text("Signed", startX + 390, currentY + 30);
        }
      } else {
        doc.text("Pending", startX + 390, currentY + 30);
      }

      // Print QF Value INSIDE the bottom left of the SAME block
      doc.fontSize(7).font('Helvetica').text(currentPageQfValue, startX + 5, currentY + 35);
      // ==========================================
    }
    
    doc.end();

  }catch (error) {
    console.error("PDF Generation Error:", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
};