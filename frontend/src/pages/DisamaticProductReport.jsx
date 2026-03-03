import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import logo from "../Assets/logo.png"; // Imported logo

// --- HELPER: Calculate Production Date & Shift ---
const getProductionDateTime = () => {
  const now = new Date();
  const hours = now.getHours();
  const mins = now.getMinutes();
  const time = hours + mins / 60; 

  let shift = "I";
  if (time >= 7 && time < 15.5) {
    shift = "I"; 
  } else if (time >= 15.5 && time < 24) {
    shift = "II"; 
  } else {
    shift = "III"; 
  }

  const prodDate = new Date(now);
  if (hours < 7) {
    prodDate.setDate(prodDate.getDate() - 1);
  }
  
  const year = prodDate.getFullYear();
  const month = String(prodDate.getMonth() + 1).padStart(2, '0');
  const day = String(prodDate.getDate()).padStart(2, '0');
  
  return { date: `${year}-${month}-${day}`, shift };
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
const SearchableSelect = ({ label, options, displayKey, onSelect, value, placeholder }) => {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  const filtered = options.filter((item) =>
    item[displayKey]?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative w-full">
      {label && <label className="font-bold text-gray-700 block mb-1 text-left">{label}</label>}
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
        className="w-full border border-gray-400 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm bg-white"
        placeholder={placeholder || `Search or type '-' for ${label || ''}`}
      />
      {open && (
        <ul className="absolute z-50 bg-white border border-gray-300 w-full max-h-40 overflow-y-auto rounded shadow-xl mt-1 text-left">
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
                className="p-2 hover:bg-orange-100 cursor-pointer text-sm border-b border-gray-100 last:border-0"
              >
                {item[displayKey]}
              </li>
            ))
          ) : (
            <li className="p-2 text-gray-500 text-sm">No results found</li>
          )}
        </ul>
      )}
    </div>
  );
};

// ==========================================
// COMPONENT: MultiSelect Checkbox Dropdown
// ==========================================
const MultiSelectDropdown = ({ options, displayKey, selectedValue, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);

  const selectedArray = selectedValue && selectedValue !== "-" ? selectedValue.split(', ') : [];

  const handleToggle = (val) => {
    let newArr = [...selectedArray];
    if (newArr.includes(val)) {
      newArr = newArr.filter((item) => item !== val);
    } else {
      newArr.push(val);
    }
    onChange(newArr.length > 0 ? newArr.join(', ') : "-");
  };

  return (
    <div className="relative w-full flex-1">
      <div 
        className="w-full border border-gray-300 p-2 rounded focus:outline-none min-h-[40px] text-sm bg-white cursor-pointer text-left flex items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedValue || "-"}
      </div>
      
      {isOpen && (
        <React.Fragment>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <ul className="absolute z-50 bg-white border border-gray-300 w-full max-h-40 overflow-y-auto rounded shadow-2xl mt-1 text-left">
            {options.map((item, index) => (
              <li 
                key={index} 
                className="p-2 hover:bg-orange-50 text-sm border-b border-gray-100 last:border-0 flex items-center gap-2 cursor-pointer"
                onClick={() => handleToggle(item[displayKey])}
              >
                <input 
                  type="checkbox" 
                  readOnly
                  checked={selectedArray.includes(item[displayKey])}
                  className="cursor-pointer pointer-events-none"
                />
                <span>{item[displayKey]}</span>
              </li>
            ))}
          </ul>
        </React.Fragment>
      )}
    </div>
  );
};

