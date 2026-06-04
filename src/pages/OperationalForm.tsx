import React, { useState, useEffect, useMemo } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, handleFirestoreError, OperationType, getErrorMessage } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, setDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  ArrowLeft, 
  Send, 
  Save, 
  MapPin, 
  CreditCard, 
  Truck, 
  LayoutList,
  Sparkles,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../components/auth/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { OperationalEntry, EntryStatus } from '../types';
import { CLIENT_MASTERLIST } from '../lib/constants';

const formSchema = z.object({
  employeeName: z.string().min(2, "Name is required"),
  department: z.string().min(1, "Department is required"),
  contactNumber: z.string().min(7, "Contact number is required"),
  destination: z.string().min(2, "Destination is required"),
  purpose: z.string().min(5, "Purpose is required"),
  scheduleDate: z.string().min(1, "Schedule date is required"),
  accountName: z.string().min(2, "Account name is required"),
  companyName: z.string().optional(),
  contactPerson: z.string().optional(),
  destinationType: z.enum(['Within Metro Manila', 'Outside Metro Manila']),
  outOfPocketExpense: z.number(),
  requestedCashAdvance: z.coerce.number().min(0, "Amount cannot be negative"),
  cashAdvancePurpose: z.string().optional(),
  remarks: z.string().optional(),
});

interface Props {
  entry?: OperationalEntry; // For editing drafts
  onBack: () => void;
  onSuccess: () => void;
}

