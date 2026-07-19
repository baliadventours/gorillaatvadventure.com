import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { parseMeetingPoint } from './utils';

export async function generateTourVoucherPdf(booking: any, config: any) {
  const doc = new jsPDF();
  const siteName = config?.siteName || 'Bali Adventours';
  const primaryColor = config?.primaryColor || '#1a1a1a';
  const slate400 = '#94a3b8';
  const slate600 = '#475569';
  const slate900 = '#0f172a';
  const borderLight = '#f1f5f9';

  // --- Design Geometry ---
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);
  
  // Header section matching Manifest
  doc.setTextColor(slate900);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(siteName.toUpperCase(), margin, 25);

  // Ref Number (Top Right)
  doc.setTextColor(slate400);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`#${booking.id.toUpperCase()}`, pageWidth - margin, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text('Booking Reference', pageWidth - margin, 24, { align: 'right' });

  // Main Title
  doc.setTextColor(slate900);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Tour Voucher', margin, 42);
  
  doc.setTextColor(slate600);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Confirmed booking for passengers', margin, 48);

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, 55, pageWidth - margin, 55);

  let currentY = 70;

  // --- SECTION: GENERAL INFORMATION ---
  doc.setTextColor(slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('GENERAL INFORMATION', margin, currentY);

  currentY += 8;

  const drawInfoBox = (label: string, value: string, x: number, y: number, width: number, linkUrl?: string) => {
    doc.setTextColor(slate400);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x, y);
    
    if (linkUrl) {
      doc.setTextColor(234, 88, 12); // #ea580c orange
    } else {
      doc.setTextColor(slate900);
    }
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const displayValue = value || 'N/A';
    const lines = doc.splitTextToSize(displayValue, width);
    doc.text(lines, x, y + 5);
    if (linkUrl) {
      doc.link(x, y + 1, width, lines.length * 5, { url: linkUrl });
    }
    return lines.length * 5;
  };

  const colWidth = (contentWidth / 2) - 5;
  
  const tourTitleHeight = drawInfoBox('TOUR / ACTIVITY NAME', booking.tourTitle, margin, currentY, contentWidth - 80);
  drawInfoBox('TRIP DATE', booking.date, margin + contentWidth - 75, currentY, 35);
  drawInfoBox('STATUS', (booking.status || 'Confirmed').toUpperCase(), margin + contentWidth - 35, currentY, 35);
  
  currentY += Math.max(tourTitleHeight, 10) + 10;
  
  drawInfoBox('PACKAGE TYPE', booking.packageName, margin, currentY, colWidth);
  drawInfoBox('MEETING / PICKUP', booking.time || 'TBA', margin + colWidth + 10, currentY, colWidth);

  currentY += 20;

  // --- SECTION: PARTICIPANT DETAILS ---
  doc.setTextColor(slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('PARTICIPANT DETAILS', margin, currentY);
  
  currentY += 8;
  
  // Participant Grid
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 35, 'FD');

  const pCol = contentWidth / 4;
  drawInfoBox('GUEST NAME', booking.customerData?.fullName || 'N/A', margin + 5, currentY + 8, pCol - 10);
  drawInfoBox('NATIONALITY', booking.customerData?.nationality || booking.customerData?.country || 'N/A', margin + pCol + 5, currentY + 8, pCol - 10);
  drawInfoBox('CONTACT NUMBER', booking.customerData?.phone || 'N/A', margin + 5, currentY + 22, pCol - 10);
  drawInfoBox('EMAIL', booking.customerData?.email || 'N/A', margin + pCol + 5, currentY + 22, pCol - 10);

  // Pax counts
  const drawPaxBox = (label: string, value: string, x: number, y: number) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(x, y, 22, 22, 'FD');
    
    doc.setTextColor(primaryColor);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(value, x + 11, y + 10, { align: 'center' });
    
    doc.setTextColor(slate400);
    doc.setFontSize(5);
    doc.text(label.toUpperCase(), x + 11, y + 15, { align: 'center' });
  };

  const participants = booking.participants || { adults: 0, children: 0 };
  const totalPax = (participants.adults || 0) + (participants.children || 0);
  
  drawPaxBox('Adults', participants.adults.toString(), margin + (pCol * 2) + 12, currentY + 6);
  drawPaxBox('Children', participants.children.toString(), margin + (pCol * 2) + 38, currentY + 6);
  
  doc.setFillColor(slate900);
  const totalBoxX = pageWidth - margin - 22 - 5;
  doc.rect(totalBoxX, currentY + 6, 22, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text(totalPax.toString(), totalBoxX + 11, currentY + 11, { align: 'center' });
  doc.setFontSize(5);
  doc.text('TOTAL PAX', totalBoxX + 11, currentY + 16, { align: 'center' });

  currentY += 45;

  // --- SECTION: PICKUP & ARRIVAL INFO ---
  doc.setTextColor(slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('PICKUP & ARRIVAL INFO', margin, currentY);

  currentY += 8;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(241, 245, 249);
  doc.rect(margin, currentY, contentWidth, 20, 'FD');
  
  const rawAddress = booking.customerData.pickupAddress || "";
  const isMeetingPoint = !rawAddress || 
    rawAddress.includes("Meet") || 
    rawAddress.toLowerCase().includes("basecamp") ||
    rawAddress.toLowerCase().includes("operation");

  let addressToPrint = rawAddress;
  let linkUrl = undefined;
  if (isMeetingPoint) {
    const mp = parseMeetingPoint(rawAddress);
    addressToPrint = mp.venue;
    linkUrl = mp.url;
  }
  
  drawInfoBox(isMeetingPoint ? 'MEETING POINT LOCATION' : 'LOCATION / HOTEL NAME', addressToPrint || 'Please contact for pickup location', margin + 5, currentY + 8, contentWidth - 10, linkUrl);

  currentY += 30;

  // Bottom Grid for Addons & Special Req
  const midPoint = margin + (contentWidth / 2) + 5;
  
  // ADD ONS
  doc.setTextColor(slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('BOOKED ADD-ONS', midPoint, currentY - 50);

  let addonY = currentY - 42;
  const addons = booking.selectedAddOns || [];
  if (addons.length > 0) {
    addons.forEach((addon: any) => {
      doc.setTextColor(slate900);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(addon.name, midPoint, addonY);
      doc.setTextColor(primaryColor);
      doc.text(`x${addon.quantity || 1}`, margin + contentWidth - 5, addonY, { align: 'right' });
      addonY += 6;
    });
  } else {
    doc.setTextColor(slate400);
    doc.setFontSize(7);
    doc.text('No add-ons booked.', midPoint, addonY);
  }

  // SPECIAL REQ
  doc.setTextColor(slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('SPECIAL REQUIREMENTS', midPoint, currentY - 10);
  
  doc.setFillColor(255, 254, 252);
  doc.setDrawColor(254, 243, 199);
  doc.rect(midPoint, currentY - 2, (contentWidth / 2) - 5, 12, 'FD');
  doc.setTextColor(180, 83, 9);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(booking.specialRequirements || 'No special requirements noted for this trip.', midPoint + 5, currentY + 6);

  // Financial Footer
  const footerY = 245;
  doc.setDrawColor(borderLight);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  doc.setTextColor(slate400);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL AMOUNT PAID', margin, footerY + 12);
  
  doc.setTextColor(slate900);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${booking.totalAmount?.toString() || '0'} USD`, margin, footerY + 22);

  // QR in bottom right
  try {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : (process.env.VITE_APP_URL || 'https://gorillaatvadventure.com');
    const qrDataUrl = await QRCode.toDataURL(`${appUrl}/booking-confirmation/${booking.id}`);
    doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 30, footerY + 2, 30, 30);
  } catch (qrErr) {}

  // Final small footer
  doc.setFontSize(6);
  doc.setTextColor(slate400);
  doc.setFont('helvetica', 'normal');
  doc.text(`Verified Operational Document - ${siteName}`, margin, 285);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString('en-GB')}`, pageWidth - margin, 285, { align: 'right' });

  return doc;
}
