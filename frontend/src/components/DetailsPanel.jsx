import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, Check, History, Save, Trash2, AlertTriangle } from 'lucide-react';
import axios from 'axios';


export default function DetailsPanel({
  item,
  currentUser,
  auditIsLocked,
  onClose,
  onUpdate,
  isDark,
  roleNamesMap = {},
  auditMembers = []
}) {
  const [selectedAuditor, setSelectedAuditor] = useState('');
  const [physicalCount, setPhysicalCount] = useState('');
  const [remarks, setRemarks] = useState('');

  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editItemName, setEditItemName] = useState('');
  const [editBatchNo, setEditBatchNo] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editUnitMrp, setEditUnitMrp] = useState('');
  const [editUnitCost, setEditUnitCost] = useState('');
  const [editSystemQty, setEditSystemQty] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editSupplier, setEditSupplier] = useState('');

  const isAdmin = currentUser.role === 'Admin' || currentUser.role === 'Developer';
  // Own column key: use user_id for new system
  const myMember = auditMembers.find(m => String(m.user_id) === String(currentUser.id));
  const ownAuditorKey = myMember ? String(myMember.user_id) : currentUser.role;
  const canEditSelectedAuditor = isAdmin || selectedAuditor === ownAuditorKey;

  // Initialize panel values when item changes
  useEffect(() => {
    if (item) {
      setPhysicalCount('');
      setRemarks('');
      setSuccessMsg('');
      setError('');
      fetchItemHistory();

      // Initialize editable static values
      setEditItemName(item.item_name || '');
      setEditBatchNo(item.batch_no || '');
      setEditExpiryDate(item.expiry_date || '');
      setEditUnitMrp(item.unit_mrp != null ? Number(item.unit_mrp).toFixed(2) : '');
      setEditUnitCost(item.unit_purchase_rate != null ? Number(item.unit_purchase_rate).toFixed(2) : '');
      setEditSystemQty(String(item.system_qty ?? ''));
      setEditLocation(item.location || '');
      setEditSupplier(item.supplier || '');

      // Default selected auditor to current user's own key
      if (!isAdmin) {
        setSelectedAuditor(ownAuditorKey);
        const existingCount = (item.auditor_counts || []).find(
          c => String(c.auditor_name) === ownAuditorKey || c.auditor_name === currentUser.role
        );
        if (existingCount) {
          setPhysicalCount(String(existingCount.physical_count ?? ''));
          setRemarks(existingCount.remarks || '');
        }
      } else {
        setSelectedAuditor(ownAuditorKey);
        const existingCount = (item.auditor_counts || []).find(
          c => String(c.auditor_name) === ownAuditorKey
        );
        if (existingCount) {
          setPhysicalCount(String(existingCount.physical_count ?? ''));
          setRemarks(existingCount.remarks || '');
        }
      }
    }
  }, [item, currentUser]);

  const fetchItemHistory = async () => {
    if (!item) return;
    setIsLoadingHistory(true);
    try {
      const response = await axios.get(`/api/audits/${item.audit_session_id}/trail`);
      const itemLogs = response.data.filter(log => log.item_id === item.id);
      setHistory(itemLogs);
    } catch (err) {
      console.error('Failed to load item history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleAuditorChange = (auditorName) => {
    setSelectedAuditor(auditorName);
    const existingCount = (item.auditor_counts || []).find(c => c.auditor_name === auditorName);
    if (existingCount) {
      setPhysicalCount(String(existingCount.physical_count ?? ''));
      setRemarks(existingCount.remarks || '');
    } else {
      setPhysicalCount('');
      setRemarks('');
    }
  };

  const handleSaveStaticDetails = async (e) => {
    e.preventDefault();
    if (auditIsLocked) {
      setError('This audit session is completed and locked.');
      return;
    }
    try {
      await axios.put(`/api/items/${item.id}`, {
        item_name: editItemName,
        batch_no: editBatchNo,
        expiry_date: editExpiryDate,
        unit_mrp: Number(editUnitMrp || 0),
        unit_purchase_rate: Number(editUnitCost || 0),
        system_qty: Number(editSystemQty || 0),
        location: editLocation,
        supplier: editSupplier,
        reason: 'Admin manual edit',
        user_name: currentUser.name
      });
      setSuccessMsg('Product details updated successfully.');
      setError('');
      onUpdate();
      fetchItemHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update product details.');
    }
  };

  const handleSaveCount = async (e) => {
    e.preventDefault();
    if (!selectedAuditor) {
      setError('Please select or specify an auditor column.');
      return;
    }

    if (auditIsLocked) {
      setError('This audit session is completed and locked.');
      return;
    }

    if (!canEditSelectedAuditor) {
      setError(`You can only save counts in your own column.`);
      return;
    }

    const countVal = physicalCount === '' ? null : parseInt(physicalCount);
    if (physicalCount !== '' && (isNaN(countVal) || countVal < 0)) {
      setError('Physical count must be a non-negative integer or left blank.');
      return;
    }

    try {
      await axios.put(`/api/items/${item.id}/count`, {
        auditor_name: selectedAuditor,
        physical_count: countVal,
        expiry_check: false,
        remarks: remarks
      });
      setSuccessMsg('Auditor count saved successfully.');
      setError('');
      onUpdate();
      fetchItemHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save count.');
    }
  };

  const handleDeleteProduct = async () => {
    setIsDeleting(true);
    setError('');
    try {
      await axios.delete(`/api/items/${item.id}`);
      setSuccessMsg('Product deleted successfully.');
      setTimeout(() => {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
        onUpdate();
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete product.');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };


  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden text-sm w-full rounded-2xl sm:rounded-3xl shadow-2xl ring-1 ring-zinc-200 dark:ring-zinc-800">
      {/* Drawer Header */}
      <div className="flex justify-between items-center px-8 py-5 border-b border-zinc-100 dark:border-zinc-800/60 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl z-10">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50 text-[15px] tracking-tight">Audit Investigation</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Sticky Alerts / Feedback */}
      {error && (
        <div className="px-8 pt-6">
          <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl p-4 text-sm font-medium">
            {error}
          </div>
        </div>
      )}
      {successMsg && (
        <div className="px-8 pt-6">
          <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl p-4 text-sm font-medium flex items-center gap-2">
            <Check className="h-4 w-4" />
            {successMsg}
          </div>
        </div>
      )}

      {/* Drawer Body Scroll */}
      <div
        className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 gap-8"
        style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
      >
        {/* LEFT COLUMN: Static Details & Remove */}
        <div className="space-y-8 flex flex-col">
          {/* 1. Item Details Block */}
          <div className="bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800/60">
            {isAdmin ? (
              <form onSubmit={handleSaveStaticDetails} className="space-y-5">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 block">Product Name</label>
                  <input
                    type="text"
                    value={editItemName}
                    onChange={(e) => setEditItemName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-semibold transition-all shadow-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 block">Batch ID</label>
                    <input
                      type="text"
                      value={editBatchNo}
                      onChange={(e) => setEditBatchNo(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm shadow-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 block">Expiry Date</label>
                    <input
                      type="text"
                      value={editExpiryDate}
                      placeholder="YYYY-MM-DD"
                      onChange={(e) => setEditExpiryDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm shadow-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 block">Unit MRP (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={editUnitMrp}
                      onChange={(e) => setEditUnitMrp(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm shadow-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 block">Unit Cost (₹)</label>
                    <input
                      type="number"
                      step="any"
                      value={editUnitCost}
                      onChange={(e) => setEditUnitCost(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm shadow-sm transition-all"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5 block">System Qty</label>
                    <input
                      type="number"
                      value={editSystemQty}
                      onChange={(e) => setEditSystemQty(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm font-mono shadow-sm transition-all"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={auditIsLocked}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <Save className="h-4 w-4" /> Save Details
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <div>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">Product Name</h4>
                  <p className="text-base font-bold text-zinc-900 dark:text-zinc-50">{item.item_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <div>
                    <span className="text-zinc-500 text-xs block mb-0.5">Batch ID</span>
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">{item.batch_no}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-xs block mb-0.5">Expiry Date</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.expiry_date || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-xs block mb-0.5">Pack Size</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.pack_size}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-xs block mb-0.5">Unit MRP</span>
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">₹{item.unit_mrp}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-xs block mb-0.5">Unit Cost</span>
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">₹{item.unit_purchase_rate}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-xs block mb-0.5">System Qty</span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{item.system_qty}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800/60 text-zinc-500 text-xs space-y-1">
                  <div>Location: <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.location} ({item.store_name})</span></div>
                  <div>Supplier: <span className="font-medium text-zinc-700 dark:text-zinc-300">{item.supplier}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* 4. Remove Product (Admin Only) */}
          {isAdmin && (
            <div className="bg-red-50/50 dark:bg-red-950/20 rounded-2xl p-6 border border-red-100 dark:border-red-900/30">
              <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-1">Remove Product</h3>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mb-4 leading-relaxed">
                Permanently removes this product and all associated counts and audit logs from this session.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={auditIsLocked}
                className="w-full flex justify-center items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-800/50 font-medium text-sm text-red-600 dark:text-red-400 bg-white dark:bg-red-950/50 hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors shadow-sm"
              >
                <Trash2 className="h-4 w-4" /> Remove Product Row
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Physical Count & History */}
        <div className="space-y-8 flex flex-col">
          {/* 3. Physical Count Inputs */}
          <div className="bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800/60">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Auditor Physical Count</h3>
            <form onSubmit={handleSaveCount} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Target Auditor Column</label>
                <div className="w-full px-4 py-2.5 rounded-xl text-sm font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50">
                  {myMember?.user_name || roleNamesMap[currentUser.role] || currentUser.role}
                  {myMember && (myMember.status === 'frozen' || myMember.status === 'removed') && (
                    <span className="ml-2 text-[10px] text-rose-500 font-bold uppercase tracking-wide">
                      ({myMember.status})
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Physical Qty Count</label>
                <input
                  type="number"
                  min="0"
                  placeholder="Leave blank to clear"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm shadow-sm transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Remarks</label>
                <input
                  type="text"
                  placeholder="Notes about quality, damaged boxes, etc."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm shadow-sm transition-all"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 font-medium rounded-xl text-sm shadow-sm transition-colors mt-2"
              >
                <Save className="h-4 w-4" />
                Save Count
              </button>
            </form>
          </div>

          {/* 5. Item History (Change Log) */}
          <div className="bg-zinc-50/50 dark:bg-zinc-900/30 rounded-2xl p-6 border border-zinc-100 dark:border-zinc-800/60 flex-1 flex flex-col min-h-[300px]">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-4 w-4 text-zinc-400" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Item Audit Trail</h3>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar -mr-2">
              {isLoadingHistory ? (
                <div className="text-zinc-400 text-sm animate-pulse flex items-center justify-center h-full">Loading history...</div>
              ) : history.length === 0 ? (
                <div className="text-zinc-400 text-sm flex items-center justify-center h-full text-center">
                  No edits recorded yet.<br />Changes will appear here.
                </div>
              ) : (
                <div className="space-y-4">
                  {history.map((log) => {
                    const mappedUser = roleNamesMap[log.user_name] || log.user_name;
                    const formatFieldName = (field) => {
                      if (!field) return '';
                      const match = field.match(/^Auditor Count \(([^)]+)\)$/);
                      if (match) {
                        const slot = match[1];
                        const displayName = roleNamesMap[slot] || slot;
                        return `Auditor Count (${displayName})`;
                      }
                      return field;
                    };
                    const cleanValue = (val) => {
                      if (!val) return '';
                      return val.replace(/\s*\(Exp:[01]\)/ig, '');
                    };

                    return (
                      <div key={log.id} className="relative pl-4 border-l-2 border-zinc-200 dark:border-zinc-800 pb-1">
                        <div className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600 border-2 border-white dark:border-zinc-950"></div>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-xs">{mappedUser}</span>
                          <span className="text-[10px] text-zinc-400">{new Date(log.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })}</span>
                        </div>
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">
                          Updated <span className="font-medium text-zinc-800 dark:text-zinc-200">{formatFieldName(log.field_name)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-zinc-400 line-through">{cleanValue(log.old_value) || '—'}</span>
                          <span className="text-zinc-300 dark:text-zinc-600">→</span>
                          <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-50">{cleanValue(log.new_value) || '—'}</span>
                        </div>
                        {log.reason && (
                          <div className="mt-2 text-[11px] text-zinc-500 bg-white dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 p-2 rounded-lg italic">
                            "{log.reason}"
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Portal */}
      {showDeleteConfirm && ReactDOM.createPortal(
        <div
          style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '16px', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)'
          }}
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '400px', animation: 'dropdown-in 0.2s cubic-bezier(0.2, 0.9, 0.3, 1)',
              background: isDark ? '#18181b' : '#ffffff',
              border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.04)',
              boxShadow: '0 32px 64px rgba(0,0,0,0.2)', borderRadius: '24px', padding: '32px', textAlign: 'center'
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '16px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', color: 'rgb(239, 68, 68)'
            }}>
              <AlertTriangle style={{ width: 26, height: 26 }} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8, color: isDark ? '#fafafa' : '#09090b', letterSpacing: '-0.01em' }}>
              Remove Product
            </h3>
            <p style={{ fontSize: 13, color: isDark ? '#a1a1aa' : '#71717a', marginBottom: 28, lineHeight: 1.5 }}>
              Are you sure you want to delete <strong style={{ color: isDark ? '#fafafa' : '#09090b' }}>{item.item_name}</strong>? This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{
                  flex: 1, padding: '12px 16px', fontSize: 14, fontWeight: 500, borderRadius: '14px',
                  background: isDark ? 'rgba(255,255,255,0.05)' : '#f4f4f5', color: isDark ? '#fafafa' : '#18181b', border: 'none', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                style={{
                  flex: 1, padding: '12px 16px', fontSize: 14, fontWeight: 600, borderRadius: '14px',
                  background: '#ef4444', color: '#ffffff', border: 'none', cursor: isDeleting ? 'not-allowed' : 'pointer'
                }}
              >
                {isDeleting ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
