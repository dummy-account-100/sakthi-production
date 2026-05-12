import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { AlertTriangle, Save, FileDown, UserCheck, ShieldCheck, X, CheckCircle, Loader, Send, Edit3 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Header from "../components/Header";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import logo from '../Assets/logo.png';

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

const HeaderSearchableSelect = ({ options, displayKey, onSelect, value, placeholder }) => {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => { setSearch(value || ""); }, [value]);

  const filtered = options.filter((item) =>
    item[displayKey]?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full h-full flex items-center">
      <input
        type="text" value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="px-3 py-2 bg-transparent text-white font-semibold text-sm outline-none w-full placeholder:text-gray-400 focus:placeholder:text-gray-600"
        placeholder={placeholder}
      />
      {open && (
        <ul className="absolute top-[110%] left-0 z-50 bg-white border border-gray-300 w-full max-h-40 overflow-y-auto rounded shadow-lg">
          {filtered.length > 0 ? (
            filtered.map((item, index) => (
              <li key={index} onMouseDown={(e) => { e.preventDefault(); setSearch(item[displayKey]); setOpen(false); onSelect(item); }} className="p-2 hover:bg-orange-50 cursor-pointer text-sm text-gray-800 font-semibold">{item[displayKey]}</li>
            ))
          ) : (<li className="p-2 text-gray-500 text-sm">No results found</li>)}
        </ul>
      )}
    </div>
  );
};

