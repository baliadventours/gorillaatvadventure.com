import { getAdminDb, verifyAdmin } from "../../src/services/firebaseAdmin.js";
import fs from "fs";
import path from "path";

export default async function handler(req: any, res: any) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;

    // SECURITY: Verify user is admin
    const authResult = await verifyAdmin(idToken);
    if (!authResult.isAdmin) {
      console.warn("[Backup API] Unauthorized access attempt:", authResult.error);
      return res.status(403).json({ 
        error: authResult.error || "Unauthorized: Admin access required for backups.",
        details: "Ensure your login email matches the admin list."
      });
    }

    const db = getAdminDb();
    
    console.log(`[Backup] Starting full system backup...`);
    
    const collections = [
      'tours', 
      'bookings', 
      'users', 
      'coupons', 
      'generalSettings', 
      'communicationSettings', 
      'inventory', 
      'reviews',
      'partnerSettings',
      'payouts',
      'posts',
      'locationMeta',
      'categories',
      'pages',
      'urgencyPoints',
      'tourLabels',
      'tourTypes',
      'popups',
      'guides',
      'globalAddOns'
    ];

    const backup: Record<string, any[]> = {};
    let totalDocs = 0;
    
    // Fetch all collections. Using for-loop to be more gentle on resources and avoid hitting concurrent connection limits
    for (const colName of collections) {
      try {
        const snapshot = await db.collection(colName).limit(5000).get(); 
        totalDocs += snapshot.size;
        backup[colName] = snapshot.docs.map((doc: any) => ({
          id: doc.id,
          ...doc.data()
        }));
        console.log(`[Backup] Collection ${colName}: found ${snapshot.size} docs.`);
      } catch (colErr: any) {
        console.warn(`[Backup] Warning: Could not backup collection ${colName}:`, colErr.message);
        backup[colName] = [];
      }
    }

    const timestamp = new Date().toISOString();
    const metadata = {
      version: "2.1",
      timestamp,
      source: "Bali Adventours CMS",
      totalCollections: collections.length,
      totalDocumentsFound: totalDocs,
      databaseId: db.databaseId || '(default)', // Now safe to access in Admin SDK
      userId: authResult.decodedToken?.uid || 'unknown'
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=bali_adventours_backup_${timestamp.split('T')[0]}.json`);
    return res.status(200).json({ metadata, data: backup });

  } catch (error: any) {
    console.error("[Backup Error]:", error);
    return res.status(500).json({ 
      error: error.message || "Failed to generate backup",
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
