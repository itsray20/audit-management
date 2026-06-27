import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Save, AlertCircle, Check } from 'lucide-react';

export default function ExtraFoundForm({ sessionId, currentUser, onSuccess }) {
  const [masterItems, setMasterItems] = useState([]);
  const [selectedItemName, setSelectedItemName] = useState('');
  const [customItemName, setCustomItemName] = useState('');
  const [allowCustomName, setAllowCustomName] = useState(false); // fallback just in case
  const [batchNo, setBatchNo] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [unitMrp, setUnitMrp] = useState('');
  const [unitPurchaseRate, setUnitPurchaseRate] = useState('');
  const [physicalCount, setPhysicalCount] = useState('');
  const [supplier, setSupplier] = useState('');
  const [location, setLocation] = useState('');
  const [storeName, setStoreName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchMasterItems();
  }, [sessionId]);

  const fetchMasterItems = async () => {
    try {
      // Fetch distinct items from session
      const response = await axios.get(`/api/audits/${sessionId}/items?limit=1000`);
      // Extract unique item names
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

    const itemName = allowCustomName ? customItemName : selectedItemName;
    if (!itemName) {
      setError('Please select or enter an Item Name.');
      return;
    }
    if (!batchNo) {
      setError('Batch Number is required.');
      return;
    }
    if (!unitPurchaseRate || Number(unitPurchaseRate) <= 0) {
      setError('A valid unit purchase rate is required.');
      return;
    }
    const countNum = parseInt(physicalCount);
    if (isNaN(countNum) || countNum <= 0) {
      setError('Physical count must be greater than 0.');
      return;
    }

    setIsLoading(true);
    try {
      // In server.js, the API is POST /api/items/counts, but we need to create the extra found item first!
      // In server.js we don't have a direct POST to create an item, but wait!
      // In our server.js, we didn't add a POST /api/audits/:id/items route to create a new item!
      // Ah! We need to add a route POST /api/audits/:id/items to support adding "Extra Found" items manually!
      // Yes! In server.js, we only have file import.
      // So we must add:
      // 1. `POST /api/audits/:id/items` to create a new item in the database.
      // Let's make sure we add this API to server.js.
      
      // Let's hit the endpoint to create a new item
      const itemRes = await axios.post(`/api/audits/${sessionId}/items`, {
        item_name: itemName,
        batch_no: batchNo,
        expiry_date: expiryDate,
        unit_mrp: Number(unitMrp || 0),
        unit_purchase_rate: Number(unitPurchaseRate),
        system_qty: 0,
        supplier: supplier,
        location: location,
        store_name: storeName,
        notes: 'Extra Found (Logged manually)'
      });

      const newItem = itemRes.data;

      // Now add count for the current auditor
      await axios.post(`/api/items/${newItem.id}/counts`, {
        auditor_name: currentUser.name,
        physical_count: countNum,
        expiry_check: false,
        remarks: 'Extra found physical entry'
      });

      setSuccessMsg('Extra Found item registered and count saved successfully!');
      
      // Reset form
      setSelectedItemName('');
      setCustomItemName('');
      setBatchNo('');
      setExpiryDate('');
      setUnitMrp('');
      setUnitPurchaseRate('');
      setPhysicalCount('');
      setSupplier('');
      setLocation('');
      setStoreName('');
      
      if (onSuccess) onSuccess();
      fetchMasterItems();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to register Extra Found item.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm max-w-2xl mx-auto">
      <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4">
        <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">Log Extra Found Item</h3>
        <p className="text-xs text-zinc-500">
          Use this form to log stock items that were physically found on shelves but were not listed in the imported system inventory file.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 text-rose-800 dark:text-rose-400 rounded-lg p-3 text-xs mb-4 flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-400 rounded-lg p-3 text-xs mb-4 flex items-center gap-1.5">
          <Check className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Item Selection from Master List */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="text-xs font-semibold text-zinc-500">Item Name (from Master List)</label>
            <button
              type="button"
              onClick={() => setAllowCustomName(!allowCustomName)}
              className="text-[10px] text-blue-500 hover:underline"
            >
              {allowCustomName ? 'Select from Master List' : 'Enter Custom Item Name'}
            </button>
          </div>
          
          {allowCustomName ? (
            <input
              type="text"
              placeholder="Enter item name..."
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50"
            />
          ) : (
            <select
              value={selectedItemName}
              onChange={(e) => setSelectedItemName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50"
            >
              <option value="">-- Select Predefined Item Name --</option>
              {masterItems.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Batch & Expiry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500">Batch Number</label>
            <input
              type="text"
              placeholder="e.g. B23490"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50 font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500">Expiry Date</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50"
            />
          </div>
        </div>

        {/* Rates & Count */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500">Unit MRP</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={unitMrp}
              onChange={(e) => setUnitMrp(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50 font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500">Unit Purchase Cost</label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={unitPurchaseRate}
              onChange={(e) => setUnitPurchaseRate(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50 font-mono"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500">Physical Qty Count</label>
            <input
              type="number"
              min="1"
              placeholder="1"
              value={physicalCount}
              onChange={(e) => setPhysicalCount(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50 font-mono"
            />
          </div>
        </div>

        {/* Location & Vendor Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500">Location (Rack/Shelf)</label>
            <input
              type="text"
              placeholder="e.g. Rack C4"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500">Store Name</label>
            <input
              type="text"
              placeholder="e.g. Lifespan Pharmacy"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-500">Supplier/Vendor</label>
            <input
              type="text"
              placeholder="e.g. Vijaya Pharma"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center items-center gap-1.5 px-4 py-2.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 border border-emerald-700 text-white shadow-sm disabled:opacity-55 transition-colors mt-6"
        >
          <Save className="h-4 w-4" />
          {isLoading ? 'Saving...' : 'Register Extra Found Item'}
        </button>
      </form>
    </div>
  );
}
