const sql = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

// 🔥 Helper for backend PDF generation
const getDynamicQfString = (recordDate, qfHistory, defaultFallback) => {
    if (!qfHistory || qfHistory.length === 0) return defaultFallback;
    const targetDate = new Date(recordDate || new Date());
    targetDate.setHours(0, 0, 0, 0);

    for (const qf of qfHistory) {
        if (!qf.date) continue;
        const qfDate = new Date(qf.date);
        qfDate.setHours(0, 0, 0, 0);
        if (qfDate <= targetDate) {
            return qf.qfValue;
        }
    }
    return qfHistory[qfHistory.length - 1].qfValue || defaultFallback;
};

// --- GET USERS FOR DROPDOWNS ---
exports.getUsers = async (req, res) => {
  try {
    const ops = await sql.query`SELECT username as name FROM dbo.Users WHERE role = 'operator' ORDER BY username ASC`;
    const sups = await sql.query`SELECT username as name FROM dbo.Users WHERE role = 'supervisor' ORDER BY username ASC`;
    res.json({ operators: ops.recordset, supervisors: sups.recordset });
  } catch (err) {
    res.status(500).json({ message: "DB error" });
  }
};

// --- GET COMPONENTS FOR PART NAME DROPDOWN ---
exports.getComponents = async (req, res) => {
  try {
    const result = await sql.query`SELECT description FROM dbo.Component ORDER BY description ASC`;
    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching components:", err);
    res.status(500).json({ message: "DB error" });
  }
};

// --- CHECK EXISTING DATA BY DATE, MACHINE, AND SHIFT ---
exports.checkExisting = async (req, res) => {
  try {
    const { date, disa, shift } = req.query;

    // Look for a report header on this date/machine that possesses rows matching the requested shift
    const headerRes = await sql.query`
      SELECT TOP 1 h.* 
      FROM MouldQualityReport h
      JOIN MouldQualityRows r ON h.id = r.reportId
      WHERE CAST(h.reportDate AS DATE) = CAST(${date} AS DATE) 
        AND h.disaMachine = ${disa}
        AND r.shift = ${shift}
      ORDER BY h.id DESC
    `;

    if (headerRes.recordset.length === 0) return res.json(null);
    
    const report = headerRes.recordset[0];
    
    // Fetch ONLY the rows for the selected shift 
    const rowsRes = await sql.query`
      SELECT * FROM MouldQualityRows 
      WHERE reportId = ${report.id} AND shift = ${shift} 
      ORDER BY id ASC
    `;
    
    res.json({ ...report, rows: rowsRes.recordset });
  } catch (err) {
    console.error("Check existing error:", err);
    res.status(500).json({ message: "DB error" });
  }
};

// --- SAVE REPORT ---
exports.saveReport = async (req, res) => {
  const { recordDate, disaMachine, verifiedBy, approvedBy, operatorSignature, rows } = req.body;
  const transaction = new sql.Transaction();
  await transaction.begin();

  try {
    const headerReq = new sql.Request(transaction);
    const headerRes = await headerReq.query`
      INSERT INTO MouldQualityReport (reportDate, disaMachine, verifiedBy, approvedBy, status, operatorSignature, supervisorSignature)
      OUTPUT INSERTED.id
      VALUES (${recordDate}, ${disaMachine}, ${verifiedBy}, ${approvedBy}, 'Pending', ${operatorSignature || 'APPROVED'}, NULL)
    `;
    const reportId = headerRes.recordset[0].id;

    for (const r of rows) {
      const rowReq = new sql.Request(transaction);
      await rowReq.query`
        INSERT INTO MouldQualityRows (
          reportId, sNo, shift, partName, dataCode, fmSoftRamming, fmMouldBreakage, fmMouldCrack, fmLooseSand, fmPatternSticking, fmCoreSetting,
          drMouldCrush, drLooseSand, drPatternSticking, drDateHeatCode, drFilterSize, drSurfaceHardnessPP, drSurfaceHardnessSP,
          drInsideMouldPP, drInsideMouldSP, drPatternTempPP, drPatternTempSP
        ) VALUES (
          ${reportId}, ${r.sNo}, ${r.shift}, ${r.partName}, ${r.dataCode}, ${r.fmSoftRamming}, ${r.fmMouldBreakage}, ${r.fmMouldCrack}, ${r.fmLooseSand}, ${r.fmPatternSticking}, ${r.fmCoreSetting},
          ${r.drMouldCrush}, ${r.drLooseSand}, ${r.drPatternSticking}, ${r.drDateHeatCode}, ${r.drFilterSize}, ${r.drSurfaceHardnessPP}, ${r.drSurfaceHardnessSP},
          ${r.drInsideMouldPP}, ${r.drInsideMouldSP}, ${r.drPatternTempPP}, ${r.drPatternTempSP}
        )
      `;
    }

    await transaction.commit();
    res.json({ success: true, message: "Report Saved!" });
  } catch (err) {
    await transaction.rollback();
    console.error(err);
    res.status(500).json({ message: "Save failed" });
  }
};

