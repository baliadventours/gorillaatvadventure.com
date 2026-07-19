import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Booking } from '../types';
import * as Icons from 'lucide-react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import FormattedPrice from '../components/FormattedPrice';
import { motion } from 'motion/react';
import { useSettings } from '../lib/SettingsContext';
import QRCode from 'react-qr-code';
import { getWhatsAppLink, generateBookingMessage } from '../lib/whatsappService';
import { collection, onSnapshot, query, where, limit } from 'firebase/firestore';
import { parseMeetingPoint } from '../lib/utils';

export default function BookingSuccess() {
  const { settings } = useSettings();
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);
  const [tour, setTour] = useState<any>(null);
  const [commSettings, setCommSettings] = useState<any>(null);

  useEffect(() => {
    // Fetch communication settings for WA templates
    const unsub = onSnapshot(doc(db, 'communicationSettings', 'global'), (snap) => {
      if (snap.exists()) setCommSettings(snap.data());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      try {
        const [bookingSnap, settingsSnap] = await Promise.all([
          getDoc(doc(db, 'bookings', id)),
          getDoc(doc(db, 'settings', 'payment'))
        ]);

        if (bookingSnap.exists()) {
          const bookingData = { id: bookingSnap.id, ...bookingSnap.data() } as Booking;
          setBooking(bookingData);
          
          if (bookingData.tourId) {
            const tourSnap = await getDoc(doc(db, 'tours', bookingData.tourId));
            if (tourSnap.exists()) {
              setTour(tourSnap.data());
            }
          }
        }
        if (settingsSnap.exists()) {
          setPaymentSettings(settingsSnap.data());
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-gray-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="container mx-auto px-4 py-20 text-center bg-white text-gray-900">
        <h1 className="text-4xl font-black text-gray-900 uppercase">Booking Not Found</h1>
        <p className="mt-4 text-gray-500 font-medium">We couldn't find the booking you were looking for.</p>
        <Link to="/" className="mt-8 inline-block rounded-full bg-gray-900 px-10 py-4 font-black text-white uppercase tracking-widest text-xs transition-all hover:bg-black">
          Return Home
        </Link>
      </div>
    );
  }

  if (booking.status !== 'confirmed') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 pt-32 pb-20 font-sans">
        <div className="max-w-xl w-full">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-[40px] p-10 md:p-16 shadow-2xl shadow-gray-200 text-center relative overflow-hidden"
          >
            {/* Decorative background circle */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -mr-10 -mt-10" />
            
            <div className="relative z-10">
              <div className="h-20 w-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
                {booking.status === 'pending' || booking.status === 'review_required' ? (
                  <Clock className="h-10 w-10 text-amber-500 animate-pulse" />
                ) : (
                  <XCircle className="h-10 w-10 text-red-500" />
                )}
              </div>

              <h1 className="text-2xl md:text-3xl font-black text-gray-900 mb-6 tracking-tight uppercase">
                {booking.status === 'pending' || booking.status === 'review_required' ? 'Booking Processing' : 'Booking ' + booking.status}
              </h1>

              {booking.id && (
                <div className="mb-8 p-4 bg-gray-50 rounded-2xl border border-gray-100 inline-block">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Booking Reference</span>
                  <span className="text-xl font-black text-primary font-mono tracking-tighter">#{booking.id}</span>
                </div>
              )}

              <div className="space-y-6 text-gray-500 font-medium leading-relaxed mb-12">
                {booking.status === 'pending' || booking.status === 'review_required' ? (
                  <>
                    <p className="text-gray-900 font-bold">
                      Check your inbox! We've sent an email to <span className="text-primary">{booking.customerData?.email || 'your email address'}</span> with:
                    </p>
                    
                    <ul className="text-left bg-gray-50/50 p-6 rounded-2xl space-y-3 text-sm">
                      <li className="flex gap-3">
                        <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                        Detailed summary of your trip details
                      </li>
                      <li className="flex gap-3">
                        <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                        Step-by-step instructions on how to pay
                      </li>
                      <li className="flex gap-3">
                        <CheckCircle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                        Voucher download link (after payment is verified)
                      </li>
                    </ul>

                    <div className="pt-6 border-t border-gray-100">
                      <p className="text-xs italic bg-orange-50 text-orange-700 p-4 rounded-xl">
                        <strong>Pro-Tip:</strong> To track your booking and manage your trips easily, we recommend <Link to="/auth?mode=signup" className="underline font-black">signing up</Link> using the same email you used for this booking.
                      </p>
                    </div>
                  </>
                ) : (
                  <p>This booking is {booking.status}. Vouchers are only available for confirmed bookings.</p>
                )}
              </div>

              <div className="grid gap-3">
                <Link 
                  to="/customer/bookings" 
                  className="w-full h-14 bg-gray-900 text-white rounded-2xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest shadow-xl shadow-gray-200 hover:bg-gray-800 transition-all group"
                >
                  Go to Dashboard <Icons.ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
                
                <Link 
                  to={`/track-booking?id=${booking.id}`}
                  className="w-full h-14 bg-white border-2 border-gray-100 text-gray-900 rounded-2xl flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-widest hover:border-primary hover:text-primary transition-all"
                >
                  Track Without Account <Icons.Search className="h-4 w-4" />
                </Link>

                <Link 
                  to="/" 
                  className="w-full h-14 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center font-black text-[10px] uppercase tracking-widest hover:text-gray-600 transition-all"
                >
                  Return Home
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] py-12 px-4 selection:bg-primary/20 booking-success-page print:p-0 print:bg-white text-gray-900">
      <div className="mx-auto max-w-4xl print:max-w-none">
        
        {/* Header Actions - Hidden on Print */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6 no-print">
          <div className="text-center md:text-left">
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter">Booking Confirmed</h1>
            <p className="text-sm font-medium text-gray-500 mt-1">Your adventure is ready. Print your voucher below.</p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-full bg-gray-900 px-8 py-3.5 text-xs font-black text-white transition-all hover:bg-black active:scale-95 shadow-xl hover:shadow-black/20"
            >
              Print Voucher
            </button>
            <Link 
              to="/"
              className="flex items-center gap-2 rounded-full bg-white border border-gray-200 px-8 py-3.5 text-xs font-black text-gray-600 transition-all hover:bg-gray-50 active:scale-95"
            >
              Explore More
            </Link>
          </div>
        </div>

        {/* THE VOUCHER CARD */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[40px] shadow-[0_48px_96px_-24px_rgba(0,0,0,0.08)] overflow-hidden border border-gray-100 voucher-card print:border-gray-200 print:shadow-none print:rounded-[20px]"
        >
          {/* Header Branding */}
          <div className="p-8 md:p-12 border-b border-gray-50 flex flex-col md:flex-row justify-between items-center text-center md:text-left gap-8 bg-gray-50/30 print:p-8 print:bg-white">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="h-20 w-20 rounded-2xl bg-white p-3 shadow-sm flex items-center justify-center print:h-16 print:w-16">
                {settings?.logoURL ? (
                  <img 
                    src={settings.logoURL} 
                    alt={settings.siteName} 
                    className="max-h-full max-w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full bg-primary rounded-xl flex items-center justify-center text-white font-black text-2xl">
                    {settings?.siteName?.charAt(0)}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase">{settings?.siteName}</h2>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest">
                  Official Experience Voucher
                </div>
              </div>
            </div>
            
            <div className="md:text-right">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Voucher Reference</p>
              <div className="inline-block px-5 py-2 bg-white rounded-xl border border-gray-100 shadow-sm">
                <p className="text-xl font-mono font-black text-primary tracking-tighter">#{booking.id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
          </div>

          <div className="p-8 md:p-12 print:p-8">
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 print:gap-8">
              
              {/* Details Column */}
              <div className="space-y-10">
                <div className="voucher-section">
                  <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] mb-4">You're going to</h3>
                  <h4 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight tracking-tight print:text-2xl">{booking.tourTitle}</h4>
                  <div className="flex items-center gap-2 mt-3 p-3 bg-gray-50 rounded-xl border border-gray-100 w-fit">
                    <CheckCircle className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-bold text-gray-600">{booking.packageName}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 voucher-section">
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</p>
                    <p className="text-base font-black text-gray-900">{booking.date}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Arrival</p>
                    <p className="text-base font-black text-gray-900">{booking.time || "TBA"}</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Guest(s)</p>
                    <p className="text-base font-black text-gray-900">{booking.participants.adults + booking.participants.children} Persons</p>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment</p>
                    <p className={`text-base font-black ${booking.paymentStatus === 'paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {booking.paymentStatus === 'paid' ? 'Fully Paid' : 'Pending'}
                    </p>
                  </div>
                </div>

                {/* Transport & Location Details */}
                <div className="pt-6 border-t border-gray-50 space-y-3 voucher-section">
                  {(() => {
                    const isMeetingPoint = !booking.customerData?.pickupAddress || 
                      booking.selectedTransport?.type === 'meet' ||
                      booking.selectedTransport?.name?.toLowerCase().includes("own transport") ||
                      booking.selectedTransport?.name?.toLowerCase().includes("meet on location") ||
                      booking.customerData.pickupAddress.includes("Meet") || 
                      booking.customerData.pickupAddress.toLowerCase().includes("basecamp") ||
                      booking.customerData.pickupAddress.toLowerCase().includes("operation") ||
                      booking.customerData.pickupAddress.includes("maps.app.goo.gl") ||
                      booking.customerData.pickupAddress.includes("google.com/maps");
                    
                    if (isMeetingPoint) {
                      const mp = parseMeetingPoint(booking.customerData?.pickupAddress);
                      return (
                        <>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Meeting Point Location
                          </p>
                          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 text-left space-y-2.5">
                            <div className="flex items-start gap-2">
                              <Icons.MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                              <div className="space-y-1">
                                <span className="text-sm font-black text-slate-900 block">{mp.venue}</span>
                                {mp.address && mp.address !== mp.venue && (
                                  <p className="text-xs text-gray-500 font-bold leading-relaxed">{mp.address}</p>
                                )}
                              </div>
                            </div>
                            <div className="pl-6 border-t border-gray-200/50 pt-2">
                              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1">Direct Google Maps Link:</span>
                              <a 
                                href={mp.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-extrabold text-primary hover:underline break-all inline-block"
                              >
                                {mp.url}
                              </a>
                            </div>
                          </div>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                            Hotel Pickup Address
                          </p>
                          <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                            <p className="text-sm font-bold text-gray-900 leading-relaxed">
                              {booking.customerData.pickupAddress}
                            </p>
                          </div>
                        </>
                      );
                    }
                  })()}
                </div>

                <div className="pt-8 border-t border-gray-50 voucher-section">
                  <h3 className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] mb-5">Lead Guest Details</h3>
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-lg font-black text-gray-400">
                      {booking.customerData.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-lg font-black text-gray-900">{booking.customerData.fullName}</p>
                      <div className="flex items-center gap-4 text-xs font-bold text-gray-500 mt-0.5">
                        <span>{booking.customerData.phone}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* QR & Info Column */}
              <div className="space-y-10">
                <div className="bg-gray-900 rounded-[32px] p-8 text-center text-white print:bg-white print:text-black print:border print:border-gray-100 print:rounded-2xl voucher-section">
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-6 print:text-gray-400">Check-in Scan</p>
                  <div className="bg-white p-4 rounded-2xl inline-block mb-6 shadow-xl print:shadow-none print:border print:border-gray-100">
                    <QRCode 
                      value={`${window.location.origin}/admin/booking/${booking.id}`}
                      size={140}
                      style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                      viewBox={`0 0 256 256`}
                    />
                  </div>
                  <p className="text-[9px] font-bold text-white/60 leading-relaxed uppercase tracking-tighter print:text-gray-400">
                    Present this code at the terminal or to your guide.
                  </p>
                </div>

                <div className="p-6 bg-gray-50 rounded-[24px] border border-gray-100 print:bg-white voucher-section">
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Price</span>
                    <span className="text-2xl font-black text-gray-900 tracking-tighter"><FormattedPrice amount={booking.totalAmount} /></span>
                  </div>
                  <div className="pt-6 border-t border-gray-200">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Support</p>
                    <div className="space-y-3">
                       {settings?.supportPhone && (
                         <button 
                           onClick={() => {
                             const template = commSettings?.whatsappTemplates?.booking_status_updated?.message || 
                               "Hi, I have a question about my booking {{bookingId}} for {{tourTitle}}.";
                             const message = generateBookingMessage(template, booking!);
                             const link = getWhatsAppLink(settings.supportPhone!, message);
                             window.open(link, '_blank');
                           }}
                           className="flex items-center gap-3 w-full p-3 rounded-xl bg-orange-50 text-orange-700 hover:bg-orange-100 transition-all text-xs font-black uppercase tracking-tight"
                         >
                           <Icons.MessageSquare className="h-4 w-4" />
                           Contact Support (WA)
                         </button>
                       )}
                       <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                         <Icons.Phone className="h-3 w-3 text-primary" />
                         {settings?.supportPhone}
                       </div>
                       <div className="flex items-center gap-2 text-xs font-bold text-gray-700">
                         <Icons.Mail className="h-3 w-3 text-primary" />
                         {settings?.supportEmail}
                       </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 py-6 px-12 border-t border-gray-100 text-center print:bg-white print:py-4">
             <p className="text-[9px] font-black text-gray-300 uppercase tracking-[0.6em]">
               Thank you for choosing {settings?.siteName}
             </p>
          </div>
        </motion.div>

        <div className="mt-8 text-center no-print">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
            A copy has been sent to {booking.customerData.email}
          </p>
        </div>
      </div>
    </div>
  );
}
