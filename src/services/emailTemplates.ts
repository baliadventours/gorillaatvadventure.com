import { formatCurrency } from "./email/recipientResolver.js";

export const EMAIL_TEMPLATES: Record<string, { subject: string; body: string; enabled: boolean }> = {
  booking_pending: { 
    subject: "Booking Confirmed! - {{tourTitle}}", 
    body: "Thank you for booking {{tourTitle}}! Your booking status now is Confirmed and your payment status is Pending.", 
    enabled: true 
  },
  booking_confirmed: { 
    subject: "Booking Confirmed! - {{tourTitle}}", 
    body: "Great news! Your booking for {{tourTitle}} with Bali Adventours is confirmed. We can't wait to show you the best of Bali!{{supplierInfo}}{{supplierContactConfirmed}}", 
    enabled: true 
  },
  booking_status_confirmed: {
    subject: "Booking Confirmed! - {{tourTitle}}",
    body: "Great news! Your booking status for {{tourTitle}} has been updated from Pending to <strong>Confirmed</strong>. Below are your travel details and ticket voucher.{{supplierInfo}}{{supplierContactConfirmed}}",
    enabled: true
  },
  booking_change_request: {
    subject: "Booking Change Request Submitted - #{{bookingId}}",
    body: "We have received your requested changes (date, participants, and/or add-ons) for your tour {{tourTitle}}. Your booking status is currently <strong>Review Required</strong> while our team validates schedule and guide availability. We will notify you once approved!{{supplierInfo}}",
    enabled: true
  },
  booking_change_approved: {
    subject: "Booking Request Approved! - #{{bookingId}}",
    body: "Your booking change request for {{tourTitle}} has been successfully approved! Please find your updated itinerary below.{{supplierInfo}}{{supplierContactConfirmed}}",
    enabled: true
  },
  booking_cancellation_request: {
    subject: "Booking Cancellation Request - #{{bookingId}}",
    body: "Your cancellation request for {{tourTitle}} has been registered. Our team is currently reviewing the request in accordance with our terms of service, and we'll follow up shortly.{{supplierInfo}}",
    enabled: true
  },
  booking_cancelled: { 
    subject: "Booking Cancelled - #{{bookingId}}", 
    body: `We wanted to let you know that your booking has been successfully cancelled.<br><br>If you’ve already made a payment, any applicable refund will be processed according to our cancellation policy. You’ll receive a separate confirmation once the refund has been completed.<br><br>We understand that plans can change. If you’d like to reschedule your tour or explore other options, we’d be happy to help.<br><br>You can:<br>• Reply directly to this email<br>• Contact us on WhatsApp: <a href='{{whatsappLink}}' style='color: #0055ff; text-decoration: underline;'>{{supportPhone}}</a><br><br>We hope to welcome you on another tour soon.<br><br>Warm regards,<br>{{siteName}}<br>{{appUrl}}`,
    enabled: true
  },
  guide_assigned: { 
    subject: "Your Guide is Assigned! - {{tourTitle}}", 
    body: "We've assigned a guide for your upcoming tour! You can see your guide's details below and contact them directly via WhatsApp for any further discussion.", 
    enabled: true 
  },
  tour_completed_review_request: {
    subject: "Tour Completed! Thank You and Share Your Experience! - {{tourTitle}}",
    body: "Thank you for completing your tour with {{siteName}}! We hope you had a spectacular adventure. Your feedback means everything to us. Please take 1 minute to leave us your reviews and rate your experience! Thank you again!{{supplierInfo}}",
    enabled: true
  },
  test: {
    subject: "Test Email - Bali AdvenTours",
    body: "System check completed successfully.",
    enabled: true
  },

  // ADMIN Notification Templates
  admin_new_booking: { 
    subject: "[Admin] New Booking Alert: #{{bookingId}} - {{tourTitle}}", 
    body: "<strong>New Booking Alert!</strong><br><br>A new booking has been logged on the platform.<br><br>Status: <strong>{{status}}</strong><br>Lead Guest: {{customerName}} (Nationality: {{nationality}}, Phone: {{phone}})", 
    enabled: true 
  },
  admin_booking_confirmed: {
    subject: "[Admin] Booking Confirmed: #{{bookingId}}",
    body: "<strong>Booking Confirmed by Admin</strong><br><br>Booking Reference #{{bookingId}} has been successfully updated to <strong>Confirmed</strong>.<br><br><strong>Details:</strong><br>Lead Guest: {{customerName}}<br>Tour: {{tourTitle}}<br>Operator Partner: {{supplierName}}<br><br>The client has been notified.",
    enabled: true
  },
  admin_booking_change_request: {
    subject: "[Admin] New Booking Change Request: #{{bookingId}}",
    body: "<strong>Booking Change Request Received</strong><br><br>Customer {{customerName}} has proposed an update to Booking #{{bookingId}} (Date, Participants, or Add-ons).<br><br><strong>Proposed Tour Details:</strong><br>Tour: {{tourTitle}}<br>New Date: {{date}}<br>New Time: {{time}}<br>New Total: {{totalAmount}}<br><br>Please check the admin console dashboard to review and approve these changes.",
    enabled: true
  },
  admin_booking_change_approved: {
    subject: "[Admin] Booking Change Approved: #{{bookingId}}",
    body: "<strong>Booking Change Approved</strong><br><br>Proposed modifications for booking #{{bookingId}} have been successfully approved and confirmed in the database.",
    enabled: true
  },
  admin_booking_cancellation_request: {
    subject: "[Admin] Booking Cancellation Request: #{{bookingId}}",
    body: "<strong>Booking Cancellation Request Received</strong><br><br>Lead Guest {{customerName}} has requested a cancellation for Booking #{{bookingId}}.<br><br>Please review and confirm this request via the Admin console dashboard.",
    enabled: true
  },
  admin_booking_cancellation_approved: {
    subject: "[Admin] Booking Cancellation Approved: #{{bookingId}}",
    body: "<strong>Booking Cancellation Approved</strong><br><br>Cancellation for booking #{{bookingId}} has been approved by the Admin and the supplier has been notified.",
    enabled: true
  },
  admin_booking_completed: {
    subject: "[Admin] Tour Booking Completed: #{{bookingId}}",
    body: "<strong>Booking Tour Completed Successfully</strong><br><br>Booking Reference #{{bookingId}} ({{tourTitle}}) has been completed.",
    enabled: true
  },

  // SUPPLIER Notification Templates
  supplier_new_booking: { 
    subject: "[Supplier] New Booking Notification: #{{bookingId}} - {{tourTitle}}", 
    body: "Hello {{supplierName}},<br><br>You have received a new booking for your tour '{{tourTitle}}'. Please review the booking summary below and prepare for the passenger's arrival.<br><br><strong>Booking Summary:</strong><br>Reference: #{{bookingId}}<br>Customer: {{customerName}}<br>Date: {{date}}<br>Guests: {{guests}}<br><br><strong>Financial Details:</strong><br>Total Customer Paid: {{totalAmount}}<br>Commission to pay: ({{commissionRate}}%) {{supplierCommission}}<br>Net earnings you will receive: {{supplierEarnings}}", 
    enabled: true 
  },
  supplier_booking_confirmed: {
    subject: "[Supplier] Booking Confirmed: #{{bookingId}} - {{tourTitle}}",
    body: "Hello {{supplierName}},<br><br>We are writing to confirm that Booking Reference #{{bookingId}} for '{{tourTitle}}' is now fully confirmed.<br><br><strong>Confirmed Flight/Schedule Details:</strong><br>Date: {{date}}<br>Time Slot: {{time}}<br>Lead Passenger: {{customerName}}<br>Guests: {{guests}}<br><br>Please proceed with standard logistics preparations.",
    enabled: true
  },
  supplier_booking_change_request: {
    subject: "[Supplier] Booking Change Proposed (Pending Review): #{{bookingId}} - {{tourTitle}}",
    body: "Hello {{supplierName}},<br><br>A schedule or participant change has been proposed for Booking #{{bookingId}} ('{{tourTitle}}'). We are currently reviewing the request. Please hold on further logistics arrangements for this booking until approved.<br><br><strong>Proposed New Schedule:</strong><br>New Proposed Date: {{date}}<br>New Proposed Time Slot: {{time}}<br>Guests: {{guests}}",
    enabled: true
  },
  supplier_booking_change_approved: {
    subject: "[Supplier] Booking Change Approved: #{{bookingId}} - {{tourTitle}}",
    body: "Hello {{supplierName}},<br><br>Great news! The proposed modifications for Booking #{{bookingId}} ('{{tourTitle}}') have been approved.<br><br><strong>Updated Schedule and Guest Information:</strong><br>Approved Date: {{date}}<br>Approved Time Slot: {{time}}<br>Guests: {{guests}}<br><br>Please update your operational records.",
    enabled: true
  },
  supplier_booking_cancellation_request: {
    subject: "[Supplier] Cancel Request Received: #{{bookingId}} - {{tourTitle}}",
    body: "Hello {{supplierName}},<br><br>A cancellation request has been registered for Booking #{{bookingId}} ('{{tourTitle}}'). We are confirming details with the super administrator and will advise on approval shortly.",
    enabled: true
  },
  supplier_booking_cancellation_approved: {
    subject: "[Supplier] Booking Cancelled: #{{bookingId}} - {{tourTitle}}",
    body: "Hello {{supplierName}},<br><br>Please be advised that the booking for '{{tourTitle}}' reference #{{bookingId}} has been cancelled and approved.<br><br><strong>Cancelled Booking Details:</strong><br>Reference: #{{bookingId}}<br>Customer: {{customerName}}<br>Date: {{date}}<br><br>Your time slot is now available. No further action is required.",
    enabled: true
  },
  supplier_booking_completed: {
    subject: "[Supplier] Booking Tour Completed: #{{bookingId}} - {{tourTitle}}",
    body: "Hello {{supplierName}},<br><br>Booking Reference #{{bookingId}} ('{{tourTitle}}') has been successfully marked as completed. Thank you for your partnership and service!",
    enabled: true
  },

  // Legacy fallback templates matching original structures
  booking_changed: { 
    subject: "Trip Update Proposed - #{{bookingId}}", 
    body: "You've successfully proposed changes to your trip for {{tourTitle}}. Your current status is now <strong>Review Required</strong>. An admin will review your changes shortly and confirm once approved. Any price difference will be handled accordingly.<br><br>{{supplierInfo}}", 
    enabled: true 
  },
  booking_updated_by_admin: { 
    subject: "Trip Updated by Staff - #{{bookingId}}", 
    body: "Your trip has been successfully updated by our staff. Please find the updated journey details below. If you have any further questions or notice any discrepancies, please contact us immediately.<br><br>{{supplierInfo}}", 
    enabled: true 
  },
  booking_status_updated: { 
    subject: "Booking Update - #{{bookingId}}", 
    body: "Your booking for {{tourTitle}} has been updated with new details. Status: {{status}}. Please review the summary below.<br><br>{{supplierInfo}}", 
    enabled: true 
  },
  booking_date_changed: { 
    subject: "Tour Date Changed - #{{bookingId}}", 
    body: "The date for your tour {{tourTitle}} has been updated to {{date}}. Please check the new schedule below.", 
    enabled: true 
  },
  booking_payment_received: { 
    subject: "Payment Received! - #{{bookingId}}", 
    body: "We've received and verified your payment for #{{bookingId}}. Thank you! Your adventure is fully secured.", 
    enabled: true 
  },
  payment_received: { 
    subject: 'Payment Received - {{tourTitle}}', 
    body: '<p>We have received your payment of {{totalAmount}}.</p>', 
    enabled: true 
  },
  payment_failed: { 
    subject: 'Payment Failed - {{tourTitle}}', 
    body: '<p>Unfortunately, your payment for {{tourTitle}} failed.</p>', 
    enabled: true 
  },
  review_request: { 
    subject: 'Share your experience!', 
    body: '<p>How was your trip to {{tourTitle}}?</p>', 
    enabled: true 
  },
  trip_plan: {
    subject: "Your Bali Trip Plan: {{planTitle}}",
    body: "{{summary}}<br><br>{{planContent}}",
    enabled: true
  }
};

