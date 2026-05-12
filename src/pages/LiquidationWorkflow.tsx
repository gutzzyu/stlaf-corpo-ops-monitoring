import React, { useState } from 'react';
import { db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  ArrowLeft, 
  Send, 
  Plus, 
  Trash2, 
  Upload, 
  Receipt, 
  CreditCard,
  FileText,
  BadgeCheck,
  ChevronRight,
  ChevronLeft,
  X,
  Camera,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../components/auth/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { OperationalEntry, ReimbursementEntry, LiquidationItem, ProofSlip } from '../types';

interface Props {
  entry: OperationalEntry;
  onBack: () => void;
  onSuccess: () => void;
}

const LiquidationWorkflow: React.FC<Props> = ({ entry, onBack, onSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: Reimbursements, 2: Liquidation, 3: Finalize
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field states
  const [hasReimbursements, setHasReimbursements] = useState(entry.hasReimbursements || false);
  const [reimbursements, setReimbursements] = useState<ReimbursementEntry[]>(entry.reimbursements || []);
  const [liquidationItems, setLiquidationItems] = useState<LiquidationItem[]>(entry.liquidationItems || [
    { id: Math.random().toString(36).substr(2, 9), description: '', amount: 0, date: new Date().toISOString().split('T')[0] }
  ]);
  const [proofSlips, setProofSlips] = useState<ProofSlip[]>(entry.proofSlips || []);

  const handleFileUpload = async (file: File, type: string, index: number) => {
    if (!user) return null;
    const toastId = toast.loading(`Uploading ${type}...`);
    
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      const nameParts = user.displayName?.split(' ') || ['User'];
      const lastName = nameParts[nameParts.length - 1].toLowerCase();
      const firstName = nameParts[0].toLowerCase();
      const ext = file.name.split('.').pop();
      const fileName = `${dateStr}_${firstName}_${lastName}_${type}_${index}.${ext}`;
      
      const storageRef = ref(storage, `receipts/${user.uid}/${entry.id}/${fileName}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      
      toast.success(`${type} uploaded`, { id: toastId });
      return { url, fileName };
    } catch (error) {
      toast.error(`Upload failed`, { id: toastId });
      console.error(error);
      return null;
    }
  };

  const addReimbursement = () => {
    setReimbursements([...reimbursements, { id: Math.random().toString(36).substr(2, 9), purpose: '', amount: 0 }]);
  };

  const removeReimbursement = (id: string) => {
    setReimbursements(reimbursements.filter(r => r.id !== id));
  };

  const addLiquidationItem = () => {
    setLiquidationItems([...liquidationItems, { id: Math.random().toString(36).substr(2, 9), description: '', amount: 0, date: new Date().toISOString().split('T')[0] }]);
  };

  const removeLiquidationItem = (id: string) => {
    setLiquidationItems(liquidationItems.filter(i => i.id !== id));
    // Also remove associated proof slips
    setProofSlips(proofSlips.filter(p => p.id !== id));
  };

  const toggleProofSlip = (itemId: string, checked: boolean) => {
    const updated = liquidationItems.map(item => item.id === itemId ? { ...item, requiresProofSlip: checked } : item);
    setLiquidationItems(updated);

    if (checked) {
      const item = updated.find(i => i.id === itemId);
      setProofSlips([...proofSlips, { id: itemId, description: item?.description || '', amount: item?.amount || 0, explanation: '' }]);
    } else {
      setProofSlips(proofSlips.filter(p => p.id !== itemId));
    }
  };

  const handleFinalSubmit = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, 'operational_entries', entry.id!), {
        hasReimbursements,
        reimbursements,
        liquidationItems,
        proofSlips,
        status: 'Submitted',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      toast.success("Operational entry submitted for audit!");
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `operational_entries/${entry.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 h-full">
      <div className="flex items-center justify-between mb-8 px-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-slate-400 hover:text-navy-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Abort Liquidation
        </Button>
        <div className="flex items-center gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-1.5 w-12 rounded-full transition-all ${step >= i ? 'bg-navy-900' : 'bg-slate-100'}`} />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="border-none shadow-2xl shadow-navy-900/5 rounded-[3rem] overflow-hidden bg-white">
              <div className="h-2 bg-emerald-500 w-full" />
              <CardHeader className="p-10">
                <CardTitle className="text-4xl font-black text-navy-900 tracking-tighter italic">Reimbursements.</CardTitle>
                <CardDescription className="text-slate-500 font-medium max-w-sm">
                  Did you spend personal funds that need company reimbursement?
                </CardDescription>
              </CardHeader>
              <CardContent className="px-10 pb-10 space-y-8">
                 <div className="flex items-center space-x-3 p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 transition-all hover:border-emerald-200">
                    <Checkbox 
                      id="hasReimbursements" 
                      className="h-6 w-6 rounded-lg border-2 border-slate-300" 
                      checked={hasReimbursements}
                      onCheckedChange={(val) => setHasReimbursements(!!val)}
                    />
                    <Label htmlFor="hasReimbursements" className="text-lg font-bold text-navy-900 cursor-pointer">
                      Yes, I have personal expenses to reimburse.
                    </Label>
                 </div>

                 {hasReimbursements && (
                   <div className="space-y-6">
                      <AnimatePresence>
                        {reimbursements.map((r, idx) => (
                          <motion.div 
                            key={r.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="p-6 bg-white border border-slate-100 rounded-3xl space-y-4 shadow-sm relative group"
                          >
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => removeReimbursement(r.id)}
                              className="absolute top-4 right-4 h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <div className="grid gap-4 md:grid-cols-2">
                               <div className="space-y-2">
                                  <Label className="micro-label">Purpose</Label>
                                  <Input 
                                    value={r.purpose}
                                    onChange={(e) => {
                                      const updated = reimbursements.map(item => item.id === r.id ? { ...item, purpose: e.target.value } : item);
                                      setReimbursements(updated);
                                    }}
                                    placeholder="e.g., Extended Client Meeting Lunch"
                                    className="h-12 rounded-xl bg-slate-50 border-none font-bold"
                                  />
                               </div>
                               <div className="space-y-2">
                                  <Label className="micro-label font-bold text-emerald-600 italic">Amount (PHP)</Label>
                                  <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-600">₱</span>
                                    <Input 
                                      type="number"
                                      value={r.amount}
                                      onChange={(e) => {
                                        const updated = reimbursements.map(item => item.id === r.id ? { ...item, amount: Number(e.target.value) } : item);
                                        setReimbursements(updated);
                                      }}
                                      className="h-12 pl-10 rounded-xl bg-emerald-50/50 border-none text-xl font-black font-data text-emerald-900"
                                    />
                                  </div>
                               </div>
                            </div>
                            <div className="grid gap-4 md:grid-cols-2 items-end">
                               <div className="space-y-2">
                                  <Label className="micro-label">Remarks</Label>
                                  <Input 
                                    value={r.remarks}
                                    onChange={(e) => {
                                      const updated = reimbursements.map(item => item.id === r.id ? { ...item, remarks: e.target.value } : item);
                                      setReimbursements(updated);
                                    }}
                                    placeholder="Context for reimbursement..."
                                    className="h-12 rounded-xl bg-slate-50 border-none font-medium"
                                  />
                               </div>
                               <div className="space-y-2">
                                  <Label className="micro-label">Attachment</Label>
                                  {r.attachmentUrl ? (
                                    <div className="h-12 flex items-center justify-between px-4 bg-emerald-50 rounded-xl border-2 border-emerald-100">
                                       <span className="text-[10px] font-bold text-emerald-700 truncate max-w-[150px]">{r.fileName}</span>
                                       <BadgeCheck className="h-4 w-4 text-emerald-500" />
                                    </div>
                                  ) : (
                                    <div className="relative h-12">
                                      <input 
                                        type="file" 
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const res = await handleFileUpload(file, 'reimbursement', idx);
                                            if (res) {
                                              const updated = reimbursements.map(item => item.id === r.id ? { ...item, attachmentUrl: res.url, fileName: res.fileName } : item);
                                              setReimbursements(updated);
                                            }
                                          }
                                        }}
                                      />
                                      <div className="h-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-xs hover:border-navy-900 hover:text-navy-900 transition-all">
                                        <Upload className="h-4 w-4" />
                                        Upload Receipt
                                      </div>
                                    </div>
                                  )}
                               </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={addReimbursement}
                        className="w-full h-14 rounded-2xl border-2 border-dashed border-slate-100 font-black uppercase text-xs tracking-widest gap-2 hover:bg-slate-50"
                      >
                        <Plus className="h-4 w-4" /> Add Reimbursement Entry
                      </Button>
                   </div>
                 )}
              </CardContent>
              <CardFooter className="px-10 pb-10">
                 <Button 
                   onClick={() => setStep(2)}
                   className="ml-auto h-16 px-10 rounded-2xl bg-navy-900 hover:bg-navy-800 font-black uppercase text-xs tracking-widest gap-2 group transition-all"
                 >
                   Continue to Liquidation
                   <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                 </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <Card className="border-none shadow-2xl shadow-navy-900/5 rounded-[3rem] overflow-hidden bg-white">
              <div className="h-2 bg-amber-500 w-full" />
              <CardHeader className="p-10">
                <CardTitle className="text-4xl font-black text-navy-900 tracking-tighter italic">PCF Liquidation.</CardTitle>
                <CardDescription className="text-slate-500 font-medium max-w-sm">
                  Break down all petty cash expenses. Upload receipts for every transaction.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-10 pb-10 space-y-6">
                 <AnimatePresence>
                    {liquidationItems.map((item, idx) => (
                      <motion.div 
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="p-8 bg-slate-50/50 rounded-[2.5rem] border border-slate-100 space-y-6 relative group"
                      >
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeLiquidationItem(item.id)}
                          className="absolute top-6 right-6 h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                        
                        <div className="grid gap-6 md:grid-cols-3">
                           <div className="space-y-2 md:col-span-1">
                              <Label className="micro-label">Expense Date</Label>
                              <Input 
                                type="date"
                                value={item.date}
                                onChange={(e) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, date: e.target.value } : li);
                                  setLiquidationItems(updated);
                                }}
                                className="h-12 rounded-xl bg-white border-none font-bold font-data"
                              />
                           </div>
                           <div className="space-y-2 md:col-span-2">
                              <Label className="micro-label">Description / Particulars</Label>
                              <Input 
                                value={item.description}
                                onChange={(e) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, description: e.target.value } : li);
                                  setLiquidationItems(updated);
                                }}
                                placeholder="e.g., Gas Refill - Shell SLEX"
                                className="h-12 rounded-xl bg-white border-none font-bold"
                              />
                           </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2 items-end">
                           <div className="space-y-2">
                              <Label className="micro-label font-bold text-amber-600 italic">Expense Amount (PHP)</Label>
                              <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-amber-600">₱</span>
                                <Input 
                                  type="number"
                                  value={item.amount}
                                  onChange={(e) => {
                                    const updated = liquidationItems.map(li => li.id === item.id ? { ...li, amount: Number(e.target.value) } : li);
                                    setLiquidationItems(updated);
                                  }}
                                  className="h-14 pl-10 rounded-xl bg-white border-none text-2xl font-black font-data text-navy-900"
                                />
                              </div>
                           </div>
                           <div className="space-y-2">
                              <Label className="micro-label">Receipt Proof</Label>
                              {!item.requiresProofSlip ? (
                                item.receiptUrl ? (
                                  <div className="h-14 flex items-center justify-between px-4 bg-emerald-50 rounded-xl border-2 border-emerald-100">
                                     <div className="flex items-center gap-2">
                                        <Camera className="h-4 w-4 text-emerald-500" />
                                        <span className="text-[10px] font-bold text-emerald-700 truncate max-w-[200px]">{item.fileName}</span>
                                     </div>
                                     <Button 
                                       size="sm" 
                                       variant="ghost" 
                                       onClick={() => {
                                         const updated = liquidationItems.map(li => li.id === item.id ? { ...li, receiptUrl: '', fileName: '' } : li);
                                         setLiquidationItems(updated);
                                       }}
                                       className="h-8 w-8 text-emerald-400"
                                     >
                                        <X className="h-4 w-4" />
                                     </Button>
                                  </div>
                                ) : (
                                  <div className="relative h-14">
                                    <input 
                                      type="file" 
                                      accept="image/*"
                                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const res = await handleFileUpload(file, 'receipt', idx);
                                          if (res) {
                                            const updated = liquidationItems.map(li => li.id === item.id ? { ...li, receiptUrl: res.url, fileName: res.fileName } : li);
                                            setLiquidationItems(updated);
                                          }
                                        }
                                      }}
                                    />
                                    <div className="h-full flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-xs hover:border-navy-900 hover:text-navy-900 transition-all bg-white">
                                      <Camera className="h-5 w-5" />
                                      Snap Receipt
                                    </div>
                                  </div>
                                )
                              ) : (
                                <div className="h-14 flex items-center gap-2 px-4 bg-amber-50 rounded-xl border-2 border-amber-100 text-amber-700 font-bold text-[10px] uppercase tracking-wider">
                                   <FileText className="h-4 w-4" />
                                   Proof Slip Mode Active
                                </div>
                              )}
                           </div>
                        </div>

                        <div className="flex items-center space-x-3 p-4 bg-white/50 rounded-2xl border border-slate-100">
                           <Checkbox 
                             id={`proof-${item.id}`} 
                             className="h-5 w-5 rounded-md border-2 border-slate-200"
                             onCheckedChange={(val) => toggleProofSlip(item.id, !!val)}
                             checked={item.requiresProofSlip}
                           />
                           <Label htmlFor={`proof-${item.id}`} className="text-xs font-bold text-slate-500 cursor-pointer flex items-center gap-2">
                             I don't have an official receipt for this expense (Requires Proof Slip)
                             <AlertCircle className="h-3 w-3" />
                           </Label>
                        </div>

                        {item.requiresProofSlip && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="space-y-4 pt-4 border-t border-slate-100"
                          >
                             <div className="space-y-2">
                                <Label className="micro-label text-amber-600">Proof Slip Explanation</Label>
                                <Textarea 
                                  value={proofSlips.find(p => p.id === item.id)?.explanation || ''}
                                  onChange={(e) => {
                                    const updated = proofSlips.map(p => p.id === item.id ? { ...p, explanation: e.target.value } : p);
                                    setProofSlips(updated);
                                  }}
                                  placeholder="Provide a detailed explanation why no official receipt is available (e.g., Tricycle fare, street parking)..."
                                  className="min-h-[80px] rounded-xl bg-white border-none font-medium text-sm italic"
                                />
                             </div>
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                 </AnimatePresence>

                 <Button 
                    type="button" 
                    variant="outline" 
                    onClick={addLiquidationItem}
                    className="w-full h-16 rounded-3xl border-2 border-dashed border-slate-100 font-black uppercase text-xs tracking-widest gap-2 hover:bg-slate-50"
                  >
                    <Plus className="h-4 w-4" /> Add Expense Item
                  </Button>
              </CardContent>
              <CardFooter className="px-10 pb-10 flex justify-between">
                 <Button 
                   variant="ghost" 
                   onClick={() => setStep(1)}
                   className="h-16 px-8 rounded-2xl font-black uppercase text-xs tracking-widest gap-2 group transition-all"
                 >
                   <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                   Reimbursements
                 </Button>
                 <Button 
                   onClick={() => setStep(3)}
                   className="h-16 px-10 rounded-2xl bg-navy-900 hover:bg-navy-800 font-black uppercase text-xs tracking-widest gap-2 group transition-all"
                 >
                   Review & Finalize
                   <ChevronRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                 </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            <Card className="border-none shadow-2xl shadow-navy-900/5 rounded-[3rem] overflow-hidden bg-white">
              <div className="h-2 bg-navy-900 w-full" />
              <CardHeader className="p-10 text-center">
                 <div className="mx-auto w-20 h-20 bg-navy-900 rounded-[2rem] flex items-center justify-center text-white mb-6">
                    <BadgeCheck className="h-10 w-10" />
                 </div>
                <CardTitle className="text-5xl font-black text-navy-900 tracking-tighter italic leading-none">Ready for <br />Submission.</CardTitle>
                <CardDescription className="text-slate-500 font-medium max-w-sm mx-auto mt-4">
                  Please review the operational statistics below before finalizing the registry entry.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-10 pb-10">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-50 rounded-3xl space-y-1">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Operational Budget</span>
                       <div className="text-2xl font-black font-data text-navy-900">₱{entry.requestedCashAdvance?.toLocaleString()}</div>
                    </div>
                    <div className="p-6 bg-emerald-50 rounded-3xl space-y-1">
                       <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Expected Reimbursement</span>
                       <div className="text-2xl font-black font-data text-emerald-700">
                          ₱{reimbursements.reduce((sum, r) => sum + r.amount, 0).toLocaleString()}
                       </div>
                    </div>
                    <div className="p-6 bg-amber-50 rounded-3xl space-y-1">
                       <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">Total Liquidated Expenses</span>
                       <div className="text-2xl font-black font-data text-amber-700">
                          ₱{liquidationItems.reduce((sum, i) => sum + i.amount, 0).toLocaleString()}
                       </div>
                    </div>
                 </div>

                 <div className="mt-8 p-6 bg-navy-900 rounded-[2.5rem] text-white">
                    <div className="flex items-center justify-between mb-6">
                       <div className="space-y-1">
                          <h4 className="text-xl font-bold italic">Audit Summary</h4>
                          <p className="text-navy-300 text-xs font-medium">Transaction integrity report</p>
                       </div>
                       <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                          <FileCheck className="h-6 w-6" />
                       </div>
                    </div>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-sm">
                          <span className="opacity-60 font-medium">Liaison Itinerary</span>
                          <span className="font-bold">Verified</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="opacity-60 font-medium">Reimbursement Count</span>
                          <span className="font-bold">{reimbursements.length} entries</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="opacity-60 font-medium">Liquidation Lines</span>
                          <span className="font-bold">{liquidationItems.length} items</span>
                       </div>
                       <div className="flex justify-between items-center text-sm">
                          <span className="opacity-60 font-medium">Proof Slips Req.</span>
                          <span className="font-bold text-amber-400">{proofSlips.length} slips</span>
                       </div>
                    </div>
                 </div>
              </CardContent>
              <CardFooter className="px-10 pb-10 flex justify-between gap-4">
                 <Button 
                   variant="ghost" 
                   onClick={() => setStep(2)}
                   className="h-16 px-8 rounded-2xl font-black uppercase text-xs tracking-widest gap-2 group transition-all"
                 >
                   <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
                   Review Liquidation
                 </Button>
                 <Button 
                   onClick={handleFinalSubmit}
                   disabled={isSubmitting}
                   className="flex-1 h-16 rounded-2xl bg-navy-900 hover:bg-navy-800 font-black uppercase text-xs tracking-widest gap-3 shadow-xl shadow-navy-900/20"
                 >
                   {isSubmitting ? "Syncing Registry..." : (
                     <>
                        Complete Submission
                        <Send className="h-5 w-5" />
                     </>
                   )}
                 </Button>
              </CardFooter>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FileCheck = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/>
  </svg>
);

export default LiquidationWorkflow;
