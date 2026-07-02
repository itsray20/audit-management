import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import JSZip from 'jszip';
import {
  Building2, Plus, Phone, MapPin, Calendar, ChevronRight,
  RefreshCw, Edit3, X, Lock, Package, ClipboardList, Trash2,
  ArrowLeft, Activity, CheckCircle2, Clock3, BarChart3,
  Hash, AlertTriangle, Search, ChevronDown, Check, ChevronLeft
} from 'lucide-react';

const getAbsoluteUrl = (path) => {
  // Use axios.defaults.baseURL (already set from VITE_API_URL in App.jsx) as the
  // canonical source of truth so both Axios and native fetch hit the same server.
  const base = (axios.defaults.baseURL || import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return base ? `${base}/${cleanPath}` : `/${cleanPath}`;
};

const ACCENT_COLORS = [
  { solid: '#007AFF', light: 'rgba(0,122,255,0.12)'   },
  { solid: '#FF6B35', light: 'rgba(255,107,53,0.12)'  },
  { solid: '#34C759', light: 'rgba(52,199,89,0.12)'   },
  { solid: '#FF9500', light: 'rgba(255,149,0,0.12)'   },
  { solid: '#AF52DE', light: 'rgba(175,82,222,0.12)'  },
  { solid: '#FF2D55', light: 'rgba(255,45,85,0.12)'   },
  { solid: '#5AC8FA', light: 'rgba(90,200,250,0.12)'  },
  { solid: '#32ADE6', light: 'rgba(50,173,230,0.12)'  },
];

const SYS = {
  labelSm:  { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.055em' },
  caption:  { fontSize: 11, lineHeight: 1.5 },
  body:     { fontSize: 13 },
  subhead:  { fontSize: 15, fontWeight: 600 },
  title3:   { fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em' },
  title1:   { fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' },
};

/* ─────────────────────────────────────────────────────────────────────────── */
export default function HospitalManagement({ currentUser, isDark, onSelectAudit }) {
  const [hospitals, setHospitals]               = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedGrad, setSelectedGrad]         = useState(null);
  const [hospitalAudits, setHospitalAudits]     = useState([]);
  const [loadingAudits, setLoadingAudits]       = useState(false);
  const [showAddForm, setShowAddForm]           = useState(false);
  const [editTarget, setEditTarget]             = useState(null);
  const [deleteTarget, setDeleteTarget]         = useState(null);
  const [associatedAudits, setAssociatedAudits] = useState([]);
  const [loadingAssociatedAudits, setLoadingAssociatedAudits] = useState(false);
  const [auditDeleteSearch, setAuditDeleteSearch] = useState('');
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [zipStatus, setZipStatus] = useState({ active: false, total: 0, current: 0, currentName: '', error: null });
  const [isDeleting, setIsDeleting]             = useState(false);
  const zipCancelledRef                         = useRef(false);
  const [toast, setToast]                       = useState(null);
  const [newHospital, setNewHospital]           = useState({ name: '', location: '', contact_number: '' });
  const [editForm, setEditForm]                 = useState({ name: '', location: '', contact_number: '' });
  const [auditSearch, setAuditSearch]           = useState('');
  const [auditFilter, setAuditFilter]           = useState('All');
  const [auditYearFilter, setAuditYearFilter]   = useState('All');
  const [showYearMenu, setShowYearMenu]         = useState(false);
  const [auditFromDate, setAuditFromDate]       = useState('');
  const [auditToDate, setAuditToDate]           = useState('');
  const [tempFromDate, setTempFromDate]         = useState('');
  const [tempToDate, setTempToDate]             = useState('');
  const [showFromCal, setShowFromCal]           = useState(false);
  const [showToCal, setShowToCal]               = useState(false);
  const [fromCalMonth, setFromCalMonth]         = useState(new Date().getMonth());
  const [fromCalYear, setFromCalYear]           = useState(new Date().getFullYear());
  const [toCalMonth, setToCalMonth]             = useState(new Date().getMonth());
  const [toCalYear, setToCalYear]               = useState(new Date().getFullYear());
  const [hospitalSearch, setHospitalSearch]     = useState('');

  const isPrivileged = ['Admin', 'Developer'].includes(currentUser?.role);
  const isUpperTier  = isPrivileged || currentUser?.role === 'CoFounder';

  const c  = isDark
    ? { bg: '#000000', card: '#1c1c1e', card2: '#2c2c2e', border: 'rgba(255,255,255,0.10)', t1: '#ffffff', t2: '#ebebf5cc', t3: '#ebebf599', sep: 'rgba(255,255,255,0.08)' }
    : { bg: '#f2f2f7', card: '#ffffff',  card2: '#f2f2f7', border: 'rgba(0,0,0,0.10)',      t1: '#000000', t2: '#3c3c4399', t3: '#3c3c4366', sep: 'rgba(0,0,0,0.07)' };

  const fetchHospitals = async () => {
    setLoading(true);
    try { const r = await axios.get('/api/hospitals'); setHospitals(r.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openHospital = async (hospital, grad) => {
    setSelectedHospital(hospital);
    setSelectedGrad(grad);
    setAuditSearch('');
    setAuditFilter('All');
    setAuditYearFilter('All');
    setShowYearMenu(false);
    setAuditFromDate('');
    setAuditToDate('');
    setTempFromDate('');
    setTempToDate('');
    setShowFromCal(false);
    setShowToCal(false);
    setFromCalMonth(new Date().getMonth());
    setFromCalYear(new Date().getFullYear());
    setToCalMonth(new Date().getMonth());
    setToCalYear(new Date().getFullYear());
    setLoadingAudits(true);
    try {
      const r = await axios.get(`/api/hospitals/${hospital.id}/audits`);
      setHospitalAudits(r.data);
    } catch (e) { console.error(e); }
    finally { setLoadingAudits(false); }
  };

  useEffect(() => { fetchHospitals(); }, []);

  useEffect(() => {
    if (deleteTarget) {
      setLoadingAssociatedAudits(true);
      setAuditDeleteSearch('');
      setDeleteConfirmInput('');
      axios.get(`/api/hospitals/${deleteTarget.id}/audits`)
        .then(res => {
          setAssociatedAudits(res.data);
        })
        .catch(err => {
          console.error(err);
          setAssociatedAudits([]);
        })
        .finally(() => {
          setLoadingAssociatedAudits(false);
        });
    } else {
      setAssociatedAudits([]);
    }
  }, [deleteTarget]);

  const showToast = (text, ok = true) => {
    setToast({ text, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/hospitals', newHospital);
      setNewHospital({ name: '', location: '', contact_number: '' });
      setShowAddForm(false);
      showToast('Hospital added successfully.');
      fetchHospitals();
    } catch (err) { showToast(err.response?.data?.error || 'Failed to add.', false); }
  };

  const handleEdit = async () => {
    try {
      await axios.put(`/api/hospitals/${editTarget.id}`, editForm);
      setEditTarget(null);
      showToast('Hospital updated.');
      fetchHospitals();
      if (selectedHospital?.id === editTarget.id)
        setSelectedHospital(prev => ({ ...prev, ...editForm }));
    } catch (err) { showToast(err.response?.data?.error || 'Failed to update.', false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await axios.delete(`/api/hospitals/${deleteTarget.id}`);
      setDeleteTarget(null);
      showToast('Hospital deleted.');
      fetchHospitals();
      if (selectedHospital?.id === deleteTarget.id) setSelectedHospital(null);
    } catch (err) { showToast(err.response?.data?.error || 'Failed to delete.', false); }
    finally { setIsDeleting(false); }
  };

  const handleZipDownload = async () => {
    if (!deleteTarget) return;

    setZipStatus({
      active: true,
      total: 1,
      current: 0,
      currentName: 'Requesting server export...',
      error: null
    });

    try {
      const url = getAbsoluteUrl(`/api/hospitals/${deleteTarget.id}/audits/export?role=${currentUser.role}`);
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        const errText = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
      }
      const blob = await response.blob();
      const safeName = deleteTarget.name.replace(/[/\\?%*:|"<>\s]/g, '_');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${safeName}-audits.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setZipStatus({ active: false, total: 0, current: 0, currentName: '' });
      showToast('Backup downloaded successfully!', true);
    } catch (err) {
      console.error(err);
      setZipStatus(prev => ({
        ...prev,
        currentName: `Error: ${err.message || 'Download failed'}`,
        error: err.message || 'Error occurred'
      }));
    }
  };


  /* ── Shared modal renderer ── */
  const renderModals = () => (
    <>
      {/* Edit */}
      {editTarget && (
        <Backdrop onClose={() => setEditTarget(null)}>
          <Sheet isDark={isDark} c={c} width={400}>
            <SheetHeader title="Edit Hospital" onClose={() => setEditTarget(null)} c={c} />
            {[['Hospital Name','name','e.g. Kukatpally',true],['Location','location','City, State',false],['Contact','contact_number','+91 9XXXXXXXXX',false]].map(([label,field,ph,req]) => (
              <FieldRow key={field} label={label} isDark={isDark} c={c}>
                <input
                  required={req}
                  value={editForm[field]}
                  onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
                  placeholder={ph}
                  style={{ width:'100%', background: isDark ? '#3a3a3c' : '#f2f2f7', border: 'none', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: c.t1, outline: 'none' }}
                />
              </FieldRow>
            ))}
            <PrimaryBtn onClick={handleEdit} label="Save Changes" />
          </Sheet>
        </Backdrop>
      )}

      {/* Delete */}
      {deleteTarget && (() => {
        if (loadingAssociatedAudits) {
          return (
            <Backdrop onClose={() => setDeleteTarget(null)}>
              <Sheet isDark={isDark} c={c} width={360}>
                <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                  <RefreshCw className="animate-spin" style={{ width: 28, height: 28, margin: '0 auto 16px', color: '#007AFF' }} />
                  <p style={{ ...SYS.subhead, color: c.t1 }}>Loading associated audits...</p>
                </div>
              </Sheet>
            </Backdrop>
          );
        }

        if (associatedAudits.length === 0) {
          // Standard simple delete modal
          return (
            <Backdrop onClose={() => setDeleteTarget(null)}>
              <Sheet isDark={isDark} c={c} width={360}>
                <div style={{ textAlign:'center', padding: '8px 0 20px' }}>
                  <div style={{ width:52, height:52, borderRadius:16, background:'rgba(255,59,48,0.12)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
                    <Trash2 style={{ width:22, height:22, color:'#FF3B30' }} />
                  </div>
                  <p style={{ ...SYS.subhead, color: c.t1, marginBottom:8 }}>Delete Hospital</p>
                  <p style={{ ...SYS.caption, color: c.t3, marginBottom:24 }}>
                    Permanently delete <strong style={{ color: c.t2 }}>{deleteTarget.name}</strong>? This cannot be undone.
                  </p>
                  <div style={{ display:'flex', gap:10 }}>
                    <button onClick={() => setDeleteTarget(null)} style={ghostBtn(c)}>Cancel</button>
                    <button disabled={isDeleting} onClick={confirmDelete}
                      style={{ ...primaryBtnStyle, flex:1, background:'linear-gradient(180deg,#f87171,#dc2626)', boxShadow:'0 4px 14px rgba(220,38,38,0.28)', opacity: isDeleting ? 0.6 : 1, cursor: isDeleting ? 'not-allowed' : 'pointer' }}>
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              </Sheet>
            </Backdrop>
          );
        }

        // Large Warning & Backups Modal
        const filteredList = associatedAudits.filter(a =>
          a.name.toLowerCase().includes(auditDeleteSearch.toLowerCase()) ||
          String(a.id).includes(auditDeleteSearch) ||
          (a.created_by || '').toLowerCase().includes(auditDeleteSearch.toLowerCase())
        );

        const deleteDisabled = deleteConfirmInput !== deleteTarget.name || isDeleting;

        return (
          <Backdrop onClose={() => setDeleteTarget(null)}>
            <Sheet isDark={isDark} c={c} width={850}>
              <div style={{ display: 'flex', gap: '28px', minHeight: '440px' }}>
                
                {/* LEFT COLUMN: Warnings, Confirmation, Deletion Action */}
                <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '16px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '12px', borderBottom: `1px solid ${c.sep}` }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(255,59,48,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF3B30', flexShrink: 0 }}>
                      <AlertTriangle style={{ width: 20, height: 20 }} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: c.t1, letterSpacing: '-0.02em' }}>
                        Delete Hospital
                      </h3>
                      <p style={{ fontSize: 10, margin: '1px 0 0', color: '#FF3B30', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                        Critical Warning
                      </p>
                    </div>
                  </div>

                  <p style={{ fontSize: 12, color: c.t2, lineHeight: 1.5, margin: 0 }}>
                    Deleting the facility <strong style={{ color: c.t1 }}>{deleteTarget.name}</strong> will also permanently delete all <strong style={{ color: c.t1 }}>{associatedAudits.length} associated audit sessions</strong>.
                  </p>

                  <div style={{ background: isDark ? 'rgba(255,59,48,0.05)' : 'rgba(255,59,48,0.03)', border: '1px solid rgba(255,59,48,0.12)', borderRadius: '12px', padding: '12px', fontSize: 11, color: '#FF3B30', lineHeight: 1.4 }}>
                    ⚠️ <strong>This action is irreversible.</strong> All items, counts, physical check records, and audit logs will be wiped from the database.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: c.t3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Type hospital name to confirm:
                    </label>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c.t1, marginBottom: 2 }}>
                      "{deleteTarget.name}"
                    </div>
                    <input
                      type="text"
                      value={deleteConfirmInput}
                      onChange={e => setDeleteConfirmInput(e.target.value)}
                      placeholder={deleteTarget.name}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        fontSize: 12,
                        borderRadius: 10,
                        background: isDark ? '#2c2c2e' : '#f2f2f7',
                        border: deleteConfirmInput === deleteTarget.name ? '1px solid #FF3B30' : 'none',
                        color: c.t1,
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 10, marginTop: '8px' }}>
                    <button onClick={() => setDeleteTarget(null)} style={{ ...ghostBtn(c), padding: '10px 12px', flex: 1, fontSize: 12 }}>
                      Cancel
                    </button>
                    <button
                      disabled={deleteDisabled}
                      onClick={confirmDelete}
                      style={{
                        flex: 1.8,
                        padding: '10px 12px',
                        fontSize: 12,
                        fontWeight: 700,
                        borderRadius: 12,
                        border: 'none',
                        color: '#ffffff',
                        background: deleteDisabled ? 'rgba(150,150,150,0.4)' : 'linear-gradient(180deg,#f87171,#dc2626)',
                        boxShadow: deleteDisabled ? 'none' : '0 4px 14px rgba(220,38,38,0.25)',
                        cursor: deleteDisabled ? 'not-allowed' : 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isDeleting ? 'Deleting...' : 'Delete Facility'}
                    </button>
                  </div>
                </div>

                {/* VERTICAL DIVIDER */}
                <div style={{ width: '1px', background: c.sep, alignSelf: 'stretch' }} />

                {/* RIGHT COLUMN: Backup Download All as ZIP & Searchable Audits List */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: `1px solid ${c.sep}` }}>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: c.t1 }}>
                        Associated Audit Sessions ({associatedAudits.length})
                      </h4>
                      <p style={{ fontSize: 10, margin: '2px 0 0', color: c.t3 }}>
                        Search and backup sessions individually or in bulk.
                      </p>
                    </div>

                    <button
                      onClick={handleZipDownload}
                      style={{
                        padding: '8px 14px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 10,
                        border: 'none',
                        color: '#ffffff',
                        background: '#34C759',
                        boxShadow: '0 2px 8px rgba(52,199,89,0.25)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Package style={{ width: 14, height: 14 }} /> Download ZIP Backup
                    </button>
                  </div>

                  {/* Search box */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search style={{ position: 'absolute', left: 12, width: 14, height: 14, color: c.t3 }} />
                    <input
                      type="text"
                      placeholder="Search sessions by name, ID or creator..."
                      value={auditDeleteSearch}
                      onChange={e => setAuditDeleteSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px 8px 34px',
                        fontSize: 12,
                        borderRadius: 10,
                        background: isDark ? '#2c2c2e' : '#f2f2f7',
                        border: 'none',
                        color: c.t1,
                        outline: 'none'
                      }}
                    />
                  </div>

                  {/* Audits Scroll Pane */}
                  <div style={{
                    flex: 1,
                    minHeight: '280px',
                    maxHeight: '340px',
                    overflowY: 'auto',
                    border: `1px solid ${c.sep}`,
                    borderRadius: '14px',
                    background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.005)'
                  }}>
                    {filteredList.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '40px 0', color: c.t3 }}>
                        <ClipboardList style={{ width: 28, height: 28, strokeWidth: 1.5, marginBottom: 8, opacity: 0.7 }} />
                        <span style={{ fontSize: 12 }}>No matching audits found</span>
                      </div>
                    ) : (
                      filteredList.map((audit) => {
                        const statusColor = audit.status === 'Completed' ? '#34C759' : '#007AFF';
                        return (
                          <div
                            key={audit.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 16px',
                              borderBottom: `1px solid ${c.sep}`,
                              fontSize: 12
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '70%' }}>
                              <span style={{ fontWeight: 700, color: c.t1 }} className="truncate">
                                {audit.name}
                              </span>
                              <span style={{ fontSize: 10, color: c.t3 }}>
                                ID: {audit.id} • Created by: {audit.created_by || 'Admin'} • Date: {audit.audit_date || 'N/A'}
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                              <span style={{
                                fontSize: 9,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: statusColor,
                                background: `${statusColor}14`,
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                {audit.status}
                              </span>
                              <a
                                href={getAbsoluteUrl(`/api/audits/${audit.id}/export?role=${currentUser.role}`)}
                                download
                                style={{
                                  padding: '6px 12px',
                                  fontSize: 11,
                                  fontWeight: 700,
                                  borderRadius: '8px',
                                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                                  color: '#34C759',
                                  background: isDark ? 'rgba(52,199,89,0.08)' : 'rgba(52,199,89,0.06)',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  cursor: 'pointer'
                                }}
                              >
                                📊 Excel
                              </a>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>
            </Sheet>
          </Backdrop>
        );
      })()}

      {/* Zipping blocking progress modal */}
      {zipStatus.active && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 15000,
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '380px',
            background: isDark ? '#1c1c1e' : '#ffffff',
            border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
            borderRadius: '24px',
            padding: '32px 24px 24px',
            textAlign: 'center',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: 54,
              height: 54,
              borderRadius: '16px',
              background: zipStatus.error ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)',
              border: zipStatus.error ? '1px solid rgba(255,59,48,0.2)' : '1px solid rgba(52,199,89,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: zipStatus.error ? '#FF3B30' : '#34C759'
            }}>
              {zipStatus.error ? (
                <AlertTriangle style={{ width: 24, height: 24 }} />
              ) : zipStatus.current >= zipStatus.total ? (
                <Check style={{ width: 24, height: 24 }} />
              ) : (
                <RefreshCw className="animate-spin" style={{ width: 24, height: 24 }} />
              )}
            </div>
            
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 8, color: zipStatus.error ? '#FF3B30' : c.t1, letterSpacing: '-0.02em' }}>
              {zipStatus.error ? 'Backup Failed' : zipStatus.current >= zipStatus.total ? '✓ Backup Complete!' : 'Zipping & Downloading...'}
            </h3>
            
            <p style={{ fontSize: 12, color: c.t3, marginBottom: 20, lineHeight: 1.4 }}>
              {zipStatus.error
                ? <span>An error occurred while compiling your backup archive. Details below:</span>
                : zipStatus.current >= zipStatus.total
                ? <span>Your zip backup for <strong>{deleteTarget?.name}</strong> has been generated successfully.</span>
                : <span>Bundling audit reports for <strong>{deleteTarget?.name}</strong>. Please do not close or reload the browser.</span>}
            </p>

            {/* Progress status card */}
            <div style={{
              background: isDark ? '#2c2c2e' : '#f2f2f7',
              borderRadius: '14px',
              padding: '14px',
              textAlign: 'left',
              marginBottom: 24
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: c.t2, marginBottom: 6 }}>
                <span>{zipStatus.error ? 'Error Details' : 'Progress'}</span>
                {!zipStatus.error && <span>{zipStatus.current} of {zipStatus.total}</span>}
              </div>
              {!zipStatus.error && (
                <div style={{ width: '100%', height: 6, background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                  <div style={{ width: `${(zipStatus.current / zipStatus.total) * 100}%`, height: '100%', background: '#34C759', transition: 'width 0.3s ease' }} />
                </div>
              )}
              <p style={{ fontSize: 10, color: zipStatus.error ? '#FF3B30' : c.t3, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                {zipStatus.currentName}
              </p>
            </div>

            {/* Close / Cancel Button */}
            {zipStatus.error ? (
              <button
                onClick={() => setZipStatus({ active: false, total: 0, current: 0, currentName: '', error: null })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 12,
                  border: 'none',
                  color: '#ffffff',
                  background: '#FF3B30',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(255,59,48,0.2)',
                  transition: 'all 0.2s'
                }}
              >
                Close
              </button>
            ) : zipStatus.current < zipStatus.total ? (
              <button
                onClick={() => {
                  zipCancelledRef.current = true;
                  setZipStatus({ active: false, total: 0, current: 0, currentName: '', error: null });
                  showToast('Backup download cancelled.', false);
                }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 12,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                  color: '#FF3B30',
                  background: 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Cancel Download
              </button>
            ) : (
              <button
                onClick={() => setZipStatus({ active: false, total: 0, current: 0, currentName: '', error: null })}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  borderRadius: 12,
                  border: 'none',
                  color: '#ffffff',
                  background: '#34C759',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(52,199,89,0.2)',
                  transition: 'all 0.2s'
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );

  if (selectedHospital) {
    const grad = selectedGrad || ACCENT_COLORS[0];
    const total     = hospitalAudits.length;
    const completed = hospitalAudits.filter(a => a.status === 'Completed').length;
    const active    = total - completed;

    // Extract available years from hospital audits
    const availableYears = Array.from(new Set(hospitalAudits.map(audit => {
      if (!audit.audit_date) return null;
      // audit_date is typically YYYY-MM-DD
      const parts = audit.audit_date.split('-');
      return parts[0];
    }).filter(Boolean))).sort((a, b) => b - a);

    // Filter audits based on search query, status segment, year, and date range
    const filteredAudits = hospitalAudits.filter(audit => {
      const matchesSearch =
        audit.name.toLowerCase().includes(auditSearch.toLowerCase()) ||
        (audit.created_by || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
        String(audit.id).includes(auditSearch);

      const matchesStatus =
        auditFilter === 'All' ||
        (auditFilter === 'Completed' && audit.status === 'Completed') ||
        (auditFilter === 'Active' && audit.status !== 'Completed');

      const matchesYear =
        auditYearFilter === 'All' ||
        (audit.audit_date && audit.audit_date.startsWith(auditYearFilter));

      let matchesDate = true;
      if (audit.audit_date) {
        if (auditFromDate && audit.audit_date < auditFromDate) {
          matchesDate = false;
        }
        if (auditToDate && audit.audit_date > auditToDate) {
          matchesDate = false;
        }
      } else {
        if (auditFromDate || auditToDate) {
          matchesDate = false;
        }
      }

      return matchesSearch && matchesStatus && matchesYear && matchesDate;
    });

  const AppleCalendar = ({
    label,
    value,
    onChange,
    isOpen,
    setIsOpen,
    calMonth,
    setCalMonth,
    calYear,
    setCalYear
  }) => {
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const startDay = new Date(calYear, calMonth, 1).getDay();
    
    const calendarCells = [];
    for (let i = 0; i < startDay; i++) {
      calendarCells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      calendarCells.push(d);
    }
    
    const handlePrevMonth = (e) => {
      e.stopPropagation();
      if (calMonth === 0) {
        setCalMonth(11);
        setCalYear(prev => prev - 1);
      } else {
        setCalMonth(prev => prev - 1);
      }
    };
    
    const handleNextMonth = (e) => {
      e.stopPropagation();
      if (calMonth === 11) {
        setCalMonth(0);
        setCalYear(prev => prev + 1);
      } else {
        setCalMonth(prev => prev + 1);
      }
    };

    const handleSelectDay = (day) => {
      const formattedMonth = String(calMonth + 1).padStart(2, '0');
      const formattedDay = String(day).padStart(2, '0');
      onChange(`${calYear}-${formattedMonth}-${formattedDay}`);
      setIsOpen(false);
    };

    const getDisplayValue = () => {
      if (!value) return "Select Date";
      const parts = value.split('-');
      if (parts.length !== 3) return value;
      const y = parts[0];
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      return `${months[m]} ${d}, ${y}`;
    };

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: c.t3 }}>{label}</span>
        
        <button
          onClick={() => {
            if (label === 'From') setShowToCal(false);
            else setShowFromCal(false);
            setIsOpen(!isOpen);
          }}
          style={{
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 8,
            border: `1px solid ${c.border}`,
            background: isDark ? '#2c2c2e' : '#ffffff',
            color: value ? c.t1 : c.t3,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: '120px',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            outline: 'none'
          }}
        >
          <Calendar style={{ width: 12, height: 12, color: value ? '#007AFF' : c.t3 }} />
          <span style={{ flex: 1, textAlign: 'left', marginLeft: 4 }}>{getDisplayValue()}</span>
          <ChevronDown style={{ width: 10, height: 10, color: c.t3 }} />
        </button>

        {isOpen && (
          <div
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 998,
              background: 'transparent'
            }}
          />
        )}

        {isOpen && (
          <div className="apple-animate-popover" style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: label === 'From' ? 0 : 'auto',
            right: label === 'To' ? 0 : 'auto',
            zIndex: 999,
            width: '230px',
            maxWidth: 'none',
            background: isDark ? 'rgba(28,28,30,0.88)' : 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
            borderRadius: 12,
            padding: '12px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
            userSelect: 'none'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <button onClick={handlePrevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007AFF', padding: 2 }}>
                <ChevronLeft style={{ width: 16, height: 16 }} />
              </button>
              <span style={{ fontSize: 12, fontWeight: 700, color: c.t1 }}>
                {months[calMonth]} {calYear}
              </span>
              <button onClick={handleNextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#007AFF', padding: 2 }}>
                <ChevronRight style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6, textAlign: 'center' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, idx) => (
                <span key={idx} style={{ fontSize: 9, fontWeight: 700, color: c.t3 }}>
                  {wd}
                </span>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
              {calendarCells.map((day, idx) => {
                if (day === null) {
                  return <div key={idx} style={{ width: 24, height: 24 }} />;
                }

                const formattedDate = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isSelected = value === formattedDate;

                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectDay(day)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      border: 'none',
                      background: isSelected ? '#007AFF' : 'transparent',
                      color: isSelected ? '#ffffff' : c.t1,
                      fontSize: 10,
                      fontWeight: isSelected ? '700' : '500',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                      transition: 'background 0.1s, color 0.1s'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="apple-animate-slide-in" style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Helvetica,Arial,sans-serif' }}>
      <style>{`
        @keyframes appleSlideIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes applePopoverEnter {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(-4px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .apple-animate-slide-in {
          animation: appleSlideIn 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .apple-animate-popover {
          animation: applePopoverEnter 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transform-origin: top;
        }
      `}</style>
      <Toast toast={toast} />

        {/* Navigation Breadcrumb */}
        <button
          onClick={() => setSelectedHospital(null)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            color: '#007AFF',
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 20,
            padding: 0
          }}
        >
          <ArrowLeft style={{ width: 16, height: 16 }} />
          Hospitals
        </button>

        {/* ── Hospital Profile Header Card ── */}
        <div style={{
          borderRadius: 20,
          overflow: 'hidden',
          marginBottom: 16,
          background: c.card,
          border: `1px solid ${c.border}`,
          boxShadow: isDark ? '0 10px 30px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.03)'
        }}>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Profile Icon */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: grad.light,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 2px 8px ${grad.light.replace('0.12', '0.2')}`,
                  border: `1px solid ${grad.solid}`
                }}>
                  <Building2 style={{ width: 20, height: 20, color: grad.solid }} />
                </div>
                <div>
                  <h1 style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.02em', color: c.t1, marginBottom: 2 }}>
                    {selectedHospital.name}
                  </h1>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {selectedHospital.location && (
                      <Row icon={<MapPin style={{ width: 11, height: 11, color: grad.solid }} />} text={selectedHospital.location} color={c.t2} />
                    )}
                    {selectedHospital.contact_number && (
                      <Row icon={<Phone style={{ width: 11, height: 11, color: grad.solid }} />} text={selectedHospital.contact_number} color={c.t3} />
                    )}
                  </div>
                </div>
              </div>

              {isPrivileged && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <InlineBtn
                    onClick={() => {
                      setEditTarget(selectedHospital);
                      setEditForm({
                        name: selectedHospital.name,
                        location: selectedHospital.location || '',
                        contact_number: selectedHospital.contact_number || ''
                      });
                    }}
                    label="Edit"
                    icon={<Edit3 style={{ width: 11, height: 11 }} />}
                    color="#007AFF"
                    bg="rgba(0,122,255,0.06)"
                    border="rgba(0,122,255,0.15)"
                  />
                  <InlineBtn
                    onClick={() => setDeleteTarget(selectedHospital)}
                    label="Delete"
                    icon={<Trash2 style={{ width: 11, height: 11 }} />}
                    color="#FF3B30"
                    bg="rgba(255,59,48,0.06)"
                    border="rgba(255,59,48,0.15)"
                  />
                </div>
              )}
            </div>

            {/* Stat Counters Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
              {[
                { n: total,     label: 'Total Audits', icon: BarChart3,   color: '#007AFF', bg: 'rgba(0,122,255,0.08)'   },
                { n: completed, label: 'Completed',    icon: CheckCircle2, color: '#34C759', bg: 'rgba(52,199,89,0.08)'  },
                { n: active,    label: 'In Progress',  icon: Activity,    color: '#FF9500', bg: 'rgba(255,149,0,0.08)'   },
              ].map(({ n, label, icon: Icon, color, bg }) => (
                <div
                  key={label}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.012)',
                    border: `1px solid ${c.border}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '74px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ ...SYS.labelSm, color: c.t3, fontSize: 9 }}>{label}</span>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon style={{ width: 18, height: 18, color }} />
                    </div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: c.t1, letterSpacing: '-0.02em', marginTop: 4 }}>
                    {n}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Audit Sessions History Panel ── */}
        <div style={{
          borderRadius: 24,
          overflow: 'visible',
          background: c.card,
          border: `1px solid ${c.border}`,
          boxShadow: isDark ? '0 12px 40px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,0,0,0.04)'
        }}>
          {/* Header & Controls bar */}
          <div style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${c.sep}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 14
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(0,122,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ClipboardList style={{ width: 12, height: 12, color: '#007AFF' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: c.t3 }}>
                  Audit History
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: 'rgba(0,122,255,0.1)', color: '#007AFF' }}>
                  {filteredAudits.length} of {total}
                </span>
              </div>
            </div>

            {/* Filter and Search Controls (Apple segmented picker) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {/* Search input */}
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <Search style={{ width: 14, height: 14, color: c.t3, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search audits by name, ID or author..."
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    fontSize: 12,
                    borderRadius: 10,
                    border: `1px solid ${c.border}`,
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    color: c.t1,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {auditSearch && (
                  <button
                    onClick={() => setAuditSearch('')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: c.t3,
                      padding: 0
                    }}
                  >
                    <X style={{ width: 12, height: 12 }} />
                  </button>
                )}
              </div>

              {/* Status Segmented Control */}
              <div style={{
                display: 'flex',
                background: isDark ? '#2c2c2e' : '#e3e3e8',
                padding: 2,
                borderRadius: 9,
                alignItems: 'center'
              }}>
                {['All', 'Active', 'Completed'].map(opt => {
                  const active = auditFilter === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAuditFilter(opt)}
                      style={{
                        padding: '6px 14px',
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 7,
                        border: 'none',
                        background: active ? (isDark ? '#545456' : '#ffffff') : 'transparent',
                        color: active ? c.t1 : c.t3,
                        boxShadow: active && !isDark ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.12s ease'
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {/* Year Select Control (Custom Apple Popover) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: c.t3 }}>Year:</span>
                
                {/* Trigger Button */}
                <button
                  onClick={() => setShowYearMenu(!showYearMenu)}
                  style={{
                    padding: '6px 24px 6px 12px',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: `1px solid ${c.border}`,
                    background: isDark ? '#2c2c2e' : '#ffffff',
                    color: c.t1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    position: 'relative',
                    minWidth: '100px',
                    textAlign: 'left',
                    justifyContent: 'space-between',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    outline: 'none'
                  }}
                >
                  <span>{auditYearFilter === 'All' ? 'All Years' : auditYearFilter}</span>
                  <ChevronDown style={{ width: 12, height: 12, color: c.t3, position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }} />
                </button>

                {/* Dismiss backdrop */}
                {showYearMenu && (
                  <div
                    onClick={() => setShowYearMenu(false)}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 998,
                      background: 'transparent'
                    }}
                  />
                )}

                {/* Dropdown Popover */}
                {showYearMenu && (
                  <div className="apple-animate-popover" style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    zIndex: 999,
                    minWidth: '130px',
                    background: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                    borderRadius: 10,
                    padding: '4px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2
                  }}>
                    {/* All Years Item */}
                    <button
                      onClick={() => {
                        setAuditYearFilter('All');
                        setShowYearMenu(false);
                      }}
                      style={{
                        padding: '6px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: c.t1,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        width: '100%',
                        transition: 'background 0.1s, color 0.1s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = '#007AFF';
                        e.currentTarget.style.color = '#ffffff';
                        const checkIcon = e.currentTarget.querySelector('svg');
                        if (checkIcon) checkIcon.style.color = '#ffffff';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = c.t1;
                        const checkIcon = e.currentTarget.querySelector('svg');
                        if (checkIcon) checkIcon.style.color = '#007AFF';
                      }}
                    >
                      <span>All Years</span>
                      {auditYearFilter === 'All' && <Check style={{ width: 12, height: 12, color: '#007AFF' }} />}
                    </button>

                    {/* Available Years list */}
                    {availableYears.map(yr => (
                      <button
                        key={yr}
                        onClick={() => {
                          setAuditYearFilter(yr);
                          setShowYearMenu(false);
                        }}
                        style={{
                          padding: '6px 8px',
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: 'none',
                          background: 'transparent',
                          color: c.t1,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          width: '100%',
                          transition: 'background 0.1s, color 0.1s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = '#007AFF';
                          e.currentTarget.style.color = '#ffffff';
                          const checkIcon = e.currentTarget.querySelector('svg');
                          if (checkIcon) checkIcon.style.color = '#ffffff';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = c.t1;
                          const checkIcon = e.currentTarget.querySelector('svg');
                          if (checkIcon) checkIcon.style.color = '#007AFF';
                        }}
                      >
                        <span>{yr}</span>
                        {auditYearFilter === yr && <Check style={{ width: 12, height: 12, color: '#007AFF' }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Date range controls row */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              alignItems: 'center',
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
              padding: '8px 12px',
              borderRadius: 12,
              border: `1px solid ${c.border}`,
              marginTop: 4
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: c.t3, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Calendar style={{ width: 12, height: 12, color: '#007AFF' }} />
                Filter by Date:
              </span>

              {/* From Date input card */}
              <AppleCalendar
                label="From"
                value={tempFromDate}
                onChange={setTempFromDate}
                isOpen={showFromCal}
                setIsOpen={setShowFromCal}
                calMonth={fromCalMonth}
                setCalMonth={setFromCalMonth}
                calYear={fromCalYear}
                setCalYear={setFromCalYear}
              />

              {/* To Date input card */}
              <AppleCalendar
                label="To"
                value={tempToDate}
                onChange={setTempToDate}
                isOpen={showToCal}
                setIsOpen={setShowToCal}
                calMonth={toCalMonth}
                setCalMonth={setToCalMonth}
                calYear={toCalYear}
                setCalYear={setToCalYear}
              />

              {/* Apply Button */}
              {(tempFromDate !== auditFromDate || tempToDate !== auditToDate) && (
                <button
                  onClick={() => {
                    setAuditFromDate(tempFromDate);
                    setAuditToDate(tempToDate);
                  }}
                  style={{
                    padding: '5px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    background: '#007AFF',
                    color: '#ffffff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    boxShadow: '0 2px 6px rgba(0,122,255,0.2)',
                    transition: 'opacity 0.1s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 0.9}
                  onMouseLeave={e => e.currentTarget.style.opacity = 1}
                >
                  Apply
                </button>
              )}

              {/* Clear button if active filter is applied */}
              {(auditFromDate || auditToDate || tempFromDate || tempToDate) && (
                <button
                  onClick={() => {
                    setTempFromDate('');
                    setTempToDate('');
                    setAuditFromDate('');
                    setAuditToDate('');
                  }}
                  style={{
                    padding: '5px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    borderRadius: 6,
                    border: 'none',
                    background: 'rgba(255,59,48,0.1)',
                    color: '#FF3B30',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    marginLeft: 'auto',
                    transition: 'opacity 0.1s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                  onMouseLeave={e => e.currentTarget.style.opacity = 1}
                >
                  <X style={{ width: 11, height: 11 }} />
                  Clear Dates
                </button>
              )}
            </div>
          </div>

          {/* Audit List Container */}
          <div style={{ padding: '8px 0' }}>
            {loadingAudits ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                <RefreshCw style={{ width: 22, height: 22, color: '#007AFF' }} className="animate-spin" />
              </div>
            ) : filteredAudits.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 16px' }}>
                <Package style={{ width: 44, height: 44, margin: '0 auto 12px', opacity: 0.15, color: c.t1 }} />
                <p style={{ fontSize: 14, fontWeight: 700, color: c.t2 }}>
                  {auditSearch ? 'No matching audits found' : 'No audit sessions yet'}
                </p>
                <p style={{ fontSize: 11, marginTop: 4, color: c.t3 }}>
                  {auditSearch ? 'Try checking your spelling or selecting another filter.' : 'New audit sessions will be displayed here once created.'}
                </p>
              </div>
            ) : (
              <div>
                {filteredAudits.map((audit, i) => {
                  const done = audit.status === 'Completed';
                  return (
                    <div key={audit.id}>
                      {i > 0 && <div style={{ height: 1, background: c.sep, marginLeft: 64 }} />}
                      <div
                        onClick={() => onSelectAudit && onSelectAudit(audit)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          padding: '14px 24px',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.015)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        {/* Status Icon */}
                        <div style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          flexShrink: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: done ? 'rgba(52,199,89,0.12)' : 'rgba(0,122,255,0.1)'
                        }}>
                          {done ? <Lock style={{ width: 15, height: 15, color: '#34C759' }} /> : <Clock3 style={{ width: 15, height: 15, color: '#007AFF' }} />}
                        </div>

                        {/* Title & Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: c.t1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {audit.name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: c.t3, display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Calendar style={{ width: 11, height: 11 }} />
                              {audit.audit_date}
                            </span>
                            {audit.created_by && (
                              <span style={{ fontSize: 11, color: c.t3 }}>
                                · Auditor: {audit.created_by}
                              </span>
                            )}
                            <span style={{ fontSize: 10, color: c.t3, fontFamily: 'monospace' }}>
                              · ID: {audit.id}
                            </span>
                          </div>
                        </div>

                        {/* Status badge & chevron */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span style={{
                            padding: '3px 10px',
                            borderRadius: 20,
                            fontSize: 9,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                            background: done ? 'rgba(52,199,89,0.12)' : 'rgba(0,122,255,0.1)',
                            color: done ? '#34C759' : '#007AFF'
                          }}>
                            {done ? 'Completed' : 'Active'}
                          </span>
                          <ChevronRight style={{ width: 16, height: 16, color: c.t3 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════════
     MAIN LIST VIEW
     ═══════════════════════════════════════════════════════════════════════ */
  const filteredHospitals = hospitals.filter(h => {
    const query = hospitalSearch.toLowerCase();
    return h.name.toLowerCase().includes(query) ||
           (h.location || '').toLowerCase().includes(query) ||
           (h.contact_number || '').includes(query);
  });

  return (
    <div className="apple-animate-slide-in" style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",Helvetica,Arial,sans-serif' }}>
      <Toast toast={toast} />

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h2 style={{ ...SYS.title3, color: c.t1, marginBottom:3 }}>Hospitals</h2>
          <p style={{ ...SYS.caption, color: c.t3 }}>
            {filteredHospitals.length} of {hospitals.length} location{hospitals.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={fetchHospitals} style={{ width:34, height:34, borderRadius:10, border:`1px solid ${c.border}`, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            <RefreshCw style={{ width:14, height:14, color: c.t3 }} />
          </button>
          {isPrivileged && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:12, fontSize:13, fontWeight:600, cursor:'pointer', color:'#fff', border:'none', background:'#007AFF', boxShadow:'0 2px 10px rgba(0,122,255,0.35)' }}
            >
              <Plus style={{ width:14, height:14 }} />
              Add Hospital
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div style={{ position: 'relative', marginBottom: 20 }}>
        <Search style={{ width: 16, height: 16, color: c.t3, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input
          type="text"
          placeholder="Search hospitals by name, location or contact..."
          value={hospitalSearch}
          onChange={e => setHospitalSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 16px 10px 38px',
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 12,
            border: `1px solid ${c.border}`,
            background: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
            color: c.t1,
            outline: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
            boxSizing: 'border-box'
          }}
        />
        {hospitalSearch && (
          <button
            onClick={() => setHospitalSearch('')}
            style={{
              position: 'absolute',
               right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: c.t3,
              padding: 0
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {/* Add form */}
      {isPrivileged && (
        <div style={{
          maxHeight: showAddForm ? '300px' : '0px',
          opacity: showAddForm ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease'
        }}>
          <div style={{
            padding: '20px',
            marginBottom: '20px',
            borderRadius: '16px',
            background: isDark ? '#1c1c1e' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(0,122,255,0.25)' : 'rgba(0,122,255,0.18)'}`,
            borderLeft: '4px solid #007AFF',
            boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,122,255,0.06)',
            marginTop: '4px'
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: c.t1, marginBottom: 14 }}>New Hospital</p>
            <form onSubmit={handleAdd}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 10, marginBottom: 14 }}>
                {[['Name *','name','Kukatpally',true],['Location','location','City, State',false],['Contact','contact_number','+91 9XXXXXXXXX',false]].map(([label,field,ph,req]) => (
                  <div key={field}>
                    <label style={{ ...SYS.labelSm, color: c.t3, display: 'block', marginBottom: 5 }}>{label}</label>
                    <input
                      required={!!req}
                      placeholder={ph}
                      value={newHospital[field]}
                      onChange={e => setNewHospital({ ...newHospital, [field]: e.target.value })}
                      style={{
                        width: '100%',
                        background: isDark ? '#3a3a3c' : '#ffffff',
                        border: `1px solid ${c.border}`,
                        borderRadius: 10,
                        padding: '9px 12px',
                        fontSize: 13,
                        color: c.t1,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  style={{
                    ...ghostBtn(c),
                    flex: 'none',
                    minWidth: '90px',
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    border: `1px solid ${c.border}`,
                    color: c.t1
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    ...primaryBtnStyle,
                    flex: 'none',
                    minWidth: '110px',
                    background: '#007AFF',
                    boxShadow: '0 2px 8px rgba(0,122,255,0.25)'
                  }}
                >
                  Add Hospital
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hospital list — grouped in an iOS-style section card */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:'64px 0' }}>
          <RefreshCw style={{ width:22, height:22, color:'#007AFF' }} className="animate-spin" />
        </div>
      ) : filteredHospitals.length === 0 ? (
        <div style={{ textAlign:'center', padding:'64px 0' }}>
          <Building2 style={{ width:40, height:40, margin:'0 auto 12px', opacity:0.15, color: c.t1 }} />
          <p style={{ fontSize:14, fontWeight:600, color: c.t3 }}>
            {hospitalSearch ? 'No matching hospitals found' : 'No hospitals yet'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '24px' }}>
          {filteredHospitals.map((hospital, idx) => {
            const grad = ACCENT_COLORS[idx % ACCENT_COLORS.length];

            return (
              <div
                key={hospital.id}
                onClick={() => openHospital(hospital, grad)}
                style={{
                  borderRadius: 22,
                  background: isDark ? '#1c1c1e' : '#ffffff',
                  border: isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.08)',
                  boxShadow: isDark ? '0 12px 30px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.04)',
                  padding: '20px 20px 16px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '320px',
                  transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-6px)';
                  e.currentTarget.style.boxShadow = isDark ? '0 18px 48px rgba(0,0,0,0.6)' : '0 18px 36px rgba(0,0,0,0.08)';
                  e.currentTarget.style.borderColor = grad.solid;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = isDark ? '0 12px 30px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.04)';
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.08)';
                }}
              >
                {/* Lanyard punch slot at the top center */}
                <div style={{
                  width: '38px',
                  height: '8px',
                  borderRadius: '4px',
                  background: isDark ? '#2c2c2e' : '#e5e5ea',
                  margin: '0 auto 14px',
                  boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.12)'
                }} />

                {/* Profile Avatar: Medical/Hospital Emblem */}
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: grad.light,
                  border: `2px solid ${grad.solid}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.04)',
                  flexShrink: 0
                }}>
                  <Building2 style={{ width: '28px', height: '28px', color: grad.solid }} />
                </div>

                {/* Centered Hospital Details */}
                <div style={{ textAlign: 'center', flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: c.t1, marginBottom: '6px', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    {hospital.name}
                  </h3>
                  {hospital.location && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: '600',
                      color: grad.solid,
                      background: grad.light,
                      padding: '3px 10px',
                      borderRadius: '20px',
                      margin: '0 auto 8px'
                    }}>
                      <MapPin style={{ width: '10px', height: '10px' }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }}>
                        {hospital.location}
                      </span>
                    </div>
                  )}
                  {hospital.contact_number && (
                    <div style={{ fontSize: '10px', color: c.t3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                      <Phone style={{ width: 10, height: 10 }} />
                      {hospital.contact_number}
                    </div>
                  )}
                </div>

                {/* Simulated Barcode */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '14px', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', gap: '2px', height: '20px', alignItems: 'center', opacity: isDark ? 0.35 : 0.65 }}>
                    <div style={{ width: '2px', height: '100%', background: c.t1 }} />
                    <div style={{ width: '1px', height: '100%', background: c.t1 }} />
                    <div style={{ width: '3px', height: '100%', background: c.t1 }} />
                    <div style={{ width: '1px', height: '100%', background: c.t1 }} />
                    <div style={{ width: '4px', height: '100%', background: c.t1 }} />
                    <div style={{ width: '1px', height: '100%', background: c.t1 }} />
                    <div style={{ width: '2px', height: '100%', background: c.t1 }} />
                    <div style={{ width: '5px', height: '100%', background: c.t1 }} />
                    <div style={{ width: '1px', height: '100%', background: c.t1 }} />
                    <div style={{ width: '3px', height: '100%', background: c.t1 }} />
                    <div style={{ width: '2px', height: '100%', background: c.t1 }} />
                  </div>
                  <span style={{ fontSize: '9px', fontFamily: 'monospace', color: c.t3, marginTop: '4px', letterSpacing: '0.08em' }}>
                    HOSP-ID-0{hospital.id}
                  </span>
                </div>

                {/* Card Footer Actions */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: `1px solid ${c.sep}`,
                  flexShrink: 0
                }}>
                  <span style={{ fontSize: '11px', fontWeight: '700', color: grad.solid, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                    View Records <ChevronRight style={{ width: '12px', height: '12px' }} />
                  </span>

                  {isPrivileged && (
                    <div style={{ display: 'flex', gap: '6px' }} onClick={e => e.stopPropagation()}>
                      <IconPill
                        onClick={() => {
                          setEditTarget(hospital);
                          setEditForm({
                            name: hospital.name,
                            location: hospital.location || '',
                            contact_number: hospital.contact_number || ''
                          });
                        }}
                        color={grad.solid}
                        bg={grad.light}
                      >
                        <Edit3 style={{ width: '12px', height: '12px' }} />
                      </IconPill>
                      <IconPill
                        onClick={() => setDeleteTarget(hospital)}
                        color="#FF3B30"
                        bg="rgba(255,59,48,0.08)"
                      >
                        <Trash2 style={{ width: '12px', height: '12px' }} />
                      </IconPill>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {renderModals()}
    </div>
  );
}

/* ─── Tiny helper components ────────────────────────────────────────────── */
function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ position:'fixed', bottom:28, left:'50%', transform:'translateX(-50%)', zIndex:9999, padding:'10px 20px', borderRadius:50, fontSize:13, fontWeight:600, color:'#fff', background: toast.ok ? 'rgba(52,199,89,0.92)' : 'rgba(255,59,48,0.92)', backdropFilter:'blur(12px)', boxShadow:'0 4px 24px rgba(0,0,0,0.25)', whiteSpace:'nowrap' }}>
      {toast.text}
    </div>
  );
}

function Backdrop({ children, onClose }) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)', WebkitBackdropFilter:'blur(4px)' }}
      onClick={onClose}>
      {children}
    </div>,
    document.fullscreenElement || document.body
  );
}

function Sheet({ children, isDark, c, width = 400 }) {
  return (
    <div style={{ width:'100%', maxWidth: width, borderRadius:24, padding:'24px', background: isDark ? '#1c1c1e' : '#ffffff', border:`1px solid ${c.border}`, boxShadow:'0 24px 80px rgba(0,0,0,0.45)' }}
      onClick={e => e.stopPropagation()}>
      {children}
    </div>
  );
}

function SheetHeader({ title, onClose, c }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
      <p style={{ fontSize:17, fontWeight:700, color: c.t1 }}>{title}</p>
      <button onClick={onClose} style={{ width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', background: c.card2 || 'rgba(0,0,0,0.06)', border:'none', cursor:'pointer' }}>
        <X style={{ width:14, height:14, color: c.t3 }} />
      </button>
    </div>
  );
}

function FieldRow({ label, children, isDark, c }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block', fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.055em', color: c.t3, marginBottom:6 }}>{label}</label>
      {children}
    </div>
  );
}

function PrimaryBtn({ onClick, label }) {
  return (
    <button onClick={onClick} style={{ ...primaryBtnStyle, width:'100%', marginTop:8 }}>{label}</button>
  );
}

function SectionCard({ title, badge, children, isDark, c }) {
  return (
    <div style={{ borderRadius:20, overflow:'hidden', background: c.card, border:`1px solid ${c.border}`, boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 2px 14px rgba(0,0,0,0.06)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'14px 18px', borderBottom:`1px solid ${c.sep}` }}>
        <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.055em', color: c.t3 }}>{title}</span>
        {badge && <span style={{ marginLeft:'auto', padding:'2px 9px', borderRadius:20, fontSize:10, fontWeight:700, background:'rgba(0,122,255,0.1)', color:'#007AFF' }}>{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Row({ icon, text, color }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, color }}>
      {icon}{text}
    </div>
  );
}

function InlineBtn({ onClick, label, icon, color, bg, border }) {
  return (
    <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 12px', borderRadius:9, fontSize:11, fontWeight:600, cursor:'pointer', color, background: bg, border:`1px solid ${border}` }}>
      {icon}{label}
    </button>
  );
}

function IconPill({ onClick, color, bg, children }) {
  return (
    <button onClick={onClick} style={{ width:30, height:30, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color, background: bg, border:'none' }}>
      {children}
    </button>
  );
}

const primaryBtnStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '11px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700,
  cursor: 'pointer', color: '#ffffff', border: 'none',
  background: '#007AFF', boxShadow: '0 2px 10px rgba(0,122,255,0.35)'
};

const ghostBtn = (c) => ({
  flex: 1, padding: '11px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', background: 'transparent',
  border: `1px solid ${c.border}`, color: c.t3
});
