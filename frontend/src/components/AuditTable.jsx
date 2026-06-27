import React from 'react';
import { 
  Lock, Unlock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, 
  Search, Filter, SlidersHorizontal, RefreshCcw, Eye
} from 'lucide-react';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(val || 0);
};

export default function AuditTable({ 
  items, 
  totalItems, 
  currentPage, 
  setCurrentPage, 
  limit, 
  search, 
  setSearch, 
  categoryFilter, 
  setCategoryFilter, 
  supplierFilter, 
  setSupplierFilter, 
  locationFilter, 
  setLocationFilter, 
  storeFilter, 
  setStoreFilter, 
  meta, 
  onRowClick, 
  selectedItemId,
  auditors
}) {

  const totalPages = Math.ceil(totalItems / limit) || 1;
  const offset = (currentPage - 1) * limit;

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('');
    setSupplierFilter('');
    setLocationFilter('');
    setStoreFilter('');
    setCurrentPage(1);
  };

  // Get status color pill
  const getCategoryPill = (cat) => {
    switch (cat) {
      case 'Excess':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'Shortage':
        return 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400 border-rose-200 dark:border-rose-800';
      case 'Extra Found':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'Expired Stock':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'Other':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      default:
        return 'bg-zinc-50 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800';
    }
  };

  // Check row warning
  const getRowHighlightClass = (item) => {
    if (selectedItemId === item.id) {
      return 'bg-blue-50/70 dark:bg-blue-950/30 hover:bg-blue-100/50 dark:hover:bg-blue-950/40';
    }
    if (item.category === 'Expired Stock') {
      return 'bg-amber-50/30 dark:bg-amber-950/10 hover:bg-zinc-50 dark:hover:bg-zinc-900/50';
    }
    if (item.category === 'Shortage' || item.category === 'Excess') {
      return 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50';
    }
    return 'hover:bg-zinc-50 dark:hover:bg-zinc-900/50';
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search bar */}
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Search item, batch, supplier..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="w-full pl-3 pr-8 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50 appearance-none"
            >
              <option value="">All Categories</option>
              <option value="Excess">Excess</option>
              <option value="Shortage">Shortage</option>
              <option value="Extra Found">Extra Found</option>
              <option value="Expired Stock">Expired Stock</option>
              <option value="Other">Other</option>
              <option value="Perfect Match">Perfect Match</option>
            </select>
            <Filter className="absolute right-3 top-3 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
          </div>

          {/* Location Filter */}
          <div className="relative">
            <select
              value={locationFilter}
              onChange={(e) => { setLocationFilter(e.target.value); setCurrentPage(1); }}
              className="w-full pl-3 pr-8 py-2 text-sm bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-zinc-950 dark:text-zinc-50 appearance-none"
            >
              <option value="">All Locations</option>
              {(meta.locations || []).filter(Boolean).map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
            <SlidersHorizontal className="absolute right-3 top-3 h-3.5 w-3.5 text-zinc-400 pointer-events-none" />
          </div>

          {/* Action Toolbar */}
          <div className="flex gap-2">
            <button
              onClick={resetFilters}
              className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <RefreshCcw className="h-4 w-4" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900/80 backdrop-blur-md z-10 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-medium">
              <tr>
                <th className="px-4 py-3 font-semibold w-12 text-center">Lock</th>
                <th className="px-4 py-3 font-semibold">Item Details</th>
                <th className="px-4 py-3 font-semibold">Batch & Expiry</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold text-right">System Qty</th>
                
                {/* Dynamically render Auditor Columns */}
                {auditors.map(auditor => (
                  <th key={auditor} className="px-4 py-3 font-semibold text-right text-blue-600 dark:text-blue-400">
                    {auditor}
                  </th>
                ))}

                <th className="px-4 py-3 font-semibold text-right">Adj (Add/Rchk)</th>
                <th className="px-4 py-3 font-semibold text-right">Total Phy</th>
                <th className="px-4 py-3 font-semibold text-right">Diff Qty</th>
                <th className="px-4 py-3 font-semibold text-right">Diff Value</th>
                <th className="px-4 py-3 font-semibold text-center">Category</th>
                <th className="px-4 py-3 font-semibold text-center w-12">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={11 + auditors.length} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                    No items found matching the selected filters.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr 
                    key={item.id}
                    onClick={() => onRowClick(item)}
                    className={`cursor-pointer transition-colors duration-150 ${getRowHighlightClass(item)}`}
                  >
                    <td className="px-4 py-3 text-center">
                      {item.is_locked === 1 ? (
                        <Lock className="h-4 w-4 text-rose-500 mx-auto" />
                      ) : (
                        <Unlock className="h-4 w-4 text-zinc-400 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-950 dark:text-zinc-50">{item.item_name}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">{item.supplier}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded px-1.5 py-0.5 inline-block">
                        {item.batch_no}
                      </div>
                      <div className={`text-xs mt-1 ${
                        item.category === 'Expired Stock' 
                          ? 'text-rose-500 font-semibold' 
                          : 'text-zinc-500 dark:text-zinc-400'
                      }`}>
                        Exp: {item.expiry_date || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      <div>{item.location}</div>
                      <div className="text-xs text-zinc-500">{item.store_name}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-zinc-950 dark:text-zinc-100">
                      {item.system_qty}
                    </td>

                    {/* Dynamic auditor counts */}
                    {auditors.map(auditor => {
                      const countObj = (item.counts || []).find(c => c.auditor_name === auditor);
                      return (
                        <td key={auditor} className="px-4 py-3 text-right font-mono font-medium text-blue-600 dark:text-blue-400">
                          {countObj ? (
                            <span className={countObj.expiry_check ? 'text-amber-500 line-through' : ''}>
                              {countObj.physical_count}
                            </span>
                          ) : '-'}
                        </td>
                      );
                    })}

                    <td className="px-4 py-3 text-right font-mono text-zinc-500">
                      {item.manual_add !== 0 ? `+${item.manual_add}` : ''}
                      {item.manual_recheck !== 0 ? ` / ${item.manual_recheck}` : ''}
                      {item.manual_add === 0 && item.manual_recheck === 0 ? '-' : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-zinc-950 dark:text-zinc-100">
                      {item.totalPhysical}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      item.difference > 0 ? 'text-emerald-600 dark:text-emerald-400' : 
                      item.difference < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'
                    }`}>
                      {item.difference > 0 ? `+${item.difference}` : item.difference}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      item.differenceValue > 0 ? 'text-emerald-600 dark:text-emerald-400' : 
                      item.differenceValue < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500'
                    }`}>
                      {formatCurrency(item.differenceValue)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getCategoryPill(item.category)}`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onRowClick(item); }}
                        className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 p-1"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-5 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-xs text-zinc-500 dark:text-zinc-400">
          <div>
            Showing <span className="font-semibold text-zinc-900 dark:text-zinc-200">{Math.min(totalItems, offset + 1)}</span> to{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-200">{Math.min(totalItems, offset + limit)}</span> of{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-200">{totalItems}</span> items
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-600 dark:text-zinc-300"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-600 dark:text-zinc-300"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-3">
              Page <span className="font-semibold text-zinc-900 dark:text-zinc-200">{currentPage}</span> of{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-200">{totalPages}</span>
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-600 dark:text-zinc-300"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-600 dark:text-zinc-300"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
