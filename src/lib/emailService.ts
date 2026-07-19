import { Booking } from "../types";
import { auth } from "./firebase";

/**
 * Sends a booking email by delegating to the backend API.
 * This is more secure as it avoids reading sensitive API keys on the client
 * and bypasses Firestore permission restrictions for regular users.
 */
export async function sendBookingEmail(type: string, booking: Booking, extraInfo?: any) {
  try {
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;
    
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        type,
        booking,
        extraInfo: {
          ...extraInfo,
          appUrl: currentOrigin || (extraInfo && extraInfo.appUrl)
        }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to send email");
    }

    const data = await response.json();
    if (data.skipped) {
      console.log(`Email skipped: ${type} ${data.reason ? '- ' + data.reason : '(Template disabled or provider not configured)'}`);
    } else {
      console.log(`Email ${type} processed successfully`);
    }
  } catch (error) {
    console.error("Error sending booking email:", error);
  }
}
