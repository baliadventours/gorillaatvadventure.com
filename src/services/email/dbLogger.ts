import admin from "firebase-admin";
import { getAdminDb, createDocViaRest } from "../firebaseAdmin.js";
import { EmailLogEntry } from "./types.js";

/**
 * Logs an email event to Firestore under 'email_logs' with error handling
 * so that any issues in logging do not disrupt the actual email flow.
 */
export async function logEmailAttempt(entry: {
  to: string;
  type: string;
  bookingId: string | null;
  subject: string;
  status: "success" | "skipped" | "failed";
  reason?: string;
  provider: string;
  errorDetails?: string;
}) {
  try {
    const db = getAdminDb();
    const logData: EmailLogEntry = {
      ...entry,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    console.log(`[Email Logger] Logging attempt for ${entry.type} to ${entry.to} [Status: ${entry.status}]`);
    await db.collection("email_logs").add(logData);
  } catch (err: any) {
    console.warn("[Email Logger] Admin SDK Firestore logging failed, trying REST fallback:", err.message);
    try {
      await createDocViaRest("email_logs", {
        ...entry,
        createdAt: new Date().toISOString()
      });
      console.log("[Email Logger] Successfully logged email attempt via REST fallback.");
    } catch (restErr: any) {
      console.error("[Email Logger] REST fallback logging also failed:", restErr.message || restErr);
    }
  }
}
