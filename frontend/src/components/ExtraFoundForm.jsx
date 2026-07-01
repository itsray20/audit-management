import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, CheckCircle2, Lock, PackagePlus, ChevronRight, ChevronLeft, ChevronDown, ArrowLeft, Hash, Calendar, DollarSign, Package } from 'lucide-react';

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEK_DAYS = ["S", "M", "T", "W", "T", "F", "S"];

const formatToDMY = (dateStr) => {
  if (!dateStr) return '';
  const normalized = dateStr.replace(/[\/\.\s]/g, '-');
  const parts = normalized.split('-');
  if (parts.length === 3) {
    if (parts[2].length === 4) return normalized; // Already DD-MM-YYYY
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return normalized;
};

const formatToYMD = (dateStr) => {
  if (!dateStr) return '';
  const normalized = dateStr.replace(/[\/\.\s]/g, '-');
  const parts = normalized.split('-');
  if (parts.length === 3) {
    if (parts[0].length === 4) return normalized; // Already YYYY-MM-DD
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return normalized;
};

const getExpiryValidationError = (dateStr) => {
  if (!dateStr) return '';
  const cleaned = dateStr.replace(/[^0-9\-]/g, '');
  
  // Check day part
  if (cleaned.length >= 2) {
    const day = parseInt(cleaned.slice(0, 2), 10);
    if (day === 0 || day > 31) {
      return 'Invalid day (must be 01-31)';
    }
  }
  
  // Check month part
  if (cleaned.length >= 5) {
    const month = parseInt(cleaned.slice(3, 5), 10);
    if (month === 0 || month > 12) {
      return 'Invalid month (must be 01-12)';
    }
  }

  // Check complete format
  if (cleaned.length === 10) {
    const dmyRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;
    if (!dmyRegex.test(cleaned)) {
      return 'Invalid date format (DD-MM-YYYY)';
    }
  }
  
  return '';
};

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

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());

  const isDark = document.documentElement.classList.contains('dark');
  const valError = getExpiryValidationError(expiryDate);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (showDatePicker && !e.target.closest('.apple-datepicker-container')) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [showDatePicker]);

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

    if (expiryDate) {
      const dmyRegex = /^(0[1-9]|[12][0-9]|3[01])-(0[1-9]|1[0-2])-\d{4}$/;
      if (!dmyRegex.test(expiryDate)) {
        setError('Expiry date must be a valid date in DD-MM-YYYY format (e.g., 30-06-2026).');
        return;
      }
    }

    setIsLoading(true);
    try {
      const itemRes = await axios.post(`/api/audits/${sessionId}/items`, {
        item_name: itemName,
        batch_no: batchNo,
        expiry_date: formatToYMD(expiryDate),
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
        auditor_name: currentUser.id ? String(currentUser.id) : currentUser.role,
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
      <div className="panel-card rounded-2xl">
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
              <div className="apple-datepicker-container relative">
                <label className={fieldLabel} style={{ color: 'var(--text-tertiary)' }}>Expiry Date</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="DD-MM-YYYY"
                    value={expiryDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      const cleaned = val.replace(/[^0-9\-]/g, '');
                      
                      // If deleting, set value directly and skip formatting
                      if (cleaned.length < expiryDate.length) {
                        setExpiryDate(cleaned);
                        return;
                      }
                      
                      // Strip all existing dashes to re-format dynamically
                      const digits = cleaned.replace(/\-/g, '');
                      let formatted = '';
                      if (digits.length <= 2) {
                        formatted = digits;
                      } else if (digits.length <= 4) {
                        formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
                      } else {
                        formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
                      }
                      setExpiryDate(formatted);
                    }}
                    className={`${fieldInput} pr-10 ${valError ? '!border-rose-500 !ring-rose-500 !focus:border-rose-500 !focus:ring-rose-500' : ''}`}
                    style={{ 
                      color: 'var(--text-primary)',
                      borderColor: valError ? '#FF3B30' : undefined,
                      boxShadow: valError ? '0 0 0 1px rgba(255,59,48,0.25)' : undefined 
                    }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDatePicker(!showDatePicker);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center justify-center cursor-pointer"
                  >
                    <Calendar className="h-4 w-4" />
                  </button>
                </div>
                {valError && (
                  <span className="text-[10px] text-rose-500 font-semibold mt-1 block">
                    {valError}
                  </span>
                )}

                {showDatePicker && (() => {
                  const firstDayIdx = new Date(pickerYear, pickerMonth, 1).getDay();
                  const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
                  const prevMonthDays = new Date(pickerYear, pickerMonth, 0).getDate();

                  const cells = [];
                  for (let i = firstDayIdx - 1; i >= 0; i--) {
                    const pmYear = pickerMonth === 0 ? pickerYear - 1 : pickerYear;
                    const pmMonth = pickerMonth === 0 ? 12 : pickerMonth;
                    cells.push({
                      day: prevMonthDays - i,
                      isCurrentMonth: false,
                      dateStr: `${pmYear}-${String(pmMonth).padStart(2, '0')}-${String(prevMonthDays - i).padStart(2, '0')}`
                    });
                  }
                  for (let i = 1; i <= daysInMonth; i++) {
                    cells.push({
                      day: i,
                      isCurrentMonth: true,
                      dateStr: `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
                    });
                  }
                  const remaining = (7 - (cells.length % 7)) % 7;
                  for (let i = 1; i <= remaining; i++) {
                    const nmYear = pickerMonth === 11 ? pickerYear + 1 : pickerYear;
                    const nmMonth = pickerMonth === 11 ? 1 : pickerMonth + 2;
                    cells.push({
                      day: i,
                      isCurrentMonth: false,
                      dateStr: `${nmYear}-${String(nmMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
                    });
                  }

                  const handlePrevMonth = (e) => {
                    e.stopPropagation();
                    if (pickerMonth === 0) {
                      setPickerMonth(11);
                      setPickerYear(y => y - 1);
                    } else {
                      setPickerMonth(m => m - 1);
                    }
                  };

                  const handleNextMonth = (e) => {
                    e.stopPropagation();
                    if (pickerMonth === 11) {
                      setPickerMonth(0);
                      setPickerYear(y => y + 1);
                    } else {
                      setPickerMonth(m => m + 1);
                    }
                  };

                  const handleSelectDate = (dateStr, e) => {
                    e.stopPropagation();
                    setExpiryDate(formatToDMY(dateStr));
                    setShowDatePicker(false);
                  };

                  const todayStr = new Date().toISOString().split('T')[0];

                  return (
                    <div
                      className="absolute right-0 mb-2 z-50 rounded-2xl p-4 shadow-xl border animate-dropdown-in"
                      style={{
                        width: '280px',
                        background: isDark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.98)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
                        bottom: '100%',
                        boxSizing: 'border-box'
                      }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-zinc-900 dark:text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif' }}>
                          {MONTH_NAMES[pickerMonth]} {pickerYear}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer flex items-center justify-center transition-colors"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 cursor-pointer flex items-center justify-center transition-colors"
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
                        {WEEK_DAYS.map((wd, idx) => (
                          <span key={idx} className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">
                            {wd}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center">
                        {cells.map((cell, idx) => {
                          const isSelected = expiryDate === formatToDMY(cell.dateStr);
                          const isToday = todayStr === cell.dateStr;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={(e) => handleSelectDate(cell.dateStr, e)}
                              className="aspect-square flex items-center justify-center text-[11px] font-semibold rounded-full cursor-pointer relative transition-all"
                              style={{
                                color: isSelected 
                                  ? '#ffffff' 
                                  : cell.isCurrentMonth 
                                    ? 'var(--text-primary)' 
                                    : 'var(--text-tertiary)',
                                background: isSelected 
                                  ? '#007AFF' 
                                  : 'transparent',
                                border: isToday && !isSelected 
                                  ? '1px solid #007AFF' 
                                  : 'none',
                              }}
                            >
                              {cell.day}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
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
