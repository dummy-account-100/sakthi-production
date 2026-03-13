const express = require("express");
const router = express.Router();
const sql = require("mssql");
const PDFDocument = require("pdfkit");
const fs = require('fs');
const path = require('path');

// GET next S.No
router.get("/next-sno", async (req, res) => {
  try {
    const result = await sql.query`SELECT ISNULL(MAX(sNo), 0) + 1 AS nextSNo FROM ReactionPlan`;
    res.json({ nextSNo: result.recordset[0].nextSNo });
  } catch (err) {
    console.error("Next SNo Error:", err);
    res.status(500).json({ message: "DB error" });
  }
});

// GET Operators, Supervisors, HOFs from Users table
router.get("/incharges", async (req, res) => {
  try {
    const ops = await sql.query`SELECT username as name FROM dbo.Users WHERE role = 'operator' ORDER BY username ASC`;
    const sups = await sql.query`SELECT username as name FROM dbo.Users WHERE role = 'supervisor' ORDER BY username ASC`;
    const hofs = await sql.query`SELECT username as name FROM dbo.Users WHERE role = 'hof' ORDER BY username ASC`;
    res.json({ operators: ops.recordset, supervisors: sups.recordset, hofs: hofs.recordset });
  } catch (err) {
    res.status(500).json({ message: "DB error" });
  }
});

// INSERT Verification
router.post("/add-verification", async (req, res) => {
  const { line, errorProofName, natureOfErrorProof, frequency, recordDate, shift, observationResult, verifiedBy, reviewedBy, operatorSignature, assignedHOF } = req.body;
  try {
    await sql.query`
      INSERT INTO ErrorProofVerification (line, errorProofName, natureOfErrorProof, frequency, recordDate, shift, observationResult, verifiedBy, reviewedBy, OperatorSignature, AssignedHOF)
      VALUES (${line}, ${errorProofName}, ${natureOfErrorProof}, ${frequency}, ${recordDate}, ${shift}, ${observationResult}, ${verifiedBy}, ${reviewedBy}, ${operatorSignature}, ${assignedHOF})
    `;
    res.json({ message: "Verification saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Insert failed" });
  }
});

// INSERT Reaction Plan
router.post("/add-reaction", async (req, res) => {
  const { sNo, errorProofNo, errorProofName, recordDate, shift, problem, rootCause, correctiveAction, status, reviewedBy, approvedBy, remarks } = req.body;
  try {
    await sql.query`
      INSERT INTO ReactionPlan (sNo, errorProofNo, errorProofName, recordDate, shift, problem, rootCause, correctiveAction, status, reviewedBy, approvedBy, remarks)
      VALUES (${sNo}, ${errorProofNo}, ${errorProofName}, ${recordDate}, ${shift}, ${problem}, ${rootCause}, ${correctiveAction}, ${status}, ${reviewedBy}, ${approvedBy}, ${remarks})
    `;
    res.json({ message: "Reaction Plan saved" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Insert failed" });
  }
});

// ==========================================
//        SUPERVISOR DASHBOARD APIS 
// ==========================================
router.get("/supervisor/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
        SELECT 
          r.sNo as VerificationId, 
          r.errorProofName as ErrorProofName, 
          r.status as Status, 
          r.problem as Problem, 
          r.correctiveAction as CorrectiveAction, 
          r.recordDate, 
          e.line as DisaMachine 
        FROM ReactionPlan r
        LEFT JOIN ErrorProofVerification e ON r.recordDate = e.recordDate AND r.errorProofName = e.errorProofName
        WHERE r.approvedBy = ${name}
        ORDER BY r.recordDate DESC
      `;
    res.json(result.recordset);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

router.post("/sign-supervisor", async (req, res) => {
  try {
    const { reactionPlanId, signature } = req.body;
    if (!reactionPlanId) {
      return res.status(400).json({ message: "Missing ID for signature update" });
    }
    await sql.query`
        UPDATE ReactionPlan 
        SET SupervisorSignature = ${signature}, status = 'Completed' 
        WHERE sNo = ${reactionPlanId}
      `;
    res.json({ message: "Signature saved successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// ==========================================
//        HOF DASHBOARD APIS 
// ==========================================
router.get('/hof/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT recordDate as reportDate, line as disa, AssignedHOF as hofName,
             (SELECT TOP 1 HOFSignature FROM ErrorProofVerification t2 WHERE t2.recordDate = t1.recordDate AND t2.line = t1.line AND t2.AssignedHOF = t1.AssignedHOF) as hofSignature
      FROM ErrorProofVerification t1
      WHERE AssignedHOF = ${name}
      GROUP BY recordDate, line, AssignedHOF
      ORDER BY recordDate DESC
    `;
    res.json(result.recordset);
  } catch (error) { res.status(500).json({ error: "Failed to fetch HOF reports" }); }
});

