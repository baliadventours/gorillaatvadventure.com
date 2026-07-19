import admin from "firebase-admin";
import { getAdminDb, getDocViaRest } from "../firebaseAdmin.js";
import { EmailConfig } from "./types.js";

/**
 * Loads Email Configuration from Settings document and parses standard fallbacks.
 */
export async function resolveEmailConfig(): Promise<EmailConfig> {
  const db = getAdminDb();
  let globalSettings: any = null;

  try {
    try {
      const settingsDoc = await db.collection('communicationSettings').doc('global').get();
      if (settingsDoc.exists) {
        globalSettings = settingsDoc.data();
      }
    } catch (e: any) {
      console.warn("[Email Resolver] Fetching communicationSettings/global via Admin SDK failed, falling back to REST:", e.message || e);
      globalSettings = await getDocViaRest('communicationSettings', 'global');
    }
    
    let siteData: any = null;
    try {
      const siteSettingsDoc = await db.collection('settings').doc('general').get();
      if (siteSettingsDoc.exists) {
        siteData = siteSettingsDoc.data();
      }
    } catch (e: any) {
      console.warn("[Email Resolver] Fetching settings/general via Admin SDK failed, falling back to REST:", e.message || e);
      siteData = await getDocViaRest('settings', 'general');
    }

    if (siteData) {
      globalSettings = {
        ...globalSettings,
        siteName: siteData.siteName,
        logo: siteData.logoURL || siteData.logoUrl || siteData.logo,
        officeAddress: siteData.officeAddress,
        supportEmail: siteData.supportEmail,
        supportPhone: siteData.supportPhone,
        primaryColor: siteData.primaryColor,
        secondaryColor: siteData.secondaryColor
      };
    }

    let paymentData: any = null;
    try {
      const paymentSettingsDoc = await db.collection('settings').doc('payment').get();
      if (paymentSettingsDoc.exists) {
        paymentData = paymentSettingsDoc.data();
      }
    } catch (e: any) {
      console.warn("[Email Resolver] Fetching settings/payment via Admin SDK failed, falling back to REST:", e.message || e);
      paymentData = await getDocViaRest('settings', 'payment');
    }

    if (paymentData) {
      globalSettings = {
        ...globalSettings,
        bankName: paymentData?.bankName,
        accountNumber: paymentData?.accountNumber,
        accountHolder: paymentData?.accountHolder,
        swiftCode: paymentData?.swiftCode,
        bankInstructions: paymentData?.bankInstructions
      };
    }
  } catch (dbError: any) {
    console.error("[Email Resolver] Firestore fetch FAILED:", dbError.message);
  }

  let resolvedApiKey = (globalSettings?.emailApiKey || '').trim();
  if (!resolvedApiKey) {
    const mPublic = process.env.MJ_APIKEY_PUBLIC || process.env.MAILJET_API_KEY;
    const mPrivate = process.env.MJ_APIKEY_PRIVATE || process.env.MAILJET_API_SECRET;
    if (mPublic && mPrivate) {
      resolvedApiKey = `${mPublic.trim()}:${mPrivate.trim()}`;
    } else {
      resolvedApiKey = (mPublic || process.env.ENGINEMAILER_API_KEY || process.env.RESEND_API_KEY || process.env.BREVO_API_KEY || process.env.SENDGRID_API_KEY || '').trim();
    }
  }

  const envValues = {
    emailProvider: (globalSettings?.emailProvider || process.env.DEFAULT_EMAIL_PROVIDER || 'none').trim(),
    emailApiKey: resolvedApiKey,
    senderEmail: (globalSettings?.senderEmail || process.env.SENDER_EMAIL || globalSettings?.supportEmail || 'onboarding@resend.dev').trim(),
    senderName: (globalSettings?.senderName || process.env.SENDER_NAME || globalSettings?.siteName || 'Travel Agency').trim(),
    adminNotificationEmail: (globalSettings?.adminNotificationEmail?.trim() || process.env.ADMIN_EMAIL?.trim() || 'baliadventours@gmail.com').trim(),
    gmailUser: (globalSettings?.gmailUser || process.env.GMAIL_USER || '').trim(),
    gmailAppPassword: (globalSettings?.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || '').trim().replace(/\s+/g, '')
  };

  // Determine active provider based on environment keys
  if (envValues.emailProvider === 'none' || envValues.emailProvider === 'resend') {
    if (process.env.RESEND_API_KEY) {
      envValues.emailProvider = 'resend';
    } else if (process.env.BREVO_API_KEY) {
      envValues.emailProvider = 'brevo';
    } else if (process.env.SENDGRID_API_KEY) {
      envValues.emailProvider = 'sendgrid';
    } else if (process.env.ENGINEMAILER_API_KEY) {
      envValues.emailProvider = 'enginemailer';
    } else if (process.env.MAILJET_API_KEY || process.env.MJ_APIKEY_PUBLIC) {
      envValues.emailProvider = 'mailjet';
    } else if (process.env.GMAIL_APP_PASSWORD) {
      envValues.emailProvider = 'gmail';
    }
  }

  return {
    ...globalSettings,
    ...envValues
  };
}

