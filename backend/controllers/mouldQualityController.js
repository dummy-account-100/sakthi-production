const sql = require("../db");
const PDFDocument = require("pdfkit");

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

// --- PDF GENERATOR (🔥 FIXED TEXT OVERLAP) ---
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

    // --- Header ---
    doc.font("Helvetica-Bold").fontSize(16).text("SAKTHI AUTO COMPONENT LIMITED", startX, y, { align: "center", width: 720 });
    doc.fontSize(14).text("MOULDING QUALITY INSPECTION REPORT", startX, y + 20, { align: "center", width: 720 });
    
    const displayDate = new Date(header.reportDate).toLocaleDateString('en-GB');
    doc.fontSize(10).text(`Machine: ${header.disaMachine || '-'}`, startX, y + 45);
    doc.text(`Date: ${displayDate}`, startX + 570, y + 45, { align: "right", width: 150 });
    
    y += 65;

    // Table settings
    const colWidths = [25, 30, 80, 45, 35, 35, 35, 35, 35, 35, 35, 35, 35, 45, 30, 25, 25, 25, 25, 25, 25];
    
    // Header Drawing Function
    const drawTableHeaders = (startY) => {
        let cy = startY;
        
        // Row 1 (Top Level)
        doc.fontSize(7).font("Helvetica-Bold");
        doc.rect(startX, cy, 25, 55).stroke(); doc.text("S.No", startX, cy + 25, { width: 25, align: "center" });
        doc.rect(startX + 25, cy, 30, 55).stroke(); doc.text("Shift", startX + 25, cy + 25, { width: 30, align: "center" });
        doc.rect(startX + 55, cy, 80, 55).stroke(); doc.text("Part Name", startX + 55, cy + 25, { width: 80, align: "center" });
        
        doc.rect(startX + 135, cy, 45, 55).stroke(); 
        doc.text("Data\nCode", startX + 135, cy + 20, { width: 45, align: "center" }); // Native wrapping
        
        doc.rect(startX + 180, cy, 210, 15).stroke(); doc.text("First Moulding", startX + 180, cy + 5, { width: 210, align: "center" });
        doc.rect(startX + 390, cy, 330, 15).stroke(); doc.text("During Running", startX + 390, cy + 5, { width: 330, align: "center" });

        // Row 2 (Middle Level)
        let cy2 = cy + 15;
        let cx = startX + 180;
        
        // 🔥 FIX: Reduce font size slightly so text fits without clipping
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

        // 🔥 FIX: Passed as single strings with \n so PDFKit perfectly centers all three lines
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

        // Row 3 (Bottom Level for PP/SP)
        let cy3 = cy2 + 25; 
        cx = startX + 570; 
        doc.fontSize(7); // Back to normal size
        for(let i=0; i<3; i++) {
            doc.rect(cx, cy3, 25, 15).stroke(); doc.text("PP", cx, cy3 + 5, { width: 25, align: "center" }); cx += 25;
            doc.rect(cx, cy3, 25, 15).stroke(); doc.text("SP", cx, cy3 + 5, { width: 25, align: "center" }); cx += 25;
        }

        return cy + 55; 
    };

    let rowY = drawTableHeaders(y);

    // --- Draw Rows ---
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

    // --- Footer Signatures ---
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