import axios from 'axios';

interface WhatsAppPayload {
  number: string;
  message: string;
  file?: string;
  filename?: string;
}

async function raceToSuccess<T>(promises: Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let rejectedCount = 0;
    const errors: any[] = [];
    
    if (promises.length === 0) {
      reject(new Error("No endpoints configured to send message."));
      return;
    }
    
    promises.forEach((p, idx) => {
      p.then((val) => {
        resolve(val);
      }).catch((err) => {
        let errDetails = err.message || 'Unknown error';
        if (err.response) {
          const status = err.response.status;
          const statusText = err.response.statusText;
          const data = typeof err.response.data === 'object' 
            ? JSON.stringify(err.response.data) 
            : String(err.response.data);
          errDetails = `HTTP ${status} (${statusText}): ${data.slice(0, 150)}`;
        }
        errors[idx] = errDetails;
        rejectedCount++;
        if (rejectedCount === promises.length) {
          // Compile all error messages elegantly
          const combinedMsg = errors
            .map((e, i) => `Attempt #${i + 1}: ${e}`)
            .join(' | ');
          reject(new Error(combinedMsg));
        }
      });
    });
  });
}

/**
 * Sends a WhatsApp message via WhatsApp Business API (WABA) Cloud API
 */
export async function sendWabaMessage(
  payload: WhatsAppPayload,
  config: {
    accessToken?: string;
    phoneNumberId?: string;
    templateName?: string;
    languageCode?: string;
    booking?: any;
    type?: string;
  }
) {
  const token = config.accessToken || process.env.WABA_ACCESS_TOKEN;
  const phoneNumberId = config.phoneNumberId || process.env.WABA_PHONE_NUMBER_ID;
  
  if (!token || !phoneNumberId) {
    console.warn("[WhatsApp WABA] Access Token or Phone Number ID is missing.");
    return { success: false, error: 'WABA configuration missing. Access Token and Phone Number ID are required.' };
  }

  // Format phone number to E.164 digits-only format required by Meta (without +)
  const parts = payload.number.split('@');
  let rawNumber = parts[0];
  let digitsOnly = rawNumber.replace(/\D/g, '');
  if (digitsOnly.startsWith('620')) {
    digitsOnly = '62' + digitsOnly.slice(3);
  } else if (digitsOnly.startsWith('0')) {
    digitsOnly = '62' + digitsOnly.slice(1);
  } else if (digitsOnly.startsWith('8')) {
    digitsOnly = '62' + digitsOnly;
  }

  const url = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // Build the message data
  let data: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: digitsOnly
  };

  // Check if we should use WABA Template messaging (critical for business initiated, like booking confirmations)
  if (config.templateName) {
    const parameters: any[] = [];
    
    // We add the full custom message as the 1st parameter to support "Universal 1-Variable Templates"
    parameters.push({ type: 'text', text: payload.message });
    
    // Standard backup parameters for multi-variable templates
    if (config.booking) {
      parameters.push({ type: 'text', text: config.booking.customerData?.fullName || 'Customer' });
      parameters.push({ type: 'text', text: config.booking.tourTitle || '' });
      parameters.push({ type: 'text', text: config.booking.date || '' });
      parameters.push({ type: 'text', text: config.booking.time || config.booking.timeSlot || '' });
      parameters.push({ type: 'text', text: config.booking.totalAmount?.toString() || '0' });
      parameters.push({ type: 'text', text: config.booking.id || '' });
    }

    data.type = "template";
    data.template = {
      name: config.templateName,
      language: {
        code: config.languageCode || 'id'
      },
      components: [
        {
          type: "body",
          parameters: parameters
        }
      ]
    };
  } else {
    // Standard text message for user-initiated chats / custom messages
    data.type = "text";
    data.text = {
      preview_url: false,
      body: payload.message
    };
  }

  try {
    console.log(`[WhatsApp WABA] Sending to ${digitsOnly} via ${config.templateName ? 'template: ' + config.templateName : 'text message'}`);
    const response = await axios.post(url, data, { headers, timeout: 8000 });
    return { success: true, provider: 'waba', data: response.data };
  } catch (err: any) {
    let errMsg = err.message || 'Unknown error';
    if (err.response && err.response.data) {
      errMsg = typeof err.response.data === 'object' 
        ? JSON.stringify(err.response.data) 
        : String(err.response.data);
    }
    console.error(`[WhatsApp WABA Error]:`, errMsg);
    return { success: false, error: `WhatsApp WABA failed: ${errMsg}` };
  }
}

/**
 * Sends a WhatsApp message via OpenWA (wa-automate) API or WABA Cloud API
 */
