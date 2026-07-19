const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function test() {
  const rootPath = process.cwd();
  const configPath = path.resolve(rootPath, "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) {
    console.log("No firebase-applet-config.json found");
    return;
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const projectId = config.projectId;
  const databaseId = config.firestoreDatabaseId || "(default)";
  const apiKey = config.apiKey;

  // Fetch email logs
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/email_logs?key=${apiKey}&pageSize=10`;
  console.log("Fetching email logs...");

  try {
    const res = await axios.get(url);
    if (!res.data.documents) {
      console.log("No email logs found in database.");
      return;
    }
    console.log("Found", res.data.documents.length, "logs:");
    for (const doc of res.data.documents) {
      const fields = doc.fields;
      console.log("-----------------------------------------");
      console.log("ID:", doc.name.split('/').pop());
      console.log("To:", fields.to?.stringValue);
      console.log("Subject:", fields.subject?.stringValue);
      console.log("Status:", fields.status?.stringValue);
      console.log("Reason/Error:", fields.reason?.stringValue || fields.error?.stringValue);
      console.log("Provider:", fields.provider?.stringValue);
      console.log("Created At:", fields.createdAt?.stringValue || fields.timestamp?.stringValue);
    }
  } catch (err) {
    console.error("REST Error:", err.message, err.response ? err.response.data : "");
  }
}

test();
