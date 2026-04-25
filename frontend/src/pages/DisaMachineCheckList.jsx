import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, CheckCircle, AlertTriangle, FileDown, Loader, Save } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Header from '../components/Header';
import logo from '../Assets/logo.png'; 

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

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
  if (now.getHours() < 7) now.setDate(now.getDate() - 1);
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const DisaMachineCheckList = () => {
  const [checklist, setChecklist] = useState([]);
  const [operators, setOperators] = useState([]);
  const [supervisors, setSupervisors] = useState([]); 
  const [reportsMap, setReportsMap] = useState({});
  const [headerData, setHeaderData] = useState({
    date: getShiftDate(),
    operatorName: '',
    disaMachine: 'DISA - I'
  });
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState(null);
  const [ncForm, setNcForm] = useState({ ncDetails: '', correction: '', rootCause: '', correctiveAction: '', targetDate: new Date().toISOString().split('T')[0], responsibility: '', sign: '', status: 'Pending' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchData(); }, [headerData.date, headerData.disaMachine]);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/disa-checklist/details`, {
        params: { date: headerData.date, disaMachine: headerData.disaMachine }
      });
      setOperators(res.data.operators || []);
      setSupervisors(res.data.supervisors || []); 
      let foundHOD = '';
      const mergedList = res.data.checklist.map(item => {
        if (item.AssignedHOD) foundHOD = item.AssignedHOD;
        return {
          ...item,
          IsDone: item.IsDone === true || item.IsDone == 1,
          IsHoliday: item.IsHoliday === true || item.IsHoliday == 1,
          IsVatCleaning: item.IsVatCleaning === true || item.IsVatCleaning == 1,
          IsPreventiveMaintenance: item.IsPreventiveMaintenance === true || item.IsPreventiveMaintenance == 1,
          ReadingValue: item.ReadingValue || ''
        };
      });
      setChecklist(mergedList);
      setHeaderData(prev => ({ ...prev, operatorName: foundHOD }));
      const reportsObj = {};
      res.data.reports.forEach(r => { reportsObj[r.MasterId] = r; });
      setReportsMap(reportsObj);
    } catch (error) {
      setNotification({ show: true, type: 'error', message: "Failed to load data." });
    }
  };

  const isGlobalHoliday = checklist.length > 0 && checklist.every(i => i.IsHoliday);
  const isGlobalVatCleaning = checklist.length > 0 && checklist.every(i => i.IsVatCleaning);
  const isGlobalPrevMaint = checklist.length > 0 && checklist.every(i => i.IsPreventiveMaintenance);

  const handleOkClick = (item) => {
    setChecklist(prev => prev.map(c => c.MasterId === item.MasterId ? { ...c, IsDone: !c.IsDone } : c));
  };

  const handleReadingChange = (id, value) => {
    setChecklist(prev => prev.map(c =>
      c.MasterId === id ? { ...c, ReadingValue: value, IsDone: value !== '' } : c
    ));
  };

  const handleNotOkClick = (item) => {
    if (!headerData.operatorName && !(isGlobalHoliday || isGlobalVatCleaning || isGlobalPrevMaint)) {
      document.getElementById('checklist-footer')?.scrollIntoView({ behavior: 'smooth' });
      return setNotification({ show: true, type: 'error', message: 'Please select the HOD Name at the bottom before adding NCR.' });
    }
    setModalItem(item);
    const existingReport = reportsMap[item.MasterId];
    if (existingReport) {
      setNcForm({ 
        ncDetails: existingReport.NonConformityDetails, 
        correction: existingReport.Correction, 
        rootCause: existingReport.RootCause, 
        correctiveAction: existingReport.CorrectiveAction, 
        targetDate: existingReport.TargetDate ? existingReport.TargetDate.split('T')[0] : headerData.date, 
        responsibility: existingReport.Responsibility, 
        sign: existingReport.Sign, 
        status: existingReport.Status 
      });
    } else {
      setNcForm({ 
        ncDetails: '', correction: '', rootCause: '', correctiveAction: '', 
        targetDate: headerData.date, responsibility: '', sign: headerData.operatorName || 'N/A', status: 'Pending' 
      });
    }
    setIsModalOpen(true);
  };

  const handleMasterHolidayToggle = (checked) => {
    setChecklist(prev => prev.map(c => ({
      ...c, IsHoliday: checked, IsVatCleaning: false, IsPreventiveMaintenance: false, IsDone: false, ReadingValue: checked ? '' : c.ReadingValue
    })));
  };

  const handleMasterVatToggle = (checked) => {
    setChecklist(prev => prev.map(c => ({
      ...c, IsVatCleaning: checked, IsHoliday: false, IsPreventiveMaintenance: false, IsDone: false, ReadingValue: checked ? '' : c.ReadingValue
    })));
  };

  const handleMasterPrevMaintToggle = (checked) => {
    setChecklist(prev => prev.map(c => ({
      ...c, IsPreventiveMaintenance: checked, IsHoliday: false, IsVatCleaning: false, IsDone: false, ReadingValue: checked ? '' : c.ReadingValue
    })));
  };

  const submitReport = async () => {
    if (!ncForm.ncDetails || !ncForm.correction || !ncForm.rootCause || !ncForm.correctiveAction || !ncForm.responsibility) {
      return setNotification({ show: true, type: 'error', message: "Please fill all input fields." });
    }
    try {
      await axios.post(`${API_BASE}/disa-checklist/report-nc`, {
        checklistId: modalItem.MasterId, slNo: modalItem.SlNo, reportDate: headerData.date, disaMachine: headerData.disaMachine, ...ncForm
      });
      setNotification({ show: true, type: 'success', message: 'Report Logged Successfully.' });
      setIsModalOpen(false);
      setReportsMap(prev => ({ 
        ...prev, 
        [modalItem.MasterId]: { ...ncForm, MasterId: modalItem.MasterId, Status: ncForm.status, Name: ncForm.sign } 
      }));
      setChecklist(prev => prev.map(c => c.MasterId === modalItem.MasterId ? { ...c, IsDone: false, ReadingValue: '' } : c));
    } catch (error) { 
      setNotification({ show: true, type: 'error', message: 'Failed to save report.' }); 
    }
  };

  const handleBatchSubmit = async () => {
    if (!isGlobalHoliday && !isGlobalVatCleaning && !isGlobalPrevMaint) {
      if (!headerData.operatorName) {
        document.getElementById('checklist-footer')?.scrollIntoView({ behavior: 'smooth' });
        return setNotification({ show: true, type: 'error', message: 'Please select a HOD to verify this form.' });
      }
    }
    const pendingItems = checklist.filter(item => !item.IsDone && !item.IsHoliday && !item.IsVatCleaning && !item.IsPreventiveMaintenance && !reportsMap[item.MasterId]);
    if (pendingItems.length > 0) return setNotification({ show: true, type: 'error', message: `Cannot submit. ${pendingItems.length} items are unchecked.` });

    setLoading(true);
    try {
      const itemsToSave = checklist.map(item => ({
        MasterId: item.MasterId, IsDone: item.IsDone, IsHoliday: item.IsHoliday, IsVatCleaning: item.IsVatCleaning, IsPreventiveMaintenance: item.IsPreventiveMaintenance, ReadingValue: item.ReadingValue || ''
      }));
      await axios.post(`${API_BASE}/disa-checklist/submit-batch`, {
        items: itemsToSave,
        sign: headerData.operatorName || '',
        operatorSignature: "APPROVED",
        date: headerData.date,
        disaMachine: headerData.disaMachine
      });
      setNotification({ show: true, type: 'success', message: 'Sent to HOD Successfully!' });
      fetchData();
    } catch (error) {
      setNotification({ show: true, type: 'error', message: 'Submit failed.' });
    } finally {
      setLoading(false);
    }
  };

  // Replace your existing generatePDF function inside DisaMachineCheckList with this updated one:

  const generatePDF = async () => {
    setNotification({ show: true, type: 'loading', message: 'Generating PDF...' });
    try {
      const selectedDate = new Date(headerData.date);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;
      let monthlyLogs = [], ncReports = [], qfHistory = []; 

      try {
        const res = await axios.get(`${API_BASE}/disa-checklist/monthly-report`, {
          params: { month, year, disaMachine: headerData.disaMachine }
        });
        monthlyLogs = res.data.monthlyLogs || [];
        ncReports = res.data.ncReports || [];
        qfHistory = res.data.qfHistory || []; 
      } catch (backendErr) { console.warn(backendErr); }

      let currentPageQfValue = "QF/07/FBP-13, Rev.No:06 dt 08.10.2025";
      const reportDateObj = new Date(year, month - 1, 1);
      for (let qf of qfHistory) {
        if (!qf.date) continue;
        const qfDate = new Date(qf.date);
        qfDate.setHours(0, 0, 0, 0);
        if (qfDate <= reportDateObj) { currentPageQfValue = qf.qfValue; break; }
      }

      const historyMap = {}, opSigMap = {}, hodSigMap = {};
      const holidayDays = new Set(), vatDays = new Set(), prevMaintDays = new Set();

      monthlyLogs.forEach(log => {
        const logDay = log.DayVal;
        const key = String(log.MasterId);
        const isHol = log.IsHoliday == 1 || log.IsHoliday === true;
        const isVat = log.IsVatCleaning == 1 || log.IsVatCleaning === true;
        const isPM = log.IsPreventiveMaintenance == 1 || log.IsPreventiveMaintenance === true;

        if (isHol) holidayDays.add(logDay);
        else if (isVat) vatDays.add(logDay);
        else if (isPM) prevMaintDays.add(logDay);

        if (log.OperatorSignature) opSigMap[logDay] = log.OperatorSignature;
        if (log.HODSignature) hodSigMap[logDay] = log.HODSignature;

        if (!historyMap[key]) historyMap[key] = {};
        if (isHol || isVat || isPM) historyMap[key][logDay] = '';
        else if (log.ReadingValue) historyMap[key][logDay] = log.ReadingValue;
        else historyMap[key][logDay] = (log.IsDone == 1 || log.IsDone === true) ? 'Y' : 'N';
      });

      const doc = new jsPDF('l', 'mm', 'a4');
      const monthName = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });

      doc.setLineWidth(0.3);
      doc.rect(10, 10, 40, 20);
      try { doc.addImage(logo, 'PNG', 12, 11, 36, 18); } catch (e) {
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text("SAKTHI AUTO", 30, 20, { align: 'center' });
      }

      doc.rect(50, 10, 180, 20);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text("DISA MACHINE OPERATOR CHECK SHEET", 140, 22, { align: 'center' });

      doc.rect(230, 10, 57, 20);
      doc.setFontSize(11); doc.text(headerData.disaMachine, 258.5, 16, { align: 'center' });
      doc.line(230, 20, 287, 20);
      doc.setFontSize(10); doc.text(`Month: ${monthName}`, 258.5, 26, { align: 'center' });

      const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());
      const tableBody = checklist.map((item, rowIndex) => {
        const row = [String(item.SlNo), item.CheckPointDesc, item.CheckMethod];
        for (let i = 1; i <= 31; i++) {
          if (holidayDays.has(i)) {
            if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } });
          } else if (vatDays.has(i)) {
            if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } });
          } else if (prevMaintDays.has(i)) {
            if (rowIndex === 0) row.push({ content: 'P\nR\nE\nV\nE\nN\nT\nI\nV\nE\n\nM\nA\nI\nN\nT', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [243, 232, 255], fontStyle: 'bold', textColor: [126, 34, 206], fontSize: 4.5 } });
          } else row.push(historyMap[String(item.MasterId)]?.[i] || '');
        }
        return row;
      });

      const opSigRow = ["", "OPERATOR SIGN", "", ...Array(31).fill("")];
      const hodSigRow = ["", "HOD - MOU SIGN", "", ...Array(31).fill("")];

      autoTable(doc, {
        startY: 35,
        head: [[{ content: 'Sl.No', styles: { halign: 'center', valign: 'middle' } }, { content: 'CHECK POINTS', styles: { halign: 'center', valign: 'middle' } }, { content: 'CHECK METHOD', styles: { halign: 'center', valign: 'middle' } }, ...days.map(d => ({ content: d, styles: { halign: 'center' } }))]],
        body: [...tableBody, opSigRow, hodSigRow],
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 0.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 60 }, 2: { cellWidth: 25 }, ...Object.fromEntries(Array.from({length:31}, (_,i)=>[i+3, {cellWidth:5, halign:'center'}])) },
        didDrawCell: (data) => {
          if (data.row.index >= tableBody.length && data.column.index > 2) {
            const dayIndex = data.column.index - 2;
            const isOpRow = data.row.index === tableBody.length;
            const sigData = isOpRow ? opSigMap[dayIndex] : hodSigMap[dayIndex];

            if (sigData && String(sigData).trim().toUpperCase() === "APPROVED") {
              doc.setDrawColor(0, 128, 0); doc.setLineWidth(0.3);
              const startX = data.cell.x + 1.2;
              const midY = data.cell.y + 4;
              doc.line(startX, midY, startX + 1, midY + 1.2);
              doc.line(startX + 1, midY + 1.2, startX + 2.8, midY - 1.5);
              doc.setDrawColor(0, 0, 0);
            } else if (sigData && String(sigData).startsWith('data:image')) {
              try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch (e) {}
            }
          }
        },
        didParseCell: (data) => {
          if (data.row.index >= tableBody.length && data.column.index > 2) {
            data.cell.text = ['']; data.cell.styles.minCellHeight = 8;
          }
          if (data.column.index > 2 && data.row.index < tableBody.length) {
            const text = data.cell.text[0];
            if (text === 'Y') { data.cell.styles.font = 'ZapfDingbats'; data.cell.text = '3'; data.cell.styles.textColor = [0, 100, 0]; }
            else if (text === 'N') { data.cell.text = 'X'; data.cell.styles.textColor = [255, 0, 0]; data.cell.styles.fontStyle = 'bold'; }
          }
        }
      });

      doc.setFontSize(8); doc.text(currentPageQfValue, 10, 200); doc.text("Page 1 of 2", 270, 200);
      doc.addPage();
      doc.rect(10, 10, 40, 20); doc.rect(50, 10, 237, 20);
      doc.setFontSize(16); doc.text("DISA MACHINE OPERATOR CHECK SHEET", 168.5, 18, { align: 'center' });
      doc.setFontSize(14); doc.text("Non-Conformance Report", 168.5, 26, { align: 'center' });

      const ncRows = ncReports.map((r, i) => [i + 1, new Date(r.ReportDate).toLocaleDateString('en-GB'), r.NonConformityDetails, r.Correction, r.RootCause, r.CorrectiveAction, r.TargetDate ? new Date(r.TargetDate).toLocaleDateString('en-GB') : '', r.Responsibility, '', r.Status]);
      while (ncRows.length < 5) ncRows.push(Array(10).fill(''));

      autoTable(doc, {
        startY: 35,
        head: [['S.No', 'Date', 'Details', 'Correction', 'Root Cause', 'Action', 'Target', 'Resp', 'Signature', 'Status']],
        body: ncRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, valign: 'top' },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 8) {
            const sig = ncReports[data.row.index]?.SupervisorSignature || ncReports[data.row.index]?.Sign;
            if (sig && String(sig).trim().toUpperCase() === "APPROVED") {
              // Draw rightmark + APPROVED text
              doc.setDrawColor(0, 128, 0); doc.setLineWidth(0.5);
              doc.line(data.cell.x + 2, data.cell.y + 4, data.cell.x + 4, data.cell.y + 6);
              doc.line(data.cell.x + 4, data.cell.y + 6, data.cell.x + 8, data.cell.y + 2);
              doc.setDrawColor(0, 0, 0);
              
              doc.setFontSize(5);
              doc.setTextColor(0, 128, 0);
              doc.text("APPROVED", data.cell.x + 9, data.cell.y + 5);
              doc.setTextColor(0, 0, 0); // reset
            }
          }
        }
      });
      doc.save(`Disa_Checklist_Report_${headerData.date}.pdf`);
      setNotification({ show: false });
    } catch (error) {
      setNotification({ show: true, type: 'error', message: `PDF Error: ${error.message}` });
    }
  };

  const isCompleted = ncForm.status === 'Completed';
  const inputStyle = "w-full border-2 border-gray-300 bg-white rounded-lg p-3 text-sm text-gray-900 font-medium focus:border-orange-500 outline-none disabled:bg-gray-100";

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#2d2d2d] py-10 px-4 flex justify-center pb-24">
        <ToastNotification data={notification} onClose={() => setNotification({ ...notification, show: false })} />
        <div className="w-full max-w-6xl bg-white shadow-xl rounded-2xl flex flex-col p-8">
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 uppercase flex items-center justify-center gap-2">
            <span className="text-orange-500">📋</span> Operator Checklist
          </h2>
          <div className="flex justify-end items-center gap-6 mb-8 border-b-2 border-gray-200 pb-4">
            <div className="w-40">
              <label className="font-bold text-gray-700 block mb-1 text-sm">DISA-</label>
              <select value={headerData.disaMachine} onChange={(e) => setHeaderData({ ...headerData, disaMachine: e.target.value })} className="w-full border p-2 rounded text-sm font-semibold">
                {["I", "II", "III", "IV", "V", "VI"].map(num => <option key={num} value={`DISA - ${num}`}>DISA - {num}</option>)}
              </select>
            </div>
            <div className="w-48">
              <label className="font-bold text-gray-700 block mb-1 text-sm">DATE :</label>
              <input type="date" value={headerData.date} onChange={(e) => setHeaderData({ ...headerData, date: e.target.value })} className="w-full border p-2 rounded text-sm font-semibold" />
            </div>
          </div>
          <div className="overflow-x-auto min-h-[500px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b-2 border-orange-100">
                  <th className="py-3 pl-2 w-12">#</th>
                  <th className="py-3 w-1/3">Check Point</th>
                  <th className="py-3">Method</th>
                  <th className="py-3 text-center w-24">OK / Value</th>
                  <th className="py-3 text-center w-20">Not OK</th>
                  <th className="py-3 text-center w-20 ">Holiday<br /><input type="checkbox" checked={isGlobalHoliday} onChange={(e) => handleMasterHolidayToggle(e.target.checked)} className="w-4 h-4 mt-2" /></th>
                  <th className="py-3 text-center w-24 border-l-2 bg-gray-50">VAT Cleaning<br /><input type="checkbox" checked={isGlobalVatCleaning} onChange={(e) => handleMasterVatToggle(e.target.checked)} className="w-4 h-4 mt-2" /></th>
                  <th className="py-3 text-center w-24 border-l-2 bg-gray-50">Prev Maint<br /><input type="checkbox" checked={isGlobalPrevMaint} onChange={(e) => handleMasterPrevMaintToggle(e.target.checked)} className="w-4 h-4 mt-2" /></th>
                </tr>
              </thead>
              <tbody>
                {checklist.map((item) => {
                  const hasReport = !!reportsMap[item.MasterId];
                  const isDisabled = item.IsHoliday || item.IsVatCleaning || item.IsPreventiveMaintenance;
                  const isDecimalRow = [1, 2, 17].includes(item.SlNo);
                  return (
                    <tr key={item.MasterId} className={`border-b transition-colors ${hasReport ? 'bg-red-50' : isDisabled ? 'bg-gray-50 opacity-60' : 'hover:bg-orange-50/20'}`}>
                      <td className="py-4 pl-2 font-bold text-gray-400">{item.SlNo}</td>
                      <td className={`py-4 font-bold text-sm ${isDisabled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.CheckPointDesc}</td>
                      <td className="py-4"><span className="bg-white border text-[10px] font-bold px-2 py-1 rounded uppercase text-gray-600">{item.CheckMethod}</span></td>
                      <td className="py-4 text-center">
                        {isDecimalRow ? (
                          <input type="text" value={item.ReadingValue} onChange={(e) => handleReadingChange(item.MasterId, e.target.value)} disabled={isDisabled || hasReport} className="w-32 text-center border-2 rounded text-xs font-bold py-1" />
                        ) : (
                          <div onClick={() => !isDisabled && !hasReport && handleOkClick(item)} className={`w-6 h-6 mx-auto rounded border-2 flex items-center justify-center ${item.IsDone && !hasReport && !isDisabled ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 bg-white'}`}>{item.IsDone && !hasReport && !isDisabled && "✓"}</div>
                        )}
                      </td>
                      <td className="py-4 text-center">
                        <div onClick={() => !isDisabled && handleNotOkClick(item)} className={`w-6 h-6 mx-auto rounded border-2 flex items-center justify-center ${hasReport && !isDisabled ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 bg-white'}`}>{hasReport && !isDisabled && "✕"}</div>
                      </td>
                      <td className="py-4 text-center bg-gray-50/30"><input type="checkbox" checked={item.IsHoliday} readOnly disabled className="w-5 h-5" /></td>
                      <td className="py-4 text-center bg-gray-50/30"><input type="checkbox" checked={item.IsVatCleaning} readOnly disabled className="w-5 h-5" /></td>
                      <td className="py-4 text-center bg-gray-50/30"><input type="checkbox" checked={item.IsPreventiveMaintenance} readOnly disabled className="w-5 h-5" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div id="checklist-footer" className="bg-slate-100 p-8 border-t flex flex-col md:flex-row justify-between items-center gap-6 rounded-b-2xl mt-4">
            <div className="w-full md:w-1/3">
              <label className="text-[11px] font-black text-gray-600 uppercase block mb-1">Verify HOD</label>
              <SearchableSelect options={operators} displayKey="OperatorName" value={headerData.operatorName} onSelect={(op) => setHeaderData(prev => ({ ...prev, operatorName: op.OperatorName }))} placeholder="Select HOD..." />
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button onClick={generatePDF} className="bg-white border-2 border-gray-900 text-gray-900 font-bold py-3 px-6 rounded-lg flex items-center gap-2 transition-colors hover:bg-gray-100">
                <FileDown size={20} /> Preview PDF
              </button>
              <button onClick={handleBatchSubmit} disabled={loading} className="bg-gray-900 hover:bg-orange-600 text-white font-bold py-3 px-10 rounded-lg flex items-center gap-3 transition-colors">
                {loading ? <Loader className="animate-spin" /> : <Save />} {loading ? 'Saving...' : 'Sign & Submit'}
              </button>
            </div>
          </div>
        </div>

        {isModalOpen && modalItem && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl">
              <div className={`p-5 flex justify-between items-center text-white ${isCompleted ? 'bg-green-600' : 'bg-red-600'}`}>
                <div><h3 className="font-bold uppercase text-sm">NCR</h3><p className="text-xs opacity-80">Item #{modalItem.SlNo}</p></div>
                <button onClick={() => setIsModalOpen(false)}><X size={24} /></button>
              </div>
              <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto">
                <div className={`p-4 rounded-lg border font-bold ${isCompleted ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>{modalItem.CheckPointDesc}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2"><label className="text-xs font-bold text-gray-500">Details</label><textarea className={inputStyle} disabled={isCompleted} value={ncForm.ncDetails} onChange={e => setNcForm({ ...ncForm, ncDetails: e.target.value })} /></div>
                  <div><label className="text-xs font-bold text-gray-500">Correction</label><input className={inputStyle} disabled={isCompleted} value={ncForm.correction} onChange={e => setNcForm({ ...ncForm, correction: e.target.value })} /></div>
                  <div><label className="text-xs font-bold text-gray-500">Root Cause</label><input className={inputStyle} disabled={isCompleted} value={ncForm.rootCause} onChange={e => setNcForm({ ...ncForm, rootCause: e.target.value })} /></div>
                  <div className="col-span-2"><label className="text-xs font-bold text-gray-500">Action</label><textarea className={inputStyle} disabled={isCompleted} value={ncForm.correctiveAction} onChange={e => setNcForm({ ...ncForm, correctiveAction: e.target.value })} /></div>
                  <div><label className="text-xs font-bold text-gray-500">Resp</label><SearchableSelect options={supervisors} displayKey="OperatorName" value={ncForm.responsibility} onSelect={(op) => setNcForm(prev => ({ ...prev, responsibility: op.OperatorName }))} /></div>
                  <div><label className="text-xs font-bold text-gray-500">Date</label><input type="date" className={inputStyle} disabled={isCompleted} value={ncForm.targetDate} onChange={e => setNcForm({ ...ncForm, targetDate: e.target.value })} /></div>
                </div>
                {!isCompleted && <button onClick={submitReport} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg">Save Report</button>}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DisaMachineCheckList;