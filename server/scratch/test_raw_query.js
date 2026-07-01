const { supabase } = require('../db');

async function testRaw() {
  try {
    const { data, error } = await supabase.rpc('exec_raw_sql', { 
      query_text: 'SELECT 1 as test', 
      query_params: [] 
    });
    if (error) {
      console.error('RPC failed:', error.message);
    } else {
      console.log('RPC output:', data);
    }
  } catch (err) {
    console.error('Catch error:', err);
  }
}

testRaw();
