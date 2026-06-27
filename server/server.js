require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { supabase, initDb } = require('./db');
const { importExcel } = require('./import');
const { generateExcelBuffer, calculateItemValues } = require('./export');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Set up file upload destination
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// Ensure uploads folder exists
if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// -------------------------------------------------------------
// USER ROUTES
// -------------------------------------------------------------
app.get('/api/users', async (req, res) => {
  try {
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// AUDIT SESSION ROUTES
// -------------------------------------------------------------
app.get('/api/audits', async (req, res) => {
  try {
    // Fetch sessions
    const { data: sessions, error: sErr } = await supabase
      .from('audit_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (sErr) throw sErr;

    // Fetch item counts and values per session
    const { data: items, error: iErr } = await supabase
      .from('items')
      .select('audit_session_id, system_qty, unit_purchase_rate');
    if (iErr) throw iErr;

    // Aggregate
    const sessionMap = {};
    items.forEach(item => {
      if (!sessionMap[item.audit_session_id]) {
        sessionMap[item.audit_session_id] = { count: 0, value: 0 };
      }
      sessionMap[item.audit_session_id].count += 1;
      sessionMap[item.audit_session_id].value += (item.system_qty || 0) * (item.unit_purchase_rate || 0);
    });

    const result = sessions.map(s => ({
      ...s,
      total_items: sessionMap[s.id]?.count || 0,
      total_stock_value: sessionMap[s.id]?.value || 0
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audits', async (req, res) => {
  const { name, audit_date } = req.body;
  if (!name || !audit_date) {
    return res.status(400).json({ error: 'Name and audit date are required.' });
  }
  try {
    const { data, error } = await supabase
      .from('audit_sessions')
      .insert([{ name, audit_date, status: 'Active', created_at: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/audits/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { error } = await supabase.from('audit_sessions').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// EXCEL IMPORT ROUTE
// -------------------------------------------------------------
app.post('/api/audits/:id/import', upload.single('file'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }
  const filePath = req.file.path;
  try {
    console.log(`Starting Excel import for audit session ${id} from file ${req.file.originalname}`);
    const count = await importExcel(id, filePath);
    fs.unlinkSync(filePath);
    res.json({ success: true, imported_rows: count });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add manual item registration (Extra Found items)
app.post('/api/audits/:id/items', async (req, res) => {
  const { id } = req.params;
  const {
    item_name, batch_no, expiry_date, unit_mrp, unit_purchase_rate,
    system_qty, supplier, location, store_name, notes
  } = req.body;

  if (!item_name || !batch_no || !unit_purchase_rate) {
    return res.status(400).json({ error: 'Item name, batch number, and unit purchase rate are required.' });
  }

  try {
    const { data, error } = await supabase
      .from('items')
      .insert([{
        audit_session_id: parseInt(id),
        item_name,
        batch_no,
        expiry_date: expiry_date || '',
        unit_mrp: Number(unit_mrp || 0),
        unit_purchase_rate: Number(unit_purchase_rate),
        system_qty: Number(system_qty || 0),
        supplier: supplier || '',
        location: location || '',
        store_name: store_name || '',
        notes: notes || ''
      }])
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// AUDIT ITEMS & COLLABORATION ROUTES
// -------------------------------------------------------------
app.get('/api/audits/:id/items', async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const search = req.query.search || '';
  const categoryFilter = req.query.category || '';
  const supplierFilter = req.query.supplier || '';
  const locationFilter = req.query.location || '';
  const storeFilter = req.query.store || '';
  const offset = (page - 1) * limit;

  try {
    // Verify session exists
    const { data: session, error: sErr } = await supabase
      .from('audit_sessions')
      .select('*')
      .eq('id', id)
      .single();
    if (sErr || !session) return res.status(404).json({ error: 'Session not found' });

    // Build items query with filters
    let query = supabase.from('items').select('*').eq('audit_session_id', id);
    if (search) {
      query = query.or(`item_name.ilike.%${search}%,batch_no.ilike.%${search}%,supplier.ilike.%${search}%`);
    }
    if (supplierFilter) query = query.eq('supplier', supplierFilter);
    if (locationFilter) query = query.eq('location', locationFilter);
    if (storeFilter) query = query.eq('store_name', storeFilter);

    const { data: itemsList, error: iErr } = await query.order('item_name', { ascending: true });
    if (iErr) throw iErr;

    // Fetch all auditor counts for this session
    const { data: allCounts, error: cErr } = await supabase
      .from('auditor_counts')
      .select('*')
      .in('item_id', itemsList.map(i => i.id));
    if (cErr) throw cErr;

    // Group counts by item_id
    const countsByItem = {};
    (allCounts || []).forEach(c => {
      if (!countsByItem[c.item_id]) countsByItem[c.item_id] = [];
      countsByItem[c.item_id].push(c);
    });

    // Calculate fields + category per item
    let processedList = itemsList.map(item => {
      const itemCounts = countsByItem[item.id] || [];
      const auditorTotal = itemCounts.reduce((sum, c) => sum + (c.physical_count || 0), 0);
      const hasExpiredCheck = itemCounts.some(c => c.expiry_check === true || c.expiry_check === 1);
      const totalPhysical = auditorTotal + Number(item.manual_add || 0) + Number(item.manual_recheck || 0);
      const difference = totalPhysical - (item.system_qty || 0);
      const differenceValue = difference * (item.unit_purchase_rate || 0);

      let category = 'Perfect Match';
      let isExpired = false;
      if (item.expiry_date) {
        if (new Date(item.expiry_date) < new Date(session.audit_date)) isExpired = true;
      }
      if (hasExpiredCheck) isExpired = true;

      if (isExpired && totalPhysical > 0) {
        category = 'Expired Stock';
      } else if (item.system_qty === 0 && totalPhysical > 0) {
        category = 'Extra Found';
      } else if (item.notes && item.notes.startsWith('OT')) {
        category = 'Other';
      } else if (difference > 0) {
        category = 'Excess';
      } else if (difference < 0) {
        category = 'Shortage';
      }

      return { ...item, totalPhysical, difference, differenceValue, category, counts: itemCounts };
    });

    // Apply category filter in JS
    if (categoryFilter) {
      processedList = processedList.filter(item => item.category === categoryFilter);
    }

    const totalCount = processedList.length;
    const paginatedList = processedList.slice(offset, offset + limit);

    // Get filter metadata (unique suppliers/locations/stores)
    const { data: allItems } = await supabase
      .from('items')
      .select('supplier, location, store_name')
      .eq('audit_session_id', id);

    const suppliers = [...new Set((allItems || []).map(i => i.supplier).filter(Boolean))];
    const locations = [...new Set((allItems || []).map(i => i.location).filter(Boolean))];
    const stores = [...new Set((allItems || []).map(i => i.store_name).filter(Boolean))];

    res.json({
      items: paginatedList,
      total: totalCount,
      page,
      limit,
      meta: { suppliers, locations, stores }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Auditor Count
app.post('/api/items/:id/counts', async (req, res) => {
  const { id } = req.params;
  const { auditor_name, physical_count, expiry_check, remarks } = req.body;

  if (!auditor_name || physical_count === undefined) {
    return res.status(400).json({ error: 'Auditor name and physical count are required.' });
  }

  try {
    const { data: item, error: iErr } = await supabase.from('items').select('*').eq('id', id).single();
    if (iErr || !item) return res.status(404).json({ error: 'Item not found' });
    if (item.is_locked) {
      return res.status(403).json({ error: 'This row is locked and cannot be edited.' });
    }

    // Get old count if any
    const { data: oldCount } = await supabase
      .from('auditor_counts')
      .select('*')
      .eq('item_id', id)
      .eq('auditor_name', auditor_name)
      .single();

    // Upsert count
    const { error: upsertErr } = await supabase
      .from('auditor_counts')
      .upsert([{
        item_id: parseInt(id),
        auditor_name,
        physical_count: parseInt(physical_count),
        expiry_check: expiry_check ? true : false,
        remarks: remarks || '',
        updated_at: new Date().toISOString()
      }], { onConflict: 'item_id,auditor_name' });
    if (upsertErr) throw upsertErr;

    // Log trail if changed
    const oldVal = oldCount ? `${oldCount.physical_count} (Exp:${oldCount.expiry_check ? 1 : 0})` : 'None';
    const newVal = `${physical_count} (Exp:${expiry_check ? 1 : 0})`;
    if (oldVal !== newVal) {
      await supabase.from('audit_trail').insert([{
        item_id: parseInt(id),
        user_name: auditor_name,
        timestamp: new Date().toISOString(),
        field_name: `Auditor Count (${auditor_name})`,
        old_value: oldVal,
        new_value: newVal,
        reason: 'Count update'
      }]);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Item Adjustments / Manual Inputs
app.put('/api/items/:id', async (req, res) => {
  const { id } = req.params;
  const { manual_add, manual_recheck, notes, user_name, reason } = req.body;

  try {
    const { data: item, error: iErr } = await supabase.from('items').select('*').eq('id', id).single();
    if (iErr || !item) return res.status(404).json({ error: 'Item not found' });
    if (item.is_locked) {
      return res.status(403).json({ error: 'This row is locked. Only Audit Managers can make edits.' });
    }

    const trailEntries = [];

    if (manual_add !== undefined && Number(manual_add) !== Number(item.manual_add)) {
      await supabase.from('items').update({ manual_add: Number(manual_add) }).eq('id', id);
      trailEntries.push({
        item_id: parseInt(id), user_name: user_name || 'System',
        timestamp: new Date().toISOString(), field_name: 'Manual Add',
        old_value: String(item.manual_add), new_value: String(manual_add),
        reason: reason || 'Adjustment'
      });
    }

    if (manual_recheck !== undefined && Number(manual_recheck) !== Number(item.manual_recheck)) {
      await supabase.from('items').update({ manual_recheck: Number(manual_recheck) }).eq('id', id);
      trailEntries.push({
        item_id: parseInt(id), user_name: user_name || 'System',
        timestamp: new Date().toISOString(), field_name: 'Manual Recheck',
        old_value: String(item.manual_recheck), new_value: String(manual_recheck),
        reason: reason || 'Adjustment'
      });
    }

    if (notes !== undefined && notes !== item.notes) {
      await supabase.from('items').update({ notes }).eq('id', id);
      trailEntries.push({
        item_id: parseInt(id), user_name: user_name || 'System',
        timestamp: new Date().toISOString(), field_name: 'Notes',
        old_value: item.notes || '', new_value: notes,
        reason: reason || 'Notes update'
      });
    }

    if (trailEntries.length > 0) {
      await supabase.from('audit_trail').insert(trailEntries);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lock/Unlock Item Row
app.post('/api/items/:id/lock', async (req, res) => {
  const { id } = req.params;
  const { is_locked, user_name, reason } = req.body;

  if (is_locked === undefined || !user_name || !reason) {
    return res.status(400).json({ error: 'is_locked, user_name, and reason are required.' });
  }

  try {
    const { data: item, error: iErr } = await supabase.from('items').select('*').eq('id', id).single();
    if (iErr || !item) return res.status(404).json({ error: 'Item not found' });

    await supabase.from('items').update({ is_locked: !!is_locked }).eq('id', id);

    await supabase.from('audit_trail').insert([{
      item_id: parseInt(id),
      user_name,
      timestamp: new Date().toISOString(),
      field_name: 'Row Lock State',
      old_value: item.is_locked ? 'Locked' : 'Unlocked',
      new_value: is_locked ? 'Locked' : 'Unlocked',
      reason
    }]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// ITEM HISTORY ROUTE
// -------------------------------------------------------------
app.get('/api/items/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase
      .from('audit_trail')
      .select('*')
      .eq('item_id', id)
      .order('timestamp', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// SUMMARY DASHBOARD ROUTE
// -------------------------------------------------------------
app.get('/api/audits/:id/dashboard', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: session, error: sErr } = await supabase
      .from('audit_sessions').select('*').eq('id', id).single();
    if (sErr || !session) return res.status(404).json({ error: 'Session not found' });

    const { data: items, error: iErr } = await supabase
      .from('items').select('*').eq('audit_session_id', id);
    if (iErr) throw iErr;

    const { data: allCounts, error: cErr } = await supabase
      .from('auditor_counts')
      .select('*')
      .in('item_id', (items || []).map(i => i.id));
    if (cErr) throw cErr;

    const countsByItem = {};
    (allCounts || []).forEach(c => {
      if (!countsByItem[c.item_id]) countsByItem[c.item_id] = [];
      countsByItem[c.item_id].push(c);
    });

    const sessionDate = session.audit_date;
    const processedItems = (items || []).map(item => {
      const itemCounts = countsByItem[item.id] || [];
      return calculateItemValues(item, itemCounts, sessionDate);
    });

    const totalItems = processedItems.length;
    const itemsAudited = processedItems.filter(item => item.totalPhysical > 0).length;
    const totalStockValue = processedItems.reduce((sum, item) => sum + ((item.system_qty || 0) * (item.unit_purchase_rate || 0)), 0);
    const totalExcessValue = processedItems.filter(i => i.category === 'Excess').reduce((sum, i) => sum + i.differenceValue, 0);
    const totalShortageValue = processedItems.filter(i => i.category === 'Shortage').reduce((sum, i) => sum + i.differenceValue, 0);
    const extraFoundValue = processedItems.filter(i => i.category === 'Extra Found').reduce((sum, i) => sum + (i.totalPhysical * (i.unit_purchase_rate || 0)), 0);
    const expiredValue = processedItems.filter(i => i.category === 'Expired Stock').reduce((sum, i) => sum + (i.totalPhysical * (i.unit_purchase_rate || 0)), 0);
    const otValue = processedItems.filter(i => i.category === 'Other').reduce((sum, i) => sum + i.differenceValue, 0);
    const grossShortage = totalExcessValue + totalShortageValue;
    const netShortage = grossShortage + extraFoundValue;

    const categoryBreakdown = {
      'Excess': processedItems.filter(i => i.category === 'Excess').length,
      'Shortage': processedItems.filter(i => i.category === 'Shortage').length,
      'Extra Found': processedItems.filter(i => i.category === 'Extra Found').length,
      'Expired Stock': processedItems.filter(i => i.category === 'Expired Stock').length,
      'Other': processedItems.filter(i => i.category === 'Other').length,
      'Perfect Match': processedItems.filter(i => i.category === 'Perfect Match').length
    };

    const locationBreakdown = {};
    const supplierBreakdown = {};
    processedItems.forEach(i => {
      const loc = i.location || 'Unknown';
      const sup = i.supplier || 'Unknown';
      locationBreakdown[loc] = (locationBreakdown[loc] || 0) + i.differenceValue;
      supplierBreakdown[sup] = (supplierBreakdown[sup] || 0) + i.differenceValue;
    });

    res.json({
      totalItems, itemsAudited, totalStockValue,
      totalExcessValue, totalShortageValue, extraFoundValue,
      expiredValue, otValue, grossShortage, netShortage,
      categoryBreakdown, locationBreakdown, supplierBreakdown
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// REPORT EXPORT ROUTE
// -------------------------------------------------------------
app.get('/api/audits/:id/export', async (req, res) => {
  const { id } = req.params;
  try {
    const buffer = await generateExcelBuffer(id);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Audit_Report_Session_${id}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// AUDIT TRAIL / CHANGE LOG ROUTE
// -------------------------------------------------------------
app.get('/api/audits/:id/trail', async (req, res) => {
  const { id } = req.params;
  try {
    // Fetch items in session
    const { data: items, error: iErr } = await supabase
      .from('items').select('id, item_name, batch_no').eq('audit_session_id', id);
    if (iErr) throw iErr;

    const itemIds = (items || []).map(i => i.id);
    if (itemIds.length === 0) return res.json([]);

    const { data: trail, error: tErr } = await supabase
      .from('audit_trail')
      .select('*')
      .in('item_id', itemIds)
      .order('timestamp', { ascending: false });
    if (tErr) throw tErr;

    // Attach item_name and batch_no
    const itemMap = {};
    (items || []).forEach(i => { itemMap[i.id] = i; });
    const enriched = (trail || []).map(t => ({
      ...t,
      item_name: itemMap[t.item_id]?.item_name || '',
      batch_no: itemMap[t.item_id]?.batch_no || ''
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start backend server
app.listen(PORT, async () => {
  await initDb();
  console.log(`Backend server running on port ${PORT}`);
});
