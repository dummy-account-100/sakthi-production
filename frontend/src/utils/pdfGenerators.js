import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../Assets/logo.png'; // Ensure this path matches your project structure

// --- Utility for Formatting ---
const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB');
};

const getReportMonthYear = (fromDate) => {
    const d = new Date(fromDate);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
};

// ============================================================================
// 🔥 STANDARDIZED PDF HEADER (3-BOX LAYOUT)
// ============================================================================
const drawStandardHeader = (doc, title, metaTop, metaBottom) => {
    doc.setDrawColor(0);
    doc.setLineWidth(0.3);

    // Box 1: SAKTHI AUTO (Logo Area)
    doc.rect(10, 10, 40, 20);
    try {
        doc.addImage(logo, 'PNG', 12, 11, 36, 18);
    } catch (err) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("SAKTHI", 30, 18, { align: 'center' });
        doc.text("AUTO", 30, 26, { align: 'center' });
    }

    // Box 2: Title
    doc.rect(50, 10, 180, 20);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 140, 22, { align: 'center' });

    // Box 3: Meta Data (DISA / Date / Month)
    doc.rect(230, 10, 57, 20);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(metaTop || '-', 258.5, 17, { align: 'center' });
    doc.line(230, 20, 287, 20);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(metaBottom || '', 258.5, 27, { align: 'center' });
};


