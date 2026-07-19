import { getAdminDb, verifyAdmin, verifyUser } from "../src/services/firebaseAdmin.js";
import { sendWhatsAppMessage, formatWhatsAppMessage, sendWhatsAppTemplateMessage } from "../src/services/whatsappHandler.js";

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const db = getAdminDb();

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
      wabaAccessToken,
      wabaPhoneNumberId,
      wabaTemplateName,
      wabaLanguageCode
    } = req.body;
    const finalMessageContent = customMessage || fallbackMessage;

    // SECURITY: Verify user is authorized
    const adminResult = idToken ? await verifyAdmin(idToken) : { isAdmin: false };
    const isAdmin = adminResult.isAdmin;
    const isOwner = (idToken && booking?.userId) ? await verifyUser(idToken, booking.userId) : false;

    // Allow sending notifications if it's a legitimate booking confirmation OR authorized user
    const isStandardNotification = ['booking_confirmation', 'admin_notification', 'booking_status_updated'].includes(type);
    
    if (customMessage && !isAdmin) {
        return res.status(403).json({ error: "Forbidden: Only admins can send custom messages." });
    }

    if (!isAdmin && !isOwner && !isStandardNotification) {
        return res.status(403).json({ error: "Forbidden: You are not authorized to send messages." });
    }

    // Additional security for standard notifications when not logged in
    if (!idToken && isStandardNotification) {
        // Only allow sending to the customer's phone in the booking OR to the admin
        if (type === 'booking_confirmation' && receiver && receiver !== booking?.customerData?.phone) {
            return res.status(403).json({ error: "Forbidden: Cannot send confirmation to third party number." });
        }
        if (type === 'admin_notification' && receiver) {
            // Admin notifications should go to the configured admin phone, not a caller-provided receiver
            return res.status(403).json({ error: "Forbidden: Admin notifications use internal routing." });
        }
    }

    // Fetch communication settings from Firestore with graceful fallback for Vercel database credential issues
    let settings: any = {};
    try {
      const settingsDoc = await db.collection('communicationSettings').doc('global').get();
      settings = settingsDoc.data() || {};
    } catch (dbErr: any) {
      console.warn("[WhatsApp API] Firestore settings lookup skipped or failed on Vercel:", dbErr.message);
      // If we skipped, warn but continue in case body parameter overrides are passed (e.g., diagnostics/test sends)
      if (!finalMessageContent) {
        return res.status(500).json({ 
          success: false, 
          error: `Database connection failed. In order to retrieve templates and send automatic booking confirmations on Vercel, you must configure the FIREBASE_SERVICE_ACCOUNT environment variable on your Vercel Dashboard. Internal error: ${dbErr.message}` 
        });
      }
    }
    
    // In case Firestore lookup was skipped, default whatsappEnabled to true if there is a custom direct message
    const isEnabled = settings.hasOwnProperty('whatsappEnabled') ? settings.whatsappEnabled : true;
    if (!isEnabled && !finalMessageContent) {
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

    // Use configured OpenWA credentials, supporting inline overrides
    const finalToken = token || settings.openwaApiKey;
    const finalBaseUrl = baseUrl || settings.openwaBaseUrl;
    const finalSessionId = sessionId || settings.openwaSessionId;

    const finalProvider = provider || settings.whatsappProvider || 'openwa';

    const finalWabaConfig = {
      accessToken: wabaAccessToken || settings.wabaAccessToken,
      phoneNumberId: wabaPhoneNumberId || settings.wabaPhoneNumberId,
      templateName: wabaTemplateName || settings.wabaTemplateName,
      languageCode: wabaLanguageCode || settings.wabaLanguageCode || 'en',
      booking: booking,
      type: type
    };

    const result = await sendWhatsAppMessage({
      number: targetNumber,
      message: message
    }, finalToken, finalBaseUrl, finalSessionId, finalProvider, finalWabaConfig);

    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[WhatsApp Vercel API Error]:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
