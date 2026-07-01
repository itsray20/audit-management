import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, CheckCircle2, Lock, PackagePlus, ChevronRight, ChevronLeft, ChevronDown, ArrowLeft, Hash, Calendar, DollarSign, Package, Search, X } from 'lucide-react';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [showItemDropdown, setShowItemDropdown] = useState(false);

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

  const fieldInputClass = "w-full px-4 py-3 rounded-[16px] text-[13px] font-medium transition-all outline-none border border-transparent focus:border-green-500 focus:ring-4 focus:ring-green-500/10";
  const fieldLabelClass = "block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-2 tracking-wide";
  const cardStyle = {
    background: isDark ? 'rgba(28,28,30,0.6)' : 'rgba(255,255,255,0.7)',
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
    boxShadow: isDark ? '0 16px 32px rgba(0,0,0,0.2)' : '0 16px 32px rgba(0,0,0,0.04)'
  };
  const inputBgStyle = {
    background: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.03)',
    color: 'var(--text-primary)'
  };

  const groupedContainerStyle = {
    background: isDark ? 'rgba(28,28,30,0.5)' : '#ffffff',
    borderRadius: '12px',
    border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
    boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.02), 0 10px 24px rgba(0,0,0,0.02)'
  };
  const rowStyle = "flex flex-col md:flex-row md:items-center justify-between p-4 px-5 border-b last:border-b-0";
  const labelStyle = "text-[16px] text-zinc-900 dark:text-white mb-2 md:mb-0 shrink-0";
  const inputWrapperStyle = "w-full md:w-2/3 flex items-center justify-end relative";
  const appleInputStyle = "w-full text-right outline-none bg-transparent text-[16px] text-zinc-500 dark:text-zinc-400 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 focus:text-zinc-900 dark:focus:text-white transition-colors";

  return (
    <div className="w-full mx-auto" style={{ maxWidth: '1400px' }}>

      {/* Lock Banner */}
      {auditIsLocked && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border text-[13px] font-medium mb-6 shadow-sm backdrop-blur-md"
          style={{ background: 'rgba(255,149,0,0.08)', borderColor: 'rgba(255,149,0,0.25)', color: '#FF9500' }}>
          <Lock className="h-4 w-4 flex-shrink-0" />
          <span>This audit session is <strong>Completed & Locked</strong>. Logging new items is disabled.</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border text-[13px] font-medium mb-6 shadow-sm backdrop-blur-md"
          style={{ background: 'rgba(255,59,48,0.07)', borderColor: 'rgba(255,59,48,0.22)', color: '#FF3B30' }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {successMsg && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl border text-[13px] font-medium mb-6 shadow-sm backdrop-blur-md"
          style={{ background: 'rgba(52,199,89,0.08)', borderColor: 'rgba(52,199,89,0.25)', color: '#34C759' }}>
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto mt-2" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "SF Pro", "Helvetica Neue", sans-serif' }}>
        <div className="panel-card p-6 overflow-visible">
          
          {/* Form Header */}
          <div className="flex items-center justify-between pb-4 border-b border-zinc-100 dark:border-zinc-800/80 mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" 
                   style={{ background: 'linear-gradient(135deg, #34C759, #30d158)' }}>
                <PackagePlus className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-black text-black dark:text-white tracking-tight">
                  Log Extra Found
                </h2>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Register items found physically but missing from the system.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {unitPurchaseRate && physicalCount && Number(unitPurchaseRate) > 0 && Number(physicalCount) > 0 && (
                <div className="hidden sm:flex items-center h-8 px-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-black dark:text-white border border-zinc-200/55 dark:border-zinc-700/50">
                  Total Value: ₹{(Number(unitPurchaseRate) * Number(physicalCount)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              )}
              <button
                type="submit"
                disabled={isLoading || auditIsLocked}
                className="h-8 px-4 flex items-center gap-1.5 font-bold rounded-lg text-[11px] transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                style={{
                  background: 'linear-gradient(135deg, #34C759, #30d158)',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(52,199,89,0.2)',
                  border: 'none'
                }}
              >
                <Save className="h-3.5 w-3.5" />
                {isLoading ? 'Saving...' : 'Add Item'}
              </button>
            </div>
          </div>

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 text-left">
            
            {/* Column 1: Identification */}
            <div className="space-y-4">
              
              {/* Product Name */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-black dark:text-zinc-100">Product Name</label>
                  <button
                    type="button"
                    onClick={() => setAllowCustomName(!allowCustomName)}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                  >
                    {allowCustomName ? "Select Predefined" : "Enter Custom Name"}
                  </button>
                </div>
                {allowCustomName ? (
                  <input 
                    type="text" 
                    placeholder="Enter custom product name..." 
                    value={customItemName} 
                    onChange={e => setCustomItemName(e.target.value)} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-black dark:text-white font-medium"
                    style={{ fontFamily: 'inherit' }}
                  />
                ) : (
                  <div 
                    onClick={() => setShowItemDropdown(true)} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none flex items-center justify-between cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-all select-none"
                  >
                    <span className={selectedItemName ? 'text-black dark:text-white font-semibold' : 'text-zinc-400'}>
                      {selectedItemName || 'Select a product...'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-zinc-400" />
                  </div>
                )}
              </div>

              {/* Category / Notes */}
              <div>
                <label className="text-xs font-bold text-black dark:text-zinc-100 mb-1.5 block">Category / Notes</label>
                <input 
                  type="text" 
                  value="Logged manually as Extra Found" 
                  disabled 
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none bg-zinc-50/50 dark:bg-zinc-900/30 opacity-70 text-zinc-400 dark:text-zinc-500 cursor-not-allowed select-none font-medium"
                  style={{ fontFamily: 'inherit' }}
                />
              </div>

            </div>

            {/* Column 2: Details & Financials */}
            <div className="space-y-4">
              
              <div className="grid grid-cols-2 gap-4">
                {/* Batch Number */}
                <div>
                  <label className="text-xs font-bold text-black dark:text-zinc-100 mb-1.5 block">Batch Number</label>
                  <input 
                    type="text" 
                    placeholder="e.g. B23490" 
                    value={batchNo} 
                    onChange={e => setBatchNo(e.target.value)} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none font-mono focus:ring-1 focus:ring-blue-500/50 text-black dark:text-white font-medium"
                    style={{ fontFamily: 'inherit' }}
                  />
                </div>

                {/* Expiry Date */}
                <div className="relative apple-datepicker-container">
                  <label className="text-xs font-bold text-black dark:text-zinc-100 mb-1.5 block">Expiry Date</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="DD-MM-YYYY" 
                      value={expiryDate} 
                      onChange={e => {
                        const val = e.target.value;
                        const cleaned = val.replace(/[^0-9\-]/g, '');
                        if (cleaned.length < expiryDate.length) { setExpiryDate(cleaned); return; }
                        const digits = cleaned.replace(/\-/g, '');
                        let formatted = '';
                        if (digits.length <= 2) formatted = digits;
                        else if (digits.length <= 4) formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
                        else formatted = `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}`;
                        setExpiryDate(formatted);
                      }} 
                      className={`w-full text-xs px-3.5 py-2.5 pr-9 rounded-xl glass-input focus:outline-none font-mono text-black dark:text-white font-medium ${valError ? 'border-rose-500 text-rose-500' : ''}`}
                      style={{ fontFamily: 'inherit' }}
                    />
                    <button 
                      type="button" 
                      onClick={(e) => { e.stopPropagation(); setShowDatePicker(!showDatePicker); }} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-450 hover:text-zinc-655 dark:hover:text-zinc-300"
                    >
                      <Calendar className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {valError && (
                    <span className="absolute right-0 top-full mt-0.5 text-[10px] text-rose-500 font-semibold block z-10">
                      {valError}
                    </span>
                  )}

                  {/* Dropdown Calendar */}
                  {showDatePicker && (() => {
                    const firstDayIdx = new Date(pickerYear, pickerMonth, 1).getDay();
                    const daysInMonth = new Date(pickerYear, pickerMonth + 1, 0).getDate();
                    const prevMonthDays = new Date(pickerYear, pickerMonth, 0).getDate();
                    const cells = [];
                    for (let i = firstDayIdx - 1; i >= 0; i--) { const pmYear = pickerMonth === 0 ? pickerYear - 1 : pickerYear; const pmMonth = pickerMonth === 0 ? 12 : pickerMonth; cells.push({ day: prevMonthDays - i, isCurrentMonth: false, dateStr: `${pmYear}-${String(pmMonth).padStart(2, '0')}-${String(prevMonthDays - i).padStart(2, '0')}` }); }
                    for (let i = 1; i <= daysInMonth; i++) { cells.push({ day: i, isCurrentMonth: true, dateStr: `${pickerYear}-${String(pickerMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}` }); }
                    const remaining = (7 - (cells.length % 7)) % 7;
                    for (let i = 1; i <= remaining; i++) { const nmYear = pickerMonth === 11 ? pickerYear + 1 : pickerYear; const nmMonth = pickerMonth === 11 ? 1 : pickerMonth + 2; cells.push({ day: i, isCurrentMonth: false, dateStr: `${nmYear}-${String(nmMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}` }); }

                    const handlePrevMonth = (e) => { e.stopPropagation(); if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1); } else { setPickerMonth(m => m - 1); } };
                    const handleNextMonth = (e) => { e.stopPropagation(); if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1); } else { setPickerMonth(m => m + 1); } };
                    const handleSelectDate = (dateStr, e) => { e.stopPropagation(); setExpiryDate(formatToDMY(dateStr)); setShowDatePicker(false); };
                    const todayStr = new Date().toISOString().split('T')[0];

                    return (
                      <div className="absolute right-0 top-full mt-2 z-50 rounded-xl p-4 shadow-xl border bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 animate-dropdown-in" style={{ width: '280px' }}>
                        <div className="flex items-center justify-between mb-3" style={{ fontFamily: 'inherit' }}>
                          <span className="text-[13px] font-bold text-black dark:text-white">{MONTH_NAMES[pickerMonth]} {pickerYear}</span>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={handlePrevMonth} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                            <button type="button" onClick={handleNextMonth} className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-500 transition-colors"><ChevronRight className="h-4 w-4" /></button>
                          </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center mb-1" style={{ fontFamily: 'inherit' }}>
                          {WEEK_DAYS.map((wd, idx) => (<span key={idx} className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">{wd}</span>))}
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center">
                          {cells.map((cell, idx) => {
                            const isSelected = expiryDate === formatToDMY(cell.dateStr);
                            const isToday = todayStr === cell.dateStr;
                            return (
                              <button key={idx} type="button" onClick={(e) => handleSelectDate(cell.dateStr, e)}
                                className="aspect-square flex items-center justify-center text-[12px] font-semibold rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all"
                                style={{ color: isSelected ? '#fff' : (cell.isCurrentMonth ? 'var(--text-primary)' : 'var(--text-tertiary)'), background: isSelected ? '#34C759' : 'transparent', border: isToday && !isSelected ? '1px solid #34C759' : 'none', fontFamily: 'inherit' }}>
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

              <div className="grid grid-cols-2 gap-4">
                {/* Purchase Rate */}
                <div>
                  <label className="text-xs font-bold text-black dark:text-zinc-100 mb-1.5 block">Purchase Rate (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={unitPurchaseRate} 
                    onChange={e => setUnitPurchaseRate(e.target.value)} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none font-mono focus:ring-1 focus:ring-blue-500/50 text-black dark:text-white font-medium"
                    style={{ fontFamily: 'inherit' }}
                  />
                </div>

                {/* Unit MRP */}
                <div>
                  <label className="text-xs font-bold text-black dark:text-zinc-100 mb-1.5 block">Unit MRP (₹)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00" 
                    value={unitMrp} 
                    onChange={e => setUnitMrp(e.target.value)} 
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none font-mono focus:ring-1 focus:ring-blue-500/50 text-black dark:text-white font-medium"
                    style={{ fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              {/* Quantity Found */}
              <div>
                <label className="text-xs font-bold text-black dark:text-zinc-100 mb-1.5 block">Quantity Found</label>
                <input 
                  type="number" 
                  min="1" 
                  placeholder="1" 
                  value={physicalCount} 
                  onChange={e => setPhysicalCount(e.target.value)} 
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl glass-input focus:outline-none font-mono font-bold text-green-600 dark:text-green-500 focus:ring-1 focus:ring-blue-500/50"
                  style={{ fontFamily: 'inherit' }}
                />
              </div>

            </div>

          </div>
        </div>
      </form>

      {showItemDropdown && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
             onClick={() => setShowItemDropdown(false)}>
          <div className="w-full rounded-[24px] overflow-hidden flex flex-col shadow-[0_32px_64px_rgba(0,0,0,0.3)] transition-all bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
            style={{ maxWidth: '550px' }}
            onClick={e => e.stopPropagation()}>
            
            {/* Modal Header & Search */}
            <div className="p-5 pb-4 border-b border-zinc-100 dark:border-zinc-800/50">
              <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">Select Product</h3>
                  <button type="button" onClick={() => setShowItemDropdown(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
              </div>
              
              <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by product name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-[16px] text-[14px] font-medium transition-all outline-none bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-white placeholder:text-zinc-400 border border-zinc-200 dark:border-zinc-700 focus:bg-white dark:focus:bg-zinc-800 focus:border-zinc-300 dark:focus:border-zinc-600 focus:shadow-sm"
                    autoFocus
                  />
              </div>
            </div>

            {/* Modal Scrollable List */}
            <div className="max-h-[45vh] overflow-y-auto px-3 py-2 bg-zinc-50/30 dark:bg-zinc-900/30">
              {masterItems
                .filter(name => name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((name, idx) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => {
                      setSelectedItemName(name);
                      setShowItemDropdown(false);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-4 py-3 rounded-[12px] text-[14px] font-semibold hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm transition-all mb-1 flex items-center justify-between group border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                    style={{ color: selectedItemName === name ? '#34C759' : (isDark ? '#e4e4e7' : '#27272a') }}
                  >
                    <span>{name}</span>
                    {selectedItemName === name && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  </button>
                ))}
              {masterItems.filter(name => name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <div className="py-10 text-center flex flex-col items-center">
                  <Package className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mb-3" />
                  <p className="text-[14px] text-zinc-500 font-medium">No products found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
