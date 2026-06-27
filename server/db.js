require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: run raw SQL via RPC (for complex queries)
const rawQuery = async (query, params = []) => {
  const { data, error } = await supabase.rpc('exec_raw_sql', { query_text: query, query_params: params });
  if (error) throw new Error(error.message);
  return data;
};

// Seed default users if table is empty
const initDb = async () => {
  console.log('Checking Supabase connection and seeding data...');
  try {
    const { data: users, error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;

    if (!users || users.length === 0) {
      console.log('Seeding default users...');
      const { error: seedError } = await supabase.from('users').insert([
        { username: 'admin', name: 'System Admin', role: 'Admin' },
        { username: 'manager', name: 'Audit Manager', role: 'Audit Manager' },
        { username: 'sri', name: 'Sri', role: 'Auditor' },
        { username: 'sravani', name: 'Sravani', role: 'Auditor' },
        { username: 'sanathu', name: 'Sanathu', role: 'Auditor' },
        { username: 'sha', name: 'Sha', role: 'Auditor' },
        { username: 'operator', name: 'Data Entry Operator', role: 'Data Entry Operator' }
      ]);
      if (seedError) throw seedError;
    }

    console.log('Database ready.');
  } catch (err) {
    console.error('Database init error:', err.message);
    throw err;
  }
};

module.exports = { supabase, initDb };
