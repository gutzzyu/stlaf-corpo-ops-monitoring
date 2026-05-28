import * as XLSX from 'xlsx-js-style';
import { OperationalEntry } from '../types';

function styleHeaderRow(sheet: any, rowIdx: number, numCols: number) {
  for (let c = 0; c < numCols; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: rowIdx, c });
    if (!sheet[cellRef]) {
      sheet[cellRef] = { v: '' };
    }
    sheet[cellRef].s = {
      fill: {
        fgColor: { rgb: "0F172A" } // Deep Navy Blue (consistent with the app's navy branding)
      },
      font: {
        name: "Arial",
        sz: 10,
        color: { rgb: "FFFFFF" }, // White text
        bold: true
      },
      alignment: {
        vertical: "center",
        horizontal: "left",
        wrapText: true
      }
    };
  }
}

export async function exportToExcel(data: OperationalEntry[], fileName: string) {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();
  const timestampStr = new Date().toLocaleString();

  // ==========================================
  // TAB 1: OPEX Summary
  // ==========================================
  const opexHeader = [
    'ACCOUNT NAME',
    'DATE OF VISIT',
    'LOCATION',
    'PURPOSE / TRANSACTION',
    'AMOUNT',
    'BILLED',
    'BILLING NUMBER',
    'BILLING DATE'
  ];

  let totalOpexAmount = 0;
  const opexRows = data.map(item => {
    const amount = item.outOfPocketExpense || 0;
    totalOpexAmount += amount;
    return [
      item.accountName || '',
      item.scheduleDate || '',
      item.destination || '',
      item.purpose || '',
      amount,
      '', // left blank as requested
      '', // left blank as requested
      ''  // left blank as requested
    ];
  });

  const opexSheetData = [
    ['STLAF LIAISON OPERATIONS - OPEX SUMMARY'],
    [`Report Generated: ${timestampStr}`],
    [], // Spacer row
    opexHeader,
    ...opexRows,
    [], // Spacer row before Total
    ['GRAND TOTAL', '', '', '', totalOpexAmount, '', '', '']
  ];

  const opexSheet = XLSX.utils.aoa_to_sheet(opexSheetData);
  styleHeaderRow(opexSheet, 3, opexHeader.length);

  // Set column widths for Tab 1
  opexSheet['!cols'] = [
    { wch: 30 }, // ACCOUNT NAME
    { wch: 15 }, // DATE OF VISIT
    { wch: 28 }, // LOCATION
    { wch: 35 }, // PURPOSE
    { wch: 18 }, // AMOUNT
    { wch: 12 }, // BILLED
    { wch: 20 }, // BILLING NUMBER
    { wch: 16 }  // BILLING DATE
  ];

  // Apply cell formats for Tab 1 (Numeric values and Currency styles)
  // Data rows start at index 4 (0-based) to 4 + opexRows.length
  // Grand total is at index 4 + opexRows.length + 1
  const opexDataStartRow = 4;
  const opexTotalRowIdx = opexDataStartRow + opexRows.length + 1;

  for (let r = opexDataStartRow; r < opexDataStartRow + opexRows.length; r++) {
    const amountCellRef = XLSX.utils.encode_cell({ r, c: 4 });
    if (opexSheet[amountCellRef]) {
      opexSheet[amountCellRef].t = 'n';
      opexSheet[amountCellRef].z = '"₱"#,##0.00';
    }
  }

  // Format grand total cell
  const opexTotalCellRef = XLSX.utils.encode_cell({ r: opexTotalRowIdx, c: 4 });
  if (opexSheet[opexTotalCellRef]) {
    opexSheet[opexTotalCellRef].t = 'n';
    opexSheet[opexTotalCellRef].z = '"₱"#,##0.00';
  }


  // ==========================================
  // TAB 2: Cash Advance Summary
  // ==========================================
  const caHeader = [
    'DATE',
    'NAME OF THE EMPLOYEE',
    'AMOUNT',
    'DESCRIPTION / PURPOSE'
  ];

  let totalCaAmount = 0;
  const caRows = data.map(item => {
    const amount = item.requestedCashAdvance || 0;
    totalCaAmount += amount;
    return [
      item.scheduleDate || '',
      item.employeeName || '',
      amount,
      item.cashAdvancePurpose || item.purpose || ''
    ];
  });

  const caSheetData = [
    ['STLAF LIAISON OPERATIONS - CASH ADVANCE SUMMARY'],
    [`Report Generated: ${timestampStr}`],
    [], // Spacer row
    caHeader,
    ...caRows,
    [], // Spacer row
    ['GRAND TOTAL', '', totalCaAmount, '']
  ];

  const caSheet = XLSX.utils.aoa_to_sheet(caSheetData);
  styleHeaderRow(caSheet, 3, caHeader.length);

  // Set column widths for Tab 2
  caSheet['!cols'] = [
    { wch: 16 }, // DATE
    { wch: 30 }, // NAME
    { wch: 18 }, // AMOUNT
    { wch: 45 }  // DESCRIPTION/PURPOSE
  ];

  // Apply cell formats for Tab 2
  const caDataStartRow = 4;
  const caTotalRowIdx = caDataStartRow + caRows.length + 1;

  for (let r = caDataStartRow; r < caDataStartRow + caRows.length; r++) {
    const amountCellRef = XLSX.utils.encode_cell({ r, c: 2 });
    if (caSheet[amountCellRef]) {
      caSheet[amountCellRef].t = 'n';
      caSheet[amountCellRef].z = '"₱"#,##0.00';
    }
  }

  const caTotalCellRef = XLSX.utils.encode_cell({ r: caTotalRowIdx, c: 2 });
  if (caSheet[caTotalCellRef]) {
    caSheet[caTotalCellRef].t = 'n';
    caSheet[caTotalCellRef].z = '"₱"#,##0.00';
  }


  // ==========================================
  // TAB 3: PCF Summary
  // ==========================================
  const pcfHeader = [
    'Employee',
    'Date',
    'Entity',
    'Department',
    'Tin Number of Supplier',
    'Supplier’s Name',
    'Supplier’s Address',
    'Description',
    'Account',
    'Tax Type',
    'Total Amount',
    'VAT Exclusive Amount',
    'VAT Amount',
    'NON-VAT Amount',
    'Invoice Number',
    'Billable',
    'Client Name',
    'Liquidation Receipts'
  ];

  let totalReceiptAmount = 0;
  let totalVatExclusive = 0;
  let totalVatAmount = 0;
  let totalNonVatAmount = 0;

  const pcfRows: any[] = [];

  data.forEach(entry => {
    const items = entry.liquidationItems || [];
    items.forEach(item => {
      let vatExclusive = 0;
      let vatAmt = 0;
      let nonVatAmt = 0;

      const baseAmount = item.amount || 0;
      totalReceiptAmount += baseAmount;

      if (item.taxType === 'VAT') {
        vatExclusive = item.vatExclusive || (baseAmount / 1.12);
        vatAmt = item.vatAmount || (baseAmount - vatExclusive);
        totalVatExclusive += vatExclusive;
        totalVatAmount += vatAmt;
      } else {
        nonVatAmt = item.nonVatAmount || baseAmount;
        totalNonVatAmount += nonVatAmt;
      }

      const receiptUrl = item.driveUrl || item.receiptUrl || '';

      // Create cell for Link
      const linkCell = receiptUrl ? {
        v: 'View Receipt Image',
        l: { Target: receiptUrl, Tooltip: 'Click to open Google Drive' }
      } : '';

      pcfRows.push([
        entry.employeeName || '',
        entry.scheduleDate || '',
        item.entity || 'CCT',
        item.department || entry.department || '',
        item.tinNo || '',
        item.supplierName || '',
        item.supplierAddress || '',
        item.description || '',
        item.account || '',
        item.taxType || 'NON-VAT',
        baseAmount,
        vatExclusive,
        vatAmt,
        nonVatAmt,
        item.invoiceNo || '',
        item.billable || 'No',
        item.clientName || 'N/A',
        linkCell
      ]);
    });
  });

  const pcfSheetData = [
    ['STLAF LIAISON OPERATIONS - PCF LIQUIDATION SUMMARY'],
    [`Report Generated: ${timestampStr}`],
    [], // Spacer row
    pcfHeader,
    ...pcfRows.map(row => {
      // Return a plain row (with URL links represented as objects or plain strings)
      return row;
    }),
    [], // Spacer row
    [
      'GRAND TOTAL', '', '', '', '', '', '', '', '', '',
      totalReceiptAmount,
      totalVatExclusive,
      totalVatAmount,
      totalNonVatAmount,
      '', '', '', ''
    ]
  ];

  const pcfSheet = XLSX.utils.aoa_to_sheet(pcfSheetData);
  styleHeaderRow(pcfSheet, 3, pcfHeader.length);

  // Set column widths for Tab 3
  pcfSheet['!cols'] = [
    { wch: 25 }, // Employee
    { wch: 15 }, // Date
    { wch: 12 }, // Entity
    { wch: 18 }, // Department
    { wch: 22 }, // Tin Number of Supplier
    { wch: 25 }, // Supplier’s Name
    { wch: 30 }, // Supplier’s Address
    { wch: 35 }, // Description
    { wch: 18 }, // Account
    { wch: 12 }, // Tax Type
    { wch: 18 }, // Total Amount
    { wch: 20 }, // VAT Exclusive Amount
    { wch: 18 }, // VAT Amount
    { wch: 18 }, // NON-VAT Amount
    { wch: 18 }, // Invoice Number
    { wch: 12 }, // Billable
    { wch: 22 }, // Client Name
    { wch: 25 }  // Liquidation Receipts
  ];

  // Apply cell formats for Tab 3 (Total, VAT Exclusive, VAT Amount, NON-VAT Amount)
  const pcfDataStartRow = 4;
  const pcfTotalRowIdx = pcfDataStartRow + pcfRows.length + 1;

  for (let r = pcfDataStartRow; r < pcfDataStartRow + pcfRows.length; r++) {
    // Column 10 (K): Total Amount
    const totCellRef = XLSX.utils.encode_cell({ r, c: 10 });
    if (pcfSheet[totCellRef]) {
      pcfSheet[totCellRef].t = 'n';
      pcfSheet[totCellRef].z = '"₱"#,##0.00';
    }

    // Column 11 (L): VAT Exclusive
    const extCellRef = XLSX.utils.encode_cell({ r, c: 11 });
    if (pcfSheet[extCellRef]) {
      pcfSheet[extCellRef].t = 'n';
      pcfSheet[extCellRef].z = '"₱"#,##0.00';
    }

    // Column 12 (M): VAT Amount
    const vatCellRef = XLSX.utils.encode_cell({ r, c: 12 });
    if (pcfSheet[vatCellRef]) {
      pcfSheet[vatCellRef].t = 'n';
      pcfSheet[vatCellRef].z = '"₱"#,##0.00';
    }

    // Column 13 (N): NON-VAT Amount
    const nVatCellRef = XLSX.utils.encode_cell({ r, c: 13 });
    if (pcfSheet[nVatCellRef]) {
      pcfSheet[nVatCellRef].t = 'n';
      pcfSheet[nVatCellRef].z = '"₱"#,##0.00';
    }

    // Make the link cells styled with blue color if they exist
    const linkCellRef = XLSX.utils.encode_cell({ r, c: 17 });
    if (pcfSheet[linkCellRef] && pcfSheet[linkCellRef].v) {
      // High-quality link metadata (l property is already assigned in cell object, aoa_to_sheet preserves it)
    }
  }

  // Grand totals mapping for Tab 3
  const pcfTotalCols = [10, 11, 12, 13];
  pcfTotalCols.forEach(colIdx => {
    const totalCellRef = XLSX.utils.encode_cell({ r: pcfTotalRowIdx, c: colIdx });
    if (pcfSheet[totalCellRef]) {
      pcfSheet[totalCellRef].t = 'n';
      pcfSheet[totalCellRef].z = '"₱"#,##0.00';
    }
  });


  // ==========================================
  // Append Sheets to Workbook
  // ==========================================
  XLSX.utils.book_append_sheet(workbook, opexSheet, 'OPEX Summary');
  XLSX.utils.book_append_sheet(workbook, caSheet, 'Cash Advance Summary');
  XLSX.utils.book_append_sheet(workbook, pcfSheet, 'PCF Summary');

  // Trigger file download
  if (fileName) {
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  }

  // Generate buffer for potential backend upload/storage
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
