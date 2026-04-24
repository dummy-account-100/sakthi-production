const express = require("express");
const router = express.Router();
const sql = require("../db"); // Adjusted to safe import
const PDFDocument = require("pdfkit");
const path = require("path");
const fs = require("fs");

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

// ══════════════════════════════════════════════════════════════════════════════
//  DROPDOWN DATA
// ══════════════════════════════════════════════════════════════════════════════
router.get("/incharges", async (req, res) => {
    try {
        const supRes = await sql.query`SELECT username AS name FROM dbo.Users WHERE role = 'supervisor' ORDER BY username ASC`;
        const hodRes = await sql.query`SELECT username AS name FROM dbo.Users WHERE role = 'hod' ORDER BY username ASC`;
        res.json({ supervisors: supRes.recordset, hods: hodRes.recordset });
    } catch (err) { res.status(500).json({ message: "DB error", error: err.message }); }
});

router.get("/types", async (req, res) => {
    try {
        const result = await sql.query`SELECT typeName FROM FourMTypes ORDER BY id ASC`;
        res.json(result.recordset);
    } catch (err) {
        res.json([{ typeName: "Man" }, { typeName: "Machine" }, { typeName: "Material" }, { typeName: "Method" }]);
    }
});

// ══════════════════════════════════════════════════════════════════════════════
//  CUSTOM COLUMN MANAGEMENT (Admin)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/custom-columns", async (req, res) => {
    try {
        const result = await sql.query(`SELECT id, columnName, displayOrder FROM FourMCustomColumns WHERE isDeleted = 0 ORDER BY displayOrder ASC, id ASC`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "DB error", error: err.message }); }
});

router.post("/custom-columns", async (req, res) => {
    const { columnName } = req.body;
    try {
        const maxRes = await sql.query(`SELECT ISNULL(MAX(displayOrder), 0) AS maxOrder FROM FourMCustomColumns WHERE isDeleted = 0`);
        const nextOrder = maxRes.recordset[0].maxOrder + 1;

        const request = new sql.Request();
        request.input('columnName', sql.NVarChar, columnName.trim());
        request.input('displayOrder', sql.Int, nextOrder);
        const result = await request.query(`INSERT INTO FourMCustomColumns (columnName, displayOrder, isDeleted) OUTPUT INSERTED.* VALUES (@columnName, @displayOrder, 0)`);
        res.json(result.recordset[0]);
    } catch (err) { res.status(500).json({ message: "Insert failed", error: err.message }); }
});

router.put("/custom-columns/:id", async (req, res) => {
    const { id } = req.params;
    const { columnName } = req.body;
    try {
        const request = new sql.Request();
        request.input('id', sql.Int, id).input('columnName', sql.NVarChar, columnName.trim());
        await request.query(`UPDATE FourMCustomColumns SET columnName = @columnName WHERE id = @id`);
        res.json({ message: "Updated" });
    } catch (err) { res.status(500).json({ message: "Update failed", error: err.message }); }
});

router.delete("/custom-columns/:id", async (req, res) => {
    try {
        const request = new sql.Request();
        request.input('id', sql.Int, req.params.id);
        await request.query(`UPDATE FourMCustomColumns SET isDeleted = 1 WHERE id = @id`);
        res.json({ message: "Deleted" });
    } catch (err) { res.status(500).json({ message: "Delete failed" }); }
});

// ══════════════════════════════════════════════════════════════════════════════
//  RECORDS CRUD (🔥 UPDATED TO INCLUDE qfHistory FOR ADMIN BULK EXPORT)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/records", async (req, res) => {
    try {
        const recordsResult = await sql.query(`SELECT * FROM FourMChangeRecord ORDER BY id DESC`);
        const records = recordsResult.recordset;

        let qfHistory = [];
        try {
            const qfRes = await sql.query(`SELECT qfValue, date FROM FourMChangeQFvalues WHERE formName = '4m-change' ORDER BY date DESC, id DESC`);
            qfHistory = qfRes.recordset;
        } catch(e) { console.error("QF History fetch failed", e); }

        if (records.length === 0) return res.json({ records: [], qfHistory });

        const ids = records.map(r => r.id).join(',');
        const valResult = await sql.query(`SELECT recordId, columnId, value FROM FourMCustomColumnValues WHERE recordId IN (${ids})`);

        const valMap = {};
        valResult.recordset.forEach(v => {
            if (!valMap[v.recordId]) valMap[v.recordId] = {};
            valMap[v.recordId][v.columnId] = v.value;
        });

        const merged = records.map(r => ({ ...r, customValues: valMap[r.id] || {} }));
        res.json({ records: merged, qfHistory });
    } catch (err) { res.status(500).json({ message: "DB error", error: err.message }); }
});

