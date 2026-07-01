const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: items } = await supabase.from('items').select('*').gt('system_qty', 0);
  let count = 0;
  for(const item of items) {
    if(item.manual_add === item.system_qty) count++;
  }
  console.log(`Items with manual_add == system_qty: ${count} out of ${items.length}`);
}
run();
