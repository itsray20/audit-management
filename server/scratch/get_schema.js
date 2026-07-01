const { supabase } = require('../db');

async function get_schema() {
  console.log('Querying Supabase database schema details for auditor_counts...');
  try {
    // We can query information_schema.columns
    const { data: cols, error: cErr } = await supabase.rpc('exec_raw_sql', {
      query_text: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'auditor_counts';
      `,
      query_params: []
    });

    if (cErr) {
      console.error('Column error:', cErr);
    } else {
      console.log('Columns of auditor_counts:', cols);
    }

    // Check constraints
    const { data: consts, error: conErr } = await supabase.rpc('exec_raw_sql', {
      query_text: `
        SELECT 
          tc.constraint_name, 
          tc.constraint_type,
          cc.check_clause
        FROM 
          information_schema.table_constraints tc
          LEFT JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE 
          tc.table_name = 'auditor_counts';
      `,
      query_params: []
    });

    if (conErr) {
      console.error('Constraint error:', conErr);
    } else {
      console.log('Constraints of auditor_counts:', consts);
    }

  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

get_schema();
