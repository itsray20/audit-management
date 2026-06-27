import React from 'react';
import { History, RefreshCw } from 'lucide-react';

export default function AuditTrail({ trail, onRefresh, isLoading }) {
  return (
    <div className="bg-white dark:bg-[#0c0c0f] border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
      <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-4 mb-4">
        <div>
          <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50 flex items-center gap-1.5">
            <History className="h-5 w-5 text-zinc-500" />
            Audit Session Trail / Change Log
          </h3>
          <p className="text-xs text-zinc-500">
            This log tracks all changes, locks, auditor counts, and manual adjustments made during the course of the stock audit.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex justify-center items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Log
        </button>
      </div>

      <div className="overflow-x-auto max-h-[500px]">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-2">Timestamp</th>
              <th className="px-4 py-2">Auditor / User</th>
              <th className="px-4 py-2">Item Name</th>
              <th className="px-4 py-2">Batch</th>
              <th className="px-4 py-2">Field</th>
              <th className="px-4 py-2 text-center">Old Value</th>
              <th className="px-4 py-2 text-center">New Value</th>
              <th className="px-4 py-2">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/40">
            {isLoading && trail.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">
                  <RefreshCw className="animate-spin text-zinc-400 h-6 w-6 mx-auto mb-2" />
                  Loading logs...
                </td>
              </tr>
            ) : trail.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-zinc-500">
                  No changes have been made in this audit session yet.
                </td>
              </tr>
            ) : (
              trail.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                  <td className="px-4 py-2.5 text-zinc-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-zinc-900 dark:text-zinc-200">
                    {log.user_name}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-zinc-900 dark:text-zinc-200 max-w-xs truncate">
                    {log.item_name}
                  </td>
                  <td className="px-4 py-2.5 font-mono">{log.batch_no}</td>
                  <td className="px-4 py-2.5 font-semibold text-blue-600 dark:text-blue-400">
                    {log.field_name}
                  </td>
                  <td className="px-4 py-2.5 text-center font-mono text-zinc-500">{log.old_value || '-'}</td>
                  <td className="px-4 py-2.5 text-center font-mono font-semibold text-zinc-950 dark:text-zinc-50">{log.new_value || '-'}</td>
                  <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-300 italic">
                    {log.reason || 'N/A'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
