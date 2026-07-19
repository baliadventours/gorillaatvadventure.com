# 🌴 Travel Agency Enterprise Platform - Fresh Installation & Orchestration Guide

Welcome to the official deployment and systems orchestration manual for your white-labeled travel booking platform. This manual provides a production-grade, step-by-step walkthrough to customize, integrate, and deploy our full-stack travel booking application with complete functional parity on your own cloud infrastructure.

This application is built as a **full-stack modern React (Vite) + Node (Express SSR) platform** designed to deliver dynamic, search-engine-optimized content with robust automatic payments, email schedules, generative AI features, and WhatsApp CRM pipelines.

---

## 🛠️ Fresh Installation Requirements & Checklist

To compile, build, and deploy the full suite of automated services with complete functional parity, you must register credentials from the following platforms:

| Integration Domain | Provider | Purpose | Estimated Setup Time |
| :--- | :--- | :--- | :--- |
| **Source Management** | GitHub | Host source repositories, drive Vercel continuous integrations | 5 mins |
| **NoSQL & Auth Core** | Google Firebase | Relational-flat storage database & Google secure sign-in | 10 mins |
| **Generative Intelligence** | Google AI Studio | Drive AI Tour generation & personalized itinerary planners | 3 mins |
| **Image Upload Pipeline** | Imgbb | CDN Asset storage for generated tours | 3 mins |
| **E-Mail Service Provider** | Resend | Dispatch transactional tour receipts & itinerary invoices | 5 mins |
| **WhatsApp Automation** | OpenWA & Railway | Headless WA session cluster & real-time Customer CRM | 15 mins |
| **Financial Gateway** | PayPal Developer Portal | Multi-currency client checkouts & payment processing | 5 mins |
| **Hosting & Rendering Hub**| Vercel | Dynamic server/client SSR execution engine | 5 mins |

---

## 🚨 CRITICAL: Fresh Installation Customization Checklist

To completely remove the default sample configuration and ensure your system is secure. you **MUST** perform the following files and rule edits immediately prior to deploying.

### 1. Update Firestore Admin Security Rules (`firestore.rules`)
By default, the Firestore rules limit root write access to a fallback developer email. For your fresh install to be secure, you must change this block:
1. Open the `/firestore.rules` file in your project root.
2. Locate the `isAdmin()` helper function around lines 15–23:
   ```javascript
   function isAdmin() {
     return isSignedIn() && (
       (request.auth.token.email != null && 
        request.auth.token.email.lower() == 'baliadventours@gmail.com' && // <-- CHANGE THIS EMAIL
        request.auth.token.email_verified == true) ||
       (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin')
     );
   }
   ```
3. Replace `'baliadventours@gmail.com'` with **your choice of administrative Google email** (e.g., `'admin@yourtravelbrand.com'`).
4. Save and deploy this rule within your Firebase Firestore console under the **Rules** tab.

### 2. Branding Customization (`metadata.json`)
Replace the default sample branding with your travel agency name and SEO tags:
1. Open `/metadata.json` in your project root.
2. Modify the file with your specific agency details:
   ```json
   {
     "name": "Your Travel Brand Name",
     "description": "Enter your customized business description here, highlighting your target vacation destinations, dynamic AI planning, and secure online bookings."
   }
   ```
3. Save the file. This updates the browser tab headers, SEO indexing, and user-facing layout values.

---

## 🚀 Phase-by-Phase Integration and Account Setup Steps

### Phase 1: Code Acquisition & GitHub Setup
This phase securely hosts your platform code on GitHub to trigger automated continuous integration (CI/CD) and live tracking via Vercel.

