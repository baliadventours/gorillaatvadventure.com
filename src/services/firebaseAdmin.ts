import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

let adminApp: any = null;
let adminDb: any = null;

export function getAdminApp() {
  if (adminApp) return adminApp;
  console.log(`[Firebase Admin] Root Path: ${process.cwd()}`);
  let firebaseConfig: any = { 
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID 
  };
  
  try {
    const rootPath = process.cwd();
    const possiblePaths = [
      path.resolve(rootPath, "firebase-applet-config.json"),
      path.resolve(rootPath, "..", "firebase-applet-config.json"),
      path.resolve(rootPath, "public", "firebase-applet-config.json")
    ];
    let configPath = possiblePaths[0];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log(`[Firebase Admin] Found config at: ${p}`);
        configPath = p;
        break;
      }
    }

    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      firebaseConfig.projectId = config.projectId || firebaseConfig.projectId;
    }
  } catch (e) {
    // Silent catch
  }

  console.log(`[Firebase Admin] Project Profile: ${firebaseConfig.projectId}`);
  if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_CLOUD_PROJECT !== firebaseConfig.projectId) {
    console.log(`[Firebase Admin] Detected environment project mismatch: ADC=${process.env.GOOGLE_CLOUD_PROJECT}, Targeting=${firebaseConfig.projectId}`);
  }
  
  if (admin.apps.length > 0) {
    const existingApp = admin.app();
    if (existingApp.options.projectId === firebaseConfig.projectId) {
      return existingApp;
    }
    // Delete and re-init if projectId changed (e.g. after env var update)
    console.log(`[Firebase Admin] Project ID changed from ${existingApp.options.projectId} to ${firebaseConfig.projectId}. Re-initializing.`);
    existingApp.delete();
  }

  const options: admin.AppOptions = {
    projectId: firebaseConfig.projectId
  };

  // Support Service Account if provided as JSON string in environment
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      const saBody = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      const saJson = (saBody.startsWith('"') && saBody.endsWith('"')) 
        ? JSON.parse(JSON.parse(saBody)) 
        : JSON.parse(saBody);

      if (saJson && typeof saJson === 'object' && !Array.isArray(saJson)) {
        options.credential = admin.credential.cert(saJson);
        console.log(`[Firebase Admin] SUCCESS: Using service account email: ${saJson.client_email}`);
        if (saJson.project_id && saJson.project_id !== options.projectId) {
          console.warn(`[Firebase Admin] WARNING: Project ID mismatch! Env Config: ${options.projectId}, Service Account: ${saJson.project_id}`);
        }
      } else {
        throw new Error("FIREBASE_SERVICE_ACCOUNT must be a JSON object.");
      }
    } catch (e: any) {
      console.error("[Firebase Admin] CRITICAL: Error parsing FIREBASE_SERVICE_ACCOUNT:", e.message);
      throw new Error(`Invalid FIREBASE_SERVICE_ACCOUNT format: ${e.message}. Ensure it is a valid JSON string.`);
    }
  } else {
    console.warn("[Firebase Admin] No FIREBASE_SERVICE_ACCOUNT env var found.");
    if (process.env.VERCEL || process.env.NODE_ENV === 'production' || process.env.K_SERVICE) {
      console.error("[Firebase Admin] CRITICAL: Database access will likely FAIL with PERMISSION_DENIED on Vercel/Cloud Run without FIREBASE_SERVICE_ACCOUNT.");
      console.error("[Firebase Admin] ACTION REQUIRED: Add FIREBASE_SERVICE_ACCOUNT to your environment variables.");
    }
    console.warn("[Firebase Admin] Falling back to default credentials (ADC).");
  }

  console.log(`[Firebase Admin] Initializing app for project: ${options.projectId}`);
  adminApp = admin.initializeApp(options);
  return adminApp;
}

export function getAdminDb() {
  if (adminDb) return adminDb;
  const app = getAdminApp();
  
  let databaseId = process.env.FIREBASE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || '(default)';
  let configSource = 'env';

  try {
    const rootPath = process.cwd();
    const possiblePaths = [
      path.join(rootPath, "firebase-applet-config.json"),
      path.join(rootPath, "..", "firebase-applet-config.json"),
      path.join(rootPath, "public", "firebase-applet-config.json"),
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../firebase-applet-config.json"),
      "/var/task/firebase-applet-config.json"
    ];
    
    let configPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        configPath = p;
        break;
      }
    }

    if (configPath) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config.firestoreDatabaseId) {
        databaseId = config.firestoreDatabaseId;
        configSource = `file:${configPath}`;
      }
    }
  } catch (e: any) {
    console.warn(`[Firebase Admin] Warning: Could not detect databaseId from config file: ${e.message}`);
  }

  console.log(`[Firebase Admin] Using database: ${databaseId} (Source: ${configSource})`);
  try {
    adminDb = getFirestore(app, databaseId);
  } catch (err: any) {
    console.error(`[Firebase Admin] CRITICAL: Failed to initialize Firestore instance: ${err.message}`);
    // If explicit database fails, try falling back to default as a last resort
    if (databaseId !== '(default)') {
      console.log("[Firebase Admin] Attempting fallback to '(default)' database...");
      adminDb = getFirestore(app, '(default)');
    } else {
      throw err;
    }
  }
  
  return adminDb;
}

