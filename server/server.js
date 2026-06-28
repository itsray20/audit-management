require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { supabase, initDb } = require('./db');
const { importExcel } = require('./import');
const { generateExcelBuffer, generateWordReport, calculateItemValues } = require('./export');

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
// USER & AUTHENTICATION ROUTES
// -------------------------------------------------------------

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // name field is encoded as: "DisplayName|Password|AuditorSlot"
    // e.g. "Sathya|user223|User2" or "Srikant|srikant123|Admin"
    const parts = (user.name || '').split('|');
    const cleanName = parts[0] || user.username;
    const storedPassword = parts[1] || '';
    // The 3rd field is the auditor slot (Admin/User1..User5). Fall back to DB role.
    const auditorSlot = parts[2] || user.role;

    if (storedPassword === password) {
      res.json({
        id: user.id,
        username: user.username,
        name: cleanName,
        role: auditorSlot  // Admin | User1 | User2 | User3 | User4 | User5
      });
    } else {
      res.status(401).json({ error: 'Invalid username or password.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/public-map', async (req, res) => {
  const requesterRole = req.headers['x-user-role'];
  if (!requesterRole) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*');
    
    if (error) throw error;

    const mapping = {};
    (users || []).forEach(u => {
      const parts = (u.name || '').split('|');
      const cleanName = parts[0] || u.username;
      const auditorSlot = parts[2] || u.role;
      mapping[auditorSlot] = cleanName;
    });

    res.json(mapping);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  const requesterRole = req.headers['x-user-role'];
  if (requesterRole !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can manage users.' });
  }
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('username', { ascending: true });
    
    if (error) throw error;

    const mappedUsers = (users || []).map(u => {
      const parts = (u.name || '').split('|');
      const cleanName = parts[0] || u.username;
      const auditorSlot = parts[2] || u.role;
      return {
        id: u.id,
        username: u.username,
        name: cleanName,
        role: auditorSlot
      };
    });

    res.json(mappedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { username, name, password, role } = req.body;
  const requesterRole = req.headers['x-user-role'];
  
  if (requesterRole !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can manage users.' });
  }
  if (!username || !name || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const dbRole = role === 'Admin' ? 'Admin' : 'Auditor';
    const encodedName = `${name}|${password}|${role}`;
    
    const { data, error } = await supabase
      .from('users')
      .insert([{ username: username.toLowerCase().trim(), name: encodedName, role: dbRole }])
      .select()
      .single();
    if (error) throw error;
    res.json({ id: data.id, username: data.username, name: name, role: role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const requesterRole = req.headers['x-user-role'];

  if (requesterRole !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can change passwords.' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }
  try {
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !user) return res.status(404).json({ error: 'User not found.' });

    const parts = (user.name || '').split('|');
    const cleanName = parts[0] || user.username;
    const slot = parts[2] || user.role;
    const encodedName = `${cleanName}|${password}|${slot}`;

    const { error: updateErr } = await supabase
      .from('users')
      .update({ name: encodedName })
      .eq('id', id);
    if (updateErr) throw updateErr;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, name, password } = req.body;
  const requesterRole = req.headers['x-user-role'];

  if (requesterRole !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can modify user details.' });
  }

  try {
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !user) return res.status(404).json({ error: 'User not found.' });

    const parts = (user.name || '').split('|');
    const oldName = parts[0] || '';
    const oldPassword = parts[1] || '';
    const oldRoleSlot = parts[2] || user.role;

    const newName = name !== undefined ? name : oldName;
    const newPassword = password !== undefined && password !== '' ? password : oldPassword;
    const encodedName = `${newName}|${newPassword}|${oldRoleSlot}`;

    const updateData = { name: encodedName };
    if (username) {
      updateData.username = username.toLowerCase().trim();
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', id);

    if (updateErr) throw updateErr;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const requesterRole = req.headers['x-user-role'];

  if (requesterRole !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can delete users.' });
  }
  try {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware to enforce write locks if session is Completed and user is not Admin
const enforceWritePermission = async (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  
  if (userRole === 'Admin') {
    return next();
  }

  let sessionId = null;
  
  if (req.params.id) {
    if (req.originalUrl.includes('/api/audits/')) {
      sessionId = req.params.id;
    } else if (req.originalUrl.includes('/api/items/')) {
      const { data: item } = await supabase
        .from('items')
        .select('audit_session_id')
        .eq('id', req.params.id)
        .single();
      if (item) sessionId = item.audit_session_id;
    }
  }

  if (sessionId) {
    const { data: session } = await supabase
      .from('audit_sessions')
      .select('status')
      .eq('id', sessionId)
      .single();
      
    if (session && session.status === 'Completed') {
      return res.status(403).json({ error: 'This audit is completed. No changes can be made except by the Admin.' });
    }
  }
  
  next();
};

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
  const userRole = req.headers['x-user-role'];
  if (userRole !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can delete audit sessions.' });
  }
  try {
    const { error } = await supabase.from('audit_sessions').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Put route to change status (Admin Only)
app.put('/api/audits/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userRole = req.headers['x-user-role'];
  
  if (userRole !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can change the audit status.' });
  }
  if (!status || !['Active', 'Completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Must be Active or Completed.' });
  }
  try {
    const { data, error } = await supabase
      .from('audit_sessions')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// EXCEL IMPORT ROUTE
// -------------------------------------------------------------
app.post('/api/audits/:id/import', enforceWritePermission, upload.single('file'), async (req, res) => {
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
app.post('/api/audits/:id/items', enforceWritePermission, async (req, res) => {
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
  const filter = req.query.filter || '';
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

    // Calculate fields + category + expiryStatus per item
    let processedList = itemsList.map(item => {
      const ALLOWED_AUDITORS = ['Admin', 'User1', 'User2', 'User3', 'User4', 'User5'];
      const itemCounts = countsByItem[item.id] || [];
      const auditorTotal = itemCounts.reduce((sum, c) => {
        if (ALLOWED_AUDITORS.includes(c.auditor_name)) {
          return sum + (c.physical_count || 0);
        }
        return sum;
      }, 0);
      const hasExpiredCheck = itemCounts.some(c => c.expiry_check === true || c.expiry_check === 1);
      const totalPhysical = auditorTotal + Number(item.manual_add || 0) + Number(item.manual_recheck || 0);
      
      const hasValidCount = itemCounts.some(c => ALLOWED_AUDITORS.includes(c.auditor_name));
      const isCounted = hasValidCount || Number(item.manual_add || 0) !== 0 || Number(item.manual_recheck || 0) !== 0;
      
      const difference = isCounted ? (totalPhysical - (item.system_qty || 0)) : 0;
      const differenceValue = difference * (item.unit_purchase_rate || 0);

      let category = 'Not Counted';
      let expiryStatus = 'GOOD STOCK';
      if (item.expiry_date) {
        const itemDate = new Date(item.expiry_date);
        itemDate.setHours(0,0,0,0);
        const refDate = new Date(session.audit_date);
        refDate.setHours(0,0,0,0);
        
        const ninetyDays = new Date(refDate);
        ninetyDays.setDate(refDate.getDate() + 90);
        
        if (itemDate < refDate) {
          expiryStatus = 'EXPIRED';
        } else if (itemDate <= ninetyDays) {
          expiryStatus = 'NEAR EXPIRY';
        } else {
          expiryStatus = 'GOOD STOCK';
        }
      }
      if (hasExpiredCheck) expiryStatus = 'EXPIRED';

      if (isCounted) {
        if (expiryStatus === 'EXPIRED' && totalPhysical > 0) {
          category = 'Expired Stock';
        } else if (item.system_qty === 0 && totalPhysical > 0) {
          category = 'Extra Found';
        } else if (item.notes && item.notes.startsWith('OT')) {
          category = 'Other';
        } else if (difference > 0) {
          category = 'Excess';
        } else if (difference < 0) {
          category = 'Shortage';
        } else {
          category = 'Perfect Match';
        }
      }

      return { ...item, totalPhysical, difference, differenceValue, category, expiryStatus, auditor_counts: itemCounts };
    });

    // Apply single unified filter in JS
    if (filter) {
      if (filter === 'EXPIRED') {
        processedList = processedList.filter(item => item.expiryStatus === 'EXPIRED');
      } else if (filter === 'NEAR EXPIRY') {
        processedList = processedList.filter(item => item.expiryStatus === 'NEAR EXPIRY');
      } else if (filter === 'GOOD STOCK') {
        processedList = processedList.filter(item => item.expiryStatus === 'GOOD STOCK');
      } else if (filter === 'Shortage') {
        // Only verified shortages — items that were actually counted and physical < system
        processedList = processedList.filter(item => item.category === 'Shortage');
      } else if (filter === 'Excess') {
        processedList = processedList.filter(item => item.category === 'Excess');
      } else if (filter === 'Perfect Match') {
        processedList = processedList.filter(item => item.category === 'Perfect Match');
      } else if (filter === 'Extra Found') {
        processedList = processedList.filter(item => item.category === 'Extra Found');
      } else if (filter === 'Expired Stock') {
        processedList = processedList.filter(item => item.category === 'Expired Stock');
      } else if (filter === 'Not Counted') {
        // Items nobody has submitted a count for yet
        processedList = processedList.filter(item => item.auditor_counts.length === 0);
      }
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

// Update Auditor Count (supports both POST /api/items/:id/counts and PUT /api/items/:id/count)
const handleCountUpdate = async (req, res) => {
  const { id } = req.params;
  const { auditor_name, physical_count, expiry_check, remarks } = req.body;
  const userRole = req.headers['x-user-role'];

  if (!auditor_name) {
    return res.status(400).json({ error: 'Auditor name is required.' });
  }

  // Column-level permission check: Non-admins can only write to their own column
  if (userRole !== 'Admin' && auditor_name !== userRole) {
    return res.status(403).json({ error: `You are only authorized to edit the '${userRole}' column.` });
  }

  try {
    const { data: item, error: iErr } = await supabase.from('items').select('*').eq('id', id).single();
    if (iErr || !item) return res.status(404).json({ error: 'Item not found' });
    
    // Only Admin can bypass row lock
    if (item.is_locked && userRole !== 'Admin') {
      return res.status(403).json({ error: 'This row is locked and cannot be edited.' });
    }

    // Get old count if any
    const { data: oldCount } = await supabase
      .from('auditor_counts')
      .select('*')
      .eq('item_id', id)
      .eq('auditor_name', auditor_name)
      .single();

    const isDelete = physical_count === null || physical_count === undefined || physical_count === '';

    if (isDelete) {
      // Delete count
      const { error: delErr } = await supabase
        .from('auditor_counts')
        .delete()
        .eq('item_id', parseInt(id))
        .eq('auditor_name', auditor_name);
      if (delErr) throw delErr;

      // Log trail if changed
      const oldVal = oldCount ? `${oldCount.physical_count} (Exp:${oldCount.expiry_check ? 1 : 0})` : 'None';
      const newVal = 'None';
      if (oldVal !== newVal) {
        await supabase.from('audit_trail').insert([{
          item_id: parseInt(id),
          user_name: auditor_name,
          timestamp: new Date().toISOString(),
          field_name: `Auditor Count (${auditor_name})`,
          old_value: oldVal,
          new_value: newVal,
          reason: remarks || 'Count cleared'
        }]);
      }
    } else {
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
          reason: remarks || 'Count update'
        }]);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.post('/api/items/:id/counts', enforceWritePermission, handleCountUpdate);
app.put('/api/items/:id/count', enforceWritePermission, handleCountUpdate);

// Update Item Adjustments / Static / Dynamic Inputs (Admin Only)
app.put('/api/items/:id', enforceWritePermission, async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers['x-user-role'];

  if (userRole !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can make adjustments or edit static item fields.' });
  }

  const {
    manual_add, manual_recheck, notes, user_name, reason,
    item_name, batch_no, expiry_date, unit_purchase_rate, unit_mrp, system_qty,
    location, store_name, supplier
  } = req.body;

  try {
    const { data: item, error: iErr } = await supabase.from('items').select('*').eq('id', id).single();
    if (iErr || !item) return res.status(404).json({ error: 'Item not found' });

    const updates = {};
    const trailEntries = [];
    const timestamp = new Date().toISOString();
    const editor = user_name || 'Admin';
    const changeReason = reason || 'Admin edit';

    const checkAndUpdate = (field, newVal, label) => {
      if (newVal !== undefined && String(newVal) !== String(item[field] !== null && item[field] !== undefined ? item[field] : '')) {
        updates[field] = newVal;
        trailEntries.push({
          item_id: parseInt(id), user_name: editor,
          timestamp, field_name: label,
          old_value: String(item[field] || ''), new_value: String(newVal),
          reason: changeReason
        });
      }
    };

    checkAndUpdate('manual_add', manual_add, 'Manual Add');
    checkAndUpdate('manual_recheck', manual_recheck, 'Manual Recheck');
    checkAndUpdate('notes', notes, 'Notes');
    checkAndUpdate('item_name', item_name, 'Product Name');
    checkAndUpdate('batch_no', batch_no, 'Batch ID');
    checkAndUpdate('expiry_date', expiry_date, 'Expiry Date');
    checkAndUpdate('unit_purchase_rate', unit_purchase_rate, 'Unit Cost');
    checkAndUpdate('unit_mrp', unit_mrp, 'Retail Price');
    checkAndUpdate('system_qty', system_qty, 'System Quantity');
    checkAndUpdate('location', location, 'Location');
    checkAndUpdate('store_name', store_name, 'Store Name');
    checkAndUpdate('supplier', supplier, 'Supplier');

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase.from('items').update(updates).eq('id', id);
      if (updateErr) throw updateErr;

      if (trailEntries.length > 0) {
        await supabase.from('audit_trail').insert(trailEntries);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lock/Unlock Item Row (Admin Only)
app.post('/api/items/:id/lock', enforceWritePermission, async (req, res) => {
  const { id } = req.params;
  const { is_locked, user_name, reason } = req.body;
  const userRole = req.headers['x-user-role'];

  if (userRole !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can lock or unlock rows.' });
  }

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

// Delete Item Row (Admin Only)
app.delete('/api/items/:id', enforceWritePermission, async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers['x-user-role'];

  if (userRole !== 'Admin') {
    return res.status(403).json({ error: 'Only administrators can delete items.' });
  }

  try {
    // 1. Delete associated auditor counts
    const { error: countsErr } = await supabase
      .from('auditor_counts')
      .delete()
      .eq('item_id', id);
    if (countsErr) throw countsErr;

    // 2. Delete associated audit trail logs
    const { error: trailErr } = await supabase
      .from('audit_trail')
      .delete()
      .eq('item_id', id);
    if (trailErr) throw trailErr;

    // 3. Delete the item itself
    const { error: itemErr } = await supabase
      .from('items')
      .delete()
      .eq('id', id);
    if (itemErr) throw itemErr;

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
    // If the session is Completed, it's 100% by definition (admin has signed off)
    // Otherwise count items that have at least one valid auditor count record
    const ALLOWED_AUDITORS = ['Admin', 'User1', 'User2', 'User3', 'User4', 'User5'];
    const activeCounts = (allCounts || []).filter(c => ALLOWED_AUDITORS.includes(c.auditor_name));
    const auditedItemIds = new Set(activeCounts.map(c => c.item_id));
    const itemsAudited = session.status === 'Completed'
      ? totalItems
      : processedItems.filter(item => auditedItemIds.has(item.id) || Number(item.manual_add || 0) !== 0 || Number(item.manual_recheck || 0) !== 0).length;
    const totalStockValue = processedItems.reduce((sum, item) => sum + ((item.system_qty || 0) * (item.unit_purchase_rate || 0)), 0);
    const totalExcessValue = processedItems.filter(i => i.category === 'Excess').reduce((sum, i) => sum + i.differenceValue, 0);
    const totalShortageValue = processedItems.filter(i => i.category === 'Shortage').reduce((sum, i) => sum + i.differenceValue, 0);
    const extraFoundValue = processedItems.filter(i => i.category === 'Extra Found').reduce((sum, i) => sum + (i.totalPhysical * (i.unit_purchase_rate || 0)), 0);
    const expiredValue = processedItems.filter(i => i.category === 'Expired Stock').reduce((sum, i) => sum + (i.totalPhysical * (i.unit_purchase_rate || 0)), 0);
    const otValue = processedItems.filter(i => i.category === 'Other').reduce((sum, i) => sum + i.differenceValue, 0);
    
    // Correct formulas:
    const grossShortage = totalShortageValue; // negative shortage sum
    const netShortage = grossShortage + extraFoundValue; // shortage offset by extra found
    const netAuditDifference = totalExcessValue + totalShortageValue + extraFoundValue + otValue; // overall audit variance

    // Expiry breakdown
    let expCount = 0, expVal = 0;
    let nearCount = 0, nearVal = 0;
    let goodCount = 0, goodVal = 0;

    const today = new Date();
    today.setHours(0,0,0,0);
    const ninetyDays = new Date(today);
    ninetyDays.setDate(today.getDate() + 90);

    processedItems.forEach(item => {
      const val = (item.totalPhysical || item.system_qty || 0) * (item.unit_purchase_rate || 0);
      if (!item.expiry_date) {
        goodCount++;
        goodVal += val;
        return;
      }
      const expDate = new Date(item.expiry_date);
      expDate.setHours(0,0,0,0);
      if (expDate < today) {
        expCount++;
        expVal += val;
      } else if (expDate <= ninetyDays) {
        nearCount++;
        nearVal += val;
      } else {
        goodCount++;
        goodVal += val;
      }
    });

    const expiryBreakdown = {
      expired: { count: expCount, value: expVal },
      nearExpiry: { count: nearCount, value: nearVal },
      goodStock: { count: goodCount, value: goodVal }
    };

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

    // Top shortages (items with negative differenceValue) sorted by absolute loss size
    const topShortages = [...processedItems]
      .filter(i => i.differenceValue < 0)
      .sort((a, b) => a.differenceValue - b.differenceValue) // most negative first
      .slice(0, 5)
      .map(i => ({
        item_name: i.item_name,
        batch_no: i.batch_no,
        expiry_date: i.expiry_date,
        system_qty: i.system_qty,
        totalPhysical: i.totalPhysical,
        difference: i.difference,
        unit_purchase_rate: i.unit_purchase_rate,
        differenceValue: i.differenceValue
      }));

    // Top excesses (items with positive differenceValue) sorted by surplus size
    const topExcesses = [...processedItems]
      .filter(i => i.differenceValue > 0)
      .sort((a, b) => b.differenceValue - a.differenceValue) // most positive first
      .slice(0, 5)
      .map(i => ({
        item_name: i.item_name,
        batch_no: i.batch_no,
        expiry_date: i.expiry_date,
        system_qty: i.system_qty,
        totalPhysical: i.totalPhysical,
        difference: i.difference,
        unit_purchase_rate: i.unit_purchase_rate,
        differenceValue: i.differenceValue
      }));

    res.json({
      totalItems, itemsAudited, totalStockValue,
      totalExcessValue, totalShortageValue, extraFoundValue,
      expiredValue, otValue, grossShortage, netShortage, netAuditDifference,
      categoryBreakdown, locationBreakdown, supplierBreakdown, expiryBreakdown,
      topShortages, topExcesses
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

app.get('/api/audits/:id/export/word', async (req, res) => {
  const { id } = req.params;
  try {
    const buffer = await generateWordReport(id);
    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', `attachment; filename=Audit_Analysis_Report_${id}.doc`);
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