// --- UPDATE REPORT (Enhanced) ---
exports.updateReport = async (req, res) => {
  const { id } = req.params;
  const { recordDate, disaMachine, verifiedBy, approvedBy, operatorSignature, rows } = req.body;
  const transaction = new sql.Transaction();
  await transaction.begin();

  try {
    // 1. Update the Header properties
    await new sql.Request(transaction).query`
      UPDATE MouldQualityReport 
      SET reportDate = ${recordDate}, 
          disaMachine = ${disaMachine}, 
          verifiedBy = ${verifiedBy}, 
          approvedBy = ${approvedBy}, 
          operatorSignature = ${operatorSignature || 'APPROVED'}, 
          status = 'Pending'
      WHERE id = ${id}
    `;

    // 2. Identify the Shift being updated
    const activeShift = rows[0]?.shift || 'I';

    // 3. Delete ONLY the rows for the currently edited Shift
    await new sql.Request(transaction).query`
        DELETE FROM MouldQualityRows 
        WHERE reportId = ${id} AND shift = ${activeShift}
    `;

    // 4. Insert the updated rows
    for (const r of rows) {
      await new sql.Request(transaction).query`
        INSERT INTO MouldQualityRows (
          reportId, sNo, shift, partName, dataCode, fmSoftRamming, fmMouldBreakage, fmMouldCrack, fmLooseSand, fmPatternSticking, fmCoreSetting,
          drMouldCrush, drLooseSand, drPatternSticking, drDateHeatCode, drFilterSize, drSurfaceHardnessPP, drSurfaceHardnessSP,
          drInsideMouldPP, drInsideMouldSP, drPatternTempPP, drPatternTempSP
        ) VALUES (
          ${id}, ${r.sNo}, ${r.shift}, ${r.partName}, ${r.dataCode}, ${r.fmSoftRamming}, ${r.fmMouldBreakage}, ${r.fmMouldCrack}, ${r.fmLooseSand}, ${r.fmPatternSticking}, ${r.fmCoreSetting},
          ${r.drMouldCrush}, ${r.drLooseSand}, ${r.drPatternSticking}, ${r.drDateHeatCode}, ${r.drFilterSize}, ${r.drSurfaceHardnessPP}, ${r.drSurfaceHardnessSP},
          ${r.drInsideMouldPP}, ${r.drInsideMouldSP}, ${r.drPatternTempPP}, ${r.drPatternTempSP}
        )
      `;
    }

    await transaction.commit();
    res.json({ success: true, message: "Updated Successfully" });
  } catch (err) {
    await transaction.rollback();
    console.error(err);
    res.status(500).json({ message: "Update failed" });
  }
};

