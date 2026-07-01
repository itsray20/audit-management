const { supabase } = require('../db');

async function inspect() {
  console.log('Querying recent audit trail logs...');
  try {
    const { data, error } = await supabase
      .from('audit_trail')
      .select('*')
      .order('id', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error(error);
    } else {
      console.log('Recent logs:', data);
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

inspect();