// ==========================================
// MAIN COMPONENT
// ==========================================
const DisamaticProductReport = () => {
  const { date: initDate, shift: initShift } = getProductionDateTime();

  const initialFormState = {
    disa: "",
    date: initDate,
    shift: initShift,
    incharge: "",
    member: "",
    ppOperator: "", 
    significantEvent: "",
    maintenance: "",
    supervisorName: "",
  };

  const [formData, setFormData] = useState(() => {
    const savedDraft = localStorage.getItem("disaFormDraft");
    if (savedDraft) {
      const parsed = JSON.parse(savedDraft);
      return { ...parsed, date: initDate, shift: initShift };
    }
    return initialFormState;
  });

  const [productions, setProductions] = useState([
    { componentName: "", pouredWeight: "", mouldCounterNo: "", produced: "", poured: "", cycleTime: "", mouldsPerHour: "", remarks: "" }
  ]);
  const [resetKey, setResetKey] = useState(0);

  const [incharges, setIncharges] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [operators, setOperators] = useState([]);
  const [components, setComponents] = useState([]);
  const [previousMouldCounter, setPreviousMouldCounter] = useState(0);
  const [nextShiftPlans, setNextShiftPlans] = useState([{ componentName: "", plannedMoulds: "", remarks: "" }]);
  
  const [delays, setDelays] = useState([{ delayType: "", startTime: "", endTime: "", duration: "" }]);
  const [delaysMaster, setDelaysMaster] = useState([]); 
  
  const [mouldHardness, setMouldHardness] = useState([{ componentName: "", penetrationPP: "", penetrationSP: "", bScalePP: "", bScaleSP: "", remarks: "-" }]);
  const [mouldRemarksList, setMouldRemarksList] = useState([]); 
  const [patternTemps, setPatternTemps] = useState([{ componentName: "", pp: "", sp: "", remarks: "" }]);
  const [supervisors, setSupervisors] = useState([]);

  // Use a ref to prevent double-toasting on the very first mount
  const isFirstRender = useRef(true);

  useEffect(() => {
    localStorage.setItem("disaFormDraft", JSON.stringify(formData));
  }, [formData]);

  // 🔥 CENTRALIZED FETCH LOGIC 🔥
  // Listens to Date, Shift, and DISA specifically. Fetches data when any of the three changes.
  useEffect(() => {
    const fetchPersonnelAndCounter = async () => {
      if (formData.disa && formData.disa !== "-" && formData.date && formData.shift) {
        try {
          // 1. Fetch Personnel
          const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/forms/last-personnel`, {
            params: { disa: formData.disa, date: formData.date, shift: formData.shift }
          });
          
          if (res.data) {
            setFormData((prev) => ({
              ...prev,
              incharge: res.data.incharge || "",
              member: res.data.member || "",
              ppOperator: res.data.ppOperator || "",
              supervisorName: res.data.supervisorName || "",
            }));
            if (!isFirstRender.current) toast.success(`Personnel auto-filled for DISA-${formData.disa}`);
          } else {
            // Reset personnel fields if no previous data found
            setFormData((prev) => ({
              ...prev,
              incharge: "", member: "", ppOperator: "", supervisorName: ""
            }));
            if (!isFirstRender.current) toast.info(`First entry for DISA-${formData.disa} in this shift.`);
          }

          // 2. Fetch Last Mould Counter
          const counterRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/forms/last-mould-counter`, {
            params: { disa: formData.disa }
          });
          const fetchedCounter = Number(counterRes.data.lastMouldCounter) || 0;
          setPreviousMouldCounter(fetchedCounter);
          
          // 3. Recalculate production based on new fetched counter
          setProductions(prevList => {
            let prev = fetchedCounter || 0; 
            return prevList.map((item) => {
              if (item.mouldCounterNo === "-" || String(item.mouldCounterNo).trim() === "") return { ...item, produced: "-" };
              
              let currentInput = Number(item.mouldCounterNo) || 0;
              let produced = 0;
              let displayCounter = String(item.mouldCounterNo);

              // Wrap-around logic (> 600000)
              if (currentInput > 600000) {
                const remainder = currentInput % 600000;
                produced = (600000 - prev) + remainder;
                displayCounter = String(remainder);
                prev = remainder;
              } else if (currentInput > 0 && currentInput < prev) {
                // Manual wrap case
                produced = (600000 - prev) + currentInput;
                prev = currentInput;
              } else {
                // Normal case
                produced = currentInput ? Math.max(0, currentInput - prev) : 0;
                prev = currentInput;
              }

              return { 
                ...item, 
                mouldCounterNo: displayCounter, 
                produced: isNaN(produced) ? "-" : produced 
              };
            });
          });

        } catch (err) {
          console.error("Failed to fetch dynamic personnel/counter data", err);
        }
      }
    };

    fetchPersonnelAndCounter();
    isFirstRender.current = false;
  }, [formData.disa, formData.date, formData.shift]);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/delays`).then((res) => setDelaysMaster(res.data));
    axios.get(`${process.env.REACT_APP_API_URL}/api/incharges`).then((res) => setIncharges(res.data));
    axios.get(`${process.env.REACT_APP_API_URL}/api/employees`).then((res) => setEmployees(res.data));
    axios.get(`${process.env.REACT_APP_API_URL}/api/operators`).then((res) => setOperators(res.data));
    axios.get(`${process.env.REACT_APP_API_URL}/api/components`).then((res) => setComponents(res.data));
    axios.get(`${process.env.REACT_APP_API_URL}/api/supervisors`).then((res) => setSupervisors(res.data));
    axios.get(`${process.env.REACT_APP_API_URL}/api/mould-hardness-remarks`).then((res) => setMouldRemarksList(res.data));
  }, []);

  // Updated handleChange: Clears personnel on Date/Shift change to force fresh fetch via useEffect
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "date" || name === "shift") {
        updated.incharge = "";
        updated.member = "";
        updated.ppOperator = "";
        updated.supervisorName = "";
      }
      return updated;
    });
  };

  // 🔥 FIX: Removed async/await logic. Now only updates state. The useEffect handles the fetch.
  const handleDisaChange = (e) => {
    const selectedDisa = e.target.value;
    setFormData((prev) => ({ 
      ...prev, 
      disa: selectedDisa,
      incharge: "", member: "", ppOperator: "", supervisorName: ""
    }));
  };

  const addNextShiftPlan = () => setNextShiftPlans([...nextShiftPlans, { componentName: "", plannedMoulds: "", remarks: "" }]);
  const updateNextShiftPlan = (index, field, value) => {
    const updated = [...nextShiftPlans];
    updated[index][field] = value;
    setNextShiftPlans(updated);
  };
  const removeNextShiftPlan = (index) => {
    if (nextShiftPlans.length === 1) return;
    setNextShiftPlans(nextShiftPlans.filter((_, i) => i !== index));
  };

  const addDelay = () => setDelays([...delays, { delayType: "", startTime: "", endTime: "", duration: "" }]);
  const removeDelay = (index) => {
    if (delays.length === 1) return;
    setDelays(delays.filter((_, i) => i !== index));
  };
  const updateDelay = (index, field, value) => {
    const updated = [...delays];
    updated[index][field] = value;
    
    if (updated[index].startTime && updated[index].endTime && updated[index].startTime !== "-" && updated[index].endTime !== "-") {
      const startParts = updated[index].startTime.split(':');
      const endParts = updated[index].endTime.split(':');
      if(startParts.length === 2 && endParts.length === 2) {
        const start = new Date(`1970-01-01T${updated[index].startTime}:00`);
        const end = new Date(`1970-01-01T${updated[index].endTime}:00`);
        let diff = (end - start) / 60000; 
        if (diff < 0) diff += 1440;
        updated[index].duration = isNaN(diff % 720) ? "-" : Math.round(diff % 720); 
      } else {
        updated[index].duration = "-";
      }
    } else {
      updated[index].duration = "-";
    }
    setDelays(updated);
  };

  const addMouldHardness = () => setMouldHardness([...mouldHardness, { componentName: "", penetrationPP: "", penetrationSP: "", bScalePP: "", bScaleSP: "", remarks: "-" }]);
  const removeMouldHardness = (index) => {
    if (mouldHardness.length === 1) return;
    setMouldHardness(mouldHardness.filter((_, i) => i !== index));
  };
  const updateMouldHardness = (index, field, value) => {
    const updated = [...mouldHardness];
    updated[index][field] = value;
    setMouldHardness(updated);
  };

  const addPatternTemp = () => setPatternTemps([...patternTemps, { componentName: "", pp: "", sp: "", remarks: "" }]);
  const updatePatternTemp = (index, field, value) => {
    const updated = [...patternTemps];
    updated[index][field] = value;
    setPatternTemps(updated);
  };
  const removePatternTemp = (index) => {
    if (patternTemps.length === 1) return;
    setPatternTemps(patternTemps.filter((_, i) => i !== index));
  };

  const addProduction = () => {
    setProductions([...productions, { componentName: "", pouredWeight: "", mouldCounterNo: "", produced: "", poured: "", cycleTime: "", mouldsPerHour: "", remarks: "" }]);
  };
  
  const removeProduction = (index) => {
    if (productions.length === 1) return;
    const updated = productions.filter((_, i) => i !== index);
    recalculateChain(updated);
  };

  const updateProduction = (index, field, value, extraValue = null) => {
    const updated = [...productions];
    
    if (field === "componentName") {
      updated[index].componentName = value;
      updated[index].pouredWeight = extraValue;
      setProductions(updated);
    }
    else if (field === "mouldCounterNo") {
      updated[index][field] = value;
      recalculateChain(updated); 
    } 
    else if (field === "cycleTime") {
      updated[index][field] = value;
      if (value === "-" || value.trim() === "") {
        updated[index].mouldsPerHour = "-";
      } else {
        const c = Number(value);
        updated[index].mouldsPerHour = (c > 0 && !isNaN(c)) ? Math.round(3600 / c) : "-"; 
      }
      setProductions(updated);
    } 
    else {
      updated[index][field] = value;
      setProductions(updated);
    }
  };

  // 🔥 Integrated Recalculate Logic with Wrap-Around support
  const recalculateChain = (list, baseCounter = previousMouldCounter) => {
    let prev = Number(baseCounter) || 0; 
    const newList = list.map((item) => {
      if (item.mouldCounterNo === "-" || String(item.mouldCounterNo).trim() === "") return { ...item, produced: "-" };
      
      let currentInput = Number(item.mouldCounterNo) || 0;
      let produced = 0;
      let displayCounter = String(item.mouldCounterNo);

      if (currentInput > 600000) {
        const remainder = currentInput % 600000;
        produced = (600000 - prev) + remainder;
        displayCounter = String(remainder); 
        prev = remainder;
      } 
      else if (currentInput > 0 && currentInput < prev) {
        produced = (600000 - prev) + currentInput;
        prev = currentInput;
      } 
      else {
        produced = currentInput ? Math.max(0, currentInput - prev) : 0;
        prev = currentInput;
      }

      return { 
        ...item, 
        mouldCounterNo: displayCounter, 
        produced: isNaN(produced) ? "-" : produced 
      };
    });
    setProductions(newList);
  };

  const isInvalid = (val) => val === undefined || val === null || val.toString().trim() === "";

  const validateForm = () => {
    for (let key in formData) {
      if (isInvalid(formData[key])) return false;
    }
    for (let p of productions) {
      if (isInvalid(p.mouldCounterNo) || isInvalid(p.componentName) || isInvalid(p.poured) || isInvalid(p.cycleTime) || isInvalid(p.mouldsPerHour) || isInvalid(p.remarks)) return false;
    }
    for (let p of nextShiftPlans) {
      if (isInvalid(p.componentName) || isInvalid(p.plannedMoulds) || isInvalid(p.remarks)) return false;
    }
    for (let d of delays) {
      if (isInvalid(d.delayType) || isInvalid(d.startTime) || isInvalid(d.endTime)) return false;
    }
    for (let m of mouldHardness) {
      if (isInvalid(m.componentName) || isInvalid(m.penetrationPP) || isInvalid(m.penetrationSP) || isInvalid(m.bScalePP) || isInvalid(m.bScaleSP) || isInvalid(m.remarks)) return false;
    }
    for (let pt of patternTemps) {
      if (isInvalid(pt.componentName) || isInvalid(pt.pp) || isInvalid(pt.sp) || isInvalid(pt.remarks)) return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill ALL fields. Type a hyphen '-' if there is no data.");
      return;
    }

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/forms`, {
        ...formData, productions, delays, nextShiftPlans, mouldHardness, patternTemps
      });

      const lastItem = productions[productions.length - 1];
      const newPreviousCounter = lastItem.mouldCounterNo && lastItem.mouldCounterNo !== "-" && !isNaN(Number(lastItem.mouldCounterNo))
        ? Number(lastItem.mouldCounterNo) 
        : (Number(previousMouldCounter) || 0);
        
      setPreviousMouldCounter(newPreviousCounter);

      const { date: newDate, shift: newShift } = getProductionDateTime();
      setFormData((prev) => ({
        ...initialFormState,
        disa: prev.disa, 
        date: newDate,
        shift: newShift,
        incharge: prev.incharge,
        member: prev.member,
        ppOperator: prev.ppOperator,
        supervisorName: prev.supervisorName
      }));

      setProductions([{ componentName: "", pouredWeight: "", mouldCounterNo: "", produced: "", poured: "", cycleTime: "", mouldsPerHour: "", remarks: "" }]);
      setNextShiftPlans([{ componentName: "", plannedMoulds: "", remarks: "" }]);
      setDelays([{ delayType: "", startTime: "", endTime: "", duration: "" }]);
      setMouldHardness([{ componentName: "", penetrationPP: "", penetrationSP: "", bScalePP: "", bScaleSP: "", remarks: "-" }]);
      setPatternTemps([{ componentName: "", pp: "", sp: "", remarks: "" }]);
      
      setResetKey((prev) => prev + 1);

      toast.success("Report submitted! Ready for next entry.");
    } catch (err) {
      console.error(err);
      toast.error("Submission failed (Backend Error).");
    }
  };

  const handleDownload = async () => {
    if (!formData.disa || !formData.date) {
      toast.error("Please select a DISA and Date before generating the PDF.");
      return;
    }

    try {
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/forms/download-pdf`, { 
        params: { date: formData.date, disa: formData.disa },
        responseType: "blob" 
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Disamatic_Report_${formData.date}_DISA-${formData.disa}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error("Download failed", err);
      toast.error("No reports found for this selection.");
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
      
      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto">
        
        {/* HEADER WITH LOGO */}
        <div className="flex items-center gap-4 border-b-2 border-gray-800 pb-4 mb-6">
            <img src={logo} alt="Sakthi Auto" className="h-10 w-auto object-contain bg-white p-1 rounded" />
            <h1 className="text-2xl font-bold text-gray-800 tracking-wide uppercase">
              DISAMATIC PRODUCTION REPORT
            </h1>
        </div>

        <form onSubmit={handleSubmit} className="min-w-[1100px] flex flex-col gap-6">
          
          <div className="grid grid-cols-3 gap-6 bg-gray-100 p-4 rounded-lg border border-gray-300">
            <div>
              <label className="font-bold text-gray-700 block mb-1">DISA-</label>
              <select name="disa" value={formData.disa} onChange={handleDisaChange} className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500">
                <option value="">Select</option>
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IV">IV</option>
                <option value="V">V</option>
                <option value="VI">VI</option>
              </select>
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Date</label>
              <input 
                type="date" 
                name="date" 
                value={formData.date} 
                onChange={handleChange} 
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700" 
              />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Shift</label>
              <select 
                name="shift" 
                value={formData.shift} 
                onChange={handleChange} 
                className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-gray-700"
              >
                <option value="I">I (7 AM - 3:30 PM)</option>
                <option value="II">II (3:30 PM - 12 AM)</option>
                <option value="III">III (12 AM - 7 AM)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <SearchableSelect key={`incharge-${resetKey}`} label="Incharge" options={incharges} displayKey="name" value={formData.incharge} onSelect={(item) => setFormData({ ...formData, incharge: item.name || item.name })} />
            <SearchableSelect key={`ppOperator-${resetKey}`} label="P/P Operator" options={operators} displayKey="operatorName" value={formData.ppOperator} onSelect={(item) => setFormData({ ...formData, ppOperator: item.operatorName || item.operatorName })} />
            <SearchableSelect key={`member-${resetKey}`} label="Member" options={employees} displayKey="name" value={formData.member} onSelect={(item) => setFormData({ ...formData, member: item.name || item.name })} />
          </div>

          {/* PRODUCTION SECTION */}
          <div className="mt-6 border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">Production :</h2>
              <button type="button" onClick={addProduction} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-1 rounded flex items-center justify-center leading-none" title="Add Row">+ Add Row</button>
            </div>

            {productions.map((prod, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50 relative">
                {productions.length > 1 && (
                  <button type="button" onClick={() => removeProduction(index)} className="absolute top-2 right-2 text-red-600 font-bold hover:text-red-800">✕</button>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div className="flex flex-col gap-2">
                    <div>
                      <label className="font-medium text-sm text-gray-700 block mb-1">Mould Counter No.</label>
                      <input type="text" value={String(prod.mouldCounterNo)} onChange={(e) => updateProduction(index, "mouldCounterNo", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" placeholder="Type '-' if none" />
                    </div>
                    <div>
                      <label className="font-medium text-sm text-gray-500 block mb-1">Closed Mould Count</label>
                      <input type="text" value={String(index === 0 ? (isNaN(previousMouldCounter) ? "-" : previousMouldCounter) : (productions[index - 1].mouldCounterNo || "-"))} readOnly className="w-full border border-gray-300 p-2 rounded bg-gray-200 cursor-not-allowed text-gray-600" />
                    </div>
                  </div>
                  
                  <div>
                    <label className="font-medium text-sm text-gray-700 block mb-1">Component Name</label>
                    <SearchableSelect 
                      key={`prod-comp-${index}-${resetKey}`} 
                      options={components} 
                      displayKey="description" 
                      value={prod.componentName} 
                      onSelect={(item) => updateProduction(index, "componentName", item.description, item.pouredWeight)} 
                    />
                    {prod.pouredWeight != null && prod.pouredWeight !== "" && (
                      <p className="text-sm font-semibold text-blue-600 mt-2 ml-1">
                        Poured Weight: {prod.pouredWeight}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="font-medium text-sm text-gray-500">Produced (Updates Previous Form)</label>
                    <input type="text" value={String(prod.produced)} readOnly className="w-full border border-gray-300 p-2 rounded bg-gray-200 cursor-not-allowed text-gray-600" />
                  </div>
                  <div>
                    <label className="font-medium text-sm text-gray-700">Poured</label>
                    <input type="text" value={String(prod.poured)} onChange={(e) => updateProduction(index, "poured", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" placeholder="Type '-' if none" />
                  </div>
                  <div>
                    <label className="font-medium text-sm text-gray-700">Cycle Time</label>
                    <input type="text" value={String(prod.cycleTime)} onChange={(e) => updateProduction(index, "cycleTime", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" placeholder="Type '-' if none" />
                  </div>
                  <div>
                    <label className="font-medium text-sm text-gray-700">Moulds Per Hour</label>
                    <input type="text" value={String(prod.mouldsPerHour)} onChange={(e) => updateProduction(index, "mouldsPerHour", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" placeholder="Type '-' if none" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="font-medium text-sm text-gray-700">Remarks</label>
                    <textarea value={String(prod.remarks)} onChange={(e) => updateProduction(index, "remarks", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-10 resize-y" placeholder="Type '-' if none" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* NEXT SHIFT PLAN */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-800">Next Shift Plan :</h2>
              <button type="button" onClick={addNextShiftPlan} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none">+</button>
            </div>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 p-2 text-left w-1/3">Component Name</th>
                  <th className="border border-gray-300 p-2 w-48">Planned Moulds</th>
                  <th className="border border-gray-300 p-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {nextShiftPlans.map((plan, index) => (
                  <tr key={index} className="bg-white">
                    <td className="border border-gray-300 p-2 align-top">
                      <SearchableSelect key={`nextPlan-${index}-${resetKey}`} options={components} displayKey="description" value={plan.componentName} onSelect={(item) => updateNextShiftPlan(index, "componentName", item.description)} />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input type="text" value={String(plan.plannedMoulds)} onChange={(e) => updateNextShiftPlan(index, "plannedMoulds", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" placeholder="Type '-' if none" />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <div className="flex gap-2 w-full">
                        <textarea value={String(plan.remarks)} onChange={(e) => updateNextShiftPlan(index, "remarks", e.target.value)} className="flex-1 w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-10 resize-y" placeholder="Type '-' if none" />
                        {nextShiftPlans.length > 1 && <button type="button" onClick={() => removeNextShiftPlan(index)} className="text-red-500 font-bold hover:text-red-700 px-2">✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* DELAYS */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-800">Delays :</h2>
              <button type="button" onClick={addDelay} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none">+</button>
            </div>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 p-2 text-left w-1/3">Reason</th>
                  <th className="border border-gray-300 p-2 w-48">Start Time (HH:MM)</th>
                  <th className="border border-gray-300 p-2 w-48">End Time (HH:MM)</th>
                  <th className="border border-gray-300 p-2">Duration (Mins)</th>
                </tr>
              </thead>
              <tbody>
                {delays.map((delay, index) => (
                  <tr key={index} className="bg-white">
                    <td className="border border-gray-300 p-2 align-top">
                      <SearchableSelect key={`delay-${index}-${resetKey}`} options={delaysMaster} displayKey="reasonName" value={delay.delayType} onSelect={(item) => updateDelay(index, "delayType", item.reasonName)} />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input type="text" value={String(delay.startTime)} onChange={(e) => updateDelay(index, "startTime", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" placeholder="Type '-' if none" />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input type="text" value={String(delay.endTime)} onChange={(e) => updateDelay(index, "endTime", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500" placeholder="Type '-' if none" />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <div className="flex gap-2 w-full">
                        <input type="text" value={String(delay.duration)} readOnly className="flex-1 w-full border border-gray-300 p-2 rounded bg-gray-100 cursor-not-allowed text-gray-600" />
                        {delays.length > 1 && <button type="button" onClick={() => removeDelay(index)} className="text-red-500 font-bold hover:text-red-700 px-2">✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOULD HARDNESS */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-800">Mould Hardness :</h2>
              <button type="button" onClick={addMouldHardness} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none">+</button>
            </div>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th rowSpan="2" className="border border-gray-300 p-2 text-left w-64 align-middle">Component Name</th>
                  <th colSpan="2" className="border border-gray-300 p-1 text-center bg-gray-200">Penetration (N/cm²)</th>
                  <th colSpan="2" className="border border-gray-300 p-1 text-center bg-gray-200">B-Scale</th>
                  <th rowSpan="2" className="border border-gray-300 p-2 align-middle">Remarks</th>
                </tr>
                <tr>
                  <th className="border border-gray-300 p-2 w-40">PP</th>
                  <th className="border border-gray-300 p-2 w-40">SP</th>
                  <th className="border border-gray-300 p-2 w-40">PP</th>
                  <th className="border border-gray-300 p-2 w-40">SP</th>
                </tr>
              </thead>
              <tbody>
                {mouldHardness.map((item, index) => (
                  <tr key={index} className="bg-white">
                    <td className="border border-gray-300 p-2 align-top">
                      <SearchableSelect key={`hardness-${index}-${resetKey}`} options={components} displayKey="description" value={item.componentName} onSelect={(comp) => updateMouldHardness(index, "componentName", comp.description)} />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="text" value={String(item.penetrationPP)} placeholder="Ex: 21.5, 23.2"
                        onChange={(e) => updateMouldHardness(index, "penetrationPP", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${!validateMultipleNumbers(item.penetrationPP, 20) ? 'border-red-500' : ''}`} 
                      />
                      {!validateMultipleNumbers(item.penetrationPP, 20) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 20</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="text" value={String(item.penetrationSP)} placeholder="Ex: 21.5, 23.2"
                        onChange={(e) => updateMouldHardness(index, "penetrationSP", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${!validateMultipleNumbers(item.penetrationSP, 20) ? 'border-red-500' : ''}`} 
                      />
                      {!validateMultipleNumbers(item.penetrationSP, 20) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 20</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="text" value={String(item.bScalePP)} placeholder="Ex: 86.5, 88.2"
                        onChange={(e) => updateMouldHardness(index, "bScalePP", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${!validateMultipleNumbers(item.bScalePP, 85) ? 'border-red-500' : ''}`} 
                      />
                      {!validateMultipleNumbers(item.bScalePP, 85) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 85</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="text" value={String(item.bScaleSP)} placeholder="Ex: 86.5, 88.2"
                        onChange={(e) => updateMouldHardness(index, "bScaleSP", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${!validateMultipleNumbers(item.bScaleSP, 85) ? 'border-red-500' : ''}`} 
                      />
                      {!validateMultipleNumbers(item.bScaleSP, 85) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 85</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <div className="flex gap-2 w-full">
                        <MultiSelectDropdown 
                          options={mouldRemarksList} 
                          displayKey="remarkName" 
                          selectedValue={item.remarks} 
                          onChange={(val) => updateMouldHardness(index, "remarks", val)} 
                        />
                        {mouldHardness.length > 1 && <button type="button" onClick={() => removeMouldHardness(index)} className="text-red-500 font-bold hover:text-red-700 px-2 mt-2">✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* PATTERN TEMPERATURE */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-800">Pattern Temp. (°C) :</h2>
              <button type="button" onClick={addPatternTemp} className="bg-orange-500 hover:bg-orange-600 text-white w-6 h-6 rounded flex items-center justify-center font-bold text-lg leading-none">+</button>
            </div>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="border border-gray-300 p-2 text-left w-1/3">Component Name</th>
                  <th className="border border-gray-300 p-2 w-32">PP</th>
                  <th className="border border-gray-300 p-2 w-32">SP</th>
                  <th className="border border-gray-300 p-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {patternTemps.map((pt, index) => (
                  <tr key={index} className="bg-white">
                    <td className="border border-gray-300 p-2 align-top">
                      <SearchableSelect key={`patternTemp-${index}-${resetKey}`} options={components} displayKey="description" value={pt.componentName} onSelect={(item) => updatePatternTemp(index, "componentName", item.description)} />
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="text" value={String(pt.pp)} placeholder="-"
                        onChange={(e) => updatePatternTemp(index, "pp", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${!validateMultipleNumbers(pt.pp, 45) ? 'border-red-500' : ''}`} 
                      />
                      {!validateMultipleNumbers(pt.pp, 45) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 45</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <input 
                        type="text" value={String(pt.sp)} placeholder="-"
                        onChange={(e) => updatePatternTemp(index, "sp", e.target.value)} 
                        className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 ${!validateMultipleNumbers(pt.sp, 45) ? 'border-red-500' : ''}`} 
                      />
                      {!validateMultipleNumbers(pt.sp, 45) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 45</p>}
                    </td>
                    <td className="border border-gray-300 p-2 align-top">
                      <div className="flex gap-2 w-full">
                        <textarea value={String(pt.remarks)} onChange={(e) => updatePatternTemp(index, "remarks", e.target.value)} className="flex-1 w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-10 resize-y" placeholder="Type '-' if none" />
                        {patternTemps.length > 1 && <button type="button" onClick={() => removePatternTemp(index)} className="text-red-500 font-bold hover:text-red-700 px-2">✕</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* OTHER DETAILS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            <div>
              <label className="font-bold text-gray-700 block mb-1">Significant Event</label>
              <textarea name="significantEvent" value={String(formData.significantEvent || "")} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-20 resize-y" placeholder="Type '-' if none..." />
            </div>
            <div>
              <label className="font-bold text-gray-700 block mb-1">Maintenance</label>
              <textarea name="maintenance" value={String(formData.maintenance || "")} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-20 resize-y" placeholder="Type '-' if none..." />
            </div>
          </div>

          <div className="w-1/3 mt-4">
            <SearchableSelect key={`supervisor-${resetKey}`} label="Supervisor Name" options={supervisors} displayKey="supervisorName" value={formData.supervisorName} onSelect={(item) => setFormData({ ...formData, supervisorName: item.supervisorName || item.supervisorName })} />
          </div>

          {/* BUTTONS */}
          <div className="flex justify-end gap-4 mt-6">
            <button type="button" onClick={handleDownload} className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded font-bold transition-colors flex items-center gap-2 shadow-lg">
              <span>⬇️</span> Generate Report (PDF)
            </button>
            <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-2 rounded font-bold transition-colors shadow-md">
              Submit Form
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
};

export default DisamaticProductReport;