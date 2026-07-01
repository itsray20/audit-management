const { supabase } = require('../db');

async function query() {
  try {
    const { data: sessions, error: sErr } = await supabase.from('audit_sessions').select('*');
    if (sErr) {
      console.error('sessions error:', sErr.message);
      return;
    }
    console.log('--- SESSIONS ---');
    console.log(sessions);

    for (const session of sessions) {
      const { count: itemsCount, error: iErr } = await supabase
        .from('items')
        .select('*', { count: 'exact', head: true })
        .eq('audit_session_id', session.id);
      
      const { data: items, error: iDataErr } = await supabase
        .from('items')
        .select('id')
        .eq('audit_session_id', session.id);
      
      const itemIds = (items || []).map(i => i.id);

      let countsCount = 0;
      if (itemIds.length > 0) {
        const { count, error: cErr } = await supabase
          .from('auditor_counts')
          .select('*', { count: 'exact', head: true })
          .in('item_id', itemIds);
        countsCount = count || 0;
      }

      console.log(`Session ID ${session.id} (${session.name}): ${itemsCount} items, ${countsCount} auditor counts`);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

query();
