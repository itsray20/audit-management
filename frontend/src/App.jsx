import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Sun, Moon, Package, UploadCloud, DownloadCloud, Plus, Trash2,
  User, Check, Shield, Activity, ListFilter, Play, RefreshCw, X
} from 'lucide-react';
import Dashboard from './components/Dashboard';
import AuditTable from './components/AuditTable';
import DetailsPanel from './components/DetailsPanel';
import ExtraFoundForm from './components/ExtraFoundForm';
import AuditTrail from './components/AuditTrail';

// In production (Vercel), VITE_API_URL points to the Render backend.
// In local dev, it's empty so the Vite proxy handles /api → localhost:5000.
const API_BASE = import.meta.env.VITE_API_URL || '';


export default function App() {
  // Theme & Identity State
  const [isDark, setIsDark] = useState(true);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState({ username: 'manager', name: 'Audit Manager', role: 'Audit Manager' });

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
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'sheet', 'extra', 'trail'

  // Items and Table States
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit] = useState(30);

  // Table filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [meta, setMeta] = useState({ suppliers: [], locations: [], stores: [] });

  // Drawer / Side Panel Edit State
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

  // Polling Sync toggler
  const [syncEnabled, setSyncEnabled] = useState(true);

  // Apply Light/Dark Class to root HTML
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Initial Boot Data Fetch
  useEffect(() => {
    fetchUsers();
    fetchSessions();
  }, []);

  // Fetch items and dashboard metrics when activeSession changes or page/filters change
  useEffect(() => {
    if (activeSession) {
      fetchItems();
      fetchDashboardMetrics();
      fetchGeneralTrail();
    } else {
      setItems([]);
      setTotalItems(0);
      setDashboardMetrics(null);
      setGeneralTrail([]);
    }
  }, [
    activeSession, currentPage, search, categoryFilter,
    supplierFilter, locationFilter, storeFilter
  ]);

  // Periodic polling sync for real-time collaboration (every 5 seconds)
  useEffect(() => {
    let intervalId;
    if (activeSession && syncEnabled) {
      intervalId = setInterval(() => {
        // Silently reload items and metrics in the background
        fetchItems(true);
        fetchDashboardMetrics(true);
        if (activeTab === 'trail') {
          fetchGeneralTrail(true);
        }
      }, 5000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [
    activeSession, syncEnabled, activeTab, currentPage, search,
    categoryFilter, supplierFilter, locationFilter, storeFilter
  ]);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/api/users');
      setUsers(res.data);
      // Try to find matching user if exists
      const match = res.data.find(u => u.role === 'Audit Manager');
      if (match) setCurrentUser(match);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
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
        params: {
          page: currentPage,
          limit,
          search,
          category: categoryFilter,
          supplier: supplierFilter,
          location: locationFilter,
          store: storeFilter
        }
      });
      setItems(res.data.items);
      setTotalItems(res.data.total);
      setMeta(res.data.meta);

      // Keep the open detail panel item synchronized
      if (selectedItem) {
        const updatedSelectedItem = res.data.items.find(i => i.id === selectedItem.id);
        if (updatedSelectedItem) {
          setSelectedItem(updatedSelectedItem);
        }
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
      console.error('Failed to load trail logs:', err);
    } finally {
      if (!isSilent) setIsLoadingTrail(false);
    }
  };

  const handleCreateSession = async (e) => {
    e.preventDefault();
    if (!newSessionName) return;
    try {
      const res = await axios.post('/api/audits', {
        name: newSessionName,
        audit_date: newSessionDate
      });
      setNewSessionName('');
      setIsCreatingSession(false);
      await fetchSessions();
      setActiveSession(res.data);
      setActiveTab('sheet'); // Go to sheet tab to allow import
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const handleDeleteSession = async (id) => {
    if (!window.confirm('Are you absolutely sure you want to delete this audit session and all of its counts? This is irreversible.')) {
      return;
    }
    try {
      await axios.delete(`/api/audits/${id}`);
      setActiveSession(null);
      await fetchSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
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
      setUploadStatus(`Imported successfully: ${res.data.imported_rows} rows added!`);
      setUploadFile(null);
      // Reload
      fetchItems();
      fetchDashboardMetrics();
    } catch (err) {
      setUploadStatus(err.response?.data?.error || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  // Get distinct list of auditor names currently logged in database counts for columns
  const getActiveAuditorsList = () => {
    if (!dashboardMetrics || !items) return ['Sri', 'Sravani', 'Sanathu', 'Sha'];
    // In our seed/excel, we have Sri, Sravani, Sanathu, Sha. We return them as default, 
    // but check if there are others in the db.
    return ['Sri', 'Sravani', 'Sanathu', 'Sha', 'Extra Count'];
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#09090b] text-zinc-900 dark:text-zinc-50 font-sans transition-colors duration-200">

      {/* App Header */}
      <header className="bg-white dark:bg-[#0c0c0f] border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">

          {/* Title & Brand */}
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md">
              <Package className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">Ray's Audit</h1>
              <p className="text-xs text-zinc-500 font-medium">Pharmacy Stock Audit Management System</p>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center gap-3">

            {/* Session Selector */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1">
              <select
                value={activeSession?.id || ''}
                onChange={(e) => {
                  const sess = sessions.find(s => s.id === parseInt(e.target.value));
                  setActiveSession(sess);
                  setCurrentPage(1);
                }}
                className="text-xs font-semibold px-2 py-1.5 bg-transparent focus:outline-none border-none text-zinc-800 dark:text-zinc-100"
              >
                {sessions.length === 0 ? (
                  <option value="">No Active Sessions</option>
                ) : (
                  sessions.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.audit_date})</option>
                  ))
                )}
              </select>
              <button
                onClick={() => setIsCreatingSession(true)}
                className="p-1.5 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 transition-colors"
                title="Create New Audit"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Current User Selector */}
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-1 text-xs">
              <User className="h-3.5 w-3.5 text-zinc-400 ml-1.5" />
              <select
                value={currentUser.id || ''}
                onChange={(e) => {
                  const usr = users.find(u => u.id === parseInt(e.target.value));
                  if (usr) setCurrentUser(usr);
                }}
                className="font-semibold bg-transparent focus:outline-none pr-4 text-zinc-800 dark:text-zinc-100"
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            {/* Sync Status Button */}
            <button
              onClick={() => setSyncEnabled(!syncEnabled)}
              className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${syncEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/40'
                : 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800'
                }`}
              title={syncEnabled ? 'Real-time sync active (polling every 5s)' : 'Sync disabled'}
            >
              <Activity className={`h-3.5 w-3.5 ${syncEnabled ? 'animate-pulse' : ''}`} />
              {syncEnabled ? 'Live' : 'Paused'}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout Container */}
      <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">

        {/* Modal: Create Session Form */}
        {isCreatingSession && (
          <div className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl max-w-md w-full shadow-2xl p-6 relative">
              <button
                onClick={() => setIsCreatingSession(false)}
                className="absolute right-4 top-4 p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500"
              >
                <X className="h-5 w-5" />
              </button>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50 mb-4">Start New Pharmacy Audit</h3>
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500 font-semibold">Audit Session Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kukatpally Pharmacy Audit March 2026"
                    value={newSessionName}
                    onChange={(e) => setNewSessionName(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-500 font-semibold">Audit Reference Date</label>
                  <input
                    type="date"
                    required
                    value={newSessionDate}
                    onChange={(e) => setNewSessionDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-50"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full flex justify-center items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors border border-blue-700"
                >
                  <Play className="h-3.5 w-3.5" />
                  Launch Audit
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Audit Session Controls Panel (Export, Import and deletes) */}
        {activeSession && (
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-zinc-950 dark:text-zinc-50">{activeSession.name}</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400">
                  Ref Date: {activeSession.audit_date}
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Created: {new Date(activeSession.created_at).toLocaleString()} • ID: #{activeSession.id}
              </p>
            </div>

            {/* Importer & Exporter Buttons */}
            <div className="flex flex-wrap items-center gap-2">

              {/* Import Excel */}
              <form onSubmit={handleFileUpload} className="flex items-center gap-2">
                <label className="cursor-pointer flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                  <UploadCloud className="h-3.5 w-3.5 text-zinc-400" />
                  {uploadFile ? uploadFile.name : 'Select Import File'}
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files.length > 0) {
                        setUploadFile(e.target.files[0]);
                        setUploadStatus('');
                      }
                    }}
                  />
                </label>
                {uploadFile && (
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-blue-700 disabled:opacity-50"
                  >
                    {isUploading ? 'Importing...' : 'Upload'}
                  </button>
                )}
              </form>

              {/* Status Message */}
              {uploadStatus && (
                <span className="text-xs text-zinc-500 font-semibold px-2">{uploadStatus}</span>
              )}

              {/* Export Button */}
              <a
                href={`/api/audits/${activeSession.id}/export`}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border border-blue-200 dark:border-blue-800/40 rounded-lg bg-blue-50/50 hover:bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400 dark:hover:bg-blue-950/30 transition-colors"
                download
              >
                <DownloadCloud className="h-3.5 w-3.5" />
                Export final Report
              </a>

              {/* Delete Session (Admin Only) */}
              {currentUser.role === 'Admin' && (
                <button
                  onClick={() => handleDeleteSession(activeSession.id)}
                  className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-rose-50 hover:border-rose-200 dark:hover:bg-rose-950/20 text-rose-500 transition-colors"
                  title="Delete Audit Session"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab Selection Row */}
        {activeSession && (
          <div className="flex border-b border-zinc-200 dark:border-zinc-800 text-sm">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2.5 font-medium -mb-px transition-all ${activeTab === 'dashboard'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('sheet')}
              className={`px-4 py-2.5 font-medium -mb-px transition-all ${activeTab === 'sheet'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
            >
              Audit Sheet
            </button>
            <button
              onClick={() => setActiveTab('extra')}
              className={`px-4 py-2.5 font-medium -mb-px transition-all ${activeTab === 'extra'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
            >
              Log Extra Found
            </button>
            <button
              onClick={() => setActiveTab('trail')}
              className={`px-4 py-2.5 font-medium -mb-px transition-all ${activeTab === 'trail'
                ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                }`}
            >
              Audit Trail Log
            </button>
          </div>
        )}

        {/* Main Tab Render Grid */}
        {!activeSession ? (
          <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center max-w-xl mx-auto space-y-4 shadow-sm">
            <Package className="h-12 w-12 text-zinc-400 mx-auto" />
            <h3 className="text-lg font-bold text-zinc-950 dark:text-zinc-50">No Active Audit Session</h3>
            <p className="text-sm text-zinc-500">
              Create an audit session or select an existing one to start counting and analyzing stock counts.
            </p>
            <button
              onClick={() => setIsCreatingSession(true)}
              className="inline-flex justify-center items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create Audit Session
            </button>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6 relative items-start">

            {/* Left Content Area (dynamic tab size) */}
            <div className={`transition-all duration-300 ${selectedItem ? 'w-full lg:w-2/3' : 'w-full'}`}>
              {activeTab === 'dashboard' && (
                <Dashboard
                  metrics={dashboardMetrics}
                  isDark={isDark}
                />
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
                  categoryFilter={categoryFilter}
                  setCategoryFilter={setCategoryFilter}
                  supplierFilter={supplierFilter}
                  setSupplierFilter={setSupplierFilter}
                  locationFilter={locationFilter}
                  setLocationFilter={setLocationFilter}
                  storeFilter={storeFilter}
                  setStoreFilter={setStoreFilter}
                  meta={meta}
                  onRowClick={(item) => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                  selectedItemId={selectedItem?.id}
                  auditors={getActiveAuditorsList()}
                />
              )}

              {activeTab === 'extra' && (
                <ExtraFoundForm
                  sessionId={activeSession.id}
                  currentUser={currentUser}
                  onSuccess={() => {
                    fetchItems();
                    fetchDashboardMetrics();
                  }}
                />
              )}

              {activeTab === 'trail' && (
                <AuditTrail
                  trail={generalTrail}
                  onRefresh={fetchGeneralTrail}
                  isLoading={isLoadingTrail}
                />
              )}
            </div>

            {/* Right Sliding Detail Panel (collapsible) */}
            {selectedItem && (
              <div className="w-full lg:w-1/3 lg:sticky lg:top-24 h-[85vh] overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-lg">
                <DetailsPanel
                  item={selectedItem}
                  currentUser={currentUser}
                  onClose={() => setSelectedItem(null)}
                  onUpdate={() => {
                    fetchItems();
                    fetchDashboardMetrics();
                  }}
                />
              </div>
            )}

          </div>
        )}

      </main>
    </div>
  );
}
