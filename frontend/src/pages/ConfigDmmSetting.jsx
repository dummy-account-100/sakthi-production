import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, Plus, Trash2, ArrowLeft, Loader, Settings, AlertTriangle, CheckCircle } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL && process.env.REACT_APP_API_URL !== "undefined" 
                 ? process.env.REACT_APP_API_URL 
                 : "/api";

const NotificationToast = ({ data, onClose }) => {
    const isError = data.type === 'error';
    const isLoading = data.type === 'loading';

    useEffect(() => {
        if (data.show && !isLoading) {
            const timer = setTimeout(() => onClose(), 3000);
            return () => clearTimeout(timer);
        }
    }, [data.show, isLoading, onClose]);

    if (!data.show) return null;

    return (
        <div className="fixed top-6 right-6 z-[250] animate-in slide-in-from-right-8 duration-300">
            <div className={`
                flex items-center gap-4 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md border 
                ${isError ? 'bg-red-500/10 border-red-500/30 text-red-200'
                    : isLoading ? 'bg-[#ff9100]/10 border-[#ff9100]/30 text-[#ff9100]'
                        : 'bg-green-500/10 border-green-500/30 text-green-200'}
            `}>
                <div className="flex-shrink-0">
                    {isLoading ? <Loader className="w-6 h-6 animate-spin" /> : isError ? <AlertTriangle className="w-6 h-6 text-red-500" /> : <CheckCircle className="w-6 h-6 text-green-500" />}
                </div>
                <div className="flex flex-col">
                    <h4 className="text-sm font-bold tracking-wide uppercase">
                        {isLoading ? 'Processing' : isError ? 'Error' : 'Success'}
                    </h4>
                    <p className="text-sm opacity-90">{data.message}</p>
                </div>
            </div>
        </div>
    );
};

