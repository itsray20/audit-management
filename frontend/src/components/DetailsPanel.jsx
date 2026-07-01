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

  const myMember = auditMembers.find(m => String(m.id) === String(currentUser.id));
  const isFrozenOrRemoved = myMember && (myMember.status === 'frozen' || myMember.status === 'removed');
  const isReadOnly = auditIsLocked || isFrozenOrRemoved;

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

  const isAdmin = currentUser.role === 'Admin';
  // Column-level check: users (including Admin) can only save counts under their own role column
  const canEditSelectedAuditor = String(selectedAuditor) === String(currentUser.id) || (isAdmin && selectedAuditor === 'Admin');

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

      // Default selected auditor to current user ID
      if (!isAdmin) {
        setSelectedAuditor(currentUser.id);
        const existingCount = (item.auditor_counts || []).find(c => String(c.auditor_name) === String(currentUser.id));
        if (existingCount) {
          setPhysicalCount(String(existingCount.physical_count ?? ''));
          setRemarks(existingCount.remarks || '');
        }
      } else {
        setSelectedAuditor('Admin');
        const existingCount = (item.auditor_counts || []).find(c => c.auditor_name === 'Admin');
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
      setError(`You are only authorized to save counts in your own column.`);
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
    <div className="flex flex-col h-full glass overflow-hidden text-xs" style={{ borderLeft: '1px solid var(--glass-border-dim)' }}>
      {/* Drawer Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b bg-zinc-50/20 dark:bg-zinc-900/10" style={{ borderColor: 'var(--glass-border-dim)' }}>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-zinc-950 dark:text-zinc-50 text-sm">Audit Investigation Panel</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-zinc-100/50 dark:hover:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Sticky Alerts / Feedback */}
      {error && (
        <div className="px-6 pt-4">
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-400 rounded-lg p-3 text-xs">
            {error}
          </div>
        </div>
      )}
      {successMsg && (
        <div className="px-6 pt-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-400 rounded-lg p-3 text-xs flex items-center gap-1.5">
            <Check className="h-4 w-4" />
            {successMsg}
          </div>
        </div>
      )}

      {/* Drawer Body Scroll */}
      <div 
        className="flex-1 overflow-y-auto p-6 space-y-4"
        style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
      >

        {/* 1. Item Details Block */}
        <div className="glass rounded-xl p-4 space-y-3">
          {isAdmin ? (
            <form onSubmit={handleSaveStaticDetails} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Product Name</label>
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="w-full mt-1 px-3 py-1.5 glass-input focus:outline-none text-xs font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Batch ID</label>
                  <input
                    type="text"
                    value={editBatchNo}
                    onChange={(e) => setEditBatchNo(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 glass-input focus:outline-none font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Expiry Date</label>
                  <input
                    type="text"
                    value={editExpiryDate}
                    placeholder="YYYY-MM-DD"
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 glass-input focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Unit MRP (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={editUnitMrp}
                    onChange={(e) => setEditUnitMrp(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 glass-input focus:outline-none text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Unit Cost (₹)</label>
                  <input
                    type="number"
                    step="any"
                    value={editUnitCost}
                    onChange={(e) => setEditUnitCost(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 glass-input focus:outline-none text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">System Qty</label>
                  <input
                    type="number"
                    value={editSystemQty}
                    onChange={(e) => setEditSystemQty(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 glass-input focus:outline-none text-xs font-mono"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={auditIsLocked}
                className="w-full py-2 px-3 btn-glass-primary text-xs flex items-center justify-center gap-1.5"
              >
                <Save className="h-3.5 w-3.5" /> Save Product Details
              </button>
            </form>
          ) : (
            <>
              <div>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Product Name</h4>
                <p className="text-sm font-bold text-zinc-950 dark:text-zinc-50">{item.item_name}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-zinc-400">Batch ID:</span>
                  <span className="font-mono ml-1 font-semibold text-zinc-800 dark:text-zinc-200">{item.batch_no}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Expiry Date:</span>
                  <span className="ml-1 font-semibold text-zinc-800 dark:text-zinc-200">{item.expiry_date || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Pack Size:</span>
                  <span className="ml-1 font-semibold text-zinc-800 dark:text-zinc-200">{item.pack_size}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Unit MRP:</span>
                  <span className="font-mono ml-1 font-semibold text-zinc-800 dark:text-zinc-200">₹{item.unit_mrp}</span>
                </div>
                <div>
                  <span className="text-zinc-400">Unit Cost:</span>
                  <span className="font-mono ml-1 font-semibold text-zinc-800 dark:text-zinc-200">₹{item.unit_purchase_rate}</span>
                </div>
                <div>
                  <span className="text-zinc-400">System Qty:</span>
                  <span className="ml-1 font-semibold text-zinc-800 dark:text-zinc-200">{item.system_qty}</span>
                </div>
              </div>
              <div className="pt-2 text-zinc-500 dark:text-zinc-400" style={{ borderTop: '1px solid var(--glass-border-dim)' }}>
                <div>Location: {item.location} ({item.store_name})</div>
                <div>Supplier: {item.supplier}</div>
              </div>
            </>
          )}
        </div>



        {/* 3. Physical Count Inputs */}
        <div className="glass rounded-xl p-4 space-y-4">
          <h3 className="text-xs font-bold text-zinc-950 dark:text-zinc-50">Auditor Physical Count</h3>
          <form onSubmit={handleSaveCount} className="space-y-3">
            {/* Auditor Column Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Target Auditor Column</label>
              <div className="w-full px-3 py-2 rounded-lg text-xs font-bold select-none" style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)' }}>
                {myMember?.name || roleNamesMap[currentUser.role] || currentUser.role}
                {isFrozenOrRemoved && <span className="ml-2 text-[10px] text-rose-500 font-bold uppercase tracking-wide">({myMember?.status})</span>}
              </div>
            </div>

            {/* Count input */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Physical Qty Count</label>
              <input
                type="number"
                min="0"
                placeholder="Leave blank to clear"
                value={physicalCount}
                onChange={(e) => setPhysicalCount(e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-1.5 glass-input focus:outline-none font-mono text-xs disabled:opacity-50"
              />
            </div>

            {/* Remarks */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Remarks</label>
              <input
                type="text"
                placeholder="Notes about quality, damaged boxes, etc."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-1.5 glass-input focus:outline-none text-xs disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isReadOnly}
              className="w-full flex justify-center items-center gap-2 px-3 py-2 btn-glass-primary text-xs disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              Save Count
            </button>
          </form>
        </div>

        {/* 4. Remove Product (Admin Only) */}
        {isAdmin && (
          <div className="glass rounded-xl p-4 space-y-3" style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: isDark ? 'rgba(239, 68, 68, 0.03)' : 'rgba(239, 68, 68, 0.01)' }}>
            <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400">Remove Product</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
              Permanently removes this product and all associated counts and audit logs from this session.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={auditIsLocked}
              className="w-full flex justify-center items-center gap-2 px-3 py-2.5 rounded-xl border font-semibold text-xs transition-colors cursor-pointer"
              style={{
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: 'rgb(239, 68, 68)',
                background: 'rgba(239, 68, 68, 0.06)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)'}
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove Product Row
            </button>
          </div>
        )}

        {/* Delete Confirmation Portal — renders at document.body to escape sidebar constraints */}
        {showDeleteConfirm && ReactDOM.createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: '16px',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
            onClick={() => setShowDeleteConfirm(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '420px',
                animation: 'dropdown-in 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
                background: isDark ? '#1c1c1e' : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.35)',
                borderRadius: '22px',
                padding: '32px 28px 28px',
                textAlign: 'center'
              }}
            >
              {/* Warning Icon */}
              <div style={{
                width: 60, height: 60,
                borderRadius: '18px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                color: 'rgb(239, 68, 68)'
              }}>
                <AlertTriangle style={{ width: 28, height: 28 }} />
              </div>

              <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: isDark ? '#f4f4f5' : '#111827', letterSpacing: '-0.02em' }}>
                Remove Product Row
              </h3>
              <p style={{ fontSize: 12, color: isDark ? '#a1a1aa' : '#6b7280', marginBottom: 24, lineHeight: 1.6 }}>
                Are you sure you want to delete{' '}
                <strong style={{ color: isDark ? '#f4f4f5' : '#111827' }}>{item.item_name}</strong>?
                {' '}This is irreversible and will permanently remove all auditor counts and audit trail entries for this product.
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    flex: 1, padding: '11px 16px',
                    fontSize: 13, fontWeight: 600, borderRadius: 12,
                    border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid #e4e4e7',
                    color: isDark ? '#a1a1aa' : '#52525b',
                    background: 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : '#f4f4f5'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProduct}
                  disabled={isDeleting}
                  style={{
                    flex: 1, padding: '11px 16px',
                    fontSize: 13, fontWeight: 700, borderRadius: 12,
                    border: 'none',
                    color: '#ffffff',
                    background: isDeleting ? 'rgba(239,68,68,0.5)' : 'linear-gradient(180deg, #f87171 0%, #dc2626 100%)',
                    boxShadow: isDeleting ? 'none' : '0 2px 12px rgba(220,38,38,0.4)',
                    cursor: isDeleting ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    transition: 'all 0.15s'
                  }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                  {isDeleting ? 'Removing...' : 'Remove Product'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}



        {/* 5. Item History (Change Log) */}
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <History className="h-4 w-4 text-zinc-400" />
            <h3 className="text-xs font-bold text-zinc-950 dark:text-zinc-50">Item Audit Trail</h3>
          </div>
          {isLoadingHistory ? (
            <div className="text-zinc-500 dark:text-zinc-400 animate-pulse">Loading item log...</div>
          ) : history.length === 0 ? (
            <div className="text-zinc-500 dark:text-zinc-400">No edits recorded for this item yet.</div>
          ) : (
            <div className="space-y-3 divide-y divide-zinc-100 dark:divide-zinc-800/40">
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
                  <div key={log.id} className="pt-2 space-y-1">
                    <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-550">
                      <span className="font-semibold text-zinc-600 dark:text-zinc-350">{mappedUser}</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 dark:text-zinc-500">Field:</span>{' '}
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">{formatFieldName(log.field_name)}</span>
                    </div>
                    <div className="flex gap-2">
                      <div>
                        <span className="text-zinc-400 dark:text-zinc-500">Old:</span>{' '}
                        <span className="font-mono text-zinc-800 dark:text-zinc-300">{cleanValue(log.old_value) || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 dark:text-zinc-500">New:</span>{' '}
                        <span className="font-mono text-zinc-950 dark:text-zinc-50 font-semibold">{cleanValue(log.new_value) || 'N/A'}</span>
                      </div>
                    </div>
                    {log.reason && (
                      <div className="italic text-zinc-500 text-[11px] bg-zinc-50 dark:bg-zinc-900/50 p-1.5 rounded">
                        Reason: "{log.reason}"
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
  );
}
