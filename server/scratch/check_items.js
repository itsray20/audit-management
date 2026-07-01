const { supabase } = require('../db');

async function check() {
  const sessionId = 24;
  const { data: items, error: iErr } = await supabase.from('items').select('*').eq('audit_session_id', sessionId);
  if (iErr) throw iErr;

  const countedItems = items.filter(item => {
    return Number(item.manual_add || 0) !== 0 || Number(item.manual_recheck || 0) !== 0;
  });

  console.log(`Items in session 24 with manual_add or manual_recheck non-zero: ${countedItems.length}`);
  if (countedItems.length > 0) {
    console.log(countedItems.slice(0, 5).map(item => ({
      item_name: item.item_name,
      manual_add: item.manual_add,
      manual_recheck: item.manual_recheck,
      system_qty: item.system_qty,
      unit_purchase_rate: item.unit_purchase_rate
    })));
  }

  // Let's check a few items that have auditor_counts
  const itemIds = items.map(i => i.id);
  const { data: counts, error: cErr } = await supabase.from('auditor_counts').select('*').in('item_id', itemIds);
  if (cErr) throw cErr;

  console.log(`Total auditor_counts for session 24 items: ${counts.length}`);
}

check();
