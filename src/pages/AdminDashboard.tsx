import React, { useEffect, useState } from "react";
import {
  db,
  handleFirestoreError,
  OperationType,
  getErrorMessage,
} from "../lib/firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Download,
  Search,
  CheckCircle,
  XCircle,
  MoreVertical,
  LayoutGrid,
  List,
  Eye,
  FileText,
  Camera,
  Filter,
  Users,
  ShieldAlert,
  ShieldCheck as ShieldIcon,
  UserCog,
  Trash2,
  Lock,
  Unlock,
  Clock,
  ExternalLink,
  Settings,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { exportToExcel } from "../lib/excelExport";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import { OperationalEntry, EntryStatus, UserProfile } from "../types";
import SummaryView from "./SummaryView";
import { deleteDoc } from "firebase/firestore";

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

interface AdminDashboardProps {
  onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [entries, setEntries] = useState<OperationalEntry[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [adminTab, setAdminTab] = useState<"missions" | "personnel">(
    "missions",
  );
  const [selectedEntry, setSelectedEntry] = useState<OperationalEntry | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<EntryStatus | "All">("All");

  // Revision Dialog state
  const [revisionEntryId, setRevisionEntryId] = useState<string | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [isRevisionLoading, setIsRevisionLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [saEmail, setSaEmail] = useState("");

  useEffect(() => {
    fetch("/api/service-account", { credentials: "include" })
      .then(async (r) => {
        const text = await r.text();
        try {
          return JSON.parse(text);
        } catch {
          return {}; // Silently ignore HTML payloads like the cookie check for this minor info check
        }
      })
      .then((d) => setSaEmail(d?.email || ""))
      .catch(console.error);
  }, []);

  useEffect(() => {
    // Mission Listener
    const qEntries = query(
      collection(db, "operational_entries"),
      orderBy("updatedAt", "desc"),
    );

    const unsubEntries = onSnapshot(
      qEntries,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as OperationalEntry[];
        setEntries(records);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "operational_entries");
      },
    );

    // User Listener
    const qUsers = query(collection(db, "users"), orderBy("createdAt", "desc"));

    const unsubUsers = onSnapshot(
      qUsers,
      (snapshot) => {
        const records = snapshot.docs.map((doc) => ({
          ...doc.data(),
        })) as UserProfile[];
        setAllUsers(records);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, "users");
      },
    );

    return () => {
      unsubEntries();
      unsubUsers();
    };
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: EntryStatus) => {
    if (newStatus === "Needs Revision") {
      setRevisionEntryId(id);
      setRevisionNotes("");
      return;
    }

    const toastId = toast.loading(`Marking entry as ${newStatus}...`);
    try {
      const entry = entries.find((e) => e.id === id);
      if (!entry) throw new Error("Entry not found");

      // Drive Logic
      const token = localStorage.getItem("google_drive_token");
      if (newStatus === "Approved") {
        if (!token) {
          throw new Error(
            "Google Drive session missing. Please log in with Google to approve and transfer files.",
          );
        }
        toast.loading("Transferring attachments to official Google Drive...", {
          id: toastId,
        });
        const res = await fetch("/api/finalize-liquidation", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ entryId: id, entryData: entry }),
        });
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Finalization failed" }));
          if (res.status === 401 || err.error === "DRIVE_AUTH_ERROR") {
            localStorage.removeItem("google_drive_token");
            throw new Error(
              "Google Drive session expired. Please refresh your connection by logging in again.",
            );
          }
          throw new Error(
            err.message || err.error || "Failed to finalize Drive files",
          );
        }
      }

      await updateDoc(doc(db, "operational_entries", id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
      toast.success(`Entry marked as ${newStatus}`, { id: toastId });
    } catch (error: any) {
      toast.error(`Update failed: ${getErrorMessage(error)}`, { id: toastId });
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `operational_entries/${id}`,
      );
    }
  };

  const submitRevisionRequest = async () => {
    if (!revisionEntryId || !revisionNotes.trim()) {
      toast.error("Please provide revision notes.");
      return;
    }

    setIsRevisionLoading(true);
    const toastId = toast.loading("Processing revision request...");
    try {
      const entry = entries.find((e) => e.id === revisionEntryId);
      if (entry) {
        const token = localStorage.getItem("google_drive_token");
        if (!token) {
          throw new Error(
            "Google Drive session missing. Please reconnect to move files back to Pending.",
          );
        }

        toast.loading("Ensuring attachments are in pending state...", {
          id: toastId,
        });
        const response = await fetch("/api/revert-to-pending", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ entryId: revisionEntryId, entryData: entry }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          if (response.status === 401 || err.error === "DRIVE_AUTH_ERROR") {
            localStorage.removeItem("google_drive_token");
            throw new Error("Google Drive session expired. Please reconnect.");
          }
          console.warn("Drive revert warning:", err);
        }
      }

      await updateDoc(doc(db, "operational_entries", revisionEntryId!), {
        status: "Needs Revision",
        adminNotes: revisionNotes,
        updatedAt: serverTimestamp(),
      });
      toast.success("Entry sent back for revision.", { id: toastId });
      setRevisionEntryId(null);
      setRevisionNotes("");
    } catch (error: any) {
      toast.error(
        `Revision request failed: ${error.message || "Unknown error"}`,
        { id: toastId },
      );
    } finally {
      setIsRevisionLoading(false);
    }
  };

  const handleUpdateUserRole = async (
    uid: string,
    newRole: "user" | "admin",
  ) => {
    try {
      await updateDoc(doc(db, "users", uid), {
        role: newRole,
        updatedAt: serverTimestamp(),
      });
      toast.success(`User role updated to ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (
      !window.confirm(
        "Are you absolutely sure? This will remove the user's profile from the registry.",
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "users", uid));
      toast.success("User removed from registry.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
    }
  };

  // User Profile Editing States
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editContact, setEditContact] = useState("");
  const [isSavingUser, setIsSavingUser] = useState(false);

  const handleSaveUserEdit = async () => {
    if (!editingUser) return;
    if (!editName.trim() || !editDepartment.trim() || !editContact.trim()) {
      toast.error("Name, Department, and Contact Number are required.");
      return;
    }

    setIsSavingUser(true);
    const toastId = toast.loading("Updating personnel profile...");
    try {
      await updateDoc(doc(db, "users", editingUser.uid), {
        displayName: editName,
        department: editDepartment,
        contactNumber: editContact.trim(),
        updatedAt: serverTimestamp(),
      });
      toast.success("Personnel profile updated successfully.", { id: toastId });
      setEditingUser(null);
    } catch (error) {
      toast.error("Failed to update profile.", { id: toastId });
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `users/${editingUser.uid}`,
      );
    } finally {
      setIsSavingUser(false);
    }
  };

  const filteredData = entries.filter((item) => {
    const matchesSearch =
      item.employeeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.destination?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.purpose?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.department?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "All" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const filteredUsers = allUsers.filter(
    (u) =>
      u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.department?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getStatusBadge = (status: EntryStatus) => {
    switch (status) {
      case "Approved":
      case "Completed":
        return (
          <Badge className="bg-emerald-500 text-white border-none rounded-sm px-2 text-[9px] uppercase font-black tracking-widest">
            Completed
          </Badge>
        );
      case "Rejected":
        return (
          <Badge className="bg-red-500 text-white border-none rounded-sm px-2 text-[9px] uppercase font-black tracking-widest">
            Rejected
          </Badge>
        );
      case "Needs Revision":
        return (
          <Badge className="bg-orange-500 text-white border-none rounded-sm px-2 text-[9px] uppercase font-black tracking-widest">
            Needs Revision
          </Badge>
        );
      case "Submitted":
        return (
          <Badge className="bg-indigo-500 text-white border-none rounded-sm px-2 text-[9px] uppercase font-black tracking-widest">
            Sent for Audit
          </Badge>
        );
      case "Ongoing":
        return (
          <Badge className="bg-blue-500 text-white border-none rounded-sm px-2 text-[9px] uppercase font-black tracking-widest">
            Ongoing
          </Badge>
        );
      case "For Liquidation":
        return (
          <Badge className="bg-amber-500 text-white border-none rounded-sm px-2 text-[9px] uppercase font-black tracking-widest">
            Liquidation
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="text-slate-400 border-slate-200 rounded-sm px-2 text-[9px] uppercase font-black tracking-widest"
          >
            Draft
          </Badge>
        );
    }
  };

  if (selectedEntry) {
    return (
      <SummaryView
        entry={selectedEntry}
        onBack={() => setSelectedEntry(null)}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Drive Connection Status */}
      {!localStorage.getItem("google_drive_token") && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-6 p-4 bg-orange-50 border border-orange-100 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-600">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-orange-900 font-bold">
                Drive Session Disconnected
              </h3>
              <p className="text-orange-700 text-xs font-medium">
                Automatic file transfers are currently suspended. Please
                re-authenticate to sync and approve missions.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="border-orange-200 text-orange-700 hover:bg-orange-100 rounded-xl"
            onClick={() => {
              import("../lib/firebase").then(({ auth }) => auth.signOut());
            }}
          >
            Reconnect Google Drive
          </Button>
        </motion.div>
      )}
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-100 pb-8">
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="gap-2 text-slate-400 hover:text-navy-900 -ml-2 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </Button>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-8 bg-navy-900 rounded-full" />
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">
                Admin Control Unit
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-navy-900 tracking-tighter italic leading-none">
              Command <br />
              {adminTab === "missions" ? "Registry." : "Personnel."}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            <Button
              variant={adminTab === "missions" ? "secondary" : "ghost"}
              onClick={() => setAdminTab("missions")}
              className={`h-12 px-6 rounded-xl font-bold transition-all gap-2 ${adminTab === "missions" ? "bg-white shadow-sm" : ""}`}
            >
              <List className="h-4 w-4" />
              Missions
            </Button>
            <Button
              variant={adminTab === "personnel" ? "secondary" : "ghost"}
              onClick={() => setAdminTab("personnel")}
              className={`h-12 px-6 rounded-xl font-bold transition-all gap-2 ${adminTab === "personnel" ? "bg-white shadow-sm" : ""}`}
            >
              <Users className="h-4 w-4" />
              Personnel
            </Button>
          </div>

          {adminTab === "missions" && (
            <div className="flex bg-slate-100 p-1.5 rounded-2xl">
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("table")}
                className={`h-10 w-10 rounded-xl transition-all ${viewMode === "table" ? "bg-white shadow-sm" : ""}`}
              >
                <List className="h-5 w-5" />
              </Button>
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setViewMode("grid")}
                className={`h-10 w-10 rounded-xl transition-all ${viewMode === "grid" ? "bg-white shadow-sm" : ""}`}
              >
                <LayoutGrid className="h-5 w-5" />
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => setShowSettings(true)}
            className="h-14 border-slate-200 text-slate-600 rounded-2xl gap-2 font-black uppercase text-xs tracking-widest px-6"
          >
            <Settings className="h-5 w-5" />
            Config
          </Button>

          <Button
            onClick={() =>
              exportToExcel(
                filteredData,
                "STLAF_Operations_Unified_Summary_2026",
              )
            }
            className="h-14 bg-navy-900 hover:bg-navy-800 rounded-2xl gap-2 font-black uppercase text-xs tracking-widest px-8 shadow-xl shadow-navy-900/10 group animate-pulse-subtle"
          >
            <Download className="h-5 w-5 group-hover:translate-y-1 transition-transform" />
            Export Unified logs
          </Button>
        </div>
      </div>

      {/* Stats Board (Only for Missions) */}
      {adminTab === "missions" && (
        <div className="grid gap-6 md:grid-cols-4">
          {[
            {
              label: "Total Operations",
              value: entries.length,
              color: "text-navy-900",
            },
            {
              label: "Total Cash Advance",
              value: `₱${entries.reduce((sum, e) => sum + (e.requestedCashAdvance || 0), 0).toLocaleString()}`,
              color: "text-blue-500",
            },
            {
              label: "Total Reimbursements",
              value: `₱${entries.reduce((sum, e) => sum + (e.reimbursements?.reduce((ss, r) => ss + r.amount, 0) || 0), 0).toLocaleString()}`,
              color: "text-indigo-600",
            },
            {
              label: "Liquidation Value",
              value: `₱${entries.reduce((sum, e) => sum + (e.liquidationItems?.reduce((ss, i) => ss + i.amount, 0) || 0), 0).toLocaleString()}`,
              color: "text-emerald-600",
              isLarge: true,
            },
          ].map((stat, i) => (
            <Card
              key={i}
              className="border-none bg-white shadow-sm overflow-hidden group"
            >
              <div className="h-1 bg-navy-900/10 group-hover:bg-navy-900 transition-colors" />
              <CardHeader className="p-6">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">
                  {stat.label}
                </div>
                <div className={`text-2xl font-black font-data ${stat.color}`}>
                  {stat.value}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Personnel Stats */}
      {adminTab === "personnel" && (
        <div className="grid gap-6 md:grid-cols-4">
          {[
            {
              label: "Total Enrolled",
              value: allUsers.length,
              color: "text-navy-900",
            },
            {
              label: "Administrators",
              value: allUsers.filter((u) => u.role === "admin").length,
              color: "text-red-500",
            },
            {
              label: "Standard Users",
              value: allUsers.filter((u) => u.role === "user").length,
              color: "text-blue-500",
            },
            {
              label: "Departments",
              value: new Set(allUsers.map((u) => u.department)).size,
              color: "text-amber-600",
            },
          ].map((stat, i) => (
            <Card
              key={i}
              className="border-none bg-white shadow-sm overflow-hidden group"
            >
              <div className="h-1 bg-navy-900/10 group-hover:bg-navy-900 transition-colors" />
              <CardHeader className="p-6">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 mb-1">
                  {stat.label}
                </div>
                <div className={`text-2xl font-black font-data ${stat.color}`}>
                  {stat.value}
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
          <Input
            placeholder={
              adminTab === "missions"
                ? "Search missions..."
                : "Search personnel by name, email, dept..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-14 pl-12 rounded-2xl border-slate-100 bg-white/50 backdrop-blur-sm focus:bg-white transition-all text-sm font-medium"
          />
        </div>
        {adminTab === "missions" && (
          <div className="flex gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="h-14 rounded-2xl border border-slate-100 font-bold gap-2 px-6 flex items-center justify-center bg-white hover:bg-slate-50 transition-colors">
                <Filter className="h-4 w-4" />
                Status: {statusFilter}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="rounded-2xl min-w-[200px] p-2">
                {[
                  "All",
                  "Draft",
                  "Ongoing",
                  "For Liquidation",
                  "Submitted",
                  "Approved",
                  "Rejected",
                ].map((s) => (
                  <DropdownMenuItem
                    key={s}
                    onClick={() => setStatusFilter(s as any)}
                    className="rounded-xl cursor-pointer"
                  >
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Content Area */}
      <AnimatePresence mode="wait">
        {/* Revision Notes Dialog */}
        <Dialog
          open={!!revisionEntryId}
          onOpenChange={(open) => !open && setRevisionEntryId(null)}
        >
          <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            <div className="h-2 bg-orange-500 w-full" />
            <div className="p-8 space-y-6">
              <DialogHeader>
                <DialogTitle className="text-2xl font-black text-navy-900 italic tracking-tight">
                  Revision Request.
                </DialogTitle>
                <DialogDescription className="font-medium text-slate-500">
                  Provide specific instructions on what needs to be fixed or
                  updated in this entry.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <Label className="micro-label text-orange-600">
                  Revision Notes
                </Label>
                <Textarea
                  placeholder="e.g., Please upload a clearer copy of the fuel receipt."
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  className="min-h-[150px] rounded-2xl bg-slate-50 border-none font-medium focus:ring-2 focus:ring-orange-200 transition-all"
                />
              </div>

              <DialogFooter className="flex flex-row gap-3 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setRevisionEntryId(null)}
                  className="flex-1 h-12 rounded-xl font-bold text-slate-400 hover:text-navy-900"
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitRevisionRequest}
                  disabled={isRevisionLoading}
                  className="flex-1 h-12 rounded-xl bg-orange-500 hover:bg-orange-600 font-bold text-white shadow-lg shadow-orange-500/20"
                >
                  {isRevisionLoading ? "Sending..." : "Send Request"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        {adminTab === "missions" ? (
          viewMode === "table" ? (
            <motion.div
              key="missionTable"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-xl shadow-navy-900/5 mb-20"
            >
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-50">
                      <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400 pl-8">
                        Mission Lead
                      </TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                        Destination
                      </TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                        Cash Advance
                      </TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                        Reimbursement
                      </TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                        Liquidation Value
                      </TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                        Audit Status
                      </TableHead>
                      <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400 text-right pr-8">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-20 text-xs font-black uppercase text-slate-300 tracking-widest italic animate-pulse"
                        >
                          Syncing Satellite Data...
                        </TableCell>
                      </TableRow>
                    ) : filteredData.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center py-20 text-xs font-black uppercase text-slate-300 tracking-widest italic"
                        >
                          No matching records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredData.map((item) => (
                        <TableRow
                          key={item.id}
                          className="hover:bg-slate-50/80 transition-colors border-slate-50 group"
                        >
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-3 py-2">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-navy-900 font-black text-xs">
                                {item.employeeName?.charAt(0)}
                              </div>
                              <div className="flex flex-col -space-y-0.5">
                                <span className="font-black text-navy-900 text-sm">
                                  {item.employeeName}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  {item.department}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-navy-900 text-sm">
                                {item.destination}
                              </span>
                              <span className="text-[10px] font-data text-slate-400">
                                {item.scheduleDate}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-data font-black text-navy-900">
                            ₱{item.requestedCashAdvance?.toLocaleString()}
                          </TableCell>
                          <TableCell className="font-data font-black text-indigo-600">
                            ₱
                            {(
                              item.reimbursements?.reduce(
                                (sum, r) => sum + r.amount,
                                0,
                              ) || 0
                            ).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-data font-black text-emerald-600">
                            ₱
                            {(
                              item.liquidationItems?.reduce(
                                (sum, i) => sum + i.amount,
                                0,
                              ) || 0
                            ).toLocaleString()}
                          </TableCell>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="text-right pr-8">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setSelectedEntry(item)}
                                className="h-10 w-10 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                              >
                                <Eye className="h-5 w-5" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger className="h-10 w-10 rounded-xl text-slate-400 hover:bg-slate-100 flex items-center justify-center transition-colors">
                                  <MoreVertical className="h-5 w-5" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="rounded-2xl p-2 min-w-[200px]"
                                >
                                  <div className="px-3 py-2 micro-label text-slate-300">
                                    Operational Decision
                                  </div>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUpdateStatus(item.id!, "Approved")
                                    }
                                    className="gap-3 text-emerald-600 cursor-pointer rounded-xl font-bold"
                                  >
                                    <CheckCircle className="h-4 w-4" /> Approve
                                    Mission
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUpdateStatus(
                                        item.id!,
                                        "Needs Revision",
                                      )
                                    }
                                    className="gap-3 text-orange-600 cursor-pointer rounded-xl font-bold"
                                  >
                                    <Clock className="h-4 w-4" /> Send for
                                    Revision
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUpdateStatus(item.id!, "Rejected")
                                    }
                                    className="gap-3 text-red-600 cursor-pointer rounded-xl font-bold"
                                  >
                                    <XCircle className="h-4 w-4" /> Abort /
                                    Reject
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-slate-100" />
                                  <div className="px-3 py-2 micro-label text-slate-300 font-normal">
                                    State Overrides
                                  </div>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUpdateStatus(
                                        item.id!,
                                        "For Liquidation",
                                      )
                                    }
                                    className="gap-3 text-amber-600 cursor-pointer rounded-xl font-bold"
                                  >
                                    <FileText className="h-4 w-4" /> Open for
                                    Liquidation
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleUpdateStatus(item.id!, "Ongoing")
                                    }
                                    className="gap-3 text-blue-600 cursor-pointer rounded-xl font-bold"
                                  >
                                    <ExternalLink className="h-4 w-4" /> Revive
                                    to Ongoing
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="missionGrid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-20"
            >
              {filteredData.map((item) => (
                <Card
                  key={item.id}
                  className="border-none bg-white shadow-xl shadow-navy-900/5 rounded-[2.5rem] overflow-hidden group hover:scale-[1.02] transition-all duration-500 cursor-pointer"
                  onClick={() => setSelectedEntry(item)}
                >
                  <CardHeader className="p-8 pb-4">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex flex-col -space-y-1">
                        <span className="micro-label opacity-40">
                          Ref: {item.id?.slice(0, 6)}
                        </span>
                        <span className="font-bold text-navy-900">
                          {item.employeeName}
                        </span>
                      </div>
                      {getStatusBadge(item.status)}
                    </div>
                    <CardTitle className="text-2xl font-black text-navy-900 tracking-tight leading-none italic group-hover:text-blue-600 transition-colors">
                      {item.destination}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-8 pb-8 space-y-6">
                    <p className="text-sm text-slate-500 line-clamp-2 min-h-[40px] font-medium leading-relaxed">
                      {item.purpose}
                    </p>
                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="micro-label">Cash Advance</div>
                        <div className="text-xl font-black font-data text-navy-900">
                          ₱{item.requestedCashAdvance?.toLocaleString()}
                        </div>
                      </div>
                      {item.liquidationItems && (
                        <div className="text-right space-y-1">
                          <div className="micro-label">Liquidation</div>
                          <div className="text-xl font-black font-data text-emerald-600">
                            ₱
                            {item.liquidationItems
                              .reduce((s, i) => s + i.amount, 0)
                              .toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </motion.div>
          )
        ) : (
          <motion.div
            key="personnelTable"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden shadow-xl shadow-navy-900/5 mb-20"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow className="hover:bg-transparent border-slate-50">
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400 pl-8">
                      Identity
                    </TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                      Department
                    </TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                      Contact Number
                    </TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                      Privilege
                    </TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400">
                      Join Date
                    </TableHead>
                    <TableHead className="font-black text-[9px] uppercase tracking-[0.2em] h-14 text-slate-400 text-right pr-8">
                      Management
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-20 text-xs font-black uppercase text-slate-300 tracking-widest italic"
                      >
                        No personnel found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => (
                      <TableRow
                        key={u.uid}
                        className="hover:bg-slate-50/80 transition-colors border-slate-50 group"
                      >
                        <TableCell className="pl-8">
                          <div className="flex items-center gap-3 py-2">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs ${u.role === "admin" ? "bg-red-50 text-red-600 border border-red-100" : "bg-slate-100 text-navy-900"}`}
                            >
                              {u.displayName?.charAt(0)}
                            </div>
                            <div className="flex flex-col -space-y-0.5">
                              <span className="font-black text-navy-900 text-sm">
                                {u.displayName}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 lowercase">
                                {u.email}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="rounded-md border-slate-100 text-slate-500 font-bold text-[9px] uppercase tracking-widest"
                          >
                            {u.department}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-data font-bold text-slate-500 text-xs">
                          {u.contactNumber || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {u.role === "admin" ? (
                              <div className="flex items-center gap-1.5 text-red-600 font-black text-[10px] uppercase tracking-tighter">
                                <ShieldAlert className="h-3 w-3" />
                                Admin
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-slate-400 font-black text-[10px] uppercase tracking-tighter">
                                <Users className="h-3 w-3" />
                                User
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-data font-bold text-slate-400 text-xs">
                          {u.createdAt?.toDate().toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="h-10 w-10 rounded-xl text-slate-400 hover:text-navy-900 hover:bg-slate-100 flex items-center justify-center transition-colors">
                              <UserCog className="h-5 w-5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-2xl p-2 min-w-[200px]"
                            >
                              <div className="px-3 py-2 micro-label text-slate-300">
                                Personnel Operations
                              </div>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditName(u.displayName || "");
                                  setEditDepartment(u.department || "");
                                  setEditContact(u.contactNumber || "");
                                }}
                                className="gap-3 text-slate-700 cursor-pointer rounded-xl font-bold"
                              >
                                <UserCog className="h-4 w-4" /> Edit Profile
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="bg-slate-100" />
                              <div className="px-3 py-2 micro-label text-slate-300">
                                Privilege Override
                              </div>
                              {u.role === "user" ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUpdateUserRole(u.uid, "admin")
                                  }
                                  className="gap-3 text-red-600 cursor-pointer rounded-xl font-bold"
                                >
                                  <Lock className="h-4 w-4" /> Promote to Admin
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    handleUpdateUserRole(u.uid, "user")
                                  }
                                  className="gap-3 text-slate-600 cursor-pointer rounded-xl font-bold"
                                >
                                  <Unlock className="h-4 w-4" /> Demote to User
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-slate-100" />
                              <DropdownMenuItem
                                onClick={() => handleDeleteUser(u.uid)}
                                className="gap-3 text-red-500 cursor-pointer rounded-xl font-bold hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" /> Purge from
                                Registry
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-2xl bg-white p-8 rounded-3xl border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black text-navy-900 tracking-tighter italic">
              System Configuration
            </DialogTitle>
            <DialogDescription className="text-lg font-medium text-slate-500">
              Manage backend settings and cloud integrations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
              <h3 className="font-bold text-navy-900 flex items-center gap-2">
                <Settings className="h-5 w-5" /> Storage Setup (Hidden from
                Users)
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                App files are uploaded to Google Drive. The system is reverting
                back to User Google Drive Login. Ensure that the users are
                authenticating their Google Drive upon login.
              </p>

              <div className="space-y-2 mt-4 bg-white p-4 rounded-xl border border-slate-100">
                <Label className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                  Base Drive Setup
                </Label>
                <div className="flex text-xs">
                  <p>
                    The system will automatically create an "STLAF" folder in
                    the root of the logged-in user's Google Drive, unless you
                    configure an explicit Parent Folder ID in your environment
                    variables.
                  </p>
                </div>
              </div>

              <div className="space-y-2 bg-white p-4 rounded-xl border border-slate-100">
                <Label className="text-xs uppercase tracking-widest text-slate-400 font-bold">
                  Override Folder ID (Optional)
                </Label>
                <p className="text-xs text-slate-500">
                  Open your{" "}
                  <span className="font-mono bg-slate-100 px-1 rounded">
                    .env
                  </span>{" "}
                  file in the AI Studio editor and set{" "}
                  <span className="font-mono bg-slate-100 px-1 rounded">
                    GOOGLE_DRIVE_PARENT_FOLDER_ID
                  </span>{" "}
                  to force uploads into a specific folder.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-8">
            <Button
              className="h-12 px-8 rounded-xl font-bold bg-navy-900 hover:bg-navy-800"
              onClick={() => setShowSettings(false)}
            >
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Personnel Profile Dialog */}
      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent className="rounded-[2.5rem] border-none bg-white p-8 max-w-md shadow-2xl">
          <DialogHeader className="space-y-3">
            <div className="w-12 h-12 bg-navy-900 rounded-2xl flex items-center justify-center text-white mb-2">
              <UserCog className="h-6 w-6" />
            </div>
            <DialogTitle className="text-2xl font-black text-navy-900 italic uppercase tracking-tighter">
              Edit Personnel Profile
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              Updating details for {editingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveUserEdit();
            }}
            className="space-y-6 my-6"
          >
            <div className="space-y-2">
              <Label
                htmlFor="edit-name"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900"
              >
                Full Name
              </Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full Name"
                className="h-12 rounded-xl bg-slate-50 border-none font-bold text-navy-950"
                required
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="edit-dept"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900"
              >
                Department
              </Label>
              <select
                id="edit-dept"
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value)}
                className="w-full h-12 px-4 rounded-xl bg-slate-50 border-none font-bold text-navy-950 focus:ring-2 focus:ring-navy-900 focus:outline-none"
                required
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
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="edit-contact"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-navy-900"
              >
                Contact Number
              </Label>
              <Input
                id="edit-contact"
                value={editContact}
                onChange={(e) => setEditContact(e.target.value)}
                placeholder="e.g. +63 912 345 6789"
                className="h-12 rounded-xl bg-slate-50 border-none font-bold text-navy-950"
                required
              />
            </div>

            <DialogFooter className="gap-3 sm:gap-0 pt-4 border-t border-slate-100">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditingUser(null)}
                className="rounded-xl font-bold uppercase tracking-wider text-xs h-12 px-6"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingUser}
                className="rounded-xl bg-navy-900 hover:bg-navy-800 text-white font-bold uppercase tracking-wider text-xs h-12 px-6"
              >
                {isSavingUser ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
