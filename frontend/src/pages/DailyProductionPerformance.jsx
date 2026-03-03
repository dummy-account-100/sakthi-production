import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import SignatureCanvas from "react-signature-canvas";
import logo from "../assets/logo.png";

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

  const opSigCanvas = useRef({});

  // --- DROPDOWN DATA ---
  const [components, setComponents] = useState([]);
  const [incharges, setIncharges] = useState([]);
  const [hofs, setHofs] = useState([]);
  const [hods, setHods] = useState([]);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_URL}/api/components`)
      .then((res) => setComponents(res.data))
      .catch((err) => console.error("Failed to fetch components", err));

    axios.get(`${process.env.REACT_APP_API_URL}/api/daily-performance/users`)
      .then((res) => {
        setIncharges(res.data.incharges || []);
        setHofs(res.data.hofs || []);
        setHods(res.data.hods || []);
      })
      .catch((err) => console.error("Failed to fetch users", err));
  }, []);

  // --- STATE: SUMMARY TABLE (Defaulted to "-") ---
  const [summary, setSummary] = useState({
    I: { pouredMoulds: "-", tonnage: "-", casted: "", value: "" },
    II: { pouredMoulds: "-", tonnage: "-", casted: "", value: "" },
    III: { pouredMoulds: "-", tonnage: "-", casted: "", value: "" },
  });

  const [delays, setDelays] = useState([]);

  // Auto-fetch Summary Data
  useEffect(() => {
    const fetchData = async () => {
      if (!productionDate || disa === "-" || !disa) {
        setDelays([]);
        return;
      }

      try {
        const sumRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/daily-performance/summary?date=${productionDate}&disa=${disa}`);
        const fetchedData = sumRes.data;

        setSummary((prev) => {
          const newSummary = { ...prev };
          ["I", "II", "III"].forEach(s => {
            newSummary[s].pouredMoulds = "-";
            newSummary[s].tonnage = "-";
            // 🔥 FIX: Properly reset editable fields when DISA/Date changes
            newSummary[s].casted = "";
            newSummary[s].value = "";
          });

          fetchedData.forEach(item => {
            if (newSummary[item.shift]) {
              newSummary[item.shift].pouredMoulds = item.totalPouredMoulds > 0 ? item.totalPouredMoulds : "-";

              if (item.totalTonnageKg > 0) {
                newSummary[item.shift].tonnage = (item.totalTonnageKg / 1000).toFixed(3);
              }
              if (item.totalCastedKg > 0) {
                newSummary[item.shift].casted = item.totalCastedKg.toFixed(0);
              }
            }
          });
          return newSummary;
        });

        const delayRes = await axios.get(`${process.env.REACT_APP_API_URL}/api/daily-performance/delays?date=${productionDate}&disa=${disa}`);
        setDelays(delayRes.data);

      } catch (err) {
        console.error("Failed to fetch daily data", err);
      }
    };

    fetchData();
  }, [productionDate, disa]);

  // --- STATE: DETAILS TABLE (Defaulted to "-") ---
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

  // 🔥 AUTO FETCH PRODUCED & POURED FOR DETAILS 🔥
  const handleComponentSelect = async (index, item) => {
    const updated = [...details];

    updated[index].patternCode = item.code || "";
    updated[index].itemDescription = item.description || "-";
    updated[index].cavity = item.cavity !== null && item.cavity !== undefined ? item.cavity : "-";

    const unitWt = item.pouredWeight !== null && item.pouredWeight !== undefined ? item.pouredWeight : "-";
    updated[index].unitWeight = unitWt;

    // Clear temporarily while fetching
    updated[index].mouldsProd = "";
    updated[index].mouldsPour = "";
    updated[index].totalWeight = "-";
    setDetails([...updated]);

    if (productionDate && disa && disa !== "-" && item.description && item.description !== "-") {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/daily-performance/component-totals`, {
          params: { date: productionDate, disa: disa, componentName: item.description }
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

    if (field === "mouldsPour") {
      const pour = Number(updated[index].mouldsPour);
      const weight = Number(updated[index].unitWeight);
      updated[index].totalWeight = (!isNaN(pour) && !isNaN(weight) && pour > 0 && weight > 0) ? Math.round(pour * weight) : "-";
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

  // --- GROUP DELAYS LOGIC ---
  const groupedDelaysMap = {};
  let totalShiftI = 0, totalShiftII = 0, totalShiftIII = 0, grandTotalDelay = 0;

  delays.forEach(d => {
    const reason = d.reason || "-";
    const shift = d.shift;
    const dur = Number(d.duration) || 0;

    if (!groupedDelaysMap[reason]) {
      groupedDelaysMap[reason] = { I: 0, II: 0, III: 0, total: 0 };
    }
    if (shift === "I") { groupedDelaysMap[reason].I += dur; totalShiftI += dur; }
    else if (shift === "II") { groupedDelaysMap[reason].II += dur; totalShiftII += dur; }
    else if (shift === "III") { groupedDelaysMap[reason].III += dur; totalShiftIII += dur; }

    groupedDelaysMap[reason].total += dur;
    grandTotalDelay += dur;
  });

  const groupedDelays = Object.keys(groupedDelaysMap).map(reason => ({
    reason,
    ...groupedDelaysMap[reason]
  }));

  // --- STRICT VALIDATION FOR ALL FIELDS ---
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
      toast.error("Please fill ALL fields. Type a hyphen '-' if there is no data to enter.");
      return;
    }

    if (opSigCanvas.current.isEmpty()) {
      toast.warning("Please provide an Operator Signature.");
      return;
    }
    const signatureData = opSigCanvas.current.getCanvas().toDataURL("image/png");

    const payload = {
      productionDate, disa, summary, details, unplannedReasons, signatures, delays,
      operatorSignature: signatureData
    };

    try {
      await axios.post(`${process.env.REACT_APP_API_URL}/api/daily-performance`, payload);
      toast.success("Report saved successfully!");

      setSummary({
        I: { pouredMoulds: "-", tonnage: "-", casted: "", value: "" },
        II: { pouredMoulds: "-", tonnage: "-", casted: "", value: "" },
        III: { pouredMoulds: "-", tonnage: "-", casted: "", value: "" },
      });
      setDetails([{ patternCode: "", itemDescription: "-", planned: "", unplanned: "", mouldsProd: "", mouldsPour: "", cavity: "-", unitWeight: "-", totalWeight: "-" }]);
      setUnplannedReasons("");
      setSignatures({ incharge: "", hof: "", hod: "" });
      setDisa("");
      opSigCanvas.current.clear();
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
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/daily-performance/download-pdf`, {
        params: { date: productionDate, disa: disa },
        responseType: "blob"
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `Daily_Performance_${productionDate}_${disa}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      toast.success("PDF Downloaded successfully!");
    } catch (err) {
      console.error("Download failed", err);
      if (err.response && err.response.status === 404) {
        toast.error("No saved report found for this Date & DISA. Please submit the form first.");
      } else {
        toast.error("Failed to download PDF.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center justify-center p-6">
      <ToastContainer position="top-right" autoClose={3000} theme="colored" />

      <div className="bg-white w-full max-w-[90rem] rounded-xl p-8 shadow-2xl overflow-x-auto border-4 border-gray-100">

        {/* HEADER */}
        <div className="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex items-center gap-4">
            <img src={logo} alt="Sakthi Auto" className="h-10 w-auto object-contain bg-white p-1 rounded" />
            <h1 className="text-2xl font-bold text-gray-800 tracking-wide uppercase">
              DAILY PRODUCTION PERFORMANCE (FOUNDRY - B)
            </h1>
          </div>

          <div className="flex items-center gap-6">
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

                    <td className="border border-gray-800 p-0">
                      <input type="text" value={String(row.itemDescription)} readOnly className="w-full h-full text-left outline-none bg-gray-50 text-gray-700 py-2 px-2 cursor-not-allowed" />
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
                        <input type="text" placeholder="Wt" value={String(row.unitWeight)} readOnly className="w-12 text-center outline-none border-b border-gray-400 bg-transparent py-1 font-normal text-gray-500 cursor-not-allowed" />
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
                      {/* <span>[</span><span className="w-12 text-center inline-block"></span><span className="mx-1">X</span><span className="w-12 text-center inline-block"></span><span>] =</span> */}
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

          {/* 5. SIGNATURES & ASSIGNMENTS */}
          <div className="flex justify-between items-end mt-8 mb-4 px-10 gap-6">
            <div className="flex flex-col w-64">
              <label className="font-bold text-gray-700 block mb-1 text-sm text-center">Operator Signature</label>
              <div className="border-2 border-dashed border-gray-400 rounded-lg overflow-hidden h-24 mb-1">
                <SignatureCanvas ref={opSigCanvas} penColor="blue" canvasProps={{ className: 'w-full h-full cursor-crosshair bg-gray-50' }} />
              </div>
              <button type="button" onClick={() => opSigCanvas.current.clear()} className="text-xs text-red-500 hover:text-red-700 font-bold self-end uppercase">Clear</button>
            </div>

            <div className="w-64">
              <SearchableSelect
                key={`sign-inc-${resetKey}`} label="Assign In-charge"
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
            <button type="button" onClick={handleDownload} className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded font-bold transition-colors flex items-center gap-2 shadow-lg"><span>⬇️</span> Generate Report (PDF)</button>
            <button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded font-bold transition-colors shadow-lg">Submit & Send to HOF/HOD</button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default DailyProductionPerformance;