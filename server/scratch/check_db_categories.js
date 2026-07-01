const { supabase } = require('../db');

async function check() {
  try {
    const sessionId = 24;
    const { data: items, error: iErr } = await supabase
      .from('items')
      .select('id, item_name, type, notes, system_qty')
      .eq('audit_session_id', sessionId);
    if (iErr) throw iErr;

    const types = {};
    items.forEach(i => {
      types[i.type] = (types[i.type] || 0) + 1;
    });

    console.log('Database type column distribution for Session 24:', types);
  } catch (err) {
    console.error('Error:', err);
  }
}

check();
