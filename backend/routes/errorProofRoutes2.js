const express = require("express");
const router = express.Router();
const sql = require("../db");
const PDFDocument = require("pdfkit");

/* =====================================================
   1️⃣ GET DETAILS (Operator Dashboard V2 & Admin)
===================================================== */
router.get("/details", async (req, res) => {
  try {
    const { machine, date } = req.query;

    let mainRes;
    let reactionRes;

    const masterRes = await sql.query`
        SELECT * FROM ErrorProof_Master 
        WHERE IsDeleted = 0 OR IsDeleted IS NULL 
        ORDER BY SlNo ASC
    `;

    if (date) {
      mainRes = await sql.query`
        SELECT * FROM ErrorProofVerifications 
        WHERE DisaMachine = ${machine} AND FORMAT(RecordDate, 'yyyy-MM-dd') = ${date}
        ORDER BY RecordDate DESC, Id ASC
      `;
      reactionRes = await sql.query`
        SELECT rp.* FROM ReactionPlans rp
        INNER JOIN ErrorProofVerifications epv ON rp.VerificationId = epv.Id
        WHERE epv.DisaMachine = ${machine} AND FORMAT(epv.RecordDate, 'yyyy-MM-dd') = ${date}
        ORDER BY rp.SNo ASC
      `;
    } else {
      mainRes = await sql.query`
        SELECT * FROM ErrorProofVerifications 
        WHERE DisaMachine = ${machine}
        ORDER BY RecordDate DESC, Id ASC
      `;
      reactionRes = await sql.query`
        SELECT rp.* FROM ReactionPlans rp
        INNER JOIN ErrorProofVerifications epv ON rp.VerificationId = epv.Id
        WHERE epv.DisaMachine = ${machine}
        ORDER BY rp.SNo ASC
      `;
    }

    const hofsRes = await sql.query`SELECT username AS name FROM dbo.DisaUsersTable WHERE role = 'hof' ORDER BY username`;
    const operatorsRes = await sql.query`SELECT username AS name FROM dbo.DisaUsersTable WHERE role = 'operator' ORDER BY username`;
    const supervisorsRes = await sql.query`SELECT username AS name FROM dbo.DisaUsersTable WHERE role = 'supervisor' ORDER BY username`;

    // 🔥 FETCH QF HISTORY 🔥
    let qfHistory = [];
    try {
        const qfRes = await sql.query`SELECT qfValue, date FROM ErrorProof2QFvalues WHERE formName = 'error-proof2' ORDER BY date DESC, id DESC`;
        qfHistory = qfRes.recordset;
    } catch(e) {}

    res.json({
      masterConfig: masterRes.recordset,
      verifications: mainRes.recordset,
      reactionPlans: reactionRes.recordset,
      hofs: hofsRes.recordset,
      operators: operatorsRes.recordset,
      supervisors: supervisorsRes.recordset,
      qfHistory // send to frontend
    });

  } catch (err) {
    console.error("Fetch Error V2:", err);
    res.status(500).send('Server Error');
  }
});

