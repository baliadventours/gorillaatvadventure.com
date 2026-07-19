export interface PricingTier {
  minParticipants: number;
  maxParticipants: number;
  adultPrice: number;
  childPrice: number;
}

export interface TourPackage {
  name: string;
  details?: string; // Made optional
  inclusions: string[];
  exclusions: string[];
  meetingPoint?: string; // New: map embed URL or address
  meetingPointType?: 'Meeting Point' | 'Pick up Location'; // New: selection
  tiers: PricingTier[];
}

export interface AddOn {
  id: string;
  name: string;
  description?: string; // New field
  price: number;
  unit: 'per person' | 'per booking';
}

export interface TransportOption {
  id: string;
  name: string;
  type: 'meet' | 'shared' | 'private';
  carType?: string;
  price: number;
  priceType: 'per_car' | 'per_person';
  description?: string;
  maxCapacity?: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string; // New: image URL or icon identifier
}

export interface TourType {
  id: string;
  name: string;
}

export interface LocationMeta {
  id: string;
  name: string;
}

export interface ImportantInfoSection {
  title: string;
  content: string[];
}

export interface TourLabel {
  id: string;
  name: string;
  color?: string; // Optional: background color for the badge
}

export interface Tour {
  id: string;
  slug: string; // Added slug field
  title: string;
  description: string;
  seo?: {
    title: string;
    description: string;
    keywords?: string;
    ogImage?: string;
  };
  categoryId?: string;
  tourTypeId?: string;
  locationId?: string;
  labelIds?: string[]; // Selection from global labels
  imageLabelId?: string; // New field for placement
  belowTitleLabelId?: string; // New field for placement
  priceLabelId?: string; // New field for placement
  highlights: string[];
  inclusions: string[]; // Global inclusions
  exclusions: string[]; // Global exclusions
  itinerary: {
    day: number;
    title: string;
    description: string;
    pickup?: {
      description: string;
      image?: string;
    };
    image?: string;
  }[];
  importantInfo?: string;
  infoSections?: ImportantInfoSection[]; // Dynamic sections: What to Bring, Before you go, etc.
  languages: string[];
  location: string; // Keep as backup or display string
  locationMapUrl: string;
  duration: string;
  gallery: string[];
  featuredImage?: string; // New field
  regularPrice: number; // For display on cards/grid
  discountPrice?: number;
  packages: TourPackage[];
  addOnIds?: string[]; // Selection from global add-ons
  addOns?: AddOn[]; // Kept for backward compatibility or snapshots
  transportIds?: string[]; // Selection from global transports
  meetingPoint?: string; // Tour level meeting point
  faqs: {
    question: string;
    answer: string;
  }[];
  timeSlots?: string[]; // Available times e.g. ["08:00", "08:30"]
  maxCapacity?: number; // Maximum participants per day/tour
  slotCapacity?: number; // Optional: Maximum participants per specific time slot if different from daily
  urgencyPointIds?: string[]; // Global urgency points
  rating?: number; // New field for aggregated rating
  reviewsCount?: number; // New field for review count
  isPopular?: boolean; // New field for display badges
  supplierId?: string; // ID of the supplier who owns this tour
  supplierName?: string; // Cache supplier name
  supplierEmail?: string; // Cache supplier email
  vendorEmail?: string; // Legacy field for vendor email
  vendor?: string; // Legacy field for vendor name
  businessName?: string; // Legacy field for business name
  status: 'published' | 'pending' | 'draft' | 'rejected'; // Status for supplier submission
  createdAt: any;
  updatedAt: any;
}

export interface UrgencyPoint {
  id: string;
  title: string;
  description: string;
  icon: string; // Lucide icon name
}

export interface PageContent {
  id: string;
  title: string;
  slug: string;
  content: string;
  seo?: {
    title: string;
    description: string;
    keywords?: string;
    ogImage?: string;
  };
  updatedAt: any;
}

export interface Review {
  id: string;
  tourId?: string; // New: reference back to tour
  tourTitle?: string; // New: cache for display
  userId: string;
  userName: string;
  userPhoto?: string;
  nationality?: string;
  tourDate?: string;
  rating: number;
  title?: string;
  comment: string;
  image?: string;
  images?: string[]; // New: support for multiple images
  status: 'pending' | 'approved' | 'rejected'; // New moderation status
  createdAt: any;
}

export interface PaymentSettings {
  paypalClientId: string;
  paypalSecret?: string; // Cache for backend use if needed
  paypalSandboxClientId?: string;
  paypalSandboxSecret?: string;
  paypalMode: 'live' | 'sandbox';
  isPaypalEnabled: boolean;
  creditCardEnabled: boolean;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  swiftCode?: string;
  bankInstructions: string;
}

