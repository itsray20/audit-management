const { supabase } = require('../db');

async function testPassword() {
  try {
    const { data, error } = await supabase.from('users').select('password').limit(1);
    if (error) {
      console.log('Error selecting password column:', error.message);
    } else {
      console.log('Password column exists! Row data:', data);
    }
  } catch (err) {
    console.error('Catch error:', err);
  }
}

testPassword();
