const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

async function main() {
  const rootPath = process.cwd();
  const configPath = path.resolve(rootPath, "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    console.log("No config file found");
    return;
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  
  const projectId = config.projectId;
  const databaseId = config.firestoreDatabaseId || "(default)";

  console.log("Using projectId:", projectId);
  console.log("Using databaseId:", databaseId);

  const app = admin.initializeApp({
    projectId: projectId,
  });

  const db = getFirestore(app, databaseId);
  await fetchLogs(db);
}

async function fetchLogs(firestoreDb) {
  try {
    const snap = await firestoreDb.collection('email_logs').orderBy('createdAt', 'desc').limit(15).get();
    if (snap.empty) {
      console.log("No logs found in email_logs collection.");
      return;
    }
    console.log(`Found ${snap.size} logs:`);
    snap.forEach(doc => {
      const data = doc.data();
      console.log("-----------------------------------------");
      console.log("ID:", doc.id);
      console.log("To:", data.to);
      console.log("Subject:", data.subject);
      console.log("Status:", data.status);
      console.log("Reason/Error:", data.reason || data.error);
      console.log("Provider:", data.provider);
      console.log("Created At:", data.createdAt);
    });
  } catch (err) {
    console.error("Firestore query error:", err.message);
  }
}

main();
