const { supabase } = require('../db');

async function list() {
  try {
    // Try to query from a public view or table
    const { data, error } = await supabase.rpc('get_my_rpcs'); // just a guess
    if (error) {
      console.log('rpc error:', error.message);
    } else {
      console.log('rpcs:', data);
    }
  } catch (e) {
    console.error(e);
  }
}
list();
