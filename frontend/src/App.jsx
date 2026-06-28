import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import {
  Sun, Moon, Package, UploadCloud, DownloadCloud, Plus, Trash2,
  User, Activity, Play, X, LogOut, Shield, Settings, Check,
  Lock, Unlock, FileText, Users, KeyRound, AlertTriangle, ShieldCheck
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import AuditTable from './components/AuditTable';
import DetailsPanel from './components/DetailsPanel';
import ExtraFoundForm from './components/ExtraFoundForm';
import AuditTrail from './components/AuditTrail';
import Login from './components/Login';
import QuickAddPage from './components/QuickAddPage';
import GlassSelect from './components/GlassSelect';

const API_BASE = import.meta.env.VITE_API_URL || '';
axios.defaults.baseURL = API_BASE;

// Role → column name mapping
const ROLE_TO_AUDITOR = {
  'Admin': 'Admin',
  'User1': 'User1',
  'User2': 'User2',
  'User3': 'User3',
  'User4': 'User4',
};

const AUDITOR_COLUMNS = ['Admin', 'User1', 'User2', 'User3', 'User4'];

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState(null);

  // Theme
  const [isDark, setIsDark] = useState(false);

  // Audit Session States
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // File Upload State
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  // Active Tab
  const [activeTab, setActiveTab] = useState('dashboard');

  // Items and Table States
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(30);

  // Table filters
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [meta, setMeta] = useState({ suppliers: [], locations: [], stores: [] });

  // Drawer / Side Panel
  const [selectedItem, setSelectedItem] = useState(null);

  // Dashboard Stats
  const [dashboardMetrics, setDashboardMetrics] = useState(null);

  // General Trail
  const [generalTrail, setGeneralTrail] = useState([]);

  // Loading flags
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingTrail, setIsLoadingTrail] = useState(false);

  // Sync
  const [syncEnabled, setSyncEnabled] = useState(true);

  // Admin panels
  const [showUserMgmt, setShowUserMgmt] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [roleNamesMap, setRoleNamesMap] = useState({});
  const [newUserForm, setNewUserForm] = useState({ username: '', name: '', password: '' });
  const [pwdChangeTarget, setPwdChangeTarget] = useState({ id: null, username: '', name: '', password: '' });
  const [userMgmtMsg, setUserMgmtMsg] = useState('');

  // Session delete modal
  const [deleteSessionTarget, setDeleteSessionTarget] = useState(null); // { id, name }
  const [deleteSessionInput, setDeleteSessionInput] = useState('');
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Apply dark/light class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

  // Restore login from localStorage on boot
  useEffect(() => {
    const saved = localStorage.getItem('auditUser');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        setCurrentUser(user);
        // Inject auth headers
        axios.defaults.headers.common['x-user-role'] = user.role;
        axios.defaults.headers.common['x-user-name'] = user.name;
      } catch (_) { }
    }
  }, []);

  // Fetch sessions once logged in
  useEffect(() => {
    if (currentUser) {
      fetchSessions();
      fetchRoleNamesMap();
    }
  }, [currentUser]);

  // Fetch items and dashboard when session/filters change
  useEffect(() => {
    if (activeSession && currentUser) {
      fetchItems();
      fetchDashboardMetrics();
      fetchGeneralTrail();
    } else {
      setItems([]);
      setTotalItems(0);
      setDashboardMetrics(null);
      setGeneralTrail([]);
    }
  }, [activeSession, currentPage, search, filter, supplierFilter, locationFilter, storeFilter]);

  // Periodic sync
  useEffect(() => {
    if (!activeSession || !syncEnabled || !currentUser) return;
    const id = setInterval(() => {
      fetchItems(true);
      fetchDashboardMetrics(true);
      if (activeTab === 'trail') fetchGeneralTrail(true);
    }, 5000);
    return () => clearInterval(id);
  }, [activeSession, syncEnabled, activeTab, currentPage, search, filter, supplierFilter, locationFilter, storeFilter, currentUser]);

  // Clear selected item when active tab changes
  useEffect(() => {
    setSelectedItem(null);
  }, [activeTab]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem('auditUser', JSON.stringify(user));
    axios.defaults.headers.common['x-user-role'] = user.role;
    axios.defaults.headers.common['x-user-name'] = user.name;
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('auditUser');
    delete axios.defaults.headers.common['x-user-role'];
    delete axios.defaults.headers.common['x-user-name'];
    setActiveSession(null);
    setSessions([]);
  };

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await axios.get('/api/audits');
      setSessions(res.data);
      if (res.data.length > 0 && !activeSession) {
        setActiveSession(res.data[0]);
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchItems = async (isSilent = false) => {
    if (!activeSession) return;
    if (!isSilent) setIsLoadingItems(true);
    try {
      const res = await axios.get(`/api/audits/${activeSession.id}/items`, {
        params: { page: currentPage, limit, search, filter, supplier: supplierFilter, location: locationFilter, store: storeFilter }
      });
      setItems(res.data.items);
      setTotalItems(res.data.total);
      setMeta(res.data.meta);
      if (selectedItem) {
        const updated = res.data.items.find(i => i.id === selectedItem.id);
        if (updated) setSelectedItem(updated);
      }
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      if (!isSilent) setIsLoadingItems(false);
    }
  };

  const fetchDashboardMetrics = async (isSilent = false) => {
    if (!activeSession) return;
    if (!isSilent) setIsLoadingDashboard(true);
    try {
      const res = await axios.get(`/api/audits/${activeSession.id}/dashboard`);
      setDashboardMetrics(res.data);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      if (!isSilent) setIsLoadingDashboard(false);
    }
  };

  const fetchGeneralTrail = async (isSilent = false) => {
    if (!activeSession) return;
    if (!isSilent) setIsLoadingTrail(true);
    try {
      const res = await axios.get(`/api/audits/${activeSession.id}/trail`);
      setGeneralTrail(res.data);
    } catch (err) {
      console.error('Failed to load trail:', err);
    } finally {
      if (!isSilent) setIsLoadingTrail(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newSessionName) return;
    try {
      const res = await axios.post('/api/audits', { name: newSessionName, audit_date: newSessionDate });
      setNewSessionName('');
      setIsCreatingSession(false);
      await fetchSessions();
      setActiveSession(res.data);
      setActiveTab('sheet');
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleDeleteSession = (id, name) => {
    setDeleteSessionTarget({ id, name });
    setDeleteSessionInput('');
  };

  const confirmDeleteSession = async () => {
    if (!deleteSessionTarget) return;
    setIsDeletingSession(true);
    try {
      await axios.delete(`/api/audits/${deleteSessionTarget.id}`);
      setActiveSession(null);
      setDeleteSessionTarget(null);
      setDeleteSessionInput('');
      await fetchSessions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete session.');
    } finally {
      setIsDeletingSession(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!activeSession) return;
    const newStatus = activeSession.status === 'Active' ? 'Completed' : 'Active';
    const confirmMsg = newStatus === 'Completed'
      ? 'Mark this audit as COMPLETED? No one except Admin will be able to make changes.'
      : 'Re-open this audit to Active status?';
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await axios.put(`/api/audits/${activeSession.id}/status`, { status: newStatus });
      setActiveSession(res.data);
      await fetchSessions();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update status.');
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile || !activeSession) return;
    setIsUploading(true);
    setUploadStatus('Uploading file...');
    const formData = new FormData();
    formData.append('file', uploadFile);
    try {
      const res = await axios.post(`/api/audits/${activeSession.id}/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadStatus(`✓ Imported successfully: ${res.data.imported_rows} rows added!`);
      setUploadFile(null);
      fetchItems();
      fetchDashboardMetrics();
    } catch (err) {
      setUploadStatus(err.response?.data?.error || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  // Admin: fetch all users
  const fetchAllUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      setAllUsers(res.data);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const fetchRoleNamesMap = async () => {
    try {
      const res = await axios.get('/api/users/public-map');
      setRoleNamesMap(res.data);
    } catch (err) {
      console.error('Failed to load role names map:', err);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserMgmtMsg('');

    // Auto-assign the next available auditor role from User1 to User4
    const activeRoles = allUsers.map(u => u.role);
    let assignedRole = 'User1';
    for (let i = 1; i <= 4; i++) {
      const rName = `User${i}`;
      if (!activeRoles.includes(rName)) {
        assignedRole = rName;
        break;
      }
    }

    try {
      await axios.post('/api/users', {
        ...newUserForm,
        role: assignedRole
      });
      setNewUserForm({ username: '', name: '', password: '' });
      setUserMgmtMsg('User created successfully.');
      fetchAllUsers();
      fetchRoleNamesMap();
    } catch (err) {
      setUserMgmtMsg(err.response?.data?.error || 'Failed to create user.');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await axios.delete(`/api/users/${id}`);
      setUserMgmtMsg('User deleted.');
      fetchAllUsers();
      fetchRoleNamesMap();
    } catch (err) {
      setUserMgmtMsg(err.response?.data?.error || 'Failed to delete user.');
    }
  };

  const handleUpdateUserDetails = async (userId) => {
    try {
      await axios.put(`/api/users/${userId}`, {
        username: pwdChangeTarget.username,
        name: pwdChangeTarget.name,
        password: pwdChangeTarget.password
      });
      setUserMgmtMsg('User details updated successfully.');
      setPwdChangeTarget({ id: null, username: '', name: '', password: '' });
      fetchAllUsers();
      fetchRoleNamesMap();
    } catch (err) {
      setUserMgmtMsg(err.response?.data?.error || 'Failed to update user details.');
    }
  };

  const isAdmin = currentUser?.role === 'Admin';
  const auditIsLocked = activeSession?.status === 'Completed' && !isAdmin;
  const userAuditorColumn = ROLE_TO_AUDITOR[currentUser?.role];

  // Show login if not authenticated
  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen font-sans transition-colors duration-200" style={{ color: 'var(--text-primary)' }}>

      {/* App Header — Apple-grade frosted glass navbar */}
      <header className="sticky top-0 z-30 transition-all" style={ isDark ? { 
        background: 'rgba(22,22,24,0.88)', 
        backdropFilter: 'blur(28px) saturate(1.8)', 
        WebkitBackdropFilter: 'blur(28px) saturate(1.8)', 
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 1px 24px rgba(0,0,0,0.45)'
      } : { 
        background: 'rgba(255,255,255,0.82)', 
        backdropFilter: 'blur(28px) saturate(2)', 
        WebkitBackdropFilter: 'blur(28px) saturate(2)', 
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.8) inset, 0 1px 16px rgba(0,0,0,0.06)'
      }}>
        <div className="max-w-[1600px] mx-auto px-2 sm:px-4 py-2 flex justify-between items-center w-full gap-1.5 sm:gap-2">

          {/* Title */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="p-1.5 rounded-lg" style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)', boxShadow: '0 2px 8px rgba(0,122,255,0.25)' }}>
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Auditing</h1>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap">

            {/* ── Session Selector Group ── */}
            <div style={{ position: 'relative' }}>
              <GlassSelect
                compact
                value={activeSession?.id?.toString() || ''}
                onChange={(v) => {
                  const sess = sessions.find(s => s.id === parseInt(v));
                  if (sess) { setActiveSession(sess); setCurrentPage(1); }
                }}
                options={sessions.length === 0
                  ? [{ value: '', label: 'No Sessions' }]
                  : sessions.map(s => ({
                      value: s.id.toString(),
                      label: s.name,
                      dot: s.status === 'Completed' ? '#34C759' : '#007AFF'
                    }))
                }
                placeholder="Select Session"
                className=""
              />
            </div>

            {/* New Session (Separated for clean, standalone alignment) */}
            {isAdmin && (
              <button
                onClick={() => setIsCreatingSession(true)}
                className="flex items-center justify-center gap-1 px-1.5 sm:px-3 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 cursor-pointer shrink-0"
                style={{
                  background: 'var(--accent-light)',
                  border: '1px solid rgba(0,122,255,0.2)',
                  color: 'var(--accent)',
                  height: '28px',
                  minWidth: '28px',
                  lineHeight: '1',
                  boxSizing: 'border-box'
                }}
                title="New Audit Session"
              >
                <Plus className="h-3 w-3" />
                <span className="hidden sm:inline">New</span>
              </button>
            )}

            {/* ── Divider ── */}
            <div className="h-5 w-px mx-0.5 hidden sm:block" style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }} />

            {/* ── User Badge ── */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs" style={{
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.07)'
            }}>
              <div className="h-4.5 w-4.5 rounded-full flex items-center justify-center text-white text-[8px] font-extrabold" style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}>
                {currentUser.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="font-semibold hidden sm:inline" style={{ color: 'var(--text-primary)' }}>{currentUser.name}</span>
              <span className="px-1 py-0.5 rounded text-[9px] font-bold hidden sm:inline" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                {currentUser.role}
              </span>
            </div>

            {/* ── Action Buttons ── */}
            <div className="flex items-center gap-1.5 flex-nowrap shrink-0">

              {/* Admin: User Management */}
              {isAdmin && (
                <button
                  onClick={() => { setActiveTab(activeTab === 'user-mgmt' ? 'sheet' : 'user-mgmt'); fetchAllUsers(); }}
                  className="flex items-center justify-center gap-1 px-2.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer"
                  style={activeTab === 'user-mgmt'
                    ? { background: 'var(--accent-light)', border: '1px solid var(--accent)', color: 'var(--accent)', height: '28px', minWidth: '28px', boxSizing: 'border-box' }
                    : { background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.07)', color: 'var(--text-secondary)', height: '28px', minWidth: '28px', boxSizing: 'border-box' }}
                  title="Manage Users"
                >
                  <Users style={{ width: 14, height: 14 }} className="shrink-0" />
                  <span className="hidden sm:inline">Users</span>
                </button>
              )}

              {/* Theme Toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                className="flex items-center justify-center gap-1 px-2.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer"
                style={{ 
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', 
                  border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.07)', 
                  color: 'var(--text-secondary)', 
                  height: '28px', 
                  minWidth: '28px',
                  boxSizing: 'border-box'
                }}
                title={isDark ? 'Light Mode' : 'Dark Mode'}
              >
                {isDark ? (
                  <>
                    <Sun style={{ width: 14, height: 14 }} className="shrink-0 text-amber-400" />
                    <span className="hidden sm:inline text-amber-400">Light</span>
                  </>
                ) : (
                  <>
                    <Moon style={{ width: 14, height: 14 }} className="shrink-0" />
                    <span className="hidden sm:inline">Dark</span>
                  </>
                )}
              </button>

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-1 px-2.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer"
                style={{ 
                  background: 'rgba(255,59,48,0.07)', 
                  border: '1px solid rgba(255,59,48,0.20)', 
                  color: '#FF3B30', 
                  height: '28px', 
                  minWidth: '28px',
                  boxSizing: 'border-box'
                }}
                title="Sign Out"
              >
                <LogOut style={{ width: 14, height: 14 }} className="shrink-0" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>

            </div>
          </div>
        </div>
      </header>

      {/* Create Session Modal */}
      {isCreatingSession && isAdmin && (
        <div className="fixed inset-0 flex justify-center items-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}>
          <div 
            style={{
              width: '100%',
              maxWidth: '400px',
              animation: 'dropdown-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
              background: isDark ? 'var(--glass-bg-heavy)' : '#ffffff',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
              borderRadius: '20px',
              padding: '28px 28px 24px 28px',
              position: 'relative'
            }}
          >
            <button
              onClick={() => setIsCreatingSession(false)}
              className="absolute right-4 top-4 p-1.5 rounded-xl transition-colors cursor-pointer"
              style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)', color: 'var(--text-tertiary)' }}
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Start New Audit Session</h3>
            <p className="text-[11px] mb-5" style={{ color: 'var(--text-tertiary)' }}>Fill in the details to begin a new stock audit cycle.</p>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Session Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kukatpally June 2026"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="glass-input w-full text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Audit Reference Date</label>
                <input
                  type="date"
                  required
                  value={newSessionDate}
                  onChange={(e) => setNewSessionDate(e.target.value)}
                  className="glass-input w-full text-sm px-3.5 py-2.5 rounded-xl focus:outline-none"
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <button type="submit" className="btn-glass-primary w-full flex justify-center items-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl" style={{ marginTop: '8px' }}>
                <Play className="h-4 w-4" /> Launch Audit
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Unified Main Content Area */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4" style={{ color: 'var(--text-primary)' }}>
        
        {/* Session Controls Bar */}
        {activeSession && (
          <div className="panel-card rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1 w-full md:w-auto">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-bold text-zinc-950 dark:text-zinc-50">{activeSession.name}</span>
                {/* Status Badge */}
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${activeSession.status === 'Completed'
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40'
                  }`}>
                  {activeSession.status === 'Completed' ? '🔒 COMPLETED' : '🟢 ACTIVE'}
                </span>
                {auditIsLocked && (
                  <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                    <AlertTriangle className="h-3 w-3" /> Read-only
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Ref Date: {activeSession.audit_date} · ID: #{activeSession.id}</p>
            </div>

            {/* Action Buttons Tray - Wrapped on mobile for full visibility, row on desktop */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto py-0.5">

              {/* Admin: Status Toggle */}
              {isAdmin && (
                <button
                  onClick={handleToggleStatus}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-lg transition-colors shrink-0 ${activeSession.status === 'Completed'
                    ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/30'
                    : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/30'
                    }`}
                >
                  {activeSession.status === 'Completed' ? <><Unlock className="h-3.5 w-3.5" /> Re-open</> : <><Lock className="h-3.5 w-3.5" /> Complete</>}
                </button>
              )}

              {/* Admin: Import Excel */}
              {isAdmin && (
                <form onSubmit={handleFileUpload} className="flex items-center gap-2 shrink-0">
                  <label
                    className="cursor-pointer flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors"
                    style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)', color: 'var(--text-secondary)' }}
                  >
                    <UploadCloud className="h-3.5 w-3.5" />
                    {uploadFile ? uploadFile.name.substring(0, 15) + '...' : 'Import'}
                    <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files.length > 0) { setUploadFile(e.target.files[0]); setUploadStatus(''); } }} />
                  </label>
                  {uploadFile && (
                    <button
                      type="submit"
                      disabled={isUploading}
                      className="px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-50"
                      style={{ background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }}
                    >
                      {isUploading ? '...' : 'Upload'}
                    </button>
                  )}
                </form>
              )}
              {uploadStatus && <span className={`text-xs font-medium px-2 shrink-0 ${uploadStatus.startsWith('✓') ? 'text-emerald-400' : 'text-rose-400'}`}>{uploadStatus}</span>}

              {/* Export Excel */}
              <a
                href={`${API_BASE}/api/audits/${activeSession.id}/export`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all shrink-0"
                style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.25)', color: '#34C759' }}
                download
              >
                <DownloadCloud className="h-3.5 w-3.5" /> Excel <span className="hidden sm:inline">Report</span>
              </a>

              {/* Export Word */}
              <a
                href={`${API_BASE}/api/audits/${activeSession.id}/export/word`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all shrink-0"
                style={{ background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.25)', color: '#007AFF' }}
                download
              >
                <FileText className="h-3.5 w-3.5" /> Word <span className="hidden sm:inline">Report</span>
              </a>

              {/* Admin: Delete Session */}
              {isAdmin && (
                <button onClick={() => handleDeleteSession(activeSession.id, activeSession.name)} className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/20 text-rose-500 transition-colors" title="Delete Session">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Apple Segmented control */}
        {activeSession && (
          <div className="w-full overflow-hidden py-1.5">
            <div className="flex p-1 rounded-2xl overflow-x-auto flex-nowrap scrollbar-none gap-0.5 max-w-full" style={{ 
              background: isDark ? 'rgba(44,44,46,0.90)' : 'rgba(240,240,245,0.85)', 
              backdropFilter: 'blur(16px)', 
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.07)',
              boxShadow: isDark ? '0 1px 0 rgba(255,255,255,0.05) inset, 0 2px 12px rgba(0,0,0,0.35)' : '0 1px 0 rgba(255,255,255,0.9) inset, 0 1px 8px rgba(0,0,0,0.05)'
            }}>
              {[
                { id: 'dashboard', label: '📊 Dashboard' },
                { id: 'sheet', label: '📋 Audit Sheet' },
                { id: 'quick-add', label: '⚡ Add Data' },
                ...(isAdmin ? [{ id: 'extra', label: '➕ Extra Found' }] : []),
                { id: 'history', label: '📂 Audit History' },
                { id: 'trail', label: '⏱️ Audit Trail' },
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (tab.id === 'user-mgmt') fetchAllUsers();
                      setSelectedItem(null);
                      setActiveTab(tab.id);
                    }}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 shrink-0 ${isActive ? 'tab-active-glow' : ''}`}
                    style={isActive
                      ? isDark
                        ? { background: 'rgba(72,72,76,1)', color: '#f5f5f7', boxShadow: '0 2px 8px rgba(0,0,0,0.40), 0 1px 0 rgba(255,255,255,0.10) inset', border: '1px solid rgba(255,255,255,0.10)' }
                        : { background: '#ffffff', color: '#1d1d1f', boxShadow: '0 2px 8px rgba(0,0,0,0.10), 0 1px 0 rgba(255,255,255,1) inset', border: '1px solid rgba(0,0,0,0.06)' }
                      : { color: isDark ? 'rgba(235,235,245,0.55)' : 'var(--text-tertiary)', border: '1px solid transparent' }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Area */}
        {!activeSession ? (
          <div className="flex justify-center items-start pt-8">
            <div
              style={{
                width: '100%',
                maxWidth: '400px',
                background: isDark ? 'var(--glass-bg-heavy)' : '#ffffff',
                border: '1px solid var(--glass-border)',
                borderRadius: '20px',
                padding: '40px 32px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                textAlign: 'center',
              }}
            >
              <div style={{
                width: 56, height: 56,
                borderRadius: '16px',
                background: isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <Package className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
              </div>
              <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No Active Audit Session</h3>
              <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {isAdmin ? 'Create an audit session to begin.' : 'Ask your administrator to start or select an audit session.'}
              </p>
              {isAdmin && (
                <button onClick={() => setIsCreatingSession(true)} className="btn-glass-primary inline-flex justify-center items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl">
                  <Plus className="h-4 w-4" /> Create Audit Session
                </button>
              )}
            </div>
          </div>

        ) : activeTab === 'user-mgmt' && isAdmin ? (
          <div className="space-y-6">
            <div className="pb-4" style={{ borderBottom: '1px solid var(--glass-border-dim)' }}>
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>User Management</h3>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{allUsers.length} registered users · Admin access only</p>
            </div>
            
            {userMgmtMsg && (
              <div className={`p-3 rounded-xl text-xs border ${
                userMgmtMsg.includes('success') || userMgmtMsg.includes('created') || userMgmtMsg.includes('updated') || userMgmtMsg.includes('deleted')
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40'
                  : 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40'
              }`}>
                {userMgmtMsg}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Users List */}
              <div className="lg:col-span-2 glass rounded-2xl overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--glass-border-dim)' }}>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Registered Users</h2>
                  <span className="text-xs text-zinc-400 font-mono">{allUsers.length} total</span>
                </div>
                <div>
                  {allUsers.map((u, idx) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between px-4 py-3 cursor-pointer select-none group transition-colors"
                      style={{ background: 'transparent' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => setPwdChangeTarget(pwdChangeTarget.id === u.id ? { id: null, username: '', name: '', password: '' } : { id: u.id, username: u.username || '', name: u.name || '', password: '' })}
                    >
                      <div className="flex items-center gap-3">
                        {/* SF-style avatar: system gray circle with initial */}
                        <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0" style={{ background: '#636366' }}>
                          {u.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="text-[14px] font-medium" style={{ color: 'var(--text-primary)', fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif', letterSpacing: '-0.01em' }}>{u.name}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>@{u.username}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>{u.role}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* iOS-style chevron */}
                        <svg className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: '#C7C7CC' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.id); }}
                          className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          style={{ color: '#FF3B30' }}
                          title="Delete User"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Create New User */}
              <div className="glass rounded-2xl p-5">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-500" /> Add New User
                </h2>
                <form onSubmit={handleCreateUser} className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">Username</label>
                    <input placeholder="e.g. john_doe" required value={newUserForm.username} onChange={e => setNewUserForm({ ...newUserForm, username: e.target.value })} className="w-full text-xs px-3 py-2 glass-input focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">Display Name</label>
                    <input placeholder="e.g. John Doe" required value={newUserForm.name} onChange={e => setNewUserForm({ ...newUserForm, name: e.target.value })} className="w-full text-xs px-3 py-2 glass-input focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1 block">Password</label>
                    <input type="password" placeholder="••••••••" required value={newUserForm.password} onChange={e => setNewUserForm({ ...newUserForm, password: e.target.value })} className="w-full text-xs px-3 py-2 glass-input focus:outline-none" />
                  </div>
                  <button type="submit" className="w-full mt-1 px-4 py-2 text-xs font-bold btn-glass-primary flex items-center justify-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Create User
                  </button>
                </form>
              </div>
            </div>

            {/* ── Edit User Modal — Dark Frosted Glass ── */}
            {pwdChangeTarget.id && (() => {
              const editUser = allUsers.find(u => u.id === pwdChangeTarget.id);
              const initial = editUser?.name?.charAt(0)?.toUpperCase() || '?';
              const roleColors = {
                Admin: '#0A84FF',
                User1: '#5E5CE6',
                User2: '#30B0C7',
                User3: '#64D2FF'
              };
              const avatarColor = roleColors[editUser?.role] || '#5E5CE6';

              return (
                <div
                  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
                  onClick={() => setPwdChangeTarget({ id: null, username: '', name: '', password: '' })}
                >
                  <div
                    className="w-full rounded-t-3xl sm:rounded-3xl overflow-hidden"
                    style={{
                      animation: 'dropdown-in 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                      background: isDark ? 'var(--glass-bg-heavy)' : '#ffffff',
                      border: isDark ? '1px solid var(--glass-border)' : '1px solid rgba(0, 0, 0, 0.08)',
                      boxShadow: '0 24px 64px rgba(0, 0, 0, 0.16), 0 8px 24px rgba(0, 0, 0, 0.08)',
                      maxWidth: '340px',
                      margin: '0 auto'
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* ── Title bar ── */}
                    <div
                      className="pt-5 pb-4 px-5 flex items-center justify-between"
                      style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}
                    >
                      <button
                        onClick={() => setPwdChangeTarget({ id: null, username: '', name: '', password: '' })}
                        className="text-sm font-semibold transition-opacity hover:opacity-60"
                        style={{ color: '#FF3B30' }}
                      >
                        Cancel
                      </button>
                      <span className="text-sm font-bold" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
                        Edit User
                      </span>
                      <button
                        onClick={() => handleUpdateUserDetails(pwdChangeTarget.id)}
                        className="text-sm font-bold transition-opacity hover:opacity-75"
                        style={{ color: '#007AFF' }}
                      >
                        Save
                      </button>
                    </div>

                    {/* ── Avatar hero ── */}
                    <div
                      className="flex flex-col items-center pt-7 pb-6"
                      style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}
                    >
                      {/* Avatar circle */}
                      <div style={{
                        width: 76, height: 76, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #ffffff 0%, #fafafa 100%)',
                        border: '1.5px solid rgba(0, 0, 0, 0.06)',
                        boxShadow: '0 0 0 4px #ffffff, 0 8px 20px rgba(0, 0, 0, 0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 30, fontWeight: 700, color: '#1d1d1f',
                        position: 'relative',
                        letterSpacing: '-0.02em',
                        marginBottom: 12
                      }}>
                        {initial}
                      </div>

                      <div className="text-base font-bold" style={{ color: '#1d1d1f', letterSpacing: '-0.02em' }}>
                        {editUser?.name}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: '#86868b' }}>
                        @{editUser?.username}
                      </div>
                      {/* Role pill */}
                      <div
                        className="mt-3 text-[10px] font-bold px-3 py-1 rounded-full"
                        style={{
                          background: 'rgba(0, 122, 255, 0.05)',
                          color: '#007AFF',
                          border: '1px solid rgba(0, 122, 255, 0.12)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {editUser?.role}
                      </div>
                    </div>

                    {/* ── Form fields ── */}
                    <div className="px-4 py-4 space-y-2.5">
                      {/* Group 1 */}
                      <div
                        className="rounded-2xl overflow-hidden"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.09)' : '1.5px solid rgba(0, 0, 0, 0.06)',
                        }}
                      >
                        {[
                          { label: 'Name', field: 'name', type: 'text', placeholder: 'Display Name' },
                          { label: 'Username', field: 'username', type: 'text', placeholder: 'username' },
                        ].map(({ label, field, type, placeholder }, i, arr) => (
                          <div
                            key={field}
                            className="flex items-center px-4"
                            style={{
                              padding: '12px 16px',
                              background: 'transparent',
                              borderBottom: i < arr.length - 1 
                                ? (isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.04)') 
                                : 'none',
                            }}
                          >
                            <span className="text-xs font-semibold w-24 shrink-0" style={{ color: isDark ? 'var(--text-secondary)' : '#515154' }}>
                              {label}
                            </span>
                            <input
                              type={type}
                              placeholder={placeholder}
                              value={pwdChangeTarget[field]}
                              onChange={(e) => setPwdChangeTarget({ ...pwdChangeTarget, [field]: e.target.value })}
                              className="flex-1 text-sm bg-transparent border-none outline-none text-right"
                              style={{ color: 'var(--text-primary)', caretColor: '#007AFF' }}
                              autoComplete="off"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Group 2 — Password */}
                      <div
                        className="rounded-2xl overflow-hidden"
                        style={{
                          background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.09)' : '1.5px solid rgba(0, 0, 0, 0.06)',
                        }}
                      >
                        <div className="flex items-center px-4" style={{ padding: '12px 16px', background: 'transparent' }}>
                          <span className="text-xs font-semibold w-24 shrink-0" style={{ color: isDark ? 'var(--text-secondary)' : '#515154' }}>
                            New Password
                          </span>
                          <input
                            type="password"
                            placeholder="optional"
                            value={pwdChangeTarget.password}
                            onChange={(e) => setPwdChangeTarget({ ...pwdChangeTarget, password: e.target.value })}
                            className="flex-1 text-sm bg-transparent border-none outline-none text-right"
                            style={{ color: 'var(--text-primary)', caretColor: '#007AFF' }}
                            autoComplete="new-password"
                          />
                        </div>
                      </div>

                      {/* Save button */}
                      <button
                        onClick={() => handleUpdateUserDetails(pwdChangeTarget.id)}
                        className="w-full flex justify-center items-center gap-2 py-3 text-sm font-bold rounded-2xl transition-all mt-1"
                        style={{
                          background: 'linear-gradient(180deg, #1a8fff 0%, #0071e3 100%)',
                          color: '#ffffff',
                          boxShadow: '0 1px 0 rgba(255,255,255,0.25) inset, 0 4px 14px rgba(0,113,227,0.35)',
                          border: 'none',
                          letterSpacing: '-0.01em',
                        }}
                        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(1.08)'}
                        onMouseLeave={e => e.currentTarget.style.filter = 'brightness(1)'}
                      >
                        <Check className="h-4 w-4" /> Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : activeTab === 'quick-add' ? (

          <QuickAddPage
            sessionId={activeSession.id}
            currentUser={currentUser}
            auditIsLocked={auditIsLocked}
            onUpdate={() => { fetchItems(); fetchDashboardMetrics(); }}
          />
        ) : (
          <div className="flex flex-col lg:flex-row gap-5 relative items-start w-full">
            {/* Left Content */}
            <div className={`transition-all duration-300 ${selectedItem ? 'w-full lg:w-2/3' : 'w-full'}`}>
              {activeTab === 'dashboard' && (
                <Dashboard metrics={dashboardMetrics} isDark={isDark} />
              )}
              {activeTab === 'sheet' && (
                <AuditTable
                  items={items}
                  totalItems={totalItems}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  limit={limit}
                  search={search}
                  setSearch={setSearch}
                  filter={filter}
                  setFilter={setFilter}
                  supplierFilter={supplierFilter}
                  setSupplierFilter={setSupplierFilter}
                  locationFilter={locationFilter}
                  setLocationFilter={setLocationFilter}
                  storeFilter={storeFilter}
                  setStoreFilter={setStoreFilter}
                  meta={meta}
                  onRowClick={(item) => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                  selectedItemId={selectedItem?.id}
                  auditors={AUDITOR_COLUMNS}
                  roleNamesMap={roleNamesMap}
                  currentUser={currentUser}
                  auditIsLocked={auditIsLocked}
                  onCountSaved={() => { fetchItems(true); fetchDashboardMetrics(true); }}
                  activeSession={activeSession}
                />
              )}
              {activeTab === 'extra' && (
                <ExtraFoundForm
                  sessionId={activeSession.id}
                  currentUser={currentUser}
                  auditIsLocked={auditIsLocked}
                  onSuccess={() => { fetchItems(); fetchDashboardMetrics(); }}
                />
              )}
              {activeTab === 'history' && (
                <div className="space-y-5">
                  <div className="pb-3" style={{ borderBottom: '1px solid var(--glass-border-dim)' }}>
                    <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Audit Session Archives</h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Review, load, or export summaries for all stock audits recorded in the database.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sessions.map(s => {
                      const isCurrent = activeSession?.id === s.id;
                      return (
                        <div
                          key={s.id}
                          className={`glass rounded-2xl p-5 transition-all ${isCurrent ? 'ring-1 ring-blue-400/40' : ''}`}
                          style={isCurrent ? { background: 'rgba(0,122,255,0.06)' } : {}}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="space-y-0.5">
                              <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{s.name}</h4>
                              <p className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>Date: {s.audit_date} · ID: #{s.id}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg border ${
                              s.status === 'Completed'
                                ? 'bg-emerald-500/10 border-emerald-400/25 text-emerald-400'
                                : 'bg-blue-500/10 border-blue-400/25 text-blue-400'
                            }`}>
                              {s.status === 'Completed' ? '🔒 Locked' : '🟢 Active'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => { setActiveSession(s); setActiveTab('dashboard'); }}
                              className={`flex-1 text-[11px] py-1.5 font-bold rounded-xl transition-all ${
                                isCurrent
                                  ? 'cursor-default'
                                  : ''
                              }`}
                              style={isCurrent
                                ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px rgba(0,122,255,0.3)' }
                                : { background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)', color: 'var(--text-secondary)' }
                              }
                            >
                              {isCurrent ? '✓ Viewing' : '📂 Load'}
                            </button>
                            <a
                              href={`${API_BASE}/api/audits/${s.id}/export`}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-xl text-center transition-all"
                              style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.25)', color: '#34C759' }}
                              title="Download Excel Report"
                              download
                            >
                              Excel
                            </a>
                            <a
                              href={`${API_BASE}/api/audits/${s.id}/export/word`}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-xl text-center transition-all"
                              style={{ background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.25)', color: '#007AFF' }}
                              title="Download Word Analysis Report"
                              download
                            >
                              Word
                            </a>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteSession(s.id, s.name)}
                                className="p-1.5 rounded-xl transition-all"
                                style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)', color: '#FF3B30' }}
                                title="Delete Session"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {activeTab === 'trail' && (
                <AuditTrail trail={generalTrail} onRefresh={fetchGeneralTrail} isLoading={isLoadingTrail} roleNamesMap={roleNamesMap} />
              )}
            </div>

            {/* Responsive Detail Panel */}
            {selectedItem && (
              <>
                {/* Mobile Drawer (shown below lg) */}
                <div className="lg:hidden fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-end justify-center animate-fade-in" onClick={() => setSelectedItem(null)}>
                  <div 
                    className="w-full max-h-[85vh] rounded-t-3xl overflow-hidden shadow-2xl relative animate-slide-up"
                    style={{ 
                      background: 'var(--card-solid)', 
                      borderTop: '1px solid var(--glass-border)',
                      boxShadow: '0 -8px 36px rgba(0,0,0,0.30)'
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Drag indicator handle */}
                    <div className="w-12 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto my-3 pointer-events-none" />
                    
                    <div className="overflow-y-auto h-[calc(85vh-20px)]">
                      <DetailsPanel
                        item={selectedItem}
                        currentUser={currentUser}
                        auditIsLocked={auditIsLocked}
                        onClose={() => setSelectedItem(null)}
                        onUpdate={() => { fetchItems(); fetchDashboardMetrics(); }}
                        isDark={isDark}
                        roleNamesMap={roleNamesMap}
                      />
                    </div>
                  </div>
                </div>

                {/* Desktop Sticky Sidebar (shown lg and above) */}
                <div className="hidden lg:block lg:w-1/3 lg:sticky lg:top-20 h-[85vh] overflow-hidden rounded-2xl" style={{ border: '1px solid var(--glass-border)', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
                  <DetailsPanel
                    item={selectedItem}
                    currentUser={currentUser}
                    auditIsLocked={auditIsLocked}
                    onClose={() => setSelectedItem(null)}
                    onUpdate={() => { fetchItems(); fetchDashboardMetrics(); }}
                    isDark={isDark}
                    roleNamesMap={roleNamesMap}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </main>

      {/* Delete Session Confirmation Portal — renders at document.body level */}
      {deleteSessionTarget && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)'
          }}
          onClick={() => setDeleteSessionTarget(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              animation: 'dropdown-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
              background: isDark ? '#1c1c1e' : '#ffffff',
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
              borderRadius: '22px',
              padding: '32px 28px 28px',
              textAlign: 'center'
            }}
          >
            {/* Warning Icon */}
            <div style={{
              width: 60, height: 60,
              borderRadius: '18px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              color: 'rgb(239, 68, 68)'
            }}>
              <AlertTriangle style={{ width: 28, height: 28 }} />
            </div>

            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: isDark ? '#f4f4f5' : '#111827', letterSpacing: '-0.02em' }}>
              Delete Audit Session
            </h3>
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '13px',
              fontWeight: 700,
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              marginBottom: 16
            }}>
              {deleteSessionTarget.name}
            </div>
            <p style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>
              This will permanently delete this audit session, including all physical counts, audit trails, and product data. This action cannot be undone.
            </p>

            <div style={{ textAlign: 'left', marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: isDark ? '#a1a1aa' : '#52525b', marginBottom: 6 }}>
                Type the audit name <strong style={{ color: '#ef4444' }}>{deleteSessionTarget.name}</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteSessionInput}
                onChange={(e) => setDeleteSessionInput(e.target.value)}
                placeholder={deleteSessionTarget.name}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  fontSize: '13px',
                  borderRadius: '10px',
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #d4d4d8',
                  background: isDark ? '#2c2c2e' : '#f9f9f9',
                  color: isDark ? '#ffffff' : '#000000',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setDeleteSessionTarget(null)}
                style={{
                  flex: 1, padding: '11px 16px',
                  fontSize: 13, fontWeight: 600, borderRadius: 12,
                  border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e4e4e7',
                  color: isDark ? '#a1a1aa' : '#52525b',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteSession}
                disabled={isDeletingSession || deleteSessionInput !== deleteSessionTarget.name}
                style={{
                  flex: 1, padding: '11px 16px',
                  fontSize: 13, fontWeight: 700, borderRadius: 12,
                  border: 'none',
                  color: '#ffffff',
                  background: (isDeletingSession || deleteSessionInput !== deleteSessionTarget.name) 
                    ? (isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.45)') 
                    : 'linear-gradient(180deg, #f87171 0%, #dc2626 100%)',
                  boxShadow: (isDeletingSession || deleteSessionInput !== deleteSessionTarget.name) ? 'none' : '0 2px 12px rgba(220,38,38,0.4)',
                  cursor: (isDeletingSession || deleteSessionInput !== deleteSessionTarget.name) ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s'
                }}
              >
                <Trash2 style={{ width: 14, height: 14 }} />
                {isDeletingSession ? 'Deleting...' : 'Delete Session'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
