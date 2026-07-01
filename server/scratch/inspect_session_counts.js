const { supabase } = require('../db');

async function inspect() {
  try {
    const sessionId = 24; // Session AF
    const { data: items, error: iErr } = await supabase.from('items').select('id, item_name').eq('audit_session_id', sessionId);
    if (iErr) throw iErr;

    const itemIds = items.map(i => i.id);

    const { data: counts, error: cErr } = await supabase.from('auditor_counts').select('*').in('item_id', itemIds);
    if (cErr) throw cErr;

    console.log(`Total items: ${items.length}`);
    console.log(`Total auditor counts: ${counts.length}`);

    // Count auditor names
    const auditorNames = {};
    counts.forEach(c => {
      auditorNames[c.auditor_name] = (auditorNames[c.auditor_name] || 0) + 1;
    });
    console.log('Auditor count distribution:', auditorNames);

    // Let's also see what audit members are in the session
    const { data: members, error: mErr } = await supabase.from('audit_members').select('*').eq('audit_session_id', sessionId);
    if (mErr) throw mErr;
    console.log('Audit members in session 24:', members);
  } catch (err) {
    console.error('Error:', err);
  }
}

inspect();
