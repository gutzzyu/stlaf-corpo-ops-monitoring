import express from "express";
import path from "path";
import cors from "cors";
import multer from "multer";
import { google } from "googleapis";
import admin from "firebase-admin";
import { createServer as createViteServer } from "vite";
import fs from "fs";

// Support for local config file if it exists
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.warn("Could not load firebase-applet-config.json for server init");
}

// Initialize Firebase Admin
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ?.replace(/\\n/g, '\n')
  ?.replace(/^"(.*)"$/, '$1')
  ?.replace(/^'(.*)'$/, '$1')
  ?.replace(/\\"/g, '"');

if (email && privateKey && !admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
        clientEmail: email,
        privateKey: privateKey,
      }),
      storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
    });
    console.log("Firebase Admin initialized successfully.");
  } catch (e) {
    console.error("Firebase Admin initialization failed:", e);
  }
}

const firestoreDatabaseId = process.env.VITE_FIREBASE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';

// Initialize express
const app = express();
const PORT = 3000;

// Multer setup for handling memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Google Drive Auth helper
const getDriveService = (accessToken?: string) => {
  if (accessToken && accessToken !== "null" && accessToken !== "undefined" && accessToken.trim() !== "") {
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return {
      drive: google.drive({ version: "v3", auth: oauth2Client }),
      isServiceAccount: false
    };
  }

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ?.replace(/\\n/g, '\n')
    ?.replace(/^"(.*)"$/, '$1')
    ?.replace(/^'(.*)'$/, '$1')
    ?.replace(/\\"/g, '"');

  if (!email || !privateKey) {
    return { 
      drive: null, 
      isServiceAccount: false,
      error: "Google Drive session missing. Service Account not configured and no user token provided." 
    };
  }

  console.log(`Initializing Service Account: ${email}`);
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive"
    ],
  });

  return { 
    drive: google.drive({ version: "v3", auth }), 
    isServiceAccount: true 
  };
};

