import React, { useState, useEffect } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
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

const formSchema = z.object({
  employeeName: z.string().min(2, "Name is required"),
  department: z.string().min(1, "Department is required"),
  destination: z.string().min(2, "Destination is required"),
  purpose: z.string().min(5, "Purpose is required"),
  scheduleDate: z.string().min(1, "Schedule date is required"),
  requestedCashAdvance: z.coerce.number().min(0, "Amount cannot be negative"),
  transportationDetails: z.string().min(2, "Transportation details required"),
  operationalEstimates: z.string().min(2, "Estimates are required"),
  remarks: z.string().optional(),
});

interface Props {
  entry?: OperationalEntry; // For editing drafts
  onBack: () => void;
  onSuccess: () => void;
}

const OperationalForm: React.FC<Props> = ({ entry, onBack, onSuccess }) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      employeeName: entry?.employeeName || user?.displayName || '',
      department: entry?.department || '',
      destination: entry?.destination || '',
      purpose: entry?.purpose || '',
      scheduleDate: entry?.scheduleDate || new Date().toISOString().split('T')[0],
      requestedCashAdvance: entry?.requestedCashAdvance || 0,
      transportationDetails: entry?.transportationDetails || '',
      operationalEstimates: entry?.operationalEstimates || '',
      remarks: entry?.remarks || '',
    }
  });

  const saveEntry = async (values: z.infer<typeof formSchema>, status: EntryStatus) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (entry?.id) {
        // Update existing draft
        await updateDoc(doc(db, 'operational_entries', entry.id), {
          ...values,
          status,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Create new entry
        await addDoc(collection(db, 'operational_entries'), {
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
      handleFirestoreError(error, OperationType.WRITE, 'operational_entries');
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSubmit: SubmitHandler<z.infer<typeof formSchema>> = (values) => saveEntry(values, 'Ongoing');
  const handleSaveDraft = handleSubmit((values) => saveEntry(values, 'Draft'));

  return (
    <div className="max-w-4xl mx-auto py-4">
      <div className="flex items-center justify-between mb-8 px-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-slate-400 hover:text-navy-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-navy-900 flex items-center justify-center text-white">
              <FileText className="h-4 w-4" />
           </div>
           <span className="text-[10px] font-black uppercase tracking-widest text-navy-900 opacity-30">Form 01+1.2 Alpha</span>
        </div>
      </div>

      <Card className="border-none shadow-2xl shadow-navy-900/5 rounded-[3rem] overflow-hidden bg-white">
        <div className="h-2 bg-navy-900 w-full" />
        <CardHeader className="p-10 pb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 text-center md:text-left">
            <div className="space-y-2">
              <CardTitle className="text-4xl md:text-5xl font-black text-navy-900 tracking-tighter leading-none italic">
                Operational <br />
                Itinerary.
              </CardTitle>
              <CardDescription className="text-slate-500 font-medium max-w-sm">
                Consolidated mission request system. Please fill in all operational parameters before deployment.
              </CardDescription>
            </div>
            <div className="hidden md:block">
               <Sparkles className="h-12 w-12 text-slate-100" />
            </div>
          </div>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="p-10 pt-4 space-y-10">
            {/* Identity Group */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                <LayoutList className="h-4 w-4 text-slate-300" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Personnel & Dept</span>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="micro-label">Lead Liaison Employee</Label>
                  <Input 
                    {...register('employeeName')} 
                    placeholder="Full Name"
                    className={`h-12 rounded-xl bg-slate-50 border-none font-bold text-navy-900 ${errors.employeeName ? 'ring-2 ring-red-500' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="micro-label">Operational Department</Label>
                  <Select onValueChange={(val) => setValue('department', val)} defaultValue={entry?.department}>
                    <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-none font-bold text-navy-900">
                      <SelectValue placeholder="Select Division" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Accounting">Accounting</SelectItem>
                      <SelectItem value="Corporate">Corporate</SelectItem>
                      <SelectItem value="HR & Admin">HR & Admin</SelectItem>
                      <SelectItem value="Litigation">Litigation</SelectItem>
                      <SelectItem value="Marketing & IT">Marketing & IT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Mission Group */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                <MapPin className="h-4 w-4 text-slate-300" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Mission Parameters</span>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="micro-label">Primary Destination</Label>
                  <Input 
                    {...register('destination')} 
                    placeholder="Location / Site Name"
                    className="h-12 rounded-xl bg-slate-50 border-none font-bold text-navy-900"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="micro-label">Deployment Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                      type="date"
                      {...register('scheduleDate')} 
                      className="h-12 pl-10 rounded-xl bg-slate-50 border-none font-data font-bold text-navy-900"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="micro-label">Mission Objectives & Description</Label>
                <Textarea 
                  {...register('purpose')} 
                  placeholder="Detail the operational reasons for this deployment..."
                  className="min-h-[100px] rounded-2xl bg-slate-50 border-none font-medium leading-relaxed"
                />
              </div>
            </div>

            {/* Logistics Group */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                <Truck className="h-4 w-4 text-slate-300" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Logistics & Transportation</span>
              </div>
              <div className="space-y-2">
                <Label className="micro-label">Transportation Mode & Details</Label>
                <Textarea 
                  {...register('transportationDetails')} 
                  placeholder="e.g., Company Vehicle (Plate #), Grab, Public Transport with route details..."
                  className="min-h-[80px] rounded-2xl bg-slate-50 border-none font-medium text-sm"
                />
              </div>
            </div>

            {/* Financial Group */}
            <div className="space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
                <CreditCard className="h-4 w-4 text-slate-300" />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Financial Quantum</span>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="micro-label font-bold text-emerald-700 italic">Requested Cash Advance (PHP)</Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-emerald-600">₱</span>
                    <Input 
                      type="number"
                      step="0.01"
                      {...register('requestedCashAdvance')} 
                      className="h-14 pl-10 rounded-xl bg-emerald-50/50 border-none text-2xl font-black font-data text-emerald-900"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="micro-label">Operational Estimates / Breakdown</Label>
                  <Textarea 
                    {...register('operationalEstimates')} 
                    placeholder="Gas, Parking, Food, Supplies, etc."
                    className="min-h-[80px] rounded-xl bg-slate-50 border-none font-medium text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="micro-label">Additional Remarks (Optional)</Label>
                <Input 
                  {...register('remarks')} 
                  placeholder="Any extra context for the approving officer..."
                  className="h-12 rounded-xl bg-slate-50 border-none font-medium"
                />
              </div>
            </div>

          </CardContent>

          <CardFooter className="p-10 pt-0 grid sm:grid-cols-2 gap-4">
            <Button 
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              className="h-16 rounded-2xl border-2 border-slate-100 font-black uppercase text-xs tracking-widest gap-2 hover:bg-slate-50"
            >
              <Save className="h-5 w-5" />
              Save as Draft
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
              className="h-16 rounded-2xl bg-navy-900 hover:bg-navy-800 font-black uppercase text-xs tracking-widest gap-2 group"
            >
              {isSubmitting ? "Finalizing Entry..." : (
                <>
                  Initialize Mission
                  <Send className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
      
      <div className="mt-8 flex justify-center items-center gap-3 opacity-20 hover:opacity-100 transition-opacity">
         <div className="h-[1px] w-12 bg-navy-900" />
         <span className="text-[9px] font-black uppercase tracking-[0.2em] text-navy-900">STLAF Encrypted Transmission</span>
         <div className="h-[1px] w-12 bg-navy-900" />
      </div>
    </div>
  );
};

export default OperationalForm;
