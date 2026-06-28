import React, { useState, useEffect, useRef } from 'react';
import {
  Search, RotateCcw, AlertCircle, CheckCircle,
  Loader2, Keyboard, Sparkles, X
} from 'lucide-react';
import axios from 'axios';

export default function QuickAddPage({ sessionId, currentUser, auditIsLocked, onUpdate }) {
  const [allItems, setAllItems]           = useState([]);
  const [isLoading, setIsLoading]         = useState(false);
  const [searchQuery, setSearchQuery]     = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedItem, setSelectedItem]   = useState(null);
  const [qty, setQty]                     = useState('');
  const [remarks, setRemarks]             = useState('');
  const [recentLogs, setRecentLogs]       = useState([]);
  const [error, setError]                 = useState('');

  const searchInputRef = useRef(null);
  const qtyInputRef    = useRef(null);

  useEffect(() => { if (sessionId) loadAllItems(); }, [sessionId]);

  const loadAllItems = async () => {
    setIsLoading(true); setError('');
    try {
      const res = await axios.get(`/api/audits/${sessionId}/items?limit=10000`);
      setAllItems(res.data.items || []);
    } catch (err) {
      console.error('Failed to load master items:', err);
      setError('Failed to load stock list.');
    } finally { setIsLoading(false); }
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (!val.trim()) { setFilteredItems([]); return; }
    const query = val.toLowerCase();
    setFilteredItems(
      allItems.filter(item =>
        (item.item_name && item.item_name.toLowerCase().includes(query)) ||
        (item.batch_no  && item.batch_no.toLowerCase().includes(query))
      ).slice(0, 10)
    );
    setSelectedIndex(0);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(p => Math.min(p + 1, filteredItems.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(p => Math.max(p - 1, 0)); }
    else if (e.key === 'Enter')   { e.preventDefault(); if (filteredItems[selectedIndex]) selectItem(filteredItems[selectedIndex]); }
  };

  const selectItem = (item) => {
    setSelectedItem(item);
    const existing = (item.auditor_counts || []).find(c => c.auditor_name === currentUser.role);
    setQty(existing ? String(existing.physical_count ?? '') : '');
    setRemarks(existing ? existing.remarks || '' : '');
    setTimeout(() => { qtyInputRef.current?.focus(); qtyInputRef.current?.select(); }, 50);
  };

  const handleQtyKeyDown = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); saveCount(); }
    else if (e.key === 'Escape') { e.preventDefault(); setSelectedItem(null); setTimeout(() => searchInputRef.current?.focus(), 50); }
  };

  const saveCount = async () => {
    if (!selectedItem) return;
    if (auditIsLocked) { setError('Audit session is completed and locked.'); return; }

    const qtyVal = qty === '' ? null : parseInt(qty);
    if (qty !== '' && (isNaN(qtyVal) || qtyVal < 0)) { setError('Count must be a non-negative number.'); return; }

    const itemToSave = selectedItem;
    const tempLogId  = Date.now();

    setRecentLogs(prev => [
      { id: tempLogId, itemName: itemToSave.item_name, batchNo: itemToSave.batch_no, qty: qtyVal, status: 'saving' },
      ...prev
    ].slice(0, 10));

    setSelectedItem(null); setSearchQuery(''); setFilteredItems([]); setError('');
    setTimeout(() => searchInputRef.current?.focus(), 50);

    try {
      await axios.put(`/api/items/${itemToSave.id}/count`, {
        auditor_name: currentUser.role, physical_count: qtyVal, expiry_check: false, remarks
      });
      setRecentLogs(prev => prev.map(l => l.id === tempLogId ? { ...l, status: 'saved' } : l));
      setAllItems(prev => prev.map(item => {
        if (item.id !== itemToSave.id) return item;
        const counts = [...(item.auditor_counts || [])];
        const idx = counts.findIndex(c => c.auditor_name === currentUser.role);
        if (idx !== -1) counts[idx] = { ...counts[idx], physical_count: qtyVal };
        else counts.push({ auditor_name: currentUser.role, physical_count: qtyVal });
        return { ...item, auditor_counts: counts };
      }));
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error(err);
      setRecentLogs(prev =>
        prev.map(l => l.id === tempLogId ? { ...l, status: 'failed', error: err.response?.data?.error || 'Save failed' } : l)
      );
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col lg:flex-row gap-5 text-xs select-none">

      {/* ── Left Panel ────────────────────────────────────────────────── */}
      <div className="flex-1 panel-card p-4 flex flex-col justify-between">
        <div>

          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--glass-border-dim)' }}>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Superfast Audit Console
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                Ultra-fast physical stock count entry
              </p>
            </div>
            <button
              onClick={loadAllItems}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-all"
              style={{ color: 'var(--text-tertiary)', background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)' }}
            >
              {isLoading
                ? <Loader2 className="h-3 w-3 animate-spin" style={{ color: 'var(--accent)' }} />
                : <RotateCcw className="h-3 w-3" />}
              Refresh
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400 px-3 py-2.5 rounded-xl flex items-center gap-2 text-[11px]">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError('')}><X className="h-3 w-3" /></button>
            </div>
          )}

          {/* ── STEP 1: Search ────────────────────────────────────── */}
          {!selectedItem ? (
            <div className="mt-4 space-y-3">
              <label className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-tertiary)' }}>
                Search Product
              </label>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck="false"
                  placeholder="Product name or batch number…"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  autoFocus
                  className="w-full pl-9 pr-4 glass-input focus:outline-none"
                  style={{ fontSize: '14px', padding: '9px 9px 9px 34px' }}
                />
              </div>

              {/* Autocomplete Results */}
              {filteredItems.length > 0 && (
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--glass-border-dim)', background: 'var(--glass-bg-heavy)' }}>
                  {filteredItems.map((item, idx) => {
                    const isHighlighted = idx === selectedIndex;
                    const existing = (item.auditor_counts || []).find(c => c.auditor_name === currentUser.role);
                    const isCounted = existing && existing.physical_count !== null;
                    return (
                      <div
                        key={item.id}
                        onClick={() => selectItem(item)}
                        className="flex justify-between items-center cursor-pointer transition-colors border-b last:border-b-0"
                        style={{
                          borderColor: 'var(--glass-border-dim)',
                          background: isHighlighted ? 'var(--accent-light)' : 'transparent',
                          padding: '10px 14px',
                        }}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Counted indicator dot */}
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isCounted ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                          <div className="min-w-0">
                            <div
                              className="text-[12px] font-semibold truncate"
                              style={{ color: isHighlighted ? 'var(--accent)' : 'var(--text-primary)' }}
                            >
                              {item.item_name}
                            </div>
                            <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>
                              {item.batch_no} · {item.expiry_date || 'No Expiry'}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <span
                            className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                            style={{ background: 'var(--glass-bg-light)', color: 'var(--text-tertiary)' }}
                          >
                            {item.system_qty}
                          </span>
                          {isCounted && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-emerald-600 dark:text-emerald-400"
                              style={{ background: 'rgba(52,199,89,0.10)' }}>
                              ✓ {existing.physical_count}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          ) : (
            /* ── STEP 2: Count Entry ──────────────────────────── */
            <div className="mt-4 space-y-4">

              {/* Product Info Card — Apple grouped style */}
              <div
                className="rounded-2xl overflow-hidden relative"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,122,255,0.06) 0%, rgba(88,86,214,0.04) 100%)',
                  border: '1px solid rgba(0,122,255,0.15)',
                }}
              >
                {/* Dismiss button */}
                <button
                  type="button"
                  onClick={() => { setSelectedItem(null); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                  className="absolute right-3 top-3 p-1 rounded-lg transition-colors"
                  style={{ color: 'var(--text-tertiary)', background: 'var(--glass-bg-light)' }}
                  title="Change product"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <div className="px-4 pt-3 pb-3.5">
                  {/* Section label */}
                  <div className="text-[9px] font-black uppercase tracking-[0.12em] mb-1.5" style={{ color: 'var(--accent)' }}>
                    Selected Product
                  </div>
                  {/* Product name */}
                  <div className="text-sm font-bold pr-8 leading-snug" style={{ color: 'var(--text-primary)' }}>
                    {selectedItem.item_name}
                  </div>
                  {/* Meta chips row */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { label: 'Batch', value: selectedItem.batch_no || '—' },
                      { label: 'Expiry', value: selectedItem.expiry_date || 'N/A' },
                      { label: 'Sys Qty', value: selectedItem.system_qty },
                    ].map(({ label, value }) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)', color: 'var(--text-secondary)' }}
                      >
                        <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
                        <strong className="font-mono">{value}</strong>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quantity section */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-wider block" style={{ color: 'var(--text-tertiary)' }}>
                  Physical Count
                </label>
                <input
                  ref={qtyInputRef}
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min="0"
                  placeholder="0"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                  onKeyDown={handleQtyKeyDown}
                  onFocus={(e) => e.target.select()}
                  className="w-full glass-input focus:outline-none font-mono font-bold text-center"
                  style={{ fontSize: '18px', padding: '7px 12px', letterSpacing: '-0.01em' }}
                />
              </div>

              {/* Action Buttons — Apple style */}
              <div className="flex gap-2 pt-1">
                {/* Primary: Save — Apple blue gradient pill */}
                <button
                  type="button"
                  onClick={saveCount}
                  disabled={auditIsLocked}
                  className="flex-1 flex justify-center items-center gap-1.5 text-white font-bold text-[13px] rounded-xl transition-all disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(180deg, #1a8fff 0%, #0071e3 100%)',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.25) inset, 0 4px 12px rgba(0,113,227,0.35)',
                    padding: '8px 20px',
                  }}
                >
                  Save Count
                </button>

                {/* Secondary: Cancel — ghost text button */}
                <button
                  type="button"
                  onClick={() => { setSelectedItem(null); setTimeout(() => searchInputRef.current?.focus(), 50); }}
                  className="font-semibold text-[12px] rounded-xl transition-all px-4"
                  style={{
                    color: 'var(--accent)',
                    background: 'var(--accent-light)',
                    border: '1px solid rgba(0,122,255,0.15)',
                    padding: '8px 16px',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Keyboard hints — desktop only */}
        <div
          className="mt-4 pt-3 border-t hidden sm:flex justify-between items-center"
          style={{ borderColor: 'var(--glass-border-dim)' }}
        >
          <div className="flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
            <Keyboard className="h-3 w-3" />
            <span className="font-semibold text-[10px]">Shortcuts</span>
          </div>
          <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
            {[['↓↑', 'Navigate'], ['Enter', 'Select / Save'], ['Esc', 'Clear']].map(([k, label]) => (
              <span key={k}>
                <kbd className="px-1.5 py-0.5 rounded-md border font-mono"
                  style={{ background: 'var(--glass-bg-light)', borderColor: 'var(--glass-border-dim)', color: 'var(--text-secondary)', fontSize: '10px' }}>
                  {k}
                </kbd>
                {' '}{label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel: Activity Log ─────────────────────────────── */}
      <div className="w-full lg:w-80 panel-card p-4 flex flex-col">
        <h3
          className="text-[11px] font-black uppercase tracking-wider border-b pb-2.5 mb-3"
          style={{ color: 'var(--text-tertiary)', borderColor: 'var(--glass-border-dim)' }}
        >
          Session Activity
        </h3>

        {recentLogs.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8" style={{ color: 'var(--text-tertiary)' }}>
            <div className="w-10 h-10 rounded-2xl border-2 border-dashed flex items-center justify-center mb-2.5" style={{ borderColor: 'var(--glass-border-dim)' }}>
              <CheckCircle className="h-4 w-4 opacity-30" />
            </div>
            <div className="text-[11px] font-semibold">No entries yet</div>
            <div className="text-[10px] mt-0.5 opacity-60">Saved counts appear here</div>
          </div>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto max-h-[460px]">
            {recentLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all"
                style={{ borderColor: 'var(--glass-border-dim)', background: 'var(--glass-bg-light)' }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{log.itemName}</div>
                  <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: 'var(--text-tertiary)' }}>{log.batchNo}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="text-[11px] font-black font-mono px-2 py-0.5 rounded-lg"
                    style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}
                  >
                    {log.qty === null ? '—' : log.qty}
                  </span>
                  {log.status === 'saving' && <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: 'var(--accent)' }} />}
                  {log.status === 'saved'  && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />}
                  {log.status === 'failed' && <AlertCircle className="h-3.5 w-3.5 text-rose-500" title={log.error} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
