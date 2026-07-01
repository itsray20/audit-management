const fs = require('fs');
let code = fs.readFileSync('server.js', 'utf8');

code = code.replace(
  /countAuditors = Array\.from\(new Set\(\(counts \|\| \[\]\)\.map\(c => String\(c\.auditor_name\)\)\)\);/g,
  'countAuditors = Array.from(new Set((counts || []).map(c => String(c.auditor_name)))).filter(n => !n.startsWith(\'Physical Quantity\'));'
);

code = code.replace(
  /const countAuditors = Array\.from\(new Set\(\(allCounts \|\| \[\]\)\.map\(c => String\(c\.auditor_name\)\)\)\);/g,
  'const countAuditors = Array.from(new Set((allCounts || []).map(c => String(c.auditor_name)))).filter(n => !n.startsWith(\'Physical Quantity\'));'
);

fs.writeFileSync('server.js', code);
console.log('Replaced successfully!');
