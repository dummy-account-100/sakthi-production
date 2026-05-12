import React, { useEffect, useState } from "react";
import axios from "axios";
import Header from "../components/Header";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FileDown, Save } from 'lucide-react'; 

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

// --- Custom Searchable Dropdown for Table Cells ---
const TableSearchableSelect = ({ options, displayKey, onSelect, value, placeholder }) => {
  const [search, setSearch] = useState(value || "");
  const [open, setOpen] = useState(false);

  useEffect(() => { setSearch(value || ""); }, [value]);

  const filtered = options.filter((item) => item[displayKey]?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full h-full min-h-[50px] flex items-center justify-center bg-gray-50">
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        className="w-full h-full min-h-[50px] px-2 text-center text-sm font-bold text-gray-900 bg-transparent outline-none focus:bg-orange-100 focus:ring-2 focus:ring-orange-500 transition-colors placeholder:text-gray-500"
        placeholder={placeholder}
      />
      {open && (
        <ul className="absolute top-full left-0 mt-1 z-[9999] bg-white border border-gray-400 w-56 max-h-48 overflow-y-auto rounded shadow-2xl text-left">
          {filtered.length > 0 ? filtered.map((item, index) => (
            <li
              key={index}
              onMouseDown={(e) => { e.preventDefault(); setSearch(item[displayKey]); setOpen(false); onSelect(item[displayKey]); }}
              className="p-3 hover:bg-orange-100 cursor-pointer text-sm text-gray-800 font-bold border-b border-gray-100"
            >
              {item[displayKey]}
            </li>
          )) : <li className="p-3 text-gray-500 text-sm italic">No matches</li>}
        </ul>
      )}
    </div>
  );
};

const getDateInfo = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return { recordDate: `${day}-${month}-${year}`, dbDate: `${year}-${month}-${day}` };
};

const defaultErrorProofs = [
  {
    line: "All the 6 DISA Lines",
    name: "Mould gap sensor Presure 0.2 bar applied on the mould partling line alarm and line stoppage interlink control prevention",
    nature: "If mould Gap forms, pressure drops below 0.2 bar which gives alarm with red light and line will stopage",
    frequency: "Once in 10 days or every VAT cleaning"
  },
];

