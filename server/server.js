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

app.use(cors({
  origin: true,           // reflect the request origin (allows any origin)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role', 'x-user-name', 'x-user-id'],
  exposedHeaders: ['Content-Disposition', 'Content-Type', 'Content-Length'],
  credentials: false,
  optionsSuccessStatus: 200
}));
app.use(express.json());

// In-memory tracking of active/online users based on HTTP requests headers
const userActivityMap = new Map();

// Session cache to prevent repeated database hits on large items tables
const sessionCache = new Map();
const clearSessionCache = (sessionId) => {
  if (sessionId) {
    sessionCache.delete(String(sessionId));
  }
};
const importProgressMap = new Map();

// Helper to fetch all items and counts in exactly 2 raw SQL queries (optimized for large datasets)
const fetchSessionData = async (id) => {
  const { data: session, error: sErr } = await supabase.from('audit_sessions').select('*').eq('id', id).single();
  if (sErr || !session) throw new Error('Session not found');

  const { data: auditMembers } = await supabase
    .from('audit_members')
    .select('user_id, status')
    .eq('audit_session_id', id);

  const memberIds = (auditMembers || []).map(m => String(m.user_id));

  // 1. Fetch all items in a single query via raw SQL
  const { data: itemsList, error: itemsErr } = await supabase.rpc('exec_raw_sql', {
    query_text: 'SELECT * FROM items WHERE audit_session_id = $1::bigint ORDER BY id ASC',
    query_params: [String(id)]
  });
  if (itemsErr) throw itemsErr;

  // 2. Fetch all counts for the session in a single query via raw SQL
  const { data: allCounts, error: countsErr } = await supabase.rpc('exec_raw_sql', {
    query_text: `
      SELECT ac.* 
      FROM auditor_counts ac
      JOIN items i ON i.id = ac.item_id
      WHERE i.audit_session_id = $1::bigint
    `,
    query_params: [String(id)]
  });
  if (countsErr) throw countsErr;

  const countsByItem = {};
  (allCounts || []).forEach(c => {
    if (!countsByItem[c.item_id]) countsByItem[c.item_id] = [];
    countsByItem[c.item_id].push(c);
  });

  const ALLOWED_AUDITORS = Array.from(new Set([
    ...memberIds,
    'Physical Quantity', 'Physical Quantity_1', 'Physical Quantity_2',
    'Extra Count', 'Expired Count'
  ]));

  const processedList = (itemsList || []).map(item => {
    const itemCounts = countsByItem[item.id] || [];
    const auditorTotal = itemCounts.reduce((sum, c) => {
      if (ALLOWED_AUDITORS.includes(String(c.auditor_name))) return sum + (c.physical_count || 0);
      return sum;
    }, 0);
    const hasExpiredCheck = itemCounts.some(c => c.expiry_check === true || c.expiry_check === 1);
    const totalPhysical = auditorTotal + Number(item.manual_add || 0) + Number(item.manual_recheck || 0);

    const hasValidCount = itemCounts.some(c => ALLOWED_AUDITORS.includes(String(c.auditor_name)));
    const isCounted = hasValidCount || Number(item.manual_add || 0) !== 0 || Number(item.manual_recheck || 0) !== 0;

    const difference = isCounted ? (totalPhysical - (item.system_qty || 0)) : 0;
    const differenceValue = difference * (item.unit_purchase_rate || 0);

    let category = 'Not Counted';
    let expiryStatus = 'GOOD STOCK';
    if (item.expiry_date) {
      const itemDate = new Date(item.expiry_date);
      itemDate.setHours(0, 0, 0, 0);
      const refDate = new Date(session.audit_date);
      refDate.setHours(0, 0, 0, 0);
      const ninetyDays = new Date(refDate);
      ninetyDays.setDate(refDate.getDate() + 90);
      if (itemDate < refDate) expiryStatus = 'EXPIRED';
      else if (itemDate <= ninetyDays) expiryStatus = 'NEAR EXPIRY';
      else expiryStatus = 'GOOD STOCK';
    }
    if (hasExpiredCheck) expiryStatus = 'EXPIRED';

    if (isCounted) {
      if (item.system_qty === 0 && totalPhysical > 0) category = 'Extra Found';
      else if (expiryStatus === 'EXPIRED' && totalPhysical > 0) category = 'Expired Stock';
      else if (item.notes && item.notes.startsWith('OT')) category = 'Other';
      else if (difference > 0) category = 'Excess';
      else if (difference < 0) category = 'Shortage';
      else category = 'Perfect Match';
    }

    return { ...item, totalPhysical, difference, differenceValue, category, expiryStatus, auditor_counts: itemCounts };
  });

  const suppliers = [...new Set((itemsList || []).map(i => i.supplier).filter(Boolean))].sort();
  const locations = [...new Set((itemsList || []).map(i => i.location).filter(Boolean))].sort();
  const stores = [...new Set((itemsList || []).map(i => i.store_name).filter(Boolean))].sort();

  // 3. Fetch audit trail for member performance
  const { data: trailData } = await supabase
    .from('audit_trail')
    .select('user_name, items!inner(audit_session_id)')
    .eq('items.audit_session_id', id);

  // 4. Fetch user details for audit members
  const memberUserIds = (auditMembers || []).map(m => m.user_id);
  let memberNames = {};
  if (memberUserIds.length > 0) {
    const { data: memberUsers } = await supabase.from('users').select('*').in('id', memberUserIds);
    (memberUsers || []).forEach(u => {
      const { cleanName } = decodeUser(u);
      memberNames[u.id] = { name: cleanName, role: u.role };
    });
  }

  // Pre-calculate dashboard metrics
  const totalItems = processedList.length;
  const activeCounts = (allCounts || []).filter(c => ALLOWED_AUDITORS.includes(String(c.auditor_name)));
  const auditedItemIds = new Set(activeCounts.map(c => c.item_id));
  const itemsAudited = session.status === 'Completed'
    ? totalItems
    : processedList.filter(item => auditedItemIds.has(item.id) || Number(item.manual_add || 0) !== 0 || Number(item.manual_recheck || 0) !== 0).length;

  const totalStockValue = processedList.reduce((sum, item) => sum + ((item.system_qty || 0) * (item.unit_purchase_rate || 0)), 0);
  const totalExcessValue = processedList.filter(i => i.category === 'Excess').reduce((sum, i) => sum + i.differenceValue, 0);
  const totalShortageValue = processedList.filter(i => i.category === 'Shortage').reduce((sum, i) => sum + i.differenceValue, 0);
  const extraFoundValue = processedList.filter(i => i.category === 'Extra Found').reduce((sum, i) => sum + (i.totalPhysical * (i.unit_purchase_rate || 0)), 0);
  const extraFoundQty = processedList.filter(i => i.category === 'Extra Found').reduce((sum, i) => sum + (i.totalPhysical || 0), 0);
  const expiredValue = processedList.filter(i => i.category === 'Expired Stock').reduce((sum, i) => sum + (i.totalPhysical * (i.unit_purchase_rate || 0)), 0);
  const otValue = processedList.filter(i => i.category === 'Other').reduce((sum, i) => sum + i.differenceValue, 0);

  const grossShortage = totalShortageValue;
  const netShortage = grossShortage + extraFoundValue;
  const netAuditDifference = totalExcessValue + totalShortageValue + extraFoundValue + otValue;

  const totalSystemExpiryValue = processedList.filter(i => i.expiryStatus === 'EXPIRED').reduce((sum, i) => sum + ((i.system_qty || 0) * (i.unit_purchase_rate || 0)), 0);
  const totalPhysicalExpiryValue = processedList.filter(i => i.expiryStatus === 'EXPIRED').reduce((sum, i) => sum + ((i.totalPhysical || 0) * (i.unit_purchase_rate || 0)), 0);
  const totalPerfectMatchValue = processedList.filter(i => i.isCounted && (i.totalPhysical || 0) === (i.system_qty || 0)).reduce((sum, i) => sum + ((i.totalPhysical || 0) * (i.unit_purchase_rate || 0)), 0);

  let expCount = 0, expVal = 0, nearCount = 0, nearVal = 0, goodCount = 0, goodVal = 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ninetyDays = new Date(today); ninetyDays.setDate(today.getDate() + 90);

  processedList.forEach(item => {
    const val = (item.totalPhysical || item.system_qty || 0) * (item.unit_purchase_rate || 0);
    if (!item.expiry_date) { goodCount++; goodVal += val; return; }
    const expDate = new Date(item.expiry_date); expDate.setHours(0, 0, 0, 0);
    if (expDate < today) { expCount++; expVal += val; }
    else if (expDate <= ninetyDays) { nearCount++; nearVal += val; }
    else { goodCount++; goodVal += val; }
  });

  const categoryBreakdown = {
    'Excess': processedList.filter(i => i.category === 'Excess').length,
    'Shortage': processedList.filter(i => i.category === 'Shortage').length,
    'Extra Found': processedList.filter(i => i.category === 'Extra Found').length,
    'Expired Stock': processedList.filter(i => i.category === 'Expired Stock').length,
    'Other': processedList.filter(i => i.category === 'Other').length,
    'Perfect Match': processedList.filter(i => i.category === 'Perfect Match').length
  };

  const locationBreakdown = {}, supplierBreakdown = {};
  processedList.forEach(i => {
    const loc = i.location || 'Unknown';
    const sup = i.supplier || 'Unknown';
    locationBreakdown[loc] = (locationBreakdown[loc] || 0) + i.differenceValue;
    supplierBreakdown[sup] = (supplierBreakdown[sup] || 0) + i.differenceValue;
  });

  const topShortages = [...processedList].filter(i => i.differenceValue < 0)
    .sort((a, b) => a.differenceValue - b.differenceValue).slice(0, 5)
    .map(i => ({ item_name: i.item_name, batch_no: i.batch_no, expiry_date: i.expiry_date, system_qty: i.system_qty, totalPhysical: i.totalPhysical, difference: i.difference, unit_purchase_rate: i.unit_purchase_rate, differenceValue: i.differenceValue }));

  const topExcesses = [...processedList].filter(i => i.differenceValue > 0)
    .sort((a, b) => b.differenceValue - a.differenceValue).slice(0, 5)
    .map(i => ({ item_name: i.item_name, batch_no: i.batch_no, expiry_date: i.expiry_date, system_qty: i.system_qty, totalPhysical: i.totalPhysical, difference: i.difference, unit_purchase_rate: i.unit_purchase_rate, differenceValue: i.differenceValue }));

  const changeCounts = {};
  (trailData || []).forEach(t => {
    changeCounts[t.user_name] = (changeCounts[t.user_name] || 0) + 1;
  });

  const countCounts = {};
  (allCounts || []).forEach(c => {
    countCounts[String(c.auditor_name)] = (countCounts[String(c.auditor_name)] || 0) + 1;
  });

  const memberPerformance = (auditMembers || []).map(m => {
    const uid = String(m.user_id);
    const trailCount = (changeCounts[uid] || 0);
    const countEntries = (countCounts[uid] || 0);
    return {
      user_id: m.user_id,
      name: memberNames[m.user_id]?.name || `User ${m.user_id}`,
      role: memberNames[m.user_id]?.role || '',
      status: m.status,
      change_count: trailCount + countEntries,
      entry_count: countEntries,
    };
  }).sort((a, b) => b.change_count - a.change_count);

  const dashboardData = {
    totalItems, itemsAudited, totalStockValue,
    totalExcessValue, totalShortageValue, extraFoundValue, extraFoundQty,
    expiredValue, otValue, grossShortage, netShortage, netAuditDifference,
    totalSystemExpiryValue, totalPhysicalExpiryValue, totalPerfectMatchValue,
    categoryBreakdown, locationBreakdown, supplierBreakdown,
    expiryBreakdown: { expired: { count: expCount, value: expVal }, nearExpiry: { count: nearCount, value: nearVal }, goodStock: { count: goodCount, value: goodVal } },
    topShortages, topExcesses,
    memberPerformance,
    auditMembers: auditMembers || [],
  };

  return { processedList, suppliers, locations, stores, ALLOWED_AUDITORS, auditDate: session.audit_date, auditMembers, dashboardData };
};

