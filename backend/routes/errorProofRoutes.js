const express = require("express");
const router = express.Router();
const sql = require("mssql");
const PDFDocument = require("pdfkit");

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

// 🔥 FIXED: Accepts reactionPlanId from the React frontend so it properly saves to the DB!
router.post("/sign-supervisor", async (req, res) => {
    try {
      // The frontend sends 'reactionPlanId', not 'verificationId'
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
//        PDF GENERATOR LOGIC
// ==========================================
router.get("/report", async (req, res) => {
  try {
    const { line, date } = req.query; 
    
    const request = new sql.Request();
    let verificationQuery = `SELECT * FROM ErrorProofVerification`;
    let reactionQuery = `SELECT * FROM ReactionPlan`;
    
    // 🔥 FILTER SPECIFIC TO THE MODAL CLICKED
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

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape", bufferPages: true, autoPageBreak: false });
    const PAGE_HEIGHT = 595.28;

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

    const wLine = 45, wName = 120, wNature = 145, wFreq = 65;
    const wDateBox = 135; 

    const drawMainHeaders = (y, datesArr = []) => {
      doc.font("Helvetica-Bold").fontSize(14).fillColor('black').text("ERROR PROOF VERIFICATION CHECK LIST - FDY", startX, y, { align: "center" });
      const headerTopY = y + 25;
      
      doc.rect(startX, headerTopY, wLine, 60).stroke();
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
      for (let i = 0; i < 3; i++) {
        const boxX = cx + (i * wDateBox);
        
        doc.rect(boxX, headerTopY, wDateBox, 20).stroke();
        let dateLabel = datesArr[i] ? `Date: ${formatDate(datesArr[i])}` : "Date:";
        
        doc.font("Helvetica-Bold").fontSize(9);
        doc.text(dateLabel, boxX + 2, headerTopY + 5, { width: wDateBox, align: "left" });

        doc.rect(boxX, headerTopY + 20, wDateBox, 40).stroke();
        doc.fontSize(8);
        doc.text("Observation Result", boxX, headerTopY + 35, { width: wDateBox, align: "center" });
      }

      return headerTopY + 60;
    };

    const allRecords = verificationResult.recordset;
    const allUniqueDates = [...new Set(allRecords.map(r => getISODate(r.recordDate)))].sort();
    const last3Dates = allUniqueDates.slice(-3); 

    const filteredRecords = allRecords.filter(r => last3Dates.includes(getISODate(r.recordDate)));

    const uniqueProofsMap = new Map();
    filteredRecords.forEach(r => {
      if (!uniqueProofsMap.has(r.errorProofName)) {
        uniqueProofsMap.set(r.errorProofName, { line: r.line, nature: r.natureOfErrorProof, frequency: r.frequency });
      }
    });
    const uniqueProofs = Array.from(uniqueProofsMap.keys());

    const dateChunks = last3Dates.length > 0 ? [last3Dates] : [[]];

    let y = startY;

    dateChunks.forEach((chunk, chunkIndex) => {
      if (chunkIndex > 0) { doc.addPage({ layout: "landscape", margin: 30 }); y = startY; }
      y = drawMainHeaders(y, chunk);

      uniqueProofs.forEach((proofName) => {
        const proofData = uniqueProofsMap.get(proofName);

        doc.font("Helvetica").fontSize(8);
        const nameHeight = doc.heightOfString(proofName || "", { width: wName - 8, align: "center" });
        const natureHeight = doc.heightOfString(proofData.nature || "", { width: wNature - 8, align: "center" });
        const freqHeight = doc.heightOfString(proofData.frequency || "", { width: wFreq - 8, align: "center" });
        let rowHeight = Math.max(50, nameHeight + 20, natureHeight + 20, freqHeight + 20); 

        if (y + rowHeight > PAGE_HEIGHT - 120) {
          doc.addPage({ layout: "landscape", margin: 30 });
          y = drawMainHeaders(30, chunk); 
        }

        let cx = startX;
        doc.rect(cx, y, wLine, rowHeight).stroke();
        doc.text(proofData.line || "", cx + 2, y + (rowHeight/2 - 5), { width: wLine - 4, align: "center" });
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

        for (let i = 0; i < 3; i++) { doc.rect(cx + (i * wDateBox), y, wDateBox, rowHeight).stroke(); }

        chunk.forEach((dateStr, dateIndex) => {
          const recordsForDateAndProof = filteredRecords.filter(r => getISODate(r.recordDate) === dateStr && r.errorProofName === proofName);

          if (recordsForDateAndProof.length > 0) {
            const record = recordsForDateAndProof[0];
            const targetX = cx + (dateIndex * wDateBox);
            const targetY = y + (rowHeight / 2) - 8;

            doc.fontSize(8);
            if (record.observationResult === "OK") {
              doc.text("Checked OK", targetX, targetY, { width: wDateBox, align: "center" });
            } else if (record.observationResult === "NOT_OK") {
              doc.text("Checked Not OK", targetX, targetY, { width: wDateBox, align: "center" });
            }
          }
        });

        y += rowHeight;
      });

      // Signature Grid
      const sigY = y + 20; 
      if (sigY + 80 > PAGE_HEIGHT - 40) { doc.addPage({ layout: "landscape", margin: 30 }); y = 30; }

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
          } catch(e) {}
      }
      
      if (latestRecordWithHofSig && latestRecordWithHofSig.HOFSignature.includes('base64,')) {
          try { 
              const imgBuffer = Buffer.from(latestRecordWithHofSig.HOFSignature.split('base64,')[1], 'base64'); 
              doc.image(imgBuffer, startX + 355, sigY + 12, { fit: [170, 37] }); 
          } catch(e) {}
      }
    });

    // =========================================================
    // PART B: REACTION PLAN TABLE
    // =========================================================
    const filteredReactions = reactionResult.recordset.filter(r => last3Dates.includes(getISODate(r.recordDate)));

    if (filteredReactions.length > 0) {
      doc.addPage({ layout: "landscape", margin: 30 });
      
      const rColWidths = [30, 50, 90, 60, 80, 80, 80, 50, 70, 70, 90];
      const rHeaders = ["S.No", "Error\nProof No", "Error proof\nName", "Date", "Problem", "Root Cause", "Corrective\naction", "Status", "Reviewed\nBy (Op)", "Approved By\n(Sup)", "Remarks"];

      const drawReactionHeaders = (ry) => {
        doc.font("Helvetica-Bold").fontSize(14).fillColor('black').text("REACTION PLAN", startX, ry, { align: "center" });
        const headerY = ry + 25;
        doc.fontSize(8);
        
        let currX = startX;
        rHeaders.forEach((h, i) => {
          doc.rect(currX, headerY, rColWidths[i], 30).stroke();
          doc.text(h, currX + 2, headerY + 5, { width: rColWidths[i] - 4, align: "center" });
          currX += rColWidths[i];
        });
        return headerY + 30;
      };

      let ry = drawReactionHeaders(30);

      filteredReactions.forEach((rRow, index) => {
        doc.font("Helvetica").fontSize(8).fillColor('black');

        const dDate = new Date(rRow.recordDate);
        const dateStr = !isNaN(dDate) ? `${String(dDate.getDate()).padStart(2, '0')}/${String(dDate.getMonth() + 1).padStart(2, '0')}/${dDate.getFullYear()}` : "";

        const hName = doc.heightOfString(rRow.errorProofName || "", { width: rColWidths[2] - 8, align: "center" });
        const hProb = doc.heightOfString(rRow.problem || "", { width: rColWidths[4] - 8, align: "center" });
        
        let rRowHeight = Math.max(40, hName + 15, hProb + 15);

        if (ry + rRowHeight > PAGE_HEIGHT - 60) {
          doc.addPage({ layout: "landscape", margin: 30 });
          ry = drawReactionHeaders(30);
        }

        const rowData = [
          (index + 1).toString(), rRow.errorProofNo || "", rRow.errorProofName || "", dateStr, rRow.problem || "", rRow.rootCause || "", 
          rRow.correctiveAction || "", rRow.status || "", rRow.reviewedBy || "", rRow.SupervisorSignature || rRow.approvedBy || "", rRow.remarks || ""
        ];

        let currX = startX;
        rowData.forEach((cellText, i) => {
          doc.rect(currX, ry, rColWidths[i], rRowHeight).stroke();
          
          if (i === 9 && cellText && String(cellText).startsWith('data:image')) {
             try {
                const imgBuffer = Buffer.from(cellText.split('base64,')[1], 'base64');
                doc.image(imgBuffer, currX + 2, ry + 2, { fit: [rColWidths[i] - 4, rRowHeight - 4] });
             } catch(e) {}
          } else {
             const textY = (i === 4 || i === 5 || i === 6 || i === 10 || i === 2) ? ry + 5 : ry + (rRowHeight / 2) - 5;
             
             if (i === 7) {
                if (String(cellText).toLowerCase() === 'completed') { doc.fillColor('green').font("Helvetica-Bold"); }
                else if (String(cellText).toLowerCase() === 'pending') { doc.fillColor('red').font("Helvetica-Bold"); }
                else { doc.fillColor('black').font("Helvetica"); }
             } else {
                doc.fillColor('black').font("Helvetica");
             }
             
             doc.text(String(cellText), currX + 4, textY, { width: rColWidths[i] - 8, align: "center" });
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
        doc.text("QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023", 30, PAGE_HEIGHT - 45, { align: "left", lineBreak: false });
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

// 1. GET Details by Date & Machine for Admin Edit
router.get("/details", async (req, res) => {
  try {
    const { machine, date } = req.query;
    const verifications = await sql.query`
        SELECT * FROM ErrorProofVerification 
        WHERE line = ${machine} AND recordDate = ${date}
    `;
    
    // Only grab reaction plans that match the date and the error proofs from this line
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

// 2. POST Bulk Update from Admin Edit
router.post("/bulk-update", async (req, res) => {
  try {
    const { verifications, reactionPlans } = req.body;
    
    // Update Verifications (OK / NOT OK)
    for (let v of verifications) {
        if (v.id) {
            await sql.query`
                UPDATE ErrorProofVerification 
                SET observationResult = ${v.observationResult} 
                WHERE id = ${v.id}
            `;
        }
    }
    
    // Update Reaction Plans (Problem, Root Cause, Status, etc)
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
    
    res.json({ success: true, message: "Updated Successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

// 3. GET Bulk Data for Admin PDF Export
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

    res.json({ 
        verifications: verifications.recordset, 
        plans: plans.recordset 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bulk data failed" });
  }
});

// ==========================================
//   ADMIN EDIT BULK UPDATE (V1)
// ==========================================
router.post("/bulk-update", async (req, res) => {
  try {
    const { verifications, reactionPlans } = req.body;
    
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
    
    res.json({ success: true, message: "Updated Successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

module.exports = router;