// Helper: Safely validate if a parent folder exists and is accessible
async function getValidatedParentId(drive: any, parentId?: string) {
  // Clean the ID in case it has quotes or whitespace from env
  const cleanId = parentId?.trim().replace(/^["'](.*)["']$/, '$1');
  if (!cleanId || cleanId === "root") return undefined;
  
  try {
    const res = await drive.files.get({ 
      fileId: cleanId, 
      fields: "id, name, trashed, driveId, mimeType",
      supportsAllDrives: true 
    });
    
    if (res.data.trashed) {
      throw new Error(`Parent folder ${cleanId} ("${res.data.name}") is in the trash.`);
    }
    
    return cleanId;
  } catch (error: any) {
    console.error(`[Drive Error] getValidatedParentId (${cleanId}):`, error.message, "Status:", error.code || error.status);
    if (error.message?.includes("invalid authentication credentials") || error.code === 401 || error.status === 401) {
      const e = new Error("DRIVE_AUTH_ERROR");
      (e as any).status = 401;
      throw e;
    }
    throw new Error(`Google Drive Folder Details Error: ${error.message}
If you are using a Service Account, ensure that you have shared the folder "${cleanId}" with your Service Account email, giving it the "Editor" role.`);
  }
}

// Helper: Find or create a folder by name inside a parent
async function findOrCreateFolder(drive: any, name: string, parentId?: string) {
  try {
    // sanitize name to avoid injection errors in query
    const safeName = name.replace(/'/g, "\\'");
    
    // If parentId is provided, we should ensure it's still valid/accessible
    let validatedParentId = parentId;
    if (parentId) {
      await drive.files.get({ fileId: parentId, fields: "id", supportsAllDrives: true });
    }

    const q = `name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${validatedParentId || "root"}' in parents`;
    const res = await drive.files.list({ 
      q, 
      fields: "files(id, name)", 
      supportsAllDrives: true, 
      includeItemsFromAllDrives: true,
      pageSize: 1
    });
    
    if (res.data.files && res.data.files.length > 0) {
      return res.data.files[0].id;
    }

    const fileMetadata = {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: validatedParentId ? [validatedParentId] : undefined,
    };

    const folder = await drive.files.create({
      requestBody: fileMetadata,
      fields: "id",
      supportsAllDrives: true
    });

    return folder.data.id;
  } catch (error: any) {
    console.error(`[Drive Error] findOrCreateFolder (${name}):`, error.message, "Status:", error.code || error.status);
    if (error.message?.includes("invalid authentication credentials") || error.code === 401 || error.status === 401) {
      const err = new Error("DRIVE_AUTH_ERROR");
      (err as any).status = 401;
      throw err;
    }
    throw new Error(`Folder operation failed for "${name}": ${error.message}`);
  }
}

app.use(cors());
app.use(express.json());

// API: Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API: Delete File from Drive
app.post("/api/delete-file", async (req, res) => {
  const { fileId } = req.body;
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!fileId) {
    return res.status(400).json({ error: "File ID is required" });
  }

  try {
    const driveResult = getDriveService(accessToken);
    const { drive, error: authError } = driveResult;
    
    if (!drive) {
      return res.status(401).json({ error: "Drive Auth Failed", message: authError || "Drive session missing" });
    }

    await drive.files.delete({ fileId, supportsAllDrives: true });
    res.json({ success: true, message: "File deleted successfully" });
  } catch (error: any) {
    console.error("Delete File Error:", error);
    if (error.message?.includes("invalid authentication credentials") || error.code === 401 || error.status === 401) {
      return res.status(401).json({ error: "DRIVE_AUTH_ERROR", message: "Invalid or expired Google Drive session." });
    }
    if (error.message?.includes("File not found") || error.code === 404) {
      return res.json({ success: true, warning: "File was already deleted or not found" });
    }
    res.status(400).json({ error: error.message || "Failed to delete file from Drive" });
  }
});

// API: Revert to Pending (Move files within Drive from Official back to Pending)
app.post("/api/revert-to-pending", async (req, res) => {
  const { entryId, entryData } = req.body;
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!entryId) {
    return res.status(400).json({ error: "Entry ID is required" });
  }

  try {
    const driveResult = getDriveService(accessToken);
    const { drive, error: authError } = driveResult;
    
    if (!drive) {
      return res.status(401).json({ error: "Drive Auth Failed", message: authError || "Drive session missing" });
    }

    const entry = entryData;
    if (!entry) {
      return res.status(400).json({ error: "entryData is required in request body" });
    }

    const envParentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    const parentFolderId = await getValidatedParentId(drive, envParentId);

    const stlafRootId = await findOrCreateFolder(drive, "STLAF", parentFolderId);
    const pendingRootId = await findOrCreateFolder(drive, ".PENDING_APPROVALS", stlafRootId);
    const entryFolderId = await findOrCreateFolder(drive, `Entry_${entryId}`, pendingRootId);

    // Helper to move file inside Drive
    const moveDriveFile = async (item: any, category: string) => {
      if (!item.driveFileId) return item;
      try {
        const categoryFolderId = await findOrCreateFolder(drive, category, entryFolderId);
        const file = await drive.files.get({
          fileId: item.driveFileId,
          fields: 'parents',
          supportsAllDrives: true
        });
        const previousParents = (file.data.parents || []).join(',');

        if (previousParents !== categoryFolderId) {
          await drive.files.update({
            fileId: item.driveFileId,
            addParents: categoryFolderId,
            removeParents: previousParents || undefined,
            enforceSingleParent: true,
            fields: 'id, parents',
            supportsAllDrives: true
          });
        }
        return item;
      } catch (err: any) {
        if (err.message?.includes("invalid authentication credentials") || err.code === 401 || err.status === 401) {
           throw err; // Bubble up Auth error
        }
        console.error(`Move internal Drive failed [${item.driveFileId}]:`, err.message);
        return item;
      }
    };

    await Promise.all([
      Promise.all((entry.reimbursements || []).map((r: any) => moveDriveFile(r, "Reimbursements"))),
      Promise.all((entry.liquidationItems || []).map((i: any) => moveDriveFile(i, "Receipts"))),
      Promise.all((entry.proofSlips || []).map((p: any) => moveDriveFile(p, "Proof_Slips")))
    ]);

    res.json({ success: true, message: "Drive revert to pending complete" });
  } catch (error: any) {
    console.error("Revert to Pending Error:", error);
    if (error.message?.includes("invalid authentication credentials") || error.code === 401 || error.status === 401) {
      return res.status(401).json({ error: "DRIVE_AUTH_ERROR", message: "Invalid or expired Google Drive session." });
    }
    res.status(400).json({ error: error.message || "Failed to revert Drive files to pending" });
  }
});

// API: Finalize Liquidation (Move files within Drive from Pending to Official)
app.post("/api/finalize-liquidation", async (req, res) => {
  const { entryId, entryData } = req.body;
  const authHeader = req.headers.authorization;
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!entryId) {
    return res.status(400).json({ error: "Entry ID is required" });
  }

  try {
    const driveResult = getDriveService(accessToken);
    const { drive, error: authError } = driveResult;
    
    if (!drive) {
      return res.status(401).json({ error: "Drive Auth Failed", message: authError || "Drive session missing" });
    }

    // Use passed data
    const entry = entryData;

    if (!entry) {
      return res.status(400).json({ error: "entryData is required in request body" });
    }

    // 1. Prepare Target Folder Structure
    const year = new Date().getFullYear().toString();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    // Safety check for date
    let createdDate = new Date();
    if (entry.createdAt) {
      if (entry.createdAt.toDate) createdDate = entry.createdAt.toDate();
      else if (entry.createdAt._seconds) createdDate = new Date(entry.createdAt._seconds * 1000);
      else if (typeof entry.createdAt === 'string') createdDate = new Date(entry.createdAt);
    }
    
    const month = monthNames[createdDate.getMonth()];
    const userName = entry.employeeName || "Unknown_User";

    const envParentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    const parentFolderId = await getValidatedParentId(drive, envParentId);

    const stlafRootId = await findOrCreateFolder(drive, "STLAF", parentFolderId);
    const yearFolderId = await findOrCreateFolder(drive, year, stlafRootId);
    const monthFolderId = await findOrCreateFolder(drive, month, yearFolderId);
    const userFolderId = await findOrCreateFolder(drive, userName.replace(/ /g, "_"), monthFolderId);
    const entryFolderId = await findOrCreateFolder(drive, `Entry_${entryId}`, userFolderId);

    // Helper to move file inside Drive
    const moveDriveFile = async (item: any, category: string) => {
      if (!item.driveFileId) return item;
      
      try {
        const categoryFolderId = await findOrCreateFolder(drive, category, entryFolderId);

        // Get current parents
        const file = await drive.files.get({
          fileId: item.driveFileId,
          fields: 'parents',
          supportsAllDrives: true
        });
        
        const previousParents = (file.data.parents || []).join(',');

        if (previousParents !== categoryFolderId) {
          // Move the file
          await drive.files.update({
            fileId: item.driveFileId,
            addParents: categoryFolderId,
            removeParents: previousParents || undefined,
            enforceSingleParent: true, // Automatically handle removing old parents in Drive environments that support it
            fields: 'id, parents',
            supportsAllDrives: true
          });
        }

        return item; // link stays same
      } catch (err: any) {
        if (err.message?.includes("invalid authentication credentials") || err.code === 401 || err.status === 401) {
           throw err; // Bubble up Auth error
        }
        console.error(`Move internal Drive failed [${item.driveFileId}]:`, err.message);
        return item;
      }
    };

    // Move all attachments
    await Promise.all([
      Promise.all((entry.reimbursements || []).map((r: any) => moveDriveFile(r, "Reimbursements"))),
      Promise.all((entry.liquidationItems || []).map((i: any) => moveDriveFile(i, "Receipts"))),
      Promise.all((entry.proofSlips || []).map((p: any) => moveDriveFile(p, "Proof_Slips")))
    ]);

    res.json({ success: true, message: "Drive finalization complete" });
  } catch (error: any) {
    console.error("Finalization Error:", error);
    if (error.message?.includes("invalid authentication credentials") || error.code === 401 || error.status === 401) {
      return res.status(401).json({ error: "DRIVE_AUTH_ERROR", message: "Invalid or expired Google Drive session." });
    }
    res.status(400).json({ error: error.message || "Failed to finalize Drive upload" });
  }
});