// Helper to pre-compile and store data in sessionCache
const prepopulateSessionCache = async (sessionId) => {
  try {
    const data = await fetchSessionData(sessionId);
    sessionCache.set(String(sessionId), data);
    console.log(`Cache successfully prepopulated for session ${sessionId}`);
  } catch (err) {
    console.error(`Failed to prepopulate cache for session ${sessionId}:`, err.message);
  }
};

app.use((req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (userId) {
    userActivityMap.set(String(userId), Date.now());
  }
  next();
});

const upload = multer({ dest: path.join(__dirname, 'uploads/') });

if (!fs.existsSync(path.join(__dirname, 'uploads'))) {
  fs.mkdirSync(path.join(__dirname, 'uploads'));
}

// ─── Role Helpers ───────────────────────────────────────────────
const PROTECTED_ROLES = ['Admin', 'Developer'];

const isPrivileged = (role) => role === 'Admin' || role === 'Developer';
const isUpperTier = (role) => isPrivileged(role) || role === 'CoFounder';
const canSeeAuditWork = (role) => isUpperTier(role) || role === 'TeamMember';

const fetchCountsInChunks = async (itemIds) => {
  if (!itemIds || itemIds.length === 0) return [];
  let allCounts = [];
  const chunkSize = 500;
  for (let i = 0; i < itemIds.length; i += chunkSize) {
    const chunk = itemIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from('auditor_counts')
      .select('*')
      .in('item_id', chunk);
    if (error) throw error;
    if (data) allCounts = allCounts.concat(data);
  }
  return allCounts;
};

// Decode legacy name field
const decodeUser = (u) => {
  const parts = (u.name || '').split('|');
  const cleanName = u.display_name || parts[0] || u.username;
  const storedPassword = parts[1] || '';
  const auditorSlot = parts[2] || u.role;
  return { cleanName, storedPassword, auditorSlot };
};

