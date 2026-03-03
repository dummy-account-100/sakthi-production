import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, CheckCircle, AlertTriangle, FileDown, Loader, Save } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../assets/logo.png';

// --- Upgraded to Toast Notification ---
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

const SearchableSelect = ({ label, options, displayKey, onSelect, value, placeholder }) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { if (value) setSearch(value); }, [value]);
  const filtered = options.filter((item) => item[displayKey]?.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="relative w-full">
      {label && <label className="text-[11px] font-black text-gray-800 uppercase block mb-1 tracking-wider">{label}</label>}
      <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} className="w-full p-3 text-sm font-bold border-2 border-gray-600 bg-white text-gray-900 rounded-lg outline-none focus:border-orange-600 placeholder-gray-500 shadow-sm" placeholder={placeholder || "Search..."} />
      {open && <ul className="absolute bottom-full mb-1 z-50 bg-white border-2 border-gray-400 w-full max-h-60 overflow-y-auto rounded-lg shadow-2xl">
        {filtered.length > 0 ? filtered.map((item, index) => (
          <li key={index} onMouseDown={(e) => { e.preventDefault(); setSearch(item[displayKey]); setOpen(false); onSelect(item); }} className="p-3 hover:bg-orange-100 cursor-pointer text-sm font-bold border-b border-gray-200 text-gray-900">{item[displayKey]}</li>
        )) : <li className="p-3 text-gray-500 text-sm font-medium">No results</li>}
      </ul>}
    </div>
  );
};

