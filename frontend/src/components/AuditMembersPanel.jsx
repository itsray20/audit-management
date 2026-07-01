import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Users, UserPlus, Snowflake, UserX, UserCheck, RefreshCw, X, Plus,
  Shield, Code2, Star, Briefcase, Lock, Mail, Phone, MapPin, AtSign,
  CheckCircle2, UserCircle2, ArrowLeft, Search, AlertTriangle
} from 'lucide-react';

const ROLE_CONFIG = {
  Admin:     { label: 'Admin',      color: '#FF6B35', icon: Shield },
  Developer: { label: 'Developer',  color: '#8B5CF6', icon: Code2 },
  CoFounder: { label: 'Co-Founder', color: '#F59E0B', icon: Star },
  Employee:  { label: 'Employee',   color: '#007AFF', icon: Briefcase },
};

/* ─────────────────────────────────────────────────────────────────────────
   Add Member Page — renders inline in the content area (nav stays visible)
   ───────────────────────────────────────────────────────────────────────── */
function AddMemberPage({ members, usersToAdd, onAdd, onClose, isDark, actionLoading }) {
  const [search, setSearch]           = useState('');
  const [confirmUser, setConfirmUser] = useState(null); // user pending confirmation
  const activeOrFrozen = members.filter(m => m.status !== 'removed');
  const filtered = usersToAdd.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    (u.role || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirmAdd = () => {
    if (!confirmUser) return;
    onAdd(confirmUser.id);
    setConfirmUser(null);
  };

  return (
    <div
      className="animate-fade-in"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div className="max-w-[700px] mx-auto">
      {/* ── Page Header ── */}
      <div className="glass rounded-3xl p-7 border shadow-sm mb-5" style={{
        background: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
      }}>
        <div className="flex items-center gap-3 mb-1 pb-5 border-b border-zinc-200/50 dark:border-zinc-800/80">
          <div
            className="h-9 w-9 rounded-xl flex items-center justify-center text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}
          >
            <UserPlus className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h2
              className="text-sm font-black tracking-tight"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              Add Team Member
            </h2>
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Select an eligible user to join this audit session
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            style={{
              color: 'var(--text-secondary)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'
            }}
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Members
          </button>
        </div>

        {/* ── Already Added Members (frozen / read-only) ── */}
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-3">
            <div
              className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(52,199,89,0.12)' }}
            >
              <CheckCircle2 className="h-3 w-3" style={{ color: '#34C759' }} />
            </div>
            <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              Already on This Audit
            </span>
            <span
              className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold"
              style={{ background: 'rgba(52,199,89,0.1)', color: '#34C759' }}
            >
              {activeOrFrozen.length} assigned
            </span>
          </div>

          {activeOrFrozen.length === 0 ? (
            <p className="text-[11px] py-3 text-center" style={{ color: 'var(--text-tertiary)' }}>
              No members assigned yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {activeOrFrozen.map(m => {
                const cfg = ROLE_CONFIG[m.user_role] || ROLE_CONFIG.Employee;
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.025)',
                      border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.05)',
                      opacity: 0.72
                    }}
                  >
                    <div
                      className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black shrink-0"
                      style={{ background: cfg.color }}
                    >
                      {m.user_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {m.user_name}
                      </div>
                      <div className="text-[9px] font-bold" style={{ color: cfg.color }}>
                        {cfg.label}
                      </div>
                    </div>
                    <Lock className="h-3 w-3 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Add New Member ── */}
      <div className="glass rounded-3xl p-7 border shadow-sm" style={{
        background: isDark ? 'rgba(255,255,255,0.02)' : '#ffffff',
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'
      }}>
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-zinc-200/50 dark:border-zinc-800/80">
          <div
            className="h-5 w-5 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,122,255,0.12)' }}
          >
            <UserPlus className="h-3 w-3 text-blue-500" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
            Add New Member
          </span>
          <span
            className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{
              background: usersToAdd.length > 0 ? 'rgba(0,122,255,0.1)' : 'rgba(0,0,0,0.05)',
              color: usersToAdd.length > 0 ? '#007AFF' : 'var(--text-tertiary)'
            }}
          >
            {usersToAdd.length} eligible
          </span>
        </div>

        {/* Search bar */}
        <div className="relative mb-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 z-10" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or role..."
            className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all"
            style={{
              background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.08)',
              color: 'var(--text-primary)'
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full flex items-center justify-center cursor-pointer transition-opacity hover:opacity-70"
              style={{ background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
            >
              <X className="h-2.5 w-2.5" style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-10">
            <div
              className="h-12 w-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
              style={{ background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}
            >
              <UserCircle2 className="h-6 w-6" style={{ color: 'var(--text-tertiary)' }} />
            </div>
            <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              {search ? `No results for "${search}"` : 'No eligible users available'}
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {search ? 'Try a different name or role.' : 'All eligible users are already assigned to this audit.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(u => {
              const cfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.Employee;
              return (
                <button
                  key={u.id}
                  onClick={() => setConfirmUser(u)}
                  disabled={actionLoading}
                  className="group w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-wait"
                  style={{
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)',
                    border: isDark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)'
                  }}
                >
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white text-sm font-black shrink-0 shadow-sm"
                    style={{ background: cfg.color }}
                  >
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                      {u.name}
                    </div>
                    <div className="text-[10px] font-semibold mt-0.5" style={{ color: cfg.color }}>
                      {cfg.label}
                    </div>
                  </div>
                  <div
                    className="h-7 w-7 rounded-full flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-md shrink-0"
                    style={{ background: 'linear-gradient(135deg, #007AFF, #5856D6)' }}
                  >
                    <Plus className="h-3.5 w-3.5 text-white" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Confirmation Modal ── */}
      {confirmUser && (() => {
        const cfg = ROLE_CONFIG[confirmUser.role] || ROLE_CONFIG.Employee;
        return (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center animate-fade-in"
            style={{
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              padding: '16px'
            }}
            onClick={() => setConfirmUser(null)}
          >
            <div
              className="animate-dropdown-in rounded-3xl border shadow-2xl overflow-hidden"
              style={{
                width: '100%',
                maxWidth: '380px',
                background: isDark ? '#1c1c1e' : '#ffffff',
                borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Orange top stripe */}
              <div style={{ height: 4, background: 'linear-gradient(90deg, #FF9500, #FF6B35)' }} />

              <div style={{ padding: '28px 24px 24px' }}>
                {/* Warning icon */}
                <div style={{
                  height: 48, width: 48, borderRadius: 14,
                  background: 'rgba(255,149,0,0.12)',
                  border: '1px solid rgba(255,149,0,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px'
                }}>
                  <AlertTriangle style={{ height: 22, width: 22, color: '#FF9500' }} />
                </div>

                <h3 style={{
                  fontSize: 15, fontWeight: 800, textAlign: 'center',
                  letterSpacing: '-0.02em', marginBottom: 6,
                  color: isDark ? '#f5f5f7' : '#1d1d1f'
                }}>
                  Confirm Member Addition
                </h3>
                <p style={{
                  fontSize: 11, textAlign: 'center', lineHeight: 1.6,
                  color: isDark ? '#aeaeb2' : '#6e6e73', marginBottom: 20
                }}>
                  You are about to add this person to the active audit session. This can be undone later.
                </p>

                {/* Member preview */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px', borderRadius: 14, marginBottom: 20,
                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)'
                }}>
                  <div style={{
                    height: 38, width: 38, borderRadius: 10, flexShrink: 0,
                    background: cfg.color, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 14, fontWeight: 900
                  }}>
                    {confirmUser.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#f5f5f7' : '#1d1d1f' }}>
                      {confirmUser.name}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2, color: cfg.color }}>
                      {cfg.label}
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => setConfirmUser(null)}
                    style={{
                      flex: 1, padding: '11px 16px', fontSize: 12, fontWeight: 700,
                      borderRadius: 12, cursor: 'pointer',
                      background: 'transparent',
                      border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)',
                      color: isDark ? '#aeaeb2' : '#6e6e73'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmAdd}
                    disabled={actionLoading}
                    style={{
                      flex: 1, padding: '11px 16px', fontSize: 12, fontWeight: 700,
                      borderRadius: 12, cursor: actionLoading ? 'not-allowed' : 'pointer',
                      color: '#fff', border: 'none',
                      background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                      boxShadow: '0 4px 14px rgba(0,122,255,0.35)',
                      opacity: actionLoading ? 0.6 : 1
                    }}
                  >
                    {actionLoading ? 'Adding...' : 'Yes, Add Member'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      </div>{/* end max-w-[700px] */}
    </div>
  );
}


/* ─────────────────────────────────────────────────────────────────────────
   Main Panel
   ───────────────────────────────────────────────────────────────────────── */
export default function AuditMembersPanel({ sessionId, activeSession, currentUser, isDark, onMembersChanged }) {
  const [members, setMembers]                 = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loading, setLoading]                 = useState(true);
  const [showAddPage, setShowAddPage]         = useState(false);
  const [infoModalMember, setInfoModalMember] = useState(null);
  const [actionLoading, setActionLoading]     = useState(false);
  const [msg, setMsg]                         = useState({ text: '', type: '' });

  const isPrivileged = currentUser?.role === 'Admin' || currentUser?.role === 'Developer';
  const isLocked     = activeSession?.status === 'Completed';

  const fetchMembers = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await axios.get(`/api/audits/${sessionId}/members`);
      setMembers(res.data);
      if (infoModalMember) {
        const fresh = res.data.find(m => m.user_id === infoModalMember.user_id);
        if (fresh) setInfoModalMember(fresh);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const fetchAssignable = async () => {
    try {
      const res = await axios.get('/api/users/assignable');
      setAssignableUsers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchMembers(true);
      if (isPrivileged) fetchAssignable();
      const pollTimer = setInterval(() => fetchMembers(false), 10000);
      return () => clearInterval(pollTimer);
    }
  }, [sessionId]);

  const showMsg = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  const handleAddMember = async (userId) => {
    if (isLocked) return;
    setActionLoading(true);
    try {
      await axios.post(`/api/audits/${sessionId}/members`, { user_id: userId });
      showMsg('Member added successfully.');
      await fetchMembers(true);
      onMembersChanged && onMembersChanged();
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to add member.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMemberAction = async (userId, action) => {
    if (isLocked) return;
    setActionLoading(true);
    try {
      await axios.put(`/api/audits/${sessionId}/members/${userId}`, { status: action });
      const labels = { frozen: 'frozen', active: 'unfrozen', removed: 'removed' };
      showMsg(`Member ${labels[action]} successfully.`);
      await fetchMembers(false);
      onMembersChanged && onMembersChanged();
      if (action === 'removed') {
        setInfoModalMember(null);
      } else {
        const fresh = members.find(m => m.user_id === userId);
        if (fresh) setInfoModalMember({ ...fresh, status: action });
      }
    } catch (err) {
      showMsg(err.response?.data?.error || 'Failed to update member.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const activeOrFrozen = members.filter(m => m.status !== 'removed' && !m.is_virtual);
  const removed        = members.filter(m => m.status === 'removed' && !m.is_virtual);

  // Exclude: already in audit, current user, Developers
  const existingUserIds = members.map(m => m.user_id);
  const usersToAdd = assignableUsers.filter(u =>
    !existingUserIds.includes(u.id) &&
    u.role !== 'Developer'
  );

  const statusBadge = (member) => {
    if (member.status === 'frozen') {
      return (
        <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,149,0,0.1)', color: '#FF9500' }}>
          <Snowflake className="h-2.5 w-2.5" /> Frozen
        </span>
      );
    }
    if (member.status === 'removed') {
      return (
        <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}>
          Removed
        </span>
      );
    }
    if (member.is_online) {
      return (
        <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(52,199,89,0.12)', color: '#34C759' }}>
          <span className="h-1 w-1 rounded-full bg-[#34C759] animate-pulse" /> Active
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', color: 'var(--text-tertiary)' }}>
        Not Active
      </span>
    );
  };

  /* ── If Add Page is active, render it inline (full content area, nav stays) ── */
  if (showAddPage) {
    return (
      <AddMemberPage
        members={members}
        usersToAdd={usersToAdd}
        onAdd={handleAddMember}
        onClose={() => setShowAddPage(false)}
        isDark={isDark}
        actionLoading={actionLoading}
      />
    );
  }

  /* ── Default: Members Panel ── */
  return (
    <>
      <div className="rounded-2xl p-5 border shadow-sm transition-all duration-300" style={{ 
        background: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff', 
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }}>

        {/* Locked banner */}
        {isLocked && (
          <div className="mb-4 flex items-center gap-2 p-2.5 rounded-xl text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20">
            <Lock className="h-4 w-4" />
            <span>Audit session is completed. Member list is locked and cannot be modified.</span>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
            Assigned Members
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              {activeOrFrozen.length} team members
            </span>
          </h4>

          {isPrivileged && !isLocked && (() => {
            const isCurrentMember = members.some(m => m.user_id === currentUser?.id && m.status !== 'removed');
            return (
              <div className="flex items-center gap-2">
                {!isCurrentMember && (
                  <button
                    onClick={() => handleAddMember(currentUser.id)}
                    disabled={actionLoading}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 hover:opacity-90 cursor-pointer text-white"
                    style={{ background: 'linear-gradient(135deg, #30d158, #15b03d)', border: 'none', boxShadow: '0 2px 8px rgba(48,209,88,0.3)', height: '28px', boxSizing: 'border-box' }}
                  >
                    <UserCheck className="h-3.5 w-3.5 text-white" /> Join Audit
                  </button>
                )}
                <button
                  onClick={() => setShowAddPage(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all active:scale-95 hover:opacity-90 cursor-pointer"
                  style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid rgba(0,122,255,0.2)', height: '28px', boxSizing: 'border-box' }}
                >
                  <UserPlus className="h-3 w-3" /> Add Member
                </button>
              </div>
            );
          })()}
        </div>

        {msg.text && (
          <div className={`mb-3 p-2.5 rounded-xl text-xs font-medium transition-all ${msg.type === 'error' ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
            {msg.text}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <RefreshCw className="animate-spin h-5 w-5" style={{ color: 'var(--accent)' }} />
          </div>
        ) : activeOrFrozen.length === 0 ? (
          <p className="text-[11px] text-center py-4" style={{ color: 'var(--text-tertiary)' }}>No active members assigned yet.</p>
        ) : (
          <div className="space-y-1">
            {activeOrFrozen.map(member => {
              const cfg = ROLE_CONFIG[member.user_role] || ROLE_CONFIG.Employee;
              const initial = member.user_name?.charAt(0)?.toUpperCase() || '?';
              return (
                <div
                  key={member.id}
                  className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-all active:scale-[0.99]"
                  onClick={() => setInfoModalMember(member)}
                >
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm" style={{ background: cfg.color }}>
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold tracking-tight group-hover:text-blue-500 transition-colors" style={{ color: 'var(--text-primary)' }}>{member.user_name}</span>
                      {statusBadge(member)}
                    </div>
                    <div className="text-[9px] mt-0.5 font-bold" style={{ color: cfg.color }}>{cfg.label}</div>
                  </div>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 hover:text-blue-500 font-semibold transition-colors">Details &rarr;</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Removed Members */}
        {removed.length > 0 && (
          <div className="mt-6 pt-5 border-t border-zinc-200/50 dark:border-zinc-800/80">
            <h5 className="text-[11px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider mb-3">
              Removed Members ({removed.length})
            </h5>
            <div className="space-y-2">
              {removed.map(member => {
                const cfg = ROLE_CONFIG[member.user_role] || ROLE_CONFIG.Employee;
                const initial = member.user_name?.charAt(0)?.toUpperCase() || '?';
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition-all active:scale-[0.99]"
                    onClick={() => setInfoModalMember(member)}
                  >
                    <div className="h-8 w-8 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0 opacity-55 shadow-sm" style={{ background: cfg.color }}>
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 line-through">{member.user_name}</span>
                      <div className="text-[9px] font-bold opacity-60" style={{ color: cfg.color }}>{cfg.label}</div>
                    </div>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold">Details &rarr;</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Member Detail Modal ── */}
      {infoModalMember && (() => {
        const cfg = ROLE_CONFIG[infoModalMember.user_role] || ROLE_CONFIG.Employee;
        const initial = infoModalMember.user_name?.charAt(0)?.toUpperCase() || '?';
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in cursor-default"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            onClick={() => setInfoModalMember(null)}
          >
            <div
              className="w-[360px] rounded-3xl border shadow-2xl relative overflow-hidden animate-dropdown-in"
              style={{ background: isDark ? '#1c1c1e' : '#ffffff', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="h-12 w-full opacity-15" style={{ background: cfg.color }} />
              <button
                onClick={() => setInfoModalMember(null)}
                className="absolute top-3 right-3 h-7 w-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer z-10"
                style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="p-6 pt-0 text-center relative">
                <div className="h-16 w-16 rounded-2xl flex items-center justify-center text-white text-xl font-black mx-auto -mt-8 shadow-md border-4" style={{ background: cfg.color, borderColor: isDark ? '#1c1c1e' : '#ffffff' }}>
                  {initial}
                </div>
                <h3 className="text-base font-black tracking-tight mt-3" style={{ color: 'var(--text-primary)' }}>{infoModalMember.user_name}</h3>
                <div className="flex items-center justify-center gap-1.5 mt-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: `${cfg.color}15`, color: cfg.color }}>{cfg.label}</span>
                  {statusBadge(infoModalMember)}
                </div>
                <div className="mt-6 space-y-3.5 text-left border-y border-zinc-200/50 dark:border-zinc-800/80 py-4">
                  {[
                    { Icon: AtSign, label: 'Username',     val: `@${infoModalMember.username || 'auditor'}` },
                    { Icon: Mail,   label: 'Email Address', val: infoModalMember.email   || 'No email specified' },
                    { Icon: Phone,  label: 'Phone Number',  val: infoModalMember.phone   || 'No phone specified' },
                    { Icon: MapPin, label: 'Address',       val: infoModalMember.address || 'No address specified' },
                  ].map(({ Icon, label, val }) => (
                    <div key={label} className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                      <div>
                        <div className="text-[9px] uppercase font-bold text-zinc-400">{label}</div>
                        <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate max-w-[260px]">{val}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  {isPrivileged && !isLocked ? (
                    <>
                      {infoModalMember.status === 'active' && (() => {
                        const activeAdmins   = members.filter(m => m.user_role === 'Admin' && m.status === 'active');
                        const assignedAdmins = members.filter(m => m.user_role === 'Admin' && m.status !== 'removed');
                        const isOnlyActive   = infoModalMember.user_role === 'Admin' && activeAdmins.length <= 1;
                        const isOnlyAssigned = infoModalMember.user_role === 'Admin' && assignedAdmins.length <= 1;
                        return (
                          <div className="w-full space-y-2">
                            <div className="flex gap-2 w-full">
                              <button onClick={() => handleMemberAction(infoModalMember.user_id, 'frozen')} disabled={actionLoading || isOnlyActive} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                                <Snowflake className="h-3.5 w-3.5" /> Freeze Role
                              </button>
                              <button onClick={() => handleMemberAction(infoModalMember.user_id, 'removed')} disabled={actionLoading || isOnlyAssigned} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                                <UserX className="h-3.5 w-3.5" /> Remove Member
                              </button>
                            </div>
                            {isOnlyActive && <p className="text-[9px] font-bold text-rose-500 dark:text-rose-400 text-center leading-normal">⚠️ Only active Admin — add another before freezing.</p>}
                          </div>
                        );
                      })()}
                      {infoModalMember.status === 'frozen' && (() => {
                        const assignedAdmins = members.filter(m => m.user_role === 'Admin' && m.status !== 'removed');
                        const isOnlyAssigned = infoModalMember.user_role === 'Admin' && assignedAdmins.length <= 1;
                        return (
                          <div className="w-full space-y-2">
                            <div className="flex gap-2 w-full">
                              <button onClick={() => handleMemberAction(infoModalMember.user_id, 'active')} disabled={actionLoading} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer">
                                <UserCheck className="h-3.5 w-3.5" /> Unfreeze Role
                              </button>
                              <button onClick={() => handleMemberAction(infoModalMember.user_id, 'removed')} disabled={actionLoading || isOnlyAssigned} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                                <UserX className="h-3.5 w-3.5" /> Remove Member
                              </button>
                            </div>
                            {isOnlyAssigned && <p className="text-[9px] font-bold text-rose-500 dark:text-rose-400 text-center leading-normal">⚠️ Only Admin assigned — cannot remove.</p>}
                          </div>
                        );
                      })()}
                      {infoModalMember.status === 'removed' && (
                        <button onClick={() => handleMemberAction(infoModalMember.user_id, 'active')} disabled={actionLoading} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer">
                          <Plus className="h-3.5 w-3.5" /> Rejoin Member
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                      {isLocked ? '🔒 Changes locked (audit completed)' : 'ℹ️ Only Admins/Developers can manage members'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