1. **Extract source code:** Download the platform code `.zip` archive on your local computer. Extract it to a dedicated workspace folder (e.g., `your-travel-agency`).
2. **Access GitHub:** Navigate to [GitHub](https://github.com) and log into your account.
3. **Initialize Repository:** 
   - Click the **`+`** icon in the upper right-hand corner and choose **New repository**.
   - **Repository Name**: E.g., `our-travel-agency-platform`.
   - **Visibility**: Toggle to **Private** to ensure your credentials, databases, and customer records remain secure.
   - Leave "Add a README file", "Add .gitignore", and "Choose a license" **unchecked** (since our template package bundles pre-configured overrides). Click **Create repository**.
4. **Push your code:**
   - On your local computer, open your Terminal (macOS/Linux) or Command Prompt / Git Bash (Windows).
   - Navigate to your extracted directory:
     ```bash
     cd /path/to/extracted/your-travel-agency
     ```
   - Initialize and commit your directory:
     ```bash
     git init
     git add .
     git commit -m "feat: initial commit of enterprise platform fresh install"
     git branch -M main
     git remote add origin https://github.com/YOUR_GITHUB_USERNAME/our-travel-agency-platform.git
     git push -u origin main
     ```

---

### Phase 2: Google Account & Firebase Integration
Firebase serves as the database and authorization core, handling database queries, user sessions, dynamic catalogs, and supplier access roles.

#### A. Set up Firebase Project & Core Data Services
1. Open the [Firebase Console](https://console.firebase.google.com/) and authenticate with your Google account.
2. Click **Add project** (or **Create project**).
   - Name your project (e.g., `your-agency-prod`).
   - Choose whether to enable Google Analytics. Click **Create project** and continue to project view.

#### B. Set up Firebase Authentication (Google Access)
1. In the left navigation rail, open **Build > Authentication** and click **Get Started**.
2. Under the **Sign-in method** tab, select **Google** from the providers.
3. Toggle the **Enable** switch in the top right.
4. Input your **Project support email** and **Developer support email**. Click **Save**.
5. Go to the **Settings** tab (within Authentication) and select **Authorized domains** in the submenu.
6. Click **Add domain** and enter your production Vercel URL (e.g., `your-agency.vercel.app`). This authorizes your custom domain to securely initialize Google logins.

#### C. Set up Firestore NoSQL Database
1. In the left navigation rail, open **Build > Firestore Database** and click **Create database**.
2. Select **Start in production mode** (this restricts direct open connections, requiring the security schema). Click Next.
3. Set your Cloud Firestore Location. Choose a server physically close to your primary market or business operation (e.g., `us-central1` for North America, `europe-west3` for flat European response latencies).
4. Click **Enable** (the location defaults to database ID `(default)`).

#### D. Deploy Firestore Security Rules
1. Navigate to the **Rules** tab inside the Firestore Database dashboard.
2. Select the existing mock rules, delete them, and paste the entire modified content of your `firestore.rules` file (with your personalized administrator email updated as explained in the Critical Customization check above).
3. Click **Publish**.

#### E. Register Web App Configuration & Generate SDK Access
1. In the Firebase console top header, click the **Gear Icon** and select **Project Settings**.
2. Scrolling down on the **General** tab to the **Your apps** section.
3. Click the **Web icon (`</>`)** to configure your deployment application.
4. Set App nickname to: `Travel Hub Production`. Leave "Also set up Firebase Hosting" **unchecked** (Vite on Vercel serves the actual assets). Click **Register app**.
5. Copy down the generated configuration block. It will directly populate these Vercel Environment Variables:
   - `apiKey` $\rightarrow$ Map to `VITE_FIREBASE_API_KEY`
   - `authDomain` $\rightarrow$ Map to `VITE_FIREBASE_AUTH_DOMAIN`
   - `projectId` $\rightarrow$ Map to `VITE_FIREBASE_PROJECT_ID` and `FIREBASE_PROJECT_ID`
   - `storageBucket` $\rightarrow$ Map to `VITE_FIREBASE_STORAGE_BUCKET`
   - `messagingSenderId` $\rightarrow$ Map to `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `appId` $\rightarrow$ Map to `VITE_FIREBASE_APP_ID`
   - Default Database ID is `(default)` $\rightarrow$ Map to `VITE_FIREBASE_FIRESTORE_DATABASE_ID` & `FIREBASE_DATABASE_ID`

#### F. Generate Service Account Key (Secure Server Proxy)
This allows our server-side router (`server.ts`) to securely access and record reservations without client limits.
1. Inside modern Firebase Project Settings, navigate to the **Service accounts** tab.
2. Verify the **Firebase Admin SDK** option is selected.
3. Click the blue **Generate new private key** button.
4. Authenticate by clicking **Generate key** on the warning. This saves a privileged `.json` file to your computer.
5. Open this downloaded file in any plain text editor, copy the **entire JSON string**, and paste it as the value for the `FIREBASE_SERVICE_ACCOUNT` variable in Vercel.

---

### Phase 3: Google Gemini GenAI Integration
The platform comes equipped with an advanced **AI Tour Builder** that uses Google’s generative model stack to synthesize detailed descriptions, optimal pickup lists, and structured itinerary flows instantly.

1. Navigate to [Google AI Studio](https://aistudio.google.com/).
2. Log in using your main Google account.
3. Click on the button **Get API Key** in the sidebar.
4. Select **Create API Key**. You can link this key to an existing project or create a standalone key.
5. Once generated, click the **Copy** icon next to the key string. 
6. Save this value to use as your `GEMINI_API_KEY` environment variable.

---

### Phase 4: Imgbb Image Hosting Setup
Since we use the AI Tour Builder to dynamically design tour files, we need a reliable image CDN to persist and host custom photos uploaded by administrators or users.

1. Navigate to [Imgbb Website](https://imgbb.com/) and register a free account.
2. Complete account verification via email and log into your Imgbb Dashboard.
3. Keep the session active and proceed to [Imgbb's API Console](https://api.imgbb.com/).
4. Click **Create API Key** (or copy your default API key).
5. Copy the active API string. Save this value as `VITE_IMGBB_API_KEY` in Vercel to route uploaded tour, day, and blog images directly to Imgbb's lightning-fast assets server.

---

### Phase 5: Resend Email Automation Setup
The booking portal employs **Resend** to dispatch elegantly formatted, dynamic HTML receipts, cancellation warnings, and voucher credentials directly to customer inboxes.

1. Create a free business profile at [Resend](https://resend.com/).
2. Open the **API Keys** panel in the left navigation sidebar.
3. Click **Create API Key**. Assign a name to code (e.g. `Travel Platform Production Key`), toggle permissions to **Full Access**, and click **Add**.
4. Copy the displayed API Token immediately. Save this value as `RESEND_API_KEY`.
5. **Set up Custom Domain Sending:**
   - In your Resend sidebar, go to **Domains > Add Domain**.
   - Input your custom registered domain name (e.g., `yourtravelagency.com`).
   - Copy the generated DNS records (DKIM and SPF records) and paste them as TXT/MX records inside your Domain Name Registrar (GoDaddy, Namecheap, Cloudflare, etc.).
   - Wait 5-10 minutes and click **Verify**. Once verified, update the `SENDER_EMAIL` environment variable in Vercel to use your authenticated domain (e.g., `bookings@yourtravelagency.com`).

---

### Phase 6: Self-Hosted OpenWA WhatsApp Automation Setup on Railway
The platform features an advanced real-time WhatsApp CRM, custom template dispatcher, and a diagnostic WhatsApp Connection tester. It runs on **OpenWA** (the industrial `wa-automate-server` headless node architecture running a virtual Chrome automation stack).

#### A. Set up Railway.app Host Container
1. Register an account on [Railway](https://railway.app/).
2. Click **New Project** and select **Deploy from GitHub**.
3. Choose the official, pre-configured OpenWA Docker template. If deploying manually, deploy from our verified open-source OpenWA workspace wrapper:
   - Provide original Repository URL: `https://github.com/open-wa/wa-automate-server`
4. Railway will automatically analyze the repository. Click on **Configure variables** before launching:
   - Add **`PORT`** $\rightarrow$ `8080`
   - Add **`API_KEY`** $\rightarrow$ Create a long, secure random password string (e.g. `OurAgencySuperSecretToken2026`). Copy this value! This is your `OPENWA_API_KEY` which authorizes Vercel to talk to your Railway WhatsApp server.
5. Click **Deploy**. Wait approximately 3-4 minutes as Railway downloads the Linux Alpine virtual container, launches headless Chromium, and spins up the server.
6. Once deployed, select **Settings** inside your Railway Service page, go to the **Networking** menu, and click **Generate Domain** (or set a custom address).
7. Copy the generated Railway routing link (e.g. `https://openwa-server-production.up.railway.app`). This is your `OPENWA_BASE_URL`.

#### B. Link your Whatsapp Device (Admin Panel Workflow)
Once Vercel environment variables are updated in Phase 9, follow these simple steps to link your physical phone.

1. Navigate to `/admin` on your finished website and log in with your administrative Google email.
2. Select **Settings** (gear icon) in your sidebar and locate the **WhatsApp Settings** panel.
3. Toggle the **WhatsApp Automation Enabled** option to ON.
4. Input the phone number tracking customer queries into the fields provided.
5. In your admin page, go to the **WhatsApp CRM** tab (Messages icon).
6. Click **Check Session Status** or **Initialize WhatsApp Session**.
7. The platform will dynamically contact Railway, spin up Chrome, and display the WhatsApp login QR Code directly on your Admin screen.
8. Grab your physical mobile phone, open WhatsApp, go to **Settings > Linked Devices**, tap **Link a Device**, and scan the QR code.
9. Your dashboard will refresh and change to `Connected` mode. Your platform can now securely trigger automated tour confirmation notifications, send itinerary manifest PDFs, and drive real-time customer support messaging directly on your WhatsApp number!

---

### Phase 7: PayPal & Stripe Payment Gateways
Your platform has direct payment support integrated natively using React and Server proxies. You do not need hardcoded environment variables on deployment of source files for payments—**they are fully manageable directly within the secure `/admin` portal** so that your secrets are stored securely in Firestore without risky exposure.

#### A. Collect Developer Credentials
1. Go to [PayPal Developer Portal](https://developer.paypal.com/) and authorize with your commercial profile.
2. In the dashboard top-right header, select **Apps & Credentials**.
3. Toggle the switch to **Live** or **Sandbox** (for testing mock checkouts).
4. Click **Create App** and name application `Travel Agency Checkout Hub`.
5. Under Credentials, copy:
   - **Client ID**
   - **Secret Key**

#### B. Setup in Admin Panel
1. Access the administrator interface `/admin` on your live website.
2. Click **Settings > Financial Settings** (Credit Cards/Payments panel).
3. Under **PayPal Express Checkout Settings**:
   - Toggle **Enable PayPal Payments** to **Active**.
   - Select your Target Operational Mode: **Live** or **Sandbox**.
   - Input your retrieved **Live Client ID** & **Live Secret Key**.
   - Input your testing **Sandbox Client ID** & **Sandbox Secret Key**.
4. Click **Save Changes**. The booking system will instantly adapt, displaying PayPal and credit card checkout fields on tour purchase pages.

---

### Phase 8: Unified Vercel Platform Deployment
This is the final publishing phase. It brings your client-side assets and server-side SSR engine online under Vercel's global CDN, fully wired with your environment variables.

1. Open [Vercel](https://vercel.com/) and register/log in via your active GitHub profile.
2. Click the **Add New...** dropdown menu and select **Project**.
3. Under the *Import Git Repository* list, locate your imported project. Click **Import**.
4. Inside Vercel's Project Configuration, establish these parameters:
   - **Framework Preset**: Select `Vite` (Vercel automatically translates Vite routers).
   - **Root Directory**: `./` (Root directory).
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Open the **Environment Variables** sub-section underneath the build settings.
6. Progressively add each of the variables detailed in the Glossary below. Ensure that you copy each string without any spaces or line breaks!
7. Once everything is populated, click **Deploy**. Vercel will bundle output files, compile the Express server and SSR engine, map all DNS records, and assign your live URL.
8. Congratulations! Visit your app URL to explore your newly launched production system.

---

## 🗃️ Clean & Generic Environment Variables Dictionary

Always apply these exact keys inside **Vercel Settings > Environment Variables** before attempting production compilation:

| Environment Variable Key | Scope / Type | Operational Profile & Purpose | Generic Placeholder Example |
| :--- | :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Public / Front | Authorizes front-end storage requests to Google Firestore. | `AIzaSyA88xXx_YourApiKeyGoesHere99` |
| `VITE_FIREBASE_AUTH_DOMAIN` | Public / Front | Directs web sign-ins to authenticated domain. | `your-agency-prod.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Public / Front | Connects frontend interface to the targeted Firebase hub.| `your-agency-prod` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Public / Front | Directs media files to the dedicated CDN directory. | `your-agency-prod.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID`| Public / Front | Identifies system sender to direct push notifications. | `958197463957` (12-digit number) |
| `VITE_FIREBASE_APP_ID` | Public / Front | Identifies specific web application inside the project. | `1:958197463957:web:21a2b3c4d5e6` |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Public / Front| Points client queries to default database instance. | `(default)` |
| `FIREBASE_PROJECT_ID` | Private / Back | Connects server router directly to Firebase Admin endpoints. | `your-agency-prod` |
| `FIREBASE_DATABASE_ID` | Private / Back | Points server queries to database instance on server. | `(default)` |
| `FIREBASE_SERVICE_ACCOUNT` | Private / Back | **Full raw content** of downloaded Service Account Key JSON. | `{"type": "service_account", ...}` |
| `GEMINI_API_KEY` | Private / Back | Unlocks generative artificial intelligence for tour plans. | `AIzaSyDb_YourGeminiAPIKey` |
| `VITE_IMGBB_API_KEY` | Public / Front | Unlocks Imgbb image pipeline uploads on front-end. | `your_imgbb_secret_api_key` |
| `DEFAULT_EMAIL_PROVIDER` | Private / Back | Sets primary transactional email provider. | `resend` |
| `RESEND_API_KEY` | Private / Back | Unlocks emails sending using Resend.com. | `re_MxXg6219_AaBbCcDdEeFf` |
| `SENDER_EMAIL` | Private / Back | Verified sender address for tour confirmations. | `bookings@yourtravelagency.com` |
| `SENDER_NAME` | Private / Back | Friendly business display name for client emails. | `Your Brand Bookings` |
| `OPENWA_BASE_URL` | Private / Back | Root deployment URL assigned to your active Railway instance. | `https://openwa-server-production.up.railway.app` |
| `OPENWA_API_KEY` | Private / Back | Secret Key that authorizes Vercel to contact your OpenWA. | `YourRailwayContainerSecureToken2026` |
| `ADMIN_EMAIL` | Private / Back | **Primary administrative email address** matching Google Auth. (Matches `firestore.rules`). | `your-name@gmail.com` |
| `VITE_CURRENCY_API_KEY` | Public / Front | (Optional) Drives live currency conversions for rates. | `bd8e7f12acbb45690dfa1e3b` |

---

## 🏁 Post-Deployment Verification & Diagnostics

Once the site is successfully built on Vercel:

1. **Verify Google Authentication:**
   Open your custom production URL in an Incognito page. Click on the **Sign In** button. Verify that the Google SSO pop-up launches cleanly and returns you to a logged-in state.
2. **Assign Administrator Roles:**
   If your login email matches the `ADMIN_EMAIL` defined in Vercel and the authorized admin email inside `firestore.rules`, the platform immediately grants you Full Admin privileges. To confirm, navigate manually to `/admin`.
3. **Run a WhatsApp Connection Test:**
   Navigate to `/admin` and select the **WhatsApp CRM** tab on the left. If you have successfully scanned your QR code as explained in Phase 6, click "Send Test WhatsApp". You should receive a direct connection diagnostics ping on your linked phone within 3 seconds!
4. **Hydrate Custom Data:**
   Use the **AI Tour Builder** on your panel to instantly generate your first travel tour directly, utilizing the active Gemini integration.

---
🌴 **Congratulations!** Your enterprise-grade tour automation, CRM, and payment system is officially live. Customize your packages, add guides, and coordinate custom operations securely on your white-labeled travel booking platform!
