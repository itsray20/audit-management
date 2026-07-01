import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  User, Mail, Phone, MapPin, Shield, Code2, Star, Users, Briefcase,
  Edit3, Check, X, Calendar, ClipboardList, Lock, ChevronRight,
  RefreshCw, AlertTriangle, BarChart2, Search, Building2,
  CheckCircle2, Activity, ChevronDown, ChevronUp
} from 'lucide-react';

const ROLE_CONFIG = {
  Admin: { label: 'Admin', color: '#FF6B35', gradient: 'linear-gradient(135deg, #FF6B35, #F7931E)', icon: Shield },
  Developer: { label: 'Developer', color: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #7C3AED)', icon: Code2 },
  CoFounder: { label: 'Co-Founder', color: '#F59E0B', gradient: 'linear-gradient(135deg, #F59E0B, #D97706)', icon: Star },
  Employee: { label: 'Employee', color: '#007AFF', gradient: 'linear-gradient(135deg, #007AFF, #5856D6)', icon: Briefcase },
};

const STATUS_TABS = [
  { key: 'All', label: 'All' },
  { key: 'Active', label: 'Active' },
  { key: 'Completed', label: 'Completed' },
];

export default function UserProfile({ currentUser, isDark, onSelectAudit }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', username: '', email: '', phone: '', address: '', password: ''
  });

  // My Work filters
  const [workSearch, setWorkSearch] = useState('');
  const [workStatusFilter, setWorkStatusFilter] = useState('All');
  const [workHospitalFilter, setWorkHospitalFilter] = useState('All');
  const [workPage, setWorkPage] = useState(1);
  const workLimit = 5;

  const cfg = ROLE_CONFIG[currentUser?.role] || ROLE_CONFIG.Employee;
  const RoleIcon = cfg.icon;
  const initial = currentUser?.name?.charAt(0)?.toUpperCase() || '?';
  const isFrozen = currentUser?.status === 'frozen';

  const fetchProfile = async () => {
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const res = await axios.get(`/api/users/${currentUser.id}/profile`, {
        headers: { 'x-user-id': currentUser.id }
      });
      setProfile(res.data);
      setNewDisplayName(res.data.name || '');
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, [currentUser?.id]);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const handleSaveName = async () => {
    if (!newDisplayName.trim()) return;
    try {
      await axios.put(`/api/users/${currentUser.id}/displayname`, { display_name: newDisplayName.trim() }, {
        headers: { 'x-user-id': currentUser.id }
      });
      setEditingName(false);
      showMsg('Display name updated! Please log in again to see the change in the header.');
      await fetchProfile();
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to update name.', 'error');
    }
  };

  const handleSaveProfile = async () => {
    try {
      await axios.put(`/api/users/${currentUser.id}`, {
        name: editForm.name,
        username: editForm.username,
        email: editForm.email,
        phone: editForm.phone,
        address: editForm.address,
        role: currentUser.role
      });
      if (editForm.password.trim()) {
        await axios.put(`/api/users/${currentUser.id}/password`, { password: editForm.password.trim() });
      }
      setShowEditModal(false);
      showMsg('Profile updated successfully! If you changed name or username, please log in again to sync fully.');
      await fetchProfile();
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to update profile.', 'error');
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setWorkPage(1);
  }, [workSearch, workStatusFilter, workHospitalFilter]);

  // ── My Work: Flat filtered list, pagination, and dropdown options ──
  const { filteredAudits, paginatedAudits, stats, hospitalOptions } = useMemo(() => {
    const all = profile?.audit_history || [];

    // stats
    const stats = {
      total: all.length,
      active: all.filter(a => a.status === 'Active').length,
      completed: all.filter(a => a.status === 'Completed').length,
      hospitals: new Set(all.map(a => a.hospital_name || 'Unassigned')).size,
    };

    // get list of all unique hospitals present in the user's history for the dropdown filter
    const hospitalsList = [...new Set(all.map(a => a.hospital_name).filter(Boolean))].sort();

    // apply filters
    const s = workSearch.toLowerCase().trim();
    const filtered = all.filter(audit => {
      const matchSearch = !s || (audit.name || '').toLowerCase().includes(s);
      const matchStatus = workStatusFilter === 'All' || audit.status === workStatusFilter;
      const matchHospital = workHospitalFilter === 'All' || audit.hospital_name === workHospitalFilter;
      return matchSearch && matchStatus && matchHospital;
    });

    // sort: active audits first, then descending by date
    const sorted = [...filtered].sort((a, b) => {
      if (a.status === 'Active' && b.status !== 'Active') return -1;
      if (a.status !== 'Active' && b.status === 'Active') return 1;
      return new Date(b.audit_date) - new Date(a.audit_date);
    });

    const offset = (workPage - 1) * workLimit;
    const paginated = sorted.slice(offset, offset + workLimit);

    return {
      filteredAudits: sorted,
      paginatedAudits: paginated,
      stats,
      hospitalOptions: hospitalsList
    };
  }, [profile?.audit_history, workSearch, workStatusFilter, workHospitalFilter, workPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <RefreshCw className="animate-spin h-6 w-6" style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div
      className="space-y-6 max-w-2xl mx-auto"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif' }}
    >
      {/* Frozen Banner */}
      {isFrozen && (
        <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: 'rgba(255,149,0,0.1)', border: '1px solid rgba(255,149,0,0.3)' }}>
          <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: '#FF9500' }} />
          <div>
            <div className="font-bold text-sm" style={{ color: '#FF9500' }}>Account Frozen</div>
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Your account has been frozen by an administrator. You have read-only access. Contact your admin for assistance.</div>
          </div>
        </div>
      )}

      {msg.text && (
        <div className={`p-3 rounded-xl text-xs font-semibold border ${msg.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border-rose-200' : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 border-emerald-200'}`}>
          {msg.text}
        </div>
      )}

      {/* Profile Hero Card */}
      <div
        className="rounded-[28px] overflow-hidden border shadow-xl relative"
        style={{
          background: isDark ? 'linear-gradient(135deg, #2c2c2e 0%, #1c1c1e 100%)' : 'linear-gradient(135deg, #ffffff 0%, #fcfcfd 100%)',
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          boxShadow: isDark ? '0 20px 45px rgba(0,0,0,0.45)' : '0 12px 30px rgba(0,0,0,0.04)'
        }}
      >
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="h-20 w-20 rounded-2xl flex items-center justify-center text-white text-3xl font-black shrink-0" style={{ background: cfg.gradient, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
              {initial}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                {editingName ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      autoFocus
                      value={newDisplayName}
                      onChange={e => setNewDisplayName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                      className="flex-1 text-lg font-bold px-2 py-1 rounded-lg glass-input focus:outline-none"
                      style={{ color: isDark ? '#fff' : '#1c1c1e' }}
                    />
                    <button onClick={handleSaveName} className="p-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(52,199,89,0.15)', color: '#34C759' }}><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingName(false)} className="p-1.5 rounded-lg cursor-pointer" style={{ background: 'rgba(255,59,48,0.08)', color: '#FF3B30' }}><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <h1 className="text-xl font-black text-zinc-900 dark:text-zinc-50" style={{ letterSpacing: '-0.02em' }}>
                      {profile?.name || currentUser?.name}
                    </h1>
                    {!isFrozen && (
                      <button onClick={() => setEditingName(true)} className="p-1 rounded-lg opacity-50 hover:opacity-100 transition-opacity cursor-pointer text-blue-500" title="Edit display name">
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap mt-1">
                <span className="text-xs text-zinc-650 dark:text-zinc-400">@{currentUser?.username}</span>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: `${cfg.color}15`, color: cfg.color, border: `1px solid ${cfg.color}25` }}>
                  <RoleIcon className="h-3 w-3" />
                  {cfg.label}
                </div>
                {isFrozen && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(255,149,0,0.1)', color: '#FF9500', border: '1px solid rgba(255,149,0,0.2)' }}>Frozen</div>
                )}
              </div>
              {profile?.joined_at && (
                <div className="flex items-center justify-center sm:justify-start gap-1 mt-2.5 text-[10px] text-zinc-550 dark:text-zinc-400 font-semibold">
                  <Calendar className="h-3.5 w-3.5" />
                  Joined {new Date(profile.joined_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              )}
            </div>
          </div>

          {/* Contact fields */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Email', value: currentUser?.email || profile?.email, fallback: 'no-email', icon: Mail },
              { label: 'Phone', value: currentUser?.phone || profile?.phone, fallback: 'no-phone', icon: Phone },
              { label: 'Address', value: currentUser?.address || profile?.address, fallback: 'no-address', icon: MapPin },
            ].map(({ label, value, fallback, icon: Icon }) => (
              <div key={label} className="flex items-start gap-3 p-4 rounded-2xl border"
                style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f5f5f7', borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', boxShadow: '0 2px 8px rgba(0,0,0,0.01)' }}>
                <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: cfg.color }} />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider mb-0.5 text-zinc-550 dark:text-zinc-400">{label}</div>
                  <div className="text-xs font-semibold truncate text-zinc-900 dark:text-zinc-100">
                    {value || <span className="italic text-zinc-450 dark:text-zinc-500 font-normal">{fallback}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-zinc-200/50 dark:border-zinc-800/80 pt-4 flex-wrap gap-4">
            {!(currentUser?.role === 'Admin' || currentUser?.role === 'Developer') && (
              <p className="text-[10px] text-zinc-550 dark:text-zinc-400 max-w-sm text-left">
                💡 Only your display name can be edited here. For other changes, contact your administrator.
              </p>
            )}
            {(currentUser?.role === 'Admin' || currentUser?.role === 'Developer') && (
              <button
                onClick={() => {
                  setEditForm({ name: profile?.name || currentUser?.name || '', username: currentUser?.username || '', email: currentUser?.email || profile?.email || '', phone: currentUser?.phone || profile?.phone || '', address: currentUser?.address || profile?.address || '', password: '' });
                  setShowEditModal(true);
                }}
                className="ml-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-250 dark:border-zinc-700 shadow-sm"
              >
                <Edit3 className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-300" /> Edit Profile &amp; Password
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <>
          <div className="fixed inset-0 z-50 cursor-pointer" style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)', width: '100vw', height: '100vh', top: 0, left: 0 }} onClick={() => setShowEditModal(false)} />
          <div className="fixed z-50 rounded-2xl shadow-2xl" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', maxWidth: '480px', width: '92%', maxHeight: '90vh', overflowY: 'auto', background: isDark ? '#1c1c1e' : '#ffffff', border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}>
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Edit Profile &amp; Password</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer" style={{ color: 'var(--text-tertiary)' }}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveProfile(); }} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block text-zinc-400 dark:text-zinc-500">Full Name</label>
                  <input type="text" required value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block text-zinc-400 dark:text-zinc-500">Username</label>
                  <input type="text" required value={editForm.username} onChange={e => setEditForm({ ...editForm, username: e.target.value })} className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block text-zinc-400 dark:text-zinc-500">Email</label>
                  <input type="email" placeholder="name@company.com" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block text-zinc-400 dark:text-zinc-500">Phone</label>
                  <input type="text" placeholder="+91 9XXXXXXXXX" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block text-zinc-400 dark:text-zinc-500">Address</label>
                  <input type="text" placeholder="City, State" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" />
                </div>
                <div className="sm:col-span-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-0.5 block text-zinc-400 dark:text-zinc-500">New Password</label>
                  <span className="text-[9px] text-zinc-400 dark:text-zinc-500 block mb-2">Leave blank to keep your current password.</span>
                  <input type="password" placeholder="Enter new password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 transition-all cursor-pointer">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-xl text-xs font-bold shadow-sm text-white transition-all active:scale-[0.98] hover:opacity-95 cursor-pointer" style={{ background: 'linear-gradient(180deg, #1a8fff, #0071e3)' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ══════════════════════════════════════
          MY WORK — Hospital-wise with Search
      ══════════════════════════════════════ */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: isDark ? 'rgba(30,30,32,0.95)' : '#fff',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
          boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.07)'
        }}
      >
        {/* Section Header */}
        <div className="px-5 pt-5 pb-0">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            <h2 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>My Work</h2>
            <span className="ml-1 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              {stats.total} {stats.total === 1 ? 'audit' : 'audits'}
            </span>
          </div>

          {/* Stats bar */}
          {stats.total > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Active', value: stats.active, color: '#007AFF', bg: 'rgba(0,122,255,0.08)', icon: Activity },
                { label: 'Completed', value: stats.completed, color: '#34C759', bg: 'rgba(52,199,89,0.08)', icon: CheckCircle2 },
                { label: 'Hospitals', value: stats.hospitals, color: '#FF9500', bg: 'rgba(255,149,0,0.08)', icon: Building2 },
              ].map(({ label, value, color, bg, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl" style={{ background: bg, border: `1px solid ${color}20` }}>
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}15` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color }} />
                  </div>
                  <div>
                    <div className="text-sm font-black leading-none" style={{ color }}>{value}</div>
                    <div className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Search + Hospital Filter Selector + Status filter row */}
          {stats.total > 0 && (
            <div className="flex flex-col gap-2.5 mb-4">
              <div className="flex flex-col sm:flex-row gap-2">
                {/* Search input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Search by audit name..."
                    value={workSearch}
                    onChange={e => setWorkSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl focus:outline-none"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`,
                      color: 'var(--text-primary)',
                    }}
                  />
                  {workSearch && (
                    <button onClick={() => setWorkSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer opacity-50 hover:opacity-100 transition-opacity">
                      <X className="h-3.5 w-3.5" style={{ color: 'var(--text-tertiary)' }} />
                    </button>
                  )}
                </div>

                {/* Hospital dropdown selector */}
                <div className="relative shrink-0 sm:w-48">
                  <select
                    value={workHospitalFilter}
                    onChange={e => setWorkHospitalFilter(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 text-xs rounded-xl focus:outline-none appearance-none cursor-pointer font-medium"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)'}`,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <option value="All" style={{ background: isDark ? '#1c1c1e' : '#fff' }}>🏥 All Hospitals</option>
                    {hospitalOptions.map(h => (
                      <option key={h} value={h} style={{ background: isDark ? '#1c1c1e' : '#fff' }}>
                        🏥 {h}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none opacity-50" style={{ color: 'var(--text-tertiary)' }} />
                </div>
              </div>

              {/* Status tabs */}
              <div className="flex items-center gap-0.5 p-0.5 rounded-xl self-start" style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}` }}>
                {STATUS_TABS.map(tab => {
                  const active = workStatusFilter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setWorkStatusFilter(tab.key)}
                      className="px-3 py-1.5 rounded-lg text-[11px] transition-all cursor-pointer whitespace-nowrap"
                      style={{
                        background: active ? (isDark ? 'rgba(255,255,255,0.12)' : '#fff') : 'transparent',
                        color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                        fontWeight: active ? 700 : 500,
                        boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="px-5 pb-5">
          {stats.total === 0 ? (
            <div className="text-center py-10" style={{ color: 'var(--text-tertiary)' }}>
              <ClipboardList className="h-9 w-9 mx-auto mb-2.5 opacity-30" />
              <p className="text-xs font-semibold">No audit work yet</p>
              <p className="text-[11px] mt-1 opacity-60">Once you're assigned to an audit, it will appear here.</p>
            </div>
          ) : filteredAudits.length === 0 ? (
            <div className="text-center py-10" style={{ color: 'var(--text-tertiary)' }}>
              <Search className="h-7 w-7 mx-auto mb-2.5 opacity-30" />
              <p className="text-xs font-semibold">No results found</p>
              <p className="text-[11px] mt-1 opacity-60">Try a different search or filter.</p>
              <button
                onClick={() => { setWorkSearch(''); setWorkStatusFilter('All'); setWorkHospitalFilter('All'); }}
                className="mt-3 text-[11px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-xl overflow-hidden border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
                <div className="divide-y" style={{ borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                  {paginatedAudits.map(audit => (
                    <div
                      key={audit.id}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors group"
                      onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => onSelectAudit && onSelectAudit(audit)}
                    >
                      {/* Audit icon */}
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: audit.status === 'Completed' ? 'rgba(52,199,89,0.1)' : 'rgba(0,122,255,0.1)' }}>
                        {audit.status === 'Completed'
                          ? <Lock className="h-3.5 w-3.5" style={{ color: '#34C759' }} />
                          : <ClipboardList className="h-3.5 w-3.5" style={{ color: '#007AFF' }} />
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-xs truncate" style={{ color: 'var(--text-primary)' }}>{audit.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[10px] flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                            <Building2 className="h-3 w-3 text-amber-500" /> {audit.hospital_name || 'Unassigned'}
                          </span>
                          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>📅 {audit.audit_date}</span>
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                            style={{
                              color: audit.member_status === 'frozen' ? '#FF9500' : audit.member_status === 'removed' ? '#FF3B30' : '#34C759',
                              background: audit.member_status === 'frozen' ? 'rgba(255,149,0,0.1)' : audit.member_status === 'removed' ? 'rgba(255,59,48,0.08)' : 'rgba(52,199,89,0.08)',
                            }}
                          >
                            {audit.member_status}
                          </span>
                        </div>
                      </div>

                      {/* Status pill + arrow */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className="px-2 py-0.5 text-[9px] font-bold rounded-lg"
                          style={{
                            background: audit.status === 'Completed' ? 'rgba(52,199,89,0.12)' : 'rgba(0,122,255,0.1)',
                            color: audit.status === 'Completed' ? '#34C759' : '#007AFF',
                          }}
                        >
                          {audit.status}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--accent)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagination Controls */}
              {filteredAudits.length > workLimit && (
                <div className="flex items-center justify-between pt-3 px-1 text-xs">
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    Showing {((workPage - 1) * workLimit) + 1}–{Math.min(workPage * workLimit, filteredAudits.length)} of {filteredAudits.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setWorkPage(p => Math.max(p - 1, 1))}
                      disabled={workPage === 1}
                      className="px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-40"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      Previous
                    </button>
                    <span className="font-semibold text-zinc-600 dark:text-zinc-400">
                      {workPage} / {Math.ceil(filteredAudits.length / workLimit)}
                    </span>
                    <button
                      onClick={() => setWorkPage(p => Math.min(p + 1, Math.ceil(filteredAudits.length / workLimit)))}
                      disabled={workPage >= Math.ceil(filteredAudits.length / workLimit)}
                      className="px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-40"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.05)' : '#fff',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        color: 'var(--text-primary)'
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
