import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader, AlertTriangle, CheckCircle, Save, X, ChevronDown } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

const DISA_MACHINES = ['DISA - I', 'DISA - II', 'DISA - III', 'DISA - IV', 'DISA - V', 'DISA - VI'];

// Helper: axios instance with JWT token always attached
// Capture real axios methods FIRST to avoid infinite recursion
const _get = axios.get.bind(axios);
const _post = axios.post.bind(axios);
const _put = axios.put.bind(axios);

const authAxios = {
    get: (url, config = {}) => {
        const token = localStorage.getItem('token');
        return _get(url, { ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` } });
    },
    post: (url, data, config = {}) => {
        const token = localStorage.getItem('token');
        return _post(url, data, { ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` } });
    },
    put: (url, data, config = {}) => {
        const token = localStorage.getItem('token');
        return _put(url, data, { ...config, headers: { ...(config.headers || {}), Authorization: `Bearer ${token}` } });
    },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Small helpers
// ─────────────────────────────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => {
    useEffect(() => {
        if (msg) { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }
    }, [msg, onClose]);
    if (!msg) return null;
    const colors = {
        loading: 'bg-[#ff9100]/10 border-[#ff9100]/40 text-[#ff9100]',
        success: 'bg-green-500/10 border-green-500/30 text-green-300',
        error: 'bg-red-500/10 border-red-500/30 text-red-300',
    };
    const Icon = type === 'loading' ? Loader : type === 'success' ? CheckCircle : AlertTriangle;
    return (
        <div className="fixed top-6 right-6 z-[300]">
            <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border backdrop-blur-md shadow-2xl ${colors[type]}`}>
                <Icon className={`w-5 h-5 flex-shrink-0 ${type === 'loading' ? 'animate-spin' : ''}`} />
                <span className="text-sm font-bold">{msg}</span>
                {type !== 'loading' && <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={14} /></button>}
            </div>
        </div>
    );
};

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
        <button onClick={onClick}
            className="flex items-center gap-2 bg-[#ff9100] hover:bg-orange-500 text-white font-black text-sm uppercase tracking-wider px-6 py-3 rounded-xl transition-colors shadow-[0_0_20px_rgba(255,145,0,0.3)] active:scale-95">
            <Save size={16} /> Save All Changes
        </button>
    </div>
);

// 🔥 NEW: Table UI Wrapper for Disamatic Arrays 🔥
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


// ─────────────────────────────────────────────────────────────────────────────
//  FORM EDITORS
// ─────────────────────────────────────────────────────────────────────────────

/* 1. UNPOURED MOULD DETAILS */
const UnpouredEditor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const BASE_COLS = [
        { key: 'patternChange', label: 'Pattern Change' }, { key: 'heatCodeChange', label: 'Heat Code Change' },
        { key: 'mouldBroken', label: 'Mould Broken' }, { key: 'amcCleaning', label: 'AMC Cleaning' },
        { key: 'mouldCrush', label: 'Mould Crush' }, { key: 'coreFalling', label: 'Core Falling' },
        { key: 'sandDelay', label: 'Sand Delay' }, { key: 'drySand', label: 'Dry Sand' },
        { key: 'nozzleChange', label: 'Nozzle Change' }, { key: 'nozzleLeakage', label: 'Nozzle Leakage' },
        { key: 'spoutPocking', label: 'Spout Pocking' }, { key: 'stRod', label: 'ST Rod' },
        { key: 'qcVent', label: 'QC Vent' }, { key: 'outMould', label: 'Out Mould' },
        { key: 'lowMg', label: 'Low Mg' }, { key: 'gradeChange', label: 'Grade Change' },
        { key: 'msiProblem', label: 'MSI Problem' }, { key: 'brakeDown', label: 'Brake Down' },
        { key: 'wom', label: 'WOM' }, { key: 'devTrail', label: 'Dev Trail' },
        { key: 'powerCut', label: 'Power Cut' }, { key: 'plannedOff', label: 'Planned Off' },
        { key: 'vatCleaning', label: 'Vat Cleaning' }, { key: 'others', label: 'Others' }
    ];

    useEffect(() => {
        setLoading(true);
        authAxios.get(`${API_BASE}/unpoured-moulds/details`, { params: { date, disa } })
            .then(r => setData(r.data))
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const setShiftField = (shift, field, val) =>
        setData(prev => ({
            ...prev,
            shiftsData: {
                ...prev.shiftsData,
                [shift]: { ...prev.shiftsData[shift], [field]: val }
            }
        }));

    const setCustom = (shift, colId, val) =>
        setData(prev => ({
            ...prev,
            shiftsData: {
                ...prev.shiftsData,
                [shift]: {
                    ...prev.shiftsData[shift],
                    customValues: { ...(prev.shiftsData[shift]?.customValues || {}), [colId]: val }
                }
            }
        }));

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            const payloadData = { ...data.shiftsData };
            [1, 2, 3].forEach(shift => {
                let total = 0;
                BASE_COLS.forEach(c => total += parseInt(payloadData[shift][c.key]) || 0);
                if (payloadData[shift].customValues) {
                    Object.values(payloadData[shift].customValues).forEach(v => total += parseInt(v) || 0);
                }
                payloadData[shift].rowTotal = total;
            });

            await authAxios.post(`${API_BASE}/unpoured-moulds/save`, { date, disa, shiftsData: payloadData });
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data) return <NoData />;

    return (
        <div className="space-y-6">
            {[1, 2, 3].map(shift => (
                <div key={shift} className="bg-[#2a2a2a] border border-white/10 rounded-xl p-4">
                    <h3 className="text-base font-black text-[#ff9100] uppercase tracking-wider mb-3">Shift {shift}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {BASE_COLS.map(c => (
                            <Field key={c.key} label={c.label} value={data.shiftsData[shift]?.[c.key] ?? ''}
                                onChange={val => setShiftField(shift, c.key, val)} type="number" />
                        ))}
                        {(data.masterCols || []).map(c => (
                            <Field key={c.key} label={c.label} value={data.shiftsData[shift]?.customValues?.[c.id] ?? ''}
                                onChange={v => setCustom(shift, c.id, v)} type="number" />
                        ))}
                    </div>
                </div>
            ))}
            <SaveButton onClick={handleSave} />
        </div>
    );
};

/* 2. DMM SETTING PARAMETERS */
const DmmEditor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        authAxios.get(`${API_BASE}/dmm-settings/details`, { params: { date, disa } })
            .then(r => setData(r.data))
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const setRow = (shift, rowIdx, field, val) =>
        setData(prev => {
            const rows = [...(prev.shiftsData[shift] || [])];
            rows[rowIdx] = { ...rows[rowIdx], [field]: val };
            return { ...prev, shiftsData: { ...prev.shiftsData, [shift]: rows } };
        });

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            await authAxios.post(`${API_BASE}/dmm-settings/save`, { date, disa, shiftsData: data.shiftsData, shiftsMeta: data.shiftsMeta });
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data) return <NoData />;

    const BASE_COLS = ['Customer', 'ItemDescription', 'Time', 'PpThickness', 'PpHeight', 'SpThickness', 'SpHeight','CoreMaskThickness',
        'CoreMaskOut', 'CoreMaskIn', 'SandShotPressure', 'CorrectionShotTime', 'SqueezePressure',
        'PpStripAccel', 'PpStripDist', 'SpStripAccel', 'SpStripDist', 'MouldThickness', 'CloseUpForce', 'Remarks'];

    return (
        <div className="space-y-6">
            {[1, 2, 3].map(shift => (
                <div key={shift} className="bg-[#2a2a2a] border border-white/10 rounded-xl p-4">
                    <h3 className="text-base font-black text-[#ff9100] uppercase tracking-wider mb-3">Shift {shift}</h3>
                    {(data.shiftsData[shift] || []).map((row, ri) => (
                        <div key={ri} className="mb-4 border border-white/5 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-white/30 uppercase mb-2">Row {ri + 1}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {BASE_COLS.map(col => (
                                    <Field key={col} label={col.replace(/([A-Z])/g, ' $1')} value={row[col] || ''}
                                        onChange={val => setRow(shift, ri, col, val)} />
                                ))}
                                {row.customValues && Object.entries(row.customValues).map(([cId, cv]) => (
                                    <Field key={cId} label={`Custom ${cId}`} value={cv || ''}
                                        onChange={v => setRow(shift, ri, 'customValues', { ...row.customValues, [cId]: v })} />
                                ))}
                            </div>
                        </div>
                    ))}
                    {(!data.shiftsData[shift] || data.shiftsData[shift].length === 0) &&
                        <p className="text-white/30 text-sm italic">No rows for this shift.</p>}
                </div>
            ))}
            <SaveButton onClick={handleSave} />
        </div>
    );
};


/* 3. DISA OPERATOR CHECKLIST */
const DisaChecklistEditor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [reportsMap, setReportsMap] = useState({});
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalItem, setModalItem] = useState(null);
    const [ncForm, setNcForm] = useState({ ncDetails: '', correction: '', rootCause: '', correctiveAction: '', targetDate: date, responsibility: '', sign: '', status: 'Pending' });

    useEffect(() => {
        setLoading(true);
        authAxios.get(`${API_BASE}/disa-checklist/details`, { params: { date, disaMachine: disa } })
            .then(res => {
                const cl = res.data.checklist.map(item => ({
                    ...item,
                    IsDone: item.IsDone === true || item.IsDone === 1,
                    IsHoliday: item.IsHoliday === true || item.IsHoliday === 1,
                    IsVatCleaning: item.IsVatCleaning === true || item.IsVatCleaning === 1,
                    IsPreventiveMaintenance: item.IsPreventiveMaintenance === true || item.IsPreventiveMaintenance === 1, // Added PM Mapping
                    ReadingValue: item.ReadingValue || ''
                }));
                setData({ checklist: cl, originalData: res.data });

                const rMap = {};
                (res.data.reports || []).forEach(r => { rMap[r.MasterId] = r; });
                setReportsMap(rMap);
            })
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const setItem = (idx, field, val) =>
        setData(prev => {
            const cl = [...prev.checklist];
            cl[idx] = { ...cl[idx], [field]: val };
            return { ...prev, checklist: cl };
        });

    const handleOkClick = (item, idx) => {
        setItem(idx, 'IsDone', !item.IsDone);
    };

    const handleReadingChange = (idx, value) => {
        setData(prev => {
            const cl = [...prev.checklist];
            cl[idx] = { ...cl[idx], ReadingValue: value, IsDone: value !== '' };
            return { ...prev, checklist: cl };
        });
    };

    const handleNotOkClick = (item) => {
        setModalItem(item);
        const existingReport = reportsMap[item.MasterId];
        if (existingReport) {
            setNcForm({
                ncDetails: existingReport.NonConformityDetails, correction: existingReport.Correction,
                rootCause: existingReport.RootCause, correctiveAction: existingReport.CorrectiveAction,
                targetDate: existingReport.TargetDate.split('T')[0], responsibility: existingReport.Responsibility,
                sign: existingReport.Sign, status: existingReport.Status
            });
        } else {
            setNcForm({ ncDetails: '', correction: '', rootCause: '', correctiveAction: '', targetDate: date, responsibility: '', sign: '', status: 'Pending' });
        }
        setIsModalOpen(true);
    };

    const submitReport = async () => {
        if (!ncForm.ncDetails || !ncForm.responsibility) return setToast({ msg: 'Details and Responsibility are mandatory.', type: 'error' });
        try {
            await authAxios.post(`${API_BASE}/disa-checklist/report-nc`, {
                checklistId: modalItem.MasterId, slNo: modalItem.SlNo, reportDate: date, disaMachine: disa, ...ncForm
            });
            setToast({ msg: 'NC Report Logged Successfully.', type: 'success' });
            setIsModalOpen(false);
            setReportsMap(prev => ({ ...prev, [modalItem.MasterId]: { ...ncForm, MasterId: modalItem.MasterId, Status: 'Pending', Name: ncForm.sign } }));

            const idx = data.checklist.findIndex(c => c.MasterId === modalItem.MasterId);
            if (idx !== -1) {
                setItem(idx, 'IsDone', false);
                setItem(idx, 'ReadingValue', '');
            }
        } catch (error) { setToast({ msg: 'Failed to save report.', type: 'error' }); }
    };

    const handleMasterHolidayToggle = (checked) => {
        setData(prev => ({
            ...prev, checklist: prev.checklist.map(c => ({ ...c, IsHoliday: checked, IsVatCleaning: checked ? false : c.IsVatCleaning, IsPreventiveMaintenance: checked ? false : c.IsPreventiveMaintenance, IsDone: checked ? false : c.IsDone, ReadingValue: checked ? '' : c.ReadingValue }))
        }));
    };

    const handleMasterVatToggle = (checked) => {
        setData(prev => ({
            ...prev, checklist: prev.checklist.map(c => ({ ...c, IsVatCleaning: checked, IsHoliday: checked ? false : c.IsHoliday, IsPreventiveMaintenance: checked ? false : c.IsPreventiveMaintenance, IsDone: checked ? false : c.IsDone, ReadingValue: checked ? '' : c.ReadingValue }))
        }));
    };

    // Added PM Master Toggle
    const handleMasterPMToggle = (checked) => {
        setData(prev => ({
            ...prev, checklist: prev.checklist.map(c => ({ ...c, IsPreventiveMaintenance: checked, IsHoliday: checked ? false : c.IsHoliday, IsVatCleaning: checked ? false : c.IsVatCleaning, IsDone: checked ? false : c.IsDone, ReadingValue: checked ? '' : c.ReadingValue }))
        }));
    };

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            const itemsToSave = data.checklist.map(item => ({
                MasterId: item.MasterId, IsDone: item.IsDone, IsHoliday: item.IsHoliday, IsVatCleaning: item.IsVatCleaning, IsPreventiveMaintenance: item.IsPreventiveMaintenance, ReadingValue: item.ReadingValue || ''
            }));
            await authAxios.post(`${API_BASE}/disa-checklist/submit-batch`, {
                items: itemsToSave, sign: data.originalData.checklist[0]?.AssignedHOD || '',
                date, disaMachine: disa, operatorSignature: data.originalData.checklist[0]?.OperatorSignature || ''
            });
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data || data.checklist.length === 0) return <NoData />;

    const isGlobalHoliday = data.checklist.every(i => i.IsHoliday);
    const isGlobalVatCleaning = data.checklist.every(i => i.IsVatCleaning);
    const isGlobalPM = data.checklist.every(i => i.IsPreventiveMaintenance);

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#2a2a2a]">
                <table className="w-full text-sm text-white text-left">
                    <thead className="bg-[#222] border-b border-white/10">
                        <tr>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50 w-12">#</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50 w-1/3">Check Point</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50">Method</th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50 w-24">OK / Value</th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50 w-20">Not OK</th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50 w-20">
                                Holiday<br />
                                <input type="checkbox" checked={isGlobalHoliday} onChange={e => handleMasterHolidayToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-[#ff9100] cursor-pointer" />
                            </th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50 w-24 border-l border-white/5">
                                VAT Cleaning<br />
                                <input type="checkbox" checked={isGlobalVatCleaning} onChange={e => handleMasterVatToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-blue-600 cursor-pointer" />
                            </th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50 w-24 border-l border-white/5">
                                Prev. Maint.<br />
                                <input type="checkbox" checked={isGlobalPM} onChange={e => handleMasterPMToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-purple-600 cursor-pointer" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.checklist.map((item, i) => {
                            const hasReport = !!reportsMap[item.MasterId];
                            const isDisabled = item.IsHoliday || item.IsVatCleaning || item.IsPreventiveMaintenance; // Updated Condition
                            const isDecimalRow = item.SlNo === 1 || item.SlNo === 2 || item.SlNo === 17;

                            return (
                                <tr key={item.MasterId} className={`border-b border-white/5 transition-colors ${hasReport ? 'bg-red-900/20' : isDisabled ? 'bg-black/20 opacity-60' : 'hover:bg-white/5'}`}>
                                    <td className="p-3 text-white/40 font-bold">{item.SlNo}</td>
                                    <td className={`p-3 font-bold ${isDisabled ? 'text-white/40 line-through' : 'text-white/90'}`}>{item.CheckPointDesc}</td>
                                    <td className="p-3"><span className={`border border-white/10 text-[10px] font-bold px-2 py-1 rounded uppercase ${isDisabled ? 'text-white/30' : 'text-white/60 bg-black/20'}`}>{item.CheckMethod}</span></td>

                                    <td className="p-3 text-center">
                                        {isDecimalRow ? (
                                            <input type="number" step="0.01" value={item.ReadingValue || ''} onChange={e => handleReadingChange(i, e.target.value)} disabled={isDisabled || hasReport} placeholder="0.00"
                                                className={`w-16 mx-auto text-center border border-white/10 rounded text-xs font-bold py-1 outline-none transition-colors ${isDisabled || hasReport ? 'bg-black/20 text-white/30 cursor-not-allowed' : 'bg-[#333] text-white focus:border-[#ff9100]'}`} />
                                        ) : (
                                            <div onClick={() => !isDisabled && !hasReport && handleOkClick(item, i)} className={`w-6 h-6 mx-auto rounded border flex items-center justify-center transition-all ${isDisabled ? 'cursor-not-allowed border-white/10 bg-black/20' : 'cursor-pointer'} ${item.IsDone && !hasReport && !isDisabled ? 'bg-green-500 border-green-500 text-white' : 'border-white/20 bg-[#333]'} ${hasReport ? 'opacity-20 cursor-not-allowed' : ''}`}>
                                                {item.IsDone && !hasReport && !isDisabled && "✓"}
                                            </div>
                                        )}
                                    </td>

                                    <td className="p-3 text-center">
                                        <div onClick={() => !isDisabled && handleNotOkClick(item)} className={`w-6 h-6 mx-auto rounded border flex items-center justify-center transition-all ${isDisabled ? 'cursor-not-allowed border-white/10 bg-black/20' : 'cursor-pointer hover:border-red-500'} ${hasReport && !isDisabled ? 'bg-red-600 border-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'border-white/20 bg-[#333]'}`}>
                                            {hasReport && !isDisabled && "✕"}
                                        </div>
                                    </td>

                                    <td className="p-3 text-center border-l border-white/5 bg-black/10">
                                        <input type="checkbox" checked={item.IsHoliday || false} readOnly disabled className="w-5 h-5 accent-[#ff9100] cursor-not-allowed opacity-70" />
                                    </td>

                                    <td className="p-3 text-center bg-black/10">
                                        <input type="checkbox" checked={item.IsVatCleaning || false} readOnly disabled className="w-5 h-5 accent-blue-600 cursor-not-allowed opacity-70" />
                                    </td>
                                    
                                    <td className="p-3 text-center bg-black/10 border-l border-white/5">
                                        <input type="checkbox" checked={item.IsPreventiveMaintenance || false} readOnly disabled className="w-5 h-5 accent-purple-600 cursor-not-allowed opacity-70" />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isModalOpen && modalItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
                    {/* ... (Modal stays exactly the same) ... */}
                    <div className="bg-[#2a2a2a] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="bg-red-600 p-5 flex justify-between items-center text-white">
                            <div><h3 className="font-bold uppercase text-sm tracking-wider">Non-Conformance Report</h3><p className="text-xs opacity-80 mt-1">Checkpoint #{modalItem.SlNo}</p></div>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-red-700 rounded-full p-1 transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/30 flex justify-between items-center">
                                <p className="font-bold text-red-200">{modalItem.CheckPointDesc}</p>
                                <span className="text-[10px] bg-[#ff9100]/20 text-[#ff9100] border border-[#ff9100]/50 px-2 py-1 rounded font-black uppercase tracking-wider">{ncForm.status}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2"><Field label="NC Details" value={ncForm.ncDetails} onChange={v => setNcForm({ ...ncForm, ncDetails: v })} multiline /></div>
                                <Field label="Correction" value={ncForm.correction} onChange={v => setNcForm({ ...ncForm, correction: v })} />
                                <Field label="Root Cause" value={ncForm.rootCause} onChange={v => setNcForm({ ...ncForm, rootCause: v })} />
                                <div className="col-span-2"><Field label="Corrective Action" value={ncForm.correctiveAction} onChange={v => setNcForm({ ...ncForm, correctiveAction: v })} multiline /></div>
                                <Field label="Responsibility" value={ncForm.responsibility} onChange={v => setNcForm({ ...ncForm, responsibility: v })} options={['Maintenance', 'Production', 'Quality']} />
                                <Field label="Target Date" type="date" value={ncForm.targetDate} onChange={v => setNcForm({ ...ncForm, targetDate: v })} />
                            </div>
                            <div className="pt-4 border-t border-white/10">
                                <button onClick={submitReport} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg uppercase tracking-widest shadow-lg transition-colors">Save NC Report</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SaveButton onClick={handleSave} />
        </div>
    );
};

/* 4. ERROR PROOF VERIFICATION */
const ErrorProofEditor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        // Uses error-proof2 dynamically
        authAxios.get(`${API_BASE}/error-proof2/details`, { params: { date, machine: disa } })
            .then(r => {
                const resData = r.data;
                const verifications = resData.verifications || [];
                const reactionPlans = resData.reactionPlans || [];
                const first = verifications[0] || {};

                setData({
                    verifications,
                    reactionPlans,
                    headerDetails: {
                        reviewedBy: first.ReviewedByHOF || '',
                        approvedBy: first.ApprovedBy || '',
                        assignedHOF: first.AssignedHOF || ''
                    },
                    operatorSignature: first.OperatorSignature || ''
                });
            })
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const setVer = (idx, field, val) =>
        setData(prev => {
            const v = [...prev.verifications];
            v[idx] = { ...v[idx], [field]: val };
            return { ...prev, verifications: v };
        });

    const setPlan = (idx, field, val) =>
        setData(prev => {
            const p = [...prev.reactionPlans];
            p[idx] = { ...p[idx], [field]: val };
            return { ...prev, reactionPlans: p };
        });

    const setHeader = (field, val) =>
        setData(prev => ({
            ...prev,
            headerDetails: { ...prev.headerDetails, [field]: val }
        }));

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            await authAxios.post(`${API_BASE}/error-proof2/bulk-update`, {
                verifications: data.verifications,
                reactionPlans: data.reactionPlans,
            });
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data || data.verifications.length === 0) return <NoData msg={`No error proof records for ${disa} on ${date}.`} />;

    const RESULTS = ['', 'OK', 'NOT OK'];
    const STATUSES = ['Pending', 'Completed'];

    return (
        <div className="space-y-6">
            {/* 1. Verifications Table */}
            <div className="bg-[#2a2a2a] border border-white/10 rounded-xl p-5 shadow-lg overflow-x-auto">
                <SectionHeader title="Verification Checklist" />
                <table className="w-full text-sm text-white mt-4 min-w-[600px]">
                    <thead className="bg-[#111] text-xs uppercase text-white/50">
                        <tr>
                            <th className="p-3 text-left">Error Proof Name</th>
                            <th className="p-3 text-left">Nature</th>
                            <th className="p-3 text-center">Freq</th>
                            <th className="p-3 text-center w-24">Shift 1</th>
                            <th className="p-3 text-center w-24">Shift 2</th>
                            <th className="p-3 text-center w-24">Shift 3</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.verifications.map((v, i) => (
                            <tr key={v.Id || i} className="hover:bg-white/5 transition-colors">
                                <td className="p-3 font-bold">{v.ErrorProofName}</td>
                                <td className="p-3 text-white/70">{v.NatureOfErrorProof}</td>
                                <td className="p-3 text-center">{v.Frequency}</td>
                                {['Date1_Shift1_Res', 'Date1_Shift2_Res', 'Date1_Shift3_Res'].map(field => (
                                    <td key={field} className="p-2">
                                        <select value={v[field] || ''} onChange={e => setVer(i, field, e.target.value)}
                                            className="w-full bg-[#333] border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff9100]">
                                            {RESULTS.map(r => <option key={r} value={r}>{r || '—'}</option>)}
                                        </select>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 2. Reaction Plans Table */}
            {data.reactionPlans.length > 0 && (
                <div className="bg-[#2a2a2a] border border-white/10 rounded-xl p-5 shadow-lg overflow-x-auto">
                    <SectionHeader title="Reaction Plans (Not OK Issues)" />
                    <table className="w-full text-sm text-white mt-4 min-w-[900px]">
                        <thead className="bg-[#111] text-xs uppercase text-white/50">
                            <tr>
                                <th className="p-3">Error Proof Name</th>
                                <th className="p-3 w-20">Shift</th>
                                <th className="p-3">Problem</th>
                                <th className="p-3">Root Cause</th>
                                <th className="p-3">Corrective Action</th>
                                <th className="p-3 w-32">Status</th>
                                <th className="p-3">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.reactionPlans.map((rp, i) => (
                                <tr key={rp.Id || i} className="hover:bg-white/5 transition-colors">
                                    <td className="p-2 text-white/70 font-bold">{rp.ErrorProofName}</td>
                                    <td className="p-2 text-center text-orange-400 font-bold">{rp.VerificationDateShift}</td>
                                    <td className="p-2"><input value={rp.Problem || ''} onChange={e => setPlan(i, 'Problem', e.target.value)} className="w-full bg-[#333] border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-[#ff9100]" /></td>
                                    <td className="p-2"><input value={rp.RootCause || ''} onChange={e => setPlan(i, 'RootCause', e.target.value)} className="w-full bg-[#333] border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-[#ff9100]" /></td>
                                    <td className="p-2"><input value={rp.CorrectiveAction || ''} onChange={e => setPlan(i, 'CorrectiveAction', e.target.value)} className="w-full bg-[#333] border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-[#ff9100]" /></td>
                                    <td className="p-2">
                                        <select value={rp.Status || 'Pending'} onChange={e => setPlan(i, 'Status', e.target.value)} className="w-full bg-[#333] border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#ff9100]">
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2"><input value={rp.Remarks || ''} onChange={e => setPlan(i, 'Remarks', e.target.value)} className="w-full bg-[#333] border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-[#ff9100]" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 3. Header Details & Supervisors */}
            <div className="bg-[#2a2a2a] border border-white/10 rounded-xl p-5 shadow-lg">
                <SectionHeader title="Supervisor Details & HOF Assignment" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                    <Field label="Assigned HOF" value={data.headerDetails.assignedHOF} onChange={v => setHeader('assignedHOF', v)} />
                    <Field label="Reviewed By (HOF)" value={data.headerDetails.reviewedBy} onChange={v => setHeader('reviewedBy', v)} />
                    <Field label="Approved By (Supervisor)" value={data.headerDetails.approvedBy} onChange={v => setHeader('approvedBy', v)} />
                </div>
            </div>

            <SaveButton onClick={handleSave} />
        </div>
    );
};

/* 4B. ERROR PROOF VERIFICATION V1 */
const ErrorProofV1Editor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    // newPlans: keyed by verification id, holds new reaction plan fields for newly-NOT_OK rows
    const [newPlans, setNewPlans] = useState({});

    useEffect(() => {
        setLoading(true);
        authAxios.get(`${API_BASE}/error-proof/v1-by-date`, { params: { date } })
            .then(r => {
                const resData = r.data || {};
                setData({
                    verifications: resData.verifications || [],
                    reactionPlans: resData.reactionPlans || [],
                });
            })
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date]);

    const setVer = (idx, field, val) => {
        const v = [...data.verifications];
        v[idx] = { ...v[idx], [field]: val };
        // When changing to OK — clear new plan form AND remove existing reaction plans for this proof
        if (field === 'observationResult' && val !== 'NOT_OK') {
            const key = v[idx].id || idx;
            const proofName = v[idx].errorProofName;
            setNewPlans(p => { const n = { ...p }; delete n[key]; return n; });
            // Remove existing DB reaction plans for this proof name from the view
            setData(prev => ({
                ...prev,
                verifications: v,
                reactionPlans: prev.reactionPlans.filter(rp => rp.errorProofName !== proofName),
                _deletedProofNames: [...(prev._deletedProofNames || []), proofName],
            }));
            return;
        }
        // When changing TO NOT_OK, initialize an empty plan form if not already present
        if (field === 'observationResult' && val === 'NOT_OK') {
            const key = v[idx].id || idx;
            if (!newPlans[key]) {
                setNewPlans(p => ({
                    ...p,
                    [key]: {
                        errorProofNo: '', problem: '', rootCause: '',
                        correctiveAction: '', status: 'Pending',
                        reviewedBy: '', approvedBy: '', remarks: '',
                        _verIdx: idx
                    }
                }));
            }
        }
        setData(prev => ({ ...prev, verifications: v }));
    };

    const setPlan = (idx, field, val) => {
        const p = [...data.reactionPlans];
        p[idx] = { ...p[idx], [field]: val };
        setData(prev => ({ ...prev, reactionPlans: p }));
    };

    const setNewPlan = (key, field, val) => {
        setNewPlans(p => ({ ...p, [key]: { ...p[key], [field]: val } }));
    };

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            // 1. Update observation results + delete reaction plans for OK verifications
            await authAxios.post(`${API_BASE}/error-proof/bulk-update`, {
                verifications: data.verifications,
                reactionPlans: data.reactionPlans,
                deletedProofNames: data._deletedProofNames || [],
                date,
            });

            // 2. Insert NEW reaction plans for newly-NOT_OK rows
            const snoRes = await authAxios.get(`${API_BASE}/error-proof/next-sno`);
            let sNo = snoRes.data.nextSNo || 1;

            for (const [key, plan] of Object.entries(newPlans)) {
                const ver = data.verifications[plan._verIdx];
                if (!ver) continue;
                await authAxios.post(`${API_BASE}/error-proof/add-reaction`, {
                    sNo, errorProofNo: plan.errorProofNo,
                    errorProofName: ver.errorProofName,
                    recordDate: date, shift: ver.shift,
                    problem: plan.problem, rootCause: plan.rootCause,
                    correctiveAction: plan.correctiveAction,
                    status: plan.status,
                    reviewedBy: plan.reviewedBy, approvedBy: plan.approvedBy,
                    remarks: plan.remarks
                });
                sNo++;
            }

            setToast({ msg: 'Saved successfully!', type: 'success' });
            setNewPlans({});
            // Reload to reflect saved state
            setLoading(true);
            const r = await authAxios.get(`${API_BASE}/error-proof/v1-by-date`, { params: { date } });
            setData({ verifications: r.data.verifications || [], reactionPlans: r.data.reactionPlans || [] });
            setLoading(false);
        } catch (e) {
            setToast({ msg: 'Save failed', type: 'error' });
            setLoading(false);
        }
    };

    if (loading) return <CenteredLoader />;
    if (!data || data.verifications.length === 0) return <NoData msg={`No V1 error proof records found on ${date}.`} />;

    const RESULTS = ['', 'OK', 'NOT_OK'];
    const STATUSES = ['Pending', 'Completed'];
    const inp = "w-full bg-[#333] border border-white/10 rounded px-2 py-1.5 text-sm text-white focus:border-[#ff9100] outline-none";

    return (
        <div className="space-y-6">
            {/* 1. Verifications Table */}
            <div className="bg-[#2a2a2a] border border-white/10 rounded-xl p-5 shadow-lg overflow-x-auto">
                <SectionHeader title="Verification Checklist (V1)" />
                <table className="w-full text-sm text-white mt-4 min-w-[700px]">
                    <thead className="bg-[#111] text-xs uppercase text-white/50">
                        <tr>
                            <th className="p-3 text-left">Line</th>
                            <th className="p-3 text-left">Error Proof Name</th>
                            <th className="p-3 text-left">Nature</th>
                            <th className="p-3 text-center">Freq</th>
                            <th className="p-3 text-center">Shift</th>
                            <th className="p-3 text-center w-32">Result</th>
                            <th className="p-3 text-center">Verified By</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {data.verifications.map((v, i) => (
                            <tr key={v.id || i} className="hover:bg-white/5 transition-colors">
                                <td className="p-3 font-bold text-[#ff9100]">{v.line}</td>
                                <td className="p-3 font-bold">{v.errorProofName}</td>
                                <td className="p-3 text-white/70">{v.natureOfErrorProof}</td>
                                <td className="p-3 text-center">{v.frequency}</td>
                                <td className="p-3 text-center font-bold text-orange-400">{v.shift}</td>
                                <td className="p-2">
                                    <select
                                        value={v.observationResult || ''}
                                        onChange={e => setVer(i, 'observationResult', e.target.value)}
                                        className={`w-full bg-[#333] border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-[#ff9100] ${v.observationResult === 'NOT_OK' ? 'border-red-500 text-red-400' : v.observationResult === 'OK' ? 'border-green-500 text-green-400' : 'border-white/10 text-white'}`}>
                                        {RESULTS.map(r => <option key={r} value={r}>{r === 'NOT_OK' ? 'NOT OK' : r || '—'}</option>)}
                                    </select>
                                </td>
                                <td className="p-3 text-center">{v.verifiedBy}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 2. NEW Reaction Plan forms for newly-NOT_OK rows */}
            {Object.entries(newPlans).map(([key, plan]) => {
                const ver = data.verifications[plan._verIdx];
                if (!ver) return null;
                return (
                    <div key={key} className="bg-[#2a2a2a] border-2 border-red-500/40 rounded-xl p-5 shadow-lg overflow-x-auto">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="bg-red-500/20 text-red-400 text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full">NOT OK — Reaction Plan Required</span>
                            <span className="text-white/60 text-sm font-bold">{ver.errorProofName}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div><label className="text-xs text-white/50 uppercase font-bold mb-1 block">Error Proof No</label>
                                <input value={plan.errorProofNo} onChange={e => setNewPlan(key, 'errorProofNo', e.target.value)} placeholder="e.g. EP-01" className={inp} /></div>
                            <div><label className="text-xs text-white/50 uppercase font-bold mb-1 block">Problem</label>
                                <input value={plan.problem} onChange={e => setNewPlan(key, 'problem', e.target.value)} placeholder="Describe problem..." className={inp} /></div>
                            <div><label className="text-xs text-white/50 uppercase font-bold mb-1 block">Root Cause</label>
                                <input value={plan.rootCause} onChange={e => setNewPlan(key, 'rootCause', e.target.value)} placeholder="Root cause..." className={inp} /></div>
                            <div><label className="text-xs text-white/50 uppercase font-bold mb-1 block">Corrective Action</label>
                                <input value={plan.correctiveAction} onChange={e => setNewPlan(key, 'correctiveAction', e.target.value)} placeholder="Action taken..." className={inp} /></div>
                            <div><label className="text-xs text-white/50 uppercase font-bold mb-1 block">Reviewed By (Operator)</label>
                                <input value={plan.reviewedBy} onChange={e => setNewPlan(key, 'reviewedBy', e.target.value)} placeholder="Operator name..." className={inp} /></div>
                            <div><label className="text-xs text-white/50 uppercase font-bold mb-1 block">Approved By (Supervisor)</label>
                                <input value={plan.approvedBy} onChange={e => setNewPlan(key, 'approvedBy', e.target.value)} placeholder="Supervisor name..." className={inp} /></div>
                            <div><label className="text-xs text-white/50 uppercase font-bold mb-1 block">Remarks</label>
                                <input value={plan.remarks} onChange={e => setNewPlan(key, 'remarks', e.target.value)} placeholder="Remarks..." className={inp} /></div>
                            <div><label className="text-xs text-white/50 uppercase font-bold mb-1 block">Status</label>
                                <select value={plan.status} onChange={e => setNewPlan(key, 'status', e.target.value)} className={inp}>
                                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select></div>
                        </div>
                    </div>
                );
            })}

            {/* 3. Existing Reaction Plans (from DB) */}
            {data.reactionPlans.length > 0 && (
                <div className="bg-[#2a2a2a] border border-white/10 rounded-xl p-5 shadow-lg overflow-x-auto">
                    <SectionHeader title="Existing Reaction Plans" />
                    <table className="w-full text-sm text-white mt-4 min-w-[900px]">
                        <thead className="bg-[#111] text-xs uppercase text-white/50">
                            <tr>
                                <th className="p-3">Error Proof Name</th>
                                <th className="p-3 w-20">Shift</th>
                                <th className="p-3">Problem</th>
                                <th className="p-3">Root Cause</th>
                                <th className="p-3">Corrective Action</th>
                                <th className="p-3 w-32">Status</th>
                                <th className="p-3">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {data.reactionPlans.map((rp, i) => (
                                <tr key={rp.sNo || i} className="hover:bg-white/5 transition-colors">
                                    <td className="p-2 text-white/70 font-bold">{rp.errorProofName}</td>
                                    <td className="p-2 text-center text-orange-400 font-bold">{rp.shift}</td>
                                    <td className="p-2"><input value={rp.problem || ''} onChange={e => setPlan(i, 'problem', e.target.value)} className={inp} /></td>
                                    <td className="p-2"><input value={rp.rootCause || ''} onChange={e => setPlan(i, 'rootCause', e.target.value)} className={inp} /></td>
                                    <td className="p-2"><input value={rp.correctiveAction || ''} onChange={e => setPlan(i, 'correctiveAction', e.target.value)} className={inp} /></td>
                                    <td className="p-2">
                                        <select value={rp.status || 'Pending'} onChange={e => setPlan(i, 'status', e.target.value)} className={inp}>
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-2"><input value={rp.remarks || ''} onChange={e => setPlan(i, 'remarks', e.target.value)} className={inp} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <SaveButton onClick={handleSave} />
        </div>
    );
};

/* 5. DISA SETTING ADJUSTMENT */
const DisaSettingEditor = ({ date, toast, setToast }) => {
    const [records, setRecords] = useState([]);
    const [customCols, setCustomCols] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        authAxios.get(`${API_BASE}/disa/records`, { params: { fromDate: date, toDate: date } })
            .then(r => {
                const arr = Array.isArray(r.data) ? r.data : [];
                setRecords(arr);
                return authAxios.get(`${API_BASE}/disa/custom-columns`);
            })
            .then(r => setCustomCols(r.data || []))
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date]);

    const setField = (idx, field, val) =>
        setRecords(prev => { const r = [...prev]; r[idx] = { ...r[idx], [field]: val }; return r; });
    const setCustom = (idx, colId, val) =>
        setRecords(prev => {
            const r = [...prev];
            r[idx] = { ...r[idx], customValues: { ...(r[idx].customValues || {}), [colId]: val } };
            return r;
        });

    const handleSaveRow = async (rec) => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            await authAxios.put(`${API_BASE}/disa/records/${rec.id}`, rec);
            setToast({ msg: 'Record updated!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (records.length === 0) return <NoData msg="No DISA Setting Adjustment records for this date." />;

    return (
        <div className="space-y-6">
            {records.map((rec, idx) => (
                <div key={rec.id} className="bg-[#2a2a2a] border border-white/10 rounded-xl p-4">
                    <p className="text-[10px] font-black text-white/30 uppercase mb-3">Record #{rec.id}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        <Field label="Mould Count No" value={rec.mouldCountNo} onChange={v => setField(idx, 'mouldCountNo', v)} />
                        <Field label="Prev Mould Count No" value={rec.prevMouldCountNo} onChange={v => setField(idx, 'prevMouldCountNo', v)} />
                        <Field label="No of Moulds" value={rec.noOfMoulds} onChange={v => setField(idx, 'noOfMoulds', v)} type="number" />
                        <SectionHeader title="Work Details" />
                        <div className="col-span-2">
                            <Field label="Work Carried Out" value={rec.workCarriedOut} onChange={v => setField(idx, 'workCarriedOut', v)} />
                        </div>
                        <div className="col-span-2">
                            <Field label="Preventive Work" value={rec.preventiveWorkCarried} onChange={v => setField(idx, 'preventiveWorkCarried', v)} />
                        </div>
                        <div className="col-span-2">
                            <Field label="Remarks" value={rec.remarks} onChange={v => setField(idx, 'remarks', v)} />
                        </div>
                        {customCols.map(col => (
                            <Field key={col.id} label={col.columnName}
                                value={rec.customValues?.[col.id] || ''}
                                onChange={v => setCustom(idx, col.id, v)} />
                        ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                        <button onClick={() => handleSaveRow(rec)}
                            className="flex items-center gap-2 bg-[#ff9100] hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-colors shadow-lg">
                            <Save size={13} /> Save Record
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

/* 6. 4M CHANGE MONITORING */
const FourMEditor = ({ date, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        authAxios.get(`${API_BASE}/4m-change/records-by-date`, { params: { date } })
            .then(r => {
                if (Array.isArray(r.data)) setData({ records: [], customColumns: [] });
                else setData(r.data);
            })
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date]);

    const setField = (idx, field, val) =>
        setData(prev => {
            const r = [...prev.records];
            r[idx] = { ...r[idx], [field]: val };
            return { ...prev, records: r };
        });

    const handleSaveRow = async (rec) => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            await authAxios.put(`${API_BASE}/4m-change/records/${rec.id}`, rec);
            setToast({ msg: 'Row saved!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data || data.records.length === 0) return <NoData msg="No 4M Monitoring records found for this date." />;

    const FIELDS_4M = [
        { key: 'line', label: 'Line' }, { key: 'partName', label: 'Part Name' },
        { key: 'shift', label: 'Shift', options: ['I', 'II', 'III'] },
        { key: 'mcNo', label: 'M/C No' }, { key: 'type4M', label: 'Type of 4M' },
        { key: 'description', label: 'Description' }, { key: 'firstPart', label: 'First Part' },
        { key: 'lastPart', label: 'Last Part' }, { key: 'inspFreq', label: 'Insp Freq' },
        { key: 'retroChecking', label: 'Retro Checking', options: ['OK', 'Not OK', '-'] },
        { key: 'quarantine', label: 'Quarantine', options: ['OK', 'Not OK', '-'] },
        { key: 'partId', label: 'Part Ident', options: ['OK', 'Not OK', '-'] },
        { key: 'internalComm', label: 'Internal Comm', options: ['OK', 'Not OK', '-'] },
        { key: 'inchargeSign', label: 'Incharge Sign' }, { key: 'assignedHOD', label: 'Assigned HOD' },
    ];

    return (
        <div className="space-y-6">
            {data.records.map((rec, idx) => (
                <div key={rec.id} className="bg-[#2a2a2a] border border-white/10 rounded-xl p-4">
                    <p className="text-[10px] font-black text-white/30 uppercase mb-3">Record #{rec.id}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {FIELDS_4M.map(f => (
                            <Field key={f.key} label={f.label} value={rec[f.key] || ''}
                                options={f.options}
                                onChange={v => setField(idx, f.key, v)} />
                        ))}
                        {(data.customColumns || []).map(col => (
                            <Field key={col.id} label={col.columnName}
                                value={rec.customValues?.[col.id] || ''}
                                onChange={v => {
                                    const r = [...data.records];
                                    r[idx] = { ...r[idx], customValues: { ...r[idx].customValues, [col.id]: v } };
                                    setData(p => ({ ...p, records: r }));
                                }} />
                        ))}
                    </div>
                    <div className="mt-3 flex justify-end">
                        <button onClick={() => handleSaveRow(rec)}
                            className="flex items-center gap-2 bg-[#ff9100] hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-lg transition-colors shadow-lg">
                            <Save size={13} /> Save Row
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};


/* 7. LPA – Bottom Level Audit */
const LpaEditor = ({ date, disa, toast, setToast }) => {
    const [data, setData] = useState(null);
    const [reportsMap, setReportsMap] = useState({});
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalItem, setModalItem] = useState(null);
    const [ncForm, setNcForm] = useState({ ncDetails: '', correction: '', rootCause: '', correctiveAction: '', targetDate: date, responsibility: '', sign: '', status: 'Pending' });

    useEffect(() => {
        setLoading(true);
        authAxios.get(`${API_BASE}/bottom-level-audit/details`, { params: { date, disaMachine: disa } })
            .then(res => {
                const cl = res.data.checklist.map(item => ({
                    ...item,
                    IsDone: item.IsDone === true || item.IsDone === 1,
                    IsHoliday: item.IsHoliday === true || item.IsHoliday === 1,
                    IsVatCleaning: item.IsVatCleaning === true || item.IsVatCleaning === 1,
                    IsPreventiveMaintenance: item.IsPreventiveMaintenance === true || item.IsPreventiveMaintenance === 1, // Added PM Mapping
                    ReadingValue: item.ReadingValue || ''
                }));
                setData({ checklist: cl, originalData: res.data });

                const rMap = {};
                (res.data.reports || []).forEach(r => { rMap[r.MasterId] = r; });
                setReportsMap(rMap);
            })
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const setItem = (idx, field, val) =>
        setData(prev => {
            const cl = [...prev.checklist];
            cl[idx] = { ...cl[idx], [field]: val };
            return { ...prev, checklist: cl };
        });

    const handleOkClick = (item, idx) => {
        setItem(idx, 'IsDone', !item.IsDone);
    };

    const handleReadingChange = (idx, value) => {
        setData(prev => {
            const cl = [...prev.checklist];
            cl[idx] = { ...cl[idx], ReadingValue: value, IsDone: value !== '' };
            return { ...prev, checklist: cl };
        });
    };

    const handleNotOkClick = (item) => {
        setModalItem(item);
        const existingReport = reportsMap[item.MasterId];
        if (existingReport) {
            setNcForm({
                ncDetails: existingReport.NonConformityDetails, correction: existingReport.Correction,
                rootCause: existingReport.RootCause, correctiveAction: existingReport.CorrectiveAction,
                targetDate: existingReport.TargetDate.split('T')[0], responsibility: existingReport.Responsibility,
                sign: existingReport.Sign, status: existingReport.Status
            });
        } else {
            setNcForm({ ncDetails: '', correction: '', rootCause: '', correctiveAction: '', targetDate: date, responsibility: '', sign: '', status: 'Pending' });
        }
        setIsModalOpen(true);
    };

    const submitReport = async () => {
        if (!ncForm.ncDetails || !ncForm.responsibility) return setToast({ msg: 'Details and Responsibility are mandatory.', type: 'error' });
        try {
            await authAxios.post(`${API_BASE}/bottom-level-audit/report-nc`, {
                checklistId: modalItem.MasterId, slNo: modalItem.SlNo, reportDate: date, disaMachine: disa, ...ncForm
            });
            setToast({ msg: 'NC Report Logged Successfully.', type: 'success' });
            setIsModalOpen(false);
            setReportsMap(prev => ({ ...prev, [modalItem.MasterId]: { ...ncForm, MasterId: modalItem.MasterId, Status: 'Pending', Name: ncForm.sign } }));

            const idx = data.checklist.findIndex(c => c.MasterId === modalItem.MasterId);
            if (idx !== -1) {
                setItem(idx, 'IsDone', false);
                setItem(idx, 'ReadingValue', '');
            }
        } catch (error) { setToast({ msg: 'Failed to save report.', type: 'error' }); }
    };

    const handleMasterHolidayToggle = (checked) => {
        setData(prev => ({
            ...prev, checklist: prev.checklist.map(c => ({ ...c, IsHoliday: checked, IsVatCleaning: checked ? false : c.IsVatCleaning, IsPreventiveMaintenance: checked ? false : c.IsPreventiveMaintenance, IsDone: checked ? false : c.IsDone, ReadingValue: checked ? '' : c.ReadingValue }))
        }));
    };

    const handleMasterVatToggle = (checked) => {
        setData(prev => ({
            ...prev, checklist: prev.checklist.map(c => ({ ...c, IsVatCleaning: checked, IsHoliday: checked ? false : c.IsHoliday, IsPreventiveMaintenance: checked ? false : c.IsPreventiveMaintenance, IsDone: checked ? false : c.IsDone, ReadingValue: checked ? '' : c.ReadingValue }))
        }));
    };

    // Added PM Master Toggle
    const handleMasterPMToggle = (checked) => {
        setData(prev => ({
            ...prev, checklist: prev.checklist.map(c => ({ ...c, IsPreventiveMaintenance: checked, IsHoliday: checked ? false : c.IsHoliday, IsVatCleaning: checked ? false : c.IsVatCleaning, IsDone: checked ? false : c.IsDone, ReadingValue: checked ? '' : c.ReadingValue }))
        }));
    };

    const handleSave = async () => {
        setToast({ msg: 'Saving…', type: 'loading' });
        try {
            const itemsToSave = data.checklist.map(item => ({
                MasterId: item.MasterId, IsDone: item.IsDone, IsHoliday: item.IsHoliday, IsVatCleaning: item.IsVatCleaning, IsPreventiveMaintenance: item.IsPreventiveMaintenance, ReadingValue: item.ReadingValue || ''
            }));
            await authAxios.post(`${API_BASE}/bottom-level-audit/submit-batch`, {
                items: itemsToSave, sign: data.originalData.checklist[0]?.AssignedHOD || '',
                date, disaMachine: disa, operatorSignature: data.originalData.checklist[0]?.OperatorSignature || ''
            });
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!data || data.checklist.length === 0) return <NoData />;

    const isGlobalHoliday = data.checklist.every(i => i.IsHoliday);
    const isGlobalVatCleaning = data.checklist.every(i => i.IsVatCleaning);
    const isGlobalPM = data.checklist.every(i => i.IsPreventiveMaintenance); // Added PM Global Boolean

    return (
        <div className="space-y-4">
            <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#2a2a2a]">
                <table className="w-full text-sm text-white text-left">
                    <thead className="bg-[#222] border-b border-white/10">
                        <tr>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50 w-12">#</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50 w-1/3">Check Point</th>
                            <th className="p-3 text-[10px] uppercase tracking-widest text-white/50">Method</th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50 w-24">OK / Value</th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50 w-20">Not OK</th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50 w-20">
                                Holiday<br />
                                <input type="checkbox" checked={isGlobalHoliday} onChange={e => handleMasterHolidayToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-[#ff9100] cursor-pointer" />
                            </th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50 w-24 border-l border-white/5">
                                VAT Cleaning<br />
                                <input type="checkbox" checked={isGlobalVatCleaning} onChange={e => handleMasterVatToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-blue-600 cursor-pointer" />
                            </th>
                            <th className="p-3 text-center text-[10px] uppercase tracking-widest text-white/50 w-24 border-l border-white/5">
                                Prev. Maint.<br />
                                <input type="checkbox" checked={isGlobalPM} onChange={e => handleMasterPMToggle(e.target.checked)} className="w-4 h-4 mt-2 accent-purple-600 cursor-pointer" />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.checklist.map((item, i) => {
                            const hasReport = !!reportsMap[item.MasterId];
                            const isDisabled = item.IsHoliday || item.IsVatCleaning || item.IsPreventiveMaintenance; // Updated condition
                            const isDecimalRow = item.SlNo === 1 || item.SlNo === 2 || item.SlNo === 17;

                            return (
                                <tr key={item.MasterId} className={`border-b border-white/5 transition-colors ${hasReport ? 'bg-red-900/20' : isDisabled ? 'bg-black/20 opacity-60' : 'hover:bg-white/5'}`}>
                                    <td className="p-3 text-white/40 font-bold">{item.SlNo}</td>
                                    <td className={`p-3 font-bold ${isDisabled ? 'text-white/40 line-through' : 'text-white/90'}`}>{item.CheckPointDesc}</td>
                                    <td className="p-3"><span className={`border border-white/10 text-[10px] font-bold px-2 py-1 rounded uppercase ${isDisabled ? 'text-white/30' : 'text-white/60 bg-black/20'}`}>{item.CheckMethod}</span></td>

                                    <td className="p-3 text-center">
                                        {isDecimalRow ? (
                                            <input type="number" step="0.01" value={item.ReadingValue || ''} onChange={e => handleReadingChange(i, e.target.value)} disabled={isDisabled || hasReport} placeholder="0.00"
                                                className={`w-16 mx-auto text-center border border-white/10 rounded text-xs font-bold py-1 outline-none transition-colors ${isDisabled || hasReport ? 'bg-black/20 text-white/30 cursor-not-allowed' : 'bg-[#333] text-white focus:border-[#ff9100]'}`} />
                                        ) : (
                                            <div onClick={() => !isDisabled && !hasReport && handleOkClick(item, i)} className={`w-6 h-6 mx-auto rounded border flex items-center justify-center transition-all ${isDisabled ? 'cursor-not-allowed border-white/10 bg-black/20' : 'cursor-pointer'} ${item.IsDone && !hasReport && !isDisabled ? 'bg-green-500 border-green-500 text-white' : 'border-white/20 bg-[#333]'} ${hasReport ? 'opacity-20 cursor-not-allowed' : ''}`}>
                                                {item.IsDone && !hasReport && !isDisabled && "✓"}
                                            </div>
                                        )}
                                    </td>

                                    <td className="p-3 text-center">
                                        <div onClick={() => !isDisabled && handleNotOkClick(item)} className={`w-6 h-6 mx-auto rounded border flex items-center justify-center transition-all ${isDisabled ? 'cursor-not-allowed border-white/10 bg-black/20' : 'cursor-pointer hover:border-red-500'} ${hasReport && !isDisabled ? 'bg-red-600 border-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'border-white/20 bg-[#333]'}`}>
                                            {hasReport && !isDisabled && "✕"}
                                        </div>
                                    </td>

                                    <td className="p-3 text-center border-l border-white/5 bg-black/10">
                                        <input type="checkbox" checked={item.IsHoliday || false} readOnly disabled className="w-5 h-5 accent-[#ff9100] cursor-not-allowed opacity-70" />
                                    </td>

                                    <td className="p-3 text-center bg-black/10">
                                        <input type="checkbox" checked={item.IsVatCleaning || false} readOnly disabled className="w-5 h-5 accent-blue-600 cursor-not-allowed opacity-70" />
                                    </td>
                                    
                                    <td className="p-3 text-center bg-black/10 border-l border-white/5">
                                        <input type="checkbox" checked={item.IsPreventiveMaintenance || false} readOnly disabled className="w-5 h-5 accent-purple-600 cursor-not-allowed opacity-70" />
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isModalOpen && modalItem && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[500] p-4 animate-in fade-in">
                    {/* ... (Modal stays exactly the same) ... */}
                    <div className="bg-[#2a2a2a] border border-white/10 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95">
                        <div className="bg-red-600 p-5 flex justify-between items-center text-white">
                            <div><h3 className="font-bold uppercase text-sm tracking-wider">Non-Conformance Report</h3><p className="text-xs opacity-80 mt-1">Checkpoint #{modalItem.SlNo}</p></div>
                            <button onClick={() => setIsModalOpen(false)} className="hover:bg-red-700 rounded-full p-1 transition-colors"><X size={24} /></button>
                        </div>
                        <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                            <div className="bg-red-900/20 p-4 rounded-lg border border-red-500/30 flex justify-between items-center">
                                <p className="font-bold text-red-200">{modalItem.CheckPointDesc}</p>
                                <span className="text-[10px] bg-[#ff9100]/20 text-[#ff9100] border border-[#ff9100]/50 px-2 py-1 rounded font-black uppercase tracking-wider">{ncForm.status}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2"><Field label="NC Details" value={ncForm.ncDetails} onChange={v => setNcForm({ ...ncForm, ncDetails: v })} multiline /></div>
                                <Field label="Correction" value={ncForm.correction} onChange={v => setNcForm({ ...ncForm, correction: v })} />
                                <Field label="Root Cause" value={ncForm.rootCause} onChange={v => setNcForm({ ...ncForm, rootCause: v })} />
                                <div className="col-span-2"><Field label="Corrective Action" value={ncForm.correctiveAction} onChange={v => setNcForm({ ...ncForm, correctiveAction: v })} multiline /></div>
                                <Field label="Responsibility" value={ncForm.responsibility} onChange={v => setNcForm({ ...ncForm, responsibility: v })} options={['Maintenance', 'Production', 'Quality']} />
                                <Field label="Target Date" type="date" value={ncForm.targetDate} onChange={v => setNcForm({ ...ncForm, targetDate: v })} />
                            </div>
                            <div className="pt-4 border-t border-white/10">
                                <button onClick={submitReport} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-lg uppercase tracking-widest shadow-lg transition-colors">Save NC Report</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <SaveButton onClick={handleSave} />
        </div>
    );
};

/* 🔥 8. NEW: DISAMATIC PRODUCT REPORT EDITOR (GROUPED ARRAYS) 🔥 */
/* 🔥 8. NEW: DISAMATIC PRODUCT REPORT EDITOR (GROUPED ARRAYS) 🔥 */
const DisamaticEditor = ({ date, disa, toast, setToast }) => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const pureDisa = disa.replace('DISA - ', '');

    useEffect(() => {
        setLoading(true);
        authAxios.get(`${API_BASE}/forms/by-date`, { params: { date, disa: pureDisa } })
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

                        // Safely concatenate text fields
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
            .catch(() => setToast({ msg: 'Failed to load data', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, pureDisa]);

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
        setToast({ msg: 'Saving...', type: 'loading' });
        try {
            // By passing the merged arrays to the primary report's ID, the backend correctly loops through and updates all individual rows via their SQL table ID.
            for (const rep of reports) {
                await authAxios.put(`${API_BASE}/forms/${rep.id}`, rep);
            }
            setToast({ msg: 'Saved successfully!', type: 'success' });
        } catch (e) {
            setToast({ msg: 'Save failed', type: 'error' });
        }
    };

    if (loading) return <CenteredLoader />;
    if (reports.length === 0) return <NoData msg={`No Disamatic reports found for DISA ${pureDisa} on ${date}.`} />;

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

                    {/* PRODUCTIONS TABLE */}
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

                    {/* NEXT SHIFT PLAN TABLE */}
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

                    {/* DELAYS TABLE */}
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

                    {/* MOULD HARDNESS TABLE */}
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

                    {/* PATTERN TEMPS TABLE */}
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

/* 9. PERFORMANCE EDITOR */
const PerformanceEditor = ({ date, disa, toast, setToast }) => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        authAxios.get(`${API_BASE}/daily-performance/by-date`, { params: { date, disa: disa } })
            .then(res => {
                const data = Array.isArray(res.data) ? res.data[0] : res.data;
                setReport(data || null);
            })
            .catch(() => setToast({ msg: 'Failed to load', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const handleSave = async () => {
        setToast({ msg: 'Saving...', type: 'loading' });
        try {
            // Reconstruct the summary object the backend expects during PUT
            const summaryObj = {};
            if (report.summary) {
                report.summary.forEach(s => {
                    summaryObj[s.shiftName] = {
                        pouredMoulds: s.pouredMoulds,
                        tonnage: s.tonnage,
                        casted: s.casted,
                        value: s.shiftValue || s.value
                    };
                });
            }

            const payload = {
                ...report,
                summary: summaryObj,
            };

            await authAxios.put(`${API_BASE}/daily-performance/${report.id}`, payload);
            setToast({ msg: 'Saved successfully', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!report) return <NoData />;

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
                <SubTable headers={['Shift', 'Poured Moulds', 'Tonnage', 'Casted', 'Value']}>
                    {['I', 'II', 'III'].map(shift => (
                        <tr key={shift} className="border-b border-white/5">
                            <td className="p-2 text-white font-bold text-center">{shift}</td>
                            <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={getSummaryField(shift, 'pouredMoulds')} onChange={e => updateSummary(shift, 'pouredMoulds', e.target.value)} /></td>
                            <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={getSummaryField(shift, 'tonnage')} onChange={e => updateSummary(shift, 'tonnage', e.target.value)} /></td>
                            <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={getSummaryField(shift, 'casted')} onChange={e => updateSummary(shift, 'casted', e.target.value)} /></td>
                            <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={getSummaryField(shift, 'shiftValue')} onChange={e => updateSummary(shift, 'shiftValue', e.target.value)} /></td>
                        </tr>
                    ))}
                </SubTable>

                <SectionHeader title="Performance Details" />
                <div className="overflow-x-auto custom-scrollbar">
                    <SubTable headers={['Pattern Code', 'Item Desc', 'Planned', 'Unplanned', 'Moulds Prod', 'Moulds Pour']}>
                        {report.details?.map((d, i) => (
                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.patternCode || ''} onChange={e => updateDetail(i, 'patternCode', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.itemDescription || ''} onChange={e => updateDetail(i, 'itemDescription', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.planned || ''} onChange={e => updateDetail(i, 'planned', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.unplanned || ''} onChange={e => updateDetail(i, 'unplanned', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.mouldsProd || ''} onChange={e => updateDetail(i, 'mouldsProd', e.target.value)} /></td>
                                <td className="p-1"><input className="w-full bg-transparent border border-white/10 rounded text-white px-2 py-1 focus:border-[#ff9100] outline-none text-center" value={d.mouldsPour || ''} onChange={e => updateDetail(i, 'mouldsPour', e.target.value)} /></td>
                            </tr>
                        ))}
                    </SubTable>
                </div>

                <SectionHeader title="Unplanned Reasons" />
                <Field label="Reasons" value={report.unplannedReasons} onChange={v => updateReport('unplannedReasons', v)} multiline />
            </div>
            <SaveButton onClick={handleSave} />
        </div>
    )
}

/* 10. MOULD QUALITY EDITOR */
const MouldQualityEditor = ({ date, disa, toast, setToast }) => {
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        authAxios.get(`${API_BASE}/mould-quality/by-date`, { params: { date, disa } })
            .then(res => setReport(res.data))
            .catch(() => setToast({ msg: 'Failed to load', type: 'error' }))
            .finally(() => setLoading(false));
    }, [date, disa]);

    const updateReport = (field, val) => setReport(prev => ({ ...prev, [field]: val }));
    const updateRow = (idx, field, val) => {
        const rows = [...report.rows];
        rows[idx] = { ...rows[idx], [field]: val };
        setReport(prev => ({ ...prev, rows }));
    };

    const handleSave = async () => {
        setToast({ msg: 'Saving...', type: 'loading' });
        try {
            await authAxios.put(`${API_BASE}/mould-quality/update/${report.id}`, report);
            setToast({ msg: 'Saved successfully', type: 'success' });
        } catch { setToast({ msg: 'Save failed', type: 'error' }); }
    };

    if (loading) return <CenteredLoader />;
    if (!report) return <NoData />;

    return (
        <div className="space-y-6">
            <div className="bg-[#2a2a2a] p-5 rounded-xl border border-white/10 shadow-lg">
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <Field label="Verified By" value={report.verifiedBy} onChange={v => updateReport('verifiedBy', v)} />
                    <Field label="Approved By" value={report.approvedBy} onChange={v => updateReport('approvedBy', v)} />
                </div>
                <SectionHeader title="Mould Inspection Rows" />
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-[#222] text-white/50 text-[10px] uppercase tracking-widest">
                            <tr>
                                <th className="p-2 border border-white/5">S.No</th>
                                <th className="p-2 border border-white/5">Shift</th>
                                <th className="p-2 border border-white/5">Part Name</th>
                                <th className="p-2 border border-white/5">Data Code</th>
                                <th className="p-2 border border-white/5">FM Soft Ramming</th>
                                <th className="p-2 border border-white/5">FM Mould Breakage</th>
                                <th className="p-2 border border-white/5">FM Mould Crack</th>
                                <th className="p-2 border border-white/5">DR Mould Crush</th>
                                <th className="p-2 border border-white/5">DR Loose Sand</th>
                                <th className="p-2 border border-white/5">Target Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.rows.map((r, i) => (
                                <tr key={r.id || i} className="border-b border-white/5 hover:bg-white/5">
                                    <td className="p-1 border border-white/5"><input className="w-full bg-transparent border border-white/10 rounded focus:border-[#ff9100] outline-none text-white px-2 py-1 text-center" value={r.sNo || ''} onChange={e => updateRow(i, 'sNo', e.target.value)} /></td>
                                    <td className="p-1 border border-white/5"><input className="w-full bg-transparent border border-white/10 rounded focus:border-[#ff9100] outline-none text-white px-2 py-1 text-center" value={r.shift || ''} onChange={e => updateRow(i, 'shift', e.target.value)} /></td>
                                    <td className="p-1 border border-white/5"><input className="w-full bg-transparent border border-white/10 rounded focus:border-[#ff9100] outline-none text-white px-2 py-1 text-center" value={r.partName || ''} onChange={e => updateRow(i, 'partName', e.target.value)} /></td>
                                    <td className="p-1 border border-white/5"><input className="w-full bg-transparent border border-white/10 rounded focus:border-[#ff9100] outline-none text-white px-2 py-1 text-center" value={r.dataCode || ''} onChange={e => updateRow(i, 'dataCode', e.target.value)} /></td>
                                    <td className="p-1 border border-white/5"><input className="w-full bg-transparent border border-white/10 rounded focus:border-[#ff9100] outline-none text-white px-2 py-1 text-center" value={r.fmSoftRamming || ''} onChange={e => updateRow(i, 'fmSoftRamming', e.target.value)} /></td>
                                    <td className="p-1 border border-white/5"><input className="w-full bg-transparent border border-white/10 rounded focus:border-[#ff9100] outline-none text-white px-2 py-1 text-center" value={r.fmMouldBreakage || ''} onChange={e => updateRow(i, 'fmMouldBreakage', e.target.value)} /></td>
                                    <td className="p-1 border border-white/5"><input className="w-full bg-transparent border border-white/10 rounded focus:border-[#ff9100] outline-none text-white px-2 py-1 text-center" value={r.fmMouldCrack || ''} onChange={e => updateRow(i, 'fmMouldCrack', e.target.value)} /></td>
                                    <td className="p-1 border border-white/5"><input className="w-full bg-transparent border border-white/10 rounded focus:border-[#ff9100] outline-none text-white px-2 py-1 text-center" value={r.drMouldCrush || ''} onChange={e => updateRow(i, 'drMouldCrush', e.target.value)} /></td>
                                    <td className="p-1 border border-white/5"><input className="w-full bg-transparent border border-white/10 rounded focus:border-[#ff9100] outline-none text-white px-2 py-1 text-center" value={r.drLooseSand || ''} onChange={e => updateRow(i, 'drLooseSand', e.target.value)} /></td>
                                    <td className="p-1 border border-white/5"><input className="w-full bg-transparent border border-white/10 rounded focus:border-[#ff9100] outline-none text-white px-2 py-1 text-center" value={r.drDateHeatCode || ''} onChange={e => updateRow(i, 'drDateHeatCode', e.target.value)} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <SaveButton onClick={handleSave} />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
//  NEEDS-MACHINE forms
// ─────────────────────────────────────────────────────────────────────────────
const NEEDS_MACHINE = ['unpoured-mould-details', 'dmm-setting-parameters', 'disa-operator', 'lpa', 'disamatic-report', 'error-proof2', 'performance', 'mould-quality'];

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
const AdminFormEditor = ({ form, date, onBack }) => {
    const [selectedMachine, setSelectedMachine] = useState('');
    const [machineConfirmed, setMachineConfirmed] = useState(false);
    const [toast, setToast] = useState({ msg: '', type: 'success' });

    const needsMachine = NEEDS_MACHINE.includes(form.id);
    const ready = !needsMachine || machineConfirmed;

    const renderEditor = () => {
        const props = { date, disa: selectedMachine, toast, setToast };
        switch (form.id) {
            case 'unpoured-mould-details': return <UnpouredEditor {...props} />;
            case 'dmm-setting-parameters': return <DmmEditor {...props} />;
            case 'disa-operator': return <DisaChecklistEditor {...props} />;
            case 'error-proof': return <ErrorProofV1Editor {...props} />;
            case 'error-proof2': return <ErrorProofEditor {...props} />;
            case 'disa-setting-adjustment': return <DisaSettingEditor date={date} toast={toast} setToast={setToast} />;
            case '4m-change': return <FourMEditor date={date} toast={toast} setToast={setToast} />;
            case 'lpa': return <LpaEditor {...props} />;
            case 'disamatic-report': return <DisamaticEditor {...props} />;
            case 'performance': return <PerformanceEditor {...props} />;
            case 'mould-quality': return <MouldQualityEditor {...props} />;
            default: return (
                <div className="flex flex-col items-center justify-center py-20 text-white/30">
                    <AlertTriangle className="w-10 h-10 mb-3" />
                    <p className="text-sm font-bold">Editor not available for this form type.</p>
                </div>
            );
        }
    };

    return (
        <div className="relative w-full min-h-screen bg-[#2d2d2d] font-sans">
            <Toast msg={toast.msg} type={toast.type} onClose={() => setToast({ msg: '', type: toast.type })} />

            {/* Header */}
            <div className="sticky top-0 z-20 bg-[#2d2d2d]/95 backdrop-blur border-b border-white/10 px-6 py-4 flex items-center gap-4">
                <button onClick={onBack}
                    className="flex items-center gap-2 text-[#ff9100] font-bold uppercase tracking-wider text-xs hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-lg border border-white/10 hover:border-[#ff9100]/50">
                    ← Back
                </button>
                <div>
                    <h1 className="text-lg font-black text-white uppercase tracking-wide leading-tight">{form.name}</h1>
                    <p className="text-xs text-white/40 font-bold uppercase tracking-widest">
                        Admin Edit · {date}{ready && needsMachine ? ` · ${selectedMachine}` : ''}
                    </p>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-8">
                {/* Machine selector step */}
                {needsMachine && !machineConfirmed && (
                    <div className="flex flex-col items-center justify-center py-20 gap-6">
                        <p className="text-white/60 text-sm font-bold uppercase tracking-wider">Select DISA Machine for this form</p>
                        <div className="flex flex-wrap justify-center gap-4 max-w-4xl">
                            {DISA_MACHINES.map(m => (
                                <button key={m}
                                    onClick={() => setSelectedMachine(m)}
                                    className={`px-6 py-3 rounded-xl font-black text-sm uppercase tracking-wider border-2 transition-all ${selectedMachine === m
                                        ? 'bg-[#ff9100] border-[#ff9100] text-white'
                                        : 'bg-[#2a2a2a] border-white/10 text-white/60 hover:border-[#ff9100]/50'
                                        }`}>
                                    {m}
                                </button>
                            ))}
                        </div>
                        <button
                            disabled={!selectedMachine}
                            onClick={() => setMachineConfirmed(true)}
                            className="mt-4 bg-[#ff9100] hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black uppercase tracking-wider px-8 py-3 rounded-xl transition-colors shadow-lg">
                            Load Data
                        </button>
                    </div>
                )}

                {/* Form editor content */}
                {ready && renderEditor()}
            </div>
        </div>
    );
};

export default AdminFormEditor;
