import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, CheckCircle, AlertTriangle, FileDown, Loader, Save, PlusCircle, Trash2, Lock, Send } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Header from '../components/Header';
import logo from '../Assets/logo.png';

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

// --- Toast Notification ---
const ToastNotification = ({ data, onClose }) => {
  useEffect(() => {
    if (data.show && data.type !== 'loading') {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [data, onClose]);

  if (!data.show) return null;

  const isError = data.type === 'error';
  const isLoading = data.type === 'loading';

  return (
    <div className={`fixed top-6 right-6 z-[200] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl transition-all duration-300 animate-in slide-in-from-right-8 ${isLoading ? 'bg-blue-50 border-l-4 border-blue-600 text-blue-800' : isError ? 'bg-red-50 border-l-4 border-red-600 text-red-800' : 'bg-green-50 border-l-4 border-green-600 text-green-800'}`}>
      {isLoading ? <Loader className="animate-spin" size={20} /> : isError ? <AlertTriangle size={20} /> : <CheckCircle size={20} />}
      <p className="font-bold text-sm">{data.message}</p>
      {!isLoading && <button onClick={onClose} className="ml-4 opacity-50 hover:opacity-100"><X size={16} /></button>}
    </div>
  );
};

// --- Compact SearchableSelect ---
const SearchableSelect = ({ label, options, displayKey, onSelect, value, placeholder, disabled }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  useEffect(() => { if (value) setSearch(value); else setSearch(''); }, [value]);

  const filtered = options.filter((item) =>
    item[displayKey]?.toLowerCase().includes((search || '').toLowerCase())
  );

  return (
    <div className="relative w-full text-left">
      {label && <label className="text-[11px] font-black text-gray-800 uppercase block mb-1 tracking-wider">{label}</label>}
      <input
        type="text"
        value={search}
        disabled={disabled}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full p-2 text-xs font-bold border-2 border-gray-300 bg-white text-gray-900 rounded outline-none focus:border-orange-500 placeholder-gray-400 disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm"
        placeholder={placeholder || 'Search...'}
      />
      {open && !disabled && (
        <ul className="absolute top-full mt-1 z-50 bg-white border-2 border-gray-300 w-full max-h-48 overflow-y-auto rounded shadow-xl text-left">
          {filtered.length > 0 ? filtered.map((item, index) => (
            <li
              key={index}
              onMouseDown={(e) => { e.preventDefault(); setSearch(item[displayKey]); setOpen(false); onSelect(item); }}
              className="p-2 hover:bg-orange-100 cursor-pointer text-xs font-bold border-b border-gray-100 text-gray-900 last:border-0"
            >
              {item[displayKey]}
            </li>
          )) : <li className="p-2 text-gray-500 text-xs font-medium">No results</li>}
        </ul>
      )}
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
  { key: 'Customer', label: 'CUSTOMER', width: 'w-32', inputType: 'text' },
  { key: 'ItemDescription', label: 'ITEM\nDESCRIPTION', width: 'w-40', inputType: 'text' },
  { key: 'Time', label: 'TIME', width: 'w-24', inputType: 'time' },
  { key: 'PpThickness', label: 'PP\nTHICKNESS\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'PpHeight', label: 'PP\nHEIGHT\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'SpThickness', label: 'SP\nTHICKNESS\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'SpHeight', label: 'SP\nHEIGHT\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'CoreMaskThickness', label: 'CORE MASK\nTHICKNESS\n(mm)', width: 'w-24', inputType: 'number' },
  { key: 'CoreMaskOut', label: 'CORE MASK\nHEIGHT\n(OUTSIDE) mm', width: 'w-24', inputType: 'number' },
  { key: 'CoreMaskIn', label: 'CORE MASK\nHEIGHT\n(INSIDE) mm', width: 'w-24', inputType: 'number' },
  { key: 'SandShotPressure', label: 'SAND SHOT\nPRESSURE\nBAR', width: 'w-24', inputType: 'number', step: '0.01' },
  { key: 'CorrectionShotTime', label: 'CORRECTION\nOF SHOT TIME\n(SEC)', width: 'w-28', inputType: 'number' },
  { key: 'SqueezePressure', label: 'SQUEEZE\nPRESSURE\nKp/Cm2 / bar', width: 'w-28', inputType: 'number' },
  { key: 'PpStripAccel', label: 'PP STRIPPING\nACCELERATION', width: 'w-28', inputType: 'number' },
  { key: 'PpStripDist', label: 'PP STRIPPING\nDISTANCE', width: 'w-28', inputType: 'number' },
  { key: 'SpStripAccel', label: 'SP STRIPPING\nACCELERATION', width: 'w-28', inputType: 'number' },
  { key: 'SpStripDist', label: 'SP STRIPPING\nDISTANCE', width: 'w-28', inputType: 'number' },
  { key: 'MouldThickness', label: 'MOULD\nTHICKNESS\n(± 10mm)', width: 'w-28', inputType: 'number' },
  { key: 'CloseUpForce', label: 'CLOSE UP\nFORCE (Kp)', width: 'w-24', inputType: 'number' },
  { key: 'Remarks', label: 'REMARKS', width: 'w-48', inputType: 'text' }
];

const createEmptyRow = () => {
  const row = { id: crypto.randomUUID(), customValues: {} };
  baseColumns.forEach(c => row[c.key] = '');
  return row;
};

const DmmSettingParameters = () => {
  const [headerData, setHeaderData] = useState({ 
    date: getShiftDate(), 
    disaMachine: 'DISA - I',
    assignedHOF: '', 
    isHofSent: false 
  });
  const [allColumns, setAllColumns] = useState([...baseColumns]);

  const [shiftsMeta, setShiftsMeta] = useState({
    1: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false },
    2: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false },
    3: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false }
  });

  const [shiftsData, setShiftsData] = useState({ 1: [], 2: [], 3: [] });
  const [submittedShifts, setSubmittedShifts] = useState(new Set());
  const [dropdowns, setDropdowns] = useState({ operators: [], supervisors: [], hofs: [] }); 
  const [qfHistory, setQfHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  useEffect(() => { loadSchemaAndData(); }, [headerData.date, headerData.disaMachine]);

  const loadSchemaAndData = async () => {
    setLoading(true);
    try {
      const configRes = await axios.get(`${API_BASE}/config/dmm-setting-parameters/master`);
      const customCols = (configRes.data.config || []).map(c => ({
        key: `custom_${c.id}`, id: c.id, label: c.columnLabel.replace('\\n', '\n'),
        inputType: c.inputType, width: c.columnWidth, isCustom: true
      }));
      const mergedColumns = [...baseColumns, ...customCols];
      setAllColumns(mergedColumns);

      const res = await axios.get(`${API_BASE}/dmm-settings/details`, {
        params: { date: headerData.date, disa: headerData.disaMachine }
      });

      setDropdowns({ 
        operators: res.data.operators || [], 
        supervisors: res.data.supervisors || [], 
        hofs: res.data.hofs || [] 
      });

      setHeaderData(prev => ({ 
        ...prev, 
        assignedHOF: res.data.assignedHOF || '',
        isHofSent: !!res.data.assignedHOF 
      }));

      setQfHistory(res.data.qfHistory || []);

      const newSubmittedShifts = new Set();
      const loadedMeta = {
        1: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false },
        2: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false },
        3: { operator: '', supervisor: '', supervisorSignature: '', isIdle: false }
      };
      if (res.data.shiftsMeta) {
        for (let i = 1; i <= 3; i++) {
          if (res.data.shiftsMeta[i]) loadedMeta[i] = res.data.shiftsMeta[i];
        }
      }
      setShiftsMeta(loadedMeta);

      const loadedData = { 1: [], 2: [], 3: [] };
      [1, 2, 3].forEach(shift => {
        if (res.data.shiftsData[shift] && res.data.shiftsData[shift].length > 0) {
          newSubmittedShifts.add(shift);
          loadedData[shift] = res.data.shiftsData[shift].map(dbRow => {
            const uiRow = { id: crypto.randomUUID(), customValues: dbRow.customValues || {} };
            baseColumns.forEach(c => uiRow[c.key] = dbRow[c.key] || '');
            return uiRow;
          });
        } else {
          loadedData[shift] = [createEmptyRow()];
        }
      });

      setShiftsData(loadedData);
      setSubmittedShifts(newSubmittedShifts);

    } catch (error) {
      setNotification({ show: true, type: 'error', message: 'Failed to load data.' });
    }
    setLoading(false);
  };

  const handleMetaChange = (shift, field, value) => {
    setShiftsMeta(prev => ({ ...prev, [shift]: { ...prev[shift], [field]: value } }));
  };

  const handleInputChange = (shift, rowId, key, value, isCustom, colId) => {
    setShiftsData(prev => ({
      ...prev,
      [shift]: prev[shift].map(row => {
        if (row.id === rowId) {
          if (isCustom) return { ...row, customValues: { ...row.customValues, [colId]: value } };
          return { ...row, [key]: value };
        }
        return row;
      })
    }));
  };

  const addRow = (shift) => { setShiftsData(prev => ({ ...prev, [shift]: [...prev[shift], createEmptyRow()] })); };

  const removeRow = (shift, rowId) => {
    setShiftsData(prev => ({ ...prev, [shift]: prev[shift].length > 1 ? prev[shift].filter(row => row.id !== rowId) : prev[shift] }));
  };

  const getActiveShifts = () => {
    return [1, 2, 3].filter(shift => {
      if (submittedShifts.has(shift)) return false; 
      const meta = shiftsMeta[shift];
      return meta.isIdle || (meta.operator && meta.operator.trim() !== '');
    });
  };

  const saveToServer = async (isHofSubmission = false) => {
    const activeShifts = getActiveShifts();

    if (isHofSubmission) {
      const shift3Done = activeShifts.includes(3) || submittedShifts.has(3);
      if (!shift3Done) {
        return setNotification({ show: true, type: 'error', message: 'You can only send to the HOF after completing the 3rd shift.' });
      }
      if (!headerData.assignedHOF) {
        document.getElementById('checklist-footer')?.scrollIntoView({ behavior: 'smooth' });
        return setNotification({ show: true, type: 'error', message: 'Please Assign an HOF before sending.' });
      }
    }

    if (activeShifts.length === 0 && !isHofSubmission) {
      return setNotification({ show: true, type: 'error', message: 'Please select an operator (or mark as Line Idle) for at least one new shift before submitting.' });
    }

    let hasEmpty = false;
    let emptyShift = null;

    for (const shift of activeShifts) {
      if (shiftsMeta[shift].isIdle) continue;
      for (const row of shiftsData[shift]) {
        for (const col of allColumns) {
          const val = col.isCustom ? row.customValues[col.id] : row[col.key];
          if (val === undefined || val === null || String(val).trim() === '') {
            hasEmpty = true;
            emptyShift = shift;
            break;
          }
        }
        if (hasEmpty) break;
      }
      if (hasEmpty) break;
    }

    if (hasEmpty) {
      return setNotification({ show: true, type: 'error', message: `Shift ${emptyShift} has empty fields. Type '-' for any field with no data.` });
    }

    for (const shift of activeShifts) {
      if (shiftsMeta[shift].isIdle) continue;
      if (!shiftsMeta[shift].supervisor || shiftsMeta[shift].supervisor.trim() === '') {
        return setNotification({ show: true, type: 'error', message: `Please select a Supervisor for Shift ${shift}.` });
      }
    }

    let finalHOF = headerData.isHofSent ? headerData.assignedHOF : '';
    if (isHofSubmission) {
      finalHOF = headerData.assignedHOF;
    }

    setLoading(true);
    try {
      await axios.post(`${API_BASE}/dmm-settings/save`, {
        date: headerData.date,
        disa: headerData.disaMachine,
        shiftsData,
        shiftsMeta,
        shiftsToSave: activeShifts,
        assignedHOF: finalHOF 
      });

      if (isHofSubmission) {
        setHeaderData(prev => ({ ...prev, isHofSent: true }));
      }

      setNotification({ show: true, type: 'success', message: isHofSubmission ? 'Sent to HOF Successfully!' : 'Shift Data Saved Successfully!' });
      setTimeout(() => setNotification({ show: false }), 3000);
      loadSchemaAndData(); 
    } catch (error) {
      setNotification({ show: true, type: 'error', message: 'Failed to save data.' });
    }
    setLoading(false);
  };

  const generatePDF = () => {
    setNotification({ show: true, type: 'loading', message: 'Generating PDF...' });
    try {
      const doc = new jsPDF('l', 'mm', 'a4');

      let currentPageQfValue = 'QF/07/FBP-13, Rev.No:06 dt 08.10.2025';
      const reportDateObj = new Date(headerData.date);
      reportDateObj.setHours(0, 0, 0, 0);

      for (let qf of qfHistory) {
        if (!qf.date) continue;
        const qfDate = new Date(qf.date);
        qfDate.setHours(0, 0, 0, 0);
        if (qfDate <= reportDateObj) { currentPageQfValue = qf.qfValue; break; }
      }

      doc.setLineWidth(0.3);

      doc.rect(10, 10, 40, 20);
      try { doc.addImage(logo, 'PNG', 12, 11, 36, 18); } catch (err) {
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text('SAKTHI', 30, 18, { align: 'center' });
        doc.text('AUTO', 30, 26, { align: 'center' });
      }

      doc.rect(50, 10, 197, 20);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text('DMM SETTING PARAMETERS CHECK SHEET', 148.5, 22, { align: 'center' });

      doc.rect(247, 10, 40, 20);
      doc.setFontSize(11);
      doc.text(headerData.disaMachine, 267, 16, { align: 'center' });
      doc.line(247, 20, 287, 20);
      doc.setFontSize(10);
      const formattedDate = new Date(headerData.date).toLocaleDateString('en-GB');
      doc.text(`DATE: ${formattedDate}`, 267, 26, { align: 'center' });

      autoTable(doc, {
        startY: 35, margin: { left: 10, right: 10 },
        head: [['SHIFT', 'OPERATOR NAME', 'VERIFIED BY', 'SIGNATURE']],
        body: [
          ['SHIFT I', shiftsMeta[1].operator || '-', shiftsMeta[1].supervisor || '-', ''],
          ['SHIFT II', shiftsMeta[2].operator || '-', shiftsMeta[2].supervisor || '-', ''],
          ['SHIFT III', shiftsMeta[3].operator || '-', shiftsMeta[3].supervisor || '-', '']
        ],
        theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        didDrawCell: function (data) {
          if (data.section === 'body' && data.column.index === 3) {
            const shiftNum = data.row.index + 1;
            const sigData = shiftsMeta[shiftNum]?.supervisorSignature;
            
            if (sigData && String(sigData).trim().toUpperCase() === 'APPROVED') {
              doc.setDrawColor(0, 128, 0); doc.setLineWidth(0.5);
              doc.line(data.cell.x + 2, data.cell.y + 4, data.cell.x + 4, data.cell.y + 6);
              doc.line(data.cell.x + 4, data.cell.y + 6, data.cell.x + 8, data.cell.y + 2);
              doc.setDrawColor(0, 0, 0);

              doc.setFontSize(5); doc.setTextColor(0, 128, 0); doc.setFont('helvetica', 'bold');
              doc.text("APPROVED", data.cell.x + 9, data.cell.y + 5);
              doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal');
            } else if (sigData && String(sigData).startsWith('data:image')) {
              try { doc.addImage(sigData, 'PNG', data.cell.x + 2, data.cell.y + 1, data.cell.width - 4, data.cell.height - 2); } catch (e) { }
            }
          }
        }
      });

      let currentY = doc.lastAutoTable.finalY + 8;

      [1, 2, 3].forEach((shift, index) => {
        const isIdle = shiftsMeta[shift].isIdle;
        const shiftLabel = shift === 1 ? 'I' : shift === 2 ? 'II' : 'III';

        const tableHeader = [
          [{ content: `SHIFT ${shiftLabel}`, colSpan: allColumns.length + 1, styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [0, 0, 0] } }],
          [{ content: 'S.No', styles: { cellWidth: 8 } }, ...allColumns.map(col => ({ content: col.label, styles: { cellWidth: 'wrap' } }))]
        ];

        let tableBody = [];
        if (isIdle) {
          tableBody.push([{ content: 'L I N E   I D L E', colSpan: allColumns.length + 1, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 14, textColor: [100, 100, 100], fillColor: [245, 245, 245], minCellHeight: 15 } }]);
        } else {
          tableBody = shiftsData[shift].map((row, idx) => {
            const pdfRow = [(idx + 1).toString()];
            allColumns.forEach(col => {
              const val = col.isCustom ? row.customValues[col.id] : row[col.key];
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
      doc.save(`DMM_Setting_Parameters_${headerData.date}.pdf`);
      setNotification({ show: false, type: '', message: '' });

    } catch (error) { setNotification({ show: true, type: 'error', message: `PDF Gen Failed: ${error.message}` }); }
  };

  const activeShifts = getActiveShifts();

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
        <ToastNotification data={notification} onClose={() => setNotification({ ...notification, show: false })} />

        <div className="bg-white w-full max-w-[100rem] rounded-xl p-8 shadow-2xl flex flex-col border-4 border-gray-100">

          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 uppercase tracking-wide flex items-center justify-center gap-2">
            <span className="text-orange-500 text-2xl">⚙️</span> DMM Setting Parameters
          </h2>

          <div className="flex justify-end items-center gap-6 mb-8 border-b-2 border-gray-200 pb-4">
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

          <div className="overflow-x-auto min-h-[400px] custom-scrollbar">
            <table className="w-full min-w-max border-collapse text-xs text-center table-fixed">
              <thead className="bg-gray-100">
                <tr className="text-[10px] text-gray-600 uppercase tracking-wide border-y-2 border-orange-200">
                  <th className="border border-gray-300 p-2 w-10 sticky left-0 bg-gray-100 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.3)]">S.No</th>
                  {allColumns.map((col, idx) => (
                    <th key={idx} className={`border border-gray-300 p-2 align-middle whitespace-pre-wrap ${col.width}`}>{col.label}</th>
                  ))}
                  <th className="border border-gray-300 p-2 w-12 sticky right-0 bg-gray-200 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">DEL</th>
                </tr>
              </thead>
              <tbody className="text-sm font-semibold text-slate-800">
                {[1, 2, 3].map(shift => {
                  const isIdle = shiftsMeta[shift].isIdle;
                  const isLocked = submittedShifts.has(shift); 
                  const zClass = shift === 1 ? 'z-40' : shift === 2 ? 'z-30' : 'z-20';

                  return (
                    <React.Fragment key={`shift-${shift}`}>
                      <tr className={`border-y-2 ${isLocked ? 'bg-green-50/70 border-green-300' : 'bg-orange-50/50 border-orange-200'}`}>
                        <td colSpan={allColumns.length + 2} className={`p-3 text-left sticky left-0 ${zClass}`}>
                          <div className="flex items-center justify-between w-[950px]">
                            <div className="flex items-center gap-6">
                              <span className="font-black text-gray-800 text-lg">SHIFT {shift}</span>

                              {isLocked && (
                                <span className="flex items-center gap-1.5 bg-green-100 border border-green-400 text-green-700 text-xs font-black px-3 py-1 rounded-full">
                                  <Lock size={12} /> SUBMITTED – READ ONLY
                                </span>
                              )}

                              {!isLocked && (
                                <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded border-2 border-gray-300 hover:border-orange-500 transition-colors shadow-sm">
                                  <input
                                    type="checkbox"
                                    checked={isIdle}
                                    onChange={(e) => handleMetaChange(shift, 'isIdle', e.target.checked)}
                                    className="w-4 h-4 accent-orange-600 cursor-pointer"
                                  />
                                  <span className="text-xs font-bold text-gray-700 uppercase">Line Idle</span>
                                </label>
                              )}

                              <div className={`flex items-center gap-2 transition-opacity ${isIdle && !isLocked ? 'opacity-40 pointer-events-none' : ''}`}>
                                <span className="text-xs font-bold text-gray-600 uppercase">Operator:</span>
                                <div className="w-48 relative">
                                  <SearchableSelect
                                    options={dropdowns.operators}
                                    displayKey="OperatorName"
                                    value={shiftsMeta[shift].operator}
                                    placeholder="Select Operator..."
                                    disabled={isLocked}
                                    onSelect={(item) => handleMetaChange(shift, 'operator', item.OperatorName)}
                                  />
                                </div>
                              </div>

                              <div className={`flex items-center gap-2 transition-opacity ${isIdle && !isLocked ? 'opacity-40 pointer-events-none' : ''}`}>
                                <span className="text-xs font-bold text-gray-600 uppercase">Supervisor:</span>
                                <div className="w-48 relative">
                                  <SearchableSelect
                                    options={dropdowns.supervisors}
                                    displayKey="supervisorName"
                                    value={shiftsMeta[shift].supervisor}
                                    placeholder="Select Supervisor..."
                                    disabled={isLocked}
                                    onSelect={(item) => handleMetaChange(shift, 'supervisor', item.supervisorName)}
                                  />
                                </div>
                              </div>
                            </div>

                            {!isLocked && (
                              <button
                                onClick={() => addRow(shift)}
                                disabled={isIdle}
                                className={`flex items-center gap-1 border-2 px-3 py-1.5 rounded transition-all shadow-sm text-xs font-bold uppercase ${isIdle ? 'bg-gray-200 text-gray-400 border-gray-300 cursor-not-allowed' : 'bg-white border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white'}`}
                              >
                                <PlusCircle className="w-4 h-4" /> Add Row
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {shiftsData[shift].map((row, index) => (
                        <tr
                          key={row.id}
                          className={`h-12 transition-all ${isLocked
                              ? 'bg-green-50/30 opacity-70 grayscale-[30%] pointer-events-none select-none'
                              : isIdle
                                ? 'bg-gray-100/50 opacity-40 grayscale pointer-events-none select-none'
                                : 'hover:bg-orange-50/20 group'
                            }`}
                        >
                          <td className={`border border-gray-300 font-bold text-gray-600 sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isLocked ? 'bg-green-50' : isIdle ? 'bg-gray-200/50' : 'bg-gray-50 group-hover:bg-orange-50/80'}`}>
                            {index + 1}
                          </td>
                          {allColumns.map(col => {
                            const val = col.isCustom ? row.customValues[col.id] : row[col.key];
                            return (
                              <td key={col.key} className="border border-gray-300 p-0 relative">
                                <input
                                  type={col.inputType === 'number' ? 'text' : col.inputType}
                                  step={col.step || undefined}
                                  disabled={isIdle || isLocked}
                                  placeholder={col.inputType === 'number' || col.inputType === 'text' ? "Type '-' if empty" : undefined}
                                  value={isIdle ? '' : (val || '')}
                                  onChange={(e) => handleInputChange(shift, row.id, col.key, e.target.value, col.isCustom, col.id)}
                                  className={`absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-800 outline-none px-1 placeholder:text-[8px] placeholder:text-gray-400 ${isLocked || isIdle ? 'bg-transparent cursor-not-allowed' : 'bg-transparent focus:bg-orange-100 focus:ring-inset focus:ring-2 focus:ring-orange-500'}`}
                                />
                              </td>
                            );
                          })}
                          <td className={`border border-gray-300 sticky right-0 z-10 shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isLocked ? 'bg-green-50' : isIdle ? 'bg-gray-200/50' : 'bg-gray-50 group-hover:bg-orange-50/80'}`}>
                            <button
                              onClick={() => removeRow(shift, row.id)}
                              disabled={isIdle || isLocked}
                              className="text-gray-400 hover:text-red-600 transition-colors mx-auto block disabled:opacity-0"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div id="checklist-footer" className="bg-slate-100 p-8 border-t border-gray-200 mt-6 flex flex-col md:flex-row justify-between items-end gap-6 rounded-xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="w-full md:w-1/3">
               <SearchableSelect 
                  label="Assign to HOF (Verification)" 
                  options={dropdowns.hofs} 
                  displayKey="OperatorName" 
                  value={headerData.assignedHOF} 
                  onSelect={(op) => setHeaderData(prev => ({ ...prev, assignedHOF: op.OperatorName }))} 
                  placeholder="Select HOF..." 
               />
            </div>

            <div className="flex flex-wrap gap-4 w-full md:w-auto justify-end">
              <button onClick={generatePDF} className="bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-200 font-bold py-3 px-6 rounded-lg shadow-md uppercase flex items-center gap-2 mt-auto transition-colors">
                <FileDown size={20} /> PDF
              </button>
              
              <button onClick={() => saveToServer(false)} disabled={loading} className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-3 px-8 rounded-lg shadow-lg uppercase mt-auto transition-colors flex items-center gap-3">
                {loading ? <Loader className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                {loading ? 'Saving...' : 'Save Shifts Data'}
              </button>

              <button onClick={() => saveToServer(true)} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg uppercase mt-auto transition-colors flex items-center gap-3">
                {loading ? <Loader className="animate-spin w-5 h-5" /> : <Send className="w-5 h-5" />}
                {loading ? 'Sending...' : 'Send to HOF'}
              </button>
            </div>
          </div>

        </div>

        <style dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { height: 12px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          input[type=time]::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
          input[type=number]::-webkit-inner-spin-button,
          input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
          input[type=number] { -moz-appearance: textfield; }
        `}} />
      </div>
    </>
  );
};

export default DmmSettingParameters;