router.post('/sign-hof', async (req, res) => {
  try {
    const { date, line, signature } = req.body;
    await sql.query`
      UPDATE ErrorProofVerification 
      SET HOFSignature = ${signature} 
      WHERE recordDate = ${date} AND line = ${line}
    `;
    res.json({ message: "Signature saved successfully" });
  } catch (error) { res.status(500).json({ error: "Failed to save HOF signature" }); }
});

// ==========================================
//        PDF GENERATOR LOGIC (PERFECT ALIGNMENT)
// ==========================================
router.get("/report", async (req, res) => {
  try {
    const { line, date } = req.query;

    const fDate = date ? new Date(date) : null;
    const headerDate = fDate && !isNaN(fDate) ? `${String(fDate.getDate()).padStart(2, '0')}/${String(fDate.getMonth() + 1).padStart(2, '0')}/${fDate.getFullYear()}` : 'MULTIPLE';
    const headerLine = line || 'ALL LINES';

    const request = new sql.Request();
    let verificationQuery = `SELECT * FROM ErrorProofVerification`;
    let reactionQuery = `SELECT * FROM ReactionPlan`;

    if (line && date) {
      verificationQuery += ` WHERE line = @line AND recordDate = @date`;
      request.input('line', sql.VarChar, line);
      request.input('date', sql.Date, date);
    } else if (line) {
      verificationQuery += ` WHERE line = @line`;
      request.input('line', sql.VarChar, line);
    }

    verificationQuery += ` ORDER BY recordDate ASC, id ASC`;
    reactionQuery += ` ORDER BY sNo ASC`;

    const verificationResult = await request.query(verificationQuery);
    const reactionResult = await request.query(reactionQuery);

    if (verificationResult.recordset.length === 0) {
      return res.status(404).send("Report not found. Please click 'Save & Assign' before downloading the PDF.");
    }

    let qfHistory = [];
    try {
        const qfRes = await sql.query`SELECT qfValue, date FROM ErrorProof1QFvalues WHERE formName = 'error-proof' ORDER BY date DESC, id DESC`;
        qfHistory = qfRes.recordset;
    } catch(e) {}

    let currentPageQfValue = "QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023"; 
    if (fDate) {
        fDate.setHours(0,0,0,0);
        for (let qf of qfHistory) {
            if (!qf.date) continue;
            const qfDate = new Date(qf.date);
            qfDate.setHours(0,0,0,0);
            if (qfDate <= fDate) {
                currentPageQfValue = qf.qfValue;
                break;
            }
        }
    }

    const marginOptions = { top: 30, bottom: 20, left: 30, right: 30 };
    // Initialize standard A4 landscape for the first section
    const doc = new PDFDocument({ margins: marginOptions, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=Error_Proof_Check_List.pdf");
    doc.pipe(res);

    const startX = 30;
    const startY = 30;

    const getISODate = (dateStr) => {
      const d = new Date(dateStr);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    };

    const findLogo = () => {
      const possiblePaths = [
        path.join(__dirname, "logo.png"),
        path.join(__dirname, "logo.jpg"),
        path.join(__dirname, "../Assets/logo.png"),
        path.join(__dirname, "../../Assets/logo.png"),
        path.join(__dirname, "../src/Assets/logo.png")
      ];
      for (let p of possiblePaths) {
        if (fs.existsSync(p)) return p;
      }
      return null;
    };
    const actualLogoPath = findLogo();

    // =========================================================
    // 🔥 DYNAMIC HEADER LOGIC (Adapts to A4 or A3)
    // =========================================================
    const draw3BoxHeader = (y, mainTitle) => {
      const currentWidth = doc.page.width - (startX * 2); // Dynamically fetched
      const logoBoxWidth = 100;
      const metaBoxWidth = 150;
      const titleBoxWidth = currentWidth - logoBoxWidth - metaBoxWidth;
      const headerHeight = 40;

      doc.lineWidth(1);

      doc.rect(startX, y, logoBoxWidth, headerHeight).stroke();
      if (actualLogoPath) {
          doc.image(actualLogoPath, startX + 10, y + 5, {
              width: 80, height: 30, fit: [80, 30], align: 'center', valign: 'center'
          });
      } else {
          doc.font("Helvetica-Bold").fontSize(12).fillColor('black').text("SAKTHI\nAUTO", startX, y + 10, { width: logoBoxWidth, align: "center" });
      }

      doc.rect(startX + logoBoxWidth, y, titleBoxWidth, headerHeight).stroke();
      doc.font("Helvetica-Bold").fontSize(14).fillColor('black').text("SAKTHI AUTO COMPONENT LIMITED", startX + logoBoxWidth, y + 8, { width: titleBoxWidth, align: "center" });
      doc.fontSize(12).text(mainTitle, startX + logoBoxWidth, y + 24, { width: titleBoxWidth, align: "center" });

      doc.rect(startX + logoBoxWidth + titleBoxWidth, y, metaBoxWidth, headerHeight).stroke();
      doc.font("Helvetica-Bold").fontSize(11).text(headerLine, startX + logoBoxWidth + titleBoxWidth, y + 7, { width: metaBoxWidth, align: "center" });
      
      doc.moveTo(startX + logoBoxWidth + titleBoxWidth, y + 20).lineTo(startX + currentWidth, y + 20).stroke();
      let dateText = headerDate === 'MULTIPLE' ? "ALL DATES" : `DATE: ${headerDate}`;
      doc.font("Helvetica").fontSize(9).text(dateText, startX + logoBoxWidth + titleBoxWidth, y + 26, { width: metaBoxWidth, align: "center" });

      return y + headerHeight + 5;
    };

    const drawMainHeaders = (y, targetDateStr) => {
      const headerTopY = draw3BoxHeader(y, "ERROR PROOF VERIFICATION CHECK LIST - FDY");
      const currentWidth = doc.page.width - (startX * 2);

      const wLine = 45, wName = 135, wNature = 160, wFreq = 65;
      const wDateBox = currentWidth - wLine - wName - wNature - wFreq; 

      doc.rect(startX, headerTopY, wLine, 60).stroke();
      doc.font("Helvetica-Bold").fontSize(10).fillColor('black');
      doc.text("Line", startX, headerTopY + 25, { width: wLine, align: "center" });

      let cx = startX + wLine;
      doc.rect(cx, headerTopY, wName, 60).stroke();
      doc.text("Error Proof\nName", cx, headerTopY + 20, { width: wName, align: "center" });

      cx += wName;
      doc.rect(cx, headerTopY, wNature, 60).stroke();
      doc.text("Nature of\nError Proof", cx, headerTopY + 20, { width: wNature, align: "center" });

      cx += wNature;
      doc.rect(cx, headerTopY, wFreq, 60).stroke();
      doc.text("Frequency\nS,D,W,M", cx, headerTopY + 15, { width: wFreq, align: "center" });

      cx += wFreq;
      
      const boxX = cx;
      doc.rect(boxX, headerTopY, wDateBox, 20).stroke();
      let dateLabel = targetDateStr ? `Date: ${formatDate(targetDateStr)}` : "Date:";

      doc.font("Helvetica-Bold").fontSize(9);
      doc.text(dateLabel, boxX + 2, headerTopY + 5, { width: wDateBox, align: "left" });

      doc.rect(boxX, headerTopY + 20, wDateBox, 40).stroke();
      doc.fontSize(8);
      doc.text("Observation Result", boxX, headerTopY + 35, { width: wDateBox, align: "center" });

      return headerTopY + 60;
    };

    const allRecords = verificationResult.recordset;
    const allUniqueDates = [...new Set(allRecords.map(r => getISODate(r.recordDate)))].sort();
    const lastDateArr = allUniqueDates.slice(-1);

    const filteredRecords = allRecords.filter(r => lastDateArr.includes(getISODate(r.recordDate)));

    const uniqueProofsMap = new Map();
    filteredRecords.forEach(r => {
      if (!uniqueProofsMap.has(r.errorProofName)) {
        uniqueProofsMap.set(r.errorProofName, { line: r.line, nature: r.natureOfErrorProof, frequency: r.frequency });
      }
    });
    const uniqueProofs = Array.from(uniqueProofsMap.keys());

    const dateChunks = lastDateArr.length > 0 ? [lastDateArr] : [[]];
    let y = startY;

    dateChunks.forEach((chunk, chunkIndex) => {
      if (chunkIndex > 0) { doc.addPage({ size: 'A4', layout: "landscape", margin: 30 }); y = startY; }
      y = drawMainHeaders(y, chunk[0]);

      const currentWidth = doc.page.width - (startX * 2);
      const wLine = 45, wName = 135, wNature = 160, wFreq = 65;
      const wDateBox = currentWidth - wLine - wName - wNature - wFreq; 

      uniqueProofs.forEach((proofName) => {
        const proofData = uniqueProofsMap.get(proofName);

        doc.font("Helvetica").fontSize(8);
        const nameHeight = doc.heightOfString(proofName || "", { width: wName - 8, align: "center" });
        const natureHeight = doc.heightOfString(proofData.nature || "", { width: wNature - 8, align: "center" });
        const freqHeight = doc.heightOfString(proofData.frequency || "", { width: wFreq - 8, align: "center" });
        let rowHeight = Math.max(50, nameHeight + 20, natureHeight + 20, freqHeight + 20);

        if (y + rowHeight > doc.page.height - 120) {
          doc.addPage({ size: 'A4', layout: "landscape", margin: 30 });
          y = drawMainHeaders(30, chunk[0]);
        }

        let cx = startX;
        doc.rect(cx, y, wLine, rowHeight).stroke();
        doc.text(proofData.line || "", cx + 2, y + (rowHeight / 2 - 5), { width: wLine - 4, align: "center" });
        cx += wLine;

        doc.rect(cx, y, wName, rowHeight).stroke();
        doc.text(proofName || "", cx + 4, y + 10, { width: wName - 8, align: "center" });
        cx += wName;

        doc.rect(cx, y, wNature, rowHeight).stroke();
        doc.text(proofData.nature || "", cx + 4, y + 10, { width: wNature - 8, align: "center" });
        cx += wNature;

        doc.rect(cx, y, wFreq, rowHeight).stroke();
        doc.text(proofData.frequency || "", cx + 4, y + 10, { width: wFreq - 8, align: "center" });
        cx += wFreq;

        doc.rect(cx, y, wDateBox, rowHeight).stroke(); 

        if (chunk.length > 0) {
          const dateStr = chunk[0];
          const recordsForDateAndProof = filteredRecords.filter(r => getISODate(r.recordDate) === dateStr && r.errorProofName === proofName);

          if (recordsForDateAndProof.length > 0) {
            const record = recordsForDateAndProof[0];
            const targetX = cx;
            const targetY = y + (rowHeight / 2) - 8;

            doc.fontSize(8);
            if (record.observationResult === "OK") {
              doc.text("Checked OK", targetX, targetY, { width: wDateBox, align: "center" });
            } else if (record.observationResult === "NOT_OK") {
              doc.text("Checked Not OK", targetX, targetY, { width: wDateBox, align: "center" });
            }
          }
        }

        y += rowHeight;
      });

      const sigY = y + 20;
      if (sigY + 80 > doc.page.height - 40) { doc.addPage({ size: 'A4', layout: "landscape", margin: 30 }); y = 30; }

      doc.font("Helvetica-Bold").fontSize(10).fillColor('black');
      doc.text("Verified By Moulding Incharge", startX, sigY);
      doc.rect(startX, sigY + 8, 180, 45).stroke();

      doc.text("Reviewed By HOF", startX + 350, sigY);
      doc.rect(startX + 350, sigY + 8, 180, 45).stroke();

      const latestRecordWithOpSig = filteredRecords.find(r => r.OperatorSignature);
      const latestRecordWithHofSig = filteredRecords.find(r => r.HOFSignature);

      if (latestRecordWithOpSig && latestRecordWithOpSig.OperatorSignature.includes('base64,')) {
        try {
          const imgBuffer = Buffer.from(latestRecordWithOpSig.OperatorSignature.split('base64,')[1], 'base64');
          doc.image(imgBuffer, startX + 5, sigY + 12, { fit: [170, 37] });
        } catch (e) { }
      }

      if (latestRecordWithHofSig && latestRecordWithHofSig.HOFSignature.includes('base64,')) {
        try {
          const imgBuffer = Buffer.from(latestRecordWithHofSig.HOFSignature.split('base64,')[1], 'base64');
          doc.image(imgBuffer, startX + 355, sigY + 12, { fit: [170, 37] });
        } catch(e) {}
      }
    });

    // =========================================================
    // PART B: REACTION PLAN TABLE (🔥 LARGER A3 PAGE FOR PERFECT FIT)
    // =========================================================
    const notOkProofNames = new Set(
      filteredRecords
        .filter(r => r.observationResult === 'NOT_OK')
        .map(r => r.errorProofName)
    );
    const filteredReactions = reactionResult.recordset.filter(r =>
      lastDateArr.includes(getISODate(r.recordDate)) && notOkProofNames.has(r.errorProofName)
    );

    if (filteredReactions.length > 0) {
      // 🔥 CRITICAL FIX: Upgrading to A3 Size (1190.55 width) for Reaction Plan to provide massive room
      doc.addPage({ size: 'A3', layout: "landscape", margin: 30 });

      const currentA3Width = doc.page.width - 60; 

      // 🔥 Percentages that map beautifully to 1130.55 points
      // Array mapped to: [S.No, EpNo, Name, Date, Prob, Root, Corrective, Status, RevBy, AppBy, Remarks]
      const rColWeights = [3, 4, 12, 6, 14, 14, 15, 6, 8, 8, 10]; // Sums to 100
      const rColWidths = rColWeights.map(weight => (weight / 100) * currentA3Width);

      const drawReactionHeaders = (ry) => {
        const headerY = draw3BoxHeader(ry, "REACTION PLAN");
        
        doc.font("Helvetica-Bold").fontSize(10).fillColor('black');
        const rHeaders = ["S.No", "Error\nProof No", "Error proof\nName", "Date", "Problem", "Root Cause", "Corrective\naction", "Status", "Reviewed\nBy (Op)", "Approved By\n(Sup)", "Remarks"];

        let currX = startX;
        rHeaders.forEach((h, i) => {
          doc.rect(currX, headerY, rColWidths[i], 40).stroke();
          doc.text(h, currX + 2, headerY + 10, { width: rColWidths[i] - 4, align: "center" });
          currX += rColWidths[i];
        });
        return headerY + 40;
      };

      let ry = drawReactionHeaders(30);

      filteredReactions.forEach((rRow, index) => {
        doc.font("Helvetica").fontSize(9).fillColor('black');

        const dDate = new Date(rRow.recordDate);
        const dateStr = !isNaN(dDate) ? `${String(dDate.getDate()).padStart(2, '0')}/${String(dDate.getMonth() + 1).padStart(2, '0')}/${dDate.getFullYear()}` : "";

        // 🔥 CRITICAL FIX: Use current font explicitly before calculating height 🔥
        const hName = doc.heightOfString(rRow.errorProofName || "-", { width: rColWidths[2] - 8, align: "center" });
        const hProb = doc.heightOfString(rRow.problem || "-", { width: rColWidths[4] - 8, align: "center" });
        const hRoot = doc.heightOfString(rRow.rootCause || "-", { width: rColWidths[5] - 8, align: "center" });
        const hCorr = doc.heightOfString(rRow.correctiveAction || "-", { width: rColWidths[6] - 8, align: "center" });
        const hRem = doc.heightOfString(rRow.remarks || "-", { width: rColWidths[10] - 8, align: "center" });

        // Row height matches the tallest paragraph with 20px padding
        let rRowHeight = Math.max(40, hName + 20, hProb + 20, hRoot + 20, hCorr + 20, hRem + 20);

        // Safe pagination checking dynamic page height
        if (ry + rRowHeight > doc.page.height - 40) {
          doc.addPage({ size: 'A3', layout: "landscape", margin: 30 });
          ry = drawReactionHeaders(30);
        }

        const rowData = [
          (index + 1).toString(), rRow.errorProofNo || "-", rRow.errorProofName || "-", dateStr, rRow.problem || "-", rRow.rootCause || "-",
          rRow.correctiveAction || "-", rRow.status || "-", rRow.reviewedBy || "-", rRow.SupervisorSignature || rRow.approvedBy || "-", rRow.remarks || "-"
        ];

        let currX = startX;
        rowData.forEach((cellText, i) => {
          doc.rect(currX, ry, rColWidths[i], rRowHeight).stroke();

          if (i === 9 && cellText && String(cellText).startsWith('data:image')) {
            try {
              const imgBuffer = Buffer.from(cellText.split('base64,')[1], 'base64');
              doc.image(imgBuffer, currX + 2, ry + 2, { fit: [rColWidths[i] - 4, rRowHeight - 4] });
            } catch (e) { }
          } else {
            // Push text to the top for larger columns
            const alignTop = [2, 4, 5, 6, 10].includes(i);
            const textY = alignTop ? ry + 5 : ry + (rRowHeight / 2) - 4;

            if (i === 7) {
              if (String(cellText).toLowerCase() === 'completed') { doc.fillColor('green').font("Helvetica-Bold"); }
              else if (String(cellText).toLowerCase() === 'pending') { doc.fillColor('red').font("Helvetica-Bold"); }
              else { doc.fillColor('black').font("Helvetica"); }
            } else {
              doc.fillColor('black').font("Helvetica");
            }

            doc.text(String(cellText || "-"), currX + 4, textY, { width: rColWidths[i] - 8, align: "center" });
            doc.fillColor('black').font("Helvetica");
          }
          currX += rColWidths[i];
        });

        ry += rRowHeight;
      });
    }

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < (range.start + range.count); i++) {
      doc.switchToPage(i);
      doc.font("Helvetica-Bold").fontSize(9).fillColor('black');
      // Render text at the bottom dynamically based on the current page's height
      doc.text(currentPageQfValue, 30, doc.page.height - 35, { align: "left", lineBreak: false });
    }

    doc.end();
  } catch (err) {
    console.error("Error generating report:", err);
    res.status(500).json({ message: "Report generation failed" });
  }
});

// ==========================================
//        ADMIN EDIT & BULK APIS (NEW)
// ==========================================

router.get("/details", async (req, res) => {
  try {
    const { machine, date } = req.query;
    const verifications = await sql.query`
        SELECT * FROM ErrorProofVerification 
        WHERE line = ${machine} AND recordDate = ${date}
    `;

    const reactionPlans = await sql.query`
        SELECT * FROM ReactionPlan 
        WHERE recordDate = ${date} 
        AND errorProofName IN (
            SELECT errorProofName FROM ErrorProofVerification WHERE line = ${machine} AND recordDate = ${date}
        )
    `;

    res.json({
      verifications: verifications.recordset,
      reactionPlans: reactionPlans.recordset
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

router.get("/v1-by-date", async (req, res) => {
  try {
    const { date } = req.query;
    const request = new sql.Request();
    request.input('searchDate', sql.Date, date);

    const verifications = await request.query(
      `SELECT * FROM ErrorProofVerification 
       WHERE CONVERT(date, recordDate) = CONVERT(date, @searchDate)
       ORDER BY line ASC, id ASC`
    );

    const request2 = new sql.Request();
    request2.input('searchDate', sql.Date, date);
    const reactionPlans = await request2.query(
      `SELECT * FROM ReactionPlan 
       WHERE CONVERT(date, recordDate) = CONVERT(date, @searchDate)
       ORDER BY errorProofNo ASC, sNo ASC`
    );

    res.json({
      verifications: verifications.recordset,
      reactionPlans: reactionPlans.recordset
    });
  } catch (err) {
    console.error("v1-by-date error:", err);
    res.status(500).json({ message: "DB error" });
  }
});

router.post("/bulk-update", async (req, res) => {
  try {
    const { verifications, reactionPlans, deletedProofNames, date } = req.body;

    for (let v of verifications) {
      if (v.id) {
        await sql.query`
                UPDATE ErrorProofVerification 
                SET observationResult = ${v.observationResult} 
                WHERE id = ${v.id}
            `;
      }
    }

    for (let rp of reactionPlans) {
      if (rp.sNo) {
        await sql.query`
                UPDATE ReactionPlan 
                SET problem = ${rp.problem}, 
                    rootCause = ${rp.rootCause}, 
                    correctiveAction = ${rp.correctiveAction}, 
                    status = ${rp.status}, 
                    remarks = ${rp.remarks} 
                WHERE sNo = ${rp.sNo}
            `;
      }
    }

    if (deletedProofNames && deletedProofNames.length > 0 && date) {
      for (let proofName of deletedProofNames) {
        await sql.query`
          DELETE FROM ReactionPlan 
          WHERE errorProofName = ${proofName}
            AND CONVERT(date, recordDate) = CONVERT(date, ${date})
        `;
      }
    }

    res.json({ success: true, message: "Updated Successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

router.get('/bulk-data', async (req, res) => {
  try {
    const { fromDate, toDate } = req.query;

    const verifications = await sql.query`
        SELECT * FROM ErrorProofVerification 
        WHERE recordDate BETWEEN ${fromDate} AND ${toDate}
        ORDER BY recordDate ASC, id ASC
    `;

    const plans = await sql.query`
        SELECT * FROM ReactionPlan 
        WHERE recordDate BETWEEN ${fromDate} AND ${toDate}
        ORDER BY recordDate ASC, sNo ASC
    `;

    let qfHistory = [];
    try {
        const qfRes = await sql.query`SELECT qfValue, date FROM ErrorProof1QFvalues WHERE formName = 'error-proof' ORDER BY date DESC, id DESC`;
        qfHistory = qfRes.recordset;
    } catch(e) {}

    res.json({
      verifications: verifications.recordset,
      plans: plans.recordset,
      qfHistory 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bulk data failed" });
  }
});

module.exports = router;