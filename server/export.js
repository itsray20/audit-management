const xlsx = require('xlsx');
const { supabase } = require('./db');

// Calculate item fields
const calculateItemValues = (item, counts, sessionDate) => {
  // Sum auditor counts
  let totalCounts = 0;
  let hasExpiredCheck = false;
  
  counts.forEach(c => {
    totalCounts += Number(c.physical_count || 0);
    if (c.expiry_check === 1) {
      hasExpiredCheck = true;
    }
  });

  const totalPhysical = totalCounts + Number(item.manual_add || 0) + Number(item.manual_recheck || 0);
  const systemQty = Number(item.system_qty || 0);
  const difference = totalPhysical - systemQty;
  const unitRate = Number(item.unit_purchase_rate || 0);
  
  const totalStockValue = systemQty * unitRate;
  const differenceValue = difference * unitRate;

  // Classify Category
  let category = 'Perfect Match';
  
  // Check if expired
  let isExpired = false;
  if (item.expiry_date) {
    const itemDate = new Date(item.expiry_date);
    const auditDate = new Date(sessionDate);
    if (itemDate < auditDate) {
      isExpired = true;
    }
  }
  if (hasExpiredCheck) {
    isExpired = true;
  }

  if (isExpired && totalPhysical > 0) {
    category = 'Expired Stock';
  } else if (systemQty === 0 && totalPhysical > 0) {
    category = 'Extra Found';
  } else if (item.notes && item.notes.startsWith('OT')) {
    category = 'Other';
  } else if (difference > 0) {
    category = 'Excess';
  } else if (difference < 0) {
    category = 'Shortage';
  }

  return {
    ...item,
    totalPhysical,
    difference,
    totalStockValue,
    differenceValue,
    category
  };
};

