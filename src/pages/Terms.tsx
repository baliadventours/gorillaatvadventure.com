import React, { useState } from 'react';
import { useSettings } from '../lib/SettingsContext';
import { Helmet } from 'react-helmet-async';
import { formatPageTitle } from '../lib/seoUtils';
import { Scale, Printer, ArrowUpRight, ThumbsUp, Calendar, BookOpen, AlertCircle, ShieldCheck } from 'lucide-react';

export default function Terms() {
  const { settings } = useSettings();
  const pageTitle = formatPageTitle('Terms & Conditions', settings?.siteName || 'Bali Adventours', settings?.pageTitleFormat);
  const siteName = settings?.siteName || 'Bali Adventours';
  const supportEmail = settings?.supportEmail || 'baliadventours@gmail.com';
  const supportPhone = settings?.supportPhone || '+62 812-3456-7890';

  const [activeSection, setActiveSection] = useState('intro');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const sections = [
    { id: 'intro', label: '1. Introduction' },
    { id: 'bookings', label: '2. Booking & Confirmation' },
    { id: 'cancellation', label: '3. Cancellation & Refunds' },
    { id: 'responsibilities', label: '4. Traveler Responsibilities' },
    { id: 'liability', label: '5. Limitation of Liability' },
    { id: 'governing-law', label: '6. Governing Law' }
  ];

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`Read the Terms and Conditions for booking tours and experiences with ${siteName}. Understand our policies on reservation, cancellation, refund, and liability.`} />
      </Helmet>

      <div className="min-h-screen bg-white pb-24 font-sans">
        {/* Banner Section */}
        <section className="relative bg-gradient-to-br from-orange-800/10 via-primary/5 to-transparent py-20 border-b border-gray-100/80">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="max-w-4xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full mb-6">
                <Scale className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Legal Framework</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight leading-tight mb-6">
                Terms & Conditions
              </h1>
              <p className="text-gray-500 text-lg font-medium max-w-2xl leading-relaxed">
                Welcome to {siteName}. Please read these terms and conditions carefully before booking your Bali experiences. By booking with us, you agree to be bound by these policies.
              </p>
              
              <div className="flex flex-wrap items-center gap-6 mt-8 text-xs font-semibold text-gray-400">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  Last Updated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="hidden md:inline text-gray-300">•</span>
                <button 
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  Print Agreement
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
                <h3 className="font-extrabold text-xs text-gray-400 mb-4 uppercase tracking-widest flex items-center gap-2">
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
                          ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]'
                          : 'text-gray-500 hover:text-gray-950 hover:bg-gray-100/70'
                      }`}
                    >
                      {section.label}
                    </a>
                  ))}
                </nav>
              </div>

              {/* Need help contact callout */}
              <div className="bg-orange-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4">
                  <Scale className="h-32 w-32" />
                </div>
                <h4 className="font-extrabold text-sm mb-2 uppercase tracking-wider">Have Questions?</h4>
                <p className="text-xs text-orange-100/80 mb-4 leading-relaxed">
                  If any policy seems unclear, our operations helpdesk is here to explain details live.
                </p>
                <div className="space-y-2 text-xs font-mono">
                  <p className="flex items-center gap-2">
                    <span className="text-primary">E:</span> {supportEmail}
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="text-primary">P:</span> {supportPhone}
                  </p>
                </div>
              </div>
            </aside>

            {/* Main Terms text container */}
            <main className="lg:col-span-3 space-y-12 max-w-none">
              
              {/* Introduction */}
              <section id="intro" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-orange-50 rounded-lg flex items-center justify-center text-primary">
                    <Scale className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">1. Introduction</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    These Booking Terms and Conditions ("Agreement") govern the contractual relationship between you (referred to as the "Traveler", "Client", or "User") and <strong>{siteName}</strong> ("Company", "we", "us", or "our") concerning all trip bookings, excursions, customized itineraries, transfers, and experiences listed under our domain.
                  </p>
                  <p>
                    By checking any booking verification consent, using our website, or submitting reservations through our platform (including our WhatsApp integrations, live advisors, or email system), you confirm that you have read, understood, and agreed to be legally bound by this entire Agreement.
                  </p>
                  <p>
                    If you are booking on behalf of others, you warrant that you have the explicit legal authority to accept these Terms on behalf of all members of your travel party and that you are responsible for ensuring they comply with all rules and requirements.
                  </p>
                </div>
              </section>

              {/* Booking & Confirmation */}
              <section id="bookings" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-orange-50 rounded-lg flex items-center justify-center text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">2. Booking & Confirmation</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    All reservations must be made online, via our authorized booking links, or through verified communication agents. Bookings are considered <strong>confirmed</strong> only when you receive an official confirmation voucher specifying your Booking ID via email or WhatsApp.
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Pricing:</strong> All rates are quoted in the specified currency on the checkout page (supporting IDR, USD, AUD, etc.). Rates are subject to change without notice until a booking is fully paid and confirmed.</li>
                    <li><strong>Payment Requirements:</strong> Unless explicitly agreed otherwise (e.g., "Pay on Departure" options), all bookings require full payment or a specified deposit at the time of reservation.</li>
                    <li><strong>Accuracy of Information:</strong> You are solely responsible for verifying that your contact details, travel dates, passport names, and pickup locations are correct in the booking voucher. Any discrepancies must be reported to our support helpdesk immediately.</li>
                  </ul>
                </div>
              </section>

              {/* Cancellation & Refunds */}
              <section id="cancellation" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600">
                    <AlertCircle className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">3. Cancellation & Refunds</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    We understand that travel plans can change. Our cancellation and refund guidelines are structured to be fair to both travelers and our local operators who hold spots for your exclusive attendance.
                  </p>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 my-6">
                    <h4 className="font-extrabold text-sm text-gray-900 mb-3 uppercase tracking-wider">Standard Cancellation Window:</h4>
                    <div className="grid gap-4 text-sm">
                      <div className="flex justify-between border-b border-gray-200/50 pb-2">
                        <span className="font-semibold text-gray-700">More than 48 hours before activity:</span>
                        <span className="font-bold text-primary">Full Refund (100%)</span>
                      </div>
                      <div className="flex justify-between border-b border-gray-200/50 pb-2">
                        <span className="font-semibold text-gray-700">24 to 48 hours before activity:</span>
                        <span className="font-bold text-amber-600">50% Refund</span>
                      </div>
                      <div className="flex justify-between pb-1">
                        <span className="font-semibold text-gray-700">Less than 24 hours or No Show:</span>
                        <span className="font-bold text-red-600">No Refund (0%)</span>
                      </div>
                    </div>
                  </div>
                  <p>
                    <strong>Force Majeure & Volcano Policy:</strong> Bali lies within an active volcanic zone. If a tour is canceled by {siteName} due to volcanic eruptions, flight cancellations causing airport closure, earthquakes, or other severe weather anomalies:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>We will first offer free rescheduling to any alternative date.</li>
                    <li>If rescheduling is impossible, a full refund of the activity cost (less bank processing/payment gateway fees) will be processed.</li>
                  </ul>
                </div>
              </section>

              {/* Traveler Responsibilities */}
              <section id="responsibilities" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-orange-50 rounded-lg flex items-center justify-center text-primary">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">4. Traveler Responsibilities</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    When embarking on excursions in Bali, you are expected to observe basic safety protocols and behave respectfully.
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li><strong>Travel Insurance:</strong> We highly recommend that all travelers purchase comprehensive travel insurance covering personal injury, emergency medical costs, evacuation, and trip cancellations.</li>
                    <li><strong>Health Conditions:</strong> Certain strenuous excursions (e.g., Mount Batur Sunrise Trekking, Scuba Diving, ATV tours) require adequate physical fitness. You must disclose any medical conditions (pregnancy, heart conditions, severe asthma) prior to booking.</li>
                    <li><strong>Customs & Dress Codes:</strong> When visiting sacred Balinese temples (like Besakih, Uluwatu, or Lempuyang), you must wear appropriate attire (sarongs and sashes are often provided on-site) and respect local ceremonies.</li>
                  </ul>
                </div>
              </section>

              {/* Limitation of Liability */}
              <section id="liability" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-orange-50 rounded-lg flex items-center justify-center text-primary">
                    <Scale className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">5. Limitation of Liability</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    To the maximum extent permitted by applicable law, <strong>{siteName}</strong> acts as an agent connecting travelers with local transport operators, instructors, and guides. We do not assume direct liability for:
                  </p>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>Personal injury, property damage, loss, or death sustained during any adventure tour (such as rafting, diving, swinging, climbing, or driving), except in cases of proven gross negligence on our direct part.</li>
                    <li>Delays or modifications caused by traffic congestion (common in Kuta, Ubud, Seminyak, or Uluwatu roads), road closures, religious processions, or ceremony blockages.</li>
                    <li>Loss of personal items (cameras, mobile phones, sunglasses) during transport or active excursions.</li>
                  </ul>
                </div>
              </section>

              {/* Governing Law */}
              <section id="governing-law" className="scroll-mt-32 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-orange-50 rounded-lg flex items-center justify-center text-primary">
                    <Scale className="h-4 w-4" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">6. Governing Law</h2>
                </div>
                <div className="prose prose-slate max-w-none text-gray-600 leading-relaxed space-y-4">
                  <p>
                    These terms, conditions, and any disputes arising out of your booking shall be governed and interpreted in accordance with the laws of the <strong>Republic of Indonesia</strong>. Any mediation, arbitration, or legal actions shall be resolved in the appropriate jurisdiction in Bali, Indonesia.
                  </p>
                </div>
              </section>

              {/* Helpful section feedback */}
              <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100/80 flex flex-col md:flex-row items-center justify-between gap-6 mt-16">
                <div>
                  <h4 className="font-extrabold text-base text-gray-900">Was this legal agreement helpful?</h4>
                  <p className="text-sm text-gray-400 mt-1">We update our policies regularly to ensure a clear and transparent relationship.</p>
                </div>
                
                {feedbackSubmitted ? (
                  <div className="flex items-center gap-2 text-primary font-bold text-sm">
                    <ShieldCheck className="h-5 w-5" /> Thank you for your feedback!
                  </div>
                ) : (
                  <button
                    onClick={() => setFeedbackSubmitted(true)}
                    className="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold text-xs px-6 py-3 rounded-xl uppercase tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
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
