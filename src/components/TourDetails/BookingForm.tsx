import { useState, FormEvent, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, Info, Rocket, Check, X, Plus, Minus, ChevronRight, ChevronLeft, ShieldCheck, Mail, Phone, User as UserIcon, CreditCard, Loader2, ChevronDown } from 'lucide-react';
import { Tour, TourPackage, PricingTier, Booking, AddOn } from '../../types';
import { formatPrice, cn } from '../../lib/utils';
import FormattedPrice from '../FormattedPrice';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';

interface BookingFormProps {
  tour: Tour;
}

type BookingStep = 'package' | 'addons' | 'customer' | 'payment';

export default function BookingForm({ tour }: BookingFormProps) {
  const navigate = useNavigate();
  const [date, setDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [step, setStep] = useState<BookingStep>('package');
  const [isBooking, setIsBooking] = useState(false);

  // Inventory tracking
  const [currentInventory, setCurrentInventory] = useState<{ bookedCount: number; max: number } | null>(null);

  useEffect(() => {
    if (!tour || !date) {
      setCurrentInventory(null);
      return;
    }
    const inventoryId = `${tour.id}_${date}_${selectedTime || 'daily'}`;
    const unsub = onSnapshot(doc(db, "inventory", inventoryId), (snapshot) => {
       if (snapshot.exists()) {
          const data = snapshot.data();
          setCurrentInventory({ bookedCount: data.bookedCount, max: data.maxCapacity });
       } else {
          setCurrentInventory({ 
            bookedCount: 0, 
            max: (tour.slotCapacity && selectedTime) ? tour.slotCapacity : (tour.maxCapacity || 999) 
          });
       }
    });
    return () => unsub();
  }, [tour, date, selectedTime]);

  const spotsLeft = currentInventory ? Math.max(0, currentInventory.max - currentInventory.bookedCount) : null;
  const isSoldOut = spotsLeft !== null && spotsLeft <= 0;
  const isLowCapacity = spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 5;

  // Selection state
  const [selectedPackage, setSelectedPackage] = useState<TourPackage | null>(null);
  const [selectedAddOns, setSelectedAddOns] = useState<{ id: string; name: string; price: number; quantity: number }[]>([]);
  const [customerData, setCustomerData] = useState({
    fullName: auth.currentUser?.displayName || '',
    email: auth.currentUser?.email || '',
    phone: '',
    specialRequirements: ''
  });

  // Basic package price calculation helper
  const calculatePackagePrice = (pkg: TourPackage) => {
    if (!pkg.tiers || pkg.tiers.length === 0) return 0;
    const totalPax = adults + children;
    const tiers = pkg.tiers;
    const tier = tiers.find(t => totalPax >= t.minParticipants && totalPax <= t.maxParticipants);
    const applicableTier = tier || (totalPax < (tiers[0]?.minParticipants || 0)
                                     ? tiers[0] 
                                     : tiers[tiers.length - 1]);
    
    const adultRate = applicableTier?.adultPrice || 0;
    const childRate = applicableTier?.childPrice || 0;
    return (adultRate * adults) + (childRate * children);
  };

  // Total summary calculation
  const summary = useMemo(() => {
    if (!selectedPackage) return { packageTotal: 0, addonsTotal: 0, grandTotal: 0 };
    
    const packageTotal = calculatePackagePrice(selectedPackage);
    const addonsTotal = selectedAddOns.reduce((sum, addon) => sum + (addon.price * addon.quantity), 0);
    
    return {
      packageTotal,
      addonsTotal,
      grandTotal: packageTotal + addonsTotal
    };
  }, [selectedPackage, selectedAddOns, adults, children]);

  const toggleAddOn = (addon: AddOn) => {
    const existing = selectedAddOns.find(a => a.id === addon.id);
    if (existing) {
      setSelectedAddOns(selectedAddOns.filter(a => a.id !== addon.id));
    } else {
      const quantity = addon.unit === 'per person' ? (adults + children) : 1;
      setSelectedAddOns([...selectedAddOns, { id: addon.id, name: addon.name, price: addon.price, quantity }]);
    }
  };

  const handleAvailabilityCheck = (e: FormEvent) => {
    e.preventDefault();
    if (!date) {
      alert("Please select a date first.");
      return;
    }
    // Navigate to checkout page instead of opening modal
    const timeParam = selectedTime ? `&time=${selectedTime}` : '';
    navigate(`/checkout/${tour.id}?date=${date}&adults=${adults}&children=${children}${timeParam}`);
  };

  if (!tour.packages || tour.packages.length === 0) {
    return (
      <div className="rounded-[10px] border-2 border-dashed border-gray-200 p-8 text-center text-gray-400">
        <p className="font-bold">No packages available for this tour.</p>
      </div>
    );
  }

  return (
    <>
      {/* Main Sidebar Form */}
      <div id="package" className="rounded-[10px] border border-gray-100/80 bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.12),_0_0_1px_rgba(0,0,0,0.05)] scroll-mt-[116px]">
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-bold text-primary">Live Pricing From</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-gray-900 tracking-tight font-display">
              <FormattedPrice amount={tour.discountPrice || tour.regularPrice} />
            </span>
            {tour.discountPrice && (
              <span className="text-sm text-gray-400 line-through decoration-secondary">
                <FormattedPrice amount={tour.regularPrice} />
              </span>
            )}
          </div>
        </div>

        <form id="tour-booking-form" onSubmit={handleAvailabilityCheck} className="space-y-6">
          {/* Modern Date Picker Dropdown */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-gray-500 text-left block">1. Select Date</label>
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowDatePicker(!showDatePicker)}
                className={cn(
                  "w-full flex items-center justify-between p-4 rounded-[10px] border-2 transition-all group",
                  date ? "border-orange-100 bg-orange-50/20" : "border-gray-50 bg-gray-50/50 hover:border-orange-100"
                )}
              >
                <div className="flex items-center gap-3">
                  <Calendar className={cn("h-4 w-4 transition-colors", date ? "text-primary" : "text-gray-400")} />
                  <span className={cn("text-sm font-bold", date ? "text-gray-900" : "text-gray-400")}>
                    {date ? new Date(date).toLocaleDateString('en-US', { dateStyle: 'medium' }) : 'Choose your date'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {date && (
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1",
                      isSoldOut ? "bg-red-50 text-red-500" : 
                      isLowCapacity ? "bg-orange-50 text-orange-500" : 
                      "bg-orange-50 text-primary"
                    )}>
                      {isSoldOut ? <X className="h-2 w-2" /> : <Check className="h-2 w-2" />}
                      {isSoldOut ? 'Sold Out' : isLowCapacity ? `${spotsLeft} left` : 'Available'}
                    </span>
                  )}
                  <ChevronDown className={cn("h-4 w-4 transition-transform text-gray-400", showDatePicker && "rotate-180")} />
                </div>
              </button>

              <AnimatePresence>
                {showDatePicker && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 5, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 right-0 z-[60] bg-white rounded-[10px] shadow-2xl border border-gray-100 p-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <button type="button" onClick={() => {
                        const d = new Date(currentMonth);
                        d.setMonth(d.getMonth() - 1);
                        setCurrentMonth(d);
                      }} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="font-extrabold text-gray-900 tracking-tight text-xs">
                          {currentMonth.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <button type="button" onClick={() => {
                        const d = new Date(currentMonth);
                        d.setMonth(d.getMonth() + 1);
                        setCurrentMonth(d);
                      }} className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-gray-400">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-1 mb-2">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                        <div key={d} className="text-center text-[10px] font-black text-gray-400 tracking-tighter uppercase">{d}</div>
                      ))}
                    </div>

                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square" />
                      ))}
                      {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                        const d = i + 1;
                        const dateObj = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d);
                        const isPast = dateObj < new Date(new Date().setHours(0,0,0,0));
                        const dateString = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                        const isSelected = date === dateString;

                        return (
                          <button
                            key={d}
                            type="button"
                            disabled={isPast}
                            onClick={() => {
                              setDate(dateString);
                              setShowDatePicker(false);
                            }}
                            className={cn(
                              "aspect-square rounded-[8px] text-[13px] font-bold transition-all flex items-center justify-center relative",
                              isSelected ? "bg-primary text-white shadow-lg" : 
                              isPast ? "text-gray-200 cursor-not-allowed" : "text-gray-600 hover:bg-primary/10 hover:text-primary"
                            )}
                          >
                            {d}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Time Picker */}
          {tour.timeSlots && tour.timeSlots.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
              <label className="text-xs font-bold text-gray-500 block text-left">2. Preferred Time</label>
              <div className="grid grid-cols-3 gap-2">
                {tour.timeSlots.map(time => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setSelectedTime(time)}
                    className={cn(
                      "py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none",
                      selectedTime === time
                        ? "bg-primary border-primary text-white shadow-sm"
                        : "bg-gray-50 border-gray-100 text-gray-500 hover:border-orange-200 hover:bg-white"
                    )}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Participant Picker */}
          <div className="space-y-4">
            <label className="text-xs font-bold text-gray-500 block text-left">
              {tour.timeSlots && tour.timeSlots.length > 0 ? '3' : '2'}. Participants
            </label>
            
            <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-[10px] border-2 border-gray-50 transition-colors hover:border-orange-100">
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 text-sm">Adults</span>
                <span className="text-xs text-gray-400 font-bold">Age 12+</span>
              </div>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setAdults(Math.max(1, adults - 1))} className="h-8 w-8 rounded-full border-2 border-primary/20 flex items-center justify-center text-primary" disabled={adults <= 1}>
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-4 text-center font-black text-lg text-primary">{adults}</span>
                <button 
                  type="button" 
                  disabled={spotsLeft !== null && (adults + children + 1) > spotsLeft}
                  onClick={() => setAdults(adults + 1)} 
                  className={cn("h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all", (spotsLeft !== null && (adults + children + 1) > spotsLeft) ? "border-gray-200 text-gray-300 opacity-50 cursor-not-allowed" : "border-primary/20 text-primary hover:bg-primary/5")}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50/50 rounded-[10px] border-2 border-gray-50 transition-colors hover:border-orange-100">
              <div className="flex flex-col">
                <span className="font-bold text-gray-900 text-sm">Children</span>
                <span className="text-xs text-gray-400 font-bold">Age 3-11</span>
              </div>
              <div className="flex items-center gap-4">
                <button type="button" onClick={() => setChildren(Math.max(0, children - 1))} className="h-8 w-8 rounded-full border-2 border-primary/20 flex items-center justify-center text-primary" disabled={children <= 0}>
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-4 text-center font-black text-lg text-primary">{children}</span>
                <button 
                  type="button" 
                  disabled={spotsLeft !== null && (adults + children + 1) > spotsLeft}
                  onClick={() => setChildren(children + 1)} 
                  className={cn("h-8 w-8 rounded-full border-2 flex items-center justify-center transition-all", (spotsLeft !== null && (adults + children + 1) > spotsLeft) ? "border-gray-200 text-gray-300 opacity-50 cursor-not-allowed" : "border-primary/20 text-primary hover:bg-primary/5")}
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
            {(spotsLeft !== null && (adults + children) > spotsLeft) && (
              <p className="text-[10px] text-red-500 font-bold text-center animate-pulse">
                Capacity Exceeded: Only {spotsLeft} spots remaining
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSoldOut || (spotsLeft !== null && (adults + children) > spotsLeft)}
            className="flex w-full items-center justify-center gap-3 rounded-[50px] bg-primary py-5 font-black text-white hover:bg-orange-700 hover:shadow-xl transition-all shadow-lg tracking-widest text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSoldOut ? 'Sold Out' : (spotsLeft !== null && (adults + children) > spotsLeft) ? 'Not Enough Spots' : 'Check Availability'} <Rocket className="h-5 w-5" />
          </button>
        </form>
      </div>
    </>
  );
}
