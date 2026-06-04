import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./components/auth/AuthProvider";
import LoginPage from "./pages/LoginPage";
import ProfileSetup from "./pages/ProfileSetup";
import UserDashboard from "./pages/UserDashboard";
import OperationalForm from "./pages/OperationalForm";
import LiquidationWorkflow from "./pages/LiquidationWorkflow";
import SummaryView from "./pages/SummaryView";
import AdminDashboard from "./pages/AdminDashboard";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import {
  LogOut,
  LayoutDashboard,
  ShieldCheck,
  User,
  Menu,
  X,
  ChevronRight,
  Phone,
  Building2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "./components/ui/button";
import { OperationalEntry } from "./types";
import { db } from "./lib/firebase";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEPARTMENTS = [
  "Accounting",
  "Corporate",
  "HR & Admin",
  "Litigation",
  "Marketing & IT",
  "Operations",
  "Finance",
  "Supply Chain",
];

function Navigation() {
  const { user, loading, isAdmin, isProfileComplete, userData } = useAuth();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [activeEntry, setActiveEntry] = useState<OperationalEntry | undefined>(
    undefined,
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Profile Edit Dialog States
  const [isProfileEditDialogOpen, setIsProfileEditDialogOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileDepartment, setProfileDepartment] = useState("");
  const [profileContact, setProfileContact] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<{ name?: string; department?: string; contact?: string }>({});

  const handleOpenProfileEdit = () => {
    setProfileName(userData?.displayName || user?.displayName || "");
    setProfileDepartment(userData?.department || "");
    setProfileContact(userData?.contactNumber || "");
    setProfileErrors({});
    setIsProfileEditDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    const newErrors: { name?: string; department?: string; contact?: string } = {};
    if (!profileName.trim()) {
      newErrors.name = "Full legal name is required.";
    } else if (profileName.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters long.";
    }

    if (!profileDepartment) {
      newErrors.department = "Department assignment is required.";
    }

    if (!profileContact.trim()) {
      newErrors.contact = "Contact number is required.";
    } else if (profileContact.trim().length < 7) {
      newErrors.contact = "Contact number must be a valid 7 to 11 digit telephone or mobile format.";
    }

    if (Object.keys(newErrors).length > 0) {
      setProfileErrors(newErrors);
      toast.error("Please fill in all required fields correctly.");
      return;
    }

    setProfileErrors({});
    setIsSavingProfile(true);
    const toastId = toast.loading("Updating your profile details...");
    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName: profileName,
        department: profileDepartment,
        contactNumber: profileContact.trim(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Profile updated successfully!", { id: toastId });
      setIsProfileEditDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile.", { id: toastId });
    } finally {
      setIsSavingProfile(false);
    }
  };

  useEffect(() => {
    if (user) {
      setIsLoggingOut(false);
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const toastId = toast.loading("Disconnecting from STLAF Ops...");
      const { auth } = await import("./lib/firebase");
      await auth.signOut();
      toast.success("Disconnected successfully.", { id: toastId });
    } catch (error) {
      console.error(error);
      setIsLoggingOut(false);
      toast.error("Failed to disconnect.");
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-white flex-col gap-4">
        <div className="w-12 h-12 border-4 border-navy-900 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-navy-900 font-black italic tracking-tighter">
          Initializing STLAF Ops...
        </p>
      </div>
    );

  if (!user) return <LoginPage />;
  if (!isProfileComplete) return <ProfileSetup />;

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return (
          <UserDashboard
            onNewEntry={() => {
              setActiveEntry(undefined);
              setCurrentPage("operational-form");
            }}
            onContinueEntry={(entry) => {
              setActiveEntry(entry);
              if (entry.status === "Draft" || entry.status === "Needs Revision") setCurrentPage("operational-form");
              else setCurrentPage("liquidation-workflow");
            }}
            onViewEntry={(entry) => {
              setActiveEntry(entry);
              setCurrentPage("summary-view");
            }}
          />
        );
      case "operational-form":
        return (
          <OperationalForm
            entry={activeEntry}
            onBack={() => setCurrentPage("dashboard")}
            onSuccess={() => {
              if (activeEntry?.status === "Needs Revision") {
                setCurrentPage("liquidation-workflow");
              } else {
                setCurrentPage("dashboard");
              }
            }}
          />
        );
      case "liquidation-workflow":
        return (
          <LiquidationWorkflow
            entry={activeEntry!}
            onBack={() => setCurrentPage("dashboard")}
            onSuccess={() => setCurrentPage("dashboard")}
          />
        );
      case "summary-view":
        return (
          <SummaryView
            entry={activeEntry!}
            onBack={() => setCurrentPage("dashboard")}
          />
        );
      case "admin-dashboard":
        return isAdmin ? (
          <AdminDashboard
            type="opex"
            onBack={() => setCurrentPage("dashboard")}
          />
        ) : (
          <UserDashboard
            onNewEntry={() => {}}
            onContinueEntry={() => {}}
            onViewEntry={() => {}}
          />
        );
      default:
        return (
          <UserDashboard
            onNewEntry={() => {}}
            onContinueEntry={() => {}}
            onViewEntry={() => {}}
          />
        );
    }
  };

  const navItems = [
    { id: "dashboard", label: "My Operations", adminOnly: false },
    { id: "admin-dashboard", label: "Admin Hub", adminOnly: true },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] font-sans selection:bg-navy-900 selection:text-white">
      <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex h-20 items-center justify-between px-6">
          <div
            className="flex items-center gap-3 font-black text-navy-900 cursor-pointer group"
            onClick={() => setCurrentPage("dashboard")}
          >
            <div className="w-10 h-10 bg-navy-900 rounded-xl flex items-center justify-center text-white transition-transform group-hover:rotate-6">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="flex flex-col -space-y-1">
              <span className="text-xl tracking-tighter italic uppercase text-navy-900 font-bold">
                <span className="text-gold-500">STLAF</span> Ops
              </span>
              <span className="text-[9px] font-black tracking-[0.3em] text-slate-400 uppercase">
                Mission Control v4.0
              </span>
            </div>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems
              .filter((i) => !i.adminOnly || isAdmin)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
                  className={`text-xs font-black uppercase tracking-widest transition-all hover:text-navy-900 relative py-2 ${currentPage === item.id ? "text-navy-900" : "text-slate-400"}`}
                >
                  {item.label}
                  {currentPage === item.id && (
                    <motion.div
                      layoutId="nav-pill"
                      className="absolute -bottom-1 left-0 right-0 h-1 bg-navy-900 rounded-full"
                    />
                  )}
                </button>
              ))}

            <div className="h-6 w-[1px] bg-slate-100 mx-2" />

            <div className="flex items-center gap-4">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-all group/profile"
                onClick={handleOpenProfileEdit}
                title="Edit My Profile"
              >
                <div className="flex flex-col items-end -space-y-1">
                  <span className="text-xs font-black text-navy-900 group-hover/profile:text-navy-700 transition-colors">
                    {userData?.displayName || user.displayName || "Officer"}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {isAdmin ? "ADMINISTRATOR" : "FIELD OFFICER"}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden group-hover/profile:border-navy-900 transition-colors">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User" />
                  ) : (
                    <User className="h-5 w-5 text-navy-900" />
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                disabled={isLoggingOut}
                onClick={handleLogout}
                className="rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
              >
                {isLoggingOut ? (
                  <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5" />
                )}
              </Button>
            </div>
          </nav>

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden rounded-xl"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden bg-white border-b border-slate-100 overflow-hidden"
            >
              <div className="p-6 space-y-4">
                {/* Mobile Profile Trigger */}
                <div
                  className="flex items-center justify-between p-6 bg-slate-50 hover:bg-slate-100/80 transition-all rounded-3xl cursor-pointer border border-slate-100/50"
                  onClick={() => {
                    handleOpenProfileEdit();
                    setIsMenuOpen(false);
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center overflow-hidden">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt="User"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-6 w-6 text-navy-900" />
                      )}
                    </div>
                    <div className="flex flex-col -space-y-0.5">
                      <span className="text-sm font-black text-navy-900">
                        {userData?.displayName ||
                          user.displayName ||
                          "Officer"}
                      </span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {isAdmin ? "ADMINISTRATOR" : "FIELD OFFICER"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-navy-900 bg-white px-3 py-1.5 rounded-xl shadow-sm border border-slate-100">
                    Edit
                  </div>
                </div>

                <div className="h-[1px] bg-slate-100/80 my-2" />

                {navItems
                  .filter((i) => !i.adminOnly || isAdmin)
                  .map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentPage(item.id);
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center justify-between w-full p-6 bg-slate-50 rounded-3xl font-black text-xs uppercase tracking-widest text-navy-900"
                    >
                      {item.label}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ))}
                <Button
                  variant="destructive"
                  disabled={isLoggingOut}
                  className="w-full h-16 rounded-3xl font-black uppercase tracking-widest gap-2 bg-red-500 text-white hover:bg-red-600 hover:text-white disabled:opacity-50"
                  onClick={handleLogout}
                >
                  {isLoggingOut ? "Disconnecting..." : "Logout System"}
                  {isLoggingOut ? (
                    <div className="w-4 h-4 border-2 border-white/60 border-t-white rounded-full animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className="max-w-7xl mx-auto py-12 px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {renderPage()}
          </motion.div>
        </AnimatePresence>
      </main>

      <footer className="max-w-7xl mx-auto py-12 px-6 border-t border-slate-50">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-6 w-6 text-slate-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 italic">
              STLAF Liaison Ops Management System © 2026
            </span>
          </div>
          <div className="flex gap-6">
            <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-navy-900 border-b border-transparent hover:border-slate-300 transition-all">
              System Health
            </button>
            <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-navy-900 border-b border-transparent hover:border-slate-300 transition-all">
              Documentation
            </button>
            <button className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-navy-900 border-b border-transparent hover:border-slate-300 transition-all">
              Support
            </button>
          </div>
        </div>
      </footer>

      {/* Self Profile Edit Dialog */}
      <Dialog
        open={isProfileEditDialogOpen}
        onOpenChange={(open) => {
          if (!open) setIsProfileEditDialogOpen(false);
        }}
      >
        <DialogContent className="rounded-[2.5rem] border-none bg-white p-8 max-w-md shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-navy-900 rounded-2xl flex items-center justify-center text-white mb-2">
              <User className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-black text-navy-900 italic uppercase tracking-tighter">
              My Personnel Profile
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              Maintain your active operational credentials
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveProfile();
            }}
            className="space-y-6 my-6"
          >
            <div className="space-y-2">
              <Label
                htmlFor="prof-name"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900 flex items-center gap-2"
              >
                <User className="h-3 w-3" /> Full Name
              </Label>
              <Input
                id="prof-name"
                value={profileName}
                onChange={(e) => {
                  setProfileName(e.target.value);
                  if (profileErrors.name) setProfileErrors(prev => ({ ...prev, name: undefined }));
                }}
                placeholder="Full Name"
                className={`h-12 rounded-xl bg-slate-50 border-2 font-bold text-navy-950 transition-all ${
                  profileErrors.name ? "border-red-500 bg-red-50/10" : "border-transparent focus:ring-2 focus:ring-navy-900"
                }`}
              />
              {profileErrors.name && (
                <p className="text-red-500 font-bold text-[11px] mt-1 flex items-start gap-1 py-1 px-2.5 bg-red-50/50 rounded-lg">
                  <span className="shrink-0 bg-red-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5">!</span>
                  <span>{profileErrors.name} Enter your full legal name.</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="prof-dept"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900 flex items-center gap-2"
              >
                <Building2 className="h-3 w-3" /> Department
              </Label>
              <select
                id="prof-dept"
                value={profileDepartment}
                onChange={(e) => {
                  setProfileDepartment(e.target.value);
                  if (profileErrors.department) setProfileErrors(prev => ({ ...prev, department: undefined }));
                }}
                className={`w-full h-12 px-4 rounded-xl bg-slate-50 border-2 font-bold text-navy-950 focus:outline-none transition-all ${
                  profileErrors.department ? "border-red-500 bg-red-50/10" : "border-transparent focus:ring-2 focus:ring-navy-900"
                }`}
              >
                <option value="" disabled>
                  Select Department
                </option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              {profileErrors.department && (
                <p className="text-red-500 font-bold text-[11px] mt-1 flex items-start gap-1 py-1 px-2.5 bg-red-50/50 rounded-lg">
                  <span className="shrink-0 bg-red-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5">!</span>
                  <span>{profileErrors.department} Select your primary organizational division.</span>
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="prof-contact"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900 flex items-center gap-2"
              >
                <Phone className="h-3 w-3" /> Contact Number
              </Label>
              <Input
                id="prof-contact"
                value={profileContact}
                onChange={(e) => {
                  setProfileContact(e.target.value);
                  if (profileErrors.contact) setProfileErrors(prev => ({ ...prev, contact: undefined }));
                }}
                placeholder="e.g. +63 912 345 6789"
                className={`h-12 rounded-xl bg-slate-50 border-2 font-bold text-navy-950 transition-all ${
                  profileErrors.contact ? "border-red-500 bg-red-50/10" : "border-transparent focus:ring-2 focus:ring-navy-900"
                }`}
              />
              {profileErrors.contact && (
                <p className="text-red-500 font-bold text-[11px] mt-1 flex items-start gap-1 py-1 px-2.5 bg-red-50/50 rounded-lg">
                  <span className="shrink-0 bg-red-500 text-white w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-black mt-0.5">!</span>
                  <span>{profileErrors.contact} Provide an active reachable mobile number.</span>
                </p>
              )}
            </div>

            <DialogFooter className="gap-3 sm:gap-0 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsProfileEditDialogOpen(false)}
                className="rounded-xl font-black uppercase tracking-wider text-xs h-12 px-6"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingProfile}
                className="rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-black uppercase tracking-wider text-xs h-12 px-6"
              >
                {isSavingProfile ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Navigation />
      <Toaster />
    </AuthProvider>
  );
}