// Helper middleware to handle multer errors gracefully
const uploadMiddleware = (req: any, res: any, next: any) => {
  console.log(`[API] Upload request received. size: ${req.headers['content-length']}`);
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.log(`[API] Multer error:`, err.message);
      if (err.code === 'LIMIT_FILE_SIZE' || err.message === 'File too large') {
        return res.status(413).json({ error: "File is too large to process." });
      }
      return res.status(400).json({ error: "File upload error", message: err.message });
    }
    console.log(`[API] Multer success, file: ${req.file ? 'yes' : 'no'}`);
    next();
  });
};

// API: Upload to Google Drive (with Pending support)
app.post("/api/upload", uploadMiddleware, async (req, res) => {
  console.log(`[API] /api/upload handler starting`);
  let isServiceAccount = false;
  try {
    const { year, month, userName, entryId, category, isPending } = req.body;
    const file = req.file;
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const driveResult = getDriveService(accessToken);
    const { drive, isServiceAccount: serviceAcc, error: authError } = driveResult;
    isServiceAccount = serviceAcc;
    
    if (!drive) {
      return res.status(401).json({ 
        error: "Drive Authentication Failed", 
        message: authError || "Please reconnect your Google Drive account." 
      });
    }

    const envParentId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
    const parentFolderId = await getValidatedParentId(drive, envParentId);

    // 1. Determine Root for this upload
    let currentParentId;
    
    if (isPending === "true" || isPending === true) {
      // Put in a central ".PENDING_APPROVALS" folder to keep official STLAF empty
      const stlafRootId = await findOrCreateFolder(drive, "STLAF", parentFolderId);
      currentParentId = await findOrCreateFolder(drive, ".PENDING_APPROVALS", stlafRootId);
      currentParentId = await findOrCreateFolder(drive, `Entry_${entryId}`, currentParentId);
      currentParentId = await findOrCreateFolder(drive, category, currentParentId);
    } else {
      // Official direct upload (if needed)
      currentParentId = await findOrCreateFolder(drive, "STLAF", parentFolderId);
      currentParentId = await findOrCreateFolder(drive, year, currentParentId);
      currentParentId = await findOrCreateFolder(drive, month, currentParentId);
      currentParentId = await findOrCreateFolder(drive, userName.replace(/ /g, "_"), currentParentId);
      currentParentId = await findOrCreateFolder(drive, `Entry_${entryId}`, currentParentId);
      currentParentId = await findOrCreateFolder(drive, category, currentParentId);
    }

    // 2. Sanitize and rename file
    // YYYY-MM-DD_Lastname_Firstname_DocumentType_Number.ext
    const dateStr = new Date().toISOString().split('T')[0];
    const nameParts = userName.split(' ');
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : userName;
    const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join('_') : '';
    
    const sanitizedLastName = lastName.replace(/[^a-zA-Z0-9]/g, "");
    const sanitizedFirstName = firstName.replace(/[^a-zA-Z0-9]/g, "");
    
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const docType = category.replace(/_/g, "");
    const newFileName = `${dateStr}_${sanitizedLastName}_${sanitizedFirstName}_${docType}_${timestamp.toString().slice(-4)}${extension}`;

    // 3. Upload to Drive
    const fileMetadata = {
      name: newFileName,
      parents: [currentParentId],
    };

    // Write buffer to tmp file
    const tmpFilePath = path.join("/tmp", timestamp.toString());
    fs.writeFileSync(tmpFilePath, file.buffer);
    
    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(tmpFilePath),
    };

    const driveFile = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink",
      supportsAllDrives: true,
    });

    // Cleanup tmp file
    fs.unlinkSync(tmpFilePath);

    // 4. Set permissions to anyone with link (read-only) for easy previewing back in app
    await drive.permissions.create({
      fileId: driveFile.data.id!,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
      supportsAllDrives: true,
    });

    res.json({
      fileId: driveFile.data.id,
      url: driveFile.data.webViewLink,
      fileName: newFileName
    });
  } catch (error: any) {
    console.error("Upload Error:", error);
    
    // Check for "API not enabled" error specifically
    if (error.message?.includes("Google Drive API has not been used") || error.errors?.[0]?.message?.includes("Drive API has not been used")) {
      return res.status(403).json({ 
        error: "Google Drive API is disabled in your cloud console.",
        message: "You must enable the Google Drive API for your project in the Google Cloud Console (APIs & Services > Library)."
      });
    }

    if (error.message?.includes("storage quota") || error.errors?.[0]?.message?.includes("storage quota")) {
      return res.status(400).json({ 
        error: "Google Drive Storage Full",
        message: isServiceAccount 
          ? "The backup storage is full. Please login with your OWN Google Drive account to continue (it's free!). Simply log out and back in." 
          : "Your personal Google Drive storage is full. Please free up some space in your Google Drive or use a different account."
      });
    }

    let statusCode = error.code || error.status;
    if (error.message?.includes("invalid authentication credentials") || error.message?.includes("Invalid Credentials")) {
        statusCode = 401;
    }
    if (statusCode !== 401 && statusCode !== 403) {
      statusCode = 400; // default to 400
    }
    
    if (statusCode === 401) {
       return res.status(401).json({ error: "DRIVE_AUTH_ERROR", message: "Your Google Drive session has expired or is invalid. Please login again." });
    }

    res.status(statusCode).json({ 
      error: error.message || "Failed to upload to Google Drive",
      message: error.errors?.[0]?.message || "An unexpected error occurred during Drive interaction.",
      code: error.code || error.status 
    });
  }
});

// API: Get Service Account Info
app.get("/api/service-account", (req, res) => {
  res.json({ email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || null });
});

// Serving the app
async function startServer() {
  // API 404 handler - must be before static/SPA catch-all
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "API Route Not Found", path: req.originalUrl });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Service Account: ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? 'Configured' : 'MISSING'}`);
    console.log(`Private Key: ${process.env.GOOGLE_PRIVATE_KEY ? 'Configured' : 'MISSING'}`);
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Server Error:', err);
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
  });
}

startServer();