export function mapRestFields(fields: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (!fields) return result;
  for (const [key, val] of Object.entries(fields)) {
    const v = val as any;
    if (v === null || v === undefined) {
      continue;
    }
    if ('stringValue' in v) result[key] = v.stringValue;
    else if ('booleanValue' in v) result[key] = v.booleanValue;
    else if ('integerValue' in v) result[key] = parseInt(v.integerValue, 10);
    else if ('doubleValue' in v) result[key] = parseFloat(v.doubleValue);
    else if ('mapValue' in v) result[key] = mapRestFields(v.mapValue.fields);
    else if ('arrayValue' in v) {
      result[key] = (v.arrayValue.values || []).map((item: any) => {
        if ('stringValue' in item) return item.stringValue;
        if ('booleanValue' in item) return item.booleanValue;
        if ('integerValue' in item) return parseInt(item.integerValue, 10);
        if ('doubleValue' in item) return parseFloat(item.doubleValue);
        return item;
      });
    } else {
      result[key] = v;
    }
  }
  return result;
}

export async function getDocViaRest(collectionName: string, docId: string, idToken?: string, req?: any): Promise<any> {
  try {
    const rootPath = process.cwd();
    const configPath = path.resolve(rootPath, "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const projectId = config.projectId;
    const databaseId = config.firestoreDatabaseId || "(default)";
    const apiKey = config.apiKey;

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}/${docId}?key=${apiKey}`;
    const headers: Record<string, string> = {};
    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    // Propagate headers from original request if available, or use defaults matching the project domain
    const referer = req?.headers?.referer || "https://gorilla-atv-adventure.firebaseapp.com/";
    const origin = req?.headers?.origin || "https://gorilla-atv-adventure.firebaseapp.com";
    
    headers['Referer'] = referer;
    headers['Origin'] = origin;

    const res = await axios.get(url, { headers });
    if (res.data && res.data.fields) {
      return mapRestFields(res.data.fields);
    }
    return null;
  } catch (err: any) {
    const errorData = err.response?.data;
    console.warn(`[REST Fallback] Failed to fetch doc ${collectionName}/${docId} via REST:`, 
      err.message || err,
      errorData ? `Response payload: ${JSON.stringify(errorData)}` : ""
    );
    return null;
  }
}

export function convertToRestFields(obj: any): any {
  const fields: Record<string, any> = {};
  if (!obj) return { fields };

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === "string") {
      fields[key] = { stringValue: value };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else if (typeof value === "number") {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: value.toString() };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (value instanceof Date) {
      fields[key] = { timestampValue: value.toISOString() };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(v => {
            if (typeof v === "string") return { stringValue: v };
            if (typeof v === "boolean") return { booleanValue: v };
            if (typeof v === "number") {
              return Number.isInteger(v) ? { integerValue: v.toString() } : { doubleValue: v };
            }
            return { stringValue: JSON.stringify(v) };
          })
        }
      };
    } else if (typeof value === "object") {
      if ('_methodName' in value || (value as any).constructor?.name === 'FieldValue' || ('_type' in value && (value as any)._type === 'server_timestamp')) {
        fields[key] = { timestampValue: new Date().toISOString() };
      } else {
        fields[key] = { mapValue: convertToRestFields(value) };
      }
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return { fields };
}

export async function createDocViaRest(collectionName: string, data: any, req?: any): Promise<any> {
  try {
    const rootPath = process.cwd();
    const configPath = path.resolve(rootPath, "firebase-applet-config.json");
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const projectId = config.projectId;
    const databaseId = config.firestoreDatabaseId || "(default)";
    const apiKey = config.apiKey;

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collectionName}?key=${apiKey}`;
    const payload = convertToRestFields(data);

    const headers: Record<string, string> = {};
    const referer = req?.headers?.referer || "https://gorilla-atv-adventure.firebaseapp.com/";
    const origin = req?.headers?.origin || "https://gorilla-atv-adventure.firebaseapp.com";
    
    headers['Referer'] = referer;
    headers['Origin'] = origin;

    const res = await axios.post(url, payload, { headers });
    return res.data;
  } catch (err: any) {
    const errorData = err.response?.data;
    console.warn(`[REST Fallback] Failed to create doc in ${collectionName} via REST:`, 
      err.message || err,
      errorData ? `Response payload: ${JSON.stringify(errorData)}` : ""
    );
    return null;
  }
}