/**
 * Normalizes inputs into numbers
 */
export function parseCurrency(val: any): number {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  return Number(val.toString().replace(/[^0-9.-]+/g, "")) || 0;
}

/**
 * Formats values into a neat USD currency string
 */
export function formatCurrency(amount: any): string {
  const num = parseCurrency(amount);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num);
}

/**
 * Extracts and compiles complete supplier details for a booking
 */
export async function resolveSupplierForBooking(booking: any, config: EmailConfig) {
  const db = getAdminDb();
  let supplierName = booking?.supplierName || ""; 
  let supplierPhone = "N/A";
  let supplierEmail = booking?.supplierEmail || "N/A";
  let commissionRate = Number(booking?.commissionRate) || 10;
  
  if (booking && ((booking.supplierId && booking.supplierId !== 'admin') || booking.supplierEmail || booking.tourId)) {
    try {
      let supplierData: any = null;
      
      // Lookup by ID
      if (booking.supplierId && booking.supplierId !== 'admin') {
        const supplierDoc = await db.collection('users').doc(booking.supplierId).get();
        if (supplierDoc.exists) {
          supplierData = supplierDoc.data();
        }
      }
      
      // Lookup by email if ID skipped/failed
      if (!supplierData && booking.supplierEmail && booking.supplierEmail !== 'N/A') {
        const supplierQuery = await db.collection('users').where('email', '==', booking.supplierEmail).get();
        if (!supplierQuery.empty) {
          supplierData = supplierQuery.docs[0].data();
        }
      }

      // Clean placeholder names
      const siteName = config.siteName || "Bali Adventours";
      if (supplierName && (
          supplierName.toLowerCase() === 'supplier' || 
          supplierName.toLowerCase() === 'admin' || 
          supplierName === siteName ||
          supplierName === "Bali Adventours (Platform)" ||
          supplierName === "Bali Adventours"
      )) {
        supplierName = "";
      }

      // Fallback: check Tour document fields
      if ((!supplierName || supplierName === "" || !supplierEmail || supplierEmail === "N/A") && booking.tourId) {
        const tourDoc = await db.collection('tours').doc(booking.tourId).get();
        if (tourDoc.exists) {
          const tourData = tourDoc.data();
          if (!supplierName || supplierName === "") {
            const tourVendor = tourData?.supplierName || tourData?.vendor || tourData?.businessName || tourData?.vendorName;
            if (tourVendor && tourVendor !== siteName && tourVendor !== "Bali Adventours (Platform)") {
              supplierName = tourVendor;
            }
          }
          if (!supplierEmail || supplierEmail === "N/A") {
             const tourSupplierEmail = tourData?.supplierEmail || tourData?.vendorEmail;
             if (tourSupplierEmail) {
                supplierEmail = tourSupplierEmail;
             }
          }
        }
      }

      if (supplierData) {
        const foundName = supplierData.companyName || supplierData.businessName || supplierData.displayName || (supplierData.firstName ? `${supplierData.firstName} ${supplierData.lastName || ''}`.trim() : null);
        if (foundName && foundName !== siteName && foundName !== "Bali Adventours (Platform)") {
          supplierName = foundName;
        }
        
        supplierPhone = supplierData.phoneNumber || 'N/A';
        
        if (supplierData.commissionRate !== undefined) {
          commissionRate = Number(supplierData.commissionRate);
        }
        
        if (supplierData.publicEmail) {
          supplierEmail = supplierData.publicEmail;
        } else if (supplierData.email) {
          supplierEmail = supplierData.email;
        }
      }
    } catch (err) {
      console.error("[Email Resolver] Error resolving supplier details:", err);
    }
  }

  // Safety fallback
  if (!supplierName || 
      supplierName.toLowerCase() === 'supplier' || 
      supplierName.toLowerCase() === 'admin' ||
      supplierName === "Bali Adventours (Platform)" ||
      ((!supplierName || supplierName.trim() === "") && (!booking.supplierId || booking.supplierId === 'admin'))) {
     supplierName = config.siteName || "Bali Adventours";
  }

  return {
    supplierName,
    supplierPhone,
    supplierEmail,
    commissionRate
  };
}
