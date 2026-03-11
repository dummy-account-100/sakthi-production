import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Header from "../components/Header";
import SignatureCanvas from "react-signature-canvas";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Hof = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const sigCanvas = useRef({});
  
  // States for Error Proof Verification (V1)
  const [errorReports, setErrorReports] = useState([]);
  const [selectedErrorReport, setSelectedErrorReport] = useState(null);
  const [errorPdfUrl, setErrorPdfUrl] = useState(null);
  const [isErrorPdfLoading, setIsErrorPdfLoading] = useState(false);
  const errorSigCanvas = useRef({});

  // States for Error Proof Verification 2 (V2)
  const [errorReportsV2, setErrorReportsV2] = useState([]);
  const [selectedErrorReportV2, setSelectedErrorReportV2] = useState(null);
  const [errorPdfUrlV2, setErrorPdfUrlV2] = useState(null);
  const [isErrorPdfLoadingV2, setIsErrorPdfLoadingV2] = useState(false);
  const errorSigCanvasV2 = useRef({});

  // States for Daily Production Performance
  const [dailyReports, setDailyReports] = useState([]);
  const [selectedDailyReport, setSelectedDailyReport] = useState(null);
  const [dailyPdfUrl, setDailyPdfUrl] = useState(null);
  const [isDailyPdfLoading, setIsDailyPdfLoading] = useState(false);
  const dailySigCanvas = useRef({});

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentHOF = storedUser.username || "hof_user";

  const API_BASE = `${process.env.REACT_APP_API_URL}/api/bottom-level-audit`;
  const ERR_API_BASE = `${process.env.REACT_APP_API_URL}/api/error-proof`;
  const ERR_API_BASE_V2 = `${process.env.REACT_APP_API_URL}/api/error-proof2`; 
  const DAILY_API_BASE = `${process.env.REACT_APP_API_URL}/api/daily-performance`; 

  useEffect(() => {
    fetchReports();
    fetchErrorReports();
    fetchErrorReportsV2(); 
    fetchDailyReports(); 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- EXISTING FETCH FUNCTIONS ---
  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/hof/${currentHOF}`);
      setReports(res.data);
    } catch (err) { toast.error("Failed to load Bottom Level reports."); }
  };

  const fetchErrorReports = async () => {
    try {
      const res = await axios.get(`${ERR_API_BASE}/hof/${currentHOF}`);
      setErrorReports(res.data);
    } catch (err) { toast.error("Failed to load Error Proof reports."); }
  };

  const fetchErrorReportsV2 = async () => {
    try {
      const res = await axios.get(`${ERR_API_BASE_V2}/hof/${currentHOF}`);
      setErrorReportsV2(res.data);
    } catch (err) { toast.error("Failed to load Error Proof V2 reports."); }
  };

  // ===============================================
  //  DAILY PRODUCTION PERFORMANCE LOGIC
  // ===============================================
  const fetchDailyReports = async () => {
    try {
      const res = await axios.get(`${DAILY_API_BASE}/hof/${currentHOF}`);
      setDailyReports(res.data);
    } catch (err) { toast.error("Failed to load Daily Performance reports."); }
  };

  const handleOpenDailyModal = async (report) => {
    setSelectedDailyReport(report); setDailyPdfUrl(null); setIsDailyPdfLoading(true);
    try {
      const dateStr = new Date(report.productionDate).toISOString().split('T')[0];
      const response = await axios.get(`${DAILY_API_BASE}/download-pdf`, { 
        params: { date: dateStr, disa: report.disa }, 
        responseType: 'blob' 
      });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setDailyPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to load Daily Performance PDF."); }
    setIsDailyPdfLoading(false);
  };

  const submitDailySignature = async () => {
    if (dailySigCanvas.current.isEmpty()) { toast.warning("Please provide a signature first."); return; }
    const signatureData = dailySigCanvas.current.getCanvas().toDataURL("image/png");

    try {
      await axios.post(`${DAILY_API_BASE}/sign-hof`, { reportId: selectedDailyReport.id, signature: signatureData });
      toast.success("Daily Performance Report signed!");
      setSelectedDailyReport(null); fetchDailyReports(); 
    } catch (err) { toast.error("Failed to save Daily Performance signature."); }
  };


  // --- EXISTING MODAL LOGIC (Bottom Level, Error V1, Error V2) ---
  const handleOpenSignModal = async (report) => {
    setSelectedReport(report); setPdfUrl(null); setIsPdfLoading(true);
    try {
      const month = report.month; const year = report.year; const disaMachine = report.disa;
      const monthlyRes = await axios.get(`${API_BASE}/monthly-report`, { params: { month, year, disaMachine } });
      const monthlyLogs = monthlyRes.data.monthlyLogs || [];
      const ncReports = monthlyRes.data.ncReports || [];
      const todayStr = new Date().toISOString().split('T')[0];
      const detailsRes = await axios.get(`${API_BASE}/details`, { params: { date: todayStr, disaMachine } });
      const checklist = detailsRes.data.checklist;
      
      // 🔥 FIX: Added pmDays Set here
      const historyMap = {}; const holidayDays = new Set(); const vatDays = new Set(); const pmDays = new Set();
      const supSigMap = {}; const hofSig = report.hofSignature;

      monthlyLogs.forEach(log => {
        const logDay = log.DayVal; const key = String(log.MasterId); 
        if (Number(log.IsHoliday) === 1) holidayDays.add(logDay);
        if (Number(log.IsVatCleaning) === 1) vatDays.add(logDay);
        // 🔥 FIX: Adding Preventive Maintenance tracking
        if (Number(log.IsPreventiveMaintenance) === 1) pmDays.add(logDay);
        
        if (log.SupervisorSignature) supSigMap[logDay] = log.SupervisorSignature;
        if (!historyMap[key]) historyMap[key] = {};
        if (log.IsNA == 1) { historyMap[key][logDay] = 'NA'; } else if (log.IsDone == 1) { historyMap[key][logDay] = 'Y'; } else { historyMap[key][logDay] = 'N'; }
      });

      const doc = new jsPDF('l', 'mm', 'a4'); 
      const dateObj = new Date(year, month - 1);
      const monthName = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(year, month, 0).getDate();

      doc.setLineWidth(0.3); doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
      doc.rect(50, 10, 237, 20); doc.setFontSize(16);
      doc.text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", 168, 22, { align: 'center' });
      doc.setFontSize(10); doc.text(`${disaMachine}`, 12, 35); doc.text(`MONTH : ${monthName}`, 235, 35);

      const days = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
      const tableBody = checklist.map((item, rowIndex) => {
        const row = [String(item.SlNo), item.CheckPointDesc];
        for (let i = 1; i <= daysInMonth; i++) {
            if (holidayDays.has(i)) { if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } }); } 
            else if (vatDays.has(i)) { if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } }); } 
            // 🔥 FIX: Added Preventive Maintenance cell rendering
            else if (pmDays.has(i)) { if (rowIndex === 0) row.push({ content: 'P\nR\nE\nV\n.\n\nM\nA\nI\nN\nT', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [240, 220, 255], fontStyle: 'bold', textColor: [100, 50, 150] } }); }
            else { row.push(historyMap[String(item.MasterId)]?.[i] || ''); }
        }
        return row;
      });

      const supRow = ["", "Supervisor"]; for (let i = 1; i <= daysInMonth; i++) { supRow.push(""); }
      const hofRow = ["", "HOF"]; for (let i = 1; i <= daysInMonth - 5; i++) { hofRow.push(""); }
      hofRow.push({ content: '', colSpan: 5, styles: { halign: 'center', valign: 'middle' } });
      const footerRows = [supRow, hofRow];
      const dynamicColumnStyles = {}; for (let i = 2; i < daysInMonth + 2; i++) { dynamicColumnStyles[i] = { cellWidth: 5, halign: 'center' }; }

      autoTable(doc, {
        startY: 38, head: [[ { content: 'S.No', styles: { halign: 'center', valign: 'middle' } }, { content: 'Check Points', styles: { halign: 'center', valign: 'middle' } }, ...days.map(d => ({ content: d, styles: { halign: 'center' } })) ]],
        body: [...tableBody, ...footerRows], theme: 'grid', styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 105 }, ...dynamicColumnStyles },
        didDrawCell: function(data) {
           if (data.row.index === tableBody.length && data.column.index > 1) { 
               const sigData = supSigMap[data.column.index - 1];
               if (sigData && sigData.startsWith('data:image')) { try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch(e){} }
           }
           if (data.row.index === tableBody.length + 1 && data.cell.colSpan === 5) { 
               if (hofSig && hofSig.startsWith('data:image')) { try { doc.addImage(hofSig, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch(e){} }
           }
        },
        didParseCell: function(data) {
           if (data.row.index >= tableBody.length && data.column.index === 1) { data.cell.styles.fontStyle = 'bold'; data.cell.styles.halign = 'right'; }
           if (data.column.index > 1 && data.row.index < tableBody.length) {
             const text = (data.cell.text || [])[0] || '';
             if (text === 'Y') { data.cell.styles.font = 'ZapfDingbats'; data.cell.text = '3'; data.cell.styles.textColor = [0, 100, 0]; } 
             else if (text === 'N') { data.cell.styles.textColor = [255, 0, 0]; data.cell.text = 'X'; data.cell.styles.fontStyle = 'bold'; } 
             else if (text === 'NA') { data.cell.styles.fontSize = 5; data.cell.styles.textColor = [100, 100, 100]; data.cell.styles.fontStyle = 'bold'; }
           }
        }
      });

      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text("Legend:   3 - OK    X - NOT OK    CA - Corrected during Audit    NA - Not Applicable", 10, doc.lastAutoTable.finalY + 6);
      doc.setFont('helvetica', 'normal'); doc.text("Remarks: If Nonconformity please write on NCR format (back-side)", 10, doc.lastAutoTable.finalY + 12); doc.text("QF/08/MRO - 18, Rev No: 02 dt 01.01.2022", 10, 200); doc.text("Page 1 of 2", 270, 200);

      const pdfBlobUrl = doc.output('bloburl'); setPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate PDF preview."); }
    setIsPdfLoading(false);
  };

  const submitSignature = async () => {
    if (sigCanvas.current.isEmpty()) { toast.warning("Please provide a signature first."); return; }
    const signatureData = sigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      await axios.post(`${API_BASE}/sign-hof`, { month: selectedReport.month, year: selectedReport.year, disaMachine: selectedReport.disa, signature: signatureData });
      toast.success("Monthly Audit approved and signed!");
      setSelectedReport(null); fetchReports(); 
    } catch (err) { toast.error("Failed to save signature."); }
  };

  const handleOpenErrorModal = async (report) => {
    setSelectedErrorReport(report); setErrorPdfUrl(null); setIsErrorPdfLoading(true);
    try {
      const response = await axios.get(`${ERR_API_BASE}/report`, { params: { line: report.disa }, responseType: 'blob' });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setErrorPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate Error Proof PDF."); }
    setIsErrorPdfLoading(false);
  };

  const submitErrorSignature = async () => {
    if (errorSigCanvas.current.isEmpty()) { toast.warning("Please provide a signature first."); return; }
    const signatureData = errorSigCanvas.current.getCanvas().toDataURL("image/png");
    const dateStr = new Date(selectedErrorReport.reportDate).toISOString().split('T')[0];

    try {
      await axios.post(`${ERR_API_BASE}/sign-hof`, { date: dateStr, line: selectedErrorReport.disa, signature: signatureData });
      toast.success("Error Proof Report verified and signed!");
      setSelectedErrorReport(null); fetchErrorReports(); 
    } catch (err) { toast.error("Failed to save Error Proof signature."); }
  };

  const handleOpenErrorModalV2 = async (report) => {
    setSelectedErrorReportV2(report); setErrorPdfUrlV2(null); setIsErrorPdfLoadingV2(true);
    try {
      const response = await axios.get(`${ERR_API_BASE_V2}/report`, { params: { line: report.disa }, responseType: 'blob' });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setErrorPdfUrlV2(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate Error Proof V2 PDF."); }
    setIsErrorPdfLoadingV2(false);
  };

  const submitErrorSignatureV2 = async () => {
    if (errorSigCanvasV2.current.isEmpty()) { toast.warning("Please provide a signature first."); return; }
    const signatureData = errorSigCanvasV2.current.getCanvas().toDataURL("image/png");
    const dateStr = selectedErrorReportV2.reportDate;

    try {
      await axios.post(`${ERR_API_BASE_V2}/sign-hof`, { date: dateStr, line: selectedErrorReportV2.disa, signature: signatureData });
      toast.success("Error Proof V2 Report verified and signed!");
      setSelectedErrorReportV2(null); fetchErrorReportsV2(); 
    } catch (err) { toast.error("Failed to save Error Proof V2 signature."); }
  };

  const formatDate = (dateString) => { return new Date(dateString).toLocaleDateString("en-GB"); };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="min-h-screen bg-[#2d2d2d] p-10 space-y-10">
        
        {/* SECTION 1: BOTTOM LEVEL AUDITS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-blue-500">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-800">Bottom Level Audits</h1>
            <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded font-bold uppercase shadow-sm">Logged in: {currentHOF}</span>
          </div>

          {reports.length === 0 ? (
            <p className="text-gray-500 italic">No monthly audits found for your review.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead className="bg-gray-800 text-white">
                <tr><th className="p-3 border border-gray-300">Month / Year</th><th className="p-3 border border-gray-300">DISA Line</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
              </thead>
              <tbody>
                {reports.map((report, idx) => {
                  const dateObj = new Date(report.year, report.month - 1);
                  const monthDisplay = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 border border-gray-300 font-medium">{monthDisplay}</td><td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.hofSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Approved</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Approval</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.hofSignature && <button onClick={() => handleOpenSignModal(report)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* SECTION 2: ERROR PROOF VERIFICATION (V1) */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-indigo-500">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-800">Error Proof Verification (Daily)</h1>
          </div>

          {errorReports.length === 0 ? (
            <p className="text-gray-500 italic">No Error Proof reports found for your review.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead className="bg-gray-800 text-white">
                <tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
              </thead>
              <tbody>
                {errorReports.map((report, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.hofSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Approved</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Approval</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.hofSignature && <button onClick={() => handleOpenErrorModal(report)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* SECTION 3: ERROR PROOF VERIFICATION 2 (3-SHIFTS) */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-purple-500">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-800">Error Proof Verification 2 (Shift Wise)</h1>
          </div>

          {errorReportsV2.length === 0 ? (
            <p className="text-gray-500 italic">No Error Proof V2 reports found for your review.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead className="bg-gray-800 text-white">
                <tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
              </thead>
              <tbody>
                {errorReportsV2.map((report, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-purple-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.hofSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Approved</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Approval</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.hofSignature && <button onClick={() => handleOpenErrorModalV2(report)} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* SECTION 4: DAILY PRODUCTION PERFORMANCE */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-cyan-500">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-800">Daily Production Performance</h1>
          </div>

          {dailyReports.length === 0 ? (
            <p className="text-gray-500 italic">No Daily Performance reports found for your review.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead className="bg-gray-800 text-white">
                <tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
              </thead>
              <tbody>
                {dailyReports.map((report, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-cyan-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.productionDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">DISA - {report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.hofSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Approved</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Approval</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.hofSignature && <button onClick={() => handleOpenDailyModal(report)} className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>

      {/* ========================================================================================= */}
      {/* 🔥 FULL-SCREEN SPLIT UI PDF MODALS */}
      {/* ========================================================================================= */}

      {/* 1. BOTTOM LEVEL AUDIT MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Approve Monthly Audit</h3>
            <button onClick={() => { setSelectedReport(null); setPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {pdfUrl && <iframe src={`${pdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <div className="bg-blue-100 p-4 rounded-xl border border-blue-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-blue-900">
                  <p><span className="font-bold">Month:</span> {new Date(selectedReport.year, selectedReport.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                  <p><span className="font-bold">Machine:</span> {selectedReport.disa}</p>
                </div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">HOF Signature</label>
                <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl overflow-hidden mb-2 shadow-inner">
                  <SignatureCanvas ref={sigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-64 cursor-crosshair' }} />
                </div>
                <button onClick={() => { if(sigCanvas.current) sigCanvas.current.clear() }} className="text-xs text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider underline self-end mb-8">Clear Signature</button>
                <div className="mt-auto">
                  <button onClick={submitSignature} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Approve & Sign
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. ERROR PROOF MODAL (V1) */}
      {selectedErrorReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Approve Error Proof (V1)</h3>
            <button onClick={() => { setSelectedErrorReport(null); setErrorPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isErrorPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {errorPdfUrl && <iframe src={`${errorPdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <div className="bg-indigo-100 p-4 rounded-xl border border-indigo-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-indigo-900">
                  <p><span className="font-bold">Date:</span> {formatDate(selectedErrorReport.reportDate)}</p>
                  <p><span className="font-bold">Machine:</span> {selectedErrorReport.disa}</p>
                </div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">HOF Signature</label>
                <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl overflow-hidden mb-2 shadow-inner">
                  <SignatureCanvas ref={errorSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-64 cursor-crosshair' }} />
                </div>
                <button onClick={() => errorSigCanvas.current.clear()} className="text-xs text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider underline self-end mb-8">Clear Signature</button>
                <div className="mt-auto">
                  <button onClick={submitErrorSignature} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Approve & Sign
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. ERROR PROOF V2 MODAL */}
      {selectedErrorReportV2 && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Approve Error Proof (V2)</h3>
            <button onClick={() => { setSelectedErrorReportV2(null); setErrorPdfUrlV2(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isErrorPdfLoadingV2 && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {errorPdfUrlV2 && <iframe src={`${errorPdfUrlV2}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <div className="bg-purple-100 p-4 rounded-xl border border-purple-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-purple-900">
                  <p><span className="font-bold">Date:</span> {formatDate(selectedErrorReportV2.reportDate)}</p>
                  <p><span className="font-bold">Machine:</span> {selectedErrorReportV2.disa}</p>
                </div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">HOF Signature</label>
                <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl overflow-hidden mb-2 shadow-inner">
                  <SignatureCanvas ref={errorSigCanvasV2} penColor="blue" canvasProps={{ className: 'w-full h-64 cursor-crosshair' }} />
                </div>
                <button onClick={() => errorSigCanvasV2.current.clear()} className="text-xs text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider underline self-end mb-8">Clear Signature</button>
                <div className="mt-auto">
                  <button onClick={submitErrorSignatureV2} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Approve & Sign
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. DAILY PRODUCTION PERFORMANCE MODAL */}
      {selectedDailyReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Approve Daily Performance</h3>
            <button onClick={() => { setSelectedDailyReport(null); setDailyPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isDailyPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {dailyPdfUrl && <iframe src={`${dailyPdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <div className="bg-cyan-100 p-4 rounded-xl border border-cyan-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-cyan-900">
                  <p><span className="font-bold">Date:</span> {formatDate(selectedDailyReport.productionDate)}</p>
                  <p><span className="font-bold">Machine:</span> DISA - {selectedDailyReport.disa}</p>
                </div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">HOF Signature</label>
                <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl overflow-hidden mb-2 shadow-inner">
                  <SignatureCanvas ref={dailySigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-64 cursor-crosshair' }} />
                </div>
                <button onClick={() => dailySigCanvas.current.clear()} className="text-xs text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider underline self-end mb-8">Clear Signature</button>
                <div className="mt-auto">
                  <button onClick={submitDailySignature} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Approve & Sign
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Hof;