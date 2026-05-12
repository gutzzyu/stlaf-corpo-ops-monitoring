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
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Camera
} from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  entry: OperationalEntry;
  onBack: () => void;
}

const SummaryView: React.FC<Props> = ({ entry, onBack }) => {
  return (
    <div className="max-w-4xl mx-auto py-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-slate-400 hover:text-navy-900 transition-colors mb-8">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Button>

      <Card className="border-none shadow-2xl shadow-navy-900/5 rounded-[3rem] overflow-hidden bg-white">
        <div className="h-2 bg-navy-900 w-full" />
        <CardHeader className="p-10 pb-6 border-b border-slate-50">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4">
              <Badge className="rounded-xl px-4 py-1.5 font-black text-xs uppercase tracking-widest bg-navy-900 text-white">
                {entry.status}
              </Badge>
              <div className="space-y-1">
                <CardTitle className="text-4xl md:text-5xl font-black text-navy-900 tracking-tighter leading-none italic">
                  Operational <br />
                  Registry #{(entry.id || '...').slice(0, 8).toUpperCase()}
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
          {/* Section 1: Parameters */}
          <div className="grid md:grid-cols-2 gap-12">
             <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-navy-900 italic">Objectives</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Mission Lead</Label>
                    <p className="text-lg font-bold text-navy-900">{entry.employeeName}</p>
                    <p className="text-xs font-medium text-slate-400 italic">{entry.department}</p>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Destination</Label>
                    <div className="flex items-center gap-2 text-lg font-bold text-navy-900">
                      <MapPin className="h-5 w-5 text-blue-500" />
                      {entry.destination}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] uppercase font-bold text-slate-400">Purpose</Label>
                    <p className="text-sm leading-relaxed text-slate-600 font-medium">{entry.purpose}</p>
                  </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className="flex items-center gap-2">
                   <Truck className="h-4 w-4 text-amber-500" />
                   <span className="text-xs font-black uppercase tracking-widest text-navy-900 italic">Logistics</span>
                </div>
                <div className="space-y-4">
                   <div>
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Schedule</Label>
                      <div className="flex items-center gap-2 text-navy-900 font-data font-bold">
                         <Calendar className="h-4 w-4 text-slate-300" />
                         {entry.scheduleDate}
                      </div>
                   </div>
                   <div>
                      <Label className="text-[10px] uppercase font-bold text-slate-400">Transportation Details</Label>
                      <p className="text-sm text-slate-600 font-medium bg-slate-50 p-4 rounded-2xl italic leading-relaxed">
                         {entry.transportationDetails}
                      </p>
                   </div>
                </div>
             </div>
          </div>

          {/* Section 2: Financials */}
          <div className="space-y-6 pt-12 border-t border-slate-50">
             <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-black uppercase tracking-widest text-navy-900 italic">Financial Auditing</span>
             </div>
             
             <div className="grid md:grid-cols-3 gap-6">
                <div className="p-8 bg-slate-50 rounded-[2.5rem] space-y-1">
                   <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Advance Released</div>
                   <div className="text-3xl font-black font-data text-navy-900">₱{entry.requestedCashAdvance?.toLocaleString()}</div>
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
                    <div key={item.id} className="flex items-center justify-between p-6 bg-white border border-slate-100 rounded-3xl group hover:border-navy-900 transition-all">
                       <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-navy-900 group-hover:text-white transition-colors">
                             {item.requiresProofSlip ? <FileText className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                          </div>
                          <div>
                             <h5 className="font-bold text-navy-900">{item.description}</h5>
                             <p className="text-xs font-data text-slate-400">{item.date}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-6">
                          <div className="text-right">
                             <div className="text-lg font-black font-data text-navy-900">₱{item.amount.toLocaleString()}</div>
                             {item.requiresProofSlip && <Badge variant="outline" className="text-[8px] bg-amber-50 text-amber-600 border-amber-100">PROOF SLIP</Badge>}
                          </div>
                          {(item.receiptUrl || entry.proofSlips?.find(p => p.id === item.id)?.attachmentUrl) && (
                            <a 
                              href={item.receiptUrl || entry.proofSlips?.find(p => p.id === item.id)?.attachmentUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
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

const Label = ({ children, className }: { children: React.ReactNode, className?: string }) => (
  <span className={`block mb-1 ${className}`}>
    {children}
  </span>
);

export default SummaryView;
