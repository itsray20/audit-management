const { supabase } = require('../db');
const { calculateItemValues } = require('../export');

async function fetchCountsInChunks(itemIds) {
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
}

async function check() {
  try {
    const sessionId = 24;
    // Get all items in chunks
    let allItems = [];
    let pageNum = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('audit_session_id', sessionId)
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
        .order('id', { ascending: true });
        
      if (error) throw error;
      if (!data || data.length === 0) break;
      allItems = allItems.concat(data);
      if (data.length < pageSize) break;
      pageNum++;
    }

    const items = allItems;
    const itemIds = items.map(i => i.id);

    const counts = await fetchCountsInChunks(itemIds);

    const countsByItem = {};
    counts.forEach(c => {
      if (!countsByItem[c.item_id]) countsByItem[c.item_id] = [];
      countsByItem[c.item_id].push(c);
    });

    const LEGACY_SLOTS = ['Admin', 'User1', 'User2', 'User3', 'User4', 'User5'];
    const { data: auditMembers, error: mErr } = await supabase.from('audit_members').select('*').eq('audit_session_id', sessionId);
    if (mErr) throw mErr;
    const memberIds = (auditMembers || []).map(m => String(m.user_id));
    const ALLOWED_AUDITORS = [...LEGACY_SLOTS, ...memberIds];

    const processedItems = items.map(item => {
      const itemCounts = countsByItem[item.id] || [];
      return calculateItemValues(item, itemCounts, null, ALLOWED_AUDITORS);
    });

    const nonZero = processedItems.filter(i => i.differenceValue !== 0);
    console.log(`Number of items with differenceValue !== 0: ${nonZero.length}`);
    nonZero.slice(0, 10).forEach(i => {
      console.log(`Item: ${i.item_name}, System Qty: ${i.system_qty}, Total Physical: ${i.totalPhysical}, Diff: ${i.difference}, DiffVal: ${i.differenceValue}, Category: ${i.category}`);
      console.log(`  Auditor counts:`, countsByItem[i.id]);
    });
  } catch (err) {
    console.error('Unhandled rejection caught in catch block:', err);
  }
}

check();