// ─────────────────────────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────────────────────────

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

    // Check status first
    if (user.status === 'removed') {
      return res.status(403).json({ error: 'Your account has been removed. Please contact your administrator.' });
    }

    const { cleanName, storedPassword, auditorSlot } = decodeUser(user);

    if (storedPassword === password) {
      const isFrozen = user.status === 'frozen';
      res.json({
        id: user.id,
        username: user.username,
        name: cleanName,
        role: auditorSlot,
        status: user.status || 'active',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        isFrozen,
      });
    } else {
      res.status(401).json({ error: 'Invalid username or password.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// USER ROUTES
// ─────────────────────────────────────────────────────────────────

app.get('/api/users/public-map', async (req, res) => {
  const requesterRole = req.headers['x-user-role'];
  if (!requesterRole) return res.status(401).json({ error: 'Unauthorized.' });
  try {
    const { data: users, error } = await supabase.from('users').select('*');
    if (error) throw error;
    const mapping = {};
    (users || []).forEach(u => {
      const { cleanName, auditorSlot } = decodeUser(u);
      mapping[auditorSlot] = cleanName;
      // Also map by user_id for dynamic column support
      mapping[String(u.id)] = cleanName;
    });
    res.json(mapping);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users (Admin/Developer only)
app.get('/api/users', async (req, res) => {
  const requesterRole = req.headers['x-user-role'];
  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can manage users.' });
  }
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*');
    if (error) throw error;

    // Sort by joined_at if it exists, otherwise fallback to id
    const sortedUsers = (users || []).sort((a, b) => {
      if (a.joined_at && b.joined_at) return new Date(a.joined_at) - new Date(b.joined_at);
      return a.id - b.id;
    });

    const mappedUsers = sortedUsers.map(u => {
      const { cleanName, auditorSlot } = decodeUser(u);
      return {
        id: u.id,
        username: u.username,
        name: cleanName,
        role: auditorSlot,
        email: u.email || '',
        phone: u.phone || '',
        address: u.address || '',
        status: u.status || 'active',
        remarks: u.remarks || '',
        joined_at: u.joined_at,
        removed_at: u.removed_at,
      };
    });
    res.json(mappedUsers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get assignable users for audit (not removed, active/frozen - but for new audit only active)
app.get('/api/users/assignable', async (req, res) => {
  const requesterRole = req.headers['x-user-role'];
  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can view assignable users.' });
  }
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*');
    if (error) throw error;

    // Filter and sort in JS to be safe before migration
    const filteredUsers = (users || [])
      .filter(u => u.status !== 'removed')
      .sort((a, b) => {
        if (a.joined_at && b.joined_at) return new Date(a.joined_at) - new Date(b.joined_at);
        return a.id - b.id;
      });
    const mapped = filteredUsers.map(u => {
      const { cleanName, auditorSlot } = decodeUser(u);
      return { id: u.id, username: u.username, name: cleanName, role: auditorSlot, status: u.status || 'active' };
    });
    res.json(mapped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user
app.post('/api/users', async (req, res) => {
  const { username, name, password, role, email, phone, address } = req.body;
  const requesterRole = req.headers['x-user-role'];
  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can manage users.' });
  }
  if (!username || !name || !password || !role) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  try {
    const dbRole = role;
    const encodedName = `${name}|${password}|${role}`;
    // Build insert payload - only include new columns if migration has run
    const insertPayload = {
      username: username.toLowerCase().trim(),
      name: encodedName,
      role: dbRole,
    };
    // Attempt to include new columns; if migration not done, Supabase ignores unknown keys
    // But to avoid hard errors, we'll try and catch per field approach isn't possible,
    // so we include them and let the migration SQL handle creating them
    // The user already has the 3 core fields, extended fields are bonus
    try {
      Object.assign(insertPayload, {
        display_name: name,
        email: email || '',
        phone: phone || '',
        address: address || '',
        status: 'active',
        joined_at: new Date().toISOString()
      });
    } catch (e) { /* ignore if columns missing */ }

    const { data, error } = await supabase
      .from('users')
      .insert([insertPayload])
      .select()
      .single();
    if (error) {
      // If display_name column missing, retry with only core fields
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        const corePayload = { username: username.toLowerCase().trim(), name: encodedName, role: dbRole };
        const { data: data2, error: err2 } = await supabase.from('users').insert([corePayload]).select().single();
        if (err2) throw err2;
        return res.json({ id: data2.id, username: data2.username, name, role, status: 'active' });
      }
      throw error;
    }
    res.json({ id: data.id, username: data.username, name, role, status: 'active' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user status (freeze/unfreeze/remove) - Admin/Developer only
app.put('/api/users/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const requesterRole = req.headers['x-user-role'];
  const requesterName = req.headers['x-user-name'];

  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can change user status.' });
  }
  if (!['active', 'frozen', 'removed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  try {
    // Protect Admin and Developer roles
    const { data: targetUser } = await supabase.from('users').select('*').eq('id', id).single();
    if (!targetUser) return res.status(404).json({ error: 'User not found.' });

    const { auditorSlot } = decodeUser(targetUser);
    if (auditorSlot === 'Developer' && requesterRole !== 'Developer') {
      return res.status(403).json({ error: 'Developer accounts cannot be modified.' });
    }
    if (auditorSlot === 'Admin' && requesterRole !== 'Developer') {
      return res.status(403).json({ error: 'Admin accounts cannot be modified.' });
    }

    const updateData = { status };
    if (status === 'removed') {
      try { updateData.removed_at = new Date().toISOString(); } catch(e) {}
    } else if (status === 'active') {
      try { updateData.removed_at = null; } catch(e) {}
    }

    const { error } = await supabase.from('users').update(updateData).eq('id', id);
    if (error && error.message && error.message.includes('removed_at')) {
      // Column doesn't exist yet - update only status
      const { error: err2 } = await supabase.from('users').update({ status }).eq('id', id);
      if (err2) throw err2;
    } else if (error) {
      throw error;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user remarks (Admin/Developer only)
app.put('/api/users/:id/remarks', async (req, res) => {
  const { id } = req.params;
  const { remarks } = req.body;
  const requesterRole = req.headers['x-user-role'];
  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can add remarks.' });
  }
  try {
    const { error } = await supabase.from('users').update({ remarks }).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update display name (self - any role)
app.put('/api/users/:id/displayname', async (req, res) => {
  const { id } = req.params;
  const { display_name } = req.body;
  const requesterId = req.headers['x-user-id'];

  if (String(requesterId) !== String(id)) {
    return res.status(403).json({ error: 'You can only update your own display name.' });
  }
  if (!display_name || !display_name.trim()) {
    return res.status(400).json({ error: 'Display name cannot be empty.' });
  }

  try {
    const { data: user } = await supabase.from('users').select('*').eq('id', id).single();
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const parts = (user.name || '').split('|');
    const password = parts[1] || '';
    const slot = parts[2] || user.role;
    const encodedName = `${display_name.trim()}|${password}|${slot}`;

    const { error } = await supabase.from('users').update({
      name: encodedName,
      display_name: display_name.trim()
    }).eq('id', id);
    if (error) {
      if (error.message && error.message.includes('display_name')) {
        const { error: err2 } = await supabase.from('users').update({ name: encodedName }).eq('id', id);
        if (err2) throw err2;
      } else {
        throw error;
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Full user update (Admin/Developer)
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, name, password, email, phone, address, role } = req.body;
  const requesterRole = req.headers['x-user-role'];
  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can modify user details.' });
  }
  try {
    const { data: user, error: fetchErr } = await supabase.from('users').select('*').eq('id', id).single();
    if (fetchErr || !user) return res.status(404).json({ error: 'User not found.' });

    const { auditorSlot } = decodeUser(user);
    if (auditorSlot === 'Developer' && requesterRole !== 'Developer') {
      return res.status(403).json({ error: 'Developer accounts cannot be modified.' });
    }
    if (auditorSlot === 'Admin' && requesterRole !== 'Developer') {
      return res.status(403).json({ error: 'Admin accounts cannot be modified.' });
    }
    if ((role === 'Admin' || role === 'Developer') && requesterRole !== 'Developer') {
      return res.status(403).json({ error: 'Only Developers can promote/assign Admin or Developer roles.' });
    }

    const parts = (user.name || '').split('|');
    const oldName = parts[0] || '';
    const oldPassword = parts[1] || '';
    const oldRoleSlot = parts[2] || user.role;

    const newName = name !== undefined ? name : oldName;
    const newPassword = password && password !== '' ? password : oldPassword;
    const newRole = role || oldRoleSlot;
    const encodedName = `${newName}|${newPassword}|${newRole}`;

    const updateData = {
      name: encodedName,
      display_name: newName,
      role: newRole,
    };
    if (username) updateData.username = username.toLowerCase().trim();
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;

    const { error: updateErr } = await supabase.from('users').update(updateData).eq('id', id);
    if (updateErr) {
      if (updateErr.message && (updateErr.message.includes('display_name') || updateErr.message.includes('email') || updateErr.message.includes('phone') || updateErr.message.includes('address'))) {
        // Fall back to legacy fields only
        const legacyData = {
          name: encodedName,
          role: newRole,
        };
        if (username) legacyData.username = username.toLowerCase().trim();
        const { error: err2 } = await supabase.from('users').update(legacyData).eq('id', id);
        if (err2) throw err2;
      } else {
        throw updateErr;
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Password change
app.put('/api/users/:id/password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  const requesterRole = req.headers['x-user-role'];
  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can change passwords.' });
  }
  if (!password) return res.status(400).json({ error: 'Password is required.' });
  try {
    const { data: user, error: fetchErr } = await supabase.from('users').select('*').eq('id', id).single();
    if (fetchErr || !user) return res.status(404).json({ error: 'User not found.' });

    const { cleanName, auditorSlot } = decodeUser(user);
    const encodedName = `${cleanName}|${password}|${auditorSlot}`;
    const { error: updateErr } = await supabase.from('users').update({ name: encodedName }).eq('id', id);
    if (updateErr) throw updateErr;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (Admin/Developer only, can't delete protected roles)
app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const requesterRole = req.headers['x-user-role'];
  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can delete users.' });
  }
  try {
    const { data: targetUser } = await supabase.from('users').select('*').eq('id', id).single();
    if (targetUser) {
      const { auditorSlot } = decodeUser(targetUser);
      if (auditorSlot === 'Developer' && requesterRole !== 'Developer') {
        return res.status(403).json({ error: 'Developer accounts cannot be deleted.' });
      }
      if (auditorSlot === 'Admin' && requesterRole !== 'Developer') {
        return res.status(403).json({ error: 'Admin accounts cannot be deleted.' });
      }
    }
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user profile (self or admin)
app.get('/api/users/:id/profile', async (req, res) => {
  const { id } = req.params;
  const requesterRole = req.headers['x-user-role'];
  const requesterId = req.headers['x-user-id'];

  if (!isPrivileged(requesterRole) && String(requesterId) !== String(id)) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  try {
    const { data: user, error } = await supabase.from('users').select('*').eq('id', id).single();
    if (error || !user) return res.status(404).json({ error: 'User not found.' });

    const { cleanName, auditorSlot } = decodeUser(user);

    // Get audit sessions this user participated in (safe - audit_members may not exist yet)
    let memberSessions = [];
    let auditHistory = [];
    try {
      const { data: ms } = await supabase
        .from('audit_members')
        .select('audit_session_id, status, added_at')
        .eq('user_id', id);
      memberSessions = ms || [];

      const sessionIds = memberSessions.map(m => m.audit_session_id);
      if (sessionIds.length > 0) {
        const { data: sessions } = await supabase
          .from('audit_sessions')
          .select('id, name, audit_date, status, hospital_id')
          .in('id', sessionIds);

        const { data: hospitals } = await supabase.from('hospitals').select('id, name');
        const hospitalMap = {};
        (hospitals || []).forEach(h => { hospitalMap[h.id] = h.name; });

        auditHistory = (sessions || []).map(s => ({
          ...s,
          hospital_name: hospitalMap[s.hospital_id] || '',
          member_status: memberSessions.find(m => m.audit_session_id === s.id)?.status || 'active',
        }));
      }
    } catch (e) {
      // audit_members or hospitals table not yet created — skip
    }

    // Also check auditor_counts for legacy user slot columns
    const legacySlotCounts = await supabase
      .from('auditor_counts')
      .select('item_id, physical_count, updated_at')
      .eq('auditor_name', String(id));

    res.json({
      id: user.id,
      username: user.username,
      name: cleanName,
      role: auditorSlot,
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      status: user.status || 'active',
      remarks: user.remarks || '',
      joined_at: user.joined_at,
      audit_history: auditHistory,
      total_entries: (legacySlotCounts.data || []).length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// HOSPITAL ROUTES
// ─────────────────────────────────────────────────────────────────

app.get('/api/hospitals', async (req, res) => {
  const requesterRole = req.headers['x-user-role'];
  if (!requesterRole) return res.status(401).json({ error: 'Unauthorized.' });
  try {
    const { data, error } = await supabase
      .from('hospitals')
      .select('*')
      .order('name', { ascending: true });
    // If hospitals table doesn't exist yet (before migration), return empty
    if (error && error.message && error.message.includes('hospitals')) {
      return res.json([]);
    }
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    // Pre-migration: table may not exist
    if (err.message && err.message.includes('hospitals')) return res.json([]);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/hospitals', async (req, res) => {
  const requesterRole = req.headers['x-user-role'];
  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can add hospitals.' });
  }
  const { name, location, contact_number } = req.body;
  if (!name) return res.status(400).json({ error: 'Hospital name is required.' });
  try {
    const { data, error } = await supabase
      .from('hospitals')
      .insert([{ name, location: location || '', contact_number: contact_number || '' }])
      .select()
      .single();
    if (error) {
      if (error.message && error.message.includes('hospitals')) {
        return res.status(400).json({ error: 'Database table "hospitals" is missing. Please copy-paste and run the SQL migration script in your Supabase console first.' });
      }
      throw error;
    }
    res.json(data);
  } catch (err) {
    if (err.message && err.message.includes('hospitals')) {
      return res.status(400).json({ error: 'Database table "hospitals" is missing. Please copy-paste and run the SQL migration script in your Supabase console first.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/hospitals/:id', async (req, res) => {
  const { id } = req.params;
  const requesterRole = req.headers['x-user-role'];
  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can edit hospitals.' });
  }
  const { name, location, contact_number } = req.body;
  try {
    const { data, error } = await supabase
      .from('hospitals')
      .update({ name, location, contact_number })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete hospital (Admin/Developer only)
app.delete('/api/hospitals/:id', async (req, res) => {
  const { id } = req.params;
  const requesterRole = req.headers['x-user-role'];
  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can delete hospitals.' });
  }
  try {
    // Fetch all audit sessions associated with this hospital
    const { data: sessions, error: fetchErr } = await supabase
      .from('audit_sessions')
      .select('id')
      .eq('hospital_id', id);
    if (fetchErr) throw fetchErr;

    const sessionIds = (sessions || []).map(s => s.id);
    if (sessionIds.length > 0) {
      // Fetch all items belonging to these sessions
      const { data: items, error: itemsErr } = await supabase
        .from('items')
        .select('id')
        .in('audit_session_id', sessionIds);
      if (itemsErr) throw itemsErr;

      const itemIds = (items || []).map(item => item.id);
      if (itemIds.length > 0) {
        // Delete all physical counts for these items
        const { error: countsDelErr } = await supabase
          .from('auditor_counts')
          .delete()
          .in('item_id', itemIds);
        if (countsDelErr) throw countsDelErr;

        // Delete the items
        const { error: itemsDelErr } = await supabase
          .from('items')
          .delete()
          .in('id', itemIds);
        if (itemsDelErr) throw itemsDelErr;
      }

      // Delete assigned session members
      const { error: membersDelErr } = await supabase
        .from('audit_members')
        .delete()
        .in('audit_session_id', sessionIds);
      if (membersDelErr) throw membersDelErr;

      // Delete audit trails for these sessions
      const { error: trailDelErr } = await supabase
        .from('audit_trail')
        .delete()
        .in('audit_session_id', sessionIds);
      if (trailDelErr) throw trailDelErr;

      // Delete the audit sessions records
      const { error: sessionsDelErr } = await supabase
        .from('audit_sessions')
        .delete()
        .in('id', sessionIds);
      if (sessionsDelErr) throw sessionsDelErr;
    }

    // Delete the hospital record
    const { error: hospitalDelErr } = await supabase
      .from('hospitals')
      .delete()
      .eq('id', id);
    if (hospitalDelErr) throw hospitalDelErr;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get audit history for a hospital (Admin/CoFounder/Developer)
app.get('/api/hospitals/:id/audits', async (req, res) => {
  const { id } = req.params;
  const requesterRole = req.headers['x-user-role'];
  if (!isUpperTier(requesterRole)) {
    return res.status(403).json({ error: 'Access denied.' });
  }
  try {
    const { data: sessions, error } = await supabase
      .from('audit_sessions')
      .select('*')
      .eq('hospital_id', id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(sessions || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// WRITE PERMISSION MIDDLEWARE
// ─────────────────────────────────────────────────────────────────
const enforceWritePermission = async (req, res, next) => {
  const userRole = req.headers['x-user-role'];
  if (isPrivileged(userRole)) return next();

  let sessionId = null;
  if (req.params.id) {
    if (req.originalUrl.includes('/api/audits/')) {
      sessionId = req.params.id;
    } else if (req.originalUrl.includes('/api/items/')) {
      const { data: item } = await supabase.from('items').select('audit_session_id').eq('id', req.params.id).single();
      if (item) sessionId = item.audit_session_id;
    }
  }

  if (sessionId) {
    const { data: session } = await supabase.from('audit_sessions').select('status').eq('id', sessionId).single();
    if (session && session.status === 'Completed') {
      return res.status(403).json({ error: 'This audit is completed. No changes can be made except by the Admin.' });
    }
  }
  next();
};

// ─────────────────────────────────────────────────────────────────
// AUDIT SESSION ROUTES
// ─────────────────────────────────────────────────────────────────

app.get('/api/audits', async (req, res) => {
  try {
    const userRole = req.headers['x-user-role'];
    const userId = req.headers['x-user-id'];
    console.log('[DEBUG] /api/audits called with Role:', userRole, 'ID:', userId);

    const { data: allSessions, error: sErr } = await supabase
      .from('audit_sessions')
      .select('*')
      .order('created_at', { ascending: false });
    if (sErr) throw sErr;

    let sessions = allSessions;
    if (userRole === 'Employee' && userId) {
      const { data: memberData, error: mErr } = await supabase
        .from('audit_members')
        .select('audit_session_id')
        .eq('user_id', parseInt(userId))
        .eq('status', 'active');
      if (mErr) throw mErr;

      const allowedSessionIds = new Set((memberData || []).map(m => m.audit_session_id));
      sessions = sessions.filter(s => allowedSessionIds.has(s.id));
    }

    const { data: summaryData, error: sumErr } = await supabase.rpc('exec_raw_sql', {
      query_text: `
        SELECT 
          audit_session_id, 
          COUNT(*)::integer as count, 
          SUM(COALESCE(system_qty, 0) * COALESCE(unit_purchase_rate, 0))::numeric as value 
        FROM items 
        GROUP BY audit_session_id
      `,
      query_params: []
    });
    if (sumErr) throw sumErr;

    // Fetch hospitals for enrichment
    const { data: hospitals } = await supabase.from('hospitals').select('id, name, location');
    const hospitalMap = {};
    (hospitals || []).forEach(h => { hospitalMap[h.id] = h; });

    const sessionMap = {};
    (summaryData || []).forEach(row => {
      sessionMap[row.audit_session_id] = {
        count: row.count,
        value: Number(row.value || 0)
      };
    });

    const result = sessions.map(s => ({
      ...s,
      total_items: sessionMap[s.id]?.count || 0,
      total_stock_value: sessionMap[s.id]?.value || 0,
      hospital_name: hospitalMap[s.hospital_id]?.name || '',
      hospital_location: hospitalMap[s.hospital_id]?.location || '',
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audits', async (req, res) => {
  const { name, audit_date, hospital_id, assigned_members } = req.body;
  const userRole = req.headers['x-user-role'];
  const userName = req.headers['x-user-name'];
  const userId = req.headers['x-user-id'];

  if (!isPrivileged(userRole)) {
    return res.status(403).json({ error: 'Only administrators can create audit sessions.' });
  }
  if (!name) {
    return res.status(400).json({ error: 'Session name is required.' });
  }
  if (!hospital_id) {
    return res.status(400).json({ error: 'Target hospital is required.' });
  }
  if (!assigned_members || assigned_members.length === 0) {
    return res.status(400).json({ error: 'At least one auditor must be selected.' });
  }

  const todayDate = new Date().toISOString().split('T')[0];

  try {
    const { data, error } = await supabase
      .from('audit_sessions')
      .insert([{
        name,
        audit_date: todayDate,
        status: 'Active',
        created_at: new Date().toISOString(),
        hospital_id: hospital_id,
        created_by: userName || 'Admin',
      }])
      .select()
      .single();
    if (error) throw error;

    // Collect all assigned user IDs
    const assignedUserIds = new Set();
    assigned_members.forEach(uid => assignedUserIds.add(parseInt(uid)));

    // Always add the creating admin ID
    const adminIdNum = parseInt(userId);
    if (adminIdNum) assignedUserIds.add(adminIdNum);

    // Convert Set back to array and map to insert objects
    if (assignedUserIds.size > 0) {
      const memberInserts = Array.from(assignedUserIds).map(uid => ({
        audit_session_id: data.id,
        user_id: uid,
        status: 'active',
        added_at: new Date().toISOString(),
        action_by: userName || 'Admin',
      }));
      await supabase.from('audit_members').upsert(memberInserts, { onConflict: 'audit_session_id,user_id' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/audits/:id', async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers['x-user-role'];
  if (!isPrivileged(userRole)) {
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

app.put('/api/audits/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const userRole = req.headers['x-user-role'];
  if (!isPrivileged(userRole)) {
    return res.status(403).json({ error: 'Only administrators can change the audit status.' });
  }
  if (!status || !['Active', 'Completed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
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

// ─────────────────────────────────────────────────────────────────
// AUDIT MEMBER MANAGEMENT
// ─────────────────────────────────────────────────────────────────

// Get members for an audit session
app.get('/api/audits/:id/members', async (req, res) => {
  const { id } = req.params;
  const requesterRole = req.headers['x-user-role'];
  if (!requesterRole) return res.status(401).json({ error: 'Unauthorized.' });

  try {
    const { data: members, error } = await supabase
      .from('audit_members')
      .select('*')
      .eq('audit_session_id', id);
    if (error) throw error;

    // Enrich with user info
    const userIds = (members || []).map(m => m.user_id);
    let userMap = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase.from('users').select('*').in('id', userIds);
      (users || []).forEach(u => {
        const { cleanName, auditorSlot } = decodeUser(u);
        userMap[u.id] = { 
          name: cleanName, 
          role: auditorSlot, 
          username: u.username, 
          status: u.status,
          email: u.email || '',
          phone: u.phone || '',
          address: u.address || ''
        };
      });
    }

    const enriched = (members || []).map(m => {
      const lastActive = userActivityMap.get(String(m.user_id));
      const isOnline = lastActive ? (Date.now() - lastActive < 45000) : false;
      return {
        ...m,
        user_name: userMap[m.user_id]?.name || `User ${m.user_id}`,
        user_role: userMap[m.user_id]?.role || '',
        username: userMap[m.user_id]?.username || '',
        global_status: userMap[m.user_id]?.status || 'active',
        email: userMap[m.user_id]?.email || '',
        phone: userMap[m.user_id]?.phone || '',
        address: userMap[m.user_id]?.address || '',
        is_online: isOnline,
      };
    });

    // Dynamically append virtual members representing unique auditor names in auditor_counts
    const { data: countsData, error: countsErr } = await supabase.rpc('exec_raw_sql', {
      query_text: `
        SELECT DISTINCT ac.auditor_name 
        FROM auditor_counts ac
        JOIN items i ON i.id = ac.item_id
        WHERE i.audit_session_id = $1::bigint
      `,
      query_params: [String(id)]
    });
    if (countsErr) throw countsErr;

    const countAuditors = (countsData || [])
      .map(c => String(c.auditor_name))
      .filter(n => !n.startsWith('Physical Quantity'));

    const existingUserIdsOrNames = new Set([
      ...userIds.map(String),
      ...enriched.map(m => String(m.user_name).toLowerCase()),
      ...enriched.map(m => String(m.username).toLowerCase())
    ]);

    

    countAuditors.forEach(auditorName => {
      const lowerName = auditorName.toLowerCase();
      if (!existingUserIdsOrNames.has(auditorName) && !existingUserIdsOrNames.has(lowerName)) {
        enriched.push({
          id: auditorName,
          audit_session_id: parseInt(id),
          user_id: auditorName,
          status: 'active',
          user_name: auditorName,
          user_role: 'Imported',
          global_status: 'active',
          is_online: false,
          is_virtual: true
        });
      }
    });

    // Sort columns: real members first, then legacy/imported virtual columns sorted alphabetically with natural numeric ordering
    enriched.sort((a, b) => {
      if (a.is_virtual && !b.is_virtual) return 1;
      if (!a.is_virtual && b.is_virtual) return -1;
      if (a.is_virtual && b.is_virtual) {
        return String(a.user_name).localeCompare(String(b.user_name), undefined, { numeric: true, sensitivity: 'base' });
      }
      return Number(a.user_id || 0) - Number(b.user_id || 0);
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add member to audit mid-session
app.post('/api/audits/:id/members', async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.body;
  const requesterRole = req.headers['x-user-role'];
  const requesterName = req.headers['x-user-name'];

  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can add members.' });
  }
  try {
    const { data, error } = await supabase
      .from('audit_members')
      .upsert([{
        audit_session_id: parseInt(id),
        user_id: parseInt(user_id),
        status: 'active',
        added_at: new Date().toISOString(),
        action_by: requesterName || 'Admin',
      }], { onConflict: 'audit_session_id,user_id' })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Freeze/Unfreeze/Remove member from audit
app.put('/api/audits/:id/members/:userId', async (req, res) => {
  const { id, userId } = req.params;
  const { status } = req.body; // 'active' | 'frozen' | 'removed'
  const requesterRole = req.headers['x-user-role'];
  const requesterName = req.headers['x-user-name'];

  if (!isPrivileged(requesterRole)) {
    return res.status(403).json({ error: 'Only administrators can modify member status.' });
  }
  if (!['active', 'frozen', 'removed'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status.' });
  }

  try {
    const updateData = { status, action_by: requesterName || 'Admin' };
    if (status === 'frozen') updateData.frozen_at = new Date().toISOString();
    if (status === 'removed') updateData.removed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('audit_members')
      .update(updateData)
      .eq('audit_session_id', parseInt(id))
      .eq('user_id', parseInt(userId))
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// EXCEL IMPORT ROUTE
// ─────────────────────────────────────────────────────────────────
app.post('/api/audits/:id/import', enforceWritePermission, upload.single('file'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const filePath = req.file.path;
  try {
    importProgressMap.set(String(id), { total: 0, processed: 0, status: 'parsing', error: null });
    const count = await importExcel(id, filePath, (processed, total) => {
      importProgressMap.set(String(id), { total, processed, status: 'importing', error: null });
    });
    fs.unlinkSync(filePath);
    clearSessionCache(id);
    await prepopulateSessionCache(id);
    importProgressMap.set(String(id), { total: count, processed: count, status: 'completed', error: null });
    res.json({ success: true, imported_rows: count });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    importProgressMap.set(String(id), { total: 0, processed: 0, status: 'failed', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET Import progress
app.get('/api/audits/:id/import-progress', async (req, res) => {
  const { id } = req.params;
  const progress = importProgressMap.get(String(id)) || { total: 0, processed: 0, status: 'idle', error: null };
  res.json(progress);
});

// POST Reset import progress
app.post('/api/audits/:id/import-progress/reset', async (req, res) => {
  const { id } = req.params;
  importProgressMap.delete(String(id));
  res.json({ success: true });
});

// POST Reset/Remove imported data for a session
app.post('/api/audits/:id/reset-import', enforceWritePermission, async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers['x-user-role'];
  if (!isPrivileged(userRole)) {
    return res.status(403).json({ error: 'Only administrators can remove imported Excel data.' });
  }
  try {
    // 1. Get all item IDs belonging to this session
    const { data: items, error: fetchErr } = await supabase
      .from('items')
      .select('id')
      .eq('audit_session_id', id);
    if (fetchErr) throw fetchErr;

    const itemIds = (items || []).map(i => i.id);

    if (itemIds.length > 0) {
      const chunkSize = 500;
      for (let i = 0; i < itemIds.length; i += chunkSize) {
        const chunk = itemIds.slice(i, i + chunkSize);
        // 2. Delete auditor_counts
        await supabase.from('auditor_counts').delete().in('item_id', chunk);
        // 3. Delete audit_trail
        await supabase.from('audit_trail').delete().in('item_id', chunk);
      }
      // 4. Delete items
      const { error: delErr } = await supabase.from('items').delete().eq('audit_session_id', id);
      if (delErr) throw delErr;
    }

    clearSessionCache(id);
    res.json({ success: true, message: `Successfully removed ${itemIds.length} imported items.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add manual item registration (Extra Found items)
app.post('/api/audits/:id/items', enforceWritePermission, async (req, res) => {
  const { id } = req.params;
  const { item_name, batch_no, expiry_date, unit_mrp, unit_purchase_rate, system_qty, supplier, location, store_name, notes } = req.body;
  if (!item_name || !batch_no || !unit_purchase_rate) {
    return res.status(400).json({ error: 'Item name, batch number, and unit purchase rate are required.' });
  }
  try {
    const { data, error } = await supabase
      .from('items')
      .insert([{
        audit_session_id: parseInt(id),
        item_name, batch_no,
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

// ─────────────────────────────────────────────────────────────────
// AUDIT ITEMS & COLLABORATION ROUTES
// ─────────────────────────────────────────────────────────────────
app.get('/api/audits/:id/items', async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 30;
  const search = req.query.search || '';
  const filter = req.query.filter || '';
  const alphabetFilter = req.query.alphabet || '';
  const supplierFilter = req.query.supplier || '';
  const locationFilter = req.query.location || '';
  const storeFilter = req.query.store || '';
  const sortBy = req.query.sortBy || 'item_name'; // default to item_name
  const sortOrder = req.query.sortOrder || 'asc';
  const offset = (page - 1) * limit;

  try {
    const cacheKey = String(id);
    console.log(`[CACHE DEBUG] items endpoint hit-test for session ${cacheKey}: ${sessionCache.has(cacheKey)}`);
    if (sessionCache.has(cacheKey)) {
      const cached = sessionCache.get(cacheKey);
      const { processedList, suppliers, locations, stores } = cached;

      // Apply filtering in memory
      let filteredList = processedList;
      if (search) {
        const s = search.toLowerCase();
        filteredList = filteredList.filter(item => 
          String(item.item_name || '').toLowerCase().includes(s) ||
          String(item.batch_no || '').toLowerCase().includes(s) ||
          String(item.supplier || '').toLowerCase().includes(s)
        );
      }
      if (supplierFilter) {
        filteredList = filteredList.filter(item => item.supplier === supplierFilter);
      }
      if (locationFilter) {
        filteredList = filteredList.filter(item => item.location === locationFilter);
      }
      if (storeFilter) {
        filteredList = filteredList.filter(item => item.store_name === storeFilter);
      }

      // Apply category filter
      if (filter) {
        if (filter === 'EXPIRED' || filter === 'Expired Stock') filteredList = filteredList.filter(i => i.expiryStatus === 'EXPIRED');
        else if (filter === 'NEAR EXPIRY') filteredList = filteredList.filter(i => i.expiryStatus === 'NEAR EXPIRY');
        else if (filter === 'GOOD STOCK') filteredList = filteredList.filter(i => i.expiryStatus === 'GOOD STOCK');
        else if (filter === 'Shortage') filteredList = filteredList.filter(i => i.category === 'Shortage');
        else if (filter === 'Excess') filteredList = filteredList.filter(i => i.category === 'Excess');
        else if (filter === 'Perfect Match') filteredList = filteredList.filter(i => i.category === 'Perfect Match');
        else if (filter === 'Extra Found') filteredList = filteredList.filter(i => i.category === 'Extra Found');
        else if (filter === 'Not Counted') filteredList = filteredList.filter(i => i.auditor_counts.length === 0);
      }

      if (alphabetFilter) {
        if (alphabetFilter === '0-9') {
          filteredList = filteredList.filter(item => /^[0-9]/.test(item.item_name));
        } else {
          filteredList = filteredList.filter(item => String(item.item_name || '').toUpperCase().startsWith(alphabetFilter));
        }
      }

      // FIX 2: Spread before sort to avoid mutating the cached array reference
      const sortedList = [...filteredList].sort((a, b) => {
        let valA, valB;

        if (sortBy === 'item_name') {
          valA = String(a.item_name || '').toLowerCase();
          valB = String(b.item_name || '').toLowerCase();
        } else if (sortBy === 'batch_no') {
          valA = String(a.batch_no || '').toLowerCase();
          valB = String(b.batch_no || '').toLowerCase();
        } else if (sortBy === 'expiry_date') {
          valA = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
          valB = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
        } else if (sortBy === 'unit_purchase_rate') {
          valA = Number(a.unit_purchase_rate || 0);
          valB = Number(b.unit_purchase_rate || 0);
        } else if (sortBy === 'system_qty') {
          valA = Number(a.system_qty || 0);
          valB = Number(b.system_qty || 0);
        } else if (sortBy === 'totalPhysical') {
          valA = Number(a.totalPhysical || 0);
          valB = Number(b.totalPhysical || 0);
        } else if (sortBy === 'difference') {
          valA = Number(a.difference || 0);
          valB = Number(b.difference || 0);
        } else if (sortBy === 'differenceValue') {
          valA = Number(a.differenceValue || 0);
          valB = Number(b.differenceValue || 0);
        } else if (sortBy === 'category') {
          valA = String(a.category || '').toLowerCase();
          valB = String(b.category || '').toLowerCase();
        } else if (sortBy === 'location') {
          valA = String(a.location || '').toLowerCase();
          valB = String(b.location || '').toLowerCase();
        } else {
          valA = Number(a.id || 0);
          valB = Number(b.id || 0);
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });

      const totalCount = sortedList.length;
      const paginatedList = sortedList.slice(offset, offset + limit);

      res.json({ items: paginatedList, total: totalCount, page, limit, meta: { suppliers, locations, stores } });
      return;
    }

    let processedList;
    let suppliers, locations, stores;

    try {
      const data = await fetchSessionData(id);
      processedList = data.processedList;
      suppliers = data.suppliers;
      locations = data.locations;
      stores = data.stores;
      sessionCache.set(cacheKey, data);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }

    // Apply filtering in memory
    let filteredList = processedList;
    if (search) {
      const s = search.toLowerCase();
      filteredList = filteredList.filter(item => 
        String(item.item_name || '').toLowerCase().includes(s) ||
        String(item.batch_no || '').toLowerCase().includes(s) ||
        String(item.supplier || '').toLowerCase().includes(s)
      );
    }
    if (supplierFilter) {
      filteredList = filteredList.filter(item => item.supplier === supplierFilter);
    }
    if (locationFilter) {
      filteredList = filteredList.filter(item => item.location === locationFilter);
    }
    if (storeFilter) {
      filteredList = filteredList.filter(item => item.store_name === storeFilter);
    }

    // Apply category filter
    if (filter) {
      if (filter === 'EXPIRED' || filter === 'Expired Stock') filteredList = filteredList.filter(i => i.expiryStatus === 'EXPIRED');
      else if (filter === 'NEAR EXPIRY') filteredList = filteredList.filter(i => i.expiryStatus === 'NEAR EXPIRY');
      else if (filter === 'GOOD STOCK') filteredList = filteredList.filter(i => i.expiryStatus === 'GOOD STOCK');
      else if (filter === 'Shortage') filteredList = filteredList.filter(i => i.category === 'Shortage');
      else if (filter === 'Excess') filteredList = filteredList.filter(i => i.category === 'Excess');
      else if (filter === 'Perfect Match') filteredList = filteredList.filter(i => i.category === 'Perfect Match');
      else if (filter === 'Extra Found') filteredList = filteredList.filter(i => i.category === 'Extra Found');
      else if (filter === 'Not Counted') filteredList = filteredList.filter(i => i.auditor_counts.length === 0);
    }

    if (alphabetFilter) {
      if (alphabetFilter === '0-9') {
        filteredList = filteredList.filter(item => /^[0-9]/.test(item.item_name));
      } else {
        filteredList = filteredList.filter(item => String(item.item_name || '').toUpperCase().startsWith(alphabetFilter));
      }
    }

    // FIX 2: Spread before sort to avoid mutating the cached array reference
    const sortedList = [...filteredList].sort((a, b) => {
      let valA, valB;

      if (sortBy === 'item_name') {
        valA = String(a.item_name || '').toLowerCase();
        valB = String(b.item_name || '').toLowerCase();
      } else if (sortBy === 'batch_no') {
        valA = String(a.batch_no || '').toLowerCase();
        valB = String(b.batch_no || '').toLowerCase();
      } else if (sortBy === 'expiry_date') {
        valA = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
        valB = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
      } else if (sortBy === 'unit_purchase_rate') {
        valA = Number(a.unit_purchase_rate || 0);
        valB = Number(b.unit_purchase_rate || 0);
      } else if (sortBy === 'system_qty') {
        valA = Number(a.system_qty || 0);
        valB = Number(b.system_qty || 0);
      } else if (sortBy === 'totalPhysical') {
        valA = Number(a.totalPhysical || 0);
        valB = Number(b.totalPhysical || 0);
      } else if (sortBy === 'difference') {
        valA = Number(a.difference || 0);
        valB = Number(b.difference || 0);
      } else if (sortBy === 'differenceValue') {
        valA = Number(a.differenceValue || 0);
        valB = Number(b.differenceValue || 0);
      } else if (sortBy === 'category') {
        valA = String(a.category || '').toLowerCase();
        valB = String(b.category || '').toLowerCase();
      } else if (sortBy === 'location') {
        valA = String(a.location || '').toLowerCase();
        valB = String(b.location || '').toLowerCase();
      } else {
        valA = Number(a.id || 0);
        valB = Number(b.id || 0);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const totalCount = sortedList.length;
    const paginatedList = sortedList.slice(offset, offset + limit);

    res.json({ items: paginatedList, total: totalCount, page, limit, meta: { suppliers, locations, stores } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// Cache Updater (Updates cached items in place to avoid full rebuilds)
// ─────────────────────────────────────────────────────────────────
const updateCacheInPlace = (sessionId, itemId, auditorName, physicalCount, expiryCheck, remarks, isDelete) => {
  const cacheKey = String(sessionId);
  if (!sessionCache.has(cacheKey)) return;

  const cached = sessionCache.get(cacheKey);
  const cachedItem = cached.processedList.find(i => Number(i.id) === Number(itemId));
  if (!cachedItem) {
    sessionCache.delete(cacheKey);
    return;
  }

  if (!cachedItem.auditor_counts) cachedItem.auditor_counts = [];

  if (isDelete) {
    cachedItem.auditor_counts = cachedItem.auditor_counts.filter(
      c => String(c.auditor_name) !== String(auditorName)
    );
  } else {
    const existingC = cachedItem.auditor_counts.find(
      c => String(c.auditor_name) === String(auditorName)
    );
    if (existingC) {
      existingC.physical_count = physicalCount !== null ? parseInt(physicalCount) : null;
      existingC.expiry_check = expiryCheck ? true : false;
      existingC.remarks = remarks || '';
      existingC.updated_at = new Date().toISOString();
    } else {
      cachedItem.auditor_counts.push({
        item_id: parseInt(itemId),
        auditor_name: auditorName,
        physical_count: physicalCount !== null ? parseInt(physicalCount) : null,
        expiry_check: expiryCheck ? true : false,
        remarks: remarks || '',
        updated_at: new Date().toISOString()
      });
    }
  }

  const ALLOWED_AUDITORS = cached.ALLOWED_AUDITORS || [];
  const auditorTotal = cachedItem.auditor_counts.reduce((sum, c) => {
    if (ALLOWED_AUDITORS.includes(String(c.auditor_name))) return sum + (c.physical_count || 0);
    return sum;
  }, 0);
  
  const hasExpiredCheck = cachedItem.auditor_counts.some(c => c.expiry_check === true || c.expiry_check === 1);
  const totalPhysical = auditorTotal + Number(cachedItem.manual_add || 0) + Number(cachedItem.manual_recheck || 0);

  const hasValidCount = cachedItem.auditor_counts.some(c => ALLOWED_AUDITORS.includes(String(c.auditor_name)));
  const isCounted = hasValidCount || Number(cachedItem.manual_add || 0) !== 0 || Number(cachedItem.manual_recheck || 0) !== 0;

  const difference = isCounted ? (totalPhysical - (cachedItem.system_qty || 0)) : 0;
  const differenceValue = difference * (cachedItem.unit_purchase_rate || 0);

  let expiryStatus = 'GOOD STOCK';
  if (cachedItem.expiry_date && cached.auditDate) {
    const itemDate = new Date(cachedItem.expiry_date);
    itemDate.setHours(0, 0, 0, 0);
    const refDate = new Date(cached.auditDate);
    refDate.setHours(0, 0, 0, 0);
    const ninetyDays = new Date(refDate);
    ninetyDays.setDate(refDate.getDate() + 90);
    if (itemDate < refDate) expiryStatus = 'EXPIRED';
    else if (itemDate <= ninetyDays) expiryStatus = 'NEAR EXPIRY';
    else expiryStatus = 'GOOD STOCK';
  }
  if (hasExpiredCheck) expiryStatus = 'EXPIRED';

  let category = 'Not Counted';
  if (isCounted) {
    if (cachedItem.system_qty === 0 && totalPhysical > 0) category = 'Extra Found';
    else if (expiryStatus === 'EXPIRED' && totalPhysical > 0) category = 'Expired Stock';
    else if (cachedItem.notes && cachedItem.notes.startsWith('OT')) category = 'Other';
    else if (difference > 0) category = 'Excess';
    else if (difference < 0) category = 'Shortage';
    else category = 'Perfect Match';
  }

  cachedItem.totalPhysical = totalPhysical;
  cachedItem.difference = difference;
  cachedItem.differenceValue = differenceValue;
  cachedItem.expiryStatus = expiryStatus;
  cachedItem.category = category;
};

// ─────────────────────────────────────────────────────────────────
// COUNT UPDATE HANDLER (supports dynamic user_id or legacy slot)
// ─────────────────────────────────────────────────────────────────
const handleCountUpdate = async (req, res) => {
  const { id } = req.params;
  const { auditor_name, physical_count, expiry_check, remarks } = req.body;
  const userRole = req.headers['x-user-role'];
  const userId = req.headers['x-user-id'];

  if (!auditor_name) return res.status(400).json({ error: 'Auditor name is required.' });

  // Permission check: non-privileged can only write to their own column
  // Column identity = user_id (string) for new system, or legacy role slot
  if (!isPrivileged(userRole)) {
    const isOwnColumn = String(auditor_name) === String(userId) || auditor_name === userRole;
    if (!isOwnColumn) {
      return res.status(403).json({ error: 'You can only edit your own column.' });
    }
  }

  try {
    const { data: item, error: iErr } = await supabase.from('items').select('*').eq('id', id).single();
    if (iErr || !item) return res.status(404).json({ error: 'Item not found' });

    if (item.is_locked && !isPrivileged(userRole)) {
      return res.status(403).json({ error: 'This row is locked.' });
    }

    // Check if this user is frozen or removed from this audit
    if (!isPrivileged(userRole) && userId) {
      const { data: memberRecord } = await supabase
        .from('audit_members')
        .select('status')
        .eq('audit_session_id', item.audit_session_id)
        .eq('user_id', parseInt(userId))
        .single();

      if (memberRecord && memberRecord.status !== 'active') {
        return res.status(403).json({ error: 'Your access to this audit has been restricted.' });
      }
    }

    const { data: oldCount } = await supabase
      .from('auditor_counts')
      .select('*')
      .eq('item_id', id)
      .eq('auditor_name', auditor_name)
      .single();

    const isDelete = physical_count === null || physical_count === undefined || physical_count === '';

    // Use user_id as the trail user_name for new entries
    const trailUserName = userId || auditor_name;

    if (isDelete) {
      const { error: delErr } = await supabase.from('auditor_counts').delete()
        .eq('item_id', parseInt(id)).eq('auditor_name', auditor_name);
      if (delErr) throw delErr;

      // Update cache in place to prevent database polling bottleneck
      updateCacheInPlace(item.audit_session_id, id, auditor_name, null, expiry_check, remarks, true);

      const oldVal = oldCount ? `${oldCount.physical_count}` : 'None';
      if (oldVal !== 'None') {
        await supabase.from('audit_trail').insert([{
          item_id: parseInt(id),
          user_name: trailUserName,
          timestamp: new Date().toISOString(),
          field_name: `Auditor Count (${auditor_name})`,
          old_value: oldVal,
          new_value: 'None',
          reason: remarks || 'Count cleared'
        }]);
      }
    } else {
      const { error: upsertErr } = await supabase.from('auditor_counts').upsert([{
        item_id: parseInt(id),
        auditor_name,
        physical_count: parseInt(physical_count),
        expiry_check: expiry_check ? true : false,
        remarks: remarks || '',
        updated_at: new Date().toISOString()
      }], { onConflict: 'item_id,auditor_name' });
      if (upsertErr) throw upsertErr;

      // Update cache in place to prevent database polling bottleneck
      updateCacheInPlace(item.audit_session_id, id, auditor_name, physical_count, expiry_check, remarks, false);

      const oldVal = oldCount ? `${oldCount.physical_count}` : 'None';
      const newVal = `${physical_count}`;
      if (oldVal !== newVal) {
        await supabase.from('audit_trail').insert([{
          item_id: parseInt(id),
          user_name: trailUserName,
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

// Update Item (Admin/Developer only)
app.put('/api/items/:id', enforceWritePermission, async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers['x-user-role'];
  if (!isPrivileged(userRole)) {
    return res.status(403).json({ error: 'Only administrators can edit item fields.' });
  }
  const { manual_add, manual_recheck, notes, user_name, reason, item_name, batch_no, expiry_date, unit_purchase_rate, unit_mrp, system_qty, location, store_name, supplier } = req.body;
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
        trailEntries.push({ item_id: parseInt(id), user_name: editor, timestamp, field_name: label, old_value: String(item[field] || ''), new_value: String(newVal), reason: changeReason });
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
      if (trailEntries.length > 0) await supabase.from('audit_trail').insert(trailEntries);
    }

    clearSessionCache(item.audit_session_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lock/Unlock Item Row
app.post('/api/items/:id/lock', enforceWritePermission, async (req, res) => {
  const { id } = req.params;
  const { is_locked, user_name, reason } = req.body;
  const userRole = req.headers['x-user-role'];
  if (!isPrivileged(userRole)) return res.status(403).json({ error: 'Only administrators can lock rows.' });
  if (is_locked === undefined || !user_name || !reason) return res.status(400).json({ error: 'is_locked, user_name, and reason are required.' });
  try {
    const { data: item } = await supabase.from('items').select('*').eq('id', id).single();
    if (!item) return res.status(404).json({ error: 'Item not found.' });
    await supabase.from('items').update({ is_locked: !!is_locked }).eq('id', id);
    await supabase.from('audit_trail').insert([{
      item_id: parseInt(id), user_name, timestamp: new Date().toISOString(),
      field_name: 'Row Lock State',
      old_value: item.is_locked ? 'Locked' : 'Unlocked',
      new_value: is_locked ? 'Locked' : 'Unlocked',
      reason
    }]);
    clearSessionCache(item.audit_session_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete Item Row
app.delete('/api/items/:id', enforceWritePermission, async (req, res) => {
  const { id } = req.params;
  const userRole = req.headers['x-user-role'];
  if (!isPrivileged(userRole)) return res.status(403).json({ error: 'Only administrators can delete items.' });
  try {
    const { data: item } = await supabase.from('items').select('audit_session_id').eq('id', id).single();
    const sessId = item ? item.audit_session_id : null;
    await supabase.from('auditor_counts').delete().eq('item_id', id);
    await supabase.from('audit_trail').delete().eq('item_id', id);
    await supabase.from('items').delete().eq('id', id);
    if (sessId) clearSessionCache(sessId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// ITEM HISTORY ROUTE
// ─────────────────────────────────────────────────────────────────
app.get('/api/items/:id/history', async (req, res) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('audit_trail').select('*').eq('item_id', id).order('timestamp', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// DASHBOARD ROUTE (enhanced with member performance)
// ─────────────────────────────────────────────────────────────────
app.get('/api/audits/:id/dashboard', async (req, res) => {
  const { id } = req.params;
  const requesterRole = req.headers['x-user-role'];

  // Only upper tiers can see dashboard
  if (!isUpperTier(requesterRole)) {
    return res.status(403).json({ error: 'Dashboard access restricted.' });
  }

  try {
    const cacheKey = String(id);
    console.log(`[CACHE DEBUG] dashboard endpoint hit-test for session ${cacheKey}: ${sessionCache.has(cacheKey)}`);
    if (sessionCache.has(cacheKey)) {
      const cached = sessionCache.get(cacheKey);
      return res.json(cached.dashboardData);
    }

    const data = await fetchSessionData(id);
    sessionCache.set(cacheKey, data);
    return res.json(data.dashboardData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// REPORT EXPORT (Admin/Developer/CoFounder only)
// ─────────────────────────────────────────────────────────────────
app.get('/api/audits/:id/export', async (req, res) => {
  const { id } = req.params;
  const requesterRole = req.headers['x-user-role'] || req.query.role;
  if (!isUpperTier(requesterRole)) {
    return res.status(403).json({ error: 'Export access restricted.' });
  }
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
  const requesterRole = req.headers['x-user-role'] || req.query.role;
  if (!isUpperTier(requesterRole)) {
    return res.status(403).json({ error: 'Export access restricted.' });
  }
  try {
    const buffer = await generateWordReport(id);
    res.setHeader('Content-Type', 'application/msword');
    res.setHeader('Content-Disposition', `attachment; filename=Audit_Analysis_Report_${id}.doc`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
// AUDIT TRAIL ROUTE
// ─────────────────────────────────────────────────────────────────
app.get('/api/audits/:id/trail', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: trail, error: tErr } = await supabase
      .from('audit_trail')
      .select('*, items!inner(audit_session_id, item_name, batch_no)')
      .eq('items.audit_session_id', id)
      .order('timestamp', { ascending: false });
    if (tErr) throw tErr;

    // Get user names for enriching trail
    const { data: users } = await supabase.from('users').select('id, name, display_name, username');
    const userNameMap = {};
    (users || []).forEach(u => {
      const parts = (u.name || '').split('|');
      const cleanName = u.display_name || parts[0] || u.username;
      userNameMap[String(u.id)] = cleanName;
    });

    const enriched = (trail || []).map(t => ({
      ...t,
      item_name: t.items?.item_name || '',
      batch_no: t.items?.batch_no || '',
      display_user_name: userNameMap[String(t.user_name)] || t.user_name,
    }));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  await initDb();
  console.log(`Backend server running on port ${PORT}`);
});
