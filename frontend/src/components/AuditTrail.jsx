import React from 'react';
import { History, RefreshCw } from 'lucide-react';

export default function AuditTrail({ trail, onRefresh, isLoading, roleNamesMap = {} }) {
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
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex justify-between items-center px-6 py-4" style={{ borderBottom: '1px solid var(--glass-border-dim)' }}>
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <History className="h-4 w-4" style={{ color: 'var(--text-tertiary)' }} />
            Audit Session Trail
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
            All changes, locks, auditor counts and adjustments in this session.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
          style={{ background: 'var(--glass-bg-light)', border: '1px solid var(--glass-border-dim)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0" style={{ background: 'var(--glass-bg)', borderBottom: '1px solid var(--glass-border-dim)' }}>
            <tr>
              {['Timestamp', 'Auditor / User', 'Item Name', 'Batch', 'Field', 'Old Value', 'New Value', 'Reason'].map(col => {
                const isCenter = col === 'Old Value' || col === 'New Value';
                return (
                  <th
                    key={col}
                    className={`px-4 py-2.5 font-semibold uppercase tracking-wide text-[10px] ${isCenter ? 'text-center' : 'text-left'}`}
                    style={{ color: 'var(--text-tertiary)', textAlign: isCenter ? 'center' : 'left' }}
                  >
                    {col}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading && trail.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                  Loading logs...
                </td>
              </tr>
            ) : trail.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center" style={{ color: 'var(--text-tertiary)' }}>
                  No changes have been made in this audit session yet.
                </td>
              </tr>
            ) : (
              trail.map((log) => {
                const mappedUser = roleNamesMap[log.user_name] || log.user_name;
                return (
                  <tr
                    key={log.id}
                    className="glass-row-hover transition-colors"
                    style={{ borderBottom: '1px solid var(--glass-border-dim)' }}
                  >
                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {mappedUser}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                      {log.item_name}
                    </td>
                    <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-secondary)' }}>{log.batch_no}</td>
                    <td className="px-4 py-2.5 font-semibold" style={{ color: 'var(--accent)' }}>
                      {formatFieldName(log.field_name)}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono" style={{ color: 'var(--text-tertiary)', textAlign: 'center' }}>{cleanValue(log.old_value) || '—'}</td>
                    <td className="px-4 py-2.5 text-center font-mono font-semibold" style={{ color: 'var(--text-primary)', textAlign: 'center' }}>{cleanValue(log.new_value) || '—'}</td>
                    <td className="px-4 py-2.5 italic" style={{ color: 'var(--text-secondary)' }}>
                      {log.reason || 'N/A'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