// ── Admin: Fetch records by single date ───────────────────────────────────────
router.get("/records-by-date", async (req, res) => {
    try {
        const { date } = req.query;
        if (!date) return res.status(400).json({ message: "date query param required" });

        const request = new sql.Request();
        request.input('date', sql.Date, date);
        const recordsResult = await request.query(`SELECT * FROM FourMChangeRecord WHERE recordDate = @date ORDER BY id ASC`);
        const records = recordsResult.recordset;

        let qfHistory = [];
        try {
            const qfRes = await sql.query(`SELECT qfValue, date FROM FourMChangeQFvalues WHERE formName = '4m-change' ORDER BY date DESC, id DESC`);
            qfHistory = qfRes.recordset;
        } catch(e) {}

        if (records.length === 0) return res.json({ records: [], customColumns: [], qfHistory });

        const ids = records.map(r => r.id).join(',');
        const valResult = await sql.query(`SELECT recordId, columnId, value FROM FourMCustomColumnValues WHERE recordId IN (${ids})`);
        const customCols = await sql.query(`SELECT id, columnName FROM FourMCustomColumns WHERE isDeleted = 0 ORDER BY displayOrder ASC, id ASC`);

        const valMap = {};
        valResult.recordset.forEach(v => {
            if (!valMap[v.recordId]) valMap[v.recordId] = {};
            valMap[v.recordId][v.columnId] = v.value;
        });

        res.json({
            records: records.map(r => ({ ...r, customValues: valMap[r.id] || {} })),
            customColumns: customCols.recordset,
            qfHistory
        });
    } catch (err) {
        console.error("Error fetching 4M records by date:", err);
        res.status(500).json({ message: "DB error", error: err.message });
    }
});

// ── Admin: Update a single 4M record ─────────────────────────────────────────
router.put("/records/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const {
            line, partName, recordDate, shift, mcNo, type4M, description,
            firstPart, lastPart, inspFreq, retroChecking, quarantine,
            partId, internalComm, inchargeSign, assignedHOD, customValues
        } = req.body;

        const request = new sql.Request();
        request.input('id', sql.Int, id)
            .input('line', sql.VarChar, line || '').input('partName', sql.VarChar, partName || '')
            .input('recordDate', sql.Date, recordDate).input('shift', sql.VarChar, shift || '')
            .input('mcNo', sql.VarChar, mcNo || '').input('type4M', sql.VarChar, type4M || '')
            .input('description', sql.NVarChar, description || '').input('firstPart', sql.VarChar, firstPart || '')
            .input('lastPart', sql.VarChar, lastPart || '').input('inspFreq', sql.VarChar, inspFreq || '')
            .input('retroChecking', sql.VarChar, retroChecking || '').input('quarantine', sql.VarChar, quarantine || '')
            .input('partId', sql.VarChar, partId || '').input('internalComm', sql.VarChar, internalComm || '')
            .input('inchargeSign', sql.VarChar, inchargeSign || '').input('assignedHOD', sql.VarChar, assignedHOD || '');

        await request.query(`
            UPDATE FourMChangeRecord SET
                line=@line, partName=@partName, recordDate=@recordDate, shift=@shift,
                mcNo=@mcNo, type4M=@type4M, description=@description, firstPart=@firstPart,
                lastPart=@lastPart, inspFreq=@inspFreq, retroChecking=@retroChecking,
                quarantine=@quarantine, partId=@partId, internalComm=@internalComm,
                inchargeSign=@inchargeSign, AssignedHOD=@assignedHOD
            WHERE id=@id
        `);

        if (customValues && typeof customValues === 'object') {
            for (const [columnId, value] of Object.entries(customValues)) {
                const colId = parseInt(columnId);
                const strVal = value !== null && value !== undefined ? String(value) : '';
                const checkReq = new sql.Request();
                checkReq.input('recordId', sql.Int, id).input('columnId', sql.Int, colId);
                const existing = await checkReq.query(`SELECT id FROM FourMCustomColumnValues WHERE recordId=@recordId AND columnId=@columnId`);
                const upReq = new sql.Request();
                upReq.input('recordId', sql.Int, id).input('columnId', sql.Int, colId).input('value', sql.NVarChar, strVal);
                if (existing.recordset.length > 0) {
                    await upReq.query(`UPDATE FourMCustomColumnValues SET value=@value WHERE recordId=@recordId AND columnId=@columnId`);
                } else {
                    await upReq.query(`INSERT INTO FourMCustomColumnValues (recordId, columnId, value) VALUES (@recordId, @columnId, @value)`);
                }
            }
        }
        res.json({ message: "Record updated successfully" });
    } catch (err) {
        console.error("Error updating 4M record:", err);
        res.status(500).json({ message: "Update failed", error: err.message });
    }
});