export async function sendWhatsAppMessage(
  payload: WhatsAppPayload, 
  tokenOverride?: string, 
  baseUrlOverride?: string, 
  sessionId?: string,
  providerOverride?: 'openwa' | 'waba' | 'whapi',
  wabaConfig?: {
    accessToken?: string;
    phoneNumberId?: string;
    templateName?: string;
    languageCode?: string;
    booking?: any;
    type?: string;
  }
) {
  if (providerOverride === 'waba') {
    return sendWabaMessage(payload, wabaConfig || {});
  }

  // Load OpenWA API key from parameter or environment
  const token = tokenOverride || process.env.OPENWA_API_KEY;
  
  if (!token) {
    console.warn(`[WhatsApp] OpenWA API token is not configured. Skipping message.`);
    return { success: false, error: 'WhatsApp configuration missing. Please supply a valid OpenWA API Key.' };
  }

  // Format number to digits-only supporting potential JIDs
  const parts = payload.number.split('@');
  let rawNumber = parts[0];
  let digitsOnly = rawNumber.replace(/\D/g, '');
  if (digitsOnly.startsWith('620')) {
    digitsOnly = '62' + digitsOnly.slice(3);
  } else if (digitsOnly.startsWith('0')) {
    digitsOnly = '62' + digitsOnly.slice(1);
  } else if (digitsOnly.startsWith('8')) {
    digitsOnly = '62' + digitsOnly;
  }

  // ---- OpenWA (wa-automate) Integration ----
  const baseUrl = baseUrlOverride || process.env.OPENWA_BASE_URL || 'https://openwa-dashboard-production-b24e.up.railway.app';
  const session = sessionId || 'baliadventours';
  const chatID = parts.length > 1 ? `${digitsOnly}@${parts[1]}` : `${digitsOnly}@c.us`;

  const cleanToken = token.replace('Bearer ', '').trim();
  
  // Resolve session UUID if a friendly session name was provided
  let resolvedSessionId = session;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(session)) {
    try {
      const listRes = await axios.get(`${baseUrl.replace(/\/$/, '')}/api/sessions`, {
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'X-API-Key': cleanToken,
          'X-Api-Key': cleanToken,
          'api-key': cleanToken
        },
        timeout: 3000
      });
      if (Array.isArray(listRes.data)) {
        const found = listRes.data.find((s: any) => s.name === session || s.id === session);
        if (found && found.id) {
          resolvedSessionId = found.id;
          console.log(`[WhatsApp] Dynamically resolved session name "${session}" to server UUID: ${resolvedSessionId}`);
        }
      }
    } catch (resolveErr: any) {
      console.warn(`[WhatsApp] Failed to dynamically resolve session name "${session}":`, resolveErr.message);
    }
  }

  // Modern OpenWA servers can check headers for auth key. We unify headers so a single 
  // concurrent request tests multiple authentication styles at the same time!
  const unifiedHeaders = {
    'Authorization': `Bearer ${cleanToken}`,
    'X-API-Key': cleanToken,
    'X-Api-Key': cleanToken,
    'api-key': cleanToken,
    'X-Session-ID': resolvedSessionId,
    'X-Session-Id': resolvedSessionId,
    'session': resolvedSessionId,
    'Content-Type': 'application/json'
  };

  const fileData = payload.file;
  const filename = payload.filename || 'document.pdf';
  const caption = payload.message || '';

  // Format configurations pairing target URLs with matching request payloads
  const candidates = fileData ? [
    // --- SEND FILE ENDPOINTS ---
    // 1. Resolved Session UUID send-file (HIGHEST SUCCESS PROBABILITY)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/sessions/${resolvedSessionId}/messages/send-file`,
      payload: { chatId: chatID, file: fileData, filename: filename, caption: caption }
    },
    // 2. Official send-file (NAME)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/sessions/${session}/messages/send-file`,
      payload: { chatId: chatID, file: fileData, filename: filename, caption: caption }
    },
    // 3. Legacy sendFile format #1 (UUID)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/${resolvedSessionId}/sendFile`,
      payload: { to: chatID, file: fileData, filename: filename, caption: caption }
    },
    // 4. Legacy sendFile format #1 (NAME)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/${session}/sendFile`,
      payload: { to: chatID, file: fileData, filename: filename, caption: caption }
    },
    // 5. Legacy sendFile format #2 (UUID)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/${resolvedSessionId}/sendFile`,
      payload: { chatId: chatID, file: fileData, filename: filename, caption: caption }
    },
    // 6. Legacy sendFile format #2 (NAME)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/${session}/sendFile`,
      payload: { chatId: chatID, file: fileData, filename: filename, caption: caption }
    },
    // 7. Sessionless sendFile format #1
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/sendFile`,
      payload: { to: chatID, file: fileData, filename: filename, caption: caption }
    },
    // 8. Sessionless sendFile format #2
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/sendFile`,
      payload: { chatId: chatID, file: fileData, filename: filename, caption: caption }
    },
    // 9. Root-level sendFile format #1
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/sendFile`,
      payload: { to: chatID, file: fileData, filename: filename, caption: caption }
    },
    // 10. Root-level sendFile format #2
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/sendFile`,
      payload: { chatId: chatID, file: fileData, filename: filename, caption: caption }
    }
  ] : [
    // --- SEND TEXT ENDPOINTS ---
    // 1. Resolved Session UUID Message Send Endpoint (HIGHEST SUCCESS PROBABILITY)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/sessions/${resolvedSessionId}/messages/send-text`,
      payload: { chatId: chatID, text: payload.message }
    },
    // 2. Official Documented OpenWA REST Gateway Message Send Endpoint (NAME)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/sessions/${session}/messages/send-text`,
      payload: { chatId: chatID, text: payload.message }
    },
    // 3. High-probability legacy format #1 (UUID)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/${resolvedSessionId}/sendText`,
      payload: { to: chatID, message: payload.message }
    },
    // 4. High-probability legacy format #1 (NAME)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/${session}/sendText`,
      payload: { to: chatID, message: payload.message }
    },
    // 5. High-probability legacy format #2 (UUID)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/${resolvedSessionId}/sendText`,
      payload: { chatId: chatID, text: payload.message }
    },
    // 6. High-probability legacy format #2 (NAME)
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/${session}/sendText`,
      payload: { chatId: chatID, text: payload.message }
    },
    // 7. Sessionless / Direct sendText format #1
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/sendText`,
      payload: { to: chatID, message: payload.message }
    },
    // 8. Sessionless / Direct sendText format #2
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/api/sendText`,
      payload: { chatId: chatID, text: payload.message }
    },
    // 9. Root-level sendText format #1
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/sendText`,
      payload: { to: chatID, message: payload.message }
    },
    // 10. Root-level sendText format #2
    {
      endpoint: `${baseUrl.replace(/\/$/, '')}/sendText`,
      payload: { chatId: chatID, text: payload.message }
    }
  ];

  console.log(`[WhatsApp] Dispatching to OpenWA (${session}) concurrently via ${candidates.length} variations to prevent Vercel timeouts.`);

  // Map all combinations to a collection of concurrent promises
  const promises: Promise<{ endpoint: string; data: any }>[] = candidates.map(candidate => {
    return (async () => {
      const response = await axios.post(candidate.endpoint, candidate.payload, {
        headers: unifiedHeaders,
        timeout: 4500 // Expanded slightly to ensure network reliability
      });
      const data = response.data;
      if (response.status === 200 || response.status === 201) {
        // Check success formats
        if (data && (data.success !== false || data.id || data.messageId || data.status === 'success' || data.result)) {
          return { endpoint: candidate.endpoint, data };
        }
      }
      throw new Error(`Non-success payload returned from ${candidate.endpoint}`);
    })();
  });

  try {
    const winner = await raceToSuccess(promises);
    console.log(`[WhatsApp] OpenWA SUCCESS via endpoint: ${winner.endpoint}`);
    return { success: true, provider: 'openwa', data: winner.data };
  } catch (raceErr: any) {
    console.error('[WhatsApp] All OpenWA parallel attempts failed:', raceErr.message);
    return { 
      success: false, 
      error: `All (${promises.length}) OpenWA endpoints failed. Ensure instance (${baseUrl}) is online and session "${session}" is connected. Errors: ${raceErr.message?.slice(0, 300)}...` 
    };
  }
}