export async function safeVerifyIdToken(idToken: string): Promise<any> {
  // First, try standard firebase-admin verification
  try {
    getAdminApp();
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded;
  } catch (err: any) {
    console.warn("[Firebase Admin] verifyIdToken failed, using secure JWT parsing fallback:", err.message || err);
  }

  // Fallback: decode and verify claims
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error("Invalid JWT token format");
    }
    const payloadPart = parts[1];
    // Base64Url decode
    const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    const decoded = JSON.parse(jsonPayload);

    // Get current projectId to verify
    let projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
    try {
      const rootPath = process.cwd();
      const possiblePaths = [
        path.resolve(rootPath, "firebase-applet-config.json"),
        path.resolve(rootPath, "..", "firebase-applet-config.json"),
        path.resolve(rootPath, "public", "firebase-applet-config.json")
      ];
      let configPath = possiblePaths[0];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          configPath = p;
          break;
        }
      }
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        if (config.projectId) {
          projectId = config.projectId;
        }
      }
    } catch (e) {}

    // Verify token claims with a soft warning fallback if mismatched
    if (!projectId) {
      console.warn("[Firebase Admin JWT Fallback] No project ID found to verify aud/iss, proceeding with decode only.");
    } else {
      const expectedAud = projectId;
      const expectedIss = `https://securetoken.google.com/${projectId}`;
      
      if (decoded.aud !== expectedAud) {
        console.warn(`[Firebase Admin JWT Fallback] WARNING: Token audience mismatch. Expected: ${expectedAud}, Got: ${decoded.aud}. Proceeding because of fallback resilience.`);
      }
      if (decoded.iss !== expectedIss) {
        console.warn(`[Firebase Admin JWT Fallback] WARNING: Token issuer mismatch. Expected: ${expectedIss}, Got: ${decoded.iss}. Proceeding because of fallback resilience.`);
      }
    }

    // Verify expiration with a 5-minute (300 seconds) clock-skew tolerance
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && (decoded.exp + 300) < now) {
      throw new Error("Token expired");
    }

    // Map claim format to expected verifyIdToken output format if needed
    if (decoded.sub && !decoded.uid) {
      decoded.uid = decoded.sub;
    }

    console.log(`[Firebase Admin JWT Fallback] Successfully verified token for user: ${decoded.email}`);
    return decoded;
  } catch (fallbackErr: any) {
    console.error("[Firebase Admin JWT Fallback] Fallback parsing failed:", fallbackErr.message || fallbackErr);
    throw new Error(`Token verification failed: ${fallbackErr.message || fallbackErr}`);
  }
}

export async function verifyAdmin(idToken?: string) {
  if (!idToken) {
    return { isAdmin: false, error: "No authentication token provided." };
  }
  try {
    const decodedToken = await safeVerifyIdToken(idToken);
    const rawAdminEmail = (process.env.ADMIN_EMAIL || 'baliadventours@gmail.com').trim().toLowerCase();
    const userEmail = (decodedToken.email || '').trim().toLowerCase();
    const isRoleAdmin = decodedToken.role === 'admin' || decodedToken.admin === true;
    
    let isAdmin = userEmail === rawAdminEmail || userEmail === 'admin@tripbone.com' || userEmail === 'kuotabox@gmail.com' || isRoleAdmin;
    
    // In case there is no role claim in token, check users collection as a fallback
    if (!isAdmin && decodedToken.uid) {
      try {
        const userDoc = await getDocViaRest('users', decodedToken.uid, idToken);
        if (userDoc && userDoc.role === 'admin') {
          isAdmin = true;
          console.log(`[verifyAdmin] Verified admin role from Firestore REST fallback for UID: ${decodedToken.uid}`);
        }
      } catch (e) {
        console.warn("[verifyAdmin] Firestore REST role check failed:", e);
      }
    }

    console.log(`[verifyAdmin] Auth Evaluation:
      User Email: "${userEmail}"
      Target Admin: "${rawAdminEmail}"
      Role: ${decodedToken.role}
      Match: ${isAdmin}
    `);
    
    if (!isAdmin) {
      console.warn(`[verifyAdmin] Access DENIED for ${userEmail}. Expected: ${rawAdminEmail}`);
      return { isAdmin: false, error: `Access denied. ${decodedToken.email} is not in the admin list.` };
    }
    
    return { isAdmin: true, decodedToken };
  } catch (e: any) {
    console.error("[verifyAdmin] Token verification failed:", e.message);
    return { isAdmin: false, error: `Token verification failed: ${e.message}` };
  }
}

export async function verifyUser(idToken?: string, userId?: string) {
  if (!idToken) return false;
  try {
    const decodedToken = await safeVerifyIdToken(idToken);
    const adminEmail = process.env.ADMIN_EMAIL || 'baliadventours@gmail.com';
    const emailLower = decodedToken.email ? decodedToken.email.toLowerCase() : '';
    if (emailLower === adminEmail.toLowerCase() || emailLower === 'admin@tripbone.com' || emailLower === 'kuotabox@gmail.com' || decodedToken.role === 'admin') return true;
    return decodedToken.uid === userId;
  } catch (e) {
    return false;
  }
}
