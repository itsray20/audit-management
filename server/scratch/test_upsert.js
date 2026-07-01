const { supabase } = require('../db');

async function test() {
  console.log('Testing raw count upsert in Supabase...');
  try {
    const { data: item, error: iErr } = await supabase
      .from('items')
      .select('id')
      .limit(1)
      .single();

    if (iErr) {
      console.error('Failed to get an item:', iErr);
      return;
    }

    console.log(`Found item ID: ${item.id}`);

    // Try to delete first to see if that works
    const { error: delErr } = await supabase
      .from('auditor_counts')
      .delete()
      .eq('item_id', item.id)
      .eq('auditor_name', 'Admin');
    console.log('Delete error status:', delErr);

    // Try to insert/upsert
    const { data, error } = await supabase
      .from('auditor_counts')
      .upsert([{
        item_id: item.id,
        auditor_name: 'Admin',
        physical_count: 48,
        expiry_check: false,
        remarks: 'Test script',
        updated_at: new Date().toISOString()
      }]);

    console.log('Upsert result:', data);
    console.log('Upsert error:', error);
  } catch (err) {
    console.error('Exception:', err);
  }
}

test();
