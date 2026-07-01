require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in .env file');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const initDb = async () => {
  console.log('Checking Supabase connection...');
  try {
    const { data: existingUsers, error } = await supabase.from('users').select('username');
    if (error) {
      console.warn('Could not read users table:', error.message);
      console.log('Database ready (skipped user seed check).');
      return;
    }

    const hasSrikant = existingUsers && existingUsers.some(u => u.username === 'srikant');

    if (!hasSrikant) {
      console.log('Re-seeding standard team users...');
      await supabase.from('users').delete().neq('id', 0);

      // New role hierarchy: Admin, Developer, CoFounder, TeamMember, Employee
      const seedData = [
        {
          username: 'srikant',
          name: 'Srikant|srikant123|Admin',
          display_name: 'Srikant',
          role: 'Admin',
          status: 'active',
          joined_at: new Date().toISOString()
        },
        {
          username: 'admin2',
          name: 'Admin Two|admin223|Admin',
          display_name: 'Admin Two',
          role: 'Admin',
          status: 'active',
          joined_at: new Date().toISOString()
        },
        {
          username: 'developer',
          name: 'Developer|dev123|Developer',
          display_name: 'Developer',
          role: 'Developer',
          status: 'active',
          joined_at: new Date().toISOString()
        },
        {
          username: 'sathya',
          name: 'Sathya|user223|CoFounder',
          display_name: 'Sathya',
          role: 'CoFounder',
          status: 'active',
          joined_at: new Date().toISOString()
        },
        {
          username: 'santosh',
          name: 'Santosh|user323|CoFounder',
          display_name: 'Santosh',
          role: 'CoFounder',
          status: 'active',
          joined_at: new Date().toISOString()
        },
        {
          username: 'naveen',
          name: 'Naveen|user423|CoFounder',
          display_name: 'Naveen',
          role: 'CoFounder',
          status: 'active',
          joined_at: new Date().toISOString()
        },
        {
          username: 'shreeyash',
          name: 'Shreeyash|user523|CoFounder',
          display_name: 'Shreeyash',
          role: 'CoFounder',
          status: 'active',
          joined_at: new Date().toISOString()
        }
      ];

      const { error: seedError } = await supabase.from('users').insert(seedData);
      if (seedError) {
        console.warn('Seed failed:', seedError.message);
      } else {
        console.log('Seeded standard team users successfully.');
      }
    } else {
      console.log('Users already seeded.');
    }

    // Check and seed hospitals if the table exists
    try {
      const { data: existingHospitals, error: hErr } = await supabase.from('hospitals').select('id').limit(1);
      if (!hErr && (!existingHospitals || existingHospitals.length === 0)) {
        console.log('Seeding hospitals...');
        await supabase.from('hospitals').insert([
          { name: 'Kukatpally', location: 'Kukatpally, Hyderabad', contact_number: '' },
          { name: 'Ameerpet', location: 'Ameerpet, Hyderabad', contact_number: '' },
          { name: 'Dilsukhnagar', location: 'Dilsukhnagar, Hyderabad', contact_number: '' },
          { name: 'Miyapur', location: 'Miyapur, Hyderabad', contact_number: '' },
          { name: 'KPHB', location: 'KPHB Colony, Hyderabad', contact_number: '' },
        ]);
        console.log('Hospitals seeded.');
      }
    } catch (hErr) {
      console.warn('Hospitals table not found yet. Run SQL migration first:', hErr.message);
    }

    console.log('Database ready.');
  } catch (err) {
    console.error('Database init error:', err.message);
    console.log('Server continuing despite init error...');
  }
};

module.exports = { supabase, initDb };
