import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../components/auth/AuthProvider';
import { OperationalEntry, EntryStatus } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Clock, 
  MapPin, 
  CreditCard, 
  ArrowRight, 
  Trash2, 
  Search,
  LayoutDashboard,
  Timer,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Input } from '@/components/ui/input';

interface Props {
  onNewEntry: () => void;
  onContinueEntry: (entry: OperationalEntry) => void;
  onViewEntry: (entry: OperationalEntry) => void;
}

const UserDashboard: React.FC<Props> = ({ onNewEntry, onContinueEntry, onViewEntry }) => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<OperationalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'operational_entries'),
      where('userId', '==', user.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OperationalEntry));
      setEntries(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'operational_entries');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredEntries = entries.filter(e => 
    e.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusInfo = (status: EntryStatus) => {
    switch (status) {
      case 'Draft': return { color: 'bg-slate-100 text-slate-600', icon: <Timer className="h-3 w-3" /> };
      case 'Ongoing': return { color: 'bg-blue-100 text-blue-600', icon: <ArrowRight className="h-3 w-3" /> };
      case 'For Liquidation': return { color: 'bg-amber-100 text-amber-600', icon: <CreditCard className="h-3 w-3" /> };
      case 'Submitted': return { color: 'bg-indigo-100 text-indigo-600', icon: <CheckCircle2 className="h-3 w-3" /> };
      case 'Approved': return { color: 'bg-emerald-100 text-emerald-600', icon: <CheckCircle2 className="h-3 w-3" /> };
      case 'Rejected': return { color: 'bg-red-100 text-red-600', icon: <AlertCircle className="h-3 w-3" /> };
      default: return { color: 'bg-slate-100 text-slate-600', icon: <Clock className="h-3 w-3" /> };
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this draft?")) return;
    try {
      await deleteDoc(doc(db, 'operational_entries', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `operational_entries/${id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 border-4 border-navy-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-navy-900 mb-2">
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-xs font-black uppercase tracking-widest italic opacity-50">Operational Nexus</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-navy-900 tracking-tighter leading-none italic">
            Officer <br />
            Dashboard.
          </h1>
        </div>
        <Button 
          onClick={onNewEntry}
          className="h-16 px-8 rounded-2xl bg-navy-900 hover:bg-navy-800 text-lg font-black gap-2 transition-all hover:gap-4 shadow-xl shadow-navy-900/10 group overflow-hidden"
        >
          New Operation
          <Plus className="h-6 w-6 group-hover:rotate-90 transition-transform" />
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <Input 
          placeholder="Filter operational registry..." 
          className="h-14 pl-12 rounded-2xl border-slate-100 bg-white/50 backdrop-blur-sm focus:bg-white transition-all text-lg font-medium shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence>
          {filteredEntries.map((entry) => {
            const status = getStatusInfo(entry.status);
            const canContinue = ['Draft', 'Ongoing', 'For Liquidation'].includes(entry.status);
            
            return (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <Card className="group border-none shadow-xl shadow-navy-900/5 rounded-[2.5rem] overflow-hidden bg-white hover:bg-slate-50/50 transition-colors cursor-pointer" onClick={() => canContinue ? onContinueEntry(entry) : onViewEntry(entry)}>
                  <CardHeader className="p-6 pb-2">
                    <div className="flex justify-between items-start mb-4">
                      <Badge className={`rounded-xl px-3 py-1 font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 ${status.color}`}>
                        {status.icon}
                        {entry.status}
                      </Badge>
                      {entry.status === 'Draft' && (
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => { e.stopPropagation(); handleDelete(entry.id!); }}
                          className="h-8 w-8 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <CardTitle className="text-xl font-bold text-navy-900 line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {entry.destination || 'Unnamed Operation'}
                    </CardTitle>
                    <CardDescription className="text-xs font-data flex items-center gap-1 opacity-60">
                      <Clock className="h-3 w-3" />
                      Updated {entry.updatedAt?.toDate().toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-2">
                    <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px] leading-relaxed">
                      {entry.purpose || 'No mission objective specified.'}
                    </p>
                    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">Target</span>
                        <div className="flex items-center gap-1 text-xs font-bold text-navy-900">
                          <MapPin className="h-3 w-3 text-blue-500" />
                          <span className="truncate">{entry.destination}</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-black tracking-widest text-slate-300">Grant</span>
                        <div className="flex items-center gap-1 text-xs font-bold text-emerald-600">
                          <CreditCard className="h-3 w-3" />
                          ₱{entry.requestedCashAdvance?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Button 
                      variant="ghost" 
                      className="w-full h-12 rounded-xl bg-slate-100 text-navy-900 group-hover:bg-navy-900 group-hover:text-white transition-all font-black text-xs uppercase tracking-widest gap-2"
                    >
                      {canContinue ? 'Continue Workflow' : 'View Summary'}
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredEntries.length === 0 && !loading && (
        <div className="text-center py-24 bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <LayoutDashboard className="h-10 w-10 text-slate-200" />
          </div>
          <h2 className="text-2xl font-black text-navy-900 italic tracking-tighter">No Active Operations.</h2>
          <p className="text-slate-400 mt-2 font-medium">Initialize a new mission itinerary to get started.</p>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;
