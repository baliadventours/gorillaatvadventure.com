import admin from "firebase-admin";
import { getAdminApp, getAdminDb, safeVerifyIdToken, getDocViaRest } from "./firebaseAdmin.js";
import { emailBaseTemplate, bookingDetailsSection, EMAIL_TEMPLATES } from "./emailTemplates.js";

// Import isolated modular components
import { 
  resolveEmailConfig, 
  resolveSupplierForBooking, 
  formatCurrency, 
  parseCurrency 
} from "./email/recipientResolver.js";
import { generateVoucherPdf } from "./email/voucherGenerator.js";
import { sendEmailViaProvider } from "./email/transporter.js";
import { logEmailAttempt } from "./email/dbLogger.js";

/**
 * Main orchestration function called by server API endpoints to securely send booking, admin, or supplier notifications.
 */
export async function handleSendEmail(reqBody: any, authHeader?: string) {
    let { to: requestedTo, subject: requestedSubject, html: requestedHtml, type, booking, extraInfo } = reqBody;
    let to = requestedTo;
    let subject = requestedSubject;
    let html = requestedHtml;

    console.log(`[Email Handler] START: Processing ${type || 'custom email'} to: ${to}`);
    if (booking) {
      console.log(`[Email Handler] Info: BookingID: ${booking.id}, PaymentMethod: ${booking.paymentMethod}, Status: ${booking.status}`);
    }

    // --- 1. SECURITY CONTROL ---
    getAdminApp(); // Ensure Firebase app is ready
    const db = getAdminDb();

    // Authenticate client user
    const idToken = (authHeader && authHeader.startsWith('Bearer ') && authHeader !== 'Bearer undefined') 
      ? authHeader.split('Bearer ')[1] 
      : null;
    let decodedToken: any = null;

    if (idToken && idToken !== 'null') {
      try {
        decodedToken = await safeVerifyIdToken(idToken);
      } catch (e: any) {
        console.warn("[Email Handler] Auth token verification failed:", e.message || e);
      }
    }

    const rawAdminEmail = (process.env.ADMIN_EMAIL || 'baliadventours@gmail.com').trim().toLowerCase();
    const userEmail = (decodedToken?.email || '').trim().toLowerCase();
    const isRoleAdmin = decodedToken?.role === 'admin' || decodedToken?.admin === true;

    let isAdmin = decodedToken && (userEmail === rawAdminEmail || userEmail === 'admin@tripbone.com' || userEmail === 'kuotabox@gmail.com' || isRoleAdmin);
    let isSupplier = booking && decodedToken && (decodedToken.uid === booking.supplierId || decodedToken.email === booking.supplierEmail) && decodedToken.role === 'supplier';

    // Fallback lookups in database
    if (decodedToken) {
      try {
        let userData: any = null;
        try {
          const userDoc = await db.collection('users').doc(decodedToken.uid).get();
          if (userDoc.exists) {
            userData = userDoc.data();
          }
        } catch (dbErr: any) {
          console.warn("[Email Handler] Admin SDK Firestore user lookup failed, falling back to REST:", dbErr.message || dbErr);
          userData = await getDocViaRest('users', decodedToken.uid, idToken || undefined);
        }

        if (userData) {
          if (!isAdmin && userData.role === 'admin') {
            isAdmin = true;
            console.log(`[Email Handler] Verified admin role from Firestore for UID: ${decodedToken.uid}`);
          }
          if (!isSupplier && userData.role === 'supplier') {
            isSupplier = true;
            console.log(`[Email Handler] Verified supplier role from Firestore for UID: ${decodedToken.uid}`);
          }
        }
      } catch (err: any) {
        console.warn("[Email Handler] Firestore user role lookup skipped or failed:", err.message || err);
      }
    }

    const isOwner = booking && decodedToken && decodedToken.uid === booking.userId;
    const isSelf = decodedToken && decodedToken.email?.toLowerCase() === to?.toLowerCase();

    // Enforce routing security policies
    if (!type) {
      if (!isAdmin && !isSelf) {
        throw new Error("Unauthorized: Generic email sending restricted to admins or oneself.");
      }
    } else if (type === 'trip_plan') {
      if (decodedToken && !isAdmin && !isSelf) {
         console.log(`[Email Handler] Authenticated user ${decodedToken.email} sharing trip plan with ${to}`);
      }
    } else if (type === 'test') {
      if (!isAdmin) {
        let debugMsg = "Unauthorized: Only admins can send test emails.";
        if (!decodedToken) {
          debugMsg += " (No valid decoded token found. Token verification may have failed.)";
        } else {
          debugMsg += ` (Authenticated as ${userEmail || 'unknown_email'} with UID ${decodedToken.uid || 'none'}. Admin role: ${isRoleAdmin}. Target admin: ${rawAdminEmail}.)`;
        }
        throw new Error(debugMsg);
      }
    } else if (booking) {
      const isAnonymousBooking = booking.userId === 'anonymous';
      const guestAllowedTypes = [
        'booking_pending', 'booking_confirmed', 'admin_new_booking', 'booking_changed',
        'supplier_new_booking', 'supplier_booking_cancelled', 'supplier_booking_updated',
        'booking_status_updated', 'booking_status_confirmed', 'booking_change_request',
        'booking_change_approved', 'booking_cancellation_request', 'tour_completed_review_request',
        'admin_booking_confirmed', 'admin_booking_change_request', 'admin_booking_change_approved',
        'admin_booking_cancellation_request', 'admin_booking_cancellation_approved', 'admin_booking_completed',
        'supplier_booking_confirmed', 'supplier_booking_change_request', 'supplier_booking_change_approved',
        'supplier_booking_cancellation_request', 'supplier_booking_cancellation_approved', 'supplier_booking_completed'
      ];
      
      if (!isAdmin && !isOwner && !isSupplier && !(isAnonymousBooking && guestAllowedTypes.includes(type))) {
        throw new Error("Forbidden: You are not authorized to send emails for this booking.");
      }
    } else if (!isAdmin) {
      throw new Error("Unauthorized: Restricted email type.");
    }

    const config = await resolveEmailConfig();
    console.log(`[Email Handler] Provider Config: ${config.emailProvider}, Sender: ${config.senderEmail}`);

    try {
      // Check templates and enable switches
      if (type) {
        const template = EMAIL_TEMPLATES[type];
        if (!template || !template.enabled || config.emailProvider === 'none') {
          const reason = !template ? 'Template not found' : (!template.enabled ? 'Template disabled' : 'Provider not configured');
          console.log(`[Email Handler] SKIPPING: TemplateEnabled=${template?.enabled}, Provider=${config.emailProvider}`);
          
          await logEmailAttempt({
            to: to || "Unknown",
            type: type,
            bookingId: booking?.id || null,
            subject: requestedSubject || template?.subject || "No Subject",
            status: "skipped",
            reason,
            provider: config.emailProvider
          });

          if (!html) return { success: true, skipped: true, reason };
        }

        if (template) {
          subject = template.subject;
          let body = template.body;

          // REFRESH BOOKING DATA (CRITICAL)
          if (booking && booking.id) {
            try {
              const bookingDoc = await db.collection('bookings').doc(booking.id).get();
              if (bookingDoc.exists) {
                const dbBooking = bookingDoc.data();
                booking = { 
                  ...booking, 
                  ...dbBooking,
                  customerData: {
                    ...(booking?.customerData || {}),
                    ...(dbBooking?.customerData || {})
                  }
                };
                console.log(`[Email Handler] Refreshed booking data from DB. Total: ${booking.totalAmount}`);
              }
            } catch (err) {
              console.warn(`[Email Handler] Failed to refresh booking data for ${booking.id}:`, err);
            }
          }

          // Resolve supplier details and custom payouts
          const { supplierName, supplierPhone, supplierEmail, commissionRate: resolvedCommissionRate } = 
            await resolveSupplierForBooking(booking, config);

          let commissionRate = resolvedCommissionRate;
          let supplierCommissionVal = 0;
          let supplierEarningsVal = 0;
          let supplierInfo = "";
          let supplierRow = "";
          let supplierContactConfirmed = "";

          if (booking) {
            supplierInfo = "";

            const showSupplierContact = (!type.startsWith('admin_') && !type.startsWith('supplier_')) || booking.status === 'confirmed' || booking.status === 'pending';
            supplierRow = `
              <tr>
                <td style="padding: 12px 0; color: #64748b; border-bottom: 1px solid #f1f5f9;">Supplier</td>
                <td align="right" style="padding: 12px 0; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;">
                  ${supplierName}${showSupplierContact && supplierPhone !== 'N/A' ? `<br/><span style="font-size: 11px; color: #64748b; font-weight: 500;">${supplierPhone}</span>` : ""}
                </td>
              </tr>
            `;

            if (booking.status === 'confirmed') {
              const waLink = supplierPhone !== 'N/A' && supplierPhone !== null ? `https://wa.me/${supplierPhone.toString().replace(/\D/g, '')}` : null;
              supplierContactConfirmed = `
                <div style="margin-top: 30px; padding: 25px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
                  <div style="font-weight: 800; font-size: 11px; color: #94a3b8; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px;">Operator Contact</div>
                  <p style="font-size: 13px; color: #475569; margin-bottom: 15px; font-weight: 500;">Direct contact for your tour operator:</p>
                  <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    ${waLink ? `<a href="${waLink}" style="display: inline-block; background-color: #0f172a; color: white; padding: 10px 18px; border-radius: 2px; text-decoration: none; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">WhatsApp Contact</a>` : ''}
                    <a href="mailto:${supplierEmail}" style="display: inline-block; border: 1px solid #0f172a; color: #0f172a; padding: 10px 18px; border-radius: 2px; text-decoration: none; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Email Operator</a>
                  </div>
                </div>
              `;
            }

            // Financial Calculations
            const amount = parseCurrency(booking.totalAmount);
            if (booking.merchantFee !== undefined && Number(booking.merchantFee) > 0) {
              supplierCommissionVal = Number(booking.merchantFee);
            } else if (booking.commissionAmount !== undefined && Number(booking.commissionAmount) > 0) {
              supplierCommissionVal = Number(booking.commissionAmount);
            } else {
              supplierCommissionVal = (amount * commissionRate) / 100;
            }

            if (booking.supplierEarnings !== undefined && Number(booking.supplierEarnings) > 0) {
              supplierEarningsVal = Number(booking.supplierEarnings);
            } else {
              supplierEarningsVal = amount - supplierCommissionVal;
            }

            if (amount > 0 && supplierCommissionVal > 0) {
              const rawRate = (supplierCommissionVal / amount) * 100;
              commissionRate = Math.round(rawRate * 10) / 10;
            }
          }

          const supplierCommission = formatCurrency(supplierCommissionVal);
          const supplierEarnings = formatCurrency(supplierEarningsVal);

          // Recipient Routing Verification
          if (type.startsWith('admin_')) {
            const adminMail = (config.adminNotificationEmail || '').trim();
            to = adminMail || process.env.ADMIN_EMAIL || 'baliadventours@gmail.com';
          } else if (type.startsWith('supplier_')) {
            let recipientEmail = null;
            if (supplierEmail && supplierEmail !== 'N/A' && supplierEmail.trim() !== '') {
              recipientEmail = supplierEmail.trim();
            } else if (booking?.supplierEmail && booking.supplierEmail.trim() !== '') {
              recipientEmail = booking.supplierEmail.trim();
            }

            to = recipientEmail;
            
            if (!to && booking) {
               console.log(`[Email Handler] Supplier email missing for ${type}. Falling back to default admin notification.`);
               const adminMail = (config.adminNotificationEmail || '').trim();
               to = adminMail || process.env.ADMIN_EMAIL || 'baliadventours@gmail.com';
            }

            if (!to) {
              console.warn(`[Email Handler] FAILED: No recipient found for supplier email ${type}`);
              await logEmailAttempt({
                to: "none",
                type: type,
                bookingId: booking?.id || null,
                subject: template.subject,
                status: "failed",
                reason: "Supplier email not found and fallback failed",
                provider: config.emailProvider
              });
              return { success: true, skipped: true, reason: 'Supplier email not found' };
            }
          } else {
            to = (to || booking?.customerData?.email || '').trim();
          }

          if (!to) {
             console.warn(`[Email Handler] FAILED: Recipient address missing for type: ${type}`);
             await logEmailAttempt({
               to: "none",
               type: type,
               bookingId: booking?.id || null,
               subject: template.subject,
               status: "failed",
               reason: "Email recipient is empty",
               provider: config.emailProvider
             });
             return { success: true, skipped: true, reason: 'No recipient email' };
          }

          console.log(`[Email Handler] Final Recipient resolved: ${to}`);

          const guestsText = booking?.participants 
            ? `${booking.participants.adults || 0} Adults${booking.participants.children > 0 ? `, ${booking.participants.children} Children` : ""}`
            : "N/A";

          let displayDate = booking?.date || '';
          if (displayDate) {
            try {
              const dateObj = new Date(displayDate);
              if (!isNaN(dateObj.getTime())) {
                displayDate = dateObj.toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                });
              }
            } catch (e) {}
          }

          // Build price breakdown section
          let priceBreakdownHtml = "";
          if (booking) {
            const pricing = booking.pricingBreakdown || { adultRate: 0, childRate: 0, packageTotal: 0 };
            const participants = booking.participants || { adults: 0, children: 0 };

            priceBreakdownHtml = `
              <tr>
                <td colspan="2" style="padding: 0 0 10px; font-weight: 700; color: #1a1a1a; border-bottom: 1px solid #f1f5f9;">
                  Package: ${booking.packageName}
                </td>
              </tr>
              ${participants.adults > 0 ? `
              <tr>
                <td style="padding: 10px 0; color: #666;">Adults x${participants.adults} @${formatCurrency(pricing.adultRate)}</td>
                <td align="right" style="padding: 10px 0; font-weight: 700; color: #1a1a1a;">${formatCurrency(participants.adults * pricing.adultRate)}</td>
              </tr>
              `: ""}
              ${participants.children > 0 ? `
              <tr>
                <td style="padding: 10px 0; color: #666;">Children x${participants.children} @${formatCurrency(pricing.childRate)}</td>
                <td align="right" style="padding: 10px 0; font-weight: 700; color: #1a1a1a;">${formatCurrency(participants.children * pricing.childRate)}</td>
              </tr>
              `: ""}
            `;

            if (booking.selectedAddOns && booking.selectedAddOns.length > 0) {
              priceBreakdownHtml += `
                <tr>
                  <td colspan="2" style="padding: 15px 0 5px; font-size: 10px; font-weight: 900; color: #1a1a1a; text-transform: uppercase; letter-spacing: 1px;">Add Ons</td>
                </tr>
              `;
              booking.selectedAddOns.forEach((addon: any) => {
                priceBreakdownHtml += `
                  <tr>
                    <td style="padding: 5px 0 10px;">
                      <div style="color: #666;">${addon.name} x${addon.quantity || 1}</div>
                    </td>
                    <td align="right" style="padding: 5px 0 10px; font-weight: 700; color: #1a1a1a;">
                      ${formatCurrency(addon.price * (addon.quantity || 1))}
                    </td>
                  </tr>
                `;
              });
            }

            if (booking.discountAmount > 0) {
              priceBreakdownHtml += `
                <tr style="border-top: 1px solid #f1f5f9;">
                  <td style="padding: 10px 0;">
                    <div style="font-weight: 700; color: #ef4444;">Discount</div>
                    <div style="font-size: 11px; color: #ef4444;">${booking.couponCode || 'Promo Code'}</div>
                  </td>
                  <td align="right" style="padding: 10px 0; font-weight: 700; color: #ef4444;">
                    -${formatCurrency(booking.discountAmount)}
                  </td>
                </tr>
              `;
            }
          }

          // Generate placeholders
          const placeholders: any = {
            "{{customerName}}": booking?.customerData?.fullName || "Guest",
            "{{bookingId}}": booking?.id?.substring(0, 8).toUpperCase() || "N/A",
            "{{tourTitle}}": booking?.tourTitle || "Selected Tour",
            "{{packageName}}": booking?.packageName || "Selected Package",
            "{{date}}": displayDate,
            "{{time}}": booking?.time || "09:00",
            "{{guests}}": guestsText,
            "{{totalAmount}}": booking ? formatCurrency(booking.totalAmount) : "N/A",
            "{{priceBreakdown}}": priceBreakdownHtml,
            "{{commissionRate}}": commissionRate,
            "{{supplierCommission}}": supplierCommission,
            "{{supplierEarnings}}": supplierEarnings,
            "{{supplierName}}": supplierName,
            "{{supplierInfo}}": supplierInfo,
            "{{supplierEmail}}": supplierEmail,
            "{{status}}": booking?.status || 'N/A',
            "{{phone}}": booking?.customerData?.phone || "N/A",
            "{{email}}": booking?.customerData?.email || "N/A",
            "{{nationality}}": booking?.customerData?.nationality || booking?.customerData?.country || "N/A",
            "{{paymentMethod}}": booking?.paymentMethod || "Bank Transfer",
            "{{supplierRow}}": supplierRow,
            "{{greeting}}": type.startsWith('admin_') ? "Hi <strong>Administrator</strong>," : 
                            type.startsWith('supplier_') ? "" : 
                            `Hi <strong>${booking?.customerData?.fullName || "Guest"}</strong>,`,
            "{{greeting_section}}": type.startsWith('admin_') ? `<p style="font-size: 15px; color: #1e293b; margin-bottom: 25px; line-height: 1.6;">Hi <strong>Administrator</strong>,</p>` : 
                                    type.startsWith('supplier_') ? "" : 
                                    `<p style="font-size: 15px; color: #1e293b; margin-bottom: 25px; line-height: 1.6;">Hi <strong>${booking?.customerData?.fullName || "Guest"}</strong>,</p>`,
            "{{paymentInstructions}}": (booking && type === 'booking_pending' && !type.startsWith('admin_')) ? (
              booking.paymentMethod === 'pay_on_arrival' ? `
              <div style="margin-bottom: 40px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                  <div style="background-color: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #e2e8f0;">
                      <div style="font-size: 13px; font-weight: 800; color: #1a1a1a; display: flex; align-items: center;">
                          <span style="font-size: 16px; margin-right: 8px;">💵</span> Payment Instructions (Pay on Arrival)
                      </div>
                  </div>
                  <div style="padding: 25px; background-color: #ffffff;">
                      <p style="margin: 0 0 15px; font-size: 14px; line-height: 1.5; color: #444444;">
                          You have selected <strong>Cash on Arrival</strong>. Please prepare the cash payment of <strong>${formatCurrency(booking.totalAmount)}</strong> (in Indonesian Rupiah IDR or equivalent USD/AUD) as the amount has to be paid directly to our guide or driver on the day of your activity.
                      </p>
                      <p style="margin: 0; font-size: 13px; font-style: italic; color: #64748b; line-height: 1.5;">
                          * Your booking is fully confirmed and secured. No advance online payment is required.
                      </p>
                  </div>
              </div>
              ` : `
              <div style="margin-bottom: 40px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                  <div style="background-color: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #e2e8f0;">
                      <div style="font-size: 13px; font-weight: 800; color: #1a1a1a; display: flex; align-items: center;">
                          <span style="font-size: 16px; margin-right: 8px;">💳</span> Payment Instructions (Bank Transfer)
                      </div>
                  </div>
                  <div style="padding: 25px; background-color: #ffffff;">
                      <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #444444;">
                          To secure your booking, please complete your payment of <strong>${formatCurrency(booking.totalAmount)}</strong>. You can pay via Bank Transfer to:
                      </p>
                      <div style="background-color: #f1f5f9; border-radius: 8px; padding: 20px;">
                          <table width="100%" style="font-size: 14px; color: #1a1a1a;">
                              <tr>
                                  <td style="padding: 6px 0; color: #64748b;">Bank</td>
                                  <td align="right" style="padding: 6px 0; font-weight: 700;">${config.bankName || "Bank Central Asia"}</td>
                              </tr>
                              <tr>
                                  <td style="padding: 6px 0; color: #64748b;">Account No.</td>
                                  <td align="right" style="padding: 6px 0; font-weight: 700;">${config.accountNumber || "7700251076"}</td>
                              </tr>
                              <tr>
                                  <td style="padding: 6px 0; color: #64748b;">Account Holder</td>
                                  <td align="right" style="padding: 6px 0; font-weight: 700;">${config.accountHolder || "I Kadek Didi Suprapta SH"}</td>
                              </tr>
                              ${config.swiftCode ? `
                              <tr>
                                  <td style="padding: 6px 0; color: #64748b;">SWIFT CODE</td>
                                  <td align="right" style="padding: 6px 0; font-weight: 700;">${config.swiftCode}</td>
                              </tr>` : (config.bankName === "Bank Central Asia" || !config.bankName) ? `
                              <tr>
                                  <td style="padding: 6px 0; color: #64748b;">SWIFT CODE</td>
                                  <td align="right" style="padding: 6px 0; font-weight: 700;">CENAIDJA</td>
                              </tr>` : ''}
                          </table>
                      </div>
                      <p style="margin: 20px 0 0; font-size: 13px; font-style: italic; color: #64748b; line-height: 1.5;">
                          * ${config.bankInstructions || "After transfer, please send your transfer receipt. Once your receipt is validated your Booking Status will be confirmed."}
                      </p>
                  </div>
              </div>
              `
            ) : "",
            "{{supplierContactConfirmed}}": supplierContactConfirmed,
            "{{pickupAddress}}": booking?.customerData?.pickupAddress || "Meet at location",
            "{{whatsappLink}}": `https://wa.me/${config.supportPhone?.replace(/\D/g, '')}`,
            "{{siteName}}": config.siteName || "Bali Adventours",
            "{{supportPhone}}": config.supportPhone || "+6281246502939",
            "{{appUrl}}": (() => {
              let url = process.env.VITE_APP_URL || "https://gorillaatvadventure.com";
              if (!url.startsWith("http")) url = "https://" + url;
              return url.replace(/\/$/, "");
            })(),
            "{{viewBookingUrl}}": (() => {
              let url = process.env.VITE_APP_URL || "https://gorillaatvadventure.com";
              if (!url.startsWith("http")) url = "https://" + url;
              url = url.replace(/\/$/, "");
              return `${url}/booking-confirmation/${booking?.id || ''}`;
            })(),
            "{{guideRow}}": (booking?.assignedGuideName || extraInfo?.["{{guideName}}"]) ? `
              <tr>
                  <td style="padding: 8px 0; color: #888888;">Guide</td>
                  <td align="right" style="padding: 8px 0; font-weight: 700; color: #1a1a1a;">${extraInfo?.["{{guideName}}"] || booking?.assignedGuideName}</td>
              </tr>
              ${(booking?.assignedGuideWhatsapp || extraInfo?.["{{guideWhatsapp}}"]) ? `
              <tr>
                  <td style="padding: 8px 0; color: #888888;">Guide WhatsApp</td>
                  <td align="right" style="padding: 8px 0; font-weight: 700; color: #0055ff;">${extraInfo?.["{{guideWhatsapp}}"] || booking?.assignedGuideWhatsapp}</td>
              </tr>
              ` : ""}
            ` : "",
            ...extraInfo
          };

          const performReplacement = (text: string, data: any) => {
            if (!text) return "";
            let result = text;
            for (let i = 0; i < 3; i++) {
              Object.keys(data).forEach(key => {
                const val = data[key]?.toString() || '';
                result = result.split(key).join(val);
              });
            }
            return result;
          };

          body = performReplacement(body, placeholders);
          subject = performReplacement(subject, placeholders);
          placeholders["{{body}}"] = body;

          const bookingIdShort = booking?.id?.substring(0, 8).toUpperCase() || "N/A";

          // Core visual layout styling wraps
          const isVisualTemplate = booking && (
            type === 'booking_confirmed' || 
            type === 'booking_pending' || 
            type === 'booking_cancelled' || 
            type === 'guide_assigned' || 
            type === 'booking_changed' || 
            type === 'booking_updated_by_admin' ||
            type === 'booking_status_confirmed' ||
            type === 'booking_change_request' ||
            type === 'booking_change_approved' ||
            type === 'booking_cancellation_request' ||
            type === 'tour_completed_review_request' ||
            type.startsWith('admin_') || 
            type.startsWith('supplier_')
          );

          if (isVisualTemplate) {
            const isNotifyAdmin = type.startsWith('admin_') || type.startsWith('supplier_');
            
            let title = 'Notification';
            let subtitle = 'Update regarding booking';

            if (type === 'booking_pending') {
              title = 'Booking Confirmed!';
              subtitle = 'Your booking is confirmed.';
            } else if (type.includes('confirmed') || type.includes('confirm')) {
              title = 'Booking Confirmed!';
              subtitle = 'Your booking is confirmed.';
            } else if (type.includes('pending')) {
              title = 'Booking Pending';
              subtitle = 'Awaiting payment verification.';
            } else if (type.includes('cancelled') || type.includes('cancellation_approved') || type.includes('cancel')) {
              title = 'Booking Cancelled';
              subtitle = 'The booking has been cancelled.';
            } else if (type.includes('change_request') || type === 'booking_changed') {
              title = 'Change Request Proposed';
              subtitle = 'A change request is currently under review.';
            } else if (type.includes('change_approved')) {
              title = 'Booking Changed';
              subtitle = 'The booking modifications have been approved.';
            } else if (type === 'tour_completed_review_request' || type.includes('completed') || type.includes('complete')) {
              title = 'Tour Completed!';
              subtitle = 'Thank you for your journey with us!';
            } else if (type === 'guide_assigned') {
              title = 'Guide Assigned!';
              subtitle = 'A tour guide has been assigned.';
            } else if (type === 'admin_new_booking') {
              title = 'New Booking Alert';
              subtitle = `New booking from ${booking?.customerData?.fullName || 'Guest'}`;
            } else if (type === 'supplier_new_booking') {
              title = 'New Tour Booking';
              subtitle = `New booking from platform`;
            } else if (type === 'booking_updated_by_admin') {
              title = 'Trip Updated';
              subtitle = 'Your trip details have been updated by staff.';
            }

            if (type.startsWith('admin_')) {
              title = `[Admin] ${title}`;
            } else if (type.startsWith('supplier_')) {
              title = `[Supplier] ${title}`;
            }

            const showImportantNote = type === 'booking_confirmed' || type === 'booking_status_confirmed' || type === 'booking_change_approved' || type === 'booking_pending' || type.includes('confirm');
            const showVoucher = type === 'booking_confirmed' || type === 'booking_status_confirmed' || type === 'booking_change_approved' || type === 'booking_pending' || type.includes('confirm');
            const contentHtml = bookingDetailsSection(booking, config, isNotifyAdmin, { showImportantNote, showVoucher });
            html = emailBaseTemplate(title, subtitle, contentHtml, config, bookingIdShort);
          } else if (booking && (type === 'booking_status_updated' || type === 'booking_date_changed' || type === 'booking_payment_received')) {
            const titleMap: any = {
              'booking_status_updated': 'Status Updated',
              'booking_date_changed': 'Date Changed',
              'booking_payment_received': 'Payment Received'
            };
            const title = titleMap[type] || 'Status Updated';
            const subtitle = `Update regarding your booking`;
            const contentHtml = bookingDetailsSection(booking, config);
            html = emailBaseTemplate(title, subtitle, contentHtml, config, bookingIdShort);
          } else if (type === 'test') {
             html = emailBaseTemplate('Test Notification', 'System check completed successfully.', html || '<p>This is a test notification.</p>', config);
          } else {
             html = html || body || "";
             if (!html.includes('<html>')) {
               html = emailBaseTemplate(subject, "New Notification", html, config);
             }
          }

          html = performReplacement(html, placeholders);
          subject = performReplacement(subject, placeholders);
        }
      }

      // Generate PDF Voucher
      let attachment: any = null;
      if (type === 'booking_confirmed' && booking) {
        try {
          const pdfBuffer = await generateVoucherPdf(booking, config);
          attachment = {
            content: pdfBuffer.toString('base64'),
            filename: `Voucher-${booking.id.substring(0, 8).toUpperCase()}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment'
          };
        } catch (pdfError) {
          console.error("[Email Handler] PDF Generation FAILED:", pdfError);
        }
      }

      // Sanitize recipient list
      const recipientsArray = typeof to === 'string'
        ? to.split(',').map(e => e.trim()).filter(Boolean)
        : Array.isArray(to) ? to.map((e: any) => e?.toString()?.trim()).filter(Boolean) : [];

      if (recipientsArray.length === 0) {
         console.warn(`[Email Handler] FAILED: No valid recipients found for ${type || 'custom email'}`);
         await logEmailAttempt({
           to: "none",
           type: type || "custom",
           bookingId: booking?.id || null,
           subject: subject || "No Subject",
           status: "skipped",
           reason: "Email recipients array resolved to empty",
           provider: config.emailProvider
         });
         return { success: true, skipped: true, reason: 'No valid recipient email' };
      }

      // Trigger standard send transporter
      const result = await sendEmailViaProvider(config, {
        to: recipientsArray,
        subject,
        html,
        attachment
      });

      // Record successful or skipped dispatch
      await logEmailAttempt({
        to: recipientsArray.join(', '),
        type: type || "custom",
        bookingId: booking?.id || null,
        subject,
        status: result.skipped ? "skipped" : "success",
        reason: result.reason || undefined,
        provider: config.emailProvider
      });

      return result;

    } catch (error: any) {
      console.error("[Email Handler Error] Dispatch FAILED:", error);
      
      // Register precise error in Firestore Diagnostic Log for the Admin UI to read
      await logEmailAttempt({
        to: Array.isArray(to) ? to.join(', ') : (to || "Unknown"),
        type: type || "custom",
        bookingId: booking?.id || null,
        subject: subject || "No Subject",
        status: "failed",
        errorDetails: error.stack || error.toString(),
        reason: error.message || "Unknown transportation dispatch error",
        provider: config.emailProvider
      });

      throw error;
    }
}
