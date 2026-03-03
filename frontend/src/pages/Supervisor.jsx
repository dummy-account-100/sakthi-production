import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Header from "../components/Header";
import SignatureCanvas from "react-signature-canvas";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Loader, X } from "lucide-react"; 
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const Supervisor = () => {
  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
  const currentSupervisor = storedUser.username || "supervisor1";

  // --- States for Disamatic Report ---
  const [disaReports, setDisaReports] = useState([]);
  const [selectedDisaReport, setSelectedDisaReport] = useState(null);
  const disaSigCanvas = useRef({});

  // --- States for Bottom Level Audit ---
  const [bottomReports, setBottomReports] = useState([]);
  const [selectedBottomReport, setSelectedBottomReport] = useState(null);
  const [bottomPdfUrl, setBottomPdfUrl] = useState(null);
  const [isBottomPdfLoading, setIsBottomPdfLoading] = useState(false);
  const bottomSigCanvas = useRef({});

  // --- States for Non-Conformance Reports (NCR) ---
  const [ncrReports, setNcrReports] = useState([]);
  const [selectedNcrReport, setSelectedNcrReport] = useState(null);
  const ncrSigCanvas = useRef({});

  // --- States for DMM Setting Parameters ---
  const [dmmReports, setDmmReports] = useState([]);
  const [selectedDmmReport, setSelectedDmmReport] = useState(null);
  const [dmmPdfUrl, setDmmPdfUrl] = useState(null);
  const [isDmmPdfLoading, setIsDmmPdfLoading] = useState(false);
  const dmmSigCanvas = useRef({});

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
  const errorSigCanvas = useRef({});

  // --- States for Moulding Quality ---
  const [mouldQualityReports, setMouldQualityReports] = useState([]);
  const [selectedMQReport, setSelectedMQReport] = useState(null);
  const [mqPdfUrl, setMqPdfUrl] = useState(null);
  const mqSigCanvas = useRef({});

  useEffect(() => {
    fetchDisaReports();
    fetchBottomReports();
    fetchNcrReports(); 
    fetchDmmReports();
    fetchFourMReports();
    fetchErrorReports(); 
    fetchMouldQualityReports();
  }, []);

  const formatDate = (dateString) => { 
      if (!dateString) return "";
      return new Date(dateString).toLocaleDateString("en-GB"); 
  };

  const formatTime = (dateString) => {
      if (!dateString) return "";
      return new Date(dateString).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' });
  };

  // 🔥 HELPER: Filters duplicates based on Date, Shift, and Disa Machine
  // Keeps only the report with the highest ID (latest submission)
  const filterUniqueReports = (data) => {
    const uniqueMap = {};

    data.forEach((item) => {
      // Create a unique key: YYYY-MM-DD | Shift | Disa
      const dateStr = new Date(item.reportDate).toISOString().split('T')[0];
      const key = `${dateStr}|${item.shift}|${item.disa || item.disaMachine}`;

      // If key doesn't exist OR current item is newer (higher ID), store it
      if (!uniqueMap[key] || item.id > uniqueMap[key].id) {
        uniqueMap[key] = item;
      }
    });

    // Convert back to array and sort by Date Descending, then ID Descending
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
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/forms/supervisor/${currentSupervisor}`);
      setDisaReports(filterUniqueReports(res.data));
    } catch (err) { toast.error("Failed to load Disamatic reports."); }
  };

  const submitDisaSignature = async () => {
    if (disaSigCanvas.current.isEmpty()) { toast.warning("Please provide a signature."); return; }
    const signatureData = disaSigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/forms/sign`, { reportId: selectedDisaReport.id, signature: signatureData });
      toast.success("Disamatic Report signed successfully!");
      setSelectedDisaReport(null); fetchDisaReports();
    } catch (err) { toast.error("Failed to save signature."); }
  };

  // ==========================================
  // 2. BOTTOM LEVEL AUDIT LOGIC
  // ==========================================
  const fetchBottomReports = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/bottom-level-audit/supervisor/${currentSupervisor}`);
      setBottomReports(res.data);
    } catch (err) { toast.error("Failed to load Bottom Level Audits."); }
  };

  const handleOpenBottomModal = async (report) => {
    setSelectedBottomReport(report); setBottomPdfUrl(null); setIsBottomPdfLoading(true);
    try {
      const selectedDate = new Date(report.reportDate);
      const offset = selectedDate.getTimezoneOffset();
      const localDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
      const dateStr = localDate.toISOString().split('T')[0];
      const month = localDate.getMonth() + 1; const year = localDate.getFullYear();
      const disaMachine = report.disa;

      const [detailsRes, monthlyRes] = await Promise.all([
        axios.get(`${process.env.REACT_APP_API_URL}/api/bottom-level-audit/details`, { params: { date: dateStr, disaMachine } }),
        axios.get(`${process.env.REACT_APP_API_URL}/api/bottom-level-audit/monthly-report`, { params: { month, year, disaMachine } })
      ]);

      const checklist = detailsRes.data.checklist; const monthlyLogs = monthlyRes.data.monthlyLogs || []; 
      // eslint-disable-next-line
      const ncReports = monthlyRes.data.ncReports || [];
      const historyMap = {}; const holidayDays = new Set(); const vatDays = new Set();
      const supSigMap = {}; const hofSig = monthlyLogs.find(l => l.HOFSignature)?.HOFSignature;

      monthlyLogs.forEach(log => {
        const logDay = log.DayVal; const key = String(log.MasterId);
        if (Number(log.IsHoliday) === 1) holidayDays.add(logDay);
        if (Number(log.IsVatCleaning) === 1) vatDays.add(logDay);
        if (log.SupervisorSignature) supSigMap[logDay] = log.SupervisorSignature;
        if (!historyMap[key]) historyMap[key] = {};
        if (log.IsNA === 1) { historyMap[key][logDay] = 'NA'; } else if (log.IsDone === 1) { historyMap[key][logDay] = 'Y'; } else { historyMap[key][logDay] = 'N'; }
      });

      const doc = new jsPDF('l', 'mm', 'a4');
      const monthName = localDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      const daysInMonth = new Date(year, month, 0).getDate();

      doc.setLineWidth(0.3); doc.rect(10, 10, 40, 20); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
      doc.text("SAKTHI", 30, 18, { align: 'center' }); doc.text("AUTO", 30, 26, { align: 'center' });
      doc.rect(50, 10, 237, 20); doc.setFontSize(16); doc.text("LAYERED PROCESS AUDIT - BOTTOM LEVEL", 168, 22, { align: 'center' });
      doc.setFontSize(10); doc.text(`${disaMachine}`, 12, 35); doc.text(`MONTH : ${monthName}`, 235, 35);

      const days = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
      const tableBody = checklist.map((item, rowIndex) => {
        const row = [String(item.SlNo), item.CheckPointDesc];
        for (let i = 1; i <= daysInMonth; i++) {
          if (holidayDays.has(i)) { if (rowIndex === 0) row.push({ content: 'H\nO\nL\nI\nD\nA\nY', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [100, 100, 100] } }); }
          else if (vatDays.has(i)) { if (rowIndex === 0) row.push({ content: 'V\nA\nT\n\nC\nL\nE\nA\nN\nI\nN\nG', rowSpan: checklist.length, styles: { halign: 'center', valign: 'middle', fillColor: [210, 230, 255], fontStyle: 'bold', textColor: [50, 100, 150] } }); }
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
        startY: 38, head: [[{ content: 'S.No', styles: { halign: 'center', valign: 'middle' } }, { content: 'Check Points', styles: { halign: 'center', valign: 'middle' } }, ...days.map(d => ({ content: d, styles: { halign: 'center' } }))]],
        body: [...tableBody, ...footerRows], theme: 'grid', styles: { fontSize: 7, cellPadding: 1, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], valign: 'middle' },
        headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 105 }, ...dynamicColumnStyles },
        didDrawCell: function (data) {
          if (data.row.index === tableBody.length && data.column.index > 1) {
            const sigData = supSigMap[data.column.index - 1];
            if (sigData && sigData.startsWith('data:image')) { try { doc.addImage(sigData, 'PNG', data.cell.x + 0.5, data.cell.y + 0.5, data.cell.width - 1, data.cell.height - 1); } catch (e) { } }
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

      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.text("Legend:   3 - OK     X - NOT OK     CA - Corrected during Audit     NA - Not Applicable", 10, doc.lastAutoTable.finalY + 6);
      doc.setFont('helvetica', 'normal'); doc.text("Remarks: If Nonconformity please write on NCR format (back-side)", 10, doc.lastAutoTable.finalY + 12);
      doc.text("QF/08/MRO - 18, Rev No: 02 dt 01.01.2022", 10, 200); doc.text("Page 1 of 2", 270, 200);

      const pdfBlobUrl = doc.output('bloburl'); setBottomPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate PDF preview."); }
    setIsBottomPdfLoading(false);
  };

  const submitBottomSignature = async () => {
    if (bottomSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = bottomSigCanvas.current.getCanvas().toDataURL("image/png");
    const localDate = new Date(selectedBottomReport.reportDate);
    const offset = localDate.getTimezoneOffset();
    const cleanDate = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/bottom-level-audit/sign-supervisor`, { date: cleanDate, disaMachine: selectedBottomReport.disa, signature: signatureData });
      toast.success("Bottom Level Audit approved!"); setSelectedBottomReport(null); fetchBottomReports();
    } catch (err) { toast.error("Failed to save signature."); }
  };

  // ==========================================
  // 3. NCR LOGIC
  // ==========================================
  const fetchNcrReports = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/bottom-level-audit/supervisor-ncr/${currentSupervisor}`);
      setNcrReports(res.data);
    } catch (err) { toast.error("Failed to load NCRs."); }
  };

  const submitNcrSignature = async () => {
    if (ncrSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = ncrSigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/bottom-level-audit/sign-ncr`, { reportId: selectedNcrReport.ReportId, signature: signatureData });
      toast.success("NCR Verified and Completed!"); setSelectedNcrReport(null); fetchNcrReports(); 
    } catch (err) { toast.error("Failed to save NCR signature."); }
  };

  // ==========================================
  // 4. DMM SETTINGS LOGIC
  // ==========================================
  const fetchDmmReports = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/dmm-settings/supervisor/${currentSupervisor}`);
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

      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/dmm-settings/details`, { params: { date: dateStr, disa: disaMachine } });
      const { shiftsData, shiftsMeta } = res.data;

      const doc = new jsPDF('l', 'mm', 'a4'); 
      doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.text("SAKTHI AUTO COMPONENT LIMITED", 148.5, 10, { align: 'center' });
      doc.setFontSize(16); doc.text("DMM SETTING PARAMETERS CHECK SHEET", 148.5, 18, { align: 'center' });
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text(` ${disaMachine}`, 10, 28); doc.text(`DATE: ${localDate.toLocaleDateString('en-GB')}`, 280, 28, { align: 'right' });

      autoTable(doc, {
        startY: 32, margin: { left: 10, right: 10 }, 
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
            startY: currentY, margin: { left: 5, right: 5 }, head: tableHeader, body: tableBody, theme: 'grid',
            styles: { fontSize: 5.5, cellPadding: 0.8, lineColor: [0, 0, 0], lineWidth: 0.1, textColor: [0, 0, 0], halign: 'center', valign: 'middle' },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 5 },
            columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 25 }, 2: { cellWidth: 28 }, 19: { cellWidth: 'auto' } }
         });

         currentY = doc.lastAutoTable.finalY + 5; 
         if (currentY > 175 && index < 2) { doc.setFontSize(8); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200); doc.addPage(); currentY = 15; }
      });
      doc.setFontSize(8); doc.text("QF/07/FBP-13, Rev.No:06 dt 08.10.2025", 10, 200);

      const pdfBlobUrl = doc.output('bloburl'); setDmmPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate PDF preview."); }
    setIsDmmPdfLoading(false);
  };

  const submitDmmSignature = async () => {
    if (dmmSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = dmmSigCanvas.current.getCanvas().toDataURL("image/png");
    const localDate = new Date(selectedDmmReport.reportDate);
    const offset = localDate.getTimezoneOffset();
    const cleanDate = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/dmm-settings/sign`, { date: cleanDate, disaMachine: selectedDmmReport.disa, shift: selectedDmmReport.shift, signature: signatureData });
      toast.success("DMM Settings Shift signed successfully!");
      setSelectedDmmReport(null); fetchDmmReports();
    } catch (err) { toast.error("Failed to save signature."); }
  };

  // ==========================================
  // 5. 4M CHANGE LOGIC 
  // ==========================================
  const fetchFourMReports = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/4m-change/supervisor/${currentSupervisor}`);
      setFourMReports(res.data);
    } catch (err) { toast.error("Failed to load 4M Change Reports."); }
  };

  const handleOpenFourMModal = async (report) => {
    setSelectedFourMReport(report); setFourMPdfUrl(null); setIsFourMPdfLoading(true);
    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/4m-change/report`, { params: { reportId: report.id }, responseType: 'blob' });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setFourMPdfUrl(pdfBlobUrl);
    } catch (error) { toast.error("Failed to generate 4M PDF."); }
    setIsFourMPdfLoading(false);
  };

  const submitFourMSignature = async () => {
    if (fourMSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = fourMSigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/4m-change/sign-supervisor`, { reportId: selectedFourMReport.id, signature: signatureData });
      toast.success("4M Change Report signed successfully!");
      setSelectedFourMReport(null); fetchFourMReports();
    } catch (err) { toast.error("Failed to save 4M signature."); }
  };

  // ==========================================
  // 6. ERROR PROOF REACTION PLANS LOGIC (🔥 FULL-SCREEN PDF FIX)
  // ==========================================
  const fetchErrorReports = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/error-proof/supervisor/${currentSupervisor}`);
      setErrorReports(res.data);
    } catch (err) { toast.error("Failed to load Error Proof plans."); }
  };

  const handleOpenErrorModal = async (report) => {
    setSelectedErrorReport(report);
    setErrorPdfUrl(null);
    setIsErrorPdfLoading(true);
    try {
      const line = report.DisaMachine || report.disaMachine || report.line;
      // Get exact date safely to filter the PDF
      const localDate = new Date(report.recordDate || report.RecordDate);
      const offset = localDate.getTimezoneOffset();
      const dateStr = new Date(localDate.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/error-proof/report`, { 
          params: { line, date: dateStr }, 
          responseType: 'blob' 
      });
      const pdfBlobUrl = URL.createObjectURL(response.data);
      setErrorPdfUrl(pdfBlobUrl);
    } catch (error) {
      toast.error("Failed to generate Error Proof PDF.");
    }
    setIsErrorPdfLoading(false);
  };

  const submitErrorSignature = async () => {
    if (errorSigCanvas.current.isEmpty()) { toast.warning("Please provide your signature."); return; }
    const signatureData = errorSigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      const id = selectedErrorReport.reportId || selectedErrorReport.VerificationId || selectedErrorReport.Id || selectedErrorReport.sNo;
      await axios.post(`${process.env.REACT_APP_API_URL}/api/error-proof/sign-supervisor`, { 
        reactionPlanId: id, 
        signature: signatureData 
      });
      toast.success("Reaction Plan Approved!");
      setSelectedErrorReport(null); fetchErrorReports();
    } catch (err) { toast.error("Failed to save signature."); }
  };

  // ==========================================
  // 7. MOULDING QUALITY LOGIC
  // ==========================================
  const fetchMouldQualityReports = async () => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/mould-quality/supervisor/${currentSupervisor}`);
      setMouldQualityReports(filterUniqueReports(res.data));
    } catch (err) { console.error(err); }
  };

  const handleOpenMQModal = async (report) => {
    setSelectedMQReport(report);
    setMqPdfUrl(null);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/mould-quality/report?reportId=${report.id}`, { responseType: 'blob' });
      setMqPdfUrl(URL.createObjectURL(res.data));
    } catch (err) { toast.error("Failed to load PDF preview"); }
  };

  const submitMQSignature = async () => {
    if (mqSigCanvas.current.isEmpty()) return toast.warning("Please provide a signature");
    const signature = mqSigCanvas.current.getCanvas().toDataURL("image/png");
    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/mould-quality/sign-supervisor`, { reportId: selectedMQReport.id, signature });
      toast.success("Signed successfully!");
      setSelectedMQReport(null);
      fetchMouldQualityReports();
    } catch (err) { toast.error("Failed to save signature"); }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="min-h-screen bg-[#2d2d2d] p-10 space-y-10">

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
                      <td className="p-3 border border-gray-300 text-center">{!report.supervisorSignature && <button onClick={() => setSelectedDisaReport(report)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Review & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 2: BOTTOM LEVEL AUDITS */}
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

        {/* SECTION 3: NON-CONFORMANCE REPORTS */}
        <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-8 border-t-4 border-red-500">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h1 className="text-2xl font-bold text-gray-800">Non-Conformance Reports (NCR)</h1></div>
          {ncrReports.length === 0 ? <p className="text-gray-500 italic">No NCRs to review.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-gray-300">
                <thead className="bg-gray-800 text-white"><tr><th className="p-3 border border-gray-300">Date</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">NC Details</th><th className="p-3 border border-gray-300">Responsibility</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr></thead>
                <tbody>
                  {ncrReports.map((report, idx) => (
                    <tr key={idx} className="hover:bg-red-50">
                      <td className="p-3 border border-gray-300 font-medium">{formatDate(report.ReportDate)}</td><td className="p-3 border border-gray-300 font-bold">{report.DisaMachine}</td><td className="p-3 border border-gray-300 text-sm">{report.NonConformityDetails}</td><td className="p-3 border border-gray-300 font-bold">{report.Responsibility}</td>
                      <td className="p-3 border border-gray-300">{report.Status === 'Completed' ? <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">✓ Completed</span> : <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">Pending</span>}</td>
                      <td className="p-3 border border-gray-300 text-center">{report.Status !== 'Completed' && <button onClick={() => setSelectedNcrReport(report)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded font-bold text-sm shadow transition-colors">Verify & Sign</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* SECTION 4: DMM SETTING PARAMETERS */}
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

        {/* SECTION 5: 4M CHANGE MONITORING */}
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

        {/* SECTION 6: ERROR PROOF REACTION PLANS */}
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
                  <tr><th className="p-3 border border-gray-300 w-20 text-center">ID</th><th className="p-3 border border-gray-300">Date/Shift</th><th className="p-3 border border-gray-300">Machine</th><th className="p-3 border border-gray-300">Error Proof</th><th className="p-3 border border-gray-300">Status</th><th className="p-3 border border-gray-300 text-center">Action</th></tr>
                </thead>
                <tbody>
                  {errorReports.map((report, idx) => {
                    const status = report.Status || report.status;
                    return (
                      <tr key={idx} className="hover:bg-yellow-50">
                        <td className="p-3 border border-gray-300 text-center font-bold text-gray-400">#{report.reportId || report.VerificationId}</td>
                        <td className="p-3 border border-gray-300 font-bold">{report.shift || formatDate(report.recordDate)}</td>
                        <td className="p-3 border border-gray-300 font-bold">{report.DisaMachine || report.disaMachine || report.line}</td>
                        <td className="p-3 border border-gray-300">{report.ErrorProofName || report.errorProofName}</td>
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

        {/* SECTION 7: MOULDING QUALITY INSPECTION */}
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
            <button onClick={() => setSelectedDisaReport(null)} className="text-gray-400 hover:text-red-400 transition-colors">
              <X size={28} />
            </button>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="flex-1 h-full bg-[#525659] relative flex items-center justify-center">
              <iframe src={`${process.env.REACT_APP_API_URL}/api/forms/download-pdf?reportId=${selectedDisaReport.id}#toolbar=0&view=FitH`} className="w-full h-full border-none relative z-10" title="PDF" />
            </div>
            <div className="w-full lg:w-[400px] bg-gray-50 border-l border-gray-300 flex flex-col shrink-0 shadow-2xl z-10 overflow-y-auto">
              <div className="p-6 flex-1 flex flex-col">
                  <div className="bg-orange-100 p-4 rounded-xl border border-orange-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-orange-900">
                    <p><span className="font-bold">Report ID:</span> #{selectedDisaReport.id}</p>
                    <p><span className="font-bold">Date:</span> {formatDate(selectedDisaReport.reportDate)}</p>
                    <p><span className="font-bold">Shift:</span> {selectedDisaReport.shift}</p>
                    <p><span className="font-bold">DISA:</span> {selectedDisaReport.disa}</p>
                  </div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">Supervisor Signature</label>
                  <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl overflow-hidden mb-2 shadow-inner">
                    <SignatureCanvas ref={disaSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-64 cursor-crosshair' }} />
                  </div>
                  <button onClick={() => disaSigCanvas.current.clear()} className="text-xs text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider underline self-end mb-8">Clear Signature</button>
                  <div className="mt-auto">
                      <button onClick={submitDisaSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve & Sign
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. BOTTOM LEVEL AUDIT MODAL */}
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
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">Supervisor Signature</label>
                  <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl overflow-hidden mb-2 shadow-inner">
                    <SignatureCanvas ref={bottomSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-64 cursor-crosshair' }} />
                  </div>
                  <button onClick={() => bottomSigCanvas.current.clear()} className="text-xs text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider underline self-end mb-8">Clear Signature</button>
                  <div className="mt-auto">
                      <button onClick={submitBottomSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve & Sign
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. DMM SETTINGS MODAL */}
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
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">Supervisor Signature</label>
                  <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl overflow-hidden mb-2 shadow-inner">
                    <SignatureCanvas ref={dmmSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-64 cursor-crosshair' }} />
                  </div>
                  <button onClick={() => dmmSigCanvas.current.clear()} className="text-xs text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider underline self-end mb-8">Clear Signature</button>
                  <div className="mt-auto">
                      <button onClick={submitDmmSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve & Sign
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. 4M CHANGE MODAL */}
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
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">Supervisor Signature</label>
                  <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl overflow-hidden mb-2 shadow-inner">
                    <SignatureCanvas ref={fourMSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-64 cursor-crosshair' }} />
                  </div>
                  <button onClick={() => fourMSigCanvas.current.clear()} className="text-xs text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider underline self-end mb-8">Clear Signature</button>
                  <div className="mt-auto">
                      <button onClick={submitFourMSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve & Sign
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. ERROR PROOF MODAL (🔥 FULL-SCREEN SPLIT UI FIX) */}
      {selectedErrorReport && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden animate-fade-in">
          <div className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-md z-10">
            <h3 className="font-bold text-xl uppercase tracking-wider">Review & Approve Reaction Plan</h3>
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
                  <div className="bg-yellow-100 p-4 rounded-xl border border-yellow-200 mb-6 text-sm flex flex-col gap-2 shadow-sm text-yellow-900">
                    <p><span className="font-bold">Report ID:</span> #{selectedErrorReport.reportId || selectedErrorReport.VerificationId}</p>
                    <p><span className="font-bold">Machine:</span> {selectedErrorReport.DisaMachine || selectedErrorReport.disaMachine || selectedErrorReport.line}</p>
                    <p><span className="font-bold">Problem:</span> {selectedErrorReport.Problem || selectedErrorReport.problem}</p>
                    <p><span className="font-bold">Action Taken:</span> {selectedErrorReport.CorrectiveAction || selectedErrorReport.correctiveAction}</p>
                  </div>
                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest mb-2 block">Supervisor Signature</label>
                  <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl overflow-hidden mb-2 shadow-inner">
                    <SignatureCanvas ref={errorSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-64 cursor-crosshair' }} />
                  </div>
                  <button onClick={() => errorSigCanvas.current.clear()} className="text-xs text-gray-500 hover:text-red-600 font-bold uppercase tracking-wider underline self-end mb-8">Clear Signature</button>
                  <div className="mt-auto">
                      <button onClick={submitErrorSignature} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">
                        Approve & Sign
                      </button>
                  </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. MOULD QUALITY MODAL */}
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
              <label className="text-xs font-black text-gray-500 uppercase mb-2 block tracking-widest">Supervisor Signature</label>
              <div className="border-2 border-dashed border-gray-300 bg-white rounded-xl mb-2 shadow-inner"><SignatureCanvas ref={mqSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-64 cursor-crosshair' }} /></div>
              <button onClick={() => mqSigCanvas.current.clear()} className="text-xs text-red-500 hover:text-red-700 font-bold uppercase underline tracking-wider self-end mb-auto">Clear Signature</button>
              <button onClick={submitMQSignature} className="mt-8 w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-black text-lg uppercase tracking-wider shadow-lg transition-transform hover:-translate-y-1">Approve & Sign</button>
            </div>
          </div>
        </div>
      )}

      {/* NCR Modal Remains a standard popup because it doesn't have an underlying PDF */}
      {selectedNcrReport && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-red-600 text-white px-6 py-4 flex justify-between items-center shrink-0"><h3 className="font-bold text-lg">Verify Non-Conformance Report</h3><button onClick={() => setSelectedNcrReport(null)} className="text-red-200 hover:text-white font-bold text-2xl leading-none">&times;</button></div>
            <div className="p-6 overflow-y-auto">
               <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6 flex flex-col gap-3 text-sm text-gray-800">
                  <div className="flex justify-between border-b border-red-200 pb-2"><p><span className="font-bold">Date:</span> {formatDate(selectedNcrReport.ReportDate)}</p><p><span className="font-bold">Machine:</span> {selectedNcrReport.DisaMachine}</p></div>
                  <p><span className="font-bold">NC Details:</span> {selectedNcrReport.NonConformityDetails || 'N/A'}</p><p><span className="font-bold">Correction:</span> {selectedNcrReport.Correction || 'N/A'}</p><p><span className="font-bold">Root Cause:</span> {selectedNcrReport.RootCause || 'N/A'}</p><p><span className="font-bold">Corrective Action:</span> {selectedNcrReport.CorrectiveAction || 'N/A'}</p>
               </div>
               <label className="block text-gray-800 font-bold mb-2 text-sm">Sign below to confirm resolution:</label><div className="border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden mb-2"><SignatureCanvas ref={ncrSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-40 cursor-crosshair' }} /></div><div className="flex justify-end mb-6"><button onClick={() => ncrSigCanvas.current.clear()} className="text-sm text-red-500 hover:text-red-700 font-bold underline">Clear Pad</button></div>
               <div className="flex flex-col gap-3"><button onClick={submitNcrSignature} className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded font-bold shadow-md text-lg">Verify & Complete NCR</button></div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

export default Supervisor;