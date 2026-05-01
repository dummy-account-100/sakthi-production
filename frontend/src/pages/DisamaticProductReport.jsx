import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Header from "../components/Header";
import { X, Calendar, Edit, Factory, Save, Loader, AlertTriangle, ChevronDown } from "lucide-react";

// --- HELPER: Calculate Production Date & Shift ---

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

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
// 🔥 ADMIN UI HELPER COMPONENTS
// ==========================================
const Field = ({ label, value, onChange, type = 'text', options, disabled, multiline = false }) => (
    <div className="flex flex-col gap-1">
        {label && <label className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</label>}
        {options ? (
            <div className="relative">
                <select
                    value={value || ''}
                    onChange={e => onChange(e.target.value)}
                    disabled={disabled}
                    className="w-full bg-[#222] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff9100] appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <option value="">— Select —</option>
                    {options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
            </div>
        ) : multiline ? (
            <textarea
                rows="2"
                value={value ?? ''}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                className="w-full bg-[#222] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff9100] disabled:opacity-50 disabled:cursor-not-allowed resize-none"
            />
        ) : (
            <input
                type={type}
                value={value ?? ''}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
                className="w-full bg-[#222] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#ff9100] disabled:opacity-50 disabled:cursor-not-allowed"
            />
        )}
    </div>
);

const SectionHeader = ({ title }) => (
    <div className="col-span-full mt-4 mb-1 pb-1 border-b border-white/10">
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#ff9100]">{title}</h3>
    </div>
);

const CenteredLoader = () => (
    <div className="flex justify-center items-center py-20">
        <Loader className="animate-spin text-[#ff9100] w-10 h-10" />
    </div>
);

const NoData = ({ msg = "No records found for the selected date." }) => (
    <div className="flex flex-col items-center justify-center py-20 text-white/30">
        <AlertTriangle className="w-10 h-10 mb-3" />
        <p className="text-sm font-bold">{msg}</p>
    </div>
);

const SaveButton = ({ onClick }) => (
    <div className="flex justify-end pt-2">
        <button onClick={onClick} type="button"
            className="flex items-center gap-2 bg-[#ff9100] hover:bg-orange-500 text-white font-black text-sm uppercase tracking-wider px-6 py-3 rounded-xl transition-colors shadow-[0_0_20px_rgba(255,145,0,0.3)] active:scale-95">
            <Save size={16} /> Save All Changes
        </button>
    </div>
);

const SubTable = ({ headers, children }) => (
    <div className="overflow-x-auto mt-2 mb-6 border border-white/10 rounded-lg bg-[#222]">
        <table className="w-full min-w-max text-sm text-left text-white">
            <thead className="bg-[#1a1a1a] border-b border-white/10">
                <tr>
                    {headers.map((h, i) => (
                        <th key={i} className="p-3 text-[10px] uppercase tracking-widest text-white/50 font-bold">{h}</th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                {children}
            </tbody>
        </table>
    </div>
);

// ==========================================
// 🔥 ADMIN TABULAR EDITOR
// ==========================================
const DisamaticEditor = ({ date, disa, onSaveSuccess }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const token = localStorage.getItem('token');
        axios.get(`${API_BASE}/forms/by-date`, { 
            params: { date, disa },
            headers: { Authorization: `Bearer ${token}` }
        })
        .then(r => {
            const fetched = r.data || [];
            const grouped = {};

            // Group multiple form submissions by Shift
            fetched.forEach(rep => {
                if (!grouped[rep.shift]) {
                    // Create deep copy for first occurrence of shift
                    grouped[rep.shift] = {
                        ...rep,
                        productions: [...(rep.productions || [])],
                        nextShiftPlans: [...(rep.nextShiftPlans || [])],
                        delays: [...(rep.delays || [])],
                        mouldHardness: [...(rep.mouldHardness || [])],
                        patternTemps: [...(rep.patternTemps || [])]
                    };
                } else {
                    // Merge array items to prevent duplicated table blocks
                    grouped[rep.shift].productions.push(...(rep.productions || []));
                    grouped[rep.shift].nextShiftPlans.push(...(rep.nextShiftPlans || []));
                    grouped[rep.shift].delays.push(...(rep.delays || []));
                    grouped[rep.shift].mouldHardness.push(...(rep.mouldHardness || []));
                    grouped[rep.shift].patternTemps.push(...(rep.patternTemps || []));

                    if (rep.significantEvent && rep.significantEvent !== '-') {
                        grouped[rep.shift].significantEvent = grouped[rep.shift].significantEvent && grouped[rep.shift].significantEvent !== '-'
                            ? grouped[rep.shift].significantEvent + ' | ' + rep.significantEvent
                            : rep.significantEvent;
                    }
                    if (rep.maintenance && rep.maintenance !== '-') {
                        grouped[rep.shift].maintenance = grouped[rep.shift].maintenance && grouped[rep.shift].maintenance !== '-'
                            ? grouped[rep.shift].maintenance + ' | ' + rep.maintenance
                            : rep.maintenance;
                    }
                }
            });

            // Sort strictly by Shift order I, II, III
            const shiftOrder = { 'I': 1, 'II': 2, 'III': 3 };
            const sorted = Object.values(grouped).sort((a, b) => (shiftOrder[a.shift] || 99) - (shiftOrder[b.shift] || 99));
            setReports(sorted);
        })
        .catch(() => toast.error('Failed to load data'))
        .finally(() => setLoading(false));
    }, [date, disa]);

    const updateReport = (rIdx, field, val) => {
        setReports(prev => {
            const next = [...prev];
            next[rIdx] = { ...next[rIdx], [field]: val };
            return next;
        });
    };

    const updateSub = (rIdx, arrayName, subIdx, field, val) => {
        setReports(prev => {
            const next = [...prev];
            const arr = [...next[rIdx][arrayName]];
            arr[subIdx] = { ...arr[subIdx], [field]: val };
            next[rIdx] = { ...next[rIdx], [arrayName]: arr };
            return next;
        });
    };

    const handleSave = async () => {
        toast.info('Saving...', { autoClose: 1000 });
        const token = localStorage.getItem('token');
        try {
            for (const rep of reports) {
                await axios.put(`${API_BASE}/forms/${rep.id}`, rep, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            toast.success('Saved successfully!');
            if(onSaveSuccess) onSaveSuccess();
        } catch (e) {
            toast.error('Save failed');
        }
    };

    if (loading) return <CenteredLoader />;
    if (reports.length === 0) return <NoData msg={`No Disamatic reports found for DISA ${disa} on ${date}.`} />;

    return (
        <div className="space-y-8">
            {reports.map((report, rIdx) => (
                <div key={report.id} className="bg-[#2a2a2a] border border-white/10 rounded-xl p-5 shadow-lg">

                    <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                        <h3 className="text-xl font-black text-[#ff9100] uppercase tracking-wider">Shift {report.shift}</h3>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <Field label="Incharge" value={report.incharge} onChange={v => updateReport(rIdx, 'incharge', v)} />
                        <Field label="Member" value={report.member} onChange={v => updateReport(rIdx, 'member', v)} />
                        <Field label="P/P Operator" value={report.ppOperator} onChange={v => updateReport(rIdx, 'ppOperator', v)} />
                        <Field label="Supervisor" value={report.supervisorName} onChange={v => updateReport(rIdx, 'supervisorName', v)} />
                    </div>

                    <SectionHeader title="Productions" />
                    <SubTable headers={['S.No', 'Component', 'Counter No', 'Produced', 'Poured', 'Cycle Time', 'Moulds/Hr', 'Remarks']}>
                        {report.productions?.map((p, pIdx) => (
                            <tr key={p.id || pIdx} className="hover:bg-white/5 transition-colors">
                                <td className="p-2 text-white/50 text-center font-bold w-12">{pIdx + 1}</td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={p.componentName || ''} onChange={e => updateSub(rIdx, 'productions', pIdx, 'componentName', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={p.mouldCounterNo || ''} onChange={e => updateSub(rIdx, 'productions', pIdx, 'mouldCounterNo', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={p.produced || ''} onChange={e => updateSub(rIdx, 'productions', pIdx, 'produced', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={p.poured || ''} onChange={e => updateSub(rIdx, 'productions', pIdx, 'poured', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={p.cycleTime || ''} onChange={e => updateSub(rIdx, 'productions', pIdx, 'cycleTime', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={p.mouldsPerHour || ''} onChange={e => updateSub(rIdx, 'productions', pIdx, 'mouldsPerHour', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={p.remarks || ''} onChange={e => updateSub(rIdx, 'productions', pIdx, 'remarks', e.target.value)} /></td>
                            </tr>
                        ))}
                    </SubTable>

                    <SectionHeader title="Next Shift Plan" />
                    <SubTable headers={['S.No', 'Component Name', 'Planned Moulds', 'Remarks']}>
                        {report.nextShiftPlans?.map((p, pIdx) => (
                            <tr key={p.id || pIdx} className="hover:bg-white/5 transition-colors">
                                <td className="p-2 text-white/50 text-center font-bold w-12">{pIdx + 1}</td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={p.componentName || ''} onChange={e => updateSub(rIdx, 'nextShiftPlans', pIdx, 'componentName', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={p.plannedMoulds || ''} onChange={e => updateSub(rIdx, 'nextShiftPlans', pIdx, 'plannedMoulds', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={p.remarks || ''} onChange={e => updateSub(rIdx, 'nextShiftPlans', pIdx, 'remarks', e.target.value)} /></td>
                            </tr>
                        ))}
                    </SubTable>

                    <SectionHeader title="Delays" />
                    <SubTable headers={['S.No', 'Delays (Reason)', 'Minutes', 'Time Range']}>
                        {report.delays?.map((d, dIdx) => (
                            <tr key={d.id || dIdx} className="hover:bg-white/5 transition-colors">
                                <td className="p-2 text-white/50 text-center font-bold w-12">{dIdx + 1}</td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={d.delay || d.delayType || ''} onChange={e => updateSub(rIdx, 'delays', dIdx, 'delay', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={d.durationMinutes || d.duration || ''} onChange={e => updateSub(rIdx, 'delays', dIdx, 'durationMinutes', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={d.durationTime || d.startTime || ''} onChange={e => updateSub(rIdx, 'delays', dIdx, 'durationTime', e.target.value)} /></td>
                            </tr>
                        ))}
                    </SubTable>

                    <SectionHeader title="Mould Hardness" />
                    <SubTable headers={['S.No', 'Component Name', 'Penetration PP', 'Penetration SP', 'B-Scale PP', 'B-Scale SP', 'Remarks']}>
                        {report.mouldHardness?.map((h, hIdx) => (
                            <tr key={h.id || hIdx} className="hover:bg-white/5 transition-colors">
                                <td className="p-2 text-white/50 text-center font-bold w-12">{hIdx + 1}</td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={h.componentName || ''} onChange={e => updateSub(rIdx, 'mouldHardness', hIdx, 'componentName', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={h.penetrationPP || ''} onChange={e => updateSub(rIdx, 'mouldHardness', hIdx, 'penetrationPP', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={h.penetrationSP || ''} onChange={e => updateSub(rIdx, 'mouldHardness', hIdx, 'penetrationSP', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={h.bScalePP || ''} onChange={e => updateSub(rIdx, 'mouldHardness', hIdx, 'bScalePP', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={h.bScaleSP || ''} onChange={e => updateSub(rIdx, 'mouldHardness', hIdx, 'bScaleSP', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={h.remarks || ''} onChange={e => updateSub(rIdx, 'mouldHardness', hIdx, 'remarks', e.target.value)} /></td>
                            </tr>
                        ))}
                    </SubTable>

                    <SectionHeader title="Pattern Temps" />
                    <SubTable headers={['S.No', 'Component Name', 'PP', 'SP', 'Remarks']}>
                        {report.patternTemps?.map((pt, ptIdx) => (
                            <tr key={pt.id || ptIdx} className="hover:bg-white/5 transition-colors">
                                <td className="p-2 text-white/50 text-center font-bold w-12">{ptIdx + 1}</td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={pt.componentName || ''} onChange={e => updateSub(rIdx, 'patternTemps', ptIdx, 'componentName', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={pt.pp || ''} onChange={e => updateSub(rIdx, 'patternTemps', ptIdx, 'pp', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={pt.sp || ''} onChange={e => updateSub(rIdx, 'patternTemps', ptIdx, 'sp', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded px-2 py-1 text-white text-sm focus:border-[#ff9100] outline-none" value={pt.remarks || ''} onChange={e => updateSub(rIdx, 'patternTemps', ptIdx, 'remarks', e.target.value)} /></td>
                            </tr>
                        ))}
                    </SubTable>

                    <SectionHeader title="Other Details" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Field label="Significant Event" value={report.significantEvent} onChange={v => updateReport(rIdx, 'significantEvent', v)} multiline />
                        <Field label="Maintenance" value={report.maintenance} onChange={v => updateReport(rIdx, 'maintenance', v)} multiline />
                    </div>
                </div>
            ))}
            <SaveButton onClick={handleSave} />
        </div>
    );
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

  // 🔥 NEW: State for the Admin Tabular Edit View
  const [editModeData, setEditModeData] = useState(null); 
  const [editWizard, setEditWizard] = useState({ show: false, step: 1, date: initDate, disa: "I" });

  const [productions, setProductions] = useState([
    { 
      componentName: "", 
      patternCode: "", 
      castedWeight: "", 
      pouredWeight: "", 
      cavity: 0, 
      mouldCounterNo: "", 
      produced: "", 
      poured: "", 
      cycleTime: "", 
      mouldsPerHour: "", 
      remarks: "" 
    }
  ]);
  const [lastReportCavity, setLastReportCavity] = useState(0); 
  const [resetKey, setResetKey] = useState(0);

  const [incharges, setIncharges] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [operators, setOperators] = useState([]);
  const [components, setComponents] = useState([]);
  const [nextShiftPlans, setNextShiftPlans] = useState([{ componentName: "", plannedMoulds: "", remarks: "" }]);
  
  const [delays, setDelays] = useState([{ delayType: "", startTime: "", endTime: "", duration: "" }]);
  const [delaysMaster, setDelaysMaster] = useState([]); 
  
  const [mouldHardness, setMouldHardness] = useState([{ componentName: "", penetrationPP: "", penetrationSP: "", bScalePP: "", bScaleSP: "", remarks: "-" }]);
  const [mouldRemarksList, setMouldRemarksList] = useState([]); 
  const [patternTemps, setPatternTemps] = useState([{ componentName: "", pp: "", sp: "", remarks: "" }]);
  const [supervisors, setSupervisors] = useState([]);

  const isFirstRender = useRef(true);

  useEffect(() => {
    localStorage.setItem("disaFormDraft", JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    const fetchPersonnelAndCounter = async () => {
      // Don't auto-fetch if we are in Edit Mode
      if (formData.disa && formData.disa !== "-" && formData.date && formData.shift && !editModeData) {
        try {
          const res = await axios.get(`${API_BASE}/forms/last-personnel`, {
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
            setFormData((prev) => ({
              ...prev,
              incharge: "", member: "", ppOperator: "", supervisorName: ""
            }));
            if (!isFirstRender.current) toast.info(`First entry for DISA-${formData.disa} in this shift.`);
          }

          const compRes = await axios.get(`${API_BASE}/forms/last-component`, {
            params: { disa: formData.disa, shift: formData.shift }
          });
          setLastReportCavity(compRes.data?.cavity || 0);

        } catch (err) {
          console.error("Failed to fetch dynamic personnel/counter data", err);
        }
      }
    };

    fetchPersonnelAndCounter();
    isFirstRender.current = false;
  }, [formData.disa, formData.date, formData.shift, editModeData]);

  useEffect(() => {
    axios.get(`${API_BASE}/delays`).then((res) => setDelaysMaster(res.data));
    axios.get(`${API_BASE}/incharges`).then((res) => setIncharges(res.data));
    axios.get(`${API_BASE}/employees`).then((res) => setEmployees(res.data));
    
    axios.get(`${API_BASE}/users`)
      .then((res) => {
        const ppOps = res.data.filter(user => user.role && user.role.trim().toLowerCase() === 'pp operator');
        setOperators(ppOps);
      })
      .catch(err => console.error("Failed to fetch PP Operators", err));

    axios.get(`${API_BASE}/components`).then((res) => setComponents(res.data.filter(c => c.isActive === 'Active')));
    axios.get(`${API_BASE}/supervisors`).then((res) => setSupervisors(res.data));
    axios.get(`${API_BASE}/mould-hardness-remarks`).then((res) => setMouldRemarksList(res.data));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if ((name === "date" || name === "shift") && !editModeData) {
        updated.incharge = "";
        updated.member = "";
        updated.ppOperator = "";
        updated.supervisorName = "";
      }
      return updated;
    });
  };

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
      const normalizedStart = String(updated[index].startTime).replace('.', ':');
      const normalizedEnd = String(updated[index].endTime).replace('.', ':');

      const startParts = normalizedStart.split(':');
      const endParts = normalizedEnd.split(':');
      
      if(startParts.length === 2 && endParts.length === 2) {
        const formattedStart = `${startParts[0].padStart(2, '0')}:${startParts[1].padStart(2, '0')}`;
        const formattedEnd = `${endParts[0].padStart(2, '0')}:${endParts[1].padStart(2, '0')}`;
        
        const start = new Date(`1970-01-01T${formattedStart}:00`);
        const end = new Date(`1970-01-01T${formattedEnd}:00`);
        
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
    setProductions([...productions, { componentName: "", patternCode: "", castedWeight: "", pouredWeight: "", cavity: 0, mouldCounterNo: "", produced: "", poured: "", cycleTime: "", mouldsPerHour: "", remarks: "" }]);
  };
  
  const removeProduction = (index) => {
    if (productions.length === 1) return;
    const updated = productions.filter((_, i) => i !== index);
    recalculateChain(updated);
  };

  const updateProduction = (index, field, value, itemObj = null) => {
    const updated = [...productions];

    if (field === "componentName" || field === "patternCode") {
      updated[index].componentName = itemObj?.description || value;
      updated[index].patternCode = itemObj?.code || value;
      updated[index].pouredWeight = itemObj?.pouredWeight || "";
      updated[index].castedWeight = itemObj?.castedWeight || "";
      updated[index].cavity = itemObj?.cavity || 0; 
      setProductions(updated);
    }
    else if (field === "mouldCounterNo" || field === "prevCount") {
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

  const recalculateChain = (list) => {
    const newList = list.map((item) => {
      if (item.prevCount === undefined || item.prevCount === null || String(item.prevCount).trim() === "") {
          return { ...item, produced: "-" };
      }
      if (item.mouldCounterNo === "-" || String(item.mouldCounterNo).trim() === "") {
          return { ...item, produced: "-" };
      }
      
      let startCount = Number(item.prevCount);
      let currentInput = Number(item.mouldCounterNo) || 0;
      let produced = Math.max(0, startCount - currentInput);

      return { 
        ...item, 
        mouldCounterNo: String(item.mouldCounterNo), 
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
      const payload = { ...formData, productions, delays, nextShiftPlans, mouldHardness, patternTemps };
      await axios.post(`${API_BASE}/forms`, payload);
      toast.success("Report submitted! Ready for next entry.");

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

      setProductions([{ componentName: "", patternCode: "", pouredWeight: "", castedWeight: "", cavity: 0, mouldCounterNo: "", produced: "", poured: "", cycleTime: "", mouldsPerHour: "", remarks: "" }]);
      setNextShiftPlans([{ componentName: "", plannedMoulds: "", remarks: "" }]);
      setDelays([{ delayType: "", startTime: "", endTime: "", duration: "" }]);
      setMouldHardness([{ componentName: "", penetrationPP: "", penetrationSP: "", bScalePP: "", bScaleSP: "", remarks: "-" }]);
      setPatternTemps([{ componentName: "", pp: "", sp: "", remarks: "" }]);
      
      setResetKey((prev) => prev + 1);

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
      const response = await axios.get(`${API_BASE}/forms/download-pdf`, { 
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
    <>
      <Header />
      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20 font-sans">
        <ToastContainer position="top-right" autoClose={3000} theme="colored" />
        
        <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">
          
          <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide flex items-center gap-4">
              DISAMATIC PRODUCTION REPORT
              {editModeData && <span className="text-[10px] bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-black border border-orange-300 shadow-sm align-middle">EDITING MODE</span>}
            </h2>
            {!editModeData ? (
                <button type="button" onClick={() => setEditWizard({ show: true, step: 1, date: formData.date, disa: formData.disa || 'I' })} className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5">
                    <Edit size={16} /> Edit Previous Record
                </button>
            ) : (
                <button type="button" onClick={() => setEditModeData(null)} className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5">
                    <X size={16} /> Back to New Entry
                </button>
            )}
          </div>

          {editModeData ? (
            <div className="bg-[#2d2d2d] p-6 rounded-xl border border-gray-700 shadow-inner mt-6">
                <DisamaticEditor date={editModeData.date} disa={editModeData.disa} onSaveSuccess={() => setEditModeData(null)} />
            </div>
          ) : (
            <>
              <div className="flex justify-end items-center gap-6 mb-8">
                <div className="w-40">
                  <label className="font-bold text-gray-700 block mb-1 text-sm">DISA-</label>
                  <select name="disa" value={formData.disa} onChange={handleDisaChange} className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white text-gray-800">
                    <option value="">Select</option>
                    <option value="I">I</option>
                    <option value="II">II</option>
                    <option value="III">III</option>
                    <option value="IV">IV</option>
                    <option value="V">V</option>
                    <option value="VI">VI</option>
                  </select>
                </div>
                
                <div className="w-48">
                  <label className="font-bold text-gray-700 block mb-1 text-sm">DATE :</label>
                  <input 
                    type="date" 
                    name="date" 
                    value={formData.date} 
                    onChange={handleChange}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold text-gray-800 bg-white" 
                  />
                </div>
                
                <div className="w-48">
                  <label className="font-bold text-gray-700 block mb-1 text-sm">SHIFT :</label>
                  <select 
                    name="shift" 
                    value={formData.shift} 
                    onChange={handleChange}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold text-gray-800 bg-white"
                  >
                    <option value="I">I (7 AM - 3:30 PM)</option>
                    <option value="II">II (3:30 PM - 12 AM)</option>
                    <option value="III">III (12 AM - 7 AM)</option>
                  </select>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="min-w-[1100px] flex flex-col gap-6">
                
                <div className="grid grid-cols-3 gap-6">
                  <SearchableSelect key={`incharge-${resetKey}`} label="Incharge" options={incharges} displayKey="name" value={formData.incharge} onSelect={(item) => setFormData({ ...formData, incharge: item.name || item.name })} />
                  
                  <SearchableSelect 
                    key={`ppOperator-${resetKey}`} 
                    label="P/P Operator" 
                    options={operators} 
                    displayKey="username" 
                    value={formData.ppOperator} 
                    onSelect={(item) => setFormData({ ...formData, ppOperator: item.username || item.username })} 
                  />
                  
                  <SearchableSelect key={`member-${resetKey}`} label="Member" options={employees} displayKey="name" value={formData.member} onSelect={(item) => setFormData({ ...formData, member: item.name || item.name })} />
                </div>

                {/* PRODUCTION SECTION */}
                <div className="mt-6 border-t pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-800">Production :</h2>
                    <button type="button" onClick={addProduction} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-3 py-1 rounded flex items-center justify-center leading-none" title="Add Row">+ Add Row</button>
                  </div>

                  {productions.map((prod, index) => {
                    const quantity = (Number(prod.poured) && prod.cavity) ? (Number(prod.poured) * prod.cavity) : null;

                    return (
                      <div key={index} className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50 relative">
                        {productions.length > 1 && (
                          <button type="button" onClick={() => removeProduction(index)} className="absolute top-2 right-2 text-red-600 font-bold hover:text-red-800">✕</button>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          
                          <div className="flex flex-col gap-2">
                            <div>
                              <label className="font-medium text-sm text-gray-700 block mb-1">Open Mould Counter No.</label>
                              <input type="text" value={String(prod.mouldCounterNo)} onChange={(e) => updateProduction(index, "mouldCounterNo", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white" placeholder="Type '-' if none" />
                            </div>
                            <div>
                              <label className="font-medium text-sm text-gray-700 block mb-1">Closed Mould Count</label>
                              <input 
                                type="text" 
                                value={prod.prevCount !== undefined && prod.prevCount !== null ? String(prod.prevCount) : ""} 
                                onChange={(e) => updateProduction(index, "prevCount", e.target.value)}
                                className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white" 
                                placeholder="Edit start count"
                              />
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-4">
                            {/* Component Name Selection */}
                            <SearchableSelect 
                              label="Component Name"
                              key={`prod-comp-${index}-${resetKey}`} 
                              options={components} 
                              displayKey="description" 
                              value={prod.componentName} 
                              onSelect={(item) => updateProduction(index, "componentName", item.description, item)} 
                            />

                            {/* Pattern Code Selection */}
                            <SearchableSelect 
                              label="Pattern Code"
                              key={`prod-patt-${index}-${resetKey}`} 
                              options={components} 
                              displayKey="code" 
                              value={prod.patternCode} 
                              onSelect={(item) => updateProduction(index, "patternCode", item.code, item)} 
                            />
                            
                            {/* Styled Weights Row */}
                            <div className="flex justify-between items-center px-1">
                              <span className="text-sm font-bold text-blue-700">
                                Poured: {prod.pouredWeight ? `${prod.pouredWeight} kg` : "-"}
                              </span>
                              <span className="text-sm font-bold text-green-700">
                                Casted: {prod.castedWeight ? `${prod.castedWeight} kg` : "-"}
                              </span>
                            </div>
                          </div>

                          <div>
                            <label className="font-medium text-sm text-gray-500">Produced </label>
                            <input type="text" value={String(prod.produced)} readOnly className="w-full border border-gray-300 p-2 rounded bg-gray-200 cursor-not-allowed text-gray-600" />
                          </div>

                          <div>
                            <label className="font-medium text-sm text-gray-700">Poured</label>
                            <input type="text" value={String(prod.poured)} onChange={(e) => updateProduction(index, "poured", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white" placeholder="Type '-' if none" />
                            {quantity !== null && !isNaN(quantity) && (
                            <div className="mt-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-blue-700 font-bold text-sm">
                              Quantity : {quantity}
                            </div>
                          )}
                          </div>

                          <div>
                            <label className="font-medium text-sm text-gray-700">Cycle Time</label>
                            <input type="text" value={String(prod.cycleTime)} onChange={(e) => updateProduction(index, "cycleTime", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white" placeholder="Type '-' if none" />
                          </div>

                          <div>
                            <label className="font-medium text-sm text-gray-700">Moulds Per Hour</label>
                            <input type="text" value={String(prod.mouldsPerHour)} onChange={(e) => updateProduction(index, "mouldsPerHour", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white" placeholder="Type '-' if none" />
                          </div>

                          <div className="md:col-span-2">
                            <label className="font-medium text-sm text-gray-700">Remarks</label>
                            <textarea value={String(prod.remarks)} onChange={(e) => updateProduction(index, "remarks", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-10 resize-y bg-white" placeholder="Type '-' if none" />
                          </div>

                        </div>
                      </div>
                    );
                  })}
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
                            <input type="text" value={String(plan.plannedMoulds)} onChange={(e) => updateNextShiftPlan(index, "plannedMoulds", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white" placeholder="Type '-' if none" />
                          </td>
                          <td className="border border-gray-300 p-2 align-top">
                            <div className="flex gap-2 w-full">
                              <textarea value={String(plan.remarks)} onChange={(e) => updateNextShiftPlan(index, "remarks", e.target.value)} className="flex-1 w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-10 resize-y bg-white" placeholder="Type '-' if none" />
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
                        <th className="border border-gray-300 p-2 w-48">Start Time (HH.MM)</th>
                        <th className="border border-gray-300 p-2 w-48">End Time (HH.MM)</th>
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
                            <input type="text" value={String(delay.startTime)} onChange={(e) => updateDelay(index, "startTime", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white" placeholder="Type '-' if none" />
                          </td>
                          <td className="border border-gray-300 p-2 align-top">
                            <input type="text" value={String(delay.endTime)} onChange={(e) => updateDelay(index, "endTime", e.target.value)} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white" placeholder="Type '-' if none" />
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
                              className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white ${!validateMultipleNumbers(item.penetrationPP, 20) ? 'border-red-500' : ''}`} 
                            />
                            {!validateMultipleNumbers(item.penetrationPP, 20) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 20</p>}
                          </td>
                          <td className="border border-gray-300 p-2 align-top">
                            <input 
                              type="text" value={String(item.penetrationSP)} placeholder="Ex: 21.5, 23.2"
                              onChange={(e) => updateMouldHardness(index, "penetrationSP", e.target.value)} 
                              className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white ${!validateMultipleNumbers(item.penetrationSP, 20) ? 'border-red-500' : ''}`} 
                            />
                            {!validateMultipleNumbers(item.penetrationSP, 20) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 20</p>}
                          </td>
                          <td className="border border-gray-300 p-2 align-top">
                            <input 
                              type="text" value={String(item.bScalePP)} placeholder="Ex: 86.5, 88.2"
                              onChange={(e) => updateMouldHardness(index, "bScalePP", e.target.value)} 
                              className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white ${!validateMultipleNumbers(item.bScalePP, 85) ? 'border-red-500' : ''}`} 
                            />
                            {!validateMultipleNumbers(item.bScalePP, 85) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 85</p>}
                          </td>
                          <td className="border border-gray-300 p-2 align-top">
                            <input 
                              type="text" value={String(item.bScaleSP)} placeholder="Ex: 86.5, 88.2"
                              onChange={(e) => updateMouldHardness(index, "bScaleSP", e.target.value)} 
                              className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white ${!validateMultipleNumbers(item.bScaleSP, 85) ? 'border-red-500' : ''}`} 
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
                              className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white ${!validateMultipleNumbers(pt.pp, 45) ? 'border-red-500' : ''}`} 
                            />
                            {!validateMultipleNumbers(pt.pp, 45) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 45</p>}
                          </td>
                          <td className="border border-gray-300 p-2 align-top">
                            <input 
                              type="text" value={String(pt.sp)} placeholder="-"
                              onChange={(e) => updatePatternTemp(index, "sp", e.target.value)} 
                              className={`w-full border border-gray-300 p-2 rounded focus:outline-orange-500 bg-white ${!validateMultipleNumbers(pt.sp, 45) ? 'border-red-500' : ''}`} 
                            />
                            {!validateMultipleNumbers(pt.sp, 45) && <p className="text-red-500 text-xs mt-1 font-medium">Min: 45</p>}
                          </td>
                          <td className="border border-gray-300 p-2 align-top">
                            <div className="flex gap-2 w-full">
                              <textarea value={String(pt.remarks)} onChange={(e) => updatePatternTemp(index, "remarks", e.target.value)} className="flex-1 w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-10 resize-y bg-white" placeholder="Type '-' if none" />
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
                    <textarea name="significantEvent" value={String(formData.significantEvent || "")} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-20 resize-y bg-white" placeholder="Type '-' if none..." />
                  </div>
                  <div>
                    <label className="font-bold text-gray-700 block mb-1">Maintenance</label>
                    <textarea name="maintenance" value={String(formData.maintenance || "")} onChange={handleChange} className="w-full border border-gray-300 p-2 rounded focus:outline-orange-500 h-20 resize-y bg-white" placeholder="Type '-' if none..." />
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
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🔥 EDIT WIZARD MODALS (Identical to Admin Flow) 🔥 */}
      {/* ========================================================================= */}
      
      {/* WIZARD STEP 1: Date */}
      {editWizard.show && editWizard.step === 1 && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-sm rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden scale-in">
                  <div className="bg-[#1A2634] px-6 py-5 border-b-2 border-orange-500 flex justify-between items-center">
                      <h3 className="font-black text-sm text-white uppercase tracking-widest flex items-center gap-2">
                          <Calendar size={18} className="text-orange-500" /> Date Lookup
                      </h3>
                      <button type="button" onClick={() => setEditWizard({ ...editWizard, show: false })} className="text-gray-400 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 flex flex-col gap-5">
                      <div className="bg-[#2d2d2d] border border-[#4a4a4a] rounded-xl p-3 text-center shadow-inner">
                          <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Editing Form</div>
                          <div className="text-sm font-bold text-white uppercase leading-tight">Disamatic Product Report</div>
                      </div>
                      <div>
                          <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Target Date</label>
                          <input type="date" value={editWizard.date} onChange={e => setEditWizard({ ...editWizard, date: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] rounded-xl p-3 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all cursor-pointer font-bold shadow-inner [color-scheme:dark]" />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button type="button" onClick={() => setEditWizard({ ...editWizard, show: false })} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-gray-300 hover:text-white bg-[#222] border border-[#4a4a4a] hover:bg-[#4a4a4a] rounded-xl transition-all shadow-sm">Cancel</button>
                          <button type="button" disabled={!editWizard.date} onClick={() => setEditWizard({ ...editWizard, step: 2 })} className="flex-[1.5] bg-orange-600 hover:bg-orange-500 border border-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(234,88,12,0.3)]">
                              Next ➡️
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* WIZARD STEP 2: DISA Machine */}
      {editWizard.show && editWizard.step === 2 && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-2xl rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden scale-in">
                  <div className="h-16 bg-[#1A2634] border-b-2 border-orange-500 relative flex items-center justify-center">
                      <h3 className="text-lg font-black text-white uppercase tracking-widest drop-shadow-md flex items-center gap-2">
                          <Factory size={18} className="text-orange-500" /> Select DISA Machine
                      </h3>
                      <button type="button" onClick={() => setEditWizard({ ...editWizard, show: false })} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400 hover:text-white transition-colors bg-black/20 p-1.5 rounded-lg hover:bg-black/40 border border-transparent hover:border-gray-500">
                          <X className="w-5 h-5" />
                      </button>
                  </div>
                  <div className="px-8 py-10 flex flex-col items-center gap-8">
                      <div className="flex flex-wrap justify-center gap-4 max-w-4xl">
                          {['I', 'II', 'III', 'IV', 'V', 'VI'].map(m => (
                              <button key={m} type="button"
                                  onClick={() => setEditWizard({ ...editWizard, disa: m })}
                                  className={`px-8 py-4 rounded-xl font-black text-base uppercase tracking-wider border-2 transition-all ${editWizard.disa === m
                                      ? 'bg-orange-500 border-orange-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)] scale-105'
                                      : 'bg-[#2a2a2a] border-white/10 text-white/60 hover:border-orange-500/50 hover:text-white'
                                      }`}>
                                  DISA - {m}
                              </button>
                          ))}
                      </div>
                      <div className="flex gap-4 mt-2 w-full justify-center max-w-sm">
                          <button type="button" onClick={() => setEditWizard({ ...editWizard, step: 1 })} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-gray-300 hover:text-white bg-[#222] border border-[#4a4a4a] hover:bg-[#4a4a4a] rounded-xl transition-all shadow-sm">
                              ⬅️ Back
                          </button>
                          <button type="button"
                              disabled={!editWizard.disa}
                              onClick={() => {
                                setEditModeData({ date: editWizard.date, disa: editWizard.disa });
                                setEditWizard({ ...editWizard, show: false });
                              }}
                              className="flex-[1.5] bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest px-8 py-3 rounded-xl transition-all shadow-[0_4px_15px_rgba(234,88,12,0.3)]">
                              Load Data
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Animation Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes scale-in { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .scale-in { animation: scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
    </>
  );
};

export default DisamaticProductReport;