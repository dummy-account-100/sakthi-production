const sql = require("../db");

exports.getFormSettings = async (req, res) => {
    try {
        const result = await sql.query`
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM DisamaticReportQFvalues
            ) t1 WHERE rn = 1
            UNION ALL
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM PerformanceReportQFvalues
            ) t2 WHERE rn = 1
            UNION ALL
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM UnpouredMouldQFvalues
            ) t3 WHERE rn = 1
            UNION ALL
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM BottomLevelAuditQFvalues
            ) t4 WHERE rn = 1
            UNION ALL
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM MachineChecklistQFvalues
            ) t5 WHERE rn = 1
            UNION ALL
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM DmmSettingQFvalues
            ) t6 WHERE rn = 1
            UNION ALL
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM DISASettingAdjustmentQFvalues
            ) t7 WHERE rn = 1
            UNION ALL
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM MouldQualityQFvalues
            ) t8 WHERE rn = 1
            UNION ALL
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM FourMChangeQFvalues
            ) t9 WHERE rn = 1
            UNION ALL
            -- ✅ ADDED ERROR PROOF 2 HERE
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM ErrorProof2QFvalues
            ) t10 WHERE rn = 1
            UNION ALL
            -- ✅ ADDED ERROR PROOF 1 HERE
            SELECT id, formName, qfValue, date FROM (
                SELECT id, formName, qfValue, date, ROW_NUMBER() OVER(PARTITION BY formName ORDER BY date DESC, id DESC) as rn
                FROM ErrorProof1QFvalues
            ) t11 WHERE rn = 1
            ORDER BY formName ASC
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error("getFormSettings error:", err);
        res.status(500).json({ error: "Failed to fetch form settings", details: err.message });
    }
};

exports.updateFormSettings = async (req, res) => {
    const { setting } = req.body; 

    if (!setting) return res.status(400).json({ error: "No setting data provided" });

    const safeDate = (setting.date && setting.date.trim() !== '') ? setting.date : null;

    try {
        if (setting.formName === 'performance') {
            await sql.query`INSERT INTO PerformanceReportQFvalues (formName, qfValue, date) VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})`;
        } else if (setting.formName === 'unpoured-mould-details') {
            await sql.query`INSERT INTO UnpouredMouldQFvalues (formName, qfValue, date) VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})`;
        } else if (setting.formName === 'lpa') {
            await sql.query`INSERT INTO BottomLevelAuditQFvalues (formName, qfValue, date) VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})`;
        } else if (setting.formName === 'disa-operator') {
            await sql.query`INSERT INTO MachineChecklistQFvalues (formName, qfValue, date) VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})`;
        } else if (setting.formName === 'dmm-setting-parameters') {
            await sql.query`INSERT INTO DmmSettingQFvalues (formName, qfValue, date) VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})`;
        } else if (setting.formName === 'disa-setting-adjustment') {
            await sql.query`INSERT INTO DISASettingAdjustmentQFvalues (formName, qfValue, date) VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})`;
        } else if (setting.formName === 'mould-quality') {
            await sql.query`INSERT INTO MouldQualityQFvalues (formName, qfValue, date) VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})`;
        } else if (setting.formName === '4m-change') {
            await sql.query`INSERT INTO FourMChangeQFvalues (formName, qfValue, date) VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})`;
        } 
        // ✅ ERROR PROOF 2 ALREADY PRESENT (kept unchanged)
        else if (setting.formName === 'error-proof2') {
            await sql.query`
                INSERT INTO ErrorProof2QFvalues (formName, qfValue, date)
                VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})
            `;
        }
        // ✅ ERROR PROOF 1 ADDED HERE
        else if (setting.formName === 'error-proof') {
            await sql.query`
                INSERT INTO ErrorProof1QFvalues (formName, qfValue, date)
                VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})
            `;
        }
        else {
            await sql.query`INSERT INTO DisamaticReportQFvalues (formName, qfValue, date) VALUES (${setting.formName}, ${setting.qfValue}, ${safeDate})`;
        }
        
        res.json({ message: "New QF value record created successfully" });
    } catch (err) {
        console.error("updateFormSettings error:", err);
        res.status(500).json({ error: "Failed to save new form setting", details: err.message });
    }
};