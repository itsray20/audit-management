const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_SECRET_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: items, error: err1 } = await supabase.from('items').select('*').eq('system_qty', 3);
  if (err1) {
      console.error(err1);
      return;
  }
  
  for (const item of items) {
    const { data: counts, error: err2 } = await supabase.from('auditor_counts').select('*').eq('item_id', item.id);
    if (err2) console.error(err2);
    
    let total = Number(item.manual_add || 0) + Number(item.manual_recheck || 0);
    let countsStr = [];
    for(const c of counts) {
        total += Number(c.physical_count || 0);
        countsStr.push(`${c.auditor_name}: ${c.physical_count}`);
    }
    
    if(total >= 6 && counts.length > 0) {
        console.log("===============================");
        console.log(item.item_name, "| SysQty:", item.system_qty, "| manual_add:", item.manual_add);
        console.log(countsStr.join(", "));
    }
  }
}

run();
