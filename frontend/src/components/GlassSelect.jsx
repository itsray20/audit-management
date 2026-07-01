import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

/**
 * GlassSelect — polished custom dropdown using a React portal.
 * Renders the panel at document.body level so it's never clipped
 * by overflow:hidden parent containers.
 */
export default function GlassSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  className = '',
  compact = false,
  fullWidth = false,
}) {
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({});
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove = spaceBelow < 220 && rect.top > 220;

    const PANEL_MIN_W = Math.max(rect.width, 176);
    const MARGIN = 6; // viewport edge margin

    // Decide horizontal alignment: left-align by default,
    // but flip to right-align if panel would overflow viewport right edge
    let leftPos = rect.left;
    if (leftPos + PANEL_MIN_W > window.innerWidth - MARGIN) {
      // Right-align: anchor panel's right edge to trigger's right edge
      leftPos = rect.right - PANEL_MIN_W;
    }
    // Clamp to left margin
    leftPos = Math.max(MARGIN, leftPos);

    setPanelStyle({
      position: 'fixed',
      left: leftPos,
      minWidth: PANEL_MIN_W,
      maxWidth: window.innerWidth - MARGIN * 2,
      zIndex: 99999,
      ...(openAbove
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    computePosition();
    window.addEventListener('scroll', computePosition, true);
    window.addEventListener('resize', computePosition);
    return () => {
      window.removeEventListener('scroll', computePosition, true);
      window.removeEventListener('resize', computePosition);
    };
  }, [open, computePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      const inTrigger = triggerRef.current?.contains(e.target);
      const inPanel  = panelRef.current?.contains(e.target);
      if (!inTrigger && !inPanel) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find(o => o.value === value);
  const label = selected?.label || placeholder;

  return (
    <div style={{ position: 'relative', display: fullWidth ? 'block' : 'inline-block', width: fullWidth ? '100%' : 'auto' }}>
      {/* ─── Trigger ─────────────────────────────── */}
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        className={`glass-dropdown-trigger ${open ? 'open' : ''} ${className}`}
        style={compact ? { padding: '4px 10px', fontSize: '11px', height: '28px', gap: '5px' } : {}}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpen(v => !v)}
      >
        {selected?.dot && (
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: selected.dot, flexShrink: 0, display: 'inline-block',
          }} />
        )}
        {selected?.icon && (
          <span style={{ fontSize: compact ? 11 : 13, lineHeight: 1 }}>{selected.icon}</span>
        )}
        <span style={{
          flex: 1, minWidth: 0, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: fullWidth ? 'none' : (compact ? 140 : 220),
          textAlign: 'left'
        }}>
          {label}
        </span>
        <ChevronDown style={{
          width: compact ? 11 : 12, height: compact ? 11 : 12,
          flexShrink: 0, color: 'var(--text-tertiary)',
          transition: 'transform 0.2s ease',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </div>

      {/* ─── Portal Panel ────────────────────────── */}
      {open && createPortal(
        <div
          ref={panelRef}
          className="glass-dropdown-panel"
          style={{ ...panelStyle, maxHeight: 264, overflowY: 'auto' }}
        >
          {options.map(opt => {
            const isSel = opt.value === value;
            return (
              <div
                key={opt.value}
                className={`glass-dropdown-item${isSel ? ' selected' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                {opt.dot && (
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: isSel ? 'var(--accent)' : opt.dot,
                    flexShrink: 0, display: 'inline-block',
                  }} />
                )}
                {opt.icon && (
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{opt.icon}</span>
                )}
                <span style={{ flex: 1 }}>{opt.label}</span>
                {isSel && (
                  <Check style={{ width: 12, height: 12, color: 'var(--accent)', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>,
        document.fullscreenElement || document.body,
      )}
    </div>
  );
}
