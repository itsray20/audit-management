import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ChevronUp,
  Search, X, Edit3, Lock, CheckCircle, Snowflake, UserX, RefreshCw,
  Maximize2, Minimize2
} from 'lucide-react';
import GlassSelect from './GlassSelect';

const formatCurrency = (val) => {
  const num = Number(val || 0);
  if (num < 0) return '-₹' + Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const getCategoryPill = (cat) => {
  switch (cat) {
    case 'Excess': return 'bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40';
    case 'Shortage': return 'bg-rose-50/50 text-rose-700 dark:bg-rose-950/10 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40';
    case 'Extra Found': return 'bg-amber-50/50 text-amber-700 dark:bg-amber-950/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40';
    case 'Expired Stock': return 'bg-purple-50/50 text-purple-700 dark:bg-purple-950/10 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/40';
    case 'Perfect Match': return 'bg-blue-50/50 text-blue-700 dark:bg-blue-950/10 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40';
    default: return 'bg-zinc-100/50 text-zinc-600 dark:bg-zinc-800/10 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-800/40';
  }
};

const getExpiryLabel = (dateStr, sessionDateStr) => {
  if (!dateStr) return null;
  const itemDate = new Date(dateStr); itemDate.setHours(0, 0, 0, 0);
  const today = sessionDateStr ? new Date(sessionDateStr) : new Date(); today.setHours(0, 0, 0, 0);
  const ninetyDays = new Date(today); ninetyDays.setDate(today.getDate() + 90);
  if (itemDate < today) return { label: 'EXPIRED', cls: 'text-rose-600 dark:text-rose-450 font-bold text-[9px]' };
  if (itemDate <= ninetyDays) return { label: 'NEAR EXPIRY', cls: 'text-amber-600 dark:text-amber-450 font-bold text-[9px]' };
  return { label: 'GOOD STOCK', cls: 'text-emerald-600 dark:text-emerald-450 font-semibold text-[9px]' };
};

const getExpiryStatusPill = (label) => {
  switch (label) {
    case 'EXPIRED': return 'bg-rose-50/50 text-rose-700 dark:bg-rose-950/10 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40';
    case 'NEAR EXPIRY': return 'bg-amber-50/50 text-amber-700 dark:bg-amber-950/10 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40';
    case 'GOOD STOCK': return 'bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/10 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40';
    default: return 'bg-zinc-100/50 text-zinc-600 dark:bg-zinc-800/10 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-800/40';
  }
};

// ─────────────────────────────────────────────────────────────────
// Inline Count Cell — supports dynamic user_id-based columns
// ─────────────────────────────────────────────────────────────────
function InlineCountCellInner({
  item,
  auditorId,       // user_id string (or legacy slot like 'User1')
  memberStatus,    // 'active' | 'frozen' | 'removed'
  currentUser,
  auditIsLocked,
  onSaved,
  onPutComplete,   // called after PUT succeeds — triggers background sync
  rowIdx,
  colIdx,
  bulkEditMode,
}) {
  // Find existing count: match by user_id (string) or legacy slot
  const existingCount = item.auditor_counts?.find(
    c => String(c.auditor_name) === String(auditorId)
  );

  const [localVal, setLocalVal] = useState(existingCount?.physical_count ?? '');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isPrivileged = currentUser?.role === 'Admin' || currentUser?.role === 'Developer';
  const isOwnColumn = String(auditorId) === String(currentUser?.id);

  // Column is editable if:
  // 1. Not audit-locked globally
  // 2. Either user is privileged (can edit anyone's, even frozen/removed)
  // 3. OR it's the user's own column AND they are not frozen/removed
  const memberIsFrozenOrRemoved = memberStatus === 'frozen' || memberStatus === 'removed';
  const isEditableColumn = !auditIsLocked &&
    (isPrivileged || (isOwnColumn && !memberIsFrozenOrRemoved));

  const alwaysRenderInput = isEditableColumn && isPrivileged && bulkEditMode;

  useEffect(() => {
    const handleTriggerEdit = (e) => {
      if (e.detail.rowIdx === rowIdx && e.detail.colIdx === colIdx) setEditing(true);
    };
    window.addEventListener('trigger-inline-edit', handleTriggerEdit);
    return () => window.removeEventListener('trigger-inline-edit', handleTriggerEdit);
  }, [rowIdx, colIdx]);

  const triggerNextEdit = (targetRowIdx, targetColIdx) => {
    window.dispatchEvent(new CustomEvent('trigger-inline-edit', { detail: { rowIdx: targetRowIdx, colIdx: targetColIdx } }));
  };

  useEffect(() => {
    setLocalVal(existingCount?.physical_count ?? '');
  }, [existingCount?.physical_count]);

  const save = async (inputVal) => {
    if (!isEditableColumn) return;
    const numVal = inputVal === '' ? null : Number(inputVal);
    const dbVal = existingCount?.physical_count ?? null;
    if (numVal === dbVal) { setEditing(false); return; }
    if (inputVal !== '' && (isNaN(numVal) || numVal < 0)) { setError('Invalid'); return; }

    setSaving(true); setError('');
    // ① Optimistic: immediately paint the new value in the UI
    onSaved(item.id, auditorId, numVal);
    setEditing(false);
    try {
      await axios.put(`/api/items/${item.id}/count`, {
        auditor_name: auditorId,
        physical_count: numVal,
      });
      // ② PUT succeeded → trigger background refetch to confirm server state
      onPutComplete?.();
    } catch (err) {
      // Revert optimistic update on failure
      onSaved(item.id, auditorId, dbVal);
      setError(err.response?.data?.error || 'Err');
      setEditing(true);
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
        if (nextInput) { nextInput.focus(); nextInput.select(); }
        else triggerNextEdit(rowIdx + 1, colIdx);
      }, 30);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      save(localVal);
      setTimeout(() => {
        const prevInput = document.getElementById(`count-input-${rowIdx - 1}-${colIdx}`);
        if (prevInput) { prevInput.focus(); prevInput.select(); }
        else triggerNextEdit(rowIdx - 1, colIdx);
      }, 30);
    } else if (e.key === 'ArrowRight' && (bulkEditMode || alwaysRenderInput)) {
      setTimeout(() => {
        const r = document.getElementById(`count-input-${rowIdx}-${colIdx + 1}`);
        if (r) { r.focus(); r.select(); }
      }, 10);
    } else if (e.key === 'ArrowLeft' && (bulkEditMode || alwaysRenderInput)) {
      setTimeout(() => {
        const l = document.getElementById(`count-input-${rowIdx}-${colIdx - 1}`);
        if (l) { l.focus(); l.select(); }
      }, 10);
    } else if (e.key === 'Escape') {
      setLocalVal(existingCount?.physical_count ?? '');
      setEditing(false);
    }
  };

  // Frozen/Removed column style — read-only but data preserved
  if (memberIsFrozenOrRemoved) {
    const hasValue = existingCount?.physical_count !== null && existingCount?.physical_count !== undefined;
    return (
      <td
        className="px-1.5 py-1 text-center border-r border-zinc-200 dark:border-zinc-700/60"
        style={{ background: memberStatus === 'frozen' ? 'rgba(255,149,0,0.04)' : 'rgba(255,59,48,0.03)' }}
        title={memberStatus === 'frozen' ? 'Member frozen — read only' : 'Member removed — read only'}
      >
        <div className="flex items-center justify-center gap-1">
          {memberStatus === 'frozen' && <Snowflake className="h-2.5 w-2.5 text-amber-400 shrink-0" />}
          {memberStatus === 'removed' && <UserX className="h-2.5 w-2.5 text-rose-400 shrink-0" />}
          <span className="text-zinc-400 dark:text-zinc-600 font-mono text-xs">
            {hasValue ? existingCount.physical_count : <span className="text-zinc-300 dark:text-zinc-700">—</span>}
          </span>
        </div>
      </td>
    );
  }

  // Bulk Edit (Admin/Dev mode)
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
            className={`w-14 text-center text-xs font-mono px-1 py-0.5 rounded border bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#0071e3] focus:border-[#0071e3] transition-all ${isOwnColumn ? 'ring-1 ring-[#0071e3] border-[#0071e3]' : ''}`}
            placeholder="—"
          />
          {saving && <span className="absolute -bottom-2 text-[8px] text-[#0071e3] font-semibold tracking-wide animate-pulse">Saving</span>}
          {error && <span className="absolute -bottom-2 text-[8px] text-rose-500 font-semibold tracking-wide">{error}</span>}
        </div>
      </td>
    );
  }

  // Editable click cell
  if (isEditableColumn) {
    return (
      <td
        className="px-1.5 py-1 text-center border-r border-zinc-200 dark:border-zinc-700/60 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/30 cursor-pointer relative"
        style={{ overflow: 'visible' }}
        onClick={() => !editing && setEditing(true)}
      >
        {/* Static display — always rendered so the row height never changes */}
        <div className="flex items-center justify-center gap-1 group/edit" style={{ visibility: editing ? 'hidden' : 'visible' }}>
          <span className="text-zinc-700 dark:text-zinc-355 font-semibold font-mono text-xs">
            {existingCount?.physical_count ?? <span className="text-zinc-300 dark:text-zinc-700 font-normal">—</span>}
          </span>
          <Edit3 className="h-2.5 w-2.5 text-zinc-400 dark:text-zinc-600 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
        </div>
        {/* Input overlay — absolutely positioned so it doesn't affect row/col size */}
        {editing && (
          <input
            id={`count-input-${rowIdx}-${colIdx}`}
            type="number"
            min="0"
            value={localVal}
            onChange={(e) => setLocalVal(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => save(localVal)}
            onFocus={(e) => e.target.select()}
            className="no-spin"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              textAlign: 'center',
              fontSize: '0.75rem',
              fontFamily: 'inherit',
              fontWeight: 600,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              padding: 0,
              margin: 0,
              color: 'var(--accent)',
            }}
            autoFocus
            placeholder="—"
          />
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

const InlineCountCell = React.memo(InlineCountCellInner, (prevProps, nextProps) => {
  const prevCount = prevProps.item.auditor_counts?.find(c => String(c.auditor_name) === String(prevProps.auditorId))?.physical_count;
  const nextCount = nextProps.item.auditor_counts?.find(c => String(c.auditor_name) === String(nextProps.auditorId))?.physical_count;
  
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.auditorId === nextProps.auditorId &&
    prevProps.memberStatus === nextProps.memberStatus &&
    prevProps.auditIsLocked === nextProps.auditIsLocked &&
    prevProps.bulkEditMode === nextProps.bulkEditMode &&
    prevCount === nextCount &&
    prevProps.rowIdx === nextProps.rowIdx &&
    prevProps.colIdx === nextProps.colIdx &&
    prevProps.currentUser?.id === nextProps.currentUser?.id &&
    prevProps.currentUser?.role === nextProps.currentUser?.role
  );
});

// ─────────────────────────────────────────────────────────────────
// Main AuditTable Component
// ─────────────────────────────────────────────────────────────────
export default function AuditTable({
  isInitialLoading,
  items,
  totalItems,
  currentPage,
  setCurrentPage,
  limit,
  setLimit,
  search,
  setSearch,
  filter,
  setFilter,
  alphabetFilter,
  setAlphabetFilter,
  supplierFilter,
  setSupplierFilter,
  locationFilter,
  setLocationFilter,
  storeFilter,
  setStoreFilter,
  meta,
  onRowClick,
  selectedItemId,
  auditors,        // array of user_id strings for which columns to show
  auditColumns,    // array of { id, name, role, status } — enriched column metadata
  currentUser,
  auditIsLocked,
  onCountSaved,
  onCountSyncReady,  // called after PUT succeeds — triggers background refetch
  activeSession,
  roleNamesMap = {},
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
}) {
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [localSearch, setLocalSearch] = useState(search);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tableRef = useRef(null);
  const tableScrollRef = useRef(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const currentlyFull = !!document.fullscreenElement;
      setIsFullscreen(currentlyFull);
      if (setLimit) {
        if (currentlyFull) {
          setLimit(200);
          setCurrentPage(1);
        } else {
          setLimit(30);
          setCurrentPage(1);
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [setLimit, setCurrentPage]);

  const toggleFullscreen = () => {
    if (!tableRef.current) return;
    if (!document.fullscreenElement) {
      tableRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleTableScroll = (e) => {
    if (e.target.scrollTop > 155) {
      setShowScrollTop(true);
    } else {
      setShowScrollTop(false);
    }
  };

  const scrollToTop = () => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => { setLocalSearch(search); }, [search]);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const renderSortIndicator = (field) => {
    if (sortBy !== field) return null;
    return <span className="ml-1 text-[8px] opacity-80">{sortOrder === 'asc' ? '▲' : '▼'}</span>;
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) { setSearch(localSearch); setCurrentPage(1); }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, search]);

  const totalPages = Math.ceil(totalItems / limit) || 1;
  const offset = (currentPage - 1) * limit;

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const resetFilters = () => {
    setSearch(''); setFilter(''); setAlphabetFilter(''); setSupplierFilter('');
    setLocationFilter(''); setStoreFilter(''); setCurrentPage(1);
  };

  const hasFilters = search || filter || alphabetFilter || supplierFilter || locationFilter || storeFilter;
  const isPrivileged = currentUser?.role === 'Admin' || currentUser?.role === 'Developer';

  // Build display columns from auditColumns prop
  // Fallback to auditors array if auditColumns not provided
  const columns = auditColumns && auditColumns.length > 0
    ? auditColumns
    : (auditors || []).map(a => ({ id: a, name: roleNamesMap[a] || a, status: 'active' }));

  // Only show removed-member columns if they have entries in current page items. Exclude virtual/imported columns.
  const visibleColumns = columns.filter(col => {
    if (col.role === 'Imported') return false;
    if (col.is_virtual && col.role !== 'Legacy Slot') return false;
    if (col.status !== 'removed') return true;
    // Show removed column only if at least one item on this page has a count for them
    return items.some(item =>
      item.auditor_counts?.some(c => String(c.auditor_name) === String(col.id))
    );
  });

  return (
    <div 
      ref={tableRef} 
      className={`w-full transition-all ${isFullscreen ? 'p-6 overflow-hidden flex flex-col h-screen space-y-3' : 'space-y-3'}`}
      style={isFullscreen ? { background: 'var(--bg-base)' } : {}}
    >
      {/* Search & Filters */}
      <div className="panel-card rounded-2xl p-3">
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center">
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
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none flex-nowrap py-0.5">
            <GlassSelect
              value={alphabetFilter}
              onChange={(v) => { setAlphabetFilter(v); setCurrentPage(1); }}
              options={[
                { value: '', label: 'A-Z' },
                ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).map(char => ({ value: char, label: char })),
                { value: '0-9', label: '(0-9)' }
              ]}
              placeholder="A-Z"
              style={{ minWidth: '80px' }}
            />
            <GlassSelect
              value={filter}
              onChange={(v) => { setFilter(v); setCurrentPage(1); }}
              options={[
                { value: '', label: 'All Items', icon: '📋' },
                { value: 'Shortage', label: 'SHORTAGE', dot: '#FF3B30' },
                { value: 'Excess', label: 'EXCESS', dot: '#34C759' },
                { value: 'Expired Stock', label: 'EXPIRED STOCK', dot: '#FF9500' },
                { value: 'NEAR EXPIRY', label: 'NEAR EXPIRY', dot: '#FFD60A' },
                { value: 'Extra Found', label: 'EXTRA FOUND', dot: '#007AFF' },
                { value: 'Not Counted', label: 'NOT COUNTED', dot: '#8E8E93' },
              ]}
              placeholder="All Items"
            />
            {meta?.suppliers?.length > 0 && (
              <GlassSelect
                value={supplierFilter}
                onChange={(v) => { setSupplierFilter(v); setCurrentPage(1); }}
                options={[{ value: '', label: 'All Suppliers', icon: '🏭' }, ...meta.suppliers.map(s => ({ value: s, label: s }))]}
                placeholder="All Suppliers"
              />
            )}
            {hasFilters && (
              <button onClick={resetFilters} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-zinc-200 dark:border-zinc-700 text-zinc-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0">
                <X className="h-3 w-3" /> Reset
              </button>
            )}
            <div className="text-[10px] text-zinc-400 font-bold px-2 font-mono shrink-0">{totalItems} entries</div>
            
            {/* Fullscreen Maximize / Minimize Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-550 hover:text-zinc-750 dark:hover:text-zinc-200 shrink-0 flex items-center gap-1"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
              style={{ fontFamily: 'inherit' }}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Minimize</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Maximize</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Locked Banner */}
      {auditIsLocked && (
        <div className="flex items-center gap-2 px-4 py-2.5 text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 rounded-xl">
          <Lock className="h-4 w-4" />
          <span>Audit session is <strong>{activeSession?.status === 'Completed' ? 'Completed & Locked' : 'restricted'}</strong>. Counts are in read-only mode.</span>
        </div>
      )}

      {/* Member Status Legend */}
      {visibleColumns.some(c => c.status === 'frozen' || c.status === 'removed') && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-[10px]" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ color: 'var(--text-tertiary)' }}>Column status:</span>
          <span className="flex items-center gap-1 text-amber-500"><Snowflake className="h-3 w-3" /> Frozen (read-only, counted in totals)</span>
          <span className="flex items-center gap-1 text-rose-400"><UserX className="h-3 w-3" /> Removed (read-only, counted in totals)</span>
        </div>
      )}

      {/* Table Container */}
      <div className={`panel-card rounded-2xl overflow-hidden relative flex flex-col ${isFullscreen ? 'flex-1 min-h-0' : 'min-h-[300px]'}`}>
        {isInitialLoading ? (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-zinc-50/80 dark:bg-zinc-900/80 rounded-2xl transition-all duration-300">
            <div className="flex flex-col items-center gap-4 bg-white dark:bg-zinc-900 p-6 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-800">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
              <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">Loading audit data...</span>
            </div>
          </div>
        ) : (
          <div 
            ref={tableScrollRef}
            onScroll={handleTableScroll}
            className={`overflow-x-auto overflow-y-auto ${isFullscreen ? 'flex-1 min-h-0' : ''}`}
          >
            <table className="w-auto min-w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: '36px' }} />{/* # */}
                <col style={{ width: '150px' }} />{/* Item Name */}
                <col style={{ width: '100px' }} />{/* Batch */}
                <col style={{ width: '80px' }} />{/* Expiry */}
                <col style={{ width: '90px' }} />{/* Purchase Rate */}
                <col style={{ width: '80px' }} />{/* Selling Rate */}
                <col style={{ width: '64px' }} />{/* Avail. Qty */}
                {visibleColumns.map((col) => (
                  <col key={col.id} style={{ width: '72px' }} />
                ))}
                <col style={{ width: '56px' }} />{/* Total */}
                <col style={{ width: '76px' }} />{/* Difference */}
                <col style={{ width: '88px' }} />{/* Diff. Value */}
                <col style={{ width: '88px' }} />{/* Status */}
              </colgroup>
              <thead className="sticky top-0 z-10 shadow-sm" style={{ background: 'var(--card-solid)' }}>
                <tr className="border-b border-zinc-200 dark:border-zinc-700/60 text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider text-[10px] text-center" style={{ background: 'var(--card-solid)' }}>
                  <th colSpan="7" className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-700/60">Static Medication Info</th>
                  <th colSpan={visibleColumns.length} className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-700/60" style={{ background: 'rgba(0,122,255,0.02)' }}>Physical Count Entries</th>
                  <th colSpan="3" className="px-4 py-2 border-r border-zinc-200 dark:border-zinc-700/60" style={{ background: 'rgba(0,122,255,0.02)' }}>Reconciliation Metrics</th>
                  <th colSpan="1" className="px-4 py-2">Status</th>
                </tr>
                <tr className="border-b border-zinc-200 dark:border-zinc-700/60 text-zinc-600 dark:text-zinc-300 text-left font-semibold" style={{ background: 'var(--card-solid)' }}>
                  <th className="px-4 py-2.5 text-center whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60 select-none">
                    <div className="flex items-center justify-center">#</div>
                  </th>
                  <th className="px-2 py-2.5 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60 select-none">
                    <div className="flex items-center justify-between">Item Name</div>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60 select-none">
                    <div className="flex items-center justify-between">Batch</div>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60 select-none">
                    <div className="flex items-center justify-between">Expiry</div>
                  </th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60 select-none">
                    <div className="flex items-center justify-end">Purchase Rate</div>
                  </th>
                  <th className="px-3 py-2.5 text-right whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60 select-none">Selling Rate</th>
                  <th className="px-3 py-2.5 text-center border-r border-zinc-200 dark:border-zinc-700/60 font-bold whitespace-nowrap select-none">
                    <div className="flex items-center justify-center">Avail. Qty</div>
                  </th>

                  {visibleColumns.map((col) => {
                    const isOwnCol = String(col.id) === String(currentUser?.id);
                    const isFrozen = col.status === 'frozen';
                    const isRemoved = col.status === 'removed';
                    return (
                      <th
                        key={col.id}
                        className={`px-1 py-2.5 text-center whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60 ${isOwnCol ? 'font-bold border-b-2' : ''}`}
                        style={{
                          borderBottomColor: isOwnCol ? 'var(--accent)' : undefined,
                          color: isFrozen ? '#FF9500' : isRemoved ? '#FF3B30' : isOwnCol ? 'var(--accent)' : undefined,
                          background: isOwnCol ? 'var(--accent-light)' : isFrozen ? 'rgba(255,149,0,0.05)' : isRemoved ? 'rgba(255,59,48,0.04)' : undefined,
                        }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {isFrozen && <Snowflake className="h-2.5 w-2.5 text-amber-400" />}
                          {isRemoved && <UserX className="h-2.5 w-2.5 text-rose-400" />}
                          <span className="truncate max-w-[70px]">{col.name}</span>
                        </div>
                      </th>
                    );
                  })}

                  <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60 select-none">
                    <div className="flex items-center justify-center">Total</div>
                  </th>
                  <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap border-r border-zinc-200 dark:border-zinc-700/60 select-none">
                    <div className="flex items-center justify-center">Difference</div>
                  </th>
                  <th className="px-3 py-2.5 text-right font-bold border-r border-zinc-200 dark:border-zinc-700/60 font-mono whitespace-nowrap select-none">
                    <div className="flex items-center justify-end">Diff. Value</div>
                  </th>
                  <th className="px-3 py-2.5 text-center font-bold whitespace-nowrap select-none">
                    <div className="flex items-center justify-center">Status</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700/60">
                {items.length === 0 && (
                  <tr>
                    <td colSpan={7 + visibleColumns.length + 4} className="px-4 py-16 text-center text-zinc-400 dark:text-zinc-600">
                      <div className="space-y-2">
                        <p className="font-semibold text-sm">No items found</p>
                        {hasFilters && <p className="text-xs">Try clearing filters or search parameters.</p>}
                      </div>
                    </td>
                  </tr>
                )}
                {items.map((item, rowIdx) => {
                  const totalPhysical = item.totalPhysical || 0;
                  const diff = item.difference || 0;
                  const diffValue = item.differenceValue || 0;
                  const expLabel = getExpiryLabel(item.expiry_date, activeSession?.audit_date);
                  const isSelected = selectedItemId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={`group transition-colors align-middle cursor-pointer ${isSelected ? 'bg-blue-500/5 dark:bg-blue-500/8' : 'hover:bg-zinc-50 dark:hover:bg-white/[0.03]'}`}
                    >
                      {/* Index */}
                      <td className="px-2 py-1.5 text-center text-zinc-400 dark:text-zinc-500 font-mono border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                        {offset + rowIdx + 1}
                      </td>

                      {/* Product Name & Location */}
                      <td className="px-2 py-1.5 border-r border-zinc-200 dark:border-zinc-700/60 overflow-hidden" onClick={() => onRowClick(item)}>
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate">{item.item_name}</div>
                        {item.location && (
                          <div className="text-zinc-400 text-[10px] mt-0.5 flex items-center gap-1 truncate">
                            <span>📍 {item.location}</span>
                            {item.store_name && <span>({item.store_name})</span>}
                          </div>
                        )}
                      </td>

                      <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-400 font-mono border-r border-zinc-200 dark:border-zinc-700/60 overflow-hidden" onClick={() => onRowClick(item)}>
                        <span className="truncate block">{item.batch_no || '—'}</span>
                      </td>

                      {/* Expiry */}
                      <td className="px-2 py-1.5 text-zinc-600 dark:text-zinc-400 font-mono border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                        {item.expiry_date || '—'}
                      </td>

                      {/* Cost */}
                      <td className="px-2 py-1.5 text-right text-zinc-700 dark:text-zinc-300 font-mono font-medium border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                        {item.unit_purchase_rate != null ? `₹${Number(item.unit_purchase_rate).toFixed(2)}` : '—'}
                      </td>

                      {/* MRP */}
                      <td className="px-2 py-1.5 text-right text-zinc-500 dark:text-zinc-400 font-mono border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                        {item.unit_mrp != null ? `₹${Number(item.unit_mrp).toFixed(2)}` : '—'}
                      </td>

                      {/* System Qty */}
                      <td className="px-2 py-1.5 text-center font-bold text-zinc-800 dark:text-zinc-200 border-r border-zinc-200 dark:border-zinc-700/60 font-mono" onClick={() => onRowClick(item)}>
                        {item.system_qty ?? '0'}
                      </td>

                      {/* Dynamic Count Columns */}
                      {visibleColumns.map((col, colIdx) => (
                        <InlineCountCell
                          key={col.id}
                          item={item}
                          auditorId={col.id}
                          memberStatus={col.status}
                          currentUser={currentUser}
                          auditIsLocked={auditIsLocked}
                          onSaved={onCountSaved}
                          onPutComplete={onCountSyncReady}
                          rowIdx={rowIdx}
                          colIdx={colIdx}
                          bulkEditMode={bulkEditMode}
                        />
                      ))}

                      {/* Total Physical */}
                      <td className="px-2 py-1.5 text-center font-extrabold text-zinc-950 dark:text-white font-mono border-r border-zinc-200 dark:border-zinc-700/60" onClick={() => onRowClick(item)}>
                        {totalPhysical}
                      </td>

                      {/* Difference Qty */}
                      <td className={`px-2 py-1.5 text-center font-extrabold font-mono border-r border-zinc-200 dark:border-zinc-700/60 ${diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : diff < 0 ? 'text-rose-600 dark:text-rose-450' : 'text-zinc-500 dark:text-zinc-400'}`} onClick={() => onRowClick(item)}>
                        {diff > 0 ? `+${diff}` : diff}
                      </td>

                      {/* Variance Value */}
                      <td className={`px-2 py-1.5 text-right font-bold border-r border-zinc-200 dark:border-zinc-700/60 font-mono ${diffValue > 0 ? 'text-emerald-600 dark:text-emerald-400' : diffValue < 0 ? 'text-rose-600 dark:text-rose-450' : 'text-zinc-500 dark:text-zinc-400'}`} onClick={() => onRowClick(item)}>
                        {(diffValue > 0 ? '+' : '') + formatCurrency(diffValue)}
                      </td>

                      {/* Expiry Status */}
                      <td className="px-2 py-1.5 text-center" onClick={() => onRowClick(item)}>
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
        )}

        {/* Pagination */}
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

        {showScrollTop && (
          <button
            type="button"
            onClick={scrollToTop}
            className="absolute bottom-16 right-6 p-2 rounded-full bg-zinc-900/90 hover:bg-zinc-950 dark:bg-white/90 dark:hover:bg-white text-white dark:text-zinc-950 shadow-2xl transition-all scale-100 hover:scale-105 active:scale-95 z-40 border border-zinc-700/30 flex items-center justify-center gap-1"
            title="Scroll to Top"
            style={{ fontFamily: 'inherit' }}
          >
            <ChevronUp className="h-4 w-4" />
            <span className="text-[9px] font-extrabold uppercase tracking-wider pr-1">Back to Top</span>
          </button>
        )}
      </div>
    </div>
  );
}
