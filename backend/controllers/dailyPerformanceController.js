const sql = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// ==========================================
//           BULLETPROOF HELPERS
// ==========================================
const safeNum = (val) => {
  if (val === null || val === undefined || String(val).trim() === "" || String(val).trim() === "-") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const safeStr = (val) => {
  if (val === null || val === undefined || String(val).trim() === "" || String(val).trim() === "-") return "-";
  return String(val).trim();
};

// ==========================================
//   SUBMIT DAILY PRODUCTION PERFORMANCE
// ==========================================
exports.createDailyPerformance = async (req, res) => {
  const { productionDate, disa, summary, details, unplannedReasons, signatures, delays } = req.body;

  try {
    const reportResult = await sql.query`
            INSERT INTO DailyPerformanceReport (productionDate, disa, unplannedReasons, incharge, hof, hod, operatorSignature)
            OUTPUT INSERTED.id
            VALUES (${safeStr(productionDate)}, ${safeStr(disa)}, ${safeStr(unplannedReasons)}, 
                    ${safeStr(signatures?.incharge)}, ${safeStr(signatures?.hof)}, ${safeStr(signatures?.hod)}, NULL)`;

    const reportId = reportResult.recordset[0].id;

    const shifts = ["I", "II", "III"];
    for (let sh of shifts) {
      const sData = summary[sh] || {};
      await sql.query`
                INSERT INTO DailyPerformanceSummary (reportId, shiftName, pouredMoulds, tonnage, quantity, casted, shiftValue)
                VALUES (${reportId}, ${sh}, ${safeNum(sData.pouredMoulds)},
                        ${safeNum(sData.tonnage)}, ${safeNum(sData.quantity)}, ${safeNum(sData.casted)}, ${safeNum(sData.value)})`;
    }

    if (details && details.length > 0) {
      for (let d of details) {
        if (d.patternCode) {
          await sql.query`
                        INSERT INTO DailyPerformanceDetails (reportId, patternCode, itemDescription, planned, unplanned,
                                                             mouldsProd, mouldsPour, cavity, unitWeight, totalWeight)
                        VALUES (${reportId}, ${safeStr(d.patternCode)}, ${safeStr(d.itemDescription)}, 
                                ${safeNum(d.planned)}, ${safeNum(d.unplanned)},
                                ${safeNum(d.mouldsProd)}, ${safeNum(d.mouldsPour)}, 
                                ${safeNum(d.cavity)}, ${safeNum(d.unitWeight)}, ${safeNum(d.totalWeight)})`;
        }
      }
    }

    if (delays && delays.length > 0) {
      for (let delay of delays) {
        await sql.query`
                    INSERT INTO Productiondelays (reportId, shift, duration, reason)
                    VALUES (${reportId}, ${safeStr(delay.shift)}, ${safeNum(delay.duration)}, ${safeStr(delay.reason)})`;
      }
    }

    res.status(201).json({ message: "Daily Performance Report saved successfully" });
  } catch (error) {
    console.error("SQL Error saving daily performance:", error);
    res.status(500).json({ error: "Failed to save daily performance", details: error.message });
  }
};

// ==========================================
//   FETCH AGGREGATED SUMMARY BY DATE & DISA
// ==========================================
exports.getSummaryByDate = async (req, res) => {
  const { date, disa } = req.query;
  try {
    const result = await sql.query`
      SELECT 
        r.shift,
        SUM(ISNULL(TRY_CAST(p.poured AS INT), 0)) AS totalPouredMoulds,
        SUM(ISNULL(TRY_CAST(p.poured AS INT), 0) * ISNULL(TRY_CAST(comp.pouredWeight AS DECIMAL(10,3)), 0)) AS totalTonnageKg,
        SUM(ISNULL(TRY_CAST(p.poured AS INT), 0) * ISNULL(TRY_CAST(comp.castedWeight AS DECIMAL(10,3)), 0) * ISNULL(TRY_CAST(comp.cavity AS INT), 0)) AS totalCastedKg,
        SUM(ISNULL(TRY_CAST(p.poured AS INT), 0) * ISNULL(TRY_CAST(comp.cavity AS INT), 0)) AS totalQuantity
      FROM DisamaticProductReport r
      JOIN DisamaticProduction p ON r.id = p.reportId
      OUTER APPLY (
        SELECT TOP 1 pouredWeight, castedWeight, cavity
        FROM Component comp
        WHERE comp.description = p.componentName
        ORDER BY CASE WHEN comp.isActive = 'Active' THEN 0 ELSE 1 END
      ) comp
      WHERE CAST(r.reportDate AS DATE) = CAST(${date} AS DATE) 
        AND r.disa = ${disa}
      GROUP BY r.shift
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ error: "Failed to fetch summary calculations", details: error.message });
  }
};

// ==========================================
//   FETCH DELAYS BY DATE & DISA
// ==========================================
exports.getDelaysByDateAndDisa = async (req, res) => {
  const { date, disa } = req.query;
  try {
    const result = await sql.query`
      SELECT 
        r.shift,
        d.durationMinutes AS duration,
        d.delay AS reason
      FROM DisamaticProductReport r
      JOIN DisamaticDelays d ON r.id = d.reportId
      WHERE CAST(r.reportDate AS DATE) = CAST(${date} AS DATE)
        AND r.disa = ${disa}
      ORDER BY r.shift, d.id
    `;
    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("Error fetching delays:", error);
    res.status(500).json({ error: "Failed to fetch delays", details: error.message });
  }
};

// ==========================================
//   FETCH USERS FOR DROPDOWNS BY ROLE
// ==========================================
exports.getFormUsers = async (req, res) => {
  try {
    const incharges = await sql.query`SELECT username as name FROM dbo.Users WHERE role = 'operator' ORDER BY username ASC`;
    const hofs = await sql.query`SELECT username as name FROM dbo.Users WHERE role = 'hof' ORDER BY username ASC`;
    const hods = await sql.query`SELECT username as name FROM dbo.Users WHERE role = 'hod' ORDER BY username ASC`;

    res.json({
      incharges: incharges.recordset,
      hofs: hofs.recordset,
      hods: hods.recordset
    });
  } catch (err) {
    console.error("Error fetching dropdown users:", err);
    res.status(500).json({ message: "DB Error fetching users" });
  }
};

// ==========================================
//   SUPERVISOR DASHBOARD - DAILY PERFORMANCE
// ==========================================
exports.getSupervisorReports = async (req, res) => {
  try {
    const { name } = req.params;
    // 🔥 FIXED: We fetch 'operatorSignature' but rename it to 'supervisorSignature' so the frontend understands it safely!
    const result = await sql.query`
      SELECT id, productionDate, disa, operatorSignature AS supervisorSignature, incharge, hof, hod 
      FROM DailyPerformanceReport 
      WHERE incharge = ${name}
      ORDER BY productionDate DESC, id DESC
    `;
    res.json(result.recordset);
  } catch (err) {
    console.error("Supervisor Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch Supervisor reports", details: err.message });
  }
};

exports.signSupervisor = async (req, res) => {
  try {
    const { reportId, signature } = req.body;
    // 🔥 FIXED: Saving the signature into the existing 'operatorSignature' column so SQL doesn't crash!
    await sql.query`UPDATE DailyPerformanceReport SET operatorSignature = ${signature} WHERE id = ${reportId}`;
    res.json({ message: "Supervisor signature saved successfully" });
  } catch (err) {
    console.error("Supervisor Sign Error:", err);
    res.status(500).json({ error: "Failed to save Supervisor signature", details: err.message });
  }
};

// ==========================================
//   HOF/HOD DASHBOARD - DAILY PERFORMANCE
// ==========================================
exports.getHofReports = async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT id, productionDate, disa, hofSignature, incharge, hod 
      FROM DailyPerformanceReport 
      WHERE hof = ${name}
      ORDER BY productionDate DESC, id DESC
    `;
    res.json(result.recordset);
  } catch (err) {
    console.error("HOF Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch HOF reports" });
  }
};

