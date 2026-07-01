const fs = require('fs');
const data = JSON.parse(fs.readFileSync('api_response.json', 'utf8'));
data.forEach(item => {
  const allowed = new Set(['Admin', 'User1', 'User2', 'User3', 'User4', 'User5', '87', '88']);
  const total = item.auditor_counts.filter(c => allowed.has(String(c.auditor_name))).reduce((sum, c) => sum + Number(c.physical_count || 0), 0) + Number(item.manual_add || 0) + Number(item.manual_recheck || 0);
  if (total !== item.totalPhysical) console.log(item.id, total, item.totalPhysical);
});
