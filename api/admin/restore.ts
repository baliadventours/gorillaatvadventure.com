import { getAdminDb, verifyAdmin } from "../../src/services/firebaseAdmin.js";

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;

    const authResult = await verifyAdmin(idToken);
    if (!authResult.isAdmin) {
      return res.status(403).json({ 
        error: authResult.error || "Unauthorized: Admin access required for restore.",
        details: "Ensure your login email matches the admin list."
      });
    }

    const { data } = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: "Invalid backup data provided." });
    }

    const db = getAdminDb();
    console.log("[Restore] Starting full system restore...");
    
    const results: Record<string, number> = {};

    for (const [colName, docs] of Object.entries(data)) {
      if (!Array.isArray(docs)) continue;
      
      let count = 0;
      const colRef = db.collection(colName);

      for (const docData of docs) {
        const { id, ...cleanData } = docData;
        if (id) {
          await colRef.doc(id).set(cleanData, { merge: true });
          count++;
        }
      }
      results[colName] = count;
    }

    return res.status(200).json({ 
      message: "Restore completed successfully", 
      stats: results 
    });

  } catch (error: any) {
    console.error("[Restore Error]:", error);
    return res.status(500).json({ error: error.message || "Failed to restore backup" });
  }
}
