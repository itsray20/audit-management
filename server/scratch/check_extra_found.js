const { supabase } = require('../db');

async function check() {
  try {
    const { data: sessions } = await supabase.from('audit_sessions').select('*');
    for (const session of sessions) {
      const { data: items, error: iErr } = await supabase
        .from('items')
        .select('*')
        .eq('audit_session_id', session.id)
        .eq('system_qty', 0);
      if (iErr) continue;

      if (items.length > 0) {
        console.log(`Session ID ${session.id} (${session.name}): ${items.length} items with system_qty === 0`);
        const itemIds = items.map(i => i.id);
        const { data: counts, error: cErr } = await supabase
          .from('auditor_counts')
          .select('*')
          .in('item_id', itemIds);
        if (!cErr && counts.length > 0) {
          console.log(`  Counts found: ${counts.length}. Auditor names:`, Array.from(new Set(counts.map(c => c.auditor_name))));
        }
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

check();
