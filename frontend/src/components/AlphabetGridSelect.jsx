import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

const AlphabetGridSelect = ({ value, onChange, placeholder = 'A-Z', isDark }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target) &&
          panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const alphabets = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const items = [...alphabets, '0-9']; // 27 items

  return (
    <div className="relative inline-block" style={{ width: 'auto' }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all whitespace-nowrap"
        style={{
          background: 'var(--glass-bg)',
          borderColor: 'var(--glass-border)',
          color: 'var(--text-primary)',
          fontSize: '13px',
          fontWeight: 500,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 4px 12px var(--shadow-sm)'
        }}
      >
        <span>{value || placeholder}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute z-50 mt-2 p-4 rounded-3xl shadow-2xl animate-slide-up"
          style={{
            background: 'var(--card-solid)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 24px 48px rgba(0,0,0,0.4)',
            width: '280px',
            left: 0
          }}
        >
          <div className="flex items-center justify-between mb-4 px-2">
            <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              Select Alphabet
            </span>
          </div>

          <div className="grid grid-cols-7 gap-y-3 gap-x-1 justify-items-center">
            {items.map(item => {
              const isSel = item === value;
              return (
                <button
                  key={item}
                  onClick={() => { onChange(item); setOpen(false); }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${isSel ? 'bg-blue-600 text-white shadow-md transform scale-110' 
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  style={{
                    color: isSel ? '#fff' : 'var(--text-primary)',
                    backgroundColor: isSel ? '#007AFF' : 'transparent',
                  }}
                >
                  {item}
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t px-2 text-left" style={{ borderColor: 'var(--glass-border)' }}>
            <button
              onClick={() => { onChange(''); setOpen(false); }}
              className="text-xs font-bold text-blue-500 hover:text-blue-600 transition-colors"
            >
              All Items
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlphabetGridSelect;
