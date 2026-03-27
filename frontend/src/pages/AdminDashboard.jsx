import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import {
    FileDown, Calendar, Users, X, Loader, AlertTriangle, CheckCircle,
    Settings, Edit, Trash2, UserPlus, Eye, BookOpen,
    BarChart3, Factory, Layers, Cpu, ListChecks, FileSearch, ShieldCheck, 
    ShieldAlert, SlidersHorizontal, Activity, ClipboardCheck, Package, PlusSquare
} from 'lucide-react';

import {
    generateUnPouredMouldPDF, generateDmmSettingPDF, generateChecklistPDF,
    generateErrorProofPDF, generateDisaSettingAdjustmentPDF, generateMouldQualityPDF
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
import Header from '../components/Header';

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
        <div className="fixed top-24 right-6 z-[2000] animate-in slide-in-from-right-8 duration-300">
            <div className={`flex items-center gap-4 px-6 py-4 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-md border ${isError ? 'bg-[#2A0D0D]/90 border-red-500/50 text-red-400' : isLoading ? 'bg-[#1A1005]/90 border-[#ff9100]/50 text-[#ff9100]' : 'bg-[#0A1A10]/90 border-green-500/50 text-green-400'}`}>
                <div className="flex-shrink-0 bg-black/20 p-2 rounded-lg shadow-inner">
                    {isLoading ? <Loader className="w-5 h-5 animate-spin" /> : isError ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
                </div>
                <div className="flex flex-col">
                    <h4 className="text-[10px] font-black tracking-widest uppercase mb-0.5 opacity-80">
                        {isLoading ? 'System Processing' : isError ? 'System Error' : 'Success'}
                    </h4>
                    <p className="text-sm font-bold tracking-wide">{data.message}</p>
                </div>
            </div>
        </div>
    );
};

