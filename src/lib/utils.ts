import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 
 * @deprecated Use FormattedPrice component or useCurrency hook for dynamic currency support.
 * This utility only provides a static USD fallback.
 */
export function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function sanitizeImageUrl(url: string | undefined): string {
  if (!url) return '';
  let clean = url.trim();
  if (clean.includes('firebasestorage.googleapis.com')) {
    const match = clean.match(/\/v0\/b\/([^/]+)\/v0\/b\/\1\//);
    if (match) {
      const duplicateSegment = `/v0/b/${match[1]}/v0/b/${match[1]}/`;
      const correctSegment = `/v0/b/${match[1]}/`;
      clean = clean.replace(duplicateSegment, correctSegment);
    }
  }
  return clean;
}

export function getSafeImageUrl(url?: string) {
  if (!url) return '';
  return sanitizeImageUrl(url);
}

export interface MeetingPointDetails {
  venue: string;
  address: string;
  url: string;
}

export function parseMeetingPoint(text: string | null | undefined): MeetingPointDetails {
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
  // Remove trailing/leading punctuation/spaces/dashes
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
}

