import { Timestamp } from 'firebase/firestore';

export type EntryStatus = 'Draft' | 'Ongoing' | 'For Liquidation' | 'Submitted' | 'Approved' | 'Rejected';

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
  fileName?: string;
}

export interface LiquidationItem {
  id: string;
  description: string;
  amount: number;
  receiptUrl?: string;
  date: string;
  fileName?: string;
  requiresProofSlip?: boolean;
}

export interface ProofSlip {
  id: string;
  description: string;
  amount: number;
  explanation: string;
  attachmentUrl?: string;
  fileName?: string;
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
  remarks: string;
  status: EntryStatus;
  
  hasReimbursements?: boolean;
  reimbursements?: ReimbursementEntry[];
  liquidationItems?: LiquidationItem[];
  proofSlips?: ProofSlip[];
  
  submittedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