const getShiftDate = () => {
  const now = new Date();
  if (now.getHours() < 7) { now.setDate(now.getDate() - 1); }
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const BottomLevelAudit = () => {
  const [checklist, setChecklist] = useState([]);
  const [supervisors, setSupervisors] = useState([]);
  const [hofs, setHofs] = useState([]);
  const [reportsMap, setReportsMap] = useState({});
  const [headerData, setHeaderData] = useState({
    date: getShiftDate(),
    supervisorName: '',
    assignedHOF: '',
    disaMachine: 'DISA - I'
  });
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [ncForm, setNcForm] = useState({ ncDetails: '', correction: '', rootCause: '', correctiveAction: '', targetDate: new Date().toISOString().split('T')[0], responsibility: '', sign: '', status: 'Pending' });

  const API_BASE = `${process.env.REACT_APP_API_URL}/api/bottom-level-audit`;

  useEffect(() => { fetchData(); }, [headerData.date, headerData.disaMachine]);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/details`, { params: { date: headerData.date, disaMachine: headerData.disaMachine } });
      setSupervisors(res.data.supervisors);
      setHofs(res.data.hofs);

      let foundHOF = ''; let foundSupName = '';
      const mergedList = res.data.checklist.map(item => {
        if (item.AssignedHOF) foundHOF = item.AssignedHOF;
        if (item.SupervisorName) foundSupName = item.SupervisorName;
        return {
          ...item,
          IsDone: item.IsDone == 1 || item.IsDone === true,
          IsNA: item.IsNA == 1 || item.IsNA === true,
          IsHoliday: item.IsHoliday == 1 || item.IsHoliday === true,
          IsVatCleaning: item.IsVatCleaning == 1 || item.IsVatCleaning === true,
          IsPreventiveMaintenance: item.IsPreventiveMaintenance == 1 || item.IsPreventiveMaintenance === true
        }
      });
      setChecklist(mergedList);
      setHeaderData(prev => ({ ...prev, supervisorName: foundSupName, assignedHOF: foundHOF }));
      const reportsObj = {};
      res.data.reports.forEach(r => { reportsObj[r.MasterId] = r; });
      setReportsMap(reportsObj);
    } catch (error) { setNotification({ show: true, type: 'error', message: "Failed to load data." }); }
  };

  const isGlobalHoliday = checklist.length > 0 && checklist.every(i => i.IsHoliday);
  const isGlobalVatCleaning = checklist.length > 0 && checklist.every(i => i.IsVatCleaning);
  const isGlobalPrevMaint = checklist.length > 0 && checklist.every(i => i.IsPreventiveMaintenance);

  const handleOkClick = (item) => { setChecklist(prev => prev.map(c => c.MasterId === item.MasterId ? { ...c, IsDone: !c.IsDone, IsNA: false } : c)); };
  const handleNAClick = (item) => { setChecklist(prev => prev.map(c => c.MasterId === item.MasterId ? { ...c, IsNA: !c.IsNA, IsDone: false } : c)); };

  const handleNotOkClick = (item) => {
    if (!headerData.supervisorName && !(isGlobalHoliday || isGlobalVatCleaning || isGlobalPrevMaint)) {
      document.getElementById('checklist-footer')?.scrollIntoView({ behavior: 'smooth' });
      return setNotification({ show: true, type: 'error', message: 'Please select the Supervisor Name at the bottom.' });
    }
    setModalItem(item);
    const existingReport = reportsMap[item.MasterId];
    if (existingReport) {
      setNcForm({ ncDetails: existingReport.NonConformityDetails, correction: existingReport.Correction, rootCause: existingReport.RootCause, correctiveAction: existingReport.CorrectiveAction, targetDate: existingReport.TargetDate.split('T')[0], responsibility: existingReport.Responsibility, sign: existingReport.Sign, status: existingReport.Status });
    } else {
      setNcForm({ ncDetails: '', correction: '', rootCause: '', correctiveAction: '', targetDate: headerData.date, responsibility: '', sign: headerData.supervisorName || 'N/A', status: 'Pending' });
    }
    setIsModalOpen(true);
  };

  const handleMasterHolidayToggle = (checked) => { setChecklist(prev => prev.map(c => ({ ...c, IsHoliday: checked, IsVatCleaning: false, IsPreventiveMaintenance: false, IsDone: false, IsNA: false }))); };
  const handleMasterVatToggle = (checked) => { setChecklist(prev => prev.map(c => ({ ...c, IsVatCleaning: checked, IsHoliday: false, IsPreventiveMaintenance: false, IsDone: false, IsNA: false }))); };
  const handleMasterPrevMaintToggle = (checked) => { setChecklist(prev => prev.map(c => ({ ...c, IsPreventiveMaintenance: checked, IsHoliday: false, IsVatCleaning: false, IsDone: false, IsNA: false }))); };

  const submitReport = async () => {
    if (!ncForm.ncDetails || !ncForm.responsibility) return setNotification({ show: true, type: 'error', message: 'Details and Responsibility are mandatory.' });
    try {
      await axios.post(`${API_BASE}/report-nc`, { checklistId: modalItem.MasterId, slNo: modalItem.SlNo, reportDate: headerData.date, disaMachine: headerData.disaMachine, ...ncForm });
      setNotification({ show: true, type: 'success', message: 'Report Logged Successfully.' });
      setIsModalOpen(false);
      setReportsMap(prev => ({ ...prev, [modalItem.MasterId]: { ...ncForm, MasterId: modalItem.MasterId, Status: 'Pending', Name: ncForm.sign } }));
      setChecklist(prev => prev.map(c => c.MasterId === modalItem.MasterId ? { ...c, IsDone: false, IsNA: false } : c));
    } catch (error) { setNotification({ show: true, type: 'error', message: 'Failed to save report.' }); }
  };

  const handleBatchSubmit = async () => {
    if (!isGlobalHoliday && !isGlobalVatCleaning && !isGlobalPrevMaint) {
      if (!headerData.supervisorName || !headerData.assignedHOF) {
        document.getElementById('checklist-footer')?.scrollIntoView({ behavior: 'smooth' });
        return setNotification({ show: true, type: 'error', message: 'Select Supervisor and HOF before submitting.' });
      }
    }
    const pendingItems = checklist.filter(item => !item.IsDone && !item.IsNA && !item.IsHoliday && !item.IsVatCleaning && !item.IsPreventiveMaintenance && !reportsMap[item.MasterId]);
    if (pendingItems.length > 0) return setNotification({ show: true, type: 'error', message: `Cannot submit. ${pendingItems.length} items are unchecked.` });

    setLoading(true);
    try {
      const itemsToSave = checklist.map(item => ({ MasterId: item.MasterId, IsDone: item.IsDone, IsNA: item.IsNA, IsHoliday: item.IsHoliday, IsVatCleaning: item.IsVatCleaning, IsPreventiveMaintenance: item.IsPreventiveMaintenance }));
      await axios.post(`${API_BASE}/submit-batch`, {
        items: itemsToSave, sign: headerData.supervisorName || '', assignedHOF: headerData.assignedHOF || '', date: headerData.date, disaMachine: headerData.disaMachine
      });
      setNotification({ show: true, type: 'success', message: 'Checklist Saved & Assigned!' });
      fetchData();
    } catch (error) { setNotification({ show: true, type: 'error', message: 'Submit failed.' }); }
    setLoading(false);
  };

  const generatePDF = async () => {
    setNotification({ show: true, type: 'loading', message: 'Generating PDF...' });
    try {
      const selectedDate = new Date(headerData.date);
      const year = selectedDate.getFullYear(); const month = selectedDate.getMonth() + 1;
      let monthlyLogs = []; let ncReports = [];

      try {
        const res = await axios.get(`${API_BASE}/monthly-report`, { params: { month, year, disaMachine: headerData.disaMachine } });
        monthlyLogs = res.data.monthlyLogs || []; ncReports = res.data.ncReports || [];
      } catch (backendErr) {
        console.error("Backend Error:", backendErr);
        setNotification({ show: true, type: 'error', message: 'Database Error: Check backend console.' });
        return;
      }

      const historyMap = {}; const holidayDays = new Set(); const vatDays = new Set(); const prevMaintDays = new Set();
      const supSigMap = {};

      const hofSigRow = monthlyLogs.find(l => l.HOFSignature);
      const hofSig = hofSigRow ? hofSigRow.HOFSignature : null;

      monthlyLogs.forEach(log => {
        const logDay = log.DayVal; const key = String(log.MasterId);

        const isHol = log.IsHoliday == 1 || log.IsHoliday === true || String(log.IsHoliday) === '1';
        const isVat = log.IsVatCleaning == 1 || log.IsVatCleaning === true || String(log.IsVatCleaning) === '1';
        const isPM = log.IsPreventiveMaintenance == 1 || log.IsPreventiveMaintenance === true || String(log.IsPreventiveMaintenance) === '1';

        if (isHol) holidayDays.add(logDay);
        else if (isVat) vatDays.add(logDay);
        else if (isPM) prevMaintDays.add(logDay);

        if (log.SupervisorSignature) supSigMap[logDay] = log.SupervisorSignature;
        if (!historyMap[key]) historyMap[key] = {};

        if (log.IsNA == 1 || log.IsNA === true) { historyMap[key][logDay] = 'NA'; }
        else if (log.IsDone == 1 || log.IsDone === true) { historyMap[key][logDay] = 'Y'; }
        else if (isHol || isVat || isPM) { historyMap[key][logDay] = ''; }
        else { historyMap[key][logDay] = 'N'; }
      });

      const doc = new jsPDF('l', 'mm', 'a4');
      const monthName = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(year, month, 0).getDate();

      doc.setLineWidth(0.3);
      doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
      doc.rect(50, 10, 237, 20); doc.setFontSize(16);
      doc.text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", 168, 22, { align: 'center' });
      doc.setFontSize(10); doc.text(`${headerData.disaMachine}`, 12, 35); doc.text(`MONTH : ${monthName}`, 235, 35);

      const days = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
      const tableBody = checklist.map((item, rowIndex) => {
        const row = [String(item.SlNo), item.CheckPointDesc];
        for (let i = 1; i <= daysInMonth; i++) {
          if (holidayDays.has(i)) {
            if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } });
          }
          else if (vatDays.has(i)) {
            if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } });
          }
          else if (prevMaintDays.has(i)) {
            if (rowIndex === 0) row.push({
              content: 'P\nR\nE\nV\nE\nN\nT\nI\nV\nE\n\nM\nA\nI\nN\nT\nE\nN\nA\nN\nC\nE',
              rowSpan: checklist.length,
              styles: { halign: 'center', valign: 'middle', fillColor: [243, 232, 255], fontStyle: 'bold', textColor: [126, 34, 206], fontSize: 4.5 }
            });
          }
          else {
            row.push(historyMap[String(item.MasterId)]?.[i] || '');
          }
        }
        return row;
      });

      const supRow = ["", "Supervisor"];
      for (let i = 1; i <= daysInMonth; i++) { supRow.push(""); }
      const hofRow = ["", "HOF"];
      for (let i = 1; i <= daysInMonth - 5; i++) { hofRow.push(""); }
      hofRow.push({ content: '', colSpan: 5, styles: { halign: 'center', valign: 'middle' } });

      const footerRows = [supRow, hofRow];
      const dynamicColumnStyles = {};
      for (let i = 2; i < daysInMonth + 2; i++) { dynamicColumnStyles[i] = { cellWidth: 5, halign: 'center' }; }

      autoTable(doc, {
        startY: 38,
        head: [[{ content: 'S.No', styles: { halign: 'center', valign: 'middle' } }, { content: 'Check Points', styles: { halign: 'center', valign: 'middle' } }, ...days.map(d => ({ content: d, styles: { halign: 'center' } }))]],
        body: [...tableBody, ...footerRows],
        theme: 'grid', styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 105 }, ...dynamicColumnStyles },

        didDrawCell: function (data) {
          if (data.row.index === tableBody.length && data.column.index > 1) {
            const sigData = supSigMap[data.column.index - 1];
            if (sigData && sigData.startsWith('data:image')) {
              try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch (e) { }
            }
          }
          if (data.row.index === tableBody.length + 1 && data.cell.colSpan === 5) {
            if (hofSig && hofSig.startsWith('data:image')) {
              try { doc.addImage(hofSig, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch (e) { }
            }
          }
        },
        didParseCell: function (data) {
          if (data.row.index >= tableBody.length && data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.halign = 'right'; }
          if (data.column.index > 1 && data.row.index < tableBody.length) {
            const text = (data.cell.text || [])[0] || '';
            if (text === 'Y') { data.cell.styles.font = 'ZapfDingbats'; data.cell.text = '3'; data.cell.styles.textColor = [0, 100, 0]; }
            else if (text === 'N') { data.cell.styles.textColor = [255, 0, 0]; data.cell.text = 'X'; data.cell.styles.fontStyle = 'bold'; }
            else if (text === 'NA') { data.cell.styles.fontSize = 5; data.cell.styles.textColor = [100, 100, 100]; data.cell.styles.fontStyle = 'bold'; }
          }
        }
      });

      const finalY = doc.lastAutoTable.finalY + 6;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.text("Legend:   3 - OK     X - NOT OK     CA - Corrected during Audit     NA - Not Applicable", 10, finalY);
      doc.setFont('helvetica', 'normal');
      doc.text("Remarks: If Nonconformity please write on NCR format (back-side)", 10, finalY + 6);
      doc.text("QF/08/MRO - 18, Rev No: 02 dt 01.01.2022", 10, 200); doc.text("Page 1 of 2", 270, 200);

      // PAGE 2 (NCR) 
      doc.addPage(); doc.setDrawColor(0); doc.setLineWidth(0.3); doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' }); doc.rect(50, 10, 237, 20); doc.setFontSize(16);
      doc.text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", 168, 18, { align: 'center' }); doc.setFontSize(14); doc.text("Non-Conformance Report", 168, 26, { align: 'center' });

      const ncRows = ncReports.map((r, index) => [
        index + 1, new Date(r.ReportDate).toLocaleDateString('en-GB'), r.NonConformityDetails || '', r.Correction || '', r.RootCause || '', r.CorrectiveAction || '',
        r.TargetDate ? new Date(r.TargetDate).toLocaleDateString('en-GB') : '', r.Responsibility || '', '', r.Status || ''
      ]);
      if (ncRows.length === 0) { for (let i = 0; i < 5; i++) ncRows.push(['', '', '', '', '', '', '', '', '', '']); }

      autoTable(doc, {
        startY: 35,
        head: [['S.No', 'Date', 'Non-Conformities Details', 'Correction', 'Root Cause', 'Corrective Action', 'Target Date', 'Responsibility', 'Signature', 'Status']],
        body: ncRows, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 35 }, 4: { cellWidth: 35 }, 5: { cellWidth: 35 }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 25 }, 8: { cellWidth: 20, halign: 'center' }, 9: { cellWidth: 20, halign: 'center' } },

        didDrawCell: function (data) {
          if (data.section === 'body' && data.column.index === 8) {
            const rowData = ncReports[data.row.index];
            if (rowData && rowData.SupervisorSignature && rowData.SupervisorSignature.startsWith('data:image')) {
              try { doc.addImage(rowData.SupervisorSignature, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch (e) { }
            }
          }
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 9) {
            const statusText = (data.cell.text || [])[0] || '';
            if (statusText === 'Completed') {
              data.cell.styles.textColor = [0, 150, 0];
              data.cell.styles.fontStyle = 'bold';
            } else if (statusText === 'Pending') {
              data.cell.styles.textColor = [200, 0, 0];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.text("QF/08/MRO - 18, Rev No: 02 dt 01.01.2022", 10, 200); doc.text("Page 2 of 2", 270, 200);

      doc.save(`Bottom_Level_Audit_${headerData.date}.pdf`); setNotification({ show: false });
    } catch (error) { setNotification({ show: true, type: 'error', message: `PDF Generation Failed: ${error.message}` }); }
  };

  const inputStyle = "w-full border-2 border-gray-300 bg-white rounded-lg p-3 text-sm text-gray-900 font-medium focus:border-red-500 outline-none shadow-sm placeholder-gray-500";

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-4 flex justify-center pb-24">
      <ToastNotification data={notification} onClose={() => setNotification({ ...notification, show: false })} />

      <div className="w-full max-w-6xl bg-white shadow-xl rounded-2xl flex flex-col">
        <div className="bg-gray-900 py-6 px-8 flex justify-between items-center rounded-t-2xl">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Sakthi Auto" className="h-10 w-auto object-contain bg-white p-1 rounded" />
            <h2 className="text-xl font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <span className="text-blue-500 text-2xl">📋</span> Bottom Level Audit
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-blue-400 text-lg font-black uppercase tracking-wider">DISA:</span>
            <select value={headerData.disaMachine} onChange={(e) => setHeaderData({ ...headerData, disaMachine: e.target.value })} className="bg-gray-800 text-white font-bold border-2 border-blue-500 rounded-md p-2 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="DISA - I">DISA - I</option><option value="DISA - II">DISA - II</option><option value="DISA - III">DISA - III</option><option value="DISA - IV">DISA - IV</option><option value="DISA - V">DISA - V</option><option value="DISA - VI">DISA - VI</option>
            </select>
            <span className="text-blue-400 text-lg font-black uppercase tracking-wider ml-4">Date:</span>
            <input type="date" value={headerData.date} onChange={(e) => setHeaderData({ ...headerData, date: e.target.value })} className="bg-white text-gray-700 font-bold border-2 border-blue-500 rounded-md p-1.5 text-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm" />
          </div>
        </div>

        <div className="p-6 overflow-x-auto min-h-[500px] border-b">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs text-gray-500 uppercase border-b-2 border-blue-100">
                <th className="py-3 pl-2 w-12">#</th>
                <th className="py-3 w-1/2">Check Point</th>
                <th className="py-3 text-center w-20">OK</th>
                <th className="py-3 text-center w-20">Not OK</th>
                <th className="py-3 text-center w-20 border-r-2 border-gray-100">N/A</th>
                <th className="py-3 text-center w-20 ">Holiday<br /><input type="checkbox" checked={isGlobalHoliday} onChange={(e) => handleMasterHolidayToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-orange-600 cursor-pointer" /></th>
                <th className="py-3 text-center w-20">VAT Cleaning<br /><input type="checkbox" checked={isGlobalVatCleaning} onChange={(e) => handleMasterVatToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-blue-600 cursor-pointer" /></th>
                <th className="py-3 text-center w-20">Preventive Maintenance<br /><input type="checkbox" checked={isGlobalPrevMaint} onChange={(e) => handleMasterPrevMaintToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-purple-600 cursor-pointer" /></th>
              </tr>
            </thead>
            <tbody>
              {checklist.length === 0 ? <tr><td colSpan="8" className="text-center py-4 text-gray-500">Loading...</td></tr> : checklist.map((item) => {
                const hasReport = !!reportsMap[item.MasterId];
                const isDisabled = item.IsHoliday || item.IsVatCleaning || item.IsPreventiveMaintenance;

                return (
                  <tr key={item.MasterId} className={`border-b border-gray-100 transition-colors ${hasReport ? 'bg-red-50' : isDisabled ? 'bg-gray-50 opacity-60' : 'hover:bg-blue-50/20'}`}>
                    <td className="py-4 pl-2 font-bold text-gray-400">{item.SlNo}</td><td className={`py-4 font-bold text-sm pr-4 ${isDisabled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.CheckPointDesc}</td>
                    <td className="py-4 text-center"><div onClick={() => !isDisabled && !hasReport && handleOkClick(item)} className={`w-6 h-6 mx-auto rounded border-2 flex items-center justify-center transition-all ${isDisabled ? 'cursor-not-allowed border-gray-200 bg-gray-100' : 'cursor-pointer'} ${item.IsDone && !hasReport && !isDisabled ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 bg-white'} ${hasReport ? 'opacity-20 cursor-not-allowed' : ''}`}>{item.IsDone && !hasReport && !isDisabled && "✓"}</div></td>
                    <td className="py-4 text-center"><div onClick={() => !isDisabled && handleNotOkClick(item)} className={`w-6 h-6 mx-auto rounded border-2 flex items-center justify-center transition-all ${isDisabled ? 'cursor-not-allowed border-gray-200 bg-gray-100' : 'cursor-pointer'} ${hasReport && !isDisabled ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 bg-white hover:border-red-400'}`}>{hasReport && !isDisabled && "✕"}</div></td>
                    <td className="py-4 text-center border-r-2 border-gray-100"><div onClick={() => !isDisabled && !hasReport && handleNAClick(item)} className={`w-6 h-6 mx-auto rounded border-2 flex items-center justify-center transition-all text-xs font-bold ${isDisabled ? 'cursor-not-allowed border-gray-200 bg-gray-100' : 'cursor-pointer hover:border-blue-400'} ${item.IsNA && !hasReport && !isDisabled ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-white text-gray-500'} ${hasReport ? 'opacity-20 cursor-not-allowed' : ''}`}>{item.IsNA && !hasReport && !isDisabled && "NA"}</div></td>
                    <td className="py-4 text-center border-l-2 border-gray-50 bg-gray-50/30"><input type="checkbox" checked={item.IsHoliday || false} readOnly disabled className="w-5 h-5 accent-orange-600 cursor-not-allowed opacity-70" /></td>
                    <td className="py-4 text-center border-l-2 border-gray-50 bg-gray-50/30"><input type="checkbox" checked={item.IsVatCleaning || false} readOnly disabled className="w-5 h-5 accent-blue-600 cursor-not-allowed opacity-70" /></td>
                    <td className="py-4 text-center border-l-2 border-gray-50 bg-gray-50/30"><input type="checkbox" checked={item.IsPreventiveMaintenance || false} readOnly disabled className="w-5 h-5 accent-purple-600 cursor-not-allowed opacity-70" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div id="checklist-footer" className="bg-slate-100 p-8 border-t border-gray-200 flex justify-between gap-6 rounded-b-2xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div className="flex flex-col gap-4 w-full md:w-1/2">
            <div className="w-full md:w-3/4">
              <label className="text-[11px] font-black text-gray-600 uppercase block mb-1">Assign Supervisor {(isGlobalHoliday || isGlobalVatCleaning || isGlobalPrevMaint) && <span className="text-gray-400 lowercase font-normal">(Optional)</span>}</label>
              <SearchableSelect options={supervisors} displayKey="OperatorName" value={headerData.supervisorName} onSelect={(op) => setHeaderData(prev => ({ ...prev, supervisorName: op.OperatorName }))} placeholder={isGlobalHoliday || isGlobalVatCleaning || isGlobalPrevMaint ? "Not Required" : "Select Supervisor..."} />
            </div>
            <div className="w-full md:w-3/4">
              <label className="text-[11px] font-black text-gray-600 uppercase block mb-1">Assign to HOF (Month End) {(isGlobalHoliday || isGlobalVatCleaning || isGlobalPrevMaint) && <span className="text-gray-400 lowercase font-normal">(Optional)</span>}</label>
              <SearchableSelect options={hofs} displayKey="OperatorName" value={headerData.assignedHOF} onSelect={(op) => setHeaderData(prev => ({ ...prev, assignedHOF: op.OperatorName }))} placeholder={isGlobalHoliday || isGlobalVatCleaning || isGlobalPrevMaint ? "Not Required" : "Select HOF..."} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-4 w-full md:w-1/2 justify-end">
            <div className="flex gap-4">
              <button onClick={generatePDF} className="bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-200 font-bold py-3 px-6 rounded-lg shadow-md uppercase flex items-center gap-2 mt-auto transition-colors"><FileDown size={20} /> Preview PDF</button>
              <button onClick={handleBatchSubmit} disabled={loading} className="bg-gray-900 hover:bg-blue-600 text-white font-bold py-3 px-10 rounded-lg shadow-lg uppercase mt-auto transition-colors flex items-center gap-3">
                {loading ? <Loader className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}{loading ? 'Saving...' : 'Submit Form'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && modalItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
            <div className="bg-red-600 p-5 flex justify-between items-center text-white">
              <div><h3 className="font-bold uppercase text-sm">Non-Conformance Report</h3><p className="text-xs opacity-80 mt-1">Item #{modalItem.SlNo}</p></div>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-red-700 rounded-full p-1"><X size={24} /></button>
            </div>
            <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
              <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex justify-between"><p className="font-bold text-gray-800">{modalItem.CheckPointDesc}</p><span className="text-[10px] bg-orange-200 text-orange-800 px-2 py-1 rounded font-bold">{ncForm.status}</span></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="col-span-2"><label className="text-xs font-bold text-gray-500 block mb-1">NC Details</label><textarea rows="2" className={inputStyle} value={ncForm.ncDetails} onChange={e => setNcForm({ ...ncForm, ncDetails: e.target.value })} /></div>
                <div><label className="text-xs font-bold text-gray-500 block mb-1">Correction</label><input className={inputStyle} value={ncForm.correction} onChange={e => setNcForm({ ...ncForm, correction: e.target.value })} /></div>
                <div><label className="text-xs font-bold text-gray-500 block mb-1">Root Cause</label><input className={inputStyle} value={ncForm.rootCause} onChange={e => setNcForm({ ...ncForm, rootCause: e.target.value })} /></div>
                <div className="col-span-2"><label className="text-xs font-bold text-gray-500 block mb-1">Corrective Action</label><textarea rows="2" className={inputStyle} value={ncForm.correctiveAction} onChange={e => setNcForm({ ...ncForm, correctiveAction: e.target.value })} /></div>
                <div className="col-span-1"><SearchableSelect label="Responsibility" options={supervisors} displayKey="OperatorName" value={ncForm.responsibility} onSelect={(op) => setNcForm(prev => ({ ...prev, responsibility: op.OperatorName }))} /></div>
                <div className="col-span-1"><label className="text-xs font-bold text-gray-500 block mb-1">Target Date</label><input type="date" className={inputStyle} value={ncForm.targetDate} onChange={e => setNcForm({ ...ncForm, targetDate: e.target.value })} /></div>
              </div>
              <div className="pt-4 border-t border-gray-100"><button onClick={submitReport} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg uppercase shadow-lg transition-colors">Save Report</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BottomLevelAudit;