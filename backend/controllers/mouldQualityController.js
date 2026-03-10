const sql = require("../db");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

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

// --- SAVE REPORT ---
exports.saveReport = async (req, res) => {
  const { recordDate, disaMachine, verifiedBy, operatorSignature, approvedBy, rows } = req.body;
  const transaction = new sql.Transaction();
  await transaction.begin();

  try {
    const headerReq = new sql.Request(transaction);
    const headerRes = await headerReq.query`
      INSERT INTO MouldQualityReport (reportDate, disaMachine, verifiedBy, operatorSignature, approvedBy, status)
      OUTPUT INSERTED.id
      VALUES (${recordDate}, ${disaMachine}, ${verifiedBy}, ${operatorSignature}, ${approvedBy}, 'Pending')
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

// --- SUPERVISOR DASHBOARD ---
exports.getSupervisorReports = async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT id, reportDate, disaMachine, verifiedBy, status 
      FROM MouldQualityReport 
      WHERE approvedBy = ${name} 
      ORDER BY reportDate DESC, id DESC
    `;
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ message: "DB error" });
  }
};

exports.signSupervisor = async (req, res) => {
  try {
    const { reportId, signature } = req.body;
    await sql.query`
      UPDATE MouldQualityReport 
      SET supervisorSignature = ${signature}, status = 'Completed' 
      WHERE id = ${reportId}
    `;
    res.json({ message: "Signed successfully" });
  } catch (err) {
    res.status(500).json({ message: "DB error" });
  }
};

// --- PDF GENERATOR (WITH 3-BOX HEADER) ---
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
    
    // BOX 1: LOGO (Width: 100)
    doc.rect(startX, y, 100, 40).stroke();
    
    const logoPath = path.join(__dirname, 'logo.jpg');

    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, startX + 10, y + 5, { width: 80, height: 30, fit: [80, 30], align: 'center', valign: 'center' });
    } else {
        doc.font("Helvetica-Bold").fontSize(12).text("SAKTHI\nAUTO", startX, y + 10, { width: 100, align: "center" });
    }

    // BOX 2: TITLE (Width: 500)
    doc.rect(startX + 100, y, 500, 40).stroke();
    doc.font("Helvetica-Bold").fontSize(14).text("SAKTHI AUTO COMPONENT LIMITED", startX + 100, y + 8, { width: 500, align: "center" });
    doc.fontSize(12).text("MOULDING QUALITY INSPECTION REPORT", startX + 100, y + 24, { width: 500, align: "center" });

    // BOX 3: META DATA (Width: 120)
    const displayDate = new Date(header.reportDate).toLocaleDateString('en-GB');
    doc.rect(startX + 600, y, 120, 40).stroke();
    doc.font("Helvetica-Bold").fontSize(11).text(header.disaMachine || '-', startX + 600, y + 7, { width: 120, align: "center" });
    doc.moveTo(startX + 600, y + 20).lineTo(startX + 720, y + 20).stroke(); 
    doc.font("Helvetica").fontSize(10).text(`DATE: ${displayDate}`, startX + 600, y + 26, { width: 120, align: "center" });

    y += 55; 
    // ==============================================================

    const colWidths = [25, 30, 80, 45, 35, 35, 35, 35, 35, 35, 35, 35, 35, 45, 30, 25, 25, 25, 25, 25, 25];
    
    const drawTableHeaders = (startY) => {
        let cy = startY;
        
        doc.fontSize(7).font("Helvetica-Bold");
        doc.rect(startX, cy, 25, 55).stroke(); doc.text("S.No", startX, cy + 25, { width: 25, align: "center" });
        doc.rect(startX + 25, cy, 30, 55).stroke(); doc.text("Shift", startX + 25, cy + 25, { width: 30, align: "center" });
        doc.rect(startX + 55, cy, 80, 55).stroke(); doc.text("Part Name", startX + 55, cy + 25, { width: 80, align: "center" });
        
        doc.rect(startX + 135, cy, 45, 55).stroke(); 
        doc.text("Data\nCode", startX + 135, cy + 20, { width: 45, align: "center" });
        
        doc.rect(startX + 180, cy, 210, 15).stroke(); doc.text("First Moulding", startX + 180, cy + 5, { width: 210, align: "center" });
        doc.rect(startX + 390, cy, 330, 15).stroke(); doc.text("During Running", startX + 390, cy + 5, { width: 330, align: "center" });

        let cy2 = cy + 15;
        let cx = startX + 180;
        
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
        cx = startX + 570; 
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
            doc.text(val || "-", x + 2, rowY + 10, { width: colWidths[i] - 4, align: "center" });
            x += colWidths[i];
        });
        rowY += 25;
    });

    const sigY = rowY + 20;
    doc.font("Helvetica-Bold").fontSize(10);
    
    doc.text(`Verified By: ${header.verifiedBy}`, startX, sigY);
    if (header.operatorSignature && header.operatorSignature.startsWith('data:image')) {
        try { doc.image(Buffer.from(header.operatorSignature.split(',')[1], 'base64'), startX, sigY + 15, { fit: [100, 30] }); } catch(e){}
    }

    doc.text(`Approved By: ${header.approvedBy}`, startX + 570, sigY);
    if (header.supervisorSignature && header.supervisorSignature.startsWith('data:image')) {
        try { doc.image(Buffer.from(header.supervisorSignature.split(',')[1], 'base64'), startX + 570, sigY + 15, { fit: [100, 30] }); } catch(e){}
    } else {
        doc.fillColor('red').text("Pending", startX + 570, sigY + 20);
    }

    doc.end();
  } catch (err) {
    console.error("PDF Error:", err);
    res.status(500).json({ message: "PDF generation failed" });
  }
};

// ==========================================
//   ADMIN EDIT & BULK APIS
// ==========================================

// 1. Fetch by Date & Machine for Admin Edit
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

// 2. Update Report from Admin Edit
exports.updateReport = async (req, res) => {
  const { id } = req.params;
  const { verifiedBy, approvedBy, rows } = req.body;
  const transaction = new sql.Transaction();
  await transaction.begin();

  try {
    await new sql.Request(transaction).query`
      UPDATE MouldQualityReport 
      SET verifiedBy = ${verifiedBy}, approvedBy = ${approvedBy}
      WHERE id = ${id}
    `;

    await new sql.Request(transaction).query`DELETE FROM MouldQualityRows WHERE reportId = ${id}`;

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

// 3. Get Bulk Data for Admin PDF Export
exports.getBulkData = async (req, res) => {
    const { fromDate, toDate } = req.query;
    try {
        const reportsRes = await sql.query`
            SELECT * FROM MouldQualityReport 
            WHERE CAST(reportDate AS DATE) BETWEEN CAST(${fromDate} AS DATE) AND CAST(${toDate} AS DATE) 
            ORDER BY reportDate ASC, disaMachine ASC
        `;
        const reports = reportsRes.recordset;
        const result = [];
        
        for (let rep of reports) {
            const rowsRes = await sql.query`SELECT * FROM MouldQualityRows WHERE reportId = ${rep.id} ORDER BY id ASC`;
            result.push({ ...rep, rows: rowsRes.recordset });
        }
        res.json(result);
    } catch(err) {
        console.error(err);
        res.status(500).json({ message: "Bulk data failed" });
    }
};