import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, CheckCircle2, Lock, PackagePlus, ChevronRight, ChevronDown, ArrowLeft, Hash, Calendar, DollarSign, Package } from 'lucide-react';

export default function ExtraFoundForm({ sessionId, currentUser, auditIsLocked, onSuccess }) {
  const [masterItems, setMasterItems] = useState([]);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [allowCustomName, setAllowCustomName] = useState(false);
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [unitMrp, setUnitMrp] = useState('');
  const [unitPurchaseRate, setUnitPurchaseRate] = useState('');
  const [physicalCount, setPhysicalCount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (sessionId) fetchMasterItems();
  }, [sessionId]);

  const fetchMasterItems = async () => {
    try {
      const response = await axios.get(`/api/audits/${sessionId}/items?limit=1000`);
      const names = [...new Set((response.data.items || []).map(i => i.item_name))].sort();
      setMasterItems(names);
    } catch (err) {
      console.error('Failed to load master items:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (auditIsLocked) { setError('This audit session is completed and locked.'); return; }

    const itemName = allowCustomName ? customItemName : selectedItemName;
    if (!itemName) { setError('Please select or enter an Item Name.'); return; }
    if (!batchNo) { setError('Batch Number is required.'); return; }
    if (!unitPurchaseRate || Number(unitPurchaseRate) <= 0) { setError('A valid unit purchase rate is required.'); return; }
    const countNum = parseInt(physicalCount);
    if (isNaN(countNum) || countNum <= 0) { setError('Physical count must be greater than 0.'); return; }

    setIsLoading(true);
    try {
      const itemRes = await axios.post(`/api/audits/${sessionId}/items`, {
        item_name: itemName,
        batch_no: batchNo,
        expiry_date: expiryDate,
        unit_mrp: Number(unitMrp || 0),
        unit_purchase_rate: Number(unitPurchaseRate),
        system_qty: 0,
        supplier: '',
        location: '',
        store_name: '',
        notes: 'Extra Found (Logged manually)'
      });
      const newItem = itemRes.data;
      await axios.put(`/api/items/${newItem.id}/count`, {
        auditor_name: currentUser.role,
        physical_count: countNum,
        expiry_check: false,
        remarks: 'Extra found physical entry'
      });

      setSuccessMsg(`"${itemName}" registered with ${countNum} units successfully!`);
      setSelectedItemName(''); setCustomItemName(''); setBatchNo('');
      setExpiryDate(''); setUnitMrp(''); setUnitPurchaseRate(''); setPhysicalCount('');
      if (onSuccess) onSuccess();
      fetchMasterItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register Extra Found item.');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldLabel = "block text-[10px] font-bold uppercase tracking-wider mb-1.5";
  const fieldInput = "glass-input w-full px-3 py-2.5 rounded-xl text-xs focus:outline-none";

  return (
    <div className="w-full mx-auto space-y-4" style={{ maxWidth: '720px' }}>

      {/* Header Card */}
      <div className="panel-card rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl" style={{ background: 'linear-gradient(135deg, #34C759, #30d158)', boxShadow: '0 4px 16px rgba(52,199,89,0.35)' }}>
            <PackagePlus className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Log Extra Found Item</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Register stock found physically but absent from the system inventory.
            </p>
          </div>
        </div>
      </div>

      {/* Lock Banner */}
      {auditIsLocked && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-medium"
          style={{ background: 'rgba(255,149,0,0.08)', borderColor: 'rgba(255,149,0,0.25)', color: '#FF9500' }}>
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>This audit session is <strong>Completed & Locked</strong>. Logging new items is disabled.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-medium"
          style={{ background: 'rgba(255,59,48,0.07)', borderColor: 'rgba(255,59,48,0.22)', color: '#FF3B30' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {successMsg && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-medium"
          style={{ background: 'rgba(52,199,89,0.08)', borderColor: 'rgba(52,199,89,0.25)', color: '#34C759' }}>
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {/* Form Card */}
      <div className="panel-card rounded-2xl overflow-hidden">
        <form onSubmit={handleSubmit}>

          {/* ── Section 1: Item Identification ── */}
          <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: 'var(--glass-border-dim)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Item Identification</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Item Name</label>
                <button
                  type="button"
                  onClick={() => setAllowCustomName(!allowCustomName)}
                  className="flex items-center gap-1 text-[10px] font-semibold transition-colors"
                  style={{ color: 'var(--accent)' }}
                >
                  {allowCustomName
                    ? <><ArrowLeft className="h-2.5 w-2.5" /> Select from list</>
                    : <>Enter custom name <ChevronRight className="h-2.5 w-2.5" /></>
                  }
                </button>
              </div>

              {allowCustomName ? (
                <input
                  type="text"
                  placeholder="Type item name..."
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className={fieldInput}
                  style={{ color: 'var(--text-primary)' }}
                />
              ) : (
                <div className="relative">
                  <select
                    value={selectedItemName}
                    onChange={(e) => setSelectedItemName(e.target.value)}
                    className={fieldInput}
                    style={{
                      color: 'var(--text-primary)',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      MozAppearance: 'none',
                      paddingRight: '2.25rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">— Select Predefined Item Name —</option>
                    {masterItems.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <ChevronDown
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                    style={{ color: 'var(--text-tertiary)' }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── Section 2: Batch & Expiry ── */}
          <div className="px-5 pt-4 pb-4 border-b" style={{ borderColor: 'var(--glass-border-dim)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Hash className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Batch & Expiry</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Batch Number <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="e.g. B23490"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className={`${fieldInput} font-mono`}
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Expiry Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--text-tertiary)' }} />
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className={`${fieldInput} pl-9`}
                    style={{ color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Rates & Count ── */}
          <div className="px-5 pt-4 pb-5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Pricing & Count</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Unit MRP (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={unitMrp}
                  onChange={(e) => setUnitMrp(e.target.value)}
                  className={`${fieldInput} font-mono`}
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Purchase Cost (₹) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={unitPurchaseRate}
                  onChange={(e) => setUnitPurchaseRate(e.target.value)}
                  className={`${fieldInput} font-mono`}
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Physical Qty <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={physicalCount}
                  onChange={(e) => setPhysicalCount(e.target.value)}
                  className={`${fieldInput} font-mono font-bold text-center`}
                  style={{ color: 'var(--text-primary)' }}
                />
              </div>
            </div>

            {/* Preview pill — shows estimated value if all fields filled */}
            {unitPurchaseRate && physicalCount && Number(unitPurchaseRate) > 0 && Number(physicalCount) > 0 && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <span className="text-[10px] font-semibold px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(52,199,89,0.10)', color: '#34C759', border: '1px solid rgba(52,199,89,0.25)' }}>
                  Estimated Value: ₹{(Number(unitPurchaseRate) * Number(physicalCount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="px-5 pb-5">
            <button
              type="submit"
              disabled={isLoading || auditIsLocked}
              className="w-full flex justify-center items-center gap-2 px-4 py-3 font-semibold rounded-xl text-xs transition-all disabled:opacity-40"
              style={{
                background: isLoading || auditIsLocked ? undefined : 'linear-gradient(135deg, #34C759, #30d158)',
                backgroundColor: isLoading || auditIsLocked ? 'rgba(52,199,89,0.15)' : undefined,
                color: isLoading || auditIsLocked ? '#34C759' : '#ffffff',
                border: '1px solid rgba(52,199,89,0.3)',
                boxShadow: isLoading || auditIsLocked ? 'none' : '0 4px 16px rgba(52,199,89,0.35)'
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {isLoading ? 'Saving...' : 'Register Extra Found Item'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
