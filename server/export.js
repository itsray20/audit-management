const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const { supabase } = require('./db');

const calculateItemValues = (item, counts, sessionDate) => {
  const ALLOWED_AUDITORS = ['Admin', 'User1', 'User2', 'User3', 'User4', 'User5'];
  
  // Sum auditor counts
  let totalCounts = 0;
  let hasExpiredCheck = false;
  
  counts.forEach(c => {
    if (ALLOWED_AUDITORS.includes(c.auditor_name)) {
      totalCounts += Number(c.physical_count || 0);
    }
    if (c.expiry_check === 1 || c.expiry_check === true) {
      hasExpiredCheck = true;
    }
  });

  const totalPhysical = totalCounts + Number(item.manual_add || 0) + Number(item.manual_recheck || 0);
  const systemQty = Number(item.system_qty || 0);
  
  const hasValidCount = counts.some(c => ALLOWED_AUDITORS.includes(c.auditor_name));
  const isCounted = hasValidCount || Number(item.manual_add || 0) !== 0 || Number(item.manual_recheck || 0) !== 0;
  
  const difference = isCounted ? (totalPhysical - systemQty) : 0;
  const unitRate = Number(item.unit_purchase_rate || 0);
  
  const totalStockValue = systemQty * unitRate;
  const differenceValue = difference * unitRate;

  // Classify Category
  let category = 'Not Counted';
  
  // Expiry Status
  let expiryStatus = 'GOOD STOCK';
  if (item.expiry_date) {
    const itemDate = new Date(item.expiry_date);
    itemDate.setHours(0,0,0,0);
    const refDate = sessionDate ? new Date(sessionDate) : new Date();
    refDate.setHours(0,0,0,0);
    
    const ninetyDays = new Date(refDate);
    ninetyDays.setDate(refDate.getDate() + 90);
    
    if (itemDate < refDate) {
      expiryStatus = 'EXPIRED';
    } else if (itemDate <= ninetyDays) {
      expiryStatus = 'NEAR EXPIRY';
    } else {
      expiryStatus = 'GOOD STOCK';
    }
  }
  if (hasExpiredCheck) {
    expiryStatus = 'EXPIRED';
  }

  if (isCounted) {
    if (expiryStatus === 'EXPIRED' && totalPhysical > 0) {
      category = 'Expired Stock';
    } else if (systemQty === 0 && totalPhysical > 0) {
      category = 'Extra Found';
    } else if (item.notes && item.notes.startsWith('OT')) {
      category = 'Other';
    } else if (difference > 0) {
      category = 'Excess';
    } else if (difference < 0) {
      category = 'Shortage';
    } else {
      category = 'Perfect Match';
    }
  }

  return {
    ...item,
    totalPhysical,
    difference,
    totalStockValue,
    differenceValue,
    category,
    expiryStatus
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

  // 3. Build real display-name map for auditor slots
  const { data: users } = await supabase.from('users').select('name, role');
  const SLOTS = ['Admin', 'User1', 'User2', 'User3', 'User4', 'User5'];
  const slotToDisplay = {};
  (users || []).forEach(u => {
    const parts = (u.name || '').split('|');
    const displayName = parts[0] || u.name;
    const slot = parts[2] || (u.role === 'Admin' ? 'Admin' : null);
    if (slot && SLOTS.includes(slot)) {
      slotToDisplay[slot] = displayName;
    }
  });
  // Fallback to slot name if no user configured
  SLOTS.forEach(slot => {
    if (!slotToDisplay[slot]) slotToDisplay[slot] = slot;
  });

  // Group counts by item ID
  const countsByItem = {};
  (allCounts || []).forEach(c => {
    if (!countsByItem[c.item_id]) countsByItem[c.item_id] = [];
    countsByItem[c.item_id].push(c);
  });

  // 4. Calculate everything
  const processedItems = (items || []).map(item => {
    const itemCounts = countsByItem[item.id] || [];
    return calculateItemValues(item, itemCounts, sessionDate);
  });

  // 5. Summary value calculations
  const totalStockVal   = processedItems.reduce((s, i) => s + (i.system_qty * i.unit_purchase_rate), 0);
  const excessVal       = processedItems.filter(i => i.category === 'Excess').reduce((s, i) => s + i.differenceValue, 0);
  const shortageVal     = processedItems.filter(i => i.category === 'Shortage').reduce((s, i) => s + i.differenceValue, 0);
  const extraFoundVal   = processedItems.filter(i => i.category === 'Extra Found').reduce((s, i) => s + (i.totalPhysical * i.unit_purchase_rate), 0);
  const expiredVal      = processedItems.filter(i => i.category === 'Expired Stock').reduce((s, i) => s + (i.totalPhysical * i.unit_purchase_rate), 0);
  const otVal           = processedItems.filter(i => i.category === 'Other').reduce((s, i) => s + i.differenceValue, 0);
  const grossShortage   = shortageVal;
  const netShortage     = grossShortage + extraFoundVal;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Pharmacy Audit App';
  workbook.lastModifiedBy = 'Pharmacy Audit App';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Style constants
  const fontName = 'Segoe UI';
  const themeBlue = 'FF1E3A8A'; // Dark blue (Tailwind blue-900)
  const headerFontColor = 'FFFFFFFF';
  const zebraColor = 'FFF9FAFB'; // Light grey/white zebra
  const totalRowColor = 'FFEBF2FA'; // Soft blue highlight for totals row

  const applyBaseFormatting = (ws, isSummary = false) => {
    // Enable gridlines
    ws.views = [{ showGridLines: true }];

    // Header Row formatting
    const headerRow = ws.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: fontName,
        size: 10,
        bold: true,
        color: { argb: headerFontColor }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: themeBlue }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: cell.value === 'Item Name' || cell.value === 'Audit Report' ? 'left' : 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'medium', color: { argb: themeBlue } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });

    if (!isSummary) {
      // Freeze header row
      ws.views = [
        { state: 'frozen', xSplit: 0, ySplit: 1, activeCell: 'A2', showGridLines: true }
      ];
    }

    // Body formatting
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const isEven = rowNumber % 2 === 0;
      const firstCellVal = String(row.getCell(1).value || '').toLowerCase();
      const isTotalRow = firstCellVal === 'total' || firstCellVal === 'totals';

      row.height = isTotalRow ? 24 : 20;

      row.eachCell((cell, colNumber) => {
        // Alignment
        const colHeader = String(ws.getRow(1).getCell(colNumber).value || '');
        let horiz = 'center';
        if (colHeader === 'Item Name' || colHeader === 'Audit Report') {
          horiz = 'left';
        } else if (
          colHeader === 'Pruchase rate' ||
          colHeader === 'Selling rate' ||
          colHeader === 'Difference  value' ||
          colHeader === 'Batch Available Quantity' ||
          colHeader === 'Total' ||
          colHeader === 'Difference' ||
          colHeader === 'Value'
        ) {
          horiz = 'right';
        }

        cell.alignment = {
          vertical: 'middle',
          horizontal: horiz
        };

        // Font and Border
        if (isTotalRow) {
          cell.font = {
            name: fontName,
            size: 9.5,
            bold: true,
            color: { argb: 'FF111827' }
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: totalRowColor }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
            bottom: { style: 'double', color: { argb: 'FF111827' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };
        } else {
          cell.font = {
            name: fontName,
            size: 9.5,
            color: { argb: 'FF374151' }
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isEven ? zebraColor : 'FFFFFFFF' }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          };
        }

        // Formatting types
        if (colHeader === 'Pruchase rate' || colHeader === 'Selling rate' || colHeader === 'Difference  value') {
          cell.numFmt = '#,##0.00';
        } else if (colHeader === 'Batch Available Quantity' || colHeader === 'Total' || colHeader === 'Difference') {
          cell.numFmt = '#,##0';
        }
      });
    });
  };

  // ── Sheet 1: Report (Summary) ───────────────────────────────
  const wsSummary = workbook.addWorksheet('Report');
  wsSummary.columns = [
    { header: 'Audit Report', key: 'reportKey', width: 24 },
    { header: 'Value', key: 'reportVal', width: 18 }
  ];

  const summaryRows = [
    { reportKey: 'Total Stock',   reportVal: totalStockVal },
    { reportKey: 'Excess',        reportVal: excessVal },
    { reportKey: 'Shortage',      reportVal: shortageVal },
    { reportKey: '',              reportVal: '' },
    { reportKey: 'Gross Shortage',reportVal: grossShortage },
    { reportKey: 'Extra found',   reportVal: extraFoundVal },
    { reportKey: 'Net Shortage',  reportVal: netShortage },
    { reportKey: '',              reportVal: '' },
    { reportKey: 'OT Present value', reportVal: otVal },
    { reportKey: '',              reportVal: '' },
    { reportKey: 'Expiry Stock Value', reportVal: expiredVal },
  ];
  wsSummary.addRows(summaryRows);
  applyBaseFormatting(wsSummary, true);

  // Customize Report Values formatting to Currency
  wsSummary.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const cellVal = row.getCell(2);
    if (cellVal.value !== '' && cellVal.value !== null && cellVal.value !== undefined) {
      cellVal.numFmt = '₹#,##0.00';
    }
  });

  // ── Sheet 2: standard sheet ────────────────────────────────
  const wsStd = workbook.addWorksheet('standard sheet');
  const stdColumns = [
    { header: 'Item Name', key: 'itemName', width: 38 },
    { header: 'Batch', key: 'batch', width: 14 },
    { header: 'Expiry', key: 'expiry', width: 12 },
    { header: 'Pruchase rate', key: 'purchaseRate', width: 14 },
    { header: 'Selling rate', key: 'sellingRate', width: 14 },
    { header: 'Batch Available Quantity', key: 'availQty', width: 24 },
  ];
  // Add columns for Srikant, Sathya, Santosh, Naveen, Shreeyash
  SLOTS.forEach(slot => {
    stdColumns.push({ header: slotToDisplay[slot], key: slot, width: 14 });
  });
  stdColumns.push(
    { header: 'Total', key: 'total', width: 10 },
    { header: 'Difference', key: 'difference', width: 12 },
    { header: 'Difference  value', key: 'differenceValue', width: 18 }
  );
  wsStd.columns = stdColumns;

  // Add Data Rows
  const totalStockRows = processedItems.map(item => {
    const row = {
      itemName: item.item_name,
      batch: item.batch_no,
      expiry: item.expiry_date || '',
      purchaseRate: item.unit_purchase_rate,
      sellingRate: item.unit_mrp,
      availQty: item.system_qty,
    };
    SLOTS.forEach(slot => {
      const itemCounts = countsByItem[item.id] || [];
      const match = itemCounts.find(c => c.auditor_name === slot);
      row[slot] = match ? Number(match.physical_count) : '';
    });
    row.total = item.totalPhysical;
    row.difference = item.difference;
    row.differenceValue = item.differenceValue;
    return row;
  });
  wsStd.addRows(totalStockRows);

  // Add totals footer
  const totalFooter = {
    itemName: 'Total',
    batch: '',
    expiry: '',
    purchaseRate: '',
    sellingRate: '',
    availQty: processedItems.reduce((s, i) => s + (Number(i.system_qty) || 0), 0),
  };
  SLOTS.forEach(slot => { totalFooter[slot] = ''; });
  totalFooter.total = processedItems.reduce((s, i) => s + (i.totalPhysical || 0), 0);
  totalFooter.difference = processedItems.reduce((s, i) => s + (i.difference || 0), 0);
  totalFooter.differenceValue = excessVal + shortageVal + extraFoundVal + otVal;
  wsStd.addRow(totalFooter);

  applyBaseFormatting(wsStd, false);

  // Helper for Category Sheets
  const addCategorySheet = (sheetName, rowsList, totalValueVal) => {
    const ws = workbook.addWorksheet(sheetName);
    ws.columns = [
      { header: 'Item Name', key: 'itemName', width: 38 },
      { header: 'Batch', key: 'batch', width: 14 },
      { header: 'Expiry', key: 'expiry', width: 12 },
      { header: 'Pruchase rate', key: 'purchaseRate', width: 14 },
      { header: 'Selling rate', key: 'sellingRate', width: 14 },
      { header: 'Batch Available Quantity', key: 'availQty', width: 24 },
      { header: 'Total', key: 'total', width: 10 },
      { header: 'Difference', key: 'difference', width: 12 },
      { header: 'Difference  value', key: 'differenceValue', width: 18 }
    ];

    if (rowsList.length > 0) {
      ws.addRows(rowsList);
      ws.addRow({
        itemName: 'Total',
        batch: '',
        expiry: '',
        purchaseRate: '',
        sellingRate: '',
        availQty: '',
        total: '',
        difference: '',
        differenceValue: totalValueVal
      });
    } else {
      ws.addRow({ itemName: 'No items' });
    }
    applyBaseFormatting(ws, false);
  };

  // Build Sub-sheet row lists
  const buildSubRow = (item) => ({
    itemName: item.item_name,
    batch: item.batch_no,
    expiry: item.expiry_date || '',
    purchaseRate: item.unit_purchase_rate,
    sellingRate: item.unit_mrp,
    availQty: item.system_qty,
    total: item.totalPhysical,
    difference: item.difference,
    differenceValue: item.differenceValue
  });

  const excessRows     = processedItems.filter(i => i.category === 'Excess').map(buildSubRow);
  const shortageRows   = processedItems.filter(i => i.category === 'Shortage').map(buildSubRow);
  const extraFoundRows = processedItems.filter(i => i.category === 'Extra Found').map(buildSubRow);
  const expiredRows    = processedItems.filter(i => i.category === 'Expired Stock').map(buildSubRow);
  const otRows         = processedItems.filter(i => i.category === 'Other').map(buildSubRow);

  addCategorySheet('Excess', excessRows, excessVal);
  addCategorySheet('Shortage', shortageRows, shortageVal);
  addCategorySheet('Extra Found', extraFoundRows, extraFoundVal);

  if (otRows.length > 0) {
    addCategorySheet('OT', otRows, otVal);
  }
  if (expiredRows.length > 0) {
    addCategorySheet('Exp', expiredRows, expiredVal);
  }

  // 8. Write to buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};



