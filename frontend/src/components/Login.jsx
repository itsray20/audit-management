import React, { useState } from 'react';
import axios from 'axios';
import { ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function Login({ onLogin }) {
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Please enter both username and password.'); return; }
    setLoading(true);
    try {
      const res = await axios.post('/api/login', { username, password });
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check your credentials.');
    } finally { setLoading(false); }
  };

  const users = [
    { name: 'Srikant',   username: 'srikant',   role: 'Admin', pw: 'srikant123' },
    { name: 'Sathya',    username: 'sathya',    role: 'User1', pw: 'user223' },
    { name: 'Santosh',   username: 'santosh',   role: 'User2', pw: 'user323' },
    { name: 'Naveen',    username: 'naveen',    role: 'User3', pw: 'user423' },
    { name: 'Shreeyash', username: 'shreeyash', role: 'User4', pw: 'user523' },
  ];

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5"
      style={{ background: 'var(--bg-base)' }}
    >
      <div className="w-full" style={{ maxWidth: '380px', margin: '0 auto' }}>

        {/* ── App Icon + Brand ──────────────────────────────────────── */}
        <div className="flex flex-col items-center mb-7">
          <div
            className="w-16 h-16 rounded-[20px] flex items-center justify-center mb-4"
            style={{
              background: 'linear-gradient(145deg, #1a8fff 0%, #5856D6 100%)',
              boxShadow: '0 2px 0 rgba(255,255,255,0.22) inset, 0 8px 24px rgba(0,113,227,0.36)',
            }}
          >
            <ShieldCheck className="h-8 w-8 text-white" strokeWidth={1.75} />
          </div>
          <h1
            className="font-black text-3xl tracking-tight"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}
          >
            Auditing
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
            Pharmacy Stock Management Console
          </p>
        </div>

        {/* ── Card ─────────────────────────────────────────────────── */}
        <div className="metric-card rounded-2xl overflow-hidden">

          {/* Sign In form */}
          <div className="px-5 pt-5 pb-4">
            <p
              className="text-[10px] font-black uppercase tracking-[0.12em] mb-4"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Sign In
            </p>

            {/* Error */}
            {error && (
              <div
                className="mb-3 px-3 py-2.5 rounded-xl flex items-center gap-2 text-xs"
                style={{ background: 'var(--danger-light)', border: '1px solid rgba(255,59,48,0.18)', color: 'var(--danger)' }}
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Username */}
              <div>
                <label
                  className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                  className="w-full px-3 py-2.5 glass-input focus:outline-none text-sm"
                />
              </div>

              {/* Password */}
              <div>
                <label
                  className="block text-[10px] font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="w-full px-3 py-2.5 pr-10 glass-input focus:outline-none text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-60"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Sign In button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-glass-primary flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl mt-1 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Connecting…
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'var(--card-border)' }} />

          {/* Quick Access */}
          <div className="px-5 py-4">
            <p
              className="text-[10px] font-black uppercase tracking-[0.12em] mb-3"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Quick Access
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {users.map(u => (
                <button
                  key={u.username}
                  onClick={() => { setUsername(u.username); setPassword(u.pw); }}
                  className="px-3 py-2 rounded-xl text-left transition-all"
                  style={{
                    background: 'var(--glass-bg-light)',
                    border: '1px solid var(--glass-border-dim)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-light)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--glass-bg-light)'}
                >
                  <div className="text-xs font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                    {u.name}
                  </div>
                  <div className="text-[10px] mt-0.5 font-semibold" style={{ color: 'var(--text-tertiary)' }}>
                    {u.role}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] mt-5" style={{ color: 'var(--text-tertiary)' }}>
          Official Pharmacy Auditing Tool · 2026
        </p>
      </div>
    </div>
  );
}
