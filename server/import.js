const xlsx = require('xlsx');
const { supabase } = require('./db');

// Map cell value to normalized string
const cleanString = (val) => {
  if (val === undefined || val === null) return '';
  return String(val).trim();
};

// Map cell value to number
const cleanNumber = (val, defaultVal = 0) => {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = Number(val);
  return isNaN(num) ? defaultVal : num;
};

// Map date format
const cleanDate = (val) => {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  // Try to parse string or excel serial date
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.split(' ')[0];
  }
  // Handle some common excel dates like "10-28" or "06-28"
  if (/^\d{2}-\d{2}$/.test(str)) {
    return `20${str.split('-')[1]}-${str.split('-')[0]}-01`;
  }
  return str;
};

// Column normalizer mappings
const COLUMN_MAPPINGS = {
  item_name: ['item name', 'name', 'item_name', 'product name', 'product', 'product_name', 'productname'],
  category: ['category', 'item category', 'dept'],
  type: ['type', 'item type', 'form'],
  batch_no: ['batch no', 'batch', 'batch_no', 'batch number', 'lot no', 'lot', 'batch_id', 'batchid'],
  pack_size: ['pack size', 'pack_size', 'package qty', 'packsize', 'pkg qty'],
  expiry_date: ['expiry date', 'expiry', 'exp date', 'exp_date', 'exp', 'expiry_date', 'expiry_date', 'expirydate'],
  pack_mrp: ['pack mrp', 'pack_mrp', 'package mrp'],
  unit_mrp: ['unit mrp', 'unit_mrp', 'mrp', 'rate mrp', 'retail_price', 'retailprice', 'selling rate', 'sellingrate'],
  pack_rate: ['pack rate', 'pack_rate', 'package rate', 'total purchase cost', 'pack cost'],
  unit_purchase_rate: ['unit purchase cost', 'unit purchase rate', 'purchase rate per unit', 'unit_purchase_cost', 'purchase rate', 'unit cost', 'pr', 'unit_cost', 'unitcost', 'pruchase rate', 'purchaserate'],
  system_qty: ['system quantity', 'system qty', 'qty', 'as per software quantity', 'stock qty', 'software qty', 'system_quantity', 'systemquantity', 'batch available quantity', 'batchavailablequantity'],
  location: ['location', 'rack', 'shelf'],
  store_name: ['store name', 'store_name', 'store'],
  supplier: ['supplier', 'vendor', 'vendor name', 'supplier name']
};

// Detect target canonical column from headers
const findMappedColumn = (header, mapping) => {
  const normHeader = header.toLowerCase().replace(/[\s_\-\.]/g, '');
  for (const [canonical, aliases] of Object.entries(mapping)) {
    for (const alias of aliases) {
      if (alias.toLowerCase().replace(/[\s_\-\.]/g, '') === normHeader) {
        return canonical;
      }
    }
  }
  return null;
};

// Recalculate range for a sheet manually to bypass stale/broken !ref metadata from ERP systems
const updateSheetRange = (sheet) => {
  if (!sheet) return;
  let maxRow = 0;
  let maxCol = 0;
  const rangeRegex = /^([A-Z]+)([0-9]+)$/;

  const decodeCol = (key) => {
    let col = 0;
    for (let i = 0; i < key.length; i++) {
      col = col * 26 + (key.charCodeAt(i) - 64);
    }
    return col;
  };

  const decodeRow = (key) => parseInt(key, 10);

  for (const key of Object.keys(sheet)) {
    if (key[0] === '!') continue;
    const match = key.match(rangeRegex);
    if (match) {
      const colStr = match[1];
      const rowStr = match[2];
      const row = decodeRow(rowStr);
      const col = decodeCol(colStr);
      if (row > maxRow) maxRow = row;
      if (col > maxCol) maxCol = col;
    }
  }

  const encodeCol = (col) => {
    let temp = col;
    let letter = '';
    while (temp > 0) {
      let t = (temp - 1) % 26;
      letter = String.fromCharCode(65 + t) + letter;
      temp = Math.floor((temp - t) / 26);
    }
    return letter;
  };

  if (maxRow > 0 && maxCol > 0) {
    sheet['!ref'] = `A1:${encodeCol(maxCol)}${maxRow}`;
  }
};

