const fs = require('fs');
let raw = fs.readFileSync('api_response.json', 'utf16le');
if (raw.charCodeAt(0) === 0xFEFF) {
  raw = raw.slice(1);
}
const data = JSON.parse(raw);
const items = data.items || data;
items.forEach(item => {
  const allowed = new Set(['Admin', 'User1', 'User2', 'User3', 'User4', 'User5', '87', '88']);
  const total = item.auditor_counts.filter(c => allowed.has(String(c.auditor_name))).reduce((sum, c) => sum + Number(c.physical_count || 0), 0) + Number(item.manual_add || 0) + Number(item.manual_recheck || 0);
  if (total !== item.totalPhysical) console.log('Mismatch for id', item.id, ': calculated', total, 'vs api', item.totalPhysical);
  if (total + item.system_qty === item.totalPhysical && item.system_qty > 0) {
      console.log('Found it! id:', item.id, 'adds system_qty!');
  }
});
console.log('Done validating API response!');
