import React, { useState, useEffect, useMemo } from 'react';
import { useOutletContext, Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Calendar, 
  Users, 
  MapPin, 
  DollarSign, 
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Filter,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  RefreshCw,
  Ban,
  Briefcase,
  Star,
  MessageSquare,
  X,
  Send,
  Loader2,
  QrCode,
  Car,
  Image as ImageIcon
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, doc, addDoc, updateDoc, serverTimestamp, documentId, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Booking, UserProfile, Tour, Review, AddOn } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { sendBookingEmail } from '../../lib/emailService';

import { useSettings } from '../../lib/SettingsContext';
import { formatPrice } from '../../lib/utils';
import { generateTourVoucherPdf } from '../../lib/pdfGenerator';

type FilterType = 'All' | 'Upcoming' | 'Completed' | 'Cancelled';

export default function Bookings() {
  const { user, profile } = useOutletContext<{ user: any; profile: UserProfile }>();
  const { settings } = useSettings();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tours, setTours] = useState<Record<string, Tour>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const navigate = useNavigate();

  // Edit Booking State
  const [editDate, setEditDate] = useState('');
  const [editAdults, setEditAdults] = useState(1);
  const [editChildren, setEditChildren] = useState(0);
  const [editSpecialReq, setEditSpecialReq] = useState('');
  const [editSelectedAddOns, setEditSelectedAddOns] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [allTourAddOns, setAllTourAddOns] = useState<AddOn[]>([]);

  // Review Form State
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  useEffect(() => {
    async function fetchBookings() {
      if (!user) return;
      
      try {
        setLoading(true);
        // 1. Fetch by userId (logged in account)
        const qUser = query(
          collection(db, 'bookings'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        
        // 2. Fetch by email (guest bookings with same email)
        const normalizedEmail = user.email?.toLowerCase();
        const rawEmail = user.email;

        const queries = [
          getDocs(query(collection(db, 'bookings'), where('userId', '==', user.uid))),
          getDocs(query(collection(db, 'bookings'), where('customerData.email', '==', normalizedEmail)))
        ];

        if (rawEmail && rawEmail !== normalizedEmail) {
          queries.push(getDocs(query(collection(db, 'bookings'), where('customerData.email', '==', rawEmail))));
        }

        // Also try capitalized version (e.g. Kadek@gmail.com)
        if (normalizedEmail && normalizedEmail.includes('@')) {
          const parts = normalizedEmail.split('@');
          const capitalized = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '@' + parts[1];
          if (capitalized !== normalizedEmail && capitalized !== rawEmail) {
            queries.push(getDocs(query(collection(db, 'bookings'), where('customerData.email', '==', capitalized))));
          }
        }

        const snapshots = await Promise.all(queries);
        
        let allBookings: Booking[] = [];
        snapshots.forEach(snap => {
          const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
          allBookings = [...allBookings, ...docs];
        });
        
        // Deduplicate by ID
        const combinedMap = new Map<string, Booking>();
        allBookings.forEach(b => {
          combinedMap.set(b.id, b);
        });
        const combined = Array.from(combinedMap.values());
        
        // Sort by createdAt desc
        combined.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return dateB - dateA;
        });

        setBookings(combined);

        // Fetch tour details for slugs
        if (combined.length > 0) {
          const tourIds = Array.from(new Set(combined.map(b => b.tourId)));
          const tourMap: Record<string, Tour> = {};
          
          // Fetch in chunks of 10
          for (let i = 0; i < tourIds.length; i += 10) {
            const chunk = tourIds.slice(i, i + 10);
            const tourQ = query(collection(db, 'tours'), where(documentId(), 'in', chunk));
            const tourSnap = await getDocs(tourQ);
            tourSnap.docs.forEach(doc => {
              const data = doc.data() as Tour;
              tourMap[doc.id] = { id: doc.id, ...data };
            });
          }
          setTours(tourMap);
        }
      } catch (err) {
        console.error("Error fetching bookings:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchBookings();
  }, [user]);

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.tourTitle.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          booking.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filter === 'All') return matchesSearch;
    
    const bookingDate = new Date(booking.date);
    const now = new Date();
    
    if (filter === 'Upcoming') return matchesSearch && booking.status === 'confirmed' && bookingDate >= now;
    if (filter === 'Completed') return matchesSearch && booking.status === 'confirmed' && bookingDate < now;
    if (filter === 'Cancelled') return matchesSearch && booking.status === 'cancelled';
    
    return matchesSearch;
  });

  const getStatusStyles = (status: string, date: string) => {
    const bookingDate = new Date(date);
    const now = new Date();

    if (status === 'cancelled') return { label: 'Cancelled', icon: XCircle, className: 'bg-red-50 text-red-600' };
    if (status === 'review_required') return { label: 'Review Required', icon: AlertCircle, className: 'bg-purple-50 text-purple-600 animate-pulse' };
    if (status === 'pending') return { label: 'Pending Approval', icon: Clock, className: 'bg-amber-50 text-amber-600' };
    if (bookingDate < now) return { label: 'Completed', icon: CheckCircle2, className: 'bg-blue-50 text-blue-600' };
    return { label: 'Confirmed', icon: CheckCircle2, className: 'bg-orange-50 text-primary' };
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingBooking || !user) return;
    setReviewSubmitting(true);

    try {
      const reviewData: Omit<Review, 'id'> = {
        tourId: reviewingBooking.tourId,
        tourTitle: reviewingBooking.tourTitle,
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Guest',
        userPhoto: profile?.photoURL || user.photoURL,
        rating: reviewRating,
        title: reviewTitle,
        comment: reviewComment,
        status: 'pending',
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, 'reviews'), reviewData);
      setReviewingBooking(null);
      setReviewRating(5);
      setReviewTitle('');
      setReviewComment('');
      // Optionally show success toast
    } catch (err) {
      console.error("Error submitting review:", err);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const startEditing = async (booking: Booking) => {
    setEditingBooking(booking);
    setEditDate(booking.date);
    setEditAdults(booking.participants.adults);
    setEditChildren(booking.participants.children);
    setEditSpecialReq(booking.customerData.specialRequirements || '');
    setEditSelectedAddOns(booking.selectedAddOns);

    // Fetch all possible add-ons for this tour
    try {
      const tourDoc = await getDocs(query(collection(db, 'tours'), where(documentId(), '==', booking.tourId)));
      if (!tourDoc.empty) {
        const tourData = tourDoc.docs[0].data() as Tour;
        if (tourData.addOnIds && tourData.addOnIds.length > 0) {
          const addonsQ = query(collection(db, 'globalAddOns'), where(documentId(), 'in', tourData.addOnIds));
          const addonsSnap = await getDocs(addonsQ);
          setAllTourAddOns(addonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AddOn)));
        } else {
          setAllTourAddOns([]);
        }
      }
    } catch (err) {
      console.error("Error fetching add-ons for edit:", err);
    }
  };

  const recalculatedSummary = useMemo(() => {
    if (!editingBooking) return null;
    const tour = tours[editingBooking.tourId];
    if (!tour) return { total: editingBooking.totalAmount, adultRate: 0, childRate: 0, packageTotal: 0, addonsTotal: 0 };

    const pkg = tour.packages.find(p => p.name === editingBooking.packageName);
    if (!pkg?.tiers) return { total: editingBooking.totalAmount, adultRate: 0, childRate: 0, packageTotal: 0, addonsTotal: 0 };

    const adultTier = pkg.tiers.find(t => editAdults >= t.minParticipants && editAdults <= t.maxParticipants) || 
                 (editAdults < pkg.tiers[0].minParticipants ? pkg.tiers[0] : pkg.tiers[pkg.tiers.length - 1]);
    
    const childTier = editChildren > 0 
      ? (pkg.tiers.find(t => editChildren >= t.minParticipants && editChildren <= t.maxParticipants) || 
         (editChildren < pkg.tiers[0].minParticipants ? pkg.tiers[0] : pkg.tiers[pkg.tiers.length - 1]))
      : adultTier;

    const adultRate = adultTier.adultPrice;
    const childRate = childTier.childPrice;
    const packageTotal = (adultRate * editAdults) + (childRate * editChildren);
    
    const addonsTotal = editSelectedAddOns.reduce((sum, a) => sum + (a.price * a.quantity), 0);
    
    let discount = 0;
    if (editingBooking.couponCode) {
      discount = editingBooking.discountAmount || 0;
    }

    return {
      adultRate,
      childRate,
      packageTotal,
      addonsTotal,
      total: Math.max(0, packageTotal + addonsTotal - discount)
    };
  }, [editingBooking, editAdults, editChildren, editSelectedAddOns, tours]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBooking || !recalculatedSummary) return;
    setEditLoading(true);

    try {
      const oldPrice = editingBooking.totalAmount;
      const newPrice = recalculatedSummary.total;
      
      const updateData: Partial<Booking> = {
        date: editDate,
        participants: {
          adults: editAdults,
          children: editChildren
        },
        selectedAddOns: editSelectedAddOns,
        customerData: {
          ...editingBooking.customerData,
          specialRequirements: editSpecialReq
        },
        totalAmount: newPrice,
        pricingBreakdown: {
          adultRate: recalculatedSummary.adultRate,
          childRate: recalculatedSummary.childRate,
          packageTotal: recalculatedSummary.packageTotal
        },
        updatedAt: serverTimestamp()
      };

      // For ANY change, we now move to "review_required" status
      // We'll store the changes in proposedUpdate if we want to show a diff, 
      // but for now let's just update the booking and set status to review_required
      // so the admin knows something changed and needs approval.
      
      const finalUpdateData = {
        ...updateData,
        status: 'review_required' as const,
        proposedUpdate: {
          oldDate: editingBooking.date,
          oldTotal: editingBooking.totalAmount,
          oldParticipants: editingBooking.participants,
          changeDate: serverTimestamp()
        }
      };

      // Check price difference
      if (newPrice > oldPrice) {
        // Redir to payment
        const confirmed = confirm(`The updated trip total is $${newPrice} ($${newPrice - oldPrice} more). You will be redirected to pay the difference. Once paid, the changes will be sent to admin for review.`);
        if (!confirmed) {
          setEditLoading(false);
          return;
        }
        
        await updateDoc(doc(db, 'bookings', editingBooking.id), {
          ...finalUpdateData,
          paymentStatus: 'pending'
        });
        
        // Send enhanced email notification
        const proposedBooking = { ...editingBooking, ...finalUpdateData } as Booking;
        const extraData = {
          priceChanged: true,
          difference: newPrice - oldPrice,
          direction: 'increase',
          needsReview: true
        };
        
        await Promise.all([
          sendBookingEmail('booking_change_request', proposedBooking, extraData),
          sendBookingEmail('admin_booking_change_request', proposedBooking, extraData),
          sendBookingEmail('supplier_booking_change_request', proposedBooking, extraData)
        ]).catch(err => console.error("Error sending booking change emails:", err));

        // Redirect to checkout with bookingId and tourId
        navigate(`/checkout/${editingBooking.tourId}?bookingId=${editingBooking.id}&upgrade=true`);
        return;
      }

      await updateDoc(doc(db, 'bookings', editingBooking.id), finalUpdateData);
      
      // Send enhanced email notification
      const proposedBooking = { ...editingBooking, ...finalUpdateData } as Booking;
      const extraData = {
        priceChanged: newPrice !== oldPrice,
        difference: Math.abs(oldPrice - newPrice),
        direction: newPrice < oldPrice ? 'decrease' : 'none',
        needsReview: true
      };
      
      await Promise.all([
        sendBookingEmail('booking_change_request', proposedBooking, extraData),
        sendBookingEmail('admin_booking_change_request', proposedBooking, extraData),
        sendBookingEmail('supplier_booking_change_request', proposedBooking, extraData)
      ]).catch(err => console.error("Error sending booking change emails:", err));

      // Update local state
      setBookings(prev => prev.map(b => b.id === editingBooking.id ? { ...b, ...finalUpdateData } as Booking : b));
      setEditingBooking(null);
      
      if (newPrice < oldPrice) {
        alert("Trip update proposed! Your status is now 'Review Required'. Since the new price is lower, an admin will review and process your refund of $" + (oldPrice - newPrice).toFixed(2));
      } else {
        alert("Trip update proposed! Your status is now 'Review Required'. An admin will review and approve your changes shortly.");
      }
    } catch (err: any) {
      console.error("Error updating booking:", err);
      alert("Failed to update booking: " + (err.message || "Unknown error"));
    } finally {
      setEditLoading(false);
    }
  };

  const handleCancelBooking = async (booking: Booking) => {
    if (!confirm("Are you sure you want to request a cancellation for this booking? This request will be sent to our staff for approval.")) return;
    try {
      const updateData = {
        status: 'review_required' as const,
        cancellationRequested: true
      };
      await updateDoc(doc(db, 'bookings', booking.id), updateData);
      
      const updatedBooking = { ...booking, ...updateData } as Booking;

      // Send cancellation emails to all roles
      await Promise.all([
        sendBookingEmail('booking_cancellation_request', updatedBooking),
        sendBookingEmail('admin_booking_cancellation_request', updatedBooking),
        sendBookingEmail('supplier_booking_cancellation_request', updatedBooking)
      ]).catch(err => console.error("Error sending cancellation request emails:", err));

      setBookings(prev => prev.map(b => b.id === booking.id ? { ...b, status: 'review_required', cancellationRequested: true } : b));
      alert("Cancellation request submitted successfully. Our administrative team will review and approve your cancellation request shortly.");
    } catch (err) {
      console.error("Error requesting cancellation:", err);
      alert("Failed to submit cancellation request.");
    }
  };

  const handlePrintVoucher = async (booking: Booking) => {
    const doc = await generateTourVoucherPdf(booking, settings);
    doc.save(`Voucher-${booking.id.toUpperCase()}.pdf`);
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">My Bookings</h1>
        <p className="text-gray-500">View and manage all your tour bookings</p>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-[20px] shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search by tour name, location, or booking ID..."
            className="w-full bg-gray-50 border-none rounded-[12px] pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {(['All', 'Upcoming', 'Completed', 'Cancelled'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-6 py-3 rounded-[12px] text-sm font-bold transition-all whitespace-nowrap",
                filter === f 
                  ? "bg-[#00A651] text-white shadow-lg shadow-orange-100" 
                  : "bg-gray-50 text-gray-500 hover:bg-gray-100"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-white rounded-[24px] border border-gray-100 animate-pulse" />
          ))
        ) : filteredBookings.length > 0 ? (
          filteredBookings.map((booking) => {
            const status = getStatusStyles(booking.status, booking.date);
            const tour = tours[booking.tourId];
            const isCompleted = new Date(booking.date) < new Date() && booking.status === 'confirmed';

            return (
              <motion.div
                key={booking.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[24px] border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="w-full md:w-64 h-48 md:h-auto bg-gray-100 relative overflow-hidden">
                    <img 
                      src={tour?.featuredImage || `https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=800`} 
                      alt={booking.tourTitle}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute top-4 left-4">
                      <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold backdrop-blur-md shadow-sm", status.className)}>
                        <status.icon className="h-3 w-3" />
                        {status.label}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                           <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Booking ID: {booking.id.slice(0, 8)}...</span>
                        </div>
                        {tour ? (
                          <Link to={`/tour/${tour.slug || tour.id}`} className="block group/title">
                            <h3 className="text-xl font-bold text-gray-900 group-hover/title:text-[#00A651] transition-colors flex items-center gap-2">
                              {booking.tourTitle}
                              <ExternalLink className="h-4 w-4 opacity-0 group-hover/title:opacity-100 transition-opacity" />
                            </h3>
                          </Link>
                        ) : (
                          <h3 className="text-xl font-bold text-gray-900">{booking.tourTitle}</h3>
                        )}
                      </div>
                      <div className="px-3 py-1 bg-orange-50 text-[#00A651] rounded-full text-[10px] font-bold uppercase tracking-wider">
                        {booking.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Date</p>
                          <p className="text-sm font-bold text-gray-900">{new Date(booking.date).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Guests</p>
                          <p className="text-sm font-bold text-gray-900">{booking.participants.adults + booking.participants.children} Persons</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Location</p>
                          <p className="text-sm font-bold text-gray-900">{tour?.location || 'Bali, Indonesia'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Total</p>
                          <p className="text-sm font-bold text-gray-900">${booking.totalAmount}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center gap-3">
                      <button 
                        onClick={() => setSelectedBooking(booking)}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-all shadow-md active:scale-95"
                      >
                        <Eye className="h-4 w-4" />
                        Details
                      </button>

                      {booking.status === 'confirmed' && (
                        <button 
                          onClick={() => handlePrintVoucher(booking)}
                          className="flex items-center gap-2 px-6 py-3 bg-orange-50 text-[#00A651] rounded-xl text-xs font-bold hover:bg-orange-100 transition-all shadow-sm active:scale-95"
                        >
                          <QrCode className="h-4 w-4" />
                          Print Voucher
                        </button>
                      )}

                      {isCompleted ? (
                        <button 
                          onClick={() => setReviewingBooking(booking)}
                          className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-all shadow-lg shadow-amber-100 active:scale-95"
                        >
                          <Star className="h-4 w-4" />
                          Review Trip
                        </button>
                      ) : null}
                      
                      {booking.status !== 'cancelled' && !isCompleted && (
                        <div className="flex gap-2 sm:ml-auto w-full sm:w-auto mt-2 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-0 border-gray-100">
                          <button 
                            onClick={() => startEditing(booking)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-orange-100 text-[#00A651] rounded-xl text-xs font-bold hover:bg-orange-50 transition-all active:scale-95 shadow-sm"
                          >
                            <RefreshCw className="h-4 w-4" />
                            Edit Trip
                          </button>
                          <button 
                            onClick={() => handleCancelBooking(booking)}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-white border border-red-100 text-red-500 rounded-xl text-xs font-bold hover:bg-red-50 transition-all active:scale-95"
                          >
                            <Ban className="h-4 w-4" />
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="py-20 text-center bg-white rounded-[24px] border border-gray-100">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="h-10 w-10 text-gray-200" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No bookings found</h3>
            <p className="text-gray-500">We couldn't find any bookings matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBooking(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
                <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{selectedBooking.tourTitle}</h2>
                    <p className="text-sm text-gray-500">Booking Reference: {selectedBooking.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedBooking.status === 'confirmed' && (
                      <button 
                        onClick={() => handlePrintVoucher(selectedBooking)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-[#00A651] rounded-xl text-xs font-bold hover:bg-orange-100 transition-all"
                      >
                        <QrCode className="h-4 w-4" />
                        Print Voucher
                      </button>
                    )}
                    <button onClick={() => setSelectedBooking(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                      <X className="h-6 w-6" />
                    </button>
                  </div>
                </div>
              
              <div className="p-8 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Traveler Details</h4>
                      <div className="space-y-2">
                        <p className="text-sm font-bold text-gray-900">{selectedBooking.customerData.fullName}</p>
                        <p className="text-sm text-gray-500">{selectedBooking.customerData.email}</p>
                        <p className="text-sm text-gray-500">{selectedBooking.customerData.phone}</p>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Selection</h4>
                      <p className="text-sm font-bold text-gray-900">{selectedBooking.packageName}</p>
                      <p className="text-sm text-gray-500 mt-1">{selectedBooking.participants.adults} Adults, {selectedBooking.participants.children} Children</p>
                      {selectedBooking.selectedTransport && (
                        <div className="mt-4 p-3 bg-orange-50/50 rounded-2xl border border-orange-100/50 space-y-1">
                          <span className="text-[10px] font-black uppercase text-orange-600 block">Transportation Chosen</span>
                          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                            <Car className="h-4 w-4 text-orange-500 animate-pulse" />
                            {selectedBooking.selectedTransport.name}
                          </p>
                          <p className="text-xs text-gray-500 font-medium">
                            ({selectedBooking.selectedTransport.type === 'meet' ? 'Meet on location' : selectedBooking.selectedTransport.carType || selectedBooking.selectedTransport.type})
                          </p>
                          {selectedBooking.selectedTransport.price > 0 && (
                            <p className="text-xs text-gray-500 font-semibold mt-1">
                              Price: ${selectedBooking.selectedTransport.price} {selectedBooking.selectedTransport.priceType === 'per_person' ? 'per person' : 'flat rate'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Extras & Add-ons</h4>
                      {selectedBooking.selectedAddOns.length > 0 ? (
                        <div className="space-y-2">
                          {selectedBooking.selectedAddOns.map(addon => (
                            <div key={addon.id} className="flex justify-between text-sm">
                              <span className="text-gray-500">{addon.name} (x{addon.quantity})</span>
                              <span className="font-bold text-gray-900">${addon.price * addon.quantity}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">No add-ons selected</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-bold text-gray-900">${selectedBooking.totalAmount + (selectedBooking.discountAmount || 0)}</span>
                  </div>
                  {selectedBooking.discountAmount && (
                    <div className="flex items-center justify-between mb-4 text-red-500">
                      <span>Discount ({selectedBooking.couponCode})</span>
                      <span>-${selectedBooking.discountAmount}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-lg font-bold text-gray-900">Total Charged</span>
                    <span className="text-2xl font-black text-[#00A651]">${selectedBooking.totalAmount}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingBooking(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleEditSubmit}>
                <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Edit Booking</h2>
                    <p className="text-sm text-gray-500">{editingBooking.tourTitle}</p>
                  </div>
                  <button type="button" onClick={() => setEditingBooking(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="p-8 overflow-y-auto max-h-[60vh] space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Date Picker (Simplified for modal) */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Select New Date</label>
                      <input 
                        type="date"
                        required
                        min={new Date().toISOString().split('T')[0]} // Min today
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-[16px] p-4 text-sm focus:ring-2 focus:ring-[#00A651] transition-all font-bold"
                      />
                    </div>

                    {/* Participants */}
                    <div className="space-y-4">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Participants</label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <p className="text-[10px] font-bold text-gray-500 uppercase">Adults</p>
                           <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl">
                             <button type="button" onClick={() => setEditAdults(Math.max(1, editAdults - 1))} className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm font-bold text-lg">-</button>
                             <span className="flex-1 text-center font-black text-lg">{editAdults}</span>
                             <button type="button" onClick={() => setEditAdults(editAdults + 1)} className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm font-bold text-lg">+</button>
                           </div>
                        </div>
                        <div className="space-y-2">
                           <p className="text-[10px] font-bold text-gray-500 uppercase">Children</p>
                           <div className="flex items-center gap-3 bg-gray-50 p-2 rounded-xl">
                             <button type="button" onClick={() => setEditChildren(Math.max(0, editChildren - 1))} className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm font-bold text-lg">-</button>
                             <span className="flex-1 text-center font-black text-lg">{editChildren}</span>
                             <button type="button" onClick={() => setEditChildren(editChildren + 1)} className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shadow-sm font-bold text-lg">+</button>
                           </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Add-ons Section */}
                  {allTourAddOns.length > 0 && (
                    <div className="space-y-4">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Optional Add-ons</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {allTourAddOns.map(addon => {
                          const selected = editSelectedAddOns.find(a => a.id === addon.id);
                          return (
                            <div 
                              key={addon.id}
                              className={cn(
                                "p-4 rounded-[20px] border-2 transition-all cursor-pointer group",
                                selected ? "border-[#00A651] bg-orange-50/30" : "border-gray-50 hover:border-gray-100 bg-white"
                              )}
                              onClick={() => {
                                if (selected) {
                                  setEditSelectedAddOns(prev => prev.filter(p => p.id !== addon.id));
                                } else {
                                  setEditSelectedAddOns(prev => [...prev, { id: addon.id, name: addon.name, price: addon.price, quantity: 1 }]);
                                }
                              }}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <p className="font-bold text-gray-900 group-hover:text-[#00A651] transition-colors">{addon.name}</p>
                                <p className="text-sm font-black text-[#00A651]">${addon.price}</p>
                              </div>
                              <p className="text-[10px] text-gray-500 font-medium">{addon.unit}</p>
                              
                              {selected && (
                                <div className="mt-4 pt-4 border-t border-orange-100 flex items-center justify-between" onClick={e => e.stopPropagation()}>
                                  <p className="text-[10px] font-black text-primary uppercase">Quantity</p>
                                  <div className="flex items-center gap-3">
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setEditSelectedAddOns(prev => prev.map(p => p.id === addon.id ? { ...p, quantity: Math.max(1, p.quantity - 1) } : p));
                                      }}
                                      className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm text-xs"
                                    >-</button>
                                    <span className="text-sm font-black">{selected.quantity}</span>
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setEditSelectedAddOns(prev => prev.map(p => p.id === addon.id ? { ...p, quantity: p.quantity + 1 } : p));
                                      }}
                                      className="w-6 h-6 bg-white rounded-lg flex items-center justify-center shadow-sm text-xs"
                                    >+</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Special Requirements</label>
                    <textarea 
                      value={editSpecialReq}
                      onChange={(e) => setEditSpecialReq(e.target.value)}
                      placeholder="Any additional requests?"
                      className="w-full bg-gray-50 border-none rounded-[16px] p-4 text-sm focus:ring-2 focus:ring-[#00A651] transition-all min-h-[100px]"
                    />
                  </div>

                  {recalculatedSummary && (
                    <div className="p-6 bg-orange-50 rounded-[24px] border border-orange-100 flex items-center justify-between">
                       <div>
                         <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Estimated Total</p>
                         <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-orange-700">${recalculatedSummary.total}</span>
                            {recalculatedSummary.total !== editingBooking.totalAmount && (
                              <div className="flex flex-col">
                                <span className={cn("text-[10px] font-black uppercase", recalculatedSummary.total > editingBooking.totalAmount ? "text-red-500" : "text-primary")}>
                                  {recalculatedSummary.total > editingBooking.totalAmount ? `+$${(recalculatedSummary.total - editingBooking.totalAmount).toFixed(2)} extra` : `-$${(editingBooking.totalAmount - recalculatedSummary.total).toFixed(2)} refund`}
                                </span>
                                <span className="text-xs font-bold text-gray-400 line-through">${editingBooking.totalAmount}</span>
                              </div>
                            )}
                         </div>
                       </div>
                       <div className="text-right">
                          <p className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none mb-1">Rates</p>
                          <p className="text-[10px] text-primary font-medium">${recalculatedSummary.adultRate}/adult, ${recalculatedSummary.childRate}/child</p>
                          <p className="text-[10px] text-primary font-black mt-1">+${recalculatedSummary.addonsTotal} Add-ons</p>
                       </div>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-gray-50/50 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setEditingBooking(null)}
                    className="flex-1 py-4 bg-white border border-gray-200 rounded-[16px] font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Discard Changes
                  </button>
                  <button 
                    type="submit"
                    disabled={editLoading}
                    className="flex-[2] py-4 bg-[#00A651] text-white rounded-[16px] font-bold text-sm hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {editLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
                    Confirm Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Modal */}
      <AnimatePresence>
        {reviewingBooking && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setReviewingBooking(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleReviewSubmit}>
                <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Write a Review</h2>
                    <p className="text-sm text-gray-500">{reviewingBooking.tourTitle}</p>
                  </div>
                  <button type="button" onClick={() => setReviewingBooking(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                
                <div className="p-8 space-y-6">
                  <div className="text-center">
                    <p className="text-sm font-bold text-gray-900 mb-3">How was your experience?</p>
                    <div className="flex items-center justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setReviewRating(star)}
                          className="p-1 transition-transform active:scale-110"
                        >
                          <Star 
                            className={cn(
                              "h-10 w-10 transition-colors",
                              star <= reviewRating ? "fill-amber-400 text-amber-400" : "text-gray-200"
                            )} 
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Review Headline</label>
                    <input 
                      type="text"
                      required
                      value={reviewTitle}
                      onChange={(e) => setReviewTitle(e.target.value)}
                      placeholder="Catchy headline (e.g. Best trip ever!)"
                      className="w-full bg-gray-50 border-none rounded-[16px] p-4 text-sm font-bold focus:ring-2 focus:ring-[#00A651] transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Your Detailed Experience</label>
                    <textarea 
                      required
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share your thoughts about the tour..."
                      className="w-full bg-gray-50 border-none rounded-[16px] p-4 text-sm focus:ring-2 focus:ring-[#00A651] transition-all min-h-[120px]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Add Photos (Optional)</label>
                    <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-100 rounded-[16px] hover:border-[#00A651] transition-colors cursor-pointer group">
                      <div className="text-center">
                        <ImageIcon className="h-8 w-8 text-gray-300 mx-auto mb-2 group-hover:text-[#00A651]" />
                        <p className="text-xs font-bold text-gray-400">Click to upload images</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-gray-50/50 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setReviewingBooking(null)}
                    className="flex-1 py-3 bg-white border border-gray-200 rounded-[12px] font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={reviewSubmitting || !reviewComment}
                    className="flex-[2] py-3 bg-[#00A651] text-white rounded-[12px] font-bold text-sm hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {reviewSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Submit Review
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