exports.signHof = async (req, res) => {
  try {
    const { reportId, signature } = req.body;
    await sql.query`UPDATE DailyPerformanceReport SET hofSignature = ${signature} WHERE id = ${reportId}`;
    res.json({ message: "HOF signature saved successfully" });
  } catch (err) {
    console.error("HOF Sign Error:", err);
    res.status(500).json({ error: "Failed to save HOF signature" });
  }
};

exports.getHodReports = async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT id, productionDate, disa, hodSignature, incharge, hof 
      FROM DailyPerformanceReport 
      WHERE hod = ${name}
      ORDER BY productionDate DESC, id DESC
    `;
    res.json(result.recordset);
  } catch (err) {
    console.error("HOD Fetch Error:", err);
    res.status(500).json({ error: "Failed to fetch HOD reports" });
  }
};

exports.signHod = async (req, res) => {
  try {
    const { reportId, signature } = req.body;
    await sql.query`UPDATE DailyPerformanceReport SET hodSignature = ${signature} WHERE id = ${reportId}`;
    res.json({ message: "HOD signature saved successfully" });
  } catch (err) {
    console.error("HOD Sign Error:", err);
    res.status(500).json({ error: "Failed to save HOD signature" });
  }
};

// ==========================================
//   FETCH COMPONENT TOTALS
// ==========================================
exports.getComponentTotals = async (req, res) => {
  const { date, disa, componentName } = req.query;
  try {
    const result = await sql.query`
      SELECT 
        ISNULL(SUM(TRY_CAST(p.produced AS INT)), 0) AS totalProduced,
        ISNULL(SUM(TRY_CAST(p.poured AS INT)), 0) AS totalPoured
      FROM DisamaticProductReport r
      JOIN DisamaticProduction p ON r.id = p.reportId
      WHERE CAST(r.reportDate AS DATE) = CAST(${date} AS DATE) 
        AND r.disa = ${disa}
        AND p.componentName = ${componentName}
    `;
    res.status(200).json(result.recordset[0]);
  } catch (error) {
    console.error("Error fetching component totals:", error);
    res.status(500).json({ error: "Failed to fetch component totals", details: error.message });
  }
};

// ==========================================
//   ADMIN: FETCH REPORT BY EXACT DATE & DISA
// ==========================================
exports.getByDate = async (req, res) => {
  const { date, disa } = req.query;
  if (!date) return res.status(400).json({ error: "date is required" });

  try {
    let reportsRes;
    if (disa) {
      const safeDisa = disa.replace('DISA - ', '').trim();
      reportsRes = await sql.query`
                SELECT * FROM DailyPerformanceReport 
                WHERE CAST(productionDate AS DATE) = CAST(${date} AS DATE) 
                AND (disa = ${safeDisa} OR disa = 'DISA - ' + ${safeDisa} OR disa = ${disa})
                ORDER BY id ASC`;
    } else {
      reportsRes = await sql.query`
                SELECT * FROM DailyPerformanceReport 
                WHERE CAST(productionDate AS DATE) = CAST(${date} AS DATE)
                ORDER BY id ASC`;
    }

    const reports = reportsRes.recordset;
    const result = [];
    for (const rep of reports) {
      const summary = (await sql.query`SELECT * FROM DailyPerformanceSummary WHERE reportId = ${rep.id}`).recordset;
      const details = (await sql.query`SELECT * FROM DailyPerformanceDetails WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      const delays = (await sql.query`SELECT * FROM Productiondelays WHERE reportId = ${rep.id} ORDER BY id ASC`).recordset;
      result.push({ ...rep, summary, details, delays });
    }
    res.json(result);
  } catch (err) {
    console.error("getByDate error:", err);
    res.status(500).json({ error: "Failed to fetch report by date", details: err.message });
  }
};

