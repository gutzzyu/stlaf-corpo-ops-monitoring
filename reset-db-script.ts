import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as fs from "fs";

// Read Firebase Config
const configPath = "./firebase-applet-config.json";
if (!fs.existsSync(configPath)) {
  console.error("Firebase config file not found!");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// Read Service Account Credentials from environment variables
const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY
  ?.replace(/\\n/g, "\n")
  ?.replace(/^"(.*)"$/, "$1")
  ?.replace(/^'(.*)'$/, "$1")
  ?.replace(/\\"/g, '"');

if (!email || !privateKey) {
  console.error("GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY environment variable is missing!");
  process.exit(1);
}

console.log(`Initializing Admin SDK with Service Account: ${email}`);

try {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.projectId,
      clientEmail: email,
      privateKey: privateKey,
    }),
  });
} catch (error) {
  console.error("Failed to initialize admin app:", error);
  process.exit(1);
}

const databaseId = config.firestoreDatabaseId;
console.log(`Connecting securely via Firebase Admin to database instance: ${databaseId}`);
const db = getFirestore(databaseId);

const collectionsToDelete = [
  "users",
  "operational_entries",
  "clients",
  "deleted_system_clients"
];

async function deleteCollection(collectionName: string) {
  try {
    const colRef = db.collection(collectionName);
    const snapshot = await colRef.get();
    console.log(`Found ${snapshot.docs.length} documents in collection "${collectionName}".`);
    
    let deletedCount = 0;
    const batch = db.batch();
    
    for (const document of snapshot.docs) {
      batch.delete(colRef.doc(document.id));
      deletedCount++;
    }
    
    if (deletedCount > 0) {
      await batch.commit();
    }
    
    console.log(`Successfully purged ${deletedCount} documents in collection "${collectionName}".`);
  } catch (error) {
    console.error(`Error deleting collection "${collectionName}":`, error);
  }
}

async function run() {
  console.log(`Initializing administrative wipe-out on Firebase project: ${config.projectId}`);
  for (const col of collectionsToDelete) {
    await deleteCollection(col);
  }
  console.log("Database reset completed successfully via Firebase Admin.");
  process.exit(0);
}

run();
