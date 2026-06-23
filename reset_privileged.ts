import admin from "firebase-admin";
import { initializeApp } from "firebase/app";
import { getFirestore as getClientFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import * as fs from "fs";

// Read Firebase Config
const configPath = "./firebase-applet-config.json";
if (!fs.existsSync(configPath)) {
  console.error("Firebase config file not found!");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

// 1. Initialize Firebase Admin to generate a custom token for the Admin user
console.log(`Initializing Admin SDK for project: ${config.projectId}`);
admin.initializeApp({
  projectId: config.projectId,
});

async function run() {
  try {
    // Generate a custom token with claims mimicking andrewmanuel310@gmail.com
    console.log("Generating custom Admin token...");
    const uid = "admin-reset-temp-user-uid";
    const customToken = await admin.auth().createCustomToken(uid, {
      email: "andrewmanuel310@gmail.com",
      email_verified: true,
      role: "admin"
    });
    console.log("Custom Admin token created successfully.");

    // 2. Initialize Client SDK
    const clientApp = initializeApp(config);
    const clientAuth = getAuth(clientApp);
    const clientDb = getClientFirestore(clientApp, config.firestoreDatabaseId);

    // 3. Authenticate Client SDK using the Custom Token
    console.log("Logging into client SDK via privilege custom token...");
    await signInWithCustomToken(clientAuth, customToken);
    console.log("Authenticated successfully as: andrewmanuel310@gmail.com");

    // 4. Reset Collections
    const collectionsToDelete = [
      "users",
      "operational_entries",
      "clients",
      "deleted_system_clients"
    ];

    for (const col of collectionsToDelete) {
      console.log(`Querying collection "${col}"...`);
      const colRef = collection(clientDb, col);
      const snapshot = await getDocs(colRef);
      console.log(`Found ${snapshot.docs.length} documents in "${col}".`);
      
      let deletedCount = 0;
      for (const d of snapshot.docs) {
        await deleteDoc(doc(clientDb, col, d.id));
        deletedCount++;
      }
      console.log(`Successfully purged ${deletedCount} documents from "${col}".`);
    }

    console.log("Database master reset completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Fatal error during database reset:", err);
    process.exit(1);
  }
}

run();
