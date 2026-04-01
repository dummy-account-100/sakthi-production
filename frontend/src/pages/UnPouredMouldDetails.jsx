import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { CheckCircle, AlertTriangle, Save, Loader, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import Header from '../components/Header';
import logo from '../Assets/logo.png'; 

const NotificationModal = ({ data, onClose }) => {
  if (!data.show) return null;
  const isError = data.type === 'error';
  const isLoading = data.type === 'loading';
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`border-2 w-full max-w-md p-6 rounded-2xl shadow-2xl bg-white ${isError ? 'border-red-200' : 'border-green-200'}`}>
        <div className="flex items-center gap-4">
          {isLoading ? <Loader className="animate-spin text-blue-600" /> : isError ? <AlertTriangle className="text-red-600" /> : <CheckCircle className="text-green-600" />}
          <div>
            <h3 className="font-bold text-lg">{isLoading ? 'Processing...' : isError ? 'Error' : 'Success'}</h3>
            <p className="text-sm text-gray-600">{data.message}</p>
          </div>
        </div>
        {!isLoading && <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded text-sm font-bold float-right">Close</button>}
      </div>
    </div>
  );
};

const getShiftDate = () => {
  const now = new Date();
  if (now.getHours() < 7) now.setDate(now.getDate() - 1);
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const baseColumns = [
  { key: 'patternChange', label: 'PATTERN\nCHANGE', group: 'MOULDING' },
  { key: 'heatCodeChange', label: 'HEAT CODE\nCHANGE', group: 'MOULDING' },
  { key: 'mouldBroken', label: 'MOULD\nBROKEN', group: 'MOULDING' },
  { key: 'amcCleaning', label: 'AMC\nCLEANING', group: 'MOULDING' },
  { key: 'mouldCrush', label: 'MOULD\nCRUSH', group: 'MOULDING' },
  { key: 'coreFalling', label: 'CORE\nFALLING', group: 'MOULDING' },
  { key: 'sandDelay', label: 'SAND\nDELAY', group: 'SAND PLANT' },
  { key: 'drySand', label: 'DRY\nSAND', group: 'SAND PLANT' },
  { key: 'nozzleChange', label: 'NOZZLE\nCHANGE', group: 'PREESPOUR' },
  { key: 'nozzleLeakage', label: 'NOZZLE\nLEAKAGE', group: 'PREESPOUR' },
  { key: 'spoutPocking', label: 'SPOUT\nPOCKING', group: 'PREESPOUR' },
  { key: 'stRod', label: 'ST\nROD', group: 'PREESPOUR' },
  { key: 'qcVent', label: 'QC\nVENT', group: 'QUALITY CONTROL' },
  { key: 'outMould', label: 'OUT\nMOULD', group: 'QUALITY CONTROL' },
  { key: 'lowMg', label: 'LOW\nMG', group: 'QUALITY CONTROL' },
  { key: 'gradeChange', label: 'GRADE\nCHANGE', group: 'QUALITY CONTROL' },
  { key: 'msiProblem', label: 'MSI\nPROBLEM', group: 'QUALITY CONTROL' },
  { key: 'brakeDown', label: 'BRAKE\nDOWN', group: 'MAINTENANCE' },
  { key: 'wom', label: 'WOM', group: 'FURNACE' },
  { key: 'devTrail', label: 'DEV\nTRAIL', group: 'TOOLING' },
  { key: 'powerCut', label: 'POWER\nCUT', group: 'OTHERS' },
  { key: 'plannedOff', label: 'PLANNED\nOFF', group: 'OTHERS' },
  { key: 'vatCleaning', label: 'VAT\nCLEANING', group: 'OTHERS' },
  { key: 'others', label: 'OTHERS', group: 'OTHERS' }
];

// Initialize with empty strings so placeholders show up on initial load
const emptyShift = baseColumns.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {});

