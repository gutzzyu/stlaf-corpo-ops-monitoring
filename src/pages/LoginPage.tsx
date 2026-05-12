import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { LogIn, ShieldCheck, Globe, Activity, Terminal } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        const isAdminEmail = user.email === 'andrewmanuel310@gmail.com';
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: isAdminEmail ? 'admin' : 'user',
          createdAt: serverTimestamp(),
        });
        toast.success(isAdminEmail ? "Administrative link established." : "Operational account established.");
      } else {
        toast.success("Welcome back, Commander.");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Authentication override failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white">
      {/* Visual Side */}
      <div className="hidden lg:flex w-1/2 bg-navy-900 relative overflow-hidden items-center justify-center">
        <div className="absolute inset-0 opacity-20">
           <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_2px_2px,rgba(255,255,255,0.05)_1px,transparent_0)] bg-[size:40px_40px]"></div>
        </div>
        
        <div className="relative z-10 p-12 space-y-8 max-w-lg">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-2xl"
          >
             <ShieldCheck className="h-10 w-10 text-navy-900" />
          </motion.div>
          
          <div className="space-y-4">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-6xl font-black text-white tracking-tighter italic leading-none"
            >
              Control <br /> The Flow.
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-navy-300 text-xl font-medium leading-relaxed"
            >
              The advanced operational interface for STLAF personnel. Secure, audited, and real-time.
            </motion.p>
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 0.6 }}
            className="flex gap-4 pt-4"
          >
            {[Activity, Globe, Terminal].map((Icon, i) => (
              <Icon key={i} className="h-6 w-6 text-white" />
            ))}
          </motion.div>
        </div>

        {/* Decorative mask */}
        <div className="absolute bottom-0 right-0 p-12 opacity-5">
           <Globe className="h-96 w-96 text-white rotate-12" />
        </div>
      </div>

      {/* Login Side */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
        <Card className="w-full max-w-md shadow-2xl shadow-navy-900/5 border-none rounded-[2.5rem] bg-white overflow-hidden">
          <div className="h-1.5 bg-navy-900 w-full" />
          <CardHeader className="p-10 pb-6 text-center space-y-2">
            <div className="lg:hidden mx-auto w-12 h-12 bg-navy-900 rounded-xl flex items-center justify-center mb-4">
               <ShieldCheck className="h-7 w-7 text-white" />
            </div>
            <CardTitle className="text-3xl font-black text-navy-900 tracking-tight">STLAF Ops Hub</CardTitle>
            <CardDescription className="text-slate-400 font-medium">
              Operational Authentication Required
            </CardDescription>
          </CardHeader>
          <CardContent className="px-10 py-6">
            <Button 
              variant="outline" 
              className="w-full h-16 text-lg font-bold gap-3 border-2 border-slate-100 hover:border-navy-900 rounded-2xl transition-all hover:bg-slate-50 group"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              {loading ? (
                <Activity className="h-5 w-5 animate-spin" />
              ) : (
                <div className="flex items-center gap-3">
                   <LogIn className="h-5 w-5 text-navy-900 group-hover:translate-x-1 transition-transform" />
                   <span>Access Data Portal</span>
                </div>
              )}
            </Button>
          </CardContent>
          <CardFooter className="flex flex-col gap-6 p-10 pt-4">
            <div className="flex items-center gap-2 w-full">
              <div className="h-[1px] bg-slate-100 flex-1" />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Protected by Firebase</span>
              <div className="h-[1px] bg-slate-100 flex-1" />
            </div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-center text-slate-400 px-6 leading-relaxed">
              Standard operational protocols apply. <br /> All actions are logged for audit purposes.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
