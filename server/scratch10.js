const fs = require('fs');
let raw = fs.readFileSync('api_response.json', 'utf16le');
if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
const data = JSON.parse(raw);
const items = data.items || data;
const item = items.find(i => i.id === 55596);
console.log(JSON.stringify(item, null, 2));