// Check if a row represents a summary/total row using precise word checks
const isSummaryRow = (row, headerMap) => {
  const nameVal = cleanString(row[headerMap.item_name || '']).toLowerCase();
  if (!nameVal) return true; // Empty item name means empty/invalid row

  const exactSummaryTerms = ['total', 'grand total', 'sub total', 'totals', 'summary', 'grand-total', 'sub-total'];
  
  // Only skip if the field IS a summary term or starts with it followed by a space
  if (exactSummaryTerms.includes(nameVal) || nameVal.startsWith('total ') || nameVal.startsWith('grand total ')) {
    return true;
  }

  const firstKey = Object.keys(row)[0];
  if (firstKey) {
    const firstVal = cleanString(row[firstKey]).toLowerCase();
    if (exactSummaryTerms.includes(firstVal) || firstVal.startsWith('total ') || firstVal.startsWith('grand total ')) {
      return true;
    }
  }
  return false;
};

// Import Excel Audit File
const importExcel = async (auditSessionId, filePath) => {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheetNames = workbook.SheetNames;
  
  console.log(`Excel file loaded: ${sheetNames.join(', ')}`);

  // Fetch db users to map Excel headers to user IDs
  const { data: dbUsers } = await supabase.from('users').select('id, name, username, display_name');
  const userMap = {};
  (dbUsers || []).forEach(u => {
    const parts = (u.name || '').split('|');
    const dispName = (u.display_name || parts[0] || u.username).toLowerCase().trim();
    userMap[dispName] = String(u.id);
    userMap[u.username.toLowerCase().trim()] = String(u.id);
  });

  // Detect which sheets to import
  // Main Inventory sheet
  let mainSheetName = sheetNames.find(s => ['total stock', 'sheet1', 'inventory', 'stock'].includes(s.toLowerCase()));
  if (!mainSheetName) {
    mainSheetName = sheetNames[0]; // fallback to first sheet
  }

  // Extra found sheet
  let extraSheetName = sheetNames.find(s => ['extra found', 'ne', 'not expected', 'new entry'].includes(s.toLowerCase()));
  
  // Other/OT sheet
  let otSheetName = sheetNames.find(s => ['ot', 'other', 'special'].includes(s.toLowerCase()));

  // Expired sheet
  let expSheetName = sheetNames.find(s => ['exp', 'expired', 'expired stock'].includes(s.toLowerCase()));

  const mainSheet = workbook.Sheets[mainSheetName];
  updateSheetRange(mainSheet); // Recalculate range before reading
  const mainData = xlsx.utils.sheet_to_json(mainSheet, { defval: '' });
  
  if (mainData.length === 0) {
    throw new Error(`No data found in main sheet: ${mainSheetName}`);
  }

  // 1. Parse Headers & Detect Auditor Columns
  const sampleRow = mainData[0];
  const headers = Object.keys(sampleRow);
  const headerMap = {};
  let auditorCols = [];

  headers.forEach(h => {
    const canonical = findMappedColumn(h, COLUMN_MAPPINGS);
    if (canonical) {
      headerMap[canonical] = h;
    } else {
      // It's a non-standard column. Check if it's an auditor count column.
      // E.g. ending in "phy qty", "qty.1", or names like "sri", "sravani", "sanathu", "sha", "recheck", "add", "user1", "user2", etc.
      const normH = h.toLowerCase();
      const isAuditor = normH.includes('phy') || 
                        normH.includes('count') || 
                        ['sri', 'sravani', 'sanathu', 'sha', 'recheck', 'add', 'qty.1', 'user1', 'user2', 'user3', 'user4', 'user5', 'admin'].some(name => normH.includes(name));
      if (isAuditor && !normH.includes('remark') && !normH.includes('exp')) {
        auditorCols.push(h);
      }
    }
  });

  // If specific auditor columns exist, filter out generic physical count columns to prevent double counting
  const hasSpecificAuditor = auditorCols.some(col => {
    const norm = col.toLowerCase();
    return ['sri', 'sravani', 'sanathu', 'sha', 'user', 'admin'].some(name => norm.includes(name));
  });

  if (hasSpecificAuditor) {
    auditorCols = auditorCols.filter(col => {
      const norm = col.toLowerCase();
      return !norm.includes('physical') && !norm.includes('phy') && !norm.includes('total') && norm !== 'qty.1';
    });
  }

  console.log('Detected Headers mapping:', headerMap);
  console.log('Detected Auditor columns:', auditorCols);

  let importedCount = 0;

  // Function to process rows for insertion
  const processRows = async (rows, defaultCategory = null) => {
    const itemsToInsert = [];
    const rowsWithCounts = [];

    // Fetch assigned members of this session to avoid repeated checks
    const { data: existingMembers } = await supabase
      .from('audit_members')
      .select('user_id')
      .eq('audit_session_id', auditSessionId);
    const assignedUserIds = new Set((existingMembers || []).map(m => Number(m.user_id)));
    const userIdsToAssign = new Set();

    for (const row of rows) {
      if (isSummaryRow(row, headerMap)) {
        console.log('Skipping summary row:', row);
        continue;
      }

      const itemName = cleanString(row[headerMap.item_name || 'Name']);
      if (!itemName) continue; // skip completely empty rows

      const batchNo = cleanString(row[headerMap.batch_no || 'Batch No'] || row['Batch'] || 'UNKNOWN');
      const expiryDate = cleanDate(row[headerMap.expiry_date || 'Expiry'] || row['Exp'] || '');
      const category = cleanString(row[headerMap.category || 'Category']);
      const type = cleanString(row[headerMap.type || 'Type']);
      const packSize = cleanNumber(row[headerMap.pack_size || 'Pack Size'], 1);
      const unitMrp = cleanNumber(row[headerMap.unit_mrp || 'Unit MRP'] || row[headerMap.pack_mrp || 'Pack MRP'] / packSize);
      const packMrp = cleanNumber(row[headerMap.pack_mrp || 'Pack MRP'] || unitMrp * packSize);
      const unitPurchaseRate = cleanNumber(row[headerMap.unit_purchase_rate || 'Unit Purchase Cost'] || row[headerMap.pack_rate || 'Pack Rate'] / packSize);
      const packRate = cleanNumber(row[headerMap.pack_rate || 'Pack Rate'] || unitPurchaseRate * packSize);
      const systemQty = cleanNumber(row[headerMap.system_qty || 'Qty'], 0);
      const location = cleanString(row[headerMap.location || 'Location']);
      const storeName = cleanString(row[headerMap.store_name || 'Store Name']);
      const supplier = cleanString(row[headerMap.supplier || 'Supplier'] || row['Vendor Name']);
      
      // Notes could contain manual categories or references
      let notes = cleanString(row['Remarks'] || row['remarks'] || '');
      if (defaultCategory) {
        notes = defaultCategory + (notes ? ': ' + notes : '');
      }

      itemsToInsert.push({
        audit_session_id: parseInt(auditSessionId),
        item_name: itemName, category, type, batch_no: batchNo, pack_size: packSize,
        expiry_date: expiryDate, pack_mrp: packMrp, unit_mrp: unitMrp,
        pack_rate: packRate, unit_purchase_rate: unitPurchaseRate, system_qty: systemQty,
        location, store_name: storeName, supplier, notes
      });

      rowsWithCounts.push(row);
    }

    if (itemsToInsert.length === 0) return;

    // Batch insert items in chunks to avoid payload limits
    const insertedItems = [];
    const chunkSize = 1000;
    for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
      const chunk = itemsToInsert.slice(i, i + chunkSize);
      const { data: chunkResult, error: insertErr } = await supabase
        .from('items')
        .insert(chunk)
        .select('id, item_name, batch_no');
      if (insertErr) throw insertErr;
      insertedItems.push(...chunkResult);
    }

    // Map item_name + '|' + batch_no to list of generated ids (to handle duplicates)
    const itemMap = {};
    insertedItems.forEach(item => {
      const key = `${item.item_name.trim()}|${item.batch_no.trim()}`;
      if (!itemMap[key]) itemMap[key] = [];
      itemMap[key].push(item.id);
    });

    // Gather all auditor counts to insert in batch
    const countsToInsert = [];
    for (const row of rowsWithCounts) {
      const itemName = cleanString(row[headerMap.item_name || 'Name']);
      const batchNo = cleanString(row[headerMap.batch_no || 'Batch No'] || row['Batch'] || 'UNKNOWN');
      const key = `${itemName.trim()}|${batchNo.trim()}`;
      
      const idsList = itemMap[key];
      if (!idsList || idsList.length === 0) continue;
      const itemId = idsList.shift(); // take matched ID in order

      // Insert any auditor counts found in the row
      for (const col of auditorCols) {
        const countVal = row[col];
        if (countVal !== undefined && countVal !== null && countVal !== '') {
          const physicalCount = Number(countVal);
          if (!isNaN(physicalCount)) {
            // Find corresponding expiry check / remark columns if any
            let expCheck = 0;
            let remark = '';
            
            const colIdx = headers.indexOf(col);
            if (colIdx !== -1) {
              const nextCol = headers[colIdx + 1];
              const nextCol2 = headers[colIdx + 2];
              if (nextCol && nextCol.toLowerCase().startsWith('exp')) {
                expCheck = row[nextCol] ? 1 : 0;
              }
              if (nextCol2 && nextCol2.toLowerCase().startsWith('remark')) {
                remark = cleanString(row[nextCol2]);
              }
            }

            // Normalise auditor name
            let auditorName = col.replace(/\s*Phy\s*Qty/gi, '').trim();
            if (auditorName === 'Qty.1') {
              auditorName = 'Extra Count';
            } else {
              // Try to map to user ID
              const cleanAuditor = auditorName.toLowerCase().trim();
              let matchedId = null;
              for (const [nameKey, userId] of Object.entries(userMap)) {
                if (cleanAuditor.includes(nameKey) || nameKey.includes(cleanAuditor)) {
                  matchedId = userId;
                  break;
                }
              }
              if (matchedId) {
                auditorName = matchedId;
                const matchIdNum = Number(matchedId);
                if (!assignedUserIds.has(matchIdNum)) {
                  userIdsToAssign.add(matchIdNum);
                  assignedUserIds.add(matchIdNum);
                }
              } else {
                if (/^user[1-5]$/i.test(auditorName)) {
                  auditorName = auditorName.charAt(0).toUpperCase() + auditorName.slice(1).toLowerCase();
                } else if (/^admin$/i.test(auditorName)) {
                  auditorName = 'Admin';
                }
              }
            }

            if (itemId) {
              countsToInsert.push({
                item_id: itemId, auditor_name: auditorName,
                physical_count: physicalCount, expiry_check: expCheck === 1,
                remarks: remark, updated_at: new Date().toISOString()
              });
            }
          }
        }
      }
    }

    // Batch insert any new audit members
    if (userIdsToAssign.size > 0) {
      const assignments = Array.from(userIdsToAssign).map(uid => ({
        audit_session_id: parseInt(auditSessionId),
        user_id: parseInt(uid),
        status: 'active'
      }));
      try {
        await supabase.from('audit_members').insert(assignments);
      } catch (e) {
        // Ignore unique constraint errors
      }
    }

    // Batch upsert auditor counts
    if (countsToInsert.length > 0) {
      for (let i = 0; i < countsToInsert.length; i += chunkSize) {
        const chunk = countsToInsert.slice(i, i + chunkSize);
        const { error: upsertErr } = await supabase
          .from('auditor_counts')
          .upsert(chunk, { onConflict: 'item_id,auditor_name' });
        if (upsertErr) throw upsertErr;
      }
    }

    importedCount += itemsToInsert.length;
  };

  // Import main inventory rows
  await processRows(mainData);

  // Import Extra Found / NE sheet if present
  if (extraSheetName) {
    const extraSheet = workbook.Sheets[extraSheetName];
    updateSheetRange(extraSheet);
    const extraData = xlsx.utils.sheet_to_json(extraSheet, { defval: '' });
    const extraHeaderMap = {};
    if (extraData.length > 0) {
      const extraHeaders = Object.keys(extraData[0]);
      extraHeaders.forEach(h => {
        const canonical = findMappedColumn(h, COLUMN_MAPPINGS);
        if (canonical) {
          extraHeaderMap[canonical] = h;
        }
      });
      console.log('Importing extra found sheet items...');
      
      const extraItems = [];
      const extraRows = [];
      for (const row of extraData) {
        if (isSummaryRow(row, extraHeaderMap)) continue;
        
        const itemName = cleanString(row[extraHeaderMap.item_name || 'Item Name']);
        if (!itemName) continue;

        const batchNo = cleanString(row[extraHeaderMap.batch_no || 'Batch No'] || row['Batch'] || 'UNKNOWN');
        const expiryDate = cleanDate(row[extraHeaderMap.expiry_date || 'Expiry'] || row['Exp'] || '');
        const unitMrp = cleanNumber(row[extraHeaderMap.unit_mrp || 'MRP']);
        const unitPurchaseRate = cleanNumber(row[extraHeaderMap.unit_purchase_rate || 'PR'] || row['PR']);
        const supplier = cleanString(row['Vendor Name'] || '');

        extraItems.push({
          audit_session_id: parseInt(auditSessionId), item_name: itemName,
          batch_no: batchNo, expiry_date: expiryDate, unit_mrp: unitMrp,
          unit_purchase_rate: unitPurchaseRate, system_qty: 0,
          supplier, notes: 'Imported as Extra Found'
        });
        extraRows.push(row);
      }

      // Batch insert items in chunks
      const insertedItems = [];
      const chunkSize = 1000;
      for (let i = 0; i < extraItems.length; i += chunkSize) {
        const chunk = extraItems.slice(i, i + chunkSize);
        const { data: chunkResult, error: insErr } = await supabase
          .from('items')
          .insert(chunk)
          .select('id');
        if (insErr) throw insErr;
        insertedItems.push(...chunkResult);
      }

      // Prepare counts for batch upsert
      const extraCounts = [];
      for (let i = 0; i < extraRows.length; i++) {
        const row = extraRows[i];
        const inserted = insertedItems[i];
        const physicalQty = cleanNumber(row[extraHeaderMap.system_qty || 'Qty'] || row['Qty.1']);
        if (inserted && !isNaN(physicalQty)) {
          extraCounts.push({
            item_id: inserted.id, auditor_name: 'Extra Count',
            physical_count: physicalQty, updated_at: new Date().toISOString()
          });
        }
      }

      // Batch upsert counts
      if (extraCounts.length > 0) {
        for (let i = 0; i < extraCounts.length; i += chunkSize) {
          const chunk = extraCounts.slice(i, i + chunkSize);
          const { error: upsertErr } = await supabase
            .from('auditor_counts')
            .upsert(chunk, { onConflict: 'item_id,auditor_name' });
          if (upsertErr) throw upsertErr;
        }
      }

      importedCount += extraItems.length;
    }
  }

  // Import OT (Other) sheet if present
  if (otSheetName) {
    const otSheet = workbook.Sheets[otSheetName];
    updateSheetRange(otSheet);
    const otData = xlsx.utils.sheet_to_json(otSheet, { defval: '' });
    if (otData.length > 0) {
      console.log('Importing OT (Other) sheet items...');
      await processRows(otData, 'OT');
    }
  }

  // Import Expired sheet if present
  if (expSheetName) {
    const expSheet = workbook.Sheets[expSheetName];
    updateSheetRange(expSheet);
    const expData = xlsx.utils.sheet_to_json(expSheet, { defval: '' });
    if (expData.length > 0) {
      console.log('Importing Expired sheet items...');
      
      const expItems = [];
      const expRows = [];
      for (const row of expData) {
        if (isSummaryRow(row, headerMap)) continue;
        const itemName = cleanString(row['Item Name']);
        if (!itemName) continue;
        const batchNo = cleanString(row['Batch No'] || 'UNKNOWN');
        const expiryDate = cleanDate(row['Exp'] || '');
        const unitMrp = cleanNumber(row['MRP']);
        const physicalQty = cleanNumber(row['Qty']);
        const value = cleanNumber(row['VALUE']);
        const unitPurchaseRate = physicalQty > 0 ? value / physicalQty : unitMrp;

        expItems.push({
          audit_session_id: parseInt(auditSessionId), item_name: itemName,
          batch_no: batchNo, expiry_date: expiryDate, unit_mrp: unitMrp,
          unit_purchase_rate: unitPurchaseRate, system_qty: 0,
          notes: 'Imported as Expired Stock'
        });
        expRows.push(row);
      }

      // Batch insert items in chunks
      const insertedItems = [];
      const chunkSize = 1000;
      for (let i = 0; i < expItems.length; i += chunkSize) {
        const chunk = expItems.slice(i, i + chunkSize);
        const { data: chunkResult, error: expInsErr } = await supabase
          .from('items')
          .insert(chunk)
          .select('id');
        if (expInsErr) throw expInsErr;
        insertedItems.push(...chunkResult);
      }

      // Prepare counts for batch upsert
      const expCounts = [];
      for (let i = 0; i < expRows.length; i++) {
        const row = expRows[i];
        const inserted = insertedItems[i];
        const physicalQty = cleanNumber(row['Qty']);
        if (inserted && !isNaN(physicalQty)) {
          expCounts.push({
            item_id: inserted.id, auditor_name: 'Expired Count',
            physical_count: physicalQty, expiry_check: true,
            updated_at: new Date().toISOString()
          });
        }
      }

      // Batch upsert counts
      if (expCounts.length > 0) {
        for (let i = 0; i < expCounts.length; i += chunkSize) {
          const chunk = expCounts.slice(i, i + chunkSize);
          const { error: upsertErr } = await supabase
            .from('auditor_counts')
            .upsert(chunk, { onConflict: 'item_id,auditor_name' });
          if (upsertErr) throw upsertErr;
        }
      }

      importedCount += expItems.length;
    }
  }

  return importedCount;
};

module.exports = {
  importExcel
};
