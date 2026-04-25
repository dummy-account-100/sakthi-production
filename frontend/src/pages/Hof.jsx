import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Header from "../components/Header";
import SignatureCanvas from "react-signature-canvas";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader, X } from "lucide-react";
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

// 🔥 DATE FORMATTER FOR PDF 🔥
const formatDate = (dateString) => { 
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-GB"); 
};

// 🔥 BASE COLUMNS FOR UNPOURED MOULDS PDF GENERATION
const unpouredBaseColumns = [
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

// 🔥 BASE COLUMNS FOR DMM SETTING PDF GENERATION
const dmmBaseColumns = [
  { key: 'Customer', label: 'CUSTOMER', width: 'w-32', inputType: 'text' },
  { key: 'ItemDescription', label: 'ITEM\nDESCRIPTION', width: 'w-40', inputType: 'text' },
  { key: 'Time', label: 'TIME', width: 'w-24', inputType: 'time' },
  { key: 'PpThickness', label: 'PP\nTHICKNESS\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'PpHeight', label: 'PP\nHEIGHT\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'SpThickness', label: 'SP\nTHICKNESS\n(mm)', width: 'w-20', inputType: 'number' },
  { key: 'SpHeight', label: 'SP\nHEIGHT\n(mm)', width: 'w-20', inputType: 'number' },
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

const Hof = () => {
  const [reports, setReports] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const sigCanvas = useRef({});
  
const [errorReports, setErrorReports] = useState([]);
  const [selectedErrorReport, setSelectedErrorReport] = useState(null);
  const [errorPdfUrl, setErrorPdfUrl] = useState(null);
  const [isErrorPdfLoading, setIsErrorPdfLoading] = useState(false);
  const [isErrorApproved, setIsErrorApproved] = useState(false);

  const [errorReportsV2, setErrorReportsV2] = useState([]);
  const [selectedErrorReportV2, setSelectedErrorReportV2] = useState(null);
  const [errorPdfUrlV2, setErrorPdfUrlV2] = useState(null);
  const [isErrorPdfLoadingV2, setIsErrorPdfLoadingV2] = useState(false);
  const [isErrorV2Approved, setIsErrorV2Approved] = useState(false);

  // States for Daily Production Performance
  const [dailyReports, setDailyReports] = useState([]);
  const [selectedDailyReport, setSelectedDailyReport] = useState(null);
  const [dailyPdfUrl, setDailyPdfUrl] = useState(null);
  const [isDailyPdfLoading, setIsDailyPdfLoading] = useState(false);


  // States for Unpoured Mould Details (VIEW ONLY)
  const [unpouredReports, setUnpouredReports] = useState([]);
  const [selectedUnpouredReport, setSelectedUnpouredReport] = useState(null);
  const [unpouredPdfUrl, setUnpouredPdfUrl] = useState(null);
  const [isUnpouredPdfLoading, setIsUnpouredPdfLoading] = useState(false);

  // 🔥 NEW: States for DMM Setting Parameters (VIEW ONLY)
  const [dmmReports, setDmmReports] = useState([]);
  const [selectedDmmReport, setSelectedDmmReport] = useState(null);
  const [dmmPdfUrl, setDmmPdfUrl] = useState(null);
  const [isDmmPdfLoading, setIsDmmPdfLoading] = useState(false);

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentHOF = storedUser.username || "hof_user";

  const API_BASE_BOTTOM_AUDIT = `${API_BASE}/bottom-level-audit`;
  const ERR_API_BASE = `${API_BASE}/error-proof`;
  const ERR_API_BASE_V2 = `${API_BASE}/error-proof2`; 
  const DAILY_API_BASE = `${API_BASE}/daily-performance`; 
  const UNPOURED_API_BASE = `${API_BASE}/unpoured-moulds`; 
  const DMM_API_BASE = `${API_BASE}/dmm-settings`; // 🔥 ADDED

  useEffect(() => {
    fetchReports();
    fetchErrorReports();
    fetchErrorReportsV2(); 
    fetchDailyReports(); 
    fetchUnpouredReports(); 
    fetchDmmReports(); // 🔥 ADDED
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${API_BASE_BOTTOM_AUDIT}/hof/${currentHOF}`);
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

  const fetchDailyReports = async () => {
    try {
      const res = await axios.get(`${DAILY_API_BASE}/hof/${currentHOF}`);
      setDailyReports(res.data);
    } catch (err) { toast.error("Failed to load Daily Performance reports."); }
  };

  const fetchUnpouredReports = async () => {
    try {
      const res = await axios.get(`${UNPOURED_API_BASE}/hof-reports/${currentHOF}`);
      setUnpouredReports(res.data);
    } catch (err) { toast.error("Failed to load Unpoured Mould reports."); }
  };

  // 🔥 NEW: Fetch DMM Settings
  const fetchDmmReports = async () => {
    try {
      const res = await axios.get(`${DMM_API_BASE}/hof-reports/${currentHOF}`);
      setDmmReports(res.data);
    } catch (err) { toast.error("Failed to load DMM Settings reports."); }
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
    try {
      await axios.post(`${DAILY_API_BASE}/sign-hof`, { reportId: selectedDailyReport.id, signature: "Approved" });
      toast.success("Daily Performance Report approved!");
      setSelectedDailyReport(null); 
      fetchDailyReports(); 
    } catch (err) { toast.error("Failed to save Daily Performance approval."); }
  };

const handleOpenSignModal = async (report) => {
    setSelectedReport(report); setPdfUrl(null); setIsPdfLoading(true);
    try {
      const month = report.month; const year = report.year; const disaMachine = report.disa;
      const monthlyRes = await axios.get(`${API_BASE_BOTTOM_AUDIT}/monthly-report`, { params: { month, year, disaMachine } });
      const monthlyLogs = monthlyRes.data.monthlyLogs || [];
      const ncReports = monthlyRes.data.ncReports || [];
      const qfHistory = monthlyRes.data.qfHistory || []; 

      const todayStr = new Date().toISOString().split('T')[0];
      const detailsRes = await axios.get(`${API_BASE_BOTTOM_AUDIT}/details`, { params: { date: todayStr, disaMachine } });
      const checklist = detailsRes.data.checklist;
      
      const historyMap = {}; const holidayDays = new Set(); const vatDays = new Set(); const pmDays = new Set();
      const supSigMap = {}; const hofSig = report.hofSignature;

      monthlyLogs.forEach(log => {
        const logDay = log.DayVal; const key = String(log.MasterId); 
        if (Number(log.IsHoliday) === 1) holidayDays.add(logDay);
        if (Number(log.IsVatCleaning) === 1) vatDays.add(logDay);
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
               if (hofSig && String(hofSig).trim().toUpperCase() === "APPROVED") {
                   const cx = data.cell.x + data.cell.width / 2;
                   const cy = data.cell.y + data.cell.height / 2;
                   doc.setDrawColor(0, 128, 0); doc.setLineWidth(0.5);
                   doc.line(cx - 2, cy - 1.5, cx - 0.5, cy + 0.5);
                   doc.line(cx - 0.5, cy + 0.5, cx + 2.5, cy - 2.5);
                   doc.setDrawColor(0, 0, 0);
                   doc.setFontSize(5); doc.setTextColor(0, 128, 0); doc.setFont('helvetica', 'bold');
                   doc.text("APPROVED", cx, cy + 2.5, { align: 'center' });
                   doc.setFont('helvetica', 'normal'); doc.setTextColor(0, 0, 0);
               } else if (hofSig && hofSig.startsWith('data:image')) { 
                   try { doc.addImage(hofSig, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2); } catch(e){} 
               }
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
      doc.setFont('helvetica', 'normal'); doc.text("Remarks: If Nonconformity please write on NCR format (back-side)", 10, doc.lastAutoTable.finalY + 12); 
      
      const reportDateObjStr = `${year}-${String(month).padStart(2, '0')}-01`;
      const dynamicQf = getDynamicQfString(reportDateObjStr, qfHistory, "QF/08/MRO - 18, Rev No: 02 dt 01.01.2022");
      doc.text(dynamicQf, 10, 200); 
      doc.text("Page 1 of 2", 270, 200);

      const pdfBlobUrl = doc.output('bloburl'); setPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate PDF preview."); }
    setIsPdfLoading(false);
  };

const submitSignature = async () => {
    try {
      await axios.post(`${API_BASE_BOTTOM_AUDIT}/sign-hof`, { 
        month: selectedReport.month, 
        year: selectedReport.year, 
        disaMachine: selectedReport.disa, 
        signature: "APPROVED" 
      });
      toast.success("Monthly Audit approved and signed!");
      setSelectedReport(null); fetchReports(); 
    } catch (err) { toast.error("Failed to save signature."); }
  };
const handleOpenErrorModal = async (report) => {
    setSelectedErrorReport(report); 
    setErrorPdfUrl(null); 
    setIsErrorApproved(false);
    setIsErrorPdfLoading(true);
    try {
      const reportDateStr = new Date(report.reportDate).toISOString().split('T')[0];
      const response = await axios.get(`${ERR_API_BASE}/report`, { params: { line: report.disa, date: reportDateStr }, responseType: 'blob' });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setErrorPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate Error Proof PDF."); }
    setIsErrorPdfLoading(false);
  };

  const submitErrorSignature = async () => {
    if (!isErrorApproved) { toast.warning("Please check the box to approve."); return; }
    const dateStr = new Date(selectedErrorReport.reportDate).toISOString().split('T')[0];
    try {
      await axios.post(`${ERR_API_BASE}/sign-hof`, { date: dateStr, line: selectedErrorReport.disa, signature: "Approved" });
      toast.success("Error Proof Report verified and signed!");
      setSelectedErrorReport(null); fetchErrorReports(); 
    } catch (err) { toast.error("Failed to save Error Proof signature."); }
  };

  const handleOpenErrorModalV2 = async (report) => {
    setSelectedErrorReportV2(report); 
    setErrorPdfUrlV2(null); 
    setIsErrorV2Approved(false);
    setIsErrorPdfLoadingV2(true);
    
    try {
      const reportDateStr = new Date(report.reportDate).toISOString().split('T')[0];
      const displayDate = formatDate(report.reportDate);
      const machine = report.disa;

      const res = await axios.get(`${ERR_API_BASE_V2}/details`, { params: { machine, date: reportDateStr } });
      const masterData = res.data.masterConfig || [];
      const transData = res.data.verifications || [];
      const reactionPlans = res.data.reactionPlans || [];
      const qfHistory = res.data.qfHistory || [];

      const verifications = [];
      if (transData.length > 0) {
        transData.forEach((transItem, index) => {
          const masterItem = masterData[index];
          verifications.push({
            ...transItem,
            Line: masterItem ? masterItem.Line : transItem.Line,
            ErrorProofName: masterItem ? masterItem.ErrorProofName : transItem.ErrorProofName,
            NatureOfErrorProof: masterItem ? masterItem.NatureOfErrorProof : transItem.NatureOfErrorProof,
            Frequency: masterItem ? masterItem.Frequency : transItem.Frequency,
          });
        });
      }

      const doc = new jsPDF('l', 'mm', 'a4');
      const PAGE_HEIGHT = doc.internal.pageSize.getHeight();

      let currentPageQfValue = "QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023";
      const repDateObj = new Date(reportDateStr);
      repDateObj.setHours(0, 0, 0, 0);

      for (let qf of qfHistory) {
          if (!qf.date) continue;
          const qfDateObj = new Date(qf.date);
          qfDateObj.setHours(0, 0, 0, 0);
          if (qfDateObj <= repDateObj) {
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

      doc.rect(50, 10, 187, 20);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text("ERROR PROOF VERIFICATION CHECK LIST - FDY", 143.5, 22, { align: 'center' });

      doc.rect(237, 10, 50, 20);
      doc.setFontSize(11);
      doc.text(machine, 262, 16, { align: 'center' });
      doc.line(237, 20, 287, 20);
      doc.setFontSize(10);
      doc.text(`Date: ${displayDate}`, 262, 26, { align: 'center' });

      const mainHead = [
        [
          { content: 'Line', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Error Proof Name', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Nature of Error Proof', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Frequency', rowSpan: 3, styles: { halign: 'center', valign: 'middle', cellWidth: 15 } },
          { content: `Date: ${displayDate}`, colSpan: 3, styles: { halign: 'center', fillColor: [240, 240, 240] } }
        ],
        [{ content: 'I Shift', styles: { halign: 'center' } }, { content: 'II Shift', styles: { halign: 'center' } }, { content: 'III Shift', styles: { halign: 'center' } }],
        [{ content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }, { content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }, { content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }]
      ];

      const mainBody = verifications.map(row => {
        const pdfRow = [row.Line || '-', row.ErrorProofName || '-', row.NatureOfErrorProof || '-', row.Frequency || '-'];
        [1, 2, 3].forEach(s => { const res = row[`Date1_Shift${s}_Res`] || '-'; pdfRow.push(res); });
        return pdfRow;
      });

      autoTable(doc, {
        startY: 35, margin: { left: 10, right: 10 }, head: mainHead, body: mainBody, theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 45 }, 2: { cellWidth: 70 } }
      });

      let finalY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');

      doc.text("Verified By Moulding Incharge", 20, finalY);
      doc.rect(20, finalY + 2, 40, 15);
      const opSigToDraw = transData.length > 0 ? transData[0].OperatorSignature : '';
      if (opSigToDraw && opSigToDraw.startsWith('data:image')) {
        doc.addImage(opSigToDraw, 'PNG', 21, finalY + 3, 38, 13);
      } else if (opSigToDraw === "Approved" || opSigToDraw === "Submitted") {
        // --- FIX 2 HERE ---
        doc.setDrawColor(22, 163, 74);
        doc.setLineWidth(0.8);
        doc.line(22, finalY + 10, 24, finalY + 12);
        doc.line(24, finalY + 12, 28, finalY + 6);

        doc.setTextColor(22, 163, 74);
        doc.setFont('helvetica', 'bold');
        doc.text("APPROVED", 31, finalY + 11);
        doc.setTextColor(0, 0, 0); doc.setDrawColor(0, 0, 0);
      }

      doc.text("Reviewed By HOF", 130, finalY);
      doc.rect(130, finalY + 2, 40, 15);
      const hofSigToDraw = report.hofSignature; 
      if (hofSigToDraw && hofSigToDraw.startsWith('data:image')) {
        doc.addImage(hofSigToDraw, 'PNG', 131, finalY + 3, 38, 13);
      } else if (hofSigToDraw === "Approved") {
        // --- FIX 3 HERE ---
        doc.setDrawColor(22, 163, 74);
        doc.setLineWidth(0.8);
        doc.line(132, finalY + 10, 134, finalY + 12);
        doc.line(134, finalY + 12, 138, finalY + 6);

        doc.setTextColor(22, 163, 74);
        doc.setFont('helvetica', 'bold');
        doc.text("APPROVED", 141, finalY + 11);
        doc.setTextColor(0, 0, 0); doc.setDrawColor(0, 0, 0);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.text("Pending", 143, finalY + 10);
      }

      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(currentPageQfValue, 10, PAGE_HEIGHT - 10);

      if (reactionPlans.length > 0) {
        doc.addPage();
        
        doc.setLineWidth(0.3);
        doc.rect(10, 10, 40, 20);
        try { doc.addImage(logo, 'PNG', 12, 11, 36, 18); } catch (err) {
          doc.setFontSize(14); doc.setFont('helvetica', 'bold');
          doc.text("SAKTHI", 30, 18, { align: 'center' }); 
          doc.text("AUTO", 30, 26, { align: 'center' });
        }

        doc.rect(50, 10, 187, 20);
        doc.setFontSize(15); doc.setFont('helvetica', 'bold');
        doc.text("REACTION PLAN", 143.5, 22, { align: 'center' });

        doc.rect(237, 10, 50, 20);
        doc.setFontSize(11);
        doc.text(machine, 262, 16, { align: 'center' });
        doc.line(237, 20, 287, 20);
        doc.setFontSize(10);
        doc.text(`Date: ${displayDate}`, 262, 26, { align: 'center' });

        const planHead = [['S.No', 'Error Proof No', 'Error Proof Name', 'Verification Date / Shift', 'Problem', 'Root Cause', 'Corrective Action', 'Status', 'Reviewed By (Op)', 'Approved By (Sup)', 'Remarks']];
        const planBody = reactionPlans.map((p, i) => [
          i + 1, p.ErrorProofNo || '-', p.ErrorProofName, p.VerificationDateShift, p.Problem, p.RootCause, p.CorrectiveAction, p.Status,
          p.ReviewedBy || '-', p.SupervisorSignature || p.ApprovedBy || '-', p.Remarks || '-'
        ]);

        autoTable(doc, {
          startY: 35, margin: { left: 5, right: 5 }, head: planHead, body: planBody, theme: 'grid',
          styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
          headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
          columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 15 }, 2: { cellWidth: 35 }, 3: { cellWidth: 25 }, 4: { cellWidth: 30 } },
          didDrawCell: function (data) {
            if (data.section === 'body' && data.column.index === 9) {
              const sig = reactionPlans[data.row.index].SupervisorSignature;
              if (sig && sig.startsWith('data:image')) {
                doc.addImage(sig, 'PNG', data.cell.x + 1, data.cell.y + 1, data.cell.width - 2, data.cell.height - 2);
              } else if (sig === "Approved") {
                // --- FIX 4 HERE ---
                const tx = data.cell.x + 2;
                const ty = data.cell.y + 4;
                doc.setDrawColor(22, 163, 74);
                doc.setLineWidth(0.5);
                doc.line(tx, ty, tx + 1.2, ty + 1.2);
                doc.line(tx + 1.2, ty + 1.2, tx + 3.5, ty - 1.5);

                doc.setTextColor(22, 163, 74);
                doc.setFont('helvetica', 'bold');
                doc.text("APPROVED", data.cell.x + 6, data.cell.y + 5);
                doc.setTextColor(0, 0, 0); doc.setDrawColor(0, 0, 0);
              }
            }
          },
          didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 9) {
              const textVal = data.cell.text[0];
              if (textVal && (textVal.startsWith('data:image') || textVal === "Approved")) {
                data.cell.text = '';
              }
            }
          }
        });

        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.text(currentPageQfValue, 10, PAGE_HEIGHT - 10);
      }

      const pdfBlobUrl = doc.output('bloburl');
      setErrorPdfUrlV2(pdfBlobUrl);

    } catch (error) { toast.error("Failed to generate Error Proof V2 PDF."); }
    setIsErrorPdfLoadingV2(false);
  };

  const submitErrorSignatureV2 = async () => {
    if (!isErrorV2Approved) { toast.warning("Please check the box to approve."); return; }
    const dateStr = selectedErrorReportV2.reportDate;
    try {
      await axios.post(`${ERR_API_BASE_V2}/sign-hof`, { date: dateStr, line: selectedErrorReportV2.disa, signature: "Approved" });
      toast.success("Error Proof V2 Report verified and signed!");
      setSelectedErrorReportV2(null); fetchErrorReportsV2(); 
    } catch (err) { toast.error("Failed to save Error Proof V2 signature."); }
  };

  // =======================================================================
  // 🔥 UNPOURED MOULD DETAILS VERIFICATION PDF GENERATION 
  // =======================================================================
  const handleOpenUnpouredModal = async (report) => {
    setSelectedUnpouredReport(report); 
    setUnpouredPdfUrl(null); 
    setIsUnpouredPdfLoading(true);

    try {
      const dateStr = getSafeDateStr(report.reportDate);
      const disaMachine = report.disa;

      const [detailsRes, summaryRes, configRes] = await Promise.all([
        axios.get(`${UNPOURED_API_BASE}/details`, { params: { date: dateStr, disa: disaMachine } }),
        axios.get(`${UNPOURED_API_BASE}/summary`, { params: { date: dateStr } }),
        axios.get(`${API_BASE}/config/unpoured-mould-details/master`)
      ]);

      const customCols = (configRes.data.config || []).map(c => ({
        key: `custom_${c.id}`, id: c.id, label: c.reasonName.toUpperCase().replace(' ', '\n'),
        group: c.department.toUpperCase(), isCustom: true
      }));

      const mergedColumns = [...unpouredBaseColumns, ...customCols];
      let currentGroup = mergedColumns[0]?.group;
      for (let i = 1; i < mergedColumns.length; i++) {
        if (mergedColumns[i].group !== currentGroup) {
          mergedColumns[i - 1].isLastInGroup = true;
          currentGroup = mergedColumns[i].group;
        }
      }
      if (mergedColumns.length > 0) mergedColumns[mergedColumns.length - 1].isLastInGroup = true;

      const shiftsData = { 1: {}, 2: {}, 3: {} };
      [1, 2, 3].forEach(shift => {
        const dbShift = detailsRes.data.shiftsData[shift] || {};
        shiftsData[shift] = { customValues: {}, operatorSignature: dbShift.operatorSignature || '' };
        mergedColumns.forEach(col => {
          if (col.isCustom) shiftsData[shift].customValues[col.id] = (dbShift.customValues?.[col.id] !== undefined && dbShift.customValues?.[col.id] !== null) ? dbShift.customValues[col.id] : '-';
          else shiftsData[shift][col.key] = (dbShift[col.key] !== undefined && dbShift[col.key] !== null) ? dbShift[col.key] : '-';
        });
      });

      const unpouredSummary = summaryRes.data.summary || [];
      const qfHistory = summaryRes.data.qfHistory || [];

      const getRowTotal = (shift) => mergedColumns.reduce((sum, col) => { const val = col.isCustom ? shiftsData[shift].customValues[col.id] : shiftsData[shift][col.key]; return sum + (parseInt(val) || 0); }, 0);
      const getColTotal = (col) => [1, 2, 3].reduce((sum, shift) => { const val = col.isCustom ? shiftsData[shift].customValues[col.id] : shiftsData[shift][col.key]; return sum + (parseInt(val) || 0); }, 0);
      const getGrandTotal = () => [1, 2, 3].reduce((sum, shift) => sum + getRowTotal(shift), 0);
      const getDisaData = (dName) => unpouredSummary.find(d => d.disa === dName) || {};
      const getSummarySum = (key) => unpouredSummary.reduce((acc, curr) => acc + (Number(curr[key]) || 0), 0);
      const totalProduced = getSummarySum("producedMould");
      const totalPoured = getSummarySum("pouredMould");
      const totalUnpoured = getSummarySum("unpouredMould");
      const totalPercentage = totalProduced > 0 ? ((totalUnpoured / totalProduced) * 100).toFixed(2) : 0;
      const totalDelays = getSummarySum("delays");
      const totalRunningHours = getSummarySum("runningHours").toFixed(2);

      const doc = new jsPDF('l', 'mm', 'a4');
      const currentPageQfValue = getDynamicQfString(dateStr, qfHistory, "QF/07/FBP-13, Rev.No:06 dt 08.10.2025");

      doc.setLineWidth(0.3);
      doc.rect(10, 10, 40, 20);
      try { doc.addImage(logo, 'PNG', 12, 11, 36, 18); } catch (err) {
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
      }

      doc.rect(50, 10, 197, 20);
      doc.setFontSize(16); doc.setFont('helvetica', 'bold');
      doc.text("UN POURED MOULD DETAILS", 148.5, 22, { align: 'center' });

      doc.rect(247, 10, 40, 20);
      doc.setFontSize(11);
      doc.text(disaMachine, 267, 16, { align: 'center' });
      doc.line(247, 20, 287, 20);
      doc.setFontSize(10);
      doc.text(`DATE: ${formatDate(dateStr)}`, 267, 26, { align: 'center' });

      const pdfGroups = [];
      mergedColumns.forEach(col => {
        if (pdfGroups.length === 0 || pdfGroups[pdfGroups.length - 1].name !== col.group) {
          pdfGroups.push({ name: col.group, count: 1 });
        } else { pdfGroups[pdfGroups.length - 1].count++; }
      });

      const headRow1 = [
        { content: 'SHIFT', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        ...pdfGroups.map(g => ({ content: g.name, colSpan: g.count, styles: { halign: 'center' } })),
        { content: 'TOTAL', rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [220, 220, 220] } }
      ];

      const headRow2 = mergedColumns.map(col => ({ content: col.label.replace(' ', '\n'), styles: { halign: 'center', valign: 'middle', fontSize: 5.5 } }));

      const bodyRows = [1, 2, 3].map(shift => {
        const row = [shift.toString()];
        mergedColumns.forEach(col => {
          const val = col.isCustom ? shiftsData[shift].customValues[col.id] : shiftsData[shift][col.key];
          row.push(val === '' || val === null || val === undefined ? '-' : val.toString());
        });
        row.push(getRowTotal(shift) === 0 ? '-' : getRowTotal(shift).toString());
        return row;
      });

      const totalRow = ['TOTAL'];
      mergedColumns.forEach(col => {
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
      if (sigY + 30 > 210) { doc.addPage(); sigY = 20; }

      const shiftLabels = ["1st shift", "2nd shift", "3rd shift"];
      const xPositions = [50, 148.5, 247]; 

      doc.setFontSize(10).setFont('helvetica', 'bold');
      [1, 2, 3].forEach((shift, index) => {
          const x = xPositions[index];
          doc.text(shiftLabels[index], x, sigY + 20, { align: 'center' });
          let sig = shiftsData[shift].operatorSignature;
          if (sig && sig.startsWith('data:image')) {
              try { doc.addImage(sig, 'PNG', x - 20, sigY, 40, 15); } catch (e) { }
          }
      });

      const summaryStartY = sigY + 30; 
      const summaryBodyRows = ['I', 'II', 'III', 'IV', 'V', 'VI'].map(disa => {
        const r = getDisaData(disa);
        return [
          disa, r.mouldCounterClose ?? '-', r.mouldCounterOpen ?? '-', r.producedMould ?? '0',
          r.pouredMould ?? '0', r.unpouredMould ?? '0', r.percentage !== undefined ? `${r.percentage}%` : '0%',
          r.delays ?? '0', r.producedMhr ?? '-', r.pouredMhr ?? '-', r.runningHours ?? '0'
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
      if (bottomTablesStartY + 40 > 210) { doc.addPage(); bottomTablesStartY = 20; }

      autoTable(doc, {
        startY: bottomTablesStartY, margin: { left: 5 }, tableWidth: 140, pageBreak: 'avoid',
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
        startY: bottomTablesStartY, margin: { left: 152 }, tableWidth: 140, pageBreak: 'avoid',
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

      const pdfBlobUrl = doc.output('bloburl');
      setUnpouredPdfUrl(pdfBlobUrl);

    } catch (error) { toast.error("Failed to generate Unpoured Moulds PDF."); }
    setIsUnpouredPdfLoading(false);
  };


  // =======================================================================
  // 🔥 NEW: DMM SETTING PARAMETERS PDF GENERATION (VIEW ONLY)
  // =======================================================================
  const handleOpenDmmModal = async (report) => {
    setSelectedDmmReport(report); 
    setDmmPdfUrl(null); 
    setIsDmmPdfLoading(true);

    try {
      const dateStr = getSafeDateStr(report.reportDate);
      const disaMachine = report.disa;

      const [detailsRes, configRes] = await Promise.all([
        axios.get(`${DMM_API_BASE}/details`, { params: { date: dateStr, disa: disaMachine } }),
        axios.get(`${API_BASE}/config/dmm-setting-parameters/master`)
      ]);

      const customCols = (configRes.data.config || []).map(c => ({
        key: `custom_${c.id}`, id: c.id, label: c.columnLabel.replace('\\n', '\n'),
        inputType: c.inputType, width: c.columnWidth, isCustom: true
      }));

      const mergedColumns = [...dmmBaseColumns, ...customCols];
      
      const shiftsData = detailsRes.data.shiftsData;
      const shiftsMeta = detailsRes.data.shiftsMeta;
      const qfHistory = detailsRes.data.qfHistory || [];

      const doc = new jsPDF('l', 'mm', 'a4');
      const currentPageQfValue = getDynamicQfString(dateStr, qfHistory, "QF/07/FBP-13, Rev.No:06 dt 08.10.2025");

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
      doc.text(disaMachine, 267, 16, { align: 'center' });
      doc.line(247, 20, 287, 20);
      doc.setFontSize(10);
      doc.text(`DATE: ${formatDate(dateStr)}`, 267, 26, { align: 'center' });

      autoTable(doc, {
        startY: 35, margin: { left: 10, right: 10 },
        head: [['SHIFT', 'OPERATOR NAME', 'VERIFIED BY', 'SIGNATURE']],
        body: [
          ['SHIFT I', shiftsMeta[1]?.operator || '-', shiftsMeta[1]?.supervisor || '-', ''],
          ['SHIFT II', shiftsMeta[2]?.operator || '-', shiftsMeta[2]?.supervisor || '-', ''],
          ['SHIFT III', shiftsMeta[3]?.operator || '-', shiftsMeta[3]?.supervisor || '-', '']
        ],
        theme: 'grid', styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
        didDrawCell: function (data) {
          if (data.section === 'body' && data.column.index === 3) {
            const shiftNum = data.row.index + 1;
            const sigData = shiftsMeta[shiftNum]?.supervisorSignature;
            if (sigData && sigData.startsWith('data:image')) {
              try { doc.addImage(sigData, 'PNG', data.cell.x + 2, data.cell.y + 1, data.cell.width - 4, data.cell.height - 2); } catch (e) { }
            }
          }
        }
      });

      let currentY = doc.lastAutoTable.finalY + 8;

      [1, 2, 3].forEach((shift, index) => {
        const isIdle = shiftsMeta[shift]?.isIdle;
        const shiftLabel = shift === 1 ? 'I' : shift === 2 ? 'II' : 'III';

        const tableHeader = [
          [{ content: `SHIFT ${shiftLabel}`, colSpan: mergedColumns.length + 1, styles: { halign: 'center', fontStyle: 'bold', fillColor: [200, 200, 200], textColor: [0, 0, 0] } }],
          [{ content: 'S.No', styles: { cellWidth: 8 } }, ...mergedColumns.map(col => ({ content: col.label, styles: { cellWidth: 'wrap' } }))]
        ];

        let tableBody = [];
        if (isIdle) {
          tableBody.push([{ content: 'L I N E   I D L E', colSpan: mergedColumns.length + 1, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 14, textColor: [100, 100, 100], fillColor: [245, 245, 245], minCellHeight: 15 } }]);
        } else if (shiftsData[shift] && shiftsData[shift].length > 0) {
          tableBody = shiftsData[shift].map((row, idx) => {
            const pdfRow = [(idx + 1).toString()];
            mergedColumns.forEach(col => {
              const val = col.isCustom ? row.customValues[col.id] : row[col.key];
              pdfRow.push(val === '' || val === null || val === undefined ? '-' : val.toString());
            });
            return pdfRow;
          });
        } else {
            tableBody.push([{ content: 'N / A', colSpan: mergedColumns.length + 1, styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', fontSize: 14, textColor: [100, 100, 100], fillColor: [250, 250, 250], minCellHeight: 15 } }]);
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

      const pdfBlobUrl = doc.output('bloburl');
      setDmmPdfUrl(pdfBlobUrl);

    } catch (error) { toast.error("Failed to generate DMM PDF."); }
    setIsDmmPdfLoading(false);
  };


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

        {/* SECTION 5: UNPOURED MOULD DETAILS (VIEW ONLY) */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-orange-500">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-800">Unpoured Mould Details</h1>
          </div>

          {unpouredReports.length === 0 ? (
            <p className="text-gray-500 italic">No Unpoured Mould reports found for your review.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead className="bg-gray-800 text-white">
                <tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
              </thead>
              <tbody>
                {unpouredReports.map((report, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-orange-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">Available for Review</span>
                      </td>
                      <td className="p-3 border border-gray-300 text-center">
                        <button onClick={() => handleOpenUnpouredModal(report)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">View Report</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* 🔥 SECTION 6: DMM SETTING PARAMETERS (VIEW ONLY) */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-amber-500">
          <div className="flex justify-between items-center mb-8 border-b pb-4">
            <h1 className="text-3xl font-bold text-gray-800">DMM Setting Parameters</h1>
          </div>

          {dmmReports.length === 0 ? (
            <p className="text-gray-500 italic">No DMM Setting reports found for your review.</p>
          ) : (
            <table className="w-full text-left border-collapse border border-gray-300">
              <thead className="bg-gray-800 text-white">
                <tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
              </thead>
              <tbody>
                {dmmReports.map((report, idx) => {
                  return (
                    <tr key={idx} className="hover:bg-amber-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.reportDate)}</td>
                      <td className="p-3 border border-gray-300 font-bold">{report.disa}</td>
                      <td className="p-3 border border-gray-300">
                        <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">Available for Review</span>
                      </td>
                      <td className="p-3 border border-gray-300 text-center">
                        <button onClick={() => handleOpenDmmModal(report)} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">View Report</button>
                      </td>
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
                
                <div className="mt-auto">
                  <button onClick={submitSignature} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Approve Monthly Audit
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
                
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">HOF Approval</label>
                <div 
                  className={`flex items-center gap-3 p-4 border-2 rounded-xl mb-6 shadow-inner cursor-pointer transition-colors ${isErrorApproved ? 'bg-indigo-50 border-indigo-400' : 'bg-white border-gray-300'}`} 
                  onClick={() => setIsErrorApproved(!isErrorApproved)}
                >
                  <input type="checkbox" checked={isErrorApproved} readOnly className="w-6 h-6 accent-indigo-600 pointer-events-none" />
                  <span className="font-bold text-gray-800 select-none">I approve this Error Proof report</span>
                </div>

                <div className="mt-auto">
                  <button onClick={submitErrorSignature} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Approve Report
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
                
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">HOF Approval</label>
                <div 
                  className={`flex items-center gap-3 p-4 border-2 rounded-xl mb-6 shadow-inner cursor-pointer transition-colors ${isErrorV2Approved ? 'bg-purple-50 border-purple-400' : 'bg-white border-gray-300'}`} 
                  onClick={() => setIsErrorV2Approved(!isErrorV2Approved)}
                >
                  <input type="checkbox" checked={isErrorV2Approved} readOnly className="w-6 h-6 accent-purple-600 pointer-events-none" />
                  <span className="font-bold text-gray-800 select-none">I approve this Error Proof report</span>
                </div>

                <div className="mt-auto">
                  <button onClick={submitErrorSignatureV2} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Approve Report
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
                
                <div className="mt-auto">
                  <button onClick={submitDailySignature} className="w-full bg-cyan-600 hover:bg-cyan-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Approve Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. UNPOURED MOULD DETAILS MODAL (VIEW ONLY) */}
      {selectedUnpouredReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">View Unpoured Mould Details</h3>
            <button onClick={() => { setSelectedUnpouredReport(null); setUnpouredPdfUrl(null); }} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              {isUnpouredPdfLoading && <Loader className="animate-spin text-white w-12 h-12 absolute" />}
              {unpouredPdfUrl && <iframe src={`${unpouredPdfUrl}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />}
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                <div className="bg-orange-100 p-4 rounded-xl border border-orange-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-orange-900">
                  <p><span className="font-bold">Date:</span> {formatDate(selectedUnpouredReport.reportDate)}</p>
                  <p><span className="font-bold">Machine:</span> {selectedUnpouredReport.disa}</p>
                </div>
                <div className="mt-auto">
                  <button onClick={() => { setSelectedUnpouredReport(null); setUnpouredPdfUrl(null); }} className="w-full bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Close Viewer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. 🔥 NEW: DMM SETTING PARAMETERS MODAL (VIEW ONLY) */}
      {selectedDmmReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">View DMM Setting Parameters</h3>
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
                <div className="bg-amber-100 p-4 rounded-xl border border-amber-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-amber-900">
                  <p><span className="font-bold">Date:</span> {formatDate(selectedDmmReport.reportDate)}</p>
                  <p><span className="font-bold">Machine:</span> {selectedDmmReport.disa}</p>
                </div>
                <div className="mt-auto">
                  <button onClick={() => { setSelectedDmmReport(null); setDmmPdfUrl(null); }} className="w-full bg-gray-600 hover:bg-gray-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                    Close Viewer
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