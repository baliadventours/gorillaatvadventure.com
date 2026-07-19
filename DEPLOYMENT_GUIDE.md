# Bali Adventours - Fresh Deployment & Setup Guide

This guide will walk you through setting up a new production instance of Bali Adventours on **Vercel** with a fresh **Firebase** database.

---

## 1. Firebase Setup (Database & Auth)

### Create a Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project** and name it (e.g., `bali-adventours-prod`).
3. (Optional) Enable Google Analytics.

### Set up Authentication
1. Go to **Build > Authentication** and click **Get Started**.
2. Go to **Sign-in method** and enable **Google**.
3. Go to **Settings > Authorized domains**.
4. Add your Vercel deployment domain (e.g., `bali-adventours.vercel.app`) and your custom domain if applicable.

### Set up Firestore Database
1. Go to **Build > Firestore Database** and click **Create database**.
2. Select **Production mode**.
3. Choose a location close to your users (e.g., `asia-southeast1` for Indonesia/Bali).
4. **Important**: If you want multiple databases or non-default ID, note down the `Database ID`. Usually, it's `(default)`.

### Generate Service Account Key (For Backend)
1. Go to **Project Settings** (gear icon) > **Service accounts**.
2. Click **Generate new private key**.
3. This downloads a `.json` file. **Open this file** and copy its entire content. You will need it for the `FIREBASE_SERVICE_ACCOUNT` environment variable.

---

## 2. Vercel Deployment

### Project Configuration
1. Import your repository into [Vercel](https://vercel.com/).
2. **Build Settings**:
   - Framework Preset: `Other` or `Vite`.
   - Build Command: `npm run build`.
   - Output Directory: `dist`.
   - Install Command: `npm install`.

### Environment Variables
Add the following variables in your Vercel Project Settings (**Settings > Environment Variables**):

| Variable | Description |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | From Firebase Project Settings (General > Web Apps) |
| `VITE_FIREBASE_AUTH_DOMAIN` | e.g. `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Your Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | e.g. `your-project.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 12-digit number from project settings |
| `VITE_FIREBASE_APP_ID` | From Project Settings > Web Apps |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Set to `(default)` or your custom DB ID |
| `FIREBASE_PROJECT_ID` | Same as above (for Backend) |
| `FIREBASE_DATABASE_ID` | Same as above (for Backend) |
| `FIREBASE_SERVICE_ACCOUNT` | **FULL JSON CONTENT** of the downloaded key file |
| `GEMINI_API_KEY` | Get this from [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `ADMIN_EMAIL` | The email that will have Admin access (matching your Google Login) |
| `VITE_CURRENCY_API_KEY` | (Optional) From [exchangerate-api.com](https://www.exchangerate-api.com/) |
| `WHAPI_TOKEN` | (Optional) From [Whapi.cloud](https://whapi.cloud/) for WhatsApp automation |
| `RESEND_API_KEY` | (Optional) From [Resend.com](https://resend.com/) for email notifications |

---

## 3. Initial Configuration (Hydrating the Data)

Once the site is live:
1. Log in using your Google account (ensure your email matches `ADMIN_EMAIL`).
2. Navigate to `/admin`.
3. Go to **Settings** and configure your site name, currency, and WhatsApp templates.
4. Use the **AI Tour Builder** to start generating content, or use the **Backup/Restore** tool if you have an existing data export.

---

## 4. Requirement Checklist
- [ ] **Node.js**: v18 or newer.
- [ ] **Firebase Plan**: **Blaze (Pay-as-you-go)** is recommended if you expect high traffic or use certain Firebase features, though it works on the Spark plan for low usage.
- [ ] **Firestore Rules**: Ensure you deploy the `firestore.rules` file from this project to your new database using the Firebase CLI: `firebase deploy --only firestore:rules`.

## 5. Dynamic SEO & Vercel SSR
The project is configured with a **Dynamic SEO Engine** located in `server.ts`. 

To ensure search engines and social media bots (like Facebook/WhatsApp) see the correct meta tags and images for each tour/blog post, the `vercel.json` and `api/ssr.ts` files automatically route requests through this engine.

**Key benefits of the current setup:**
- **Dynamic Meta Tags:** Every tour page will have its own unique title, description, and preview image in the HTML source.
- **Improved Performance:** The server preloads featured tours and categories, injecting them directly into the page to eliminate the "loading flicker" on initial visit.
- **Crawlability:** Bots get a fully hydrated HTML shell without needing to execute heavy JavaScript.

---

