import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, CheckCircle, AlertTriangle, FileDown, Loader, Save } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import SignatureCanvas from 'react-signature-canvas';
import Header from '../components/Header';

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
  if (now.getHours() < 7) {
    now.setDate(now.getDate() - 1);
  }
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const DisaMachineCheckList = () => {
  const [checklist, setChecklist] = useState([]);
  const [operators, setOperators] = useState([]);
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
  const operatorSigPad = useRef({});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, [headerData.date, headerData.disaMachine]);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/disa-checklist/details`, {
        params: { date: headerData.date, disaMachine: headerData.disaMachine }
      });

      setOperators(res.data.operators);

      let foundHOD = '';
      let foundOpSig = '';

      const mergedList = res.data.checklist.map(item => {
        if (item.AssignedHOD) foundHOD = item.AssignedHOD;
        if (item.OperatorSignature) foundOpSig = item.OperatorSignature;

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
      if (foundOpSig && operatorSigPad.current) {
        operatorSigPad.current.fromDataURL(foundOpSig);
      } else if (operatorSigPad.current) {
        operatorSigPad.current.clear();
      }

      const reportsObj = {};
      res.data.reports.forEach(r => { reportsObj[r.MasterId] = r; });
      setReportsMap(reportsObj);

    } catch (error) {
      console.error("Fetch Error:", error);
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
    setModalItem(item);
    const existingReport = reportsMap[item.MasterId];
    if (existingReport) {
      setNcForm({ ncDetails: existingReport.NonConformityDetails, correction: existingReport.Correction, rootCause: existingReport.RootCause, correctiveAction: existingReport.CorrectiveAction, targetDate: existingReport.TargetDate.split('T')[0], responsibility: existingReport.Responsibility, sign: existingReport.Sign, status: existingReport.Status });
    } else {
      setNcForm({ ncDetails: '', correction: '', rootCause: '', correctiveAction: '', targetDate: headerData.date, responsibility: '', sign: '', status: 'Pending' });
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
    if (!ncForm.ncDetails || !ncForm.responsibility) return setNotification({ show: true, type: 'error', message: 'Details and Responsibility are mandatory.' });
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/disa-checklist/report-nc`, {
        checklistId: modalItem.MasterId, slNo: modalItem.SlNo, reportDate: headerData.date, disaMachine: headerData.disaMachine, ...ncForm
      });
      setNotification({ show: true, type: 'success', message: 'Report Logged Successfully.' });
      setIsModalOpen(false);
      setReportsMap(prev => ({ ...prev, [modalItem.MasterId]: { ...ncForm, MasterId: modalItem.MasterId, Status: 'Pending', Name: ncForm.sign } }));
      setChecklist(prev => prev.map(c => c.MasterId === modalItem.MasterId ? { ...c, IsDone: false, ReadingValue: '' } : c));
    } catch (error) { setNotification({ show: true, type: 'error', message: 'Failed to save report.' }); }
  };

  const handleBatchSubmit = async () => {
    if (!isGlobalHoliday && !isGlobalVatCleaning && !isGlobalPrevMaint) {
      if (!headerData.operatorName) {
        document.getElementById('checklist-footer')?.scrollIntoView({ behavior: 'smooth' });
        return setNotification({ show: true, type: 'error', message: 'Please select a HOD to verify this form.' });
      }
      if (operatorSigPad.current && operatorSigPad.current.isEmpty()) {
        document.getElementById('checklist-footer')?.scrollIntoView({ behavior: 'smooth' });
        return setNotification({ show: true, type: 'error', message: 'Please sign the document before submitting.' });
      }
    }

    const pendingItems = checklist.filter(item => !item.IsDone && !item.IsHoliday && !item.IsVatCleaning && !item.IsPreventiveMaintenance && !reportsMap[item.MasterId]);
    if (pendingItems.length > 0) return setNotification({ show: true, type: 'error', message: `Cannot submit. ${pendingItems.length} items are unchecked.` });

    setLoading(true);
    try {
      let sigData = '';
      if (operatorSigPad.current && !operatorSigPad.current.isEmpty()) {
        sigData = operatorSigPad.current.getCanvas().toDataURL('image/png');
      }

      const itemsToSave = checklist.map(item => ({
        MasterId: item.MasterId, IsDone: item.IsDone, IsHoliday: item.IsHoliday, IsVatCleaning: item.IsVatCleaning, IsPreventiveMaintenance: item.IsPreventiveMaintenance, ReadingValue: item.ReadingValue || ''
      }));

      await axios.post(`${process.env.REACT_APP_API_URL}/api/disa-checklist/submit-batch`, {
        items: itemsToSave,
        sign: headerData.operatorName || '',
        operatorSignature: sigData,
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

  const generatePDF = async () => {
    setNotification({ show: true, type: 'loading', message: 'Generating PDF...' });

    try {
      const selectedDate = new Date(headerData.date);
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth() + 1;

      let monthlyLogs = [];
      let ncReports = [];

      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/disa-checklist/monthly-report`, {
          params: { month, year, disaMachine: headerData.disaMachine }
        });
        monthlyLogs = res.data.monthlyLogs || [];
        ncReports = res.data.ncReports || [];
      } catch (backendErr) { console.warn(backendErr); }

      const historyMap = {};
      const holidayDays = new Set();
      const vatDays = new Set();
      const prevMaintDays = new Set();

      const opSigMap = {};
      const hodSigMap = {};

      monthlyLogs.forEach(log => {
        const logDay = log.DayVal;
        const key = String(log.MasterId);

        const isHol = log.IsHoliday == 1 || log.IsHoliday === true || String(log.IsHoliday) === '1';
        const isVat = log.IsVatCleaning == 1 || log.IsVatCleaning === true || String(log.IsVatCleaning) === '1';
        const isPM = log.IsPreventiveMaintenance == 1 || log.IsPreventiveMaintenance === true || String(log.IsPreventiveMaintenance) === '1';

        if (isHol) holidayDays.add(logDay);
        else if (isVat) vatDays.add(logDay);
        else if (isPM) prevMaintDays.add(logDay);

        if (log.OperatorSignature) opSigMap[logDay] = log.OperatorSignature;
        if (log.HODSignature) hodSigMap[logDay] = log.HODSignature;

        if (!historyMap[key]) historyMap[key] = {};

        // Block text/readings on special days
        if (isHol || isVat || isPM) {
          historyMap[key][logDay] = '';
        } else if (log.ReadingValue) {
          historyMap[key][logDay] = log.ReadingValue;
        } else {
          if (log.IsDone == 1 || log.IsDone === true) historyMap[key][logDay] = 'Y';
          else historyMap[key][logDay] = 'N';
        }
      });

      const doc = new jsPDF('l', 'mm', 'a4');
      const monthName = selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' });

      doc.setLineWidth(0.3);
      doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
      doc.rect(50, 10, 180, 20); doc.setFontSize(16);
      doc.text("DISA MACHINE OPERATOR CHECK SHEET", 140, 22, { align: 'center' });
      doc.rect(230, 10, 57, 20); doc.setFontSize(11);
      doc.text(headerData.disaMachine, 258, 18, { align: 'center' });
      doc.line(230, 22, 287, 22);
      doc.setFontSize(10); doc.text(`Month: ${monthName}`, 235, 27);

      const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

      const tableBody = checklist.map((item, rowIndex) => {
        const row = [String(item.SlNo), item.CheckPointDesc, item.CheckMethod];

        for (let i = 1; i <= 31; i++) {
          if (holidayDays.has(i)) {
            if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } });
          } else if (vatDays.has(i)) {
            if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } });
          } else if (prevMaintDays.has(i)) {
            if (rowIndex === 0) row.push({
              content: 'P\nR\nE\nV\nE\nN\nT\nI\nV\nE\n\nM\nA\nI\nN\nT\nE\nN\nA\nN\nC\nE',
              rowSpan: checklist.length,
              styles: { halign: 'center', valign: 'middle', fillColor: [243, 232, 255], fontStyle: 'bold', textColor: [126, 34, 206], fontSize: 4.5 }
            });
          } else {
            const key = String(item.MasterId);
            row.push(historyMap[key]?.[i] || '');
          }
        }
        return row;
      });

      const opSigRow = ["", "OPERATOR SIGN", ""];
      const hodSigRow = ["", "HOD - MOU SIGN", ""];

      for (let i = 1; i <= 31; i++) {
        opSigRow.push(opSigMap[i] ? "SIG" : "");
        hodSigRow.push(hodSigMap[i] ? "SIG" : "");
      }

      const footerRows = [opSigRow, hodSigRow];

      const dynamicColumnStyles = {};
      for (let i = 3; i < 34; i++) {
        dynamicColumnStyles[i] = { cellWidth: 5, halign: 'center' };
      }

      autoTable(doc, {
        startY: 35,
        head: [[
          { content: 'Sl.No', styles: { halign: 'center', valign: 'middle' } },
          { content: 'CHECK POINTS', styles: { halign: 'center', valign: 'middle' } },
          { content: 'CHECK METHOD', styles: { halign: 'center', valign: 'middle' } },
          ...days.map(d => ({ content: d, styles: { halign: 'center' } }))
        ]],
        body: [...tableBody, ...footerRows],
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 0.5, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 60 }, 2: { cellWidth: 25 }, ...dynamicColumnStyles },

        didDrawCell: function (data) {
          if (data.row.index >= tableBody.length && data.column.index > 2) {
            const dayIndex = data.column.index - 2;

            if (data.cell.text[0] === 'SIG') {
              const isOpRow = data.row.index === tableBody.length;
              const sigData = isOpRow ? opSigMap[dayIndex] : hodSigMap[dayIndex];

              if (sigData && sigData.startsWith('data:image')) {
                doc.setFillColor(255, 255, 255);
                doc.rect(data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1, 'F');
                try {
                  doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1);
                } catch (e) { }
              }
            }
          }
        },
        didParseCell: function (data) {
          if (data.row.index >= tableBody.length && data.column.index === 1) {
            data.cell.styles.fontStyle = 'bold';
          }

          if (data.column.index > 2 && data.row.index < tableBody.length) {
            const rawTextArray = data.cell.text || [];
            const rawTextString = rawTextArray.join('').replace(/\n/g, '');
            const text = rawTextArray[0] ? rawTextArray[0] : '';

            if (text === 'Y') {
              data.cell.styles.font = 'ZapfDingbats';
              data.cell.text = '3';
              data.cell.styles.textColor = [0, 100, 0];
            } else if (text === 'N') {
              data.cell.styles.textColor = [255, 0, 0];
              data.cell.text = 'X';
              data.cell.styles.fontStyle = 'bold';
            } else if (text && !rawTextString.includes('HOLIDAY') && !rawTextString.includes('VATCLEANING') && !rawTextString.includes('PREVENTIVEMAINTENANCE')) {
              data.cell.styles.fontSize = 4;
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.textColor = [0, 0, 0];
              data.cell.styles.halign = 'center';
              data.cell.styles.cellPadding = 0.2;
            }
          }
        }
      });

      const finalY = doc.lastAutoTable.finalY + 6;
      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text("Note: If any deviation noticed during the verification, corrective actions should be taken and recorded in the NCR (back-side).", 10, finalY);
      doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);
      doc.text("Page 1 of 2", 270, 200);

      // PAGE 2
      doc.addPage();
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.rect(10, 10, 40, 20);
      doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' });
      doc.text("AUTO", 30, 26, { align: 'center' });
      doc.rect(50, 10, 237, 20);
      doc.setFontSize(16);
      doc.text("DISA MACHINE OPERATOR CHECK SHEET", 168, 18, { align: 'center' });
      doc.setFontSize(14);
      doc.text("Non-Conformance Report", 168, 26, { align: 'center' });

      const ncRows = ncReports.map((report, index) => [
        index + 1,
        new Date(report.ReportDate).toLocaleDateString('en-GB'),
        report.NonConformityDetails || '',
        report.Correction || '',
        report.RootCause || '',
        report.CorrectiveAction || '',
        report.TargetDate ? new Date(report.TargetDate).toLocaleDateString('en-GB') : '',
        report.Responsibility || '',
        report.Sign || '',
        report.Status || ''
      ]);

      if (ncRows.length === 0) {
        for (let i = 0; i < 5; i++) ncRows.push(['', '', '', '', '', '', '', '', '', '']);
      }

      autoTable(doc, {
        startY: 35,
        head: [['S.No', 'Date', 'Non-Conformities Details', 'Correction', 'Root Cause', 'Corrective Action', 'Target Date', 'Responsibility', 'Name', 'Status']],
        body: ncRows,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'top', overflow: 'linebreak' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 35 }, 4: { cellWidth: 35 }, 5: { cellWidth: 35 }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 25 }, 8: { cellWidth: 20 }, 9: { cellWidth: 20, halign: 'center' } }
      });

      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);
      doc.text("Page 2 of 2", 270, 200);

      doc.save(`Disa_Checklist_Report_${headerData.date}.pdf`);
      setNotification({ show: false });

    } catch (error) {
      console.error("PDF Gen Error:", error);
      setNotification({ show: true, type: 'error', message: `PDF Generation Failed: ${error.message}` });
    }
  };

  const inputStyle = "w-full border-2 border-gray-300 bg-white rounded-lg p-3 text-sm text-gray-900 font-medium focus:border-red-500 outline-none shadow-sm placeholder-gray-500";

  return (
    <>
      <Header />
      <div className="min-h-screen bg-[#2d2d2d] py-10 px-4 flex justify-center pb-24">
        <NotificationModal data={notification} onClose={() => setNotification({ ...notification, show: false })} />

        <div className="w-full max-w-6xl bg-white shadow-xl rounded-2xl flex flex-col p-8">
          
          <h2 className="text-2xl font-bold mb-6 text-center text-gray-800 uppercase tracking-wide flex items-center justify-center gap-2">
            <span className="text-orange-500 text-2xl">📋</span> Operator Checklist
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

          <div className="overflow-x-auto min-h-[500px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-xs text-gray-500 uppercase border-b-2 border-orange-100">
                  <th className="py-3 pl-2 w-12">#</th>
                  <th className="py-3 w-1/3">Check Point</th>
                  <th className="py-3">Method</th>
                  <th className="py-3 text-center w-24">OK / Value</th>
                  <th className="py-3 text-center w-20">Not OK</th>
                  <th className="py-3 text-center w-20 ">
                    Holiday<br />
                    <input type="checkbox" checked={isGlobalHoliday} onChange={(e) => handleMasterHolidayToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-orange-600 cursor-pointer" />
                  </th>
                  <th className="py-3 text-center w-24 border-l-2 border-gray-100 bg-gray-50">
                    VAT Cleaning<br />
                    <input type="checkbox" checked={isGlobalVatCleaning} onChange={(e) => handleMasterVatToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-blue-600 cursor-pointer" />
                  </th>
                  <th className="py-3 text-center w-24 border-l-2 border-gray-100 bg-gray-50 rounded-tr">
                    Preventive Maint<br />
                    <input type="checkbox" checked={isGlobalPrevMaint} onChange={(e) => handleMasterPrevMaintToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-purple-600 cursor-pointer" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {checklist.length === 0 ? <tr><td colSpan="8" className="text-center py-4 text-gray-500">Loading...</td></tr> : checklist.map((item) => {
                  const hasReport = !!reportsMap[item.MasterId];
                  const isHoliday = item.IsHoliday;
                  const isVatCleaning = item.IsVatCleaning;
                  const isPreventiveMaintenance = item.IsPreventiveMaintenance;
                  const isDisabled = isHoliday || isVatCleaning || isPreventiveMaintenance;
                  const isDecimalRow = item.SlNo === 1 || item.SlNo === 2 || item.SlNo === 17;

                  return (
                    <tr key={item.MasterId} className={`border-b border-gray-100 transition-colors ${hasReport ? 'bg-red-50' : isDisabled ? 'bg-gray-50 opacity-60' : 'hover:bg-orange-50/20'}`}>
                      <td className="py-4 pl-2 font-bold text-gray-400">{item.SlNo}</td>
                      <td className={`py-4 font-bold text-sm ${isDisabled ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{item.CheckPointDesc}</td>
                      <td className="py-4"><span className={`bg-white border text-[10px] font-bold px-2 py-1 rounded uppercase ${isDisabled ? 'text-gray-300 border-gray-200' : 'text-gray-600'}`}>{item.CheckMethod}</span></td>

                      <td className="py-4 text-center">
                        {isDecimalRow ? (
                          <input type="number" step="0.01" value={item.ReadingValue || ''} onChange={(e) => handleReadingChange(item.MasterId, e.target.value)} disabled={isDisabled || hasReport} placeholder="0.00" className={`w-16 mx-auto text-center border-2 rounded text-xs font-bold py-1 outline-none transition-colors ${isDisabled || hasReport ? 'bg-gray-100 border-gray-200 cursor-not-allowed text-gray-400' : 'bg-white border-gray-300 focus:border-orange-500 text-gray-900 shadow-inner'}`} />
                        ) : (
                          <div onClick={() => !isDisabled && !hasReport && handleOkClick(item)} className={`w-6 h-6 mx-auto rounded border-2 flex items-center justify-center transition-all ${isDisabled ? 'cursor-not-allowed border-gray-200 bg-gray-100' : 'cursor-pointer'} ${item.IsDone && !hasReport && !isDisabled ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 bg-white'} ${hasReport ? 'opacity-20 cursor-not-allowed' : ''}`}>{item.IsDone && !hasReport && !isDisabled && "✓"}</div>
                        )}
                      </td>

                      <td className="py-4 text-center">
                        <div onClick={() => !isDisabled && handleNotOkClick(item)} className={`w-6 h-6 mx-auto rounded border-2 flex items-center justify-center transition-all ${isDisabled ? 'cursor-not-allowed border-gray-200 bg-gray-100' : 'cursor-pointer'} ${hasReport && !isDisabled ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 bg-white hover:border-red-400'}`}>{hasReport && !isDisabled && "✕"}</div>
                      </td>

                      <td className="py-4 text-center border-l-2 border-gray-50 bg-gray-50/30">
                        <input type="checkbox" checked={isHoliday || false} readOnly disabled className="w-5 h-5 accent-orange-600 cursor-not-allowed opacity-70" />
                      </td>

                      <td className="py-4 text-center border-l-2 border-gray-50 bg-gray-50/30">
                        <input type="checkbox" checked={isVatCleaning || false} readOnly disabled className="w-5 h-5 accent-blue-600 cursor-not-allowed opacity-70" />
                      </td>

                      <td className="py-4 text-center border-l-2 border-gray-50 bg-gray-50/30">
                        <input type="checkbox" checked={isPreventiveMaintenance || false} readOnly disabled className="w-5 h-5 accent-purple-600 cursor-not-allowed opacity-70" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div id="checklist-footer" className="bg-slate-100 p-8 border-t border-gray-200 flex flex-col gap-6 rounded-b-2xl mt-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="flex flex-col md:flex-row justify-between items-start gap-8 w-full">

              {/* LEFT: Operator Signature Pad */}
              <div className="w-full md:w-1/3">
                <label className="text-[11px] font-black text-gray-600 uppercase block mb-1">
                  Operator Signature {(isGlobalHoliday || isGlobalVatCleaning || isGlobalPrevMaint) && <span className="text-gray-400 lowercase font-normal">(Optional)</span>}
                </label>
                <div className="border-2 border-dashed border-gray-400 bg-white rounded-lg w-full h-24 mb-1 overflow-hidden">
                  <SignatureCanvas ref={operatorSigPad} penColor="blue" canvasProps={{ className: 'w-full h-full cursor-crosshair' }} />
                </div>
                <button onClick={() => operatorSigPad.current.clear()} className="text-xs text-red-500 hover:text-red-700 font-bold uppercase tracking-wider">
                  Clear Pad
                </button>
              </div>

              {/* RIGHT: Submit Buttons and HOD dropdown */}
              <div className="flex flex-col items-end gap-4 w-full md:w-2/3">
                <div className="w-full md:w-64">
                  <label className="text-[11px] font-black text-gray-600 uppercase block mb-1">
                    Send to HOD {(isGlobalHoliday || isGlobalVatCleaning || isGlobalPrevMaint) && <span className="text-gray-400 lowercase font-normal">(Optional)</span>}
                  </label>
                  <SearchableSelect options={operators} displayKey="OperatorName" value={headerData.operatorName} onSelect={(op) => setHeaderData(prev => ({ ...prev, operatorName: op.OperatorName }))} placeholder={isGlobalHoliday || isGlobalVatCleaning || isGlobalPrevMaint ? "Not Required" : "Select HOD..."} />
                </div>

                <div className="flex gap-4">
                  <button onClick={generatePDF} className="bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-200 font-bold py-3 px-6 rounded-lg shadow-md uppercase flex items-center gap-2 mt-auto transition-colors">
                    <FileDown size={20} /> Preview PDF
                  </button>
                  <button onClick={handleBatchSubmit} disabled={loading} className="bg-gray-900 hover:bg-orange-600 text-white font-bold py-3 px-10 rounded-lg shadow-lg uppercase mt-auto transition-colors flex items-center gap-3">
                    {loading ? <Loader className="animate-spin w-5 h-5" /> : <Save className="w-5 h-5" />}
                    {loading ? 'Saving...' : 'Sign & Submit to HOD'}
                  </button>
                </div>
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
              <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex justify-between"><p className="font-bold text-gray-800">{modalItem.CheckPointDesc}</p><span className="text-[10px] bg-orange-200 text-orange-800 px-2 py-1 rounded font-bold">{ncForm.status}</span></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-2"><label className="text-xs font-bold text-gray-500 block mb-1">NC Details</label><textarea rows="2" className={inputStyle} value={ncForm.ncDetails} onChange={e => setNcForm({ ...ncForm, ncDetails: e.target.value })} /></div>
                  <div><label className="text-xs font-bold text-gray-500 block mb-1">Correction</label><input className={inputStyle} value={ncForm.correction} onChange={e => setNcForm({ ...ncForm, correction: e.target.value })} /></div>
                  <div><label className="text-xs font-bold text-gray-500 block mb-1">Root Cause</label><input className={inputStyle} value={ncForm.rootCause} onChange={e => setNcForm({ ...ncForm, rootCause: e.target.value })} /></div>
                  <div className="col-span-2"><label className="text-xs font-bold text-gray-500 block mb-1">Corrective Action</label><textarea rows="2" className={inputStyle} value={ncForm.correctiveAction} onChange={e => setNcForm({ ...ncForm, correctiveAction: e.target.value })} /></div>
                  <div className="col-span-1">
                    <SearchableSelect label="Responsibility" options={[{ OperatorName: "Maintenance" }, { OperatorName: "Production" }, { OperatorName: "Quality" }]} displayKey="OperatorName" value={ncForm.responsibility} onSelect={(op) => setNcForm(prev => ({ ...prev, responsibility: op.OperatorName }))} />
                  </div>
                  <div className="col-span-1"><label className="text-xs font-bold text-gray-500 block mb-1">Target Date</label><input type="date" className={inputStyle} value={ncForm.targetDate} onChange={e => setNcForm({ ...ncForm, targetDate: e.target.value })} /></div>
                </div>
                <div className="pt-4 border-t border-gray-100"><button onClick={submitReport} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg uppercase shadow-lg transition-colors">Save Report</button></div>
              </div>
            </div>
          </div>
        )}

        <style dangerouslySetInnerHTML={{
          __html: `
          .custom-scrollbar::-webkit-scrollbar { height: 12px; width: 8px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        `}} />
      </div>
    </>
  );
};

export default DisaMachineCheckList;