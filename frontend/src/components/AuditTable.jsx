import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  Search, X, Edit3, Lock, CheckCircle
} from 'lucide-react';
import GlassSelect from './GlassSelect';

const formatCurrency = (val) => {
  const num = Number(val || 0);
  if (num < 0) {
    return '-₹' + Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const getCategoryPill = (cat) => {
  switch (cat) {
    case 'Excess':
      return 'bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40';
    case 'Shortage':
      return 'bg-rose-50/50 text-rose-700 dark:bg-rose-950/10 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40';
    case 'Extra Found':
      return 'bg-amber-50/50 text-amber-700 dark:bg-amber-950/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40';
    case 'Expired Stock':
      return 'bg-purple-50/50 text-purple-700 dark:bg-purple-950/10 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/40';
    case 'Perfect Match':
      return 'bg-blue-50/50 text-blue-700 dark:bg-blue-950/10 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40';
    default:
      return 'bg-zinc-100/50 text-zinc-600 dark:bg-zinc-800/10 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-800/40';
  }
};

const getExpiryLabel = (dateStr, sessionDateStr) => {
  if (!dateStr) return null;
  const itemDate = new Date(dateStr);
  itemDate.setHours(0,0,0,0);
  const today = sessionDateStr ? new Date(sessionDateStr) : new Date();
  today.setHours(0,0,0,0);
  const ninetyDays = new Date(today);
  ninetyDays.setDate(today.getDate() + 90);

  if (itemDate < today) return { label: 'EXPIRED', cls: 'text-rose-600 dark:text-rose-450 font-bold text-[9px]' };
  if (itemDate <= ninetyDays) return { label: 'NEAR EXPIRY', cls: 'text-amber-600 dark:text-amber-450 font-bold text-[9px]' };
  return { label: 'GOOD STOCK', cls: 'text-emerald-600 dark:text-emerald-450 font-semibold text-[9px]' };
};

const getExpiryStatusPill = (label) => {
  switch (label) {
    case 'EXPIRED':
      return 'bg-rose-50/50 text-rose-700 dark:bg-rose-950/10 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40';
    case 'NEAR EXPIRY':
      return 'bg-amber-50/50 text-amber-700 dark:bg-amber-950/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40';
    case 'GOOD STOCK':
      return 'bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40';
    default:
      return 'bg-zinc-100/50 text-zinc-600 dark:bg-zinc-800/10 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-800/40';
  }
};

// ─────────────────────────────────────────────────────────────────
// Inline Count Cell with spreadsheet capability
// ─────────────────────────────────────────────────────────────────
function InlineCountCell({ item, auditorName, currentUser, auditIsLocked, onSaved, rowIdx, colIdx, bulkEditMode }) {
  const existingCount = item.auditor_counts?.find(c => c.auditor_name === auditorName);
  const [localVal, setLocalVal] = useState(existingCount?.physical_count ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = currentUser?.role === 'Admin';
  const isEditableColumn = !auditIsLocked && auditorName === currentUser?.role;
  
  // Always render numeric input box only in Admin Bulk mode (keep plain for standard users)
  const alwaysRenderInput = isEditableColumn && isAdmin && bulkEditMode;

  useEffect(() => {
    const handleTriggerEdit = (e) => {
      if (e.detail.rowIdx === rowIdx && e.detail.colIdx === colIdx) {
        setEditing(true);
      }
    };
    window.addEventListener('trigger-inline-edit', handleTriggerEdit);
    return () => window.removeEventListener('trigger-inline-edit', handleTriggerEdit);
  }, [rowIdx, colIdx]);

  const triggerNextEdit = (targetRowIdx, targetColIdx) => {
    const event = new CustomEvent('trigger-inline-edit', {
      detail: { rowIdx: targetRowIdx, colIdx: targetColIdx }
    });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    setLocalVal(existingCount?.physical_count ?? '');
  }, [existingCount?.physical_count]);

  const save = async (inputVal) => {
    if (!isEditableColumn) return;
    const numVal = inputVal === '' ? null : Number(inputVal);
    const dbVal = existingCount?.physical_count ?? null;
    
    // Skip API request if no changes
    if (numVal === dbVal) {
      setEditing(false);
      return;
    }

    if (inputVal !== '' && (isNaN(numVal) || numVal < 0)) {
      setError('Invalid');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await axios.put(`/api/items/${item.id}/count`, {
        auditor_name: auditorName,
        physical_count: numVal
      });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Err');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      save(localVal);
      setTimeout(() => {
        const nextInput = document.getElementById(`count-input-${rowIdx + 1}-${colIdx}`);
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        } else {
          triggerNextEdit(rowIdx + 1, colIdx);
        }
      }, 30);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      save(localVal);
      setTimeout(() => {
        const prevInput = document.getElementById(`count-input-${rowIdx - 1}-${colIdx}`);
        if (prevInput) {
          prevInput.focus();
          prevInput.select();
        } else {
          triggerNextEdit(rowIdx - 1, colIdx);
        }
      }, 30);
    } else if (e.key === 'ArrowRight' && (bulkEditMode || alwaysRenderInput)) {
      // Allow horizontal navigation in bulk edit mode
      setTimeout(() => {
        const rightInput = document.getElementById(`count-input-${rowIdx}-${colIdx + 1}`);
        if (rightInput) {
          rightInput.focus();
          rightInput.select();
        }
      }, 10);
    } else if (e.key === 'ArrowLeft' && (bulkEditMode || alwaysRenderInput)) {
      setTimeout(() => {
        const leftInput = document.getElementById(`count-input-${rowIdx}-${colIdx - 1}`);
        if (leftInput) {
          leftInput.focus();
          leftInput.select();
        }
      }, 10);
    } else if (e.key === 'Escape') {
      setLocalVal(existingCount?.physical_count ?? '');
      setEditing(false);
    }
  };

  const isCurrentAuditorHighlight = auditorName === currentUser?.role;

  // Render input field directly (Spreadsheet spreadsheet count entry mode)
  if (alwaysRenderInput) {
    return (
      <td className="px-1.5 py-1 text-center border-r border-zinc-200 dark:border-zinc-700/60 transition-all">
        <div className="relative flex flex-col items-center">
          <input
            id={`count-input-${rowIdx}-${colIdx}`}
            type="number"
            min="0"
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => save(localVal)}
            onFocus={(e) => e.target.select()}
            className={`w-14 text-center text-xs font-mono px-1 py-0.5 rounded border bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0071e3] focus:border-[#0071e3] transition-all ${
              isCurrentAuditorHighlight ? 'ring-1 ring-[#0071e3] border-[#0071e3]' : ''
            }`}
            placeholder="—"
          />
          {saving && <span className="absolute -bottom-2 text-[8px] text-[#0071e3] font-semibold tracking-wide animate-pulse">Saving</span>}
          {error && <span className="absolute -bottom-2 text-[8px] text-rose-500 font-semibold tracking-wide">{error}</span>}
        </div>
      </td>
    );
  }

  // Render clickable / double-click cell for Admin single edit
  if (isEditableColumn) {
    return (
      <td 
        className="px-1.5 py-1 text-center border-r border-zinc-200 dark:border-zinc-700/60 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/30 cursor-pointer"
        onClick={() => setEditing(true)}
      >
        {editing ? (
          <div className="flex flex-col items-center">
            <input
              id={`count-input-${rowIdx}-${colIdx}`}
              type="number"
              min="0"
              value={localVal}
              onChange={(e) => setLocalVal(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => save(localVal)}
              onFocus={(e) => e.target.select()}
              className="w-14 text-center text-xs font-mono px-1 py-0.5 rounded border border-[#0071e3] focus:outline-none bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50"
              autoFocus
            />
            {saving && <span className="text-[8px] text-[#0071e3]">Saving</span>}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1 group/edit h-6">
            <span className="text-zinc-700 dark:text-zinc-355 font-semibold font-mono">
              {existingCount?.physical_count ?? <span className="text-zinc-300 dark:text-zinc-700 font-normal">—</span>}
            </span>
            <Edit3 className="h-2.5 w-2.5 text-zinc-400 dark:text-zinc-600 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
          </div>
        )}
      </td>
    );
  }

  // Read-only cell
  return (
    <td className="px-1.5 py-1 text-center border-r border-zinc-200 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-355 font-mono font-semibold">
      {existingCount?.physical_count ?? <span className="text-zinc-300 dark:text-zinc-700 font-normal">—</span>}
    </td>
  );
}

// ─────────────────────────────────────────────────────────────────
// Main AuditTable Component
// ─────────────────────────────────────────────────────────────────
export default function AuditTable({
  items,
  totalItems,
  currentPage,
  setCurrentPage,
  limit,
  search,
  setSearch,
  filter,
  setFilter,
  supplierFilter,
  setSupplierFilter,
  locationFilter,
  setLocationFilter,
  storeFilter,
  setStoreFilter,
  meta,
  onRowClick,
  selectedItemId,
  auditors,
  currentUser,
  auditIsLocked,
  onCountSaved,
  activeSession,
  roleNamesMap = {},
}) {
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [localSearch, setLocalSearch] = useState(search);

  // Sync with prop when external search state clears/changes
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search input keystrokes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch);
        setCurrentPage(1);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, search]);

  const totalPages = Math.ceil(totalItems / limit) || 1;
  const offset = (currentPage - 1) * limit;

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const resetFilters = () => {
    setSearch('');
    setFilter('');
    setSupplierFilter('');
    setLocationFilter('');
    setStoreFilter('');
    setCurrentPage(1);
  };

  const hasFilters = search || filter || supplierFilter || locationFilter || storeFilter;
  const isAdmin = currentUser?.role === 'Admin';
  const userAuditorCol = currentUser?.role;

  return (
    <div className="space-y-3 w-full">
      {/* Search & Filters */}
      <div className="panel-card rounded-2xl p-3">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search product name, batch ID..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs glass-input focus:outline-none placeholder-zinc-400"
            />
          </div>

          {/* Swipeable Filter tray */}
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap py-0.5">
            {/* Status filter */}
            <GlassSelect
              value={filter}
              onChange={(v) => { setFilter(v); setCurrentPage(1); }}
              options={[
                { value: '',              label: 'All Items',     icon: '📋' },
                { value: 'Shortage',      label: 'SHORTAGE',      dot: '#FF3B30' },
                { value: 'Excess',        label: 'EXCESS',        dot: '#34C759' },
                { value: 'Expired Stock', label: 'EXPIRED STOCK', dot: '#FF9500' },
                { value: 'NEAR EXPIRY',   label: 'NEAR EXPIRY',   dot: '#FFD60A' },
                { value: 'Not Counted',   label: 'NOT COUNTED',   dot: '#8E8E93' },
              ]}
              placeholder="All Items"
            />

            {meta?.suppliers?.length > 0 && (
              <GlassSelect
                value={supplierFilter}
                onChange={(v) => { setSupplierFilter(v); setCurrentPage(1); }}
                options={[
                  { value: '', label: 'All Suppliers', icon: '🏭' },
                  ...meta.suppliers.map(s => ({ value: s, label: s }))
                ]}
                placeholder="All Suppliers"
              />
            )}

            {hasFilters && (
              <button onClick={resetFilters} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 text-zinc-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0">
                <X className="h-3 w-3" /> Reset
              </button>
            )}

            <div className="text-[10px] text-zinc-400 font-bold px-2 font-mono shrink-0">
              {totalItems} entries
            </div>
          </div>
        </div>
      </div>

      {/* Locked Banner */}
      {auditIsLocked && (
        <div className="flex items-center gap-2 px-4 py-2.5 text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 rounded-xl">
          <Lock className="h-4 w-4" />
          <span>Audit session is marked <strong>Completed & Locked</strong>. Counts are in read-only mode.</span>
        </div>
      )}

      {/* Table Container */}
      <div className="panel-card rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              {/* Double Header Group divisions */}
              <tr className="border-b border-zinc-200 dark:border-zinc-700/60 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px] text-center" style={{ background: 'var(--glass-bg-light)' }}>
                <th colSpan="7" className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-700/60">Static Medication Info</th>
                <th colSpan={auditors.length} className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-700/60" style={{ background: 'rgba(0,122,255,0.02)' }}>Physical Count Entries</th>
                <th colSpan="3" className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-700/60" style={{ background: 'rgba(0,122,255,0.02)' }}>Reconciliation Metrics</th>
                <th colSpan="1" className="px-4 py-2">Status</th>
              </tr>
              <tr className="border-b border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-300 text-left font-semibold" style={{ background: 'var(--glass-bg-light)' }}>
                <th className="px-4 py-2.5 text-center whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60">#</th>
                <th className="px-4 py-2.5 min-w-[180px] whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60">Item Name</th>
                <th className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60">Batch</th>
                <th className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60">Expiry</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60">Purchase Rate</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60">Selling Rate</th>
                <th className="px-3 py-2.5 text-center border-r border-zinc-200 dark:border-zinc-700/60 font-bold whitespace-nowrap">Avail. Qty</th>
                
                {auditors.map((a, colIdx) => {
                  const isUserCol = a === userAuditorCol;
                  const displayName = roleNamesMap[a] || a;
                  return (
                    <th 
                      key={a} 
                      className={`px-2 py-2.5 text-center min-w-[80px] whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60 ${
                        isUserCol ? 'font-bold border-b-2' : ''
                      }`}
                      style={{ 
                        borderBottomColor: isUserCol ? 'var(--accent)' : undefined, 
                        color: isUserCol ? 'var(--accent)' : undefined,
                        background: isUserCol ? 'var(--accent-light)' : undefined 
                      }}
                    >
                      {displayName}
                    </th>
                  );
                })}

                <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60">Total</th>
                <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60">Difference</th>
                <th className="px-3 py-2.5 text-right font-bold border-r border-zinc-200 dark:border-zinc-700/60 font-mono whitespace-nowrap">Diff. Value</th>
                <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700/60">
              {items.length === 0 && (
                <tr>
                  <td colSpan={17} className="px-4 py-16 text-center text-zinc-400 dark:text-zinc-600">
                    <div className="space-y-2">
                      <p className="font-semibold text-sm">No items found</p>
                      {hasFilters && <p className="text-xs">Try clearing filters or search parameters.</p>}
                    </div>
                  </td>
                </tr>
              )}
              {items.map((item, rowIdx) => {
                const totalPhysical = (item.auditor_counts || []).reduce((s, c) => {
                  if (auditors.includes(c.auditor_name)) {
                    return s + (Number(c.physical_count) || 0);
                  }
                  return s;
                }, 0) + Number(item.manual_add || 0) + Number(item.manual_recheck || 0);
                const diff = totalPhysical - (item.system_qty || 0);
                const diffValue = diff * (item.unit_purchase_rate || 0);
                const expLabel = getExpiryLabel(item.expiry_date, activeSession?.audit_date);
                const isSelected = selectedItemId === item.id;

                return (
                  <tr
                    key={item.id}
                    className={`group transition-colors align-middle cursor-pointer ${
                      isSelected
                        ? 'bg-blue-500/5 dark:bg-blue-500/8'
                        : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Index */}
                    <td className="px-4 py-3 text-center text-zinc-400 dark:text-zinc-500 font-mono border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                      {offset + rowIdx + 1}
                    </td>
                    
                    {/* Product Name & Location */}
                    <td className="px-4 py-3 border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                      <div className="font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{item.item_name}</div>
                      {item.location && (
                        <div className="text-zinc-400 text-[10px] mt-0.5 flex items-center gap-1">
                          <span>📍 {item.location}</span>
                          {item.store_name && <span>({item.store_name})</span>}
                        </div>
                      )}
                    </td>
                    
                    {/* Batch */}
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400 font-mono border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                      {item.batch_no || '—'}
                    </td>
                    
                    {/* Expiry Date */}
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400 font-mono border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                      {item.expiry_date || '—'}
                    </td>

                    {/* Cost */}
                    <td className="px-3 py-3 text-right text-zinc-700 dark:text-zinc-300 font-mono font-medium border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                      {item.unit_purchase_rate != null ? `₹${Number(item.unit_purchase_rate).toFixed(2)}` : '—'}
                    </td>
                    
                    {/* MRP */}
                    <td className="px-3 py-3 text-right text-zinc-500 dark:text-zinc-400 font-mono border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                      {item.unit_mrp != null ? `₹${Number(item.unit_mrp).toFixed(2)}` : '—'}
                    </td>
                    
                    {/* System Qty */}
                    <td className="px-3 py-3 text-center font-bold text-zinc-800 dark:text-zinc-200 border-r border-zinc-200 dark:border-zinc-700/60 font-mono" onClick={() => onRowClick(item)}>
                      {item.system_qty ?? '0'}
                    </td>

                    {/* Dynamic count columns */}
                    {auditors.map((auditorName, colIdx) => (
                      <InlineCountCell
                        key={auditorName}
                        item={item}
                        auditorName={auditorName}
                        currentUser={currentUser}
                        auditIsLocked={auditIsLocked}
                        onSaved={onCountSaved}
                        rowIdx={rowIdx}
                        colIdx={colIdx}
                        bulkEditMode={bulkEditMode}
                      />
                    ))}

                    {/* Total Physical */}
                    <td className="px-3 py-3 text-center font-extrabold text-zinc-950 dark:text-white font-mono border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                      {totalPhysical}
                    </td>
                    
                    {/* Difference Qty */}
                    <td className={`px-3 py-3 text-center font-extrabold font-mono border-r border-zinc-200 dark:border-zinc-700/60 ${
                      diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-rose-600 dark:text-rose-450' : 'text-zinc-500 dark:text-zinc-400'
                    }`} onClick={() => onRowClick(item)}>
                      {diff > 0 ? `+${diff}` : diff}
                    </td>
                    
                    {/* Variance Value */}
                    <td className={`px-3 py-3 text-right font-bold border-r border-zinc-200 dark:border-zinc-700/60 font-mono ${
                      diffValue > 0 ? 'text-emerald-600 dark:text-emerald-400' : diffValue < 0 ? 'text-rose-600 dark:text-rose-450' : 'text-zinc-500 dark:text-zinc-400'
                    }`} onClick={() => onRowClick(item)}>
                      {(diffValue > 0 ? '+' : '') + formatCurrency(diffValue)}
                    </td>

                    {/* Expiry Status */}
                    <td className="px-3 py-3 text-center" onClick={() => onRowClick(item)}>
                      {expLabel ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wide uppercase border whitespace-nowrap ${getExpiryStatusPill(expLabel.label)}`}>
                          {expLabel.label}
                        </span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-700">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20">
          <span className="text-xs text-zinc-500 dark:text-zinc-450">
            Showing {offset + 1}–{Math.min(offset + limit, totalItems)} of {totalItems} entries
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-600 dark:text-zinc-400"><ChevronsLeft className="h-3.5 w-3.5" /></button>
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-600 dark:text-zinc-400"><ChevronLeft className="h-3.5 w-3.5" /></button>
            <span className="px-3 py-1 text-xs font-semibold bg-blue-600 text-white rounded-lg select-none">{currentPage}</span>
            <span className="text-xs text-zinc-400 mx-1">/ {totalPages}</span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-600 dark:text-zinc-400"><ChevronRight className="h-3.5 w-3.5" /></button>
            <button onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 text-zinc-600 dark:text-zinc-400"><ChevronsRight className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
