const processedList = [];
for (let i = 0; i < 3550; i++) {
  processedList.push({
    id: i,
    item_name: `Product ${i} Name with some long text medication details`,
    batch_no: `BATCH${i}XYZ`,
    expiry_date: '2027-12-31',
    unit_purchase_rate: 12.34,
    unit_mrp: 15.00,
    system_qty: 10,
    totalPhysical: 12,
    difference: 2,
    differenceValue: 24.68,
    category: 'Excess',
    expiryStatus: 'GOOD STOCK',
    auditor_counts: [
      { auditor_name: 'Admin', physical_count: 5 },
      { auditor_name: 'Physical Quantity', physical_count: 7 }
    ]
  });
}

console.log('Starting in-memory sort and filter simulation for 3550 items...');
const start = Date.now();

// 1. Filter
let filtered = processedList.filter(item => 
  item.item_name.toLowerCase().includes('product 1') ||
  item.batch_no.toLowerCase().includes('product 1')
);

// 2. Sort
filtered.sort((a, b) => {
  const valA = String(a.item_name).toLowerCase();
  const valB = String(b.item_name).toLowerCase();
  return valA.localeCompare(valB);
});

// 3. Paginate
const page = filtered.slice(0, 30);

const end = Date.now();
console.log(`Simulation finished in ${end - start}ms.`);
console.log(`Found items count: ${filtered.length}`);
