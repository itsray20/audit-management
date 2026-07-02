require('dotenv').config();
const { supabase } = require('../db');

// Mock session cache and fetchSessionData
const sessionCache = new Map();

const fetchSessionData = async (id) => {
  // Mock simple fetch
  const { data: session } = await supabase.from('audit_sessions').select('*').eq('id', id).single();
  const { data: itemsList } = await supabase.rpc('exec_raw_sql', {
    query_text: 'SELECT * FROM items WHERE audit_session_id = $1::bigint ORDER BY id ASC',
    query_params: [String(id)]
  });
  const { data: allCounts } = await supabase.rpc('exec_raw_sql', {
    query_text: 'SELECT ac.* FROM auditor_counts ac JOIN items i ON i.id = ac.item_id WHERE i.audit_session_id = $1::bigint',
    query_params: [String(id)]
  });
  const { data: auditMembers } = await supabase.from('audit_members').select('user_id, status').eq('audit_session_id', id);
  const memberIds = (auditMembers || []).map(m => String(m.user_id));
  const ALLOWED_AUDITORS = [...memberIds, 'Physical Quantity', 'Physical Quantity_1', 'Physical Quantity_2'];
  const processedList = (itemsList || []).map(item => ({ ...item, totalPhysical: 0, differenceValue: 0, category: 'Not Counted' }));
  return { processedList, ALLOWED_AUDITORS, auditMembers, itemsList, allCounts };
};

const run = async () => {
  const id = 46;
  const cacheKey = String(id);

  console.time('Full FetchSessionData (Cache Miss)');
  const data = await fetchSessionData(id);
  sessionCache.set(cacheKey, data);
  console.timeEnd('Full FetchSessionData (Cache Miss)');

  // Run the Cache Hit Pathway
  console.time('Cache Hit Entire Block');
  
  console.time('1. Read Cache');
  const cached = sessionCache.get(cacheKey);
  const processedItems = cached.processedList;
  const ALLOWED_AUDITORS = cached.ALLOWED_AUDITORS || [];
  const allCounts = [];
  processedItems.forEach(item => {
    if (item.auditor_counts) allCounts.push(...item.auditor_counts);
  });
  console.timeEnd('1. Read Cache');

  console.time('2. Query Audit Members');
  const { data: members } = await supabase.from('audit_members').select('*').eq('audit_session_id', id);
  const auditMembers = members || [];
  console.timeEnd('2. Query Audit Members');

  console.time('3. Reduce Calculations');
  const totalItems = processedItems.length;
  const totalStockValue = processedItems.reduce((sum, item) => sum + ((item.system_qty || 0) * (item.unit_purchase_rate || 0)), 0);
  // ... (simulating the math processing)
  console.timeEnd('3. Reduce Calculations');

  console.time('4. Query Audit Trail (JOIN)');
  const { data: trailData } = await supabase
    .from('audit_trail')
    .select('user_name, items!inner(audit_session_id)')
    .eq('items.audit_session_id', id);
  console.timeEnd('4. Query Audit Trail (JOIN)');

  console.time('5. Query Users (Members enrichment)');
  const memberUserIds = (auditMembers || []).map(m => m.user_id);
  if (memberUserIds.length > 0) {
    const { data: memberUsers } = await supabase.from('users').select('*').in('id', memberUserIds);
  }
  console.timeEnd('5. Query Users (Members enrichment)');

  console.timeEnd('Cache Hit Entire Block');
};

run().then(() => process.exit(0));