/* =====================================================
   2️⃣ SAVE DETAILS (Operator V2 & Admin)
===================================================== */
router.post("/save", async (req, res) => {
  try {
    const { machine, verifications, reactionPlans, headerDetails, operatorSignature, date } = req.body;
    const today = date || new Date().toISOString().split('T')[0];

    const transaction = new sql.Transaction();
    await transaction.begin();

    try {
      const insertedIdMap = {};

      for (const row of verifications) {
        const isNewRecord = String(row.Id).startsWith('temp');
        const queryReq = new sql.Request(transaction);

        if (isNewRecord) {
          const result = await queryReq.query`
            INSERT INTO ErrorProofVerifications (
              RecordDate, DisaMachine, Line, ErrorProofName, NatureOfErrorProof, Frequency,
              Date1_Shift1_Res, Date1_Shift2_Res, Date1_Shift3_Res,
              ReviewedByHOF, ApprovedBy, OperatorSignature, AssignedHOF
            ) 
            OUTPUT INSERTED.Id
            VALUES (
              ${today}, ${machine}, ${row.Line}, ${row.ErrorProofName}, ${row.NatureOfErrorProof}, ${row.Frequency},
              ${row.Date1_Shift1_Res || null}, ${row.Date1_Shift2_Res || null}, ${row.Date1_Shift3_Res || null},
              ${headerDetails.reviewedBy}, ${headerDetails.approvedBy}, ${operatorSignature}, ${headerDetails.assignedHOF}
            )
          `;
          insertedIdMap[row.Id] = result.recordset[0].Id;
        } else {
          await queryReq.query`
            UPDATE ErrorProofVerifications
            SET 
              RecordDate = ${today},
              Date1_Shift1_Res = ${row.Date1_Shift1_Res || null},
              Date1_Shift2_Res = ${row.Date1_Shift2_Res || null},
              Date1_Shift3_Res = ${row.Date1_Shift3_Res || null},
              ReviewedByHOF = ${headerDetails.reviewedBy},
              ApprovedBy = ${headerDetails.approvedBy},
              OperatorSignature = ${operatorSignature},
              AssignedHOF = ${headerDetails.assignedHOF},
              LastUpdated = GETDATE()
            WHERE Id = ${row.Id}
          `;
        }
      }

      const validIdsForDeletion = verifications.filter(v => !String(v.Id).startsWith('temp')).map(v => v.Id);
      let existingPlans = [];

      if (validIdsForDeletion.length > 0) {
        const idString = validIdsForDeletion.join(',');
        const existingRes = await new sql.Request(transaction).query(`
          SELECT VerificationId, VerificationDateShift, SupervisorSignature, Status 
          FROM ReactionPlans WHERE VerificationId IN (${idString})
        `);
        existingPlans = existingRes.recordset;

        await new sql.Request(transaction).query(`DELETE FROM ReactionPlans WHERE VerificationId IN (${idString})`);
      }

      if (reactionPlans && reactionPlans.length > 0) {
        for (const plan of reactionPlans) {
          const finalId = insertedIdMap[plan.VerificationId] || plan.VerificationId;

          const existing = existingPlans.find(ep => ep.VerificationId === finalId && ep.VerificationDateShift === plan.VerificationDateShift);
          const preservedSig = existing && existing.SupervisorSignature ? existing.SupervisorSignature : (plan.SupervisorSignature || null);
          const preservedStatus = existing && existing.Status === 'Completed' ? 'Completed' : (plan.Status || 'Pending');

          await new sql.Request(transaction).query`
            INSERT INTO ReactionPlans (
              VerificationId, SNo, ErrorProofNo, ErrorProofName, VerificationDateShift,
              Problem, RootCause, CorrectiveAction, Status, ReviewedBy, ApprovedBy, SupervisorSignature, Remarks
            ) VALUES (
              ${finalId}, ${plan.SNo}, ${plan.ErrorProofNo || ''}, ${plan.ErrorProofName}, ${plan.VerificationDateShift},
              ${plan.Problem}, ${plan.RootCause}, ${plan.CorrectiveAction}, ${preservedStatus}, 
              ${plan.ReviewedBy}, ${plan.ApprovedBy}, ${preservedSig}, ${plan.Remarks}
            )
          `;
        }
      }

      await transaction.commit();
      res.json({ success: true, message: 'Saved successfully' });

    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (err) {
    console.error("Save Error V2:", err);
    res.status(500).json({ error: err.message, message: 'Server Error' });
  }
});

/* =====================================================
   3️⃣ SUPERVISOR DASHBOARD V2 LOGIC
===================================================== */
router.get("/supervisor/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT rp.Id as ReactionPlanId, rp.*, epv.DisaMachine, FORMAT(epv.RecordDate, 'yyyy-MM-dd') as RecordDate
      FROM ReactionPlans rp
      INNER JOIN ErrorProofVerifications epv ON rp.VerificationId = epv.Id
      WHERE rp.ApprovedBy = ${name}
      ORDER BY epv.RecordDate DESC, rp.SNo ASC
    `;
    res.json(result.recordset);
  } catch (err) {
    console.error("V2 Fetch Supervisor Error:", err);
    res.status(500).json({ message: "DB error" });
  }
});

router.post("/sign-supervisor", async (req, res) => {
  try {
    const { reactionPlanId, signature } = req.body;
    await sql.query`
      UPDATE ReactionPlans 
      SET SupervisorSignature = ${signature}, Status = 'Completed' 
      WHERE Id = ${reactionPlanId}
    `;
    res.json({ message: "Signature saved successfully" });
  } catch (err) {
    console.error("V2 Sign Supervisor Error:", err);
    res.status(500).json({ message: "DB error" });
  }
});

/* =====================================================
   4️⃣ HOF DASHBOARD V2 LOGIC
===================================================== */
router.get("/hof/:name", async (req, res) => {
  try {
    const { name } = req.params;
    const result = await sql.query`
      SELECT FORMAT(RecordDate, 'yyyy-MM-dd') as reportDate, DisaMachine as disa, AssignedHOF as hofName,
             MAX(CAST(HOFSignature AS VARCHAR(MAX))) as hofSignature
      FROM ErrorProofVerifications
      WHERE AssignedHOF = ${name}
      GROUP BY FORMAT(RecordDate, 'yyyy-MM-dd'), DisaMachine, AssignedHOF
      ORDER BY reportDate DESC
    `;
    res.json(result.recordset);
  } catch (error) {
    console.error("V2 Fetch HOF Error:", error);
    res.status(500).json({ error: "Failed to fetch HOF reports" });
  }
});

router.post("/sign-hof", async (req, res) => {
  try {
    const { date, line, signature } = req.body;
    await sql.query`
      UPDATE ErrorProofVerifications 
      SET HOFSignature = ${signature} 
      WHERE FORMAT(RecordDate, 'yyyy-MM-dd') = ${date} AND DisaMachine = ${line}
    `;
    res.json({ message: "Signature saved successfully" });
  } catch (error) {
    console.error("V2 Sign HOF Error:", error);
    res.status(500).json({ error: "Failed to save HOF signature" });
  }
});

/* =====================================================
   5️⃣ ADMIN PDF BULK DATA FALLBACK
===================================================== */
router.get('/bulk-data', async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        const verifications = await sql.query`
            SELECT * FROM ErrorProofVerifications 
            WHERE CAST(RecordDate AS DATE) BETWEEN CAST(${fromDate} AS DATE) AND CAST(${toDate} AS DATE)
            ORDER BY RecordDate ASC, Id ASC`;
        
        const plans = await sql.query`
            SELECT rp.* FROM ReactionPlans rp 
            INNER JOIN ErrorProofVerifications epv ON rp.VerificationId = epv.Id
            WHERE CAST(epv.RecordDate AS DATE) BETWEEN CAST(${fromDate} AS DATE) AND CAST(${toDate} AS DATE)`;

        // 🔥 FETCH QF HISTORY 🔥
        let qfHistory = [];
        try {
            const qfRes = await sql.query`SELECT qfValue, date FROM ErrorProof2QFvalues WHERE formName = 'error-proof2' ORDER BY date DESC, id DESC`;
            qfHistory = qfRes.recordset;
        } catch(e) {}

        res.json({ verifications: verifications.recordset, plans: plans.recordset, qfHistory });
    } catch (err) {
        res.status(500).json({ error: "Bulk data failed" });
    }
});

/* =====================================================
   🔥 6️⃣ NEW: ADMIN BULK UPDATE
===================================================== */
router.post("/bulk-update", async (req, res) => {
  try {
    const { verifications, reactionPlans } = req.body;
    
    for (let v of verifications) {
        if (v.Id) {
            await sql.query`
                UPDATE ErrorProofVerifications 
                SET Date1_Shift1_Res = ${v.Date1_Shift1_Res},
                    Date1_Shift2_Res = ${v.Date1_Shift2_Res},
                    Date1_Shift3_Res = ${v.Date1_Shift3_Res}
                WHERE Id = ${v.Id}
            `;
        }
    }
    
    for (let rp of reactionPlans) {
        const planId = rp.Id || rp.SNo;
        if (planId) {
            await sql.query`
                UPDATE ReactionPlans 
                SET Problem = ${rp.Problem}, 
                    RootCause = ${rp.RootCause}, 
                    CorrectiveAction = ${rp.CorrectiveAction}, 
                    Status = ${rp.Status}, 
                    Remarks = ${rp.Remarks} 
                WHERE Id = ${planId} OR SNo = ${planId}
            `;
        }
    }
    
    res.json({ success: true, message: "Updated Successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "DB error" });
  }
});

/* =====================================================
   7️⃣ PDF GENERATOR LOGIC V2 (SERVER RENDERED)
===================================================== */
router.get("/report", async (req, res) => {
  try {
    const { line, date } = req.query;
    let verificationQuery = `SELECT * FROM ErrorProofVerifications`;
    let reactionQuery = `SELECT rp.* FROM ReactionPlans rp INNER JOIN ErrorProofVerifications epv ON rp.VerificationId = epv.Id`;

    if (line) {
      verificationQuery += ` WHERE DisaMachine = '${line}'`;
      reactionQuery += ` WHERE epv.DisaMachine = '${line}'`;
    }

    verificationQuery += ` ORDER BY RecordDate ASC, Id ASC`;
    reactionQuery += ` ORDER BY rp.Id ASC`;

    const verificationResult = await sql.query(verificationQuery);
    const reactionResult = await sql.query(reactionQuery);

    // 🔥 FETCH QF HISTORY 🔥
    let qfHistory = [];
    try {
        const qfRes = await sql.query`SELECT qfValue, date FROM ErrorProof2QFvalues WHERE formName = 'error-proof2' ORDER BY date DESC, id DESC`;
        qfHistory = qfRes.recordset;
    } catch(e) {}

    const doc = new PDFDocument({ margin: 30, size: "A4", layout: "landscape", autoPageBreak: false, bufferPages: true });
    const PAGE_HEIGHT = 595.28; // Standard A4 Landscape height in points

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=Error_Proof_Check_List_V2.pdf");
    doc.pipe(res);

    const startX = 30; const startY = 30;
    const getISODate = (dateStr) => { const d = new Date(dateStr); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    const formatDate = (dateStr) => { const d = new Date(dateStr); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };

    const drawMainHeaders = (y, dateStr) => {
      doc.font("Helvetica-Bold").fontSize(14).fillColor('black').text("ERROR PROOF VERIFICATION CHECK LIST - FDY", startX, y, { align: "center" });
      const headerTopY = y + 25;
      const wLine = 60, wName = 180, wNature = 220, wFreq = 65, wDateBox = 255;
      const wShift = wDateBox / 3;

      doc.lineWidth(1);
      doc.rect(startX, headerTopY, wLine, 60).stroke(); doc.text("Line", startX, headerTopY + 25, { width: wLine, align: "center" });
      let cx = startX + wLine;
      doc.rect(cx, headerTopY, wName, 60).stroke(); doc.text("Error Proof\nName", cx, headerTopY + 20, { width: wName, align: "center" });
      cx += wName;
      doc.rect(cx, headerTopY, wNature, 60).stroke(); doc.text("Nature of\nError Proof", cx, headerTopY + 20, { width: wNature, align: "center" });
      cx += wNature;
      doc.rect(cx, headerTopY, wFreq, 60).stroke(); doc.text("Frequency\nS,D,W,M", cx, headerTopY + 15, { width: wFreq, align: "center" });
      cx += wFreq;

      doc.rect(cx, headerTopY, wDateBox, 20).stroke();
      let dateLabel = dateStr ? `Date: ${formatDate(dateStr)}` : "Date:";
      doc.font("Helvetica-Bold").fontSize(9).text(dateLabel, cx + 2, headerTopY + 5, { width: wDateBox, align: "center" });

      const shifts = ['I Shift', 'II Shift', 'III Shift'];
      for (let i = 0; i < 3; i++) {
        const sx = cx + (i * wShift);
        doc.rect(sx, headerTopY + 20, wShift, 20).stroke();
        doc.fontSize(8).text(shifts[i], sx, headerTopY + 25, { width: wShift, align: "center" });
        doc.rect(sx, headerTopY + 40, wShift, 20).stroke();
        doc.fontSize(6).text("Observation Result", sx, headerTopY + 46, { width: wShift, align: "center" });
      }

      return headerTopY + 60;
    };

    const allRecords = verificationResult.recordset;
    const allUniqueDates = [...new Set(allRecords.map(r => getISODate(r.RecordDate)))].sort();
    
    let last3Dates = [];
    if (date) {
        const targetDateStr = getISODate(date);
        const targetIdx = allUniqueDates.indexOf(targetDateStr);
        if (targetIdx !== -1) {
            const startIdx = Math.max(0, targetIdx - 2);
            last3Dates = allUniqueDates.slice(startIdx, targetIdx + 1);
        } else {
            last3Dates = allUniqueDates.slice(-3);
        }
    } else {
        last3Dates = allUniqueDates.slice(-3);
    }

    const targetDateStr = date ? getISODate(date) : (last3Dates.length > 0 ? last3Dates[last3Dates.length - 1] : null);

    // 🔥 DETERMINE CURRENT QF FOR THIS DOCUMENT BATCH 🔥
    let currentPageQfValue = "QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023";
    if (targetDateStr) {
        const maxDate = new Date(targetDateStr);
        maxDate.setHours(0,0,0,0);
        for (let qf of qfHistory) {
            if (!qf.date) continue;
            const qfDate = new Date(qf.date);
            qfDate.setHours(0,0,0,0);
            if (qfDate <= maxDate) {
                currentPageQfValue = qf.qfValue; 
                break;
            }
        }
    }

    const filteredRecords = allRecords.filter(r => last3Dates.includes(getISODate(r.RecordDate)));
    const uniqueProofsMap = new Map();
    filteredRecords.forEach(r => { if (!uniqueProofsMap.has(r.ErrorProofName)) { uniqueProofsMap.set(r.ErrorProofName, { line: r.Line, nature: r.NatureOfErrorProof, frequency: r.Frequency }); } });
    const uniqueProofs = Array.from(uniqueProofsMap.keys());
    
    const targetRecords = targetDateStr ? filteredRecords.filter(r => getISODate(r.RecordDate) === targetDateStr) : filteredRecords;

    let y = startY;
    const wLine = 60, wName = 180, wNature = 220, wFreq = 65, wDateBox = 255;
    const wShift = wDateBox / 3;

    y = drawMainHeaders(y, targetDateStr);

    uniqueProofs.forEach((proofName) => {
      const proofData = uniqueProofsMap.get(proofName);
      doc.font("Helvetica").fontSize(8);
      const nameHeight = doc.heightOfString(proofName || "", { width: wName - 8, align: "center" });
      const natureHeight = doc.heightOfString(proofData.nature || "", { width: wNature - 8, align: "center" });
      let rowHeight = Math.max(30, nameHeight + 20, natureHeight + 20);

      if (y + rowHeight > PAGE_HEIGHT - 120) { doc.addPage({ layout: "landscape", margin: 30 }); y = drawMainHeaders(30, targetDateStr); }

      let cx = startX;
      doc.rect(cx, y, wLine, rowHeight).stroke(); doc.text(proofData.line || "", cx + 2, y + (rowHeight / 2 - 5), { width: wLine - 4, align: "center" }); cx += wLine;
      doc.rect(cx, y, wName, rowHeight).stroke(); doc.text(proofName || "", cx + 4, y + (rowHeight / 2 - nameHeight / 2), { width: wName - 8, align: "center" }); cx += wName;
      doc.rect(cx, y, wNature, rowHeight).stroke(); doc.text(proofData.nature || "", cx + 4, y + (rowHeight / 2 - natureHeight / 2), { width: wNature - 8, align: "center" }); cx += wNature;
      doc.rect(cx, y, wFreq, rowHeight).stroke(); doc.text(proofData.frequency || "", cx + 4, y + (rowHeight / 2 - 5), { width: wFreq - 8, align: "center" }); cx += wFreq;

      const recordsForDateAndProof = targetRecords.filter(r => r.ErrorProofName === proofName);
      const record = recordsForDateAndProof.length > 0 ? recordsForDateAndProof[0] : {};

      const res1 = record.Date1_Shift1_Res || "-";
      const res2 = record.Date1_Shift2_Res || "-";
      const res3 = record.Date1_Shift3_Res || "-";

      doc.rect(cx, y, wShift, rowHeight).stroke(); doc.text(res1, cx, y + (rowHeight / 2 - 5), { width: wShift, align: "center" }); cx += wShift;
      doc.rect(cx, y, wShift, rowHeight).stroke(); doc.text(res2, cx, y + (rowHeight / 2 - 5), { width: wShift, align: "center" }); cx += wShift;
      doc.rect(cx, y, wShift, rowHeight).stroke(); doc.text(res3, cx, y + (rowHeight / 2 - 5), { width: wShift, align: "center" });

      y += rowHeight;
    });

    const sigY = y + 20;
    if (sigY + 80 > PAGE_HEIGHT - 40) { doc.addPage({ layout: "landscape", margin: 30 }); y = 30; }

    doc.font("Helvetica-Bold").fontSize(10).fillColor('black');
    doc.text("Verified By Moulding Incharge", startX, sigY);
    doc.rect(startX, sigY + 8, 180, 45).stroke();

    doc.text("Reviewed By HOF", startX + 350, sigY);
    doc.rect(startX + 350, sigY + 8, 180, 45).stroke();

      const latestRecordWithOpSig = targetRecords.find(r => r.OperatorSignature);
      const latestRecordWithHofSig = targetRecords.find(r => r.HOFSignature);

      // 🔥 Operator PDF Approval Rendering
      const opSigVal = latestRecordWithOpSig ? latestRecordWithOpSig.OperatorSignature : null;
      if (opSigVal === "Approved" || opSigVal === "Submitted") {
        doc.lineWidth(2).strokeColor('#16a34a')
           .moveTo(startX + 35, sigY + 38)
           .lineTo(startX + 39, sigY + 43)
           .lineTo(startX + 47, sigY + 31)
           .stroke();
        doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(11).text("APPROVED", startX + 53, sigY + 35);
        doc.fillColor('black').strokeColor('black');
      } else if (opSigVal && opSigVal.includes('base64,')) {
        try {
          const imgBuffer = Buffer.from(opSigVal.split('base64,')[1], 'base64');
          doc.image(imgBuffer, startX + 5, sigY + 12, { fit: [170, 37] });
        } catch (e) { }
      } else {
        doc.font('Helvetica-Bold').fontSize(10).text("Pending", startX + 60, sigY + 35);
      }

      // 🔥 HOF PDF Approval Rendering
      const hofSigVal = latestRecordWithHofSig ? latestRecordWithHofSig.HOFSignature : null;
      if (hofSigVal === "Approved") {
        doc.lineWidth(2).strokeColor('#16a34a')
           .moveTo(startX + 385, sigY + 38)
           .lineTo(startX + 389, sigY + 43)
           .lineTo(startX + 397, sigY + 31)
           .stroke();
        doc.fillColor('#16a34a').font('Helvetica-Bold').fontSize(11).text("APPROVED", startX + 403, sigY + 35);
        doc.fillColor('black').strokeColor('black');
      } else if (hofSigVal && hofSigVal.includes('base64,')) {
        try {
          const imgBuffer = Buffer.from(hofSigVal.split('base64,')[1], 'base64');
          doc.image(imgBuffer, startX + 355, sigY + 12, { fit: [170, 37] });
        } catch (e) { }
      } else {
        doc.font('Helvetica-Bold').fontSize(10).text("Pending", startX + 410, sigY + 35);
      }
    const filteredReactions = reactionResult.recordset.filter(r => {
      const epvMatch = allRecords.find(e => e.Id === r.VerificationId);
      return epvMatch && getISODate(epvMatch.RecordDate) === targetDateStr;
    });

    if (filteredReactions.length > 0) {
      doc.addPage({ layout: "landscape", margin: 30 });
      const rColWidths = [30, 50, 90, 60, 80, 80, 80, 50, 70, 70, 90];
      const rHeaders = ["S.No", "Error\nProof No", "Error proof\nName", "Date", "Problem", "Root Cause", "Corrective\naction", "Status", "Reviewed\nBy (Op)", "Approved By\n(Sup)", "Remarks"];

      const drawReactionHeaders = (ry) => {
        doc.font("Helvetica-Bold").fontSize(14).fillColor('black').text("REACTION PLAN", startX, ry, { align: "center" });
        const headerY = ry + 25; doc.fontSize(8);
        let currX = startX;
        rHeaders.forEach((h, i) => { doc.rect(currX, headerY, rColWidths[i], 30).stroke(); doc.text(h, currX + 2, headerY + 5, { width: rColWidths[i] - 4, align: "center" }); currX += rColWidths[i]; });
        return headerY + 30;
      };

      let ry = drawReactionHeaders(30);

      filteredReactions.forEach((rRow, index) => {
        doc.font("Helvetica").fontSize(8).fillColor('black');
        const epvMatch = allRecords.find(e => e.Id === rRow.VerificationId);
        const dDate = epvMatch ? new Date(epvMatch.RecordDate) : null;
        const dateStr = dDate && !isNaN(dDate) ? `${String(dDate.getDate()).padStart(2, '0')}/${String(dDate.getMonth() + 1).padStart(2, '0')}/${dDate.getFullYear()}` : "";

        const hName = doc.heightOfString(rRow.ErrorProofName || "", { width: rColWidths[2] - 8, align: "center" });
        const hProb = doc.heightOfString(rRow.Problem || "", { width: rColWidths[4] - 8, align: "center" });
        let rRowHeight = Math.max(40, hName + 15, hProb + 15);

        if (ry + rRowHeight > PAGE_HEIGHT - 60) {
          doc.addPage({ layout: "landscape", margin: 30 }); ry = drawReactionHeaders(30);
        }

        const rowData = [
          (index + 1).toString(), rRow.ErrorProofNo || "", rRow.ErrorProofName || "", dateStr, rRow.Problem || "", rRow.RootCause || "",
          rRow.CorrectiveAction || "", rRow.Status || "", rRow.ReviewedBy || "", rRow.SupervisorSignature || "", rRow.Remarks || ""
        ];

        let currX = startX;
        rowData.forEach((cellText, i) => {
          doc.rect(currX, ry, rColWidths[i], rRowHeight).stroke();

          if (i === 9 && cellText && (String(cellText).startsWith('Approved') || String(cellText).startsWith('Submitted'))) {
            doc.lineWidth(1.5).strokeColor('#16a34a')
               .moveTo(currX + 8, ry + (rRowHeight / 2) + 2)
               .lineTo(currX + 11, ry + (rRowHeight / 2) + 6)
               .lineTo(currX + 17, ry + (rRowHeight / 2) - 1)
               .stroke();
            doc.fillColor('#16a34a').font("Helvetica-Bold").fontSize(9).text("APPROVED", currX + 22, ry + (rRowHeight / 2) - 3, { width: rColWidths[i] - 26, align: "left" });
            doc.fillColor('black').font("Helvetica").strokeColor('black');
          } else if (i === 9 && cellText && String(cellText).startsWith('data:image')) {
            try {
              const imgBuffer = Buffer.from(cellText.split('base64,')[1], 'base64');
              doc.image(imgBuffer, currX + 2, ry + 2, { fit: [rColWidths[i] - 4, rRowHeight - 4] });
            } catch (e) { }
          } else {
            const textY = (i === 4 || i === 5 || i === 6 || i === 10 || i === 2) ? ry + 5 : ry + (rRowHeight / 2) - 5;
            if (i === 7 && String(cellText).toLowerCase() === 'completed') doc.fillColor('green').font('Helvetica-Bold');
            else if (i === 7 && String(cellText).toLowerCase() === 'pending') doc.fillColor('red').font('Helvetica-Bold');
            else doc.fillColor('black').font('Helvetica');

            doc.text(String(cellText), currX + 4, textY, { width: rColWidths[i] - 8, align: "center" });
            doc.fillColor('black').font('Helvetica');
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
      
      // 🔥 PRINT DYNAMIC QF VALUE 🔥
      doc.text(currentPageQfValue, 30, PAGE_HEIGHT - 35, { align: "left", lineBreak: false });
    }

    doc.end();
  } catch (err) {
    console.error("Report Generation Error V2:", err);
    res.status(500).json({ message: "Report generation failed" });
  }
});

module.exports = router;