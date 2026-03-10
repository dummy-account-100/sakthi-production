import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
    FileDown, Calendar, Users, X, Loader, AlertTriangle, CheckCircle,
    Settings, FileText, LogOut, Edit, Trash2, UserPlus, Eye
} from 'lucide-react';

import {
    generateUnPouredMouldPDF, generateDmmSettingPDF, generateChecklistPDF,
    generateErrorProofV1PDF, generateErrorProofV2PDF, generateDisaSettingAdjustmentPDF,
    generateMouldQualityPDF
} from '../utils/pdfGenerators';

import { removeToken, getUser } from '../utils/auth';

import ConfigFourMColumns from './ConfigFourMColumns';
import ConfigLpa from './ConfigLpa';
import ConfigDisaColumns from './ConfigDisaColumns';
import ConfigUnpouredMould from './ConfigUnpouredMould';
import ConfigDmmSetting from './ConfigDmmSetting';
import ConfigErrorProof from './ConfigErrorProof';
import ConfigDisaChecklist from './ConfigDisaChecklist';
import AdminFormEditor from './AdminFormEditor';

const NotificationToast = ({ data, onClose }) => {
    const isError = data.type === 'error';
    const isLoading = data.type === 'loading';

    React.useEffect(() => {
        if (data.show && !isLoading) {
            const timer = setTimeout(() => onClose(), 3000);
            return () => clearTimeout(timer);
        }
    }, [data.show, isLoading, onClose]);

    if (!data.show) return null;

    return (
        <div className="fixed top-6 right-6 z-[200] animate-slide-in-right">
            <div className={`flex items-center gap-4 px-6 py-4 rounded-xl shadow-2xl backdrop-blur-md border ${isError ? 'bg-red-500/10 border-red-500/30 text-red-200' : isLoading ? 'bg-[#ff9100]/10 border-[#ff9100]/30 text-[#ff9100]' : 'bg-green-500/10 border-green-500/30 text-green-200'}`}>
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

const AdminDashboard = () => {
    const navigate = useNavigate();
    const user = getUser();

    const handleLogout = () => {
        removeToken();
        navigate('/login');
    };

    const [activeView, setActiveView] = useState('grid');
    const [actionModal, setActionModal] = useState({ show: false, selectedForm: null });
    const [pdfModal, setPdfModal] = useState({ show: false, selectedForm: null });
    const [dateRange, setDateRange] = useState({ from: '', to: '' });
    const [loading, setLoading] = useState(false);
    const [notification, setNotification] = useState({ show: false, type: '', message: '' });

    const [datePickerModal, setDatePickerModal] = useState({ show: false, selectedForm: null });
    const [viewDate, setViewDate] = useState('');
    const [adminEditView, setAdminEditView] = useState(null);

    const [users, setUsers] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editUser, setEditUser] = useState({ id: "", username: "", role: "" });

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ username: "", password: "", role: "" });

    const forms = [
        { name: "Performance", id: "performance" },
        { name: "DISA Matic Product Report", id: "disamatic-report" },
        { name: "Unpoured Mould Details", id: "unpoured-mould-details" },
        { name: "DMM Setting Parameters", id: "dmm-setting-parameters" },
        { name: "DISA Operator Checklist", id: "disa-operator" },
        { name: "Layered Process Audit", id: "lpa" },
        { name: "Error Proof Verification", id: "error-proof" },
        { name: "Error Proof 2", id: "error-proof2" },
        { name: "DISA Setting Adjustment Record", id: "disa-setting-adjustment" },
        { name: "4M Monitoring", id: "4m-change" },
        { name: "Mould Quality Inspection", id: "mould-quality" },
        { name: "Add / Manage Users", id: "users", isSpecial: true }
    ];

    useEffect(() => {
        if (activeView === 'users') fetchUsers();
    }, [activeView]);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/users`);
            setUsers(response.data);
        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to load users' });
        }
        setLoadingUsers(false);
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${process.env.REACT_APP_API_URL}/api/users/add`, newUser);
            setNotification({ show: true, type: 'success', message: 'User added successfully!' });
            setIsAddModalOpen(false);
            setNewUser({ username: "", password: "", role: "" });
            fetchUsers();
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to add user';
            setNotification({ show: true, type: 'error', message: errorMsg });
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${process.env.REACT_APP_API_URL}/api/users/${editUser.id}`, {
                username: editUser.username,
                role: editUser.role,
            });
            setNotification({ show: true, type: 'success', message: 'User updated successfully!' });
            setIsEditModalOpen(false);
            fetchUsers();
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to update user';
            setNotification({ show: true, type: 'error', message: errorMsg });
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to delete this user? This cannot be undone.")) return;
        try {
            await axios.delete(`${process.env.REACT_APP_API_URL}/api/users/${userId}`);
            setNotification({ show: true, type: 'success', message: 'User deleted successfully!' });
            fetchUsers();
        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to delete user' });
        }
    };

    const handleGridClick = (form) => {
        if (form.isSpecial && form.id === 'users') {
            setActiveView('users');
        } else {
            setActionModal({ show: true, selectedForm: form });
        }
    };

    const openPdfModal = (form) => {
        setActionModal({ show: false, selectedForm: null });
        setPdfModal({ show: true, selectedForm: form });
        const today = new Date().toISOString().split('T')[0];
        setDateRange({ from: today, to: today });
    };

    const handleViewByDate = (form) => {
        const today = new Date().toISOString().split('T')[0];
        setViewDate(today);
        setActionModal({ show: false, selectedForm: null });
        setDatePickerModal({ show: true, selectedForm: form });
    };

    const handleManageForm = (form) => {
        const configForms = ['disa-operator', 'lpa', 'error-proof2', 'unpoured-mould-details', 'dmm-setting-parameters', 'disa-setting-adjustment', '4m-change'];
        setActionModal({ show: false, selectedForm: null });

        if (configForms.includes(form.id)) {
            if (form.id === '4m-change') setActiveView('4m-config');
            else if (form.id === 'disa-setting-adjustment') setActiveView('disa-config');
            else if (form.id === 'unpoured-mould-details') setActiveView('unpoured-config');
            else if (form.id === 'dmm-setting-parameters') setActiveView('dmm-config');
            else if (form.id === 'error-proof2') setActiveView('ep-config');
            else if (form.id === 'disa-operator') setActiveView('checklist-config');
            else if (form.id === 'lpa') setActiveView('lpa-config');
            else navigate(`/admin/config/${form.id}`);
        } else {
            navigate(`/${form.id}`);
        }
    };

    const handleDownloadPDF = async () => {
        if (!dateRange.from || !dateRange.to) {
            setNotification({ show: true, type: 'error', message: 'Please select both From and To dates.' });
            return;
        }

        setLoading(true);
        setNotification({ show: true, type: 'loading', message: 'Generating PDF Report...' });

        try {
            // 1. PERFECTED PERFORMANCE REPORT EXPORT
            if (pdfModal.selectedForm.id === 'performance') {
                const url = `${process.env.REACT_APP_API_URL}/api/daily-performance/download-pdf?fromDate=${dateRange.from}&toDate=${dateRange.to}`;
                
                const response = await axios.get(url, { responseType: 'blob' });
                
                if (response.data.type === 'application/json') {
                    setNotification({ show: true, type: 'error', message: 'No records found for the selected date range.' });
                    setLoading(false);
                    return;
                }

                const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', `Performance_Reports_${dateRange.from}_to_${dateRange.to}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(blobUrl);

                setNotification({ show: true, type: 'success', message: `Report Downloaded Successfully!` });
                setPdfModal({ show: false, selectedForm: null });
                setLoading(false);
                return;
            }

            // 2. Other Server rendered PDFs (Including disamatic-report)
            const serverPdfForms = ['4m-change', 'disamatic-report'];
            if (serverPdfForms.includes(pdfModal.selectedForm.id)) {
                let url = '';
                if (pdfModal.selectedForm.id === '4m-change') {
                    url = `${process.env.REACT_APP_API_URL}/api/4m-change/report?fromDate=${dateRange.from}&toDate=${dateRange.to}`;
                } else if (pdfModal.selectedForm.id === 'disamatic-report') {
                    url = `${process.env.REACT_APP_API_URL}/api/forms/download-pdf?fromDate=${dateRange.from}&toDate=${dateRange.to}`;
                }
                
                if (url) {
                    window.open(url, '_blank');
                    setNotification({ show: true, type: 'success', message: 'Report generated in new tab!' });
                    setPdfModal({ show: false, selectedForm: null });
                }
                setLoading(false);
                return;
            }

            // 3. Client rendered PDFs
            let apiRoute = `${process.env.REACT_APP_API_URL}/api/reports/${pdfModal.selectedForm.id}`;
            if (pdfModal.selectedForm.id === 'disa-setting-adjustment') apiRoute = `${process.env.REACT_APP_API_URL}/api/disa/records`;
            else if (pdfModal.selectedForm.id === 'error-proof') apiRoute = `${process.env.REACT_APP_API_URL}/api/error-proof/bulk-data`;
            else if (pdfModal.selectedForm.id === 'error-proof2') apiRoute = `${process.env.REACT_APP_API_URL}/api/error-proof2/bulk-data`;
            else if (pdfModal.selectedForm.id === 'unpoured-mould-details') apiRoute = `${process.env.REACT_APP_API_URL}/api/unpoured-moulds/bulk-data`;
            else if (pdfModal.selectedForm.id === 'dmm-setting-parameters') apiRoute = `${process.env.REACT_APP_API_URL}/api/dmm-settings/bulk-data`;
            else if (pdfModal.selectedForm.id === 'disa-operator') apiRoute = `${process.env.REACT_APP_API_URL}/api/disa-checklist/bulk-data`;
            else if (pdfModal.selectedForm.id === 'lpa') apiRoute = `${process.env.REACT_APP_API_URL}/api/bottom-level-audit/bulk-data`;
            else if (pdfModal.selectedForm.id === 'mould-quality') apiRoute = `${process.env.REACT_APP_API_URL}/api/mould-quality/bulk-data`;

            // 🔥 NEW FIX: Expand dates to full months for grid-based checklists
            let fetchFromDate = dateRange.from;
            let fetchToDate = dateRange.to;

            if (['disa-operator', 'lpa'].includes(pdfModal.selectedForm.id)) {
                const fromDateObj = new Date(dateRange.from);
                const toDateObj = new Date(dateRange.to);
                
                // Get 1st day of starting month
                const fromYear = fromDateObj.getFullYear();
                const fromMonth = String(fromDateObj.getMonth() + 1).padStart(2, '0');
                fetchFromDate = `${fromYear}-${fromMonth}-01`;

                // Get Last day of ending month
                const toYear = toDateObj.getFullYear();
                const toMonth = String(toDateObj.getMonth() + 1).padStart(2, '0');
                const lastDay = new Date(toYear, toDateObj.getMonth() + 1, 0).getDate();
                fetchToDate = `${toYear}-${toMonth}-${String(lastDay).padStart(2, '0')}`;
            }

            const res = await axios.get(apiRoute, { params: { fromDate: fetchFromDate, toDate: fetchToDate } });
            let data = res.data;

            const sanitizeDates = (arr) => arr.map(row => ({
                ...row,
                RecordDate: row.RecordDate ? row.RecordDate.split('T')[0] : row.RecordDate,
                date: row.date ? row.date.split('T')[0] : row.date
            }));

            if (Array.isArray(data)) {
                data = sanitizeDates(data);
            } else if (data && typeof data === 'object') {
                if (data.trans) data.trans = sanitizeDates(data.trans);
                if (data.records) data.records = sanitizeDates(data.records);
            }

            let isEmpty = false;
            if (Array.isArray(data) && data.length === 0) isEmpty = true;
            else if (data && data.trans && data.trans.length === 0) isEmpty = true;
            else if (data && data.records && data.records.length === 0) isEmpty = true;
            else if (data && data.verifications && data.verifications.length === 0) isEmpty = true; 

            if (isEmpty) {
                setNotification({ show: true, type: 'error', message: 'No data found for the selected date range.' });
                setLoading(false);
                return;
            }

            const effectiveDateRange = { from: fetchFromDate, to: fetchToDate };

            // 🔥 INTEGRATED FIX: Using proper V1, V2 PDF generators, and Mould Quality
            switch (pdfModal.selectedForm.id) {
                case 'unpoured-mould-details': generateUnPouredMouldPDF(data, dateRange); break;
                case 'dmm-setting-parameters': generateDmmSettingPDF(data, dateRange); break;
                case 'disa-operator': generateChecklistPDF(data, effectiveDateRange, "DISA MACHINE OPERATOR CHECK SHEET", "Non-Conformance Report"); break;
                case 'lpa': generateChecklistPDF(data, effectiveDateRange, "LAYERED PROCESS AUDIT - BOTTOM LEVEL", "Non-Conformance Report"); break;
                case 'error-proof': generateErrorProofV1PDF(data, dateRange); break;
                case 'error-proof2': generateErrorProofV2PDF(data, dateRange); break;
                case 'mould-quality': generateMouldQualityPDF(data, dateRange); break;
                case 'disa-setting-adjustment': generateDisaSettingAdjustmentPDF(data, dateRange); break;
                default:
                    setNotification({ show: true, type: 'error', message: 'Report format mapping not found.' });
                    setLoading(false);
                    return;
            }

            setNotification({ show: true, type: 'success', message: 'Bulk Export Downloaded Successfully!' });
            setPdfModal({ show: false, selectedForm: null });

        } catch (error) {
            console.error("PDF Generation Error: ", error);
            setNotification({ show: true, type: 'error', message: 'Failed to generate PDF.' });
        }

        setLoading(false);
    };

    if (adminEditView) {
        return (
            <AdminFormEditor
                form={adminEditView.form}
                date={adminEditView.date}
                onBack={() => setAdminEditView(null)}
            />
        );
    }

    if (activeView === 'unpoured-config') return (<div className="relative w-full min-h-screen bg-gray-100"><button onClick={() => setActiveView('grid')} className="absolute top-6 left-6 z-[100] flex items-center gap-2 bg-[#ff9100] text-white font-bold px-4 py-2 rounded shadow-lg hover:bg-orange-600 transition-colors uppercase tracking-wider text-sm">← Back to Modules</button><ConfigUnpouredMould onBack={() => setActiveView('grid')} /></div>);
    if (activeView === 'disa-config') return (<div className="relative w-full min-h-screen bg-gray-100"><button onClick={() => setActiveView('grid')} className="absolute top-6 left-6 z-[100] flex items-center gap-2 bg-[#ff9100] text-white font-bold px-4 py-2 rounded shadow-lg hover:bg-orange-600 transition-colors uppercase tracking-wider text-sm">← Back to Modules</button><ConfigDisaColumns onBack={() => setActiveView('grid')} /></div>);
    if (activeView === '4m-config') return (<div className="relative w-full min-h-screen bg-gray-100"><button onClick={() => setActiveView('grid')} className="absolute top-6 left-6 z-[100] flex items-center gap-2 bg-[#ff9100] text-white font-bold px-4 py-2 rounded shadow-lg hover:bg-orange-600 transition-colors uppercase tracking-wider text-sm">← Back to Modules</button><ConfigFourMColumns onBack={() => setActiveView('grid')} /></div>);
    if (activeView === 'dmm-config') return (<div className="relative w-full min-h-screen bg-gray-100"><button onClick={() => setActiveView('grid')} className="absolute top-6 left-6 z-[100] flex items-center gap-2 bg-[#ff9100] text-white font-bold px-4 py-2 rounded shadow-lg hover:bg-orange-600 transition-colors uppercase tracking-wider text-sm">← Back to Modules</button><ConfigDmmSetting onBack={() => setActiveView('grid')} /></div>);
    if (activeView === 'ep-config') return (<div className="relative w-full min-h-screen bg-gray-100"><button onClick={() => setActiveView('grid')} className="absolute top-6 left-6 z-[100] flex items-center gap-2 bg-[#ff9100] text-white font-bold px-4 py-2 rounded shadow-lg hover:bg-orange-600 transition-colors uppercase tracking-wider text-sm">← Back to Modules</button><ConfigErrorProof onBack={() => setActiveView('grid')} /></div>);
    if (activeView === 'checklist-config') return (<div className="relative w-full min-h-screen bg-gray-100"><button onClick={() => setActiveView('grid')} className="absolute top-6 left-6 z-[100] flex items-center gap-2 bg-[#ff9100] text-white font-bold px-4 py-2 rounded shadow-lg hover:bg-orange-600 transition-colors uppercase tracking-wider text-sm">← Back to Modules</button><ConfigDisaChecklist onBack={() => setActiveView('grid')} /></div>);
    if (activeView === 'lpa-config') return (<div className="relative w-full min-h-screen bg-gray-100"><button onClick={() => setActiveView('grid')} className="absolute top-6 left-6 z-[100] flex items-center gap-2 bg-[#ff9100] text-white font-bold px-4 py-2 rounded shadow-lg hover:bg-orange-600 transition-colors uppercase tracking-wider text-sm">← Back to Modules</button><ConfigLpa onBack={() => setActiveView('grid')} /></div>);

    if (activeView === 'users') {
        return (
            <div className="relative w-full min-h-screen bg-[#2d2d2d] flex flex-col items-center pt-24 pb-10 px-4 font-sans">
                <NotificationToast data={notification} onClose={() => setNotification(prev => ({ ...prev, show: false }))} />

                <button
                    onClick={() => setActiveView('grid')}
                    className="absolute top-6 left-6 z-[100] flex items-center gap-2 text-[#ff9100] font-bold uppercase tracking-wider text-sm hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-lg border border-white/10 hover:border-[#ff9100]/50 shadow-lg backdrop-blur-sm"
                >
                    ← Back to Dashboard
                </button>

                <div className="bg-white w-full max-w-5xl rounded-2xl p-8 shadow-2xl animate-fade-in">
                    <div className="flex justify-between items-center border-b-2 border-gray-800 pb-4 mb-6">
                        <div>
                            <h1 className="text-3xl font-black text-gray-800 uppercase tracking-wide">Manage Users</h1>
                            <p className="text-sm text-gray-500 font-bold mt-1 uppercase tracking-widest">System Access Control</p>
                        </div>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="bg-[#ff9100] hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider transition-colors shadow-lg flex items-center gap-2"
                        >
                            <UserPlus size={18} /> Add New User
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-gray-300 shadow-sm">
                        {loadingUsers ? (
                            <div className="flex justify-center items-center py-20">
                                <Loader className="animate-spin text-[#ff9100] w-10 h-10" />
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse bg-white">
                                <thead className="bg-gray-800 text-white">
                                    <tr>
                                        <th className="p-4 border-b border-gray-700 w-20 text-center uppercase tracking-wider text-xs font-bold">ID</th>
                                        <th className="p-4 border-b border-gray-700 uppercase tracking-wider text-xs font-bold">Username</th>
                                        <th className="p-4 border-b border-gray-700 w-48 uppercase tracking-wider text-xs font-bold">Role</th>
                                        <th className="p-4 border-b border-gray-700 w-32 text-center uppercase tracking-wider text-xs font-bold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.length > 0 ? (
                                        users.map((u) => (
                                            <tr key={u.id} className="hover:bg-orange-50 transition-colors border-b border-gray-200 last:border-0 group">
                                                <td className="p-4 text-center font-black text-gray-400 group-hover:text-[#ff9100] transition-colors">{u.id}</td>
                                                <td className="p-4 font-bold text-gray-800 text-lg">{u.username}</td>
                                                <td className="p-4">
                                                    <span className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md text-xs font-bold uppercase tracking-widest">
                                                        {u.role}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className="flex justify-center gap-4">
                                                        <button onClick={() => { setEditUser({ id: u.id, username: u.username, role: u.role }); setIsEditModalOpen(true); }} className="text-blue-500 hover:text-blue-700 transition-transform hover:scale-110" title="Edit User">
                                                            <Edit size={20} />
                                                        </button>
                                                        <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-700 transition-transform hover:scale-110" title="Delete User">
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan="4" className="text-center p-8 text-gray-500 font-bold italic">
                                                No users found in the system.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {isAddModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden scale-in">
                            <div className="bg-gray-800 px-6 py-5 flex justify-between items-center border-b-4 border-[#ff9100]">
                                <h3 className="text-white font-black uppercase tracking-widest text-lg flex items-center gap-2"><UserPlus size={20} className="text-[#ff9100]" /> Add New User</h3>
                                <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleAddUser} className="p-6 flex flex-col gap-5">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1">Username</label>
                                    <input type="text" required value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} className="w-full border-2 border-gray-300 p-3 rounded-xl focus:outline-none focus:border-[#ff9100] transition-colors font-bold text-gray-800" placeholder="Enter username" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1">Password</label>
                                    <input type="text" required value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full border-2 border-gray-300 p-3 rounded-xl focus:outline-none focus:border-[#ff9100] transition-colors font-bold text-gray-800" placeholder="Enter password" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1">Role</label>
                                    <select required value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })} className="w-full border-2 border-gray-300 p-3 rounded-xl focus:outline-none focus:border-[#ff9100] transition-colors font-bold text-gray-800 bg-white">
                                        <option value="">Select a Role</option>
                                        <option value="operator">Operator</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="hof">HOF</option>
                                        <option value="hod">HOD</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold uppercase tracking-wider py-3 rounded-xl transition-colors">Cancel</button>
                                    <button type="submit" className="flex-1 bg-[#ff9100] hover:bg-orange-600 text-white font-bold uppercase tracking-wider py-3 rounded-xl transition-colors shadow-lg">Create User</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {isEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
                        <div className="bg-white rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md overflow-hidden scale-in">
                            <div className="bg-gray-800 px-6 py-5 flex justify-between items-center border-b-4 border-blue-500">
                                <h3 className="text-white font-black uppercase tracking-widest text-lg flex items-center gap-2"><Edit size={20} className="text-blue-500" /> Edit User</h3>
                                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
                            </div>
                            <form onSubmit={handleUpdateUser} className="p-6 flex flex-col gap-5">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1">Username</label>
                                    <input type="text" required value={editUser.username} onChange={(e) => setEditUser({ ...editUser, username: e.target.value })} className="w-full border-2 border-gray-300 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-bold text-gray-800" />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-gray-600 mb-1">Role</label>
                                    <select required value={editUser.role} onChange={(e) => setEditUser({ ...editUser, role: e.target.value })} className="w-full border-2 border-gray-300 p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-bold text-gray-800 bg-white">
                                        <option value="">Select a Role</option>
                                        <option value="operator">Operator</option>
                                        <option value="supervisor">Supervisor</option>
                                        <option value="hof">HOF</option>
                                        <option value="hod">HOD</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div className="flex gap-3 mt-4">
                                    <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold uppercase tracking-wider py-3 rounded-xl transition-colors">Cancel</button>
                                    <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wider py-3 rounded-xl transition-colors shadow-lg">Save Changes</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="h-screen w-screen bg-[#2d2d2d] flex flex-col overflow-hidden font-sans relative">
            <NotificationToast data={notification} onClose={() => setNotification(prev => ({ ...prev, show: false }))} />

            <div className="h-1.5 bg-[#ff9100] flex-shrink-0 shadow-[0_0_15px_rgba(255,145,0,0.5)]" />

            <div className="w-full flex justify-between items-center px-10 pt-6 absolute top-0 left-0 z-10">
                {/* <Link to="/admin" className="flex items-center gap-2 text-[#ff9100] font-bold uppercase tracking-wider text-sm hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-lg border border-white/10 hover:border-[#ff9100]/50 shadow-lg backdrop-blur-sm">
                    ← Back to Dashboard
                </Link> */}
                <div className="flex items-center gap-4">
                    <span className="text-white/30 text-xs font-mono uppercase tracking-wider">
                        {user ? `${user.username} · ${user.role}` : ''}
                    </span>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-white/50 hover:text-[#ff9100] text-xs font-bold uppercase tracking-widest transition-colors bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg border border-white/10 hover:border-[#ff9100]/40 shadow-lg backdrop-blur-sm"
                    >
                        <LogOut className="w-4 h-4" /> Logout
                    </button>
                </div>
            </div>

            <div className="py-8 pt-16 flex-shrink-0 flex flex-col items-center">
                <h1 className="text-[2.5rem] md:text-[3.5rem] font-black text-center text-white tracking-tighter uppercase leading-tight drop-shadow-lg">
                    Admin Dashboard
                </h1>
                <div className="text-[#ff9100] tracking-widest uppercase text-sm font-bold mt-2">Sakthi Auto Component Limited</div>
                <div className="w-32 h-1 bg-[#ff9100] mt-4 rounded-full" />
            </div>

            <div className="flex-1 flex justify-center items-center px-10 pb-10 overflow-y-auto mt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 w-full max-w-7xl">
                    {forms.map((form) => (
                        <button
                            key={form.name}
                            onClick={() => handleGridClick(form)}
                            className={`
                                relative group border text-white rounded-2xl flex flex-col items-center justify-center text-center p-6 shadow-xl transition-all duration-300 hover:scale-[1.03] active:scale-95 overflow-hidden h-40
                                ${form.isSpecial
                                    ? 'bg-gradient-to-br from-[#ff9100]/80 to-orange-700 border-[#ff9100] hover:shadow-[0_0_30px_rgba(255,145,0,0.6)]'
                                    : 'bg-[#383838] border-white/5 hover:bg-white/10 hover:border-[#ff9100]/50'}
                            `}
                        >
                            {form.isSpecial ? (
                                <Users className="w-10 h-10 mb-3 text-white drop-shadow-md group-hover:scale-110 transition-transform" />
                            ) : (
                                <Settings className="w-8 h-8 mb-3 text-[#ff9100] opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                            )}
                            <span className="relative z-10 text-sm md:text-base font-bold uppercase tracking-wide group-hover:text-white leading-tight">
                                {form.name}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-1.5 bg-[#ff9100] flex-shrink-0 mt-auto" />

            {actionModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#383838] border border-white/10 w-full max-w-lg rounded-3xl shadow-[0_0_60px_rgba(0,0,0,0.8)] overflow-hidden scale-in relative">
                        <div className="h-24 bg-gradient-to-br from-[#ff9100] to-orange-800 relative flex items-center justify-center overflow-hidden">
                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
                            <h3 className="relative z-10 text-2xl font-black text-white uppercase tracking-widest drop-shadow-md">
                                Select Action
                            </h3>
                            <button onClick={() => setActionModal({ show: false, selectedForm: null })} className="absolute top-4 right-4 z-20 text-white/70 hover:text-white transition-colors bg-black/20 hover:bg-black/40 p-2 rounded-full">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-8 py-10 flex flex-col items-center gap-6">
                            <div className="text-center mb-4">
                                <p className="text-sm font-bold text-[#ff9100] uppercase tracking-[0.2em] mb-2">Target Module</p>
                                <h2 className="text-2xl font-black text-white leading-tight">{actionModal.selectedForm.name}</h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                                <button onClick={() => openPdfModal(actionModal.selectedForm)} className="group flex flex-col items-center justify-center gap-4 bg-[#2a2a2a] hover:bg-[#333] border-2 border-transparent hover:border-[#ff9100]/50 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 shadow-lg">
                                    <div className="bg-[#ff9100]/10 p-4 rounded-full group-hover:scale-110 transition-transform group-hover:bg-[#ff9100]/20"><FileText className="w-8 h-8 text-[#ff9100]" /></div>
                                    <div className="text-center"><div className="text-white font-bold uppercase tracking-wide text-sm mb-1">Export Data</div><div className="text-white/40 text-[10px] uppercase font-bold">Generate Bulk PDF</div></div>
                                </button>
                                <button onClick={() => handleViewByDate(actionModal.selectedForm)} className="group flex flex-col items-center justify-center gap-4 bg-[#2a2a2a] hover:bg-[#333] border-2 border-transparent hover:border-[#ff9100]/50 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 shadow-lg relative overflow-hidden">
                                    <div className="absolute top-0 right-0 bg-green-600 text-white text-[9px] font-black uppercase tracking-wider py-1 px-3 rounded-bl-lg flex items-center gap-1 shadow-md"><Eye size={10} /> Admin Edit</div>
                                    <div className="bg-[#ff9100]/10 p-4 rounded-full group-hover:scale-110 transition-transform group-hover:bg-[#ff9100]/20"><Calendar className="w-8 h-8 text-[#ff9100]" /></div>
                                    <div className="text-center"><div className="text-white font-bold uppercase tracking-wide text-sm mb-1">View by Date</div><div className="text-white/40 text-[10px] uppercase font-bold">Edit Form Data</div></div>
                                </button>
                                <button onClick={() => handleManageForm(actionModal.selectedForm)} className="group flex flex-col items-center justify-center gap-4 bg-[#2a2a2a] hover:bg-[#333] border-2 border-transparent hover:border-[#ff9100]/50 p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 shadow-lg relative overflow-hidden">
                                    <div className="absolute top-0 right-0 bg-[#ff9100] text-black text-[9px] font-black uppercase tracking-wider py-1 px-3 rounded-bl-lg flex items-center gap-1 shadow-md"><Settings size={10} /> Admin Setup</div>
                                    <div className="bg-[#ff9100]/10 p-4 rounded-full group-hover:scale-110 transition-transform group-hover:bg-[#ff9100]/20"><Settings className="w-8 h-8 text-[#ff9100]" /></div>
                                    <div className="text-center"><div className="text-white font-bold uppercase tracking-wide text-sm mb-1">Manage Form</div><div className="text-white/40 text-[10px] uppercase font-bold">Edit Structure & Parameters</div></div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {datePickerModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#383838] border border-white/10 w-full max-w-md rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden scale-in">
                        <div className="bg-[#2a2a2a] px-6 py-5 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-extrabold text-lg text-white uppercase tracking-widest flex items-center gap-2">
                                <Calendar size={20} className="text-[#ff9100]" /> Select Date
                            </h3>
                            <button onClick={() => setDatePickerModal({ show: false, selectedForm: null })} className="text-white/40 hover:text-[#ff9100] transition-colors p-1"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 flex flex-col gap-5">
                            <div className="bg-white/5 border border-[#ff9100]/30 rounded-xl p-4 text-center">
                                <div className="text-xs font-bold text-[#ff9100] uppercase tracking-widest mb-1">Target Form</div>
                                <div className="text-lg font-bold text-white uppercase leading-tight">{datePickerModal.selectedForm?.name}</div>
                            </div>
                            <div>
                                <label className="flex items-center gap-2 text-xs font-bold text-white/50 uppercase tracking-widest mb-2"><Calendar size={14} /> Date</label>
                                <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] transition-all cursor-pointer font-bold [color-scheme:dark]" />
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button onClick={() => setDatePickerModal({ show: false, selectedForm: null })} className="flex-1 py-3 text-sm font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all">Cancel</button>
                                <button disabled={!viewDate} onClick={() => { setAdminEditView({ form: datePickerModal.selectedForm, date: viewDate }); setDatePickerModal({ show: false, selectedForm: null }); }} className="flex-1 bg-[#ff9100] hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl uppercase transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,145,0,0.3)]">
                                    <Eye className="w-5 h-5" /> Load Form
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {pdfModal.show && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#383838] border border-white/10 w-full max-w-md rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.6)] overflow-hidden scale-in">
                        <div className="bg-[#2a2a2a] px-6 py-5 border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-extrabold text-lg text-white uppercase tracking-widest flex items-center gap-2">
                                <FileDown size={20} className="text-[#ff9100]" /> Bulk PDF Export
                            </h3>
                            <button onClick={() => setPdfModal({ show: false, selectedForm: null })} className="text-white/40 hover:text-[#ff9100] transition-colors p-1"><X className="w-6 h-6" /></button>
                        </div>
                        <div className="p-6 flex flex-col gap-6">
                            <div className="bg-white/5 border border-[#ff9100]/30 rounded-xl p-4 text-center">
                                <div className="text-xs font-bold text-[#ff9100] uppercase tracking-widest mb-1">Target Report</div>
                                <div className="text-lg font-bold text-white uppercase leading-tight">{pdfModal.selectedForm.name}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="flex items-center gap-2 text-xs font-bold text-white/50 uppercase tracking-widest mb-2"><Calendar size={14} /> From Date</label><input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] transition-all cursor-pointer font-bold [color-scheme:dark]" /></div>
                                <div><label className="flex items-center gap-2 text-xs font-bold text-white/50 uppercase tracking-widest mb-2"><Calendar size={14} /> To Date</label><input type="date" value={dateRange.to} min={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="w-full bg-[#222] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] transition-all cursor-pointer font-bold [color-scheme:dark]" /></div>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button onClick={() => setPdfModal({ show: false, selectedForm: null })} className="flex-1 py-3 text-sm font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all">Cancel</button>
                                <button onClick={handleDownloadPDF} disabled={loading} className="flex-1 bg-[#ff9100] hover:bg-orange-500 text-white font-bold py-3 rounded-xl uppercase transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(255,145,0,0.3)] disabled:opacity-70 disabled:cursor-not-allowed">
                                    {loading ? <Loader className="animate-spin w-5 h-5" /> : <FileDown className="w-5 h-5" />}{loading ? 'Generating...' : 'Download'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        @keyframes scale-in { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        .scale-in { animation: scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes slide-in-right { 0% { transform: translateX(100%); opacity: 0; } 100% { transform: translateX(0); opacity: 1; } }
        .animate-slide-in-right { animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}} />
        </div>
    );
};

export default AdminDashboard;