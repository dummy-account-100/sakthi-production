const sql = require("../db"); // 🔥 Safe import

// Map frontend form IDs to their specific SQL Master Tables
const tableMapping = {
    'disa-operator': 'MachineChecklist_Master',
    'lpa': 'BottomLevelAudit_Master',
    'error-proof': 'ErrorProof_Master',
    'unpoured-mould-details': 'UnpouredMould_Master',
    'dmm-setting-parameters': 'DmmSetting_Master',
    'disamatic-production': 'DisamaticProd_Master',
    'disa-setting-adjustment': 'DisaSettingAdjustment_Master'
};

exports.getMasterConfig = async (req, res) => {
    try {
        const { type } = req.params;
        const tableName = tableMapping[type];

        if (!tableName) {
            return res.status(400).json({ error: 'Config management not supported for this form type.' });
        }

        const request = new sql.Request();
        
        // 🔥 FIX 1: Ensure we only fetch items that are NOT soft-deleted
        const result = await request.query(`
            SELECT * FROM ${tableName} 
            WHERE IsDeleted = 0 OR IsDeleted IS NULL
            ORDER BY SlNo ASC
        `);

        let standardData = [];

        // Standardize output to match React UI expectations
        if (type === 'error-proof') {
            standardData = result.recordset.map(row => ({
                id: row.MasterId,
                slNo: row.SlNo,
                line: row.Line || '',
                errorProofName: row.ErrorProofName || '',
                natureOfErrorProof: row.NatureOfErrorProof || '',
                frequency: row.Frequency || '',
                isDeleted: row.IsDeleted || false,
                isNew: false
            }));
        } else if (type === 'unpoured-mould-details') {
            standardData = result.recordset.map(row => ({
                id: row.MasterId,
                slNo: row.SlNo,
                department: row.Department || '',
                reasonName: row.ReasonName || '',
                isDeleted: row.IsDeleted || false,
                isNew: false
            }));
        } else if (type === 'dmm-setting-parameters') {
            standardData = result.recordset.map(row => ({
                id: row.MasterId || row.id, 
                slNo: row.SlNo,
                columnKey: row.ColumnKey || '',
                columnLabel: row.ColumnLabel || '',
                inputType: row.InputType || 'text',
                columnWidth: row.ColumnWidth || 'w-32',
                isDeleted: row.IsDeleted || false,
                isNew: false
            }));
        } else if (type === 'disa-setting-adjustment') {
            standardData = result.recordset.map(row => ({
                id: row.MasterId,
                slNo: row.SlNo,
                parameterName: row.ParameterName || '',
                description: row.Description || '',
                isDeleted: row.IsDeleted || false,
                isNew: false
            }));
        } else {
            standardData = result.recordset.map(row => ({
                id: row.MasterId,
                slNo: row.SlNo,
                description: row.CheckPointDesc,
                method: row.CheckMethod || 'Visual',
                isDeleted: row.IsDeleted || false,
                isNew: false
            }));
        }

        res.json({ config: standardData, module: type });

    } catch (err) {
        console.error("Config Fetch Error:", err);
        res.status(500).send('Server Error');
    }
};

