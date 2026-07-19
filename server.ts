import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import compression from "compression";
import axios from "axios";
import multer from "multer";
import admin from "firebase-admin";
import { getAdminApp, getAdminDb, verifyAdmin, verifyUser, getDocViaRest, createDocViaRest } from "./src/services/firebaseAdmin.js";
import { handleSendEmail } from "./src/services/emailHandler.js";
import { sendWhatsAppMessage, formatWhatsAppMessage, sendWhatsAppTemplateMessage } from "./src/services/whatsappHandler.js";
import { generateVoucherPdf } from "./src/services/email/voucherGenerator.js";
import { generateManifestPdf } from "./src/services/email/manifestGenerator.js";
import { resolveEmailConfig } from "./src/services/email/recipientResolver.js";
import { handleChatbotRequest } from "./src/services/chatbotHandler.js";
import { fallbackHtmlTemplate } from "./src/indexHtmlFallback.js";

dotenv.config();

// const db = getAdminDb();

// Test environment variables
console.log("[Server] Checking environment variables...");
console.log(`[Server] GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "CONFIGURED" : "MISSING"}`);
console.log(`[Server] FIREBASE_PROJECT_ID: ${process.env.VITE_FIREBASE_PROJECT_ID ? "CONFIGURED" : "MISSING"}`);
console.log(`[Server] OPENWA_API_KEY: ${process.env.OPENWA_API_KEY || process.env.WHAPI_TOKEN ? "CONFIGURED" : "MISSING"}`);
console.log(`[Server] RESEND_API_KEY: ${process.env.RESEND_API_KEY ? "CONFIGURED" : "MISSING"}`);
console.log(`[Server] SENDER_EMAIL: ${process.env.SENDER_EMAIL || "NOT SET (will use fallback)"}`);

// --- CONVERSANT FIRESTORE REST API HELPERS (BYPASS GCP ADC CONSTRAINTS FOR PREVIEWS) ---
function parseRestValue(value: any): any {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return parseFloat(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) {
    const values = value.arrayValue.values || [];
    return values.map((v: any) => parseRestValue(v));
  }
  if ('mapValue' in value) {
    const fields = value.mapValue.fields || {};
    const res: any = {};
    for (const [k, v] of Object.entries(fields)) {
      res[k] = parseRestValue(v);
    }
    return res;
  }
  if ('nullValue' in value) return null;
  return value;
}

function parseRestDocument(doc: any) {
  if (!doc || !doc.fields) return null;
  const idStr = doc.name ? doc.name.split('/').pop() : '';
  const parsed: any = { id: idStr };
  for (const [key, val] of Object.entries(doc.fields)) {
    parsed[key] = parseRestValue(val);
  }
  return parsed;
}

async function fetchFromREST(
  collectionName: string,
  docId?: string,
  queryOptions?: { 
    whereFilters?: Array<{ field: string; op: 'EQUAL' | 'IN'; value: any }>;
    orderByField?: string;
    direction?: 'ASCENDING' | 'DESCENDING';
    limit?: number;
  }
) {
  let projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0785892115';
  let databaseId = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)';
  let apiKey = '';

  try {
    const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      projectId = config.projectId || projectId;
      databaseId = config.firestoreDatabaseId || databaseId;
      apiKey = config.apiKey || apiKey;
    }
  } catch (e) {}

  if (docId) {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}/${docId}${apiKey ? `?key=${apiKey}` : ''}`;
    const res = await axios.get(url);
    return parseRestDocument(res.data);
  } else {
    const structuredQuery: any = {
      from: [{ collectionId: collectionName }]
    };

    if (queryOptions?.whereFilters && queryOptions.whereFilters.length > 0) {
      if (queryOptions.whereFilters.length === 1) {
        const filter = queryOptions.whereFilters[0];
        structuredQuery.where = {
          fieldFilter: {
            field: { fieldPath: filter.field },
            op: filter.op,
            value: typeof filter.value === 'string' 
              ? { stringValue: filter.value }
              : (Array.isArray(filter.value) 
                ? { arrayValue: { values: filter.value.map(v => ({ stringValue: v })) } }
                : { booleanValue: filter.value })
          }
        };
      } else {
        structuredQuery.where = {
          compositeFilter: {
            op: 'AND',
            filters: queryOptions.whereFilters.map(f => ({
              fieldFilter: {
                field: { fieldPath: f.field },
                op: f.op,
                value: typeof f.value === 'string'
                  ? { stringValue: f.value }
                  : (Array.isArray(f.value)
                    ? { arrayValue: { values: f.value.map(v => ({ stringValue: v })) } }
                    : { booleanValue: f.value })
              }
            }))
          }
        };
      }
    }

    if (queryOptions?.orderByField) {
      structuredQuery.orderBy = [{
        field: { fieldPath: queryOptions.orderByField },
        direction: queryOptions.direction || 'ASCENDING'
      }];
    }

    if (queryOptions?.limit) {
      structuredQuery.limit = queryOptions.limit;
    }

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents:runQuery${apiKey ? `?key=${apiKey}` : ''}`;
    const res = await axios.post(url, { structuredQuery });
    
    const documents = (res.data || [])
      .map((item: any) => item.document ? parseRestDocument(item.document) : null)
      .filter(Boolean);
    
    return documents;
  }
}