export const emailBaseTemplate = (title: string, subtitle: string, content: string, siteSettings?: any, bookingId?: string) => {
  const primaryColor = siteSettings?.primaryColor || '#00A651';
  const siteName = siteSettings?.siteName || 'Bali Adventours';
  
  const defaultLogo = 'https://www.image2url.com/r2/default/images/1783414314313-8554640b-4bf3-4e31-9329-a8ac6143a6ed.png';
  let logo = siteSettings?.logo || defaultLogo;

  // If the logo setting is empty, default, or uses an internal restricted upload path, use the stable public image URL.
  if (
    !siteSettings?.logo || 
    siteSettings.logo === '/logo.png' || 
    siteSettings.logo === '' || 
    siteSettings.logo.includes('/uploads') || 
    siteSettings.logo.includes('/api/uploads')
  ) {
    logo = defaultLogo;
  }
  // Resolve relative logo URL to an absolute URL for email clients
  if (logo && logo.startsWith('/')) {
    let appUrl = process.env.VITE_APP_URL || process.env.APP_URL || '';
    if (!appUrl || appUrl.includes("baliadventours.com")) {
      appUrl = "https://gorillaatvadventure.com"; // Default fallback / override
    }
    if (!appUrl.startsWith("http")) appUrl = "https://" + appUrl;
    appUrl = appUrl.replace(/\/$/, "");
    logo = `${appUrl}${logo}`;
  }

  const supportEmail = siteSettings?.supportEmail || 'info@gorillaatvadventure.com';
  const supportPhone = siteSettings?.supportPhone || '+62 812-3456-7890';

  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        @media only screen and (max-width: 600px) {
            .container { width: 100% !important; border-radius: 0 !important; }
            .header-td { padding: 30px 20px !important; }
            .content-td { padding: 30px 20px !important; }
            .footer-td { padding: 0 20px 30px !important; }
            .title-text { font-size: 20px !important; }
        }
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f8fafc;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <!-- Logo -->
                <div style="margin-bottom: 25px; text-align: center;">
                    ${logo ? `
                        <img src="${logo}" alt="${siteName}" style="max-height: 60px; display: inline-block; margin: 0 auto;" />
                    ` : `
                        <div style="color: #0f172a; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; text-transform: uppercase;">${siteName}</div>
                    `}
                </div>

                <!-- Main Card -->
                <table class="container" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
                    <!-- Minimal Header -->
                    <tr>
                        <td class="header-td" style="padding: 40px 40px 30px; border-bottom: 1px solid #f1f5f9;">
                            <table width="100%" border="0" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td valign="middle">
                                        <div style="width: 35px; height: 3px; background-color: #00A651; margin-bottom: 12px; border-radius: 2px;"></div>
                                        <div class="title-text" style="font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.1; margin-bottom: 6px; text-transform: uppercase; letter-spacing: -0.5px;">${title}</div>
                                        <div style="font-size: 13px; font-weight: 500; color: #64748b;">${subtitle}</div>
                                    </td>
                                    ${bookingId ? `
                                    <td align="right" valign="top" style="text-align: right; white-space: nowrap;">
                                        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Reference</div>
                                        <div style="font-size: 16px; font-weight: 800; color: #00A651; letter-spacing: 0.5px;">#${bookingId}</div>
                                    </td>
                                    ` : ''}
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td class="content-td" style="padding: 40px;">
                            ${content}
                        </td>
                    </tr>
                    
                    <!-- Minimal Footer -->
                    <tr>
                        <td class="footer-td" style="padding: 0 40px 40px;">
                            <div style="text-align: center; border-top: 1px solid #f1f5f9; padding-top: 30px;">
                                <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">Customer Support</div>
                                <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.6; font-weight: 600;">
                                    <a href="mailto:${supportEmail}" style="color: #00A651; text-decoration: none;">${supportEmail}</a>
                                    <span style="color: #cbd5e1; margin: 0 8px;">|</span>
                                    <a href="https://wa.me/${supportPhone.replace(/\D/g, '')}" style="color: #00A651; text-decoration: none;">${supportPhone}</a>
                                </p>
                            </div>
                        </td>
                    </tr>
                </table>

                <!-- Bottom Copyright -->
                <div style="padding: 30px 20px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
                        &copy; ${new Date().getFullYear()} ${siteName}. Your Bali Travel Partner.
                    </p>
                </div>
            </td>
        </tr>
    </table>
</body>
</html>
  `;
};

export const bookingDetailsSection = (booking: any, siteSettings?: any, isAdmin: boolean = false, options: { showImportantNote?: boolean; showVoucher?: boolean } = {}) => {
  const primaryColor = siteSettings?.primaryColor || '#00A651';

  // Helper formatting functions
  const getShortDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      }
    } catch (e) {}
    return dateStr;
  };

  const getGuestsText = (b: any) => {
    const p = b?.participants || { adults: 0, children: 0 };
    const adultsStr = `${p.adults || 0} Adults`;
    const childrenStr = p.children > 0 ? `, ${p.children} Children` : "";
    return adultsStr + childrenStr;
  };

  const getPhoneLabel = (b: any) => {
    const rawPhone = b?.customerData?.phone || "N/A";
    if (rawPhone !== "N/A" && !rawPhone.toLowerCase().includes("whatsapp")) {
      return `WhatsApp: ${rawPhone}`;
    }
    return rawPhone;
  };

  const getTransportOptionLabel = (b: any) => {
    if (!b?.selectedTransport) return "Own Transport (Meet on location)";
    const t = b.selectedTransport;
    if (t.type === 'meet') {
      return "Own Transport (Meet on location)";
    }
    if (t.type === 'private') {
      return `Private Transport (${t.carType || t.name || 'Car'})`;
    }
    if (t.type === 'shared') {
      return `Shared Shuttle / Transport (${t.name || 'Shuttle'})`;
    }
    return t.name || "N/A";
  };

  // Format helper variables
  const tourTitle = booking?.tourTitle || "Selected Tour";
  const packageName = booking?.packageName || "Selected Package";
  const bookingId = booking?.id?.substring(0, 8).toUpperCase() || "N/A";
  const shortDate = getShortDate(booking?.date);
  const time = booking?.time || "10:00";
  const guests = getGuestsText(booking);
  const customerName = booking?.customerData?.fullName || "Guest";
  const email = booking?.customerData?.email || "N/A";
  const phone = getPhoneLabel(booking);
  const transportOption = getTransportOptionLabel(booking);
  
  const parseMeetingPointForEmail = (text: string | null | undefined) => {
    const defaultVenue = "Gorilla ATV Adventure";
    const defaultAddress = "Jl. Raya Payangan No.199, Puhu, Kec. Payangan, Kabupaten Gianyar, Bali 80572";
    const defaultUrl = "https://maps.app.goo.gl/nM2C85Qdv4BQ4BgE6";

    if (!text) {
      return { venue: defaultVenue, address: defaultAddress, url: defaultUrl };
    }

    const cleanText = text.trim();
    if (
      cleanText === "" ||
      cleanText.toLowerCase().includes("meet directly at our") ||
      cleanText.toLowerCase().includes("meet directly at main") ||
      cleanText.toLowerCase().includes("meet directly at the") ||
      cleanText.toLowerCase().includes("adventure basecamp") ||
      cleanText.toLowerCase().includes("operation basecamp") ||
      cleanText.toLowerCase().includes("operation center")
    ) {
      return { venue: defaultVenue, address: defaultAddress, url: defaultUrl };
    }

    // Extract URL if any
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = cleanText.match(urlRegex);
    const url = match ? match[0] : null;

    // Remove URL from text
    let remaining = cleanText.replace(urlRegex, "").trim();
    remaining = remaining.replace(/^[\s\-,.:;]+|[\s\-,.:;]+$/g, "").trim();

    if (!remaining) {
      if (url && url.includes("nM2C85Qdv4BQ4BgE6")) {
        return {
          venue: defaultVenue,
          address: defaultAddress,
          url: url
        };
      }
      return {
        venue: "Google Maps Location",
        address: url || "",
        url: url || defaultUrl
      };
    }

    let venue = remaining;
    let address = "";

    const splitters = ["\n", " - ", " – ", " | ", " @ "];
    for (const splitter of splitters) {
      if (remaining.includes(splitter)) {
        const parts = remaining.split(splitter);
        const possibleVenue = parts[0].trim();
        const possibleAddress = parts.slice(1).join(splitter).trim();
        if (possibleVenue && possibleAddress) {
          venue = possibleVenue;
          address = possibleAddress;
          break;
        }
      }
    }

    if (venue === remaining && remaining.includes(",")) {
      const parts = remaining.split(",");
      const possibleVenue = parts[0].trim();
      if (possibleVenue.length < 40 && parts.length > 1) {
        venue = possibleVenue;
        address = parts.slice(1).join(",").trim();
      }
    }

    const finalUrl = url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(remaining)}`;

    return { venue, address, url: finalUrl };
  };

  const rawPickupAddress = booking?.customerData?.pickupAddress || "";
  const isMeetingPoint = !rawPickupAddress || 
    booking?.selectedTransport?.type === 'meet' ||
    transportOption.toLowerCase().includes("own transport") ||
    transportOption.toLowerCase().includes("meet on location") ||
    rawPickupAddress.includes("Meet") || 
    rawPickupAddress.toLowerCase().includes("basecamp") ||
    rawPickupAddress.toLowerCase().includes("operation") ||
    rawPickupAddress.includes("maps.app.goo.gl") ||
    rawPickupAddress.includes("google.com/maps");

  let pickupAddressHtml = "";
  if (isMeetingPoint) {
    const mp = parseMeetingPointForEmail(rawPickupAddress);
    pickupAddressHtml = `
      <div style="font-family: sans-serif; text-align: left;">
        <a href="${mp.url}" target="_blank" style="color: #ea580c; font-weight: 800; text-decoration: underline; font-size: 13px; display: inline-block;">
          ${mp.venue}
        </a>
      </div>
    `;
  } else {
    pickupAddressHtml = `<span style="font-weight: 600; color: #0f172a;">${rawPickupAddress}</span>`;
  }

  const totalAmount = booking ? formatCurrency(booking.totalAmount) : "N/A";

  // Price Detail Breakdown
  let priceRowsHtml = "";
  const pricing = booking?.pricingBreakdown || { adultRate: 0, childRate: 0 };
  const participants = booking?.participants || { adults: 0, children: 0 };

  if (participants.adults > 0) {
    priceRowsHtml += `
      <tr>
        <td style="padding: 8px 0; color: #475569; font-weight: 700; width: 180px; vertical-align: top;">${participants.adults}xadult @${formatCurrency(pricing.adultRate)}</td>
        <td align="right" style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right; vertical-align: top;">${formatCurrency(participants.adults * pricing.adultRate)}</td>
      </tr>
    `;
  }
  if (participants.children > 0) {
    priceRowsHtml += `
      <tr>
        <td style="padding: 8px 0; color: #475569; font-weight: 700; width: 180px; vertical-align: top;">${participants.children}xchild @${formatCurrency(pricing.childRate)}</td>
        <td align="right" style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right; vertical-align: top;">${formatCurrency(participants.children * pricing.childRate)}</td>
      </tr>
    `;
  }

  // Transport
  const transportCost = Number(booking?.transportTotal) || 0;
  const transportStr = transportCost > 0 ? formatCurrency(transportCost) : "-";
  priceRowsHtml += `
    <tr>
      <td style="padding: 8px 0; color: #475569; font-weight: 700; vertical-align: top;">Transport:</td>
      <td align="right" style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right; vertical-align: top;">${transportStr}</td>
    </tr>
  `;

  // Add ons
  let addonsCost = 0;
  const addOnsList = booking?.selectedAddOns || booking?.addOns || [];
  if (Array.isArray(addOnsList) && addOnsList.length > 0) {
    addOnsList.forEach((addon: any) => {
      const qty = Number(addon.quantity) || 1;
      const price = Number(addon.price) || 0;
      addonsCost += price * qty;
    });
  }
  const addonsStr = addonsCost > 0 ? formatCurrency(addonsCost) : "-";
  priceRowsHtml += `
    <tr>
      <td style="padding: 8px 0; color: #475569; font-weight: 700; vertical-align: top;">Add ons:</td>
      <td align="right" style="padding: 8px 0; color: #0f172a; font-weight: 600; text-align: right; vertical-align: top;">${addonsStr}</td>
    </tr>
  `;

  // Discount (if any)
  const discountCost = Number(booking?.discountAmount) || 0;
  if (discountCost > 0) {
    priceRowsHtml += `
      <tr>
        <td style="padding: 8px 0; color: #ef4444; font-weight: 700; vertical-align: top;">Discount (${booking?.couponCode || 'Promo'}):</td>
        <td align="right" style="padding: 8px 0; color: #ef4444; font-weight: 700; text-align: right; vertical-align: top;">-${formatCurrency(discountCost)}</td>
      </tr>
    `;
  }

  // Payment Status Color & Label
  const rawPaymentStatus = booking?.paymentStatus || 'pending';
  const paymentStatusLabel = rawPaymentStatus === 'paid' ? 'Paid' : 'Pending';
  const paymentStatusColor = rawPaymentStatus === 'paid' ? '#00A651' : '#f59e0b';

  // Payment Method Label
  const rawPaymentMethod = booking?.paymentMethod || 'pay_on_arrival';
  const paymentMethodLabel = rawPaymentMethod === 'pay_on_arrival' ? 'Pay on Arrival' :
                             rawPaymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                             rawPaymentMethod === 'credit_card' || rawPaymentMethod === 'cc' ? 'Credit Card' :
                             rawPaymentMethod.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return `
    {{greeting_section}}
    <p style="font-size: 14px; line-height: 1.7; color: #475569; margin-bottom: 35px;">
        {{body}}
    </p>

    <div style="margin-bottom: 40px;">
        <!-- BOOKING DETAILS Section -->
        <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 15px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0;">
            BOOKING DETAILS:
        </div>
        <table width="100%" style="font-size: 13.5px; border-collapse: collapse; margin-bottom: 35px;">
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; width: 180px; vertical-align: top;">Tour:</td>
                <td style="padding: 7px 0; font-weight: 700; color: #00A651; vertical-align: top;">${tourTitle}</td>
            </tr>
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; vertical-align: top;">Package:</td>
                <td style="padding: 7px 0; color: #0f172a; font-weight: 500; vertical-align: top;">${packageName}</td>
            </tr>
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; vertical-align: top;">Booking ID:</td>
                <td style="padding: 7px 0; color: #0f172a; font-weight: 700; vertical-align: top;">#${bookingId}</td>
            </tr>
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; vertical-align: top;">Date:</td>
                <td style="padding: 7px 0; color: #0f172a; font-weight: 500; vertical-align: top;">${shortDate}</td>
            </tr>
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; vertical-align: top;">Time:</td>
                <td style="padding: 7px 0; color: #0f172a; font-weight: 500; vertical-align: top;">${time}</td>
            </tr>
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; vertical-align: top;">No of participant:</td>
                <td style="padding: 7px 0; color: #0f172a; font-weight: 700; vertical-align: top;">${guests}</td>
            </tr>
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; vertical-align: top;">Main Customer:</td>
                <td style="padding: 7px 0; color: #0f172a; font-weight: 700; vertical-align: top;">${customerName}</td>
            </tr>
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; vertical-align: top;">Email:</td>
                <td style="padding: 7px 0; color: #0055ff; text-decoration: underline; vertical-align: top;">${email}</td>
            </tr>
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; vertical-align: top;">Phone:</td>
                <td style="padding: 7px 0; color: #0f172a; font-weight: 500; vertical-align: top;">${phone}</td>
            </tr>
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; vertical-align: top;">Transportation option:</td>
                <td style="padding: 7px 0; color: #0f172a; font-weight: 500; vertical-align: top;">${transportOption}</td>
            </tr>
            <tr>
                <td style="padding: 7px 0; color: #475569; font-weight: 700; vertical-align: top;">${isMeetingPoint ? 'Meeting Point:' : 'Pick up address:'}</td>
                <td style="padding: 7px 0; color: #0f172a; font-weight: 500; vertical-align: top;">${pickupAddressHtml}</td>
            </tr>
            ${isAdmin ? '' : `{{guideRow}}`}
        </table>

        <!-- PRICE DETAIL Section -->
        <div style="font-size: 12px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 15px; padding-bottom: 6px; border-bottom: 2px solid #e2e8f0;">
            Price Detail:
        </div>
        <table width="100%" style="font-size: 13.5px; border-collapse: collapse; margin-bottom: 35px;">
            ${priceRowsHtml}
            <tr style="border-top: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #475569; font-weight: 700; vertical-align: top;">Total:</td>
                <td align="right" style="padding: 10px 0; font-weight: 800; color: #00A651; font-size: 18px; text-align: right; vertical-align: top;">${totalAmount}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #475569; font-weight: 700; vertical-align: top;">Payment status:</td>
                <td align="right" style="padding: 8px 0; font-weight: 700; color: ${paymentStatusColor}; text-align: right; vertical-align: top;">${paymentStatusLabel}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #475569; font-weight: 700; vertical-align: top;">Payment method:</td>
                <td align="right" style="padding: 8px 0; color: #0f172a; font-weight: 500; text-align: right; vertical-align: top;">${paymentMethodLabel}</td>
            </tr>
        </table>
    </div>

    <!-- Centered View Booking Button -->
    <div style="text-align: center; margin: 35px 0 45px;">
        <a href="{{viewBookingUrl}}" style="display: inline-block; background-color: #00A651; color: #ffffff; padding: 12px 30px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.15);">
            View Booking Details
        </a>
    </div>

    ${isAdmin ? "" : `
    {{paymentInstructions}}

    <!-- Minimal Voucher (Confirmed Only) -->
    ${options.showVoucher ? `
    <div style="margin-top: 50px; padding: 40px; border: 1px solid #00A651; position: relative;">
        <div style="position: absolute; top: -10px; left: 20px; background: #ffffff; padding: 0 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #00A651;">Voucher</div>
        
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
            <tr>
                <td valign="top">
                    <div style="font-size: 22px; font-weight: 800; color: #0f172a; margin-bottom: 5px;">${tourTitle}</div>
                    <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 25px; text-transform: uppercase;">${packageName}</div>
                    
                    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px;">
                        <tr>
                            <td style="padding-bottom: 15px; color: #64748b;">Trip Date: <strong>${shortDate}</strong></td>
                        </tr>
                        <tr>
                            <td style="padding-bottom: 15px; color: #64748b;">Time Slot: <strong>${time}</strong></td>
                        </tr>
                        <tr>
                            <td style="padding-bottom: 15px; color: #64748b;">Lead Guest: <strong>${customerName}</strong></td>
                        </tr>
                    </table>
                </td>
                <td width="100" align="right" valign="top">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://gorillaatvadventure.com/admin/booking/${booking?.id}" width="90" height="90" style="display: block; border: 1px solid #f1f5f9;" />
                    <div style="font-size: 9px; font-weight: 700; color: #94a3b8; margin-top: 8px; text-transform: uppercase;">#${bookingId}</div>
                </td>
            </tr>
        </table>
    </div>
    ` : ''}
    
    ${options.showImportantNote ? `
    <div style="margin-top: 30px; padding: 20px; border-left: 2px solid #f59e0b; background-color: #fffbeb;">
        <div style="font-weight: 700; font-size: 14px; color: #92400e; margin-bottom: 4px;">Important Note</div>
        <div style="font-size: 13px; color: #b45309; line-height: 1.6;">
            Our team will contact you via WhatsApp for final coordination. Please ensure your contact details are correct.
        </div>
    </div>
    ` : ''}
    `}
  `;
};