const UnPouredMouldDetails = ({ isAdminMode = false, adminDate = null, adminDisa = null }) => {
  const [headerData, setHeaderData] = useState({
    date: adminDate || getShiftDate(),
    disaMachine: adminDisa || 'DISA - I'
  });

  const [columns, setColumns] = useState([...baseColumns]);
  const [shiftsData, setShiftsData] = useState({
    1: { ...emptyShift, customValues: {}, operatorSignature: '' },
    2: { ...emptyShift, customValues: {}, operatorSignature: '' },
    3: { ...emptyShift, customValues: {}, operatorSignature: '' }
  });
  const [unpouredSummary, setUnpouredSummary] = useState([]);
  const [qfHistory, setQfHistory] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  const sigRefs = { 1: useRef(null), 2: useRef(null), 3: useRef(null) };

  useEffect(() => {
    if (isAdminMode && adminDate && adminDisa) {
      setHeaderData({ date: adminDate, disaMachine: adminDisa });
    }
  }, [isAdminMode, adminDate, adminDisa]);

  useEffect(() => {
    loadSchemaAndData();
  }, [headerData.date, headerData.disaMachine]);

  const loadSchemaAndData = async () => {
    setLoading(true);
    try {
      const configRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/config/unpoured-mould-details/master`);
      const customCols = (configRes.data.config || []).map(c => ({
        key: `custom_${c.id}`,
        id: c.id,
        label: c.reasonName.toUpperCase().replace(' ', '\n'),
        group: c.department.toUpperCase(),
        isCustom: true
      }));

      const mergedColumns = [...baseColumns, ...customCols];

      let currentGroup = mergedColumns[0]?.group;
      for (let i = 1; i < mergedColumns.length; i++) {
        if (mergedColumns[i].group !== currentGroup) {
          mergedColumns[i - 1].isLastInGroup = true;
          currentGroup = mergedColumns[i].group;
        }
      }
      if (mergedColumns.length > 0) mergedColumns[mergedColumns.length - 1].isLastInGroup = true;
      setColumns(mergedColumns);

      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/unpoured-moulds/details`, {
        params: { date: headerData.date, disa: headerData.disaMachine }
      });

      const loadedData = {
        1: { ...emptyShift, customValues: {}, operatorSignature: '' },
        2: { ...emptyShift, customValues: {}, operatorSignature: '' },
        3: { ...emptyShift, customValues: {}, operatorSignature: '' }
      };

      [1, 2, 3].forEach(shift => {
        const dbShift = res.data.shiftsData && res.data.shiftsData[shift];
        
        // VERIFY IF SHIFT IS SAVED:
        const isShiftSaved = dbShift && dbShift.patternChange !== undefined;

        if (isShiftSaved) {
          // If the shift WAS saved, populate empty values with '-'
          mergedColumns.forEach(col => {
            if (col.isCustom) {
              const val = dbShift.customValues?.[col.id];
              loadedData[shift].customValues[col.id] = (val === '' || val == null || val === 0) ? '-' : val;
            } else {
              const val = dbShift[col.key];
              loadedData[shift][col.key] = (val === '' || val == null || val === 0) ? '-' : val;
            }
          });
          loadedData[shift].operatorSignature = dbShift.operatorSignature || '';

          if (loadedData[shift].operatorSignature && sigRefs[shift].current) {
            sigRefs[shift].current.fromDataURL(loadedData[shift].operatorSignature);
          } else if (sigRefs[shift].current) {
            sigRefs[shift].current.clear();
          }
        } else {
          // If the shift was NOT saved, force everything to be an empty string '' so the placeholder shows!
          mergedColumns.forEach(col => {
            if (col.isCustom) {
              loadedData[shift].customValues[col.id] = '';
            } else {
              loadedData[shift][col.key] = '';
            }
          });
          loadedData[shift].operatorSignature = '';
          if (sigRefs[shift].current) sigRefs[shift].current.clear();
        }
      });
      setShiftsData(loadedData);
    } catch (error) {
      setNotification({ show: true, type: 'error', message: "Failed to load shift data." });
    }

    try {
      const summaryRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/unpoured-moulds/summary`, {
        params: { date: headerData.date }
      });
      setUnpouredSummary(summaryRes.data.summary || []);
      setQfHistory(summaryRes.data.qfHistory || []); 
    } catch (e) {
      setUnpouredSummary([]);
    }

    setLoading(false);
  };

  const handleInputChange = (shift, key, value, isCustom = false, colId = null) => {
    setShiftsData(prev => {
      const newShift = { ...prev[shift] };
      if (isCustom) {
        newShift.customValues = { ...newShift.customValues, [colId]: value };
      } else {
        newShift[key] = value;
      }
      return { ...prev, [shift]: newShift };
    });
  };

  const clearSignature = (shift) => {
    if (sigRefs[shift].current) {
      sigRefs[shift].current.clear();
      handleInputChange(shift, 'operatorSignature', '');
    }
  };

  const getRowTotal = (shift) => columns.reduce((sum, col) => {
    const val = col.isCustom ? shiftsData[shift]?.customValues?.[col.id] : shiftsData[shift]?.[col.key];
    return sum + (parseInt(val) || 0); 
  }, 0);

  const getColTotal = (col) => [1, 2, 3].reduce((sum, shift) => {
    const val = col.isCustom ? shiftsData[shift]?.customValues?.[col.id] : shiftsData[shift]?.[col.key];
    return sum + (parseInt(val) || 0);
  }, 0);

  const getGrandTotal = () => [1, 2, 3].reduce((sum, shift) => sum + getRowTotal(shift), 0);

  const getSummarySum = (key) => unpouredSummary.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);
  const totalProduced = getSummarySum("producedMould");
  const totalPoured = getSummarySum("pouredMould");
  const totalUnpoured = getSummarySum("unpouredMould");
  const totalPercentage = totalProduced > 0 ? ((totalUnpoured / totalProduced) * 100).toFixed(2) : 0;
  const totalDelays = getSummarySum("delays");
  const totalRunningHours = getSummarySum("runningHours").toFixed(2);
  const getDisaData = (disaName) => unpouredSummary.find(d => d.disa === disaName) || {};

  const handleSave = async () => {
    setLoading(true);
    
    // 🔥 NEW: We will dynamically build the payload to ONLY include shifts that have data.
    const payloadData = {};
    let hasAnyData = false;

    [1, 2, 3].forEach(s => {
      let shiftHasData = false;
      const shiftData = shiftsData[s];

      // Check if any standard or custom column has a value
      columns.forEach(col => {
        const val = col.isCustom ? shiftData.customValues?.[col.id] : shiftData[col.key];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          shiftHasData = true;
        }
      });

      // Check if a signature exists
      const sigBase64 = (sigRefs[s].current && !sigRefs[s].current.isEmpty())
        ? sigRefs[s].current.getCanvas().toDataURL('image/png') 
        : (shiftData.operatorSignature || '');

      if (sigBase64 && sigBase64.trim() !== '') {
        shiftHasData = true;
      }

      // If the shift has ANY data, include it in the save payload
      if (shiftHasData) {
        hasAnyData = true;
        payloadData[s] = { 
          ...shiftData, 
          rowTotal: getRowTotal(s), 
          operatorSignature: sigBase64 
        };
      }
    });

    // 🔥 NEW: Prevent submission if the user completely ignored all fields
    if (!hasAnyData) {
      setLoading(false);
      setNotification({ show: true, type: 'error', message: 'Please enter data for at least one shift before submitting.' });
      return;
    }

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/unpoured-moulds/save`, {
        date: headerData.date, disa: headerData.disaMachine, shiftsData: payloadData
      });
      setNotification({ show: true, type: 'success', message: 'Shift Data Saved Successfully!' });
      setTimeout(() => setNotification({ show: false }), 3000);
    } catch (error) {
      setNotification({ show: true, type: 'error', message: 'Failed to save data.' });
    }
    setLoading(false);
  };

  const generatePDF = () => {
    setNotification({ show: true, type: 'loading', message: 'Generating PDF...' });
    try {
      const doc = new jsPDF('l', 'mm', 'a4');

      let currentPageQfValue = "QF/07/FBP-13, Rev.No:06 dt 08.10.2025";
      const reportDate = new Date(headerData.date);
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

      doc.setLineWidth(0.3);
      
      doc.rect(10, 10, 40, 20);
      try {
        doc.addImage(logo, 'PNG', 12, 11, 36, 18);
      } catch (err) {
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text("SAKTHI", 30, 18, { align: 'center' }); 
        doc.text("AUTO", 30, 26, { align: 'center' });
      }

      doc.rect(50, 10, 197, 20);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text("UN POURED MOULD DETAILS", 148.5, 22, { align: 'center' });

      doc.rect(247, 10, 40, 20);
      doc.setFontSize(11);
      doc.text(headerData.disaMachine, 267, 16, { align: 'center' });
      doc.line(247, 20, 287, 20);
      doc.setFontSize(10);
      const formattedDate = new Date(headerData.date).toLocaleDateString('en-GB');
      doc.text(`DATE: ${formattedDate}`, 267, 26, { align: 'center' });

      const pdfGroups = [];
      columns.forEach(col => {
        if (pdfGroups.length === 0 || pdfGroups[pdfGroups.length - 1].name !== col.group) {
          pdfGroups.push({ name: col.group, count: 1 });
        } else { pdfGroups[pdfGroups.length - 1].count++; }
      });

      const headRow1 = [
        { content: 'SHIFT', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        ...pdfGroups.map(g => ({ content: g.name, colSpan: g.count, styles: { halign: 'center' } })),
        { content: 'TOTAL', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [220, 220, 220] } }
      ];

      const headRow2 = columns.map(col => ({ content: col.label.replace(' ', '\n'), styles: { halign: 'center', valign: 'middle', fontSize: 5.5 } }));

      const bodyRows = [1, 2, 3].map(shift => {
        const row = [shift.toString()];
        columns.forEach(col => {
          const val = col.isCustom ? shiftsData[shift]?.customValues?.[col.id] : shiftsData[shift]?.[col.key];
          row.push(val === '' || val === null || val === undefined ? '-' : val.toString());
        });
        row.push(getRowTotal(shift) === 0 ? '-' : getRowTotal(shift).toString());
        return row;
      });

      const totalRow = ['TOTAL'];
      columns.forEach(col => {
        const colTotal = getColTotal(col);
        totalRow.push(colTotal === 0 ? '-' : colTotal.toString());
      });
      totalRow.push(getGrandTotal() === 0 ? '-' : getGrandTotal().toString());
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

          let sig = '';
          if (sigRefs[shift].current && !sigRefs[shift].current.isEmpty()) sig = sigRefs[shift].current.getCanvas().toDataURL('image/png');
          else if (shiftsData[shift].operatorSignature) sig = shiftsData[shift].operatorSignature;

          if (sig && sig.startsWith('data:image')) {
              try { doc.addImage(sig, 'PNG', x - 20, sigY, 40, 15); } catch (e) { }
          }
      });

      const summaryStartY = sigY + 30; 

      const summaryBodyRows = ['I', 'II', 'III', 'IV', 'V', 'VI'].map(disa => {
        const row = getDisaData(disa);
        return [
          disa, row.mouldCounterClose ?? '-', row.mouldCounterOpen ?? '-', row.producedMould ?? '0',
          row.pouredMould ?? '0', row.unpouredMould ?? '0', row.percentage !== undefined ? `${row.percentage}%` : '0%',
          row.delays ?? '0', row.producedMhr ?? '-', row.pouredMhr ?? '-', row.runningHours ?? '0'
        ];
      });
      summaryBodyRows.push(['TOTAL', '-', '-', totalProduced, totalPoured, totalUnpoured, `${totalPercentage}%`, totalDelays, '-', '-', totalRunningHours]);

      autoTable(doc, {
        startY: summaryStartY, margin: { right: 5, left: 5 },
        head: [['DISA', 'MOULD\nCLOSE', 'MOULD\nOPEN', 'PRODUCED', 'POURED', 'UNPOURED', '%', 'DELAYS', 'PROD\nM/HR', 'POURED\nM/HR', 'RUN HRS']],
        body: summaryBodyRows, theme: 'grid',
        styles: { fontSize: 6, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        didParseCell: function (data) { if (data.section === 'body' && data.row.index === summaryBodyRows.length - 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [240, 240, 240]; } }
      });

      let bottomTablesStartY = doc.lastAutoTable.finalY + 10;
      
      if (bottomTablesStartY + 40 > 210) { 
          doc.addPage();
          bottomTablesStartY = 20; 
      }

      autoTable(doc, {
        startY: bottomTablesStartY, 
        margin: { left: 5 }, 
        tableWidth: 140, 
        pageBreak: 'avoid',
        head: [[{ content: 'NO. OF MOULDS/DAY', colSpan: 7, styles: { halign: 'left' } }], ['', 'DISA 1', 'DISA 2', 'DISA 3', 'DISA 4', 'DISA 5', 'DISA 6']],
        body: [
          ['MOULD / DAY', getDisaData('I').producedMould ?? '0', getDisaData('II').producedMould ?? '0', getDisaData('III').producedMould ?? '0', getDisaData('IV').producedMould ?? '0', getDisaData('V').producedMould ?? '0', getDisaData('VI').producedMould ?? '0'],
          ['TOTAL', { content: totalProduced, colSpan: 6 }]
        ],
        theme: 'grid', styles: { fontSize: 6, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        didParseCell: function (data) {
          if (data.section === 'body' && data.row.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [240, 240, 240]; }
          if (data.section === 'body' && data.column.index === 0) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [250, 250, 250]; }
        }
      });

      autoTable(doc, {
        startY: bottomTablesStartY, 
        margin: { left: 152 },      
        tableWidth: 140,            
        pageBreak: 'avoid',
        head: [[{ content: 'NO. OF QUANTITY/DAY', colSpan: 7, styles: { halign: 'left' } }], ['', 'DISA 1', 'DISA 2', 'DISA 3', 'DISA 4', 'DISA 5', 'DISA 6']],
        body: [
          ['QTY / DAY', getDisaData('I').pouredMould ?? '0', getDisaData('II').pouredMould ?? '0', getDisaData('III').pouredMould ?? '0', getDisaData('IV').pouredMould ?? '0', getDisaData('V').pouredMould ?? '0', getDisaData('VI').pouredMould ?? '0'],
          ['TOTAL', { content: totalPoured, colSpan: 6 }]
        ],
        theme: 'grid', styles: { fontSize: 6, lineColor: [0, 0, 0], lineWidth: 0.15, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        didParseCell: function (data) {
          if (data.section === 'body' && data.row.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [240, 240, 240]; }
          if (data.section === 'body' && data.column.index === 0) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.fillColor = [250, 250, 250]; }
        }
      });

      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(currentPageQfValue, 10, 200);

      doc.save(`UnPoured_Mould_Details_${headerData.date}.pdf`);
      setNotification({ show: false, type: '', message: '' });
    } catch (error) {
      setNotification({ show: true, type: 'error', message: `PDF Generation Failed: ${error.message}` });
    }
  };

  const renderGroupHeaders = () => {
    const groups = [];
    let currentGroup = null;
    columns.forEach(col => {
      if (!currentGroup || currentGroup.name !== col.group) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { name: col.group, count: 1 };
      } else { currentGroup.count++; }
    });
    if (currentGroup) groups.push(currentGroup);

    return groups.map((g, i) => (
      <th key={i} className="border border-gray-300 p-2 border-r-2 border-r-gray-400" colSpan={g.count}>{g.name}</th>
    ));
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
        <NotificationModal data={notification} onClose={() => setNotification({ ...notification, show: false })} />
        
        <div className="bg-white w-full max-w-[100rem] shadow-xl rounded-xl flex flex-col border-4 border-gray-100">

          {!isAdminMode && (
            <div className="p-8 pb-4">
              <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 uppercase tracking-wide flex items-center justify-center gap-2">
                <span className="text-orange-500 text-2xl">📉</span> Un Poured Mould Details
              </h2>

              <div className="flex justify-end items-center gap-6 border-b-2 border-gray-200 pb-4">
                <div className="w-40">
                  <label className="font-bold text-gray-700 block mb-1 text-sm">DISA-</label>
                  <select 
                    value={headerData.disaMachine} 
                    onChange={(e) => setHeaderData({ ...headerData, disaMachine: e.target.value })} 
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white text-gray-800"
                  >
                    <option value="DISA - I">DISA - I</option>
                    <option value="DISA - II">DISA - II</option>
                    <option value="DISA - III">DISA - III</option>
                    <option value="DISA - IV">DISA - IV</option>
                    <option value="DISA - V">DISA - V</option>
                    <option value="DISA - VI">DISA - VI</option>
                  </select>
                </div>
                
                <div className="w-48">
                  <label className="font-bold text-gray-700 block mb-1 text-sm">DATE :</label>
                  <input 
                    type="date" 
                    value={headerData.date} 
                    onChange={(e) => setHeaderData({ ...headerData, date: e.target.value })} 
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold text-gray-800 bg-white" 
                  />
                </div>
              </div>
            </div>
          )}

          <div className="p-6 overflow-x-auto min-h-[300px] custom-scrollbar">
            <table className="w-full text-center border-collapse table-fixed min-w-[2450px]">
              <thead className="bg-gray-100">
                <tr className="text-xs text-gray-600 uppercase border-y-2 border-orange-200">
                  <th className="border border-gray-300 p-3 w-20 bg-gray-100 z-10" rowSpan="2">SHIFT</th>
                  {renderGroupHeaders()}
                  <th className="border border-gray-300 p-3 w-24 bg-gray-200 z-10 border-l-2 border-l-orange-300" rowSpan="2">TOTAL</th>
                </tr>
                <tr className="text-[10px] text-gray-500 uppercase tracking-wide bg-gray-50">
                  {columns.map((col, idx) => (
                    <th key={col.key} className={`border border-gray-300 p-2 align-bottom whitespace-pre-wrap leading-snug w-20 ${col.isLastInGroup ? 'border-r-2 border-r-gray-400' : ''}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map(shift => (
                  <tr key={shift} className="hover:bg-orange-50/30 transition-colors group h-12">
                    <td className="border border-gray-300 font-black text-gray-700 bg-gray-50 left-0 z-10 group-hover:bg-orange-50/80">{shift}</td>
                    {columns.map(col => {
                      const val = col.isCustom ? shiftsData[shift]?.customValues?.[col.id] : shiftsData[shift]?.[col.key];
                      return (
                        <td key={col.key} className={`border border-gray-300 p-0 relative ${col.isLastInGroup ? 'border-r-2 border-r-gray-400' : ''}`}>
                          <input
                            type="text"
                            placeholder="Type '-' if empty"
                            value={val !== undefined && val !== null ? val : ''} 
                            onChange={(e) => handleInputChange(shift, col.key, e.target.value, col.isCustom, col.id)}
                            onFocus={(e) => e.target.select()}
                            className="absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-800 bg-transparent outline-none placeholder:text-[8px] placeholder:text-gray-400 focus:bg-orange-100 focus:ring-inset focus:ring-2 focus:ring-orange-500 transition-colors"
                          />
                        </td>
                      );
                    })}
                    <td className="border border-gray-300 font-bold text-gray-800 bg-gray-100 right-0 z-10 border-l-2 border-l-orange-300">{getRowTotal(shift) || '0'}</td>
                  </tr>
                ))}
                <tr className="bg-gray-200 h-14 font-black">
                  <td className="border border-gray-400 text-gray-800 left-0 z-10 bg-gray-200">TOTAL</td>
                  {columns.map(col => (
                    <td key={col.key} className={`border border-gray-400 text-gray-800 ${col.isLastInGroup ? 'border-r-2 border-r-gray-500' : ''}`}>{getColTotal(col) || '0'}</td>
                  ))}
                  <td className="border border-gray-400 text-xl text-orange-800 bg-orange-200 right-0 z-10 border-l-2 border-l-orange-400 shadow-inner">{getGrandTotal() || '0'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="px-6 pb-6">
            <h3 className="text-gray-800 font-black uppercase tracking-widest text-sm mb-4 border-b-2 border-gray-200 pb-2">Operator Signatures</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((shift) => (
                <div key={shift} className="flex flex-col bg-gray-50 rounded-xl p-4 border border-gray-300 shadow-sm relative group">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-gray-600 text-sm tracking-wider">SHIFT {shift}</span>
                    <button onClick={() => clearSignature(shift)} className="text-xs text-red-500 hover:text-red-700 font-bold uppercase underline">Clear</button>
                  </div>
                  <div className="w-full h-24 relative overflow-hidden rounded bg-white border-2 border-dashed border-gray-300 shadow-inner">
                    <SignatureCanvas ref={sigRefs[shift]} penColor="blue" canvasProps={{ className: 'absolute inset-0 w-full h-full cursor-crosshair' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full border-t border-dashed border-gray-300 my-4"></div>

          <div className="p-6">
            <div className="overflow-x-auto mb-8 shadow-sm rounded-lg border border-gray-300">
              <table className="w-full border-collapse border border-gray-300 text-center text-sm">
                <thead className="bg-gray-100 font-bold text-gray-700 uppercase">
                  <tr>
                    <th className="border border-gray-300 p-3 w-16">DISA</th>
                    <th className="border border-gray-300 p-3">MOULD COUNTER<br />CLOSE</th>
                    <th className="border border-gray-300 p-3">MOULD COUNTER<br />OPEN</th>
                    <th className="border border-gray-300 p-3">PRODUCED<br />MOULD</th>
                    <th className="border border-gray-300 p-3">POURED<br />MOULD</th>
                    <th className="border border-gray-300 p-3">UNPOURED<br />MOULD</th>
                    <th className="border border-gray-300 p-3 w-16">%</th>
                    <th className="border border-gray-300 p-3">DELAYS</th>
                    <th className="border border-gray-300 p-3">PRODUCED<br />M/HR</th>
                    <th className="border border-gray-300 p-3">POURED<br />M/HR</th>
                    <th className="border border-gray-300 p-3">RUNNING<br />HOURS</th>
                  </tr>
                </thead>
                <tbody className="text-gray-800">
                  {['I', 'II', 'III', 'IV', 'V', 'VI'].map((disaName) => {
                    const row = getDisaData(disaName);
                    return (
                      <tr key={disaName} className="hover:bg-gray-50 transition-colors">
                        <td className="border border-gray-300 p-3 font-bold bg-gray-50">{disaName}</td>
                        <td className="border border-gray-300 p-3">{row.mouldCounterClose ?? "-"}</td>
                        <td className="border border-gray-300 p-3">{row.mouldCounterOpen ?? "-"}</td>
                        <td className="border border-gray-300 p-3">{row.producedMould ?? "-"}</td>
                        <td className="border border-gray-300 p-3">{row.pouredMould ?? "-"}</td>
                        <td className="border border-gray-300 p-3">{row.unpouredMould ?? "-"}</td>
                        <td className="border border-gray-300 p-3 font-medium text-blue-600">{row.percentage !== undefined && row.percentage !== "" ? `${row.percentage}%` : "-"}</td>
                        <td className="border border-gray-300 p-3 text-red-500">{row.delays ?? "-"}</td>
                        <td className="border border-gray-300 p-3">{row.producedMhr ?? "-"}</td>
                        <td className="border border-gray-300 p-3">{row.pouredMhr ?? "-"}</td>
                        <td className="border border-gray-300 p-3 font-medium text-green-600">{row.runningHours ?? "-"}</td>
                      </tr>
                    );
                  })}
                  <tr className="font-black bg-gray-200 text-gray-900">
                    <td className="border border-gray-400 p-3 text-left">TOTAL</td>
                    <td className="border border-gray-400 p-3"></td><td className="border border-gray-400 p-3"></td>
                    <td className="border border-gray-400 p-3">{totalProduced}</td><td className="border border-gray-400 p-3">{totalPoured}</td>
                    <td className="border border-gray-400 p-3 text-orange-600">{totalUnpoured}</td><td className="border border-gray-400 p-3">{totalPercentage}%</td>
                    <td className="border border-gray-400 p-3 text-red-600">{totalDelays}</td><td className="border border-gray-400 p-3"></td><td className="border border-gray-400 p-3"></td>
                    <td className="border border-gray-400 p-3 text-green-700">{totalRunningHours}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <table className="w-full border-collapse border border-gray-300 text-center text-sm shadow-sm rounded-lg overflow-hidden">
                <thead className="bg-gray-100 font-bold text-gray-700">
                  <tr><th colSpan="7" className="border border-gray-300 p-3 text-left">NO. OF MOULDS/DAY</th></tr>
                  <tr><th className="border border-gray-300 p-2 bg-gray-50 w-32"></th><th className="border border-gray-300 p-2">DISA 1</th><th className="border border-gray-300 p-2">DISA 2</th><th className="border border-gray-300 p-2">DISA 3</th><th className="border border-gray-300 p-2">DISA 4</th><th className="border border-gray-300 p-2">DISA 5</th><th className="border border-gray-300 p-2">DISA 6</th></tr>
                </thead>
                <tbody className="text-gray-800">
                  <tr><td className="border border-gray-300 p-3 font-bold bg-gray-50 text-left text-xs uppercase tracking-wider">MOULD / DAY</td><td className="border border-gray-300 p-3">{getDisaData('I').producedMould ?? "0"}</td><td className="border border-gray-300 p-3">{getDisaData('II').producedMould ?? "0"}</td><td className="border border-gray-300 p-3">{getDisaData('III').producedMould ?? "0"}</td><td className="border border-gray-300 p-3">{getDisaData('IV').producedMould ?? "0"}</td><td className="border border-gray-300 p-3">{getDisaData('V').producedMould ?? "0"}</td><td className="border border-gray-300 p-3">{getDisaData('VI').producedMould ?? "0"}</td></tr>
                  <tr className="font-black bg-gray-200"><td className="border border-gray-400 p-3 text-left">TOTAL</td><td className="border border-gray-400 p-3 text-center text-lg text-orange-700" colSpan="6">{totalProduced}</td></tr>
                </tbody>
              </table>

              <table className="w-full border-collapse border border-gray-300 text-center text-sm shadow-sm rounded-lg overflow-hidden">
                <thead className="bg-gray-100 font-bold text-gray-700">
                  <tr><th colSpan="7" className="border border-gray-300 p-3 text-left">NO. OF QUANTITY/DAY</th></tr>
                  <tr><th className="border border-gray-300 p-2 bg-gray-50 w-32"></th><th className="border border-gray-300 p-2">DISA 1</th><th className="border border-gray-300 p-2">DISA 2</th><th className="border border-gray-300 p-2">DISA 3</th><th className="border border-gray-300 p-2">DISA 4</th><th className="border border-gray-300 p-2">DISA 5</th><th className="border border-gray-300 p-2">DISA 6</th></tr>
                </thead>
                <tbody className="text-gray-800">
                  <tr><td className="border border-gray-300 p-3 font-bold bg-gray-50 text-left text-xs uppercase tracking-wider">QTY / DAY</td><td className="border border-gray-300 p-3">{getDisaData('I').pouredMould ?? "0"}</td><td className="border border-gray-300 p-3">{getDisaData('II').pouredMould ?? "0"}</td><td className="border border-gray-300 p-3">{getDisaData('III').pouredMould ?? "0"}</td><td className="border border-gray-300 p-3">{getDisaData('IV').pouredMould ?? "0"}</td><td className="border border-gray-300 p-3">{getDisaData('V').pouredMould ?? "0"}</td><td className="border border-gray-300 p-3">{getDisaData('VI').pouredMould ?? "0"}</td></tr>
                  <tr className="font-black bg-gray-200"><td className="border border-gray-400 p-3 text-left">TOTAL</td><td className="border border-gray-400 p-3 text-center text-lg text-orange-700" colSpan="6">{totalPoured}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div id="checklist-footer" className="bg-slate-100 p-8 border-t border-gray-200 bottom-0 z-20 flex justify-end gap-6 rounded-b-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <button onClick={generatePDF} className="bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-200 font-bold py-3 px-6 rounded-lg shadow-md uppercase flex items-center gap-2 mt-auto transition-colors"><FileDown size={20} /> PDF</button>
            <button onClick={handleSave} disabled={loading} className="bg-gray-900 hover:bg-orange-600 text-white font-bold py-3 px-12 rounded-lg shadow-lg uppercase mt-auto transition-colors flex items-center gap-3">{loading ? <Loader className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}{loading ? 'Saving...' : 'Save Shifts Data'}</button>
          </div>

        </div>
        <style dangerouslySetInnerHTML={{ __html: ` .custom-scrollbar::-webkit-scrollbar { height: 12px; } .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; } ` }} />
      </div>
    </>
  );
};

export default UnPouredMouldDetails;