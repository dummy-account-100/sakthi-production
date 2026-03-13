import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../Assets/logo.png'; // Make sure this path is correct

// --- Utility for Formatting ---
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB');
};

const getReportMonthYear = (fromDate) => {
    const d = new Date(fromDate);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
};

// 🔥 FIX: Bulletproof String-Based Date Extractor 🔥
const getSafeDateStr = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val.split('T')[0];
    try {
        return val.toISOString().split('T')[0];
    } catch (e) {
        return null;
    }
};

// 🔥 FIX: Smarter Dynamic QF String Helper 🔥
const getDynamicQfString = (recordDate, qfHistory, defaultFallback) => {
    if (!qfHistory || !Array.isArray(qfHistory) || qfHistory.length === 0) return defaultFallback;

    const targetDateStr = getSafeDateStr(recordDate);
    if (!targetDateStr) return defaultFallback;

    // History is expected to be sorted descending by date (newest first)
    for (const qf of qfHistory) {
        const qfDateStr = getSafeDateStr(qf.date);
        if (!qfDateStr) continue;

        // String lexicographical comparison works flawlessly for YYYY-MM-DD
        if (qfDateStr <= targetDateStr) {
            return qf.qfValue;
        }
    }

    // If the report date is older than ALL records in the DB, 
    // fall back to the oldest record in the DB instead of the hardcoded string!
    return qfHistory[qfHistory.length - 1].qfValue || defaultFallback;
};

