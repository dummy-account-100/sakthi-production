import React, { useState, useEffect } from "react";
import axios from "axios";
import Header from "../components/Header";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { X, Calendar, Edit, Factory, Save, Loader, AlertTriangle, ChevronDown } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined"
  ? process.env.REACT_APP_API_URL
  : "/api";

// --- HELPER: Calculate Production Date (Strict 7 AM to 7 AM Logic) ---
const getProductionDate = () => {
  const now = new Date();
  const hours = now.getHours();

  const prodDate = new Date(now);
  if (hours < 7) {
    prodDate.setDate(prodDate.getDate() - 1);
  }

  const year = prodDate.getFullYear();
  const month = String(prodDate.getMonth() + 1).padStart(2, '0');
  const day = String(prodDate.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// --- HELPER: Safe Number Parsing for Totals ---
const parseNum = (val) => {
  if (val === "-" || !val) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

// ==========================================
// 🔥 ADMIN UI HELPER COMPONENTS (For Edit Mode)
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
// 🔥 ADMIN TABULAR EDITOR (For Operator Edit Mode)
// ==========================================
const PerformanceEditor = ({ date, disa, onSaveSuccess }) => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    const getAuthHeaders = () => {
        let token = localStorage.getItem('token');
        if (!token) {
            const userData = localStorage.getItem('user');
            if (userData) {
                try {
                    const parsedUser = JSON.parse(userData);
                    token = parsedUser.token || '';
                } catch (e) { }
            }
        }
        return { headers: { Authorization: `Bearer ${token}` } };
    };

    useEffect(() => {
        setLoading(true);
        axios.get(`${API_BASE}/daily-performance/by-date`, { 
            params: { date, disa: disa },
            ...getAuthHeaders()
        })
        .then(res => {
            const data = Array.isArray(res.data) ? res.data[0] : res.data;
            setReport(data || null);
        })
        .catch(() => toast.error('Failed to load edit data'))
        .finally(() => setLoading(false));
    }, [date, disa]);

    const handleSave = async () => {
        toast.info('Saving...', { autoClose: 1000 });
        try {
            // Reconstruct the summary object the backend expects during PUT
            const summaryObj = {};
            if (report.summary) {
                report.summary.forEach(s => {
                    summaryObj[s.shiftName] = {
                        pouredMoulds: s.pouredMoulds,
                        tonnage: s.tonnage,
                        quantity: s.quantity,
                        casted: s.casted,
                        value: s.shiftValue || s.value
                    };
                });
            }

            const payload = {
                ...report,
                summary: summaryObj,
            };

            await axios.put(`${API_BASE}/daily-performance/${report.id}`, payload, getAuthHeaders());
            toast.success('Saved successfully!');
            if (onSaveSuccess) onSaveSuccess();
        } catch (e) {
            toast.error('Save failed');
        }
    };

    if (loading) return <CenteredLoader />;
    if (!report) return <NoData msg={`No Performance reports found for DISA ${disa} on ${date}.`} />;

    const updateReport = (field, val) => setReport(prev => ({ ...prev, [field]: val }));

    const updateDetail = (idx, field, val) => {
        const details = [...report.details];
        details[idx] = { ...details[idx], [field]: val };
        updateReport('details', details);
    }

    const updateSummary = (shiftName, field, val) => {
        const sumArray = [...report.summary];
        const idx = sumArray.findIndex(s => s.shiftName === shiftName);
        if (idx !== -1) {
            sumArray[idx] = { ...sumArray[idx], [field]: val };
        } else {
            sumArray.push({ shiftName, [field]: val });
        }
        updateReport('summary', sumArray);
    }

    const updateDelay = (idx, field, val) => {
        const delays = [...(report.delays || [])];
        delays[idx] = { ...delays[idx], [field]: val };
        updateReport('delays', delays);
    }

    const getSummaryField = (shiftName, field) => {
        const s = report.summary?.find(x => x.shiftName === shiftName);
        return s ? s[field] : '';
    };

    return (
        <div className="space-y-6">
            <div className="bg-[#2a2a2a] p-5 rounded-xl border border-white/10 shadow-lg">
                <div className="grid grid-cols-3 gap-4 mb-6">
                    <Field label="Incharge" value={report.incharge} onChange={v => updateReport('incharge', v)} />
                    <Field label="HOF" value={report.hof} onChange={v => updateReport('hof', v)} />
                    <Field label="HOD" value={report.hod} onChange={v => updateReport('hod', v)} />
                </div>

                <SectionHeader title="Performance Summary" />
                <SubTable headers={['Shift', 'Poured Moulds', 'Tonnage', 'Quantity', 'Casted', 'Value']}>
                    {['I', 'II', 'III'].map(shift => (
                        <tr key={shift} className="border-b border-white/5">
                            <td className="p-2 text-white font-bold text-center">{shift}</td>
                            <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={getSummaryField(shift, 'pouredMoulds')} onChange={e => updateSummary(shift, 'pouredMoulds', e.target.value)} /></td>
                            <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={getSummaryField(shift, 'tonnage')} onChange={e => updateSummary(shift, 'tonnage', e.target.value)} /></td>
                            <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={getSummaryField(shift, 'quantity')} onChange={e => updateSummary(shift, 'quantity', e.target.value)} /></td>
                            <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={getSummaryField(shift, 'casted')} onChange={e => updateSummary(shift, 'casted', e.target.value)} /></td>
                            <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={getSummaryField(shift, 'shiftValue')} onChange={e => updateSummary(shift, 'shiftValue', e.target.value)} /></td>
                        </tr>
                    ))}
                </SubTable>

                <SectionHeader title="Performance Details" />
                <div className="overflow-x-auto custom-scrollbar">
                    <SubTable headers={['Pattern Code', 'Item Desc', 'Planned', 'Unplanned', 'Moulds Prod', 'Moulds Pour', 'Cavity', 'Unit Wt', 'Total Wt']}>
                        {report.details?.map((d, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.patternCode || ''} onChange={e => updateDetail(i, 'patternCode', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.itemDescription || ''} onChange={e => updateDetail(i, 'itemDescription', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.planned || ''} onChange={e => updateDetail(i, 'planned', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.unplanned || ''} onChange={e => updateDetail(i, 'unplanned', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.mouldsProd || ''} onChange={e => updateDetail(i, 'mouldsProd', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.mouldsPour || ''} onChange={e => updateDetail(i, 'mouldsPour', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.cavity || ''} onChange={e => updateDetail(i, 'cavity', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.unitWeight || ''} onChange={e => updateDetail(i, 'unitWeight', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.totalWeight || ''} onChange={e => updateDetail(i, 'totalWeight', e.target.value)} /></td>
                            </tr>
                        ))}
                    </SubTable>
                </div>

                <SectionHeader title="Production Delays" />
                {report.delays && report.delays.length > 0 ? (
                    <div className="overflow-x-auto custom-scrollbar">
                        <SubTable headers={['Shift', 'Duration (Mins)', 'Reason']}>
                            {report.delays.map((d, i) => (
                                <tr key={d.id || i} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="p-1 w-24"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.shift || ''} onChange={e => updateDelay(i, 'shift', e.target.value)} /></td>
                                    <td className="p-1 w-32"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.duration || ''} onChange={e => updateDelay(i, 'duration', e.target.value)} /></td>
                                    <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-left" value={d.reason || ''} onChange={e => updateDelay(i, 'reason', e.target.value)} /></td>
                                </tr>
                            ))}
                        </SubTable>
                    </div>
                ) : (
                    <p className="text-white/30 text-sm italic mb-6">No valid delays recorded for this report.</p>
                )}

                <SectionHeader title="Unplanned Reasons" />
                <Field label="Reasons" value={report.unplannedReasons} onChange={v => updateReport('unplannedReasons', v)} multiline />
            </div>
            <SaveButton onClick={handleSave} />
        </div>
    )
}

// ==========================================
// INTERNAL COMPONENT: SearchableSelect
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
        placeholder={placeholder || `Type '-' if none...`}
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
// MAIN COMPONENT
// ==========================================
const DailyProductionPerformance = () => {
  const [productionDate, setProductionDate] = useState(getProductionDate());
  const [disa, setDisa] = useState("");
  const [resetKey, setResetKey] = useState(0);

  // --- DROPDOWN DATA ---
  const [components, setComponents] = useState([]);
  const [incharges, setIncharges] = useState([]);
  const [hofs, setHofs] = useState([]);
  const [hods, setHods] = useState([]);

  // 🔥 NEW: State for Edit Wizard
  const [editModeData, setEditModeData] = useState(null);
  const [editWizard, setEditWizard] = useState({ show: false, step: 1, date: getProductionDate(), disa: "I" });

  const initialFormState = {
    disa: "",
    date: productionDate,
    significantEvent: "",
    maintenance: ""
  };

  const [formData, setFormData] = useState(() => {
    const savedDraft = localStorage.getItem("disaFormDraft");
    if (savedDraft) {
      const parsed = JSON.parse(savedDraft);
      return { ...parsed, date: productionDate };
    }
    return initialFormState;
  });

  const getAuthHeaders = () => {
    let token = localStorage.getItem('token');
    if (!token) {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const parsedUser = JSON.parse(userData);
          token = parsedUser.token || '';
        } catch (e) { }
      }
    }
    return {
      headers: { Authorization: `Bearer ${token}` }
    };
  };

  useEffect(() => {
    const authConfig = getAuthHeaders();

    axios.get(`${API_BASE}/components`, authConfig)
      .then((res) => setComponents(res.data.filter(c => c.isActive === 'Active')))
      .catch((err) => console.error("Failed to fetch components", err));

    axios.get(`${API_BASE}/daily-performance/users`, authConfig)
      .then((res) => {
        setHofs(res.data.hofs || []);
        setHods(res.data.hods || []);
      })
      .catch((err) => console.error("Failed to fetch users", err));

    axios.get(`${API_BASE}/supervisors`, authConfig)
      .then((res) => {
        const mappedIncharges = res.data.map(sup => ({ name: sup.supervisorName }));
        setIncharges(mappedIncharges);
      })
      .catch((err) => console.error("Failed to fetch supervisors", err));
  }, []);

  const [summary, setSummary] = useState({
    I: { pouredMoulds: "-", tonnage: "-", quantity: "-", casted: "", value: "" },
    II: { pouredMoulds: "-", tonnage: "-", quantity: "-", casted: "", value: "" },
    III: { pouredMoulds: "-", tonnage: "-", quantity: "-", casted: "", value: "" },
  });

  const [delays, setDelays] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      // Don't auto-fetch if we are in Edit Mode
      if (!productionDate || disa === "-" || !disa || editModeData) {
        setDelays([]);
        return;
      }

      try {
        const sumRes = await axios.get(`${API_BASE}/daily-performance/summary`, {
          params: { date: productionDate, disa: disa },
          ...getAuthHeaders()
        });
        const fetchedData = sumRes.data;

        setSummary((prev) => {
          const newSummary = { ...prev };
          ["I", "II", "III"].forEach(s => {
            newSummary[s].pouredMoulds = "-";
            newSummary[s].tonnage = "-";
            newSummary[s].quantity = "-";
            newSummary[s].casted = "";
            newSummary[s].value = "";
          });

          fetchedData.forEach(item => {
            if (newSummary[item.shift]) {
              newSummary[item.shift].pouredMoulds = item.totalPouredMoulds > 0 ? item.totalPouredMoulds : "-";

              if (item.totalTonnageKg > 0) {
                newSummary[item.shift].tonnage = (item.totalTonnageKg / 1000).toFixed(3);
              }
              if (item.totalQuantity > 0) {
                newSummary[item.shift].quantity = item.totalQuantity;
              }
              if (item.totalCastedKg > 0) {
                newSummary[item.shift].casted = item.totalCastedKg.toFixed(0);
              }
            }
          });
          return newSummary;
        });

        const delayRes = await axios.get(`${API_BASE}/daily-performance/delays`, {
          params: { date: productionDate, disa: disa },
          ...getAuthHeaders()
        });
        setDelays(delayRes.data);

      } catch (err) {
        console.error("Failed to fetch daily data", err);
      }
    };

    fetchData();
  }, [productionDate, disa, editModeData]);

  const [details, setDetails] = useState([
    {
      patternCode: "", itemDescription: "-", planned: "", unplanned: "",
      mouldsProd: "", mouldsPour: "", cavity: "-", unitWeight: "-", totalWeight: "-",
    },
  ]);

  const [unplannedReasons, setUnplannedReasons] = useState("");

  const [signatures, setSignatures] = useState({
    incharge: "",
    hof: "",
    hod: ""
  });

  const handleSummaryChange = (shift, field, value) => {
    setSummary((prev) => ({
      ...prev,
      [shift]: { ...prev[shift], [field]: value },
    }));
  };

  const summaryTotals = {
    pouredMoulds: ["I", "II", "III"].reduce((acc, s) => acc + parseNum(summary[s].pouredMoulds), 0),
    tonnage: ["I", "II", "III"].reduce((acc, s) => acc + parseNum(summary[s].tonnage), 0),
    quantity: ["I", "II", "III"].reduce((acc, s) => acc + parseNum(summary[s].quantity), 0),
    casted: ["I", "II", "III"].reduce((acc, s) => acc + parseNum(summary[s].casted), 0),
    value: ["I", "II", "III"].reduce((acc, s) => acc + parseNum(summary[s].value), 0),
  };

  const addDetailRow = () => {
    setDetails([
      ...details,
      { patternCode: "", itemDescription: "-", planned: "", unplanned: "", mouldsProd: "", mouldsPour: "", cavity: "-", unitWeight: "-", totalWeight: "-" },
    ]);
  };

  const removeDetailRow = (index) => {
    if (details.length === 1) return;
    const updated = details.filter((_, i) => i !== index);
    setDetails(updated);
  };

  const handleComponentSelect = async (index, item) => {
    const updated = [...details];

    updated[index].patternCode = item.code || "";
    updated[index].itemDescription = item.description || "-";
    updated[index].cavity = item.cavity !== null && item.cavity !== undefined ? item.cavity : "-";

    const unitWt = item.pouredWeight !== null && item.pouredWeight !== undefined ? item.pouredWeight : "-";
    updated[index].unitWeight = unitWt;

    updated[index].mouldsProd = "";
    updated[index].mouldsPour = "";
    updated[index].totalWeight = "-";
    setDetails([...updated]);

    if (productionDate && disa && disa !== "-" && item.description && item.description !== "-") {
      try {
        const res = await axios.get(`${API_BASE}/daily-performance/component-totals`, {
          params: { date: productionDate, disa: disa, componentName: item.description },
          ...getAuthHeaders()
        });

        const fetchedProd = res.data.totalProduced > 0 ? res.data.totalProduced : "";
        const fetchedPour = res.data.totalPoured > 0 ? res.data.totalPoured : "";

        setDetails((prev) => {
          const newDetails = [...prev];
          newDetails[index].mouldsProd = fetchedProd;
          newDetails[index].mouldsPour = fetchedPour;

          const pourNum = Number(fetchedPour);
          const wtNum = Number(unitWt);
          newDetails[index].totalWeight = (!isNaN(pourNum) && !isNaN(wtNum) && pourNum > 0 && wtNum > 0) ? Math.round(pourNum * wtNum) : "-";

          return newDetails;
        });

      } catch (err) {
        console.error("Failed to fetch component totals:", err);
      }
    }
  };

  const handleDetailChange = (index, field, value) => {
    const updated = [...details];
    updated[index][field] = value;

    if (field === "mouldsPour" || field === "unitWeight") {
      const pourVal = String(updated[index].mouldsPour).trim();
      const weightVal = String(updated[index].unitWeight).trim();

      if (pourVal === "-" || weightVal === "-" || pourVal === "" || weightVal === "") {
        updated[index].totalWeight = "-";
      } else {
        const pour = Number(pourVal);
        const weight = Number(weightVal);
        updated[index].totalWeight = (!isNaN(pour) && !isNaN(weight) && pour > 0 && weight > 0) ? Math.round(pour * weight) : "-";
      }
    }

    setDetails(updated);
  };

  const detailTotals = details.reduce(
    (acc, curr) => {
      acc.mouldsProd += parseNum(curr.mouldsProd);
      acc.mouldsPour += parseNum(curr.mouldsPour);
      acc.totalWeight += parseNum(curr.totalWeight);
      return acc;
    },
    { mouldsProd: 0, mouldsPour: 0, totalWeight: 0 }
  );

  const groupedDelaysMap = {};
  let totalShiftI = 0, totalShiftII = 0, totalShiftIII = 0, grandTotalDelay = 0;

  delays.forEach(d => {
    const reason = String(d.reason || "").trim();
    const shift = d.shift;
    
    let durStr = String(d.duration).trim();
    let dur = (durStr === "-" || durStr === "") ? 0 : Number(durStr);
    if (isNaN(dur)) dur = 0;

    if ((reason === "-" || reason === "") && dur === 0) {
        return; 
    }

    const safeReason = reason === "" ? "-" : reason;

    if (!groupedDelaysMap[safeReason]) {
      groupedDelaysMap[safeReason] = { I: 0, II: 0, III: 0, total: 0 };
    }
    
    if (shift === "I") { groupedDelaysMap[safeReason].I += dur; totalShiftI += dur; }
    else if (shift === "II") { groupedDelaysMap[safeReason].II += dur; totalShiftII += dur; }
    else if (shift === "III") { groupedDelaysMap[safeReason].III += dur; totalShiftIII += dur; }

    groupedDelaysMap[safeReason].total += dur;
    grandTotalDelay += dur;
  });

  const groupedDelays = Object.keys(groupedDelaysMap).map(reason => ({
    reason,
    ...groupedDelaysMap[reason]
  }));

  const isInvalid = (val) => val === undefined || val === null || String(val).trim() === "";

  const validateForm = () => {
    if (isInvalid(disa) || isInvalid(productionDate)) return false;

    for (let shift of ["I", "II", "III"]) {
      if (isInvalid(summary[shift].pouredMoulds) || isInvalid(summary[shift].tonnage) || isInvalid(summary[shift].casted) || isInvalid(summary[shift].value)) return false;
    }

    for (let d of details) {
      if (isInvalid(d.patternCode) || isInvalid(d.itemDescription) || isInvalid(d.planned) || isInvalid(d.unplanned) || isInvalid(d.mouldsProd) || isInvalid(d.mouldsPour) || isInvalid(d.cavity) || isInvalid(d.unitWeight) || isInvalid(d.totalWeight)) return false;
    }

    if (isInvalid(unplannedReasons)) return false;
    if (isInvalid(signatures.incharge) || isInvalid(signatures.hof) || isInvalid(signatures.hod)) return false;

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill ALL fields, including Assign In-charge. Type '-' if no data.");
      return;
    }

    const payload = {
      productionDate,
      disa,
      supervisorName: signatures.incharge,
      summary,
      details,
      unplannedReasons,
      signatures,
      delays
    };

    try {
      await axios.post(`${API_BASE}/daily-performance`, payload, getAuthHeaders());
      toast.success("Report sent to Supervisor successfully!");

      setSummary({
        I: { pouredMoulds: "-", tonnage: "-", quantity: "-", casted: "", value: "" },
        II: { pouredMoulds: "-", tonnage: "-", quantity: "-", casted: "", value: "" },
        III: { pouredMoulds: "-", tonnage: "-", quantity: "-", casted: "", value: "" },
      });
      setDetails([{ patternCode: "", itemDescription: "-", planned: "", unplanned: "", mouldsProd: "", mouldsPour: "", cavity: "-", unitWeight: "-", totalWeight: "-" }]);
      setUnplannedReasons("");
      setSignatures({ incharge: "", hof: "", hod: "" });
      setFormData(initialFormState);
      setDisa("");
      setResetKey(prev => prev + 1);

    } catch (err) {
      console.error(err);
      toast.error("Submission failed.");
    }
  };

  const handleDownload = async () => {
    if (!disa || disa === "-" || !productionDate) {
      toast.warning("Please select a valid DISA and Date before generating the PDF.");
      return;
    }

    try {
      const response = await axios.get(`${API_BASE}/daily-performance/download-pdf`, {
        params: { date: productionDate, disa: disa },
        responseType: "blob",
        ...getAuthHeaders()
      });

      if (response.data.type === "application/json") {
        toast.error("No saved report found for this Date & DISA. Please submit the form first.");
        return;
      }

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Daily_Performance_${productionDate}_${disa}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      toast.success("PDF Downloaded successfully!");
    } catch (err) {
      console.error("Download failed", err);
      toast.error("Failed to download PDF. Ensure the server is running.");
    }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6 pb-20">
        <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">

          <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
            <h2 className="text-2xl font-bold text-gray-800 uppercase tracking-wide flex items-center gap-4">
                DAILY PRODUCTION PERFORMANCE (FOUNDRY - B)
                {editModeData && <span className="text-[10px] bg-orange-100 text-orange-700 px-3 py-1 rounded-full font-black border border-orange-300 shadow-sm align-middle">EDITING MODE</span>}
            </h2>
            {!editModeData ? (
                <button type="button" onClick={() => setEditWizard({ show: true, step: 1, date: productionDate, disa: disa || 'I' })} className="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg transition-transform hover:-translate-y-0.5">
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
                <PerformanceEditor date={editModeData.date} disa={editModeData.disa} onSaveSuccess={() => setEditModeData(null)} />
            </div>
          ) : (
            <>
              <div className="flex justify-end items-center gap-6 mb-8 border-b-2 border-gray-200 pb-4">
                <div className="w-40">
                  <label className="font-bold text-gray-700 block mb-1 text-sm">DISA-</label>
                  <select
                    name="disa" value={disa}
                    onChange={(e) => setDisa(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold bg-white"
                  >
                    <option value="">Select DISA</option>
                    <option value="I">I</option>
                    <option value="II">II</option>
                    <option value="III">III</option>
                    <option value="IV">IV</option>
                    <option value="V">V</option>
                    <option value="VI">VI</option>
                  </select>
                </div>

                <div className="w-48">
                  <label className="font-bold text-gray-700 block mb-1 text-sm">DATE OF PRODUCTION :</label>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                    className="w-full border border-gray-300 p-2 rounded focus:outline-none focus:ring-1 focus:ring-orange-500 text-sm font-semibold text-gray-800 bg-white"
                  />
                </div>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-8 min-w-[1100px]">
                {/* 1. SUMMARY TABLE */}
                <div>
                  <table className="w-full border-collapse border border-gray-800 text-sm text-center">
                    <thead className="text-gray-800 font-bold bg-gray-100">
                      <tr>
                        <th className="border border-gray-800 p-2 w-32">SHIFT</th>
                        <th className="border border-gray-800 p-2">POURED MOULDS</th>
                        <th className="border border-gray-800 p-2">TONNAGE</th>
                        <th className="border border-gray-800 p-2">QUANTITY</th>
                        <th className="border border-gray-800 p-2">CASTED</th>
                        <th className="border border-gray-800 p-2">VALUE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["I", "II", "III"].map((shift) => (
                        <tr key={shift} className="bg-white">
                          <td className="border border-gray-800 p-2 font-bold bg-gray-50">{shift}</td>
                          <td className="border border-gray-800 p-0">
                            <input type="text" value={String(summary[shift].pouredMoulds)} readOnly className="w-full h-full text-center outline-none bg-gray-50 py-2 cursor-not-allowed font-semibold text-gray-600" />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input type="text" value={String(summary[shift].tonnage)} readOnly className="w-full h-full text-center outline-none bg-gray-50 py-2 cursor-not-allowed font-semibold text-gray-600" />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input type="text" value={String(summary[shift].quantity)} readOnly className="w-full h-full text-center outline-none bg-gray-50 py-2 cursor-not-allowed font-semibold text-gray-600" />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input type="text" value={String(summary[shift].casted)} onChange={(e) => handleSummaryChange(shift, "casted", e.target.value)} placeholder="Type '-' if none" className="w-full h-full text-center outline-none bg-transparent py-2" />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input type="text" value={String(summary[shift].value)} onChange={(e) => handleSummaryChange(shift, "value", e.target.value)} placeholder="Type '-' if none" className="w-full h-full text-center outline-none bg-transparent py-2" />
                          </td>
                        </tr>
                      ))}
                      {/* TOTAL ROW */}
                      <tr className="bg-gray-100 font-bold border-t-2 border-gray-800">
                        <td className="border border-gray-800 p-2">TOTAL</td>
                        <td className="border border-gray-800 p-2">{summaryTotals.pouredMoulds > 0 ? summaryTotals.pouredMoulds : "-"}</td>
                        <td className="border border-gray-800 p-2">{summaryTotals.tonnage > 0 ? summaryTotals.tonnage.toFixed(3) : "-"}</td>
                        <td className="border border-gray-800 p-2">{summaryTotals.quantity > 0 ? summaryTotals.quantity : "-"}</td>
                        <td className="border border-gray-800 p-2">{summaryTotals.casted > 0 ? summaryTotals.casted.toFixed(0) : "-"}</td>
                        <td className="border border-gray-800 p-2">{summaryTotals.value > 0 ? summaryTotals.value.toFixed(2) : "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 2. DETAILS TABLE */}
                <div>
                  <div className="flex items-center justify-end mb-2">
                    <button type="button" onClick={addDetailRow} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-1 rounded shadow text-sm">+ Add Row</button>
                  </div>

                  <table className="w-full border-collapse border border-gray-800 text-sm text-center relative z-0">
                    <thead className="bg-gray-100 text-gray-800 font-bold border-b-2 border-gray-800">
                      <tr>
                        <th className="border border-gray-800 p-2 w-10" rowSpan="2">Sl.<br />No.</th>
                        <th className="border border-gray-800 p-2 w-48" rowSpan="2">Pattern Code</th>
                        <th className="border border-gray-800 p-2 w-64" rowSpan="2">Item Description</th>
                        <th className="border border-gray-800 p-1" colSpan="2">Item</th>
                        <th className="border border-gray-800 p-2 w-24" rowSpan="2">Number of<br />Moulds Prod.</th>
                        <th className="border border-gray-800 p-2 w-24" rowSpan="2">Number of<br />Moulds Pour.</th>
                        <th className="border border-gray-800 p-2 w-16" rowSpan="2">No. of<br />Cavity</th>
                        <th className="border border-gray-800 p-2 w-56" rowSpan="2">Poured WT (Kg)</th>
                        <th className="border border-gray-800 p-2 w-10" rowSpan="2">Act</th>
                      </tr>
                      <tr>
                        <th className="border border-gray-800 p-1 font-normal w-16 text-xs">Planned</th>
                        <th className="border border-gray-800 p-1 font-normal w-20 text-xs">Un Planned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.map((row, index) => (
                        <tr key={index} className="bg-white hover:bg-gray-50 transition-colors">
                          <td className="border border-gray-800 p-1 font-bold">{index + 1}</td>

                          <td className="border border-gray-800 p-1 relative overflow-visible">
                            <SearchableSelect
                              key={`pattern-${index}-${resetKey}`}
                              options={components} displayKey="code"
                              value={row.patternCode} placeholder="Type '-'"
                              onSelect={(item) => handleComponentSelect(index, item)}
                            />
                          </td>

                          <td className="border border-gray-800 p-1 relative overflow-visible text-left">
                            <SearchableSelect
                              key={`desc-${index}-${resetKey}`}
                              options={components}
                              displayKey="description"
                              value={row.itemDescription === "-" ? "" : row.itemDescription}
                              placeholder="Search Component..."
                              onSelect={(item) => handleComponentSelect(index, item)}
                            />
                          </td>

                          <td className="border border-gray-800 p-0">
                            <input type="text" value={String(row.planned)} onChange={(e) => handleDetailChange(index, "planned", e.target.value)} className="w-full h-full text-center outline-none bg-transparent py-2" />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input type="text" value={String(row.unplanned)} onChange={(e) => handleDetailChange(index, "unplanned", e.target.value)} className="w-full h-full text-center outline-none bg-transparent py-2" />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input type="text" value={String(row.mouldsProd)} onChange={(e) => handleDetailChange(index, "mouldsProd", e.target.value)} placeholder="-" className="w-full h-full text-center outline-none bg-transparent py-2" />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input type="text" value={String(row.mouldsPour)} onChange={(e) => handleDetailChange(index, "mouldsPour", e.target.value)} placeholder="-" className="w-full h-full text-center outline-none bg-transparent py-2 font-bold" />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <input type="text" value={String(row.cavity)} readOnly className="w-full h-full text-center outline-none bg-gray-50 text-gray-700 py-2 cursor-not-allowed font-bold" />
                          </td>
                          <td className="border border-gray-800 p-0">
                            <div className="flex items-center justify-center w-full h-full gap-1 px-1 font-semibold text-gray-700">
                              <span>[</span>
                              <input
                                type="text"
                                placeholder="Wt"
                                value={String(row.unitWeight)}
                                onChange={(e) => handleDetailChange(index, "unitWeight", e.target.value)}
                                className="w-12 text-center outline-none border-b border-gray-500 bg-transparent py-1 font-normal text-gray-800 focus:border-orange-500 transition-colors"
                              />
                              <span className="mx-1">X</span>
                              <input type="text" value={String(row.mouldsPour)} readOnly placeholder="Qty" className="w-12 text-center outline-none border-b border-gray-400 bg-transparent py-1 font-normal text-gray-500 cursor-not-allowed" />
                              <span>] =</span>
                              <span className="w-16 text-right pr-1 text-black font-bold">{row.totalWeight}</span>
                            </div>
                          </td>
                          <td className="border border-gray-800 p-0 text-center">
                            {details.length > 1 && (
                              <button type="button" onClick={() => removeDetailRow(index)} className="text-red-500 font-bold hover:text-red-700 w-full h-full" title="Remove Row">✕</button>
                            )}
                          </td>
                        </tr>
                      ))}

                      {/* DETAILS TOTAL ROW */}
                      <tr className="bg-gray-100 font-bold text-gray-800 border-t-2 border-gray-800">
                        <td className="border border-gray-800 p-2"></td><td className="border border-gray-800 p-2"></td><td className="border border-gray-800 p-2"></td><td className="border border-gray-800 p-2"></td>
                        <td className="border border-gray-800 p-2 text-center text-black tracking-widest text-sm">TOTAL</td>
                        <td className="border border-gray-800 p-2 text-center text-black">{detailTotals.mouldsProd > 0 ? detailTotals.mouldsProd : "-"}</td>
                        <td className="border border-gray-800 p-2 text-center text-black">{detailTotals.mouldsPour > 0 ? detailTotals.mouldsPour : "-"}</td>
                        <td className="border border-gray-800 p-2 bg-gray-100"></td>
                        <td className="border border-gray-800 p-0">
                          <div className="flex items-center justify-center w-full h-full gap-1 px-1 font-bold text-gray-800">
                            <span className="w-16 text-right pr-1 text-black">{detailTotals.totalWeight > 0 ? Math.round(detailTotals.totalWeight) : "-"}</span>
                          </div>
                        </td>
                        <td className="border border-gray-800 p-2"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* 3. GROUPED PRODUCTION DELAYS TABLE */}
                <div>
                  <table className="w-full border-collapse border border-gray-800 text-sm text-center">
                    <thead className="bg-gray-100 text-gray-800 font-bold">
                      <tr><th className="border border-gray-800 p-2 bg-gray-200" colSpan="6">Production delays / Remarks</th></tr>
                      <tr>
                        <th className="border border-gray-800 p-2 w-16" rowSpan="2">S.No.</th>
                        <th className="border border-gray-800 p-2" rowSpan="2">Reasons</th>
                        <th className="border border-gray-800 p-1" colSpan="3">Shift (Mins)</th>
                        <th className="border border-gray-800 p-2 w-32" rowSpan="2">Total Duration</th>
                      </tr>
                      <tr>
                        <th className="border border-gray-800 p-1 font-normal text-xs w-20">I</th>
                        <th className="border border-gray-800 p-1 font-normal text-xs w-20">II</th>
                        <th className="border border-gray-800 p-1 font-normal text-xs w-20">III</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedDelays.length > 0 ? (
                        groupedDelays.map((d, index) => (
                          <tr key={index} className="bg-white">
                            <td className="border border-gray-800 p-2">{index + 1}</td>
                            <td className="border border-gray-800 p-2 text-left px-4">{d.reason}</td>
                            <td className="border border-gray-800 p-2">{d.I > 0 ? d.I : "-"}</td>
                            <td className="border border-gray-800 p-2">{d.II > 0 ? d.II : "-"}</td>
                            <td className="border border-gray-800 p-2">{d.III > 0 ? d.III : "-"}</td>
                            <td className="border border-gray-800 p-2 font-bold text-blue-800">{d.total > 0 ? d.total : "-"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr className="bg-white h-10"><td className="border border-gray-800 p-2 text-gray-500 font-semibold italic" colSpan="6">{(disa !== "-" && disa) ? "No delays recorded for this date and DISA." : "Select DISA to view delays."}</td></tr>
                      )}

                      {/* DELAYS TOTAL ROW */}
                      {groupedDelays.length > 0 && (
                        <tr className="bg-gray-100 font-bold border-t-2 border-gray-800">
                          <td className="border border-gray-800 p-2 text-right pr-4" colSpan="2">TOTAL</td>
                          <td className="border border-gray-800 p-2">{totalShiftI > 0 ? totalShiftI : "-"}</td>
                          <td className="border border-gray-800 p-2">{totalShiftII > 0 ? totalShiftII : "-"}</td>
                          <td className="border border-gray-800 p-2">{totalShiftIII > 0 ? totalShiftIII : "-"}</td>
                          <td className="border border-gray-800 p-2 text-red-600">{grandTotalDelay > 0 ? grandTotalDelay : "-"}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 4. FOOTER & REASONS */}
                <div className="border-2 border-gray-800 flex flex-col min-h-[100px]">
                  <div className="px-2 py-1 font-bold text-gray-800 text-sm border-b border-gray-400">Reasons for producing un-planned items.</div>
                  <textarea className="w-full h-full p-2 outline-none resize-none text-sm bg-transparent" placeholder="Type '-' if none..." value={String(unplannedReasons)} onChange={(e) => setUnplannedReasons(e.target.value)} />
                </div>

                {/* 5. ASSIGNMENTS */}
                <div className="flex flex-wrap justify-between items-end mt-8 mb-4 gap-6">

                  <div className="w-64">
                    <SearchableSelect
                      key={`sign-inc-${resetKey}`} label="Assign In-charge (Supervisor)"
                      options={incharges} displayKey="name" value={signatures.incharge}
                      onSelect={(item) => setSignatures({ ...signatures, incharge: item.name || item.name })}
                    />
                  </div>

                  <div className="w-64">
                    <SearchableSelect
                      key={`sign-hof-${resetKey}`} label="Assign HOF"
                      options={hofs} displayKey="name" value={signatures.hof}
                      onSelect={(item) => setSignatures({ ...signatures, hof: item.name || item.name })}
                    />
                  </div>

                  <div className="w-64">
                    <SearchableSelect
                      key={`sign-hod-${resetKey}`} label="Assign HOD - Production"
                      options={hods} displayKey="name" value={signatures.hod}
                      onSelect={(item) => setSignatures({ ...signatures, hod: item.name || item.name })}
                    />
                  </div>

                </div>

                {/* BUTTONS */}
                <div className="flex justify-end gap-4 mt-2 pt-4 border-t border-gray-300">
                  <button type="button" onClick={handleDownload} className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded font-bold transition-colors flex items-center gap-2 shadow-lg">
                    <span>⬇️</span> Generate Report (PDF)
                  </button>
                  <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg">
                    Submit & Send to Supervisor
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
                          <div className="text-sm font-bold text-white uppercase leading-tight">Performance Report</div>
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

export default DailyProductionPerformance;