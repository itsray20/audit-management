const { supabase } = require('../db');
const { calculateItemValues } = require('../export');

async function findSession() {
  try {
    const { data: sessions, error: sErr } = await supabase.from('audit_sessions').select('*');
    if (sErr) throw sErr;

    for (const session of sessions) {
      // Get all items in chunks
      let allItems = [];
      let pageNum = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('items')
          .select('*')
          .eq('audit_session_id', session.id)
          .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
          .order('id', { ascending: true });
          
        if (error) throw error;
        if (!data || data.length === 0) break;
        allItems = allItems.concat(data);
        if (data.length < pageSize) break;
        pageNum++;
      }
      
      const items = allItems;
      if (!items || items.length === 0) continue;

      // Get counts
      const itemIds = items.map(i => i.id);
      let allCounts = [];
      const chunkCountSize = 500;
      for (let i = 0; i < itemIds.length; i += chunkCountSize) {
        const chunk = itemIds.slice(i, i + chunkCountSize);
        const { data, error } = await supabase.from('auditor_counts').select('*').in('item_id', chunk);
        if (error) throw error;
        if (data) allCounts = allCounts.concat(data);
      }

      const countsByItem = {};
      allCounts.forEach(c => {
        if (!countsByItem[c.item_id]) countsByItem[c.item_id] = [];
        countsByItem[c.item_id].push(c);
      });

      const LEGACY_SLOTS = ['Admin', 'User1', 'User2', 'User3', 'User4', 'User5'];
      const { data: auditMembers } = await supabase.from('audit_members').select('*').eq('audit_session_id', session.id);
      const memberIds = (auditMembers || []).map(m => String(m.user_id));
      const ALLOWED_AUDITORS = [...LEGACY_SLOTS, ...memberIds];

      const processedItems = items.map(item => {
        const itemCounts = countsByItem[item.id] || [];
        return calculateItemValues(item, itemCounts, session.audit_date, ALLOWED_AUDITORS);
      });

      const totalStockValue = processedItems.reduce((sum, item) => sum + ((item.system_qty || 0) * (item.unit_purchase_rate || 0)), 0);
      const totalExcessValue = processedItems.filter(i => i.category === 'Excess').reduce((sum, i) => sum + i.differenceValue, 0);
      const totalShortageValue = processedItems.filter(i => i.category === 'Shortage').reduce((sum, i) => sum + i.differenceValue, 0);
      
      console.log(`Session ID: ${session.id}, Name: ${session.name}, Date: ${session.audit_date}, Status: ${session.status}`);
      console.log(`  Calculated Total Stock Value: ₹${totalStockValue.toLocaleString('en-IN')}`);
      console.log(`  Total Excess Value: ₹${totalExcessValue.toLocaleString('en-IN')}`);
      console.log(`  Total Shortage: ₹${totalShortageValue.toLocaleString('en-IN')}`);
      console.log(`  Number of items: ${items.length}, Number of counts: ${allCounts.length}`);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

findSession();