exports.saveMasterConfig = async (req, res) => {
    const transaction = new sql.Transaction();
    try {
        const { type } = req.params;
        const { config } = req.body;
        const tableName = tableMapping[type];

        if (!tableName || !Array.isArray(config)) {
            return res.status(400).json({ error: 'Invalid input' });
        }

        await transaction.begin();

        for (const item of config) {
            if (item.isNew && !item.isDeleted) {
                // INSERT NEW ROW
                const request = new sql.Request(transaction);
                if (type === 'disa-operator') {
                    await request.query(`
                        INSERT INTO ${tableName} (SlNo, CheckPointDesc, CheckMethod)
                        VALUES (${item.slNo}, '${item.description.replace(/'/g, "''")}', '${item.method.replace(/'/g, "''")}')
                    `);
                } else if (type === 'lpa') {
                    await request.query(`
                        INSERT INTO ${tableName} (SlNo, CheckPointDesc)
                        VALUES (${item.slNo}, '${item.description.replace(/'/g, "''")}')
                    `);
                } else if (type === 'error-proof') {
                    await request.query(`
                        INSERT INTO ${tableName} (SlNo, Line, ErrorProofName, NatureOfErrorProof, Frequency, IsDeleted)
                        VALUES (${item.slNo}, '${item.line.replace(/'/g, "''")}', '${item.errorProofName.replace(/'/g, "''")}', '${item.natureOfErrorProof.replace(/'/g, "''")}', '${item.frequency.replace(/'/g, "''")}', 0)
                    `);
                } else if (type === 'unpoured-mould-details') {
                    await request.query(`
                        INSERT INTO ${tableName} (SlNo, Department, ReasonName, IsDeleted)
                        VALUES (${item.slNo}, '${item.department.replace(/'/g, "''")}', '${item.reasonName.replace(/'/g, "''")}', 0)
                    `);
                } else if (type === 'dmm-setting-parameters') {
                    await request.query(`
                        INSERT INTO ${tableName} (SlNo, ColumnKey, ColumnLabel, InputType, ColumnWidth, IsDeleted)
                        VALUES (${item.slNo}, '${item.columnKey.replace(/'/g, "''")}', '${item.columnLabel.replace(/'/g, "''")}', '${item.inputType}', '${item.columnWidth}', 0)
                    `);
                } else if (type === 'disa-setting-adjustment') {
                    await request.query(`
                        INSERT INTO ${tableName} (SlNo, ParameterName, Description, IsDeleted)
                        VALUES (${item.slNo}, '${item.parameterName.replace(/'/g, "''")}', '${item.description.replace(/'/g, "''")}', 0)
                    `);
                }
            } else if (!item.isNew) {
                // UPDATE OR SOFT DELETE EXISTING ROW
                const request = new sql.Request(transaction);

                // For dmm-setting-parameters, ID might be 'id', others use 'MasterId'
                const primaryKeyColumn = type === 'dmm-setting-parameters' ? 'id' : 'MasterId';

                if (item.isDeleted) {
                    // 🔥 FIX 2: Soft delete instead of Hard delete. This prevents the EREQUEST constraint crash!
                    await request.query(`UPDATE ${tableName} SET IsDeleted = 1 WHERE ${primaryKeyColumn} = ${item.id}`);
                } else {
                    if (type === 'disa-operator') {
                        await request.query(`
                            UPDATE ${tableName} 
                            SET SlNo = ${item.slNo}, 
                                CheckPointDesc = '${item.description.replace(/'/g, "''")}',
                                CheckMethod = '${item.method.replace(/'/g, "''")}'
                            WHERE MasterId = ${item.id}
                        `);
                    } else if (type === 'lpa') {
                        await request.query(`
                            UPDATE ${tableName} 
                            SET SlNo = ${item.slNo}, 
                                CheckPointDesc = '${item.description.replace(/'/g, "''")}'
                            WHERE MasterId = ${item.id}
                        `);
                    } else if (type === 'error-proof') {
                        await request.query(`
                            UPDATE ${tableName} 
                            SET SlNo = ${item.slNo}, 
                                Line = '${item.line.replace(/'/g, "''")}',
                                ErrorProofName = '${item.errorProofName.replace(/'/g, "''")}',
                                NatureOfErrorProof = '${item.natureOfErrorProof.replace(/'/g, "''")}',
                                Frequency = '${item.frequency.replace(/'/g, "''")}'
                            WHERE MasterId = ${item.id}
                        `);
                    } else if (type === 'unpoured-mould-details') {
                        await request.query(`
                            UPDATE ${tableName} 
                            SET SlNo = ${item.slNo}, 
                                Department = '${item.department.replace(/'/g, "''")}',
                                ReasonName = '${item.reasonName.replace(/'/g, "''")}'
                            WHERE MasterId = ${item.id}
                        `);
                    } else if (type === 'dmm-setting-parameters') {
                        await request.query(`
                            UPDATE ${tableName} 
                            SET SlNo = ${item.slNo}, 
                                ColumnKey = '${item.columnKey.replace(/'/g, "''")}',
                                ColumnLabel = '${item.columnLabel.replace(/'/g, "''")}',
                                InputType = '${item.inputType}',
                                ColumnWidth = '${item.columnWidth}'
                            WHERE id = ${item.id}
                        `);
                    } else if (type === 'disa-setting-adjustment') {
                        await request.query(`
                            UPDATE ${tableName} 
                            SET SlNo = ${item.slNo}, 
                                ParameterName = '${item.parameterName.replace(/'/g, "''")}',
                                Description = '${item.description.replace(/'/g, "''")}'
                            WHERE MasterId = ${item.id}
                        `);
                    }
                }
            }
        }

        await transaction.commit();
        res.json({ message: 'Configuration saved successfully' });

    } catch (err) {
        console.error("Config Save Error:", err);
        await transaction.rollback();
        res.status(500).send('Server Error saving config');
    }
};