const OperationalForm: React.FC<Props> = ({ entry, onBack, onSuccess }) => {
  const { user, userData } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCustomAmount, setIsCustomAmount] = useState(() => {
    if (!entry) return false;
    const expense = entry.outOfPocketExpense;
    if (expense === 1000 || expense === 1500) return false;
    return true;
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      employeeName: entry?.employeeName || userData?.displayName || user?.displayName || '',
      department: entry?.department || userData?.department || '',
      contactNumber: entry?.contactNumber || '',
      destination: entry?.destination || '',
      purpose: entry?.purpose || '',
      scheduleDate: entry?.scheduleDate || new Date().toISOString().split('T')[0],
      accountName: entry?.accountName || '',
      companyName: entry?.companyName || '',
      contactPerson: entry?.contactPerson || '',
      destinationType: entry?.destinationType || 'Within Metro Manila',
      outOfPocketExpense: entry?.outOfPocketExpense || 1000,
      requestedCashAdvance: entry?.requestedCashAdvance || 0,
      cashAdvancePurpose: entry?.cashAdvancePurpose || '',
      remarks: entry?.remarks || '',
    }
  });

  const watchedDepartment = watch('department');

  const DEPARTMENTS = [
    'Accounting',
    'Corporate',
    'HR & Admin',
    'Litigation',
    'Marketing & IT',
    'Operations',
    'Finance',
    'Supply Chain'
  ];

  const watchedDestinationType = watch('destinationType');

  const [dbClients, setDbClients] = useState<string[]>([]);

  useEffect(() => {
    const qClients = query(collection(db, "clients"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(qClients, (snapshot) => {
      const records = snapshot.docs.map(doc => doc.data().name as string);
      setDbClients(records);
    }, (err) => {
      console.warn("Clients fetch warning in form:", err);
    });
    return () => unsubscribe();
  }, []);

  const combinedClientOptions = useMemo(() => {
    const set = new Set([...CLIENT_MASTERLIST, ...dbClients]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dbClients]);

  useEffect(() => {
    if (!isCustomAmount) {
      if (watchedDestinationType === 'Within Metro Manila') {
        setValue('outOfPocketExpense', 1000);
      } else {
        setValue('outOfPocketExpense', 1500);
      }
    }
  }, [watchedDestinationType, setValue, isCustomAmount]);

  const saveEntry = async (values: z.infer<typeof formSchema>, status: EntryStatus) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (entry?.id) {
        // Update existing draft or revision
        const finalStatus = (entry.status === 'Needs Revision') ? 'Needs Revision' : status;
        await updateDoc(doc(db, 'operational_entries', entry.id), {
          ...values,
          status: finalStatus,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new entry
        const name = values.employeeName || user.displayName || 'User';
        const initials = name.split(' ').filter(n => n.length > 0).map(n => n[0].toUpperCase()).slice(0, 2).join('') || 'XX';
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const customId = `${initials}-${yyyy}${mm}${dd}-${randomStr}`;

        await setDoc(doc(db, 'operational_entries', customId), {
          ...values,
          userId: user.uid,
          status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      
      toast.success(status === 'Draft' ? "Draft saved successfully" : "Mission initialized!");
      onSuccess();
    } catch (error) {
      toast.error(`Failed to save: ${getErrorMessage(error)}`);
      handleFirestoreError(error, OperationType.WRITE, 'operational_entries');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderFieldError = (fieldName: keyof z.infer<typeof formSchema>, tip?: string) => {
    const error = errors[fieldName];
    if (!error) return null;
    return (
      <p role="alert" className="text-red-500 font-bold text-xs mt-1.5 flex items-start gap-1 py-1.5 px-3 bg-red-50/80 border border-red-100 rounded-xl animate-fadeIn shadow-sm">
        <span className="shrink-0 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black mt-0.5">!</span>
        <span className="flex flex-col">
          <span>{error.message}</span>
          {tip && <span className="text-[10px] font-medium text-red-400 mt-0.5">{tip}</span>}
        </span>
      </p>
    );
  };

  const onSubmit: SubmitHandler<z.infer<typeof formSchema>> = (values) => saveEntry(values, 'For Liquidation');

  return (
    <div className="max-w-4xl mx-auto py-2 sm:py-4 px-2 sm:px-4">
      <div className="flex items-center justify-between mb-6 px-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-slate-400 hover:text-navy-900 transition-colors px-2 sm:px-3">
          <ArrowLeft className="h-4 w-4" />
          <span className="text-xs sm:text-sm">Back to Dashboard</span>
        </Button>
        <div className="flex items-center gap-1.5">
           <div className="w-7 h-7 rounded-lg bg-navy-900 flex items-center justify-center text-white">
              <FileText className="h-3.5 w-3.5" />
           </div>
           <span className="text-[9px] font-black uppercase tracking-widest text-navy-900 opacity-30">Form 01+1.2 Alpha</span>
        </div>
      </div>

      {entry?.status === 'Needs Revision' && entry.adminNotes && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-6 bg-amber-50 rounded-3xl border-2 border-amber-100 flex gap-4 text-left"
        >
          <div className="shrink-0 mt-0.5 bg-amber-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-black">
             !
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Revision Instructions from Admin</span>
            <p className="text-sm font-bold text-amber-900 leading-relaxed">
              {entry.adminNotes}
            </p>
          </div>
        </motion.div>
      )}

      <Card className="border-none shadow-2xl shadow-navy-900/5 rounded-[2rem] sm:rounded-[3rem] overflow-hidden bg-white">
        <div className="h-2 bg-gold-500 w-full" />
        <CardHeader className="p-5 sm:p-10 pb-4 sm:pb-6 text-left">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1 sm:space-y-2">
              <CardTitle className="text-2xl sm:text-4xl md:text-5xl font-black text-navy-900 tracking-tighter leading-none italic">
                Operational <br className="hidden sm:inline" />
                <span className="text-gold-500">Itinerary.</span>
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium text-xs sm:text-sm max-w-sm">
                Consolidated mission request system. Please fill in all operational parameters before deployment.
              </CardDescription>
            </div>
            <div className="hidden md:block">
               <Sparkles className="h-12 w-12 text-slate-100" />
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="p-5 sm:p-10 pt-2 sm:pt-4 space-y-8 sm:space-y-12">
            {/* SECTION 1 — Liaison Information */}
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                <LayoutList className="h-4 w-4 text-slate-300" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">SECTION 1 — Liaison Information</span>
              </div>
              <div className="grid gap-4 sm:grid-gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="micro-label">Employee Name</Label>
                  <Input 
                    {...register('employeeName')} 
                    placeholder="Full Name"
                    readOnly={!!userData?.displayName}
                    className={`h-12 rounded-xl bg-slate-50 border-2 font-bold text-navy-900 transition-all ${
                      errors.employeeName 
                        ? 'border-red-500 bg-red-50/20 focus-visible:ring-red-500' 
                        : 'border-transparent focus-visible:ring-navy-900 hover:bg-slate-100/50'
                    } ${userData?.displayName ? 'opacity-60 cursor-not-allowed' : ''}`}
                  />
                  {renderFieldError('employeeName', 'Enter your full legal name as it appears in payroll/HR.')}
                </div>
                <div className="space-y-2">
                  <Label className="micro-label">Department</Label>
                  <Select onValueChange={(val) => setValue('department', val)} value={watchedDepartment || entry?.department || userData?.department}>
                    <SelectTrigger className={`h-12 rounded-xl bg-slate-50 border-2 font-bold text-navy-900 transition-all ${
                      errors.department 
                        ? 'border-red-500 bg-red-50/20 focus:ring-red-500 focus-visible:ring-red-500' 
                        : 'border-transparent focus-visible:ring-navy-900 hover:bg-slate-100/50'
                    } ${userData?.department ? 'opacity-60 pointer-events-none' : ''}`}>
                      <SelectValue placeholder="Select Division" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(dept => (
                        <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {renderFieldError('department', 'Select the department or division funding this operational deployment.')}
                </div>
                <div className="space-y-2">
                  <Label className="micro-label">Contact Number</Label>
                  <Input 
                    {...register('contactNumber')} 
                    placeholder="09XX XXX XXXX"
                    className={`h-12 rounded-xl bg-slate-50 border-2 font-bold text-navy-900 transition-all ${
                      errors.contactNumber 
                        ? 'border-red-500 bg-red-50/20 focus-visible:ring-red-500' 
                        : 'border-transparent focus-visible:ring-navy-900 hover:bg-slate-100/50'
                    }`}
                  />
                  {renderFieldError('contactNumber', 'Provide a valid active 11-digit mobile number so team leaders can stay in contact.')}
                </div>
                <div className="space-y-2">
                  <Label className="micro-label">Schedule / Date of Activity</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      type="date"
                      {...register('scheduleDate')} 
                      className={`h-12 pl-10 rounded-xl bg-slate-50 border-2 font-data font-bold text-navy-900 transition-all ${
                        errors.scheduleDate 
                          ? 'border-red-500 bg-red-50/20 focus-visible:ring-red-500' 
                          : 'border-transparent focus-visible:ring-navy-900 hover:bg-slate-100/50'
                      }`}
                    />
                  </div>
                  {renderFieldError('scheduleDate', 'Specify the target date of dispatch.')}
                </div>
              </div>
              
              <div className="grid gap-4 sm:grid-gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="micro-label">Primary Destination</Label>
                  <Input 
                    {...register('destination')} 
                    placeholder="Location / Site Name"
                    className={`h-12 rounded-xl bg-slate-50 border-2 font-bold text-navy-900 transition-all ${
                      errors.destination 
                        ? 'border-red-500 bg-red-50/20 focus-visible:ring-red-500' 
                        : 'border-transparent focus-visible:ring-navy-900 hover:bg-slate-100/50'
                    }`}
                  />
                  {renderFieldError('destination', 'State the specific site, client office, or municipal jurisdiction.')}
                </div>
                <div className="space-y-1.5 flex flex-col justify-end text-left md:text-right">
                   <span className="text-[9px] sm:text-[10px] font-black text-slate-300 uppercase tracking-widest mb-0.5 sm:mb-1">Filing Date</span>
                   <span className="text-sm font-black text-navy-900">{new Date().toLocaleDateString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="micro-label">Purpose of Travel / Mission Objectives</Label>
                <Textarea 
                  {...register('purpose')} 
                  placeholder="Detail the operational reasons for this deployment..."
                  className={`min-h-[100px] rounded-2xl bg-slate-50 border-2 font-medium leading-relaxed transition-all ${
                    errors.purpose 
                      ? 'border-red-500 bg-red-50/20 focus-visible:ring-red-500' 
                      : 'border-transparent focus-visible:ring-navy-900 hover:bg-slate-100/50'
                  }`}
                />
                {renderFieldError('purpose', 'State the concrete work objectives or project activities planned (minimum 5 characters).')}
              </div>

              <div className="space-y-2">
                <Label className="micro-label">Additional Remarks (Optional)</Label>
                <Input 
                  {...register('remarks')} 
                  placeholder="Any extra context for this liaison itinerary..."
                  className="h-12 rounded-xl bg-slate-50 border-2 border-transparent font-medium hover:bg-slate-100/50 transition-all focus-visible:ring-navy-900"
                />
              </div>
            </div>

            {/* SECTION 2 — Account Information */}
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                <Sparkles className="h-4 w-4 text-slate-300" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">SECTION 2 — Account Information</span>
              </div>
              <div className="space-y-2">
                <Label className="micro-label">Account Name / Client Name</Label>
                <Input 
                  {...register('accountName')} 
                  list="section2-client-names"
                  placeholder="Identify the billing account"
                  className={`h-12 rounded-xl bg-slate-50 border-2 font-bold text-navy-900 transition-all ${
                    errors.accountName 
                      ? 'border-red-500 bg-red-50/20 focus-visible:ring-red-500' 
                      : 'border-transparent focus-visible:ring-navy-900 hover:bg-slate-100/50'
                  }`}
                />
                <datalist id="section2-client-names">
                  {combinedClientOptions.map((client) => (
                    <option key={client} value={client} />
                  ))}
                </datalist>
                {renderFieldError('accountName', 'Select a client masterlist option or input the corporate billable account.')}
              </div>
            </div>

            {/* SECTION 3 — Out-of-Pocket Expense */}
            <div className="space-y-4 sm:space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                <MapPin className="h-4 w-4 text-slate-300" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">SECTION 3 — Out-of-Pocket Expense</span>
              </div>
              <div className="grid gap-6 sm:grid-gap-8 md:grid-cols-2 items-center">
                <div className="space-y-3 sm:space-y-4">
                  <Label className="micro-label">Destination Type</Label>
                  <div className="flex flex-col gap-3">
                    {[
                      { id: 'Manila', label: 'Within Metro Manila', val: 'Within Metro Manila' as const },
                      { id: 'Provincial', label: 'Outside Metro Manila', val: 'Outside Metro Manila' as const }
                    ].map((opt) => (
                      <label 
                        key={opt.id} 
                        className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border-2 ${
                          watchedDestinationType === opt.val 
                            ? 'bg-navy-900 border-navy-900 text-white' 
                            : 'bg-slate-50 border-transparent text-navy-900 hover:bg-slate-100'
                        }`}
                      >
                         <div className="flex items-center gap-3">
                            <input 
                              type="radio" 
                              className="hidden"
                              value={opt.val}
                              {...register('destinationType')}
                            />
                            <span className="font-black uppercase text-[10px] tracking-widest">{opt.label}</span>
                         </div>
                         {watchedDestinationType === opt.val && <div className="w-2 h-2 rounded-full bg-white shadow-lg" />}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="p-6 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] bg-indigo-50/50 border-2 border-indigo-100 flex flex-col items-center justify-center text-center space-y-3">
                   <span className="text-[9px] sm:text-[10px] font-black text-indigo-400 uppercase tracking-widest">Computed Operating Fee</span>
                   {!isCustomAmount ? (
                     <div className="text-3xl sm:text-4xl font-black font-data text-indigo-900">
                        ₱{watch('outOfPocketExpense')?.toLocaleString()}
                     </div>
                   ) : (
                     <div className="relative w-full max-w-[200px]">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-indigo-900 text-lg">₱</span>
                       <Input
                         type="number"
                         {...register('outOfPocketExpense', { valueAsNumber: true })}
                         className="h-12 pl-8 pr-3 text-center rounded-xl bg-white border border-indigo-200 text-xl font-bold font-data text-indigo-900 shadow-sm focus:border-indigo-400"
                         placeholder="Custom Amount"
                       />
                     </div>
                   )}
                   <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-tighter">
                     {isCustomAmount ? "Custom Operating Fee Override" : "Automatic Service Compensation"}
                   </span>
                   
                   <button
                     type="button"
                     onClick={() => {
                       const nextCustom = !isCustomAmount;
                       setIsCustomAmount(nextCustom);
                       if (!nextCustom) {
                         // Reset back to computed default
                         if (watchedDestinationType === 'Within Metro Manila') {
                           setValue('outOfPocketExpense', 1000);
                         } else {
                           setValue('outOfPocketExpense', 1500);
                         }
                       }
                     }}
                     className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 underline decoration-indigo-200 cursor-pointer pt-1 transition-colors"
                   >
                     {isCustomAmount ? "Use automatic standard amount" : "Set Custom / Optional Amount"}
                   </button>
                </div>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6 pt-6 border-t-2 border-slate-50">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                <CreditCard className="h-4 w-4 text-slate-300" />
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400">Mission Budget Request</span>
              </div>
              <div className="space-y-4">
                <Label className="micro-label font-bold text-emerald-700 italic">Requested Cash Advance (PHP)</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-600">₱</span>
                  <Input 
                    type="number"
                    step="0.01"
                    {...register('requestedCashAdvance')} 
                    className={`h-16 pl-10 rounded-2xl border-2 text-2xl sm:text-3xl font-black font-data text-emerald-900 transition-all ${
                      errors.requestedCashAdvance 
                        ? 'border-red-500 bg-red-50/20 focus-visible:ring-red-500' 
                        : 'border-transparent bg-emerald-50/50 focus-visible:ring-emerald-550'
                    }`}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 micro-label opacity-20 hidden sm:block">Operational Funds</div>
                </div>
                {renderFieldError('requestedCashAdvance', 'State the cash advance requested for logistics, or enter 0 if none is required.')}

                <div className="space-y-2 mt-4">
                   <Label className="micro-label">Purpose of Cash Advance</Label>
                   <Input 
                      {...register('cashAdvancePurpose')} 
                      placeholder="What is this cash for? (e.g. Toll, Fuel, Parking, Misc)"
                      className="h-12 rounded-xl bg-emerald-50/30 border-2 border-transparent hover:bg-slate-100/20 transition-all font-bold text-navy-900 text-sm sm:text-base placeholder:italic focus-visible:ring-emerald-550"
                   />
                </div>
              </div>
            </div>

          </CardContent>

          <CardFooter className="p-5 sm:p-10 pt-0 flex flex-col">
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="w-full h-auto py-4 sm:py-5 min-h-[4rem] px-4 rounded-2xl bg-navy-900 hover:bg-navy-800 font-black uppercase tracking-widest gap-1.5 sm:gap-2 group flex-col text-center"
            >
              {isSubmitting ? "Finalizing Entry..." : (
                <>
                  <span className="text-[10px] sm:text-xs">Initialize Mission</span>
                  <div className="flex items-center gap-1 text-white/50 text-[8px] sm:text-[9px]">
                     &amp;
                  </div>
                  <span className="text-[10px] sm:text-xs flex items-center gap-1.5 sm:gap-2">
                     Mark for Liquidation
                     <Send className="h-3.5 w-3.5 shrink-0 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </span>
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <div className="mt-8 flex justify-center items-center gap-3 opacity-20 hover:opacity-100 transition-opacity">
         <div className="h-[1px] w-8 sm:w-12 bg-navy-900" />
         <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] text-navy-900">STLAF Encrypted Transmission</span>
         <div className="h-[1px] w-8 sm:w-12 bg-navy-900" />
      </div>
    </div>
  );
};

export default OperationalForm;
