require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

(async () => {
  // Find what other roles are allowed
  const roles = ['Admin', 'User', 'Auditor', 'Manager', 'Viewer', 'auditor1', 'Srikant',
    'User1', 'User2', 'User3', 'User4', 'User5',
    'member', 'Member', 'Committee', 'committee',
    'Audit', 'audit', 'checker', 'Checker', 'counter', 'Counter'
  ];
  for (const role of roles) {
    const { error } = await supabase.from('users').insert([{ username: 'testrole', name: 'Test|pass', role }]);
    if (!error) {
      console.log('VALID ROLE:', role);
      await supabase.from('users').delete().eq('username', 'testrole');
    }
  }
  console.log('Done');
  process.exit(0);
})();
