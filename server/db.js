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

const initDb = async () => {
  console.log('Checking Supabase connection and seeding data...');
  try {
    const { data: existingUsers, error } = await supabase.from('users').select('username');
    if (error) {
      console.warn('Could not read users table:', error.message);
      console.log('Database ready (skipped user seed check).');
      return;
    }

    const hasSrikant = existingUsers && existingUsers.some(u => u.username === 'srikant');

    if (!hasSrikant) {
      console.log('Re-seeding standard committee users...');
      await supabase.from('users').delete().neq('id', 0);

      // Supabase schema only allows roles: 'Admin' and 'Auditor'
      // We encode: name = "DisplayName|Password|AuditorSlot"
      // Slot is Admin/User1/User2/User3/User4/User5
      const seedData = [
        { username: 'srikant',   name: 'Srikant|srikant123|Admin',    role: 'Admin'   },
        { username: 'user1',     name: 'User 1|user123|User1',         role: 'Auditor' },
        { username: 'sathya',    name: 'Sathya|user223|User2',         role: 'Auditor' },
        { username: 'santosh',   name: 'Santosh|user323|User3',        role: 'Auditor' },
        { username: 'naveen',    name: 'Naveen|user423|User4',         role: 'Auditor' },
        { username: 'shreeyash', name: 'Shreeyash|user523|User5',      role: 'Auditor' }
      ];

      const { error: seedError } = await supabase.from('users').insert(seedData);
      if (seedError) {
        console.warn('Seed failed:', seedError.message);
      } else {
        console.log('Seeded standard committee users successfully.');
      }
    } else {
      console.log('Committee users already seeded.');
    }

    console.log('Database ready.');
  } catch (err) {
    console.error('Database init error:', err.message);
    console.log('Server continuing despite init error...');
  }
};

module.exports = { supabase, initDb };
