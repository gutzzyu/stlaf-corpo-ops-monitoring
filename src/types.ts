import { Timestamp } from 'firebase/firestore';

export type EntryStatus = 'Draft' | 'Ongoing' | 'For Liquidation' | 'Submitted' | 'Approved' | 'Rejected' | 'Needs Revision' | 'Completed';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  department: string;
  role: 'user' | 'admin';
  createdAt: Timestamp;
}

export interface ReimbursementEntry {
  id: string;
  purpose: string;
  amount: number;
  remarks?: string;
  attachmentUrl?: string;
  driveFileId?: string;
  driveUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export interface LiquidationItem {
  id: string;
  dateOfReceipt: string;
  entity: 'CCT';
  department: 'Corporate';
  tinNo: string;
  supplierName: string;
  supplierAddress: string;
  account: string;
  taxType: 'VAT' | 'NON-VAT';
  vatExclusive?: number;
  vatAmount?: number;
  nonVatAmount?: number;
  invoiceNo?: string;
  billable: 'Yes' | 'No';
  clientName: string;
  description: string;
  amount: number;
  receiptUrl?: string;
  driveFileId?: string;
  driveUrl?: string;
  fileName?: string;
  requiresProofSlip?: boolean;
  mimeType?: string;
}

export interface ProofSlip {
  id: string;
  description: string;
  amount: number;
  explanation: string;
  attachmentUrl?: string;
  driveFileId?: string;
  driveUrl?: string;
  fileName?: string;
  mimeType?: string;
}

export interface OperationalEntry {
  id?: string;
  userId: string;
  employeeName: string;
  department: string;
  contactNumber: string;
  accountName: string;
  companyName: string;
  contactPerson?: string;
  destination: string;
  purpose: string;
  scheduleDate: string;
  destinationType: 'Within Metro Manila' | 'Outside Metro Manila';
  outOfPocketExpense: number;
  requestedCashAdvance: number;
  cashAdvancePurpose?: string;
  remarks: string;
  adminNotes?: string;
  status: EntryStatus;
  
  billed?: 'Yes' | 'No';
  billingNumber?: string;
  billingDate?: string;
  
  hasReimbursements?: boolean;
  reimbursements?: ReimbursementEntry[];
  liquidationItems?: LiquidationItem[];
  proofSlips?: ProofSlip[];
  
  submittedAt?: Timestamp;
  reportDriveUrl?: string;
  reportDriveId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
