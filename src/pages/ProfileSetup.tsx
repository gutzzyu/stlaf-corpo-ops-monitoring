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
  const [errors, setErrors] = useState<{ fullName?: string; department?: string; contactNumber?: string }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const newErrors: { fullName?: string; department?: string; contactNumber?: string } = {};
    if (!fullName.trim()) {
      newErrors.fullName = "Full legal name is required.";
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = "Name must be at least 2 characters long.";
    }

    if (!department) {
      newErrors.department = "Department assignment is required.";
    }

    if (!contactNumber.trim()) {
      newErrors.contactNumber = "Active contact number is required.";
    } else if (contactNumber.trim().length < 7) {
      newErrors.contactNumber = "Contact number must be a valid 7 to 11 digit telephone or mobile format.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error("Please fill in all required fields correctly.");
      return;
    }

    setErrors({});
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

  const renderError = (msg?: string, tip?: string) => {
    if (!msg) return null;
    return (
      <p role="alert" className="text-red-500 font-bold text-xs mt-1.5 flex items-start gap-1 py-1.5 px-3 bg-red-50/80 border border-red-100 rounded-xl animate-fadeIn">
        <span className="shrink-0 bg-red-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5">!</span>
        <span className="flex flex-col">
          <span>{msg}</span>
          {tip && <span className="text-[10px] font-medium text-red-400 mt-0.5">{tip}</span>}
        </span>
      </p>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#fafafa]">
      <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         className="w-full max-w-md"
      >
        <Card className="border-none shadow-2xl rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden bg-white">
          <div className="h-3 bg-navy-900 w-full" />
          <CardHeader className="p-6 sm:p-10 space-y-3 sm:space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-navy-900 rounded-2xl flex items-center justify-center text-white shrink-0">
                <User className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div>
                <CardTitle className="text-xl sm:text-2xl font-black text-navy-900 italic uppercase tracking-tighter">Profile Setup</CardTitle>
                <CardDescription className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                  Finalize your identity to start operations
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 sm:px-10 pb-6 sm:pb-10 space-y-6 sm:space-y-8">
            <form id="setup-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="fullname" className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900 flex items-center gap-2">
                  <User className="h-3 w-3" /> Full Name
                </Label>
                <Input
                  id="fullname"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (errors.fullName) setErrors(prev => ({ ...prev, fullName: undefined }));
                  }}
                  placeholder="e.g. Juan Dela Cruz"
                  className={`h-14 rounded-2xl bg-slate-50 border-2 font-bold text-navy-900 placeholder:text-slate-300 transition-all shrink-0 ${
                    errors.fullName ? 'border-red-500 bg-red-50/10' : 'border-transparent focus:ring-2 focus:ring-navy-900'
                  }`}
                />
                {renderError(errors.fullName, 'Provide your full official name for audit compliance.')}
              </div>

               <div className="space-y-2">
                <Label htmlFor="department" className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900 flex items-center gap-2">
                  <Building2 className="h-3 w-3" /> Department
                </Label>
                <Select 
                  value={department} 
                  onValueChange={(val) => {
                    setDepartment(val);
                    if (errors.department) setErrors(prev => ({ ...prev, department: undefined }));
                  }}
                >
                  <SelectTrigger className={`h-14 rounded-2xl bg-slate-50 border-2 font-bold text-navy-900 transition-all ${
                    errors.department ? 'border-red-500 bg-red-50/10' : 'border-transparent focus:ring-2 focus:ring-navy-900'
                  }`}>
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
                {renderError(errors.department, 'Select the principal team or corporate department you report to.')}
              </div>

              <div className="space-y-2">
                <Label htmlFor="contactNumber" className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900 flex items-center gap-2">
                  <Phone className="h-3 w-3" /> Contact Number
                </Label>
                <Input
                  id="contactNumber"
                  value={contactNumber}
                  onChange={(e) => {
                    setContactNumber(e.target.value);
                    if (errors.contactNumber) setErrors(prev => ({ ...prev, contactNumber: undefined }));
                  }}
                  placeholder="e.g. +63 912 345 6789"
                  className={`h-14 rounded-2xl bg-slate-50 border-2 font-bold text-navy-950 placeholder:text-slate-300 transition-all shrink-0 ${
                    errors.contactNumber ? 'border-red-500 bg-red-50/10' : 'border-transparent focus:ring-2 focus:ring-navy-900'
                  }`}
                />
                {renderError(errors.contactNumber, 'Include your area code or mobile prefix (e.g., 0917xxxxxxx).')}
              </div>
            </form>
          </CardContent>
          <CardFooter className="px-6 sm:px-10 pb-6 sm:pb-10">
            <Button
              form="setup-form"
              type="submit"
              disabled={isSubmitting}
              className="w-full h-16 rounded-3xl bg-navy-900 hover:bg-navy-800 text-white font-black uppercase tracking-widest gap-3 transition-all hover:scale-[1.01] active:scale-[0.99]"
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