// ==========================================
//  ADMIN: UPDATE PERFORMANCE REPORT
// ==========================================
exports.updateReport = async (req, res) => {
  const { id } = req.params;
  const { summary, details, delays, unplannedReasons, incharge, hof, hod } = req.body;

  try {
    await sql.query`
            UPDATE DailyPerformanceReport 
            SET unplannedReasons = ${safeStr(unplannedReasons)},
                incharge = ${safeStr(incharge)},
                hof = ${safeStr(hof)},
                hod = ${safeStr(hod)}
            WHERE id = ${Number(id)}`;

    if (summary) {
      for (const shift of Object.keys(summary)) {
        const s = summary[shift];
        const existing = await sql.query`SELECT id FROM DailyPerformanceSummary WHERE reportId = ${Number(id)} AND shiftName = ${shift}`;
        if (existing.recordset.length > 0) {
          await sql.query`UPDATE DailyPerformanceSummary SET 
                        pouredMoulds = ${safeNum(s.pouredMoulds)},
                        tonnage = ${safeNum(s.tonnage)},
                        quantity = ${safeNum(s.quantity)},
                        casted = ${safeNum(s.casted)},
                        shiftValue = ${safeNum(s.value || s.shiftValue)}
                        WHERE reportId = ${Number(id)} AND shiftName = ${shift}`;
        }
      }
    }

    if (details && details.length > 0) {
      for (const d of details) {
        if (d.id) {
          await sql.query`UPDATE DailyPerformanceDetails SET
                        patternCode = ${safeStr(d.patternCode)},
                        itemDescription = ${safeStr(d.itemDescription)},
                        planned = ${safeNum(d.planned)},
                        unplanned = ${safeNum(d.unplanned)},
                        mouldsProd = ${safeNum(d.mouldsProd)},
                        mouldsPour = ${safeNum(d.mouldsPour)},
                        cavity = ${safeNum(d.cavity)},
                        unitWeight = ${safeNum(d.unitWeight)},
                        totalWeight = ${safeNum(d.totalWeight)}
                        WHERE id = ${Number(d.id)}`;
        }
      }
    }

    if (delays && delays.length > 0) {
      for (const d of delays) {
        if (d.id) {
          await sql.query`UPDATE Productiondelays SET
                        shift = ${safeStr(d.shift)},
                        duration = ${safeNum(d.duration)},
                        reason = ${safeStr(d.reason)}
                        WHERE id = ${Number(d.id)}`;
        }
      }
    }

    res.json({ message: "Report updated successfully" });
  } catch (err) {
    console.error("updateReport error:", err);
    res.status(500).json({ error: "Failed to update report", details: err.message });
  }
};


