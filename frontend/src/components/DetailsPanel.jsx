import React, { useState, useEffect } from 'react';
import { X, Lock, Unlock, Check, History, Save } from 'lucide-react';
import axios from 'axios';

export default function DetailsPanel({ 
  item, 
  currentUser, 
  onClose, 
  onUpdate 
}) {
  const [selectedAuditor, setSelectedAuditor] = useState('');
  const [physicalCount, setPhysicalCount] = useState('');
  const [expiryCheck, setExpiryCheck] = useState(false);
  const [remarks, setRemarks] = useState('');
  
  const [manualAdd, setManualAdd] = useState('0');
  const [manualRecheck, setManualRecheck] = useState('0');
  const [notes, setNotes] = useState('');
  const [changeReason, setChangeReason] = useState('');
  
  const [history, setHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Roles
  const isManagerOrAdmin = currentUser.role === 'Admin' || currentUser.role === 'Audit Manager';

  // Initialize panel values when item changes
  useEffect(() => {
    if (item) {
      setManualAdd(String(item.manual_add || '0'));
      setManualRecheck(String(item.manual_recheck || '0'));
      setNotes(item.notes || '');
      setPhysicalCount('');
      setExpiryCheck(false);
      setRemarks('');
      setSuccessMsg('');
      setError('');
      setChangeReason('');
      fetchItemHistory();
      
      // Default selected auditor to current user if they are an Auditor
      if (currentUser.role === 'Auditor') {
        setSelectedAuditor(currentUser.name);
        const existingCount = (item.counts || []).find(c => c.auditor_name === currentUser.name);
        if (existingCount) {
          setPhysicalCount(String(existingCount.physical_count));
          setExpiryCheck(existingCount.expiry_check === 1);
          setRemarks(existingCount.remarks || '');
        }
      } else {
        setSelectedAuditor('');
      }
    }
  }, [item, currentUser]);

  const fetchItemHistory = async () => {
    if (!item) return;
    setIsLoadingHistory(true);
    try {
      // We can fetch from general trail route and filter on client, or write server route.
      // General trail is fine, or we filter in memory
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
    const existingCount = (item.counts || []).find(c => c.auditor_name === auditorName);
    if (existingCount) {
      setPhysicalCount(String(existingCount.physical_count));
      setExpiryCheck(existingCount.expiry_check === 1);
      setRemarks(existingCount.remarks || '');
    } else {
      setPhysicalCount('');
      setExpiryCheck(false);
      setRemarks('');
    }
  };

  const handleSaveCount = async (e) => {
    e.preventDefault();
    if (!selectedAuditor) {
      setError('Please select or specify an auditor name.');
      return;
    }
    if (physicalCount === '') {
      setError('Physical count cannot be blank.');
      return;
    }
    const countNum = parseInt(physicalCount);
    if (isNaN(countNum) || countNum < 0) {
      setError('Physical count cannot be negative.');
      return;
    }

    try {
      await axios.post(`/api/items/${item.id}/counts`, {
        auditor_name: selectedAuditor,
        physical_count: countNum,
        expiry_check: expiryCheck,
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

  const handleSaveAdjustments = async (e) => {
    e.preventDefault();
    const addNum = parseInt(manualAdd);
    const recheckNum = parseInt(manualRecheck);

    if (isNaN(addNum) || isNaN(recheckNum)) {
      setError('Adjustments must be valid integers.');
      return;
    }

    if ((addNum !== (item.manual_add || 0) || recheckNum !== (item.manual_recheck || 0) || notes !== (item.notes || '')) && !changeReason) {
      setError('A reason for change is required to save adjustments.');
      return;
    }

    try {
      await axios.put(`/api/items/${item.id}`, {
        manual_add: addNum,
        manual_recheck: recheckNum,
        notes: notes,
        user_name: currentUser.name,
        reason: changeReason || 'Direct adjustments update'
      });
      setSuccessMsg('Adjustments saved successfully.');
      setError('');
      setChangeReason('');
      onUpdate();
      fetchItemHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save adjustments.');
    }
  };

  const handleLockToggle = async () => {
    const nextLockState = item.is_locked === 0;
    
    if (!changeReason) {
      setError('Please specify a reason for locking/unlocking.');
      return;
    }

    try {
      await axios.post(`/api/items/${item.id}/lock`, {
        is_locked: nextLockState,
        user_name: currentUser.name,
        reason: changeReason
      });
      setSuccessMsg(`Row successfully ${nextLockState ? 'locked' : 'unlocked'}.`);
      setError('');
      setChangeReason('');
      onUpdate();
      fetchItemHistory();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle lock state.');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#0c0c0f] border-l border-zinc-200 dark:border-zinc-800 shadow-xl overflow-hidden">
      {/* Drawer Header */}
      <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
        <div className="flex items-center gap-2">
          {item.is_locked === 1 ? (
            <Lock className="h-5 w-5 text-rose-500" />
          ) : (
            <Unlock className="h-5 w-5 text-zinc-400" />
          )}
          <span className="font-semibold text-zinc-950 dark:text-zinc-50">Audit Investigation Panel</span>
        </div>
        <button 
          onClick={onClose} 
          className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Sticky Alerts / Feedback */}
      {error && (
        <div className="px-6 pt-4">
          <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-400 rounded-lg p-3 text-sm">
            {error}
          </div>
        </div>
      )}
      {successMsg && (
        <div className="px-6 pt-4">
          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-400 rounded-lg p-3 text-sm flex items-center gap-1.5">
            <Check className="h-4 w-4" />
            {successMsg}
          </div>
        </div>
      )}

      {/* Drawer Body Scroll */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* 1. Item Details Block */}
        <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60 rounded-xl p-4 space-y-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Item Name</h4>
            <p className="text-sm font-bold text-zinc-950 dark:text-zinc-50">{item.item_name}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-zinc-400">Batch No:</span>
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
              <span className="text-zinc-400">Unit Purchase Cost:</span>
              <span className="font-mono ml-1 font-semibold text-zinc-800 dark:text-zinc-200">₹{item.unit_purchase_rate}</span>
            </div>
            <div>
              <span className="text-zinc-400">System Qty:</span>
              <span className="ml-1 font-semibold text-zinc-800 dark:text-zinc-200">{item.system_qty}</span>
            </div>
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-800/60 pt-2 text-xs text-zinc-500">
            <div>Location: {item.location} ({item.store_name})</div>
            <div>Supplier: {item.supplier}</div>
          </div>
        </div>

        {/* 2. Lock / Unlock (Managers & Admins only) */}
        {isManagerOrAdmin && (
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 bg-zinc-50/20">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Row Editing State</h3>
            <p className="text-xs text-zinc-500">
              Locking a row prevents data entry operators and auditors from changing entries. 
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleLockToggle}
                className={`flex-1 flex justify-center items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg shadow-sm border text-white transition-colors ${
                  item.is_locked === 1 
                    ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-700' 
                    : 'bg-rose-600 hover:bg-rose-700 border-rose-700'
                }`}
              >
                {item.is_locked === 1 ? (
                  <>
                    <Unlock className="h-3.5 w-3.5" />
                    Unlock Row
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Lock Row
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Reason field (shared for adjustments / locks) */}
        {(isManagerOrAdmin || item.is_locked === 0) && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-500">Reason / Change Justification (Required for adjustments & locks)</label>
            <input
              type="text"
              placeholder="e.g. Verified count physically / Recheck requested"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-50"
            />
          </div>
        )}

        {/* 3. Physical Count Inputs */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Auditor Physical Count</h3>
          {item.is_locked === 1 ? (
            <div className="text-xs text-rose-500 bg-rose-50/50 dark:bg-rose-950/10 p-2.5 rounded border border-rose-100 dark:border-rose-900/20">
              This item has been locked. Auditor counts cannot be recorded.
            </div>
          ) : (
            <form onSubmit={handleSaveCount} className="space-y-3">
              {/* Auditor Name Dropdown */}
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Auditor Name</label>
                <select
                  value={selectedAuditor}
                  onChange={(e) => handleAuditorChange(e.target.value)}
                  disabled={currentUser.role === 'Auditor'}
                  className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-50"
                >
                  <option value="">-- Select Auditor --</option>
                  <option value="Sri">Sri</option>
                  <option value="Sravani">Sravani</option>
                  <option value="Sanathu">Sanathu</option>
                  <option value="Sha">Sha</option>
                  <option value="Extra Count">Extra Count</option>
                </select>
              </div>

              {/* Count input */}
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Physical Qty Count</label>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-50 font-mono"
                />
              </div>

              {/* Expiry Flag */}
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="expiry_flag"
                  checked={expiryCheck}
                  onChange={(e) => setExpiryCheck(e.target.checked)}
                  className="rounded text-blue-500 focus:ring-blue-500 border-zinc-300"
                />
                <label htmlFor="expiry_flag" className="text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  Flag as Expired / Near Expiry
                </label>
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="text-xs text-zinc-500">Auditor Remarks</label>
                <input
                  type="text"
                  placeholder="Notes about quality, damaged boxes, etc."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-50"
                />
              </div>

              <button
                type="submit"
                className="w-full flex justify-center items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 border border-blue-700 text-white shadow-sm transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Save Count
              </button>
            </form>
          )}
        </div>

        {/* 4. Adjustments Form (Add/Recheck - Manager/Admin/DEO) */}
        {isManagerOrAdmin && (
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Manual Adjustments</h3>
            {item.is_locked === 1 ? (
              <div className="text-xs text-rose-500 bg-rose-50/50 dark:bg-rose-950/10 p-2.5 rounded border border-rose-100 dark:border-rose-900/20">
                This item is locked. Lock must be released before making adjustments.
              </div>
            ) : (
              <form onSubmit={handleSaveAdjustments} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Manual Add Qty</label>
                    <input
                      type="number"
                      value={manualAdd}
                      onChange={(e) => setManualAdd(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-50 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Manual Recheck Qty</label>
                    <input
                      type="number"
                      value={manualRecheck}
                      onChange={(e) => setManualRecheck(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-50 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-500">General Notes</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-zinc-500">Reason / Change Justification (Required for adjustments)</label>
                  <input
                    type="text"
                    placeholder="e.g. Verified count mismatch / Notes updated"
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-zinc-950 dark:text-zinc-50"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex justify-center items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-700 text-white shadow-sm transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Adjustments
                </button>
              </form>
            )}
          </div>
        )}

        {/* 5. Item History (Change Log) */}
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <History className="h-4 w-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Item Audit Trail</h3>
          </div>
          {isLoadingHistory ? (
            <div className="text-xs text-zinc-500 animate-pulse">Loading item log...</div>
          ) : history.length === 0 ? (
            <div className="text-xs text-zinc-500">No edits recorded for this item yet.</div>
          ) : (
            <div className="space-y-3 divide-y divide-zinc-100 dark:divide-zinc-800/40">
              {history.map((log) => (
                <div key={log.id} className="pt-2 text-xs space-y-1">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span className="font-semibold text-zinc-600 dark:text-zinc-300">{log.user_name}</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Field:</span>{' '}
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{log.field_name}</span>
                  </div>
                  <div className="flex gap-2">
                    <div>
                      <span className="text-zinc-400">Old:</span>{' '}
                      <span className="font-mono text-zinc-800 dark:text-zinc-300">{log.old_value || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">New:</span>{' '}
                      <span className="font-mono text-zinc-950 dark:text-zinc-50 font-semibold">{log.new_value || 'N/A'}</span>
                    </div>
                  </div>
                  {log.reason && (
                    <div className="italic text-zinc-500 text-[11px] bg-zinc-50 dark:bg-zinc-900/50 p-1.5 rounded">
                      Reason: "{log.reason}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
