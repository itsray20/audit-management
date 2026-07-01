const { supabase } = require('../db');

async function inspect() {
  try {
    const { data: items, error: iErr } = await supabase.from('items').select('*').limit(1);
    if (iErr) console.error('items error:', iErr.message);
    else console.log('items columns:', items.length > 0 ? Object.keys(items[0]) : 'No rows');

    const { data: users, error: uErr } = await supabase.from('users').select('*').limit(1);
    if (uErr) console.error('users error:', uErr.message);
    else console.log('users columns:', users.length > 0 ? Object.keys(users[0]) : 'No rows');

    const { data: counts, error: cErr } = await supabase.from('auditor_counts').select('*').limit(1);
    if (cErr) console.error('auditor_counts error:', cErr.message);
    else console.log('auditor_counts columns:', counts.length > 0 ? Object.keys(counts[0]) : 'No rows');

    const { data: trail, error: tErr } = await supabase.from('audit_trail').select('*').limit(1);
    if (tErr) console.error('audit_trail error:', tErr.message);
    else console.log('audit_trail columns:', trail.length > 0 ? Object.keys(trail[0]) : 'No rows');
  } catch (err) {
    console.error('Error:', err);
  }
}

inspect();