// --- SUPERVISOR DASHBOARD ---
exports.getSupervisorReports = async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT id, reportDate, disaMachine, verifiedBy, status, supervisorSignature 
      FROM MouldQualityReport 
      WHERE approvedBy = ${name} 
      ORDER BY reportDate DESC, id DESC
    `;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "DB error" });
  }
};

// --- SIGN SUPERVISOR ---
exports.signSupervisor = async (req, res) => {
  try {
    const { reportId, signature } = req.body;
    await sql.query`
      UPDATE MouldQualityReport 
      SET supervisorSignature = ${signature || 'APPROVED'}, status = 'Completed' 
      WHERE id = ${reportId}
    `;
    res.json({ message: "Signed successfully" });
  } catch (err) {
    res.status(500).json({ message: "DB error" });
  }
};

// --- PDF GENERATOR ---
exports.generateReport = async (req, res) => {
  try {
    const { reportId, date, disaMachine } = req.query;
    
    let headerRes;
    if (reportId) {
        headerRes = await sql.query`SELECT * FROM MouldQualityReport WHERE id = ${reportId}`;
    } else if (date && disaMachine) {
        headerRes = await sql.query`
            SELECT TOP 1 * FROM MouldQualityReport 
            WHERE CAST(reportDate AS DATE) = CAST(${date} AS DATE) AND disaMachine = ${disaMachine} 
            ORDER BY id DESC
        `;
    } else {
        return res.status(400).send("Missing parameters for PDF generation.");
    }

    if (headerRes.recordset.length === 0) {
        return res.status(404).send("Report not found. Please click 'Submit to Supervisor' before downloading the PDF.");
    }

    const header = headerRes.recordset[0];
    const rowsRes = await sql.query`SELECT * FROM MouldQualityRows WHERE reportId = ${header.id} ORDER BY id ASC`;
    const rows = rowsRes.recordset;

    // 🔥 FETCH QF HISTORY 🔥
    let qfHistory = [];
    try {
        const qfReq = new sql.Request();
        const qfRes = await qfReq.query(`SELECT qfValue, date FROM MouldQualityQFvalues WHERE formName = 'mould-quality' ORDER BY date DESC, id DESC`);
        qfHistory = qfRes.recordset;
    } catch(e) {}

    const doc = new PDFDocument({ margin: 20, size: "A4", layout: "landscape", bufferPages: true });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Moulding_Quality_${header.id}.pdf"`);
    doc.pipe(res);

    const startX = 40; 
    let y = 30;

    // ==============================================================
    // 🔥 3-BOX HEADER DESIGN 
    // ==============================================================
    doc.lineWidth(1);
    
    // BOX 1: LOGO
    doc.rect(startX, y, 100, 40).stroke();
    const logoPath = path.join(__dirname, 'logo.jpg');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 10, y + 5, { width: 80, height: 30, fit: [80, 30], align: 'center', valign: 'center' });
    } else {
        doc.font("Helvetica-Bold").fontSize(12).text("SAKTHI\nAUTO", startX, y + 10, { width: 100, align: "center" });
    }

    // BOX 2: TITLE
    doc.rect(startX + 100, y, 500, 40).stroke();
    doc.font("Helvetica-Bold").fontSize(14).text("SAKTHI AUTO COMPONENT LIMITED", startX + 100, y + 8, { width: 500, align: "center" });
    doc.fontSize(12).text("MOULDING QUALITY INSPECTION REPORT", startX + 100, y + 24, { width: 500, align: "center" });

    // BOX 3: META DATA
    const displayDate = new Date(header.reportDate).toLocaleDateString('en-GB');
    doc.rect(startX + 600, y, 120, 40).stroke();
    doc.font("Helvetica-Bold").fontSize(11).text(header.disaMachine || '-', startX + 600, y + 7, { width: 120, align: "center" });
    doc.moveTo(startX + 600, y + 20).lineTo(startX + 720, y + 20).stroke(); 
    doc.font("Helvetica").fontSize(10).text(`DATE: ${displayDate}`, startX + 600, y + 26, { width: 120, align: "center" });

    y += 55; 

    const colWidths = [25, 30, 140, 45, 35, 35, 35, 35, 35, 35, 35, 35, 35, 45, 30, 25, 25, 25, 25, 25, 25];
    
    const drawTableHeaders = (startY) => {
        let cy = startY;
        doc.fontSize(7).font("Helvetica-Bold");
        doc.rect(startX, cy, 25, 55).stroke(); doc.text("S.No", startX, cy + 25, { width: 25, align: "center" });
        doc.rect(startX + 25, cy, 30, 55).stroke(); doc.text("Shift", startX + 25, cy + 25, { width: 30, align: "center" });
        
        doc.rect(startX + 55, cy, 140, 55).stroke(); doc.text("Part Name", startX + 55, cy + 25, { width: 140, align: "center" }); 
        
        doc.rect(startX + 195, cy, 45, 55).stroke(); doc.text("Data\nCode", startX + 195, cy + 20, { width: 45, align: "center" });
        
        doc.rect(startX + 240, cy, 210, 15).stroke(); doc.text("First Moulding", startX + 240, cy + 5, { width: 210, align: "center" });
        doc.rect(startX + 450, cy, 330, 15).stroke(); doc.text("During Running", startX + 450, cy + 5, { width: 330, align: "center" });

        let cy2 = cy + 15;
        let cx = startX + 240; 
        doc.fontSize(6);
        
        const l2Single = [
            { label: "Soft\nRam", w: 35 }, { label: "Mould\nBreakage", w: 35 }, { label: "Mould\nCrack", w: 35 },
            { label: "Loose\nSand", w: 35 }, { label: "Pattern\nSticking", w: 35 }, { label: "Core\nSetting", w: 35 },
            { label: "Mould\nCrush", w: 35 }, { label: "Loose\nSand", w: 35 }, { label: "Pattern\nSticking", w: 35 },
            { label: "Heat\nCode", w: 45 }, { label: "Filter\nSize", w: 30 }
        ];
        l2Single.forEach(h => {
            doc.rect(cx, cy2, h.w, 40).stroke();
            doc.text(h.label, cx, cy2 + 15, { width: h.w, align: "center" });
            cx += h.w;
        });

        const l2Double = [
            { label: "Surface\nHardness\n(Min 85)", w: 50 },
            { label: "Inside\nPenetrant\n(Min 20)", w: 50 },
            { label: "Pattern\nTemp\n(Min 45C)", w: 50 }
        ];
        l2Double.forEach(h => {
            doc.rect(cx, cy2, h.w, 25).stroke(); 
            doc.text(h.label, cx, cy2 + 3, { width: h.w, align: "center" });
            cx += h.w;
        });

        let cy3 = cy2 + 25; 
        cx = startX + 630; 
        doc.fontSize(7);
        for(let i=0; i<3; i++) {
            doc.rect(cx, cy3, 25, 15).stroke(); doc.text("PP", cx, cy3 + 5, { width: 25, align: "center" }); cx += 25;
            doc.rect(cx, cy3, 25, 15).stroke(); doc.text("SP", cx, cy3 + 5, { width: 25, align: "center" }); cx += 25;
        }

        return cy + 55; 
    };

    let rowY = drawTableHeaders(y);

    doc.font("Helvetica").fontSize(7);
    rows.forEach(r => {
        if (rowY + 25 > doc.page.height - 60) {
            doc.addPage();
            rowY = drawTableHeaders(30);
            doc.font("Helvetica").fontSize(7);
        }

        const rowData = [
            r.sNo, r.shift, r.partName, r.dataCode,
            r.fmSoftRamming, r.fmMouldBreakage, r.fmMouldCrack, r.fmLooseSand, r.fmPatternSticking, r.fmCoreSetting,
            r.drMouldCrush, r.drLooseSand, r.drPatternSticking, r.drDateHeatCode, r.drFilterSize,
            r.drSurfaceHardnessPP, r.drSurfaceHardnessSP, r.drInsideMouldPP, r.drInsideMouldSP, r.drPatternTempPP, r.drPatternTempSP
        ];

        let x = startX;
        rowData.forEach((val, i) => {
            doc.rect(x, rowY, colWidths[i], 25).stroke();
            doc.text(String(val || "-"), x + 2, rowY + 10, { width: colWidths[i] - 4, align: "center" });
            x += colWidths[i];
        });
        rowY += 25;
    });

    const sigY = rowY + 20;
    doc.font("Helvetica-Bold").fontSize(10);
    
    // --- OPERATOR SIGNATURE UPDATE ---
    doc.text(`Verified By: ${header.verifiedBy || '-'}`, startX, sigY);
    if (header.IsOperatorApproved === true || header.IsOperatorApproved === 1 || header.operatorSignature === "APPROVED") {
        doc.lineWidth(2).strokeColor('#008000');
        doc.moveTo(startX + 2, sigY + 22).lineTo(startX + 6, sigY + 26).lineTo(startX + 14, sigY + 14).stroke();
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#008000').text("APPROVED", startX + 20, sigY + 16);
        doc.fillColor('black'); doc.font('Helvetica-Bold').fontSize(10); 
    } else if (header.operatorSignature && header.operatorSignature.startsWith('data:image')) {
        try { doc.image(Buffer.from(header.operatorSignature.split(',')[1], 'base64'), startX, sigY + 15, { fit: [100, 30] }); } catch(e){}
    }

    // --- SUPERVISOR SIGNATURE UPDATE ---
    const supX = doc.page.width - 200;
    doc.text(`Approved By: ${header.approvedBy || '-'}`, supX, sigY);
    
    if (header.IsSupervisorApproved === true || header.IsSupervisorApproved === 1 || header.supervisorSignature === "APPROVED") {
        doc.lineWidth(2).strokeColor('#008000');
        doc.moveTo(supX + 2, sigY + 22).lineTo(supX + 6, sigY + 26).lineTo(supX + 14, sigY + 14).stroke();
        doc.font('Helvetica-Bold').fontSize(12).fillColor('#008000').text("APPROVED", supX + 20, sigY + 16);
        doc.fillColor('black'); doc.font('Helvetica-Bold').fontSize(10);
    } else if (header.supervisorSignature && header.supervisorSignature.startsWith('data:image')) {
        try { doc.image(Buffer.from(header.supervisorSignature.split(',')[1], 'base64'), supX, sigY + 15, { fit: [100, 30] }); } catch(e){}
    } else {
        doc.font('Helvetica').fontSize(10).fillColor('red');
        doc.text("Pending", supX, sigY + 15);
        doc.fillColor('black');
    }

    // 🔥 DYNAMIC QF VALUE 🔥
    const dynamicQfString = getDynamicQfString(header.reportDate, qfHistory, "QF/07/MOU-06, Rev. No.02 Dt 01.01.2023");
    
    doc.font('Helvetica').fontSize(8).fillColor('black');
    doc.text(dynamicQfString, startX, doc.page.height - 30, { align: "left" });

    doc.end();
  } catch (err) {
    console.error("PDF Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "PDF generation failed" });
    }
  }
};