export interface BookingLog {
  timestamp: string;
  message: string;
  type: 'status_change' | 'note' | 'system' | 'assignment';
  userName?: string;
}

export interface Booking {
  id: string;
  tourId: string;
  tourTitle: string;
  userId: string;
  supplierId?: string; // Reference to the product owner
  supplierName?: string; // Cache supplier name for easy display
  supplierEmail?: string; // Cache supplier email for reliable notifications
  customerData: {
    fullName: string;
    email: string;
    phone: string;
    country?: string; // New field
    nationality?: string;
    pickupAddress?: string; // New field
    specialRequirements?: string;
  };
  date: string;
  time?: string;
  timeSlot?: string; // New field for selected time slot
  participants: {
    adults: number;
    children: number;
  };
  packageName: string;
  selectedAddOns: {
    id: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  addOns?: { name: string; price: number }[]; // Snapshot fields
  couponCode?: string;
  discountAmount?: number;
  agentDiscount?: number; // Discount applied for agents
  merchantFee?: number; // Fee deducted for the platform from supplier
  supplierEarnings?: number; // Final payout to supplier
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'cancelled' | 'review_required' | 'completed';
  cancellationRequested?: boolean;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed'; // New field
  paymentId: string | null;
  paymentToken?: string; // New field for manual tokens
  bookingSource: 'Direct' | 'Klook' | 'Viator' | 'GetYourGuide' | 'Manual' | 'Agent' | string; // Source of the booking
  selectedTransport?: TransportOption | null; // Transport selection for booking
  transportTotal?: number; // Total price calculated for transport option
  internalNotes?: string; // New field for admin notes
  logs?: BookingLog[]; // New: activity logs
  assignedGuideId?: string; // New field for guide assignment
  assignedGuideName?: string; // Cache name for easy display
  assignedGuideWhatsapp?: string; // New: cache whatsapp for easy contact
  bookedBy?: {
    uid: string;
    name: string;
    email: string;
    role: string;
  };
  pricingBreakdown?: {
    adultRate: number;
    childRate: number;
    packageTotal: number;
    transportTotal?: number;
  };
  proposedUpdate?: any;
  payoutId?: string | null; // ID of the payout document this booking is linked to
  payoutStatus?: 'pending' | 'queued' | 'paid'; // Status in the payout lifecycle
  createdAt: any;
  updatedAt?: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'customer' | 'supplier' | 'agent';
  status: 'active' | 'pending' | 'suspended';
  commissionRate?: number; // For suppliers (percentage 0-100)
  discountRate?: number; // For agents (percentage 0-100)
  companyName?: string;
  publicEmail?: string;
  taxId?: string;
  phoneNumber?: string;
  website?: string;
  instagramUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  country?: string;
  dateOfBirth?: string;
  bio?: string;
  wishlist?: string[];
  payoutMethod?: PayoutMethod;
  createdAt: any;
  updatedAt?: any;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minBookingValue: number;
  expiryDate?: string;
  isActive: boolean;
}

export interface Guide {
  id: string;
  name: string;
  whatsapp: string;
  isActive: boolean;
  supplierId?: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string; // Markdown supported
  excerpt: string;
  featuredImage: string;
  category: string;
  tags: string[];
  author: string;
  seo?: {
    title: string;
    description: string;
    keywords?: string;
    ogImage?: string;
  };
  status: 'draft' | 'published';
  publishedAt: any;
  createdAt: any;
  updatedAt: any;
}

export interface EmailTemplate {
  subject: string;
  body: string; // HTML supported with placeholders like {{customerName}}, {{bookingId}}, etc.
  enabled: boolean;
}

export interface WhatsAppTemplate {
  message: string; // Placeholders supported like {{customerName}}, {{bookingId}}, etc.
  enabled: boolean;
}

export interface CommunicationSettings {
  id: 'settings';
  emailProvider: 'resend' | 'sendgrid' | 'brevo' | 'smtp' | 'gmail' | 'none' | 'enginemailer' | 'mailjet';
  emailApiKey?: string;
  gmailUser?: string;
  gmailAppPassword?: string;
  smtpSettings?: {
    host: string;
    port: number;
    user: string;
    pass: string;
    secure: boolean;
  };
  senderEmail: string;
  senderName: string;
  adminNotificationEmail: string; // Where admin receives alerts
  adminNotificationPhone?: string; // Where admin receives WA alerts
  openwaApiKey?: string; // New: OpenWA API Key
  openwaBaseUrl?: string; // New: OpenWA Dashboard URL
  openwaSessionId?: string; // New: OpenWA Session Name
  whatsappProvider?: 'openwa' | 'waba'; // Provider select option
  wabaAccessToken?: string; // WABA Access Token
  wabaPhoneNumberId?: string; // WABA Phone Number ID
  wabaTemplateName?: string; // Default template name for confirmations
  wabaLanguageCode?: string; // Default language code (e.g., en, id)
  wabaVerifyToken?: string; // Verification token for Meta Webhook
  geminiApiKey?: string;
  whatsappEnabled: boolean;
  whatsappTemplates: {
    booking_confirmation: WhatsAppTemplate;
    booking_status_updated: WhatsAppTemplate;
    admin_notification: WhatsAppTemplate;
    guide_assigned?: WhatsAppTemplate;
    payment_link?: WhatsAppTemplate;
  };
  templates: {
    booking_pending: EmailTemplate;
    booking_confirmed: EmailTemplate;
    booking_cancelled: EmailTemplate;
    booking_changed: EmailTemplate;
    booking_status_updated: EmailTemplate;
    payment_received: EmailTemplate;
    payment_failed: EmailTemplate;
    review_request: EmailTemplate;
    guide_assigned: EmailTemplate;
    admin_new_booking: EmailTemplate;
    booking_updated_by_admin?: EmailTemplate;
  };
}

export interface SiteSettings {
  siteName: string;
  siteDescription: string;
  siteKeywords: string;
  supportEmail: string;
  supportPhone: string;
  whatsappNumber: string;
  logoURL: string;
  faviconURL: string;
  officeAddress: string;
  primaryColor: string;
  secondaryColor: string;
  bodyFont: string;
  headingFont: string;
  currency: string;
  heroYoutubeUrl?: string;
  heroImage?: string;
  heroImages?: string[];
  instagramUrl?: string;
  facebookUrl?: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  // SEO & AI Crawler Settings
  metaTitle?: string;
  homeTitleFormat?: string; // e.g. "{{siteName}} - Best Bali Tours"
  pageTitleFormat?: string; // e.g. "{{title}} | {{siteName}}"
  tourTitleFormat?: string; // e.g. "{{title}} | {{siteName}}"
  blogTitleFormat?: string; // e.g. "{{title}} - {{siteName}}"
  ogImage?: string;
  allowAICrawlers?: boolean;
  sitemapUrl?: string;
  // Theme Settings
  themeMode?: 'default' | 'custom';
  sectionStyles?: {
    topNav?: string;
    mainNav?: string;
    hero?: string;
    featuredTours?: string;
    guestFavorites?: string;
    reviews?: string;
    inspiration?: string;
    footer?: string;
    aboutPage?: string;
    contactPage?: string;
    blogPage?: string;
  };
}

export interface Popup {
  id: string;
  title: string;
  content: string;
  imageURL?: string;
  ctaText?: string;
  ctaLink?: string;
  isActive: boolean;
  displayDelay: number;
  type: 'newsletter' | 'promotion' | 'info';
  updatedAt: any;
}

export interface Inventory {
  id: string; // tourId_date_timeSlot
  tourId: string;
  date: string; // YYYY-MM-DD
  timeSlot: string; // "daily" or specific time
  bookedCount: number;
  maxCapacity: number;
  updatedAt: any;
}

export interface Inquiry {
  id: string;
  userId?: string | null;
  userName: string;
  userEmail: string;
  userPhone?: string;
  planTitle: string;
  summary: string;
  itinerary: any;
  formData: any;
  status: 'new' | 'followed_up' | 'converted' | 'cancelled';
  createdAt: any;
}

export interface PayoutMethod {
  type: 'bank_transfer' | 'paypal' | 'other';
  bankName?: string;
  accountNumber?: string;
  accountHolder?: string;
  paypalEmail?: string;
  details?: string;
}

export interface Payout {
  id: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'cancelled';
  payoutMethod: PayoutMethod;
  bookingIds: string[];
  referenceNumber?: string;
  notes?: string;
  processedAt?: any;
  createdAt: any;
  updatedAt: any;
}

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: 'customer' | 'admin';
  text: string;
  timestamp: any;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: 'Booking' | 'Tour Details' | 'Payment' | 'Feedback' | 'General Inquiry';
  status: 'open' | 'replied' | 'pending' | 'closed';
  messages: TicketMessage[];
  createdAt: any;
  updatedAt: any;
  type: 'web';
}