// Robust Gemini API helper that falls back to stable alternative models if the primary model is unavailable.
export async function generateContentWithFallback(ai: any, params: any) {
  const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3-flash-preview", "gemini-3.1-flash-lite"];
  const initialModel = params.model || "gemini-3.5-flash";
  const uniqueModels = Array.from(new Set([initialModel, ...modelsToTry]));

  let lastError: any = null;
  for (const model of uniqueModels) {
    try {
      console.log(`[Gemini Fallback Router] Attempting generation with model: ${model}`);
      const response = await ai.models.generateContent({
        ...params,
        model: model
      });
      console.log(`[Gemini Fallback Router] Successfully generated content using model: ${model}`);
      return response;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Fallback Router] Failed with model ${model}:`, err.message || err);

      // If we failed and there are tools configured, try one more time for this model without tools (in case of tool support issues)
      if (params.config?.tools || params.tools) {
        try {
          console.log(`[Gemini Fallback Router] Retrying model ${model} without tools...`);
          const cleanParams = { ...params };
          if (cleanParams.config) {
            cleanParams.config = { ...cleanParams.config };
            delete cleanParams.config.tools;
          }
          delete cleanParams.tools;
          
          const response = await ai.models.generateContent({
            ...cleanParams,
            model: model
          });
          console.log(`[Gemini Fallback Router] Successfully generated content (sans tools) using model: ${model}`);
          return response;
        } catch (retryErr: any) {
          console.warn(`[Gemini Fallback Router] Retry without tools also failed for ${model}:`, retryErr.message || retryErr);
        }
      }
    }
  }
  throw lastError;
}

// Start of server logic
export async function createServer() {
  const db = getAdminDb();
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(compression());
  app.use(express.json());

  // Configure multer for in-memory file uploads (max 10MB)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  });

  // API Route: Safe Image Upload Proxy (eliminates client CORS and API key leaks)
  app.post("/api/upload", upload.single("image"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const filePath = `uploads/${Date.now()}_${sanitizedName}`;

      // Try Firebase Storage first
      try {
        // Ensure admin app is initialized
        getAdminApp();

        let bucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET;
        if (!bucketName) {
          try {
            const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
            if (fs.existsSync(configPath)) {
              const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
              bucketName = config.storageBucket;
            }
          } catch (e) {
            // ignore
          }
        }
        if (!bucketName) {
          bucketName = "gorilla-atv-adventure.firebasestorage.app";
        }

        // Remove gs:// prefix if present
        if (bucketName.startsWith("gs://")) {
          bucketName = bucketName.substring(5);
        }

        console.log(`[Server Upload] Uploading to Firebase Storage bucket: ${bucketName}, path: ${filePath}`);
        const bucket = admin.storage().bucket(bucketName);
        const fileUpload = bucket.file(filePath);

        // Generate a standard Firebase Storage download token (random hex works perfectly)
        const downloadToken = Array.from({ length: 4 }, () => Math.random().toString(16).substring(2)).join("");

        await fileUpload.save(file.buffer, {
          metadata: {
            contentType: file.mimetype,
            metadata: {
              firebaseStorageDownloadTokens: downloadToken,
            },
          },
        });

        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(filePath)}?alt=media&token=${downloadToken}`;
        console.log("[Server Upload] Firebase Storage upload successful! URL:", downloadUrl);
        return res.json({ success: true, url: downloadUrl });

      } catch (storageError: any) {
        console.warn("[Server Upload] Firebase Storage upload failed, trying Firestore fallback:", storageError);

        // Firestore Fallback: only if file size is less than 1MB (limit of firestore document is 1MB)
        if (file.buffer.length < 1000000) {
          try {
            console.log("[Server Upload] Saving file to Firestore uploads collection...");
            const adminDb = getAdminDb();
            const docRef = await adminDb.collection("uploads").add({
              name: file.originalname,
              mimetype: file.mimetype,
              base64: file.buffer.toString("base64"),
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            const downloadUrl = `/api/uploads/${docRef.id}`;
            console.log("[Server Upload] Firestore upload successful! URL:", downloadUrl);
            return res.json({ success: true, url: downloadUrl });
          } catch (firestoreError: any) {
            console.warn("[Server Upload] Firestore SDK upload failed, trying REST fallback:", firestoreError.message || firestoreError);
            try {
              const restData = await createDocViaRest("uploads", {
                name: file.originalname,
                mimetype: file.mimetype,
                base64: file.buffer.toString("base64"),
                createdAt: new Date().toISOString()
              }, req);
              if (restData && restData.name) {
                const docId = restData.name.split("/").pop();
                const downloadUrl = `/api/uploads/${docId}`;
                console.log("[Server Upload] Firestore REST upload successful! URL:", downloadUrl);
                return res.json({ success: true, url: downloadUrl });
              } else {
                throw new Error("No REST document name returned");
              }
            } catch (restErr: any) {
              console.warn("[Server Upload] Firestore REST fallback failed, falling back to ImgBB:", restErr.message || restErr);
            }
          }
        } else {
          console.log("[Server Upload] File is over 1MB, skipping Firestore fallback");
        }

        const imgbbKey = process.env.VITE_IMGBB_API_KEY || process.env.IMGBB_API_KEY;
        if (!imgbbKey) {
          throw new Error(`Firebase Storage and Firestore fallback failed. No ImgBB API key available in environment.`);
        }

        console.log("[Server Upload] Uploading to ImgBB on backend...");
        const formData = new FormData();
        const blob = new Blob([file.buffer], { type: file.mimetype });
        formData.append("image", blob, file.originalname);

        const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
          method: "POST",
          body: formData,
        });

        const data: any = await response.json();
        if (data.success) {
          console.log("[Server Upload] ImgBB upload successful! URL:", data.data.url);
          return res.json({ success: true, url: data.data.url });
        } else {
          throw new Error(data.error?.message || "Failed to upload image to Imgbb");
        }
      }
    } catch (error: any) {
      console.error("[Server Upload] Critical error:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });

  // API Route: Serve files from Firestore uploads collection
  app.get("/api/uploads/:id", async (req: any, res: any) => {
    try {
      const id = req.params.id;
      let data: any = null;
      try {
        const adminDb = getAdminDb();
        const docSnap = await adminDb.collection("uploads").doc(id).get();
        if (docSnap.exists) {
          data = docSnap.data();
        }
      } catch (sdkError: any) {
        console.warn(`[Serve File] Admin SDK failed: ${sdkError.message || sdkError}. Trying REST fallback...`);
        try {
          data = await getDocViaRest("uploads", id, undefined, req);
        } catch (restError: any) {
          console.error(`[Serve File] REST fallback failed too: ${restError.message || restError}`);
        }
      }

      if (!data) {
        return res.status(404).send("File not found");
      }
      if (!data.base64) {
        return res.status(404).send("File data not found");
      }
      const buffer = Buffer.from(data.base64, "base64");
      res.setHeader("Content-Type", data.mimetype || "application/octet-stream");
      res.setHeader("Cache-Control", "public, max-age=31536000"); // Cache for 1 year
      return res.end(buffer);
    } catch (error: any) {
      console.error("[Serve File Error]:", error);
      return res.status(500).send("Error serving file");
    }
  });

  // API Route: Send Email
  app.post("/api/send-email", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      console.log(`[API /api/send-email] Request received. To: ${req.body.to}, Type: ${req.body.type}`);
      
      const result = await handleSendEmail(req.body, authHeader);
      console.log(`[API /api/send-email] Success:`, result);
      res.json(result);
    } catch (error: any) {
      console.error("[Email Proxy Error]:", error);
      res.status(500).json({ 
        error: error.message || "Internal server error",
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      });
    }
  });

  // API Route: Image Proxy to bypass Hotlinking/Referer protections on ImgBB and other CDNs
  app.get("/api/image-proxy", async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).send("url query parameter is required");
      }

      const parsedUrl = new URL(imageUrl);
      console.log(`[Image Proxy] Fetching: ${imageUrl}`);

      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": `${parsedUrl.protocol}//${parsedUrl.host}/`,
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        },
        timeout: 10000
      });

      let contentType = response.headers["content-type"] || "image/jpeg";
      if (typeof contentType !== "string") {
        contentType = "image/jpeg";
      }
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", "public, max-age=2592000"); // 30 days caching

      res.send(Buffer.from(response.data));
    } catch (error: any) {
      console.error("[Image Proxy Error]:", error.message || error);
      res.status(500).send("Error proxying image");
    }
  });

  // API Route: Email Diagnostic
  app.get("/api/admin/email-diagnostic", async (req, res) => {
    try {
      // Use the safe resolver which handles Admin SDK and REST fallbacks
      const resolvedConfig = await resolveEmailConfig();

      // Fetch email_logs via Admin SDK first
      let logs: any[] = [];
      let firestoreConfigFound = false;

      try {
        const db = getAdminDb();
        const logsSnap = await db.collection("email_logs").orderBy("createdAt", "desc").limit(30).get();
        firestoreConfigFound = true;
        if (!logsSnap.empty) {
          logs = logsSnap.docs.map((doc: any) => {
            const data = doc.data() || {};
            return {
              id: doc.id,
              ...data,
              createdAt: data.createdAt ? (typeof data.createdAt.toDate === 'function' ? data.createdAt.toDate().toISOString() : data.createdAt) : undefined
            };
          });
        }
      } catch (sdkErr: any) {
        console.warn("[Diagnostic Admin SDK logs fetch failed, trying REST fallback]:", sdkErr.message);
        
        // Fetch email_logs via REST API as fallback
        const rootPath = process.cwd();
        const configPath = path.resolve(rootPath, "firebase-applet-config.json");

        if (fs.existsSync(configPath)) {
          firestoreConfigFound = true;
          const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          const projectId = config.projectId;
          const databaseId = config.firestoreDatabaseId || "(default)";
          const apiKey = config.apiKey;
          const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/email_logs?key=${apiKey}&pageSize=30`;
          
          try {
            const restRes = await axios.get(url);
            if (restRes.data && restRes.data.documents) {
              logs = restRes.data.documents.map((doc: any) => {
                const fields = doc.fields || {};
                const mapped: Record<string, any> = {};
                for (const [key, val] of Object.entries(fields)) {
                  const v = val as any;
                  if ('stringValue' in v) mapped[key] = v.stringValue;
                  else if ('booleanValue' in v) mapped[key] = v.booleanValue;
                  else if ('integerValue' in v) mapped[key] = parseInt(v.integerValue, 10);
                  else if ('doubleValue' in v) mapped[key] = parseFloat(v.doubleValue);
                }
                return {
                  id: doc.name.split("/").pop(),
                  ...mapped,
                  createdAt: doc.createTime
                };
              });
            }
          } catch (restErr: any) {
            console.warn("[Diagnostic REST logs fetch failed]:", restErr.message);
          }
        }
      }

      // Safely mask secret values
      const maskSecret = (val: string) => {
        if (!val) return "undefined/empty";
        const trimmed = val.trim();
        if (trimmed.length < 8) return `present (length: ${trimmed.length})`;
        return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)} (length: ${trimmed.length})`;
      };

      res.json({
        success: true,
        firestoreConfigFound,
        activeEnvironment: {
          NODE_ENV: process.env.NODE_ENV,
          DEFAULT_EMAIL_PROVIDER: process.env.DEFAULT_EMAIL_PROVIDER,
          MAILJET_API_KEY_ENV_EXISTS: !!process.env.MAILJET_API_KEY,
          MAILJET_API_SECRET_ENV_EXISTS: !!process.env.MAILJET_API_SECRET,
          RESEND_API_KEY_ENV_EXISTS: !!process.env.RESEND_API_KEY,
        },
        resolvedConfiguration: {
          emailProvider: resolvedConfig.emailProvider,
          senderEmail: resolvedConfig.senderEmail,
          senderName: resolvedConfig.senderName,
          adminNotificationEmail: resolvedConfig.adminNotificationEmail,
          emailApiKey_masked: maskSecret(resolvedConfig.emailApiKey),
          emailApiKey_has_colon: resolvedConfig.emailApiKey ? resolvedConfig.emailApiKey.includes(":") : false
        },
        recentLogs: logs
      });
    } catch (err: any) {
      console.error("[Email Diagnostic Error]:", err);
      res.status(500).json({ error: err.message, stack: err.stack });
    }
  });

  // API Route: Full Site Backup (Admin Only)
  app.get("/api/admin/backup", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;

      // SECURITY: Verify user is admin
      const authResult = await verifyAdmin(idToken);
      if (!authResult.isAdmin) {
        return res.status(403).json({ error: "Unauthorized: Admin access required for backups." });
      }

      const db = getAdminDb();
      
      // Diagnostic: List collections
      console.log(`[Backup] Starting backup...`);
      
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

      let collectionsToBackup = collections;
      const collectionsParam = req.query.collections as string;
      if (collectionsParam) {
        const requested = collectionsParam.split(',').map(c => c.trim()).filter(Boolean);
        collectionsToBackup = collections.filter(c => requested.includes(c));
        console.log(`[Backup] Performing partial backup for: ${collectionsToBackup.join(', ')}`);
      } else {
        console.log(`[Backup] Performing full system backup...`);
      }

      const backup: Record<string, any[]> = {};
      let totalDocs = 0;

      // Fetch all collections sequentially to avoid timeouts and resource exhaustion
      for (const colName of collectionsToBackup) {
        try {
          const snapshot = await db.collection(colName).limit(5000).get();
          totalDocs += snapshot.size;
          backup[colName] = snapshot.docs.map((doc: any) => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log(`[Server Backup] Collection ${colName}: found ${snapshot.size} docs.`);
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
        totalCollections: collectionsToBackup.length,
        totalDocumentsFound: totalDocs,
        databaseId: db.databaseId || '(default)',
        userId: authResult.decodedToken?.uid || 'unknown',
        isPartial: !!collectionsParam
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=bali_adventours_backup_${timestamp.split('T')[0]}.json`);
      res.status(200).json({ metadata, data: backup });

    } catch (error: any) {
      console.error("[Backup Error]:", error);
      res.status(500).json({ error: error.message || "Failed to generate backup" });
    }
  });

  // API Route: Restore Site (Admin Only)
  app.post("/api/admin/restore", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;

      const adminAuth = await verifyAdmin(idToken);
      if (!adminAuth.isAdmin) {
        return res.status(403).json({ error: "Unauthorized: Admin access required for restore." });
      }

      const { data } = req.body;
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: "Invalid backup data provided." });
      }

      console.log("[Restore] Starting full system restore...");
      
      const results: Record<string, number> = {};

      for (const [colName, docs] of Object.entries(data)) {
        if (!Array.isArray(docs)) continue;
        
        let count = 0;
        const colRef = db.collection(colName);

        // Process in batches if possible, but for simplicity we'll do promise.all on docs
        // or sequential for safety with large datasets.
        for (const docData of docs) {
          const { id, ...cleanData } = docData;
          if (id) {
            await colRef.doc(id).set(cleanData, { merge: true });
            count++;
          }
        }
        results[colName] = count;
      }

      res.json({ 
        message: "Restore completed successfully", 
        stats: results 
      });

    } catch (error: any) {
      console.error("[Restore Error]:", error);
      res.status(500).json({ error: error.message || "Failed to restore backup" });
    }
  });

  // API Route: AI Hub Content Generator (Admin Only)
  app.post("/api/admin/generate-ai-hub", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;

      const adminAuth = await verifyAdmin(idToken);
      if (!adminAuth.isAdmin) {
        return res.status(403).json({ error: "Unauthorized: Admin access required for content generation." });
      }

      const { type, prompt, category } = req.body;
      if (!type || !prompt || !category) {
        return res.status(400).json({ error: "Missing required fields: type, prompt, category." });
      }

      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API Key is not configured on the server." });
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      if (type === 'faq') {
        const response = await generateContentWithFallback(ai, {
          model: "gemini-3.5-flash",
          contents: `Create exactly 3 relevant, highly human questions and highly detailed, expert answers about: "${prompt}" in the category: "${category}".
          For Bali Tourism SEO, provide informative responses containing specific Balinese words (like "Kulkul", "Warung", "Santi", "Sari", "Pura") with exact explanations. Keep the language natural, helpful, and highly detailed.
          Respond in JSON format complying with the schema.`,
          config: {
            systemInstruction: "You are an expert Bali SEO content generator for Bali Adventours. You generate helpful travel FAQs that search engines love.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  answer: { type: Type.STRING }
                },
                required: ["question", "answer"]
              }
            }
          }
        });

        const text = response.text || "";
        res.status(200).json({ data: JSON.parse(text) });
      } else {
        // Tips
        const response = await generateContentWithFallback(ai, {
          model: "gemini-3.5-flash",
          contents: `Create a single highly actionable, incredibly detailed, specific Travel Tip about: "${prompt}" under the category: "${category}".
          Write a short title and paragraph-length content containing local Balinese terms or culture insights. Avoid generic ideas.
          Respond in JSON format complying with the schema.`,
          config: {
            systemInstruction: "You are an expert Bali Travel Advisor for Bali Adventours. You generate premium travel tips and insights.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING }
              },
              required: ["title", "content"]
            }
          }
        });

        const text = response.text || "";
        res.status(200).json({ data: JSON.parse(text) });
      }

    } catch (error: any) {
      console.error("[AI Content Gen Error]:", error);
      res.status(500).json({ error: error.message || "Failed to generate AI contents." });
    }
  });

  // API Route: AI Grounded Concierge Search & Chat (Public)
  app.post("/api/gemini/ask-concierge", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Missing query or invalid input." });
      }

      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey) {
        return res.status(400).json({ error: "Gemini API service is currently not configured on this server." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      let response;
      let fellBack = false;

      try {
        response = await generateContentWithFallback(ai, {
          model: "gemini-3.5-flash",
          contents: query,
          config: {
            systemInstruction: `You are the Grounded AI Travel Concierge for "Bali Adventours", an ultra-premium tour operator, private driver service, and local adventure curator in Bali, Indonesia. 
            Your goal is to answer tourist questions with absolute accuracy, providing real-world context gathered from search results.
            
            STYLE & GUIDELINES:
            - Use a warm, authentic, local-expert Balinese-friendly tone (e.g. "Suksma!", "Selamat Siang!").
            - Avoid generic or vague advice. Quote prices in Indonesian Rupiah (IDR) where appropriate.
            - Structure your answer cleanly with paragraphs. Do not use complex tables.
            - Keep your response friendly and highly informative.`,
            tools: [{ googleSearch: {} }]
          }
        });
      } catch (err: any) {
        const errMsg = (err.message || "").toLowerCase();
        // If the query exceeds quota, rate limits (429), or says resource is exhausted, fall back to core AI model
        if (
          errMsg.includes("quota") || 
          errMsg.includes("exhausted") || 
          errMsg.includes("rate") || 
          errMsg.includes("429") || 
          errMsg.includes("limit") ||
          errMsg.includes("experiencing high demand") ||
          errMsg.includes("unavailable")
        ) {
          console.warn("[Grounded Concierge Warning] Google Search Grounding quota or access limited. Falling back to Core Knowledge AI generation...");
          fellBack = true;

          response = await generateContentWithFallback(ai, {
            model: "gemini-3.5-flash",
            contents: query,
            config: {
              systemInstruction: `You are the AI Travel Concierge for "Bali Adventours", an ultra-premium tour operator, private driver service, and local adventure curator in Bali, Indonesia. 
              Your goal is to answer tourist questions with absolute accuracy, using your core knowledge.
              
              STYLE & GUIDELINES:
              - Use a warm, authentic, local-expert Balinese-friendly tone (e.g. "Suksma!", "Selamat Siang!").
              - Avoid generic or vague advice. Quote prices in Indonesian Rupiah (IDR) where appropriate.
              - Structure your answer cleanly with paragraphs. Do not use complex tables.
              - Keep your response friendly and highly informative.`
            }
          });
        } else {
          // If it is another kind of error entirely, bubble it
          throw err;
        }
      }

      // Extract the answer content
      const answer = response.text || "I was unable to search for this information. Please try rephrasing.";

      // Extract search grounding metadata sources/citations if present
      const sources: { title: string; url: string }[] = [];
      const candidate = response.candidates?.[0];
      const groundingMetadata = candidate?.groundingMetadata;
      const groundingChunks = groundingMetadata?.groundingChunks;

      if (Array.isArray(groundingChunks)) {
        groundingChunks.forEach(chunk => {
          const web = chunk.web;
          if (web && web.uri) {
            sources.push({
              title: web.title || "Reference Source",
              url: web.uri
            });
          }
        });
      }

      // De-duplicate sources
      const uniqueSources = Array.from(new Map(sources.map(item => [item.url, item])).values());

      res.status(200).json({ 
        answer,
        sources: uniqueSources,
        fellBack
      });

    } catch (error: any) {
      console.error("[Grounded Concierge Error]:", error);
      res.status(500).json({ error: error.message || "Failed to process chat consultation." });
    }
  });

  // API Route: Generate Tour Data (Public/Admin proxy)
  app.post("/api/gemini/generate-tour", async (req, res) => {
    try {
      const { prompt, apiKey } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Missing required field: prompt" });
      }

      const finalKey = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
      if (!finalKey) {
        return res.status(400).json({ error: "Gemini API Key is not configured on the server." });
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: finalKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await generateContentWithFallback(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are a professional travel tour designer for a luxury tour company in Bali called "Bali Adventours".
Your task is to take a rough prompt or itinerary list and transform it into a highly detailed, professional tour description.

VOICE & STYLE:
- Avoid "corporate" or overly polished "marketing" speak.
- Use a storytelling, authentic, and conversational tone, as if a local friend is explaining the experience.
- Focus on the sensory details—the sounds, sights, and feelings—of the experience.
- Keep the language inviting and warm, not just a list of facts.

ITINERARY RULES:
- The first item in the itinerary MUST ALWAYS be "Pick up from the hotel" with a professional description of the meeting and transport.
- The last item in the itinerary MUST ALWAYS be "Back to hotel" with a description of the return journey and drop-off.
- Ensure the middle items flow logically like a real day's adventure.

The output MUST be in valid JSON format according to the schema provided.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Catchy and professional tour title" },
              description: { type: Type.STRING, description: "Detailed and engaging tour description" },
              duration: { type: Type.STRING, description: "Estimated duration e.g. '8 Hours' or 'Full Day'" },
              highlights: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Top 4-6 key features or highlights of the tour"
              },
              inclusions: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "What's included (e.g. Private transport, Entrance fees, Mineral water)"
              },
              exclusions: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "What's NOT included (e.g. Personal expenses, Tips, Lunch)"
              },
              itinerary: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["day", "title", "description"]
                },
                description: "Chronological list of activities"
              },
              importantInfo: { type: Type.STRING, description: "Brief important notes for the traveler" }
            },
            required: ["title", "description", "duration", "highlights", "inclusions", "exclusions", "itinerary"]
          }
        }
      });

      let text = response.text || "";
      if (text.includes("```json")) {
        text = text.split("```json")[1].split("```")[0].trim();
      } else if (text.includes("```")) {
        text = text.split("```")[1].split("```")[0].trim();
      }

      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("[Generate Tour Server Error]:", error);
      res.status(500).json({ error: error.message || "Failed to generate tour" });
    }
  });

  // API Route: Generate Blog Post Data (Public/Admin proxy)
  app.post("/api/gemini/generate-blog", async (req, res) => {
    try {
      const { prompt, apiKey } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Missing required field: prompt" });
      }

      const finalKey = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
      if (!finalKey) {
        return res.status(400).json({ error: "Gemini API Key is not configured on the server." });
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: finalKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await generateContentWithFallback(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are a professional travel blogger and SEO expert writing for "Bali Adventours".
Your task is to write high-quality, engaging, and SEO-optimized blog posts about Bali and travel.

VOICE & STYLE:
- Use an inspiring, adventurous, yet helpful tone.
- Write in English but feel free to use local Balinese/Indonesian terms with brief explanations where appropriate (e.g., "Canang Sari").
- The content should be informative, providing real value to travelers (tips, hidden gems, cultural etiquette).
- Use proper HTML formatting inside the 'content' field (h2, h3, p, ul, li) for readability.
- The content should be at least 600-800 words long.

The output MUST be in valid JSON format including title, excerpt, full HTML content, category, and tags.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Captivating SEO-friendly blog title" },
              excerpt: { type: Type.STRING, description: "A short, intriguing 2-sentence summary to encourage clicks" },
              content: { type: Type.STRING, description: "Full blog post content with HTML tags (h2, h3, p, ul, li)" },
              category: { type: Type.STRING, description: "Best matching category (e.g., Adventure, Culture, Food, Guide, News)" },
              tags: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "4-6 relevant SEO tags"
              }
            },
            required: ["title", "excerpt", "content", "category", "tags"]
          }
        }
      });

      let text = response.text || "";
      if (text.includes("```json")) {
        text = text.split("```json")[1].split("```")[0].trim();
      } else if (text.includes("```")) {
        text = text.split("```")[1].split("```")[0].trim();
      }

      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("[Generate Blog Server Error]:", error);
      res.status(500).json({ error: error.message || "Failed to generate blog post" });
    }
  });

  // API Route: Generate Itinerary (Public/Admin proxy)
  app.post("/api/gemini/generate-itinerary", async (req, res) => {
    try {
      const { userData, apiKey } = req.body;
      if (!userData) {
        return res.status(400).json({ error: "Missing required field: userData" });
      }

      const finalKey = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
      if (!finalKey) {
        return res.status(400).json({ error: "Gemini API Key is not configured on the server." });
      }

      // Fetch active tours context from Admin SDK or REST fallback
      let availableTours: any[] = [];
      try {
        const toursSnap = await db.collection('tours').where('status', '==', 'active').limit(20).get();
        if (!toursSnap.empty) {
          availableTours = toursSnap.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
            slug: doc.data().slug,
            category: doc.data().category,
            highlights: doc.data().highlights?.join(', ') || ''
          }));
        }
      } catch (sdkErr: any) {
        console.warn("[Itinerary Fetch Admin SDK failed, using REST fallback]:", sdkErr.message);
        try {
          const toursRest = await fetchFromREST('tours', undefined, {
            whereFilters: [{ field: 'status', op: 'EQUAL', value: 'active' }],
            limit: 20
          });
          availableTours = (toursRest || []).map((t: any) => ({
            id: t.id,
            title: t.title,
            slug: t.slug,
            category: t.category,
            highlights: Array.isArray(t.highlights) ? t.highlights.join(', ') : ''
          }));
        } catch (restErr: any) {
          console.error("[Itinerary Fetch REST fallback failed]:", restErr.message);
        }
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: finalKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `
        Create a detailed Bali travel itinerary for:
        Name: ${userData.name}
        From: ${userData.from}
        Dates/Trip Timing: ${userData.tripTiming}
        Duration: ${userData.duration} Days
        Travelers: ${userData.persons} Persons
        Interests: ${userData.interests}
        Preferred Places: ${userData.places}
        Food Preferences: ${userData.food}
        Must-visit Spots: ${userData.hotspots}
        Experience Type: ${userData.experience}
        Hotel Preference: ${userData.hotelType}
        Budget Range: ${userData.budget}

        Context - Available Tours from Bali Adventours:
        ${JSON.stringify(availableTours)}

        Please design a realistic, high-quality, and personalized itinerary from airport pickup to airport drop-off.
        Recommend specific hotels that match their preference.
        Match their interests with our existing tours listed above where appropriate.
        Provide a day-by-day breakdown with various activity types (activity, hotel, meal, transport).
      `;

      const response = await generateContentWithFallback(ai, {
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are "Didi", the expert AI Travel Planner for Bali Adventours. 
Your goal is to create a dream Bali vacation plan that feels authentic, luxurious, and perfectly tailored.

RULES:
1. Use a warm, professional, yet adventurous tone.
2. Ensure the flow of the trip makes geographical sense (e.g., don't jump from South Bali to North Bali twice in one day).
3. Recommend our actual tours (from the provided list) where they fit the user's interests.
4. Include estimated budgets in the local currency (IDR) or USD if more appropriate for the user's origin.
5. The output MUST be valid JSON.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              planTitle: { type: Type.STRING },
              summary: { type: Type.STRING },
              dailyPlans: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    day: { type: Type.NUMBER },
                    title: { type: Type.STRING },
                    activities: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          time: { type: Type.STRING },
                          title: { type: Type.STRING },
                          description: { type: Type.STRING },
                          type: { type: Type.STRING, enum: ['activity', 'hotel', 'meal', 'transport'] }
                        },
                        required: ["time", "title", "description", "type"]
                      }
                    },
                    accommodationRecommendation: {
                      type: Type.OBJECT,
                      properties: {
                        name: { type: Type.STRING },
                        reason: { type: Type.STRING },
                        estimatedPrice: { type: Type.STRING }
                      },
                      required: ["name", "reason"]
                    }
                  },
                  required: ["day", "title", "activities", "accommodationRecommendation"]
                }
              },
              recommendedTours: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tourId: { type: Type.STRING },
                    title: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    slug: { type: Type.STRING }
                  }
                }
              },
              estimatedTotalBudget: {
                type: Type.OBJECT,
                properties: {
                  amount: { type: Type.STRING },
                  breakdown: { type: Type.STRING }
                }
              },
              travelTips: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["planTitle", "summary", "dailyPlans", "recommendedTours", "estimatedTotalBudget", "travelTips"]
          }
        }
      });

      let text = response.text || "";
      if (text.includes("```json")) {
        text = text.split("```json")[1].split("```")[0].trim();
      } else if (text.includes("```")) {
        text = text.split("```")[1].split("```")[0].trim();
      }

      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("[Generate Itinerary Server Error]:", error);
      res.status(500).json({ error: error.message || "Failed to generate itinerary" });
    }
  });

  // API Route: Extract Booking From Email (Public/Admin proxy)
  app.post("/api/gemini/extract-booking", async (req, res) => {
    try {
      const { emailText, apiKey } = req.body;
      if (!emailText) {
        return res.status(400).json({ error: "Missing required field: emailText" });
      }

      const finalKey = apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
      if (!finalKey) {
        return res.status(400).json({ error: "Gemini API Key is not configured on the server." });
      }

      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: finalKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const response = await generateContentWithFallback(ai, { 
        model: "gemini-3.5-flash",
        contents: `EXTRACT BOOKING DATA FROM THE FOLLOWING EMAIL TEXT.
        
        EMAIL TEXT:
        """
        ${emailText}
        """
        
        INSTRUCTIONS:
        - Identify the customer name, email, and phone.
        - Identify the tour title / activity name.
        - Identify the booking date (format: YYYY-MM-DD). Use today's year if not specified but the month/day is.
        - Identify the number of adults and children.
        - Identify the total amount paid and currency.
        - Identify the booking platform (Klook, Viator, GetYourGuide, etc.).
        - If any field is missing, leave it as null or 0.
        
        Output MUST be valid JSON matching the schema provided.`,
        config: {
          systemInstruction: `You are a specialized booking data extractor for Bali Adventours. 
          You handle emails from Klook, Viator, GetYourGuide, and other OTAs.
          Extract every detail accurately. If a phone number is present with a country code, preserve the full number.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              customerName: { type: Type.STRING },
              customerEmail: { type: Type.STRING },
              customerPhone: { type: Type.STRING },
              tourTitle: { type: Type.STRING },
              date: { type: Type.STRING, description: "Format: YYYY-MM-DD" },
              time: { type: Type.STRING },
              adults: { type: Type.NUMBER },
              children: { type: Type.NUMBER },
              totalAmount: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              packageName: { type: Type.STRING },
              specialRequirements: { type: Type.STRING },
              bookingReference: { type: Type.STRING },
              source: { type: Type.STRING, description: "The platform name (e.g., Klook, Viator)" }
            },
            required: ["customerName", "tourTitle", "date", "adults", "totalAmount", "source"]
          }
        }
      });

      let text = response.text || "";
      if (text.includes("```json")) {
        text = text.split("```json")[1].split("```")[0].trim();
      } else if (text.includes("```")) {
        text = text.split("```")[1].split("```")[0].trim();
      }

      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("[Extract Booking Server Error]:", error);
      res.status(500).json({ error: error.message || "Failed to extract booking data" });
    }
  });

  // API Route: Chatbot Endpoint
  app.post("/api/chatbot", async (req, res) => {
    try {
      const { messages, origin: reqOrigin } = req.body;
      const origin = reqOrigin || req.headers.origin || `https://${req.headers.host}`;
      const result = await handleChatbotRequest(messages, origin);
      res.json(result);
    } catch (error: any) {
      console.error("[Server Chatbot API Error]:", error);
      res.status(500).json({ error: error.message || "Failed to process chatbot request" });
    }
  });

  // API Route: Send WhatsApp
  app.post("/api/send-whatsapp", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
      const { 
        type, 
        booking, 
        customMessage, 
        message: fallbackMessage, 
        receiver, 
        sessionId, 
        token, 
        baseUrl, 
        provider, 
        file, 
        filename, 
        attachManifest, 
        attachVoucher,
        wabaAccessToken,
        wabaPhoneNumberId,
        wabaTemplateName,
        wabaLanguageCode
      } = req.body;
      const finalMessageContent = customMessage || fallbackMessage;

      console.log(`[API /api/send-whatsapp] Request received. Type: ${type}, Receiver: ${receiver || booking?.customerData?.phone}, attachManifest: ${attachManifest}, attachVoucher: ${attachVoucher}`);

      // SECURITY: Verify user is authorized
      const authResult = await verifyAdmin(idToken);
      const isOwner = await verifyUser(idToken, booking?.userId);
      const isAnonymousBooking = booking && booking.userId === 'anonymous';
      const guestAllowedTypes = ['booking_confirmation', 'admin_notification', 'booking_status_updated'];

      // Allow sending custom messages if they are an admin
      const isCustomAllowed = (finalMessageContent || file || attachManifest || attachVoucher) && authResult.isAdmin;
      const isBookingNotificationAllowed = !finalMessageContent && !file && !attachManifest && !attachVoucher && (authResult.isAdmin || isOwner || (isAnonymousBooking && guestAllowedTypes.includes(type)));

      if (!isCustomAllowed && !isBookingNotificationAllowed) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to send messages or notifications." });
      }

      // Fetch communication settings from Firestore with fallback
      let settings: any = {};
      try {
        const settingsDoc = await db.collection('communicationSettings').doc('global').get();
        if (settingsDoc.exists) {
          settings = settingsDoc.data();
        }
      } catch (dbErr) {
        console.error("[WhatsApp Proxy Error] DB Fetch failed:", dbErr);
      }
      
      const isEnabled = settings.hasOwnProperty('whatsappEnabled') ? settings.whatsappEnabled : true;
      if (!isEnabled && !finalMessageContent && !file && !attachManifest && !attachVoucher) {
        return res.json({ success: false, error: 'WhatsApp is disabled in settings' });
      }

      let message = '';
      let targetNumber = receiver || booking?.customerData?.phone;

      if (finalMessageContent) {
        message = finalMessageContent;
      } else if (type === 'booking_confirmation') {
        const template = settings.whatsappTemplates?.booking_confirmation?.message || 
          "Halo {{customerName}}, booking anda untuk {{tourTitle}} pada tanggal {{date}} telah dikonfirmasi. Booking ID: {{bookingId}}";
        message = formatWhatsAppMessage(template, booking);
      } else if (type === 'admin_notification') {
        const template = settings.whatsappTemplates?.admin_notification?.message || 
          "New Booking Alert! {{customerName}} booked {{tourTitle}} for {{date}}. Total: {{totalAmount}}";
        message = formatWhatsAppMessage(template, booking);
        targetNumber = settings.adminNotificationPhone;
      } else if (type === 'booking_status_updated') {
        const template = settings.whatsappTemplates?.booking_status_updated?.message || 
          "Halo {{customerName}}, status booking anda {{bookingId}} telah diperbarui menjadi: {{status}}";
        message = formatWhatsAppMessage(template, booking);
      }

      if (!targetNumber) {
        return res.status(400).json({ success: false, error: 'No receiver number provided' });
      }

      let fileToSend = file;
      let filenameToSend = filename;

      if (!fileToSend && booking) {
        if (attachManifest) {
          try {
            const config = await resolveEmailConfig();
            const pdfBuffer = await generateManifestPdf(booking, config);
            fileToSend = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
            filenameToSend = filename || `Tour-Manifest-${booking.id.substring(0, 8).toUpperCase()}.pdf`;
            console.log(`[API /api/send-whatsapp] Automatically generated Manifest PDF for booking ${booking.id}`);
          } catch (manifestErr: any) {
            console.error(`[API /api/send-whatsapp] Failed to auto-generate Manifest PDF:`, manifestErr);
          }
        } else if (attachVoucher) {
          try {
            const config = await resolveEmailConfig();
            const pdfBuffer = await generateVoucherPdf(booking, config);
            fileToSend = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
            filenameToSend = filename || `Tour-Voucher-${booking.id.substring(0, 8).toUpperCase()}.pdf`;
            console.log(`[API /api/send-whatsapp] Automatically generated Tour Voucher PDF for booking ${booking.id}`);
          } catch (voucherErr: any) {
            console.error(`[API /api/send-whatsapp] Failed to auto-generate Tour Voucher PDF:`, voucherErr);
          }
        }
      }

      // Determine final provider (defaults to settings.whatsappProvider, fallback to body.provider, fallback to 'openwa')
      const finalProvider = provider || settings.whatsappProvider || 'openwa';

      const finalWabaConfig = {
        accessToken: wabaAccessToken || settings.wabaAccessToken,
        phoneNumberId: wabaPhoneNumberId || settings.wabaPhoneNumberId,
        templateName: wabaTemplateName || settings.wabaTemplateName,
        languageCode: wabaLanguageCode || settings.wabaLanguageCode || 'en',
        booking: booking,
        type: type
      };

      // Use configured OpenWA credentials, supporting inline overrides
      const finalToken = token || settings.openwaApiKey;
      const finalBaseUrl = baseUrl || settings.openwaBaseUrl;
      const finalSessionId = sessionId || settings.openwaSessionId;
      
      const result = await sendWhatsAppMessage({
        number: targetNumber,
        message: message,
        file: fileToSend,
        filename: filenameToSend
      }, finalToken, finalBaseUrl, finalSessionId, finalProvider, finalWabaConfig);

      res.json(result);
    } catch (error: any) {
      console.error("[WhatsApp Proxy Error]:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  });

  // Helper to log all incoming and outgoing WhatsApp messages recursively into Firestore for robust CRM syncing
  const logMessageToFirestore = async (msg: {
    id: string;
    chatId: string;
    from: string;
    to: string;
    body: string;
    direction: 'incoming' | 'outgoing';
    timestamp: any;
    fromMe?: boolean;
    senderName?: string;
    session?: string;
  }) => {
    try {
      const chatId = msg.chatId;
      if (!chatId) return;

      const msgDocId = msg.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const messageRef = db.collection('whatsapp_messages').doc(msgDocId);

      // Declare epoch seconds timestamp standard
      let ts = typeof msg.timestamp === 'number' ? msg.timestamp : Math.floor(Date.now() / 1000);
      if (ts > 9999999999) { // convert millisecond epoch to second epoch
        ts = Math.floor(ts / 1000);
      }

      const payload = {
        id: msgDocId,
        chatId: chatId,
        from: msg.from,
        to: msg.to,
        body: msg.body || '',
        direction: msg.direction,
        fromMe: msg.fromMe ?? (msg.direction === 'outgoing'),
        timestamp: ts,
        createdAt: new Date().toISOString(),
        session: msg.session || 'baliadventours'
      };

      await messageRef.set(payload, { merge: true });

      // Update or Create the Chat/Contact record in Firestore so the chat list shows it
      const chatRef = db.collection('whatsapp_chats').doc(chatId);
      const chatSnap = await chatRef.get();
      
      const chatName = msg.senderName || chatId.split('@')[0];

      const chatPayload = {
        chatId: chatId,
        name: chatName,
        updatedAt: new Date().toISOString(),
        session: msg.session || 'baliadventours',
        lastMessage: {
          id: payload.id,
          body: payload.body,
          fromMe: payload.fromMe,
          timestamp: payload.timestamp,
          direction: payload.direction,
          createdAt: payload.createdAt
        }
      };

      if (!chatSnap.exists) {
        await chatRef.set(chatPayload);
      } else {
        const currentData = chatSnap.data();
        const currentTS = currentData?.lastMessage?.timestamp || 0;
        if (payload.timestamp >= currentTS) {
          await chatRef.update({
            updatedAt: chatPayload.updatedAt,
            lastMessage: chatPayload.lastMessage,
            session: msg.session || 'baliadventours'
          });
        }
      }
    } catch (err) {
      console.error("[logMessageToFirestore Error]:", err);
    }
  };

  // Helper to find session key case-insensitively in any JSON object hierarchy
  const findSessionIdCaseInsensitive = (obj: any): string | undefined => {
    if (!obj || typeof obj !== 'object') return undefined;
    
    // Check keys of the current object level
    const keys = Object.keys(obj);
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'session' || 
          lowerKey === 'sessionid' || 
          lowerKey === 'sessionname' || 
          lowerKey === 'session_id') {
        const val = obj[key];
        if (val && typeof val === 'string') return val.trim();
        if (val && typeof val === 'number') return String(val).trim();
      }
    }

    // Recursively check common sub-structures (avoid infinite loops by choosing specific keys)
    const candidates = ['data', 'payload', 'message', 'object'];
    for (const cand of candidates) {
      if (obj[cand]) {
        const result = findSessionIdCaseInsensitive(obj[cand]);
        if (result) return result;
      }
    }

    return undefined;
  };

  // API Route: Webhook verification handshake for Meta WABA (WhatsApp Cloud API)
  app.get("/api/whatsapp/webhook", async (req, res) => {
    try {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      console.log(`[WhatsApp Webhook GET] Verification handshake requested. Mode: ${mode}, Token: ${token}`);

      if (mode && token) {
        if (mode === 'subscribe') {
          let settings: any = {};
          try {
            const settingsDoc = await db.collection('communicationSettings').doc('global').get();
            if (settingsDoc.exists) {
              settings = settingsDoc.data();
            }
          } catch (dbErr) {
            console.error("[WhatsApp Webhook GET] Settings DB Fetch failed:", dbErr);
          }

          const expectedVerifyToken = settings.wabaVerifyToken || 'baliadventours';

          if (token === expectedVerifyToken) {
            console.log("[WhatsApp Webhook GET] Handshake SUCCESSFUL! Echoing challenge back.");
            return res.status(200).send(challenge);
          } else {
            console.warn(`[WhatsApp Webhook GET] Handshake FAILED: Verify token mismatch. Expected: ${expectedVerifyToken}, Received: ${token}`);
            return res.status(403).send("Forbidden: Verification token mismatch");
          }
        }
      }
      return res.status(400).send("Bad Request: Missing hub.mode or hub.verify_token");
    } catch (error: any) {
      console.error("[WhatsApp Webhook GET Error]:", error);
      return res.status(500).send("Internal Server Error");
    }
  });

  // API Route: Webhook receiver for OpenWA gateway events (capture any inbound and outbound messages live)
  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      if (req.body?.object === "whatsapp_business_account" && req.body?.entry) {
        console.log("[WhatsApp Webhook] WABA Cloud API Event triggered:", JSON.stringify(req.body).substring(0, 600));
        const entries = req.body.entry;
        for (const entry of entries) {
          const changes = entry.changes;
          if (!changes) continue;
          for (const change of changes) {
            if (change.field === "messages") {
              const value = change.value;
              if (value && value.messages && value.messages.length > 0) {
                const message = value.messages[0];
                const fromPhone = message.from;
                const msgId = message.id;
                const contact = value.contacts?.[0];
                const senderName = contact?.profile?.name || "Customer";
                let textBody = "";

                if (message.type === "text" && message.text) {
                  textBody = message.text.body;
                } else if (message.type === "interactive") {
                  const interactive = message.interactive;
                  if (interactive.type === "button_reply") {
                    textBody = interactive.button_reply?.title || "";
                  } else if (interactive.type === "list_reply") {
                    textBody = interactive.list_reply?.title || "";
                  }
                } else {
                  textBody = `[Received ${message.type} message]`;
                }

                console.log(`[WhatsApp WABA Webhook] Message from +${fromPhone} (${senderName}): ${textBody}`);
                
                try {
                  await db.collection('email_logs').add({
                    type: 'WABA Message Received',
                    to: `+${fromPhone} (${senderName})`,
                    provider: 'waba',
                    status: 'success',
                    createdAt: new Date(),
                    errorMessage: `Incoming WhatsApp: "${textBody}" (Message ID: ${msgId})`
                  });
                } catch (logErr: any) {
                  console.error("[WhatsApp Webhook] Logging received message to firestore failed:", logErr.message);
                }
              } else if (value && value.statuses && value.statuses.length > 0) {
                const status = value.statuses[0];
                console.log(`[WhatsApp WABA Webhook] Message status update. Recipient: ${status.recipient_id}, Status: ${status.status}, ID: ${status.id}`);
                
                try {
                  await db.collection('email_logs').add({
                    type: `WABA Delivery Status: ${status.status.toUpperCase()}`,
                    to: `+${status.recipient_id}`,
                    provider: 'waba',
                    status: status.status === 'failed' ? 'skipped' : 'success',
                    createdAt: new Date(),
                    errorMessage: `Status ID: ${status.id}`
                  });
                } catch (logErr: any) {
                  console.error("[WhatsApp Webhook] Logging status update to firestore failed:", logErr.message);
                }
              }
            }
          }
        }
        return res.status(200).json({ success: true, message: "WABA webhook processed successfully" });
      }

      console.log("[WhatsApp Webhook] Event triggered:", req.body?.event, JSON.stringify(req.body).substring(0, 400));
      
      // Look up our active setup session
      let settings: any = {};
      try {
        const settingsDoc = await db.collection('communicationSettings').doc('global').get();
        if (settingsDoc.exists) {
          settings = settingsDoc.data();
        }
      } catch (dbErr) {
        console.error("[WhatsApp Webhook] Settings DB Fetch failed:", dbErr);
      }
      const activeSession = settings.openwaSessionId || 'baliadventours';

      // Load active session metadata to get its UUID on the gateway for webhook validation
      let activeSessionId = settings.resolvedSessionId || '';
      const baseUrl = settings.openwaBaseUrl || 'https://openwa-dashboard-production-b24e.up.railway.app';
      const token = settings.openwaApiKey;
      if (!activeSessionId && token) {
        try {
          const resolved = await resolveOpenWaSession(baseUrl, token, activeSession);
          if (resolved && resolved.id) {
            activeSessionId = String(resolved.id).trim();
          }
        } catch (resolveErr: any) {
          console.log(`[WhatsApp Webhook] Active session UUID resolve failed: ${resolveErr.message}`);
        }
      }

      // Extract incoming session ID case-insensitively and defensively
      let incomingSession = findSessionIdCaseInsensitive(req.body) || '';
      
      // Fallback searches in query or headers
      if (!incomingSession) {
        incomingSession = String(
          req.query?.session || 
          req.query?.sessionId || 
          req.headers?.['x-session-id'] || 
          req.headers?.['session'] || 
          ''
        ).trim();
      }

      const cleanIncoming = incomingSession.trim().toLowerCase();
      const cleanActiveName = activeSession.trim().toLowerCase();
      const cleanActiveId = activeSessionId.trim().toLowerCase();

      // Verify the incoming session to filter out noise from other instances on the shared gateway url
      if (cleanIncoming && cleanActiveName) {
        const matchesName = cleanIncoming === cleanActiveName;
        const matchesId = cleanActiveId ? (cleanIncoming === cleanActiveId) : false;
        
        if (!matchesName && !matchesId) {
          console.log(`[WhatsApp Webhook] Ignored event for session "${incomingSession}". Configured: name="${activeSession}", id="${activeSessionId}".`);
          return res.status(200).json({ success: true, message: `Ignored message from foreign session: ${incomingSession}` });
        }
      }

      let msgData = req.body;
      if (req.body?.data) {
        msgData = req.body.data;
      } else if (req.body?.payload) {
        msgData = req.body.payload;
      } else if (req.body?.message) {
        msgData = req.body.message;
      }

      const from = msgData.from || msgData.senderId || msgData.chatId || msgData.from_jid || 'unknown';
      const to = msgData.to || msgData.receiverId || msgData.to_jid || 'unknown';
      const body = msgData.body || msgData.text || msgData.message || msgData.payload || '';
      const id = msgData.id || msgData.messageId || msgData.msg_id || `msg-${Date.now()}`;
      const fromMe = msgData.fromMe ?? msgData.from_me ?? (msgData.direction === 'outgoing') ?? false;
      const senderName = msgData.sender?.name || msgData.sender?.formattedName || msgData.sender?.pushname || msgData.contact?.name || msgData.pushname;

      let chatId = msgData.chatId || msgData.chat?.id || (fromMe ? to : from);
      if (chatId) {
        chatId = String(chatId);
        if (!chatId.includes('@') && /^\d+$/.test(chatId)) {
          chatId = `${chatId}@c.us`;
        }
      }

      if (chatId && chatId !== 'unknown' && body) {
        // WhatsApp CRM is disabled at user's request. Bypass storing to Firestore entirely to conserve quota.
        console.log(`[WhatsApp Webhook] CRM is disabled. Bypassing Firestore writes for JID: ${chatId}`);
        return res.status(200).json({ success: true, message: "CRM is disabled, database write bypassed." });
      }

      res.status(200).json({ success: true, message: "Webhook payload processed securely" });
    } catch (err: any) {
      console.error("[WhatsApp Webhook Router Error]:", err.message);
      res.status(200).json({ success: false, error: err.message });
    }
  });

  // Helper for resolving friendly session names to UUIDs on OpenWA
  const resolveOpenWaSession = async (baseUrl: string, token: string, sessionNameOrId: string) => {
    const cleanToken = token.replace('Bearer ', '').trim();
    const headers = {
      'Authorization': `Bearer ${cleanToken}`,
      'X-API-Key': cleanToken,
      'X-Api-Key': cleanToken,
      'api-key': cleanToken,
      'Content-Type': 'application/json'
    };

    // 1. Get List of all active sessions
    const response = await axios.get(`${baseUrl.replace(/\/$/, '')}/api/sessions`, {
      headers,
      timeout: 5000
    });

    if (Array.isArray(response.data)) {
      // 2. Locate by name or database UUID id case-insensitively
      const match = response.data.find((s: any) => {
        const sName = String(s.name || '').trim().toLowerCase();
        const sId = String(s.id || '').trim().toLowerCase();
        const searchVal = String(sessionNameOrId || '').trim().toLowerCase();
        return sName === searchVal || sId === searchVal;
      });
      if (match) {
        console.log(`[WhatsApp Server Resolve] Resolved "${sessionNameOrId}" to UUID "${match.id}" with status "${match.status}"`);
        // Silently persist the resolved UUID for hot-path webhook checks
        db.collection('communicationSettings').doc('global').get().then(doc => {
          if (doc.exists) {
            const data = doc.data();
            if (data && data.openwaSessionId === sessionNameOrId && data.resolvedSessionId !== match.id) {
              db.collection('communicationSettings').doc('global').update({
                resolvedSessionId: match.id,
                resolvedSessionStatus: match.status || 'unknown'
              }).catch(dbErr => console.error("[resolveOpenWaSession Cache Save Error]:", dbErr));
            }
          }
        }).catch(() => {});
        return match;
      }
    }
    
    // Fallback to direct GET call if not found in list
    const fallbackRes = await axios.get(`${baseUrl.replace(/\/$/, '')}/api/sessions/${sessionNameOrId}`, {
      headers,
      timeout: 5000
    });
    const fallbackData = fallbackRes.data;
    if (fallbackData && fallbackData.id) {
      // Silently persist session in fallback case too
      db.collection('communicationSettings').doc('global').get().then(doc => {
        if (doc.exists) {
          const data = doc.data();
          if (data && data.openwaSessionId === sessionNameOrId && data.resolvedSessionId !== fallbackData.id) {
            db.collection('communicationSettings').doc('global').update({
              resolvedSessionId: fallbackData.id,
              resolvedSessionStatus: fallbackData.status || 'unknown'
            }).catch(dbErr => console.error("[resolveOpenWaSession Fallback Cache Save Error]:", dbErr));
          }
        }
      }).catch(() => {});
    }
    return fallbackData;
  };

  // Helper to dynamically align OpenWA Webhook to our running backend instance
  const registerWebhookOnGateway = async (baseUrl: string, token: string, sessionNameOrId: string, reqHost: string) => {
    try {
      const cleanToken = token.replace('Bearer ', '').trim();
      const headers = {
        'Authorization': `Bearer ${cleanToken}`,
        'X-API-Key': cleanToken,
        'X-Api-Key': cleanToken,
        'api-key': cleanToken,
        'Content-Type': 'application/json'
      };

      let uuid = sessionNameOrId;
      try {
        const resolved = await resolveOpenWaSession(baseUrl, token, sessionNameOrId);
        uuid = resolved.id || sessionNameOrId;
      } catch (err: any) {
        console.log(`[WhatsApp Webhook Register] Session resolve warning during registration: ${err.message}`);
      }

      const protocol = reqHost.includes('localhost') || reqHost.includes('127.0.0.1') ? 'http' : 'https';
      const currentWebhookUrl = `${protocol}://${reqHost}/api/whatsapp/webhook`;
      console.log(`[WhatsApp Webhook Register] Harmonizing gateway to push events to: "${currentWebhookUrl}" on session: "${uuid}"`);

      const methodPath = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}`;
      let setSuccess = false;

      // Pathway 1: setWebhook RPC invocation
      try {
        const resRPC = await axios.post(methodPath, {
          method: "setWebhook",
          args: [currentWebhookUrl]
        }, { headers, timeout: 5000 });
        console.log(`[WhatsApp Webhook Register] Pathway 1 (setWebhook RPC) response status: ${resRPC.status}`);
        setSuccess = true;
      } catch (err1: any) {
        console.log(`[WhatsApp Webhook Register] Pathway 1 failed: ${err1.message}`);
      }

      // Pathway 2: Configure route
      if (!setSuccess) {
        try {
          const resConfig = await axios.post(`${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/configure`, {
            webhookUrl: currentWebhookUrl
          }, { headers, timeout: 5000 });
          console.log(`[WhatsApp Webhook Register] Pathway 2 (/configure) response status: ${resConfig.status}`);
          setSuccess = true;
        } catch (err2: any) {
          console.log(`[WhatsApp Webhook Register] Pathway 2 failed: ${err2.message}`);
        }
      }

      // Pathway 3: Webhooks list
      if (!setSuccess) {
        try {
          const resWebhooks = await axios.post(`${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/webhooks`, {
            url: currentWebhookUrl
          }, { headers, timeout: 5000 });
          console.log(`[WhatsApp Webhook Register] Pathway 3 (/webhooks) response status: ${resWebhooks.status}`);
          setSuccess = true;
        } catch (err3: any) {
          console.log(`[WhatsApp Webhook Register] Pathway 3 failed: ${err3.message}`);
        }
      }

      if (setSuccess) {
        console.log(`[WhatsApp Webhook Register] Successfully synchronized webhook alignment on Gateway to point to: "${currentWebhookUrl}"`);
      } else {
        console.warn(`[WhatsApp Webhook Register] Alignment warning: Webhook registration could not be fully reconciled.`);
      }
    } catch (gErr: any) {
      console.error("[WhatsApp Webhook Register Global Error]:", gErr.message);
    }
  };

  // API Route: Get WhatsApp Session Status
  app.get("/api/whatsapp-status", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
      const authResult = await verifyAdmin(idToken);
      if (!authResult.isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required." });
      }

      // Fetch settings
      let settings: any = {};
      try {
        const settingsDoc = await db.collection('communicationSettings').doc('global').get();
        if (settingsDoc.exists) {
          settings = settingsDoc.data();
        }
      } catch (dbErr) {
        console.error("[WhatsApp Status Error] DB Fetch failed:", dbErr);
      }

      const baseUrl = settings.openwaBaseUrl || 'https://openwa-dashboard-production-b24e.up.railway.app';
      const session = settings.openwaSessionId || 'baliadventours';
      const token = settings.openwaApiKey;

      if (!token) {
        return res.json({ success: false, error: "OpenWA API Token is not configured in settings." });
      }

      const resolved = await resolveOpenWaSession(baseUrl, token, session);

      // Register / Align webhook dynamically under high reliability
      const reqHost = req.get('host');
      if (reqHost) {
        registerWebhookOnGateway(baseUrl, token, session, reqHost).catch(autoErr => {
          console.error("[WhatsApp Status] Auto register webhook error:", autoErr.message);
        });
      }

      res.json({ success: true, data: resolved });
    } catch (error: any) {
      console.error("[WhatsApp Status Proxy Error]:", error.response?.data || error.message);
      res.json({ 
        success: false, 
        error: error.response?.data?.message || error.message || "Failed to fetch status" 
      });
    }
  });

  // API Route: Get WhatsApp Messages
  app.get("/api/whatsapp-messages", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
      const authResult = await verifyAdmin(idToken);
      if (!authResult.isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required." });
      }

      // Fetch settings
      let settings: any = {};
      try {
        const settingsDoc = await db.collection('communicationSettings').doc('global').get();
        if (settingsDoc.exists) {
          settings = settingsDoc.data();
        }
      } catch (dbErr) {
        console.error("[WhatsApp Messages Proxy Error] DB Fetch failed:", dbErr);
      }

      const baseUrl = settings.openwaBaseUrl || 'https://openwa-dashboard-production-b24e.up.railway.app';
      const session = settings.openwaSessionId || 'baliadventours';
      const token = settings.openwaApiKey;

      if (!token) {
        return res.json({ success: false, error: "OpenWA API Token is not configured in settings." });
      }

      const cleanToken = token.replace('Bearer ', '').trim();
      const headers = {
        'Authorization': `Bearer ${cleanToken}`,
        'X-API-Key': cleanToken,
        'X-Api-Key': cleanToken,
        'api-key': cleanToken,
        'Content-Type': 'application/json'
      };

      let uuid = session;
      try {
        const resolved = await resolveOpenWaSession(baseUrl, token, session);
        uuid = resolved.id || session;
      } catch (err: any) {
        console.log(`[WhatsApp Messages] Session resolve failed for "${session}": ${err.message}`);
      }

      const { chatId, limit, offset } = req.query;
      const queryLimit = limit ? Number(limit) : 100;
      let liveMessages: any[] = [];

      if (chatId) {
        console.log(`[WhatsApp Messages] Specific chat messages requested for JID: ${chatId}`);
        let formattedChatId = String(chatId);
        if (!formattedChatId.includes('@') && /^\d+$/.test(formattedChatId)) {
          formattedChatId = `${formattedChatId}@c.us`;
        }

        const methodPath = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}`;
        
        let response;
        try {
          console.log(`[WhatsApp Messages] Strategy 1: getMessages for JID on ${methodPath}`);
          response = await axios.post(methodPath, {
            method: "getMessages",
            args: [formattedChatId, { limit: queryLimit }]
          }, { headers, timeout: 6000 });
        } catch (err1: any) {
          console.log(`[WhatsApp Messages] Strategy 1 failed: ${err1.message}. Trying Strategy 2: getAllMessagesInChat...`);
          try {
            response = await axios.post(methodPath, {
              method: "getAllMessagesInChat",
              args: [formattedChatId, true, true]
            }, { headers, timeout: 6000 });
          } catch (err2: any) {
            console.log(`[WhatsApp Messages] Strategy 2 failed: ${err2.message}. Trying Strategy 3: chats/messages path...`);
            try {
              const pathFallback1 = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/chats/${formattedChatId}/messages`;
              response = await axios.get(pathFallback1, { headers, timeout: 6000 });
            } catch (err3: any) {
              console.log(`[WhatsApp Messages] Strategy 3 failed: ${err3.message}. Trying Strategy 4: /messages ...`);
              try {
                const pathGlobal = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/messages`;
                response = await axios.get(pathGlobal, {
                  headers,
                  params: { chatId: formattedChatId, limit: queryLimit },
                  timeout: 6000
                });
              } catch (err4: any) {
                console.log(`[WhatsApp Messages] Live gateway fetch warning: ${err4.message}`);
              }
            }
          }
        }

        if (response && response.data) {
          const dataNode = response.data;
          let messagesArray = Array.isArray(dataNode) ? dataNode : (dataNode?.response || dataNode?.data || dataNode?.messages || dataNode?.result);
          if (!messagesArray && dataNode && typeof dataNode === 'object') {
            const arrayProp = Object.values(dataNode).find(Array.isArray);
            if (arrayProp) {
              messagesArray = arrayProp;
            }
          }
          if (messagesArray && Array.isArray(messagesArray)) {
            liveMessages = messagesArray;
            // Persist newly retrieved live messages to Firestore cache
            for (const m of liveMessages) {
              const msgId = m.id || m.messageId || `sync-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              const fromStr = getJidString(m.from);
              const toStr = getJidString(m.to);
              
              const isSelf = m.fromMe === true || 
                             String(m.fromMe) === 'true' || 
                             m.from_me === true || 
                             String(m.from_me) === 'true' || 
                             m.direction === 'outgoing' ||
                             m.isSelf === true ||
                             String(m.isSelf) === 'true' ||
                             m.sender?.isMe === true ||
                             String(m.sender?.isMe) === 'true';

              const direction = isSelf ? 'outgoing' : 'incoming';
              const bodyText = m.body || m.text || m.message || '';

              if (bodyText) {
                await logMessageToFirestore({
                  id: String(msgId),
                  chatId: formattedChatId,
                  from: fromStr || (isSelf ? 'user' : formattedChatId),
                  to: toStr || (isSelf ? formattedChatId : 'user'),
                  body: bodyText,
                  direction,
                  timestamp: m.timestamp || m.time || Math.floor(Date.now() / 1000),
                  fromMe: isSelf,
                  senderName: m.sender?.name || m.contact?.name || formattedChatId.split('@')[0],
                  session: session
                }).catch(err => console.error("[WhatsApp Messages] Firestore cache log failed:", err));
              }
            }
          }
        }

        // Fetch local archived messages from Firestore
        let localMessages: any[] = [];
        try {
          const snap = await db.collection('whatsapp_messages')
            .where('chatId', '==', formattedChatId)
            .limit(queryLimit)
            .get();
          snap.forEach(docSnap => {
            localMessages.push(docSnap.data());
          });
          // Filter local messages in memory per session and exclude the foreign spam number
          localMessages = localMessages.filter((msg: any) => {
            const mSess = String(msg.session || '').trim().toLowerCase();
            const configSess = String(session || '').trim().toLowerCase();
            const resolvedSess = String(uuid || '').trim().toLowerCase();
            const matchesSession = !msg.session || mSess === configSess || mSess === resolvedSess;
            return matchesSession && 
              msg.chatId !== "32246832590961@c.us" && 
              msg.from !== "32246832590961@c.us";
          });
          console.log(`[WhatsApp Messages] Retrieved ${localMessages.length} archived messages from Firestore for session "${session}".`);
        } catch (dbErr) {
          console.error(`[WhatsApp Messages] Firestore query failed:`, dbErr);
        }

        // Merge messages smoothly by unique ID
        const mergedMap = new Map<string, any>();

        // 1. Put Firestore messages
        localMessages.forEach((msg) => {
          const msgId = msg.id || msg.messageId;
          if (msgId) {
            mergedMap.set(String(msgId), msg);
          }
        });

        // 2. Put Gateway messages
        liveMessages.forEach((msg) => {
          const msgId = msg.id || msg.messageId;
          if (msgId) {
            const currentObj = mergedMap.get(String(msgId)) || {};
            mergedMap.set(String(msgId), {
              ...currentObj,
              ...msg,
              id: msgId,
              chatId: formattedChatId
            });
          }
        });

        const mergedList = Array.from(mergedMap.values())
          .filter((msg: any) => {
            const jid = String(msg.chatId || msg.from || '').toLowerCase();
            const isGroup = jid.endsWith('@g.us') || jid.endsWith('@g.id') || jid.endsWith('@temp');
            const isBroadcast = jid.includes('broadcast') || jid.includes('status');
            const isBelgiumSpam = jid.includes('32246832590961');
            return !isGroup && !isBroadcast && !isBelgiumSpam;
          })
          .sort((a, b) => {
            const timeA = new Date(a.createdAt || (a.timestamp ? a.timestamp * 1000 : 0)).getTime();
            const timeB = new Date(b.createdAt || (b.timestamp ? b.timestamp * 1000 : 0)).getTime();
            return timeA - timeB; // ascending chronological order
          });

        return res.json({ success: true, data: mergedList });
      } else {
        // Global timeline sequence requested
        let limitNum = limit ? Number(limit) : 100;
        let response;
        try {
          let path = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/messages`;
          response = await axios.get(path, {
            headers,
            params: { limit: limitNum, offset: offset ? Number(offset) : 0 },
            timeout: 6000
          });
        } catch (err: any) {
          console.log(`[WhatsApp Messages] Global fetch failed: ${err.message}. Trying get-all-messages...`);
          try {
            const pathFallbackAll = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/get-all-messages`;
            response = await axios.get(pathFallbackAll, { headers, timeout: 6000 });
          } catch (errAll: any) {
            console.log(`[WhatsApp Messages] Live global timeline failed: ${errAll.message}`);
          }
        }

        if (response && response.data) {
          const dataNode = response.data;
          let messagesArray = Array.isArray(dataNode) ? dataNode : (dataNode?.response || dataNode?.data || dataNode?.messages || dataNode?.result);
          if (!messagesArray && dataNode && typeof dataNode === 'object') {
            const arrayProp = Object.values(dataNode).find(Array.isArray);
            if (arrayProp) {
              messagesArray = arrayProp;
            }
          }
          if (messagesArray && Array.isArray(messagesArray)) {
            liveMessages = messagesArray;
            // Persist global timeline messages to Firestore cache
            for (const m of liveMessages) {
              const msgId = m.id || m.messageId || `sync-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              const fromStr = getJidString(m.from);
              const toStr = getJidString(m.to);
              const msgChatId = getJidString(m.chatId || m.chat?.id || fromStr);
              if (!msgChatId) continue;

              const isSelf = m.fromMe === true || 
                             String(m.fromMe) === 'true' || 
                             m.from_me === true || 
                             String(m.from_me) === 'true' || 
                             m.direction === 'outgoing' ||
                             m.isSelf === true ||
                             String(m.isSelf) === 'true' ||
                             m.sender?.isMe === true ||
                             String(m.sender?.isMe) === 'true';

              const direction = isSelf ? 'outgoing' : 'incoming';
              const bodyText = m.body || m.text || m.message || '';

              if (bodyText) {
                await logMessageToFirestore({
                  id: String(msgId),
                  chatId: msgChatId,
                  from: fromStr || (isSelf ? 'user' : msgChatId),
                  to: toStr || (isSelf ? msgChatId : 'user'),
                  body: bodyText,
                  direction,
                  timestamp: m.timestamp || m.time || Math.floor(Date.now() / 1000),
                  fromMe: isSelf,
                  senderName: m.sender?.name || m.contact?.name || msgChatId.split('@')[0],
                  session: session
                }).catch(err => console.error("[WhatsApp Global] Firestore cache log failed:", err));
              }
            }
          }
        }

        // Fetch latest messages from Firestore
        let localMessages: any[] = [];
        try {
          const dbSnap = await db.collection('whatsapp_messages')
            .orderBy('createdAt', 'desc')
            .limit(limitNum)
            .get();
          dbSnap.forEach(docSnap => {
            localMessages.push(docSnap.data());
          });
          // Filter local messages in memory per session and exclude the foreign spam number
          localMessages = localMessages.filter((msg: any) => {
            const mSess = String(msg.session || '').trim().toLowerCase();
            const configSess = String(session || '').trim().toLowerCase();
            const resolvedSess = String(uuid || '').trim().toLowerCase();
            const matchesSession = !msg.session || mSess === configSess || mSess === resolvedSess;
            return matchesSession && 
              msg.chatId !== "32246832590961@c.us" && 
              msg.from !== "32246832590961@c.us";
          });
        } catch (dbErr) {
          console.error(`[WhatsApp Global Messages] Firestore fetch failed:`, dbErr);
        }

        // Merge global history
        const mergedMap = new Map<string, any>();
        localMessages.forEach((msg) => {
          const msgId = msg.id || msg.messageId;
          if (msgId) {
            mergedMap.set(String(msgId), msg);
          }
        });
        liveMessages.forEach((msg) => {
          const msgId = msg.id || msg.messageId;
          if (msgId) {
            const currentObj = mergedMap.get(String(msgId)) || {};
            mergedMap.set(String(msgId), {
              ...currentObj,
              ...msg,
              id: msgId
            });
          }
        });

        const mergedList = Array.from(mergedMap.values())
          .filter((msg: any) => {
            const jid = String(msg.chatId || msg.from || '').toLowerCase();
            const isGroup = jid.endsWith('@g.us') || jid.endsWith('@g.id') || jid.endsWith('@temp');
            const isBroadcast = jid.includes('broadcast') || jid.includes('status');
            const isBelgiumSpam = jid.includes('32246832590961');
            return !isGroup && !isBroadcast && !isBelgiumSpam;
          })
          .sort((a, b) => {
            const timeA = new Date(a.createdAt || (a.timestamp ? a.timestamp * 1000 : 0)).getTime();
            const timeB = new Date(b.createdAt || (b.timestamp ? b.timestamp * 1000 : 0)).getTime();
            return timeB - timeA; // descending chronological order for timeline feeds
          });

        return res.json({ success: true, data: mergedList });
      }
    } catch (error: any) {
      console.error("[WhatsApp Messages Proxy Error]:", error.response?.data || error.message);
      res.json({ 
        success: false, 
        error: error.response?.data?.message || error.message || "Failed to fetch messages" 
      });
    }
  });

  // API Route: Get WhatsApp Chats (Live from gateway merged with Firestore archives)
  app.get("/api/whatsapp-chats", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
      const authResult = await verifyAdmin(idToken);
      if (!authResult.isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required." });
      }

      // WhatsApp CRM is disabled at user's request to prioritize Firestore quota
      return res.json({ success: true, data: [] });
      let settings: any = {};
      try {
        const settingsDoc = await db.collection('communicationSettings').doc('global').get();
        if (settingsDoc.exists) {
          settings = settingsDoc.data();
        }
      } catch (dbErr) {
        console.error("[WhatsApp Chats Proxy Error] DB Fetch failed:", dbErr);
      }

      const baseUrl = settings.openwaBaseUrl || 'https://openwa-dashboard-production-b24e.up.railway.app';
      const session = settings.openwaSessionId || 'baliadventours';
      const token = settings.openwaApiKey;

      if (!token) {
        return res.json({ success: false, error: "OpenWA API Token is not configured in settings." });
      }

      const cleanToken = token.replace('Bearer ', '').trim();
      const headers = {
        'Authorization': `Bearer ${cleanToken}`,
        'X-API-Key': cleanToken,
        'X-Api-Key': cleanToken,
        'api-key': cleanToken,
        'Content-Type': 'application/json'
      };

      let uuid = session;
      try {
        const resolved = await resolveOpenWaSession(baseUrl, token, session);
        uuid = resolved.id || session;
      } catch (err: any) {
        console.log(`[WhatsApp Chats] Session resolve failed for "${session}": ${err.message}`);
      }

      const path1 = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/chats`;
      const path2 = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/get-chats`;

      let response;
      let liveChats: any[] = [];
      try {
        response = await axios.get(path1, { headers, timeout: 6000 });
      } catch (err: any) {
        console.log(`[WhatsApp Chats] Path ${path1} failed: ${err.message}. Trying Strategy 2...`);
        try {
          response = await axios.get(path2, { headers, timeout: 6000 });
        } catch (fallbackErr: any) {
          console.log(`[WhatsApp Chats] Strategy 2 failed: ${fallbackErr.message}. Trying Strategy 3...`);
          try {
            const fallbackPath = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}`;
            response = await axios.post(fallbackPath, { method: "getChats" }, { headers, timeout: 6000 });
          } catch (errAll) {
            console.log(`[WhatsApp Chats] Live fetch from gateway warning:`, errAll);
          }
        }
      }

      if (response && response.data) {
        const dataNode = response.data;
        let arr = Array.isArray(dataNode) ? dataNode : (dataNode?.response || dataNode?.data || dataNode?.chats || dataNode?.result);
        if (!arr && dataNode && typeof dataNode === 'object') {
          const arrayProp = Object.values(dataNode).find(Array.isArray);
          if (arrayProp) arr = arrayProp;
        }
        if (arr && Array.isArray(arr)) {
          liveChats = arr;
        }
      }

      // Safe cleanup of any leftover strange Belgium numbers in Firestore cache
      try {
        const queryChatId = "32246832590961@c.us";
        const cleanChatsSnap = await db.collection('whatsapp_chats').where('chatId', '==', queryChatId).get();
        for (const docSnap of cleanChatsSnap.docs) {
          await docSnap.ref.delete();
          console.log(`[WhatsApp Backend Cleanup] Deleted cached foreign chat document ${docSnap.id}`);
        }

        const cleanMessagesSnap = await db.collection('whatsapp_messages').where('chatId', '==', queryChatId).get();
        for (const docSnap of cleanMessagesSnap.docs) {
          await docSnap.ref.delete();
          console.log(`[WhatsApp Backend Cleanup] Deleted cached foreign message document ${docSnap.id}`);
        }
      } catch (cleanErr: any) {
        console.error(`[WhatsApp Backend Cleanup Error]:`, cleanErr.message);
      }

      // Fetch Firestore cached chats
      let localChats: any[] = [];
      try {
        const dbSnap = await db.collection('whatsapp_chats').get();
        dbSnap.forEach(docSnap => {
          localChats.push(docSnap.data());
        });
        // Filter local chats in memory per session and exclude the foreign spam number
        localChats = localChats.filter((chat: any) => {
          const cSess = String(chat.session || '').trim().toLowerCase();
          const configSess = String(session || '').trim().toLowerCase();
          const resolvedSess = String(uuid || '').trim().toLowerCase();
          const matchesSession = !chat.session || cSess === configSess || cSess === resolvedSess;
          return matchesSession && 
            chat.chatId !== "32246832590961@c.us" && 
            chat.id !== "32246832590961@c.us";
        });
        console.log(`[WhatsApp Chats] Loaded ${localChats.length} cached chats from Firestore for session "${session}".`);
      } catch (dbErr) {
        console.error(`[WhatsApp Chats] Firestore fetch failed:`, dbErr);
      }

      // Merge chats cleanly by JID (chatId)
      const chatsMap = new Map<string, any>();

      // 1. Add Firestore cached chats
      localChats.forEach((chat) => {
        const jid = chat.chatId || chat.id;
        if (jid) {
          chatsMap.set(String(jid), {
            id: jid,
            chatId: jid,
            name: chat.name,
            lastMessage: chat.lastMessage,
            updatedAt: chat.updatedAt
          });
        }
      });

      // 2. Add Live Gateway chats
      liveChats.forEach((chat) => {
        const jid = chat.id || chat.chatId || chat.jid;
        if (jid) {
          const jidStr = String(jid);
          const currentRecord = chatsMap.get(jidStr) || {};
          
          let lastMsg = chat.lastMessage || chat.last_message;
          if (!lastMsg && chat.messages && chat.messages.length > 0) {
            lastMsg = chat.messages[chat.messages.length - 1];
          }

          const chatName = chat.name || chat.formattedTitle || chat.contact?.name || currentRecord.name || jidStr.split('@')[0];

          chatsMap.set(jidStr, {
            ...currentRecord,
            ...chat,
            id: jidStr,
            chatId: jidStr,
            name: chatName,
            lastMessage: lastMsg || currentRecord.lastMessage
          });

          // Background persist to Firestore cache to ensure real-time CRM updates
          if (lastMsg) {
            const bodyText = lastMsg.body || lastMsg.text || 'Media / Info message';
            const isSelf = lastMsg.fromMe === true || 
                           String(lastMsg.fromMe) === 'true' || 
                           lastMsg.from_me === true || 
                           String(lastMsg.from_me) === 'true' || 
                           lastMsg.direction === 'outgoing' ||
                           lastMsg.isSelf === true ||
                           String(lastMsg.isSelf) === 'true' ||
                           lastMsg.sender?.isMe === true ||
                           String(lastMsg.sender?.isMe) === 'true';

            const direction = isSelf ? 'outgoing' : 'incoming';
            const msgId = lastMsg.id || lastMsg.messageId || `sync-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

            logMessageToFirestore({
              id: String(msgId),
              chatId: jidStr,
              from: getJidString(lastMsg.from) || (isSelf ? 'user' : jidStr),
              to: getJidString(lastMsg.to) || (isSelf ? jidStr : 'user'),
              body: bodyText,
              direction,
              timestamp: lastMsg.timestamp || lastMsg.time || Math.floor(Date.now() / 1000),
              fromMe: isSelf,
              senderName: chatName,
              session: session
            }).catch(extErr => console.error("[whatsapp-chats-bg] Sync warning:", extErr.message));
          }
        }
      });

      const mergedChats = Array.from(chatsMap.values())
        .filter((chat: any) => {
          const jid = String(chat.chatId || chat.id || '').toLowerCase();
          const isGroup = jid.endsWith('@g.us') || jid.endsWith('@g.id') || jid.endsWith('@temp');
          const isBroadcast = jid.includes('broadcast') || jid.includes('status');
          const isBelgiumSpam = jid.includes('32246832590961');
          return !isGroup && !isBroadcast && !isBelgiumSpam;
        })
        .sort((a, b) => {
          const timeA = new Date(a.updatedAt || (a.lastMessage?.createdAt) || (a.lastMessage?.timestamp ? a.lastMessage.timestamp * 1000 : 0)).getTime();
          const timeB = new Date(b.updatedAt || (b.lastMessage?.createdAt) || (b.lastMessage?.timestamp ? b.lastMessage.timestamp * 1000 : 0)).getTime();
          return timeB - timeA; // Descending order (newest chat activity at top)
        });

      res.json({ success: true, data: mergedChats });
    } catch (error: any) {
      console.error("[WhatsApp Chats Proxy Error]:", error.response?.data || error.message);
      res.json({ 
        success: false, 
        error: error.response?.data?.message || error.message || "Failed to fetch chats" 
      });
    }
  });

  const getJidString = (val: any): string => {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      return val._serialized || val.id || val.jid || val.user || '';
    }
    return String(val);
  };

  // API Route: Deep sync WhatsApp Inbox (pull chats and recent messages from gateway into Firestore)
  app.post("/api/whatsapp-sync", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
      const authResult = await verifyAdmin(idToken);
      if (!authResult.isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required." });
      }

      // WhatsApp CRM is disabled at user's request to prioritize Firestore quota
      return res.json({ success: true, chatsSynced: 0, messagesSynced: 0, message: "WhatsApp CRM is disabled" });
      // Fetch communication settings
      let settings: any = {};
      try {
        const settingsDoc = await db.collection('communicationSettings').doc('global').get();
        if (settingsDoc.exists) {
          settings = settingsDoc.data();
        }
      } catch (dbErr) {
        console.error("[WhatsApp Sync Error] DB Fetch failed:", dbErr);
      }

      const baseUrl = settings.openwaBaseUrl || 'https://openwa-dashboard-production-b24e.up.railway.app';
      const session = settings.openwaSessionId || 'baliadventours';
      const token = settings.openwaApiKey;

      if (!token) {
        return res.json({ success: false, error: "OpenWA API Token is not configured in settings." });
      }

      const cleanToken = token.replace('Bearer ', '').trim();
      const headers = {
        'Authorization': `Bearer ${cleanToken}`,
        'X-API-Key': cleanToken,
        'X-Api-Key': cleanToken,
        'api-key': cleanToken,
        'Content-Type': 'application/json'
      };

      let uuid = session;
      try {
        const resolved = await resolveOpenWaSession(baseUrl, token, session);
        uuid = resolved.id || session;
      } catch (err: any) {
        console.log(`[WhatsApp Sync] Session resolve failed for "${session}": ${err.message}`);
      }

      console.log(`[WhatsApp Sync] Starting Deep Inbox Sync on session: ${uuid}`);

      // Automatically register/align the webhook when syncing to ensure real-time messages are delivered
      const reqHost = req.get('host');
      if (reqHost) {
        await registerWebhookOnGateway(baseUrl, token, session, reqHost);
      }

      // 1. Fetch live chats from physical device
      const path1 = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/chats`;
      const path2 = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/get-chats`;

      let response;
      let liveChats: any[] = [];
      try {
        response = await axios.get(path1, { headers, timeout: 8000 });
      } catch (err: any) {
        console.log(`[WhatsApp Sync] Path ${path1} failed: ${err.message}. Trying Strategy 2...`);
        try {
          response = await axios.get(path2, { headers, timeout: 8000 });
        } catch (fallbackErr: any) {
          console.log(`[WhatsApp Sync] Strategy 2 failed: ${fallbackErr.message}. Trying Strategy 3...`);
          try {
            const fallbackPath = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}`;
            response = await axios.post(fallbackPath, { method: "getChats" }, { headers, timeout: 8000 });
          } catch (errAll) {
            console.log(`[WhatsApp Sync] Live chats query failed:`, errAll);
          }
        }
      }

      if (response && response.data) {
        const dataNode = response.data;
        let arr = Array.isArray(dataNode) ? dataNode : (dataNode?.response || dataNode?.data || dataNode?.chats || dataNode?.result);
        if (!arr && dataNode && typeof dataNode === 'object') {
          const arrayProp = Object.values(dataNode).find(Array.isArray);
          if (arrayProp) arr = arrayProp;
        }
        if (arr && Array.isArray(arr)) {
          liveChats = arr;
        }
      }

      // Filter and pick the top active chats
      const filteredChats = liveChats.filter((chat: any) => {
        const jid = String(chat.id || chat.chatId || chat.jid || '').toLowerCase();
        const isGroup = jid.endsWith('@g.us') || jid.endsWith('@g.id') || jid.endsWith('@temp');
        const isBroadcast = jid.includes('broadcast') || jid.includes('status');
        const isBelgiumSpam = jid.includes('32246832590961');
        return !isGroup && !isBroadcast && !isBelgiumSpam;
      });

      console.log(`[WhatsApp Sync] Found ${filteredChats.length} active chats to sync. Syncing recent messages for top 12 active ones...`);

      // Sync top 12 active chats (with limited concurrency to prevent rate limit blocks)
      const topChats = filteredChats.slice(0, 12);
      let totalChatsSynced = 0;
      let totalMessagesSynced = 0;

      for (const chat of topChats) {
        const chatId = chat.id || chat.chatId || chat.jid;
        if (!chatId) continue;

        const formattedChatId = String(chatId);
        let lastMsg = chat.lastMessage || chat.last_message;
        if (!lastMsg && chat.messages && chat.messages.length > 0) {
          lastMsg = chat.messages[chat.messages.length - 1];
        }

        const chatName = chat.name || chat.formattedTitle || chat.contact?.name || chat.contact?.formattedName || formattedChatId.split('@')[0];

        // Ensure chat metadata itself is saved to Firestore
        try {
          const chatRef = db.collection('whatsapp_chats').doc(formattedChatId);
          await chatRef.set({
            chatId: formattedChatId,
            name: chatName,
            updatedAt: new Date().toISOString(),
            session: session,
            lastMessage: lastMsg ? {
              id: lastMsg.id || `msg-${Date.now()}`,
              body: lastMsg.body || lastMsg.text || 'Media / Info message',
              fromMe: lastMsg.fromMe ?? (lastMsg.direction === 'outgoing'),
              timestamp: lastMsg.timestamp || Math.floor(Date.now() / 1000),
              direction: lastMsg.direction || (lastMsg.fromMe ? 'outgoing' : 'incoming'),
              createdAt: new Date().toISOString()
            } : null
          }, { merge: true });
          totalChatsSynced++;
        } catch (chatSaveErr) {
          console.warn(`[WhatsApp Sync] Failed to save chat entry for ${formattedChatId}:`, chatSaveErr);
        }

        // Now, fetch last 20 messages for this contact from physical phone
        const methodPath = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}`;
        let msgResponse;
        try {
          msgResponse = await axios.post(methodPath, {
            method: "getMessages",
            args: [formattedChatId, { limit: 20 }]
          }, { headers, timeout: 6000 });
        } catch (errFetchMsg) {
          console.log(`[WhatsApp Sync] getMessages for ${formattedChatId} failed, trying getAllMessagesInChat...`);
          try {
            msgResponse = await axios.post(methodPath, {
              method: "getAllMessagesInChat",
              args: [formattedChatId, true, true]
            }, { headers, timeout: 6000 });
          } catch (errFallbackMsg) {
            console.log(`[WhatsApp Sync] Message fetching failed for chat ${formattedChatId}:`, errFallbackMsg.message);
          }
        }

        if (msgResponse && msgResponse.data) {
          const mNode = msgResponse.data;
          let msgsArr = Array.isArray(mNode) ? mNode : (mNode?.response || mNode?.data || mNode?.messages || mNode?.result);
          if (!msgsArr && mNode && typeof mNode === 'object') {
            const arrayProp = Object.values(mNode).find(Array.isArray);
            if (arrayProp) msgsArr = arrayProp;
          }

          if (msgsArr && Array.isArray(msgsArr)) {
            // Log each retrieved message to Firestore cache
            for (const m of msgsArr) {
              const msgId = m.id || m.messageId || `sync-msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
              const fromStr = getJidString(m.from);
              const toStr = getJidString(m.to);
              const isSelf = m.fromMe === true || 
                             String(m.fromMe) === 'true' || 
                             m.from_me === true || 
                             String(m.from_me) === 'true' || 
                             m.direction === 'outgoing' ||
                             m.isSelf === true ||
                             String(m.isSelf) === 'true' ||
                             m.sender?.isMe === true ||
                             String(m.sender?.isMe) === 'true';

              const direction = isSelf ? 'outgoing' : 'incoming';
              const bodyText = m.body || m.text || m.message || '';

              if (bodyText) {
                await logMessageToFirestore({
                  id: String(msgId),
                  chatId: formattedChatId,
                  from: fromStr || (isSelf ? 'me' : formattedChatId),
                  to: toStr || (isSelf ? formattedChatId : 'me'),
                  body: bodyText,
                  direction,
                  timestamp: m.timestamp || m.time || Math.floor(Date.now() / 1000),
                  fromMe: isSelf,
                  senderName: m.sender?.name || m.contact?.name || chatName,
                  session: session
                });
                totalMessagesSynced++;
              }
            }
          }
        }
      }

      console.log(`[WhatsApp Sync] Successfully completed inbox sync! Saved ${totalChatsSynced} conversations & ${totalMessagesSynced} messages.`);
      res.json({
        success: true,
        message: "Successfully synchronized live inbox with local CRM.",
        chatsSynced: totalChatsSynced,
        messagesSynced: totalMessagesSynced
      });
    } catch (error: any) {
      console.error("[WhatsApp CRM Sync Error]:", error.response?.data || error.message);
      res.json({ 
        success: false, 
        error: error.response?.data?.message || error.message || "Failed to fully synchronize WhatsApp Inbox." 
      });
    }
  });

  // API Route: Send Direct WhatsApp Message
  app.post("/api/whatsapp-send", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
      const authResult = await verifyAdmin(idToken);
      if (!authResult.isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required." });
      }

      // Fetch settings
      let settings: any = {};
      try {
        const settingsDoc = await db.collection('communicationSettings').doc('global').get();
        if (settingsDoc.exists) {
          settings = settingsDoc.data();
        }
      } catch (dbErr) {
        console.error("[WhatsApp Send Proxy Error] DB Fetch failed:", dbErr);
      }

      const baseUrl = settings.openwaBaseUrl || 'https://openwa-dashboard-production-b24e.up.railway.app';
      const session = settings.openwaSessionId || 'baliadventours';
      const token = settings.openwaApiKey;

      if (!token) {
        return res.json({ success: false, error: "OpenWA API Token is not configured in settings." });
      }

      const cleanToken = token.replace('Bearer ', '').trim();
      const headers = {
        'Authorization': `Bearer ${cleanToken}`,
        'X-API-Key': cleanToken,
        'X-Api-Key': cleanToken,
        'api-key': cleanToken,
        'Content-Type': 'application/json'
      };

      let uuid = session;
      try {
        const resolved = await resolveOpenWaSession(baseUrl, token, session);
        uuid = resolved.id || session;
      } catch (err: any) {
        console.log(`[WhatsApp Send] Session resolve failed for "${session}": ${err.message}`);
      }

      const { chatId, text } = req.body;
      if (!chatId || !text) {
        return res.status(400).json({ error: "chatId and text are required fields." });
      }

      let path = `${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/messages/send-text`;

      const response = await axios.post(path, { chatId, text }, {
        headers,
        timeout: 10000
      });

      // Log sent message to Firestore to guarantee immediate display on CRM reload/sync
      try {
        let sentId = response?.data?.id || response?.data?.response?.id || response?.data?.result?.id || `msg-${Date.now()}`;
        if (typeof sentId === 'object') {
          sentId = sentId._serialized || sentId.id || `msg-${Date.now()}`;
        }
        await logMessageToFirestore({
          id: String(sentId),
          chatId: chatId,
          from: 'me',
          to: chatId,
          body: text,
          direction: 'outgoing',
          timestamp: Math.floor(Date.now() / 1000),
          fromMe: true,
          session: session
        });
      } catch (logErr: any) {
        console.error("[WhatsApp Send] Firestore logging warning:", logErr.message);
      }

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("[WhatsApp Send Proxy Error]:", error.response?.data || error.message);
      res.json({ 
        success: false, 
        error: error.response?.data?.message || error.message || "Failed to send message" 
      });
    }
  });

  // API Route: Start WhatsApp Session
  app.post("/api/whatsapp-start", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
      const authResult = await verifyAdmin(idToken);
      if (!authResult.isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required." });
      }

      // Fetch settings
      let settings: any = {};
      try {
        const settingsDoc = await db.collection('communicationSettings').doc('global').get();
        if (settingsDoc.exists) {
          settings = settingsDoc.data();
        }
      } catch (dbErr) {
        console.error("[WhatsApp Start Error] DB Fetch failed:", dbErr);
      }

      const baseUrl = settings.openwaBaseUrl || 'https://openwa-dashboard-production-b24e.up.railway.app';
      const session = settings.openwaSessionId || 'baliadventours';
      const token = settings.openwaApiKey;

      if (!token) {
        return res.json({ success: false, error: "OpenWA API Token is not configured in settings." });
      }

      const cleanToken = token.replace('Bearer ', '').trim();
      const headers = {
        'Authorization': `Bearer ${cleanToken}`,
        'X-API-Key': cleanToken,
        'X-Api-Key': cleanToken,
        'api-key': cleanToken,
        'Content-Type': 'application/json'
      };

      let uuid = session;
      try {
        const resolved = await resolveOpenWaSession(baseUrl, token, session);
        uuid = resolved.id || session;
      } catch (err: any) {
        console.log(`[WhatsApp Start] Direct metadata lookup failed for "${session}". Will try inline start/create.`);
      }
      
      try {
        console.log(`[WhatsApp Start] Attempting start using UUID: "${uuid}"...`);
        const response = await axios.post(`${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/start`, {}, {
          headers: headers,
          timeout: 10000
        });

        const reqHost = req.get('host');
        if (reqHost) {
          registerWebhookOnGateway(baseUrl, token, session, reqHost).catch(() => {});
        }

        return res.json({ success: true, data: response.data });
      } catch (startErr: any) {
        const status = startErr.response?.status;
        const msg = startErr.response?.data?.message || startErr.message || "";
        console.log(`[WhatsApp Start] Direct start failed for UUID "${uuid}". Status: ${status}, Msg: ${msg}`);

        // If not found, attempt to create it
        if (status === 404 || msg.toLowerCase().includes("not found")) {
          console.log(`[WhatsApp Start] Session "${session}" not found. Attempting auto-creation...`);
          try {
            const createRes = await axios.post(`${baseUrl.replace(/\/$/, '')}/api/sessions`, { name: session }, {
              headers: headers,
              timeout: 10000
            });
            uuid = createRes.data?.id || uuid;
            console.log(`[WhatsApp Start] Session created. New UUID: "${uuid}". Booting...`);
          } catch (createErr: any) {
            const createStatus = createErr.response?.status;
            // 409 Conflict means the session/name already exists, which is safe to proceed
            if (createStatus !== 409) {
              throw createErr;
            }
          }

          // Try starting again
          const response = await axios.post(`${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/start`, {}, {
            headers: headers,
            timeout: 10000
          });

          const reqHost = req.get('host');
          if (reqHost) {
            registerWebhookOnGateway(baseUrl, token, session, reqHost).catch(() => {});
          }

          return res.json({ success: true, data: response.data });
        } else {
          // If already started, it might return 400 "session already started"
          if (status === 400 && msg.toLowerCase().includes("already")) {
            const reqHost = req.get('host');
            if (reqHost) {
              registerWebhookOnGateway(baseUrl, token, session, reqHost).catch(() => {});
            }
            return res.json({ success: true, message: "Session already active/started", status: "ready" });
          }
          throw startErr;
        }
      }
    } catch (error: any) {
      console.error("[WhatsApp Start Proxy Error]:", error.response?.data || error.message);
      res.json({ 
        success: false, 
        error: error.response?.data?.message || error.message || "Failed to start session" 
      });
    }
  });

  // API Route: Get WhatsApp Session QR Code
  app.get("/api/whatsapp-qr", async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const idToken = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : undefined;
      const authResult = await verifyAdmin(idToken);
      if (!authResult.isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required." });
      }

      // Fetch settings
      let settings: any = {};
      try {
        const settingsDoc = await db.collection('communicationSettings').doc('global').get();
        if (settingsDoc.exists) {
          settings = settingsDoc.data();
        }
      } catch (dbErr) {
        console.error("[WhatsApp QR Error] DB Fetch failed:", dbErr);
      }

      const baseUrl = settings.openwaBaseUrl || 'https://openwa-dashboard-production-b24e.up.railway.app';
      const session = settings.openwaSessionId || 'baliadventours';
      const token = settings.openwaApiKey;

      if (!token) {
        return res.json({ success: false, error: "OpenWA API Token is not configured in settings." });
      }

      const cleanToken = token.replace('Bearer ', '').trim();
      let uuid = session;
      try {
        const resolved = await resolveOpenWaSession(baseUrl, token, session);
        uuid = resolved.id || session;
      } catch (err: any) {
        console.log(`[WhatsApp QR] Direct metadata lookup failed for "${session}". Trying fallback QR fetch.`);
      }
      
      const response = await axios.get(`${baseUrl.replace(/\/$/, '')}/api/sessions/${uuid}/qr`, {
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'X-API-Key': cleanToken,
          'X-Api-Key': cleanToken,
          'api-key': cleanToken
        },
        timeout: 5000
      });

      res.json({ success: true, data: response.data });
    } catch (error: any) {
      console.error("[WhatsApp QR Proxy Error]:", error.response?.data || error.message);
      res.json({ 
        success: false, 
        error: error.response?.data?.message || error.message || "Failed to fetch QR code" 
      });
    }
  });

  // --- ROBUST SEO ENGINE (PERMISSION-PROOF) ---
  const getSEOContent = async (reqPath: string, type?: 'tour' | 'blog') => {
    // 1. Core Defaults (The "Zero-Failure" Layer)
    let siteName = 'Bali Adventours';
    let siteDescription = 'Book Tour and Adventours in Bali - Bali Adventours';
    try {
      const metaPath = path.join(process.cwd(), 'metadata.json');
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        siteName = meta.name || siteName;
        siteDescription = meta.description || siteDescription;
      }
    } catch (e) {}

    const seo = {
      title: siteName,
      description: siteDescription,
      image: 'https://i.ibb.co.com/pvLCVYkM/ALAS-HARUM8-optimized.webp',
      siteName: siteName,
      isProduct: false,
      isArticle: false,
      status: 'default',
      preloadedData: null as any,
      keywords: ''
    };

    // 2. Specialized Logic (The "Known Pages" Layer)
    const segments = reqPath.split('/').filter(Boolean);
    const slug = segments.length > 0 ? segments[segments.length - 1] : '';
    
    // Explicit mappings for main dynamic-static pages
    const pageMappings: Record<string, { title: string; desc: string }> = {
      'tours': { 
        title: `Experience Tours with ${siteName}`, 
        desc: `Discover Bali's most extraordinary expeditions. Explore our curated collection of premium tours from majestic peaks to coastal sanctuaries.`
      },
      'blog': { 
        title: `Adventure Stories & Travel Guides | ${siteName}`, 
        desc: `Read our latest travel guides, tips and stories about exploring the beautiful island of Bali.`
      },
      'about': { 
        title: `About us | ${siteName}`, 
        desc: `Learn about our mission to provide the most authentic and premium experiences in Bali.`
      },
      'contact': { 
        title: `Contact Us | ${siteName}`, 
        desc: `Have questions? We're here to help you plan your perfect Bali adventure.`
      },
      'destinations': { 
        title: `Explore Bali Destinations | ${siteName}`, 
        desc: `Discover the best places to visit in Bali, from Ubud to Canggu and beyond.`
      },
      'planner': { 
        title: `AI-Powered Bali Trip Planner | ${siteName}`, 
        desc: `Create your personalized Bali itinerary in seconds with our advanced AI travel planner.`
      },
      'ai-hub': { 
        title: `AI Bali Travel Hub & Search-Grounded FAQs | ${siteName}`, 
        desc: `Consult our grounded AI Bali Concierge, browse semantic FAQs and smart packing/culture traveler tips compiled by local travel experts.`
      }
    };

    if (pageMappings[slug]) {
        seo.title = pageMappings[slug].title;
        seo.description = pageMappings[slug].desc;
        seo.status = 'static-page-mapped';
    } else if (slug && (type || segments.length > 0)) {
       const pretty = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
       seo.title = `${pretty} | ${siteName}`;
       seo.description = `Experience ${pretty} with ${siteName}. Special offers and easy booking available.`;
       seo.status = 'slug-parsed';
    }

    if (reqPath === '/') {
       seo.title = `Book Tour and Adventours in Bali - ${siteName}`;
       seo.description = siteDescription;
       seo.status = 'home-default';
    }

    // 3. Database Fetch (The "Gold Standard" Layer - with resilient permission-proof REST fallback)
    let settings: any = null;
    try {
      // Fetch site-wide settings first
      const settingsSnap = await db.collection('settings').doc('general').get();
      if (settingsSnap.exists) {
        settings = settingsSnap.data() || {};
        console.log("[SEO Admin] Successfully fetched general settings via Admin SDK");
      }
    } catch (e: any) {
      try {
        settings = await fetchFromREST('settings', 'general');
        if (settings) {
          console.log("[SEO Channel] Successfully matched general settings");
        }
      } catch (restErr: any) {
        // Fallback silently to defaults
      }
    }

    if (settings) {
      seo.siteName = settings.siteName || seo.siteName;
      seo.image = settings.ogImage || seo.image;
      if (settings.siteKeywords) {
        seo.keywords = settings.siteKeywords;
      }
      if (reqPath === '/') {
        let derivedTitle = settings.metaTitle;
        if (!derivedTitle && settings.homeTitleFormat) {
          derivedTitle = settings.homeTitleFormat.replace(/\{\{siteName\}\}/gi, seo.siteName);
        }
        seo.title = derivedTitle || seo.title;
        seo.description = settings.siteDescription || settings.metaDescription || seo.description;
      }
    }

    try {
      // Determine content type and collection
      let collection = '';
      let isSingleDoc = false;

      if (reqPath.startsWith('/tour/')) {
        collection = 'tours';
        isSingleDoc = true;
      } else if (reqPath.startsWith('/blog/')) {
        collection = 'posts';
        isSingleDoc = true;
      } else if (reqPath === '/') {
        // PRELOAD HOME CONTENT: Fetch featured tours and categories for the home page
        let featured: any[] = [];
        let categories: any[] = [];
        
        const pruneTour = (t: any) => {
          if (!t) return null;
          return {
            id: t.id,
            slug: t.slug || "",
            title: t.title || "",
            duration: t.duration || "",
            regularPrice: t.regularPrice || 0,
            discountPrice: t.discountPrice || null,
            featuredImage: t.featuredImage || "",
            gallery: Array.isArray(t.gallery) && t.gallery.length > 0 ? [t.gallery[0]] : [],
            imageLabelId: t.imageLabelId || null,
            belowTitleLabelId: t.belowTitleLabelId || null,
            priceLabelId: t.priceLabelId || null,
            location: t.location || "",
            rating: t.rating ?? null,
            reviewsCount: t.reviewsCount ?? null,
            status: t.status || null,
            createdAt: t.createdAt || null
          };
        };

        try {
          const [featuredToursSnap, categoriesSnap] = await Promise.all([
            db.collection('tours')
              .where('status', 'in', ['published', 'active'])
              .orderBy('createdAt', 'desc')
              .limit(12)
              .get(),
            db.collection('categories').orderBy('name', 'asc').get()
          ]);
          
          featured = featuredToursSnap.docs.map(doc => pruneTour({ id: doc.id, ...doc.data() })).filter(Boolean);
          categories = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          console.log("[SEO Admin] Successfully preloaded and pruned home content via Admin SDK");
        } catch (adminHomeErr: any) {
          try {
            const [featuredRest, categoriesRest] = await Promise.all([
              fetchFromREST('tours', undefined, {
                whereFilters: [{ field: 'status', op: 'IN', value: ['published', 'active'] }],
                orderByField: 'createdAt',
                direction: 'DESCENDING',
                limit: 12
              }),
              fetchFromREST('categories', undefined, {
                orderByField: 'name',
                direction: 'ASCENDING'
              })
            ]);
            featured = (featuredRest || []).map(pruneTour).filter(Boolean);
            categories = categoriesRest || [];
            console.log("[SEO Channel] Successfully preloaded and pruned dynamic home content list");
          } catch (restHomeErr: any) {
            // Silently fallback to standard empty arrays
          }
        }
        
        seo.preloadedData = { 
          featuredTours: featured,
          categories: categories
        };
        seo.status = 'db-home-hydrated';
      }

      if (isSingleDoc && slug) {
        let docData: any = null;
        try {
          const querySnap = await db.collection(collection).where('slug', '==', slug).limit(1).get();
          if (!querySnap.empty) {
            docData = { id: querySnap.docs[0].id, ...querySnap.docs[0].data() };
            console.log(`[SEO Admin] Successfully fetched single doc (${collection}/${slug}) via Admin SDK`);
          }
        } catch (adminDocErr: any) {
          try {
            // Retrieve the resource strictly by slug, matching the equivalent Admin SDK query.
            // This prevents mismatching statuses where tours use 'active' and posts use 'published'.
            const docsList = await fetchFromREST(collection, undefined, {
              whereFilters: [
                { field: 'slug', op: 'EQUAL', value: slug }
              ],
              limit: 1
            });
            if (docsList && docsList.length > 0) {
              docData = docsList[0];
              console.log(`[SEO Channel] Successfully matched single resource: ${collection}/${slug}`);
            }
          } catch (restDocErr: any) {
            // Silently fallback
          }
        }

        if (docData) {
          seo.preloadedData = docData;

          // 3a. Use Explicit SEO fields if they exist
          if (docData.seo) {
            seo.title = docData.seo.title || (docData.title + ' | ' + seo.siteName);
            seo.description = docData.seo.description || docData.excerpt || docData.description || seo.description;
            seo.image = docData.seo.ogImage || docData.featuredImage || (docData.gallery && docData.gallery[0]) || seo.image;
          } else {
            // Fallback to basic fields
            seo.title = docData.title + ' | ' + seo.siteName;
            seo.description = docData.excerpt || docData.description || seo.description;
            seo.image = docData.featuredImage || (docData.gallery && docData.gallery[0]) || seo.image;
          }

          seo.isProduct = collection === 'tours';
          seo.isArticle = collection === 'posts';
          seo.status = 'db-verified-hydrated';
        }
      }
    } catch (dbErr: any) {
      // Quiet fallback
    }

    return seo;
  };

  const applySEO = (html: string, seo: any) => {
    const safeTitle = (seo.title || seo.siteName).replace(/"/g, '&quot;');
    const safeDesc = (seo.description || '').replace(/"/g, '&quot;');
    const safeKeywords = (seo.keywords || '').replace(/"/g, '&quot;');
    const debugTag = `\n    <!-- SEO INJECTED BY SERVER (${seo.status}) - ${new Date().toISOString()} -->\n    <meta name="seo-engine" content="express-ssr-v3" />\n    <meta name="seo-status" content="${seo.status}" />`;

    // Data injection for hydration
    const dataScript = seo.preloadedData ? `\n    <script id="preloaded-data" type="application/json">${JSON.stringify(seo.preloadedData)}</script>\n    <script>window.__PRELOADED_DATA__ = JSON.parse(document.getElementById('preloaded-data').innerHTML);</script>` : '';

    // Preload critical assets (Removed broken direct gstatic URL to avoid 404s)
    const preloadTags = `
    ${seo.image ? `\n    <link rel="preload" as="image" href="${seo.image}" />` : ''}`;

    let modified = html;

    // Remove pre-existing duplicate/fallback open graph, twitter, and keywords tags in template
    modified = modified.replace(/<meta\s+[^>]*property="og:[^"]*"[^>]*\/?>/gi, '');
    modified = modified.replace(/<meta\s+[^>]*name="twitter:[^"]*"[^>]*\/?>/gi, '');
    modified = modified.replace(/<meta\s+[^>]*name="keywords"[^>]*\/?>/gi, '');
    
    // Replace Title
    if (modified.includes('<title>')) {
      modified = modified.replace(/<title>.*?<\/title>/i, `<title>${safeTitle}</title>`);
    } else {
      modified = modified.replace('</head>', `<title>${safeTitle}</title></head>`);
    }

    // Replace Description
    if (modified.includes('name="description"')) {
      modified = modified.replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i, `<meta name="description" content="${safeDesc}" />`);
    } else {
      modified = modified.replace('</head>', `<meta name="description" content="${safeDesc}" /></head>`);
    }

    // Inject OG & Keywords Tags
    const ogTags = `
    <meta name="keywords" content="${safeKeywords}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDesc}" />
    <meta property="og:image" content="${seo.image}" />
    <meta property="og:type" content="${seo.isProduct ? 'product' : (seo.isArticle ? 'article' : 'website')}" />
    <meta property="og:site_name" content="${seo.siteName}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDesc}" />
    <meta name="twitter:image" content="${seo.image}" />${dataScript}${preloadTags}${debugTag}`;

    return modified.replace('</head>', `${ogTags}</head>`);
  };

  const isProd = 
    process.env.NODE_ENV === "production" || 
    (typeof __filename !== "undefined" && (__filename.includes("server.cjs") || __filename.includes("dist"))) ||
    (typeof import.meta !== "undefined" && import.meta.url && (import.meta.url.includes("server.cjs") || import.meta.url.includes("dist")));

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    // Mount Vite development middleware FIRST to handle assets, sourcemaps, and client websockets correctly
    app.use(vite.middlewares);

    app.get('*', async (req, res, next) => {
      // Skip API and logic for file extensions (images, scripts, etc)
      if (req.path.startsWith('/api/') || (req.path.includes('.') && !req.path.endsWith('.html'))) {
        return next();
      }

      try {
        const url = req.originalUrl;
        let type: 'tour' | 'blog' | undefined;
        if (url.startsWith('/tour/')) type = 'tour';
        if (url.startsWith('/blog/')) type = 'blog';

        const seo = await getSEOContent(req.path, type);
        let template = await fs.promises.readFile(path.join(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        const html = applySEO(template, seo);
        res.status(200).set({ 
          'Content-Type': 'text/html',
          'X-SEO-Engine': 'express-ssr',
          'X-SEO-Status': seo.status 
        }).end(html);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    let distPath = path.join(process.cwd(), 'dist');
    
    // Auto-detect correct dist folder in serverless or standard container environments
    const hasIndexFile = (dir: string) => fs.existsSync(path.join(dir, 'index.html')) || fs.existsSync(path.join(dir, 'index.template.html'));
    
    if (!fs.existsSync(distPath) || !hasIndexFile(distPath)) {
      const currentFilename = typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : '');
      const currentDirname = currentFilename ? path.dirname(currentFilename) : (typeof __dirname !== 'undefined' ? __dirname : '');
      const candidates = [
        path.resolve(currentDirname, 'dist'),
        path.resolve(currentDirname, '..', 'dist'),
        path.resolve(currentDirname, '..', '..', 'dist'),
        '/var/task/dist',
        '/var/task/app/dist',
        path.resolve(process.cwd(), 'dist'),
        process.cwd()
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand) && hasIndexFile(cand)) {
          distPath = cand;
          break;
        }
      }
    }

    app.use('/assets', express.static(path.join(distPath, 'assets'), {
      maxAge: '1y',
      immutable: true
    }));

    app.get('*', async (req, res, next) => {
      // 1. Fast protection against malicious bot scanners probing WordPress or other server exploits.
      // This saves massive network traffic (solving 5GB/12hr bandwidth spikes) and prevents useless database lookups.
      const lowercasePath = req.path.toLowerCase();
      const isBotProbe = 
        lowercasePath.includes('/wp-') ||
        lowercasePath.includes('/xmlrpc') ||
        lowercasePath.includes('/administrator') ||
        lowercasePath.includes('/phpmyadmin') ||
        lowercasePath.includes('/cgi-bin') ||
        lowercasePath.includes('/.env') ||
        lowercasePath.includes('/.git') ||
        lowercasePath.endsWith('.php') ||
        lowercasePath.endsWith('.asp') ||
        lowercasePath.endsWith('.aspx') ||
        lowercasePath.endsWith('.jsp') ||
        lowercasePath.endsWith('.ini') ||
        lowercasePath.endsWith('.sql') ||
        lowercasePath.endsWith('.env') ||
        lowercasePath.endsWith('.yml') ||
        lowercasePath.endsWith('.yaml') ||
        lowercasePath.endsWith('.bak');

      if (isBotProbe) {
        return res.status(404).set({
          'Content-Type': 'text/plain',
          'Cache-Control': 'public, max-age=86400' // cache bad paths at Vercel edge for 1 day
        }).send('Not Found');
      }

      // Skip API and files (images, fonts, etc)
      if (req.path.startsWith('/api/') || (req.path.includes('.') && !req.path.endsWith('.html'))) {
        return next();
      }

      try {
        let type: 'tour' | 'blog' | undefined;
        if (req.path.startsWith('/tour/')) type = 'tour';
        if (req.path.startsWith('/blog/')) type = 'blog';

        const seo = await getSEOContent(req.path, type);
        
        // Find correct index.template.html or index.html path resolving dynamically
        let htmlPath = path.join(distPath, 'index.template.html');
        if (!fs.existsSync(htmlPath)) {
          htmlPath = path.join(distPath, 'index.html');
        }
        
        if (!fs.existsSync(htmlPath)) {
          const currentFilename = typeof import.meta !== 'undefined' && import.meta.url ? fileURLToPath(import.meta.url) : (typeof __filename !== 'undefined' ? __filename : '');
          const currentDirname = currentFilename ? path.dirname(currentFilename) : (typeof __dirname !== 'undefined' ? __dirname : '');
          const htmlCandidates = [
            path.resolve(process.cwd(), 'dist', 'index.template.html'),
            path.resolve(process.cwd(), 'dist', 'index.html'),
            path.resolve(currentDirname, 'dist', 'index.template.html'),
            path.resolve(currentDirname, 'dist', 'index.html'),
            path.resolve(currentDirname, '..', 'dist', 'index.template.html'),
            path.resolve(currentDirname, '..', 'dist', 'index.html'),
            path.resolve(currentDirname, '..', '..', 'dist', 'index.template.html'),
            path.resolve(currentDirname, '..', '..', 'dist', 'index.html'),
            '/var/task/dist/index.template.html',
            '/var/task/dist/index.html',
            '/var/task/app/dist/index.template.html',
            '/var/task/app/dist/index.html'
          ];
          for (const cand of htmlCandidates) {
            if (fs.existsSync(cand)) {
              htmlPath = cand;
              break;
            }
          }
        }

        // Calculate optimized Cache-Control header for Edge CDN caching of public user-facing routes.
        // This ensures pages are served instantly by the CDN with 0% database or CPU overhead on subsequent hits.
        let cacheHeader = 'no-store, no-cache, must-revalidate, proxy-revalidate';
        const isPublicPage = req.path === '/' || 
                             req.path.startsWith('/tour/') || 
                             req.path.startsWith('/blog/') || 
                             ['/tours', '/blog', '/about', '/contact', '/destinations', '/planner', '/ai-hub', '/price-list', '/track-booking'].includes(req.path);
        
        if (isPublicPage) {
          cacheHeader = 'public, max-age=0, s-maxage=600, stale-while-revalidate=1200';
        }

        if (fs.existsSync(htmlPath)) {
          const template = await fs.promises.readFile(htmlPath, 'utf-8');
          const html = applySEO(template, seo);
          res.status(200).set({ 
            'Content-Type': 'text/html',
            'Cache-Control': cacheHeader,
            'X-SEO-Engine': 'express-ssr',
            'X-SEO-Status': seo.status 
          }).send(html);
        } else {
          // If index.html is still missing in compilation bundle, send a compliant inline HTML from fallback template.
          // This keeps client-side SPA routing entirely functioning and loads correct bundle files.
          const html = applySEO(fallbackHtmlTemplate, seo);
          res.status(200).set({ 
            'Content-Type': 'text/html',
            'Cache-Control': cacheHeader,
            'X-SEO-Engine': 'express-ssr-inline-fallback',
            'X-SEO-Status': 'fallback' 
          }).send(html);
        }
      } catch (error) {
        console.error("[SEO Prod Error]:", error);
        try {
          res.status(500).set({
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          });
          const fallbackPath = fs.existsSync(path.join(distPath, 'index.template.html'))
            ? path.join(distPath, 'index.template.html')
            : path.join(distPath, 'index.html');
          res.sendFile(fallbackPath);
        } catch (sendErr) {
          res.status(200).set({
            'Content-Type': 'text/html',
            'Cache-Control': 'no-store, no-cache, must-revalidate'
          }).send(fallbackHtmlTemplate);
        }
      }
    });

    app.use(express.static(distPath, {
      index: false,
      maxAge: '1h'
    }));
  }


  return app;
}

// Start the server
createServer().then(app => {
  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
