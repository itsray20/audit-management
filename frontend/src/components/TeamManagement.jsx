import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Plus, Trash2, Edit3, Shield, UserX, UserCheck, RefreshCw,
  User, Mail, Phone, MapPin, Calendar, ChevronDown, ChevronUp,
  Building2, Star, Code2, Users, Briefcase, AlertTriangle, Check, X,
  Search, ArrowLeft, ClipboardList, Activity, ChevronRight
} from 'lucide-react';

const ROLE_CONFIG = {
  Admin: {
    label: 'Admin',
    color: '#FF6B35',
    gradient: 'radial-gradient(circle at 10% 20%, rgba(255, 107, 53, 0.95) 0%, rgba(255, 107, 53, 0.4) 50%, transparent 90%), radial-gradient(circle at 90% 80%, rgba(247, 147, 30, 0.9) 0%, rgba(247, 147, 30, 0.3) 60%, transparent 90%), linear-gradient(135deg, #FF6B35, #E25822)',
    bg: 'rgba(255,107,53,0.1)',
    border: 'rgba(255,107,53,0.25)',
    icon: Shield,
    tier: 'leadership',
  },
  Developer: {
    label: 'Developer',
    color: '#8B5CF6',
    gradient: 'radial-gradient(circle at 10% 20%, rgba(139, 92, 246, 0.95) 0%, rgba(139, 92, 246, 0.4) 50%, transparent 90%), radial-gradient(circle at 90% 80%, rgba(236, 72, 153, 0.85) 0%, rgba(236, 72, 153, 0.3) 60%, transparent 90%), linear-gradient(135deg, #7C3AED, #4F46E5)',
    bg: 'rgba(139,92,246,0.1)',
    border: 'rgba(139,92,246,0.25)',
    icon: Code2,
    tier: 'leadership',
  },
  CoFounder: {
    label: 'Co-Founder',
    color: '#F59E0B',
    gradient: 'radial-gradient(circle at 10% 20%, rgba(245, 158, 11, 0.95) 0%, rgba(245, 158, 11, 0.4) 50%, transparent 90%), radial-gradient(circle at 90% 80%, rgba(217, 119, 6, 0.85) 0%, rgba(217, 119, 6, 0.3) 60%, transparent 90%), linear-gradient(135deg, #F59E0B, #B45309)',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.25)',
    icon: Star,
    tier: 'leadership',
  },

  Employee: {
    label: 'Employee',
    color: '#007AFF',
    gradient: 'radial-gradient(circle at 10% 20%, rgba(0, 122, 255, 0.95) 0%, rgba(0, 122, 255, 0.4) 50%, transparent 90%), radial-gradient(circle at 90% 80%, rgba(6, 182, 212, 0.85) 0%, rgba(6, 182, 212, 0.3) 60%, transparent 90%), linear-gradient(135deg, #007AFF, #5856D6)',
    bg: 'rgba(0,122,255,0.1)',
    border: 'rgba(0,122,255,0.25)',
    icon: Briefcase,
    tier: 'employee',
  },
};

const LEADERSHIP_ROLES = ['Admin', 'Developer', 'CoFounder'];

const EMPLOYEE_ROLES = ['Employee'];
const PROTECTED_ROLES = ['Admin', 'Developer'];

