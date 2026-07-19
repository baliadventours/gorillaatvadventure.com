import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { parseMeetingPoint } from "../../lib/utils.js";

export async function generateManifestPdf(booking: any, config: any): Promise<Buffer> {
  const doc = new jsPDF();
  const siteName = config?.siteName || 'Bali Adventours';
  const primaryColor = config?.primaryColor || '#1a1a1a';
  const slate400 = '#94a3b8';
  const slate600 = '#475569';
  const slate900 = '#0f172a';
  const borderLight = '#f1f5f9';

  // --- Design Geometry ---
  const pageWidth = 210;
  const pageHeight = 297;
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
  doc.text('Tour Manifest', margin, 42);
  
  doc.setTextColor(slate600);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Operational summary for on-ground field team', margin, 48);

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

  // Pax counts in boxes like manifest
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
  
  drawPaxBox('Adults', participants.adults.toString(), margin + (pCol * 2) + 12, currentY + 6);
  drawPaxBox('Children', participants.children.toString(), margin + (pCol * 2) + 38, currentY + 6);
  
  doc.setFillColor('#f8fafc');
  doc.setDrawColor(226, 232, 240);
  const totalBoxX = pageWidth - margin - 22 - 5;
  doc.rect(totalBoxX, currentY + 6, 22, 22, 'FD');
  doc.setTextColor('black');
  
  const totalPax = (participants.adults || 0) + (participants.children || 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(totalPax.toString(), totalBoxX + 11, currentY + 16, { align: 'center' });
  
  doc.setTextColor(slate400);
  doc.setFontSize(5);
  doc.text('TOTAL PASSENGERS', totalBoxX + 11, currentY + 21, { align: 'center' });

  currentY += 45;

  // --- SECTION: OPERATION DETAILS ---
  doc.setTextColor(slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('OPERATIONAL INFORMATION', margin, currentY - 10);

  const rawAddress = booking.customerData?.pickupAddress || "";
  const isMeetingPoint = !rawAddress || 
    rawAddress.includes("Meet") || 
    rawAddress.toLowerCase().includes("basecamp") ||
    rawAddress.toLowerCase().includes("operation") ||
    rawAddress.toLowerCase().includes("own transport") ||
    rawAddress.toLowerCase().includes("meet on location") ||
    rawAddress.includes("maps.app.goo.gl") ||
    rawAddress.includes("google.com/maps");

  let addressToPrint = rawAddress;
  let linkUrl = undefined;
  if (isMeetingPoint) {
    const mp = parseMeetingPoint(rawAddress);
    addressToPrint = `${mp.venue}\nGoogle Maps Link:\n${mp.url}`;
    linkUrl = mp.url;
  }

  // Calculate dynamic box height based on column text size
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  const leftLines = doc.splitTextToSize(addressToPrint || 'Meet at location', colWidth + 20);
  const rightLines = doc.splitTextToSize(booking.assignedGuideName || 'TBA', colWidth - 20);
  const maxTextHeight = Math.max(leftLines.length * 5, rightLines.length * 5);
  const boxHeight = maxTextHeight + 12;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(241, 245, 249);
  doc.rect(margin, currentY - 2, contentWidth, boxHeight, 'FD');

  drawInfoBox(isMeetingPoint ? 'MEETING POINT LOCATION' : 'PICKUP ADDRESS / HOTEL NAME', addressToPrint || 'Meet at location', margin + 5, currentY + 3, colWidth + 20, linkUrl);
  drawInfoBox('ASSIGNED GUIDE', booking.assignedGuideName || 'TBA', margin + colWidth + 30, currentY + 3, colWidth - 20);

  currentY += boxHeight + 8;

  // --- SECTION: BOOKED ADD-ONS & SPECIAL REQUIREMENTS ---
  const midPoint = margin + (contentWidth / 2) + 5;
  const addOnItems = booking.selectedAddOns || booking.addOns || [];
  
  doc.setTextColor(slate400);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('BOOKED ADD-ONS', margin, currentY - 10);

  let addonY = currentY - 2;
  if (addOnItems.length > 0) {
    addOnItems.forEach((addon: any) => {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(241, 245, 249);
      doc.rect(margin, addonY, (contentWidth / 2) - 5, 12, 'FD');
      
      doc.setTextColor(slate900);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`${addon.title || addon.name} x${addon.quantity || 1}`, margin + 5, addonY + 7);
      addonY += 15;
    });
  } else {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(241, 245, 249);
    doc.rect(margin, addonY, (contentWidth / 2) - 5, 12, 'FD');
    doc.setTextColor(slate400);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text('No add-ons booked.', margin + 5, addonY + 7);
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

  // Bottom line footer
  const footerY = 245;
  doc.setDrawColor(borderLight);
  doc.line(margin, footerY, pageWidth - margin, footerY);

  // QR in bottom right
  try {
    const appUrl = (process.env.VITE_APP_URL || 'https://gorillaatvadventure.com').replace(/\/$/, '');
    const qrDataUrl = await QRCode.toDataURL(`${appUrl}/booking-confirmation/${booking.id}`);
    doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 30, footerY + 2, 30, 30);
  } catch (qrErr) {}

  // Final small footer
  doc.setFontSize(6);
  doc.setTextColor(slate400);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Operational Tour Manifest - ${siteName}`, margin, 285);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}, ${new Date().toLocaleTimeString('en-GB')}`, pageWidth - margin, 285, { align: 'right' });

  return Buffer.from(doc.output('arraybuffer'));
}
