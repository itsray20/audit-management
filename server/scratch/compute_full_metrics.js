const { supabase } = require('../db');
const { calculateItemValues } = require('../export');

async function test() {
  try {
    const sessionId = 24;
    const { data: session } = await supabase.from('audit_sessions').select('*').eq('id', sessionId).single();

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
    
    // Get counts
    let allCounts = [];
    const chunkSize = 500;
    for (let i = 0; i < itemIds.length; i += chunkSize) {
      const chunk = itemIds.slice(i, i + chunkSize);
      const { data, error } = await supabase.from('auditor_counts').select('*').in('item_id', chunk);
      if (error) throw error;
      if (data) allCounts = allCounts.concat(data);
    }

    const countsByItem = {};
    allCounts.forEach(c => {
      if (!countsByItem[c.item_id]) countsByItem[c.item_id] = [];
      countsByItem[c.item_id].push(c);
    });

    // Let's get ALL unique auditor names from allCounts!
    const uniqueAuditors = Array.from(new Set(allCounts.map(c => String(c.auditor_name))));
    console.log('Unique auditors found in database counts:', uniqueAuditors);

    const LEGACY_SLOTS = ['Admin', 'User1', 'User2', 'User3', 'User4', 'User5'];
    const { data: auditMembers } = await supabase.from('audit_members').select('*').eq('audit_session_id', sessionId);
    const memberIds = (auditMembers || []).map(m => String(m.user_id));
    const ALLOWED_AUDITORS = Array.from(new Set([...LEGACY_SLOTS, ...memberIds, ...uniqueAuditors]));

    console.log('ALLOWED_AUDITORS containing all count authors:', ALLOWED_AUDITORS);

    const processedItems = items.map(item => {
      const itemCounts = countsByItem[item.id] || [];
      return calculateItemValues(item, itemCounts, session.audit_date, ALLOWED_AUDITORS);
    });

    const totalStockValue = processedItems.reduce((sum, item) => sum + ((item.system_qty || 0) * (item.unit_purchase_rate || 0)), 0);
    const totalExcessValue = processedItems.filter(i => i.category === 'Excess').reduce((sum, i) => sum + i.differenceValue, 0);
    const totalShortageValue = processedItems.filter(i => i.category === 'Shortage').reduce((sum, i) => sum + i.differenceValue, 0);
    const extraFoundValue = processedItems.filter(i => i.category === 'Extra Found').reduce((sum, i) => sum + (i.totalPhysical * (i.unit_purchase_rate || 0)), 0);
    const extraFoundQty = processedItems.filter(i => i.category === 'Extra Found').reduce((sum, i) => sum + (i.totalPhysical || 0), 0);
    const totalPerfectMatchValue = processedItems.filter(i => i.isCounted && (i.totalPhysical || 0) === (i.system_qty || 0)).reduce((sum, i) => sum + ((i.totalPhysical || 0) * (i.unit_purchase_rate || 0)), 0);
    const totalSystemExpiryValue = processedItems.filter(i => i.expiryStatus === 'EXPIRED').reduce((sum, i) => sum + ((i.system_qty || 0) * (i.unit_purchase_rate || 0)), 0);
    const totalPhysicalExpiryValue = processedItems.filter(i => i.expiryStatus === 'EXPIRED').reduce((sum, i) => sum + ((i.totalPhysical || 0) * (i.unit_purchase_rate || 0)), 0);

    const netAuditDifference = totalExcessValue + totalShortageValue + extraFoundValue;

    console.log('--- RE-CALCULATED METRICS ---');
    console.log(`Total Stock Value: ₹${totalStockValue.toLocaleString('en-IN')}`);
    console.log(`Total Excess Value: ₹${totalExcessValue.toLocaleString('en-IN')}`);
    console.log(`Total Shortage Value: ₹${totalShortageValue.toLocaleString('en-IN')}`);
    console.log(`Extra Found Value: ₹${extraFoundValue.toLocaleString('en-IN')} (Qty: ${extraFoundQty})`);
    console.log(`Net Audit Variance: ₹${netAuditDifference.toLocaleString('en-IN')}`);
    console.log(`Total Perfect Match: ₹${totalPerfectMatchValue.toLocaleString('en-IN')}`);
    console.log(`Total System Expiry: ₹${totalSystemExpiryValue.toLocaleString('en-IN')}`);
    console.log(`Total Physical Expiry: ₹${totalPhysicalExpiryValue.toLocaleString('en-IN')}`);
  } catch (err) {
    console.error('Error:', err);
  }
}

test();