const AdminDashboard = () => {
    const navigate = useNavigate();
    const user = getUser();

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
    const [editUser, setEditUser] = useState({ id: "", username: "", employeeId: "", role: "" });

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({ username: "", employeeId: "", password: "", role: "" });

    // === NEW COMPONENT STATES ===
    const [components, setComponents] = useState([]);
    const [loadingComponents, setLoadingComponents] = useState(false);

    const [isEditCompModalOpen, setIsEditCompModalOpen] = useState(false);
    const [editComponent, setEditComponent] = useState({ code: "", description: "", pouredWeight: "", cavity: "", castedWeight: "" });

    const [isAddCompModalOpen, setIsAddCompModalOpen] = useState(false);
    // === CUSTOM DELETE MODAL STATE ===
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, codeToDelete: null });
    const [newComponent, setNewComponent] = useState({ code: "", description: "", pouredWeight: "", cavity: "", castedWeight: "" });

    // 🔥 State for QF Settings Manager
    const [qfSettings, setQfSettings] = useState([]);
    const [savingId, setSavingId] = useState(null);

    const forms = [
        { name: "Performance", id: "performance", icon: BarChart3 },
        { name: "DISA Matic Product Report", id: "disamatic-report", icon: Factory },
        { name: "Unpoured Mould Details", id: "unpoured-mould-details", icon: Layers },
        { name: "DMM Setting Parameters", id: "dmm-setting-parameters", icon: Cpu },
        { name: "DISA Operator Checklist", id: "disa-operator", icon: ListChecks },
        { name: "Layered Process Audit", id: "lpa", icon: FileSearch },
        { name: "Error Proof Verification", id: "error-proof", icon: ShieldCheck },
        { name: "Error Proof 2", id: "error-proof2", icon: ShieldAlert },
        { name: "DISA Setting Adjustment", id: "disa-setting-adjustment", icon: SlidersHorizontal },
        { name: "4M Monitoring", id: "4m-change", icon: Activity },
        { name: "Mould Quality Inspection", id: "mould-quality", icon: ClipboardCheck },
        { name: "Manage QF Values", id: "qf-settings", isSpecial: true, icon: BookOpen },
        { name: "Add / Manage Users", id: "users", isSpecial: true, icon: Users },
        { name: "Add / Manage Components", id: "components", isSpecial: true, icon: Package }, 
        
    ];

    const hideManageFormIds = ['disamatic-report', 'performance', 'error-proof', 'mould-quality'];

    useEffect(() => {
        if (activeView === 'users') fetchUsers();
        if (activeView === 'qf-settings') fetchQfSettings();
        if (activeView === 'components') fetchComponents();
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

    const fetchQfSettings = async () => {
        try {
            const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/settings/qf-values`);
            setQfSettings(res.data);
        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to load QF values.' });
        }
    };

    const handleSaveSingleQfSetting = async (setting) => {
        setSavingId(setting.formName);
        try {
            await axios.put(`${process.env.REACT_APP_API_URL}/api/settings/qf-values`, { setting });
            setNotification({ show: true, type: 'success', message: `${setting.formName.replace('-', ' ')} QF updated!` });
            fetchQfSettings(); 
        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to save QF value.' });
        }
        setSavingId(null);
    };

    const handleQfChange = (formName, newValue) => {
        setQfSettings(prev => prev.map(s => s.formName === formName ? { ...s, qfValue: newValue } : s));
    };

    const handleQfDateChange = (formName, newDate) => {
        setQfSettings(prev => prev.map(s => s.formName === formName ? { ...s, date: newDate } : s));
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${process.env.REACT_APP_API_URL}/api/users/add`, newUser);
            setNotification({ show: true, type: 'success', message: 'User added successfully!' });
            setIsAddModalOpen(false);
            setNewUser({ username: "", employeeId: "", password: "", role: "" });
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
                employeeId: editUser.employeeId,
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
        if (form.isSpecial) {
            setActiveView(form.id);
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
            const token = localStorage.getItem('token'); 

            if (pdfModal.selectedForm.id === 'performance') {
                const url = `${process.env.REACT_APP_API_URL}/api/daily-performance/download-pdf?fromDate=${dateRange.from}&toDate=${dateRange.to}`;
                const response = await axios.get(url, { responseType: 'blob', headers: { Authorization: `Bearer ${token}` } });
                
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

            const serverPdfForms = ['4m-change', 'disamatic-report'];
            if (serverPdfForms.includes(pdfModal.selectedForm.id)) {
                let url = '';
                if (pdfModal.selectedForm.id === '4m-change') url = `${process.env.REACT_APP_API_URL}/api/4m-change/report?fromDate=${dateRange.from}&toDate=${dateRange.to}`;
                else if (pdfModal.selectedForm.id === 'disamatic-report') url = `${process.env.REACT_APP_API_URL}/api/forms/download-pdf?fromDate=${dateRange.from}&toDate=${dateRange.to}`;
                
                if (url) {
                    const response = await axios.get(url, { responseType: 'blob', headers: { Authorization: `Bearer ${token}` } });
                    if (response.data.type === 'application/json') {
                        setNotification({ show: true, type: 'error', message: 'No records found for the selected date range.' });
                        setLoading(false);
                        return;
                    }

                    const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    const fileNamePrefix = pdfModal.selectedForm.id === '4m-change' ? '4M_Monitoring' : 'Disamatic_Product_Report';
                    link.setAttribute('download', `${fileNamePrefix}_${dateRange.from}_to_${dateRange.to}.pdf`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(blobUrl);

                    setNotification({ show: true, type: 'success', message: 'Report Downloaded Successfully!' });
                    setPdfModal({ show: false, selectedForm: null });
                }
                setLoading(false);
                return;
            }

            let apiRoute = `${process.env.REACT_APP_API_URL}/api/reports/${pdfModal.selectedForm.id}`;
            if (pdfModal.selectedForm.id === 'disa-setting-adjustment') apiRoute = `${process.env.REACT_APP_API_URL}/api/disa/records`;
            else if (pdfModal.selectedForm.id === 'error-proof') apiRoute = `${process.env.REACT_APP_API_URL}/api/error-proof/bulk-data`;
            else if (pdfModal.selectedForm.id === 'error-proof2') apiRoute = `${process.env.REACT_APP_API_URL}/api/error-proof2/bulk-data`;
            else if (pdfModal.selectedForm.id === 'unpoured-mould-details') apiRoute = `${process.env.REACT_APP_API_URL}/api/unpoured-moulds/bulk-data`;
            else if (pdfModal.selectedForm.id === 'dmm-setting-parameters') apiRoute = `${process.env.REACT_APP_API_URL}/api/dmm-settings/bulk-data`;
            else if (pdfModal.selectedForm.id === 'disa-operator') apiRoute = `${process.env.REACT_APP_API_URL}/api/disa-checklist/bulk-data`;
            else if (pdfModal.selectedForm.id === 'lpa') apiRoute = `${process.env.REACT_APP_API_URL}/api/bottom-level-audit/bulk-data`;
            else if (pdfModal.selectedForm.id === 'mould-quality') apiRoute = `${process.env.REACT_APP_API_URL}/api/mould-quality/bulk-data`;

            let fetchFromDate = dateRange.from;
            let fetchToDate = dateRange.to;

            if (['disa-operator', 'lpa'].includes(pdfModal.selectedForm.id)) {
                const fromDateObj = new Date(dateRange.from);
                const toDateObj = new Date(dateRange.to);
                const fromYear = fromDateObj.getFullYear();
                const fromMonth = String(fromDateObj.getMonth() + 1).padStart(2, '0');
                fetchFromDate = `${fromYear}-${fromMonth}-01`;

                const toYear = toDateObj.getFullYear();
                const toMonth = String(toDateObj.getMonth() + 1).padStart(2, '0');
                const lastDay = new Date(toYear, toDateObj.getMonth() + 1, 0).getDate();
                fetchToDate = `${toYear}-${toMonth}-${String(lastDay).padStart(2, '0')}`;
            }

            const res = await axios.get(apiRoute, { 
                params: { fromDate: fetchFromDate, toDate: fetchToDate },
                headers: { Authorization: `Bearer ${token}` } 
            });
            
            let data = res.data;

            const sanitizeDates = (arr) => {
                if (!Array.isArray(arr)) return arr;
                return arr.map(row => ({
                    ...row,
                    RecordDate: row.RecordDate ? row.RecordDate.split('T')[0] : row.RecordDate,
                    date: row.date ? row.date.split('T')[0] : row.date
                }));
            };

            if (Array.isArray(data)) {
                data = sanitizeDates(data);
            } else if (data && typeof data === 'object') {
                ['trans', 'records', 'meta', 'verifications', 'plans', 'master', 'ncr', 'rows'].forEach(key => {
                    if (data[key]) data[key] = sanitizeDates(data[key]);
                });
            }

            if (pdfModal.selectedForm.id === 'dmm-setting-parameters') {
                if (Array.isArray(data)) {
                    data = { meta: data, trans: data };
                } else if (data && typeof data === 'object') {
                    if (!data.meta || data.meta.length === 0) {
                        data.meta = data.records || data.shiftsMeta || data.trans || [];
                    }
                    if (!data.trans || data.trans.length === 0) {
                        data.trans = data.shiftsData || data.records || data.meta || [];
                    }
                }
            }

            let isEmpty = false;
            if (!data || (Array.isArray(data) && data.length === 0)) {
                isEmpty = true;
            } else if (typeof data === 'object' && !Array.isArray(data)) {
                const arrayProps = ['trans', 'records', 'meta', 'verifications', 'master', 'rows'];
                const hasKnownProps = arrayProps.some(prop => data[prop] !== undefined);
                
                if (hasKnownProps) {
                    const allEmpty = arrayProps.every(prop => !data[prop] || (Array.isArray(data[prop]) && data[prop].length === 0));
                    if (allEmpty) isEmpty = true;
                } else if (Object.keys(data).length === 0) {
                    isEmpty = true;
                }
            }

            if (isEmpty) {
                setNotification({ show: true, type: 'error', message: 'No data found for the selected date range.' });
                setLoading(false);
                return;
            }

            const effectiveDateRange = { from: fetchFromDate, to: fetchToDate };

            switch (pdfModal.selectedForm.id) {
                case 'unpoured-mould-details': generateUnPouredMouldPDF(data, dateRange); break;
                case 'dmm-setting-parameters': await generateDmmSettingPDF(data, dateRange); break;
                case 'disa-operator': generateChecklistPDF(data, effectiveDateRange, "DISA MACHINE OPERATOR CHECK SHEET", "Non-Conformance Report"); break;
                case 'lpa': generateChecklistPDF(data, effectiveDateRange, "LAYERED PROCESS AUDIT - BOTTOM LEVEL", "Non-Conformance Report"); break;
                case 'error-proof': generateErrorProofPDF(data, dateRange); break;
                case 'error-proof2': generateErrorProofPDF(data, dateRange); break;
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
    // ==========================================
    // 🔥 COMPONENT HANDLERS
    // ==========================================
    const fetchComponents = async () => {
        setLoadingComponents(true);
        try {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/api/components`);
            setComponents(response.data);
        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to load components' });
        }
        setLoadingComponents(false);
    };

    const handleAddComponent = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${process.env.REACT_APP_API_URL}/api/components/add`, newComponent);
            setNotification({ show: true, type: 'success', message: 'Component added successfully!' });
            setIsAddCompModalOpen(false);
            setNewComponent({ code: "", description: "", pouredWeight: "", cavity: "", castedWeight: "" });
            fetchComponents();
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to add component';
            setNotification({ show: true, type: 'error', message: errorMsg });
        }
    };

    const handleUpdateComponent = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${process.env.REACT_APP_API_URL}/api/components/${encodeURIComponent(editComponent.code)}`, {
                description: editComponent.description,
                pouredWeight: editComponent.pouredWeight,
                cavity: editComponent.cavity,
                castedWeight: editComponent.castedWeight
            });
            setNotification({ show: true, type: 'success', message: 'Component updated successfully!' });
            setIsEditCompModalOpen(false);
            fetchComponents();
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Failed to update component';
            setNotification({ show: true, type: 'error', message: errorMsg });
        }
    };

   const confirmDeleteComponent = (code) => {
        setDeleteModal({ isOpen: true, codeToDelete: code });
    };

    const executeDeleteComponent = async () => {
        const code = deleteModal.codeToDelete;
        setDeleteModal({ isOpen: false, codeToDelete: null }); // Close modal immediately
        
        try {
            await axios.delete(`${process.env.REACT_APP_API_URL}/api/components/${encodeURIComponent(code)}`);
            setNotification({ show: true, type: 'success', message: 'Component deleted successfully!' });
            fetchComponents();
        } catch (error) {
            setNotification({ show: true, type: 'error', message: 'Failed to delete component' });
        }
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

    if (activeView === 'unpoured-config') return (<div className="relative w-full min-h-screen bg-[#2d2d2d]"><ConfigUnpouredMould onBack={() => setActiveView('grid')} /></div>);
    if (activeView === 'disa-config') return (<div className="relative w-full min-h-screen bg-[#2d2d2d]"><ConfigDisaColumns onBack={() => setActiveView('grid')} /></div>);
    if (activeView === '4m-config') return (<div className="relative w-full min-h-screen bg-[#2d2d2d]"><ConfigFourMColumns onBack={() => setActiveView('grid')} /></div>);
    if (activeView === 'dmm-config') return (<div className="relative w-full min-h-screen bg-[#2d2d2d]"><ConfigDmmSetting onBack={() => setActiveView('grid')} /></div>);
    if (activeView === 'ep-config') return (<div className="relative w-full min-h-screen bg-[#2d2d2d]"><ConfigErrorProof onBack={() => setActiveView('grid')} /></div>);
    if (activeView === 'checklist-config') return (<div className="relative w-full min-h-screen bg-[#2d2d2d]"><ConfigDisaChecklist onBack={() => setActiveView('grid')} /></div>);
    if (activeView === 'lpa-config') return (<div className="relative w-full min-h-screen bg-[#2d2d2d]"><ConfigLpa onBack={() => setActiveView('grid')} /></div>);

    // ==========================================
    // 🔥 QF SETTINGS MANAGER UI
    // ==========================================
    if (activeView === 'qf-settings') {
        return (
            <div className="relative w-full min-h-screen bg-[#2d2d2d] flex flex-col font-sans">
                <Header />
                <NotificationToast data={notification} onClose={() => setNotification(prev => ({ ...prev, show: false }))} />

                <div className="flex-1 flex flex-col items-center py-10 px-6 relative z-10">
                    <button
                        onClick={() => setActiveView('grid')}
                        className="self-start mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors bg-[#383838] hover:bg-[#4a4a4a] px-5 py-2.5 rounded-xl border border-[#4a4a4a] hover:border-gray-300 shadow-md font-bold uppercase tracking-wider text-xs"
                    >
                        <ArrowLeft size={16} /> Back to Dashboard
                    </button>

                    <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-4xl rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-gradient-to-r from-orange-600 to-[#ff9100] px-8 py-6 flex items-center gap-4">
                            <div className="bg-black/20 p-3 rounded-xl shadow-inner">
                                <BookOpen size={24} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-white uppercase tracking-widest leading-tight">
                                    Manage QF Document Numbers
                                </h2>
                                <p className="text-white/80 text-xs font-bold tracking-wide mt-1 uppercase">Update footer tracking codes for generated reports</p>
                            </div>
                        </div>

                        <div className="p-8 space-y-6 bg-[#2d2d2d]/50">
                            {qfSettings.length === 0 ? (
                                <div className="text-center text-gray-500 py-10 font-black uppercase tracking-widest text-lg">No QF Settings Found.</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-5">
                                    {qfSettings.map((setting) => (
                                        <div key={setting.formName} className="bg-[#383838] p-5 rounded-xl border border-[#4a4a4a] shadow-inner flex flex-col md:flex-row gap-5 items-end group hover:border-[#ff9100]/50 transition-colors">
                                            <div className="flex-1 w-full">
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-[#ff9100] mb-2">{setting.formName.replace('-', ' ')} - QF Value</label>
                                                <input 
                                                    type="text" 
                                                    value={setting.qfValue} 
                                                    onChange={(e) => handleQfChange(setting.formName, e.target.value)}
                                                    className="w-full bg-[#222] border border-[#4a4a4a] p-3.5 rounded-xl text-gray-200 font-mono text-sm focus:outline-none focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] transition-all shadow-inner"
                                                    placeholder="e.g. QF/07/FBP-03, Rev.No: 02"
                                                />
                                            </div>
                                            <div className="w-full md:w-1/4">
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-[#ff9100] mb-2">Effective Date</label>
                                                <input 
                                                    type="date" 
                                                    value={setting.date ? setting.date.split('T')[0] : ''} 
                                                    onChange={(e) => handleQfDateChange(setting.formName, e.target.value)}
                                                    className="w-full bg-[#222] border border-[#4a4a4a] p-3.5 rounded-xl text-gray-200 font-mono text-sm focus:outline-none focus:border-[#ff9100] focus:ring-1 focus:ring-[#ff9100] transition-all shadow-inner [color-scheme:dark]"
                                                />
                                            </div>
                                            <div className="w-full md:w-auto">
                                                <button 
                                                    onClick={() => handleSaveSingleQfSetting(setting)} 
                                                    disabled={savingId === setting.formName}
                                                    className="w-full md:w-auto bg-[#ff9100] hover:bg-orange-500 text-white font-black text-xs uppercase tracking-wider px-6 py-3.5 rounded-xl transition-all shadow-[0_4px_15px_rgba(255,145,0,0.3)] hover:shadow-[0_4px_20px_rgba(255,145,0,0.5)] flex justify-center items-center gap-2 disabled:opacity-50"
                                                >
                                                    {savingId === setting.formName ? <Loader className="w-4 h-4 animate-spin" /> : <Settings className="w-4 h-4" />}
                                                    Update
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    // ==========================================
    // 🔥 MANAGE COMPONENTS UI
    // ==========================================
    if (activeView === 'components') {
        return (
            <div className="relative w-full min-h-screen bg-[#2d2d2d] flex flex-col font-sans">
                <Header />
                <NotificationToast data={notification} onClose={() => setNotification(prev => ({ ...prev, show: false }))} />

                <div className="flex-1 flex flex-col items-center py-10 px-6 relative z-10">
                    <button onClick={() => setActiveView('grid')} className="self-start mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors bg-[#383838] hover:bg-[#4a4a4a] px-5 py-2.5 rounded-xl border border-[#4a4a4a] hover:border-gray-300 shadow-md font-bold uppercase tracking-wider text-xs">
                        <ArrowLeft size={16} /> Back to Dashboard
                    </button>

                    <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-6xl rounded-2xl p-8 shadow-[0_15px_40px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center border-b border-[#4a4a4a] pb-6 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="bg-blue-900/20 p-3 rounded-xl border border-blue-500/30 shadow-inner">
                                    <Package size={28} className="text-blue-400" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-white uppercase tracking-widest leading-tight">Database Components</h1>
                                    <p className="text-[11px] text-gray-400 font-bold mt-1 uppercase tracking-[0.2em]">Manage Parts & Weights</p>
                                </div>
                            </div>
                            <button onClick={() => setIsAddCompModalOpen(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-[0_4px_15px_rgba(37,99,235,0.3)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.5)] flex items-center gap-2 border border-blue-400">
                                <PlusSquare size={16} /> Add Component
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-[#4a4a4a] shadow-inner bg-[#2d2d2d]">
                            {loadingComponents ? (
                                <div className="flex justify-center items-center py-20">
                                    <Loader className="animate-spin text-blue-500 w-10 h-10" />
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse whitespace-nowrap">
                                    <thead className="bg-[#1A2634] text-gray-300 border-b border-[#4a4a4a]">
                                        <tr>
                                            <th className="p-4 uppercase tracking-widest text-[10px] font-black w-48">Code</th>
                                            <th className="p-4 uppercase tracking-widest text-[10px] font-black">Description</th>
                                            <th className="p-4 uppercase tracking-widest text-[10px] font-black text-center">Poured Wt</th>
                                            <th className="p-4 uppercase tracking-widest text-[10px] font-black text-center">Cavity</th>
                                            <th className="p-4 uppercase tracking-widest text-[10px] font-black text-center">Casted Wt</th>
                                            <th className="p-4 uppercase tracking-widest text-[10px] font-black text-center w-28">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#4a4a4a]">
                                        {components.length > 0 ? (
                                            components.map((c) => (
                                                <tr key={c.code} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-4 font-black text-blue-400 font-mono text-sm tracking-wider">{c.code}</td>
                                                    <td className="p-4 font-bold text-gray-200 text-sm whitespace-normal min-w-[200px]">{c.description}</td>
                                                    <td className="p-4 text-center text-gray-400 font-mono">{c.pouredWeight ? Number(c.pouredWeight).toFixed(3) : '-'}</td>
                                                    <td className="p-4 text-center text-gray-400 font-mono">{c.cavity || '-'}</td>
                                                    <td className="p-4 text-center text-gray-400 font-mono">{c.castedWeight ? Number(c.castedWeight).toFixed(3) : '-'}</td>
                                                    <td className="p-4">
                                                        <div className="flex justify-center gap-3">
                                                            <button onClick={() => { setEditComponent({ ...c }); setIsEditCompModalOpen(true); }} className="bg-[#222] border border-[#4a4a4a] p-2 rounded-lg text-blue-400 hover:text-white hover:bg-blue-600 hover:border-blue-500 transition-all shadow-sm"><Edit size={16} /></button>
                                                            <button onClick={() => confirmDeleteComponent(c.code)} className="bg-[#222] border border-[#4a4a4a] p-2 rounded-lg text-red-500 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all shadow-sm"><Trash2 size={16} /></button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="6" className="text-center p-12 text-gray-500 font-black uppercase tracking-widest">No components found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Modals for Add/Edit Component */}
                    {(isAddCompModalOpen || isEditCompModalOpen) && (
                        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-[#383838] border border-[#4a4a4a] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] w-full max-w-lg overflow-hidden scale-in">
                                <div className={`bg-[#1A2634] px-6 py-5 flex justify-between items-center border-b-2 border-blue-500`}>
                                    <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-3">
                                        {isAddCompModalOpen ? <><PlusSquare size={18} className="text-blue-500" /> Add Component</> : <><Edit size={18} className="text-blue-500" /> Modify Component</>}
                                    </h3>
                                    <button onClick={() => isAddCompModalOpen ? setIsAddCompModalOpen(false) : setIsEditCompModalOpen(false)} className="text-gray-400 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded-lg transition-colors"><X size={18} /></button>
                                </div>
                                <form onSubmit={isAddCompModalOpen ? handleAddComponent : handleUpdateComponent} className="p-7 flex flex-col gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Component Code</label>
                                        <input type="text" required disabled={isEditCompModalOpen} value={isAddCompModalOpen ? newComponent.code : editComponent.code} onChange={(e) => isAddCompModalOpen ? setNewComponent({ ...newComponent, code: e.target.value }) : setEditComponent({ ...editComponent, code: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-bold text-white shadow-inner font-mono disabled:opacity-50" placeholder="e.g. MAR-S-091-..." />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Description</label>
                                        <input type="text" required value={isAddCompModalOpen ? newComponent.description : editComponent.description} onChange={(e) => isAddCompModalOpen ? setNewComponent({ ...newComponent, description: e.target.value }) : setEditComponent({ ...editComponent, description: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-bold text-white shadow-inner" placeholder="Enter description" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Poured Wt</label>
                                            <input type="number" step="0.001" value={isAddCompModalOpen ? newComponent.pouredWeight : editComponent.pouredWeight} onChange={(e) => isAddCompModalOpen ? setNewComponent({ ...newComponent, pouredWeight: e.target.value }) : setEditComponent({ ...editComponent, pouredWeight: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-bold text-white shadow-inner font-mono" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Cavity</label>
                                            <input type="number" value={isAddCompModalOpen ? newComponent.cavity : editComponent.cavity} onChange={(e) => isAddCompModalOpen ? setNewComponent({ ...newComponent, cavity: e.target.value }) : setEditComponent({ ...editComponent, cavity: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-bold text-white shadow-inner font-mono" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Casted Wt</label>
                                            <input type="number" step="0.001" value={isAddCompModalOpen ? newComponent.castedWeight : editComponent.castedWeight} onChange={(e) => isAddCompModalOpen ? setNewComponent({ ...newComponent, castedWeight: e.target.value }) : setEditComponent({ ...editComponent, castedWeight: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] p-3 rounded-xl focus:outline-none focus:border-blue-500 transition-colors font-bold text-white shadow-inner font-mono" />
                                        </div>
                                    </div>
                                    <div className="flex gap-3 mt-4 pt-4 border-t border-[#4a4a4a]">
                                        <button type="button" onClick={() => isAddCompModalOpen ? setIsAddCompModalOpen(false) : setIsEditCompModalOpen(false)} className="flex-1 bg-[#222] border border-[#4a4a4a] hover:bg-[#4a4a4a] text-gray-300 font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-colors">Cancel</button>
                                        <button type="submit" className="flex-1 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg border bg-blue-600 hover:bg-blue-500 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.3)]">
                                            {isAddCompModalOpen ? 'Save Component' : 'Update Record'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
                {/* CUSTOM DELETE CONFIRMATION MODAL */}
                    {deleteModal.isOpen && (
                        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-[#383838] border border-red-500/50 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] w-full max-w-sm overflow-hidden scale-in">
                                <div className="bg-[#2A0D0D] px-6 py-5 border-b-2 border-red-500 flex justify-center items-center">
                                    <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-3">
                                        <AlertTriangle size={20} className="text-red-500" /> Confirm Deletion
                                    </h3>
                                </div>
                                <div className="p-7 text-center">
                                    <p className="text-gray-300 font-bold mb-6">
                                        Are you sure you want to delete this component?
                                        <span className="text-red-400 font-mono block mt-3 text-lg">{deleteModal.codeToDelete}</span>
                                        <span className="text-xs text-gray-500 uppercase tracking-widest mt-3 block">This action cannot be undone.</span>
                                    </p>
                                    <div className="flex gap-3">
                                        <button onClick={() => setDeleteModal({ isOpen: false, codeToDelete: null })} className="flex-1 bg-[#222] border border-[#4a4a4a] hover:bg-[#4a4a4a] text-gray-300 font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-colors">
                                            Cancel
                                        </button>
                                        <button onClick={executeDeleteComponent} className="flex-1 bg-red-600 hover:bg-red-500 border border-red-500 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)]">
                                            Delete Component
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
            </div>
        );
    }
    // ==========================================
    // 🔥 MANAGE USERS UI
    // ==========================================
    if (activeView === 'users') {
        return (
            <div className="relative w-full min-h-screen bg-[#2d2d2d] flex flex-col font-sans">
                <Header />
                <NotificationToast data={notification} onClose={() => setNotification(prev => ({ ...prev, show: false }))} />

                <div className="flex-1 flex flex-col items-center py-10 px-6 relative z-10">
                    <button
                        onClick={() => setActiveView('grid')}
                        className="self-start mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors bg-[#383838] hover:bg-[#4a4a4a] px-5 py-2.5 rounded-xl border border-[#4a4a4a] hover:border-gray-300 shadow-md font-bold uppercase tracking-wider text-xs"
                    >
                        <ArrowLeft size={16} /> Back to Dashboard
                    </button>

                    <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-5xl rounded-2xl p-8 shadow-[0_15px_40px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95">
                        <div className="flex justify-between items-center border-b border-[#4a4a4a] pb-6 mb-6">
                            <div className="flex items-center gap-4">
                                <div className="bg-[#ff9100]/10 p-3 rounded-xl border border-[#ff9100]/30 shadow-inner">
                                    <Users size={28} className="text-[#ff9100]" />
                                </div>
                                <div>
                                    <h1 className="text-2xl font-black text-white uppercase tracking-widest leading-tight">System Users</h1>
                                    <p className="text-[11px] text-gray-400 font-bold mt-1 uppercase tracking-[0.2em]">Manage access & privileges</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="bg-[#ff9100] hover:bg-orange-500 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-[0_4px_15px_rgba(255,145,0,0.3)] hover:shadow-[0_4px_25px_rgba(255,145,0,0.5)] flex items-center gap-2 border border-[#ffaa33]"
                            >
                                <UserPlus size={16} /> Add User
                            </button>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-[#4a4a4a] shadow-inner bg-[#2d2d2d]">
                            {loadingUsers ? (
                                <div className="flex justify-center items-center py-20">
                                    <Loader className="animate-spin text-[#ff9100] w-10 h-10" />
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-[#1A2634] text-gray-300 border-b border-[#4a4a4a]">
                                        <tr>
                                            <th className="p-4 w-32 text-center uppercase tracking-widest text-[10px] font-black">Emp ID</th>
                                            <th className="p-4 uppercase tracking-widest text-[10px] font-black">Username</th>
                                            <th className="p-4 w-48 uppercase tracking-widest text-[10px] font-black">Role Privilege</th>
                                            <th className="p-4 w-32 text-center uppercase tracking-widest text-[10px] font-black">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#4a4a4a]">
                                        {users.length > 0 ? (
                                            users.map((u) => (
                                                <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                                                    <td className="p-4 text-center font-black text-gray-500 font-mono tracking-wider group-hover:text-[#ff9100] transition-colors">{u.employeeId}</td>
                                                    <td className="p-4 font-bold text-gray-200 text-base">{u.username}</td>
                                                    <td className="p-4">
                                                        <span className="bg-[#222] border border-[#4a4a4a] text-gray-300 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-inner">
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex justify-center gap-3">
                                                            <button onClick={() => { setEditUser({ id: u.id, username: u.username, employeeId: u.employeeId, role: u.role }); setIsEditModalOpen(true); }} className="bg-[#222] border border-[#4a4a4a] p-2 rounded-lg text-blue-400 hover:text-white hover:bg-blue-600 hover:border-blue-500 transition-all shadow-sm" title="Edit User">
                                                                <Edit size={16} />
                                                            </button>
                                                            <button onClick={() => handleDeleteUser(u.id)} className="bg-[#222] border border-[#4a4a4a] p-2 rounded-lg text-red-500 hover:text-white hover:bg-red-600 hover:border-red-500 transition-all shadow-sm" title="Delete User">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="text-center p-12 text-gray-500 font-black uppercase tracking-widest">
                                                    No users found in database.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>

                    {/* Modals for Add/Edit User */}
                    {(isAddModalOpen || isEditModalOpen) && (
                        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-[#383838] border border-[#4a4a4a] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] w-full max-w-md overflow-hidden scale-in">
                                <div className={`bg-[#1A2634] px-6 py-5 flex justify-between items-center border-b-2 ${isAddModalOpen ? 'border-[#ff9100]' : 'border-blue-500'}`}>
                                    <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-3">
                                        {isAddModalOpen ? <><UserPlus size={18} className="text-[#ff9100]" /> Add New User</> : <><Edit size={18} className="text-blue-500" /> Modify User</>}
                                    </h3>
                                    <button onClick={() => isAddModalOpen ? setIsAddModalOpen(false) : setIsEditModalOpen(false)} className="text-gray-400 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded-lg transition-colors"><X size={18} /></button>
                                </div>
                                <form onSubmit={isAddModalOpen ? handleAddUser : handleUpdateUser} className="p-7 flex flex-col gap-5">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Username</label>
                                        <input type="text" required value={isAddModalOpen ? newUser.username : editUser.username} onChange={(e) => isAddModalOpen ? setNewUser({ ...newUser, username: e.target.value }) : setEditUser({ ...editUser, username: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] p-3 rounded-xl focus:outline-none focus:border-[#ff9100] transition-colors font-bold text-white shadow-inner" placeholder="Enter username" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Employee ID</label>
                                        <input type="text" required value={isAddModalOpen ? newUser.employeeId : editUser.employeeId} onChange={(e) => isAddModalOpen ? setNewUser({ ...newUser, employeeId: e.target.value }) : setEditUser({ ...editUser, employeeId: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] p-3 rounded-xl focus:outline-none focus:border-[#ff9100] transition-colors font-bold text-white font-mono shadow-inner" placeholder="Enter ID" />
                                    </div>
                                    {isAddModalOpen && (
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Password</label>
                                            <input type="password" required value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] p-3 rounded-xl focus:outline-none focus:border-[#ff9100] transition-colors font-bold text-white shadow-inner" placeholder="Enter secure password" />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Role Privilege</label>
                                        <select required value={isAddModalOpen ? newUser.role : editUser.role} onChange={(e) => isAddModalOpen ? setNewUser({ ...newUser, role: e.target.value }) : setEditUser({ ...editUser, role: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] p-3 rounded-xl focus:outline-none focus:border-[#ff9100] transition-colors font-bold text-white shadow-inner appearance-none">
                                            <option value="" disabled className="text-gray-500">Select Access Level</option>
                                            <option value="operator">Operator</option>
                                            <option value="supervisor">Supervisor</option>
                                            <option value="pp operator">PP Operator</option>
                                            <option value="hof">Head of Foundry (HOF)</option>
                                            <option value="hod">Head of Department (HOD)</option>
                                            <option value="admin">System Admin</option>
                                        </select>
                                    </div>
                                    <div className="flex gap-3 mt-4 pt-4 border-t border-[#4a4a4a]">
                                        <button type="button" onClick={() => isAddModalOpen ? setIsAddModalOpen(false) : setIsEditModalOpen(false)} className="flex-1 bg-[#222] border border-[#4a4a4a] hover:bg-[#4a4a4a] text-gray-300 font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-colors">Cancel</button>
                                        <button type="submit" className={`flex-1 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-lg border ${isAddModalOpen ? 'bg-[#ff9100] hover:bg-orange-500 border-[#ffaa33] shadow-[0_0_15px_rgba(255,145,0,0.3)]' : 'bg-blue-600 hover:bg-blue-500 border-blue-400 shadow-[0_0_15px_rgba(37,99,235,0.3)]'}`}>
                                            {isAddModalOpen ? 'Authorize User' : 'Save Update'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ==========================================
    // 🔥 MAIN DASHBOARD GRID
    // ==========================================
    return (
        <div className="min-h-screen w-full bg-[#2d2d2d] flex flex-col relative font-sans">
            <NotificationToast data={notification} onClose={() => setNotification(prev => ({ ...prev, show: false }))} />

            {/* Subtle Background Radial Glow for Depth */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,145,0,0.03)_0%,transparent_70%)] pointer-events-none"></div>

            <Header />

            <div className="flex-1 flex flex-col items-center px-6 py-12 relative z-10">
                <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h2 className="text-2xl md:text-3xl font-black text-white tracking-[0.2em] uppercase mb-3 drop-shadow-md">
                        Admin Command Center
                    </h2>
                    <div className="w-20 h-1.5 bg-gradient-to-r from-orange-600 via-[#ff9100] to-orange-600 mx-auto rounded-full shadow-[0_0_10px_rgba(255,145,0,0.5)]"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-[1400px] w-full pb-10">
                    {forms.map((form, index) => {
                        const IconComponent = form.icon || Settings;
                        return (
                            <button
                                key={form.id}
                                onClick={() => handleGridClick(form)}
                                style={{ animationDelay: `${index * 40}ms` }}
                                className={`
                                    group relative flex flex-col items-center justify-center p-8 
                                    bg-[#383838] border border-[#4a4a4a] rounded-2xl
                                    shadow-[0_8px_20px_rgba(0,0,0,0.3)]
                                    hover:-translate-y-1.5 active:translate-y-0
                                    transition-all duration-300 ease-out
                                    animate-in fade-in zoom-in-95 fill-mode-both overflow-hidden
                                    ${form.isSpecial 
                                        ? 'hover:border-transparent hover:bg-gradient-to-br hover:from-red-900/80 hover:to-[#0A121C] hover:shadow-[0_15px_30px_rgba(220,38,38,0.2)]' 
                                        : 'hover:border-transparent hover:bg-gradient-to-br hover:from-[#ff9100] hover:to-[#e68200] hover:shadow-[0_15px_30px_rgba(255,145,0,0.3)]'
                                    }
                                `}
                            >
                                <div className={`mb-5 p-4 rounded-full border shadow-inner transition-colors duration-300 
                                    ${form.isSpecial 
                                        ? 'bg-[#2A0D0D] border-red-900/50 group-hover:bg-white/10 group-hover:border-white/20' 
                                        : 'bg-[#2d2d2d] border-[#4a4a4a] group-hover:bg-white/20 group-hover:border-white/30'
                                    }
                                `}>
                                    <IconComponent className={`w-8 h-8 drop-shadow-md transition-colors duration-300
                                        ${form.isSpecial 
                                            ? 'text-red-500 group-hover:text-red-400' 
                                            : 'text-[#ff9100] group-hover:text-white'
                                        }
                                    `} strokeWidth={2.5} />
                                </div>

                                <span className={`text-[14px] font-bold text-center tracking-wide leading-snug drop-shadow-sm transition-colors duration-300
                                    ${form.isSpecial ? 'text-gray-300 group-hover:text-white' : 'text-gray-200 group-hover:text-white'}
                                `}>
                                    {form.name}
                                </span>

                                <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 rounded-t-full transition-all duration-300 opacity-50
                                    ${form.isSpecial ? 'bg-red-500 group-hover:w-1/2' : 'bg-white group-hover:w-1/3'}
                                `}></div>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="h-1.5 w-full bg-gradient-to-r from-orange-600 via-[#ff9100] to-orange-600 relative z-20 shadow-[0_-2px_10px_rgba(255,145,0,0.5)]" />

            {/* ==========================================
                🔥 HARDWARE-STYLED MODALS
            ========================================== */}
            
            {/* ACTION MODAL */}
            {actionModal.show && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-xl rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] overflow-hidden scale-in relative">
                        <div className="h-20 bg-[#1A2634] border-b-2 border-[#ff9100] relative flex items-center justify-center">
                            <h3 className="text-lg font-black text-white uppercase tracking-widest drop-shadow-md flex items-center gap-2">
                                <Settings size={18} className="text-[#ff9100]" /> Module Routing
                            </h3>
                            <button onClick={() => setActionModal({ show: false, selectedForm: null })} className="absolute top-1/2 -translate-y-1/2 right-4 text-gray-400 hover:text-white transition-colors bg-black/20 hover:bg-black/40 p-2 rounded-lg border border-transparent hover:border-gray-500">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="px-8 py-8 flex flex-col items-center gap-6">
                            <div className="bg-[#2d2d2d] border border-[#4a4a4a] w-full p-4 rounded-xl text-center shadow-inner">
                                <p className="text-[10px] font-black text-[#ff9100] uppercase tracking-[0.3em] mb-1">Target Form</p>
                                <h2 className="text-xl font-bold text-white leading-tight">{actionModal.selectedForm.name}</h2>
                            </div>

                            <div className={`grid grid-cols-1 gap-4 w-full ${hideManageFormIds.includes(actionModal.selectedForm.id) ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                                
                                <button onClick={() => openPdfModal(actionModal.selectedForm)} className="group flex flex-col items-center justify-center gap-3 bg-[#2d2d2d] border border-[#4a4a4a] hover:bg-[#1A2634] hover:border-blue-500 p-5 rounded-xl transition-all duration-300 shadow-md">
                                    <div className="bg-[#222] border border-[#4a4a4a] p-3 rounded-lg group-hover:bg-blue-900/30 group-hover:border-blue-500/50 transition-colors shadow-inner">
                                        <FileDown className="w-6 h-6 text-blue-400" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-white font-black uppercase tracking-wider text-xs mb-0.5">Export PDF</div>
                                        <div className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">Bulk Download</div>
                                    </div>
                                </button>
                                
                                <button onClick={() => handleViewByDate(actionModal.selectedForm)} className="group flex flex-col items-center justify-center gap-3 bg-[#2d2d2d] border border-[#4a4a4a] hover:bg-[#1A2634] hover:border-green-500 p-5 rounded-xl transition-all duration-300 shadow-md">
                                    <div className="bg-[#222] border border-[#4a4a4a] p-3 rounded-lg group-hover:bg-green-900/30 group-hover:border-green-500/50 transition-colors shadow-inner">
                                        <Calendar className="w-6 h-6 text-green-400" />
                                    </div>
                                    <div className="text-center">
                                        <div className="text-white font-black uppercase tracking-wider text-xs mb-0.5">View & Edit</div>
                                        <div className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">By Date Record</div>
                                    </div>
                                </button>
                                
                                {!hideManageFormIds.includes(actionModal.selectedForm.id) && (
                                    <button onClick={() => handleManageForm(actionModal.selectedForm)} className="group flex flex-col items-center justify-center gap-3 bg-[#2d2d2d] border border-[#4a4a4a] hover:bg-[#1A2634] hover:border-[#ff9100] p-5 rounded-xl transition-all duration-300 shadow-md">
                                        <div className="bg-[#222] border border-[#4a4a4a] p-3 rounded-lg group-hover:bg-orange-900/30 group-hover:border-[#ff9100]/50 transition-colors shadow-inner">
                                            <Settings className="w-6 h-6 text-[#ff9100]" />
                                        </div>
                                        <div className="text-center">
                                            <div className="text-white font-black uppercase tracking-wider text-xs mb-0.5">Form Setup</div>
                                            <div className="text-gray-500 text-[9px] uppercase font-bold tracking-widest">Edit Parameters</div>
                                        </div>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* DATE PICKER MODAL */}
            {datePickerModal.show && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-sm rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden scale-in">
                        <div className="bg-[#1A2634] px-6 py-5 border-b-2 border-green-500 flex justify-between items-center">
                            <h3 className="font-black text-sm text-white uppercase tracking-widest flex items-center gap-2">
                                <Calendar size={18} className="text-green-500" /> Date Lookup
                            </h3>
                            <button onClick={() => setDatePickerModal({ show: false, selectedForm: null })} className="text-gray-400 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 flex flex-col gap-5">
                            <div className="bg-[#2d2d2d] border border-[#4a4a4a] rounded-xl p-3 text-center shadow-inner">
                                <div className="text-[10px] font-black text-green-500 uppercase tracking-widest mb-1">Editing Form</div>
                                <div className="text-sm font-bold text-white uppercase leading-tight">{datePickerModal.selectedForm?.name}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Target Date</label>
                                <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} className="w-full bg-[#222] border border-[#4a4a4a] rounded-xl p-3 text-white focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all cursor-pointer font-bold shadow-inner [color-scheme:dark]" />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setDatePickerModal({ show: false, selectedForm: null })} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-gray-300 hover:text-white bg-[#222] border border-[#4a4a4a] hover:bg-[#4a4a4a] rounded-xl transition-all shadow-sm">Cancel</button>
                                <button disabled={!viewDate} onClick={() => { setAdminEditView({ form: datePickerModal.selectedForm, date: viewDate }); setDatePickerModal({ show: false, selectedForm: null }); }} className="flex-[1.5] bg-green-600 hover:bg-green-500 border border-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(22,163,74,0.3)]">
                                    <Eye className="w-4 h-4" /> Load Record
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PDF MODAL */}
            {pdfModal.show && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-[#383838] border border-[#4a4a4a] w-full max-w-md rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.8)] overflow-hidden scale-in">
                        <div className="bg-[#1A2634] px-6 py-5 border-b-2 border-blue-500 flex justify-between items-center">
                            <h3 className="font-black text-sm text-white uppercase tracking-widest flex items-center gap-2">
                                <FileDown size={18} className="text-blue-500" /> Export Records
                            </h3>
                            <button onClick={() => setPdfModal({ show: false, selectedForm: null })} className="text-gray-400 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 flex flex-col gap-5">
                            <div className="bg-[#2d2d2d] border border-[#4a4a4a] rounded-xl p-3 text-center shadow-inner">
                                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Target Report</div>
                                <div className="text-sm font-bold text-white uppercase leading-tight">{pdfModal.selectedForm.name}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Start Date</label>
                                    <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer font-bold shadow-inner [color-scheme:dark]" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">End Date</label>
                                    <input type="date" value={dateRange.to} min={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="w-full bg-[#222] border border-[#4a4a4a] rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer font-bold shadow-inner [color-scheme:dark]" />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setPdfModal({ show: false, selectedForm: null })} className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-gray-300 hover:text-white bg-[#222] border border-[#4a4a4a] hover:bg-[#4a4a4a] rounded-xl transition-all shadow-sm">Cancel</button>
                                <button onClick={handleDownloadPDF} disabled={loading} className="flex-[1.5] bg-blue-600 hover:bg-blue-500 border border-blue-500 text-white font-black text-xs uppercase tracking-widest py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(37,99,235,0.3)] disabled:opacity-70 disabled:cursor-not-allowed">
                                    {loading ? <Loader className="animate-spin w-4 h-4" /> : <FileDown className="w-4 h-4" />}
                                    {loading ? 'Processing' : 'Generate PDF'}
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
      `}} />
        </div>
    );
};

export default AdminDashboard;