// ============================================================================
// 1. UNPOURED MOULD DETAILS
// ============================================================================
export const generateUnPouredMouldPDF = async (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const records = data.records || [];

    if (records.length === 0) {
        doc.setFontSize(14);
        doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`UnPouredMouldDetails_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    let customCols = [];
    try {
        const configRes = await fetch(`${process.env.REACT_APP_API_URL}/api/config/unpoured-mould-details/master`);
        const configData = await configRes.json();
        customCols = (configData.config || []).map(c => ({
            key: `custom_${c.id}`, id: c.id, label: c.reasonName.toUpperCase().replace(' ', '\n'), group: c.department.toUpperCase(), isCustom: true
        }));
    } catch(e) { console.error("Could not fetch Unpoured custom schema for PDF"); }

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
        const dateKey = String(row.RecordDate).split('T')[0];
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

            drawStandardHeader(doc, "UN POURED MOULD DETAILS", disa, `Date: ${formatDate(dateKey)}`);

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
                    try { doc.addImage(sigData, 'PNG', x - 20, sigY, 40, 15); } catch (e) {}
                }
            });
        });
    });

    doc.save(`UnPoured_Mould_Details_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 2. DMM SETTING PARAMETERS
// ============================================================================

export const generateDmmSettingPDF = async (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');

    const metaRecords = data.meta || data.records || [];
    const transRecords = data.trans || [];
    
    if (metaRecords.length === 0 && transRecords.length === 0) {
        doc.setFontSize(14); doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`DMM_Setting_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    let customCols = [];
    try {
        const configRes = await fetch(`${process.env.REACT_APP_API_URL}/api/config/dmm-setting-parameters/master`);
        const configData = await configRes.json();
        customCols = (configData.config || []).map(c => ({
            key: `custom_${c.id}`, id: c.id, label: c.columnLabel.replace('\\n', '\n'), isCustom: true
        }));
    } catch(e) { console.error("Could not fetch DMM Custom Schema for PDF"); }

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

    // Helper to safely initialize groups regardless of where the data comes from
    const initGroup = (d, machine, shift) => {
        if (!groupedData[d]) groupedData[d] = {};
        if (!groupedData[d][machine]) groupedData[d][machine] = { shiftsMeta: {}, shiftsData: {} };
        if (!groupedData[d][machine].shiftsMeta[shift]) {
            groupedData[d][machine].shiftsMeta[shift] = {
                operator: '', supervisor: '', supervisorSignature: '', isIdle: false
            };
        }
        if (!groupedData[d][machine].shiftsData[shift]) {
            groupedData[d][machine].shiftsData[shift] = [];
        }
    };

    // 1. Process Meta Records safely
    metaRecords.forEach(m => {
        const d = String(m.RecordDate || m.recordDate || m.date || '').split('T')[0];
        const machine = m.DisaMachine || m.disaMachine || 'DISA - I';
        const shift = m.Shift || m.shift || 1;

        initGroup(d, machine, shift);
        
        groupedData[d][machine].shiftsMeta[shift] = {
            operator: m.OperatorName || m.operatorName || '',
            supervisor: m.SupervisorName || m.supervisorName || '',
            supervisorSignature: m.SupervisorSignature || m.supervisorSignature || '',
            isIdle: m.IsIdle === true || m.IsIdle === 1 || m.isIdle === true || m.isIdle === 1
        };
    });

    // 2. Process Trans Records safely
    transRecords.forEach(t => {
        const dateRaw = t.RecordDate || t.recordDate || t.date || metaRecords[0]?.RecordDate || '';
        const d = String(dateRaw).split('T')[0];
        const machine = t.DisaMachine || t.disaMachine || 'DISA - I';
        const shift = t.Shift || t.shift || 1;

        initGroup(d, machine, shift);
        groupedData[d][machine].shiftsData[shift].push(t);
    });

    let isFirstPage = true;

    // Failsafe: if data formatting totally failed
    if (Object.keys(groupedData).length === 0) {
        doc.setFontSize(14); doc.text("No valid data groups found to generate the report.", 148.5, 40, { align: 'center' });
        doc.save(`DMM_Setting_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    Object.keys(groupedData).sort().forEach(dateKey => {
        Object.keys(groupedData[dateKey]).sort().forEach(machine => {
            if (!isFirstPage) doc.addPage();
            isFirstPage = false;

            const machineData = groupedData[dateKey][machine];
            
            drawStandardHeader(doc, "DMM SETTING PARAMETERS CHECK SHEET", machine, `Date: ${formatDate(dateKey)}`);

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
                            try { doc.addImage(m.supervisorSignature, 'PNG', data.cell.x + 2, data.cell.y + 1, data.cell.width - 4, data.cell.height - 2); } catch (e) {}
                        }
                    }
                }
            });

            let currentY = doc.lastAutoTable.finalY + 8;

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
                        const rowId = record.RowUUID || record.rowUUID || record.Id || 'default';
                        if (!rowsObj[rowId]) rowsObj[rowId] = {};
                        
                        const masterKey = record.MasterId || record.masterId;
                        if (masterKey) {
                            rowsObj[rowId][masterKey] = record.Value || record.value;
                        } else {
                            // Failsafe for flat objects mapping
                            Object.assign(rowsObj[rowId], record);
                        }
                    });
                    
                    const rowsArr = Object.values(rowsObj);
                    if(rowsArr.length === 0) rowsArr.push({});

                    tableBody = rowsArr.map((row, idx) => {
                        const pdfRow = [(idx + 1).toString()];
                        allColumns.forEach(col => {
                            // Fix applied here to check `col.key` first for base columns
                            const val = row[col.key] || row[col.id] || row[col.MasterId]; 
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
                if (currentY > 175 && index < 2) { doc.setFontSize(8); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200); doc.addPage(); currentY = 15; }
            });

            doc.setFontSize(8); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);
        });
    });

    doc.save(`DMM_Setting_Parameters_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 3 & 4. DISA OPERATOR & LPA CHECKLIST
// ============================================================================
export const generateChecklistPDF = (data, dateRange, title1, title2) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const { master, trans, ncr } = data;

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

        drawStandardHeader(doc, title1, machine, `Month: ${getReportMonthYear(reportMonthDate)}`);

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
            didDrawCell: function(data) {
                if (data.row.index >= tableBody.length && data.column.index > 2) {
                    const dayIndex = data.column.index - 2; 
                    const isSig1Row = data.row.index === tableBody.length;
                    
                    const sigData = isSig1Row ? sig1Map[dayIndex] : sig2Map[dayIndex];
                    if (sigData && sigData.startsWith('data:image')) {
                        doc.setFillColor(255, 255, 255);
                        doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, 'F');
                        try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch(e){}
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
        if(isLPA) {
            doc.setFont('helvetica', 'bold');
            doc.text("Legend:   3 - OK     X - NOT OK     CA - Corrected during Audit     NA - Not Applicable", 10, doc.lastAutoTable.finalY + 5);
            doc.setFont('helvetica', 'normal');
        }
        doc.text(isLPA ? "QF/08/MRO - 18, Rev No: 02 dt 01.01.2022" : "QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);

        if (machineNc.length > 0) {
            doc.addPage();
            drawStandardHeader(doc, title2, machine, "NCR Log");

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
                didDrawCell: function(data) {
                    if (isLPA && data.section === 'body' && data.column.index === 8) {
                        const rowData = machineNc[data.row.index];
                        if (rowData && rowData.SupervisorSignature && rowData.SupervisorSignature.startsWith('data:image')) {
                            try { doc.addImage(rowData.SupervisorSignature, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch(e){}
                        }
                    }
                },
                didParseCell: function(data) {
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
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text(isLPA ? "QF/08/MRO - 18, Rev No: 02 dt 01.01.2022" : "QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);
        }
    });

    const safeTitle = title1.replace(/\s+/g, '_');
    doc.save(`${safeTitle}_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 5a. ERROR PROOF VERIFICATION (V1)
// ============================================================================
export const generateErrorProofV1PDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const verifications = data.verifications || [];
    const plans = data.plans || [];

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
        const d = p.recordDate ? p.recordDate.split('T')[0] : 'Unknown';
        const matchV = verifications.find(v => v.errorProofName === p.errorProofName && v.recordDate && v.recordDate.split('T')[0] === d);
        const l = matchV ? matchV.line : 'Unknown';
        const key = `${d}_${l}`;
        if (grouped[key]) grouped[key].plans.push(p);
    });

    let pageIndex = 0;
    Object.values(grouped).forEach(group => {
        if (pageIndex > 0) doc.addPage();
        pageIndex++;

        drawStandardHeader(doc, "ERROR PROOF VERIFICATION CHECK LIST (V1)", group.line, `Date: ${formatDate(group.date)}`);

        autoTable(doc, {
            startY: 35,
            head: [['Line', 'Error Proof Name', 'Nature of Error Proof', 'Frequency', 'Observation']],
            body: group.verifications.map(v => [
                v.line, v.errorProofName, v.natureOfErrorProof, v.frequency,
                v.observationResult === 'NOT_OK' ? 'NOT OK' : v.observationResult
            ]),
            theme: 'grid',
            styles: { fontSize: 8, halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [220, 220, 220], textColor: [0,0,0] }
        });

        let finalY = doc.lastAutoTable.finalY + 10;
        const opSig = group.verifications.find(v => v.OperatorSignature)?.OperatorSignature;
        const hofSig = group.verifications.find(v => v.HOFSignature)?.HOFSignature;

        doc.setFontSize(10).setFont('helvetica', 'bold');
        doc.text("Operator Signature:", 14, finalY);
        doc.rect(14, finalY + 2, 45, 18).stroke();
        if (opSig && opSig.startsWith('data:image')) {
            try { doc.addImage(opSig, 'PNG', 15, finalY + 3, 43, 16); } catch(e){}
        }

        doc.text("HOF Signature:", 148.5, finalY);
        doc.rect(148.5, finalY + 2, 45, 18).stroke();
        if (hofSig && hofSig.startsWith('data:image')) {
            try { doc.addImage(hofSig, 'PNG', 149.5, finalY + 3, 43, 16); } catch(e){}
        }

        finalY += 30;

        if (group.plans.length > 0) {
            if (finalY > 150) { doc.addPage(); finalY = 35; drawStandardHeader(doc, "REACTION PLAN", group.line, `Date: ${formatDate(group.date)}`); }
            else {
                doc.setFontSize(12).text("REACTION PLAN", 148.5, finalY, { align: 'center' });
            }
            
            autoTable(doc, {
                startY: finalY + 5,
                head: [['S.No', 'EP No', 'Error Proof Name', 'Problem', 'Root Cause', 'Corrective Action', 'Status', 'Op Sign', 'Sup Sign', 'Remarks']],
                body: group.plans.map(p => [
                    p.sNo, p.errorProofNo, p.errorProofName, p.problem, p.rootCause, p.correctiveAction, p.status,
                    p.reviewedBy, 'SIG', p.remarks
                ]),
                theme: 'grid',
                styles: { fontSize: 7, halign: 'center', valign: 'middle' },
                headStyles: { fillColor: [220, 220, 220], textColor: [0,0,0] },
                didDrawCell: function(data) {
                    if (data.section === 'body' && data.column.index === 8) {
                        const p = group.plans[data.row.index];
                        if (p.SupervisorSignature && p.SupervisorSignature.startsWith('data:image')) {
                            try { doc.addImage(p.SupervisorSignature, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch(e){}
                        }
                    }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 8 && data.cell.raw === 'SIG') data.cell.text = '';
                }
            });
        }
    });

    doc.save(`ErrorProof_V1_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 5b. ERROR PROOF VERIFICATION (V2)
// ============================================================================
export const generateErrorProofV2PDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const verifications = data.verifications || [];
    const plans = data.plans || [];

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

        drawStandardHeader(doc, "ERROR PROOF VERIFICATION CHECK LIST (V2)", group.line, `Date: ${formatDate(group.date)}`);

        autoTable(doc, {
            startY: 35,
            head: [['Line', 'Error Proof Name', 'Nature', 'Freq', 'Shift 1', 'Shift 2', 'Shift 3']],
            body: group.verifications.map(v => [
                v.Line, v.ErrorProofName, v.NatureOfErrorProof, v.Frequency,
                v.Date1_Shift1_Res, v.Date1_Shift2_Res, v.Date1_Shift3_Res
            ]),
            theme: 'grid',
            styles: { fontSize: 8, halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [220, 220, 220], textColor: [0,0,0] }
        });

        let finalY = doc.lastAutoTable.finalY + 10;
        const opSig = group.verifications.find(v => v.OperatorSignature)?.OperatorSignature;
        const hofSig = group.verifications.find(v => v.HOFSignature)?.HOFSignature;

        doc.setFontSize(10).setFont('helvetica', 'bold');
        doc.text("Operator Signature:", 14, finalY);
        doc.rect(14, finalY + 2, 45, 18).stroke();
        if (opSig && opSig.startsWith('data:image')) {
            try { doc.addImage(opSig, 'PNG', 15, finalY + 3, 43, 16); } catch(e){}
        }

        doc.text("HOF Signature:", 148.5, finalY);
        doc.rect(148.5, finalY + 2, 45, 18).stroke();
        if (hofSig && hofSig.startsWith('data:image')) {
            try { doc.addImage(hofSig, 'PNG', 149.5, finalY + 3, 43, 16); } catch(e){}
        }

        finalY += 30;

        if (group.plans.length > 0) {
            if (finalY > 150) { doc.addPage(); finalY = 35; drawStandardHeader(doc, "REACTION PLAN", group.line, `Date: ${formatDate(group.date)}`); }
            else {
                doc.setFontSize(12).text("REACTION PLAN", 148.5, finalY, { align: 'center' });
            }

            autoTable(doc, {
                startY: finalY + 5,
                head: [['S.No', 'EP No', 'Error Proof Name', 'Shift', 'Problem', 'Root Cause', 'Corrective Action', 'Status', 'Op Sign', 'Sup Sign', 'Remarks']],
                body: group.plans.map(p => [
                    p.SNo, p.ErrorProofNo, p.ErrorProofName, p.VerificationDateShift, p.Problem, p.RootCause, p.CorrectiveAction, p.Status,
                    p.ReviewedBy, 'SIG', p.Remarks
                ]),
                theme: 'grid',
                styles: { fontSize: 7, halign: 'center', valign: 'middle' },
                headStyles: { fillColor: [220, 220, 220], textColor: [0,0,0] },
                didDrawCell: function(data) {
                    if (data.section === 'body' && data.column.index === 9) {
                        const p = group.plans[data.row.index];
                        if (p.SupervisorSignature && p.SupervisorSignature.startsWith('data:image')) {
                            try { doc.addImage(p.SupervisorSignature, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch(e){}
                        }
                    }
                },
                didParseCell: function(data) {
                    if (data.section === 'body' && data.column.index === 9 && data.cell.raw === 'SIG') data.cell.text = '';
                }
            });
        }
    });

    doc.save(`ErrorProof_V2_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 6. DISA SETTING ADJUSTMENT RECORD
// ============================================================================
export const generateDisaSettingAdjustmentPDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');

    if (!data || data.length === 0) {
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

    drawStandardHeader(doc, "DISA SETTING ADJUSTMENT RECORD", `From: ${formatDate(dateRange.from)}`, `To: ${formatDate(dateRange.to)}`);

    const tableRows = data.map((row, index) => {
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

    const hasCustomCols = data[0] && data[0].customValues && Object.keys(data[0].customValues).length > 0;
    const baseHeaders = ['S.No', 'Date', 'Mould Count No.', 'No. of\nMoulds', 'Work Carried Out', 'Preventive Work\nCarried', 'Operator\nSignature', 'Remarks'];
    const customHeaders = hasCustomCols ? Object.keys(data[0].customValues).map((_, i) => `Custom ${i+1}`) : [];
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
                    try { doc.addImage(sigData, 'PNG', data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4); } catch(e) {}
                }
            }
        },
        didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 6) { data.cell.text = ''; }
        }
    });

    doc.setFontSize(8); doc.setFont('helvetica', 'normal');
    doc.text("QF/07/FBP-02, Rev. No.01 Dt 14.05.2025", 10, 200);

    doc.save(`DISA_SettingAdjustment_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 7. 4M CHANGE MONITORING (Refactored to JS PDF AutoTable + Standard Header)
// ============================================================================
export const generateFourMChangePDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const records = data.records || data || [];

    if (records.length === 0) {
        doc.setFontSize(14);
        doc.text("No data found for the selected date range.", 148.5, 40, { align: 'center' });
        doc.save(`4M_Change_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
        return;
    }

    const baseHeaders = ["Date /\nShift", "M/c.\nNo", "Type of\n4M", "Description", "First\nPart", "Last\nPart", "Insp.\nFreq", "Retro\nChecking", "Quarantine", "Part\nIdent.", "Internal\nComm.", "Supervisor\nSign"];
    
    const customKeys = records[0] && records[0].customValues ? Object.keys(records[0].customValues) : [];
    const customHeaders = customKeys.map((_, i) => `Custom ${i+1}`);
    const headers = [...baseHeaders, ...customHeaders];

    const groupedRecords = {};
    records.forEach(r => {
        const line = r.line || r.disa || 'DISA - I';
        if(!groupedRecords[line]) groupedRecords[line] = [];
        groupedRecords[line].push(r);
    });

    let isFirstPage = true;

    Object.keys(groupedRecords).forEach(line => {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        const lineRecords = groupedRecords[line];
        const uniquePartNames = [...new Set(lineRecords.map(r => r.partName).filter(Boolean))].join(', ');
        
        drawStandardHeader(doc, "4M CHANGE MONITORING CHECK SHEET", line, `Part: ${uniquePartNames.length > 25 ? uniquePartNames.substring(0, 22) + '...' : uniquePartNames}`);

        const tableRows = lineRecords.map(row => {
            const formattedDate = formatDate(row.recordDate);
            const customData = customKeys.map(k => row.customValues ? row.customValues[k] : "");
            const signatureCell = row.SupervisorSignature || row.inchargeSign || row.operatorSignature || "";

            return [
                `${formattedDate}\nShift ${row.shift}`, row.mcNo || '-', row.type4M || '-', row.description || '-',
                row.firstPart || '-', row.lastPart || '-', row.inspFreq || '-', row.retroChecking || '-',
                row.quarantine || '-', row.partId || '-', row.internalComm || '-', signatureCell, ...customData
            ];
        });

        autoTable(doc, {
            startY: 35,
            head: [headers],
            body: tableRows,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], valign: 'middle', halign: 'center' },
            headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
            didDrawCell: function (data) {
                if (data.section === 'body' && data.column.index === 11) {
                    const sigData = data.row.raw[11];
                    if (sigData && sigData.startsWith('data:image')) {
                        try { doc.addImage(sigData, 'PNG', data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4); } catch (e) {}
                    }
                }
            },
            didParseCell: function (data) {
                if (data.section === 'body') {
                    const idx = data.column.index;
                    if ([7, 8, 9, 10].includes(idx)) {
                        const text = data.cell.text?.[0] || '';
                        if (text === 'OK') {
                            data.cell.styles.font = 'ZapfDingbats';
                            data.cell.text = ['3'];
                            data.cell.styles.textColor = [0, 100, 0];
                        } else if (text === 'Not OK') {
                            data.cell.styles.textColor = [255, 0, 0];
                            data.cell.text = ['X'];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                    if (idx === 11) data.cell.text = ''; // Clear text for signature image
                }
            }
        });

        const footerY = doc.internal.pageSize.getHeight() - 10;
        doc.setFont("helvetica", "normal").setFontSize(8);
        doc.text("QF/07/MPD-36, Rev. No: 01, 13.03.2019", 14, footerY);
    });

    doc.save(`4M_Change_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};

// ============================================================================
// 8. MOULD QUALITY INSPECTION (Black & White Edition)
// ============================================================================
export const generateMouldQualityPDF = (data, dateRange) => {
    const doc = new jsPDF('l', 'mm', 'a4');
    const records = data.records || data || [];

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
        const pageWidth = doc.internal.pageSize.getWidth();

        drawStandardHeader(doc, "MOULDING QUALITY INSPECTION REPORT", header.disaMachine || '-', `Date: ${formatDate(header.reportDate)}`);

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
            startY: 35,
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
            try { doc.addImage(header.operatorSignature, 'PNG', startX, sigY + 5, 60, 20); } catch(e){}
        }

        doc.text(`Approved By: ${header.approvedBy || '-'}`, pageWidth - 100, sigY);
        if (header.supervisorSignature && header.supervisorSignature.startsWith('data:image')) {
            try { doc.addImage(header.supervisorSignature, 'PNG', pageWidth - 100, sigY + 5, 60, 20); } catch(e){}
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0); 
            doc.text("Pending", pageWidth - 100, sigY + 15);
        }
    });

    doc.save(`Moulding_Quality_Bulk_${dateRange.from}_to_${dateRange.to}.pdf`);
};