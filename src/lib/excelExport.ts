import * as XLSX from 'xlsx';

export async function exportToExcel(data: any[], fileName: string, type: string) {
  // Create a new workbook
  const workbook = XLSX.utils.book_new();
  
  // Format data for sheet
  const header = [
    'Lead Liaison', 
    'Department', 
    'Destination', 
    'Purpose', 
    'Schedule Date', 
    'Cash Advance Grant', 
    'Reimbursement Value', 
    'Liquidated Amount', 
    'Status', 
    'Submission Date'
  ];

  // Map data to match headers
  const worksheetData = [
    ['STLAF LIAISON OPERATIONS MASTER REGISTRY - 2026'],
    [`Report Generated: ${new Date().toLocaleString()}`],
    [], // empty row
    header,
    ...data.map(item => [
      item.employeeName,
      item.department,
      item.destination,
      item.purpose,
      item.scheduleDate,
      item.requestedCashAdvance,
      item.reimbursements?.reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || 0,
      item.liquidationItems?.reduce((sum: number, i: any) => sum + (i.amount || 0), 0) || 0,
      item.status,
      item.submittedAt?.toDate().toLocaleDateString() || 'N/A'
    ])
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Operational Report');

  // Trigger download
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
