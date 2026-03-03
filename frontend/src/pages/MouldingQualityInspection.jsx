import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import Header from "../components/Header";
import SignatureCanvas from "react-signature-canvas";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FileDown, Send } from "lucide-react";

// --- Auto Calculate Date and Shift ---
const getShiftInfo = () => {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();

  let shift = "I";
  
  if ((h > 7 && h < 15) || (h === 7) || (h === 15 && m < 30)) {
    shift = "I";
  } else if ((h === 15 && m >= 30) || (h > 15 && h <= 23)) {
    shift = "II";
  } else {
    shift = "III";
  }

  if (h < 7) {
    now.setDate(now.getDate() - 1);
  }

  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - (offset * 60 * 1000));
  const dateStr = localDate.toISOString().split("T")[0];

  return { dateStr, shift };
};

const MouldingQualityInspection = () => {
  const initialInfo = getShiftInfo();
  
  const [date, setDate] = useState(initialInfo.dateStr);
  const [currentShift] = useState(initialInfo.shift);
  const [disaMachine, setDisaMachine] = useState("DISA - I");
  
  const [operatorList, setOperatorList] = useState([]);
  const [supervisorList, setSupervisorList] = useState([]);
  const [verifiedBy, setVerifiedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  
  const opSigCanvas = useRef({});
  
  const getEmptyRow = (index) => ({ 
    sNo: String(index), shift: currentShift, partName: "", dataCode: "", fmSoftRamming: "", 
    fmMouldBreakage: "", fmMouldCrack: "", fmLooseSand: "", fmPatternSticking: "", fmCoreSetting: "", 
    drMouldCrush: "", drLooseSand: "", drPatternSticking: "", drDateHeatCode: "", drFilterSize: "", 
    drSurfaceHardnessPP: "", drSurfaceHardnessSP: "", drInsideMouldPP: "", drInsideMouldSP: "", 
    drPatternTempPP: "", drPatternTempSP: "" 
  });

  const [rows, setRows] = useState([getEmptyRow(1)]);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/mould-quality/users`)
      .then(res => {
        setOperatorList(res.data.operators || []);
        setSupervisorList(res.data.supervisors || []);
      })
      .catch(err => console.error("Failed to fetch users", err));
  }, []);

  const addRow = () => {
    setRows([...rows, getEmptyRow(rows.length + 1)]);
  };

  const updateRow = (index, field, value) => {
    const updated = [...rows];
    updated[index][field] = value;
    setRows(updated);
  };

  const removeRow = (index) => {
    if (rows.length > 1) {
      const updated = rows.filter((_, i) => i !== index);
      updated.forEach((r, i) => r.sNo = String(i + 1));
      setRows(updated);
    }
  };

  const handleDownloadReport = () => {
    window.open(`${process.env.REACT_APP_API_URL}/api/mould-quality/report?date=${date}&disaMachine=${disaMachine}`, "_blank");
  };

  const handleSubmit = async () => {
    if (!verifiedBy || !approvedBy) return toast.error("Operator and Supervisor names are required!");
    if (opSigCanvas.current.isEmpty()) return toast.error("Operator Signature is required!");

    const payload = {
      recordDate: date,
      disaMachine,
      verifiedBy,
      operatorSignature: opSigCanvas.current.getCanvas().toDataURL("image/png"),
      approvedBy,
      rows
    };

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/mould-quality/add`, payload);
      toast.success("Report Submitted Successfully!");
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error("Failed to submit report.");
    }
  };

  // Base style for standard text inputs
  const inputStyle = "w-full bg-transparent outline-none text-center p-2 min-w-[50px] focus:bg-orange-100 text-sm font-bold text-gray-800";

  // 🔥 FIXED: Removed type="number" so the text isn't hidden by arrows, matching the standard table layout
  const renderThresholdInput = (index, field, value, minVal) => {
    const isBelow = value !== "" && !isNaN(value) && Number(value) < minVal;
    
    return (
      <div className={`w-full h-full flex flex-col items-center justify-center ${isBelow ? 'bg-red-50' : ''}`}>
        <input
          type="text"
          className={`w-full bg-transparent outline-none text-center p-2 min-w-[50px] focus:bg-orange-100 text-sm font-bold transition-colors ${
            isBelow ? 'text-red-600' : 'text-gray-800'
          }`}
          value={value}
          onChange={e => updateRow(index, field, e.target.value)}
        />
        {isBelow && (
          <span className="text-[10px] text-red-600 font-bold leading-none pb-1 whitespace-nowrap">
            Min: {minVal}
          </span>
        )}
      </div>
    );
  };

  return (
    <>
      <Header />
      <ToastContainer />
      <div className="min-h-screen bg-[#2d2d2d] p-6 text-gray-900 font-sans">
        <div className="max-w-[100rem] mx-auto bg-white rounded-xl shadow-2xl overflow-hidden p-8">
          
          <h2 className="text-3xl font-black text-center mb-8 uppercase tracking-widest text-gray-800 border-b pb-4">
            Moulding Quality Inspection Report
          </h2>

          <div className="flex flex-wrap gap-6 mb-8 justify-between bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-4">
              <label className="font-bold text-gray-600 uppercase text-xs tracking-wider">Date:</label>
              <input type="date" className="p-2 border rounded shadow-inner outline-none font-bold" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="font-bold text-gray-600 uppercase text-xs tracking-wider">Shift:</label>
              <div className="p-2 border rounded shadow-inner bg-gray-200 font-bold text-gray-700 w-24 text-center select-none cursor-not-allowed">
                {currentShift}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="font-bold text-gray-600 uppercase text-xs tracking-wider">Machine:</label>
              <select className="p-2 border rounded shadow-inner outline-none font-bold" value={disaMachine} onChange={e => setDisaMachine(e.target.value)}>
                <option value="DISA - I">DISA - I</option>
                <option value="DISA - II">DISA - II</option>
                <option value="DISA - III">DISA - III</option>
                <option value="DISA - IV">DISA - IV</option>
              </select>
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="overflow-x-auto border-2 border-gray-300 rounded-xl mb-8 pb-32 relative">
            <table className="w-full text-center border-collapse">
              <thead className="bg-gray-100 uppercase text-[10px] tracking-wider text-gray-600 sticky top-0 z-10 shadow">
                <tr>
                  <th className="border border-gray-300 p-2" rowSpan={3}>S.No</th>
                  <th className="border border-gray-300 p-2" rowSpan={3}>Shift</th>
                  <th className="border border-gray-300 p-2 min-w-[150px]" rowSpan={3}>Part Name</th>
                  <th className="border border-gray-300 p-2 min-w-[100px]" rowSpan={3}>Data Code</th>
                  <th className="border border-gray-300 p-2 bg-orange-50 text-orange-800" colSpan={6}>First Moulding</th>
                  <th className="border border-gray-300 p-2 bg-blue-50 text-blue-800" colSpan={11}>During Running</th>
                  <th className="border border-gray-300 p-2" rowSpan={3}>Action</th>
                </tr>
                <tr>
                  <th className="border border-gray-300 p-2 bg-orange-50/50" rowSpan={2}>Soft Ramming</th>
                  <th className="border border-gray-300 p-2 bg-orange-50/50" rowSpan={2}>Mould Breakage</th>
                  <th className="border border-gray-300 p-2 bg-orange-50/50" rowSpan={2}>Mould Crack</th>
                  <th className="border border-gray-300 p-2 bg-orange-50/50" rowSpan={2}>Loose Sand</th>
                  <th className="border border-gray-300 p-2 bg-orange-50/50" rowSpan={2}>Pattern Sticking</th>
                  <th className="border border-gray-300 p-2 bg-orange-50/50" rowSpan={2}>Core Setting</th>
                  
                  <th className="border border-gray-300 p-2 bg-blue-50/50" rowSpan={2}>Mould Crush</th>
                  <th className="border border-gray-300 p-2 bg-blue-50/50" rowSpan={2}>Loose Sand</th>
                  <th className="border border-gray-300 p-2 bg-blue-50/50" rowSpan={2}>Pattern Sticking</th>
                  <th className="border border-gray-300 p-2 bg-blue-50/50 min-w-[120px]" rowSpan={2}>Date/Heat Code</th>
                  <th className="border border-gray-300 p-2 bg-blue-50/50" rowSpan={2}>Filter Size</th>
                  
                  <th className="border border-gray-300 p-2 bg-indigo-50" colSpan={2}>Surface Hardness (Min 85)</th>
                  <th className="border border-gray-300 p-2 bg-teal-50" colSpan={2}>Inside Penetrant (Min 20)</th>
                  <th className="border border-gray-300 p-2 bg-rose-50" colSpan={2}>Pattern Temp (Min 45°C)</th>
                </tr>
                <tr>
                  <th className="border border-gray-300 p-1 bg-indigo-100">PP</th><th className="border border-gray-300 p-1 bg-indigo-100">SP</th>
                  <th className="border border-gray-300 p-1 bg-teal-100">PP</th><th className="border border-gray-300 p-1 bg-teal-100">SP</th>
                  <th className="border border-gray-300 p-1 bg-rose-100">PP</th><th className="border border-gray-300 p-1 bg-rose-100">SP</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors border-b">
                    <td className="border border-gray-300 p-0"><input className={`${inputStyle} bg-gray-100 cursor-not-allowed text-gray-500`} value={row.sNo} readOnly /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.shift} onChange={e => updateRow(index, 'shift', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.partName} onChange={e => updateRow(index, 'partName', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.dataCode} onChange={e => updateRow(index, 'dataCode', e.target.value)} /></td>
                    
                    {/* First Moulding */}
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.fmSoftRamming} onChange={e => updateRow(index, 'fmSoftRamming', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.fmMouldBreakage} onChange={e => updateRow(index, 'fmMouldBreakage', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.fmMouldCrack} onChange={e => updateRow(index, 'fmMouldCrack', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.fmLooseSand} onChange={e => updateRow(index, 'fmLooseSand', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.fmPatternSticking} onChange={e => updateRow(index, 'fmPatternSticking', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.fmCoreSetting} onChange={e => updateRow(index, 'fmCoreSetting', e.target.value)} /></td>
                    
                    {/* During Running */}
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.drMouldCrush} onChange={e => updateRow(index, 'drMouldCrush', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.drLooseSand} onChange={e => updateRow(index, 'drLooseSand', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.drPatternSticking} onChange={e => updateRow(index, 'drPatternSticking', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.drDateHeatCode} onChange={e => updateRow(index, 'drDateHeatCode', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} value={row.drFilterSize} onChange={e => updateRow(index, 'drFilterSize', e.target.value)} /></td>
                    
                    {/* Values with MIN thresholds */}
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drSurfaceHardnessPP', row.drSurfaceHardnessPP, 85)}</td>
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drSurfaceHardnessSP', row.drSurfaceHardnessSP, 85)}</td>
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drInsideMouldPP', row.drInsideMouldPP, 20)}</td>
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drInsideMouldSP', row.drInsideMouldSP, 20)}</td>
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drPatternTempPP', row.drPatternTempPP, 45)}</td>
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drPatternTempSP', row.drPatternTempSP, 45)}</td>
                    
                    <td className="border border-gray-300 p-2">
                      <button onClick={() => removeRow(index)} className="text-red-500 hover:text-red-700 font-bold bg-red-100 px-3 py-1 rounded">X</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4 bg-gray-50 flex justify-center">
              <button onClick={addRow} className="bg-gray-800 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-black uppercase tracking-widest text-sm">+ Add Row</button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-10 pt-8 border-t-2 border-dashed border-gray-300">
            <div className="flex-1 flex flex-col gap-3">
              <label className="font-black text-xs uppercase tracking-widest text-gray-500">Verified By (Operator)</label>
              <select value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)} className="p-3 border-2 border-gray-300 rounded outline-none font-bold text-gray-800">
                <option value="">Select Operator...</option>
                {operatorList.map((o, i) => <option key={i} value={o.name}>{o.name}</option>)}
              </select>

              <label className="font-black text-xs uppercase tracking-widest text-gray-500 mt-4">Operator Signature</label>
              <div className="border-2 border-dashed border-gray-300 rounded h-24 relative overflow-hidden">
                <SignatureCanvas ref={opSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-full cursor-crosshair' }} />
              </div>
              <button onClick={() => opSigCanvas.current.clear()} className="text-red-500 text-xs font-bold underline self-end">Clear Pad</button>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <label className="font-black text-xs uppercase tracking-widest text-gray-500">Assign Supervisor for Approval</label>
              <select value={approvedBy} onChange={e => setApprovedBy(e.target.value)} className="p-3 border-2 border-gray-300 rounded outline-none font-bold text-gray-800">
                <option value="">Select Supervisor...</option>
                {supervisorList.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
              </select>

              <div className="mt-auto flex gap-4 pt-8">
                <button onClick={handleDownloadReport} className="w-1/3 bg-gray-800 hover:bg-gray-900 text-white font-black text-sm py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 uppercase tracking-wider flex items-center justify-center gap-2">
                  <FileDown size={18} /> PDF
                </button>
                <button onClick={handleSubmit} className="w-2/3 bg-orange-600 hover:bg-orange-700 text-white font-black text-sm py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 uppercase tracking-wider flex items-center justify-center gap-2">
                  <Send size={18} /> Submit to Supervisor
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default MouldingQualityInspection;