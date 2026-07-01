import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import {
  Sun, Moon, Package, UploadCloud, DownloadCloud, Plus, Trash2,
  User, Activity, Play, X, LogOut, Shield, Settings, Check,
  Lock, Unlock, FileText, Users, KeyRound, AlertTriangle, ShieldCheck,
  Building2, Star, Code2, Briefcase, UserCircle, RefreshCw, ChevronDown, Orbit, Search,
  Calendar, ChevronLeft, ChevronRight, ClipboardList
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import AuditTable from './components/AuditTable';
import DetailsPanel from './components/DetailsPanel';
import ExtraFoundForm from './components/ExtraFoundForm';
import AuditTrail from './components/AuditTrail';
import Login from './components/Login';
import QuickAddPage from './components/QuickAddPage';
import GlassSelect from './components/GlassSelect';
import TeamManagement from './components/TeamManagement';
import HospitalManagement from './components/HospitalManagement';
import UserProfile from './components/UserProfile';
import AuditMembersPanel from './components/AuditMembersPanel';

const API_BASE = import.meta.env.VITE_API_URL || '';
axios.defaults.baseURL = API_BASE;

// ─── Role Helpers ────────────────────────────────────────────────
const isPrivileged = (role) => role === 'Admin' || role === 'Developer';
const isUpperTier = (role) => isPrivileged(role) || role === 'CoFounder';
const isEmployee = (role) => role === 'Employee';

const ROLE_GRADIENT = {
  Admin: 'linear-gradient(135deg, #FF6B35, #F7931E)',
  Developer: 'linear-gradient(135deg, #8B5CF6, #7C3AED)',
  CoFounder: 'linear-gradient(135deg, #F59E0B, #D97706)',
  Employee: 'linear-gradient(135deg, #007AFF, #5856D6)',
};

const ROLE_LABEL = {
  Admin: 'Admin',
  Developer: 'Developer',
  CoFounder: 'Co-Founder',
  Employee: 'Employee',
};

const ROLE_COLOR = {
  Admin: '#FF6B35',
  Developer: '#8B5CF6',
  CoFounder: '#F59E0B',
  Employee: '#007AFF',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('auditUser');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        axios.defaults.headers.common['x-user-role'] = user.role;
        axios.defaults.headers.common['x-user-name'] = user.name;
        axios.defaults.headers.common['x-user-id'] = user.id;
        return user;
      } catch (_) { }
    }
    return null;
  });
  const [isDark, setIsDark] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(() => {
    const saved = localStorage.getItem('activeSession');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (_) { }
    }
    return null;
  });
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionDate, setNewSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());

  const [newSessionHospital, setNewSessionHospital] = useState('');
  const [newSessionMembers, setNewSessionMembers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('All');
  const [showHospitalDropdown, setShowHospitalDropdown] = useState(false);
  const [hospitalSearch, setHospitalSearch] = useState('');
  const [hospitals, setHospitals] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);

  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab) return savedTab;
    const savedUser = localStorage.getItem('auditUser');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user.role === 'Employee') return 'sheet';
      } catch (_) { }
    }
    return 'dashboard';
  });

  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem('auditCurrentPage');
    return saved ? parseInt(saved, 10) : 1;
  });

  useEffect(() => {
    sessionStorage.setItem('auditCurrentPage', currentPage);
  }, [currentPage]);

  const [limit] = useState(30);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [meta, setMeta] = useState({ suppliers: [], locations: [], stores: [] });

  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState('asc');
  const [selectedItem, setSelectedItem] = useState(null);
  const [dashboardMetrics, setDashboardMetrics] = useState(null);
  const [generalTrail, setGeneralTrail] = useState([]);
  const [roleNamesMap, setRoleNamesMap] = useState({});

  // Audit members for current session
  const [auditMembers, setAuditMembers] = useState([]);

  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingTrail, setIsLoadingTrail] = useState(false);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const [syncEnabled, setSyncEnabled] = useState(true);

  const [deleteSessionTarget, setDeleteSessionTarget] = useState(null);
  const [deleteSessionInput, setDeleteSessionInput] = useState('');
  const [isDeletingSession, setIsDeletingSession] = useState(false);

  // Audit Session Archives filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('All');
  const [historyYearFilter, setHistoryYearFilter] = useState('All');
  const [showHistoryYearMenu, setShowHistoryYearMenu] = useState(false);
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');
  const [tempHistoryFromDate, setTempHistoryFromDate] = useState('');
  const [tempHistoryToDate, setTempHistoryToDate] = useState('');
  const [showHistoryFromCal, setShowHistoryFromCal] = useState(false);
  const [showHistoryToCal, setShowHistoryToCal] = useState(false);
  const [historyFromCalMonth, setHistoryFromCalMonth] = useState(new Date().getMonth());
  const [historyFromCalYear, setHistoryFromCalYear] = useState(new Date().getFullYear());
  const [historyToCalMonth, setHistoryToCalMonth] = useState(new Date().getMonth());
  const [historyToCalYear, setHistoryToCalYear] = useState(new Date().getFullYear());
  const [historyPage, setHistoryPage] = useState(1);
  const [selectedHospitalId, setSelectedHospitalId] = useState(null);
  const [selectSearch, setSelectSearch] = useState('');
  const [selectStatus, setSelectStatus] = useState('All');
  const [selectYear, setSelectYear] = useState('All');
  const [selectFrom, setSelectFrom] = useState('');
  const [selectTo, setSelectTo] = useState('');

  // FIX 3: Refs to prevent race conditions between polling and active count saves
  const fetchAbortRef = useRef(null);   // AbortController for in-flight fetchItems
  const savingCountRef = useRef(false); // true while a count cell is being saved
  const isFetchingRef = useRef(false);  // true while a fetch is in progress

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearch, historyStatusFilter, historyYearFilter, historyFromDate, historyToDate]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);



  useEffect(() => {
    if (currentUser) {
      fetchSessions();
      fetchRoleNamesMap();
      if (isPrivileged(currentUser.role)) {
        fetchHospitals();
        fetchAssignableUsers();
      }
    }
  }, [currentUser]);

  // Persist activeTab changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('activeTab', activeTab);
    }
  }, [activeTab, currentUser]);

  // Persist activeSession changes
  useEffect(() => {
    if (currentUser) {
      if (activeSession) {
        localStorage.setItem('activeSession', JSON.stringify(activeSession));
        localStorage.setItem('activeSessionId', activeSession.id);
      } else {
        localStorage.removeItem('activeSession');
        localStorage.removeItem('activeSessionId');
      }
    }
  }, [activeSession, currentUser]);

  useEffect(() => {
    if (activeSession && currentUser) {
      fetchAuditMembers();
    } else {
      setAuditMembers([]);
    }
  }, [activeSession, currentUser]);

  useEffect(() => {
    if (activeSession && currentUser) {
      fetchItems();
      if (isUpperTier(currentUser.role)) {
        fetchDashboardMetrics();
      }
      fetchGeneralTrail();
    } else {
      setItems([]);
      setTotalItems(0);
      setDashboardMetrics(null);
      setGeneralTrail([]);
    }
  }, [activeSession, currentPage, search, filter, supplierFilter, locationFilter, storeFilter, sortBy, sortOrder]);

  useEffect(() => {
    if (!activeSession || !syncEnabled || !currentUser) return;
    const id = setInterval(() => {
      fetchItems(true);
      if (isUpperTier(currentUser.role)) fetchDashboardMetrics(true);
      if (activeTab === 'trail') fetchGeneralTrail(true);
    }, 5000);
    return () => clearInterval(id);
  }, [activeSession, syncEnabled, activeTab, currentPage, search, filter, supplierFilter, locationFilter, storeFilter, currentUser, sortBy, sortOrder]);

  useEffect(() => { setSelectedItem(null); }, [activeTab]);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      if (showHospitalDropdown && !e.target.closest('.hospital-dropdown-container')) {
        setShowHospitalDropdown(false);
      }
      if (showDatePicker && !e.target.closest('.apple-datepicker-container')) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [showHospitalDropdown, showDatePicker]);

  const handleLogin = (user) => {
    setCurrentUser(user);
    localStorage.setItem('auditUser', JSON.stringify(user));
    axios.defaults.headers.common['x-user-role'] = user.role;
    axios.defaults.headers.common['x-user-name'] = user.name;
    axios.defaults.headers.common['x-user-id'] = user.id;

    // Set landing tab on login
    if (user.role === 'Employee') {
      setActiveTab('sheet');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('auditUser');
    localStorage.removeItem('activeTab');
    localStorage.removeItem('activeSessionId');
    localStorage.removeItem('activeSession');
    delete axios.defaults.headers.common['x-user-role'];
    delete axios.defaults.headers.common['x-user-name'];
    delete axios.defaults.headers.common['x-user-id'];
    setActiveSession(null);
    setSessions([]);
    setHospitals([]);
    setAssignableUsers([]);
  };

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await axios.get('/api/audits');
      setSessions(res.data);

      const savedSessionId = localStorage.getItem('activeSessionId');
      const matched = res.data.find(s => String(s.id) === String(savedSessionId));

      if (matched) {
        setActiveSession(matched);
        localStorage.setItem('activeSession', JSON.stringify(matched));
      } else if (res.data.length > 0 && !activeSession) {
        setActiveSession(res.data[0]);
        localStorage.setItem('activeSession', JSON.stringify(res.data[0]));
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchHospitals = async () => {
    try {
      const res = await axios.get('/api/hospitals');
      setHospitals(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchAssignableUsers = async () => {
    try {
      const res = await axios.get('/api/users/assignable');
      setAssignableUsers(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchItems = async (isSilent = false) => {
    if (!activeSession) return;

    // FIX 3: Skip poll if a count save is actively in progress
    if (isSilent && savingCountRef.current) return;

    // FIX 3: Abort any previous in-flight request to prevent stale responses from overwriting fresh data
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    // FIX 3: Prevent overlapping fetches — if one is already running, abort & restart
    if (isFetchingRef.current && isSilent) return;
    isFetchingRef.current = true;

    if (!isSilent) setIsLoadingItems(true);
    try {
      const res = await axios.get(`/api/audits/${activeSession.id}/items`, {
        signal: controller.signal,
        params: {
          page: currentPage,
          limit,
          search,
          filter,
          supplier: supplierFilter,
          location: locationFilter,
          store: storeFilter,
          sortBy,
          sortOrder
        }
      });
      // Only update state if this request wasn't aborted
      // AND we aren't currently waiting on a PUT request (which holds optimistic state).
      if (!controller.signal.aborted && !savingCountRef.current) {
        setItems(res.data.items);
        setTotalItems(res.data.total);
        setMeta(res.data.meta);
        if (selectedItem) {
          const updated = res.data.items.find(i => i.id === selectedItem.id);
          if (updated) setSelectedItem(updated);
        }
      }
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
        console.error('Failed to load items:', err);
      }
    } finally {
      isFetchingRef.current = false;
      if (!isSilent) setIsLoadingItems(false);
    }
  };

  const fetchDashboardMetrics = async (isSilent = false) => {
    if (!activeSession || !isUpperTier(currentUser?.role)) return;
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

  const fetchRoleNamesMap = async () => {
    try {
      const res = await axios.get('/api/users/public-map');
      setRoleNamesMap(res.data);
    } catch (err) { console.error(err); }
  };

  const fetchAuditMembers = async () => {
    if (!activeSession) return;
    setIsLoadingMembers(true);
    try {
      const res = await axios.get(`/api/audits/${activeSession.id}/members`);
      setAuditMembers(res.data);
    } catch (err) { console.error(err); }
    finally {
      setIsLoadingMembers(false);
    }
  };

  const toggleDatePicker = () => {
    if (!showDatePicker) {
      try {
        const parts = newSessionDate.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          if (!isNaN(y) && !isNaN(m)) {
            setPickerYear(y);
            setPickerMonth(m);
          }
        }
      } catch (_) { }
    }
    setShowDatePicker(!showDatePicker);
  };

  const formatSessionDate = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[1]}/${parts[2]}/${parts[0]}`;
    }
    return dateStr;
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newSessionName) return;
    try {
      const res = await axios.post('/api/audits', {
        name: newSessionName,
        audit_date: newSessionDate,
        hospital_id: newSessionHospital || null,
        assigned_members: newSessionMembers,
      });
      setNewSessionName('');
      setNewSessionHospital('');
      setNewSessionMembers([]);
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
      ? 'Mark this audit as COMPLETED? No one except Admin/Developer will be able to make changes.'
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
      setTimeout(() => {
        setUploadStatus('');
      }, 4000);
    } catch (err) {
      setUploadStatus(err.response?.data?.error || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  // Audit dynamic columns — from assigned members (active or frozen, not removed with no entries)
  const auditColumns = (() => {
    if (!auditMembers || auditMembers.length === 0) return [];
    // Include all members (even frozen/removed) since they might have entries
    return auditMembers
      .filter(m => m.status !== 'removed' || /* has entries */ true)
      .map(m => ({
        id: String(m.user_id),
        name: m.user_name,
        role: m.user_role,
        status: m.status,
        is_virtual: m.is_virtual,
      }));
  })();

  // For AuditTable: pass auditor IDs as strings (keyed by user_id in auditor_counts)
  const auditorColumnIds = auditColumns.map(c => c.id);

  const userRole = currentUser?.role;
  const userPrivileged = isPrivileged(userRole);
  const userUpperTier = isUpperTier(userRole);
  const auditIsLocked = activeSession?.status === 'Completed' && !userPrivileged;

  // Check if current user is frozen globally
  const userIsFrozen = currentUser?.status === 'frozen';
  // Check if current user is frozen/removed from current audit
  const userAuditMember = auditMembers.find(m => String(m.user_id) === String(currentUser?.id));
  const userAuditStatus = userAuditMember?.status || 'active';
  const userAuditFrozen = userAuditStatus === 'frozen' || userAuditStatus === 'removed';

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  // Build tabs based on role
  const getTabs = () => {
    const showAddData = !!userAuditMember && !userAuditFrozen && !userIsFrozen;
    if (isEmployee(userRole)) {
      // Employee: only sheet + quick-add (if member)
      const tabs = [{ id: 'sheet', label: '📋 Audit Sheet' }];
      if (showAddData) tabs.push({ id: 'quick-add', label: '⚡ Add Data' });
      return tabs;
    }
    const tabs = [
      { id: 'dashboard', label: '📊 Dashboard' },
      { id: 'sheet', label: '📋 Audit Sheet' },
    ];
    if (showAddData) tabs.push({ id: 'quick-add', label: '⚡ Add Data' });
    if (userPrivileged) {
      tabs.push(
        { id: 'members', label: '👥 Members' },
        { id: 'performance', label: '📈 Performance' },
        { id: 'extra', label: '➕ Extra Found' }
      );
    }
    tabs.push(
      { id: 'history', label: '📂 Audit History' },
      { id: 'trail', label: '⏱️ Audit Trail' }
    );
    return tabs;
  };

  const avatarGradient = ROLE_GRADIENT[userRole] || 'linear-gradient(135deg, #007AFF, #5856D6)';

  return (
    <div className="min-h-screen font-sans transition-colors duration-200" style={{ color: 'var(--text-primary)' }}>

      {/* Backdrop overlay with premium soft blur focus pull */}
      {showUserDropdown && (
        <div
          className="fixed cursor-default"
          style={{
            top: '48px',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 25,
            background: isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.15)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            animation: 'fade-in 0.2s ease-out'
          }}
          onClick={() => setShowUserDropdown(false)}
        />
      )}

      {/* App Header */}
      <header className="sticky top-0 z-30 transition-all" style={isDark ? {
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
          <div
            onClick={() => {
              if (isEmployee(userRole)) {
                setActiveTab('sheet');
              } else {
                setActiveTab('dashboard');
              }
              setShowUserDropdown(false);
            }}
            className="flex items-center gap-1.5 sm:gap-2 cursor-pointer select-none active:scale-95 transition-all hover:opacity-85"
            title="Go to Home"
          >
            <div className="p-1.5 rounded-lg" style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)', boxShadow: '0 2px 8px rgba(0,122,255,0.25)' }}>
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Auditing</h1>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap">

            {/* Active Audit Pill — opens full Audit Selector page */}
            <button
              onClick={() => { setActiveTab('select-audit'); setShowUserDropdown(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '0 12px',
                height: '28px',
                borderRadius: 10,
                border: activeTab === 'select-audit'
                  ? '1.5px solid rgba(0,122,255,0.5)'
                  : (isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.07)'),
                background: activeTab === 'select-audit'
                  ? 'rgba(0,122,255,0.10)'
                  : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'),
                color: 'var(--text-primary)',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                minWidth: 100,
                maxWidth: 220,
                transition: 'all 0.15s',
                boxSizing: 'border-box',
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              }}
              title="Switch Audit Session"
            >
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: activeSession
                  ? (activeSession.status === 'Active' ? '#34C759' : '#8E8E93')
                  : '#FF3B30',
                boxShadow: activeSession?.status === 'Active' ? '0 0 0 2px rgba(52,199,89,0.25)' : 'none',
                display: 'inline-block',
              }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                {activeSession
                  ? (activeSession.hospital_name
                    ? `${activeSession.hospital_name} — ${activeSession.name}`
                    : activeSession.name)
                  : 'Select Audit'}
              </span>

            </button>

            {/* New Session (Admin/Developer) */}
            {userPrivileged && (
              <button
                onClick={() => {
                  setActiveTab('new-session');
                  fetchAssignableUsers();
                  fetchHospitals();
                  setShowUserDropdown(false);
                }}
                className="flex items-center justify-center gap-1 px-1.5 sm:px-3 rounded-lg text-[11px] font-semibold transition-all hover:opacity-80 cursor-pointer shrink-0"
                style={{ background: 'var(--accent-light)', border: '1px solid rgba(0,122,255,0.2)', color: 'var(--accent)', height: '28px', minWidth: '28px', lineHeight: '1', boxSizing: 'border-box' }}
                title="New Audit Session"
              >
                <Plus className="h-3 w-3" />
                <span className="hidden sm:inline">New</span>
              </button>
            )}

            {/* Action Buttons & Navigation */}
            <div className="flex items-center gap-1.5 flex-nowrap shrink-0">
              {/* Team Management — Admin/Developer */}
              {userPrivileged && (
                <button
                  onClick={() => {
                    setActiveTab(activeTab === 'team' ? 'dashboard' : 'team');
                    setShowUserDropdown(false);
                  }}
                  className="flex items-center justify-center gap-1 px-2.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer"
                  style={activeTab === 'team'
                    ? { background: 'var(--accent-light)', border: '1px solid var(--accent)', color: 'var(--accent)', height: '28px', minWidth: '28px', boxSizing: 'border-box' }
                    : { background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.07)', color: 'var(--text-secondary)', height: '28px', minWidth: '28px', boxSizing: 'border-box' }}
                  title="Team Management"
                >
                  <Users style={{ width: 14, height: 14 }} className="shrink-0" />
                  <span className="hidden sm:inline">Team</span>
                </button>
              )}

              {/* Hospitals — Admin/Developer/CoFounder */}
              {userUpperTier && (
                <button
                  onClick={() => {
                    setActiveTab(activeTab === 'hospitals' ? 'dashboard' : 'hospitals');
                    setShowUserDropdown(false);
                  }}
                  className="flex items-center justify-center gap-1 px-2.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 cursor-pointer"
                  style={activeTab === 'hospitals'
                    ? { background: 'var(--accent-light)', border: '1px solid var(--accent)', color: 'var(--accent)', height: '28px', minWidth: '28px', boxSizing: 'border-box' }
                    : { background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.07)', color: 'var(--text-secondary)', height: '28px', minWidth: '28px', boxSizing: 'border-box' }}
                  title="Hospitals"
                >
                  <Building2 style={{ width: 14, height: 14 }} className="shrink-0" />
                  <span className="hidden sm:inline">Hospitals</span>
                </button>
              )}
            </div>

            <div className="h-5 w-px mx-0.5 hidden sm:block" style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }} />

            {/* Standalone Theme Toggle Icon Button */}
            <button
              type="button"
              onClick={() => setIsDark(!isDark)}
              className="h-8 w-8 rounded-full flex items-center justify-center transition-all hover:bg-black/5 dark:hover:bg-white/5 border cursor-pointer select-none active:scale-90 shrink-0"
              style={{
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'
              }}
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? (
                <Sun className="h-4 w-4 text-amber-500" />
              ) : (
                <Moon className="h-4 w-4 text-zinc-500" />
              )}
            </button>

            {/* Interactive User Dropdown Pill at the Absolute Right */}
            <div className="relative shrink-0 user-dropdown-container">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all hover:bg-black/5 dark:hover:bg-white/5 border cursor-pointer select-none active:scale-95"
                style={{
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                  height: '32px'
                }}
              >
                <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[8px] font-black" style={{ background: avatarGradient }}>
                  {currentUser.name?.charAt(0)?.toUpperCase()}
                </div>
                <span className="font-bold text-zinc-800 dark:text-zinc-100">{currentUser.name}</span>
                <span
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase"
                  style={{
                    background: `${ROLE_COLOR[userRole]}15` || 'rgba(0,122,255,0.1)',
                    color: ROLE_COLOR[userRole] || 'var(--accent)'
                  }}
                >
                  {ROLE_LABEL[userRole] || userRole}
                </span>
                <ChevronDown className="h-3 w-3 text-zinc-400 dark:text-zinc-500 ml-0.5 transition-transform" style={{ transform: showUserDropdown ? 'rotate(180deg)' : 'none' }} />
              </button>

              {showUserDropdown && (
                <div
                  className="absolute right-[-2px] top-[-2px] w-52 rounded-2xl border z-50 p-1.5 animate-dropdown-in shadow-2xl"
                  style={{
                    background: isDark ? '#1c1c1e' : '#ffffff',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)',
                  }}
                >
                  {/* Clone of User trigger pill inside dropdown for absolute overlay visual */}
                  <div
                    onClick={() => setShowUserDropdown(false)}
                    className="flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-xl transition-all hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer select-none mb-1.5"
                    style={{ height: '28px' }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="h-5 w-5 rounded-full flex items-center justify-center text-white text-[8px] font-black shrink-0" style={{ background: avatarGradient }}>
                        {currentUser.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="font-bold text-[11px] text-zinc-800 dark:text-zinc-100 truncate">{currentUser.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-wider uppercase"
                        style={{
                          background: `${ROLE_COLOR[userRole]}15` || 'rgba(0,122,255,0.1)',
                          color: ROLE_COLOR[userRole] || 'var(--accent)'
                        }}
                      >
                        {ROLE_LABEL[userRole] || userRole}
                      </span>
                      <ChevronDown className="h-3 w-3 text-zinc-400 dark:text-zinc-500 rotate-180 transition-transform" />
                    </div>
                  </div>

                  <div className="h-px bg-zinc-200/50 dark:bg-zinc-800/80 mb-1.5 mx-1" />

                  {/* User profile option */}
                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl text-left transition-all hover:bg-black/5 dark:hover:bg-white/5 text-zinc-800 dark:text-zinc-200 cursor-pointer group active:scale-98"
                  >
                    <div className="h-6 w-6 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <UserCircle className="h-4 w-4" />
                    </div>
                    <span className="group-hover:translate-x-0.5 transition-transform">My Profile</span>
                  </button>

                  {/* Divider */}
                  <div className="h-px my-1 bg-zinc-200/50 dark:bg-zinc-800/80 mx-1.5" />

                  {/* Sign out option */}
                  <button
                    onClick={() => {
                      handleLogout();
                      setShowUserDropdown(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl text-left transition-all hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-500 cursor-pointer group active:scale-98"
                  >
                    <div className="h-6 w-6 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0 transition-transform group-hover:scale-105">
                      <LogOut className="h-4 w-4 text-rose-500" />
                    </div>
                    <span className="group-hover:translate-x-0.5 transition-transform">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>



      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4" style={{ color: 'var(--text-primary)' }}>

        {/* ─── Dedicated Audit Selector Page ─── */}
        {activeTab === 'select-audit' && (() => {
          const sf = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", Helvetica, sans-serif';
          const sortedSessions = [...sessions].sort((a, b) => b.id - a.id);
          const recentSessions = sortedSessions.slice(0, 5);

          // Group sessions by hospital
          const hospitalMap = {};
          sessions.forEach(s => {
            const hid = s.hospital_id != null ? String(s.hospital_id) : 'none';
            const hname = s.hospital_name || 'General Inventory';
            if (!hospitalMap[hid]) hospitalMap[hid] = { id: hid, name: hname, audits: [] };
            hospitalMap[hid].audits.push(s);
          });
          const hospitalGroups = Object.values(hospitalMap);

          const sColor = (st) => st === 'Active' ? '#34C759' : '#8E8E93';
          const sBg = (st) => st === 'Active' ? 'rgba(52,199,89,0.1)' : 'rgba(142,142,147,0.1)';
          const sBorder = (st) => st === 'Active' ? 'rgba(52,199,89,0.2)' : 'rgba(142,142,147,0.2)';

          const loadAudit = (s) => {
            setActiveSession(s);
            setCurrentPage(1);
            setActiveTab(isEmployee(userRole) ? 'sheet' : 'dashboard');
          };

          const selAudits = selectedHospitalId ? (hospitalMap[selectedHospitalId]?.audits || []) : [];

          const palettes = [
            ['#007AFF', '#5856D6'], ['#FF9500', '#FF3B30'], ['#34C759', '#30A855'],
            ['#FF2D55', '#FF6B8A'], ['#AF52DE', '#8B5CF6'], ['#5AC8FA', '#007AFF'],
            ['#FF9F0A', '#FF6B00'], ['#30D158', '#32D74B'],
          ];
          const card = (extra = {}) => ({
            borderRadius: 18,
            background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
            border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: isDark ? '0 2px 14px rgba(0,0,0,0.28)' : '0 2px 10px rgba(0,0,0,0.04)',
            transition: 'all 0.18s ease',
            ...extra,
          });

          return (
            <div style={{ fontFamily: sf, maxWidth: 1100, margin: '0 auto', paddingBottom: 60 }}>

              {/* ── Page Header ── */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, paddingTop: 4 }}>
                <div>
                  <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.035em', color: isDark ? '#ffffff' : '#000000', margin: 0, lineHeight: 1 }}>Select Audit</h1>
                  <p style={{ fontSize: 13, color: 'var(--text-tertiary)', margin: '6px 0 0', fontWeight: 500 }}>
                    {sessions.length} audit{sessions.length !== 1 ? 's' : ''} across {hospitalGroups.length} facilit{hospitalGroups.length !== 1 ? 'ies' : 'y'}
                  </p>
                </div>
                {userPrivileged && (
                  <button
                    onClick={() => { setActiveTab('new-session'); fetchAssignableUsers(); fetchHospitals(); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 22px',
                      borderRadius: 14, border: 'none',
                      background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                      color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      boxShadow: '0 4px 18px rgba(0,122,255,0.35)', transition: 'transform 0.15s, box-shadow 0.15s',
                      fontFamily: sf,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 7px 24px rgba(0,122,255,0.45)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(0,122,255,0.35)'; }}
                  >
                    <Plus style={{ width: 16, height: 16 }} /> New Audit
                  </button>
                )}
              </div>

              {/* ── Search + Filter Card (always at top) ── */}
              <div style={{ ...card({ padding: '0', overflow: 'hidden', marginBottom: 20 }) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '10px 16px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, paddingRight: 16, borderRight: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)' }}>
                    <Search style={{ width: 14, height: 14, color: 'var(--text-tertiary)', flexShrink: 0 }} />
                    <input
                      type="text"
                      placeholder="Search audits by name, ID or date..."
                      value={selectSearch}
                      onChange={e => setSelectSearch(e.target.value)}
                      style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: sf }}
                    />
                    {selectSearch && (
                      <button onClick={() => setSelectSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-tertiary)', display: 'flex' }}>
                        <X style={{ width: 13, height: 13 }} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>Year:</span>
                    <select
                      value={selectYear}
                      onChange={e => setSelectYear(e.target.value)}
                      style={{ border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)', borderRadius: 8, padding: '4px 8px', fontSize: 11, fontWeight: 700, background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f7', color: 'var(--text-primary)', cursor: 'pointer', outline: 'none', fontFamily: sf }}
                    >
                      <option value="All">All Years</option>
                      {[...new Set(sortedSessions.map(s => s.audit_date?.slice(0, 4)).filter(Boolean))].sort((a, b) => b - a).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px' }}>
                  <Calendar style={{ width: 13, height: 13, color: '#007AFF', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>Filter by Date:</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>From</span>
                  <input type="date" value={selectFrom} onChange={e => setSelectFrom(e.target.value)} style={{ border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)', borderRadius: 8, padding: '4px 8px', fontSize: 11, background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f7', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontFamily: sf }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>To</span>
                  <input type="date" value={selectTo} onChange={e => setSelectTo(e.target.value)} style={{ border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.09)', borderRadius: 8, padding: '4px 8px', fontSize: 11, background: isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f7', color: 'var(--text-primary)', outline: 'none', cursor: 'pointer', fontFamily: sf }} />
                  {(selectFrom || selectTo) && (
                    <button onClick={() => { setSelectFrom(''); setSelectTo(''); }} style={{ fontSize: 11, fontWeight: 600, color: '#FF3B30', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>Clear</button>
                  )}
                </div>
              </div>

              {/* ── Conditional content ── */}
              {(() => {
                const isFiltering = !!(selectSearch || selectStatus !== 'All' || selectYear !== 'All' || selectFrom || selectTo);
                const filtered = sortedSessions.filter(s => {
                  const q = selectSearch.toLowerCase();
                  const matchSearch = !q || s.name.toLowerCase().includes(q) || String(s.id).includes(q) || s.audit_date?.includes(q) || s.hospital_name?.toLowerCase().includes(q);
                  const matchStatus = selectStatus === 'All' || s.status === selectStatus;
                  const matchYear = selectYear === 'All' || s.audit_date?.startsWith(selectYear);
                  const matchFrom = !selectFrom || s.audit_date >= selectFrom;
                  const matchTo = !selectTo || s.audit_date <= selectTo;
                  return matchSearch && matchStatus && matchYear && matchFrom && matchTo;
                });

                const AuditRow = (s, i, arr) => {
                  const isCur = activeSession?.id === s.id;
                  return (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 16, padding: '13px 22px',
                        borderBottom: i < arr.length - 1 ? (isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)') : 'none',
                        background: isCur ? (isDark ? 'rgba(0,122,255,0.07)' : 'rgba(0,122,255,0.04)') : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => { if (!isCur) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.015)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isCur ? (isDark ? 'rgba(0,122,255,0.07)' : 'rgba(0,122,255,0.04)') : 'transparent'; }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: sColor(s.status), display: 'inline-block', boxShadow: s.status === 'Active' ? '0 0 0 2.5px rgba(52,199,89,0.22)' : 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#fff' : '#000', letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {s.hospital_name && <span style={{ color: '#007AFF', fontWeight: 600 }}>@ {s.hospital_name} · </span>}{s.audit_date}
                        </div>
                      </div>
                      {isCur ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#007AFF', flexShrink: 0, minWidth: 72, justifyContent: 'flex-end' }}>
                          <Check style={{ width: 13, height: 13 }} /> Current
                        </div>
                      ) : (
                        <button
                          onClick={() => loadAudit(s)}
                          style={{
                            padding: '7px 20px', borderRadius: 10, border: 'none',
                            background: 'linear-gradient(135deg,#007AFF,#5856D6)',
                            color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                            flexShrink: 0, minWidth: 72,
                            boxShadow: '0 2px 10px rgba(0,122,255,0.28)',
                            transition: 'transform 0.12s, box-shadow 0.12s', fontFamily: sf,
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,122,255,0.4)'; }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,122,255,0.28)'; }}
                        >Load</button>
                      )}
                    </div>
                  );
                };

                if (isFiltering) {
                  return (
                    <div style={{ ...card({ overflow: 'hidden' }) }}>
                      <div style={{ padding: '14px 22px', borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: isDark ? '#fff' : '#000' }}>
                          {filtered.length} audit{filtered.length !== 1 ? 's' : ''} found
                        </span>
                        <button
                          onClick={() => { setSelectSearch(''); setSelectStatus('All'); setSelectYear('All'); setSelectFrom(''); setSelectTo(''); }}
                          style={{ fontSize: 11, fontWeight: 700, color: '#007AFF', background: 'none', border: 'none', cursor: 'pointer', fontFamily: sf }}
                        >Clear Filters</button>
                      </div>
                      {filtered.length === 0 ? (
                        <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No audits match your filters.</div>
                      ) : filtered.map((s, i, arr) => AuditRow(s, i, arr))}
                    </div>
                  );
                }

                return (
                  <>
                    {/* Recent Audits */}
                    <div style={{ marginBottom: 32 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 9, background: 'linear-gradient(135deg,#FF9500,#FF3B30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Star style={{ width: 14, height: 14, color: '#fff' }} />
                        </div>
                        <h2 style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.025em', color: isDark ? '#fff' : '#000', margin: 0 }}>Recent Audits</h2>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)', padding: '2px 9px', borderRadius: 20, letterSpacing: '0.02em' }}>LAST 5</span>
                      </div>
                      {recentSessions.length === 0 ? (
                        <div style={{ ...card(), padding: '28px 24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>No audits yet.</div>
                      ) : (
                        <div style={{ ...card({ overflow: 'hidden' }) }}>
                          {recentSessions.map((s, i, arr) => AuditRow(s, i, arr))}
                        </div>
                      )}
                    </div>




                  </>
                );
              })()}
            </div>
          );
        })()}


        {/* Profile Page */}
        {activeTab === 'profile' && (
          <UserProfile
            currentUser={currentUser}
            isDark={isDark}
            onSelectAudit={(audit) => {
              const sess = sessions.find(s => s.id === audit.id);
              if (sess) { setActiveSession(sess); setActiveTab('sheet'); }
            }}
          />
        )}

        {/* Team Management */}
        {activeTab === 'team' && userPrivileged && (
          <TeamManagement isDark={isDark} currentUser={currentUser} />
        )}

        {/* Hospital Management */}
        {activeTab === 'hospitals' && userUpperTier && (
          <HospitalManagement
            currentUser={currentUser}
            isDark={isDark}
            onSelectAudit={(audit) => {
              const sess = sessions.find(s => s.id === audit.id);
              if (sess) { setActiveSession(sess); setActiveTab('dashboard'); }
            }}
          />
        )}

        {/* New Session Page */}
        {activeTab === 'new-session' && userPrivileged && (
          <div className="max-w-[700px] mx-auto animate-fade-in" style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
          }}>

            {/* Main Form Box */}
            <div className="glass rounded-3xl p-8 border shadow-sm" style={{
              background: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
            }}>

              {/* Integrated Compact Header */}
              <div className="flex items-center gap-3 mb-6 pb-5 border-b border-zinc-200/50 dark:border-zinc-800/80">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}>
                  <Orbit className="h-4.5 w-4.5 animate-spin-slow" />
                </div>
                <div>
                  <h2 className="text-sm font-black tracking-tight" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Launch Stock Audit Session</h2>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Initialize stock sweep cycle parameters and allocate authorized auditing members.</p>
                </div>
              </div>

              <form onSubmit={handleCreateSession} className="space-y-6">

                {/* Section 1: Session Details */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500">1. Audit Session Parameters</h3>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Session Name *</label>
                    <div className="relative">
                      <FileText className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500 z-10" />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Kukatpally June 2026 Audit Sweep"
                        value={newSessionName}
                        onChange={(e) => setNewSessionName(e.target.value)}
                        className="glass-input w-full text-xs pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                        style={{ color: 'var(--text-primary)', background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Target Hospital *</label>
                      <div className="relative hospital-dropdown-container">
                        {/* Hidden validation input */}
                        <input type="hidden" required name="hospital_id" value={newSessionHospital} />

                        {/* Dropdown Trigger */}
                        <div
                          onClick={() => setShowHospitalDropdown(!showHospitalDropdown)}
                          className="glass-input w-full text-xs pl-10 pr-10 py-3 rounded-xl flex items-center justify-between cursor-pointer select-none transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/20"
                          style={{
                            color: newSessionHospital ? 'var(--text-primary)' : 'var(--text-tertiary)',
                            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
                            border: '1px solid var(--glass-border)'
                          }}
                        >
                          <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500 z-10" />
                          <span className="truncate">
                            {hospitals.find(h => String(h.id) === String(newSessionHospital))?.name || 'Select Target Facility'}
                          </span>
                          <ChevronDown className="h-4 w-4 text-zinc-400 dark:text-zinc-500 transition-transform duration-200" style={{ transform: showHospitalDropdown ? 'rotate(180deg)' : 'rotate(0)' }} />
                        </div>

                        {/* Dropdown Overlay Option List with Search Option */}
                        {showHospitalDropdown && (() => {
                          const filteredHospitals = hospitals.filter(h => h.name.toLowerCase().includes(hospitalSearch.toLowerCase()));
                          return (
                            <div
                              className="absolute left-0 right-0 top-11 z-30 rounded-2xl border shadow-2xl overflow-hidden animate-dropdown-in"
                              style={{
                                background: isDark ? '#1c1c1e' : '#ffffff',
                                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'
                              }}
                            >
                              {/* Search box header */}
                              <div className="p-2 border-b border-zinc-200/50 dark:border-zinc-800/50 flex items-center gap-2 relative">
                                <Search className="absolute left-4.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                                <input
                                  type="text"
                                  placeholder="Search facility..."
                                  value={hospitalSearch}
                                  onChange={e => setHospitalSearch(e.target.value)}
                                  className="w-full text-[11px] pl-8 pr-3 py-1.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                                  style={{
                                    color: 'var(--text-primary)',
                                    background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.015)',
                                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
                                  }}
                                  onClick={e => e.stopPropagation()} // Stop click propagation to prevent closing dropdown
                                />
                                {hospitalSearch && (
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setHospitalSearch(''); }}
                                    className="absolute right-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-[10px]"
                                  >
                                    Clear
                                  </button>
                                )}
                              </div>

                              {/* List items */}
                              <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                                {filteredHospitals.length === 0 ? (
                                  <div className="text-[10px] text-center py-4 text-zinc-400">No matching facilities.</div>
                                ) : (
                                  filteredHospitals.map(h => {
                                    const isSelected = String(newSessionHospital) === String(h.id);
                                    return (
                                      <button
                                        key={h.id}
                                        type="button"
                                        onClick={() => {
                                          setNewSessionHospital(String(h.id));
                                          setShowHospitalDropdown(false);
                                          setHospitalSearch('');
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer active:scale-98 ${isSelected
                                          ? 'bg-blue-500/10 text-blue-500 dark:bg-blue-500/15'
                                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                          }`}
                                      >
                                        <span className="truncate">{h.name}</span>
                                        {isSelected && <Check className="h-3.5 w-3.5 text-blue-500 shrink-0 stroke-[2.5px]" />}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="space-y-1.5 apple-datepicker-container relative">
                      <label className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Scheduled Date *</label>
                      <button
                        type="button"
                        onClick={toggleDatePicker}
                        className="w-full text-xs px-4 py-3 rounded-xl focus:outline-none flex items-center justify-between border transition-all cursor-pointer"
                        style={{
                          color: 'var(--text-primary)',
                          background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
                          borderColor: showDatePicker ? '#007AFF' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'),
                          boxShadow: showDatePicker ? '0 0 0 1px rgba(0,122,255,0.25)' : 'none'
                        }}
                      >
                        <span>{formatSessionDate(newSessionDate) || 'Select Date'}</span>
                        <Calendar className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
                      </button>

                      {showDatePicker && (() => {
                        const firstDayIdx = new Date(pickerYear, pickerMonth, 1).getDay();
                        const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
                        const prevMonthDays = new Date(pickerYear, pickerMonth, 0).getDate();

                        const cells = [];
                        for (let i = firstDayIdx - 1; i >= 0; i--) {
                          const pmYear = pickerMonth === 0 ? pickerYear - 1 : pickerYear;
                          const pmMonth = pickerMonth === 0 ? 12 : pickerMonth;
                          cells.push({
                            day: prevMonthDays - i,
                            isCurrentMonth: false,
                            dateStr: `${pmYear}-${String(pmMonth).padStart(2, '0')}-${String(prevMonthDays - i).padStart(2, '0')}`
                          });
                        }
                        for (let i = 1; i <= daysInMonth; i++) {
                          cells.push({
                            day: i,
                            isCurrentMonth: true,
                            dateStr: `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
                          });
                        }
                        const remaining = (7 - (cells.length % 7)) % 7;
                        for (let i = 1; i <= remaining; i++) {
                          const nmYear = pickerMonth === 11 ? pickerYear + 1 : pickerYear;
                          const nmMonth = pickerMonth === 11 ? 1 : pickerMonth + 2;
                          cells.push({
                            day: i,
                            isCurrentMonth: false,
                            dateStr: `${nmYear}-${String(nmMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
                          });
                        }

                        const handlePrevMonth = (e) => {
                          e.stopPropagation();
                          if (pickerMonth === 0) {
                            setPickerMonth(11);
                            setPickerYear(y => y - 1);
                          } else {
                            setPickerMonth(m => m - 1);
                          }
                        };

                        const handleNextMonth = (e) => {
                          e.stopPropagation();
                          if (pickerMonth === 11) {
                            setPickerMonth(0);
                            setPickerYear(y => y + 1);
                          } else {
                            setPickerMonth(m => m + 1);
                          }
                        };

                        const handleSelectDate = (dateStr, e) => {
                          e.stopPropagation();
                          setNewSessionDate(dateStr);
                          setShowDatePicker(false);
                        };

                        const handleToday = (e) => {
                          e.stopPropagation();
                          const todayStr = new Date().toISOString().split('T')[0];
                          setNewSessionDate(todayStr);
                          setPickerYear(new Date().getFullYear());
                          setPickerMonth(new Date().getMonth());
                          setShowDatePicker(false);
                        };

                        const todayStr = new Date().toISOString().split('T')[0];

                        return (
                          <div
                            className="absolute left-0 mt-2 z-50 rounded-2xl p-4 shadow-xl border animate-dropdown-in"
                            style={{
                              width: '280px',
                              background: isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.98)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                              top: '100%',
                              boxSizing: 'border-box'
                            }}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs font-bold text-zinc-900 dark:text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
                                {MONTH_NAMES[pickerMonth]} {pickerYear}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={handlePrevMonth}
                                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer flex items-center justify-center transition-colors"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={handleNextMonth}
                                  className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer flex items-center justify-center transition-colors"
                                >
                                  <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                              {WEEK_DAYS.map((wd, idx) => (
                                <span key={idx} className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">
                                  {wd}
                                </span>
                              ))}
                            </div>

                            <div className="grid grid-cols-7 gap-1 text-center">
                              {cells.map((cell, idx) => {
                                const isSelected = newSessionDate === cell.dateStr;
                                const isToday = todayStr === cell.dateStr;
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={(e) => handleSelectDate(cell.dateStr, e)}
                                    className="aspect-square flex items-center justify-center text-[11px] font-semibold rounded-full cursor-pointer relative transition-all"
                                    style={{
                                      color: isSelected
                                        ? '#ffffff'
                                        : (cell.isCurrentMonth
                                          ? (isToday ? '#007AFF' : 'var(--text-primary)')
                                          : 'rgba(142,142,147,0.4)'),
                                      background: isSelected
                                        ? '#007AFF'
                                        : (isToday ? 'rgba(0,122,255,0.08)' : 'transparent'),
                                      border: isToday && !isSelected ? '1px solid rgba(0,122,255,0.3)' : 'none',
                                    }}
                                    onMouseEnter={e => {
                                      if (!isSelected) {
                                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
                                      }
                                    }}
                                    onMouseLeave={e => {
                                      if (!isSelected) {
                                        e.currentTarget.style.background = isToday ? 'rgba(0,122,255,0.08)' : 'transparent';
                                      }
                                    }}
                                  >
                                    {cell.day}
                                  </button>
                                );
                              })}
                            </div>

                            <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={handleToday}
                                className="text-[10px] font-bold text-blue-500 hover:text-blue-600 transition-colors cursor-pointer"
                              >
                                Today
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Section 2: Auditor Allocation */}
                <div className="space-y-4 pt-4 border-t border-zinc-200/50 dark:border-zinc-800/80">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-purple-500">2. Auditor Allocation</h3>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">Select the team members authorized to perform physical audits in this session.</p>
                    </div>

                    {/* Segmented Switcher Role Control */}
                    <div className="flex p-1 rounded-2xl shrink-0" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', width: 'fit-content' }}>
                      {['All', 'Admin', 'Co-Founder', 'Employee'].map(role => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setRoleFilter(role)}
                          className={`px-4.5 py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer ${roleFilter === role
                            ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                            }`}
                        >
                          {role}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-64 overflow-y-auto p-2.5 rounded-2xl border" style={{
                    background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.005)',
                    borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'
                  }}>
                    {assignableUsers
                      .filter(u => u.role !== 'Developer' && u.id !== currentUser?.id)
                      .filter(u => roleFilter === 'All' || u.role === (roleFilter === 'Co-Founder' ? 'CoFounder' : roleFilter))
                      .map(u => {
                        const checked = newSessionMembers.includes(u.id);
                        const isFrozen = u.status === 'frozen';
                        const getRoleColor = (role) => {
                          if (role === 'Admin') return '#FF6B35';
                          if (role === 'Developer') return '#8B5CF6';
                          if (role === 'CoFounder' || role === 'Co-Founder') return '#F59E0B';
                          return '#007AFF';
                        };
                        const initial = u.name?.charAt(0)?.toUpperCase() || '?';
                        const roleColor = getRoleColor(u.role);

                        return (
                          <label
                            key={u.id}
                            className={`flex items-stretch gap-4 p-4 rounded-2xl cursor-pointer transition-all border relative overflow-hidden ${checked
                              ? 'shadow-md'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/20 border-zinc-200/40 dark:border-zinc-800/40'
                              } ${isFrozen ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}`}
                            style={checked ? { borderColor: roleColor, background: isDark ? `${roleColor}1a` : `${roleColor}08` } : {}}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isFrozen}
                              onChange={() => setNewSessionMembers(prev => checked ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                              className="sr-only"
                            />

                            {/* ID Badge Left Section (Photo ID & Barcode Pass) */}
                            <div className="flex flex-col items-center shrink-0 border-r border-zinc-200/40 dark:border-zinc-800/40 pr-3.5 select-none">
                              {/* Avatar Photo Container */}
                              <div className="h-11 w-11 rounded-xl flex items-center justify-center text-white text-sm font-black shadow-md" style={{ background: roleColor }}>
                                {initial}
                              </div>

                              {/* Mini Barcode Graphic */}
                              <div className="flex gap-[1px] items-center opacity-35 mt-2 h-2.5 justify-center w-11">
                                <span className="w-[1px] h-full bg-zinc-950 dark:bg-white" />
                                <span className="w-[2px] h-full bg-zinc-950 dark:bg-white" />
                                <span className="w-[1px] h-full bg-zinc-950 dark:bg-white" />
                                <span className="w-[3px] h-full bg-zinc-950 dark:bg-white" />
                                <span className="w-[1px] h-full bg-zinc-950 dark:bg-white" />
                                <span className="w-[1.5px] h-full bg-zinc-950 dark:bg-white" />
                              </div>

                              <span className="text-[6.5px] font-black text-zinc-400 dark:text-zinc-500 tracking-wider text-center mt-1.5 uppercase">AUDITOR PASS</span>
                            </div>

                            {/* ID Badge Right Section (Details info) */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                              <div>
                                <span className="text-[7px] font-black tracking-wider uppercase text-zinc-400 dark:text-zinc-500 block mb-0.5">STAFF ID CARD</span>
                                <h4 className="text-xs font-black truncate" style={{ color: 'var(--text-primary)' }}>{u.name}</h4>
                                <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 font-semibold block mt-0.5">ID NO: A-00{u.id}</span>
                              </div>

                              <div className="flex items-center gap-1.5 mt-2">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{
                                  background: `${roleColor}15`,
                                  color: roleColor
                                }}>
                                  {ROLE_LABEL[u.role] || u.role}
                                </span>
                                {isFrozen && <span className="text-[9px] font-bold text-amber-500 flex items-center gap-0.5">⚠️ Frozen</span>}
                              </div>
                            </div>

                            {/* Custom Circular Check Indicator absolute on top-right */}
                            {!isFrozen && (
                              <div className="absolute top-2.5 right-2.5 transition-all duration-200">
                                {checked ? (
                                  <div className="h-4.5 w-4.5 rounded-full flex items-center justify-center text-white shadow-sm" style={{ background: roleColor }}>
                                    <Check className="h-2.5 w-2.5 stroke-[3px]" />
                                  </div>
                                ) : (
                                  <div className="h-4.5 w-4.5 rounded-full border transition-all duration-200" style={{
                                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
                                    background: 'transparent'
                                  }} />
                                )}
                              </div>
                            )}
                          </label>
                        );
                      })}
                    {assignableUsers.length === 0 && <p className="text-xs text-center col-span-2 py-4 text-zinc-400">Loading users list...</p>}
                  </div>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 italic mt-1.5">
                    * You ({currentUser.name}) will be automatically allocated as the Session Administrator.
                  </p>
                </div>

                {/* Warning Banner & Launch Buttons */}
                <div className="pt-6 border-t border-zinc-200/50 dark:border-zinc-800/80 space-y-5">

                  {/* Premium Redesigned Warning Banner */}
                  <div className="p-4 rounded-2xl flex gap-3.5 items-start relative overflow-hidden" style={{
                    background: isDark
                      ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(255, 107, 53, 0.05))'
                      : 'linear-gradient(135deg, rgba(254, 226, 226, 0.5), rgba(255, 237, 213, 0.3))',
                    borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)',
                    borderWidth: '1px',
                    borderStyle: 'solid',
                    backdropFilter: 'blur(10px)',
                    boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.2)' : '0 4px 16px rgba(239, 68, 68, 0.04)',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
                  }}>
                    <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(239, 68, 68, 0.12)' }}>
                      <AlertTriangle className="h-4 w-4 text-red-500 stroke-[2.5px]" />
                    </div>
                    <div className="space-y-1 z-10">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 dark:text-red-400 block" style={{ letterSpacing: '0.05em' }}>
                        Critical Action Warning
                      </span>
                      <p className="text-[11px] leading-relaxed font-medium" style={{ color: isDark ? '#ffccd5' : '#7f1d1d' }}>
                        Launching a new audit session will initialize database sweeps for the target facility. Ensure all parameters and auditor allocations are verified.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveTab(activeSession ? 'sheet' : 'dashboard')}
                      className="flex-1 py-3.5 rounded-2xl text-xs font-bold border hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-all hover:scale-[1.01] active:scale-97 cursor-pointer text-center"
                      style={{
                        color: 'var(--text-secondary)',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="flex-2 flex justify-center items-center gap-2 py-3.5 rounded-2xl text-xs font-bold text-white transition-all hover:scale-[1.01] active:scale-97 cursor-pointer"
                      style={{
                        background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                        boxShadow: '0 4px 16px rgba(0,122,255,0.25)'
                      }}
                    >
                      <Play className="h-4 w-4 fill-current" /> Initialize Audit Session
                    </button>
                  </div>
                </div>

              </form>
            </div>

          </div>
        )}

        {/* Audit session tabs and content */}
        {!['profile', 'team', 'hospitals', 'new-session', 'select-audit'].includes(activeTab) && (
          <>
            {/* Session Controls Bar */}
            {activeSession && !isEmployee(userRole) && (
              <div className="panel-card rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1 w-full md:w-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base font-bold text-zinc-950 dark:text-zinc-50">{activeSession.name}</span>
                    {activeSession.hospital_name && (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-lg" style={{ background: 'rgba(0,122,255,0.08)', color: 'var(--accent)' }}>
                        <Building2 className="h-3 w-3" /> {activeSession.hospital_name}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${activeSession.status === 'Completed' ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40' : 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40'}`}>
                      {activeSession.status === 'Completed' ? '🔒 COMPLETED' : '🟢 ACTIVE'}
                    </span>
                    {auditIsLocked && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                        <AlertTriangle className="h-3 w-3" /> Read-only
                      </span>
                    )}
                    {userAuditFrozen && !userPrivileged && (
                      <span className="flex items-center gap-1 text-[10px] text-amber-500 font-semibold">
                        ⚠ Your access is {userAuditStatus}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Ref Date: {activeSession.audit_date} · ID: #{activeSession.id}{activeSession.created_by ? ` · by ${activeSession.created_by}` : ''}</p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto py-0.5">

                  {userPrivileged && (
                    <button onClick={handleToggleStatus} className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-lg transition-colors shrink-0 ${activeSession.status === 'Completed' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400'}`}>
                      {activeSession.status === 'Completed' ? <><Unlock className="h-3.5 w-3.5" /> Re-open</> : <><Lock className="h-3.5 w-3.5" /> Complete</>}
                    </button>
                  )}

                  {userPrivileged && (() => {
                    const hasImported = totalItems > 0;
                    return (
                      <form onSubmit={handleFileUpload} className="flex items-center gap-2 shrink-0">
                        <label
                          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${hasImported ? 'opacity-40 cursor-not-allowed select-none' : 'cursor-pointer hover:bg-[var(--glass-bg-hover)]'}`}
                          style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)', color: 'var(--text-secondary)' }}
                        >
                          <UploadCloud className="h-3.5 w-3.5" />
                          {hasImported ? 'Imported' : (uploadFile ? uploadFile.name.substring(0, 12) + '...' : 'Import')}
                          {!hasImported && (
                            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files.length > 0) { setUploadFile(e.target.files[0]); setUploadStatus(''); } }} />
                          )}
                        </label>
                        {uploadFile && !hasImported && (
                          <button type="submit" disabled={isUploading} className="px-3 py-2 text-xs font-semibold rounded-lg disabled:opacity-50" style={{ background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }}>
                            {isUploading ? '...' : 'Upload'}
                          </button>
                        )}
                      </form>
                    );
                  })()}
                  {uploadStatus && <span className={`text-xs font-medium px-2 shrink-0 ${uploadStatus.startsWith('✓') ? 'text-emerald-400' : 'text-rose-400'}`}>{uploadStatus}</span>}

                  {/* Export — Admin/Dev/CoFounder only */}
                  {userUpperTier && (
                    <>
                      <a href={`${API_BASE}/api/audits/${activeSession.id}/export`} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all shrink-0" style={{ background: 'rgba(52,199,89,0.12)', border: '1px solid rgba(52,199,89,0.25)', color: '#34C759' }} download>
                        <DownloadCloud className="h-3.5 w-3.5" /> Excel <span className="hidden sm:inline">Report</span>
                      </a>
                      <a href={`${API_BASE}/api/audits/${activeSession.id}/export/word`} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all shrink-0" style={{ background: 'rgba(0,122,255,0.12)', border: '1px solid rgba(0,122,255,0.25)', color: '#007AFF' }} download>
                        <FileText className="h-3.5 w-3.5" /> Word <span className="hidden sm:inline">Report</span>
                      </a>
                    </>
                  )}

                  {userPrivileged && (
                    <button onClick={() => handleDeleteSession(activeSession.id, activeSession.name)} className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/20 text-rose-500 transition-colors" title="Delete Session">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Tab Navigation */}
            {activeSession && (
              <div className="w-full py-1.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex p-1 rounded-2xl overflow-x-auto flex-nowrap scrollbar-none gap-0.5 max-w-full" style={{ background: isDark ? 'rgba(44,44,46,0.90)' : 'rgba(240,240,245,0.85)', backdropFilter: 'blur(16px)', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.07)', boxShadow: isDark ? '0 1px 0 rgba(255,255,255,0.05) inset, 0 2px 12px rgba(0,0,0,0.35)' : '0 1px 0 rgba(255,255,255,0.9) inset, 0 1px 8px rgba(0,0,0,0.05)' }}>
                  {getTabs().map(tab => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setSelectedItem(null); setActiveTab(tab.id); }}
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

                {/* Compact Session Info for Employee */}
                {isEmployee(userRole) && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold border shrink-0 transition-all shadow-sm" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <span className="font-black text-zinc-950 dark:text-zinc-50">{activeSession.hospital_name || activeSession.name}</span>
                    <span className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
                    <span className="flex items-center gap-1.5 text-[9px] font-black text-[#30d158]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#30d158] animate-pulse" />
                      ACTIVE
                    </span>
                    <span className="h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
                    <span className="text-[9px] font-mono text-zinc-400">#{activeSession.id}</span>
                  </div>
                )}
              </div>
            )}

            {/* No Session State */}
            {!activeSession && activeTab !== 'new-session' ? (
              <div className="flex justify-center items-start pt-8">
                <div style={{ width: '100%', maxWidth: '400px', background: isDark ? 'var(--glass-bg-heavy)' : '#ffffff', border: '1px solid var(--glass-border)', borderRadius: '20px', padding: '40px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
                  <div style={{ width: 56, height: 56, borderRadius: '16px', background: isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                    <Package className="h-7 w-7" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                  <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>No Active Audit Session</h3>
                  <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {userPrivileged ? 'Create an audit session to begin.' : 'Ask your administrator to start or select an audit session.'}
                  </p>
                  {userPrivileged && (
                    <button onClick={() => { setActiveTab('new-session'); fetchAssignableUsers(); fetchHospitals(); }} className="btn-glass-primary inline-flex justify-center items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl">
                      <Plus className="h-4 w-4" /> Create Audit Session
                    </button>
                  )}
                </div>
              </div>

            ) : (
              <div className="flex flex-col relative items-start w-full">
                <div className="w-full">

                  {activeTab === 'dashboard' && userUpperTier && (
                    <div className="space-y-5">
                      <Dashboard
                        metrics={dashboardMetrics}
                        isDark={isDark}
                        currentUser={currentUser}
                        auditMembers={auditMembers}
                        roleNamesMap={roleNamesMap}
                        hidePerformance={true}
                      />
                    </div>
                  )}

                  {activeTab === 'members' && userPrivileged && (
                    <AuditMembersPanel
                      sessionId={activeSession.id}
                      activeSession={activeSession}
                      currentUser={currentUser}
                      isDark={isDark}
                      onMembersChanged={() => { fetchAuditMembers(); fetchDashboardMetrics(); fetchItems(); }}
                    />
                  )}

                  {activeTab === 'performance' && userPrivileged && (
                    <Dashboard
                      metrics={dashboardMetrics}
                      isDark={isDark}
                      currentUser={currentUser}
                      auditMembers={auditMembers}
                      roleNamesMap={roleNamesMap}
                      showOnlyPerformance={true}
                    />
                  )}

                  {activeTab === 'sheet' && (
                    <AuditTable
                      isInitialLoading={isLoadingMembers || (isLoadingItems && items.length === 0)}
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
                      onRowClick={(item) => {
                          setSelectedItem(selectedItem?.id === item.id ? null : item);
                        }}
                      selectedItemId={selectedItem?.id}
                      auditors={auditorColumnIds}
                      auditColumns={auditColumns}
                      roleNamesMap={roleNamesMap}
                      currentUser={currentUser}
                      auditIsLocked={auditIsLocked || (userAuditFrozen && !userPrivileged)}
                      onCountSaved={(itemId, auditorId, newValue) => {
                        // Block any background polls from overwriting the optimistic
                        // state while the PUT is still in-flight on the server.
                        savingCountRef.current = true;

                        const memberIdSet = new Set((auditMembers || []).map(m => String(m.user_id)));
                        const isAllowed = (name) => memberIdSet.has(String(name));

                        setItems(prev => prev.map(it => {
                          if (it.id !== itemId) return it;
                          const existingCounts = it.auditor_counts || [];
                          const alreadyExists = existingCounts.some(c => String(c.auditor_name) === String(auditorId));
                          const newCounts = alreadyExists
                            ? existingCounts.map(c =>
                              String(c.auditor_name) === String(auditorId)
                                ? { ...c, physical_count: newValue }
                                : c
                            )
                            : [...existingCounts, { auditor_name: auditorId, physical_count: newValue }];

                          const totalPhysical = newCounts
                            .filter(c => isAllowed(c.auditor_name))
                            .reduce((sum, c) => sum + (c.physical_count != null ? Number(c.physical_count) : 0), 0)
                            + Number(it.manual_add || 0)
                            + Number(it.manual_recheck || 0);

                          const systemQty = Number(it.system_qty || 0);
                          const isCounted = newCounts.some(c => isAllowed(c.auditor_name) && c.physical_count != null);
                          const difference = isCounted ? (totalPhysical - systemQty) : 0;
                          const differenceValue = difference * Number(it.unit_purchase_rate || 0);

                          return { ...it, auditor_counts: newCounts, totalPhysical, difference, differenceValue };
                        }));
                      }}
                      onCountSyncReady={() => {
                        // PUT is confirmed by server — cache is now cleared.
                        // Unblock polls, then fetch fresh authoritative state.
                        savingCountRef.current = false;
                        fetchItems(true);
                        fetchDashboardMetrics(true);
                      }}
                      activeSession={activeSession}
                      sortBy={sortBy}
                      setSortBy={setSortBy}
                      sortOrder={sortOrder}
                      setSortOrder={setSortOrder}
                    />
                  )}

                  {activeTab === 'quick-add' && (
                    <QuickAddPage
                      sessionId={activeSession.id}
                      currentUser={currentUser}
                      auditIsLocked={auditIsLocked || (userAuditFrozen && !userPrivileged)}
                      onUpdate={() => { fetchItems(); fetchDashboardMetrics(); }}
                    />
                  )}

                  {activeTab === 'extra' && userPrivileged && (
                    <ExtraFoundForm
                      sessionId={activeSession.id}
                      currentUser={currentUser}
                      auditIsLocked={auditIsLocked}
                      onSuccess={() => { fetchItems(); fetchDashboardMetrics(); }}
                    />
                  )}



                  {activeTab === 'history' && (() => {
                    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    const hc = isDark
                      ? { border: 'rgba(255,255,255,0.10)', t1: '#ffffff', t2: '#ebebf5cc', t3: '#ebebf599', sep: 'rgba(255,255,255,0.08)' }
                      : { border: 'rgba(0,0,0,0.10)', t1: '#000000', t2: '#3c3c43e6', t3: '#3c3c4399', sep: 'rgba(0,0,0,0.08)' };

                    // Calendar Sub-component
                    const HistoryAppleCalendar = ({
                      label,
                      value,
                      onChange,
                      isOpen,
                      setIsOpen,
                      calMonth,
                      setCalMonth,
                      calYear,
                      setCalYear
                    }) => {
                      const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
                      const startDay = new Date(calYear, calMonth, 1).getDay();

                      const calendarCells = [];
                      for (let i = 0; i < startDay; i++) {
                        calendarCells.push(null);
                      }
                      for (let d = 1; d <= daysInMonth; d++) {
                        calendarCells.push(d);
                      }

                      const handlePrevMonth = (e) => {
                        e.stopPropagation();
                        if (calMonth === 0) {
                          setCalMonth(11);
                          setCalYear(prev => prev - 1);
                        } else {
                          setCalMonth(prev => prev - 1);
                        }
                      };

                      const handleNextMonth = (e) => {
                        e.stopPropagation();
                        if (calMonth === 11) {
                          setCalMonth(0);
                          setCalYear(prev => prev + 1);
                        } else {
                          setCalMonth(prev => prev + 1);
                        }
                      };

                      const handleSelectDay = (day) => {
                        const formattedMonth = String(calMonth + 1).padStart(2, '0');
                        const formattedDay = String(day).padStart(2, '0');
                        onChange(`${calYear}-${formattedMonth}-${formattedDay}`);
                        setIsOpen(false);
                      };

                      const getDisplayValue = () => {
                        if (!value) return "Select Date";
                        const parts = value.split('-');
                        if (parts.length !== 3) return value;
                        const y = parts[0];
                        const m = parseInt(parts[1], 10) - 1;
                        const d = parseInt(parts[2], 10);
                        return `${months[m]} ${d}, ${y}`;
                      };

                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: hc.t3 }}>{label}</span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (label === 'From') setShowHistoryToCal(false);
                              else setShowHistoryFromCal(false);
                              setIsOpen(!isOpen);
                            }}
                            style={{
                              padding: '6px 12px',
                              fontSize: 11,
                              fontWeight: 600,
                              borderRadius: 8,
                              border: `1px solid ${hc.border}`,
                              background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                              color: value ? hc.t1 : hc.t3,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              minWidth: '120px',
                              justifyContent: 'space-between',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                              outline: 'none'
                            }}
                          >
                            <Calendar style={{ width: 12, height: 12, color: value ? '#007AFF' : hc.t3 }} />
                            <span style={{ flex: 1, textAlign: 'left', marginLeft: 4 }}>{getDisplayValue()}</span>
                            <ChevronDown style={{ width: 10, height: 10, color: hc.t3 }} />
                          </button>

                          {isOpen && (
                            <div
                              onClick={() => setIsOpen(false)}
                              style={{
                                position: 'fixed',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                zIndex: 998,
                                background: 'transparent'
                              }}
                            />
                          )}

                          {isOpen && (
                            <div className="apple-animate-popover" style={{
                              position: 'absolute',
                              top: 'calc(100% + 6px)',
                              left: label === 'From' ? 0 : 'auto',
                              right: label === 'To' ? 0 : 'auto',
                              zIndex: 999,
                              width: '230px',
                              maxWidth: 'none',
                              background: isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.95)',
                              backdropFilter: 'blur(20px)',
                              WebkitBackdropFilter: 'blur(20px)',
                              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                              borderRadius: 12,
                              padding: '12px',
                              boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                              userSelect: 'none'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                                <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007AFF', padding: 2 }}>
                                  <ChevronLeft style={{ width: 16, height: 16 }} />
                                </button>
                                <span style={{ fontSize: 12, fontWeight: 700, color: hc.t1 }}>
                                  {months[calMonth]} {calYear}
                                </span>
                                <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007AFF', padding: 2 }}>
                                  <ChevronRight style={{ width: 16, height: 16 }} />
                                </button>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6, textAlign: 'center' }}>
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, idx) => (
                                  <span key={idx} style={{ fontSize: 9, fontWeight: 700, color: hc.t3 }}>
                                    {wd}
                                  </span>
                                ))}
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
                                {calendarCells.map((day, idx) => {
                                  if (day === null) {
                                    return <div key={idx} style={{ width: 24, height: 24 }} />;
                                  }

                                  const formattedDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                  const isSelected = value === formattedDate;

                                  return (
                                    <button
                                      key={idx}
                                      onClick={() => handleSelectDay(day)}
                                      style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 12,
                                        border: 'none',
                                        background: isSelected ? '#007AFF' : 'transparent',
                                        color: isSelected ? '#ffffff' : hc.t1,
                                        fontSize: 10,
                                        fontWeight: isSelected ? '700' : '500',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: 0,
                                        transition: 'background 0.1s, color 0.1s'
                                      }}
                                      onMouseEnter={e => {
                                        if (!isSelected) {
                                          e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
                                        }
                                      }}
                                      onMouseLeave={e => {
                                        if (!isSelected) {
                                          e.currentTarget.style.background = 'transparent';
                                        }
                                      }}
                                    >
                                      {day}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    };

                    const historyYears = Array.from(new Set(sessions.map(s => {
                      if (!s.audit_date) return null;
                      return s.audit_date.split('-')[0];
                    }).filter(Boolean))).sort((a, b) => b - a);

                    const filteredSessions = sessions.filter(s => {
                      const query = historySearch.toLowerCase();
                      const matchesSearch =
                        s.name.toLowerCase().includes(query) ||
                        (s.hospital_name || '').toLowerCase().includes(query) ||
                        String(s.id).includes(query);

                      const matchesStatus =
                        historyStatusFilter === 'All' ||
                        (historyStatusFilter === 'Completed' && s.status === 'Completed') ||
                        (historyStatusFilter === 'Active' && s.status !== 'Completed');

                      const matchesYear =
                        historyYearFilter === 'All' ||
                        (s.audit_date && s.audit_date.startsWith(historyYearFilter));

                      let matchesDate = true;
                      if (s.audit_date) {
                        if (historyFromDate && s.audit_date < historyFromDate) matchesDate = false;
                        if (historyToDate && s.audit_date > historyToDate) matchesDate = false;
                      } else {
                        if (historyFromDate || historyToDate) matchesDate = false;
                      }

                      return matchesSearch && matchesStatus && matchesYear && matchesDate;
                    });

                    const itemsPerPage = 10;
                    const totalPages = Math.ceil(filteredSessions.length / itemsPerPage);
                    const startIndex = (historyPage - 1) * itemsPerPage;
                    const paginatedSessions = filteredSessions.slice(startIndex, startIndex + itemsPerPage);

                    return (
                      <div className="space-y-5">
                        <div className="pb-3" style={{ borderBottom: '1px solid var(--glass-border-dim)' }}>
                          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Audit Session Archives</h3>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Review, load, or export summaries for all stock audits recorded in the database.</p>
                        </div>

                        {/* Search & Year & Status Segment Panel */}
                        <div className="space-y-3">
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                            {/* Search bar */}
                            <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                              <Search style={{ width: 14, height: 14, color: hc.t3, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                              <input
                                type="text"
                                placeholder="Search audits by name, ID or hospital..."
                                value={historySearch}
                                onChange={e => setHistorySearch(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '8px 12px 8px 32px',
                                  fontSize: 12,
                                  borderRadius: 10,
                                  border: `1px solid ${hc.border}`,
                                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                                  color: hc.t1,
                                  outline: 'none',
                                  boxSizing: 'border-box'
                                }}
                              />
                              {historySearch && (
                                <button
                                  onClick={() => setHistorySearch('')}
                                  style={{
                                    position: 'absolute',
                                    right: 10,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: hc.t3,
                                    padding: 0
                                  }}
                                >
                                  <X style={{ width: 12, height: 12 }} />
                                </button>
                              )}
                            </div>

                            {/* Status segmented picker */}
                            <div style={{
                              display: 'flex',
                              background: isDark ? '#2c2c2e' : '#e3e3e8',
                              padding: 2,
                              borderRadius: 9,
                              alignItems: 'center'
                            }}>
                              {['All', 'Active', 'Completed'].map(opt => {
                                const active = historyStatusFilter === opt;
                                return (
                                  <button
                                    key={opt}
                                    onClick={() => setHistoryStatusFilter(opt)}
                                    style={{
                                      padding: '6px 14px',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      borderRadius: 7,
                                      border: 'none',
                                      background: active ? (isDark ? '#545456' : '#ffffff') : 'transparent',
                                      color: active ? hc.t1 : hc.t3,
                                      boxShadow: active && !isDark ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                                      cursor: 'pointer',
                                      transition: 'all 0.12s ease'
                                    }}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Year Select (Apple popover) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: hc.t3 }}>Year:</span>
                              <button
                                onClick={() => setShowHistoryYearMenu(!showHistoryYearMenu)}
                                style={{
                                  padding: '6px 24px 6px 12px',
                                  fontSize: 11,
                                  fontWeight: 600,
                                  borderRadius: 8,
                                  border: `1px solid ${hc.border}`,
                                  background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
                                  color: hc.t1,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  position: 'relative',
                                  minWidth: '100px',
                                  textAlign: 'left',
                                  justifyContent: 'space-between',
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                  outline: 'none'
                                }}
                              >
                                <span>{historyYearFilter === 'All' ? 'All Years' : historyYearFilter}</span>
                                <ChevronDown style={{ width: 12, height: 12, color: hc.t3, position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} />
                              </button>

                              {showHistoryYearMenu && (
                                <div
                                  onClick={() => setShowHistoryYearMenu(false)}
                                  style={{
                                    position: 'fixed',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    zIndex: 998,
                                    background: 'transparent'
                                  }}
                                />
                              )}

                              {showHistoryYearMenu && (
                                <div className="apple-animate-popover" style={{
                                  position: 'absolute',
                                  top: 'calc(100% + 4px)',
                                  right: 0,
                                  zIndex: 999,
                                  minWidth: '130px',
                                  background: isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.95)',
                                  backdropFilter: 'blur(20px)',
                                  WebkitBackdropFilter: 'blur(20px)',
                                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                                  borderRadius: 10,
                                  padding: '4px',
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 2
                                }}>
                                  <button
                                    onClick={() => {
                                      setHistoryYearFilter('All');
                                      setShowHistoryYearMenu(false);
                                    }}
                                    style={{
                                      padding: '6px 8px',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      borderRadius: 6,
                                      border: 'none',
                                      background: 'transparent',
                                      color: hc.t1,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      textAlign: 'left',
                                      width: '100%',
                                      transition: 'background 0.1s, color 0.1s'
                                    }}
                                    onMouseEnter={e => {
                                      e.currentTarget.style.background = '#007AFF';
                                      e.currentTarget.style.color = '#ffffff';
                                      const checkIcon = e.currentTarget.querySelector('svg');
                                      if (checkIcon) checkIcon.style.color = '#ffffff';
                                    }}
                                    onMouseLeave={e => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.color = hc.t1;
                                      const checkIcon = e.currentTarget.querySelector('svg');
                                      if (checkIcon) checkIcon.style.color = '#007AFF';
                                    }}
                                  >
                                    <span>All Years</span>
                                    {historyYearFilter === 'All' && <Check style={{ width: 12, height: 12, color: '#007AFF' }} />}
                                  </button>
                                  {historyYears.map(yr => (
                                    <button
                                      key={yr}
                                      onClick={() => {
                                        setHistoryYearFilter(yr);
                                        setShowHistoryYearMenu(false);
                                      }}
                                      style={{
                                        padding: '6px 8px',
                                        fontSize: 11,
                                        fontWeight: 600,
                                        borderRadius: 6,
                                        border: 'none',
                                        background: 'transparent',
                                        color: hc.t1,
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        textAlign: 'left',
                                        width: '100%',
                                        transition: 'background 0.1s, color 0.1s'
                                      }}
                                      onMouseEnter={e => {
                                        e.currentTarget.style.background = '#007AFF';
                                        e.currentTarget.style.color = '#ffffff';
                                        const checkIcon = e.currentTarget.querySelector('svg');
                                        if (checkIcon) checkIcon.style.color = '#ffffff';
                                      }}
                                      onMouseLeave={e => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = hc.t1;
                                        const checkIcon = e.currentTarget.querySelector('svg');
                                        if (checkIcon) checkIcon.style.color = '#007AFF';
                                      }}
                                    >
                                      <span>{yr}</span>
                                      {historyYearFilter === yr && <Check style={{ width: 12, height: 12, color: '#007AFF' }} />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Date Range Selector Card */}
                          <div style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 12,
                            alignItems: 'center',
                            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                            padding: '8px 12px',
                            borderRadius: 12,
                            border: `1px solid ${hc.border}`
                          }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: hc.t3, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Calendar style={{ width: 12, height: 12, color: '#007AFF' }} />
                              Filter by Date:
                            </span>

                            <HistoryAppleCalendar
                              label="From"
                              value={tempHistoryFromDate}
                              onChange={setTempHistoryFromDate}
                              isOpen={showHistoryFromCal}
                              setIsOpen={setShowHistoryFromCal}
                              calMonth={historyFromCalMonth}
                              setCalMonth={setHistoryFromCalMonth}
                              calYear={historyFromCalYear}
                              setCalYear={setHistoryFromCalYear}
                            />

                            <HistoryAppleCalendar
                              label="To"
                              value={tempHistoryToDate}
                              onChange={setTempHistoryToDate}
                              isOpen={showHistoryToCal}
                              setIsOpen={setShowHistoryToCal}
                              calMonth={historyToCalMonth}
                              setCalMonth={setHistoryToCalMonth}
                              calYear={historyToCalYear}
                              setCalYear={setHistoryToCalYear}
                            />

                            {/* Apply Button */}
                            {(tempHistoryFromDate !== historyFromDate || tempHistoryToDate !== historyToDate) && (
                              <button
                                onClick={() => {
                                  setHistoryFromDate(tempHistoryFromDate);
                                  setHistoryToDate(tempHistoryToDate);
                                }}
                                style={{
                                  padding: '5px 12px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: 6,
                                  border: 'none',
                                  background: '#007AFF',
                                  color: '#ffffff',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  boxShadow: '0 2px 6px rgba(0,122,255,0.2)',
                                  transition: 'opacity 0.1s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                                onMouseLeave={e => e.currentTarget.style.opacity = 1}
                              >
                                Apply
                              </button>
                            )}

                            {/* Clear button */}
                            {(historyFromDate || historyToDate || tempHistoryFromDate || tempHistoryToDate) && (
                              <button
                                onClick={() => {
                                  setTempHistoryFromDate('');
                                  setTempHistoryToDate('');
                                  setHistoryFromDate('');
                                  setHistoryToDate('');
                                }}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: 6,
                                  border: 'none',
                                  background: 'rgba(255,59,48,0.1)',
                                  color: '#FF3B30',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  marginLeft: 'auto'
                                }}
                                onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                                onMouseLeave={e => e.currentTarget.style.opacity = 1}
                              >
                                <X style={{ width: 11, height: 11 }} />
                                Clear Dates
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Table list of sessions */}
                        {filteredSessions.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '64px 16px' }} className="glass rounded-2xl">
                            <Package style={{ width: 44, height: 44, margin: '0 auto 12px', opacity: 0.15, color: hc.t1 }} />
                            <p style={{ fontSize: 14, fontWeight: 700, color: hc.t2 }}>No matching session archives found</p>
                          </div>
                        ) : (
                          <>
                            <div className="overflow-x-auto border rounded-none" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', background: isDark ? 'rgba(30,30,32,0.95)' : '#ffffff' }}>
                              <table className="w-full border-collapse text-left text-xs">
                                <thead>
                                  <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)' }}>
                                    <th className="p-3 font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 text-[10px] w-14" style={{ borderRight: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}>ID</th>
                                    <th className="p-3 font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 text-[10px]" style={{ borderRight: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}>Session Name</th>
                                    <th className="p-3 font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 text-[10px]" style={{ borderRight: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}>Hospital / Site</th>
                                    <th className="p-3 font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 text-[10px] w-28" style={{ borderRight: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}>Start Date</th>
                                    <th className="p-3 font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 text-[10px] w-28" style={{ borderRight: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}>End Date</th>
                                    <th className="p-3 font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 text-[10px] w-24 text-center" style={{ borderRight: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)', borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}>Status</th>
                                    <th className="p-3 font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 text-[10px] w-72 text-right" style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.1)' }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {paginatedSessions.map(s => {
                                    const isCurrent = activeSession?.id === s.id;
                                    const cellBorderStyle = {
                                      borderRight: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
                                      borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
                                    };
                                    const lastCellBorderStyle = {
                                      borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)'
                                    };
                                    return (
                                      <tr
                                        key={s.id}
                                        className="transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.02]"
                                        style={{ background: isCurrent ? (isDark ? 'rgba(0,122,255,0.03)' : 'rgba(0,122,255,0.015)') : 'transparent' }}
                                      >
                                        {/* ID */}
                                        <td className="p-3 font-mono font-bold text-zinc-400 dark:text-zinc-500" style={cellBorderStyle}>
                                          #{s.id}
                                        </td>

                                        {/* Session Name */}
                                        <td className="p-3 font-extrabold uppercase text-zinc-900 dark:text-zinc-50 tracking-tight" style={cellBorderStyle}>
                                          {s.name}
                                        </td>

                                        {/* Hospital / Site */}
                                        <td className="p-3 text-zinc-600 dark:text-zinc-350" style={cellBorderStyle}>
                                          <div className="flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500 shrink-0" />
                                            <span className="truncate max-w-[200px]" title={s.hospital_name || 'General Inventory'}>
                                              {s.hospital_name || 'General Inventory'}
                                            </span>
                                          </div>
                                        </td>

                                        {/* Start Date */}
                                        <td className="p-3 font-mono text-zinc-600 dark:text-zinc-450" style={cellBorderStyle}>
                                          {s.audit_date}
                                        </td>

                                        {/* End Date */}
                                        <td className="p-3 font-mono" style={cellBorderStyle}>
                                          {s.status === 'Completed' ? (
                                            <span className="text-zinc-600 dark:text-zinc-450">{s.audit_date}</span>
                                          ) : (
                                            <span className="text-blue-500 font-bold">Ongoing</span>
                                          )}
                                        </td>

                                        {/* Status */}
                                        <td className="p-3 text-center" style={cellBorderStyle}>
                                          {s.status === 'Completed' ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700/60 whitespace-nowrap">
                                              🔒 Locked
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-black uppercase bg-blue-500/10 text-blue-500 border border-blue-500/20 whitespace-nowrap">
                                              <span className="active-pulse-dot" /> Active
                                            </span>
                                          )}
                                        </td>

                                        {/* Actions */}
                                        <td className="p-3" style={lastCellBorderStyle}>
                                          <div className="flex items-center justify-end gap-2">
                                            {/* Load/Viewing button */}
                                            <button
                                              onClick={() => { setActiveSession(s); setActiveTab('dashboard'); }}
                                              className="px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide uppercase transition-all border border-none shadow-sm cursor-pointer whitespace-nowrap"
                                              style={{
                                                background: isCurrent ? '#007AFF' : (isDark ? 'rgba(255,255,255,0.06)' : '#f2f2f7'),
                                                color: isCurrent ? '#ffffff' : 'var(--text-secondary)',
                                                boxShadow: isCurrent ? '0 2px 8px rgba(0,122,255,0.2)' : 'none'
                                              }}
                                            >
                                              {isCurrent ? '✓ Current' : '📂 Load'}
                                            </button>

                                            {/* Excel export */}
                                            {userUpperTier && (
                                              <a
                                                href={`${API_BASE}/api/audits/${s.id}/export`}
                                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border decoration-none transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                                style={{
                                                  background: 'rgba(52,199,89,0.08)',
                                                  borderColor: 'rgba(52,199,89,0.15)',
                                                  color: '#34C759'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(52,199,89,0.14)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(52,199,89,0.08)'}
                                                title="Export to Excel"
                                                download
                                              >
                                                📊 Excel
                                              </a>
                                            )}

                                            {/* Word export */}
                                            {userUpperTier && (
                                              <a
                                                href={`${API_BASE}/api/audits/${s.id}/export/word`}
                                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase border decoration-none transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                                style={{
                                                  background: 'rgba(0,122,255,0.08)',
                                                  borderColor: 'rgba(0,122,255,0.15)',
                                                  color: '#007AFF'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,122,255,0.14)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,122,255,0.08)'}
                                                title="Export to Word"
                                                download
                                              >
                                                📝 Word
                                              </a>
                                            )}

                                            {/* Delete */}
                                            {userPrivileged && (
                                              <button
                                                onClick={() => handleDeleteSession(s.id, s.name)}
                                                className="h-7 w-7 rounded-lg border border-none flex items-center justify-center cursor-pointer transition-all shrink-0"
                                                style={{
                                                  background: isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.06)',
                                                  color: '#FF3B30'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,59,48,0.22)' : 'rgba(255,59,48,0.13)'}
                                                onMouseLeave={e => e.currentTarget.style.background = isDark ? 'rgba(255,59,48,0.12)' : 'rgba(255,59,48,0.06)'}
                                                title="Delete Session"
                                              >
                                                <Trash2 className="h-3.5 w-3.5" />
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 12,
                              marginTop: 24,
                              paddingTop: 16,
                              borderTop: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
                              fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", sans-serif'
                            }}>
                              <button
                                disabled={historyPage === 1}
                                onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                style={{
                                  padding: '8px 16px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: 10,
                                  border: `1px solid ${hc.border}`,
                                  background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                                  color: historyPage === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                  cursor: historyPage === 1 ? 'not-allowed' : 'pointer',
                                  opacity: historyPage === 1 ? 0.4 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  boxSizing: 'border-box',
                                  transition: 'background-color 0.15s, opacity 0.15s'
                                }}
                              >
                                <ChevronLeft style={{ width: 13, height: 13 }} />
                                Previous
                              </button>

                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 80, textAlign: 'center' }}>
                                Page {historyPage} of {Math.max(1, totalPages)}
                              </span>

                              <button
                                disabled={historyPage >= totalPages || totalPages === 0}
                                onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                                style={{
                                  padding: '8px 16px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: 10,
                                  border: `1px solid ${hc.border}`,
                                  background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
                                  color: (historyPage >= totalPages || totalPages === 0) ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                  cursor: (historyPage >= totalPages || totalPages === 0) ? 'not-allowed' : 'pointer',
                                  opacity: (historyPage >= totalPages || totalPages === 0) ? 0.4 : 1,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  boxSizing: 'border-box',
                                  transition: 'background-color 0.15s, opacity 0.15s'
                                }}
                              >
                                Next
                                <ChevronRight style={{ width: 13, height: 13 }} />
                              </button>
                            </div>
                          </>)}
                      </div>
                    );
                  })()}

                  {activeTab === 'trail' && (
                    <AuditTrail trail={generalTrail} onRefresh={fetchGeneralTrail} isLoading={isLoadingTrail} roleNamesMap={roleNamesMap} />
                  )}
                </div>

                {/* Detail Panel Modal */}
                {selectedItem && (
                  <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-fade-in" onClick={() => setSelectedItem(null)}>
                    <div
                      className="w-full max-w-5xl max-h-[90vh] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl relative animate-slide-up flex flex-col"
                      style={{ background: 'var(--card-solid)', border: '1px solid var(--glass-border)', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="overflow-y-auto flex-1 custom-scrollbar">
                        <DetailsPanel item={selectedItem} currentUser={currentUser} auditIsLocked={auditIsLocked} onClose={() => setSelectedItem(null)} onUpdate={() => { fetchItems(); fetchDashboardMetrics(); }} isDark={isDark} roleNamesMap={roleNamesMap} auditMembers={auditMembers} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Delete Session Confirmation Modal */}
      {deleteSessionTarget && ReactDOM.createPortal(
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '16px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }} onClick={() => setDeleteSessionTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', animation: 'dropdown-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)', background: isDark ? '#1c1c1e' : '#ffffff', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)', boxShadow: '0 32px 80px rgba(0,0,0,0.35)', borderRadius: '22px', padding: '32px 28px 28px', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'rgb(239,68,68)' }}>
              <AlertTriangle style={{ width: 28, height: 28 }} />
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4, color: isDark ? '#f4f4f5' : '#111827', letterSpacing: '-0.02em' }}>Delete Audit Session</h3>
            <div style={{ display: 'inline-block', padding: '4px 12px', borderRadius: '9999px', fontSize: '13px', fontWeight: 700, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>{deleteSessionTarget.name}</div>
            <p style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#6b7280', marginBottom: 20, lineHeight: 1.6 }}>This will permanently delete this audit session, including all physical counts, audit trails, and product data. This action cannot be undone.</p>
            <div style={{ textAlign: 'left', marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: isDark ? '#a1a1aa' : '#52525b', marginBottom: 6 }}>Type the audit name <strong style={{ color: '#ef4444' }}>{deleteSessionTarget.name}</strong> to confirm:</label>
              <input type="text" value={deleteSessionInput} onChange={(e) => setDeleteSessionInput(e.target.value)} placeholder={deleteSessionTarget.name} style={{ width: '100%', padding: '10px 14px', fontSize: '13px', borderRadius: '10px', border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #d4d4d8', background: isDark ? '#2c2c2e' : '#f9f9f9', color: isDark ? '#ffffff' : '#000000', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteSessionTarget(null)} style={{ flex: 1, padding: '11px 16px', fontSize: 13, fontWeight: 600, borderRadius: 12, border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e4e4e7', color: isDark ? '#a1a1aa' : '#52525b', background: 'transparent', cursor: 'pointer' }}>Cancel</button>
              <button onClick={confirmDeleteSession} disabled={isDeletingSession || deleteSessionInput !== deleteSessionTarget.name} style={{ flex: 1, padding: '11px 16px', fontSize: 13, fontWeight: 700, borderRadius: 12, border: 'none', color: '#ffffff', background: (isDeletingSession || deleteSessionInput !== deleteSessionTarget.name) ? (isDark ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.45)') : 'linear-gradient(180deg, #f87171 0%, #dc2626 100%)', cursor: (isDeletingSession || deleteSessionInput !== deleteSessionTarget.name) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
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
