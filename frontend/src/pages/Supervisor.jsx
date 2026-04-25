import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import SignatureCanvas from "react-signature-canvas";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader, X, CheckCircle } from "lucide-react"; 
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logo from '../Assets/logo.png'; 

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

// 🔥 Dynamic QF Helpers
const getSafeDateStr = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val.split('T')[0];
  try { return val.toISOString().split('T')[0]; } catch (e) { return null; }
};

const getDynamicQfString = (recordDate, qfHistory, defaultFallback) => {
  if (!qfHistory || !Array.isArray(qfHistory) || qfHistory.length === 0) return defaultFallback;
  const targetDateStr = getSafeDateStr(recordDate) || getSafeDateStr(new Date());
  for (const qf of qfHistory) {
      const qfDateStr = getSafeDateStr(qf.date);
      if (!qfDateStr) continue;
      if (qfDateStr <= targetDateStr) return qf.qfValue;
  }
  return qfHistory[qfHistory.length - 1].qfValue || defaultFallback;
};

const Supervisor = () => {
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentSupervisor = storedUser.username || "supervisor1";
  const navigate = useNavigate();

  const getAuthHeader = () => {
    return { Authorization: `Bearer ${localStorage.getItem('token')}` };
  };

  // --- States for Disamatic Report ---
  const [disaReports, setDisaReports] = useState([]);
  const [selectedDisaReport, setSelectedDisaReport] = useState(null);
  const [disaPdfUrl, setDisaPdfUrl] = useState(null); 
  const [isDisaPdfLoading, setIsDisaPdfLoading] = useState(false); 
  const disaSigCanvas = useRef({});

  // --- States for Daily Production Performance ---
  const [dpReports, setDpReports] = useState([]);
  const [selectedDpReport, setSelectedDpReport] = useState(null);
  const [dpPdfUrl, setDpPdfUrl] = useState(null); 
  const [isDpPdfLoading, setIsDpPdfLoading] = useState(false); 
  const dpSigCanvas = useRef({});

  // --- States for Bottom Level Audit ---
  const [bottomReports, setBottomReports] = useState([]);
  const [selectedBottomReport, setSelectedBottomReport] = useState(null);
  const [bottomPdfUrl, setBottomPdfUrl] = useState(null);
  const [isBottomPdfLoading, setIsBottomPdfLoading] = useState(false);
  

  // --- States for Non-Conformance Reports (NCR) ---
  const [ncrReports, setNcrReports] = useState([]);
  const [selectedNcrReport, setSelectedNcrReport] = useState(null);


  // --- States for DMM Setting Parameters ---
  const [dmmReports, setDmmReports] = useState([]);
  const [selectedDmmReport, setSelectedDmmReport] = useState(null);
  const [dmmPdfUrl, setDmmPdfUrl] = useState(null);
  const [isDmmPdfLoading, setIsDmmPdfLoading] = useState(false);
  

  // --- States for 4M Change Reports ---
  const [fourMReports, setFourMReports] = useState([]);
  const [selectedFourMReport, setSelectedFourMReport] = useState(null);
  const [fourMPdfUrl, setFourMPdfUrl] = useState(null);
  const [isFourMPdfLoading, setIsFourMPdfLoading] = useState(false);
  const fourMSigCanvas = useRef({});

  // --- States for Error Proof Reaction Plans ---
  const [errorReports, setErrorReports] = useState([]);
  const [selectedErrorReport, setSelectedErrorReport] = useState(null);
  const [errorPdfUrl, setErrorPdfUrl] = useState(null);
  const [isErrorPdfLoading, setIsErrorPdfLoading] = useState(false);
  const [isErrorApproved, setIsErrorApproved] = useState(false);

  // --- States for Moulding Quality ---
  const [mouldQualityReports, setMouldQualityReports] = useState([]);
  const [selectedMQReport, setSelectedMQReport] = useState(null);
  const [mqPdfUrl, setMqPdfUrl] = useState(null);

  useEffect(() => {
    fetchDisaReports();
    fetchDpReports(); // 🔥 Fetch Daily Performance
    fetchBottomReports();
    fetchNcrReports(); 
    fetchDmmReports();
    fetchFourMReports();
    fetchErrorReports(); 
    fetchError2Reports();
    fetchMouldQualityReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatDate = (dateString) => { 
      if (!dateString) return "";
      return new Date(dateString).toLocaleDateString("en-GB"); 
  };

  const formatTime = (dateString) => {
      if (!dateString) return "";
      return new Date(dateString).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' });
  };

  const filterUniqueReports = (data) => {
    const uniqueMap = {};
    data.forEach((item) => {
      const dateStr = new Date(item.reportDate).toISOString().split('T')[0];
      const key = `${dateStr}|${item.shift}|${item.disa || item.disaMachine}`;
      if (!uniqueMap[key] || item.id > uniqueMap[key].id) {
        uniqueMap[key] = item;
      }
    });
    return Object.values(uniqueMap).sort((a, b) => {
      const dateA = new Date(a.reportDate);
      const dateB = new Date(b.reportDate);
      return dateB - dateA || b.id - a.id;
    });
  };

  // ==========================================
  // 1. DISAMATIC LOGIC
  // ==========================================
  const fetchDisaReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/forms/supervisor/${currentSupervisor}`);
      setDisaReports(filterUniqueReports(res.data));
    } catch (err) { toast.error("Failed to load Disamatic reports."); }
  };

  const handleOpenDisaModal = async (report) => {
    setSelectedDisaReport(report);
    setDisaPdfUrl(null);
    setIsDisaPdfLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/forms/download-pdf`, { 
          params: { reportId: report.id }, 
          responseType: 'blob',
          headers: getAuthHeader()
      });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setDisaPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate Disamatic PDF preview."); }
    setIsDisaPdfLoading(false);
  };

  const submitDisaSignature = async () => {
    // Send "Approved" string instead of base64 image data
    try {
      await axios.post(`${API_BASE}/forms/sign`, { reportId: selectedDisaReport.id, signature: "Approved" });
      toast.success("Disamatic Report approved successfully!");
      setSelectedDisaReport(null); 
      fetchDisaReports();
    } catch (err) { 
      toast.error("Failed to save approval."); 
    }
  };

  // ==========================================
  // 2. DAILY PRODUCTION PERFORMANCE LOGIC
  // ==========================================
  const fetchDpReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/daily-performance/supervisor/${currentSupervisor}`, { headers: getAuthHeader() });
      setDpReports(res.data);
    } catch (err) { console.error("Failed to load Daily Performance reports."); }
  };

  const handleOpenDpModal = async (report) => {
    setSelectedDpReport(report);
    setDpPdfUrl(null);
    setIsDpPdfLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/daily-performance/download-pdf`, { 
          params: { date: getSafeDateStr(report.productionDate), disa: report.disa }, 
          responseType: 'blob',
          headers: getAuthHeader()
      });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setDpPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate Daily Performance PDF preview."); }
    setIsDpPdfLoading(false);
  };

  const submitDpSignature = async () => {
    try {
      await axios.post(`${API_BASE}/daily-performance/sign-supervisor`, { reportId: selectedDpReport.id, signature: "Approved" }, { headers: getAuthHeader() });
      toast.success("Daily Performance Report approved successfully!");
      setSelectedDpReport(null); 
      fetchDpReports();
    } catch (err) { toast.error("Failed to save approval."); }
  };

  // ==========================================
  // 3. BOTTOM LEVEL AUDIT LOGIC
  // ==========================================
  const fetchBottomReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/bottom-level-audit/supervisor/${currentSupervisor}`);
      setBottomReports(res.data);
    } catch (err) { toast.error("Failed to load Bottom Level Audits."); }
  };

const handleOpenBottomModal = async (report) => {
    setSelectedBottomReport(report); 
    setBottomPdfUrl(null); 
    setIsBottomPdfLoading(true);
    
    try {
      const selectedDate = new Date(report.reportDate);
      const offset = selectedDate.getTimezoneOffset();
      const localDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
      const dateStr = localDate.toISOString().split('T')[0];
      const month = localDate.getMonth() + 1; 
      const year = localDate.getFullYear();
      const disaMachine = report.disa;

      const [detailsRes, monthlyRes] = await Promise.all([
        axios.get(`${API_BASE}/bottom-level-audit/details`, { params: { date: dateStr, disaMachine } }),
        axios.get(`${API_BASE}/bottom-level-audit/monthly-report`, { params: { month, year, disaMachine } })
      ]);

      const checklist = detailsRes.data.checklist; 
      const monthlyLogs = monthlyRes.data.monthlyLogs || []; 
      const ncReports = monthlyRes.data.ncReports || [];
      const qfHistory = monthlyRes.data.qfHistory || []; 

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
      const monthName = localDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(year, month, 0).getDate();

      doc.setLineWidth(0.3); doc.rect(10, 10, 40, 20); 
      try { doc.addImage(logo, 'PNG', 12, 11, 36, 18); } 
      catch (err) { doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' }); }
      
      doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", 140, 22, { align: 'center' });
      doc.rect(230, 10, 57, 20); doc.setFontSize(11); doc.text(disaMachine, 258.5, 16, { align: 'center' }); doc.line(230, 20, 287, 20); doc.setFontSize(10); doc.text(`Month: ${monthName}`, 258.5, 26, { align: 'center' });

      const days = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
      const tableBody = checklist.map((item, rowIndex) => {
        const row = [String(item.SlNo), item.CheckPointDesc];
        for (let i = 1; i <= daysInMonth; i++) {
          if (holidayDays.has(i)) { if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } }); }
          else if (vatDays.has(i)) { if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } }); }
          else if (prevMaintDays.has(i)) { if (rowIndex === 0) row.push({ content: 'P\nR\nE\nV\nE\nN\nT\nI\nV\nE\n\nM\nA\nI\nN\nT\nE\nN\nA\nN\nC\nE', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [243, 232, 255], fontStyle: 'bold', textColor: [126, 34, 206], fontSize: 4.5 } }); }
          else { row.push(historyMap[String(item.MasterId)]?.[i] || ''); }
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
        startY: 38, head: [[{ content: 'S.No', styles: { halign: 'center', valign: 'middle' } }, { content: 'Check Points', styles: { halign: 'center', valign: 'middle' } }, ...days.map(d => ({ content: d, styles: { halign: 'center' } }))]],
        body: [...tableBody, ...footerRows], theme: 'grid', styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 105 }, ...dynamicColumnStyles },
        didDrawCell: function (data) {
          if (data.row.index === tableBody.length && data.column.index > 1) {
            const sigData = supSigMap[data.column.index - 1];
            if (sigData && String(sigData).trim().toUpperCase() === "APPROVED") {
               doc.setDrawColor(0, 128, 0); doc.setLineWidth(0.3);
               const cx = data.cell.x + data.cell.width / 2;
               const cy = data.cell.y + data.cell.height / 2;
               doc.line(cx - 1, cy, cx - 0.2, cy + 1); doc.line(cx - 0.2, cy + 1, cx + 1.5, cy - 1);
               doc.setDrawColor(0, 0, 0);
            } else if (sigData && sigData.startsWith('data:image')) { 
               try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch (e) { } 
            }
          }
          if (data.row.index === tableBody.length + 1 && data.cell.colSpan === 5) {
            if (hofSig && hofSig.startsWith('data:image')) { try { doc.addImage(hofSig, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch (e) { } }
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
      
      const dynamicQf = getDynamicQfString(dateStr, qfHistory, "QF/08/MRO - 18, Rev No: 02 dt 01.01.2022");
      doc.text(dynamicQf, 10, 200); 
      doc.text("Page 1 of 2", 270, 200);

      // Page 2 - NCR
      doc.addPage(); doc.setDrawColor(0); doc.setLineWidth(0.3); 
      doc.rect(10, 10, 40, 20); 
      try { doc.addImage(logo, 'PNG', 12, 11, 36, 18); } 
      catch (err) { doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' }); }
      doc.rect(50, 10, 237, 20); doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", 168.5, 18, { align: 'center' }); doc.setFontSize(14); doc.text("Non-Conformance Report", 168.5, 26, { align: 'center' });

      // FIX: Insert signature instead of empty string
      const ncRows = ncReports.map((r, index) => {
          const sigVal = r.SupervisorSignature || r.Sign || '';
          return [ index + 1, new Date(r.ReportDate).toLocaleDateString('en-GB'), r.NonConformityDetails || '', r.Correction || '', r.RootCause || '', r.CorrectiveAction || '', r.TargetDate ? new Date(r.TargetDate).toLocaleDateString('en-GB') : '', r.Responsibility || '', sigVal, r.Status || '' ];
      });
      if (ncRows.length === 0) { for (let i = 0; i < 5; i++) ncRows.push(['', '', '', '', '', '', '', '', '', '']); }

      autoTable(doc, {
        startY: 35, head: [['S.No', 'Date', 'Non-Conformities Details', 'Correction', 'Root Cause', 'Corrective Action', 'Target Date', 'Responsibility', 'Signature', 'Status']],
        body: ncRows, theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle', overflow: 'linebreak' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 40 }, 3: { cellWidth: 35 }, 4: { cellWidth: 35 }, 5: { cellWidth: 35 }, 6: { cellWidth: 20, halign: 'center' }, 7: { cellWidth: 25 }, 8: { cellWidth: 20, halign: 'center' }, 9: { cellWidth: 20, halign: 'center' } },
        didDrawCell: function (data) {
          if (data.section === 'body' && data.column.index === 8) {
            const sig = data.row.raw[8];
            const status = data.row.raw[9];
            
            const isApproved = (sig && String(sig).trim().toUpperCase() === "APPROVED") || 
                               (status && String(status).trim().toUpperCase() === "COMPLETED");

            if (isApproved) {
               const cx = data.cell.x + data.cell.width / 2;
               const cy = data.cell.y + data.cell.height / 2;
               doc.setDrawColor(0, 128, 0); doc.setLineWidth(0.5);
               doc.line(cx - 2, cy - 1.5, cx - 0.5, cy + 0.5);
               doc.line(cx - 0.5, cy + 0.5, cx + 2.5, cy - 2.5);
               doc.setDrawColor(0, 0, 0);
               doc.setFontSize(5); doc.setTextColor(0, 128, 0); doc.setFont('helvetica', 'bold');
               doc.text("APPROVED", cx, cy + 2.5, { align: 'center' });
               doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
            } else if (sig && String(sig).startsWith('data:image')) { 
               try { doc.addImage(sig, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch (e) { } 
            }
          }
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 8) { data.cell.text = ['']; }
          if (data.section === 'body' && data.column.index === 9) {
            const statusText = String(data.row.raw[9] || '');
            if (statusText.toUpperCase() === 'COMPLETED') { data.cell.styles.textColor = [0, 150, 0]; data.cell.styles.fontStyle = 'bold'; } 
            else if (statusText.toUpperCase() === 'PENDING') { data.cell.styles.textColor = [200, 0, 0]; data.cell.styles.fontStyle = 'bold'; }
          }
        }
      });
      
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); 
      doc.text(dynamicQf, 10, 200); 
      doc.text("Page 2 of 2", 270, 200);

      const pdfBlobUrl = doc.output('bloburl'); setBottomPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate PDF preview."); }
    setIsBottomPdfLoading(false);
  };

const submitBottomSignature = async () => {
    const localDate = new Date(selectedBottomReport.reportDate);
    const offset = localDate.getTimezoneOffset();
    const cleanDate = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    try {
      await axios.post(`${API_BASE}/bottom-level-audit/sign-supervisor`, { 
        date: cleanDate, 
        disaMachine: selectedBottomReport.disa, 
        signature: "APPROVED" 
      });
      toast.success("Bottom Level Audit approved!"); 
      setSelectedBottomReport(null); 
      fetchBottomReports();
    } catch (err) { 
      toast.error("Failed to save approval."); 
    }
  };

  // ==========================================
  // 4. NCR LOGIC (🔥 FETCHES FROM BOTH LPA AND CHECKLIST)
  // ==========================================
const fetchNcrReports = async () => {
    try {
      let lpaData = [];
      let checklistData = [];

      try {
        const resLpa = await axios.get(`${API_BASE}/bottom-level-audit/supervisor-ncr/${currentSupervisor}`);
        lpaData = (resLpa.data || []).map(r => ({ ...r, source: 'LPA' }));
      } catch (err) { console.warn("LPA NCR fetch error", err); }

      try {
        const resChecklist = await axios.get(`${API_BASE}/disa-checklist/supervisor-ncr/${currentSupervisor}`);
        checklistData = (resChecklist.data || []).map(r => ({ ...r, source: 'Checklist' }));
      } catch (err) { console.warn("Checklist NCR fetch error", err); }

      // Merge and sort by Date (Descending)
      const combined = [...lpaData, ...checklistData].sort((a, b) => new Date(b.ReportDate) - new Date(a.ReportDate));
      setNcrReports(combined);
    } catch (err) { 
      toast.error("Failed to load NCRs."); 
    }
  };

  const submitNcrSignature = async () => {
    try {
      const endpoint = selectedNcrReport.source === 'Checklist' 
          ? '/disa-checklist/sign-ncr' 
          : '/bottom-level-audit/sign-ncr';

      await axios.post(`${process.env.REACT_APP_API_URL}${endpoint}`, { 
        reportId: selectedNcrReport.ReportId || selectedNcrReport.id, 
        signature: "APPROVED" 
      });
      
      toast.success("NCR Verified and Completed!"); 
      setSelectedNcrReport(null); 
      fetchNcrReports(); 
    } catch (err) { 
      toast.error("Failed to save NCR approval."); 
    }
  };

  // ==========================================
  // 5. DMM SETTINGS LOGIC
  // ==========================================
  const fetchDmmReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/dmm-settings/supervisor/${currentSupervisor}`);
      setDmmReports(filterUniqueReports(res.data));
    } catch (err) { toast.error("Failed to load DMM Settings."); }
  };

  const handleOpenDmmModal = async (report) => {
    setSelectedDmmReport(report); setDmmPdfUrl(null); setIsDmmPdfLoading(true);
    try {
      const selectedDate = new Date(report.reportDate);
      const offset = selectedDate.getTimezoneOffset();
      const localDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
      const dateStr = localDate.toISOString().split('T')[0];
      const disaMachine = report.disa;

      const res = await axios.get(`${API_BASE}/dmm-settings/details`, { params: { date: dateStr, disa: disaMachine } });
      const { shiftsData, shiftsMeta } = res.data;
      const qfHistory = res.data.qfHistory || []; 

      const dynamicQf = getDynamicQfString(dateStr, qfHistory, "QF/07/FBP-13, Rev.No:06 dt 08.10.2025");

      const doc = new jsPDF('l', 'mm', 'a4'); 
      doc.setLineWidth(0.3); doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      try { doc.addImage(logo, 'PNG', 12, 11, 36, 18); } catch(e){ doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' }); }
      
      doc.rect(50, 10, 180, 20); doc.setFontSize(16); doc.text("DMM SETTING PARAMETERS CHECK SHEET", 140, 22, { align: 'center' });
      doc.rect(230, 10, 57, 20); doc.setFontSize(11); doc.text(`${disaMachine}`, 258.5, 16, { align: 'center' });
      doc.line(230, 20, 287, 20); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(`DATE: ${formatDate(dateStr)}`, 258.5, 26, { align: 'center' });

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
               if (sigData && sigData.startsWith('data:image')) {
                   try { doc.addImage(sigData, 'PNG', data.cell.x + 2, data.cell.y + 1, data.cell.width - 4, data.cell.height - 2); } catch (e) {}
               }
           }
        }
      });

      const columns = [ { key: 'Customer', label: 'CUSTOMER' }, { key: 'ItemDescription', label: 'ITEM\nDESCRIPTION' }, { key: 'Time', label: 'TIME' }, { key: 'PpThickness', label: 'PP\nTHICKNESS\n(mm)' }, { key: 'PpHeight', label: 'PP\nHEIGHT\n(mm)' }, { key: 'SpThickness', label: 'SP\nTHICKNESS\n(mm)' }, { key: 'SpHeight', label: 'SP\nHEIGHT\n(mm)' }, { key: 'CoreMaskOut', label: 'CORE MASK\nHEIGHT\n(OUTSIDE) mm' }, { key: 'CoreMaskIn', label: 'CORE MASK\nHEIGHT\n(INSIDE) mm' }, { key: 'SandShotPressure', label: 'SAND SHOT\nPRESSURE\nBAR' }, { key: 'CorrectionShotTime', label: 'CORRECTION\nOF SHOT TIME\n(SEC)' }, { key: 'SqueezePressure', label: 'SQUEEZE\nPRESSURE\nKg/Cm2 / bar' }, { key: 'PpStripAccel', label: 'PP STRIPPING\nACCELERATION' }, { key: 'PpStripDist', label: 'PP STRIPPING\nDISTANCE' }, { key: 'SpStripAccel', label: 'SP STRIPPING\nACCELERATION' }, { key: 'SpStripDist', label: 'SP STRIPPING\nDISTANCE' }, { key: 'MouldThickness', label: 'MOULD\nTHICKNESS\n(± 10mm)' }, { key: 'CloseUpForce', label: 'CLOSE UP\nFORCE (Kg)' }, { key: 'Remarks', label: 'REMARKS' } ];

      let currentY = doc.lastAutoTable.finalY + 8; 
      [1, 2, 3].forEach((shift, index) => {
         const isIdle = shiftsMeta[shift].isIdle;
         const shiftLabel = shift === 1 ? 'I' : shift === 2 ? 'II' : 'III';
         const tableHeader = [ [{ content: `SHIFT ${shiftLabel}`, colSpan: columns.length + 1, styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [0,0,0] } }], [{ content: 'S.No', styles: { cellWidth: 8 } }, ...columns.map(col => ({ content: col.label, styles: { cellWidth: 'wrap' } }))] ];

         let tableBody = [];
         if (isIdle) { tableBody.push([{ content: 'L I N E   I D L E', colSpan: columns.length + 1, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 14, textColor: [100, 100, 100], fillColor: [245, 245, 245], minCellHeight: 15 } }]); } 
         else {
            tableBody = (shiftsData[shift] || []).map((row, idx) => {
                const pdfRow = [(idx + 1).toString()];
                columns.forEach(col => { const val = row[col.key]; pdfRow.push(val === '' || val === null || val === undefined ? '-' : val.toString()); });
                return pdfRow;
            });
         }
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
            const sig = shiftsMeta[shiftNum]?.supervisorSignature;

            if (sig && String(sig).trim().toUpperCase() === "APPROVED") {
              // Draw rightmark + APPROVED text
              doc.setDrawColor(0, 128, 0); doc.setLineWidth(0.5);
              doc.line(data.cell.x + 2, data.cell.y + 4, data.cell.x + 4, data.cell.y + 6);
              doc.line(data.cell.x + 4, data.cell.y + 6, data.cell.x + 8, data.cell.y + 2);
              doc.setDrawColor(0, 0, 0);
              
              doc.setFontSize(5);
              doc.setTextColor(0, 128, 0);
              doc.setFont('helvetica', 'bold');
              doc.text("APPROVED", data.cell.x + 9, data.cell.y + 5);
              doc.setTextColor(0, 0, 0); 
              doc.setFont('helvetica', 'normal');
            } else if (sig && String(sig).startsWith('data:image')) { 
              try { doc.addImage(sig, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch (e) { } 
            }
          }
        }
      });

         currentY = doc.lastAutoTable.finalY + 5; 
         if (currentY > 175 && index < 2) { 
             doc.setFontSize(8); doc.text(dynamicQf, 10, 200); 
             doc.addPage(); currentY = 15; 
         }
      });
      doc.setFontSize(8); doc.text(dynamicQf, 10, 200);

      const pdfBlobUrl = doc.output('bloburl'); setDmmPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate PDF preview."); }
    setIsDmmPdfLoading(false);
  };

  const submitDmmSignature = async () => {
    // Removed canvas check
    const localDate = new Date(selectedDmmReport.reportDate);
    const offset = localDate.getTimezoneOffset();
    const cleanDate = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    try {
      await axios.post(`${API_BASE}/dmm-settings/sign`, { 
        date: cleanDate, 
        disaMachine: selectedDmmReport.disa, 
        shift: selectedDmmReport.shift, 
        signature: "APPROVED" // Pass the string here!
      });
      toast.success("DMM Settings Shift signed successfully!");
      setSelectedDmmReport(null); 
      fetchDmmReports();
    } catch (err) { toast.error("Failed to save signature."); }
  };

  // ==========================================
  // 6. 4M CHANGE LOGIC 
  // ==========================================
  const fetchFourMReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/4m-change/supervisor/${currentSupervisor}`);
      setFourMReports(res.data);
    } catch (err) { toast.error("Failed to load 4M Change Reports."); }
  };

  const handleOpenFourMModal = async (report) => {
    setSelectedFourMReport(report); setFourMPdfUrl(null); setIsFourMPdfLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/4m-change/report`, { 
        params: { reportId: report.id }, 
        responseType: 'blob',
        headers: getAuthHeader()
      });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setFourMPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate 4M PDF."); }
    setIsFourMPdfLoading(false);
  };

  const submitFourMSignature = async () => {
    try {
      await axios.post(`${API_BASE}/4m-change/sign-supervisor`, { reportId: selectedFourMReport.id, signature: "Approved" });
      toast.success("4M Change Report approved successfully!");
      setSelectedFourMReport(null); 
      fetchFourMReports();
    } catch (err) { toast.error("Failed to save 4M approval."); }
  };

  // ==========================================
  // 7. ERROR PROOF REACTION PLANS LOGIC 
  // ==========================================
  const fetchErrorReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/error-proof/supervisor/${currentSupervisor}`);
      const v1Data = (res.data || []).map(r => ({ ...r, _source: 'v1' }));
      setErrorReports(prev => {
        const v2Only = prev.filter(r => r._source === 'v2');
        return [...v1Data, ...v2Only];
      });
    } catch (err) { toast.error("Failed to load Error Proof plans."); }
  };

  const fetchError2Reports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/error-proof2/supervisor/${currentSupervisor}`);
      const v2Data = (res.data || []).map(r => ({ ...r, _source: 'v2' }));
      setErrorReports(prev => {
        const v1Only = prev.filter(r => r._source === 'v1');
        return [...v1Only, ...v2Data];
      });
    } catch (err) { console.error("Failed to load Error Proof V2 plans."); }
  };

  const handleOpenErrorModal = async (report) => {
    setSelectedErrorReport(report);
    setErrorPdfUrl(null);
    setIsErrorPdfLoading(true);
    try {
      const line = report.DisaMachine || report.disaMachine || report.line;
      const localDate = new Date(report.recordDate || report.RecordDate);
      const offset = localDate.getTimezoneOffset();
      const dateStr = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

      const reportEndpoint = report._source === 'v2' ? `${API_BASE}/error-proof2/report` : `${API_BASE}/error-proof/report`;
      const response = await axios.get(reportEndpoint, { 
          params: { line, date: dateStr }, 
          responseType: 'blob',
          headers: getAuthHeader()
      });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setErrorPdfUrl(pdfBlobUrl);
    } catch (error) {
      toast.error("Failed to generate Error Proof PDF.");
    }
    setIsErrorPdfLoading(false);
  };

  const submitErrorSignature = async () => {
    if (!isErrorApproved) { toast.warning("Please check the box to approve."); return; }
    try {
      const isV2 = selectedErrorReport._source === 'v2';
      const id = isV2 
        ? (selectedErrorReport.ReactionPlanId || selectedErrorReport.Id)
        : (selectedErrorReport.reportId || selectedErrorReport.VerificationId || selectedErrorReport.Id || selectedErrorReport.sNo);
      const signEndpoint = isV2 ? `${API_BASE}/error-proof2/sign-supervisor` : `${API_BASE}/error-proof/sign-supervisor`;
      await axios.post(signEndpoint, { 
        reactionPlanId: id, 
        signature: "Approved" 
      });
      toast.success("Reaction Plan Approved!");
      setSelectedErrorReport(null); setIsErrorApproved(false); 
      fetchErrorReports(); 
      fetchError2Reports();
    } catch (err) { toast.error("Failed to save approval."); }
  };

  // ==========================================
  // 8. MOULDING QUALITY LOGIC
  // ==========================================
  const fetchMouldQualityReports = async () => {
    try {
      const res = await axios.get(`${API_BASE}/mould-quality/supervisor/${currentSupervisor}`);
      setMouldQualityReports(filterUniqueReports(res.data));
    } catch (err) { console.error(err); }
  };

  const handleOpenMQModal = async (report) => {
    setSelectedMQReport(report);
    setMqPdfUrl(null);
    try {
      const res = await axios.get(`${API_BASE}/mould-quality/report`, { 
        params: { reportId: report.id },
        responseType: 'blob',
        headers: getAuthHeader()
      });
      setMqPdfUrl(URL.createObjectURL(res.data));
    } catch (err) { toast.error("Failed to load PDF preview"); }
  };

  const submitMQSignature = async () => {
    try {
      await axios.post(`${API_BASE}/mould-quality/sign-supervisor`, { reportId: selectedMQReport.id, signature: "APPROVED" });
      toast.success("Approved successfully!");
      setSelectedMQReport(null);
      fetchMouldQualityReports();
    } catch (err) { toast.error("Failed to save approval"); }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="min-h-screen bg-[#2d2d2d] p-10 space-y-10">

      <div className="max-w-6xl mx-auto flex justify-end items-center mb-[-20px]">
          <button 
            onClick={() => {
              navigate("/operator", { state: { actingOperator: currentSupervisor } });
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-black uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1 flex items-center gap-2"
          >
            <span>🔄</span> Switch to Operator Mode
          </button>
        </div>

        {/* SECTION 1: DISAMATIC REPORTS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-orange-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-800">Disamatic Production Reports</h1>
            <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded font-bold uppercase shadow-sm">Logged in: {currentSupervisor}</span>
          </div>
          {disaReports.length === 0 ? <p className="text-gray-500 italic">No Disamatic reports pending.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300 w-20 text-center">ID</th><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Shift</th><th className="p-3 border border-gray-300">DISA Line</th><th className="p-3 border border-gray-300">Operator</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {disaReports.map((report) => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="p-3 border border-gray-300 text-center font-bold text-gray-400">#{report.id}</td>
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td><td className="p-3 border border-gray-300">{report.shift}</td><td className="p-3 border border-gray-300 font-bold">DISA - {report.disa}</td><td className="p-3 border border-gray-300">{report.ppOperator || "N/A"}</td>
                      <td className="p-3 border border-gray-300">{report.supervisorSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.supervisorSignature && <button onClick={() => handleOpenDisaModal(report)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 2: DAILY PRODUCTION PERFORMANCE REPORTS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-teal-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-800">Daily Production Performance Reports</h1>
          </div>
          {dpReports.length === 0 ? <p className="text-gray-500 italic">No Daily Performance reports pending.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="p-3 border border-gray-300 w-20 text-center">ID</th>
                    <th className="p-3 border border-gray-300">Date</th>
                    <th className="p-3 border border-gray-300">DISA Line</th>
                    <th className="p-3 border border-gray-300">Status</th>
                    <th className="p-3 border border-gray-300 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dpReports.map((report) => (
                    <tr key={report.id} className="hover:bg-teal-50">
                      <td className="p-3 border border-gray-300 text-center font-bold text-gray-400">#{report.id}</td>
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.productionDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">
                        {report.supervisorSignature 
                          ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> 
                          : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>}
                      </td>
                      <td className="p-3 border border-gray-300 text-center">
                        {!report.supervisorSignature && (
                          <button onClick={() => handleOpenDpModal(report)} className="bg-teal-500 hover:bg-teal-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">
                            Review & Sign
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 3: BOTTOM LEVEL AUDITS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-blue-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold text-gray-800">Daily Bottom Level Audits</h1></div>
          {bottomReports.length === 0 ? <p className="text-gray-500 italic">No bottom level audits pending your signature.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Time Submitted</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {bottomReports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td>
                      <td className="p-3 border border-gray-300 text-gray-500 font-bold">{formatTime(report.submittedAt)}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.supervisorSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.supervisorSignature && <button onClick={() => handleOpenBottomModal(report)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 4: NON-CONFORMANCE REPORTS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-red-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold text-gray-800">Non-Conformance Reports (NCR)</h1></div>
          {ncrReports.length === 0 ? <p className="text-gray-500 italic">No NCRs to review.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white">
                  <tr>
                    <th className="p-3 border border-gray-300 w-24 text-center">Source</th>
                    <th className="p-3 border border-gray-300">Date</th>
                    <th className="p-3 border border-gray-300">Machine</th>
                    <th className="p-3 border border-gray-300">NC Details</th>
                    <th className="p-3 border border-gray-300">Responsibility</th>
                    <th className="p-3 border border-gray-300">Status</th>
                    <th className="p-3 border border-gray-300 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {ncrReports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-red-50">
                      <td className="p-3 border border-gray-300 text-center font-bold uppercase text-[10px] tracking-wider">
                        {report.source === 'LPA' 
                          ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">LPA</span> 
                          : <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded">Checklist</span>}
                      </td>
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.ReportDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.DisaMachine}</td>
                      <td className="p-3 border border-gray-300 text-sm">{report.NonConformityDetails}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.Responsibility}</td>
                      <td className="p-3 border border-gray-300">
                        {report.Status === 'Completed' 
                          ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Completed</span> 
                          : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending</span>}
                      </td>
                      <td className="p-3 border border-gray-300 text-center">
                        {report.Status !== 'Completed' && (
                          <button onClick={() => setSelectedNcrReport(report)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">
                            Verify & Sign
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 5: DMM SETTING PARAMETERS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-indigo-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold text-gray-800">DMM Setting Parameters</h1></div>
          {dmmReports.length === 0 ? <p className="text-gray-500 italic">No DMM Setting forms pending your signature.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Shift</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Operator</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {dmmReports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">Shift {report.shift}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.OperatorName || "N/A"}</td>
                      <td className="p-3 border border-gray-300">{report.SupervisorSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.SupervisorSignature && <button onClick={() => handleOpenDmmModal(report)} className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

       {/* SECTION 6: 4M CHANGE MONITORING */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-green-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold text-gray-800">4M Change Monitoring</h1></div>
          {fourMReports.length === 0 ? <p className="text-gray-500 italic">No 4M Change forms pending your signature.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300 w-20 text-center">ID</th><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Part Name</th><th className="p-3 border border-gray-300">4M Type</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {fourMReports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-green-50">
                      <td className="p-3 border border-gray-300 text-center font-bold text-gray-400">#{report.id}</td>
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.recordDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">{report.partName || "N/A"}</td>
                      <td className="p-3 border border-gray-300">{report.type4M || "N/A"}</td>
                      <td className="p-3 border border-gray-300">{report.SupervisorSignature ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending Review</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{!report.SupervisorSignature && <button onClick={() => handleOpenFourMModal(report)} className="bg-green-500 hover:bg-green-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 7: ERROR PROOF REACTION PLANS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-yellow-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-800">Error Proof Reaction Plans</h1>
          </div>
          {errorReports.length === 0 ? (
            <p className="text-gray-500 italic">No Reaction Plans pending your approval.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white">
                  <tr><th className="p-3 border border-gray-300 w-20 text-center">ID</th><th className="p-3 border border-gray-300">Date/Shift</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Error Proof</th><th className="p-3 border border-gray-300 w-20 text-center">Source</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
                </thead>
                <tbody>
                  {errorReports.map((report, idx) => {
                    const status = report.Status || report.status;
                    return (
                      <tr key={idx} className="hover:bg-yellow-50">
                        <td className="p-3 border border-gray-300 text-center font-bold text-gray-400">#{report.ReactionPlanId || report.reportId || report.VerificationId}</td>
                        <td className="p-3 border border-gray-300 font-bold">{report.VerificationDateShift || report.shift || formatDate(report.recordDate || report.RecordDate)}</td>
                        <td className="p-3 border border-gray-300 font-bold">{report.DisaMachine || report.disaMachine || report.line}</td>
                        <td className="p-3 border border-gray-300">{report.ErrorProofName || report.errorProofName}</td>
                        <td className="p-3 border border-gray-300 text-center">{report._source === 'v2' ? <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-bold">V2</span> : <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-bold">V1</span>}</td>
                        <td className="p-3 border border-gray-300">{status === 'Completed' ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Completed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending</span>}</td>
                        <td className="p-3 border border-gray-300 text-center">
                          {status !== 'Completed' && (
                            <button onClick={() => handleOpenErrorModal(report)} className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">
                              Review & Sign
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 8: MOULDING QUALITY INSPECTION */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-purple-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-800">Moulding Quality Inspection</h1>
          </div>
          {mouldQualityReports.length === 0 ? <p className="text-gray-500 italic">No Moulding Quality reports pending.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300 w-20 text-center">ID</th><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Operator</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {mouldQualityReports.map((report) => (
                    <tr key={report.id} className="hover:bg-purple-50">
                      <td className="p-3 border border-gray-300 text-center font-bold text-gray-400">#{report.id}</td>
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disaMachine}</td>
                      <td className="p-3 border border-gray-300">{report.verifiedBy}</td>
                      <td className="p-3 border border-gray-300">{report.status === 'Completed' ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Signed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{report.status !== 'Completed' && <button onClick={() => handleOpenMQModal(report)} className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* ========================================================================================= */}
      {/* 🟢 FULL-SCREEN PDF MODALS */}
      {/* ========================================================================================= */}

      {/* 1. DISAMATIC MODAL */}
      {selectedDisaReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Sign Disamatic Report</h3>
            <button onClick={() => { setSelectedDisaReport(null); setDisaPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isDisaPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {disaPdfUrl && <iframe src={`${disaPdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                  <div className="bg-orange-100 p-4 rounded-xl border border-orange-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-orange-900">
                    <p><span className="font-bold">Report ID:</span> #{selectedDisaReport.id}</p>
                    <p><span className="font-bold">Date:</span> {formatDate(selectedDisaReport.reportDate)}</p>
                    <p><span className="font-bold">Shift:</span> {selectedDisaReport.shift}</p>
                    <p><span className="font-bold">DISA:</span> {selectedDisaReport.disa}</p>
                  </div>
                  
                  <div className="mt-auto">
                      <button onClick={submitDisaSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve Report
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. DAILY PERFORMANCE MODAL */}
      {selectedDpReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Sign Daily Performance Report</h3>
            <button onClick={() => { setSelectedDpReport(null); setDpPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isDpPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {dpPdfUrl && <iframe src={`${dpPdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                  <div className="bg-teal-100 p-4 rounded-xl border border-teal-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-teal-900">
                    <p><span className="font-bold">Report ID:</span> #{selectedDpReport.id}</p>
                    <p><span className="font-bold">Date:</span> {formatDate(selectedDpReport.productionDate)}</p>
                    <p><span className="font-bold">DISA:</span> {selectedDpReport.disa}</p>
                  </div>
                  
                  <div className="mt-auto">
                      <button onClick={submitDpSignature} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve Report
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. BOTTOM LEVEL AUDIT MODAL */}
      {selectedBottomReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Approve Bottom Level Audit</h3>
            <button onClick={() => { setSelectedBottomReport(null); setBottomPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isBottomPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {bottomPdfUrl && <iframe src={`${bottomPdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                  <div className="bg-blue-100 p-4 rounded-xl border border-blue-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-blue-900">
                    <p><span className="font-bold">Time Submitted:</span> {formatTime(selectedBottomReport.submittedAt)}</p>
                    <p><span className="font-bold">Date:</span> {formatDate(selectedBottomReport.reportDate)}</p>
                    <p><span className="font-bold">Machine:</span> {selectedBottomReport.disa}</p>
                  </div>
                  
                  <div className="mt-auto">
                      <button onClick={submitBottomSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve Report
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. DMM SETTINGS MODAL */}
      {selectedDmmReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Approve DMM Settings</h3>
            <button onClick={() => { setSelectedDmmReport(null); setDmmPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isDmmPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {dmmPdfUrl && <iframe src={`${dmmPdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                  <div className="bg-indigo-100 p-4 rounded-xl border border-indigo-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-indigo-900">
                    <p><span className="font-bold">Date:</span> {formatDate(selectedDmmReport.reportDate)}</p>
                    <p><span className="font-bold">Shift:</span> Shift {selectedDmmReport.shift}</p>
                    <p><span className="font-bold">Machine:</span> {selectedDmmReport.disa}</p>
                  </div>
                  
                  {/* SignatureCanvas Removed! */}

                  <div className="mt-auto">
                      <button onClick={submitDmmSignature} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve Report
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. 4M CHANGE MODAL */}
      {selectedFourMReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Approve 4M Change Report</h3>
            <button onClick={() => { setSelectedFourMReport(null); setFourMPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isFourMPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {fourMPdfUrl && <iframe src={`${fourMPdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                  <div className="bg-green-100 p-4 rounded-xl border border-green-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-green-900">
                    <p><span className="font-bold">Report ID:</span> #{selectedFourMReport.id}</p>
                    <p><span className="font-bold">Date:</span> {formatDate(selectedFourMReport.recordDate)}</p>
                    <p><span className="font-bold">Machine:</span> {selectedFourMReport.disa}</p>
                    <p><span className="font-bold">Type:</span> {selectedFourMReport.type4M}</p>
                  </div>
                  
                  <div className="mt-auto">
                      <button onClick={submitFourMSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve Report
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 7. ERROR PROOF MODAL */}
      {selectedErrorReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Approve Reaction Plan</h3>
            <button onClick={() => { setSelectedErrorReport(null); setErrorPdfUrl(null); setIsErrorApproved(false); }} className="text-gray-400 hover:text-red-400 transition-colors">
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
                  <div className="bg-yellow-100 p-4 rounded-xl border border-yellow-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-yellow-900">
                    <p><span className="font-bold">Report ID:</span> #{selectedErrorReport.ReactionPlanId || selectedErrorReport.reportId || selectedErrorReport.VerificationId}</p>
                    <p><span className="font-bold">Machine:</span> {selectedErrorReport.DisaMachine || selectedErrorReport.disaMachine || selectedErrorReport.line}</p>
                    <p><span className="font-bold">Problem:</span> {selectedErrorReport.Problem || selectedErrorReport.problem}</p>
                    <p><span className="font-bold">Action Taken:</span> {selectedErrorReport.CorrectiveAction || selectedErrorReport.correctiveAction}</p>
                  </div>
                  <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all select-none mb-8 ${
                    isErrorApproved
                      ? 'bg-green-50 border-green-500 shadow-md' 
                      : 'bg-white border-gray-300 hover:border-yellow-400 hover:bg-yellow-50'
                  }`}>
                    <input 
                      type="checkbox" 
                      checked={isErrorApproved} 
                      onChange={(e) => setIsErrorApproved(e.target.checked)} 
                      className="w-5 h-5 accent-green-600 cursor-pointer" 
                    />
                    <span className="font-bold text-gray-800 select-none">I approve this Reaction Plan</span>
                    {isErrorApproved && <CheckCircle className="text-green-600 ml-auto" size={20} />}
                  </label>
                  <div className="mt-auto">
                      <button onClick={submitErrorSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve Reaction Plan
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

  
      {/* 8. MOULD QUALITY MODAL */}
      {selectedMQReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Approve Mould Quality Report</h3>
            <button onClick={() => { setSelectedMQReport(null); setMqPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors"><X size={28} /></button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {mqPdfUrl ? <iframe src={`${mqPdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none" title="PDF" /> : <Loader className="animate-spin text-white w-12 h-12" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl p-6">
              <div className="bg-purple-100 p-4 rounded-xl border border-purple-200 mb-6 text-sm text-purple-900 space-y-2 shadow-sm">
                <p><span className="font-bold">Report ID:</span> #{selectedMQReport.id}</p>
                <p><span className="font-bold">Date:</span> {formatDate(selectedMQReport.reportDate)}</p>
                <p><span className="font-bold">Operator:</span> {selectedMQReport.verifiedBy}</p>
              </div>
              
              <button onClick={submitMQSignature} className="mt-auto w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                Approve Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NCR Modal */}
      {selectedNcrReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg">Verify Non-Conformance Report</h3>
              <button onClick={() => setSelectedNcrReport(null)} className="text-red-200 hover:text-white font-bold text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 overflow-y-auto">
               <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6 flex flex-col gap-3 text-sm text-gray-800">
                  <div className="flex justify-between border-b border-red-200 pb-2">
                      <p><span className="font-bold">Source:</span> {selectedNcrReport.source}</p>
                      <p><span className="font-bold">Date:</span> {formatDate(selectedNcrReport.ReportDate)}</p>
                      <p><span className="font-bold">Machine:</span> {selectedNcrReport.DisaMachine}</p>
                  </div>
                  <p><span className="font-bold">NC Details:</span> {selectedNcrReport.NonConformityDetails || 'N/A'}</p>
                  <p><span className="font-bold">Correction:</span> {selectedNcrReport.Correction || 'N/A'}</p>
                  <p><span className="font-bold">Root Cause:</span> {selectedNcrReport.RootCause || 'N/A'}</p>
                  <p><span className="font-bold">Corrective Action:</span> {selectedNcrReport.CorrectiveAction || 'N/A'}</p>
               </div>
               
               <div className="flex flex-col gap-3 mt-4">
                 <button onClick={submitNcrSignature} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-bold shadow-md text-lg tracking-wider uppercase transition-transform hover:-translate-y-1">
                   Approve & Complete NCR
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Supervisor;