// ==========================================
//   ADMIN EDIT & BULK APIS
// ==========================================

exports.getByDate = async (req, res) => {
  try {
    const { date, disa } = req.query;
    const headerRes = await sql.query`
        SELECT * FROM MouldQualityReport 
        WHERE CAST(reportDate AS DATE) = CAST(${date} AS DATE) AND disaMachine = ${disa} 
        ORDER BY id DESC
    `;
    
    if (headerRes.recordset.length === 0) return res.json(null);
    
    const report = headerRes.recordset[0];
    const rowsRes = await sql.query`SELECT * FROM MouldQualityRows WHERE reportId = ${report.id} ORDER BY id ASC`;
    
    res.json({ ...report, rows: rowsRes.recordset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
};

exports.getBulkData = async (req, res) => {
    const { fromDate, toDate } = req.query;
    try {
        const reportsRes = await sql.query`
            SELECT * FROM MouldQualityReport 
            WHERE CAST(reportDate AS DATE) BETWEEN CAST(${fromDate} AS DATE) AND CAST(${toDate} AS DATE) 
            ORDER BY reportDate ASC, disaMachine ASC
        `;
        const reports = reportsRes.recordset;
        const records = [];
        
        for (let rep of reports) {
            const rowsRes = await sql.query`SELECT * FROM MouldQualityRows WHERE reportId = ${rep.id} ORDER BY id ASC`;
            records.push({ ...rep, rows: rowsRes.recordset });
        }

        // 🔥 FETCH QF HISTORY
        let qfHistory = [];
        try {
            const qfRes = await sql.query`SELECT qfValue, date FROM MouldQualityQFvalues WHERE formName = 'mould-quality' ORDER BY date DESC, id DESC`;
            qfHistory = qfRes.recordset;
        } catch(e) { console.error("MouldQualityQFvalues fetch error"); }

        res.json({ records, qfHistory });
    } catch(err) {
        console.error(err);
        res.status(500).json({ message: "Bulk data failed" });
    }
};