import React, { useState, useEffect } from "react";
import axios from "axios";
import Header from "../components/Header";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FileDown, Send, Edit3 } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

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

// --- HELPER: VALIDATE COMMA-SEPARATED NUMBERS ---
const validateMultipleNumbers = (valString, minLimit) => {
  if (!valString || valString === "-" || String(valString).trim() === "") return true; 
  
  const parts = String(valString).split(',');
  for (let part of parts) {
    const num = Number(part.trim());
    if (isNaN(num) || num < minLimit) return false;
  }
  return true;
};

// ==========================================
// COMPONENT: SearchableSelect 
// ==========================================
const SearchableSelect = ({ options, displayKey, onSelect, value, placeholder }) => {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => setSearch(value || ""), [value]);

  const filtered = options.filter((item) =>
    item[displayKey]?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full h-full">
      <input
        type="text"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
          onSelect({ [displayKey]: e.target.value });
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full h-16 bg-transparent outline-none text-center px-3 min-w-[150px] focus:bg-orange-100 text-base font-bold text-gray-800"
        placeholder={placeholder || "Search..."}
      />
      {open && (
        <ul className="absolute z-50 bg-white border border-gray-300 w-full max-h-40 overflow-y-auto rounded shadow-2xl mt-1 text-left left-0">
          {filtered.length > 0 ? (
            filtered.map((item, index) => (
              <li
                key={index}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSearch(item[displayKey]);
                  setOpen(false);
                  onSelect(item);
                }}
                className="p-2 hover:bg-orange-100 cursor-pointer text-sm border-b border-gray-100 last:border-0 font-semibold"
              >
                {item[displayKey]}
              </li>
            ))
          ) : (
            <li className="p-2 text-gray-500 text-sm">No results</li>
          )}
        </ul>
      )}
    </div>
  );
};

