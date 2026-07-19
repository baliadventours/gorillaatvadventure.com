import React, { useState } from 'react';
import { useSettings } from '../lib/SettingsContext';
import { Helmet } from 'react-helmet-async';
import { formatPageTitle } from '../lib/seoUtils';
import { Shield, Printer, Calendar, BookOpen, Key, Users, Eye, HelpCircle, ThumbsUp, ShieldCheck } from 'lucide-react';

export default function Privacy() {
  const { settings } = useSettings();
  const pageTitle = formatPageTitle('Privacy Policy', settings?.siteName || 'Bali Adventours', settings?.pageTitleFormat);
  const siteName = settings?.siteName || 'Bali Adventours';
  const supportEmail = settings?.supportEmail || 'baliadventours@gmail.com';
  const supportPhone = settings?.supportPhone || '+62 812-3456-7890';

  const [activeSection, setActiveSection] = useState('intro');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const sections = [
    { id: 'intro', label: '1. Information We Collect' },
    { id: 'usage', label: '2. How We Use Information' },
    { id: 'cookies', label: '3. Cookies & Analytics' },
    { id: 'sharing', label: '4. Information Sharing' },
    { id: 'security', label: '5. Security & Safety' },
    { id: 'rights', label: '6. Your Privacy Rights' }
  ];

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`Read the Privacy Policy of ${siteName}. Learn how we collect, use, protect, and handle your personal booking and transfer details securely.`} />
      </Helmet>

      <div className="min-h-screen bg-white pb-24 font-sans">
        {/* Banner Section */}
        <section className="relative bg-gradient-to-br from-indigo-800/10 via-indigo-600/5 to-transparent py-20 border-b border-gray-100/80">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 rounded-full mb-6 border border-indigo-100">
                <Shield className="h-4 w-4 text-indigo-600" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 font-mono">Security & Privacy First</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight leading-tight mb-6">
                Privacy Policy
              </h1>
              <p className="text-gray-500 text-lg font-medium max-w-2xl leading-relaxed">
                At {siteName}, we take your data security seriously. This Privacy Policy details how we handle, process, and protect your personal information when booking travel arrangements.
              </p>
              
              <div className="flex flex-wrap items-center gap-6 mt-8 text-xs font-semibold text-gray-400 font-mono">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  Last Updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="hidden md:inline text-gray-300">•</span>
                <button 
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-500 transition-colors cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  Print Policy
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section with sidebar index */}
        <div className="container mx-auto px-4 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 items-start">
            
            {/* Sidebar Navigation - Sticky */}
            <aside className="lg:sticky lg:top-[160px] space-y-4 lg:col-span-1">
              <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-100">
                <h3 className="font-extrabold text-xs text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2 font-mono">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  Table of Contents
                </h3>
                <nav className="space-y-1">
                  {sections.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveSection(section.id);
                        document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                      className={`block px-3 py-2 rounded-xl text-sm font-semibold transition-all ${
                        activeSection === section.id
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-[1.02]'
                          : 'text-gray-500 hover:text-gray-950 hover:bg-gray-100/70'
                      }`}
                    >
                      {section.label}
                    </a>
                  ))}
                </nav>
              </div>

              {/* Security Trust callout */}
              <div className="bg-gray-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
                  <Shield className="h-32 w-32 text-indigo-500" />
                </div>
                <h4 className="font-extrabold text-sm mb-2 uppercase tracking-wider font-mono text-indigo-400">Encrypted Cloud</h4>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  Your personal records, hotel details, and booking metadata are securely hosted on Google Cloud Firestore with 256-bit SSL encryption.
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <p className="flex items-center gap-2">
                    <span className="text-indigo-400">E:</span> {supportEmail}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-indigo-400">P:</span> {supportPhone}
                  </p>
                </div>
              </div>
            </aside>

            {/* Main Policy text container */}
            <main className="lg:col-span-3 space-y-12 max-w-none">
              
              {/* Information We Collect */}
              <section id="intro" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <Key className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">1. Information We Collect</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    In order to coordinate seamless airport transfers, customized tours, and hotel pickups in Bali, we must collect essential personal details. We only request information that is necessary to fulfill your travel itinerary.
                  </p>
                  <p>
                    <strong>Types of personal details collected include:</strong>
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Contact Information:</strong> Your full name, email address, and active telephone number (preferably WhatsApp enabled, as our drivers and tour guides coordinate pickups via WhatsApp).</li>
                    <li><strong>Travel Particulars:</strong> Your resort or hotel pickup address, accommodation name, room number (if available), and preferred travel dates.</li>
                    <li><strong>Flight Schedules:</strong> For airport pickups/drop-offs at Ngurah Rai International Airport (DPS), we collect your arrival and departure flight numbers and exact times.</li>
                    <li><strong>Payment Records:</strong> Billing details, currency preferences, and reference codes for transaction verification. We do NOT store complete credit card details; all financial processing is handled securely by certified, PCI-compliant payment gateways.</li>
                  </ul>
                </div>
              </section>

              {/* How We Use Your Information */}
              <section id="usage" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <Eye className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">2. How We Use Your Information</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    We process and use the information we collect to manage and optimize your excursions in the following ways:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Booking Fulfillment:</strong> Processing payments, preparing booking vouchers, and confirming your reservation status.</li>
                    <li><strong>Real-time Dispatch Notifications:</strong> Sending automated tour confirmations, ticket downloads, and driver assignment alerts to your email and phone (utilizing WhatsApp Cloud API or OpenWA infrastructure).</li>
                    <li><strong>Operations & Logistics:</strong> Passing pickup schedules and passenger counts to our trusted local drivers, tour instructors, and guides so they can meet you on time.</li>
                    <li><strong>AI Support Tools:</strong> Feeding trip metadata (without sensitive credentials) to our intelligent AI Planner and Travel Assistant to provide personalized FAQ replies and custom suggestions.</li>
                  </ul>
                </div>
              </section>

              {/* Cookies & Tracking Technologies */}
              <section id="cookies" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">3. Cookies & Analytics</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    We employ cookies and browser local-storage mechanisms to elevate your browsing experience and monitor general web performance metrics.
                  </p>
                  <p>
                    <strong>Cookie and session trackers are used for:</strong>
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>User Preferences:</strong> Saving your selected shopping currency, recently viewed tours, and wishlist selections so they stay intact between pages.</li>
                    <li><strong>Web Analytics:</strong> Gathering anonymous traffic statistics through Google Analytics and simple telemetry logs to see which Bali itineraries are popular and identify page rendering bottlenecks.</li>
                    <li><strong>Authentication State:</strong> Keeping your traveler profile safely logged in when navigating between your dashboard, tickets panel, and wishlist.</li>
                  </ul>
                  <p className="text-sm bg-gray-50 p-4 rounded-xl text-gray-500 font-medium">
                    You can easily configure your web browser to reject cookies or delete them periodically. However, doing so may impact certain functionalities, such as retaining items in your tour cart.
                  </p>
                </div>
              </section>

              {/* Information Sharing & Disclosure */}
              <section id="sharing" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <Users className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">4. Information Sharing</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    We do NOT sell, rent, or trade your personal information to third-party advertisers. Your information is only shared under strict parameters to ensure your travel logistics run successfully:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Local Suppliers & Operators:</strong> We disclose your pickup hotel, tour date, passenger count, and primary name to the specific Balinese drivers, boat operators (e.g. Nusa Penida fast boat companies), and instructors running your excursion.</li>
                    <li><strong>Communication Providers:</strong> In order to dispatch instant alerts, tour vouchers, and driver names, we process phone numbers and names through WhatsApp business endpoints and notification APIs.</li>
                    <li><strong>Legal Safeguards:</strong> We may share personal records if required to do so by legal subpoenas, regulatory audits, or in response to emergency safety matters involving local authorities.</li>
                  </ul>
                </div>
              </section>

              {/* Data Security */}
              <section id="security" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">5. Security & Safety</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    The safety of your personal travel logs is of paramount importance to us. We have implemented technical and organizational measures to safeguard your record databases:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>SSL Encryption:</strong> All booking inputs, dashboard requests, and customer profiles are transmitted over Secure Socket Layer (HTTPS) communication paths.</li>
                    <li><strong>Access Limits:</strong> Our internal booking engine and admin back-office dashboards are protected by strong authentication. Only authorized administrative managers can view customer rosters or billing receipts.</li>
                    <li><strong>Independent Audits:</strong> Our systems are reviewed regularly to check for security vulnerabilities or database leak threats.</li>
                  </ul>
                </div>
              </section>

              {/* Your Privacy Rights */}
              <section id="rights" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <Key className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">6. Your Privacy Rights</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    Regardless of where you reside, we respect your control over your personal records. Depending on your home country (including regulations such as GDPR or CCPA), you hold the following rights:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Access:</strong> The right to request a digital breakdown of what personal details we hold about your bookings.</li>
                    <li><strong>Correction:</strong> The right to request immediate correction of outdated hotel addresses, misspelled names, or wrong phone numbers.</li>
                    <li><strong>Erasure (Right to be Forgotten):</strong> The right to request complete deletion of your booking history, profile logs, and ticket records from our cloud database (provided there are no active, pending tours that require those details to operate).</li>
                  </ul>
                  <p>
                    To exercise any of these privacy privileges, please write to our support desk at <strong>{supportEmail}</strong> with your original booking or account details. We will process and respond to your request within 14 business days.
                  </p>
                </div>
              </section>

              {/* Helpful section feedback */}
              <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100/80 flex flex-col md:flex-row items-center justify-between gap-6 mt-16">
                <div>
                  <h4 className="font-extrabold text-base text-gray-900">Was this privacy policy helpful?</h4>
                  <p className="text-sm text-gray-400 mt-1">We honor transparency and secure treatment of travel details above all.</p>
                </div>
                
                {feedbackSubmitted ? (
                  <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                    <ShieldCheck className="h-5 w-5" /> Thank you for your feedback!
                  </div>
                ) : (
                  <button
                    onClick={() => setFeedbackSubmitted(true)}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-3 rounded-xl uppercase tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
                  >
                    <ThumbsUp className="h-4 w-4" /> Yes, Helpful
                  </button>
                )}
              </div>

            </main>
          </div>
        </div>
      </div>
    </>
  );
}