// ==========================================
//   🔥 BULK MULTI-PAGE PDF GENERATOR
// ==========================================
exports.downloadPDF = async (req, res) => {
  const { date, disa, fromDate, toDate } = req.query;

  if (!date && !fromDate) {
    return res.status(400).json({ message: "Date parameters are required." });
  }

  try {
    let qfHistory = [];
    try {
      const qfRes = await sql.query`
        SELECT qfValue, date 
        FROM PerformanceReportQFvalues 
        WHERE formName = 'performance' 
        ORDER BY date DESC, id DESC
      `;
      qfHistory = qfRes.recordset;
    } catch (e) {
      console.error("PerformanceReportQFvalues table error or not found.");
    }

    let reports = [];

    if (fromDate && toDate) {
      const reportQuery = await sql.query`
        SELECT * FROM DailyPerformanceReport 
        WHERE CAST(productionDate AS DATE) BETWEEN CAST(${fromDate} AS DATE) AND CAST(${toDate} AS DATE)
        ORDER BY productionDate ASC, disa ASC, id ASC
      `;
      reports = reportQuery.recordset;
    } else if (date && disa) {
      const safeDisa = disa.replace('DISA - ', '').trim();
      const reportQuery = await sql.query`
        SELECT TOP 1 * FROM DailyPerformanceReport 
        WHERE CAST(productionDate AS DATE) = CAST(${date} AS DATE) 
        AND (disa = ${safeDisa} OR disa = 'DISA - ' + ${safeDisa})
        ORDER BY id DESC
      `;
      reports = reportQuery.recordset;
    }

    if (!reports || reports.length === 0) {
      return res.status(200).json({ exists: false, message: "No reports found for this range." });
    }

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });
    
    const filename = (fromDate && toDate) 
        ? `Performance_Reports_${fromDate}_to_${toDate}.pdf` 
        : `Performance_Report_DISA-${disa}_${date}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    doc.pipe(res);

    const startX = 30;
    const tableWidth = 535;
    const pageBottom = 780;
    let currentY = 30;

    const checkPageBreak = (neededHeight) => {
      if (currentY + neededHeight > pageBottom) {
        doc.addPage();
        currentY = 30;
        return true;
      }
      return false;
    };

    const drawCell = (text, x, y, w, h, align = 'center', font = 'Helvetica', size = 9, isBold = false) => {
      doc.rect(x, y, w, h).stroke();
      if (text === null || text === undefined) text = "";
      let content = (text === 0) ? "0" : text.toString().trim();
      if (content === "") content = "-";

      let finalFont = (content === "-") ? 'Helvetica-Bold' : (isBold ? 'Helvetica-Bold' : font);
      let currentSize = size;
      doc.font(finalFont).fontSize(currentSize);

      let innerWidth = w - 4;
      let words = content.split(/[\s\n]+/);
      let maxWordWidth = Math.max(...words.map(word => doc.widthOfString(word)));
      while (maxWordWidth > innerWidth && currentSize > 5) {
        currentSize -= 0.5;
        doc.fontSize(currentSize);
        maxWordWidth = Math.max(...words.map(word => doc.widthOfString(word)));
      }

      const textHeight = doc.heightOfString(content, { width: innerWidth });
      const topPad = h > textHeight ? (h - textHeight) / 2 : 2;
      doc.fillColor('black').text(content, x + 2, y + topPad, { width: innerWidth, align: align });
    };

    for (let rIndex = 0; rIndex < reports.length; rIndex++) {
      const report = reports[rIndex];
      const reportId = report.id;
      const reportDateStr = new Date(report.productionDate).toISOString().split('T')[0];

      let currentPageQfValue = "QF/07/FBP-15, Rev.No:01 dt 10.06.2019"; 
      const currentReportDate = new Date(report.productionDate);
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

      const summaryData = (await sql.query`SELECT * FROM DailyPerformanceSummary WHERE reportId = ${reportId}`).recordset;
      const detailsData = (await sql.query`SELECT * FROM DailyPerformanceDetails WHERE reportId = ${reportId} ORDER BY id ASC`).recordset;
      const delaysData = (await sql.query`SELECT * FROM Productiondelays WHERE reportId = ${reportId} ORDER BY id ASC`).recordset;

      if (rIndex > 0) {
        doc.addPage();
        currentY = 30;
      }

      doc.rect(startX, currentY, tableWidth, 40).stroke();
      const logoPath = path.join(__dirname, 'logo.jpg');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 5, currentY + 5, { fit: [100, 30] });
      } else {
        doc.font('Helvetica-Bold').fontSize(12).text("SAKTHI AUTO\nCOMPONENT\nLIMITED", startX + 5, currentY + 5);
      }

      doc.moveTo(startX + 120, currentY).lineTo(startX + 120, currentY + 40).stroke();
      doc.font('Helvetica-Bold').fontSize(14).text("DAILY PRODUCTION PERFORMANCE (FOUNDRY - B)", startX + 120, currentY + 15, { width: 415, align: 'center' });
      currentY += 40;

      doc.rect(startX, currentY, tableWidth, 20).stroke();
      doc.font('Helvetica-Bold').fontSize(10).text(`DATE OF PRODUCTION : ${reportDateStr.split('-').reverse().join('-')}            DISA: ${report.disa}`, startX + 5, currentY + 6);
      currentY += 20;

      const sumCols = [
        { w: 45, l: 'SHIFT' }, 
        { w: 90, l: 'POURED MOULDS' }, 
        { w: 100, l: 'TONNAGE' }, 
        { w: 100, l: 'QUANTITY' }, 
        { w: 100, l: 'CASTED' }, 
        { w: 100, l: 'VALUE' }
      ];
      let xHeaderPos = startX;
      sumCols.forEach(col => {
        drawCell(col.l, xHeaderPos, currentY, col.w, 20, 'center', 'Helvetica', 9, true);
        xHeaderPos += col.w;
      });
      currentY += 20;
      let tMoulds = 0, tTonnage = 0, tQuantity = 0, tCasted = 0, tValue = 0;
      ["I", "II", "III"].forEach(shiftName => {
        const row = summaryData.find(s => s.shiftName === shiftName) || {};
        tMoulds += Number(row.pouredMoulds) || 0;
        tTonnage += Number(row.tonnage) || 0;
        tQuantity += Number(row.quantity) || 0;
        tCasted += Number(row.casted) || 0;
        tValue += Number(row.shiftValue) || 0;
 
        let xPos = startX;
        drawCell(shiftName, xPos, currentY, sumCols[0].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[0].w;
        drawCell(row.pouredMoulds > 0 ? row.pouredMoulds : "-", xPos, currentY, sumCols[1].w, 20); xPos += sumCols[1].w;
        drawCell(row.tonnage > 0 ? Number(row.tonnage).toFixed(3) : "-", xPos, currentY, sumCols[2].w, 20); xPos += sumCols[2].w;
        drawCell(row.quantity > 0 ? row.quantity : "-", xPos, currentY, sumCols[3].w, 20); xPos += sumCols[3].w;
        drawCell(row.casted > 0 ? Number(row.casted).toFixed(0) : "-", xPos, currentY, sumCols[4].w, 20); xPos += sumCols[4].w;
        drawCell(row.shiftValue > 0 ? Number(row.shiftValue).toFixed(2) : "-", xPos, currentY, sumCols[5].w, 20);
        currentY += 20;
      });

      let xPos = startX;
      drawCell("TOTAL", xPos, currentY, sumCols[0].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[0].w;
      drawCell(tMoulds > 0 ? tMoulds : "-", xPos, currentY, sumCols[1].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[1].w;
      drawCell(tTonnage > 0 ? tTonnage.toFixed(3) : "-", xPos, currentY, sumCols[2].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[2].w;
      drawCell(tQuantity > 0 ? tQuantity : "-", xPos, currentY, sumCols[3].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[3].w;
      drawCell(tCasted > 0 ? tCasted.toFixed(0) : "-", xPos, currentY, sumCols[4].w, 20, 'center', 'Helvetica', 9, true); xPos += sumCols[4].w;
      drawCell(tValue > 0 ? tValue.toFixed(2) : "-", xPos, currentY, sumCols[5].w, 20, 'center', 'Helvetica', 9, true);
      currentY += 30;

      const detCols = [{ w: 25 }, { w: 90 }, { w: 100 }, { w: 35 }, { w: 35 }, { w: 45 }, { w: 45 }, { w: 25 }, { w: 135 }];

      const drawDetailsHeader = () => {
        checkPageBreak(50);
        let x = startX;
        drawCell("Sl.\nNo.", x, currentY, detCols[0].w, 30, 'center', 'Helvetica', 8, true); x += detCols[0].w;
        drawCell("Pattern Code", x, currentY, detCols[1].w, 30, 'center', 'Helvetica', 8, true); x += detCols[1].w;
        drawCell("Item Description", x, currentY, detCols[2].w, 30, 'center', 'Helvetica', 8, true); x += detCols[2].w;

        drawCell("Item", x, currentY, detCols[3].w + detCols[4].w, 15, 'center', 'Helvetica', 8, true);
        drawCell("Planned", x, currentY + 15, detCols[3].w, 15, 'center', 'Helvetica', 6.5);
        drawCell("Un\nPlanned", x + detCols[3].w, currentY + 15, detCols[4].w, 15, 'center', 'Helvetica', 6.5);
        x += detCols[3].w + detCols[4].w;

        drawCell("Number of\nMoulds Prod.", x, currentY, detCols[5].w, 30, 'center', 'Helvetica', 7, true); x += detCols[5].w;
        drawCell("Number of\nMoulds Pour.", x, currentY, detCols[6].w, 30, 'center', 'Helvetica', 7, true); x += detCols[6].w;
        drawCell("No. of\nCavity", x, currentY, detCols[7].w, 30, 'center', 'Helvetica', 7, true); x += detCols[7].w;
        drawCell("Poured WT (Kg)", x, currentY, detCols[8].w, 30, 'center', 'Helvetica', 8, true);
        currentY += 30;
      };

      drawDetailsHeader();

      let detMouldsProdSum = 0, detMouldsPourSum = 0, detTotalWeightSum = 0;

      if (detailsData.length === 0) {
        doc.rect(startX, currentY, tableWidth, 20).stroke();
        drawCell("No production data recorded", startX, currentY, tableWidth, 20);
        currentY += 20;
      } else {
        detailsData.forEach((d, i) => {
          detMouldsProdSum += Number(d.mouldsProd) || 0;
          detMouldsPourSum += Number(d.mouldsPour) || 0;
          detTotalWeightSum += Number(d.totalWeight) || 0;

          let rawPattern = d.patternCode || "-";
          let safeDesc = d.itemDescription || "-";

          doc.fontSize(8);
          let innerPatW = detCols[1].w - 4;

          let safePattern = rawPattern;
          if (rawPattern.includes('-') && !rawPattern.includes(' ')) {
            let parts = rawPattern.split('-');
            let lines = [];
            let currentLine = parts[0];
            for (let p = 1; p < parts.length; p++) {
              let testLine = currentLine + '-' + parts[p];
              if (doc.widthOfString(testLine) > innerPatW) {
                lines.push(currentLine + '-');
                currentLine = parts[p];
              } else {
                currentLine = testLine;
              }
            }
            lines.push(currentLine);
            safePattern = lines.join('\n');
          }

          let maxH = 20;
          let descH = doc.heightOfString(safeDesc, { width: detCols[2].w - 4 });
          let patH = doc.heightOfString(safePattern, { width: innerPatW });

          if (descH + 10 > maxH) maxH = descH + 10;
          if (patH + 10 > maxH) maxH = patH + 10;

          if (checkPageBreak(maxH)) {
            drawDetailsHeader();
          }

          let rowX = startX;
          drawCell(i + 1, rowX, currentY, detCols[0].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[0].w;
          drawCell(safePattern, rowX, currentY, detCols[1].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[1].w;
          drawCell(safeDesc, rowX, currentY, detCols[2].w, maxH, 'left', 'Helvetica', 8); rowX += detCols[2].w;
          drawCell(d.planned === 0 ? "-" : d.planned, rowX, currentY, detCols[3].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[3].w;
          drawCell(d.unplanned === 0 ? "-" : d.unplanned, rowX, currentY, detCols[4].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[4].w;
          drawCell(d.mouldsProd === 0 ? "-" : d.mouldsProd, rowX, currentY, detCols[5].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[5].w;
          drawCell(d.mouldsPour === 0 ? "-" : d.mouldsPour, rowX, currentY, detCols[6].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[6].w;
          drawCell(d.cavity === 0 ? "-" : d.cavity, rowX, currentY, detCols[7].w, maxH, 'center', 'Helvetica', 8); rowX += detCols[7].w;
          drawCell(d.totalWeight === 0 ? "-" : d.totalWeight, rowX, currentY, detCols[8].w, maxH, 'center', 'Helvetica', 8); 
          currentY += maxH;
        });
      }

      checkPageBreak(20);
      xPos = startX;
      const offsetW = detCols[0].w + detCols[1].w + detCols[2].w + detCols[3].w + detCols[4].w;
      doc.rect(xPos, currentY, offsetW, 20).stroke();
      drawCell("TOTAL", xPos, currentY, offsetW, 20, 'center', 'Helvetica', 9, true);
      xPos += offsetW;

      drawCell(detMouldsProdSum || "-", xPos, currentY, detCols[5].w, 20, 'center', 'Helvetica', 9, true); xPos += detCols[5].w;
      drawCell(detMouldsPourSum || "-", xPos, currentY, detCols[6].w, 20, 'center', 'Helvetica', 9, true); xPos += detCols[6].w;
      drawCell("-", xPos, currentY, detCols[7].w, 20); xPos += detCols[7].w;
      drawCell(detTotalWeightSum > 0 ? Math.round(detTotalWeightSum) : "-", xPos, currentY, detCols[8].w, 20, 'center', 'Helvetica', 9, true);
      currentY += 30;

      checkPageBreak(80);
      doc.rect(startX, currentY, tableWidth, 40).stroke();
      doc.font('Helvetica-Bold').fontSize(8).text("Reasons for producing un-planned items.", startX + 5, currentY + 5);
      doc.font('Helvetica').text(report.unplannedReasons || "-", startX + 5, currentY + 15, { width: tableWidth - 10 });
      currentY += 40;

      doc.rect(startX, currentY, tableWidth, 50).stroke();

      // 🔥 FIXED: Rendering supervisorSignature using the old operatorSignature DB column mapping
      if (report.operatorSignature && report.operatorSignature.startsWith('data:image')) {
        try {
          const imgBuffer = Buffer.from(report.operatorSignature.split('base64,')[1], 'base64');
          doc.image(imgBuffer, startX + 20, currentY + 5, { fit: [100, 25] });
        } catch (e) { }
      }
      if (report.hofSignature && report.hofSignature.startsWith('data:image')) {
        try {
          const imgBuffer = Buffer.from(report.hofSignature.split('base64,')[1], 'base64');
          doc.image(imgBuffer, startX + 220, currentY + 5, { fit: [100, 25] });
        } catch (e) { }
      }
      if (report.hodSignature && report.hodSignature.startsWith('data:image')) {
        try {
          const imgBuffer = Buffer.from(report.hodSignature.split('base64,')[1], 'base64');
          doc.image(imgBuffer, startX + 400, currentY + 5, { fit: [100, 25] });
        } catch (e) { }
      }

      doc.font('Helvetica-Bold').fontSize(9);
      doc.text(`Supervisor: ${report.incharge || "-"}`, startX + 20, currentY + 35);
      doc.text(`HOF: ${report.hof || "-"}`, startX + 220, currentY + 35);
      doc.text(`HOD - Production: ${report.hod || "-"}`, startX + 400, currentY + 35);
      currentY += 50;

      currentY += 15;
      checkPageBreak(20);
      doc.font('Helvetica').fontSize(8).fillColor('black');
      
      doc.text(currentPageQfValue, startX, currentY);

      // 🔥 PAGE 2: PRODUCTION DELAYS 🔥
      doc.addPage();
      currentY = 30;

      const groupedDelaysMap = {};
      let totalI = 0, totalII = 0, totalIII = 0, totalDuration = 0;

      delaysData.forEach(d => {
        const reason = d.reason || "-";
        const shift = d.shift;
        const dur = Number(d.duration) || 0;

        if (!groupedDelaysMap[reason]) {
          groupedDelaysMap[reason] = { I: 0, II: 0, III: 0, total: 0 };
        }
        if (shift === "I") { groupedDelaysMap[reason].I += dur; totalI += dur; }
        else if (shift === "II") { groupedDelaysMap[reason].II += dur; totalII += dur; }
        else if (shift === "III") { groupedDelaysMap[reason].III += dur; totalIII += dur; }
        
        groupedDelaysMap[reason].total += dur;
        totalDuration += dur;
      });

      const groupedDelaysArray = Object.keys(groupedDelaysMap).map(reason => ({
        reason,
        ...groupedDelaysMap[reason]
      }));

      const delayCols = [
        { w: 35, l: 'S.No.' }, 
        { w: 230, l: 'Reasons' }, 
        { w: 60, l: 'Shift I' }, 
        { w: 60, l: 'Shift II' }, 
        { w: 60, l: 'Shift III' }, 
        { w: 90, l: 'Total (Mins)' }
      ];

      const drawDelaysHeader = () => {
        checkPageBreak(40);
        doc.rect(startX, currentY, tableWidth, 20).fillAndStroke('#e5e7eb', 'black');
        doc.fillColor('black').font('Helvetica-Bold').fontSize(10);
        doc.text("Production delays / Remarks", startX, currentY + 6, { width: tableWidth, align: 'center' });
        currentY += 20;

        let x = startX;
        delayCols.forEach(c => {
          drawCell(c.l, x, currentY, c.w, 20, 'center', 'Helvetica', 9, true);
          x += c.w;
        });
        currentY += 20;
      };

      drawDelaysHeader();

      if (groupedDelaysArray.length === 0) {
        doc.rect(startX, currentY, tableWidth, 20).stroke();
        drawCell("-", startX, currentY, tableWidth, 20);
        currentY += 20;
      } else {
        groupedDelaysArray.forEach((d, i) => {
          let maxH = 20;
          doc.fontSize(9);
          let rsnH = doc.heightOfString(d.reason || "-", { width: delayCols[1].w - 4 });
          if (rsnH + 10 > maxH) maxH = rsnH + 10;

          if (checkPageBreak(maxH)) {
            drawDelaysHeader();
          }

          let rX = startX;
          drawCell(i + 1, rX, currentY, delayCols[0].w, maxH); rX += delayCols[0].w;
          drawCell(d.reason || "-", rX, currentY, delayCols[1].w, maxH, 'left'); rX += delayCols[1].w;
          drawCell(d.I > 0 ? d.I : "-", rX, currentY, delayCols[2].w, maxH); rX += delayCols[2].w;
          drawCell(d.II > 0 ? d.II : "-", rX, currentY, delayCols[3].w, maxH); rX += delayCols[3].w;
          drawCell(d.III > 0 ? d.III : "-", rX, currentY, delayCols[4].w, maxH); rX += delayCols[4].w;
          drawCell(d.total > 0 ? d.total : "-", rX, currentY, delayCols[5].w, maxH, 'center', 'Helvetica-Bold', 9, true);
          currentY += maxH;
        });

        if (checkPageBreak(20)) drawDelaysHeader();
        let tX = startX;
        doc.rect(tX, currentY, delayCols[0].w + delayCols[1].w, 20).stroke();
        drawCell("TOTAL", tX, currentY, delayCols[0].w + delayCols[1].w, 20, 'center', 'Helvetica', 9, true);
        tX += delayCols[0].w + delayCols[1].w;
        drawCell(totalI > 0 ? totalI : "-", tX, currentY, delayCols[2].w, 20, 'center', 'Helvetica', 9, true); tX += delayCols[2].w;
        drawCell(totalII > 0 ? totalII : "-", tX, currentY, delayCols[3].w, 20, 'center', 'Helvetica', 9, true); tX += delayCols[3].w;
        drawCell(totalIII > 0 ? totalIII : "-", tX, currentY, delayCols[4].w, 20, 'center', 'Helvetica', 9, true); tX += delayCols[4].w;
        drawCell(totalDuration > 0 ? totalDuration : "-", tX, currentY, delayCols[5].w, 20, 'center', 'Helvetica', 9, true);
        currentY += 20;
      }

      currentY += 15;
      checkPageBreak(20);
      doc.font('Helvetica').fontSize(8).fillColor('black');
      doc.text(currentPageQfValue, startX, currentY);
    }

    doc.end();

  } catch (error) {
    console.error("PDF Generation Error:", error);
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
};