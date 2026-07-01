const { supabase } = require('../db');

async function run() {
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', {
      query_text: 'ALTER TABLE items ADD COLUMN IF NOT EXISTS result_category TEXT;',
      query_params: []
    });
    if (error) {
      console.error('Error adding column:', error.message);
    } else {
      console.log('Column result_category added successfully (or already existed).', data);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