const ErrorProofVerification = () => {
  const initialTimeData = getDateInfo();

  const [observations, setObservations] = useState({});
  const [sNo, setSNo] = useState(1);
  const [recordDate, setRecordDate] = useState(initialTimeData.dbDate);

  const [errorProofNo, setErrorProofNo] = useState("");
  const [problem, setProblem] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [status] = useState("Pending");
  const [reviewedByReaction, setReviewedByReaction] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [remarks, setRemarks] = useState("");

  const verifiedBy = ""; 
  const [reviewedByMain, setReviewedByMain] = useState("");

  const [operatorList, setOperatorList] = useState([]);
  const [supervisorList, setSupervisorList] = useState([]);
  const [hofList, setHofList] = useState([]);
  
  const [assignedHOF, setAssignedHOF] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  const fetchInitialData = async () => {
    try {
      const snoRes = await axios.get(`${API_BASE}/error-proof/next-sno`);
      setSNo(snoRes.data.nextSNo);

      const inchargeRes = await axios.get(`${API_BASE}/error-proof/incharges`);
      setOperatorList(inchargeRes.data.operators || []);
      setSupervisorList(inchargeRes.data.supervisors || []);
      setHofList(inchargeRes.data.hofs || []);
      
    } catch (err) { console.error("Error fetching initial data", err); }
  };

  // Fetch existing data when date changes (like 4M Change form)
  const fetchExistingData = async () => {
    try {
      const res = await axios.get(`${API_BASE}/error-proof/v1-by-date`, { params: { date: recordDate } });
      const verifications = res.data.verifications || [];
      const reactionPlans = res.data.reactionPlans || [];

      if (verifications.length > 0) {
        // Map verifications to observations by matching error proof name
        const loadedObs = {};
        verifications.forEach(v => {
          const idx = defaultErrorProofs.findIndex(p => p.name === v.errorProofName);
          if (idx !== -1) {
            loadedObs[idx] = v.observationResult;
          }
        });
        setObservations(loadedObs);

        // Load assigned HOF from the first verification
        setAssignedHOF(verifications[0].AssignedHOF || "");

        // If there's a reaction plan, load its fields
        if (reactionPlans.length > 0) {
          const rp = reactionPlans[0];
          setErrorProofNo(rp.errorProofNo || "");
          setProblem(rp.problem || "");
          setRootCause(rp.rootCause || "");
          setCorrectiveAction(rp.correctiveAction || "");
          setReviewedByReaction(rp.reviewedBy || "");
          setApprovedBy(rp.approvedBy || "");
          setRemarks(rp.remarks || "");
        } else {
          // No reaction plans — clear the fields
          setErrorProofNo(""); setProblem(""); setRootCause(""); setCorrectiveAction("");
          setReviewedByReaction(""); setApprovedBy(""); setRemarks("");
        }

        setIsEditMode(true);
      } else {
        // No existing data — reset form
        setObservations({});
        setAssignedHOF("");
        setErrorProofNo(""); setProblem(""); setRootCause(""); setCorrectiveAction("");
        setReviewedByReaction(""); setApprovedBy(""); setRemarks("");
        setIsEditMode(false);
      }
    } catch (err) { console.error("Error fetching existing data", err); }
  };

  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { if (recordDate) fetchExistingData(); }, [recordDate]);

  const handleObservationChange = (index, value) => {
    setObservations(prev => ({ ...prev, [index]: value }));
    // When changing to OK, clear all reaction plan data completely
    if (value === "OK") {
      setErrorProofNo("");
      setProblem("");
      setRootCause("");
      setCorrectiveAction("");
      setReviewedByReaction("");
      setApprovedBy("");
      setRemarks("");
    }
  };

  const hasNotOk = Object.values(observations).includes("NOT_OK");

  const handleSubmit = async () => {
    if (Object.keys(observations).length === 0) { 
      toast.warning("Please check OK or Not OK for at least one Error Proof."); 
      return; 
    }
    if (hasNotOk && (!errorProofNo || !problem || !reviewedByReaction || !approvedBy)) {
      toast.warning("Reaction Plan requires an Error Proof No, Problem, Operator Name, and Supervisor Assignment.");
      return;
    }
    if (!assignedHOF) { 
      toast.warning("Please assign a HOF for verification."); 
      return; 
    }

    // Automatically send "Submitted" as the signature
    const signatureData = "Submitted"; 

    try {
      for (const index of Object.keys(observations)) {
        const proof = defaultErrorProofs[index];
        const obsResult = observations[index];

        await axios.post(`${API_BASE}/error-proof/add-verification`, {
          line: proof.line, errorProofName: proof.name, natureOfErrorProof: proof.nature, frequency: proof.frequency,
          recordDate, shift: "Daily", observationResult: obsResult, verifiedBy, reviewedBy: reviewedByMain,
          operatorSignature: signatureData, assignedHOF: assignedHOF
        });

        if (obsResult === "NOT_OK") {
          await axios.post(`${API_BASE}/error-proof/add-reaction`, {
            sNo, errorProofNo, errorProofName: proof.name, recordDate, shift: "Daily",
            problem, rootCause, correctiveAction, status, reviewedBy: reviewedByReaction, approvedBy, remarks
          });
        }

        // When changing to OK, delete any old reaction plans for this proof from the DB
        if (obsResult === "OK") {
          await axios.post(`${API_BASE}/error-proof/bulk-update`, {
            verifications: [],
            reactionPlans: [],
            deletedProofNames: [proof.name],
            date: recordDate
          });
        }
      }

      toast.success("Records saved and sent to HOF/Supervisor!");

      fetchInitialData();
      fetchExistingData();
    } catch (err) { 
      toast.error(err.response?.data?.message || "Error saving record"); 
    }
  };

  const handleGenerateReport = async () => {
    const targetLine = encodeURIComponent(defaultErrorProofs[0].line);
    
    try {
      const response = await axios.get(`${API_BASE}/error-proof/report?line=${targetLine}&date=${recordDate}&_t=${Date.now()}`, {
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ErrorProof_Verification_${targetLine}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success("PDF Downloaded successfully!");
    } catch (err) {
      console.error("Download failed", err);
      if (err.response && err.response.data && err.response.data instanceof Blob) {
        const errorText = await err.response.data.text();
        toast.error(errorText || "Failed to download PDF. Please check your connection.");
      } else {
        toast.error(err.response?.data?.message || "Failed to download PDF. Please check your connection or login again.");
      }
    }
  };

  return (
    <>
      <Header />
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} />
      <div className="min-h-screen bg-[#2d2d2d] flex flex-col items-center p-6">

        <div className="bg-white w-full max-w-[100rem] rounded-xl p-8 shadow-2xl overflow-x-auto mt-6">
          <h2 className="text-2xl font-bold mb-4 text-center text-gray-800 uppercase tracking-wide">
            Error Proof Verification Check List
            {isEditMode && <span className="ml-4 text-sm text-blue-600 bg-blue-100 px-3 py-1 rounded-full align-middle normal-case">(Editing Mode)</span>}
          </h2>

          <div className="flex justify-center items-center bg-gray-50 border border-gray-200 py-3 px-8 rounded-lg mb-8 max-w-sm mx-auto shadow-sm">
            <label className="text-gray-500 uppercase text-sm tracking-wider font-bold mr-2">Date:</label>
            <input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} className="bg-white text-gray-800 font-bold border-2 border-gray-300 rounded focus:border-orange-500 outline-none px-3 py-1 cursor-pointer" />
          </div>

          <div className="min-w-[1100px] mb-8">
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead className="bg-gray-100 text-gray-700 text-center">
                <tr><th className="border border-gray-300 p-3 w-32">Line</th><th className="border border-gray-300 p-3 w-80">Error Proof Name</th><th className="border border-gray-300 p-3 w-80">Nature of Error Proof</th><th className="border border-gray-300 p-3 w-32">Frequency</th><th className="border border-gray-300 p-3 w-40">Observation</th></tr>
              </thead>
              <tbody>
                {defaultErrorProofs.map((proof, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="border border-gray-300 p-4 align-middle text-center"><p className="text-gray-900 font-bold">{proof.line}</p></td>
                    <td className="border border-gray-300 p-4 align-middle"><p className="text-gray-800 leading-relaxed">{proof.name}</p></td>
                    <td className="border border-gray-300 p-4 align-middle"><p className="text-gray-700 leading-relaxed">{proof.nature}</p></td>
                    <td className="border border-gray-300 p-4 align-middle text-center"><p className="text-gray-900 font-semibold">{proof.frequency}</p></td>
                    <td className="border border-gray-300 p-4 align-middle">
                      <div className="flex flex-col gap-3 ml-4">
                        <label className="flex items-center gap-2 cursor-pointer text-green-700 font-bold text-sm">
                          <input type="radio" name={`obs-${index}`} className="w-4 h-4 accent-green-600" checked={observations[index] === "OK"} onChange={() => handleObservationChange(index, "OK")} /> Checked OK
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-red-700 font-bold text-sm">
                          <input type="radio" name={`obs-${index}`} className="w-4 h-4 accent-red-600" checked={observations[index] === "NOT_OK"} onChange={() => handleObservationChange(index, "NOT_OK")} /> Checked Not OK
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasNotOk && (
            <div className="mt-8 animate-fade-in border-t-2 border-red-200 pt-6">
              <h3 className="text-xl font-bold mb-4 text-gray-800 text-center bg-red-100 py-2 rounded">REACTION PLAN REQUIRED</h3>

              <div className="min-w-[1300px] pb-32 overflow-visible">
                <table className="w-full text-center border-collapse border border-gray-300 text-sm mb-6 relative">
                  <thead className="bg-gray-100 text-gray-700 text-center text-xs uppercase tracking-wide">
                    <tr><th className="border border-gray-300 p-2 w-16">S.No</th><th className="border border-gray-300 p-2 w-28">Error Proof No</th><th className="border border-gray-300 p-2 w-48">Problem</th><th className="border border-gray-300 p-2 w-48">Root Cause</th><th className="border border-gray-300 p-2 w-48">Corrective Action</th><th className="border border-gray-300 p-2 w-24">Status</th><th className="border border-gray-300 p-2 w-48">Reviewed By (Operator)</th><th className="border border-gray-300 p-2 w-48">Approved By (Supervisor)</th><th className="border border-gray-300 p-2 w-48">Remarks</th></tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-300 p-2 align-top text-center"><input type="text" className="w-full border p-2 rounded bg-gray-100 cursor-not-allowed text-center font-bold text-gray-700" value={sNo} readOnly title="Auto-generated" /></td>
                      <td className="border border-gray-300 p-0 relative bg-gray-50"><input type="text" className="absolute inset-0 w-full h-full text-center text-sm font-bold bg-transparent outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-400" placeholder="No..." value={errorProofNo} onChange={(e) => setErrorProofNo(e.target.value)} /></td>
                      <td className="border border-gray-300 p-0 relative bg-gray-50"><textarea className="absolute inset-0 w-full h-full p-2 text-sm font-bold bg-transparent outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder:text-gray-400" placeholder="Describe problem..." value={problem} onChange={(e) => setProblem(e.target.value)} /></td>
                      <td className="border border-gray-300 p-0 relative bg-gray-50"><textarea className="absolute inset-0 w-full h-full p-2 text-sm font-bold bg-transparent outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder:text-gray-400" placeholder="Root cause..." value={rootCause} onChange={(e) => setRootCause(e.target.value)} /></td>
                      <td className="border border-gray-300 p-0 relative bg-gray-50"><textarea className="absolute inset-0 w-full h-full p-2 text-sm font-bold bg-transparent outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder:text-gray-400" placeholder="Action taken..." value={correctiveAction} onChange={(e) => setCorrectiveAction(e.target.value)} /></td>
                      <td className="border border-gray-300 p-0 relative bg-gray-50"><input type="text" className="absolute inset-0 w-full h-full text-center text-sm font-bold bg-yellow-50 text-yellow-700 cursor-not-allowed outline-none" value={status} readOnly /></td>

                      <td className="border border-gray-300 p-0 align-top relative bg-gray-50">
                        <TableSearchableSelect options={operatorList} displayKey="name" value={reviewedByReaction} onSelect={setReviewedByReaction} placeholder="Operator Name..." />
                      </td>

                      <td className="border border-gray-300 p-0 align-top relative bg-gray-50">
                        <TableSearchableSelect options={supervisorList} displayKey="name" value={approvedBy} onSelect={setApprovedBy} placeholder="Supervisor Name..." />
                      </td>

                      <td className="border border-gray-300 p-0 relative bg-gray-50"><textarea className="absolute inset-0 w-full h-full p-2 text-sm font-bold bg-transparent outline-none focus:ring-2 focus:ring-orange-500 resize-none placeholder:text-gray-400" placeholder="Remarks..." value={remarks} onChange={(e) => setRemarks(e.target.value)} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="mt-8 pt-8 border-t-2 border-gray-200 flex justify-end gap-8 bg-gray-50 p-6 rounded-lg">
            <div className="w-full md:w-1/3 flex flex-col gap-4">
              <div>
                <label className="text-xs font-black text-gray-700 uppercase mb-2 block">Assign HOF for Verification</label>
                <select value={assignedHOF} onChange={(e) => setAssignedHOF(e.target.value)} className="w-full p-3 border-2 border-gray-400 bg-white rounded-lg font-bold text-gray-800 outline-none focus:border-blue-500">
                  <option value="">Select HOF...</option>
                  {hofList.map((hof, i) => <option key={i} value={hof.name}>{hof.name}</option>)}
                </select>
              </div>

              <div className="flex gap-4">
                <button onClick={handleGenerateReport} className="w-1/2 bg-gray-800 hover:bg-gray-900 text-white py-3 rounded font-bold transition-colors shadow-md flex justify-center items-center gap-2">
                  <FileDown size={18} /> Preview PDF
                </button>
                <button onClick={handleSubmit} className={`w-1/2 ${isEditMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-500 hover:bg-orange-600'} text-white py-3 rounded font-bold transition-colors shadow-lg flex justify-center items-center gap-2`}>
                  <Save size={18} /> {isEditMode ? 'Update & Assign' : 'Save & Assign'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default ErrorProofVerification;