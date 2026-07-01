const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envConfig = dotenv.parse(fs.readFileSync('e:/STOCK-MANAGEMENT/server/.env'));
const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: items, error: err1 } = await supabase.from('items').select('*').limit(10);
  if (err1) {
      console.error(err1);
      return;
  }
  
  console.log("Found items:", items.length);
  
  for (const item of items) {
    const { data: counts, error: err2 } = await supabase.from('auditor_counts').select('*').eq('item_id', item.id);
    if (err2) console.error(err2);
    
    console.log("===============================");
    console.log("ITEM:", item.item_name, "| SysQty:", item.system_qty, "| manual_add:", item.manual_add);
    console.log("COUNTS:", counts.map(c => `${c.auditor_name}: ${c.physical_count}`));
  }
}

run();