const generateExcelBuffer = async (sessionId) => {
  // 1. Load Session Info
  const { data: session, error: sErr } = await supabase
    .from('audit_sessions').select('*').eq('id', sessionId).single();
  if (sErr || !session) throw new Error('Audit session not found');

  const sessionDate = session.audit_date;

  // 2. Load all items & counts
  const { data: items, error: iErr } = await supabase
    .from('items').select('*').eq('audit_session_id', sessionId);
  if (iErr) throw iErr;

  const itemIds = (items || []).map(i => i.id);
  const { data: allCounts, error: cErr } = itemIds.length > 0
    ? await supabase.from('auditor_counts').select('*').in('item_id', itemIds)
    : { data: [], error: null };
  if (cErr) throw cErr;

  // Group counts by item ID
  const countsByItem = {};
  allCounts.forEach(c => {
    if (!countsByItem[c.item_id]) countsByItem[c.item_id] = [];
    countsByItem[c.item_id].push(c);
  });

  // 3. Find all unique auditor names to dynamically build columns
  const auditorNames = [...new Set(allCounts.map(c => c.auditor_name))];

  // 4. Calculate everything
  const processedItems = items.map(item => {
    const itemCounts = countsByItem[item.id] || [];
    return calculateItemValues(item, itemCounts, sessionDate);
  });

  // 5. Structure data for sheets
  // Total Stock Sheet
  const totalStockRows = processedItems.map((item, idx) => {
    const row = {
      'SNo': idx + 1,
      'Location': item.location,
      'Store Name': item.store_name,
      'Supplier': item.supplier,
      'Item Name': item.item_name,
      'Batch No': item.batch_no,
      'Exp Date': item.expiry_date,
      'System Qty': item.system_qty,
      'Package Qty': item.pack_size,
      'Total Purchase Cost': item.system_qty * item.unit_purchase_rate,
      'Unit Purchase Cost': item.unit_purchase_rate,
      'Mrp': item.unit_mrp,
      'Total Mrp': item.system_qty * item.unit_mrp,
      'Add': item.manual_add || '',
      'Recheck': item.manual_recheck || ''
    };

    // Auditor dynamic counts
    auditorNames.forEach(name => {
      const itemCounts = countsByItem[item.id] || [];
      const match = itemCounts.find(c => c.auditor_name === name);
      row[`${name} Count`] = match ? match.physical_count : '';
      row[`${name} Remarks`] = match ? match.remarks : '';
    });

    row['Total Physical'] = item.totalPhysical;
    row['Dif'] = item.difference;
    row['TPV'] = item.differenceValue;
    row['Category'] = item.category;

    return row;
  });

  // Excess Sheet (Dif > 0, system_qty > 0)
  const excessRows = processedItems
    .filter(item => item.category === 'Excess')
    .map((item, idx) => ({
      'SNo': idx + 1,
      'Location': item.location,
      'Store Name': item.store_name,
      'Supplier': item.supplier,
      'Item Name': item.item_name,
      'Batch No': item.batch_no,
      'Exp Date': item.expiry_date,
      'System Qty': item.system_qty,
      'Total Physical': item.totalPhysical,
      'Dif': item.difference,
      'Unit Purchase Cost': item.unit_purchase_rate,
      'TPV': item.differenceValue
    }));

  // Shortage Sheet (Dif < 0, system_qty > 0, not expired)
  const shortageRows = processedItems
    .filter(item => item.category === 'Shortage')
    .map((item, idx) => ({
      'SNo': idx + 1,
      'Location': item.location,
      'Store Name': item.store_name,
      'Supplier': item.supplier,
      'Item Name': item.item_name,
      'Batch No': item.batch_no,
      'Exp Date': item.expiry_date,
      'System Qty': item.system_qty,
      'Total Physical': item.totalPhysical,
      'Dif': item.difference,
      'Unit Purchase Cost': item.unit_purchase_rate,
      'TPV': item.differenceValue
    }));

  // Extra Found Sheet (system_qty = 0)
  const extraFoundRows = processedItems
    .filter(item => item.category === 'Extra Found')
    .map((item, idx) => ({
      'S No': idx + 1,
      'Item Name': item.item_name,
      'Batch': item.batch_no,
      'Exp': item.expiry_date,
      'MRP': item.unit_mrp,
      'Qty': item.totalPhysical,
      'PR': item.unit_purchase_rate,
      'PV': item.totalPhysical * item.unit_purchase_rate
    }));

  // Expired Stock Sheet
  const expiredRows = processedItems
    .filter(item => item.category === 'Expired Stock')
    .map((item, idx) => ({
      'SNo': idx + 1,
      'Item Name': item.item_name,
      'Batch No': item.batch_no,
      'Exp': item.expiry_date,
      'MRP': item.unit_mrp,
      'Qty': item.totalPhysical,
      'VALUE': item.totalPhysical * item.unit_purchase_rate
    }));

  // OT (Other) Sheet
  const otRows = processedItems
    .filter(item => item.category === 'Other')
    .map((item, idx) => ({
      'SNo': idx + 1,
      'Location': item.location,
      'Store Name': item.store_name,
      'Supplier': item.supplier,
      'Item Name': item.item_name,
      'Batch No': item.batch_no,
      'Exp Date': item.expiry_date,
      'System Qty': item.system_qty,
      'Total Physical': item.totalPhysical,
      'Dif': item.difference,
      'Unit Purchase Cost': item.unit_purchase_rate,
      'TPV': item.differenceValue
    }));

  // Summary Metrics calculations
  const totalStockVal = processedItems.reduce((sum, item) => sum + (item.system_qty * item.unit_purchase_rate), 0);
  const excessVal = processedItems.filter(item => item.category === 'Excess').reduce((sum, item) => sum + item.differenceValue, 0);
  const shortageVal = processedItems.filter(item => item.category === 'Shortage').reduce((sum, item) => sum + item.differenceValue, 0);
  const extraFoundVal = processedItems.filter(item => item.category === 'Extra Found').reduce((sum, item) => sum + (item.totalPhysical * item.unit_purchase_rate), 0);
  const expiredVal = processedItems.filter(item => item.category === 'Expired Stock').reduce((sum, item) => sum + (item.totalPhysical * item.unit_purchase_rate), 0);
  const otVal = processedItems.filter(item => item.category === 'Other').reduce((sum, item) => sum + item.differenceValue, 0);

  const grossShortage = excessVal + shortageVal; // matches their definition of Excess + Shortage
  const netShortage = grossShortage + extraFoundVal; // shortage offset by extra found

  // Summary Dashboard Row Data
  const summaryRows = [
    { 'Audit Report': 'Total Stock', 'Value': totalStockVal },
    { 'Audit Report': 'Excess', 'Value': excessVal },
    { 'Audit Report': 'Shortage', 'Value': shortageVal },
    { 'Audit Report': '', 'Value': '' },
    { 'Audit Report': 'Gross Shortage', 'Value': grossShortage },
    { 'Audit Report': 'Extra found', 'Value': extraFoundVal },
    { 'Audit Report': 'Net Shortage', 'Value': netShortage },
    { 'Audit Report': '', 'Value': '' },
    { 'Audit Report': 'OT Present value', 'Value': otVal },
    { 'Audit Report': '', 'Value': '' },
    { 'Audit Report': 'Expiry Stock Value', 'Value': expiredVal }
  ];

  // 6. Build the Excel Workbook
  const wb = xlsx.utils.book_new();

  const wsSummary = xlsx.utils.json_to_sheet(summaryRows);
  xlsx.utils.book_append_sheet(wb, wsSummary, 'Report');

  const wsTotalStock = xlsx.utils.json_to_sheet(totalStockRows);
  // Add total row at bottom of Total Stock
  xlsx.utils.sheet_add_json(wsTotalStock, [{
    'SNo': 'Total',
    'Total Purchase Cost': totalStockVal,
    'TPV': excessVal + shortageVal + otVal
  }], { skipHeader: true, origin: -1 });
  xlsx.utils.book_append_sheet(wb, wsTotalStock, 'Total Stock');

  const wsExcess = xlsx.utils.json_to_sheet(excessRows);
  xlsx.utils.sheet_add_json(wsExcess, [{ 'SNo': 'Total', 'TPV': excessVal }], { skipHeader: true, origin: -1 });
  xlsx.utils.book_append_sheet(wb, wsExcess, 'Excess');

  const wsShortage = xlsx.utils.json_to_sheet(shortageRows);
  xlsx.utils.sheet_add_json(wsShortage, [{ 'SNo': 'Total', 'TPV': shortageVal }], { skipHeader: true, origin: -1 });
  xlsx.utils.book_append_sheet(wb, wsShortage, 'Shortage');

  const wsExtra = xlsx.utils.json_to_sheet(extraFoundRows);
  xlsx.utils.sheet_add_json(wsExtra, [{ 'S No': 'Total', 'PV': extraFoundVal }], { skipHeader: true, origin: -1 });
  xlsx.utils.book_append_sheet(wb, wsExtra, 'Extra Found');

  if (otRows.length > 0) {
    const wsOt = xlsx.utils.json_to_sheet(otRows);
    xlsx.utils.sheet_add_json(wsOt, [{ 'SNo': 'Total', 'TPV': otVal }], { skipHeader: true, origin: -1 });
    xlsx.utils.book_append_sheet(wb, wsOt, 'OT');
  }

  if (expiredRows.length > 0) {
    const wsExp = xlsx.utils.json_to_sheet(expiredRows);
    xlsx.utils.sheet_add_json(wsExp, [{ 'SNo': 'Total', 'VALUE': expiredVal }], { skipHeader: true, origin: -1 });
    xlsx.utils.book_append_sheet(wb, wsExp, 'Exp');
  }

  // 7. Write to buffer
  const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buffer;
};

module.exports = {
  calculateItemValues,
  generateExcelBuffer
};