// ============================================================================
// 1. UNPOURED MOULD DETAILS
// ============================================================================
export const generateUnPouredMouldPDF = async (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');

    const records = data.records || [];
    const qfHistory = data.qfHistory || [];

    if (records.length === 0) {
        doc.setFontSize(14);
        doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`UnPouredMouldDetails_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    let customCols = [];
    try {
        const token = localStorage.getItem('token');
        const configRes = await fetch(`${process.env.REACT_APP_API_URL}/api/config/unpoured-mould-details/master`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const configData = await configRes.json();
        customCols = (configData.config || []).map(c => ({
            key: `custom_${c.id}`, id: c.id, label: c.reasonName.toUpperCase().replace(' ', '\n'), group: c.department.toUpperCase(), isCustom: true
        }));
    } catch (e) { console.error("Could not fetch Unpoured custom schema for PDF"); }

    const baseColumns = [
        { key: 'PatternChange', label: 'PATTERN\nCHANGE', group: 'MOULDING' }, { key: 'HeatCodeChange', label: 'HEAT CODE\nCHANGE', group: 'MOULDING' },
        { key: 'MouldBroken', label: 'MOULD\nBROKEN', group: 'MOULDING' }, { key: 'AmcCleaning', label: 'AMC\nCLEANING', group: 'MOULDING' },
        { key: 'MouldCrush', label: 'MOULD\nCRUSH', group: 'MOULDING' }, { key: 'CoreFalling', label: 'CORE\nFALLING', group: 'MOULDING' },
        { key: 'SandDelay', label: 'SAND\nDELAY', group: 'SAND PLANT' }, { key: 'DrySand', label: 'DRY\nSAND', group: 'SAND PLANT' },
        { key: 'NozzleChange', label: 'NOZZLE\nCHANGE', group: 'PREESPOUR' }, { key: 'NozzleLeakage', label: 'NOZZLE\nLEAKAGE', group: 'PREESPOUR' },
        { key: 'SpoutPocking', label: 'SPOUT \nPOCKING', group: 'PREESPOUR' }, { key: 'StRod', label: 'S/T ROD\nCHANGE', group: 'PREESPOUR' },
        { key: 'QcVent', label: 'QC VENT/\nSLAG', group: 'QUALITY CONTROL' }, { key: 'OutMould', label: 'OUT\nMOULD', group: 'QUALITY CONTROL' },
        { key: 'LowMg', label: 'LOW\nMg', group: 'QUALITY CONTROL' }, { key: 'GradeChange', label: 'GRADE\nCHANGE', group: 'QUALITY CONTROL' },
        { key: 'MsiProblem', label: 'MSI\nPROBLEM', group: 'QUALITY CONTROL' }, { key: 'BrakeDown', label: 'BRAKE\nDOWN', group: 'MAINTENANCE' },
        { key: 'Wom', label: 'W/O M', group: 'FURNACE' }, { key: 'DevTrail', label: 'DEV/\nTRAIL', group: 'TOOLING' },
        { key: 'PowerCut', label: 'POWER\nCUT', group: 'OTHERS' }, { key: 'PlannedOff', label: 'PLANNED\nOFF', group: 'OTHERS' },
        { key: 'VatCleaning', label: 'VAT\nCLEANING', group: 'OTHERS' }, { key: 'Others', label: 'OTHERS', group: 'OTHERS' }
    ];

    const allColumns = [...baseColumns, ...customCols];

    const groupedData = {};
    records.forEach(row => {
        const dateKey = String(row.RecordDate || row.date).split('T')[0];
        const machine = row.DisaMachine || 'DISA - I';

        if (!groupedData[dateKey]) groupedData[dateKey] = {};
        if (!groupedData[dateKey][machine]) groupedData[dateKey][machine] = { 1: {}, 2: {}, 3: {} };

        groupedData[dateKey][machine][row.Shift] = row;
    });

    let pageIndex = 0;

    Object.keys(groupedData).sort().forEach(dateKey => {
        Object.keys(groupedData[dateKey]).sort().forEach(machine => {
            if (pageIndex > 0) doc.addPage();
            pageIndex++;

            const shiftsData = groupedData[dateKey][machine];
            const disa = machine;

            doc.setLineWidth(0.3);
            doc.rect(10, 10, 40, 20);
            try {
                doc.addImage(logo, 'PNG', 12, 11, 36, 18);
            } catch (err) {
                doc.setFontSize(14); doc.setFont('helvetica', 'bold');
                doc.text("SAKTHI", 30, 18, { align: 'center' });
                doc.text("AUTO", 30, 26, { align: 'center' });
            }
            doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
            doc.text("UN POURED MOULD DETAILS", 140, 22, { align: 'center' });
            doc.rect(230, 10, 57, 20); doc.setFontSize(11);
            doc.text(`${disa}`, 258.5, 16, { align: 'center' });
            doc.line(230, 20, 287, 20);
            doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            doc.text(`DATE: ${formatDate(dateKey)}`, 258.5, 26, { align: 'center' });

            const headRow1 = [
                { content: 'SHIFT', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                ...(() => {
                    const pdfGroups = [];
                    let currentGroup = null; let groupSpan = 0;
                    allColumns.forEach((col) => {
                        if (!currentGroup) { currentGroup = col.group; groupSpan = 1; }
                        else if (currentGroup === col.group) { groupSpan++; }
                        else {
                            pdfGroups.push({ content: currentGroup, colSpan: groupSpan, styles: { halign: 'center' } });
                            currentGroup = col.group; groupSpan = 1;
                        }
                    });
                    if (currentGroup) pdfGroups.push({ content: currentGroup, colSpan: groupSpan, styles: { halign: 'center' } });
                    return pdfGroups;
                })(),
                { content: 'TOTAL', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [220, 220, 220] } }
            ];

            const headRow2 = allColumns.map(col => ({ content: col.label, styles: { halign: 'center', valign: 'middle', fontSize: 5.5 } }));

            const bodyRows = [1, 2, 3].map(shift => {
                const row = [shift.toString()];
                let rowTotal = 0;
                allColumns.forEach(col => {
                    const val = col.isCustom ? shiftsData[shift]?.customValues?.[col.id] : shiftsData[shift]?.[col.key];
                    row.push(val === '' || val === null || val === undefined ? '-' : val.toString());
                    rowTotal += parseInt(val) || 0;
                });
                row.push(rowTotal === 0 ? '-' : rowTotal.toString());
                return row;
            });

            const totalRow = ['TOTAL'];
            let grandTotal = 0;
            allColumns.forEach(col => {
                const colTotal = [1, 2, 3].reduce((sum, shift) => {
                    const val = col.isCustom ? shiftsData[shift]?.customValues?.[col.id] : shiftsData[shift]?.[col.key];
                    return sum + (parseInt(val) || 0);
                }, 0);
                totalRow.push(colTotal === 0 ? '-' : colTotal.toString());
                grandTotal += colTotal;
            });
            totalRow.push(grandTotal === 0 ? '-' : grandTotal.toString());
            bodyRows.push(totalRow);

            autoTable(doc, {
                startY: 35, margin: { left: 5, right: 5 }, head: [headRow1, headRow2], body: bodyRows, theme: 'grid',
                styles: { fontSize: 8, cellPadding: { top: 3.5, right: 1, bottom: 3.5, left: 1 }, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', minCellHeight: 12 }, bodyStyles: { minCellHeight: 10 },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.row.index === bodyRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [240, 240, 240];
                    }
                }
            });

            let sigY = doc.lastAutoTable.finalY + 10;
            if (sigY + 30 > 210) {
                doc.addPage();
                sigY = 20;
            }

            const shiftLabels = ["1st shift", "2nd shift", "3rd shift"];
            const xPositions = [50, 148.5, 247];

            doc.setFontSize(10).setFont('helvetica', 'bold');

            [1, 2, 3].forEach((shift, index) => {
                const x = xPositions[index];
                doc.text(shiftLabels[index], x, sigY + 20, { align: 'center' });

                const sigData = shiftsData[shift]?.OperatorSignature;
                if (sigData && sigData.startsWith('data:image')) {
                    try { doc.addImage(sigData, 'PNG', x - 20, sigY, 40, 15); } catch (e) { }
                }
            });

            // 🔥 PRINT DYNAMIC QF VALUE ON PAGE 🔥
            const currentPageQfValue = getDynamicQfString(dateKey, qfHistory, "QF/07/FBP-13, Rev.No:06 dt 08.10.2025");
            doc.setFontSize(8); doc.setFont('helvetica', 'normal');
            doc.text(currentPageQfValue, 10, 200);

        });
    });

    doc.save(`UnPoured_Mould_Details_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 2. DMM SETTING PARAMETERS
// ============================================================================
export const generateDmmSettingPDF = async (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');

    // 🔥 FIX: Extract qfHistory safely from data payload
    const qfHistory = data.qfHistory || [];

    let metaRecords = [];
    let transRecords = [];

    if (Array.isArray(data)) {
        metaRecords = data;
        transRecords = data;
    } else if (data) {
        metaRecords = data.meta || data.records || data.shiftsMeta || data.trans || [];
        transRecords = data.trans || data.shiftsData || data.records || data.meta || [];
    }

    if (metaRecords.length === 0) {
        doc.setFontSize(14); doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`DMM_Setting_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    let customCols = [];
    try {
        const token = localStorage.getItem('token');
        const configRes = await fetch(`${process.env.REACT_APP_API_URL}/api/config/dmm-setting-parameters/master`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        const configData = await configRes.json();
        customCols = (configData.config || []).map(c => ({
            key: `custom_${c.id}`, id: c.id, label: c.columnLabel.replace('\\n', '\n'), isCustom: true
        }));
    } catch (e) { console.error("Could not fetch DMM Custom Schema for PDF"); }

    const baseColumns = [
        { key: 'Customer', label: 'CUSTOMER' }, { key: 'ItemDescription', label: 'ITEM DESCRIPTION' }, { key: 'Time', label: 'TIME' },
        { key: 'PpThickness', label: 'PP\nTHICKNESS' }, { key: 'PpHeight', label: 'PP\nHEIGHT' },
        { key: 'SpThickness', label: 'SP\nTHICKNESS' }, { key: 'SpHeight', label: 'SP\nHEIGHT' },
        { key: 'CoreMaskOut', label: 'CORE MASK\n(OUT)' }, { key: 'CoreMaskIn', label: 'CORE MASK\n(IN)' },
        { key: 'SandShotPressure', label: 'SAND SHOT\nPRESSURE' }, { key: 'CorrectionShotTime', label: 'CORRECTION\nSHOT TIME' },
        { key: 'SqueezePressure', label: 'SQUEEZE\nPRESSURE' }, { key: 'PpStripAccel', label: 'PP STRIP\nACCEL' },
        { key: 'PpStripDist', label: 'PP STRIP\nDIST' }, { key: 'SpStripAccel', label: 'SP STRIP\nACCEL' },
        { key: 'SpStripDist', label: 'SP STRIP\nDIST' }, { key: 'MouldThickness', label: 'MOULD\nTHICKNESS' },
        { key: 'CloseUpForce', label: 'CLOSE UP\nFORCE' }, { key: 'Remarks', label: 'REMARKS' }
    ];

    const allColumns = [...baseColumns, ...customCols];

    const groupedData = {};
    metaRecords.forEach(m => {
        const d = String(m.RecordDate || m.date).split('T')[0];
        const machine = m.DisaMachine || 'DISA - I';
        const shift = m.Shift || 1;

        if (!groupedData[d]) groupedData[d] = {};
        if (!groupedData[d][machine]) groupedData[d][machine] = { shiftsMeta: {}, shiftsData: {} };

        if (!groupedData[d][machine].shiftsMeta[shift]) {
            groupedData[d][machine].shiftsMeta[shift] = {
                operator: m.OperatorName || '',
                supervisor: m.SupervisorName || '',
                supervisorSignature: m.SupervisorSignature || '',
                isIdle: m.IsIdle === true || m.IsIdle === 1
            };
            groupedData[d][machine].shiftsData[shift] = [];
        }
    });

    transRecords.forEach(t => {
        const d = String(t.RecordDate || t.date).split('T')[0];
        const machine = t.DisaMachine || 'DISA - I';
        if (groupedData[d] && groupedData[d][machine]) {
            groupedData[d][machine].shiftsData[t.Shift || 1].push(t);
        }
    });

    let isFirstPage = true;

    Object.keys(groupedData).sort().forEach(dateKey => {
        Object.keys(groupedData[dateKey]).sort().forEach(machine => {
            if (!isFirstPage) doc.addPage();
            isFirstPage = false;

            const machineData = groupedData[dateKey][machine];

            doc.setLineWidth(0.3);
            doc.rect(10, 10, 40, 20);
            try {
                doc.addImage(logo, 'PNG', 12, 11, 36, 18);
            } catch (err) {
                doc.setFontSize(14); doc.setFont('helvetica', 'bold');
                doc.text("SAKTHI", 30, 18, { align: 'center' });
                doc.text("AUTO", 30, 26, { align: 'center' });
            }
            doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
            doc.text("DMM SETTING PARAMETERS CHECK SHEET", 140, 22, { align: 'center' });
            doc.rect(230, 10, 57, 20); doc.setFontSize(11);
            doc.text(`${machine}`, 258.5, 16, { align: 'center' });
            doc.line(230, 20, 287, 20);
            doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            doc.text(`DATE: ${formatDate(dateKey)}`, 258.5, 26, { align: 'center' });

            autoTable(doc, {
                startY: 35, margin: { left: 10, right: 10 },
                head: [['SHIFT', 'OPERATOR NAME', 'VERIFIED BY', 'SIGNATURE']],
                body: [1, 2, 3].map(s => {
                    const m = machineData.shiftsMeta[s] || {};
                    return [`SHIFT ${s === 1 ? 'I' : s === 2 ? 'II' : 'III'}`, m.operator || '-', m.supervisor || '-', ''];
                }),
                theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
                didDrawCell: function (data) {
                    if (data.section === 'body' && data.column.index === 3) {
                        const m = machineData.shiftsMeta[data.row.index + 1] || {};
                        if (m.supervisorSignature && m.supervisorSignature.startsWith('data:image')) {
                            try { doc.addImage(m.supervisorSignature, 'PNG', data.cell.x + 2, data.cell.y + 1, data.cell.width - 4, data.cell.height - 2); } catch (e) { }
                        }
                    }
                }
            });

            let currentY = doc.lastAutoTable.finalY + 8;

            // 🔥 FIND DYNAMIC QF VALUE 🔥
            const currentPageQfValue = getDynamicQfString(dateKey, qfHistory, "QF/07/FBP-13, Rev.No:06 dt 08.10.2025");

            [1, 2, 3].forEach((shift, index) => {
                const m = machineData.shiftsMeta[shift] || {};
                const t = machineData.shiftsData[shift] || [];
                const isIdle = m.isIdle === true || Number(m.isIdle) === 1;
                const shiftLabel = shift === 1 ? 'I' : shift === 2 ? 'II' : 'III';

                const tableHeader = [
                    [{ content: `SHIFT ${shiftLabel}`, colSpan: allColumns.length + 1, styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [0, 0, 0] } }],
                    [{ content: 'S.No', styles: { cellWidth: 8 } }, ...allColumns.map(col => ({ content: col.label, styles: { cellWidth: 'wrap' } }))]
                ];

                let tableBody = [];
                if (isIdle) {
                    tableBody.push([{ content: 'L I N E   I D L E', colSpan: allColumns.length + 1, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 14, textColor: [100, 100, 100], fillColor: [245, 245, 245], minCellHeight: 15 } }]);
                } else {
                    const rowsObj = {};
                    t.forEach(record => {
                        if (!rowsObj[record.RowUUID]) rowsObj[record.RowUUID] = {};
                        rowsObj[record.RowUUID][record.MasterId] = record.Value;
                    });

                    const rowsArr = Object.values(rowsObj);
                    if (rowsArr.length === 0) rowsArr.push({});

                    tableBody = rowsArr.map((row, idx) => {
                        const pdfRow = [(idx + 1).toString()];
                        allColumns.forEach(col => {
                            const val = row[col.MasterId || col.id];
                            pdfRow.push(val === '' || val === null || val === undefined ? '-' : val.toString());
                        });
                        return pdfRow;
                    });
                }

                autoTable(doc, {
                    startY: currentY, margin: { left: 5, right: 5 }, head: tableHeader, body: tableBody, theme: 'grid',
                    styles: { fontSize: 5.5, cellPadding: 0.8, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
                    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 5 },
                    columnStyles: { 0: { cellWidth: 8 } }
                });

                currentY = doc.lastAutoTable.finalY + 5;
                if (currentY > 175 && index < 2) {
                    doc.setFontSize(8); doc.text(currentPageQfValue, 10, 200);
                    doc.addPage(); currentY = 15;
                }
            });

            doc.setFontSize(8); doc.text(currentPageQfValue, 10, 200);
        });
    });

    doc.save(`DMM_Setting_Parameters_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 3 & 4. DISA OPERATOR & LPA CHECKLIST
// ============================================================================
export const generateChecklistPDF = (data, dateRange, title1, title2) => {
    const doc = new jsPDF('l', 'mm', 'a4');

    // 🔥 Extract qfHistory 
    const { master, trans, ncr, qfHistory = [] } = data;

    if (!trans || trans.length === 0) {
        doc.setFontSize(14); doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`${title1.replace(/\s+/g, '_')}_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    const isLPA = title1.includes('AUDIT');
    const reportGroups = [];

    trans.forEach(t => {
        const d = new Date(t.LogDate || t.RecordDate || t.date);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const machine = t.DisaMachine;
        const groupKey = `${machine}_${monthKey}`;

        let group = reportGroups.find(g => g.key === groupKey);
        if (!group) {
            group = { key: groupKey, machine, monthKey, trans: [], ncr: [] };
            reportGroups.push(group);
        }
        group.trans.push(t);
    });

    if (ncr) {
        ncr.forEach(n => {
            const d = new Date(n.ReportDate || n.RecordDate || n.date);
            if (isNaN(d.getTime())) return;
            const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const groupKey = `${n.DisaMachine}_${monthKey}`;

            let group = reportGroups.find(g => g.key === groupKey);
            if (group) {
                group.ncr.push(n);
            } else {
                reportGroups.push({ key: groupKey, machine: n.DisaMachine, monthKey, trans: [], ncr: [n] });
            }
        });
    }

    reportGroups.sort((a, b) => a.key.localeCompare(b.key));
    let isFirstPage = true;

    reportGroups.forEach(group => {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        const { machine, monthKey, trans: machineTrans, ncr: machineNc } = group;
        const [year, month] = monthKey.split('-');
        const reportMonthDate = new Date(year, parseInt(month) - 1, 1);

        // 🔥 MATCH QF VALUE TO CURRENT FORM DATE 🔥
        let reportDateStr = monthKey + '-01';
        if (machineTrans && machineTrans.length > 0) {
            reportDateStr = machineTrans[0].LogDate || machineTrans[0].RecordDate || machineTrans[0].date;
        }
        const dynamicFallback = isLPA ? "QF/08/MRO - 18, Rev No: 02 dt 01.01.2022" : "QF/07/FBP-13, Rev.No:06 dt 08.10.2025";
        const currentPageQfValue = getDynamicQfString(reportDateStr, qfHistory, dynamicFallback);

        const historyMap = {};
        const holidayDays = new Set();
        const vatDays = new Set();
        const prevMaintDays = new Set();
        const sig1Map = {};
        const sig2Map = {};

        machineTrans.forEach(log => {
            const dateObj = new Date(log.LogDate || log.RecordDate || log.date);
            const logDay = dateObj.getDate();
            const key = String(log.MasterId);

            const isHol = Number(log.IsHoliday) === 1 || log.IsHoliday === true || String(log.IsHoliday) === '1';
            const isVat = Number(log.IsVatCleaning) === 1 || log.IsVatCleaning === true || String(log.IsVatCleaning) === '1';
            const isPM = Number(log.IsPreventiveMaintenance) === 1 || log.IsPreventiveMaintenance === true || String(log.IsPreventiveMaintenance) === '1';

            if (isHol) holidayDays.add(logDay);
            else if (isVat) vatDays.add(logDay);
            else if (isPM) prevMaintDays.add(logDay);

            if (log.OperatorSignature) sig1Map[logDay] = log.OperatorSignature;
            if (log.SupervisorSignature) sig1Map[logDay] = log.SupervisorSignature;

            if (log.HODSignature) sig2Map[logDay] = log.HODSignature;
            if (log.HOFSignature) sig2Map[logDay] = log.HOFSignature;

            if (!historyMap[key]) historyMap[key] = {};

            if (isHol || isVat || isPM) {
                historyMap[key][logDay] = '';
            } else if (Number(log.IsNa) === 1 || log.IsNa === true || Number(log.IsNA) === 1 || log.IsNA === true) {
                historyMap[key][logDay] = 'NA';
            } else if (log.ReadingValue) {
                historyMap[key][logDay] = log.ReadingValue;
            } else {
                historyMap[key][logDay] = (Number(log.IsDone) === 1 || log.IsDone === true) ? 'Y' : 'N';
            }
        });

        // 🔥 PAGE 1 HEADER 🔥
        doc.setLineWidth(0.3);
        doc.rect(10, 10, 40, 20);
        try {
            doc.addImage(logo, 'PNG', 12, 11, 36, 18);
        } catch (err) {
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text("SAKTHI", 30, 18, { align: 'center' });
            doc.text("AUTO", 30, 26, { align: 'center' });
        }
        doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
        doc.text(title1, 140, 22, { align: 'center' });
        doc.rect(230, 10, 57, 20); doc.setFontSize(11);
        doc.text(`${machine}`, 258.5, 16, { align: 'center' });
        doc.line(230, 20, 287, 20);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(`Month: ${getReportMonthYear(reportMonthDate)}`, 258.5, 26, { align: 'center' });

        const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

        const tableBody = master.map((item, rowIndex) => {
            const row = [String(item.SlNo), item.CheckPointDesc, item.CheckMethod || 'VISUAL'];
            for (let i = 1; i <= 31; i++) {
                if (holidayDays.has(i)) {
                    if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: master.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } });
                } else if (vatDays.has(i)) {
                    if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: master.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } });
                } else if (prevMaintDays.has(i)) {
                    if (rowIndex === 0) row.push({
                        content: 'P\nR\nE\nV\nE\nN\nT\nI\nV\nE\n\nM\nA\nI\nN\nT\nE\nN\nA\nN\nC\nE',
                        rowSpan: master.length,
                        styles: { halign: 'center', valign: 'middle', fillColor: [243, 232, 255], fontStyle: 'bold', textColor: [126, 34, 206], fontSize: 4.5 }
                    });
                } else {
                    row.push(historyMap[item.MasterId]?.[i] || '');
                }
            }
            return row;
        });

        const sig1Label = isLPA ? "SUPERVISOR SIGN" : "OPERATOR SIGN";
        const sig2Label = isLPA ? "HOF SIGN" : "HOD - MOU SIGN";

        const sig1Row = ["", sig1Label, ""];
        const sig2Row = ["", sig2Label, ""];

        for (let i = 1; i <= 31; i++) {
            sig1Row.push("");
            sig2Row.push("");
        }

        const footerRows = [sig1Row, sig2Row];
        const dynamicColumnStyles = {};
        for (let i = 3; i < 34; i++) { dynamicColumnStyles[i] = { cellWidth: 5, halign: 'center' }; }

        autoTable(doc, {
            startY: 35,
            head: [['Sl.No', 'CHECK POINTS', 'CHECK METHOD', ...days]],
            body: [...tableBody, ...footerRows],
            theme: 'grid', styles: { fontSize: 6, cellPadding: 0.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
            columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 60 }, 2: { cellWidth: 25 }, ...dynamicColumnStyles },
            didDrawCell: function (data) {
                if (data.row.index >= tableBody.length && data.column.index > 2) {
                    const dayIndex = data.column.index - 2;
                    const isSig1Row = data.row.index === tableBody.length;

                    const sigData = isSig1Row ? sig1Map[dayIndex] : sig2Map[dayIndex];
                    if (sigData && sigData.startsWith('data:image')) {
                        doc.setFillColor(255, 255, 255);
                        doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, 'F');
                        try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch (e) { }
                    }
                }
            },
            didParseCell: function (data) {
                if (data.row.index >= tableBody.length && data.column.index === 1) data.cell.styles.fontStyle = 'bold';

                if (data.row.index >= tableBody.length && data.column.index > 2) {
                    data.cell.text = [];
                }

                if (data.column.index > 2 && data.row.index < tableBody.length) {
                    const text = data.cell.text?.[0] || '';
                    if (text === 'Y') { data.cell.styles.font = 'ZapfDingbats'; data.cell.text = ['3']; data.cell.styles.textColor = [0, 100, 0]; }
                    else if (text === 'N') { data.cell.styles.textColor = [255, 0, 0]; data.cell.text = ['X']; data.cell.styles.fontStyle = 'bold'; }
                    else if (text === 'NA') { data.cell.styles.fontSize = 5; data.cell.styles.textColor = [100, 100, 100]; data.cell.styles.fontStyle = 'bold'; }
                }
            }
        });

        doc.setFontSize(8);
        if (isLPA) {
            doc.setFont('helvetica', 'bold');
            doc.text("Legend:   3 - OK     X - NOT OK     CA - Corrected during Audit     NA - Not Applicable", 10, doc.lastAutoTable.finalY + 5);
            doc.setFont('helvetica', 'normal');
        }

        // 🔥 PRINT DYNAMIC QF VALUE ON PAGE 1
        doc.text(currentPageQfValue, 10, 200);

        if (machineNc.length > 0) {
            doc.addPage();
            // 🔥 PAGE 2 HEADER (NCR) 🔥
            doc.setLineWidth(0.3);
            doc.rect(10, 10, 40, 20);
            try {
                doc.addImage(logo, 'PNG', 12, 11, 36, 18);
            } catch (err) {
                doc.setFontSize(14); doc.setFont('helvetica', 'bold');
                doc.text("SAKTHI", 30, 18, { align: 'center' });
                doc.text("AUTO", 30, 26, { align: 'center' });
            }
            doc.rect(50, 10, 237, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
            doc.text(title2, 168.5, 18, { align: 'center' }); doc.setFontSize(14);
            doc.text("Non-Conformance Report", 168.5, 26, { align: 'center' });

            const ncRows = machineNc.map((report, index) => [
                index + 1, formatDate(report.ReportDate || report.RecordDate || report.date), report.NonConformityDetails || '', report.Correction || '',
                report.RootCause || '', report.CorrectiveAction || '', report.TargetDate ? formatDate(report.TargetDate) : '',
                report.Responsibility || '', '', report.Status || ''
            ]);

            autoTable(doc, {
                startY: 35, head: [['S.No', 'Date', 'Non-Conformities Details', 'Correction', 'Root Cause', 'Corrective Action', 'Target Date', 'Responsibility', isLPA ? 'Signature' : 'Name', 'Status']],
                body: ncRows, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'top', overflow: 'linebreak' },
                headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
                columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 35 }, 4: { cellWidth: 35 }, 5: { cellWidth: 35 }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 25 }, 8: { cellWidth: 20, halign: 'center' }, 9: { cellWidth: 20, halign: 'center' } },
                didDrawCell: function (data) {
                    if (isLPA && data.section === 'body' && data.column.index === 8) {
                        const rowData = machineNc[data.row.index];
                        if (rowData && rowData.SupervisorSignature && rowData.SupervisorSignature.startsWith('data:image')) {
                            try { doc.addImage(rowData.SupervisorSignature, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch (e) { }
                        }
                    }
                },
                didParseCell: function (data) {
                    if (isLPA && data.section === 'body' && data.column.index === 8) {
                        data.cell.text = [];
                    }
                    if (data.section === 'body' && data.column.index === 9) {
                        const statusText = (data.cell.text || [])[0] || '';
                        if (statusText === 'Completed') { data.cell.styles.textColor = [0, 150, 0]; data.cell.styles.fontStyle = 'bold'; }
                        else if (statusText === 'Pending') { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold'; }
                    }
                }
            });

            // 🔥 PRINT DYNAMIC QF VALUE ON PAGE 2
            doc.setFontSize(8); doc.setFont('helvetica', 'normal');
            let ncrDateStr = monthKey + '-01';
            if (machineNc && machineNc.length > 0) {
                ncrDateStr = machineNc[0].ReportDate || machineNc[0].RecordDate || machineNc[0].date;
            }
            const ncrDynamicQf = getDynamicQfString(ncrDateStr, qfHistory, dynamicFallback);
            doc.text(ncrDynamicQf, 10, 200);
        }
    });

    const safeTitle = title1.replace(/\s+/g, '_');
    doc.save(`${safeTitle}_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

export const generateErrorProofPDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    
    const verifications = data.verifications || [];
    const plans = data.plans || [];
    const qfHistory = data.qfHistory || [];

    if (!verifications || verifications.length === 0) {
        doc.setFontSize(14); doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`ErrorProof_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    const groupedByDateAndMachine = {};
    verifications.forEach(row => {
        const dateKey = String(row.recordDate || row.RecordDate).split('T')[0];
        const machine = row.line || row.DisaMachine;
        if (!groupedByDateAndMachine[dateKey]) groupedByDateAndMachine[dateKey] = {};
        if (!groupedByDateAndMachine[dateKey][machine]) groupedByDateAndMachine[dateKey][machine] = { v: [], r: [] };
        groupedByDateAndMachine[dateKey][machine].v.push(row);
    });

    if (plans) {
        plans.forEach(plan => {
            const planDateKey = String(plan.recordDate || plan.RecordDate).split('T')[0];
            const planName = plan.errorProofName || plan.ErrorProofName;

            // 🔥 CRITICAL FIX: Match the reaction plan EXACTLY to the verification on the same Date and Error Proof Name
            const exactVerification = verifications.find(v => 
                String(v.recordDate || v.RecordDate).split('T')[0] === planDateKey &&
                (v.errorProofName || v.ErrorProofName) === planName
            );

            // Fallback in case timestamps drifted: find any verification in the whole array with the same name
            const fallbackVerification = verifications.find(v => (v.errorProofName || v.ErrorProofName) === planName);

            const machine = exactVerification ? (exactVerification.line || exactVerification.DisaMachine) : 
                            (fallbackVerification ? (fallbackVerification.line || fallbackVerification.DisaMachine) : null);

            if (machine) {
                // Standard exact match
                if (groupedByDateAndMachine[planDateKey] && groupedByDateAndMachine[planDateKey][machine]) {
                    groupedByDateAndMachine[planDateKey][machine].r.push(plan);
                } 
                // Fallback: If dates drifted, attach it to the actual date group where the machine and error proof exist
                else {
                    const actualDateKey = Object.keys(groupedByDateAndMachine).find(dk => 
                        groupedByDateAndMachine[dk][machine] && 
                        groupedByDateAndMachine[dk][machine].v.some(v => (v.errorProofName || v.ErrorProofName) === planName)
                    );
                    if (actualDateKey) {
                        groupedByDateAndMachine[actualDateKey][machine].r.push(plan);
                    }
                }
            }
        });
    }

    let isFirstPage = true;
    const PAGE_HEIGHT = 210; 

    Object.keys(groupedByDateAndMachine).sort().forEach(dateKey => {
        Object.keys(groupedByDateAndMachine[dateKey]).sort().forEach(machine => {
            if (!isFirstPage) doc.addPage();
            isFirstPage = false;

            let currentPageQfValue = "QF/07/FBP-13, Rev.No:06 dt 08.10.2025"; 
            const reportDate = new Date(dateKey);
            reportDate.setHours(0, 0, 0, 0);

            for (let qf of qfHistory) {
                if (!qf.date) continue;
                const qfDate = new Date(qf.date);
                qfDate.setHours(0, 0, 0, 0);
                if (qfDate <= reportDate) {
                    currentPageQfValue = qf.qfValue;
                    break; 
                }
            }

            const records = groupedByDateAndMachine[dateKey][machine];
            const headerData = { date: dateKey, disaMachine: machine, reviewedBy: records.v[0]?.ReviewedByHOF || records.v[0]?.HOFSignature || '', approvedBy: records.v[0]?.ApprovedBy || records.v[0]?.OperatorSignature || '' };

            doc.setLineWidth(0.3);
            doc.rect(10, 10, 40, 20);
            try {
                doc.addImage(logo, 'PNG', 12, 11, 36, 18);
            } catch (err) {
                doc.setFontSize(14); doc.setFont('helvetica', 'bold');
                doc.text("SAKTHI", 30, 18, { align: 'center' }); 
                doc.text("AUTO", 30, 26, { align: 'center' });
            }
            doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
            doc.text("ERROR PROOF VERIFICATION REPORT", 140, 22, { align: 'center' });
            doc.rect(230, 10, 57, 20); doc.setFontSize(11);
            doc.text(`${machine}`, 258.5, 16, { align: 'center' });
            doc.line(230, 20, 287, 20);
            doc.setFontSize(10); doc.setFont('helvetica', 'normal'); 
            doc.text(`DATE: ${formatDate(dateKey)}`, 258.5, 26, { align: 'center' });

            const vRows = records.v.map((item, index) => {
                const obs = item.observationResult === 'NOT_OK' ? 'NOT OK' : (item.observationResult || '-');
                return [
                    index + 1, 
                    item.line || item.DisaMachine, 
                    item.errorProofName || item.ErrorProofName, 
                    item.natureOfErrorProof || item.NatureOfErrorProof, 
                    item.frequency || item.Frequency,
                    obs
                ];
            });

            autoTable(doc, {
                startY: 35,
                head: [['S.No', 'Line', 'Error Proof Name', 'Nature of Error Proof', 'Frequency', 'Observation Result']],
                body: vRows, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                columnStyles: { 0: { halign: 'center', cellWidth: 12 }, 5: { halign: 'center', fontStyle: 'bold', cellWidth: 25 } }
            });

            let currentY = doc.lastAutoTable.finalY + 10;
            
            if (records.r && records.r.length > 0) {
                doc.setFontSize(14); doc.setFont('helvetica', 'bold');
                doc.text("Reaction Plan", 148.5, currentY, { align: 'center' });
                currentY += 5;

                const rRows = records.r.map((item, index) => [
                    index + 1, 
                    item.errorProofNo || '-', 
                    item.errorProofName || item.ErrorProofName, 
                    formatDate(dateKey), 
                    item.problem || item.Problem, 
                    item.rootCause || item.RootCause, 
                    item.correctiveAction || item.CorrectiveAction, 
                    item.status || item.Status, 
                    item.remarks || item.Remarks
                ]);
                
                autoTable(doc, {
                    startY: currentY,
                    margin: { left: 10, right: 10 }, 
                    head: [['S.No', 'Ep.No', 'Error Proof Name', 'Verification Date', 'Problem', 'Root Cause', 'Corrective action taken \n (Temporary)', 'Status', 'Remarks']],
                    body: rRows, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0] },
                    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
                    columnStyles: { 
                        0: { cellWidth: 10, halign: 'center' }, 
                        1: { cellWidth: 12 }, 
                        2: { cellWidth: 35 }, 
                        3: { cellWidth: 20 }, 
                        4: { cellWidth: 35 }, 
                        5: { cellWidth: 35 }, 
                        6: { cellWidth: 40 }, 
                        7: { cellWidth: 15 }, 
                        8: { cellWidth: 'auto' } 
                    }
                });
                currentY = doc.lastAutoTable.finalY + 10;
            }

            if (currentY + 30 > PAGE_HEIGHT) { doc.addPage(); currentY = 20; }

            autoTable(doc, {
                startY: currentY, margin: { left: 10, right: 10 }, head: [['REVIEWED BY (OP/HOF)', 'APPROVED BY (SUP)']], 
                body: [['SIG1', 'SIG2']], theme: 'grid',
                styles: { fontSize: 10, cellPadding: 4, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', minCellHeight: 15 }, 
                headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
                didDrawCell: function (data) {
                    if (data.section === 'body') {
                        if (data.column.index === 0 && headerData.reviewedBy && headerData.reviewedBy.startsWith('data:image')) {
                            try { doc.addImage(headerData.reviewedBy, 'PNG', data.cell.x + 2, data.cell.y + 2, 40, 10); } catch (e) {}
                        }
                        if (data.column.index === 1 && headerData.approvedBy && headerData.approvedBy.startsWith('data:image')) {
                            try { doc.addImage(headerData.approvedBy, 'PNG', data.cell.x + 2, data.cell.y + 2, 40, 10); } catch (e) {}
                        }
                    }
                },
                didParseCell: function (data) {
                    if (data.section === 'body' && (data.cell.raw === 'SIG1' || data.cell.raw === 'SIG2')) {
                        const val = data.column.index === 0 ? headerData.reviewedBy : headerData.approvedBy;
                        if (val && !val.startsWith('data:image')) data.cell.text = val;
                        else data.cell.text = '';
                    }
                }
            });

            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); 
            doc.text(currentPageQfValue, 10, 200);
        });
    });

    doc.save(`ErrorProof_Verification_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 5a. ERROR PROOF VERIFICATION (V1 - Alternate layout structure)
// ============================================================================
export const generateErrorProofV1PDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const verifications = data.verifications || [];
    const plans = data.plans || [];
    const qfHistory = data.qfHistory || [];

    if (verifications.length === 0) {
        doc.setFontSize(14);
        doc.text("No V1 Error Proof records found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`ErrorProof_V1_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    const grouped = {};
    verifications.forEach(v => {
        const d = v.recordDate ? v.recordDate.split('T')[0] : 'Unknown';
        const l = v.line || 'Unknown';
        const key = `${d}_${l}`;
        if (!grouped[key]) grouped[key] = { date: d, line: l, verifications: [], plans: [] };
        grouped[key].verifications.push(v);
    });

    plans.forEach(p => {
        const planDateKey = p.recordDate ? p.recordDate.split('T')[0] : 'Unknown';
        const planName = p.errorProofName;
        
        // 🔥 CRITICAL FIX: Ensure exact mapping
        let matchV = verifications.find(v => v.errorProofName === planName && v.recordDate && v.recordDate.split('T')[0] === planDateKey);
        
        // Fallback
        if (!matchV) {
            matchV = verifications.find(v => v.errorProofName === planName);
        }

        if (matchV) {
            const l = matchV.line || 'Unknown';
            const targetDateKey = matchV.recordDate ? matchV.recordDate.split('T')[0] : 'Unknown';
            const key = `${targetDateKey}_${l}`;
            
            if (grouped[key]) {
                if (!grouped[key].plans.some(existing => existing.sNo === p.sNo)) {
                    grouped[key].plans.push(p);
                }
            }
        }
    });

    let pageIndex = 0;
    Object.values(grouped).forEach(group => {
        if (pageIndex > 0) doc.addPage();
        pageIndex++;

        doc.setLineWidth(0.3);
        doc.rect(10, 10, 40, 20);
        try {
            doc.addImage(logo, 'PNG', 12, 11, 36, 18);
        } catch (err) {
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text("SAKTHI", 30, 18, { align: 'center' });
            doc.text("AUTO", 30, 26, { align: 'center' });
        }
        doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
        doc.text("ERROR PROOF VERIFICATION CHECK LIST (V1)", 140, 22, { align: 'center' });
        doc.rect(230, 10, 57, 20); doc.setFontSize(11);
        doc.text(`${group.line}`, 258.5, 16, { align: 'center' });
        doc.line(230, 20, 287, 20);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(`DATE: ${formatDate(group.date)}`, 258.5, 26, { align: 'center' });

        autoTable(doc, {
            startY: 35,
            head: [['Line', 'Error Proof Name', 'Nature of Error Proof', 'Frequency', 'Observation']],
            body: group.verifications.map(v => [
                v.line, v.errorProofName, v.natureOfErrorProof, v.frequency,
                v.observationResult === 'NOT_OK' ? 'NOT OK' : v.observationResult
            ]),
            theme: 'grid',
            styles: { fontSize: 8, halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] }
        });

        let finalY = doc.lastAutoTable.finalY + 10;
        const opSig = group.verifications.find(v => v.OperatorSignature)?.OperatorSignature;
        const hofSig = group.verifications.find(v => v.HOFSignature)?.HOFSignature;

        doc.setFontSize(10).setFont('helvetica', 'bold');
        doc.text("Operator Signature:", 14, finalY);
        doc.rect(14, finalY + 2, 45, 18).stroke();
        if (opSig && opSig.startsWith('data:image')) {
            try { doc.addImage(opSig, 'PNG', 15, finalY + 3, 43, 16); } catch (e) { }
        }

        doc.text("HOF Signature:", 148.5, finalY);
        doc.rect(148.5, finalY + 2, 45, 18).stroke();
        if (hofSig && hofSig.startsWith('data:image')) {
            try { doc.addImage(hofSig, 'PNG', 149.5, finalY + 3, 43, 16); } catch (e) { }
        }

        finalY += 30;

        if (group.plans.length > 0) {
            if (finalY > 150) { doc.addPage(); finalY = 20; }
            doc.setFontSize(12).text("REACTION PLAN", 148.5, finalY, { align: 'center' });
            autoTable(doc, {
                startY: finalY + 5,
                margin: { left: 10, right: 10 },
                head: [['S.No', 'EP No', 'Error Proof Name', 'Problem', 'Root Cause', 'Corrective Action', 'Status', 'Op Sign', 'Sup Sign', 'Remarks']],
                body: group.plans.map(p => [
                    p.sNo, p.errorProofNo, p.errorProofName, p.problem, p.rootCause, p.correctiveAction, p.status,
                    p.reviewedBy, 'SIG', p.remarks
                ]),
                theme: 'grid',
                styles: { fontSize: 7, halign: 'center', valign: 'middle' },
                headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] },
                columnStyles: { 
                    0: { cellWidth: 10 }, 
                    1: { cellWidth: 12 }, 
                    2: { cellWidth: 35 }, 
                    3: { cellWidth: 35 }, 
                    4: { cellWidth: 35 }, 
                    5: { cellWidth: 35 }, 
                    6: { cellWidth: 15 }, 
                    7: { cellWidth: 20 }, 
                    8: { cellWidth: 20 }, 
                    9: { cellWidth: 'auto' } 
                },
                didDrawCell: function (data) {
                    if (data.section === 'body' && data.column.index === 8) {
                        const p = group.plans[data.row.index];
                        if (p.SupervisorSignature && p.SupervisorSignature.startsWith('data:image')) {
                            try { doc.addImage(p.SupervisorSignature, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch (e) { }
                        }
                    }
                },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.column.index === 8 && data.cell.raw === 'SIG') data.cell.text = '';
                }
            });
        }

        const dynamicQf = getDynamicQfString(group.date, qfHistory, "QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023");
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(dynamicQf, 10, 200);
    });

    doc.save(`ErrorProof_V1_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 5b. ERROR PROOF VERIFICATION (V2 - ENTIRELY UNTOUCHED)
// ============================================================================
export const generateErrorProofV2PDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const verifications = data.verifications || [];
    const plans = data.plans || [];
    const qfHistory = data.qfHistory || [];

    if (verifications.length === 0) {
        doc.setFontSize(14);
        doc.text("No V2 Error Proof records found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`ErrorProof_V2_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    const grouped = {};
    verifications.forEach(v => {
        const d = v.RecordDate ? v.RecordDate.split('T')[0] : 'Unknown';
        const l = v.DisaMachine || 'Unknown';
        const key = `${d}_${l}`;
        if (!grouped[key]) grouped[key] = { date: d, line: l, verifications: [], plans: [] };
        grouped[key].verifications.push(v);
    });

    plans.forEach(p => {
        const matchV = verifications.find(v => v.Id === p.VerificationId);
        const d = matchV && matchV.RecordDate ? matchV.RecordDate.split('T')[0] : 'Unknown';
        const l = matchV ? matchV.DisaMachine : 'Unknown';
        const key = `${d}_${l}`;
        if (grouped[key]) grouped[key].plans.push(p);
    });

    let pageIndex = 0;
    Object.values(grouped).forEach(group => {
        if (pageIndex > 0) doc.addPage();
        pageIndex++;

        doc.setLineWidth(0.3);
        doc.rect(10, 10, 40, 20);
        try {
            doc.addImage(logo, 'PNG', 12, 11, 36, 18);
        } catch (err) {
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text("SAKTHI", 30, 18, { align: 'center' });
            doc.text("AUTO", 30, 26, { align: 'center' });
        }
        doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
        doc.text("ERROR PROOF VERIFICATION CHECK LIST (V2)", 140, 22, { align: 'center' });
        doc.rect(230, 10, 57, 20); doc.setFontSize(11);
        doc.text(`${group.line}`, 258.5, 16, { align: 'center' });
        doc.line(230, 20, 287, 20);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(`DATE: ${formatDate(group.date)}`, 258.5, 26, { align: 'center' });

        autoTable(doc, {
            startY: 35,
            head: [['Line', 'Error Proof Name', 'Nature', 'Freq', 'Shift 1', 'Shift 2', 'Shift 3']],
            body: group.verifications.map(v => [
                v.Line, v.ErrorProofName, v.NatureOfErrorProof, v.Frequency,
                v.Date1_Shift1_Res, v.Date1_Shift2_Res, v.Date1_Shift3_Res
            ]),
            theme: 'grid',
            styles: { fontSize: 8, halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] }
        });

        let finalY = doc.lastAutoTable.finalY + 10;
        const opSig = group.verifications.find(v => v.OperatorSignature)?.OperatorSignature;
        const hofSig = group.verifications.find(v => v.HOFSignature)?.HOFSignature;

        doc.setFontSize(10).setFont('helvetica', 'bold');
        doc.text("Operator Signature:", 14, finalY);
        doc.rect(14, finalY + 2, 45, 18).stroke();
        if (opSig && opSig.startsWith('data:image')) {
            try { doc.addImage(opSig, 'PNG', 15, finalY + 3, 43, 16); } catch (e) { }
        }

        doc.text("HOF Signature:", 148.5, finalY);
        doc.rect(148.5, finalY + 2, 45, 18).stroke();
        if (hofSig && hofSig.startsWith('data:image')) {
            try { doc.addImage(hofSig, 'PNG', 149.5, finalY + 3, 43, 16); } catch (e) { }
        }

        finalY += 30;

        if (group.plans.length > 0) {
            if (finalY > 150) { doc.addPage(); finalY = 20; }
            doc.setFontSize(12).text("REACTION PLAN", 148.5, finalY, { align: 'center' });
            autoTable(doc, {
                startY: finalY + 5,
                head: [['S.No', 'EP No', 'Error Proof Name', 'Shift', 'Problem', 'Root Cause', 'Corrective Action', 'Status', 'Op Sign', 'Sup Sign', 'Remarks']],
                body: group.plans.map(p => [
                    p.SNo, p.ErrorProofNo, p.ErrorProofName, p.VerificationDateShift, p.Problem, p.RootCause, p.CorrectiveAction, p.Status,
                    p.ReviewedBy, 'SIG', p.Remarks
                ]),
                theme: 'grid',
                styles: { fontSize: 7, halign: 'center', valign: 'middle' },
                headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0] },
                didDrawCell: function (data) {
                    if (data.section === 'body' && data.column.index === 9) {
                        const p = group.plans[data.row.index];
                        if (p.SupervisorSignature && p.SupervisorSignature.startsWith('data:image')) {
                            try { doc.addImage(p.SupervisorSignature, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch (e) { }
                        }
                    }
                },
                didParseCell: function (data) {
                    if (data.section === 'body' && data.column.index === 9 && data.cell.raw === 'SIG') data.cell.text = '';
                }
            });
        }

        const dynamicQf = getDynamicQfString(group.date, qfHistory, "QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023");
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(dynamicQf, 10, 200);
    });

    doc.save(`ErrorProof_V2_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 6. DISA SETTING ADJUSTMENT RECORD
// ============================================================================
export const generateDisaSettingAdjustmentPDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');

    const records = data.records || data || [];
    const qfHistory = data.qfHistory || [];

    if (!records || records.length === 0) {
        doc.setFontSize(14);
        doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`DISA_SettingAdjustment_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    const processText = (text) => {
        if (!text) return '';
        if (text.includes(',') && !text.includes('•')) {
            return text.split(',').map(item => `• ${item.trim()}`).join('\n');
        }
        return text;
    };

    doc.setLineWidth(0.3);
    doc.rect(10, 10, 40, 20);
    try {
        doc.addImage(logo, 'PNG', 12, 11, 36, 18);
    } catch (err) {
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text("SAKTHI", 30, 18, { align: 'center' });
        doc.text("AUTO", 30, 26, { align: 'center' });
    }
    doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text("DISA SETTING ADJUSTMENT RECORD", 140, 22, { align: 'center' });
    doc.rect(230, 10, 57, 20); doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`From: ${formatDate(dateRange.from)}`, 258.5, 16, { align: 'center' });
    doc.line(230, 20, 287, 20);
    doc.text(`To:   ${formatDate(dateRange.to)}`, 258.5, 26, { align: 'center' });

    const tableRows = records.map((row, index) => {
        const customValues = Object.values(row.customValues || {});

        return [
            index + 1,
            formatDate(row.recordDate),
            row.mouldCountNo || '-',
            row.noOfMoulds != null ? row.noOfMoulds.toString() : '-',
            processText(row.workCarriedOut) || '-',
            processText(row.preventiveWorkCarried) || '-',
            row.operatorSignature || '',
            row.remarks || '-',
            ...customValues
        ];
    });

    const hasCustomCols = records[0] && records[0].customValues && Object.keys(records[0].customValues).length > 0;
    const baseHeaders = ['S.No', 'Date', 'Mould Count No.', 'No. of\nMoulds', 'Work Carried Out', 'Preventive Work\nCarried', 'Operator\nSignature', 'Remarks'];
    const customHeaders = hasCustomCols ? Object.keys(records[0].customValues).map((_, i) => `Custom ${i + 1}`) : [];
    const allHeaders = [...baseHeaders, ...customHeaders];

    autoTable(doc, {
        startY: 35,
        margin: { left: 10, right: 10 },
        head: [allHeaders],
        body: tableRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2.5, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], valign: 'top', overflow: 'linebreak' },
        headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle', fontSize: 7.5 },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 25, halign: 'center' }, 3: { cellWidth: 20, halign: 'center' }, 4: { cellWidth: 'auto' }, 5: { cellWidth: 'auto' }, 6: { cellWidth: 25, halign: 'center', valign: 'middle' }, 7: { cellWidth: 30 } },
        didDrawCell: function (data) {
            if (data.section === 'body' && data.column.index === 6) {
                const sigData = data.row.raw[6];
                if (sigData && sigData.startsWith('data:image')) {
                    try { doc.addImage(sigData, 'PNG', data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4); } catch (e) { }
                }
            }
        },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 6) { data.cell.text = ''; }
        }
    });

    // 🔥 DYNAMIC QF VALUE FOR SINGLE PAGE REPORT (Uses newest QF regardless of report date) 🔥
    const dynamicQf = (qfHistory && qfHistory.length > 0) ? qfHistory[0].qfValue : "QF/07/FBP-02, Rev. No.01 Dt 14.05.2025";

    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text(dynamicQf, 10, 200);

    doc.save(`DISA_SettingAdjustment_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 7. 4M CHANGE MONITORING
// ============================================================================
export const generateFourMChangePDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');

    const records = data.records || data || [];
    const qfHistory = data.qfHistory || [];

    if (records.length === 0) {
        doc.setFontSize(14);
        doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`4M_Change_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    const startX = 10;
    const pageWidth = doc.internal.pageSize.getWidth() - 20;

    const baseHeaders = ["Date /\nShift", "M/c.\nNo", "Type of\n4M", "Description", "First\nPart", "Last\nPart", "Insp.\nFreq", "Retro\nChecking", "Quarantine", "Part\nIdent.", "Internal\nComm.", "Supervisor\nSign"];

    const customKeys = records[0] && records[0].customValues ? Object.keys(records[0].customValues) : [];
    const customHeaders = customKeys.map((_, i) => `Custom ${i + 1}`);
    const headers = [...baseHeaders, ...customHeaders];

    const baseWeights = [1.5, 1, 1, 3.5, 1, 1, 1, 1.2, 1.5, 1, 1.2, 2.5];
    const customWeights = customHeaders.map(() => 1.5);
    const allWeights = [...baseWeights, ...customWeights];
    const totalWeight = allWeights.reduce((sum, w) => sum + w, 0);
    const colWidths = allWeights.map(w => (w / totalWeight) * pageWidth);

    const drawHeaders = (y, line, part) => {
        const dateText = formatDate(dateRange.from);

        doc.setLineWidth(0.3);
        doc.rect(10, 10, 40, 20);
        try {
            doc.addImage(logo, 'PNG', 12, 11, 36, 18);
        } catch (err) {
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text("SAKTHI", 30, 18, { align: 'center' });
            doc.text("AUTO", 30, 26, { align: 'center' });
        }
        doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
        doc.text("4M CHANGE MONITORING CHECK SHEET", 140, 22, { align: 'center' });
        doc.rect(230, 10, 57, 20); doc.setFontSize(11);
        doc.text(`${line}`, 258.5, 16, { align: 'center' });
        doc.line(230, 20, 287, 20);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(`DATE: ${dateText}`, 258.5, 26, { align: 'center' });

        const tableHeaderY = 40;
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(`Part Name: ${part}`, 10, tableHeaderY - 3);

        let currentX = startX;
        doc.setFontSize(7);
        headers.forEach((header, i) => {
            doc.rect(currentX, tableHeaderY, colWidths[i], 25).stroke();
            doc.text(header, currentX + colWidths[i] / 2, tableHeaderY + 8, { align: "center" });
            currentX += colWidths[i];
        });
        return tableHeaderY + 25;
    };

    const drawFooter = (lineRecords) => {
        const footerY = doc.internal.pageSize.getHeight() - 15;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);

        let reportDateStr = dateRange.from;
        if (lineRecords && lineRecords.length > 0) {
            reportDateStr = lineRecords[0].recordDate || reportDateStr;
        }

        // 🔥 DYNAMIC QF VALUE 🔥
        const dynamicQf = getDynamicQfString(reportDateStr, qfHistory, "QF/07/MPD-36, Rev. No: 01, 13.03.2019");
        doc.text(dynamicQf, startX, footerY, { align: "left" });
    };

    const groupedRecords = {};
    records.forEach(r => {
        const line = r.line || r.disa || 'DISA - I';
        if (!groupedRecords[line]) groupedRecords[line] = [];
        groupedRecords[line].push(r);
    });

    let isFirstPage = true;

    Object.keys(groupedRecords).forEach(line => {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        const lineRecords = groupedRecords[line];
        const uniquePartNames = [...new Set(lineRecords.map(r => r.partName).filter(Boolean))].join(', ');

        let y = drawHeaders(20, line, uniquePartNames);

        lineRecords.forEach((row) => {
            const formattedDate = formatDate(row.recordDate);
            const customData = customKeys.map(k => row.customValues ? row.customValues[k] : "");
            const signatureCell = row.SupervisorSignature || row.inchargeSign || row.operatorSignature || "";

            const rowData = [
                `${formattedDate}\nShift ${row.shift}`, row.mcNo || '-', row.type4M || '-', row.description || '-',
                row.firstPart || '-', row.lastPart || '-', row.inspFreq || '-', row.retroChecking || '-',
                row.quarantine || '-', row.partId || '-', row.internalComm || '-', signatureCell, ...customData
            ];

            let maxRowHeight = 25;
            doc.setFont("helvetica", "normal");
            doc.setFontSize(7);

            rowData.forEach((cell, i) => {
                if (i !== 11) {
                    const lines = doc.splitTextToSize(String(cell || ""), colWidths[i] - 4);
                    const h = lines.length * 3.5;
                    if (h + 10 > maxRowHeight) maxRowHeight = h + 10;
                }
            });

            if (y + maxRowHeight > doc.internal.pageSize.getHeight() - 25) {
                drawFooter(lineRecords);
                doc.addPage();
                y = drawHeaders(20, line, uniquePartNames);
            }

            let x = startX;
            rowData.forEach((cell, i) => {
                doc.rect(x, y, colWidths[i], maxRowHeight).stroke();

                if (i === 11 && cell && cell.startsWith('data:image')) {
                    try { doc.addImage(cell, 'PNG', x + 2, y + 2, colWidths[i] - 4, maxRowHeight - 4); } catch (e) { }
                } else if (cell === "OK") {
                    doc.save().setLineWidth(1).moveTo(x + colWidths[i] / 2 - 3, y + maxRowHeight / 2 + 1).lineTo(x + colWidths[i] / 2 - 1, y + maxRowHeight / 2 + 4).lineTo(x + colWidths[i] / 2 + 4, y + maxRowHeight / 2 - 3).stroke().restore();
                } else if (cell === "Not OK") {
                    doc.save().setLineWidth(1).moveTo(x + colWidths[i] / 2 - 3, y + maxRowHeight / 2 - 3).lineTo(x + colWidths[i] / 2 + 3, y + maxRowHeight / 2 + 3).moveTo(x + colWidths[i] / 2 + 3, y + maxRowHeight / 2 - 3).lineTo(x + colWidths[i] / 2 - 3, y + maxRowHeight / 2 + 3).stroke().restore();
                } else {
                    const lines = doc.splitTextToSize(String(cell || ""), colWidths[i] - 4);
                    doc.text(lines, x + colWidths[i] / 2, y + 5, { align: "center" });
                }
                x += colWidths[i];
            });
            y += maxRowHeight;
        });

        drawFooter(lineRecords);
    });

    doc.save(`4M_Change_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 8. MOULD QUALITY INSPECTION (Black & White Edition)
// ============================================================================
export const generateMouldQualityPDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const records = data.records || data || [];
    const qfHistory = data.qfHistory || [];

    if (records.length === 0) {
        doc.setFontSize(14);
        doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`Mould_Quality_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    let isFirstPage = true;

    records.forEach(report => {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        const header = report;
        const rows = report.rows || [];

        const startX = 14;
        let y = 35;
        const displayDate = formatDate(header.reportDate);

        doc.setLineWidth(0.3);
        doc.rect(10, 10, 40, 20);
        try {
            doc.addImage(logo, 'PNG', 12, 11, 36, 18);
        } catch (err) {
            doc.setFontSize(14); doc.setFont('helvetica', 'bold');
            doc.text("SAKTHI", 30, 18, { align: 'center' });
            doc.text("AUTO", 30, 26, { align: 'center' });
        }
        doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
        doc.text("MOULDING QUALITY INSPECTION REPORT", 140, 22, { align: 'center' });
        doc.rect(230, 10, 57, 20); doc.setFontSize(11);
        doc.text(`${header.disaMachine || '-'}`, 258.5, 16, { align: 'center' });
        doc.line(230, 20, 287, 20);
        doc.setFontSize(10); doc.setFont('helvetica', 'normal');
        doc.text(`DATE: ${displayDate}`, 258.5, 26, { align: 'center' });

        const headMatrix = [
            [
                { content: 'S.No', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Shift', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Part Name', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Data Code', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
                { content: 'First Moulding', colSpan: 6, styles: { halign: 'center' } },
                { content: 'During Running', colSpan: 11, styles: { halign: 'center' } }
            ],
            [
                { content: 'Soft\nRam', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Mould\nBreakage', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Mould\nCrack', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Loose\nSand', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Pattern\nSticking', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Core\nSetting', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Mould\nCrush', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Loose\nSand', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Pattern\nSticking', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Heat\nCode', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Filter\nSize', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: 'Surface Hardness\n(Min 85)', colSpan: 2, styles: { halign: 'center' } },
                { content: 'Inside Penetrant\n(Min 20)', colSpan: 2, styles: { halign: 'center' } },
                { content: 'Pattern Temp\n(Min 45C)', colSpan: 2, styles: { halign: 'center' } }
            ],
            [
                { content: 'PP', styles: { halign: 'center' } }, { content: 'SP', styles: { halign: 'center' } },
                { content: 'PP', styles: { halign: 'center' } }, { content: 'SP', styles: { halign: 'center' } },
                { content: 'PP', styles: { halign: 'center' } }, { content: 'SP', styles: { halign: 'center' } }
            ]
        ];

        const bodyData = rows.map(r => [
            r.sNo || '-', r.shift || '-', r.partName || '-', r.dataCode || '-',
            r.fmSoftRamming || '-', r.fmMouldBreakage || '-', r.fmMouldCrack || '-', r.fmLooseSand || '-', r.fmPatternSticking || '-', r.fmCoreSetting || '-',
            r.drMouldCrush || '-', r.drLooseSand || '-', r.drPatternSticking || '-', r.drDateHeatCode || '-', r.drFilterSize || '-',
            r.drSurfaceHardnessPP || '-', r.drSurfaceHardnessSP || '-', r.drInsideMouldPP || '-', r.drInsideMouldSP || '-', r.drPatternTempPP || '-', r.drPatternTempSP || '-'
        ]);

        autoTable(doc, {
            startY: y,
            margin: { left: startX, right: startX },
            head: headMatrix,
            body: bodyData,
            theme: 'grid',
            styles: { fontSize: 6, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle', halign: 'center' },
            headStyles: { textColor: [0, 0, 0], fillColor: [240, 240, 240], fontStyle: 'bold' },
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 15 }, 2: { cellWidth: 35 }, 3: { cellWidth: 20 } }
        });

        const sigY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);

        doc.text(`Verified By: ${header.verifiedBy || '-'}`, startX, sigY);
        if (header.operatorSignature && header.operatorSignature.startsWith('data:image')) {
            try { doc.addImage(header.operatorSignature, 'PNG', startX, sigY + 5, 60, 20); } catch (e) { }
        }

        doc.text(`Approved By: ${header.approvedBy || '-'}`, doc.internal.pageSize.getWidth() - 100, sigY);
        if (header.supervisorSignature && header.supervisorSignature.startsWith('data:image')) {
            try { doc.addImage(header.supervisorSignature, 'PNG', doc.internal.pageSize.getWidth() - 100, sigY + 5, 60, 20); } catch (e) { }
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            doc.text("Pending", doc.internal.pageSize.getWidth() - 100, sigY + 15);
        }

        // 🔥 DYNAMIC QF VALUE 🔥
        const dynamicQf = getDynamicQfString(header.reportDate || dateRange.from, qfHistory, "QF/07/MOU-06, Rev. No.02 Dt 01.01.2023");
        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.text(dynamicQf, 10, 200);
    });

    doc.save(`Moulding_Quality_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};