// Word Document report generator
const generateWordReport = async (sessionId) => {
  // Load Session Info
  const { data: session, error: sErr } = await supabase
    .from('audit_sessions').select('*').eq('id', sessionId).single();
  if (sErr || !session) throw new Error('Audit session not found');

  const sessionDate = session.audit_date;

  // Load all items & counts
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

  // Calculate everything
  const processedItems = items.map(item => {
    const itemCounts = countsByItem[item.id] || [];
    return calculateItemValues(item, itemCounts, sessionDate);
  });

  // KPI Metrics
  const totalStockVal = processedItems.reduce((sum, item) => sum + (item.system_qty * item.unit_purchase_rate), 0);
  const excessVal = processedItems.filter(item => item.category === 'Excess').reduce((sum, item) => sum + item.differenceValue, 0);
  const shortageVal = processedItems.filter(item => item.category === 'Shortage').reduce((sum, item) => sum + item.differenceValue, 0);
  const extraFoundVal = processedItems.filter(item => item.category === 'Extra Found').reduce((sum, item) => sum + (item.totalPhysical * item.unit_purchase_rate), 0);
  const expiredVal = processedItems.filter(item => item.category === 'Expired Stock').reduce((sum, item) => sum + (item.totalPhysical * item.unit_purchase_rate), 0);
  const otVal = processedItems.filter(item => item.category === 'Other').reduce((sum, item) => sum + item.differenceValue, 0);

  const grossShortage = shortageVal; // negative
  const netShortage = grossShortage + extraFoundVal;
  const netAuditDifference = excessVal + shortageVal + extraFoundVal + otVal;

  // Expiry Breakdown
  const today = new Date();
  today.setHours(0,0,0,0);
  const ninetyDays = new Date(today);
  ninetyDays.setDate(today.getDate() + 90);

  let expiredCount = 0;
  let expiredSum = 0;
  let nearExpiryCount = 0;
  let nearExpirySum = 0;
  let goodStockCount = 0;
  let goodStockSum = 0;

  processedItems.forEach(item => {
    const val = (item.totalPhysical || item.system_qty || 0) * (item.unit_purchase_rate || 0);
    if (!item.expiry_date) {
      goodStockCount++;
      goodStockSum += val;
      return;
    }
    const expDate = new Date(item.expiry_date);
    expDate.setHours(0,0,0,0);
    if (expDate < today) {
      expiredCount++;
      expiredSum += val;
    } else if (expDate <= ninetyDays) {
      nearExpiryCount++;
      nearExpirySum += val;
    } else {
      goodStockCount++;
      goodStockSum += val;
    }
  });

  // Top 5 High-Value Shortages
  const topShortages = [...processedItems]
    .filter(i => i.differenceValue < 0)
    .sort((a, b) => a.differenceValue - b.differenceValue) // most negative first
    .slice(0, 5);

  // Top 5 High-Value Excesses
  const topExcesses = [...processedItems]
    .filter(i => i.differenceValue > 0)
    .sort((a, b) => b.differenceValue - a.differenceValue) // most positive first
    .slice(0, 5);

  const formatRS = (val) => {
    const num = Number(val || 0);
    if (num < 0) {
      return '-₹' + Math.abs(num).toLocaleString('en-IN', { maximumFractionDigits: 2 });
    }
    return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  // Build HTML Word Document
  const html = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
<meta charset="utf-8">
<title>Official Stock Audit Analysis Report</title>
<!--[if gte mso 9]>
<xml>
<w:WordDocument>
<w:View>Print</w:View>
<w:Zoom>100</w:Zoom>
<w:DoNotOptimizeForBrowser/>
</w:WordDocument>
</xml>
<![endif]-->
<style>
@page Section1 {
  size: 8.27in 11.69in; /* A4 */
  margin: 1.0in 1.0in 1.0in 1.0in;
  mso-header-margin: .5in;
  mso-footer-margin: .5in;
}
div.Section1 {
  page: Section1;
}
body {
  font-family: 'Calibri', 'Arial', sans-serif;
  color: #222222;
  line-height: 1.4;
}
h1 {
  font-family: 'Arial', sans-serif;
  font-size: 24pt;
  color: #1a365d;
  text-align: center;
  margin-top: 80px;
  margin-bottom: 5px;
}
h2 {
  font-family: 'Arial', sans-serif;
  font-size: 15pt;
  color: #1a365d;
  border-bottom: 1.5pt solid #1a365d;
  padding-bottom: 3px;
  margin-top: 30px;
  margin-bottom: 10px;
}
h3 {
  font-family: 'Arial', sans-serif;
  font-size: 11pt;
  color: #2b6cb0;
  margin-top: 15px;
  margin-bottom: 5px;
}
p, li {
  font-size: 10.5pt;
  margin-bottom: 8px;
}
table {
  width: 100%;
  border-collapse: collapse;
  margin: 15px 0;
}
th {
  background-color: #1a365d;
  color: #ffffff;
  font-weight: bold;
  padding: 8px;
  font-size: 9.5pt;
  text-align: left;
  border: 1px solid #cbd5e0;
}
td {
  padding: 8px;
  font-size: 9.5pt;
  border: 1px solid #cbd5e0;
}
.kpi-table td {
  background-color: #f7fafc;
  padding: 12px;
  text-align: center;
  border: 1px solid #cbd5e0;
}
.kpi-title {
  font-size: 8.5pt;
  color: #718096;
  text-transform: uppercase;
  font-weight: bold;
}
.kpi-val {
  font-size: 15pt;
  font-weight: bold;
  color: #1a365d;
  margin-top: 4px;
}
.negative {
  color: #e53e3e;
}
.positive {
  color: #38a169;
}
.bold-row {
  font-weight: bold;
  background-color: #edf2f7;
}
</style>
</head>
<body>
<div class="Section1">

<div style="text-align: center; margin-top: 120px;">
  <p style="font-size: 11pt; font-weight: bold; color: #4a5568; text-transform: uppercase; letter-spacing: 2px;">Pharmacy Stock Audit</p>
  <h1>OFFICIAL AUDIT ANALYSIS REPORT</h1>
  <p style="font-size: 13pt; color: #4a5568; margin-bottom: 120px;">Session: ${session.name} <br/> Audit Reference Date: ${session.audit_date}</p>
  <div style="margin-top: 150px; font-size: 10pt; color: #718096;">
    <p><strong>Prepared By:</strong> Audit Administration</p>
    <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()}</p>
    <p><strong>Status:</strong> ${session.status === 'Completed' ? 'Completed & Locked' : 'Active / In Progress'}</p>
  </div>
</div>

<br style="page-break-before: always;"/>

<h2>1. Executive Summary</h2>
<p>
  This report provides a formal, comprehensive analysis of the physical pharmacy stock audit conducted for session <strong>${session.name}</strong> as of the reference date of <strong>${session.audit_date}</strong>. 
  The primary objective of the audit was to reconcile physical inventory quantities against software records, isolate discrepancies, analyze financial impacts (shortages and excesses), and classify risk categories based on product expiries.
</p>

<table class="kpi-table" style="border: 1px solid #cbd5e0;" cellpadding="8" cellspacing="0" border="1">
  <tr>
    <td width="33%" style="border: 1px solid #cbd5e0; background-color: #f7fafc; text-align: center;">
      <div class="kpi-title">Total System Value</div>
      <div class="kpi-val">${formatRS(totalStockVal)}</div>
    </td>
    <td width="33%" style="border: 1px solid #cbd5e0; background-color: #f7fafc; text-align: center;">
      <div class="kpi-title">Gross Shortage Value</div>
      <div class="kpi-val negative">${formatRS(grossShortage)}</div>
    </td>
    <td width="33%" style="border: 1px solid #cbd5e0; background-color: #f7fafc; text-align: center;">
      <div class="kpi-title">Total Excess Value</div>
      <div class="kpi-val positive">${formatRS(excessVal)}</div>
    </td>
  </tr>
  <tr>
    <td style="border: 1px solid #cbd5e0; background-color: #f7fafc; text-align: center;">
      <div class="kpi-title">Extra Found Value</div>
      <div class="kpi-val positive">${formatRS(extraFoundVal)}</div>
    </td>
    <td style="border: 1px solid #cbd5e0; background-color: #f7fafc; text-align: center;">
      <div class="kpi-title">Net Shortage Value</div>
      <div class="kpi-val negative">${formatRS(netShortage)}</div>
    </td>
    <td style="border: 1px solid #cbd5e0; background-color: #f7fafc; text-align: center;">
      <div class="kpi-title">Net Audit Variance</div>
      <div class="kpi-val ${netAuditDifference >= 0 ? 'positive' : 'negative'}">${formatRS(netAuditDifference)}</div>
    </td>
  </tr>
</table>

<h3>Key Summary Table:</h3>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e0; width: 100%;">
  <thead>
    <tr style="background-color: #1a365d; color: #ffffff;">
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px;">Financial Factor</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px;">Count Description</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px; text-align: right;">Financial Value</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="border: 1px solid #cbd5e0; padding: 6px;"><strong>Total System Stock Value</strong></td>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">Recorded inventory value prior to physical audit</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right;"><strong>${formatRS(totalStockVal)}</strong></td>
    </tr>
    <tr>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">Total Excess Discovered</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">Recorded items found in excess of system quantities</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right; color: #38a169;">+${formatRS(excessVal)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">Gross Shortage Discovered</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">Recorded items found short of system quantities</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right; color: #e53e3e;">${formatRS(grossShortage)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">Extra Items Discovered</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">Items physically present that were not in the system at all</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right; color: #38a169;">+${formatRS(extraFoundVal)}</td>
    </tr>
    <tr class="bold-row" style="background-color: #edf2f7; font-weight: bold;">
      <td style="border: 1px solid #cbd5e0; padding: 6px;"><strong>Net Audit Variance</strong></td>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">The absolute net variance (Excess + Extra - Shortage)</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right; color: ${netAuditDifference >= 0 ? '#38a169' : '#e53e3e'};">${formatRS(netAuditDifference)}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">OT Present Value</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">Manual equipment/instrument adjustments</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right;">${formatRS(otVal)}</td>
    </tr>
    <tr class="bold-row" style="background-color: #edf2f7; font-weight: bold;">
      <td style="border: 1px solid #cbd5e0; padding: 6px;"><strong>Total Expired Stock Value</strong></td>
      <td style="border: 1px solid #cbd5e0; padding: 6px;">Value of stock physically verified as expired</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right; color: #e53e3e;">${formatRS(expiredVal)}</td>
    </tr>
  </tbody>
</table>

<br style="page-break-before: always;"/>

<h2>2. Expiry Risk Analysis</h2>
<p>
  Inventory shelf-life management is critical to pharmacy profitability and compliance. Physical stock has been segmented into three distinct categories based on current age:
</p>
<ul>
  <li><strong>EXPIRED</strong>: Items whose expiry date is in the past. These items represent direct write-offs and must be cleared from the shelves immediately.</li>
  <li><strong>NEAR EXPIRY</strong>: Items expiring within the next 90 days. These items require active monitoring, markdown actions, or vendor-return requests.</li>
  <li><strong>GOOD STOCK</strong>: Items expiring beyond 90 days, representing healthy inventory.</li>
</ul>

<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e0; width: 100%;">
  <thead>
    <tr style="background-color: #1a365d; color: #ffffff;">
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px;">Stock Expiry Status</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px; text-align: center;">Item Batches Count</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px; text-align: right;">Total Financial Value</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px; text-align: center;">Proportion (%)</th>
    </tr>
  </thead>
  <tbody>
    <tr style="color: #e53e3e; font-weight: bold;">
      <td style="border: 1px solid #cbd5e0; padding: 6px;">EXPIRED (Past due date)</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center;">${expiredCount}</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right;">${formatRS(expiredSum)}</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center;">${((expiredSum / (totalStockVal || 1)) * 100).toFixed(1)}%</td>
    </tr>
    <tr style="color: #dd6b20; font-weight: bold;">
      <td style="border: 1px solid #cbd5e0; padding: 6px;">NEAR EXPIRY (Expiring in &lt;= 90 days)</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center;">${nearExpiryCount}</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right;">${formatRS(nearExpirySum)}</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center;">${((nearExpirySum / (totalStockVal || 1)) * 100).toFixed(1)}%</td>
    </tr>
    <tr style="color: #38a169;">
      <td style="border: 1px solid #cbd5e0; padding: 6px;">GOOD STOCK (Healthy shelf-life)</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center;">${goodStockCount}</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right;">${formatRS(goodStockSum)}</td>
      <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center;">${((goodStockSum / (totalStockVal || 1)) * 100).toFixed(1)}%</td>
    </tr>
  </tbody>
</table>

<br style="page-break-before: always;"/>

<h2>3. High-Value Discrepancy Breakdown</h2>

<h3>Top 5 High-Value Shortages (Shrinkage / Losses)</h3>
<p>
  The following items represent the largest financial losses. These items should be investigated for potential theft, billing errors, or damaged goods write-off failures.
</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e0; width: 100%;">
  <thead>
    <tr style="background-color: #1a365d; color: #ffffff;">
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px;">Item Name</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px;">Batch ID</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px;">Expiry</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px; text-align: center;">Sys Qty</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px; text-align: center;">Phy Qty</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px; text-align: center;">Diff</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; text-align: right;">Rate</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; text-align: right;">Loss Value</th>
    </tr>
  </thead>
  <tbody>
    ${topShortages.map(i => `
      <tr>
        <td style="border: 1px solid #cbd5e0; padding: 6px;">${i.item_name}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px;">${i.batch_no}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px;">${i.expiry_date || 'N/A'}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center;">${i.system_qty}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center;">${i.totalPhysical}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center; color: #e53e3e;">${i.difference}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right;">${formatRS(i.unit_purchase_rate)}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right; color: #e53e3e;">${formatRS(i.differenceValue)}</td>
      </tr>
    `).join('')}
  </tbody>
</table>

<h3>Top 5 High-Value Excesses (Surpluses)</h3>
<p>
  The following items represent the largest surpluses. These frequently occur due to receiving dock errors, double-receiving invoices, or failure to register custom stock.
</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e0; width: 100%;">
  <thead>
    <tr style="background-color: #1a365d; color: #ffffff;">
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px;">Item Name</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px;">Batch ID</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px;">Expiry</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px; text-align: center;">Sys Qty</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px; text-align: center;">Phy Qty</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; padding: 6px; text-align: center;">Diff</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; text-align: right;">Rate</th>
      <th style="border: 1px solid #cbd5e0; color: #ffffff; text-align: right;">Surplus Value</th>
    </tr>
  </thead>
  <tbody>
    ${topExcesses.map(i => `
      <tr>
        <td style="border: 1px solid #cbd5e0; padding: 6px;">${i.item_name}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px;">${i.batch_no}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px;">${i.expiry_date || 'N/A'}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center;">${i.system_qty}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center;">${i.totalPhysical}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: center; color: #38a169;">+${i.difference}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right;">${formatRS(i.unit_purchase_rate)}</td>
        <td style="border: 1px solid #cbd5e0; padding: 6px; text-align: right; color: #38a169;">${formatRS(i.differenceValue)}</td>
      </tr>
    `).join('')}
  </tbody>
</table>

<br style="page-break-before: always;"/>

<h2>4. Operational Findings & Recommendations</h2>
<p>
  Based on the financial metrics and risk distributions identified, the following actions are recommended for pharmacy store management:
</p>
<ol class="recommendation-list">
  <li class="recommendation-item">
    <strong>Strengthen Security on High-Value Items:</strong> 
    Several items in the Top Shortages table represent significant financial shrinkage. High-value stock lines should be moved behind locked cabinets or subjected to bi-weekly blind cycle counts.
  </li>
  <li class="recommendation-item">
    <strong>Enforce Direct Return Guidelines for Expiries:</strong> 
    With <strong>${formatRS(expiredSum)}</strong> in expired stock, a formal quarantine shelf should be established. Returns to vendors must be initiated at least 60 days prior to the batch expiry date to claim full replacement credits.
  </li>
  <li class="recommendation-item">
    <strong>Audit the Receiving Process:</strong> 
    The excess values (amounting to <strong>${formatRS(excessVal)}</strong>) point to structural receiving issues, where physical stock is scanned in/accepted without verification of invoice quantities. Receiving clerks should receive mandatory retraining on blind check-in protocols.
  </li>
  <li class="recommendation-item">
    <strong>Maintain Collaborative Audits:</strong> 
    Real-time multi-auditor entry successfully captured and cross-verified counts, reducing data clashing. Continue the practice of locking sheets to status <em>Completed</em> to prevent unauthorized back-edits after physical counts wrap up.
  </li>
</ol>

<div style="page-break-before: always; height: 100%; display: flex; flex-direction: column;">
  <div style="margin-top: auto; padding-top: 60px;">
    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #00467F;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width: 50%; border: 1.5px solid #00467F; padding: 16px 20px; text-align: left; vertical-align: top; background: #f7faff;">
          <p style="margin: 0 0 16px 0; border-bottom: 1.5px solid #00467F; width: 70%;"></p>
          <p style="margin: 0 0 6px 0;"><strong>Audited By:</strong></p>
          <p style="margin: 0 0 12px 0;">Audit Committee Representative</p>
          <p style="font-size: 8.5pt; color: #718096; margin: 0;">Date: ____/____/________</p>
        </td>
        <td style="width: 50%; border: 1.5px solid #00467F; padding: 16px 20px; text-align: right; vertical-align: top; background: #f7faff;">
          <p style="margin: 0 0 16px 0; border-bottom: 1.5px solid #00467F; width: 70%; margin-left: auto;"></p>
          <p style="margin: 0 0 6px 0;"><strong>Approved By:</strong></p>
          <p style="margin: 0 0 12px 0;">Manager</p>
          <p style="font-size: 8.5pt; color: #718096; margin: 0;">Date: ____/____/________</p>
        </td>
      </tr>
    </table>
  </div>
</div>

</div>
</body>
</html>
  `;
  return Buffer.from(html, 'utf-8');
};

module.exports = {
  calculateItemValues,
  generateExcelBuffer,
  generateWordReport
};
