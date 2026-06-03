import React, { useState } from 'react';
import { useAuth } from '../components/auth/AuthProvider';
import { db } from '../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, User, Building2, Rocket, Phone } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

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

const ProfileSetup: React.FC = () => {
  const { user, userData } = useAuth();
  const [fullName, setFullName] = useState(userData?.displayName || user?.displayName || '');
  const [department, setDepartment] = useState(userData?.department || '');
  const [contactNumber, setContactNumber] = useState(userData?.contactNumber || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!fullName.trim() || !department || !contactNumber.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: fullName,
        department: department,
        contactNumber: contactNumber.trim(),
        role: userData?.role || 'user',
        updatedAt: serverTimestamp(),
        createdAt: userData?.createdAt || serverTimestamp(),
      }, { merge: true });
      
      toast.success("Profile setup complete!");
      // The app state will update automatically via AuthProvider using onSnapshot
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#fafafa]">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
          <div className="h-3 bg-navy-900 w-full" />
          <CardHeader className="p-10 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-navy-900 rounded-2xl flex items-center justify-center text-white">
                <User className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black text-navy-900 italic uppercase tracking-tighter">Profile Setup</CardTitle>
                <CardDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  Finalize your identity to start operations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-10 pb-10 space-y-8">
            <form id="setup-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="fullname" className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900 flex items-center gap-2">
                  <User className="h-3 w-3" /> Full Name
                </Label>
                <Input
                  id="fullname"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Juan Dela Cruz"
                  className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-navy-900 placeholder:text-slate-300 focus:ring-2 focus:ring-navy-900 transition-all shrink-0"
                  required
                />
              </div>

               <div className="space-y-2">
                <Label htmlFor="department" className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900 flex items-center gap-2">
                  <Building2 className="h-3 w-3" /> Department
                </Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-navy-900 focus:ring-2 focus:ring-navy-900 transition-all">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept} className="font-bold py-3">
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNumber" className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900 flex items-center gap-2">
                  <Phone className="h-3 w-3" /> Contact Number
                </Label>
                <Input
                  id="contactNumber"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="e.g. +63 912 345 6789"
                  className="h-14 rounded-2xl bg-slate-50 border-none font-bold text-navy-950 placeholder:text-slate-300 focus:ring-2 focus:ring-navy-900 transition-all shrink-0"
                  required
                />
              </div>
            </form>
          </CardContent>
          <CardFooter className="px-10 pb-10">
            <Button
              form="setup-form"
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 rounded-3xl bg-navy-900 hover:bg-navy-800 text-white font-black uppercase tracking-widest gap-3 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Initialize Access
                  <Rocket className="h-5 w-5" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
        
        <div className="mt-8 flex items-center justify-center gap-3">
          <ShieldCheck className="h-5 w-5 text-slate-300" />
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">Security Clearance Required</p>
        </div>
      </motion.div>
    </div>
  );
};

export default ProfileSetup;
