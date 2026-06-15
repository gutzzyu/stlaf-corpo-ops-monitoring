import React from 'react';
import { OperationalEntry } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  CreditCard, 
  FileText, 
  Receipt,
  CheckCircle2,
  Clock,
  ExternalLink,
  Camera,
  User,
  Sparkles,
  AlertCircle,
  Settings
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';

import { useAuth } from '../components/auth/AuthProvider';
import { db, handleFirestoreError, OperationType, getErrorMessage } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Props {
  entry: OperationalEntry;
  onBack: () => void;
}

const SummaryView: React.FC<Props> = ({ entry, onBack }) => {
  const { isAdmin } = useAuth();
  const [isRevisionDialogOpen, setIsRevisionDialogOpen] = React.useState(false);
  const [revisionNotes, setRevisionNotes] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const handleUpdateStatus = async (newStatus: string, notes: string = '') => {
    setIsLoading(true);
    const toastId = toast.loading(`Marking entry as ${newStatus}...`);
    try {
      // 1. If Approved, trigger Drive finalization FIRST
      if (newStatus === 'Approved') {
        toast.loading("Transferring attachments to official Google Drive...", { id: toastId });
        
        const token = localStorage.getItem('google_drive_token');
        let response: Response;
        try {
          response = await fetch('/api/finalize-liquidation', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ 
              entryId: entry.id,
              entryData: entry // Pass full data to avoid server-side read
            })
          });
        } catch (fetchErr: any) {
           if (fetchErr.name === 'TypeError' && fetchErr.message === 'Failed to fetch') {
             throw new Error("Cannot contact server: Browser is blocking third-party cookies or redirects. Please click the pop-out icon at top right to open the app in a new tab.");
           }
           throw fetchErr;
        }

        if (!response.ok) {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.indexOf("application/json") !== -1) {
            const err = await response.json();
            if (response.status === 401 || err.error === 'DRIVE_AUTH_ERROR') {
              localStorage.removeItem('google_drive_token');
              localStorage.removeItem('google_drive_token_expiry');
              throw new Error("Google Drive session expired. Please log out and log in again to refresh your connection.");
            }
            throw new Error(err.message || err.error || "Failed to finalize Drive files.");
          } else {
            if (response.status === 413) throw new Error("Payload too large or server timeout.");
            throw new Error(`Finalization failed with status ${response.status}`);
          }
        }
      } else if (newStatus === 'Needs Revision') {
        toast.loading("Ensuring attachments are in pending state...", { id: toastId });
        const token = localStorage.getItem('google_drive_token');
        try {
          const response = await fetch('/api/revert-to-pending', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ 
              entryId: entry.id,
              entryData: entry
            })
          });
          if (!response.ok) {
             const err = await response.json().catch(() => ({}));
             if (response.status === 401 || err.error === 'DRIVE_AUTH_ERROR') {
                localStorage.removeItem('google_drive_token');
                console.warn("Drive session expired during revert-to-pending");
             } else {
                console.warn("Revert to pending might have failed:", err);
             }
          }
        } catch (err) {
           console.warn("Failed to contact server for revert to pending", err);
        }
      }

      // 2. Update Firestore status ONLY after successful finalization (if applicable)
      await updateDoc(doc(db, 'operational_entries', entry.id!), {
        status: newStatus,
        adminNotes: notes || entry.adminNotes || '',
        updatedAt: serverTimestamp()
      });

      toast.success(`Entry marked as ${newStatus}`, { id: toastId });
      onBack();
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Operation failed: ${errorMessage}`, { id: toastId });
      
      // Only report as Firestore error if it's actually about Firestore
      if (error.message?.includes('Firestore') || error.code?.includes('permission-denied')) {
        handleFirestoreError(error, OperationType.UPDATE, `operational_entries/${entry.id}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const submitRevision = () => {
    if (!revisionNotes.trim()) {
      toast.error("Please provide revision instructions.");
      return;
    }
    handleUpdateStatus('Needs Revision', revisionNotes);
  };

  const handleGeneratePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', format: 'legal' });
    const safeDate = entry.scheduleDate || entry.createdAt?.toDate().toLocaleDateString() || new Date().toLocaleDateString();
    
    const drawSignatureLine = (label: string, x: number, y: number) => {
      doc.line(x, y, x + 40, y);
      doc.setFontSize(7);
      doc.text(label, x + 20, y + 4, { align: 'center' });
    };

    // 1. CASH ADVANCE Section
    autoTable(doc, {
      head: [[{ content: 'Cash Advance Details', colSpan: 4, styles: { halign: 'left', fillColor: [16, 42, 67], textColor: [255, 255, 255], fontStyle: 'bold' } }],
             ['Date', 'Name', 'Purpose/Description', 'Requested Amount']],
      body: [
        [
          safeDate,
          entry.employeeName || '',
          entry.cashAdvancePurpose || entry.purpose || '',
          entry.requestedCashAdvance?.toLocaleString() || '-'
        ]
      ],
      startY: 15,
      theme: 'grid',
      headStyles: { fillColor: [16, 42, 67], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;
    drawSignatureLine("Requestor/Recipient", 14, currentY);
    drawSignatureLine("Received By", 70, currentY);
    drawSignatureLine("Released By", 126, currentY);
    drawSignatureLine("Officer in Charge", 182, currentY);

    currentY += 15;

    // 2. REIMBURSEMENT Section
    const reimbursementsBody = (entry.reimbursements || []).map(r => [
      safeDate,
      entry.employeeName || '',
      r.purpose || r.remarks || '',
      r.amount.toLocaleString()
    ]);

    if (reimbursementsBody.length === 0) {
      reimbursementsBody.push(['-', '-', 'No reimbursements filed', '0']);
    }

    autoTable(doc, {
      head: [[{ content: 'Reimbursement Details', colSpan: 4, styles: { halign: 'left', fillColor: [16, 42, 67], textColor: [255, 255, 255], fontStyle: 'bold' } }],
             ['Date', 'Name', 'Purpose/Description', 'Total Cost']],
      body: reimbursementsBody,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [16, 42, 67], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
    drawSignatureLine("Requestor/Recipient", 14, currentY);
    drawSignatureLine("Received By", 70, currentY);
    drawSignatureLine("Released By", 126, currentY);
    drawSignatureLine("Officer in Charge", 182, currentY);

    currentY += 15;

    // 3. PROOF SLIP Section
    const proofItemsBody = (entry.liquidationItems || [])
      .filter(i => i.requiresProofSlip)
      .map(i => [
        i.dateOfReceipt || safeDate,
        entry.employeeName || '',
        i.supplierName || '',
        i.amount.toLocaleString()
      ]);

    if (proofItemsBody.length === 0) {
      proofItemsBody.push(['-', '-', 'No proof slips required', '0']);
    }

    autoTable(doc, {
      head: [[{ content: 'Proof Slip Registry', colSpan: 4, styles: { halign: 'left', fillColor: [16, 42, 67], textColor: [255, 255, 255], fontStyle: 'bold' } }],
             ['Date', 'Name', 'Purpose/Description', 'Amount Paid']],
      body: proofItemsBody,
      startY: currentY,
      theme: 'grid',
      headStyles: { fillColor: [16, 42, 67], textColor: [255, 255, 255] },
      styles: { fontSize: 8, cellPadding: 2 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;
    drawSignatureLine("Payee's Name", 14, currentY);
    drawSignatureLine("Approved By", 70, currentY);
    drawSignatureLine("Officer in Charge", 126, currentY);

    doc.save(`Operational_Entry_${(entry.id || 'export').slice(0, 8)}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4 sm:px-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-wrap gap-4">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-slate-400 hover:text-navy-900 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={handleGeneratePDF} className="gap-2 text-navy-900 border-slate-200 hover:bg-slate-50 font-bold rounded-xl whitespace-nowrap">
            <FileText className="h-4 w-4" />
            Export to PDF
          </Button>
        </div>

        {isAdmin && entry.status === 'Submitted' && (
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsRevisionDialogOpen(true)}
              className="rounded-xl border-orange-200 text-orange-600 hover:bg-orange-50 font-bold"
            >
              Needs Revision
            </Button>
            <Button 
              onClick={() => handleUpdateStatus('Approved')}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-white"
            >
              Approve Mission
            </Button>
          </div>
        )}
      </div>

      <Dialog open={isRevisionDialogOpen} onOpenChange={setIsRevisionDialogOpen}>
        <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="h-2 bg-orange-500 w-full" />
          <div className="p-8 space-y-6">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-navy-900 italic tracking-tight">Revision Notes.</DialogTitle>
              <DialogDescription className="font-medium text-slate-500">
                Specify what the field officer needs to correct.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-2">
              <Label className="micro-label text-orange-600">Instructions</Label>
              <Textarea 
                placeholder="e.g., The liquidation total does not match the sum of receipts."
                value={revisionNotes}
                onChange={(e) => setRevisionNotes(e.target.value)}
                className="min-h-[120px] rounded-2xl bg-slate-50 border-none font-medium"
              />
            </div>

            <DialogFooter className="flex gap-3">
              <Button variant="ghost" onClick={() => setIsRevisionDialogOpen(false)} className="flex-1 rounded-xl font-bold">Cancel</Button>
              <Button onClick={submitRevision} disabled={isLoading} className="flex-1 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-white">
                {isLoading ? "Sending..." : "Send Back"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="border-none shadow-2xl shadow-navy-900/5 rounded-[3rem] overflow-hidden bg-white">
        <div className="h-2 bg-gold-500 w-full" />
        <CardHeader className="p-10 pb-6 border-b border-slate-50">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4">
              <Badge className="rounded-xl px-4 py-1.5 font-black text-xs uppercase tracking-widest bg-navy-900 text-white">
                {entry.status}
              </Badge>
              <div className="space-y-1">
                <CardTitle className="text-4xl md:text-5xl font-black text-navy-900 tracking-tighter leading-none italic">
                  Operational <br />
                  <span className="text-gold-500">Registry</span> #{(entry.id || '...').slice(0, 8).toUpperCase()}
                </CardTitle>
                <CardDescription className="text-slate-500 font-medium">
                  Official operational documentation for mission control.
                </CardDescription>
              </div>
            </div>
            <div className="text-right space-y-1">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">Created At</span>
              <div className="text-sm font-data font-bold text-navy-900">
                {entry.createdAt?.toDate().toLocaleString()}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-10 space-y-12">
          {/* Admin Notes Section */}
          {(entry.adminNotes || entry.status === 'Needs Revision') && (
            <div className="p-8 bg-orange-50 rounded-[2.5rem] border-2 border-orange-100 flex gap-4">
               <AlertCircle className="h-6 w-6 text-orange-500 shrink-0 mt-1" />
               <div className="space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Admin Revision Notes</span>
                  <p className="text-sm font-bold text-orange-900 italic">
                     {entry.adminNotes || "Action Required: Please review and resubmit your liquidated expenses."}
                  </p>
               </div>
            </div>
          )}

          {/* Section 1: Personnel & Account */}
          <div className="grid md:grid-cols-2 gap-12">
             <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-navy-900 italic">Personnel Info</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Employee's Name</Label>
                    <p className="text-lg font-bold text-navy-900">{entry.employeeName}</p>
                    <p className="text-xs font-medium text-slate-400 italic">{entry.department}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Contact Number</Label>
                    <p className="text-sm font-bold text-navy-900">{entry.contactNumber}</p>
                  </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex items-center gap-2">
                   <Sparkles className="h-4 w-4 text-amber-500" />
                   <span className="text-xs font-black uppercase tracking-widest text-navy-900 italic">Account Reference</span>
                </div>
                <div className="space-y-4">
                   <div>
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Client / Account</Label>
                      <p className="text-sm font-bold text-navy-900">{entry.accountName}</p>
                      <p className="text-xs font-medium text-slate-400 uppercase tracking-tighter">{entry.companyName}</p>
                   </div>
                   {entry.contactPerson && (
                     <div>
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Contact Person</Label>
                        <p className="text-sm font-medium text-navy-900">{entry.contactPerson}</p>
                     </div>
                   )}
                </div>
             </div>
          </div>

          {/* Section 2: Mission Parameters */}
          <div className="space-y-6 pt-12 border-t border-slate-50">
             <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-black uppercase tracking-widest text-navy-900 italic">Mission Scope</span>
             </div>
             
             <div className="grid md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Destination</Label>
                        <p className="text-lg font-bold text-navy-900">{entry.destination}</p>
                        <Badge variant="secondary" className="mt-1 text-[8px] uppercase font-black">
                           {entry.destinationType}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Schedule Date</Label>
                        <div className="flex items-center gap-2 text-navy-900 font-data font-bold">
                           <Calendar className="h-4 w-4 text-slate-300" />
                           {entry.scheduleDate}
                        </div>
                      </div>
                   </div>
                   <div>
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Purpose</Label>
                      <p className="text-sm leading-relaxed text-slate-600 font-medium bg-slate-50 p-4 rounded-2xl">
                         {entry.purpose}
                      </p>
                   </div>
                   {entry.remarks && (
                     <div>
                        <Label className="text-[10px] uppercase font-bold text-slate-400">Remarks</Label>
                        <p className="text-xs text-slate-400 italic">"{entry.remarks}"</p>
                     </div>
                   )}
                </div>

                <div className="p-8 bg-indigo-50/50 rounded-[2.5rem] border-2 border-indigo-100 flex flex-col items-center justify-center text-center space-y-2">
                   <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Operating Fee</span>
                   <div className="text-3xl font-black font-data text-indigo-900">
                      ₱{entry.outOfPocketExpense?.toLocaleString()}
                   </div>
                   <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-tighter">Liaison Service Comp</span>
                </div>
             </div>
          </div>

          {/* Section 3: Financials */}
          <div className="space-y-6 pt-12 border-t border-slate-50">
             <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-widest text-navy-900 italic">Financial Auditing</span>
             </div>
             
             <div className="grid md:grid-cols-3 gap-6">
                <div className="p-8 bg-slate-50 rounded-[2.5rem] space-y-1">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Advance Released</div>
                   <div className="text-3xl font-black font-data text-navy-900">₱{entry.requestedCashAdvance?.toLocaleString()}</div>
                   {entry.cashAdvancePurpose && (
                      <p className="text-[10px] font-bold text-slate-400 italic mt-2 border-t border-slate-100 pt-2 line-clamp-2">
                         Purpose: {entry.cashAdvancePurpose}
                      </p>
                   )}
                </div>
                {entry.status === 'Submitted' || entry.status === 'Approved' || entry.status === 'Rejected' ? (
                  <>
                    <div className="p-8 bg-emerald-50 rounded-[2.5rem] space-y-1">
                       <div className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-2">Reimbursements</div>
                       <div className="text-3xl font-black font-data text-emerald-700">
                          ₱{entry.reimbursements?.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                       </div>
                    </div>
                    <div className="p-8 bg-amber-50 rounded-[2.5rem] space-y-1 border-2 border-white shadow-xl shadow-amber-500/5">
                       <div className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-2">Liquidated Value</div>
                       <div className="text-3xl font-black font-data text-amber-900 italic font-italic font-black">
                          ₱{entry.liquidationItems?.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                       </div>
                    </div>
                  </>
                ) : (
                  <div className="md:col-span-2 flex items-center justify-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                     <span className="text-xs font-black uppercase tracking-widest text-slate-300 italic">Waiting for Liquidation Data</span>
                  </div>
                )}
             </div>

             {/* Reimbursements Breakdown (New Section) */}
             {(entry.reimbursements && entry.reimbursements.length > 0) && (
               <div className="space-y-6 pt-12 border-t border-slate-50">
                  <div className="flex items-center gap-2">
                     <CreditCard className="h-4 w-4 text-emerald-500" />
                     <span className="text-xs font-black uppercase tracking-widest text-navy-900 italic">Reimbursement Claims</span>
                  </div>
                  <div className="space-y-4">
                     {entry.reimbursements.map((r) => (
                       <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white border border-slate-100 rounded-3xl group hover:border-emerald-600 transition-all">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors shrink-0">
                                <Sparkles className="h-5 w-5" />
                             </div>
                             <div>
                                <h5 className="font-bold text-navy-900">{r.purpose}</h5>
                                {r.remarks && <p className="text-xs text-slate-400">{r.remarks}</p>}
                             </div>
                          </div>
                          <div className="flex items-center gap-6 sm:justify-end self-end sm:self-auto w-full sm:w-auto">
                             <div className="text-right">
                                <div className="text-lg font-black font-data text-emerald-700">₱{r.amount.toLocaleString()}</div>
                             </div>
                             {(r.driveUrl || r.tempUrl) && (
                               <a 
                                 href={r.driveUrl || r.tempUrl} 
                                 target="_blank" 
                                 rel="noreferrer"
                                 className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                               >
                                  <ExternalLink className="h-4 w-4" />
                               </a>
                             )}
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
             )}
          </div>

          {/* Section 3: Detailed Expenses (only if submitted) */}
          {(entry.status === 'Submitted' || entry.status === 'Approved' || entry.status === 'Rejected') && (
            <div className="space-y-6 pt-12 border-t border-slate-50">
               <div className="flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-slate-300" />
                  <span className="text-xs font-black uppercase tracking-widest text-navy-900 italic">Expense Registry</span>
               </div>
               
               <div className="space-y-4">
                  {entry.liquidationItems?.map((item) => (
                    <div key={item.id} className="flex flex-col p-6 bg-white border border-slate-100 rounded-3xl group hover:border-navy-900 transition-all space-y-4">
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-navy-900 group-hover:text-white transition-colors shrink-0">
                                {item.requiresProofSlip ? <FileText className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                             </div>
                             <div>
                                <h5 className="font-bold text-navy-900 truncate max-w-[200px]">{item.supplierName}</h5>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.dateOfReceipt} • {item.taxType} • {item.account}</p>
                             </div>
                          </div>
                          <div className="flex items-center gap-6 sm:justify-end self-end sm:self-auto w-full sm:w-auto">
                             <div className="text-right">
                                <div className="text-lg font-black font-data text-navy-900">₱{item.amount.toLocaleString()}</div>
                                {item.requiresProofSlip && <Badge variant="outline" className="text-[8px] bg-amber-50 text-amber-600 border-amber-100">PROOF SLIP</Badge>}
                             </div>
                             {(item.receiptUrl || item.driveUrl || item.tempUrl) && (
                               <a 
                                 href={item.receiptUrl || item.driveUrl || item.tempUrl} 
                                 target="_blank" 
                                 rel="noreferrer"
                                 className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                               >
                                  <ExternalLink className="h-4 w-4" />
                               </a>
                             )}
                          </div>
                       </div>
                       
                       <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-5 border-t border-slate-50">
                          <div className="space-y-1">
                             <span className="block text-[8px] font-black uppercase tracking-tighter text-slate-300">Entity / Department</span>
                             <span className="text-[11px] font-bold text-navy-900 bg-slate-50 px-2 py-0.5 rounded-md inline-block">{item.entity} • {item.department}</span>
                          </div>
                          <div className="space-y-1">
                             <span className="block text-[8px] font-black uppercase tracking-tighter text-slate-300">TIN / Invoice #</span>
                             <div className="flex flex-col">
                               <span className="text-[11px] font-bold text-navy-900">{item.tinNo}</span>
                               <span className="text-[9px] font-black text-slate-400 font-data uppercase tracking-tighter leading-none">{item.invoiceNo || 'No Invoice'}</span>
                             </div>
                          </div>
                          <div className="space-y-1">
                             <span className="block text-[8px] font-black uppercase tracking-tighter text-slate-300">Client Association</span>
                             <span className="text-[11px] font-bold text-navy-700 block truncate max-w-[150px]" title={item.clientName || 'N/A'}>
                                {item.clientName || 'N/A'}
                             </span>
                          </div>
                          <div className="space-y-1">
                             <span className="block text-[8px] font-black uppercase tracking-tighter text-slate-300">Billability Status</span>
                             <Badge 
                               variant="outline" 
                               className={cn(
                                 "text-[9px] font-black px-2 py-0 border-none",
                                 item.billable === 'Yes' ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-400"
                               )}
                             >
                               {item.billable === 'Yes' ? 'BILLABLE' : 'NON-BILLABLE'}
                             </Badge>
                          </div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="p-10 pt-0 bg-slate-50/50 flex justify-between items-center text-xs font-black uppercase tracking-widest text-slate-400 border-t border-slate-50">
           <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Authenticated by STLAF Cloud
           </div>
           <div>Ref: {entry.id}</div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SummaryView;