router.post("/add", async (req, res) => {
    const {
        line, partName, recordDate, shift, mcNo, type4M, description,
        firstPart, lastPart, inspFreq, retroChecking, quarantine,
        partId, internalComm, inchargeSign, assignedHOD, customValues
    } = req.body;

    try {
        const request = new sql.Request();
        request.input('line', sql.VarChar, line).input('partName', sql.VarChar, partName).input('recordDate', sql.Date, recordDate)
            .input('shift', sql.VarChar, shift).input('mcNo', sql.VarChar, mcNo).input('type4M', sql.VarChar, type4M)
            .input('description', sql.NVarChar, description).input('firstPart', sql.VarChar, firstPart)
            .input('lastPart', sql.VarChar, lastPart).input('inspFreq', sql.VarChar, inspFreq)
            .input('retroChecking', sql.VarChar, retroChecking).input('quarantine', sql.VarChar, quarantine)
            .input('partId', sql.VarChar, partId).input('internalComm', sql.VarChar, internalComm)
            .input('inchargeSign', sql.VarChar, inchargeSign).input('assignedHOD', sql.VarChar, assignedHOD);

        const insertResult = await request.query(`
            INSERT INTO FourMChangeRecord (
              line, partName, recordDate, shift, mcNo, type4M, description, firstPart, lastPart, 
              inspFreq, retroChecking, quarantine, partId, internalComm, inchargeSign, AssignedHOD
            ) OUTPUT INSERTED.id VALUES (
              @line, @partName, @recordDate, @shift, @mcNo, @type4M, @description, @firstPart, @lastPart, 
              @inspFreq, @retroChecking, @quarantine, @partId, @internalComm, @inchargeSign, @assignedHOD
            )
        `);

        const newRecordId = insertResult.recordset[0].id;

        if (customValues && typeof customValues === 'object') {
            for (const [columnId, value] of Object.entries(customValues)) {
                if (value !== undefined && value !== null && String(value).trim() !== "") {
                    const colReq = new sql.Request();
                    colReq.input('recordId', sql.Int, newRecordId).input('columnId', sql.Int, parseInt(columnId)).input('value', sql.NVarChar, String(value));
                    await colReq.query(`INSERT INTO FourMCustomColumnValues (recordId, columnId, value) VALUES (@recordId, @columnId, @value)`);
                }
            }
        }
        res.json({ message: "Saved" });
    } catch (err) { res.status(500).json({ message: "Insert failed", error: err.message }); }
});