const ErrorProofVerification2 = () => {
  const [headerData, setHeaderData] = useState({ disaMachine: 'DISA - I', reviewedBy: '', approvedBy: '', assignedHOF: '', operatorSignature: '', hofSignature: '', isHofSent: false });
  const [verifications, setVerifications] = useState([]);
  const [reactionPlans, setReactionPlans] = useState([]);

  // Track if we're editing existing data (like 4M Change form)
  const [isEditMode, setIsEditMode] = useState(false);

  const [hofList, setHofList] = useState([]);
  const [operatorList, setOperatorList] = useState([]);
  const [supervisorList, setSupervisorList] = useState([]);
  
  const [qfHistory, setQfHistory] = useState([]);

  const [recordDate, setRecordDate] = useState(new Date().toISOString().split('T')[0]);
  const currentDate = new Date(recordDate).toLocaleDateString('en-GB').replace(/\//g, '-');

  const fetchData = useCallback(async () => {
    if (!headerData?.disaMachine || !recordDate) return;

    try {
      const res = await axios.get(
        `${API_BASE}/error-proof2/details`,
        { params: { machine: headerData.disaMachine, date: recordDate } }
      );

      setHofList(res.data.hofs || []);
      setOperatorList(res.data.operators || []);
      setSupervisorList(res.data.supervisors || []);
      setQfHistory(res.data.qfHistory || []); 

      const masterData = res.data.masterConfig || [];
      const transData = res.data.verifications || [];

      // Determine if we're in edit mode (existing data found)
      setIsEditMode(transData.length > 0);

      const mergedVerifications = [];

      if (transData.length > 0) {
        transData.forEach((transItem, index) => {
          const masterItem = masterData[index];

          if (masterItem) {
            mergedVerifications.push({
              ...transItem,
              Line: masterItem.Line,
              ErrorProofName: masterItem.ErrorProofName,
              NatureOfErrorProof: masterItem.NatureOfErrorProof,
              Frequency: masterItem.Frequency,
              isLegacy: false
            });
          } else {
            mergedVerifications.push({
              ...transItem,
              isLegacy: true
            });
          }
        });

        if (masterData.length > transData.length) {
          for (let i = transData.length; i < masterData.length; i++) {
            const mItem = masterData[i];
            mergedVerifications.push({
              Id: `temp-${Date.now()}-${i}`,
              Line: mItem.Line,
              ErrorProofName: mItem.ErrorProofName,
              NatureOfErrorProof: mItem.NatureOfErrorProof,
              Frequency: mItem.Frequency,
              Date1_Shift1_Res: null,
              Date1_Shift2_Res: null,
              Date1_Shift3_Res: null,
              isLegacy: false
            });
          }
        }
      } else {
        masterData.forEach((mItem, index) => {
          mergedVerifications.push({
            Id: `temp-${Date.now()}-${index}`,
            Line: mItem.Line,
            ErrorProofName: mItem.ErrorProofName,
            NatureOfErrorProof: mItem.NatureOfErrorProof,
            Frequency: mItem.Frequency,
            Date1_Shift1_Res: null,
            Date1_Shift2_Res: null,
            Date1_Shift3_Res: null,
            isLegacy: false
          });
        });
      }

      setVerifications(mergedVerifications);
      setReactionPlans(res.data.reactionPlans || []);

      if (transData.length > 0) {
        setHeaderData(prev => ({
          ...prev,
          reviewedBy: transData[0].ReviewedByHOF || '',
          approvedBy: transData[0].ApprovedBy || '',
          assignedHOF: transData[0].AssignedHOF || '',
          operatorSignature: transData[0].OperatorSignature || '',
          hofSignature: transData[0].HOFSignature || '',
          isHofSent: !!transData[0].AssignedHOF
        }));
      } else {
        setHeaderData(prev => ({
          ...prev,
          reviewedBy: '',
          approvedBy: '',
          assignedHOF: '',
          operatorSignature: '',
          hofSignature: '',
          isHofSent: false
        }));
      }

    } catch (error) {
      toast.error("Failed to load data from server.");
    }
  }, [headerData.disaMachine, recordDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleInputChange = (id, field, value) => {
    setVerifications(prev => prev.map(row => row.Id === id ? { ...row, [field]: value } : row));
  };

  const handleResultChange = (row, shiftIdx, value) => {
    handleInputChange(row.Id, `Date1_Shift${shiftIdx}_Res`, value);
    const shiftLabel = `${currentDate} - Shift ${shiftIdx}`;

    if (value === 'NOT OK') {
      setReactionPlans(prev => {
        if (prev.find(p => p.VerificationId === row.Id && p.VerificationDateShift === shiftLabel)) return prev;
        return [...prev, { VerificationId: row.Id, ErrorProofNo: '', ErrorProofName: row.ErrorProofName, VerificationDateShift: shiftLabel, Problem: '', RootCause: '', CorrectiveAction: '', Status: 'Pending', ReviewedBy: '', ApprovedBy: '', Remarks: '', SupervisorSignature: '' }];
      });
    } else if (value === 'OK') {
      setReactionPlans(prev => prev.filter(p => !(p.VerificationId === row.Id && p.VerificationDateShift === shiftLabel)));
    }
  };

  const handleReactionPlanChange = (index, field, value) => {
    const updatedPlans = [...reactionPlans];
    updatedPlans[index][field] = value;
    setReactionPlans(updatedPlans);
  };

  // 🔥 DYNAMIC SAVE AND HOF SUBMISSION LOGIC (Editable like 4M Change) 🔥
  const saveToServer = async (isHofSubmission = false) => {
    // 1. Identify which shifts have data entered
    const activeShifts = [1, 2, 3].filter(s => verifications.some(v => v[`Date1_Shift${s}_Res`]));

    // 2. Validate HOF Submission specific requirements
    if (isHofSubmission) {
      const shift3Done = activeShifts.includes(3);
      if (!shift3Done) {
        toast.error('You can only send to the HOF after completing the 3rd shift.');
        return;
      }
      if (!headerData.assignedHOF) {
        toast.error('Please assign an HOF before sending.');
        document.getElementById('hof-assign-select')?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    if (activeShifts.length === 0 && !isHofSubmission) {
      toast.error('Please enter results for at least one shift before saving.');
      return;
    }

    // 3. Validate that the entire column for the active shift is filled out
    for (const shift of activeShifts) {
      const hasEmpty = verifications.some(v => !v[`Date1_Shift${shift}_Res`]);
      if (hasEmpty) {
        toast.error(`Please complete all observations for Shift ${shift}.`);
        return;
      }
    }

    // 4. Validate Headers and Approval
    if (!headerData.reviewedBy.trim() || !headerData.approvedBy.trim()) { 
      toast.warning('Please fill in both "Reviewed By HOF" and "Moulding Incharge".'); 
      return; 
    }

    const signatureData = "Submitted";
    const finalHOF = isHofSubmission ? headerData.assignedHOF : (headerData.isHofSent ? headerData.assignedHOF : '');

    try {
      const plansToSave = reactionPlans.map((p, i) => ({ ...p, SNo: i + 1 }));
      await axios.post(`${API_BASE}/error-proof2/save`, {
        machine: headerData.disaMachine, 
        date: recordDate, 
        verifications, 
        reactionPlans: plansToSave, 
        operatorSignature: signatureData,
        headerDetails: { 
          reviewedBy: headerData.reviewedBy, 
          approvedBy: headerData.approvedBy, 
          assignedHOF: finalHOF 
        }
      });
      
      toast.success(isHofSubmission ? 'Sent to HOF Successfully!' : 'Shift Data Saved Successfully!');
      setTimeout(() => fetchData(), 1500);
    } catch (error) { 
      toast.error('Failed to save data.'); 
    }
  };

  const generatePDF = () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');

      let currentPageQfValue = "QF/07/FYQ-05, Rev.No: 02 dt 28.02.2023";
      const repDate = new Date(recordDate);
      repDate.setHours(0, 0, 0, 0);

      for (let qf of qfHistory) {
          if (!qf.date) continue;
          const qfDate = new Date(qf.date);
          qfDate.setHours(0, 0, 0, 0);
          if (qfDate <= repDate) {
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
      doc.text(headerData.disaMachine, 262, 16, { align: 'center' });
      doc.line(237, 20, 287, 20);
      doc.setFontSize(10);
      doc.text(`Date: ${currentDate}`, 262, 26, { align: 'center' });

      const mainHead = [
        [
          { content: 'Line', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Error Proof Name', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Nature of Error Proof', rowSpan: 3, styles: { halign: 'center', valign: 'middle' } },
          { content: 'Frequency', rowSpan: 3, styles: { halign: 'center', valign: 'middle', cellWidth: 15 } },
          { content: `Date: ${currentDate}`, colSpan: 3, styles: { halign: 'center', fillColor: [240, 240, 240] } }
        ],
        [{ content: 'I Shift', styles: { halign: 'center' } }, { content: 'II Shift', styles: { halign: 'center' } }, { content: 'III Shift', styles: { halign: 'center' } }],
        [{ content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }, { content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }, { content: 'Observation Result', styles: { halign: 'center', fontSize: 6 } }]
      ];

      const mainBody = verifications.map(row => {
        const pdfRow = [row.Line, row.ErrorProofName, row.NatureOfErrorProof, row.Frequency];
        [1, 2, 3].forEach(s => { const res = row[`Date1_Shift${s}_Res`] || '-'; pdfRow.push(res); });
        return pdfRow;
      });

      autoTable(doc, {
        startY: 35, margin: { left: 10, right: 10 }, head: mainHead, body: mainBody, theme: 'grid',
        styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1, halign: 'center', valign: 'middle' },
        headStyles: { fillColor: [230, 230, 230], textColor: [0, 0, 0], fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 45 }, 2: { cellWidth: 70 } }
      });

      const finalY = doc.lastAutoTable.finalY + 8;
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');

      doc.text("Verified By Moulding Incharge", 20, finalY);
      doc.rect(20, finalY + 2, 40, 15);
      const opSigToDraw = "Submitted";
      if (opSigToDraw === "Approved" || opSigToDraw === "Submitted") {
        doc.setFont('zapfdingbats', 'normal'); doc.setFontSize(10); doc.setTextColor(0, 120, 0);
        doc.text('3', 23, finalY + 11);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
        doc.text('APPROVED', 28, finalY + 10.5);
        doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
      } else if (opSigToDraw && opSigToDraw.startsWith('data:image')) {
        doc.addImage(opSigToDraw, 'PNG', 21, finalY + 3, 38, 13);
      }

      doc.text("Reviewed By HOF", 130, finalY);
      doc.rect(130, finalY + 2, 40, 15);
      if (headerData.hofSignature === "Approved") {
        doc.setFont('zapfdingbats', 'normal'); doc.setFontSize(10); doc.setTextColor(0, 120, 0);
        doc.text('3', 133, finalY + 11);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
        doc.text('APPROVED', 138, finalY + 10.5);
        doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'bold');
      } else if (headerData.hofSignature && headerData.hofSignature.startsWith('data:image')) {
        doc.addImage(headerData.hofSignature, 'PNG', 131, finalY + 3, 38, 13);
      }

      doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(currentPageQfValue, 10, doc.internal.pageSize.getHeight() - 10);

      if (reactionPlans.length > 0) {
        doc.addPage();
        
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
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text("REACTION PLAN", 143.5, 22, { align: 'center' });

        doc.rect(237, 10, 50, 20);
        doc.setFontSize(11);
        doc.text(headerData.disaMachine, 262, 16, { align: 'center' });
        doc.line(237, 20, 287, 20);
        doc.setFontSize(10);
        doc.text(`Date: ${currentDate}`, 262, 26, { align: 'center' });

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
              }
            }
          },
          didParseCell: function (data) {
            if (data.section === 'body' && data.column.index === 9 && data.cell.text[0] && data.cell.text[0].startsWith('data:image')) {
              data.cell.text = '';
            }
          }
        });

        doc.setFontSize(8); doc.setFont('helvetica', 'normal');
        doc.text(currentPageQfValue, 10, doc.internal.pageSize.getHeight() - 10);
      }

      doc.save(`Error_Proof_Verification_${headerData.disaMachine}.pdf`);
      toast.success("PDF Downloaded successfully!");
    } catch (err) { toast.error("Failed to generate PDF."); }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} />

      <div className="min-h-screen bg-[#2d2d2d] py-8 px-4 flex justify-center pb-20 items-stretch">
        <div className="w-full max-w-[95%] min-h-[85vh] bg-white shadow-lg border border-gray-300 rounded-xl flex flex-col overflow-hidden">

          <div className="bg-gray-900 py-5 px-6 flex justify-between items-center shrink-0 rounded-t-xl flex-wrap gap-4 border-b-2 border-orange-500">
            <div className="flex items-center gap-6">
              <h2 className="text-xl font-bold text-white uppercase tracking-wide flex items-center gap-2"><span className="text-orange-500 text-2xl">🛡️</span> Error Proof Verification
                {isEditMode && <span className="ml-3 text-sm text-blue-400 bg-blue-500/20 border border-blue-500/40 px-3 py-1 rounded-full font-bold tracking-normal normal-case flex items-center gap-1.5"><Edit3 size={13} /> Editing Mode</span>}
              </h2>
              <select value={headerData.disaMachine} onChange={(e) => setHeaderData({ ...headerData, disaMachine: e.target.value })} className="bg-gray-800 text-white font-bold border border-orange-500 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 cursor-pointer transition-all shadow-sm">
                <option value="DISA - I">DISA - I</option><option value="DISA - II">DISA - II</option><option value="DISA - III">DISA - III</option><option value="DISA - IV">DISA - IV</option><option value="DISA - V">DISA - V</option><option value="DISA - VI">DISA - VI</option>
              </select>
              <div className="flex items-center gap-2">
                <span className="text-orange-400 text-sm font-bold uppercase">Date:</span>
                <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className="bg-white text-gray-800 font-bold border border-orange-500 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer shadow-sm" />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-gray-800 border border-gray-600 rounded-md flex overflow-visible focus-within:border-orange-500 transition-colors shadow-sm relative z-50">
                <span className="bg-gray-700 px-3 py-2 border-r border-gray-600 flex items-center gap-2 text-[10px] font-bold uppercase text-gray-300"><UserCheck size={14} /> Reviewed By HOF</span>
                <div className="w-48"><HeaderSearchableSelect options={hofList} displayKey="name" value={headerData.reviewedBy} onSelect={(item) => setHeaderData({ ...headerData, reviewedBy: item.name })} placeholder="Required*" /></div>
              </div>
              <div className="bg-gray-800 border border-gray-600 rounded-md flex overflow-visible focus-within:border-orange-500 transition-colors shadow-sm relative z-40">
                <span className="bg-gray-700 px-3 py-2 border-r border-gray-600 flex items-center gap-2 text-[10px] font-bold uppercase text-gray-300"><ShieldCheck size={14} /> Moulding Incharge</span>
                {/* 🔥 FIX: Changed options from operatorList to supervisorList */}
                <div className="w-48"><HeaderSearchableSelect options={supervisorList} displayKey="name" value={headerData.approvedBy} onSelect={(item) => setHeaderData({ ...headerData, approvedBy: item.name })} placeholder="Required*" /></div>
              </div>
            </div>
          </div>

          <div className="p-4 overflow-x-auto flex-1 custom-scrollbar bg-gray-50 flex flex-col">
            <table className="w-full text-center border-collapse table-fixed min-w-[1000px] shadow-sm bg-white border border-gray-300">
              <thead className="bg-gray-200">
                <tr className="text-xs text-gray-800 uppercase border-b-2 border-gray-300">
                  <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-200 w-24 font-bold">Line</th>
                  <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-100 w-64 font-bold">Error Proof Name</th>
                  <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-100 w-80 font-bold">Nature of Error Proof</th>
                  <th rowSpan="3" className="border border-gray-300 p-2 bg-gray-100 w-24 border-r-2 border-r-gray-300 font-bold">Frequency</th>
                  <th colSpan="3" className="border border-gray-300 p-2 bg-orange-200 font-bold text-orange-900 tracking-wider text-sm border-b-2 border-b-gray-300">Date: {currentDate}</th>
                </tr>
                <tr className="bg-gray-100 text-xs font-bold tracking-wide text-gray-800 border-b border-gray-300">
                  {[1, 2, 3].map((shiftNum, j) => (
                    <th key={j} className="border border-gray-300 p-2 text-center">
                      <span>Shift {shiftNum}</span>
                    </th>
                  ))}
                </tr>
                <tr className="text-[10px] font-semibold bg-gray-100 text-gray-600 uppercase tracking-wide">
                  {[1, 2, 3].map((_, j) => (<th key={j} className="border border-gray-300 p-1.5 bg-gray-200">Observation Result</th>))}
                </tr>
              </thead>
              <tbody>
                {verifications.map((row) => (
                  <tr key={row.Id} className={`hover:bg-orange-50/50 transition-colors group border-b border-gray-300 ${row.isLegacy ? 'bg-red-50/50' : ''}`}>
                    <td className="border border-gray-300 font-bold text-gray-800 bg-gray-50 p-4">{row.Line}</td>
                    <td className="border border-gray-300 p-4 text-left text-xs whitespace-pre-wrap font-semibold text-gray-800">
                      {row.ErrorProofName}
                      {row.isLegacy && <span className="ml-2 bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5 rounded font-bold border border-red-200">Obsolete Config</span>}
                    </td>
                    <td className="border border-gray-300 p-4 text-left text-xs whitespace-pre-wrap font-medium text-gray-700">{row.NatureOfErrorProof}</td>
                    <td className="border border-gray-300 p-4 font-bold text-gray-800 border-r-2 border-r-gray-300 bg-gray-50 text-xs">{row.Frequency}</td>
                    
                    {[1, 2, 3].map(s => {
                      const resKey = `Date1_Shift${s}_Res`; 
                      const result = row[resKey];

                      return (
                        <td key={s} className={`border border-gray-300 p-2 align-middle transition-colors ${result === 'NOT OK' ? 'bg-red-50' : result === 'OK' ? 'bg-green-50' : 'bg-white'}`}>
                          <div className="flex flex-row items-center justify-center gap-4 px-2 w-full h-full min-h-[60px] whitespace-nowrap">
                            <label className="flex items-center gap-1.5 p-1.5 rounded transition-colors group/radio cursor-pointer hover:bg-white/60">
                              <input type="radio" name={`res-${row.Id}-1-${s}`} checked={result === 'OK'} onChange={() => handleResultChange(row, s, 'OK')} className="accent-green-600 w-4 h-4 m-0 cursor-pointer" />
                              <span className="text-[10px] font-bold text-gray-700 group-hover/radio:text-green-800 leading-none mt-0.5">OK</span>
                            </label>
                            <label className="flex items-center gap-1.5 p-1.5 rounded transition-colors group/radio cursor-pointer hover:bg-white/60">
                              <input type="radio" name={`res-${row.Id}-1-${s}`} checked={result === 'NOT OK'} onChange={() => handleResultChange(row, s, 'NOT OK')} className="accent-red-600 w-4 h-4 m-0 cursor-pointer" />
                              <span className="text-[10px] font-bold text-gray-700 group-hover/radio:text-red-800 leading-none mt-0.5">NOT OK</span>
                            </label>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {reactionPlans.length > 0 && (
              <div className="mt-8 mb-4">
                <div className="flex items-center gap-2 mb-3 px-2 border-b-2 border-red-500 pb-2">
                  <AlertTriangle className="text-red-600 w-6 h-6" />
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-wide">Reaction Plans - Action Required</h3>
                </div>
                <table className="w-full text-center border-collapse table-fixed min-w-[1600px] shadow-md bg-white border-2 border-gray-400">
                  <thead className="bg-red-50">
                    <tr className="text-sm text-gray-900 uppercase border-b-2 border-gray-400 font-black">
                      <th className="border border-gray-400 p-3 w-12">S.No</th><th className="border border-gray-400 p-3 w-32">EP No</th><th className="border border-gray-400 p-3 w-64">Error Proof Name</th><th className="border border-gray-400 p-3 w-48">Date / Shift</th><th className="border border-gray-400 p-3 w-48">Problem</th><th className="border border-gray-400 p-3 w-48">Root Cause</th><th className="border border-gray-400 p-3 w-48">Corrective Action</th><th className="border border-gray-400 p-3 w-32">Status</th><th className="border border-gray-400 p-3 w-40">Reviewed By (Operator)</th><th className="border border-gray-400 p-3 w-40">Approved By (Supervisor)</th><th className="border border-gray-400 p-3 w-40">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reactionPlans.map((plan, idx) => (
                      <tr key={`${plan.VerificationId}-${plan.VerificationDateShift}`} className="hover:bg-red-50/30 border-b border-gray-400 group h-20">
                        <td className="border border-gray-400 p-3 font-black text-gray-900 bg-gray-100 text-sm">{idx + 1}</td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50"><input type="text" value={plan.ErrorProofNo} onChange={(e) => handleReactionPlanChange(idx, 'ErrorProofNo', e.target.value)} className="absolute inset-0 w-full h-full text-center text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors placeholder:text-gray-400 placeholder:font-medium" placeholder="EP-XX" /></td>
                        <td className="border border-gray-400 p-3 text-sm font-bold text-gray-900 text-left leading-snug">{plan.ErrorProofName}</td>
                        <td className="border border-gray-400 p-3 text-sm font-black whitespace-nowrap bg-red-100 text-red-800">{plan.VerificationDateShift}</td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50"><textarea value={plan.Problem} onChange={(e) => handleReactionPlanChange(idx, 'Problem', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Describe Problem..." /></td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50"><textarea value={plan.RootCause} onChange={(e) => handleReactionPlanChange(idx, 'RootCause', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Root Cause..." /></td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50"><textarea value={plan.CorrectiveAction} onChange={(e) => handleReactionPlanChange(idx, 'CorrectiveAction', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Action Taken..." /></td>
                        <td className="border border-gray-400 p-0 relative bg-gray-50"><input type="text" value={plan.Status || 'Pending'} readOnly className="absolute inset-0 w-full h-full text-center text-sm font-bold text-red-700 bg-red-50 outline-none" /></td>

                        <td className="border border-gray-400 p-2 align-top">
                          <select value={plan.ReviewedBy} onChange={(e) => handleReactionPlanChange(idx, 'ReviewedBy', e.target.value)} className="w-full border p-2 rounded focus:outline-blue-500 text-sm font-bold bg-white text-gray-800">
                            <option value="">Operator...</option>{operatorList.map((op, i) => <option key={i} value={op.name}>{op.name}</option>)}
                          </select>
                        </td>
                        <td className="border border-gray-400 p-2 align-top">
                          <select value={plan.ApprovedBy} onChange={(e) => handleReactionPlanChange(idx, 'ApprovedBy', e.target.value)} className="w-full border p-2 rounded focus:outline-blue-500 text-sm font-bold bg-white text-gray-800">
                            <option value="">Supervisor...</option>{supervisorList.map((sup, i) => <option key={i} value={sup.name}>{sup.name}</option>)}
                          </select>
                        </td>

                        <td className="border border-gray-400 p-0 relative bg-gray-50"><textarea value={plan.Remarks} onChange={(e) => handleReactionPlanChange(idx, 'Remarks', e.target.value)} className="absolute inset-0 w-full h-full p-3 text-sm font-bold text-gray-900 bg-white outline-none focus:bg-orange-50 focus:ring-2 focus:ring-orange-500 transition-colors resize-none placeholder:text-gray-400 placeholder:font-medium" placeholder="Remarks..." /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-gray-100 p-6 border-t border-gray-300 text-gray-800 text-sm font-medium leading-relaxed shrink-0">
            <h4 className="font-bold text-gray-900 mb-2 uppercase">NOTE:</h4>
            <ul className="list-none space-y-1 pl-2 text-[13px]">
              <li>a) If Error Proof verification gets failed, inform to Quality team and Previous batch to be Contained...</li>
              <li>b) If any deviation noticed during continuous monitoring, will be adjusted, Corrected and recorded.</li>
            </ul>
          </div>

          <div id="hof-assign-select" className="mt-2 pt-4 border-t-2 border-gray-200 flex flex-col md:flex-row justify-between items-end gap-8 bg-gray-50 p-6 rounded-b-xl shadow-inner">
            <div className="w-full md:w-1/3 flex flex-col gap-4">
              <div>
                <label className="text-xs font-black text-gray-700 uppercase mb-2 block">Assign HOF for Final Verification</label>
                <select value={headerData.assignedHOF} onChange={(e) => setHeaderData({ ...headerData, assignedHOF: e.target.value })} className="w-full p-3 border-2 border-gray-400 bg-white rounded-lg font-bold text-gray-800 outline-none focus:border-blue-500">
                  <option value="">Select HOF...</option>
                  {hofList.map((hof, i) => <option key={i} value={hof.name}>{hof.name}</option>)}
                </select>
              </div>
            </div>

            <div className="w-full md:w-2/3 flex flex-col gap-4 items-end">
              <div className="flex flex-wrap gap-4 w-full md:w-auto justify-end mt-2">
                <button onClick={generatePDF} className="bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-200 font-bold py-3 px-6 rounded-lg shadow-md uppercase flex items-center gap-2 transition-colors">
                  <FileDown size={20} /> Preview PDF
                </button>

                <button onClick={() => saveToServer(false)} className={`${isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-800 hover:bg-gray-900'} text-white font-bold py-3 px-8 rounded-lg shadow-lg uppercase transition-colors flex items-center gap-3`}>
                  <Save className="w-5 h-5" /> {isEditMode ? 'Update Shifts Data' : 'Save Shifts Data'}
                </button>

                <button onClick={() => saveToServer(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg uppercase transition-colors flex items-center gap-3">
                  <Send className="w-5 h-5" /> Send to HOF
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ErrorProofVerification2;