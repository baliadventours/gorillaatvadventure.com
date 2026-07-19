export interface GeneratedTour {
  title: string;
  description: string;
  duration: string;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  itinerary: {
    day: number;
    title: string;
    description: string;
  }[];
  importantInfo?: string;
}

export interface GeneratedBlogPost {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
}

export interface GeneratedItinerary {
  planTitle: string;
  summary: string;
  dailyPlans: {
    day: number;
    title: string;
    activities: {
      time: string;
      title: string;
      description: string;
      type: 'activity' | 'hotel' | 'meal' | 'transport';
    }[];
    accommodationRecommendation: {
      name: string;
      reason: string;
      estimatedPrice: string;
    };
  }[];
  recommendedTours: {
    tourId: string;
    title: string;
    reason: string;
    slug: string;
  }[];
  estimatedTotalBudget: {
    amount: string;
    breakdown: string;
  };
  travelTips: string[];
}

export interface ExtractedBooking {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  tourTitle: string;
  date: string; // YYYY-MM-DD
  time?: string;
  adults: number;
  children: number;
  totalAmount: number;
  currency: string;
  packageName?: string;
  specialRequirements?: string;
  bookingReference?: string;
  source: 'Klook' | 'Viator' | 'GetYourGuide' | 'Booking.com' | 'Direct' | string;
}

export async function extractBookingFromEmail(emailText: string, apiKey?: string): Promise<ExtractedBooking> {
  const response = await fetch("/api/gemini/extract-booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ emailText, apiKey })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to extract booking from email");
  }

  return response.json();
}

export async function generateTourData(prompt: string, apiKey?: string): Promise<GeneratedTour> {
  const response = await fetch("/api/gemini/generate-tour", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, apiKey })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate tour");
  }

  return response.json();
}

export async function generateBlogPostData(prompt: string, apiKey?: string): Promise<GeneratedBlogPost> {
  const response = await fetch("/api/gemini/generate-blog", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, apiKey })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate blog post");
  }

  return response.json();
}

export async function generateItinerary(userData: any, apiKey?: string): Promise<GeneratedItinerary> {
  const response = await fetch("/api/gemini/generate-itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userData, apiKey })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to generate itinerary");
  }

  return response.json();
}

export async function getChatResponse(
  messages: { role: 'user' | 'model'; parts: string }[],
  context: { tours: any[] },
  apiKey?: string
): Promise<string> {
  const response = await fetch("/api/chatbot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, origin: window.location.origin })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to get chat response");
  }

  const data = await response.json();
  return data.text || "I'm sorry, I couldn't process your request.";
}