function UserCard({ user, onEdit, onFreeze, onRemove, onViewProfile, isDark, currentUser }) {
  const [hovered, setHovered] = useState(false);
  const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.Employee;

  // Custom check for protection:
  // - A card is protected (Secure Account showing / no actions) if:
  //   - The user is the currentUser themselves (prevent self-demotion/self-freeze from list).
  //   - The user is a Developer and the currentUser is not a Developer (Developers are fixed and secure).
  //   - The user is an Admin and the currentUser is neither Admin nor Developer.
  let isProtected = false;
  if (user.id === currentUser?.id) {
    isProtected = true;
  } else if (user.role === 'Developer') {
    isProtected = currentUser?.role !== 'Developer';
  } else if (user.role === 'Admin') {
    isProtected = currentUser?.role !== 'Developer';
  }

  const statusColor = user.status === 'active' ? '#34C759' : user.status === 'frozen' ? '#FF9500' : '#FF3B30';
  const statusLabel = user.status === 'active' ? 'Active' : user.status === 'frozen' ? 'Frozen' : 'Removed';

  // First name for profile branding
  const firstName = (user.name || '').trim().split(/\s+/)[0].toUpperCase();
  const RoleIcon = cfg.icon || Briefcase;

  return (
    <div
      onClick={onViewProfile}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative rounded-[24px] transition-all duration-300 hover:scale-[1.025] hover:shadow-2xl cursor-pointer flex flex-col justify-between mt-6 group border overflow-hidden"
      style={{
        background: isDark 
          ? 'linear-gradient(135deg, #3a3a3c 0%, #2c2c2e 50%, #1c1c1e 100%)' 
          : 'linear-gradient(135deg, #e8e8ed 0%, #ffffff 50%, #d2d2d7 100%)',
        borderColor: hovered ? `${cfg.color}60` : (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
        boxShadow: hovered 
          ? (isDark ? `0 20px 45px rgba(0,0,0,0.55), 0 0 16px ${cfg.color}25` : `0 14px 32px rgba(0,0,0,0.08), 0 0 12px ${cfg.color}15`)
          : (isDark ? '0 12px 36px rgba(0,0,0,0.35)' : '0 6px 20px rgba(0,0,0,0.04)'),
        width: '260px',
        height: '380px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
      }}
    >
      {/* Top Section: Smartcard Header (EMV Chip Icon & Serial Number) */}
      <div className="p-5 flex items-center justify-between shrink-0">
        {/* EMV-Style Metallic Role Chip */}
        <div 
          className="w-10 h-8 rounded-lg border border-white/20 flex items-center justify-center shadow-md relative overflow-hidden"
          style={{ 
            background: cfg.gradient,
            boxShadow: `0 3px 8px ${cfg.color}25`
          }}
        >
          {/* Micro-chip grid lines */}
          <div className="absolute inset-0 opacity-15 pointer-events-none border-b border-r border-white/30" />
          <RoleIcon className="h-4 w-4 text-white relative z-10" />
        </div>

        {/* Monospaced Card Serial Code */}
        <div className="text-right">
          <p className="font-mono text-[9px] font-bold text-zinc-500 dark:text-zinc-400 tracking-wider">
            № 0000 · {String(user.id).padStart(2, '0')}
          </p>
          <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-[7.5px] font-bold uppercase tracking-wider" style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Middle Section: Clean Bold Typography Nameplate (Dark/Light etched print) */}
      <div className="px-5 text-center flex-1 flex flex-col justify-center select-none pt-2">
        <h3 className="font-black text-xl tracking-wide text-zinc-900 dark:text-zinc-100 uppercase leading-none">
          {firstName}
        </h3>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1.5 font-semibold">@{user.username}</p>
        <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 mt-2 truncate max-w-full px-2">
          {user.name}
        </p>
      </div>

      {/* Bottom Section: Contact details, status light & Actions */}
      <div className="p-5 pt-0 shrink-0 space-y-4">
        {/* Contact info grid */}
        <div className="space-y-1.5 pt-3.5 border-t border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-650 dark:text-zinc-400 font-semibold">
          <p className="truncate text-left flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
            <Mail className="h-3.5 w-3.5 text-zinc-550 dark:text-zinc-450 shrink-0" />
            <span className="truncate">{user.email || <span className="italic text-zinc-450 dark:text-zinc-500 font-normal">no-email</span>}</span>
          </p>
          <p className="font-mono text-[9px] text-zinc-700 dark:text-zinc-300 text-left flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-zinc-550 dark:text-zinc-450 shrink-0" />
            <span>{user.phone || <span className="italic text-zinc-450 dark:text-zinc-500 font-normal">no-phone</span>}</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="pt-1.5">
          {!isProtected ? (
            <div className="flex gap-2 justify-between">
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(user); }}
                className="flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border cursor-pointer text-center bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700 shadow-sm"
              >
                Edit
              </button>
              {(user.role !== 'Admin' || currentUser?.role === 'Developer') && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onFreeze(user); }}
                    className={`flex-1 py-1.5 rounded-xl text-[10px] font-bold transition-all border cursor-pointer text-center shadow-sm ${
                      user.status === 'frozen'
                        ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-200 dark:border-emerald-900/30'
                        : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/30'
                    }`}
                  >
                    {user.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemove(user); }}
                    className="px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all border cursor-pointer bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-200 dark:border-rose-900/30 shadow-sm"
                    title="Remove member"
                  >
                    Remove
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 py-1.5 text-[9px] font-bold text-zinc-550 dark:text-zinc-400 bg-zinc-100/70 dark:bg-zinc-800/30 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
              <Shield className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-450" /> Secure Account
            </div>
          )}
        </div>
      </div>

      {/* Bottom Status Color Edge Accent Bar */}
      <div 
        className="h-1.5 w-full shrink-0 relative"
        style={{ background: statusColor }}
      >
        {/* Ambient status light pulse */}
        <div className="absolute inset-0 bg-white/20 animate-pulse" />
      </div>
    </div>
  );
}

function PreviouslyEmployedCard({ user, onRehire, isDark }) {
  const cfg = ROLE_CONFIG[user.role] || ROLE_CONFIG.Employee;
  const initial = user.name?.charAt(0)?.toUpperCase() || '?';
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl transition-all" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}` }}>
      <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0 opacity-60" style={{ background: cfg.gradient }}>
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{user.name}</div>
        <div className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>@{user.username} · {cfg.label}</div>
        {user.removed_at && <div className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Removed: {new Date(user.removed_at).toLocaleDateString()}</div>}
      </div>
      <button
        onClick={() => onRehire(user)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0"
        style={{ background: 'rgba(52,199,89,0.12)', color: '#34C759', border: '1px solid rgba(52,199,89,0.2)' }}
      >
        <UserCheck className="h-3 w-3" /> Re-hire
      </button>
    </div>
  );
}