const MouldingQualityInspection = () => {
  const initialInfo = getShiftInfo();

  // Primary States
  const [reportId, setReportId] = useState(null); // Track if editing existing data
  const [date, setDate] = useState(initialInfo.dateStr);
  const [currentShift, setCurrentShift] = useState(initialInfo.shift);
  const [disaMachine, setDisaMachine] = useState("DISA - I");

  // Dropdown States
  const [operatorList, setOperatorList] = useState([]);
  const [supervisorList, setSupervisorList] = useState([]);
  const [components, setComponents] = useState([]); 
  
  // Form States
  const [verifiedBy, setVerifiedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");

  const getEmptyRow = (index, shiftVal = currentShift) => ({
    sNo: String(index), shift: shiftVal, partName: "", dataCode: "", fmSoftRamming: "",
    fmMouldBreakage: "", fmMouldCrack: "", fmLooseSand: "", fmPatternSticking: "", fmCoreSetting: "",
    drMouldCrush: "", drLooseSand: "", drPatternSticking: "", drDateHeatCode: "", drFilterSize: "",
    drSurfaceHardnessPP: "", drSurfaceHardnessSP: "", drInsideMouldPP: "", drInsideMouldSP: "",
    drPatternTempPP: "", drPatternTempSP: ""
  });

  const [rows, setRows] = useState([getEmptyRow(1)]);

  // Load Dropdown Options on Mount
  useEffect(() => {
    axios.get(`${API_BASE}/mould-quality/users`)
      .then(res => {
        setOperatorList(res.data.operators || []);
        setSupervisorList(res.data.supervisors || []);
      })
      .catch(err => console.error("Failed to fetch users", err));

    axios.get(`${API_BASE}/mould-quality/components`)
      .then(res => setComponents(res.data || []))
      .catch(err => console.error("Failed to fetch components", err));
  }, []);

  // 🔥 CHECK EXISTING DATA WHEN DATE, SHIFT, OR MACHINE CHANGES
  useEffect(() => {
    const fetchExistingData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/mould-quality/check`, {
          params: { date, disa: disaMachine, shift: currentShift }
        });
        
        if (res.data && res.data.id) {
          // Data found -> Populate Form
          setReportId(res.data.id);
          setVerifiedBy(res.data.verifiedBy || "");
          setApprovedBy(res.data.approvedBy || "");
          setRows(res.data.rows && res.data.rows.length > 0 ? res.data.rows : [getEmptyRow(1, currentShift)]);
          toast.info("Loaded existing report for selected Date, Shift, and Machine.");
        } else {
          // No Data -> Reset Form
          setReportId(null);
          setVerifiedBy("");
          setApprovedBy("");
          setRows([getEmptyRow(1, currentShift)]);
        }
      } catch (err) {
        console.error("Failed to check existing data", err);
      }
    };
    
    fetchExistingData();
  }, [date, disaMachine, currentShift]); // Triggers every time these change

  const addRow = () => {
    setRows([...rows, getEmptyRow(rows.length + 1, currentShift)]);
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

  const handleShiftChange = (e) => {
    setCurrentShift(e.target.value);
    // Note: No longer setting rows here. The useEffect handles re-fetching/resetting rows!
  };

  const handleDownloadReport = async () => {
    try {
      const response = await axios.get(`${API_BASE}/mould-quality/report?date=${date}&disaMachine=${disaMachine}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Moulding_Quality_${date}_${disaMachine}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      toast.success("PDF Downloaded successfully!");
    } catch (err) {
      toast.error("Failed to download PDF. Please submit data first.");
    }
  };

  const handleSubmit = async () => {
    let hasEmpty = false;
    rows.forEach(row => {
      const keysToCheck = [
        "partName", "dataCode", "fmSoftRamming", "fmMouldBreakage", "fmMouldCrack", "fmLooseSand", 
        "fmPatternSticking", "fmCoreSetting", "drMouldCrush", "drLooseSand", "drPatternSticking", 
        "drDateHeatCode", "drFilterSize", "drSurfaceHardnessPP", "drSurfaceHardnessSP", 
        "drInsideMouldPP", "drInsideMouldSP", "drPatternTempPP", "drPatternTempSP"
      ];
      keysToCheck.forEach(key => {
        if (!row[key] || String(row[key]).trim() === '') hasEmpty = true;
      });
    });

    if (hasEmpty) return toast.error("Please fill all input fields. Type '-' if empty.");
    if (!verifiedBy || !approvedBy) return toast.error("Operator and Supervisor names are required!");

    const payload = {
      recordDate: date,
      disaMachine,
      verifiedBy,
      operatorSignature: "APPROVED",
      approvedBy,
      rows
    };

    try {
      if (reportId) {
        // 🔥 UPDATE EXISTING REPORT
        await axios.put(`${API_BASE}/mould-quality/update/${reportId}`, payload);
        toast.success("Report Updated Successfully!");
      } else {
        // 🔥 CREATE NEW REPORT
        await axios.post(`${API_BASE}/mould-quality/add`, payload);
        toast.success("Report Submitted Successfully!");
      }
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error("Failed to save report.");
    }
  };

  const inputStyle = "w-full h-16 bg-transparent outline-none text-center px-3 min-w-[90px] focus:bg-orange-100 placeholder:text-[10px] placeholder:text-gray-400 text-base font-bold text-gray-800";

  const renderThresholdInput = (index, field, value, minVal) => {
    const isValid = validateMultipleNumbers(value, minVal);

    return (
      <div className={`w-full h-16 min-w-[120px] flex flex-col items-center justify-center ${!isValid ? 'bg-red-50' : ''}`}>
        <input
          type="text"
          placeholder="Ex: 21.5, 23.2"
          className={`w-full h-full bg-transparent outline-none text-center px-2 focus:bg-orange-100 placeholder:text-[10px] placeholder:text-gray-400 text-base font-bold transition-colors ${!isValid ? 'text-red-600' : 'text-gray-800'}`}
          value={value}
          onChange={e => updateRow(index, field, e.target.value)}
        />
        {!isValid && (
          <span className="text-xs text-red-600 font-bold leading-none pb-1.5 whitespace-nowrap">
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
            {reportId && <span className="ml-4 text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full">(Editing Mode)</span>}
          </h2>

          <div className="flex flex-wrap gap-6 mb-8 justify-between bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-4">
              <label className="font-bold text-gray-600 uppercase text-xs tracking-wider">Date:</label>
              <input type="date" className="p-2 border rounded shadow-inner outline-none font-bold bg-white" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex items-center gap-4">
              <label className="font-bold text-gray-600 uppercase text-xs tracking-wider">Shift:</label>
              <select
                className="p-2 border rounded shadow-inner bg-white font-bold text-gray-700 w-24 text-center cursor-pointer outline-none focus:border-orange-500"
                value={currentShift}
                onChange={handleShiftChange}
              >
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="font-bold text-gray-600 uppercase text-xs tracking-wider">Machine:</label>
              <select className="p-2 border rounded shadow-inner outline-none font-bold bg-white focus:border-orange-500 cursor-pointer" value={disaMachine} onChange={e => setDisaMachine(e.target.value)}>
                <option value="DISA - I">DISA - I</option>
                <option value="DISA - II">DISA - II</option>
                <option value="DISA - III">DISA - III</option>
                <option value="DISA - IV">DISA - IV</option>
                <option value="DISA - V">DISA - V</option>
                <option value="DISA - VI">DISA - VI</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border-2 border-gray-300 rounded-xl mb-8 pb-32 relative">
            <table className="w-full text-center border-collapse">
              <thead className="bg-gray-100 uppercase text-[10px] tracking-wider text-gray-600 sticky top-0 z-10 shadow">
                <tr>
                  <th className="border border-gray-300 p-2" rowSpan={3}>S.No</th>
                  <th className="border border-gray-300 p-2 min-w-[70px]" rowSpan={3}>Shift</th>
                  <th className="border border-gray-300 p-2 min-w-[180px]" rowSpan={3}>Part Name</th>
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
                    <td className="border border-gray-300 p-0"><input className={`${inputStyle} bg-gray-100 cursor-not-allowed text-gray-600`} value={row.shift} readOnly /></td>
                    <td className="border border-gray-300 p-0 min-w-[220px]">
                      <SearchableSelect
                        options={components}
                        displayKey="description"
                        value={row.partName}
                        onSelect={(item) => updateRow(index, 'partName', item.description)}
                        placeholder="Search Part..."
                      />
                    </td>
                    <td className="border border-gray-300 p-0 min-w-[120px]"><input className={inputStyle} placeholder="Type '-' if empty" value={row.dataCode} onChange={e => updateRow(index, 'dataCode', e.target.value)} /></td>

                    <td className="border border-gray-300 p-0"><input className={inputStyle} placeholder="Type '-' if empty" value={row.fmSoftRamming} onChange={e => updateRow(index, 'fmSoftRamming', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} placeholder="Type '-' if empty" value={row.fmMouldBreakage} onChange={e => updateRow(index, 'fmMouldBreakage', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} placeholder="Type '-' if empty" value={row.fmMouldCrack} onChange={e => updateRow(index, 'fmMouldCrack', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} placeholder="Type '-' if empty" value={row.fmLooseSand} onChange={e => updateRow(index, 'fmLooseSand', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} placeholder="Type '-' if empty" value={row.fmPatternSticking} onChange={e => updateRow(index, 'fmPatternSticking', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} placeholder="Type '-' if empty" value={row.fmCoreSetting} onChange={e => updateRow(index, 'fmCoreSetting', e.target.value)} /></td>

                    <td className="border border-gray-300 p-0"><input className={inputStyle} placeholder="Type '-' if empty" value={row.drMouldCrush} onChange={e => updateRow(index, 'drMouldCrush', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} placeholder="Type '-' if empty" value={row.drLooseSand} onChange={e => updateRow(index, 'drLooseSand', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} placeholder="Type '-' if empty" value={row.drPatternSticking} onChange={e => updateRow(index, 'drPatternSticking', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0 min-w-[140px]"><input className={inputStyle} placeholder="Type '-' if empty" value={row.drDateHeatCode} onChange={e => updateRow(index, 'drDateHeatCode', e.target.value)} /></td>
                    <td className="border border-gray-300 p-0"><input className={inputStyle} placeholder="Type '-' if empty" value={row.drFilterSize} onChange={e => updateRow(index, 'drFilterSize', e.target.value)} /></td>

                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drSurfaceHardnessPP', row.drSurfaceHardnessPP, 85)}</td>
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drSurfaceHardnessSP', row.drSurfaceHardnessSP, 85)}</td>
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drInsideMouldPP', row.drInsideMouldPP, 20)}</td>
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drInsideMouldSP', row.drInsideMouldSP, 20)}</td>
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drPatternTempPP', row.drPatternTempPP, 45)}</td>
                    <td className="border border-gray-300 p-0 align-top">{renderThresholdInput(index, 'drPatternTempSP', row.drPatternTempSP, 45)}</td>

                    <td className="border border-gray-300 p-3 min-w-[80px]">
                      <button onClick={() => removeRow(index)} className="text-red-500 hover:text-red-700 font-bold bg-red-100 px-4 py-2 text-base rounded shadow-sm w-full">X</button>
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
              <select value={verifiedBy} onChange={e => setVerifiedBy(e.target.value)} className="p-3 border-2 border-gray-300 rounded outline-none font-bold text-gray-800 bg-white">
                <option value="">Select Operator...</option>
                {operatorList.map((o, i) => <option key={i} value={o.name}>{o.name}</option>)}
              </select>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <label className="font-black text-xs uppercase tracking-widest text-gray-500">Assign Supervisor for Approval</label>
              <select value={approvedBy} onChange={e => setApprovedBy(e.target.value)} className="p-3 border-2 border-gray-300 rounded outline-none font-bold text-gray-800 bg-white">
                <option value="">Select Supervisor...</option>
                {supervisorList.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
              </select>

              <div className="mt-auto flex gap-4 pt-8">
                <button onClick={handleDownloadReport} className="w-1/3 bg-gray-800 hover:bg-gray-900 text-white font-black text-sm py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 uppercase tracking-wider flex items-center justify-center gap-2">
                  <FileDown size={18} /> PDF
                </button>
                <button onClick={handleSubmit} className={`w-2/3 text-white font-black text-sm py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 uppercase tracking-wider flex items-center justify-center gap-2 ${reportId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  {reportId ? <><Edit3 size={18} /> Update Data</> : <><Send size={18} /> Submit to Supervisor</>}
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