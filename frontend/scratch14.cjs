const fs = require('fs');
let code = fs.readFileSync('src/components/DetailsPanel.jsx', 'utf8');

// 1. Remove the borderLeft from the root div
code = code.replace(
  /<div className="flex flex-col h-full glass overflow-hidden text-xs" style=\{\{ borderLeft: '1px solid var\(--glass-border-dim\)' \}\}>/,
  '<div className="flex flex-col h-full glass overflow-hidden text-xs w-full">'
);

// 2. Change the body layout to grid
const oldBodyLayout = `<div 
        className="flex-1 overflow-y-auto p-6 space-y-4"
        style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
      >`;

const newBodyLayout = `<div 
        className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6"
        style={{ WebkitOverflowScrolling: 'touch', transform: 'translateZ(0)' }}
      >
        <div className="space-y-6 flex flex-col">`;

code = code.replace(oldBodyLayout, newBodyLayout);

// 3. Move blocks around
// The current order is: 1 (Details), 3 (Counts), 4 (Remove), 5 (History)
// We want: Left Column: 1 (Details), 4 (Remove). Right Column: 3 (Counts), 5 (History).

const removeBlockRegex = /\{\/\* 4\. Remove Product \(Admin Only\) \*\/\}[\s\S]*?(?=\{\/\* Delete Confirmation Portal)/;
const removeBlockMatch = code.match(removeBlockRegex);

if (removeBlockMatch) {
  const removeBlock = removeBlockMatch[0];
  code = code.replace(removeBlockRegex, '');
  
  // Insert it after Item Details
  code = code.replace(
    /\{\/\* 3\. Physical Count Inputs \*\/\}/,
    `${removeBlock}
        </div>
        <div className="space-y-6 flex flex-col">
        {/* 3. Physical Count Inputs */}`
  );
}

// 4. Close the second column div at the end
code = code.replace(
  /<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}/,
  `        </div>\n      </div>\n    </div>\n  );\n}`
);

fs.writeFileSync('src/components/DetailsPanel.jsx', code);
console.log('Successfully restructured DetailsPanel.jsx into two columns.');
