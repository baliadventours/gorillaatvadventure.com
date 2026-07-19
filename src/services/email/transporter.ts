import nodemailer from "nodemailer";
import { EmailConfig } from "./types.js";

interface SendMailPayload {
  to: string[];
  subject: string;
  html: string;
  attachment?: {
    content: string; // Base64
    filename: string;
    type?: string;
    disposition?: string;
  } | null;
}

/**
 * Sends a pre-compiled and parsed email via the active provider configured in Settings.
 */
export async function sendEmailViaProvider(config: EmailConfig, payload: SendMailPayload) {
  const { to: recipientsArray, subject, html, attachment } = payload;

  if (config.emailProvider === 'none') {
    return { success: true, skipped: true, reason: 'Provider set to none' };
  }

  // Validate credentials
  if (config.emailProvider === 'gmail') {
    if (!config.gmailUser || !config.gmailAppPassword) {
      throw new Error("Gmail credentials missing (GMAIL_USER or GMAIL_APP_PASSWORD)");
    }
  } else {
    if (!config.emailApiKey) {
      throw new Error(`API Key missing for provider: ${config.emailProvider}`);
    }
  }

  // Resend API
  if (config.emailProvider === 'resend') {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.emailApiKey}`,
      },
      body: JSON.stringify({
        from: `${config.senderName} <${config.senderEmail}>`,
        to: recipientsArray.length === 1 ? recipientsArray[0] : recipientsArray,
        subject,
        html,
        attachments: attachment ? [{
          content: attachment.content,
          filename: attachment.filename,
        }] : []
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || `Resend error: ${JSON.stringify(data)}`);
    }
    return { success: true, data };
  }

  // SendGrid API
  if (config.emailProvider === 'sendgrid') {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.emailApiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: recipientsArray.map(email => ({ email })) }],
        from: { email: config.senderEmail, name: config.senderName },
        subject,
        content: [{ type: "text/html", value: html }],
        attachments: attachment ? [{
          content: attachment.content,
          filename: attachment.filename,
          type: attachment.type || "application/pdf",
          disposition: attachment.disposition || "attachment"
        }] : []
      }),
    });

    if (!response.ok) {
       const errData = await response.text();
       throw new Error(errData || "SendGrid error");
    }
    return { success: true };
  }

  // Brevo API
  if (config.emailProvider === 'brevo') {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.emailApiKey,
      },
      body: JSON.stringify({
        sender: { name: config.senderName, email: config.senderEmail },
        to: recipientsArray.map(email => ({ email })),
        subject: subject,
        htmlContent: html,
        attachment: attachment ? [{
          content: attachment.content,
          name: attachment.filename
        }] : []
      }),
    });

    if (!response.ok) {
       const errData = await response.json();
       throw new Error(errData.message || `Brevo error: ${JSON.stringify(errData)}`);
    }
    return { success: true };
  }

  // Gmail SMTP
  if (config.emailProvider === 'gmail') {
    console.log(`[Email Transporter] Initializing Gmail SMTP for user: ${config.gmailUser}`);
    try {
      const transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // Use SSL/TLS
        auth: {
          user: config.gmailUser,
          pass: config.gmailAppPassword,
        },
        tls: {
          rejectUnauthorized: false // Ignore self-signed or intermediate cert handshake issues
        },
        connectionTimeout: 10000, // 10 seconds timeout
        greetingTimeout: 10000,
      });

      console.log(`[Email Transporter] Sending Gmail SMTP (Port 465 SSL/TLS) from: "${config.senderName}" <${config.gmailUser}> to: ${recipientsArray.join(', ')}`);
      await transporter.sendMail({
        from: `"${config.senderName}" <${config.gmailUser}>`,
        to: recipientsArray.join(', '),
        subject,
        html,
        attachments: attachment ? [{
          filename: attachment.filename,
          content: Buffer.from(attachment.content, 'base64')
        }] : []
      });

      console.log("[Email Transporter] Gmail SMTP message sent successfully via Port 465");
      return { success: true };
    } catch (primaryError: any) {
      console.warn(`[Email Transporter] Gmail Port 465 SMTP failed: ${primaryError.message || primaryError}. Trying Port 587 STARTTLS fallback...`);
      
      const fallbackTransporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // Use STARTTLS
        auth: {
          user: config.gmailUser,
          pass: config.gmailAppPassword,
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
      });

      console.log(`[Email Transporter] Sending Gmail SMTP (Port 587 STARTTLS) from: "${config.senderName}" <${config.gmailUser}> to: ${recipientsArray.join(', ')}`);
      await fallbackTransporter.sendMail({
        from: `"${config.senderName}" <${config.gmailUser}>`,
        to: recipientsArray.join(', '),
        subject,
        html,
        attachments: attachment ? [{
          filename: attachment.filename,
          content: Buffer.from(attachment.content, 'base64')
        }] : []
      });

      console.log("[Email Transporter] Gmail SMTP message sent successfully via Port 587 STARTTLS fallback");
      return { success: true };
    }
  }

  // Enginemailer (REST API with SMTP Fallback)
  if (config.emailProvider === 'enginemailer') {
    if (attachment) {
      console.log("[Email Transporter] Attachment present, routing through Enginemailer SMTP");
      const transporter = nodemailer.createTransport({
        host: 'smtp.enginemailer.com',
        port: 2525,
        secure: false,
        auth: {
          user: config.senderEmail,
          pass: config.emailApiKey,
        },
      });

      await transporter.sendMail({
        from: `"${config.senderName}" <${config.senderEmail}>`,
        to: recipientsArray.join(', '),
        subject,
        html,
        attachments: [{
          filename: attachment.filename,
          content: Buffer.from(attachment.content, 'base64')
        }]
      });

      return { success: true };
    }

    try {
      console.log("[Email Transporter] Routing through Enginemailer REST API");
      const response = await fetch("https://api.enginemailer.com/v1/Emails/Submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": config.emailApiKey || '',
          "ApiKey": config.emailApiKey || '',
          "Authorization": `Bearer ${config.emailApiKey}`
        },
        body: JSON.stringify({
          Sender: config.senderEmail,
          Recipient: recipientsArray[0],
          Subject: subject,
          Content: html
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`REST API returned status ${response.status}: ${errorText}`);
      }

      return { success: true };
    } catch (apiError: any) {
      console.warn(`[Email Transporter] Enginemailer REST API failed, falling back to SMTP:`, apiError.message);
      
      const transporter = nodemailer.createTransport({
        host: 'smtp.enginemailer.com',
        port: 2525,
        secure: false,
        auth: {
          user: config.senderEmail,
          pass: config.emailApiKey,
        },
      });

      await transporter.sendMail({
        from: `"${config.senderName}" <${config.senderEmail}>`,
        to: recipientsArray.join(', '),
        subject,
        html
      });

      return { success: true };
    }
  }

  // Mailjet API
  if (config.emailProvider === 'mailjet') {
    let mailjetKey = "";
    let mailjetSecret = "";
    if (config.emailApiKey && config.emailApiKey.includes(":")) {
      const parts = config.emailApiKey.split(":");
      mailjetKey = parts[0].trim();
      mailjetSecret = parts[1].trim();
    } else {
      mailjetKey = (config.emailApiKey || process.env.MJ_APIKEY_PUBLIC || process.env.MAILJET_API_KEY || "").trim();
      mailjetSecret = (process.env.MJ_APIKEY_PRIVATE || process.env.MAILJET_API_SECRET || "").trim();
    }

    if (!mailjetKey || !mailjetSecret) {
      throw new Error("Mailjet credentials missing. Please provide API_KEY:API_SECRET or define MJ_APIKEY_PUBLIC and MJ_APIKEY_PRIVATE environment variables.");
    }

    const authHeader = Buffer.from(`${mailjetKey}:${mailjetSecret}`).toString("base64");
    const senderEmailTrimmed = (config.senderEmail || "").trim();
    const senderNameTrimmed = (config.senderName || "Travel Agency").trim();

    // Create a plain-text fallback by stripping HTML tags
    const plainText = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 2000);

    const payloadBody = {
      Messages: [
        {
          From: {
            Email: senderEmailTrimmed,
            Name: senderNameTrimmed,
          },
          To: recipientsArray.map(email => ({
            Email: email.trim(),
            Name: email.trim().split("@")[0],
          })),
          Subject: subject,
          TextPart: plainText || subject,
          HTMLPart: html,
          Attachments: attachment ? [{
            ContentType: attachment.type || "application/pdf",
            Filename: attachment.filename,
            Base64Content: attachment.content,
          }] : []
        }
      ]
    };

    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(payloadBody),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errorDetail = errText;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.ErrorMessage) {
          errorDetail = `${parsed.ErrorMessage} (ErrorCode: ${parsed.ErrorCode})`;
        } else if (parsed.Messages && Array.isArray(parsed.Messages)) {
          const errors = parsed.Messages.flatMap((m: any) => m.Errors || [])
            .map((e: any) => `${e.ErrorMessage} (Code: ${e.ErrorCode})`)
            .join("; ");
          if (errors) {
            errorDetail = errors;
          }
        }
      } catch (e) {
        // Fallback to raw text
      }
      throw new Error(errorDetail || `Mailjet error: Status ${response.status}`);
    }

    const data = await response.json();

    // Mailjet v3.1 Send API returns HTTP 200 even if individual messages fail.
    // Check if any message status is "error" and throw a detailed exception.
    if (data && Array.isArray(data.Messages)) {
      const failedMessages = data.Messages.filter((msg: any) => msg.Status === "error");
      if (failedMessages.length > 0) {
        const errorStrings = failedMessages.flatMap((msg: any) => 
          (msg.Errors || []).map((e: any) => `${e.ErrorMessage} (Code: ${e.ErrorCode}, Status: ${e.StatusCode})`)
        );
        const combinedError = errorStrings.join("; ") || "Mailjet message delivery failed internally";
        throw new Error(`Mailjet delivery failed: ${combinedError}`);
      }
    }

    return { success: true, data };
  }

  throw new Error(`Provider ${config.emailProvider} not implemented`);
}
