import { createServer } from "../server.js";

let server: any;

export default async function handler(req: any, res: any) {
  try {
    if (!server) {
      server = await createServer();
    }
    return server(req, res);
  } catch (error: any) {
    console.error("[Vercel SSR Error]:", error);
    res.status(500).json({ 
      error: "SSR Failure", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