// SIGNATURE ROUTES
router.get("/supervisor/:name", async (req, res) => {
    try {
        const { name } = req.params;
        const result = await sql.query`SELECT * FROM FourMChangeRecord WHERE inchargeSign = ${name} ORDER BY recordDate DESC, shift ASC`;
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});
router.post("/sign-supervisor", async (req, res) => {
    try {
        const { reportId, signature } = req.body;
        await sql.query`UPDATE FourMChangeRecord SET SupervisorSignature = ${signature} WHERE id = ${reportId}`;
        res.json({ message: "Signature saved" });
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});
router.get("/hod/:name", async (req, res) => {
    try {
        const { name } = req.params;
        const result = await sql.query`SELECT * FROM FourMChangeRecord WHERE AssignedHOD = ${name} ORDER BY recordDate DESC, shift ASC`;
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});
router.post("/sign-hod", async (req, res) => {
    try {
        const { reportId, signature } = req.body;
        await sql.query`UPDATE FourMChangeRecord SET HODSignature = ${signature} WHERE id = ${reportId}`;
        res.json({ message: "Signature saved" });
    } catch (err) { res.status(500).json({ message: "DB error" }); }
});

// ══════════════════════════════════════════════════════════════════════════════
//  DYNAMIC PDF REPORT (🔥 ADDED DYNAMIC QF HISTORY)
// ══════════════════════════════════════════════════════════════════════════════
router.get("/report", async (req, res) => {
    try {
        const { fromDate, toDate, reportId } = req.query;

        const request = new sql.Request();
        let queryStr = `SELECT * FROM FourMChangeRecord`;

        if (reportId) {
            queryStr += ` WHERE id = @reportId`;
            request.input('reportId', sql.Int, reportId);
        } else if (fromDate && toDate) {
            queryStr += ` WHERE recordDate >= @fromDate AND recordDate <= @toDate`;
            request.input('fromDate', sql.Date, fromDate);
            request.input('toDate', sql.Date, toDate);
        }
        queryStr += ` ORDER BY id DESC`;

        const result = await request.query(queryStr);

        let customCols = [];
        let customValMap = {};
        try {
            const colsResult = await sql.query(`SELECT id, columnName FROM FourMCustomColumns WHERE isDeleted = 0 ORDER BY displayOrder ASC, id ASC`);
            customCols = colsResult.recordset;

            if (customCols.length > 0) {
                const vRes = await sql.query(`SELECT recordId, columnId, value FROM FourMCustomColumnValues`);
                vRes.recordset.forEach(v => {
                    if (!customValMap[v.recordId]) customValMap[v.recordId] = {};
                    customValMap[v.recordId][v.columnId] = v.value;
                });
            }
        } catch (e) { }

        // 🔥 FETCH QF HISTORY 🔥
        let qfHistory = [];
        try {
            const qfRes = await sql.query(`SELECT qfValue, date FROM FourMChangeQFvalues WHERE formName = '4m-change' ORDER BY date DESC, id DESC`);
            qfHistory = qfRes.recordset;
        } catch (e) {}

        const marginOptions = { top: 30, bottom: 20, left: 30, right: 30 };
        const doc = new PDFDocument({ margins: marginOptions, size: "A4", layout: "landscape" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", "inline; filename=4M_Change_Report.pdf");
        doc.pipe(res);

        const topRecord = result.recordset.length > 0 ? result.recordset[0] : {};
        const headerLine = topRecord.line || "ALL LINES";
        const hodSignature = topRecord.HODSignature;

        const uniquePartNames = [...new Set(result.recordset.map(row => row.partName).filter(name => name && name.trim() !== ""))];
        const headerPart = uniquePartNames.join(", ");

        const startX = 30;
        const pageWidth = doc.page.width - 60;

        const baseHeaders = ["Date /\nShift", "M/c.\nNo", "Type of\n4M", "Description", "First\nPart", "Last\nPart", "Insp.\nFreq", "Retro\nChecking", "Quarantine", "Part\nIdent.", "Internal\nComm.", "Supervisor\nSign"];
        const headers = [...baseHeaders, ...customCols.map(c => c.columnName)];

        const baseWeights = [1.5, 1, 1, 3.5, 1, 1, 1, 1.2, 1.5, 1, 1.2, 2.5];
        const customWeights = customCols.map(() => 1.5);
        const allWeights = [...baseWeights, ...customWeights];
        const totalWeight = allWeights.reduce((sum, w) => sum + w, 0);
        const colWidths = allWeights.map(w => (w / totalWeight) * pageWidth);

        const headerFontSize = headers.length > 12 ? 6.5 : 8;
        const bodyFontSize = headers.length > 12 ? 7 : 8.5;
        const minRowHeight = 40;

        const drawHeaders = (y) => {
            const logoBoxWidth = 100;
            const metaBoxWidth = 150;
            const titleBoxWidth = pageWidth - logoBoxWidth - metaBoxWidth;
            const headerHeight = 40;

            doc.lineWidth(1);

            // BOX 1: LOGO
            doc.rect(startX, y, logoBoxWidth, headerHeight).stroke();
            const logoPath = path.join(__dirname, "logo.jpg");
            if (fs.existsSync(logoPath)) {
                doc.image(logoPath, startX + 10, y + 5, {
                    width: 80, height: 30, fit: [80, 30], align: 'center', valign: 'center'
                });
            } else {
                doc.font("Helvetica-Bold").fontSize(12).fillColor('black').text("SAKTHI\nAUTO", startX, y + 10, { width: logoBoxWidth, align: "center" });
            }

            // BOX 2: TITLE
            doc.rect(startX + logoBoxWidth, y, titleBoxWidth, headerHeight).stroke();
            doc.font("Helvetica-Bold").fontSize(14).fillColor('black').text("SAKTHI AUTO COMPONENT LIMITED", startX + logoBoxWidth, y + 8, { width: titleBoxWidth, align: "center" });
            doc.fontSize(12).text("4M CHANGE MONITORING CHECK SHEET", startX + logoBoxWidth, y + 24, { width: titleBoxWidth, align: "center" });

            // BOX 3: META DATA (Line & Dates)
            doc.rect(startX + logoBoxWidth + titleBoxWidth, y, metaBoxWidth, headerHeight).stroke();
            doc.font("Helvetica-Bold").fontSize(11).text(headerLine, startX + logoBoxWidth + titleBoxWidth, y + 7, { width: metaBoxWidth, align: "center" });
            doc.moveTo(startX + logoBoxWidth + titleBoxWidth, y + 20).lineTo(startX + pageWidth, y + 20).stroke();
            
            let dateText = "ALL DATES";
            if (fromDate && toDate) {
                const fD = new Date(fromDate).toLocaleDateString('en-GB');
                const tD = new Date(toDate).toLocaleDateString('en-GB');
                dateText = `${fD} to ${tD}`;
            } else if (topRecord.recordDate) {
                dateText = new Date(topRecord.recordDate).toLocaleDateString('en-GB');
            }
            doc.font("Helvetica").fontSize(9).text(dateText, startX + logoBoxWidth + titleBoxWidth, y + 26, { width: metaBoxWidth, align: "center" });

            // PART NAME 
            let tableHeaderY = y + headerHeight + 5;
            if (headerPart) {
                doc.font("Helvetica-Bold").fontSize(9).text(`Part Name(s): ${headerPart}`, startX, tableHeaderY);
                tableHeaderY += 15;
            } else {
                tableHeaderY += 5;
            }

            // Table Headers
            let currentX = startX;
            doc.font("Helvetica-Bold").fontSize(headerFontSize);
            headers.forEach((header, i) => {
                doc.rect(currentX, tableHeaderY, colWidths[i], minRowHeight).stroke();
                doc.text(header, currentX, tableHeaderY + 8, { width: colWidths[i], align: "center" });
                currentX += colWidths[i];
            });
            return tableHeaderY + minRowHeight;
        };

const drawFooter = (yPos, dynamicQfString) => {
            const footerY = doc.page.height - 35;
            
            // Draw QF String on the left
            doc.font("Helvetica").fontSize(8).text(dynamicQfString, startX, footerY, { align: "left" });
            
            // Set explicit X coordinate for the HOD Sign block on the right
            const rightX = doc.page.width - 180; 
            
            // 1. Draw "HOD Sign :" Label
            doc.fillColor('black');
            doc.fontSize(10);
            doc.font('Helvetica-Bold');
            doc.text("HOD Sign :", rightX, footerY);

            // 2. Draw the Signature Status next to the label
            if (hodSignature === 'Approved' || hodSignature === 'APPROVED') {
                // Draw Green Checkmark + APPROVED Text
                doc.fillColor('#16a34a'); // Dark green
                doc.fontSize(14);
                doc.font('ZapfDingbats');
                doc.text('4', rightX + 55, footerY - 2); // Tick Mark
                
                doc.fontSize(10);
                doc.font('Helvetica-Bold');
                doc.text('APPROVED', rightX + 67, footerY); // Text
                
                doc.fillColor('black'); // Reset
                doc.font('Helvetica');
            } else if (hodSignature && hodSignature.startsWith('data:image')) {
                try {
                    const base64Data = hodSignature.split('base64,');
                    const imgBuffer = Buffer.from(base64Data, 'base64');
                    // Placed perfectly next to "HOD Sign :"
                    doc.image(imgBuffer, rightX + 55, footerY - 15, { fit: [width - 4, height - 4]});
                } catch (e) { }
            } else {
                // Pending State
                doc.fillColor('#dc2626'); // Red
                doc.fontSize(10);
                doc.font('Helvetica-Bold');
                doc.text("Pending", rightX + 55, footerY);
                doc.fillColor('black');
                doc.font('Helvetica');
            }
        };

        const drawCellContent = (value, x, y, width, height, isSignature = false) => {
            const centerX = x + width / 2;
            const centerY = y + (height / 2);

            if (isSignature) {
                if (value === "Approved" || value === "APPROVED") {
                    // 🔥 Perfectly center the tick + text block
                    const startX = centerX - 20; 
                    
                    doc.fillColor('#16a34a');
                    doc.fontSize(12);
                    doc.font('ZapfDingbats');
                    doc.text('4', startX, centerY - 4); 
                    
                    doc.fontSize(6.5);
                    doc.font("Helvetica-Bold");
                    doc.text("APPROVED", startX + 10, centerY - 1);
                    
                    doc.fillColor('black');
                    doc.font('Helvetica');
                } else if (value && value.startsWith('data:image')) {
                    try {
                        const base64Data = value.split('base64,');
                        const imgBuffer = Buffer.from(base64Data, 'base64');
                        doc.image(imgBuffer, x + 2, y + 2, { fit: [width - 4, height - 4], align: 'center', valign: 'center' });
                    } catch (e) { doc.font("Helvetica").fontSize(8).text("Invalid Sig", x, y + 10, { width, align: "center" }); }
                } else {
                    doc.fillColor('#dc2626');
                    doc.fontSize(8);
                    doc.font("Helvetica-Bold");
                    doc.text("Pending", x, centerY - 3, { width: width, align: "center" });
                    doc.fillColor('black');
                    doc.font('Helvetica');
                }
            } else if (value === "OK") {
                doc.save().lineWidth(1.5).moveTo(centerX - 4, centerY + 2).lineTo(centerX - 1, centerY + 6).lineTo(centerX + 6, centerY - 4).stroke().restore();
            } else if (value === "Not OK") {
                doc.save().lineWidth(1.5).moveTo(centerX - 4, centerY - 4).lineTo(centerX + 4, centerY + 4).moveTo(centerX + 4, centerY - 4).lineTo(centerX - 4, centerY + 4).stroke().restore();
            } else if (["-", "N", "I"].includes(value)) {
                doc.font("Helvetica").fontSize(10).text(value, x, y + (height / 2) - 5, { width, align: "center" });
            } else {
                doc.font("Helvetica").fontSize(bodyFontSize).text(String(value || ""), x + 2, y + 5, { width: width - 4, align: "center" });
            }
        };

        // Determine initial QF String using the top record's date
        const topRecordDate = topRecord.recordDate || new Date();
        let dynamicQfString = getDynamicQfString(topRecordDate, qfHistory, "QF/07/MPD-36, Rev. No: 01, 13.03.2019");

        let y = drawHeaders(30);

        if (result.recordset.length === 0) {
            doc.font("Helvetica-Oblique").fontSize(12).text("No records found for selected dates.", startX, y + 20, { align: "center", width: pageWidth });
        } else {
            result.recordset.forEach((row) => {
                const formattedDate = new Date(row.recordDate).toLocaleDateString("en-GB");
                const customData = customCols.map(c => customValMap[row.id]?.[c.id] || "");

                const signatureCell = row.SupervisorSignature || row.inchargeSign;

                const rowData = [
                    `${formattedDate}\nShift ${row.shift}`, row.mcNo, row.type4M, row.description,
                    row.firstPart, row.lastPart, row.inspFreq, row.retroChecking,
                    row.quarantine, row.partId, row.internalComm, signatureCell, ...customData
                ];

                let maxRowHeight = minRowHeight;
                doc.font("Helvetica").fontSize(bodyFontSize);

                rowData.forEach((cell, i) => {
                    if (!["OK", "Not OK"].includes(cell) && i !== 11) { 
                        const h = doc.heightOfString(String(cell || ""), { width: colWidths[i] - 4 });
                        if (h + 15 > maxRowHeight) maxRowHeight = h + 15;
                    }
                });

                if (y + maxRowHeight > doc.page.height - 65) {
                    dynamicQfString = getDynamicQfString(row.recordDate, qfHistory, "QF/07/MPD-36, Rev. No: 01, 13.03.2019");
                    drawFooter(y, dynamicQfString);
                    doc.addPage({ size: "A4", layout: "landscape", margins: marginOptions });
                    y = drawHeaders(30);
                }

                let x = startX;
                rowData.forEach((cell, i) => {
                    doc.rect(x, y, colWidths[i], maxRowHeight).stroke();
                    drawCellContent(cell, x, y, colWidths[i], maxRowHeight, i === 11); 
                    x += colWidths[i];
                });
                y += maxRowHeight;
            });
        }

        drawFooter(y, dynamicQfString);
        doc.end();
    } catch (err) {
        console.error("Error generating report:", err);
        res.status(500).json({ message: "Report failed" });
    }
});

module.exports = router;