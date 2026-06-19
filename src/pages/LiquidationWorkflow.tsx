import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType, getErrorMessage } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  AlertCircle,
  ExternalLink,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../components/auth/AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { OperationalEntry, ReimbursementEntry, LiquidationItem, ProofSlip } from '../types';
import { CLIENT_MASTERLIST, ACCOUNT_CHOICES } from '../lib/constants';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Search, Check } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface Props {
  entry: OperationalEntry;
  onBack: () => void;
  onSuccess: () => void;
}

const FileThumbnail = ({ file }: { file: File }) => {
  const [url, setUrl] = useState<string>('');
  
  React.useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  
  if (!url) return <div className="w-full h-full bg-slate-100 animate-pulse" />;
  return <img src={url} alt="thumbnail" className="w-full h-full object-cover" />;
};

const LiquidationWorkflow: React.FC<Props> = ({ entry, onBack, onSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // 1: Reimbursements, 2: Liquidation, 3: Finalize
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [dbClients, setDbClients] = useState<string[]>([]);

  useEffect(() => {
    const qClients = query(collection(db, "clients"), orderBy("name", "asc"));
    const unsubscribe = onSnapshot(qClients, (snapshot) => {
      const records = snapshot.docs.map(doc => doc.data().name as string);
      setDbClients(records);
    }, (err) => {
      console.warn("Clients fetch warning in liquidation:", err);
    });
    return () => unsubscribe();
  }, []);

  const combinedClientOptions = useMemo(() => {
    const set = new Set([...CLIENT_MASTERLIST, ...dbClients]);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [dbClients]);

  // Field states
  const [hasReimbursements, setHasReimbursements] = useState(entry.hasReimbursements || false);
  const [reimbursements, setReimbursements] = useState<(ReimbursementEntry & { pendingFile?: File })[]>(entry.reimbursements || []);
  const [liquidationItems, setLiquidationItems] = useState<(LiquidationItem & { pendingFile?: File })[]>(entry.liquidationItems || [
    { 
      id: Math.random().toString(36).substr(2, 9), 
      dateOfReceipt: new Date().toISOString().split('T')[0],
      entity: 'CCT',
      department: 'Corporate',
      tinNo: '',
      supplierName: '',
      supplierAddress: '',
      account: '',
      taxType: 'VAT',
      billable: 'No',
      clientName: '',
      description: '',
      amount: 0 
    }
  ]);
  const [proofSlips, setProofSlips] = useState<(ProofSlip & { pendingFile?: File })[]>(entry.proofSlips || []);
  const [stepOneErrors, setStepOneErrors] = useState<Record<string, { purpose?: string; amount?: string; attachment?: string }>>({});
  const [stepTwoErrors, setStepTwoErrors] = useState<Record<string, { dateOfReceipt?: string; supplierName?: string; account?: string; amount?: string; attachment?: string }>>({});

  const handleStepOneContinue = () => {
    if (!hasReimbursements) {
      setStepOneErrors({});
      setStep(2);
      return;
    }

    const errors: Record<string, { purpose?: string; amount?: string; attachment?: string }> = {};
    let hasError = false;

    reimbursements.forEach(r => {
      const fieldErrors: { purpose?: string; amount?: string; attachment?: string } = {};
      if (!r.purpose || !r.purpose.trim()) {
        fieldErrors.purpose = "Purpose of reimbursement is required.";
        hasError = true;
      }
      if (!r.amount || r.amount <= 0) {
        fieldErrors.amount = "A valid positive reimbursement amount is required.";
        hasError = true;
      }
      if (!r.driveUrl && !r.pendingFile) {
        fieldErrors.attachment = "A clear receipt scan or image attachment is required.";
        hasError = true;
      }

      if (Object.keys(fieldErrors).length > 0) {
        errors[r.id] = fieldErrors;
      }
    });

    if (hasError) {
      setStepOneErrors(errors);
      toast.error("Please fill in all requested fields and attach supporting documents before proceeding.");
    } else {
      setStepOneErrors({});
      setStep(2);
    }
  };

  const handleStepTwoContinue = () => {
    const errors: Record<string, { dateOfReceipt?: string; supplierName?: string; account?: string; amount?: string; attachment?: string }> = {};
    let hasError = false;

    liquidationItems.forEach(item => {
      const fieldErrors: { dateOfReceipt?: string; supplierName?: string; account?: string; amount?: string; attachment?: string } = {};
      if (!item.dateOfReceipt) {
        fieldErrors.dateOfReceipt = "Date of receipt is required.";
        hasError = true;
      }
      if (!item.supplierName || !item.supplierName.trim()) {
        fieldErrors.supplierName = "A valid registered supplier name is required.";
        hasError = true;
      }
      if (!item.account) {
        fieldErrors.account = "Account classification is required.";
        hasError = true;
      }
      if (!item.amount || item.amount <= 0) {
        fieldErrors.amount = "A valid positive expense amount is required (greater than ₱0).";
        hasError = true;
      }
      if (!item.driveUrl && !item.pendingFile && !item.requiresProofSlip) {
        fieldErrors.attachment = "A valid receipt scan attachment or a marked Proof Slip explanation is required.";
        hasError = true;
      }

      if (Object.keys(fieldErrors).length > 0) {
        errors[item.id] = fieldErrors;
      }
    });

    if (hasError) {
      setStepTwoErrors(errors);
      toast.error("Please fill out all missing expense parameters and upload receipts before proceeding.");
    } else {
      setStepTwoErrors({});
      setStep(3);
    }
  };

  // Preview state
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string } | null>(null);

  const isDriveUrl = (url: string) => url.includes('drive.google.com');

  const getEmbedUrl = (url: string) => {
    if (isDriveUrl(url)) {
      const match = url.match(/\/d\/([^\/]+)/) || url.match(/id=([^&]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }
    return url;
  };

  const openPreview = (file: File | string, name: string) => {
    if (!file) return;
    if (typeof file === 'string') {
      setPreviewFile({ url: file, name });
    } else {
      setPreviewFile({ url: URL.createObjectURL(file), name });
    }
  };

  const closePreview = () => {
    if (previewFile && !previewFile.url.startsWith('http')) {
      URL.revokeObjectURL(previewFile.url);
    }
    setPreviewFile(null);
  };

  const uploadDirectToDrive = async (file: File, category: string, driveToken: string) => {
    const userName = user?.displayName || user?.email || 'Unknown';
    const formatDriveFileName = (origName: string, uName: string, cat: string) => {
      const dateStr = new Date().toISOString().split('T')[0];
      const nameParts = uName.trim().split(' ');
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : uName;
      const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join('_') : '';
      
      const sanitizedLastName = lastName.replace(/[^a-zA-Z0-9]/g, "");
      const sanitizedFirstName = firstName.replace(/[^a-zA-Z0-9]/g, "");
      
      const timestamp = Date.now();
      const lastDot = origName.lastIndexOf('.');
      const extension = lastDot !== -1 ? origName.substring(lastDot) : '';
      const docType = cat.replace(/_/g, "");
      return `${dateStr}_${sanitizedLastName}_${sanitizedFirstName}_${docType}_${timestamp.toString().slice(-4)}${extension}`;
    };

    const newFileName = formatDriveFileName(file.name, userName, category);

    const getOrCreateSTLAFFolder = async (token: string): Promise<string> => {
      try {
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name = 'STLAF' and mimeType = 'application/vnd.google-apps.folder' and trashed = false")}&fields=files(id)`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.files && searchData.files.length > 0) {
            return searchData.files[0].id;
          }
        }
        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: 'STLAF',
            mimeType: 'application/vnd.google-apps.folder'
          })
        });
        if (createRes.ok) {
          const createData = await createRes.json();
          return createData.id;
        }
      } catch (e) {
        console.warn("Client-side drive folder search failed:", e);
      }
      return 'root';
    };

    const stlafFolderId = await getOrCreateSTLAFFolder(driveToken);

    const metadata = {
      name: newFileName,
      mimeType: file.type,
      parents: [stlafFolderId],
    };
    
    const boundary = 'stlaf_workflow_multipart_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;
    
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base = result.split(',')[1];
        resolve(base);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Transfer-Encoding: base64\r\n' +
      'Content-Type: ' + file.type + '\r\n\r\n' +
      base64Data +
      close_delim;

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${driveToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!uploadRes.ok) {
      const errTxt = await uploadRes.text();
      throw new Error(`Direct Drive upload failed: ${errTxt}`);
    }

    const driveFile = await uploadRes.json();
    
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${driveFile.id}/permissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${driveToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'reader',
          type: 'anyone',
        }),
      });
    } catch (e) {
      console.warn("Direct upload permissions failed:", e);
    }

    return {
      fileId: driveFile.id,
      url: `https://drive.google.com/file/d/${driveFile.id}/view?usp=drivesdk`,
      fileName: newFileName,
      mimeType: file.type
    };
  };

  const handleFileUpload = async (file: File, category: string) => {
    if (!user) return null;
    const driveToken = localStorage.getItem('google_drive_token');
    
    if (!driveToken) {
      throw new Error("Google Drive session missing. Please reconnect your account.");
    }
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('year', new Date().getFullYear().toString());
      formData.append('month', ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][new Date().getMonth()]);
      formData.append('userName', user.displayName || user.email || 'Unknown');
      formData.append('entryId', entry.id!);
      formData.append('category', category);
      
      const isPending = entry.status !== 'Approved';
      formData.append('isPending', isPending.toString());

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Ensure cookies are sent for IAP
        headers: {
          'Authorization': `Bearer ${driveToken}`
        }
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        const bodyText = await response.text();
        
        if (bodyText.includes("Cookie check") || bodyText.includes("Action required") || response.status === 403 || response.status === 302) {
          console.warn("Proxy block detected, falling back to direct client-side Google Drive API upload...");
          const directFile = await uploadDirectToDrive(file, category, driveToken);
          toast.success("Uploaded directly to your Google Drive! (Bypassed system proxy)", { duration: 4000 });
          return directFile;
        }

        if (contentType && contentType.indexOf("application/json") !== -1) {
          try {
            const error = JSON.parse(bodyText);
            if (response.status === 401 || error.error === 'DRIVE_AUTH_ERROR') {
              localStorage.removeItem('google_drive_token');
              localStorage.removeItem('google_drive_token_expiry');
              throw new Error("Google Drive session expired. Please log out and log in again to refresh your connection.");
            }
            throw new Error(error.message || error.error || 'Upload failed');
          } catch (e: any) {
            if (e.message.includes("session expired")) throw e;
            throw new Error(`Upload failed with status ${response.status}: ${bodyText.slice(0, 50)}`);
          }
        } else {
          if (response.status === 413) throw new Error("File is too large.");
          throw new Error(`Upload failed with status ${response.status}: ${bodyText.slice(0, 50)}`);
        }
      }

      const bodyText = await response.text();
      let data;
      try {
        data = JSON.parse(bodyText);
      } catch (e) {
        console.error("Invalid JSON from Drive Upload:", response.status, bodyText);
        if (bodyText.includes("Cookie check") || bodyText.includes("Action required")) {
          console.warn("Proxy block detected, falling back to direct client-side Google Drive API upload...");
          const directFile = await uploadDirectToDrive(file, category, driveToken);
          toast.success("Uploaded directly to your Google Drive! (Bypassed system proxy)", { duration: 4000 });
          return { url: directFile.url, fileName: directFile.fileName, fileId: directFile.fileId, mimeType: file.type };
        }
        throw new Error(`Invalid JSON on success response: ${bodyText.slice(0, 100)}`);
      }
      return { url: data.url, fileName: data.fileName, fileId: data.fileId, mimeType: file.type };
    } catch (error: any) {
      console.error('Drive Upload Error:', error);
      if (error.name === 'TypeError' || error.message?.includes("Failed to fetch") || error.message?.includes("Cookie check") || error.message?.includes("cookies")) {
        try {
          console.warn("Fetch failed, attempting direct client-side Google Drive API upload fallback...");
          const directFile = await uploadDirectToDrive(file, category, driveToken);
          toast.success("Uploaded directly to your Google Drive! (Bypassed system proxy)", { duration: 4000 });
          return directFile;
        } catch (fallbackError: any) {
          console.error("Direct fallback also failed:", fallbackError);
          throw new Error(`Failed to upload file to Google Drive. Keep your browser in a new tab if you run into any issues. Direct upload failed: ${fallbackError.message}`);
        }
      }
      throw error;
    }
  };

  const addReimbursement = () => {
    setReimbursements([...reimbursements, { id: Math.random().toString(36).substr(2, 9), purpose: '', amount: 0 }]);
  };

  const deleteFileFromDrive = async (fileId: string) => {
    try {
      const driveToken = localStorage.getItem('google_drive_token');
      const response = await fetch('/api/delete-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(driveToken ? { 'Authorization': `Bearer ${driveToken}` } : {})
        },
        credentials: 'include',
        body: JSON.stringify({ fileId })
      });
      if (!response.ok) {
        console.warn("Delete file API error");
      }
    } catch (e) {
      console.warn("Delete file network error", e);
    }
  };

  const removeReimbursement = (id: string) => {
    const item = reimbursements.find(r => r.id === id);
    if (item?.driveFileId) {
      deleteFileFromDrive(item.driveFileId);
    }
    setReimbursements(reimbursements.filter(r => r.id !== id));
  };

  const addLiquidationItem = () => {
    setLiquidationItems([...liquidationItems, { 
      id: Math.random().toString(36).substr(2, 9), 
      dateOfReceipt: new Date().toISOString().split('T')[0],
      entity: 'CCT',
      department: 'Corporate',
      tinNo: '',
      supplierName: '',
      supplierAddress: '',
      account: '',
      taxType: 'VAT',
      billable: 'No',
      clientName: '',
      description: '',
      amount: 0 
    }]);
  };

  const removeLiquidationItem = (id: string) => {
    const item = liquidationItems.find(i => i.id === id);
    if (item?.driveFileId) {
      deleteFileFromDrive(item.driveFileId);
    }
    setLiquidationItems(liquidationItems.filter(i => i.id !== id));
    
    // Also remove associated proof slips
    const slip = proofSlips.find(p => p.id === id);
    if (slip?.driveFileId) {
      deleteFileFromDrive(slip.driveFileId);
    }
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
    const toastId = toast.loading("Processing attachments and finalizing report...");
    
    try {
      // 1. Process Pending Uploads
      const finalReimbursements = [...reimbursements];
      for (const r of finalReimbursements) {
        if (r.pendingFile) {
          const oldFileId = r.driveFileId;
          const res = await handleFileUpload(r.pendingFile, 'Reimbursements');
          if (res) {
             r.driveUrl = res.url;
             r.driveFileId = res.fileId;
             r.fileName = res.fileName;
             r.mimeType = res.mimeType;
             delete r.pendingFile;
             if (oldFileId && oldFileId !== res.fileId) {
               deleteFileFromDrive(oldFileId);
             }
          }
        }
      }

      const finalLiquidationItems = [...liquidationItems];
      for (const item of finalLiquidationItems) {
        if (item.pendingFile) {
          const oldFileId = item.driveFileId;
          const res = await handleFileUpload(item.pendingFile, 'Receipts');
          if (res) {
             item.driveUrl = res.url;
             item.driveFileId = res.fileId;
             item.fileName = res.fileName;
             item.mimeType = res.mimeType;
             delete item.pendingFile;
             if (oldFileId && oldFileId !== res.fileId) {
               deleteFileFromDrive(oldFileId);
             }
          }
        }
      }

      const finalProofSlips = [...proofSlips];
      for (const slip of finalProofSlips) {
        if (slip.pendingFile) {
          const oldFileId = slip.driveFileId;
          const res = await handleFileUpload(slip.pendingFile, 'Proof_Slips');
          if (res) {
             slip.driveUrl = res.url;
             slip.driveFileId = res.fileId;
             slip.fileName = res.fileName;
             slip.mimeType = res.mimeType;
             delete slip.pendingFile;
             if (oldFileId && oldFileId !== res.fileId) {
               deleteFileFromDrive(oldFileId);
             }
          }
        }
      }

      // 2. Update Firestore
      await updateDoc(doc(db, 'operational_entries', entry.id!), {
        hasReimbursements,
        reimbursements: finalReimbursements,
        liquidationItems: finalLiquidationItems,
        proofSlips: finalProofSlips,
        status: 'Submitted',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      toast.success("Operational entry submitted and archived!", { id: toastId });
      onSuccess();
    } catch (error: any) {
      const errorMessage = getErrorMessage(error);
      toast.error(`Submission failed: ${errorMessage}`, { id: toastId });
      
      // Only report as Firestore error if it's actually about Firestore
      if (error.code?.includes('permission-denied') || error.message?.includes('Firestore')) {
        handleFirestoreError(error, OperationType.WRITE, `operational_entries/${entry.id}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-4 h-full">
      <div className="flex items-center justify-between mb-8 px-4">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2 text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-navy-900 font-bold rounded-xl shadow-sm transition-all px-4 py-2 h-10">
          <ArrowLeft className="h-4 w-4" />
          Abort Liquidation
        </Button>
        <div className="flex items-center gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-1.5 w-12 rounded-full transition-all ${step >= i ? 'bg-navy-900' : 'bg-slate-100'}`} />
          ))}
        </div>
      </div>

      {entry.status === 'Needs Revision' && entry.adminNotes && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-orange-50 rounded-3xl border-2 border-orange-100 flex gap-4 mx-4"
        >
          <AlertCircle className="h-6 w-6 text-orange-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Revision Required</span>
            <p className="text-sm font-bold text-orange-900 italic line-clamp-3">
              {entry.adminNotes}
            </p>
          </div>
        </motion.div>
      )}

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
                <CardTitle className="text-4xl font-black text-navy-900 tracking-tighter italic"><span className="text-gold-500">Reimbursements.</span></CardTitle>
                <CardDescription className="text-slate-500 font-medium max-w-sm">
                  Did you spend personal funds that need company reimbursement?
                </CardDescription>
              </CardHeader>
              <CardContent className="px-10 pb-10 space-y-8">
                 <div className="flex items-center space-x-3 p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 transition-all hover:border-emerald-200">
                    <Checkbox 
                      id="hasReimbursements" 
                      className="h-6 w-6 rounded-lg border-2 border-slate-300" 
                      checked={!!hasReimbursements}
                      onCheckedChange={(val) => setHasReimbursements(!!val)}
                    />
                    <Label htmlFor="hasReimbursements" className="text-lg font-bold text-navy-900 cursor-pointer">
                      Yes, I have personal expenses to reimburse.
                    </Label>
                 </div>

                 {hasReimbursements && (
                   <div className="space-y-6">
                      <AnimatePresence>
                        {reimbursements.map((r, idx) => {
                          const errors = stepOneErrors[r.id];
                          return (
                            <motion.div 
                              key={r.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className={`p-6 bg-white border rounded-3xl space-y-4 shadow-sm relative group transition-all ${
                                errors ? "border-red-200 bg-red-50/5" : "border-slate-100"
                              }`}
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
                                    <Label className={`micro-label ${errors?.purpose ? "text-red-500 font-bold" : ""}`}>Purpose</Label>
                                    <Input 
                                      value={r.purpose}
                                      onChange={(e) => {
                                        const updated = reimbursements.map(item => item.id === r.id ? { ...item, purpose: e.target.value } : item);
                                        setReimbursements(updated);
                                        if (errors?.purpose) {
                                          setStepOneErrors(prev => {
                                            const copy = { ...prev };
                                            if (copy[r.id]) {
                                              const updatedRow = { ...copy[r.id] };
                                              delete updatedRow.purpose;
                                              if (Object.keys(updatedRow).length === 0) delete copy[r.id];
                                              else copy[r.id] = updatedRow;
                                            }
                                            return copy;
                                          });
                                        }
                                      }}
                                      placeholder="e.g., Extended Client Meeting Lunch"
                                      className={`h-12 rounded-xl font-bold border-2 transition-all ${
                                        errors?.purpose 
                                          ? "border-red-500 bg-red-50/10 focus-visible:ring-red-500" 
                                          : "border-transparent bg-slate-50 focus-visible:ring-2 focus-visible:ring-navy-900"
                                      }`}
                                    />
                                    {errors?.purpose && (
                                      <p className="text-red-500 font-bold text-[10px] mt-1 flex items-center gap-1 animate-pulse">
                                        <span className="shrink-0 bg-red-100 text-red-600 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px]">!</span>
                                        {errors.purpose}
                                      </p>
                                    )}
                                 </div>
                                <div className="space-y-2">
                                   <Label className={`micro-label font-bold italic ${errors?.amount ? "text-red-500" : "text-emerald-600"}`}>Amount (PHP)</Label>
                                   <div className="relative">
                                     <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black ${errors?.amount ? "text-red-500" : "text-emerald-600"}`}>₱</span>
                                     <Input 
                                       type="number"
                                       value={r.amount || ""}
                                       onChange={(e) => {
                                         const val = e.target.value === "" ? 0 : Number(e.target.value);
                                         const updated = reimbursements.map(item => item.id === r.id ? { ...item, amount: val } : item);
                                         setReimbursements(updated);
                                         if (errors?.amount) {
                                           setStepOneErrors(prev => {
                                             const copy = { ...prev };
                                             if (copy[r.id]) {
                                               const updatedRow = { ...copy[r.id] };
                                               delete updatedRow.amount;
                                               if (Object.keys(updatedRow).length === 0) delete copy[r.id];
                                               else copy[r.id] = updatedRow;
                                             }
                                             return copy;
                                           });
                                         }
                                       }}
                                       className={`h-12 pl-10 rounded-xl border-2 text-xl font-black font-data transition-all ${
                                         errors?.amount 
                                           ? "border-red-500 bg-red-50/10 text-red-900 focus-visible:ring-red-550" 
                                           : "border-transparent bg-emerald-50/50 text-emerald-900 focus-visible:ring-emerald-550"
                                       }`}
                                     />
                                   </div>
                                    {errors?.amount && (
                                      <p className="text-red-500 font-bold text-[10px] mt-1 flex items-center gap-1 animate-pulse">
                                        <span className="shrink-0 bg-red-100 text-red-600 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px]">!</span>
                                        {errors.amount}
                                      </p>
                                    )}
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
                                     className="h-12 rounded-xl bg-slate-50 border-none font-medium text-navy-900 focus-visible:ring-2 focus-visible:ring-navy-900"
                                   />
                                </div>
                                <div className="space-y-2">
                                   <Label className={`micro-label ${errors?.attachment ? "text-red-500 font-bold" : ""}`}>Attachment</Label>
                                   {(r.driveUrl || r.pendingFile) ? (
                                     <div className="h-12 flex items-center justify-between px-3 bg-emerald-50 rounded-xl border-2 border-emerald-100">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                           <div 
                                             className="w-8 h-8 rounded-lg bg-emerald-100 flex-shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
                                             onClick={() => openPreview(r.driveUrl!, r.fileName!)}
                                           >
                                             {r.pendingFile ? (
                                               <FileThumbnail file={r.pendingFile} />
                                             ) : (
                                               <Camera className="h-4 w-4 m-auto text-emerald-500" />
                                             )}
                                           </div>
                                           <span className="text-[10px] font-bold text-emerald-700 truncate max-w-[100px]">{r.fileName}</span>
                                        </div>
                                       <div className="flex items-center gap-2">
                                           <Button 
                                             type="button"
                                             size="sm" 
                                             variant="ghost" 
                                             className="h-7 px-2 text-[9px] font-bold uppercase text-emerald-600 hover:bg-emerald-100"
                                             onClick={() => openPreview(r.driveUrl!, r.fileName!)}
                                           >
                                             View
                                           </Button>
                                           <BadgeCheck className="h-4 w-4 text-emerald-500" />
                                           <Button 
                                             type="button"
                                             size="sm" 
                                             variant="ghost" 
                                             onClick={() => {
                                               if (r.driveFileId) deleteFileFromDrive(r.driveFileId);
                                               const updated = reimbursements.map(item => item.id === r.id ? { ...item, driveUrl: '', driveFileId: '', fileName: '', pendingFile: undefined, mimeType: '' } : item);
                                               setReimbursements(updated);
                                             }}
                                             className="h-8 w-8 text-emerald-400"
                                           >
                                              <X className="h-4 w-4" />
                                           </Button>
                                        </div>
                                     </div>
                                   ) : (
                                     <div className="relative h-12">
                                       <input 
                                         type="file" 
                                         accept="image/*"
                                         className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                         onChange={(e) => {
                                           const file = e.target.files?.[0];
                                           if (file) {
                                             const updated = reimbursements.map(item => item.id === r.id ? { 
                                               ...item, 
                                               pendingFile: file,
                                               fileName: file.name
                                             } : item);
                                             setReimbursements(updated);
                                             if (errors?.attachment) {
                                               setStepOneErrors(prev => {
                                                 const copy = { ...prev };
                                                 if (copy[r.id]) {
                                                   const updatedRow = { ...copy[r.id] };
                                                   delete updatedRow.attachment;
                                                   if (Object.keys(updatedRow).length === 0) delete copy[r.id];
                                                   else copy[r.id] = updatedRow;
                                                 }
                                                 return copy;
                                               });
                                             }
                                           }
                                         }}
                                       />
                                       <div className={`h-full flex items-center justify-center gap-2 border-2 border-dashed rounded-xl text-xs font-bold transition-all ${
                                         errors?.attachment 
                                           ? "border-red-500 bg-red-50/10 text-red-500 hover:bg-red-50/20" 
                                           : "border-slate-200 text-slate-400 hover:border-navy-900 hover:text-navy-900"
                                       }`}>
                                         <Upload className="h-4 w-4" />
                                         Select Receipt
                                       </div>
                                     </div>
                                   )}
                                    {errors?.attachment && (
                                      <p className="text-red-500 font-bold text-[10px] mt-1 flex items-center gap-1 animate-pulse">
                                        <span className="shrink-0 bg-red-100 text-red-600 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px]">!</span>
                                        {errors.attachment}
                                      </p>
                                    )}
                                </div>
                             </div>
                           </motion.div>
                         );
                        })}
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
                   onClick={handleStepOneContinue}
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
              <div className="h-2 bg-gold-500 w-full" />
              <CardHeader className="p-10">
                <CardTitle className="text-4xl font-black text-navy-900 tracking-tighter italic"><span className="text-gold-500">PCF Liquidation.</span></CardTitle>
                <CardDescription className="text-slate-500 font-medium max-w-sm">
                  Break down all petty cash expenses. Upload receipts for every transaction.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-10 pb-10 space-y-6">
                 <AnimatePresence>
                    {liquidationItems.map((item, idx) => {
                      const errors = stepTwoErrors[item.id];
                      return (
                        <motion.div 
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`p-8 rounded-[2.5rem] border space-y-6 relative group transition-all ${
                            errors ? "border-red-200 bg-red-50/5" : "border-slate-100 bg-slate-50/50"
                          }`}
                        >
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeLiquidationItem(item.id)}
                          className="absolute top-6 right-6 h-10 w-10 text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                        
                        <div className="grid gap-6 md:grid-cols-4">
                           <div className="space-y-2 md:col-span-1">
                              <Label className={`micro-label ${errors?.dateOfReceipt ? "text-red-500 font-bold" : ""}`}>Date of Receipt</Label>
                              <Input 
                                type="date"
                                value={item.dateOfReceipt}
                                onChange={(e) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, dateOfReceipt: e.target.value } : li);
                                  setLiquidationItems(updated);
                                  if (errors?.dateOfReceipt) {
                                    setStepTwoErrors(prev => {
                                      const copy = { ...prev };
                                      if (copy[item.id]) {
                                        const updatedRow = { ...copy[item.id] };
                                        delete updatedRow.dateOfReceipt;
                                        if (Object.keys(updatedRow).length === 0) delete copy[item.id];
                                        else copy[item.id] = updatedRow;
                                      }
                                      return copy;
                                    });
                                  }
                                }}
                                className={`h-12 rounded-xl font-bold font-data border-2 transition-all ${
                                  errors?.dateOfReceipt 
                                    ? "border-red-500 bg-red-50/10 focus-visible:ring-red-500 text-red-900" 
                                    : "border-transparent bg-white focus-visible:ring-2 focus-visible:ring-navy-900"
                                }`}
                              />
                              {errors?.dateOfReceipt && (
                                <p className="text-red-500 font-bold text-[9px] mt-1 flex items-center gap-1 animate-pulse">
                                  <span className="shrink-0 bg-red-100 text-red-600 w-3 h-3 rounded-full flex items-center justify-center text-[8px]">!</span>
                                  {errors.dateOfReceipt}
                                </p>
                              )}
                           </div>
                           <div className="space-y-2">
                              <Label className="micro-label">Entity</Label>
                              <Select 
                                value={item.entity} 
                                onValueChange={(val) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, entity: val as 'CCT' } : li);
                                  setLiquidationItems(updated);
                                }}
                              >
                                <SelectTrigger className="h-12 rounded-xl bg-white border-none font-bold">
                                  <SelectValue placeholder="Select Entity" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl bg-white">
                                  <SelectItem value="CCT">CCT</SelectItem>
                                </SelectContent>
                              </Select>
                           </div>
                           <div className="space-y-2 col-span-2">
                              <Label className="micro-label">Department</Label>
                              <Select 
                                value={item.department} 
                                onValueChange={(val) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, department: val as 'Corporate' } : li);
                                  setLiquidationItems(updated);
                                }}
                              >
                                <SelectTrigger className="h-12 rounded-xl bg-white border-none font-bold">
                                  <SelectValue placeholder="Select Dept" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl bg-white">
                                  <SelectItem value="Corporate">Corporate</SelectItem>
                                </SelectContent>
                              </Select>
                           </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                           <div className="space-y-2">
                              <Label className="micro-label">TIN No. of Supplier</Label>
                              <Input 
                                value={item.tinNo}
                                onChange={(e) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, tinNo: e.target.value } : li);
                                  setLiquidationItems(updated);
                                }}
                                placeholder="e.g., 001-234-567-000"
                                className="h-12 rounded-xl bg-white border-none font-bold"
                              />
                           </div>
                           <div className="space-y-2">
                              <Label className={`micro-label ${errors?.supplierName ? "text-red-500 font-bold" : ""}`}>Supplier's Name</Label>
                              <Input 
                                value={item.supplierName}
                                onChange={(e) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, supplierName: e.target.value } : li);
                                  setLiquidationItems(updated);
                                  if (errors?.supplierName) {
                                    setStepTwoErrors(prev => {
                                      const copy = { ...prev };
                                      if (copy[item.id]) {
                                        const updatedRow = { ...copy[item.id] };
                                        delete updatedRow.supplierName;
                                        if (Object.keys(updatedRow).length === 0) delete copy[item.id];
                                        else copy[item.id] = updatedRow;
                                      }
                                      return copy;
                                    });
                                  }
                                }}
                                placeholder="e.g., Shell SLEX"
                                className={`h-12 rounded-xl font-bold border-2 transition-all ${
                                  errors?.supplierName 
                                    ? "border-red-500 bg-red-50/10 focus-visible:ring-red-500 text-red-900" 
                                    : "border-transparent bg-white focus-visible:ring-2 focus-visible:ring-navy-900"
                                }`}
                              />
                              {errors?.supplierName && (
                                <p className="text-red-500 font-bold text-[9px] mt-1 flex items-center gap-1 animate-pulse">
                                  <span className="shrink-0 bg-red-100 text-red-600 w-3 h-3 rounded-full flex items-center justify-center text-[8px]">!</span>
                                  {errors.supplierName}
                                </p>
                              )}
                           </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2">
                           <div className="space-y-2">
                              <Label className="micro-label">Supplier's Address</Label>
                              <Input 
                                value={item.supplierAddress}
                                onChange={(e) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, supplierAddress: e.target.value } : li);
                                  setLiquidationItems(updated);
                                }}
                                placeholder="Full supplier address"
                                className="h-12 rounded-xl bg-white border-none font-bold"
                              />
                           </div>
                           <div className="space-y-2">
                              <Label className={`micro-label ${errors?.account ? "text-red-500 font-bold" : ""}`}>Account</Label>
                              <Select 
                                value={item.account} 
                                onValueChange={(val) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, account: val } : li);
                                  setLiquidationItems(updated);
                                  if (errors?.account) {
                                    setStepTwoErrors(prev => {
                                      const copy = { ...prev };
                                      if (copy[item.id]) {
                                        const updatedRow = { ...copy[item.id] };
                                        delete updatedRow.account;
                                        if (Object.keys(updatedRow).length === 0) delete copy[item.id];
                                        else copy[item.id] = updatedRow;
                                      }
                                      return copy;
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className={`h-12 rounded-xl font-bold border-2 transition-all ${
                                  errors?.account 
                                    ? "border-red-500 bg-red-50/10 focus-visible:ring-red-500 text-red-900 animate-pulse" 
                                    : "border-transparent bg-white focus-visible:ring-2 focus-visible:ring-navy-900"
                                }`}>
                                  <SelectValue placeholder="Select Account" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-none shadow-xl bg-white">
                                  {ACCOUNT_CHOICES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              {errors?.account && (
                                <p className="text-red-500 font-bold text-[9px] mt-1 flex items-center gap-1 animate-pulse">
                                  <span className="shrink-0 bg-red-100 text-red-600 w-3 h-3 rounded-full flex items-center justify-center text-[8px]">!</span>
                                  {errors.account}
                                </p>
                              )}
                           </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-4">
                           <div className="space-y-2 col-span-2">
                              <Label className="micro-label">VAT / NON-VAT</Label>
                              <RadioGroup 
                                value={item.taxType} 
                                onValueChange={(val) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, taxType: val as 'VAT' | 'NON-VAT' } : li);
                                  setLiquidationItems(updated);
                                }}
                                className="flex items-center gap-6 h-12 px-4 bg-white rounded-xl"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="VAT" id={`vat-${item.id}`} className="border-2 text-navy-900" />
                                  <Label htmlFor={`vat-${item.id}`} className="font-bold text-navy-900 cursor-pointer">VAT</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="NON-VAT" id={`non-vat-${item.id}`} className="border-2 text-navy-900" />
                                  <Label htmlFor={`non-vat-${item.id}`} className="font-bold text-navy-900 cursor-pointer">NON-VAT</Label>
                                </div>
                              </RadioGroup>
                           </div>
                           <div className="space-y-2 col-span-2">
                              <Label className="micro-label">Billable</Label>
                              <RadioGroup 
                                value={item.billable} 
                                onValueChange={(val) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, billable: val as 'Yes' | 'No' } : li);
                                  setLiquidationItems(updated);
                                }}
                                className="flex items-center gap-6 h-12 px-4 bg-white rounded-xl"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="Yes" id={`yes-${item.id}`} className="border-2 text-navy-900" />
                                  <Label htmlFor={`yes-${item.id}`} className="font-bold text-navy-900 cursor-pointer">Yes</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="No" id={`no-${item.id}`} className="border-2 text-navy-900" />
                                  <Label htmlFor={`no-${item.id}`} className="font-bold text-navy-900 cursor-pointer">No</Label>
                                </div>
                              </RadioGroup>
                           </div>
                        </div>

                        {item.taxType === 'VAT' ? (
                          <div className="grid gap-6 md:grid-cols-2">
                             <div className="space-y-2">
                                <Label className="micro-label">VAT Exclusive Amount</Label>
                                <Input 
                                  type="number"
                                  value={item.vatExclusive}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const updated = liquidationItems.map(li => li.id === item.id ? { 
                                      ...li, 
                                      vatExclusive: val,
                                      amount: val + (li.vatAmount || 0)
                                    } : li);
                                    setLiquidationItems(updated);
                                  }}
                                  placeholder="0.00"
                                  className="h-12 rounded-xl bg-white border-none font-bold"
                                />
                             </div>
                             <div className="space-y-2">
                                <Label className="micro-label">VAT Amount</Label>
                                <Input 
                                  type="number"
                                  value={item.vatAmount}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const updated = liquidationItems.map(li => li.id === item.id ? { 
                                      ...li, 
                                      vatAmount: val,
                                      amount: (li.vatExclusive || 0) + val
                                    } : li);
                                    setLiquidationItems(updated);
                                  }}
                                  placeholder="0.00"
                                  className="h-12 rounded-xl bg-white border-none font-bold"
                                />
                             </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                             <Label className="micro-label">NON-VAT Amount</Label>
                             <Input 
                               type="number"
                               value={item.nonVatAmount}
                               onChange={(e) => {
                                 const val = Number(e.target.value);
                                 const updated = liquidationItems.map(li => li.id === item.id ? { 
                                   ...li, 
                                   nonVatAmount: val,
                                   amount: val
                                 } : li);
                                 setLiquidationItems(updated);
                               }}
                               placeholder="0.00"
                               className="h-12 rounded-xl bg-white border-none font-bold"
                             />
                          </div>
                        )}

                        <div className="grid gap-6 md:grid-cols-2">
                           <div className="space-y-2">
                              <Label className="micro-label">Invoice No.</Label>
                              <Input 
                                value={item.invoiceNo || ''}
                                onChange={(e) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, invoiceNo: e.target.value } : li);
                                  setLiquidationItems(updated);
                                }}
                                placeholder="Official Receipt / Invoice No."
                                className="h-12 rounded-xl bg-white border-none font-bold"
                              />
                           </div>
                           <div className="space-y-2">
                              <Label className="micro-label">Client Name</Label>
                              <Input 
                                value={item.clientName || ''}
                                onChange={(e) => {
                                  const updated = liquidationItems.map(li => li.id === item.id ? { ...li, clientName: e.target.value } : li);
                                  setLiquidationItems(updated);
                                }}
                                list="pcf-client-names"
                                placeholder="Search or enter Client Name"
                                className="h-12 rounded-xl bg-white border-none font-bold text-navy-900"
                              />
                              <datalist id="pcf-client-names">
                                {combinedClientOptions.map((client) => (
                                  <option key={client} value={client} />
                                ))}
                              </datalist>

                           </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2 items-end">
                           <div className="space-y-2">
                              <Label className={`micro-label font-bold italic ${errors?.amount ? "text-red-500" : "text-amber-600"}`}>Total Amount (PHP)</Label>
                              <div className="relative">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black ${errors?.amount ? "text-red-500" : "text-amber-600"}`}>₱</span>
                                <Input 
                                  type="number"
                                  readOnly
                                  value={item.amount}
                                  className={`h-14 pl-10 rounded-xl text-2xl font-black font-data cursor-not-allowed border-2 transition-all ${
                                    errors?.amount 
                                      ? "border-red-500 bg-red-50/10 text-red-900" 
                                      : "border-transparent bg-white/50 text-navy-900"
                                  }`}
                                />
                              </div>
                              {errors?.amount && (
                                <p className="text-red-500 font-bold text-[9px] mt-1 flex items-center gap-1 animate-pulse">
                                  <span className="shrink-0 bg-red-100 text-red-600 w-3 h-3 rounded-full flex items-center justify-center text-[8px]">!</span>
                                  {errors.amount}
                                </p>
                              )}
                           </div>
                           <div className="space-y-2">
                              <Label className="micro-label">Receipt Proof</Label>
                              {!item.requiresProofSlip ? (
                                (item.driveUrl || item.pendingFile) ? (
                                  <div className="h-14 flex items-center justify-between px-3 bg-emerald-50 rounded-xl border-2 border-emerald-100">
                                     <div className="flex items-center gap-2 overflow-hidden">
                                        <div 
                                          className="w-10 h-10 rounded-lg bg-emerald-100 flex-shrink-0 overflow-hidden cursor-pointer hover:ring-2 hover:ring-emerald-400 transition-all"
                                          onClick={() => openPreview(item.driveUrl!, item.fileName!)}
                                        >
                                          {item.pendingFile ? (
                                            <FileThumbnail file={item.pendingFile} />
                                          ) : (
                                            <Camera className="h-5 w-5 m-auto text-emerald-500" />
                                          )}
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-[10px] font-bold text-emerald-700 truncate max-w-[120px]">{item.fileName}</span>
                                          <Button 
                                            size="sm" 
                                            variant="link" 
                                            className="h-auto p-0 text-[8px] font-black uppercase text-emerald-500 justify-start"
                                            onClick={() => openPreview(item.driveUrl!, item.fileName!)}
                                          >
                                            Preview Image
                                          </Button>
                                        </div>
                                     </div>
                                     <div className="flex items-center gap-2">
                                       <BadgeCheck className="h-4 w-4 text-emerald-500" />
                                       <Button 
                                         size="sm" 
                                         variant="ghost" 
                                         onClick={() => {
                                           if (item.driveFileId) deleteFileFromDrive(item.driveFileId);
                                           const updated = liquidationItems.map(li => li.id === item.id ? { ...li, driveUrl: '', driveFileId: '', fileName: '', pendingFile: undefined, mimeType: '' } : li);
                                           setLiquidationItems(updated);
                                         }}
                                         className="h-8 w-8 text-emerald-400"
                                       >
                                          <X className="h-4 w-4" />
                                       </Button>
                                     </div>
                                  </div>
                                ) : (
                                   <>
                                     <div className="relative h-14">
                                       <input 
                                      type="file" 
                                      accept="image/*"
                                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          const updated = liquidationItems.map(li => li.id === item.id ? { 
                                            ...li, 
                                            pendingFile: file,
                                            fileName: file.name
                                          } : li);
                                          setLiquidationItems(updated);
                                          if (errors?.attachment) {
                                            setStepTwoErrors(prev => {
                                              const copy = { ...prev };
                                              if (copy[item.id]) {
                                                const updatedRow = { ...copy[item.id] };
                                                delete updatedRow.attachment;
                                                if (Object.keys(updatedRow).length === 0) delete copy[item.id];
                                                else copy[item.id] = updatedRow;
                                              }
                                              return copy;
                                            });
                                          }
                                        }
                                      }}
                                    />
                                    <div className={`h-full flex items-center justify-center gap-2 border-2 border-dashed rounded-xl text-xs font-bold transition-all ${
                                      errors?.attachment 
                                        ? "border-red-500 bg-red-50/10 text-red-500 hover:bg-red-50/20" 
                                        : "border-slate-200 bg-white text-slate-400 hover:border-navy-900 hover:text-navy-900"
                                    }`}>
                                      <Camera className="h-5 w-5" />
                                      Snap Receipt
                                     </div>
                                   </div>
                                   {errors?.attachment && (
                                    <p className="text-red-500 font-bold text-[9px] mt-1 flex items-center gap-1 animate-pulse">
                                      <span className="shrink-0 bg-red-100 text-red-600 w-3 h-3 rounded-full flex items-center justify-center text-[8px]">!</span>
                                      {errors.attachment}
                                    </p>
                                  )}
                                   </>
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
                             checked={!!item.requiresProofSlip}
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
                    );
                   })}
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
                   onClick={handleStepTwoContinue}
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
              <div className="h-2 bg-gold-500 w-full" />
              <CardHeader className="p-10 text-center">
                 <div className="mx-auto w-20 h-20 bg-navy-900 rounded-[2rem] flex items-center justify-center text-white mb-6">
                    <BadgeCheck className="h-10 w-10" />
                 </div>
                <CardTitle className="text-5xl font-black text-navy-900 tracking-tighter italic leading-none">Ready for <br /><span className="text-gold-500">Submission.</span></CardTitle>
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
      
      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-slate-950/95 backdrop-blur-md"
            onClick={closePreview}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative max-w-4xl w-full h-full max-h-[90vh] bg-white rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-navy-900 font-bold tracking-tight">Attachment Preview</h3>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">{previewFile.name}</p>
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={closePreview} 
                  className="rounded-full w-10 h-10 hover:bg-slate-100 transition-colors"
                >
                  <X className="h-5 w-5 text-slate-500" />
                </Button>
              </div>

              {/* Preview Area */}
              <div className="flex-1 overflow-auto bg-slate-900 flex items-center justify-center relative p-8">
                {isDriveUrl(previewFile.url) ? (
                  <iframe 
                    src={getEmbedUrl(previewFile.url)} 
                    className="w-full h-full min-h-[500px] rounded-2xl border-none shadow-2xl bg-white"
                    allow="autoplay"
                    title="Document Preview"
                  />
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative group"
                  >
                    <img 
                      src={previewFile.url} 
                      alt="preview" 
                      className="max-w-full max-h-[65vh] object-contain rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)]"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://placehold.co/600x400?text=Preview+Not+Available";
                      }}
                    />
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="px-8 py-6 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                 <div className="hidden md:flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Secure Cloud Preview</span>
                 </div>
                 <div className="flex items-center gap-3 w-full md:w-auto">
                   <Button variant="outline" onClick={closePreview} className="flex-1 md:flex-none rounded-2xl font-bold h-12 px-8 border-2 border-slate-200 hover:bg-slate-50 transition-all">
                     Close
                   </Button>
                   {previewFile.url.startsWith('http') && (
                     <a 
                       href={previewFile.url} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className={cn(
                         buttonVariants({ variant: "default" }), 
                         "flex-1 md:flex-none rounded-2xl bg-navy-900 hover:bg-navy-800 font-bold h-12 px-8 shadow-lg shadow-navy-900/20 transition-all hover:scale-[1.02] active:scale-[0.98] inline-flex items-center gap-2 text-white"
                       )}
                     >
                       <ExternalLink className="h-4 w-4" />
                       View Original
                     </a>
                   )}
                 </div>
              </div>
            </motion.div>
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