export interface WhatsAppTemplatePayload {
  number: string;
  templateName: string;
  languageCode?: string;
  components: any[];
}

export async function sendWhatsAppTemplateMessage(payload: WhatsAppTemplatePayload, tokenOverride?: string, baseUrlOverride?: string) {
  let text = `Notification: ${payload.templateName}`;
  
  if (payload.components && payload.components.length > 0) {
    const bodyComp = payload.components.find(c => c.type === 'body');
    if (bodyComp && bodyComp.parameters) {
      const params = bodyComp.parameters.map((p: any) => p.text).join(' | ');
      text = `${payload.templateName}: ${params}`;
    }
  }

  return sendWhatsAppMessage({
    number: payload.number,
    message: text
  }, tokenOverride, baseUrlOverride);
}

export function formatWhatsAppMessage(template: string, data: any): string {
  let message = template;
  const placeholders = {
    '{{customerName}}': data?.customerData?.fullName || 'Customer',
    '{{bookingId}}': data?.id || '',
    '{{tourTitle}}': data?.tourTitle || '',
    '{{date}}': data?.date || '',
    '{{time}}': data?.time || data?.timeSlot || '',
    '{{totalAmount}}': data?.totalAmount?.toString() || '0',
    '{{status}}': data?.status || '',
    '{{paymentStatus}}': data?.paymentStatus || '',
    '{{participants}}': `${data?.participants?.adults || 0} Adults, ${data?.participants?.children || 0} Children`
  };

  Object.entries(placeholders).forEach(([key, value]) => {
    message = message.replace(new RegExp(key, 'g'), value);
  });

  return message;
}
