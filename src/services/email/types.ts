import admin from "firebase-admin";

export interface EmailConfig {
  emailProvider: string;
  emailApiKey?: string;
  senderEmail: string;
  senderName: string;
  adminNotificationEmail: string;
  gmailUser?: string;
  gmailAppPassword?: string;
  siteName: string;
  logo?: string;
  officeAddress?: string;
  supportEmail?: string;
  supportPhone?: string;
  primaryColor?: string;
  secondaryColor?: string;
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  swiftCode?: string;
  bankInstructions?: string;
}

export interface SendEmailParams {
  to?: string;
  subject?: string;
  html?: string;
  type?: string;
  booking?: any;
  extraInfo?: any;
}

export interface EmailLogEntry {
  to: string;
  type: string;
  bookingId: string | null;
  subject: string;
  status: "success" | "skipped" | "failed";
  reason?: string;
  createdAt: admin.firestore.FieldValue;
  provider: string;
  errorDetails?: string;
}