const ConfigDmmSetting = ({ onBack }) => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState({ show: false, type: '', message: '' });
    const [items, setItems] = useState([]);

    const API_BASE_DMM_SETTINGS = `${API_BASE}/config/dmm-setting-parameters`;

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_DMM_SETTINGS}/master`);
            setItems(res.data.config || []);
        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to load configuration.' });
        } finally {
            setLoading(false);
        }
    };

    const handleAddRow = () => {
        setItems([...items, {
            id: Date.now(),
            slNo: items.length + 1,
            columnKey: '',
            columnLabel: '',
            inputType: 'text',
            columnWidth: 'w-32',
            isDeleted: false,
            isNew: true
        }]);
    };

    const handleUpdateRow = (id, field, value) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const handleDeleteRow = (id) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, isDeleted: !item.isDeleted } : item
        ));
    };

    const handleSaveConfig = async () => {
        setSaving(true);
        setNotification({ show: true, type: 'loading', message: 'Syncing configuration with database...' });

        try {
            const activeData = items.filter(c => !(c.isNew && c.isDeleted));
            
            await axios.post(`${API_BASE}/config/dmm-setting-parameters/master`, { config: activeData });

            setNotification({ show: true, type: 'success', message: 'Master Schema Updated Successfully!' });
            setTimeout(() => {
                if (onBack) onBack();
                else navigate('/admin');
            }, 1500);
        } catch (error) {
            console.error("Save Config Error:", error);
            setNotification({ show: true, type: 'error', message: 'Failed to save configuration.' });
        } finally {
            setSaving(false);
        }
    };

    const goBack = () => {
        if (onBack) onBack();
        else navigate('/admin');
    };

    return (
        <div className="min-h-screen bg-[#2d2d2d] flex flex-col font-sans relative pb-20">
            <NotificationToast data={notification} onClose={() => setNotification(prev => ({ ...prev, show: false }))} />

            <div className="h-1.5 bg-[#ff9100] flex-shrink-0 shadow-[0_0_15px_rgba(255,145,0,0.5)]" />

            <div className="bg-[#222] border-b border-white/5 py-4 px-10 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <button onClick={goBack} className="text-white/50 hover:text-[#ff9100] transition-colors p-2 rounded-lg hover:bg-white/5">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div>
                        <div className="flex items-center gap-2">
                            <Settings className="w-5 h-5 text-[#ff9100]" />
                            <span className="text-white/40 text-xs font-bold uppercase tracking-widest">Master Schema Config</span>
                        </div>
                        <h1 className="text-2xl font-black text-white uppercase tracking-wider">DMM SETTING PARAMETERS</h1>
                    </div>
                </div>

                <button
                    onClick={handleSaveConfig}
                    disabled={saving || loading}
                    className="bg-[#ff9100] hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-[0_0_15px_rgba(255,145,0,0.3)] transition-all flex items-center gap-2 uppercase text-sm disabled:opacity-50"
                >
                    {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Parameters Matrix
                </button>
            </div>

            <div className="flex-1 max-w-7xl w-full mx-auto p-10">
                <div className="bg-[#383838] border border-white/5 rounded-2xl shadow-xl overflow-hidden">
                    <div className="bg-black/20 grid grid-cols-12 gap-4 p-4 border-b border-white/5 text-xs font-bold text-white/50 uppercase tracking-widest text-center">
                        <div className="col-span-1">S.No</div>
                        <div className="col-span-3 text-left">Internal Col Key</div>
                        <div className="col-span-4 text-left">Display Label</div>
                        <div className="col-span-2">Input Type</div>
                        <div className="col-span-1">UI Width</div>
                        <div className="col-span-1">Action</div>
                    </div>

                    {loading ? (
                        <div className="p-10 flex justify-center items-center flex-col gap-4 text-[#ff9100]">
                            <Loader className="w-8 h-8 animate-spin" />
                            <span className="text-sm font-bold uppercase tracking-widest">Loading Settings Matrix...</span>
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {items.map((cp, index) => (
                                <div key={cp.id} className={`grid grid-cols-12 gap-4 p-4 items-center transition-all ${cp.isDeleted ? 'opacity-40 bg-red-900/10' : 'hover:bg-white/5'} ${cp.isNew ? 'border-[#ff9100]/30 border-l-4' : 'border-transparent border-l-4'}`}>
                                    <div className="col-span-1 text-center font-bold text-white/50">
                                        {cp.isDeleted ? 'DEL' : index + 1}
                                    </div>

                                    <div className="col-span-3">
                                        <input
                                            type="text"
                                            disabled={cp.isDeleted}
                                            value={cp.columnKey}
                                            onChange={(e) => handleUpdateRow(cp.id, 'columnKey', e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] outline-none text-sm transition-all disabled:cursor-not-allowed"
                                            placeholder="e.g. PumpPressure"
                                        />
                                    </div>

                                    <div className="col-span-4">
                                        <textarea
                                            rows="2"
                                            disabled={cp.isDeleted}
                                            value={cp.columnLabel}
                                            onChange={(e) => handleUpdateRow(cp.id, 'columnLabel', e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] outline-none text-sm transition-all disabled:cursor-not-allowed resize-none"
                                            placeholder="e.g. PUMP PRESSURE\n(bar)"
                                        />
                                    </div>

                                    <div className="col-span-2">
                                        <select
                                            disabled={cp.isDeleted}
                                            value={cp.inputType}
                                            onChange={(e) => handleUpdateRow(cp.id, 'inputType', e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] outline-none text-sm transition-all disabled:cursor-not-allowed appearance-none"
                                        >
                                            <option value="text">Text / String</option>
                                            <option value="number">Numeric</option>
                                            <option value="time">Time Entry</option>
                                        </select>
                                    </div>

                                    <div className="col-span-1">
                                        <select
                                            disabled={cp.isDeleted}
                                            value={cp.columnWidth}
                                            onChange={(e) => handleUpdateRow(cp.id, 'columnWidth', e.target.value)}
                                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] outline-none text-xs transition-all disabled:cursor-not-allowed appearance-none"
                                        >
                                            <option value="w-20">Small (w-20)</option>
                                            <option value="w-24">Medium (w-24)</option>
                                            <option value="w-28">Large (w-28)</option>
                                            <option value="w-32">X-Large (w-32)</option>
                                            <option value="w-40">Huge (w-40)</option>
                                            <option value="w-48">Text Box (w-48)</option>
                                        </select>
                                    </div>

                                    <div className="col-span-1 flex justify-center">
                                        <button
                                            onClick={() => handleDeleteRow(cp.id)}
                                            className={`p-2 rounded-lg transition-colors ${cp.isDeleted ? 'bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white' : 'text-white/30 hover:bg-red-500/20 hover:text-red-500'}`}
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <div className="p-4 bg-black/10">
                                <button
                                    onClick={handleAddRow}
                                    className="w-full py-4 border-2 border-dashed border-white/20 hover:border-[#ff9100] rounded-xl flex items-center justify-center gap-2 text-white/50 hover:text-[#ff9100] font-bold uppercase tracking-widest text-sm transition-all"
                                >
                                    <Plus className="w-5 h-5" /> Add New Parameter Column
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ConfigDmmSetting;