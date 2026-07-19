import { handleChatbotRequest } from "../src/services/chatbotHandler.js";

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { messages } = req.body;
    const origin = req.headers.origin || `https://${req.headers.host}`;
    
    const result = await handleChatbotRequest(messages, origin);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error("[Vercel Chatbot API Error]:", error);
    return res.status(500).json({ error: error.message || "Internal Server Error" });
  }
}