export default function TeamManagement({ isDark, currentUser }) {
  const getIsProtected = (targetUser) => {
    if (!targetUser) return true;
    if (targetUser.id === currentUser?.id) return true;
    if (targetUser.role === 'Developer') {
      return currentUser?.role !== 'Developer';
    }
    if (targetUser.role === 'Admin') {
      return currentUser?.role !== 'Developer';
    }
    return false;
  };

  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPrevEmployed, setShowPrevEmployed] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [profileDetails, setProfileDetails] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [selectedAuditSession, setSelectedAuditSession] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');

  const handleViewProfile = async (user) => {
    setSelectedProfileId(user.id);
    setProfileDetails(null);
    setSelectedAuditSession(null);
    setAuditLogs([]);
    setLogSearchQuery('');
    setProfileLoading(true);
    try {
      const res = await axios.get(`/api/users/${user.id}/profile`, {
        headers: { 'x-user-id': user.id }
      });
      setProfileDetails(res.data);
    } catch (err) {
      console.error('Failed to load profile details:', err);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleViewAuditLogs = async (audit) => {
    setSelectedAuditSession(audit);
    setLogsLoading(true);
    setLogSearchQuery('');
    try {
      const res = await axios.get(`/api/audits/${audit.id}/trail`);
      const userLogs = (res.data || []).filter(
        log => String(log.user_name) === String(selectedProfileId)
      );
      setAuditLogs(userLogs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  const [confirmAction, setConfirmAction] = useState(null); // { user, action }
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const [newUserForm, setNewUserForm] = useState({
    username: '', name: '', password: '', role: 'CoFounder',
    email: '', phone: '', address: ''
  });

  const [editForm, setEditForm] = useState({
    name: '', username: '', password: '', email: '', phone: '', address: '', role: ''
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/users');
      setAllUsers(res.data);
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to load users.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (editTarget || confirmAction) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [editTarget, confirmAction]);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/users', newUserForm);
      setNewUserForm({ username: '', name: '', password: '', role: 'CoFounder', email: '', phone: '', address: '' });
      setShowAddForm(false);
      showMsg('User created successfully.');
      fetchUsers();
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to create user.', 'error');
    }
  };

  const refreshProfile = async (userId) => {
    try {
      const res = await axios.get(`/api/users/${userId}/profile`, {
        headers: { 'x-user-id': userId }
      });
      setProfileDetails(res.data);
    } catch (err) {
      console.error('Failed to refresh profile details:', err);
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    try {
      await axios.put(`/api/users/${editTarget.id}`, editForm);
      const editedId = editTarget.id;
      setEditTarget(null);
      showMsg('User updated successfully.');
      fetchUsers();
      if (selectedProfileId && String(selectedProfileId) === String(editedId)) {
        refreshProfile(editedId);
      }
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to update user.', 'error');
    }
  };

  const handleFreeze = async (user) => {
    const newStatus = user.status === 'frozen' ? 'active' : 'frozen';
    try {
      await axios.put(`/api/users/${user.id}/status`, { status: newStatus });
      showMsg(`User ${newStatus === 'frozen' ? 'frozen' : 'unfrozen'} successfully.`);
      fetchUsers();
      if (selectedProfileId && String(selectedProfileId) === String(user.id)) {
        refreshProfile(user.id);
      }
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to update status.', 'error');
    }
    setConfirmAction(null);
  };

  const handleRemove = async (user) => {
    try {
      await axios.put(`/api/users/${user.id}/status`, { status: 'removed' });
      showMsg('User removed. They appear in Previously Employed.');
      fetchUsers();
      if (selectedProfileId && String(selectedProfileId) === String(user.id)) {
        // If viewing, refresh will reflect their removed/rehired status or close the profile
        refreshProfile(user.id);
      }
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to remove user.', 'error');
    }
    setConfirmAction(null);
  };

  const handleRehire = async (user) => {
    try {
      await axios.put(`/api/users/${user.id}/status`, { status: 'active' });
      showMsg(`${user.name} re-hired successfully.`);
      fetchUsers();
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to re-hire.', 'error');
    }
  };

  const activeUsers = allUsers.filter(u => u.status !== 'removed');
  const removedUsers = allUsers.filter(u => u.status === 'removed');

  const leadershipUsers = activeUsers.filter(u => LEADERSHIP_ROLES.includes(u.role));
  const employeeUsers = activeUsers.filter(u => EMPLOYEE_ROLES.includes(u.role));

  const sectionStyle = {
    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
    border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`,
    borderRadius: 20,
    padding: '20px',
    marginBottom: 20,
  };

  const sectionHeader = (title, count, color = 'var(--accent)') => (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</h3>
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}15`, color }}>{count}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {msg.text && (
        <div className={`p-3 rounded-xl text-xs font-semibold border ${msg.type === 'error' ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 border-rose-200 dark:border-rose-800/40' : 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 border-emerald-200 dark:border-emerald-800/40'}`}>
          {msg.text}
        </div>
      )}

      {selectedProfileId ? (
        <div 
          className="space-y-6"
          style={{ 
            fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", sans-serif' 
          }}
        >
        {/* Full Page Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedProfileId(null)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-sm cursor-pointer"
            style={{ color: 'var(--text-secondary)', background: isDark ? '#1c1c1e' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Team List
          </button>
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Member Profile & Activity</h2>
            <p className="text-xs text-zinc-400">View performance stats and searchable audit trail logs</p>
          </div>
        </div>

        {profileLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3" style={{ background: isDark ? '#1c1c1e' : '#ffffff', borderRadius: 24, border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
            <RefreshCw className="animate-spin h-7 w-7" style={{ color: 'var(--accent)' }} />
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Loading profile data...</span>
          </div>
        ) : !profileDetails ? (
          <div className="text-center py-16 rounded-2xl border" style={{ background: isDark ? '#1c1c1e' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
            Failed to load profile details.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Profile Header card (Bright solid style) */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 p-6 rounded-2xl border shadow-sm animate-fade-in" style={{ background: isDark ? '#1c1c1e' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
              <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0" style={{ background: (ROLE_CONFIG[profileDetails.role] || ROLE_CONFIG.Employee).gradient || 'linear-gradient(135deg, #007AFF, #5856D6)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                {profileDetails.name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="text-center sm:text-left flex-1 min-w-0">
                <h2 className="text-lg font-bold flex items-center justify-center sm:justify-start gap-2.5 flex-wrap text-zinc-900 dark:text-zinc-50">
                  {profileDetails.name}
                  <span className="text-[9.5px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: `${(ROLE_CONFIG[profileDetails.role] || ROLE_CONFIG.Employee).bg}`, color: (ROLE_CONFIG[profileDetails.role] || ROLE_CONFIG.Employee).color, borderColor: (ROLE_CONFIG[profileDetails.role] || ROLE_CONFIG.Employee).border, borderStyle: 'solid', borderWidth: '1px' }}>
                    {(ROLE_CONFIG[profileDetails.role] || ROLE_CONFIG.Employee).label}
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">@{profileDetails.username}</p>

                {/* Contact Grid (Structured settings layout with fallbacks) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5">
                  {/* Email */}
                  <div className="flex items-center gap-2.5 p-3 rounded-xl border text-[11px] font-medium" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f5f5f7', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                    <Mail className="h-4 w-4 text-zinc-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide leading-none mb-0.5">Email Address</p>
                      <p className="truncate text-zinc-700 dark:text-zinc-300">{profileDetails.email || <span className="italic text-zinc-400/60 font-normal">no-email@company.com</span>}</p>
                    </div>
                  </div>
                  
                  {/* Phone */}
                  <div className="flex items-center gap-2.5 p-3 rounded-xl border text-[11px] font-medium" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f5f5f7', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                    <Phone className="h-4 w-4 text-zinc-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide leading-none mb-0.5">Phone Number</p>
                      <p className="truncate text-zinc-700 dark:text-zinc-300 font-mono">{profileDetails.phone || <span className="italic text-zinc-400/60 font-normal">no-phone</span>}</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-center gap-2.5 p-3 rounded-xl border text-[11px] font-medium" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : '#f5f5f7', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                    <MapPin className="h-4 w-4 text-zinc-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide leading-none mb-0.5">Registered Address</p>
                      <p className="truncate text-zinc-700 dark:text-zinc-300">{profileDetails.address || <span className="italic text-zinc-400/60 font-normal">no-address-registered</span>}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Toolbar */}
              <div className="flex flex-row sm:flex-col gap-2 shrink-0 w-full sm:w-auto pt-4 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800 sm:self-center">
                {!getIsProtected(profileDetails) ? (
                  <>
                    <button
                      onClick={() => {
                        setEditForm({
                          name: profileDetails.name,
                          username: profileDetails.username,
                          password: '',
                          email: profileDetails.email || '',
                          phone: profileDetails.phone || '',
                          address: profileDetails.address || '',
                          role: profileDetails.role
                        });
                        setEditTarget(profileDetails);
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-800 dark:text-zinc-200 border-zinc-200/70 dark:border-zinc-700 cursor-pointer transition-all shadow-sm"
                    >
                      <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                    </button>
                    
                    {(profileDetails.role !== 'Admin' || currentUser?.role === 'Developer') && (
                      <>
                        <button
                          onClick={() => setConfirmAction({ user: profileDetails, action: profileDetails.status === 'frozen' ? 'unfreeze' : 'freeze' })}
                          className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border cursor-pointer transition-all shadow-sm ${
                            profileDetails.status === 'frozen'
                              ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 border-emerald-200 dark:border-emerald-900/30'
                              : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 text-amber-600 dark:text-amber-450 border-amber-200 dark:border-amber-900/30'
                          }`}
                        >
                          <Shield className="h-3.5 w-3.5" /> {profileDetails.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                        </button>
                        
                        <button
                          onClick={() => setConfirmAction({ user: profileDetails, action: 'remove' })}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 dark:text-rose-450 border-rose-200 dark:border-rose-900/30 cursor-pointer transition-all shadow-sm"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-1.5 px-4 py-2 text-[10px] font-bold text-zinc-550 dark:text-zinc-400 bg-zinc-100/70 dark:bg-zinc-800/30 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50">
                    <Shield className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-450" /> Secure Account
                  </div>
                )}
              </div>
            </div>

            {/* Audit Logs and History section */}
            <div className="rounded-2xl p-6 border shadow-sm" style={{ background: isDark ? '#1c1c1e' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
              {!selectedAuditSession ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                    <ClipboardList className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    Worked Audits
                    <span className="ml-auto text-[10px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
                      {profileDetails.audit_history?.length || 0}
                    </span>
                  </h4>

                  {!profileDetails.audit_history || profileDetails.audit_history.length === 0 ? (
                    <div className="text-center py-16 border border-dashed rounded-2xl" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>This user has not worked on any audits yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in">
                      {profileDetails.audit_history.map(audit => (
                        <div
                          key={audit.id}
                          onClick={() => handleViewAuditLogs(audit)}
                          className="flex items-center justify-between p-5 rounded-2xl cursor-pointer hover:border-blue-500 hover:shadow-lg transition-all border group"
                          style={{ background: isDark ? '#121214' : '#f9f9fb', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}
                        >
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="text-xs font-black truncate group-hover:text-blue-500 transition-colors" style={{ color: 'var(--text-primary)' }}>{audit.name}</div>
                            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>🏥 {audit.hospital_name || 'Generic'} · 📅 {audit.audit_date}</p>
                          </div>
                          <div className="flex items-center gap-1.5 ml-2">
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg ${audit.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                              {audit.status}
                            </span>
                            <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5 animate-fade-in">
                  {/* Audit Header */}
                  <div className="flex items-center justify-between pb-3" style={{ borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
                    <button
                      onClick={() => setSelectedAuditSession(null)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer"
                      style={{ color: 'var(--accent)', background: isDark ? '#121214' : '#f9f9fb', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to Audits
                    </button>
                    <span className="text-xs font-black" style={{ color: 'var(--text-secondary)' }}>
                      Selected Audit: <strong className="text-blue-500 font-extrabold">{selectedAuditSession.name}</strong>
                    </span>
                  </div>

                  {/* Logs Loading or Content */}
                  {logsLoading ? (
                    <div className="flex justify-center py-16"><RefreshCw className="animate-spin h-6 w-6" style={{ color: 'var(--accent)' }} /></div>
                  ) : (
                    <div className="space-y-4">
                      {/* Search bar */}
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Search className="h-3.5 w-3.5 text-zinc-400" />
                        </span>
                        <input
                          type="text"
                          placeholder="Search logs by item name, batch, action..."
                          value={logSearchQuery}
                          onChange={e => setLogSearchQuery(e.target.value)}
                          className="w-full text-xs pl-9 pr-3.5 py-3 rounded-xl border focus:outline-none"
                          style={{ background: isDark ? '#121214' : '#f9f9fb', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      {/* Logs list table (Wide spreadsheet style) */}
                      {(() => {
                        const q = logSearchQuery.toLowerCase().trim();
                        const filtered = auditLogs.filter(log =>
                          (log.item_name || '').toLowerCase().includes(q) ||
                          (log.batch_no || '').toLowerCase().includes(q) ||
                          (log.action || '').toLowerCase().includes(q) ||
                          (log.remarks || '').toLowerCase().includes(q)
                        );

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-16 border rounded-2xl" style={{ background: isDark ? '#121214' : '#f9f9fb', borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }}>
                              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No matching logs found.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
                            <table className="w-full text-[11px] text-left border-collapse">
                              <thead>
                                <tr style={{ background: isDark ? '#1c1c1e' : '#f4f4f7', color: 'var(--text-tertiary)', borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}` }}>
                                  <th className="p-3.5 font-bold uppercase tracking-wider">Date & Time</th>
                                  <th className="p-3.5 font-bold uppercase tracking-wider">Item Name</th>
                                  <th className="p-3.5 font-bold uppercase tracking-wider">Batch No</th>
                                  <th className="p-3.5 font-bold uppercase tracking-wider">Action</th>
                                  <th className="p-3.5 font-bold uppercase tracking-wider">Change</th>
                                  <th className="p-3.5 font-bold uppercase tracking-wider">Remarks</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                                {filtered.map(log => {
                                  const dateStr = new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' ' + new Date(log.timestamp).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                                  return (
                                    <tr
                                      key={log.id}
                                      style={{ background: isDark ? '#1c1c1e' : '#ffffff' }}
                                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                                    >
                                      <td className="p-3.5 whitespace-nowrap text-zinc-400 font-mono">{dateStr}</td>
                                      <td className="p-3.5 font-bold" style={{ color: 'var(--text-primary)' }}>{log.item_name || 'Generic Item'}</td>
                                      <td className="p-3.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{log.batch_no || 'N/A'}</td>
                                      <td className="p-3.5">
                                        <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold" style={{ background: log.action === 'add' ? 'rgba(52,199,89,0.1)' : 'rgba(0,122,255,0.1)', color: log.action === 'add' ? '#34C759' : '#007AFF' }}>
                                          {log.action?.replace('_', ' ')}
                                        </span>
                                      </td>
                                      <td className="p-3.5 whitespace-nowrap font-semibold" style={{ color: 'var(--text-secondary)' }}>
                                        {log.old_value !== null && log.new_value !== null ? (
                                          <span>{log.old_value} → {log.new_value}</span>
                                        ) : (
                                          <span className="text-zinc-400">—</span>
                                        )}
                                      </td>
                                      <td className="p-3.5" style={{ color: 'var(--text-tertiary)' }}>{log.remarks || <span className="text-zinc-400/60">—</span>}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    ) : (
      <>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-black" style={{ color: 'var(--text-primary)' }}>Team Management</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {activeUsers.length} active members across all tiers
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={fetchUsers} className="p-2 rounded-xl transition-all" style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)', color: 'var(--text-tertiary)' }}>
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
              style={{ background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 10px rgba(0,122,255,0.3)' }}
            >
              <Plus className="h-3.5 w-3.5" /> Add Member
            </button>
          </div>
        </div>

      {/* Add User Form */}
      {showAddForm && (
        <div className="rounded-2xl p-5" style={{ background: isDark ? 'rgba(0,122,255,0.08)' : 'rgba(0,122,255,0.04)', border: '1px solid rgba(0,122,255,0.2)' }}>
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Plus className="h-4 w-4 text-blue-500" /> Add New Team Member
          </h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: 'Full Name', field: 'name', placeholder: 'John Doe', type: 'text', required: true },
              { label: 'Username', field: 'username', placeholder: 'john_doe', type: 'text', required: true },
              { label: 'Password', field: 'password', placeholder: '••••••••', type: 'password', required: true },
              { label: 'Email', field: 'email', placeholder: 'john@example.com', type: 'email' },
              { label: 'Phone', field: 'phone', placeholder: '+91 9XXXXXXXXX', type: 'text' },
              { label: 'Address', field: 'address', placeholder: 'City, State', type: 'text' },
            ].map(({ label, field, placeholder, type, required }) => (
              <div key={field}>
                <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{label}{required && ' *'}</label>
                <input
                  type={type}
                  placeholder={placeholder}
                  required={required}
                  value={newUserForm[field]}
                  onChange={e => setNewUserForm({ ...newUserForm, [field]: e.target.value })}
                  className="w-full text-xs px-3 py-2 glass-input focus:outline-none"
                />
              </div>
            ))}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Role *</label>
              <select
                value={newUserForm.role}
                onChange={e => setNewUserForm({ ...newUserForm, role: e.target.value })}
                className="w-full text-xs px-3 py-2 glass-input focus:outline-none"
                style={{ color: 'var(--text-primary)', background: 'var(--glass-bg)' }}
              >
                <option value="CoFounder">Co-Founder</option>
                <option value="Employee">Employee</option>
                {currentUser?.role === 'Developer' && <option value="Admin">Admin</option>}
              </select>
            </div>
            <div className="md:col-span-2 lg:col-span-3 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ color: 'var(--text-secondary)', background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)' }}>
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold" style={{ background: 'var(--accent)', color: '#fff' }}>
                Create Member
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="animate-spin h-6 w-6" style={{ color: 'var(--accent)' }} />
        </div>
      ) : (
        <>
          {/* Co-founders & Leadership */}
          <div style={sectionStyle}>
            {sectionHeader('Leadership Team', leadershipUsers.length, '#F59E0B')}
            <p className="text-[11px] mb-4" style={{ color: 'var(--text-tertiary)' }}>Admins, Developers & Co-Founders — Full system access</p>
            {leadershipUsers.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>No leadership members found.</p>
            ) : (
              <div className="flex flex-wrap gap-6 justify-start">
                {leadershipUsers.map(u => (
                  <UserCard
                    key={u.id}
                    user={u}
                    isDark={isDark}
                    currentUser={currentUser}
                    onEdit={(user) => { setEditTarget(user); setEditForm({ name: user.name, username: user.username, password: '', email: user.email, phone: user.phone, address: user.address, role: user.role }); }}
                    onFreeze={(user) => setConfirmAction({ user, action: user.status === 'frozen' ? 'unfreeze' : 'freeze' })}
                    onRemove={(user) => setConfirmAction({ user, action: 'remove' })}
                    onViewProfile={() => handleViewProfile(u)}
                  />
                ))}
              </div>
            )}
          </div>



          {/* Employees */}
          <div style={sectionStyle}>
            {sectionHeader('Employees', employeeUsers.length, '#007AFF')}
            <p className="text-[11px] mb-4" style={{ color: 'var(--text-tertiary)' }}>Employees — Restricted access: Audit Sheet & Add Data only</p>
            {employeeUsers.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--text-tertiary)' }}>No employees added yet.</p>
            ) : (
              <div className="flex flex-wrap gap-6 justify-start">
                {employeeUsers.map(u => (
                  <UserCard
                    key={u.id}
                    user={u}
                    isDark={isDark}
                    currentUser={currentUser}
                    onEdit={(user) => { setEditTarget(user); setEditForm({ name: user.name, username: user.username, password: '', email: user.email, phone: user.phone, address: user.address, role: user.role }); }}
                    onFreeze={(user) => setConfirmAction({ user, action: user.status === 'frozen' ? 'unfreeze' : 'freeze' })}
                    onRemove={(user) => setConfirmAction({ user, action: 'remove' })}
                    onViewProfile={() => handleViewProfile(u)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Previously Employed */}
          {removedUsers.length > 0 && (
            <div style={sectionStyle}>
              <button
                onClick={() => setShowPrevEmployed(!showPrevEmployed)}
                className="flex items-center justify-between w-full"
              >
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Previously Employed</h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}>{removedUsers.length}</span>
                </div>
                {showPrevEmployed ? <ChevronUp className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />}
              </button>
              {showPrevEmployed && (
                <div className="mt-4 space-y-2">
                  {removedUsers.map(u => (
                    <PreviouslyEmployedCard key={u.id} user={u} onRehire={handleRehire} isDark={isDark} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
      </>
    )}

      {/* Edit User Modal */}
      {editTarget && (
        <>
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 z-50 cursor-pointer" 
            style={{ 
              background: 'rgba(0,0,0,0.55)', 
              backdropFilter: 'blur(10px)',
              width: '100vw',
              height: '100vh',
              top: 0,
              left: 0
            }}
            onClick={() => setEditTarget(null)}
          />
          {/* Centered Modal Card */}
          <div 
            className="fixed z-50 rounded-2xl shadow-2xl transition-all" 
            style={{ 
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: '480px', 
              width: '92%', 
              maxHeight: '90vh',
              overflowY: 'auto',
              background: isDark ? '#1c1c1e' : '#ffffff', 
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.3)' 
            }}
          >
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="font-bold text-base text-zinc-900 dark:text-zinc-50">Edit Member</h3>
              <button 
                onClick={() => setEditTarget(null)} 
                className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" 
                style={{ color: 'var(--text-tertiary)' }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 130px)' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Full Name</label>
                  <input 
                    type="text" 
                    value={editForm.name} 
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" 
                  />
                </div>
                {/* Username */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Username</label>
                  <input 
                    type="text" 
                    value={editForm.username} 
                    onChange={e => setEditForm({ ...editForm, username: e.target.value })} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" 
                  />
                </div>
                {/* Email */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Email</label>
                  <input 
                    type="email" 
                    placeholder="name@company.com"
                    value={editForm.email || ''} 
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" 
                  />
                </div>
                {/* Phone */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Phone</label>
                  <input 
                    type="text" 
                    placeholder="+91 XXXXXXXXXX"
                    value={editForm.phone || ''} 
                    onChange={e => setEditForm({ ...editForm, phone: e.target.value })} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" 
                  />
                </div>
                {/* Role Selection */}
                <div className="relative">
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Role</label>
                  
                  {/* Select button */}
                  <button
                    type="button"
                    disabled={editTarget?.role === 'Developer'}
                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                    className={`w-full flex items-center justify-between text-xs px-3.5 py-2.5 rounded-xl border transition-all text-left focus:outline-none ${
                      editTarget?.role === 'Developer'
                        ? 'opacity-65 cursor-not-allowed bg-zinc-150/40 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800' 
                        : 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/30'
                    }`}
                    style={{
                      background: 'var(--glass-bg)',
                      borderColor: 'var(--glass-border-dim)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0" style={{ background: (ROLE_CONFIG[editForm.role] || ROLE_CONFIG.Employee).bg }}>
                        {React.createElement((ROLE_CONFIG[editForm.role] || ROLE_CONFIG.Employee).icon || Briefcase, { className: "h-3 w-3", style: { color: (ROLE_CONFIG[editForm.role] || ROLE_CONFIG.Employee).color } })}
                      </div>
                      <span className="font-bold">{(ROLE_CONFIG[editForm.role] || ROLE_CONFIG.Employee).label}</span>
                      {editTarget?.role === 'Developer' && (
                        <span className="text-[8px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">Fixed</span>
                      )}
                    </div>
                    {editTarget?.role !== 'Developer' && <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${roleDropdownOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--text-tertiary)' }} />}
                  </button>

                  {/* Backdrop for click outside */}
                  {roleDropdownOpen && (
                    <div className="fixed inset-0 z-40" onClick={() => setRoleDropdownOpen(false)} />
                  )}

                  {/* Dropdown Options List */}
                  {roleDropdownOpen && editTarget?.role !== 'Developer' && (
                    <div 
                      className="absolute left-0 top-full mt-1.5 w-full rounded-2xl border shadow-xl z-50 overflow-hidden text-xs py-0.5"
                      style={{
                        background: isDark ? 'rgba(28,28,30,0.98)' : '#ffffff',
                        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        backdropFilter: 'blur(16px)',
                      }}
                    >
                      {[
                        { key: 'Employee', label: 'Employee' },
                        { key: 'CoFounder', label: 'Co-Founder' },
                        { key: 'Admin', label: 'Admin' },
                      ].map(opt => {
                        const optConfig = ROLE_CONFIG[opt.key] || ROLE_CONFIG.Employee;
                        const OptIcon = optConfig.icon || Briefcase;
                        
                        // Rule: Employee cannot be direct Admin (must be promoted to CoFounder first)
                        const isEmployeeTryingAdmin = opt.key === 'Admin' && editTarget?.role === 'Employee';
                        // Rule: Only Developer can promote to Admin
                        const isNonDevTryingAdmin = opt.key === 'Admin' && currentUser?.role !== 'Developer';
                        const isDisabledOpt = isEmployeeTryingAdmin || isNonDevTryingAdmin;
                        
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            disabled={isDisabledOpt}
                            onClick={() => {
                              setEditForm({ ...editForm, role: opt.key });
                              setRoleDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 transition-all text-left border-none ${
                              isDisabledOpt 
                                ? 'opacity-40 cursor-not-allowed bg-zinc-100/10' 
                                : 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="h-5.5 w-5.5 rounded-lg flex items-center justify-center shrink-0" style={{ background: optConfig.bg }}>
                                <OptIcon className="h-3 w-3" style={{ color: optConfig.color }} />
                              </div>
                              <span className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                                {optConfig.label}
                              </span>
                              {editForm.role === opt.key && (
                                <span className="h-1.5 w-1.5 rounded-full bg-[#007aff] shrink-0" />
                              )}
                            </div>
                            
                            {isEmployeeTryingAdmin && (
                              <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                Promote First
                              </span>
                            )}
                            {isNonDevTryingAdmin && !isEmployeeTryingAdmin && (
                              <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 bg-violet-500/10 text-violet-500 border border-violet-500/20">
                                Developer Only
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Password */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>New Password (optional)</label>
                  <input 
                    type="password" 
                    placeholder="••••••••" 
                    value={editForm.password || ''} 
                    onChange={e => setEditForm({ ...editForm, password: e.target.value })} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" 
                  />
                </div>
                {/* Address (Full Span) */}
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-tertiary)' }}>Address</label>
                  <input 
                    type="text" 
                    placeholder="Address, City, State"
                    value={editForm.address || ''} 
                    onChange={e => setEditForm({ ...editForm, address: e.target.value })} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none" 
                  />
                </div>
              </div>
            </div>

            {/* Separated Action Footer Bar */}
            <div className="flex justify-end gap-3 px-5 py-4 bg-zinc-55 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 rounded-b-2xl">
              <button 
                onClick={() => setEditTarget(null)} 
                className="px-4.5 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-750 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleEdit} 
                className="px-5 py-2 rounded-xl text-xs font-bold shadow-sm text-white transition-all active:scale-[0.98] hover:opacity-95 cursor-pointer" 
                style={{ background: 'linear-gradient(180deg, #1a8fff, #0071e3)' }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </>
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (
        <>
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 z-50 cursor-pointer" 
            style={{ 
              background: 'rgba(0,0,0,0.55)', 
              backdropFilter: 'blur(10px)',
              width: '100vw',
              height: '100vh',
              top: 0,
              left: 0
            }}
            onClick={() => setConfirmAction(null)}
          />
          {/* Centered Modal Card */}
          <div 
            className="fixed z-50 rounded-2xl p-6 text-center" 
            style={{ 
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: '380px', 
              width: '90%', 
              background: isDark ? '#1c1c1e' : '#fff', 
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)', 
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)' 
            }}
          >
            <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: confirmAction.action === 'remove' ? 'rgba(255,59,48,0.1)' : 'rgba(255,149,0,0.1)', color: confirmAction.action === 'remove' ? '#FF3B30' : '#FF9500' }}>
              <AlertTriangle className="h-7 w-7" />
            </div>
            <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
              {confirmAction.action === 'remove' ? 'Remove Member' : confirmAction.action === 'freeze' ? 'Freeze Member' : 'Unfreeze Member'}
            </h3>
            <p className="text-sm mb-5" style={{ color: 'var(--text-tertiary)' }}>
              {confirmAction.action === 'remove'
                ? `Remove ${confirmAction.user.name} from the team? They'll be moved to Previously Employed.`
                : confirmAction.action === 'freeze'
                  ? `Freeze ${confirmAction.user.name}? They can still log in but will have read-only access.`
                  : `Unfreeze ${confirmAction.user.name}? They'll regain full access.`}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmAction(null)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)', color: 'var(--text-secondary)' }}>Cancel</button>
              <button
                onClick={() => confirmAction.action === 'remove' ? handleRemove(confirmAction.user) : handleFreeze(confirmAction.user)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer"
                style={{ background: confirmAction.action === 'remove' ? 'linear-gradient(180deg,#f87171,#dc2626)' : confirmAction.action === 'freeze' ? 'linear-gradient(180deg,#FFB347,#FF9500)' : 'linear-gradient(180deg,#4CD964,#34C759)', color: '#fff' }}
              >
                {confirmAction.action === 'remove' ? 'Remove' : confirmAction.action === 'freeze' ? 'Freeze' : 'Unfreeze'}
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
