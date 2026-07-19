import { Booking } from '../types';
import { auth } from './firebase';

export async function sendWhatsAppNotification(
  type: 'booking_confirmation' | 'admin_notification' | 'booking_status_updated',
  booking: Booking,
  receiver?: string
) {
  try {
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const response = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify({
        type,
        booking,
        receiver
      })
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`[WhatsApp Service] Failed to send automation (${type}):`, error);
    return { success: false, error };
  }
}

export async function sendCustomWhatsApp(
  receiver: string,
  message: string,
  booking?: Booking,
  attachManifest?: boolean,
  attachVoucher?: boolean
) {
  try {
    const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const body: any = {
      receiver,
      customMessage: message,
      booking,
      attachManifest,
      attachVoucher
    };

    const response = await fetch('/api/send-whatsapp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    if (data.success) {
      return data;
    }
    
    // Fallback to client-side redirection if background sending is not functional and no attachment is required
    if (!attachManifest && !attachVoucher) {
      console.log("[WhatsApp Service] Backend send failed, falling back to client-side redirect:", data.error);
      const url = getWhatsAppLink(receiver, message);
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
      return { success: true, message: 'Opened WhatsApp web redirection' };
    }
    
    return data;
  } catch (error) {
    console.error('Failed to send WhatsApp via backend:', error);
    if (!attachManifest && !attachVoucher) {
      const url = getWhatsAppLink(receiver, message);
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
      return { success: true, message: 'Opened WhatsApp web redirection after error' };
    }
    throw error;
  }
}

export function getWhatsAppLink(phone: string, message: string): string {
  // Common Indonesian phone number formatting (convert 08xx to 628xx)
  let formattedNumber = phone.replace(/\D/g, '');
  if (formattedNumber.startsWith('0')) {
    formattedNumber = '62' + formattedNumber.slice(1);
  } else if (formattedNumber.startsWith('8')) {
    formattedNumber = '62' + formattedNumber;
  }
  
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedNumber}?text=${encodedMessage}`;
}

export function generateBookingMessage(template: string, data: any): string {
  let message = template;
  const placeholders: Record<string, string> = {
    '{{customerName}}': data.customerData?.fullName || 'Customer',
    '{{bookingId}}': data.id || '',
    '{{tourTitle}}': data.tourTitle || '',
    '{{date}}': data.date || '',
    '{{time}}': data.time || data.timeSlot || '',
    '{{totalAmount}}': data.totalAmount?.toString() || '0',
    '{{status}}': data.status || '',
    '{{paymentStatus}}': data.paymentStatus || '',
    '{{participants}}': `${data.participants?.adults || 0} Adults, ${data.participants?.children || 0} Children`,
    '{{guideName}}': data.assignedGuideName || '',
    '{{guideWhatsapp}}': data.assignedGuideWhatsapp || '',
    '{{bookingDate}}': data.date || '',
    '{{customer_name}}': data.customerData?.fullName || 'Customer',
    '{{tour_title}}': data.tourTitle || '',
    '{{booking_date}}': data.date || '',
    '{{guide_name}}': data.assignedGuideName || '',
    '{{guide_whatsapp}}': data.assignedGuideWhatsapp || ''
  };

  Object.entries(placeholders).forEach(([key, value]) => {
    message = message.replace(new RegExp(key, 'g'), value);
  });

  return message;
}
