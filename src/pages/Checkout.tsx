import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { db, auth, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  runTransaction,
  onSnapshot,
} from "firebase/firestore";
import { Tour, TourPackage, Booking, AddOn, TransportOption, Coupon, UserProfile } from "../types";
import {
  ChevronRight,
  ChevronDown,
  Check,
  Clock,
  Info,
  ShieldCheck,
  CreditCard,
  Wallet,
  Banknote,
  DollarSign,
  Loader2,
  ArrowLeft,
  Calendar,
  Users,
  Baby,
  MapPin,
  Star,
  Plus,
  Minus,
  Tag,
  Database,
  ChevronLeft,
  Car,
  Bus,
} from "lucide-react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { cn, parseMeetingPoint } from "../lib/utils";
import FormattedPrice from "../components/FormattedPrice";
import { useCurrency } from "../lib/CurrencyContext";
import { motion, AnimatePresence } from "motion/react";
import { sendBookingEmail } from "../lib/emailService";
import { sendWhatsAppNotification } from "../lib/whatsappService";

type CheckoutStep = "selection" | "customer" | "payment";
type PaymentMethod = "card" | "paypal" | "bank_transfer" | "pay_on_arrival";

interface CountryWithPhoneCode {
  name: string;
  dialCode: string;
}

const COUNTRIES_WITH_CODES: CountryWithPhoneCode[] = [
  { name: "Indonesia", dialCode: "+62" },
  { name: "Australia", dialCode: "+61" },
  { name: "United States", dialCode: "+1" },
  { name: "United Kingdom", dialCode: "+44" },
  { name: "Singapore", dialCode: "+65" },
  { name: "Malaysia", dialCode: "+60" },
  { name: "Germany", dialCode: "+49" },
  { name: "France", dialCode: "+33" },
  { name: "Japan", dialCode: "+81" },
  { name: "India", dialCode: "+91" },
  { name: "Netherlands", dialCode: "+31" },
  { name: "New Zealand", dialCode: "+64" },
  { name: "Canada", dialCode: "+1" },
  { name: "South Korea", dialCode: "+82" },
  { name: "China", dialCode: "+86" },
  { name: "Russia", dialCode: "+7" },
  { name: "Afghanistan", dialCode: "+93" },
  { name: "Albania", dialCode: "+355" },
  { name: "Algeria", dialCode: "+213" },
  { name: "Andorra", dialCode: "+376" },
  { name: "Angola", dialCode: "+244" },
  { name: "Argentina", dialCode: "+54" },
  { name: "Armenia", dialCode: "+374" },
  { name: "Austria", dialCode: "+43" },
  { name: "Azerbaijan", dialCode: "+994" },
  { name: "Bahamas", dialCode: "+1" },
  { name: "Bahrain", dialCode: "+973" },
  { name: "Bangladesh", dialCode: "+880" },
  { name: "Belarus", dialCode: "+375" },
  { name: "Belgium", dialCode: "+32" },
  { name: "Belize", dialCode: "+501" },
  { name: "Benin", dialCode: "+229" },
  { name: "Bhutan", dialCode: "+975" },
  { name: "Bolivia", dialCode: "+591" },
  { name: "Bosnia and Herzegovina", dialCode: "+387" },
  { name: "Botswana", dialCode: "+267" },
  { name: "Brazil", dialCode: "+55" },
  { name: "Brunei", dialCode: "+673" },
  { name: "Bulgaria", dialCode: "+359" },
  { name: "Cambodia", dialCode: "+855" },
  { name: "Cameroon", dialCode: "+237" },
  { name: "Chile", dialCode: "+56" },
  { name: "Colombia", dialCode: "+57" },
  { name: "Costa Rica", dialCode: "+506" },
  { name: "Croatia", dialCode: "+385" },
  { name: "Cuba", dialCode: "+53" },
  { name: "Cyprus", dialCode: "+357" },
  { name: "Czech Republic", dialCode: "+420" },
  { name: "Denmark", dialCode: "+45" },
  { name: "Ecuador", dialCode: "+593" },
  { name: "Egypt", dialCode: "+20" },
  { name: "El Salvador", dialCode: "+503" },
  { name: "Estonia", dialCode: "+372" },
  { name: "Ethiopia", dialCode: "+251" },
  { name: "Fiji", dialCode: "+679" },
  { name: "Finland", dialCode: "+358" },
  { name: "Georgia", dialCode: "+995" },
  { name: "Ghana", dialCode: "+233" },
  { name: "Greece", dialCode: "+30" },
  { name: "Guatemala", dialCode: "+502" },
  { name: "Honduras", dialCode: "+504" },
  { name: "Hong Kong", dialCode: "+852" },
  { name: "Hungary", dialCode: "+36" },
  { name: "Iceland", dialCode: "+354" },
  { name: "Iran", dialCode: "+98" },
  { name: "Iraq", dialCode: "+964" },
  { name: "Ireland", dialCode: "+353" },
  { name: "Israel", dialCode: "+972" },
  { name: "Italy", dialCode: "+39" },
  { name: "Jamaica", dialCode: "+1" },
  { name: "Jordan", dialCode: "+962" },
  { name: "Kazakhstan", dialCode: "+7" },
  { name: "Kenya", dialCode: "+254" },
  { name: "Kuwait", dialCode: "+965" },
  { name: "Laos", dialCode: "+856" },
  { name: "Latvia", dialCode: "+371" },
  { name: "Lebanon", dialCode: "+961" },
  { name: "Lithuania", dialCode: "+370" },
  { name: "Luxembourg", dialCode: "+352" },
  { name: "Macau", dialCode: "+853" },
  { name: "Macedonia", dialCode: "+389" },
  { name: "Madagascar", dialCode: "+261" },
  { name: "Maldives", dialCode: "+960" },
  { name: "Malta", dialCode: "+356" },
  { name: "Mauritius", dialCode: "+230" },
  { name: "Mexico", dialCode: "+52" },
  { name: "Moldova", dialCode: "+373" },
  { name: "Monaco", dialCode: "+377" },
  { name: "Mongolia", dialCode: "+976" },
  { name: "Montenegro", dialCode: "+382" },
  { name: "Morocco", dialCode: "+212" },
  { name: "Myanmar", dialCode: "+95" },
  { name: "Nepal", dialCode: "+977" },
  { name: "Nicaragua", dialCode: "+505" },
  { name: "Nigeria", dialCode: "+234" },
  { name: "Norway", dialCode: "+47" },
  { name: "Oman", dialCode: "+968" },
  { name: "Pakistan", dialCode: "+92" },
  { name: "Palestine", dialCode: "+970" },
  { name: "Panama", dialCode: "+507" },
  { name: "Paraguay", dialCode: "+595" },
  { name: "Peru", dialCode: "+51" },
  { name: "Philippines", dialCode: "+63" },
  { name: "Poland", dialCode: "+48" },
  { name: "Portugal", dialCode: "+351" },
  { name: "Qatar", dialCode: "+974" },
  { name: "Romania", dialCode: "+40" },
  { name: "Saudi Arabia", dialCode: "+966" },
  { name: "Senegal", dialCode: "+221" },
  { name: "Serbia", dialCode: "+381" },
  { name: "Slovakia", dialCode: "+421" },
  { name: "Slovenia", dialCode: "+386" },
  { name: "South Africa", dialCode: "+27" },
  { name: "Spain", dialCode: "+34" },
  { name: "Sri Lanka", dialCode: "+94" },
  { name: "Sweden", dialCode: "+46" },
  { name: "Switzerland", dialCode: "+41" },
  { name: "Taiwan", dialCode: "+886" },
  { name: "Thailand", dialCode: "+66" },
  { name: "Turkey", dialCode: "+90" },
  { name: "Ukraine", dialCode: "+380" },
  { name: "United Arab Emirates", dialCode: "+971" },
  { name: "Uruguay", dialCode: "+598" },
  { name: "Uzbekistan", dialCode: "+998" },
  { name: "Venezuela", dialCode: "+58" },
  { name: "Vietnam", dialCode: "+84" },
  { name: "Zimbabwe", dialCode: "+263" },
  { name: "Other", dialCode: "" }
];

export const getInternationalPhoneNumber = (phone: string, countryName: string): string => {
  if (!phone) return "";
  const cleanedPhone = phone.trim();
  
  // Find country dial code
  const country = COUNTRIES_WITH_CODES.find(c => c.name === countryName);
  if (!country || !country.dialCode) {
    if (cleanedPhone.startsWith("+")) return cleanedPhone;
    return cleanedPhone;
  }
  
  const dialCode = country.dialCode;
  const cleanDial = dialCode.replace(/\D/g, "");
  const cleanPhone = cleanedPhone.replace(/\D/g, "");
  
  if (cleanPhone.startsWith(cleanDial)) {
    return `+${cleanPhone}`;
  }
  
  if (cleanPhone.startsWith("0")) {
    return `+${cleanDial}${cleanPhone.substring(1)}`;
  }
  
  return `+${cleanDial}${cleanPhone}`;
};

export default function Checkout() {
  const { tourId } = useParams();
  const { formatPrice } = useCurrency();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [tour, setTour] = useState<Tour | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [existingBooking, setExistingBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<CheckoutStep>((searchParams.get("step") as CheckoutStep) || "selection");
  const [isBooking, setIsBooking] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Sync step to URL
  useEffect(() => {
    const currentStep = searchParams.get("step") || "selection";
    if (currentStep !== step) {
      setStep(currentStep as CheckoutStep);
    }
  }, [searchParams]);

  const validateStep = (currentStep: CheckoutStep): { isValid: boolean; error: string | null } => {
    if (currentStep === "selection") {
      if (!date) return { isValid: false, error: "Please select a date" };
      if (!selectedPackage) return { isValid: false, error: "Please select a tour package" };
      if (availableTransports.length > 0 && !selectedTransport) return { isValid: false, error: "Please select a transport / pick-up option" };
      if (selectedTransport && selectedTransport.maxCapacity && (adults + children) > selectedTransport.maxCapacity) {
        return { isValid: false, error: `The selected transport option (${selectedTransport.name}) only accommodates up to ${selectedTransport.maxCapacity} passengers. Please select a larger option.` };
      }
      if (tour?.timeSlots?.length && !selectedTime) return { isValid: false, error: "Please select a time slot" };
      if (adults + children === 0) return { isValid: false, error: "Please add at least one traveler" };
      if (selectedPackage && selectedPackage.tiers && selectedPackage.tiers.length > 0) {
        const minRequired = Math.min(...selectedPackage.tiers.map(t => t.minParticipants));
        const totalPax = adults + children;
        if (totalPax < minRequired) {
          return { isValid: false, error: `Minimum participants required for ${selectedPackage.name} is ${minRequired} people. Your current selection is ${totalPax} traveler(s).` };
        }
      }
      if (spotsLeft !== null && (adults + children) > spotsLeft) return { isValid: false, error: "Not enough spots available for this selection" };
      if ((selectedTransportType === 'shared' || selectedTransportType === 'private') && !customerData.pickupAddress.trim()) {
        return { isValid: false, error: "Please enter your hotel name and address for pickup arrangement" };
      }
    }

    if (currentStep === "customer") {
      const { fullName, email, phone, nationality } = customerData;
      if (!fullName.trim()) return { isValid: false, error: "Full name is required" };
      if (!email.trim()) return { isValid: false, error: "Email is required" };
      if (!phone.trim()) return { isValid: false, error: "Phone number is required" };
      if (!nationality.trim()) return { isValid: false, error: "Nationality is required" };
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (email.trim() && !emailRegex.test(email)) return { isValid: false, error: "Invalid email format" };
    }

    return { isValid: true, error: null };
  };

  const updateStep = (newStep: CheckoutStep) => {
    // Determine the direction
    const steps: CheckoutStep[] = ["selection", "customer", "payment"];
    const currentIndex = steps.indexOf(step);
    const targetIndex = steps.indexOf(newStep);

    // If moving forward, validate current step
    if (targetIndex > currentIndex) {
      const validation = validateStep(step);
      if (!validation.isValid) {
        setValidationErrors([validation.error!]);
        alert(validation.error);
        
        // Find the element to scroll to
        let elementId = "";
        if (validation.error?.includes("date")) elementId = "date-picker-mobile";
        if (validation.error?.includes("package")) elementId = "package-selection";
        if (validation.error?.includes("time")) elementId = "time-selection";
        if (validation.error?.includes("traveler")) elementId = "traveler-selection-mobile";
        
        const element = elementId ? document.getElementById(elementId) : null;
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        return;
      }
    }

    setStep(newStep);
    setValidationErrors([]);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("step", newStep);
    navigate({ search: newParams.toString() }, { replace: false });
    window.scrollTo(0, 0);
  };

  const validateCustomerData = () => {
    const { fullName, email, phone, nationality } = customerData;
    if (!fullName.trim() || !email.trim() || !phone.trim() || !nationality.trim()) {
      alert("Full Name, Email Address, Nationality, and Phone Number are mandatory fields.");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      alert("Please enter a valid email address.");
      return false;
    }
    return true;
  };

  // URL Params
  const dateFromUrl = searchParams.get("date") || "";
  const adultsFromUrl = parseInt(searchParams.get("adults") || "1");
  const childrenFromUrl = parseInt(searchParams.get("children") || "0");
  const timeFromUrl = searchParams.get("time") || "";

  // Local State
  const [date, setDate] = useState(dateFromUrl);
  const [adults, setAdults] = useState(adultsFromUrl);
  const [children, setChildren] = useState(childrenFromUrl);
  const [selectedTime, setSelectedTime] = useState(timeFromUrl);

  useEffect(() => {
    if (!selectedTime && tour?.timeSlots && tour.timeSlots.length > 0) {
      setSelectedTime(tour.timeSlots[0]);
    }
  }, [tour, selectedTime]);
  const [showDetailsText, setShowDetailsText] = useState<Record<string, boolean>>({});

  const toggleDetailsText = (packageName: string) => {
    setShowDetailsText(prev => ({
      ...prev,
      [packageName]: !prev[packageName]
    }));
  };
  const [selectedPackage, setSelectedPackage] = useState<TourPackage | null>(
    null,
  );
  const [selectedTransport, setSelectedTransport] = useState<TransportOption | null>(null);
  const [selectedTransportType, setSelectedTransportType] = useState<'meet' | 'shared' | 'private' | null>(null);
  const [globalTransports, setGlobalTransports] = useState<TransportOption[]>([]);
  const [selectedAddOns, setSelectedAddOns] = useState<
    { id: string; name: string; price: number; quantity: number }[]
  >([]);
  const [customerData, setCustomerData] = useState({
    fullName: auth.currentUser?.displayName || "",
    email: auth.currentUser?.email || "",
    phone: "",
    nationality: "",
    pickupAddress: "",
    specialRequirements: "",
  });

  const setCustomerDataFromBooking = (data: Booking['customerData']) => {
    setCustomerData({
      fullName: data.fullName || "",
      email: data.email || "",
      phone: data.phone || "",
      nationality: data.nationality || "",
      pickupAddress: data.pickupAddress || "",
      specialRequirements: data.specialRequirements || "",
    });
  };

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [expandedPackage, setExpandedPackage] = useState<string | null>(null);
  const [pricingTiersExpanded, setPricingTiersExpanded] = useState<string | null>(null);
  const [expandedAddOn, setExpandedAddOn] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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

  const isUnderMinParticipants = useMemo(() => {
    if (!selectedPackage || !selectedPackage.tiers || selectedPackage.tiers.length === 0) return false;
    const minRequired = Math.min(...selectedPackage.tiers.map(t => t.minParticipants));
    return (adults + children) < minRequired;
  }, [selectedPackage, adults, children]);

  // Coupon State
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<React.ReactNode>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [paymentSettings, setPaymentSettings] = useState<{
    paypalClientId: string;
    paypalSandboxClientId?: string;
    paypalMode?: 'live' | 'sandbox';
    isPaypalEnabled: boolean;
    creditCardEnabled: boolean;
    isBankTransferEnabled?: boolean;
    isPayOnArrivalEnabled?: boolean;
    bankName?: string;
    accountNumber?: string;
    swiftCode?: string;
    accountHolder?: string;
    bankInstructions?: string;
  } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "payment");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const settings = docSnap.data() as any;
          setPaymentSettings(settings);
        }
      } catch (err) {
        console.error("Error fetching payment settings", err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
          if (userDoc.exists()) {
            setUserProfile({ uid: userDoc.id, ...userDoc.data() } as UserProfile);
          }
        } catch (error) {
          console.error("Error fetching user profile", error);
        }
      } else {
        setUserProfile(null);
      }
    };
    fetchUserProfile();
  }, [auth.currentUser]);

  useEffect(() => {
    const fetchTourAndBooking = async () => {
      const bId = searchParams.get("bookingId");
      let tourToFetchId = tourId;

      try {
        if (bId) {
          const bookingSnap = await getDoc(doc(db, "bookings", bId));
          if (bookingSnap.exists()) {
            const bData = { id: bookingSnap.id, ...bookingSnap.data() } as Booking;
            setExistingBooking(bData);
            tourToFetchId = bData.tourId;
            
            // Set initial state from booking
            setDate(bData.date);
            setAdults(bData.participants.adults);
            setChildren(bData.participants.children);
            setSelectedTime(bData.time || "");
            setCustomerDataFromBooking(bData.customerData);
            setSelectedAddOns(bData.selectedAddOns || []);
            
            // If it's an upgrade, we might want to jump directly to payment or customer details
            if (searchParams.get("upgrade") === "true") {
               setStep("payment");
            }
          }
        }

        if (!tourToFetchId) return;
        const docRef = doc(db, "tours", tourToFetchId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const tourData = { id: docSnap.id, ...docSnap.data() } as Tour;
           setTour(tourData);
           if (!selectedTime && tourData.timeSlots && tourData.timeSlots.length > 0) {
             setSelectedTime(tourData.timeSlots[0]);
           }
          
          if (existingBooking) {
            const pkg = tourData.packages.find(p => p.name === existingBooking.packageName);
            if (pkg) {
              setSelectedPackage(pkg);
              setExpandedPackage(pkg.name);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTourAndBooking();
  }, [tourId, searchParams]);

  useEffect(() => {
    const fetchTransports = async () => {
      try {
        const snap = await getDocs(collection(db, "globalTransports"));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as TransportOption));
        setGlobalTransports(list);
      } catch (error) {
        console.error("Error loading global transports:", error);
      }
    };
    fetchTransports();
  }, []);

  const availableTransports = useMemo(() => {
    // If the tour specifies transportIds, filter by them
    if (tour?.transportIds && tour.transportIds.length > 0) {
      return globalTransports.filter(t => tour.transportIds.includes(t.id));
    }
    // Otherwise show all transports
    return globalTransports;
  }, [tour, globalTransports]);

  // Synchronize and auto-select transport based on available transports and group size
  useEffect(() => {
    if (availableTransports.length === 0) return;

    const totalParticipants = adults + children;

    // If no transport is currently selected, choose a default one
    if (!selectedTransport) {
      const meetOpt = availableTransports.find(t => t.type === 'meet');
      const sharedOpt = availableTransports.find(t => t.type === 'shared');
      const privateOpt = availableTransports.find(t => t.type === 'private');
      const defaultOpt = meetOpt || sharedOpt || privateOpt || availableTransports[0];
      
      setSelectedTransport(defaultOpt);
      setSelectedTransportType(defaultOpt.type);
      
      // If the default is meet, sync the pickup address to the meeting point
      if (defaultOpt.type === 'meet') {
        setCustomerData(prev => ({
          ...prev,
          pickupAddress: tour?.meetingPoint || "Meet directly at our adventure basecamp."
        }));
      }
      return;
    }

    // Set high-level transport type state if it differs from current selected transport type
    if (selectedTransportType !== selectedTransport.type) {
      setSelectedTransportType(selectedTransport.type);
    }

    // If the selected transport has a capacity limit and passenger count exceeds it:
    if (
      selectedTransport.maxCapacity !== undefined &&
      selectedTransport.maxCapacity !== null &&
      totalParticipants > selectedTransport.maxCapacity
    ) {
      // Find a suitable transport within the same category first (e.g. larger private car)
      const suitableSameType = availableTransports.filter(t => 
        t.type === selectedTransport.type && 
        (t.maxCapacity === undefined || t.maxCapacity === null || totalParticipants <= t.maxCapacity)
      );

      if (suitableSameType.length > 0) {
        setSelectedTransport(suitableSameType[0]);
      } else {
        // Fall back to any transport option that can accommodate this number of participants
        const suitableTransports = availableTransports.filter(t => 
          t.maxCapacity === undefined || 
          t.maxCapacity === null || 
          totalParticipants <= t.maxCapacity
        );

        if (suitableTransports.length > 0) {
          setSelectedTransport(suitableTransports[0]);
        } else {
          // If no transport option is large enough, fallback to the one with the maximum capacity
          const sortedByCapacity = [...availableTransports].sort((a, b) => 
            (b.maxCapacity || 0) - (a.maxCapacity || 0)
          );
          setSelectedTransport(sortedByCapacity[0]);
        }
      }
    }
  }, [availableTransports, selectedTransport, selectedTransportType, adults, children, tour?.meetingPoint]);

  const applicableTier = useMemo(() => {
    if (!selectedPackage?.tiers || selectedPackage.tiers.length === 0) return null;
    const tiers = selectedPackage.tiers;
    // Base the "primary" tier display on adults count as requested
    const count = adults;
    const findTier = tiers.find(
      (t) => count >= t.minParticipants && count <= t.maxParticipants,
    );
    return findTier || (count < (tiers[0]?.minParticipants || 0) ? tiers[0] : tiers[tiers.length - 1]);
  }, [selectedPackage, adults]);

  const getLowestAdultPrice = (pkg: TourPackage) => {
    if (!pkg.tiers || pkg.tiers.length === 0) return 0;
    return Math.min(...pkg.tiers.map(t => t.adultPrice));
  };

  const calculatePackagePrice = (pkg: TourPackage) => {
    if (!pkg.tiers || pkg.tiers.length === 0) return 0;
    const tiers = pkg.tiers;
    
    // Calculate adult rate based on adults count ONLY
    const adultTier = tiers.find(
      (t) => adults >= t.minParticipants && adults <= t.maxParticipants,
    ) || (adults < (tiers[0]?.minParticipants || 0) ? tiers[0] : tiers[tiers.length - 1]);
    
    // Calculate child rate based on children count ONLY
    const childTier = children > 0 
      ? (tiers.find((t) => children >= t.minParticipants && children <= t.maxParticipants) || 
         (children < (tiers[0]?.minParticipants || 0) ? tiers[0] : tiers[tiers.length - 1]))
      : adultTier;

    const adultRate = adultTier?.adultPrice || 0;
    const childRate = childTier?.childPrice || 0;
    
    return adultRate * adults + childRate * children;
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) return;
    setIsValidatingCoupon(true);
    setCouponError(null);
    try {
      const q = query(
        collection(db, "coupons"),
        where("code", "==", couponInput.toUpperCase()),
        where("isActive", "==", true),
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setCouponError("Invalid or expired coupon code");
        setAppliedCoupon(null);
      } else {
        const coupon = {
          id: querySnapshot.docs[0].id,
          ...querySnapshot.docs[0].data(),
        } as Coupon;
        // Basic min value check
        const packageTotal = calculatePackagePrice(selectedPackage!);
        if (packageTotal < (coupon.minBookingValue || 0)) {
          setCouponError(
            <span>Min booking value for this coupon is <FormattedPrice amount={coupon.minBookingValue || 0} /></span>
          );
          setAppliedCoupon(null);
        } else {
          setAppliedCoupon(coupon);
          setCouponInput("");
        }
      }
    } catch (error) {
      setCouponError("Failed to validate coupon");
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const summary = useMemo(() => {
    if (!selectedPackage)
      return { packageTotal: 0, transportTotal: 0, addonsTotal: 0, discount: 0, grandTotal: 0, amountToPay: 0 };
    const packageTotal = calculatePackagePrice(selectedPackage);
    const addonsTotal = selectedAddOns.reduce(
      (sum, addon) => sum + addon.price * addon.quantity,
      0,
    );

    let transportTotal = 0;
    if (selectedTransport && selectedTransport.type !== "meet") {
      if (selectedTransport.priceType === "per_person") {
        transportTotal = selectedTransport.price * (adults + children);
      } else {
        transportTotal = selectedTransport.price;
      }
    }

    let discount = 0;
    let agentDiscount = 0;

    if (userProfile?.role === "agent" && userProfile.discountRate) {
      agentDiscount = (packageTotal * userProfile.discountRate) / 100;
      discount = agentDiscount;
    } else if (appliedCoupon) {
      if (appliedCoupon.discountType === "percentage") {
        discount = (packageTotal * appliedCoupon.discountValue) / 100;
      } else {
        discount = appliedCoupon.discountValue;
      }
    } else if (existingBooking?.discountAmount) {
      // Keep existing discount if applicable
      discount = existingBooking.discountAmount;
    }

    const grandTotal = Math.max(0, packageTotal + addonsTotal + transportTotal - discount);
    const amountPaid = (existingBooking?.proposedUpdate?.oldTotal !== undefined) 
      ? existingBooking.proposedUpdate.oldTotal 
      : (existingBooking?.totalAmount || 0);

    const amountToPay = existingBooking ? Math.max(0, grandTotal - amountPaid) : grandTotal;

    return {
      packageTotal,
      transportTotal,
      addonsTotal,
      discount,
      agentDiscount,
      grandTotal,
      amountToPay,
      amountPaid
    };
  }, [selectedPackage, selectedAddOns, selectedTransport, adults, children, appliedCoupon, existingBooking, userProfile]);

const days = useMemo(() => {
  const arr = [];
  const start = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    arr.push(d);
  }
  return arr;
}, []);

const toggleAddOn = (addon: AddOn) => {
    const existing = selectedAddOns.find((a) => a.id === addon.id);
    if (existing) {
      setSelectedAddOns(selectedAddOns.filter((a) => a.id !== addon.id));
    } else {
      const quantity = addon.unit === "per person" ? adults + children : 1;
      setSelectedAddOns([
        ...selectedAddOns,
        { id: addon.id, name: addon.name, price: addon.price, quantity },
      ]);
    }
  };

  const updateAddOnQuantity = (addonId: string, delta: number) => {
    setSelectedAddOns(prev => prev.map(a => {
      if (a.id === addonId) {
        return { ...a, quantity: Math.max(1, a.quantity + delta) };
      }
      return a;
    }));
  };

  const handlePayPalApprove = async (data: any, actions: any) => {
    try {
      const details = await actions.order.capture();
      await handleFinalBooking(details.id);
    } catch (err) {
      console.error("PayPal capture error:", err);
      alert("Payment captured but booking failed to finalize. Our team will contact you.");
    }
  };

  const handleFinalBooking = async (paymentId?: string) => {
    if (!selectedPackage || !date) return;
    setIsBooking(true);
    try {
      const isUpgrade = !!existingBooking;
      
      let merchantFee = 0;
      let supplierEarnings = 0;
      let supplierEmail = "";

      if (tour?.supplierId) {
        // Fetch supplier's commission rate and email
        try {
          const supplierDoc = await getDoc(doc(db, "users", tour.supplierId));
          if (supplierDoc.exists()) {
            const supplierData = supplierDoc.data() as UserProfile;
            const commissionRate = supplierData.commissionRate || 10; // Default 10% if not set
            merchantFee = (summary.grandTotal * commissionRate) / 100;
            supplierEarnings = summary.grandTotal - merchantFee;
            supplierEmail = supplierData.email || supplierData.publicEmail || "";
          }
        } catch (err) {
          console.error("Error fetching supplier data", err);
          // Fallback to default
          merchantFee = (summary.grandTotal * 10) / 100;
          supplierEarnings = summary.grandTotal - merchantFee;
        }
      }

      // Final fallback for supplier email from tour document cache
      if (!supplierEmail && tour) {
        supplierEmail = (tour as any).supplierEmail || (tour as any).vendorEmail || "";
      }

      const customerEmailNormalized = customerData.email.trim().toLowerCase();
      
      // --- START: AUTOMATED CAPACITY CHECK ---
      const totalParticipants = adults + children;
      const effectiveMaxCapacity = (tour?.slotCapacity && selectedTime) ? tour.slotCapacity : (tour?.maxCapacity || 999);
      
      if (tour?.maxCapacity || tour?.slotCapacity) {
        try {
          const inventoryId = `${tour.id}_${date}_${selectedTime || 'daily'}`;
          const inventoryRef = doc(db, "inventory", inventoryId);
          
          await runTransaction(db, async (transaction) => {
            let invDoc;
            try {
              invDoc = await transaction.get(inventoryRef);
            } catch (err) {
              handleFirestoreError(err, OperationType.GET, `inventory/${inventoryId}`);
              throw err;
            }

            let currentBooked = 0;
            if (invDoc.exists()) {
              currentBooked = invDoc.data().bookedCount;
            }
            
            if (currentBooked + totalParticipants > effectiveMaxCapacity) {
              throw new Error(`Insufficient capacity. Only ${effectiveMaxCapacity - currentBooked} spots left for this selection.`);
            }
            
            try {
              if (invDoc.exists()) {
                transaction.update(inventoryRef, {
                  bookedCount: currentBooked + totalParticipants,
                  updatedAt: serverTimestamp()
                });
              } else {
                transaction.set(inventoryRef, {
                  tourId: tour.id,
                  date,
                  timeSlot: selectedTime || 'daily',
                  bookedCount: totalParticipants,
                  maxCapacity: effectiveMaxCapacity,
                  updatedAt: serverTimestamp()
                });
              }
            } catch (err) {
              handleFirestoreError(err, invDoc.exists() ? OperationType.UPDATE : OperationType.CREATE, `inventory/${inventoryId}`);
              throw err;
            }
          });
        } catch (err: any) {
          console.error("Availability error:", err);
          alert(err.message || "Could not verify availability. Please try again.");
          setIsBooking(false);
          return;
        }
      }
      // --- END: AUTOMATED CAPACITY CHECK ---

      const bookingData: Partial<Booking> = {
        tourId: tour?.id,
        tourTitle: tour?.title,
        userId: auth.currentUser?.uid || "anonymous",
        supplierId: tour?.supplierId || null,
        supplierName: tour?.supplierName || tour?.vendor || tour?.businessName || '',
        supplierEmail,
        customerData: {
          ...customerData,
          phone: getInternationalPhoneNumber(customerData.phone, customerData.nationality),
          email: customerEmailNormalized
        },
        date,
        participants: { adults, children },
        time: selectedTime,
        packageName: selectedPackage.name,
        selectedTransport: selectedTransport ? {
          id: selectedTransport.id,
          name: selectedTransport.name,
          type: selectedTransport.type,
          price: selectedTransport.price,
          priceType: selectedTransport.priceType,
          carType: selectedTransport.carType || ""
        } : null,
        transportTotal: summary.transportTotal,
        selectedAddOns,
        totalAmount: summary.grandTotal,
        couponCode: appliedCoupon?.code || existingBooking?.couponCode || "",
        discountAmount: summary.discount,
        agentDiscount: summary.agentDiscount,
        merchantFee,
        supplierEarnings,
        bookedBy: userProfile ? {
          uid: userProfile.uid,
          name: userProfile.displayName,
          email: userProfile.email,
          role: userProfile.role
        } : {
          uid: 'anonymous',
          name: customerData.fullName,
          email: customerData.email,
          role: 'customer'
        },
        status: "confirmed",
        updatedAt: serverTimestamp(),
        paymentId: paymentId || existingBooking?.paymentId || null,
        paymentMethod,
        paymentStatus: (paymentMethod === 'bank_transfer' || paymentMethod === 'pay_on_arrival') ? 'pending' : 'paid',
        payoutStatus: 'pending',
        pricingBreakdown: {
          adultRate: applicableTier?.adultPrice || 0,
          childRate: applicableTier?.childPrice || 0,
          packageTotal: summary.packageTotal,
          transportTotal: summary.transportTotal
        }
      };

      let finalBookingId = "";

      if (isUpgrade && existingBooking) {
        try {
          await updateDoc(doc(db, "bookings", existingBooking.id), bookingData);
          finalBookingId = existingBooking.id;
        } catch (err) {
          handleFirestoreError(err, 'update' as any, `bookings/${existingBooking.id}`);
        }
        
        const finalBooking = { id: finalBookingId, ...bookingData } as Booking;
        
        // Dispatch notifications in the background so they do not block instant checkout completion UX
        Promise.all([
          sendBookingEmail('booking_changed', finalBooking, { upgraded: true, upgradePaid: true }),
          sendBookingEmail('admin_new_booking', finalBooking, { note: "UPGRADE PAID via " + paymentMethod }),
          sendWhatsAppNotification('booking_status_updated', finalBooking)
        ]).catch((err) => {
          console.error("Upgrade notification error:", err);
        });
        
        navigate(`/booking-success/${finalBookingId}`);
        return;
      }

      // Generate a clean, shortened 8-character capitalized booking ID
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let generatedId = '';
      for (let i = 0; i < 8; i++) {
        generatedId += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      try {
        await setDoc(doc(db, "bookings", generatedId), { ...bookingData, createdAt: serverTimestamp() });
        finalBookingId = generatedId;
      } catch (err) {
        handleFirestoreError(err, 'create' as any, 'bookings');
      }

      const newBooking = { id: finalBookingId, ...bookingData } as Booking;
      
      // Send Email & WhatsApp Notifications in the background so the user is not held back on payment completion UX
      const templateType = (paymentMethod === 'bank_transfer' || paymentMethod === 'pay_on_arrival') ? 'booking_pending' : 'booking_confirmed';
      Promise.all([
        sendBookingEmail(templateType, newBooking).catch(err => console.error("Send Customer Email Error:", err)),
        sendBookingEmail('admin_new_booking', newBooking).catch(err => console.error("Send Admin New Booking Email Error:", err)),
        // Notify Supplier if it's not an admin tour or if we have a supplier email
        ((newBooking.supplierId && newBooking.supplierId !== 'admin') || (newBooking.supplierEmail && newBooking.supplierEmail !== ''))
          ? sendBookingEmail('supplier_new_booking', newBooking).catch(err => console.error("Send Supplier Email Error:", err))
          : Promise.resolve(),
        // Trigger WhatsApp Notifications
        (paymentMethod !== 'bank_transfer' && paymentMethod !== 'pay_on_arrival')
          ? sendWhatsAppNotification('booking_confirmation', newBooking).catch(err => console.error("Send Customer WhatsApp Error:", err))
          : Promise.resolve(),
        sendWhatsAppNotification('admin_notification', newBooking).catch(err => console.error("Send Admin WhatsApp Error:", err))
      ]).catch((err) => {
        console.error("Booking notification error:", err);
      });
      
      navigate(`/booking-success/${finalBookingId}`);
    } catch (error: any) {
      console.error("Booking failed", error);
      let errorMessage = error?.message || (typeof error === 'string' ? error : "Unknown error");
      
      // Try to parse JSON error from handleFirestoreError
      try {
        if (errorMessage.startsWith('{') && errorMessage.endsWith('}')) {
          const parsed = JSON.parse(errorMessage);
          if (parsed.error) {
            errorMessage = parsed.error;
            if (errorMessage.includes('Missing or insufficient permissions')) {
              errorMessage = "Permission Denied: You do not have authorization to create this booking or inventory is restricted.";
            }
          }
        }
      } catch (e) {
        // Not JSON, keep original
      }
      
      alert(`Booking Failed: ${errorMessage}`);
    } finally {
      setIsBooking(false);
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  if (!tour)
    return (
      <div className="p-20 text-center text-red-500 font-bold">
        Tour not found
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 md:top-[116px] z-40">
        <div className="container mx-auto px-4 lg:px-8 py-3 md:py-4 flex items-center justify-between">
          <button
            onClick={() => {
              if (step === 'selection') navigate(-1);
              else {
                const steps: CheckoutStep[] = ["selection", "customer", "payment"];
                const prevStep = steps[steps.indexOf(step) - 1];
                updateStep(prevStep);
              }
            }}
            className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-gray-900 transition-all group"
          >
            <div className="p-1.5 md:p-2 rounded-full group-hover:bg-gray-50 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            <span className="hidden sm:inline">Back</span>
          </button>
          
          <div className="flex gap-2 md:gap-4 items-center">
            {[
              { id: "selection", label: "Options" },
              { id: "customer", label: "Details" },
              { id: "payment", label: "Billing" },
            ].map((s, i) => {
              const steps: CheckoutStep[] = ["selection", "customer", "payment"];
              const currentIndex = steps.indexOf(step);
              const isPast = i < currentIndex;
              const isCurrent = i === currentIndex;
              
              return (
                <div key={s.id} className="flex items-center gap-1.5 md:gap-2">
                  <div
                    className={cn(
                      "h-5 w-5 md:h-6 md:w-6 rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-black transition-all",
                      isCurrent ? "bg-primary text-white ring-4 ring-orange-50" : 
                      isPast ? "bg-primary text-white" : 
                      "bg-gray-100 text-gray-400",
                    )}
                  >
                    {isPast ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span
                    className={cn(
                      "text-[10px] md:text-xs font-bold transition-all",
                      isCurrent ? "text-primary" : isPast ? "text-primary" : "text-gray-400",
                    )}
                  >
                    <span className="hidden xs:inline">{s.label}</span>
                  </span>
                  {i < 2 && <div className={cn("h-[1px] w-4 md:w-6 bg-gray-100", isPast && "bg-orange-200")} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-12 items-start">
          {/* Left Column: Flow */}
          <div className="lg:col-span-2 space-y-12 pb-32 md:pb-0 overflow-x-hidden">
            {/* Step 1: Selection (Packages & Add-ons) */}
            {step === "selection" && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4">
                {/* Date & Travelers - Consolidated Configuration with Dark Contrast */}
                <section id="selection-header" className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                      Trip Configuration
                    </h2>
                    <p className="text-sm text-gray-500 font-medium">
                      Pick your preferred date and travelers count.
                    </p>
                  </div>
                  <div className="bg-white rounded-[10px] border border-slate-200 shadow-md overflow-hidden">
                    <div className="p-5 space-y-5">
                      {/* Date Picker Trigger */}
                      <button 
                        type="button"
                        id="date-picker-mobile"
                        onClick={() => setShowDatePicker(!showDatePicker)}
                        className={cn(
                          "w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all bg-white cursor-pointer",
                          date ? "border-primary ring-1 ring-primary/10 shadow-sm" : "border-slate-300 hover:border-slate-400"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                            date ? "bg-primary text-white" : "bg-slate-100 text-slate-500"
                          )}>
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Travel Date</p>
                            <p className={cn("text-sm font-black leading-none", date ? "text-slate-900" : "text-slate-400")}>
                              {date ? new Date(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select Date'}
                            </p>
                          </div>
                        </div>
                        <ChevronDown className={cn("h-4 w-4 transition-transform text-slate-500", showDatePicker && "rotate-180")} />
                      </button>

                      <AnimatePresence>
                        {showDatePicker && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-2 pb-4 px-1">
                              <div className="flex items-center justify-between mb-4">
                                <h3 className="font-extrabold text-slate-800 uppercase tracking-widest text-xs">
                                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </h3>
                                <div className="flex items-center gap-1">
                                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"><ChevronLeft className="h-4 w-4 text-slate-700" /></button>
                                  <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"><ChevronRight className="h-4 w-4 text-slate-700" /></button>
                                </div>
                              </div>
                              <div className="grid grid-cols-7 gap-1">
                                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                                  <div key={day} className="text-[10px] font-black text-slate-400 text-center uppercase py-1">{day}</div>
                                ))}
                                {(() => {
                                  const year = currentMonth.getFullYear();
                                  const month = currentMonth.getMonth();
                                  const firstDay = new Date(year, month, 1).getDay();
                                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                                  const today = new Date(); today.setHours(0,0,0,0);
                                  const cells = [];
                                  for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} />);
                                  for (let d = 1; d <= daysInMonth; d++) {
                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                                    const isPast = new Date(year, month, d) < today;
                                    cells.push(
                                      <button
                                        key={d}
                                        disabled={isPast}
                                        onClick={() => { setDate(dateStr); setShowDatePicker(false); }}
                                        className={cn(
                                          "aspect-square rounded-lg flex items-center justify-center text-xs font-black transition-all cursor-pointer",
                                          date === dateStr 
                                            ? "bg-primary text-white shadow-md shadow-primary/20" 
                                            : isPast 
                                              ? "text-slate-300 line-through opacity-40 cursor-not-allowed" 
                                              : "text-slate-900 bg-slate-50 border border-slate-100 hover:border-primary hover:bg-orange-50"
                                        )}
                                      >
                                        {d}
                                      </button>
                                    );
                                  }
                                  return cells;
                                })()}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
 
                      {/* Travelers Selection (High Contrast Row Inputs) */}
                      <div id="traveler-selection-mobile" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Adults */}
                        <div className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-300 bg-slate-50/50 hover:bg-white hover:border-primary transition-all shadow-sm">
                          <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Adults</p>
                            <p className="text-sm font-black text-slate-900 leading-none">Age 12+</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setAdults(Math.max(1, adults - 1))} className="h-8 w-8 rounded-full bg-slate-950 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer"><Minus className="h-3.5 w-3.5" /></button>
                            <span className="text-sm font-black text-slate-950 w-5 text-center">{adults}</span>
                            <button 
                              onClick={() => {
                                if (spotsLeft !== null && (adults + children + 1) > spotsLeft) { alert(`Only ${spotsLeft} spots available.`); return; }
                                setAdults(adults + 1);
                              }} 
                              className={cn("h-8 w-8 rounded-full bg-slate-950 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer", (spotsLeft !== null && (adults + children + 1) > spotsLeft) && "opacity-50")}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
 
                        {/* Children */}
                        <div className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-300 bg-slate-50/50 hover:bg-white hover:border-primary transition-all shadow-sm">
                          <div>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Children</p>
                            <p className="text-sm font-black text-slate-900 leading-none">Age 3-11</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => setChildren(Math.max(0, children - 1))} className="h-8 w-8 rounded-full bg-slate-950 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer"><Minus className="h-3.5 w-3.5" /></button>
                            <span className="text-sm font-black text-slate-950 w-5 text-center">{children}</span>
                            <button 
                              onClick={() => {
                                if (spotsLeft !== null && (adults + children + 1) > spotsLeft) { alert(`Only ${spotsLeft} spots available.`); return; }
                                setChildren(children + 1);
                              }} 
                              className={cn("h-8 w-8 rounded-full bg-slate-950 hover:bg-slate-800 text-white flex items-center justify-center transition-all cursor-pointer", (spotsLeft !== null && (adults + children + 1) > spotsLeft) && "opacity-50")}
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Capacity Indicator (Integrated) */}
                    {date && spotsLeft !== null && (
                      <div className={cn(
                        "px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.1em] text-center border-t border-slate-200",
                        isSoldOut ? "bg-rose-50 text-rose-600" : isLowCapacity ? "bg-amber-50 text-amber-700" : "bg-orange-50 text-primary"
                      )}>
                        {isSoldOut ? 'Sold Out' : isLowCapacity ? `Limited Availability: Only ${spotsLeft} spots left!` : `Excellent: ${spotsLeft} spots available`}
                      </div>
                    )}
                  </div>
                </section>


                {/* Package Selection */}
                <section id="package-selection" className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                      Select Your Package
                    </h2>
                    <p className="text-sm text-gray-500 font-medium">
                      Select the best option tailored for your adventure.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {tour.packages.map((pkg, idx) => {
                      const isSelected = selectedPackage?.name === pkg.name;
                      const isExpanded = expandedPackage === pkg.name;
                      const price = calculatePackagePrice(pkg);

                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            setSelectedPackage(pkg);
                            setExpandedPackage(pkg.name);
                          }}
                          className={cn(
                            "border-2 rounded-2xl transition-all overflow-hidden bg-white shadow-sm cursor-pointer",
                            isSelected
                              ? "border-primary shadow-md shadow-primary/5"
                              : "border-slate-200 hover:border-slate-300",
                          )}
                        >
                          {/* Viator columns layout */}
                          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
                            {/* Left Column: Details & Specific Highlight features */}
                            <div className="flex-1 md:w-2/3 p-5 md:p-6 flex flex-col gap-4 text-left">
                              <div className="flex items-start gap-4">
                                {/* Custom radio check point */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedPackage(pkg);
                                    setExpandedPackage(pkg.name);
                                  }}
                                  className="mt-1 flex items-center justify-center shrink-0 cursor-pointer focus:outline-none"
                                >
                                  <div
                                    className={cn(
                                      "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                      isSelected
                                        ? "border-primary bg-white"
                                        : "border-slate-300 bg-white",
                                    )}
                                  >
                                    {isSelected && (
                                      <div className="h-3 w-3 rounded-full bg-primary" />
                                    )}
                                  </div>
                                </button>

                                {/* Package Main information */}
                                <div className="flex-1 text-left">
                                  <h3
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedPackage(pkg);
                                      setExpandedPackage(pkg.name);
                                    }}
                                    className="font-extrabold text-slate-900 leading-tight transition-colors cursor-pointer text-base md:text-lg"
                                  >
                                    {pkg.name}
                                  </h3>

                                  {pkg.details && (
                                    <div className="mt-2 text-xs font-semibold text-slate-655 leading-relaxed text-left">
                                      <div className={cn(!showDetailsText[pkg.name] && "line-clamp-2")}>
                                        {pkg.details}
                                      </div>
                                      {pkg.details.length > 100 && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            toggleDetailsText(pkg.name);
                                          }}
                                          className="text-primary hover:text-orange-700 font-extrabold inline-flex items-center gap-0.5 mt-1 cursor-pointer focus:outline-none block"
                                        >
                                          {showDetailsText[pkg.name] ? "Read less" : "Read more"}
                                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showDetailsText[pkg.name] && "rotate-180")} />
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Duration and specs info strip */}
                                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-slate-500 font-bold text-left font-sans">
                                    <div className="flex items-center gap-1 shrink-0">
                                      <Clock className="h-4 w-4 text-slate-400" />
                                      <span>Duration: {tour.duration || "10 hours"}</span>
                                    </div>
                                    {pkg.meetingPoint && (
                                      <div className="flex items-start gap-1.5 min-w-0">
                                        <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                        <span className="text-slate-600 break-words">{(pkg.meetingPointType || 'Meeting Point')}: <span className="font-semibold text-slate-500">{pkg.meetingPoint}</span></span>
                                      </div>
                                    )}
                                    {(() => {
                                      const minRequired = pkg.tiers && pkg.tiers.length > 0 ? Math.min(...pkg.tiers.map(t => t.minParticipants)) : 1;
                                      if (minRequired > 1) {
                                        return (
                                          <div className="flex items-center gap-1 shrink-0 text-red-500 font-extrabold bg-red-50/50 px-2 py-0.5 rounded border border-red-100">
                                            <Users className="h-3.5 w-3.5 shrink-0" />
                                            <span>Min {minRequired} travelers</span>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Right Column: Pricing Area */}
                            <div className="md:w-1/3 p-5 md:p-6 flex flex-col justify-center items-stretch md:items-end md:text-right bg-slate-50/50">
                              <div className="space-y-0.5 mb-2">
                                <div className="flex justify-between md:flex-col items-baseline md:items-end">
                                  <p className="text-xl font-black text-slate-900 font-display tracking-tight leading-none leading-none">
                                    <FormattedPrice amount={price || (getLowestAdultPrice(pkg) * (adults || 1))} />
                                  </p>
                                  <span className="text-[10px] text-slate-400 font-bold">/ total</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <AnimatePresence>
                            {isSelected && (
                              <motion.div
                                onClick={(e) => e.stopPropagation()}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden border-t border-slate-200 bg-slate-50/[0.35]"
                              >
                                <div className="p-5 md:p-6 space-y-6 text-left">
                                  {/* Minimum participants restriction warning */}
                                  {(() => {
                                    const minRequired = pkg.tiers && pkg.tiers.length > 0 ? Math.min(...pkg.tiers.map(t => t.minParticipants)) : 1;
                                    const totalPax = adults + children;
                                    if (totalPax < minRequired) {
                                      return (
                                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-left">
                                          <div className="flex items-start gap-2.5">
                                            <Info className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                                            <div>
                                              <p className="text-xs font-black text-rose-700 uppercase tracking-wider">Booking Limit: Fewer than Minimum Travelers</p>
                                              <p className="text-[11px] text-rose-600 font-bold mt-1 leading-relaxed">
                                                This package has a requirement of at least <span className="text-rose-800 underline font-black">{minRequired} travelers</span> to book. Your current selection is <span className="text-rose-800 font-black">{totalPax} traveler(s)</span>. Please increase your traveler count under the Travelers section.
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}

                                  {/* Preferred Departure time slots */}
                                  {tour.timeSlots && tour.timeSlots.length > 0 && (
                                    <div className="space-y-2 text-left mb-6">
                                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Choose Preferred Departure Time:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {tour.timeSlots.map(time => (
                                          <button
                                            key={time}
                                            type="button"
                                            onClick={() => setSelectedTime(time)}
                                            className={cn(
                                              "px-4 py-2 text-xs font-black rounded-full border-2 transition-all cursor-pointer focus:outline-none",
                                              selectedTime === time
                                                ? "bg-primary border-primary text-white shadow-md shadow-primary/10"
                                                : "bg-white border-slate-200 text-slate-700 hover:border-primary hover:text-primary"
                                            )}
                                          >
                                            {time}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Trust guarantee highlights matching Viator */}
                                  <div className="bg-primary/[0.04] border border-primary/10 rounded-xl p-4 space-y-2 text-left mb-6">
                                    <div className="flex items-start gap-2.5 text-xs font-semibold text-slate-700">
                                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                      <span>
                                        <strong className="font-extrabold border-b border-dashed border-slate-400">Free cancellation</strong> before {selectedTime || '7:00 AM'} on {date ? new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'tomorrow'} (local time)
                                      </span>
                                    </div>

                                  </div>

                                  {/* Viator Pricing Info Section */}
                                  {pkg.tiers && pkg.tiers.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                       <div className="flex items-center justify-between text-left">
                                          <div className="flex items-center gap-1.5">
                                             <div className="h-3 w-0.5 bg-primary rounded-full" />
                                             <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Dynamic Group Rates</h4>
                                          </div>
                                          <span className="text-[9px] font-extrabold text-primary bg-orange-50 px-2 py-0.5 rounded-md border border-primary/20 font-mono">
                                             Active: {adults} pax
                                          </span>
                                       </div>
                                       
                                       <div className="w-full">
                                          <div className="bg-slate-50/50 rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
                                             {pkg.tiers.map((tier, tIdx) => {
                                                const count = adults;
                                                const isActive = count >= tier.minParticipants && count <= tier.maxParticipants;
                                                return (
                                                   <div 
                                                      key={tIdx} 
                                                      className={cn(
                                                         "flex items-center justify-between px-3 py-2 text-xs transition-colors",
                                                         isActive 
                                                           ? "bg-primary/[0.04] text-slate-900 font-medium" 
                                                           : "text-slate-650 hover:bg-slate-100/20"
                                                      )}
                                                   >
                                                      <div className="flex items-center gap-2">
                                                         <span className={cn("text-[11px] font-bold", isActive ? "text-primary" : "text-slate-600")}>
                                                            {tier.maxParticipants >= 99 
                                                               ? `${tier.minParticipants}+ people` 
                                                               : tier.minParticipants === tier.maxParticipants 
                                                                 ? `${tier.minParticipants} person`
                                                                 : `${tier.minParticipants}-${tier.maxParticipants} people`
                                                            }
                                                         </span>
                                                         {isActive && (
                                                            <span className="text-[8px] font-black text-primary bg-orange-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
                                                               Active
                                                            </span>
                                                         )}
                                                      </div>
                                                      
                                                      <div className="flex items-center gap-4 text-slate-500">
                                                         <div className="flex items-center gap-1">
                                                            <span className="text-[9px] text-slate-400 font-medium font-sans">Adult:</span>
                                                            <span className={cn("font-bold font-mono text-[11px]", isActive ? "text-primary font-extrabold" : "text-slate-700")}>
                                                               <FormattedPrice amount={tier.adultPrice} />
                                                            </span>
                                                         </div>
                                                         <div className="flex items-center gap-1">
                                                            <span className="text-[9px] text-slate-400 font-medium font-sans">Child:</span>
                                                            <span className={cn("font-bold font-mono text-[11px]", isActive ? "text-primary font-extrabold" : "text-slate-600")}>
                                                               <FormattedPrice amount={tier.childPrice} />
                                                            </span>
                                                         </div>
                                                      </div>
                                                   </div>
                                                );
                                             })}
                                          </div>
                                       </div>
                                    </div>
                                  )}

                                  {/* Inclusions and Exclusions split layout */}
                                  <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                                    {pkg.inclusions && pkg.inclusions.filter(Boolean).length > 0 && (
                                      <div className="space-y-3 text-left">
                                        <h4 className="text-xs font-bold text-secondary flex items-center gap-1.5 font-extrabold uppercase tracking-wider">
                                          <div className="h-5 w-5 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
                                            <Check className="h-3.5 w-3.5" />
                                          </div>
                                          What's Included
                                        </h4>
                                        <ul className="space-y-1.5">
                                          {pkg.inclusions.filter(Boolean).map((inc, i) => (
                                            <li key={i} className="text-xs text-slate-600 flex items-start gap-2">
                                              <div className="h-1.5 w-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                                              <span className="leading-relaxed font-semibold">{inc}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {pkg.exclusions && pkg.exclusions.filter(Boolean).length > 0 && (
                                      <div className="space-y-3 text-left">
                                        <h4 className="text-xs font-bold text-rose-600 flex items-center gap-1.5 font-extrabold uppercase tracking-wider">
                                          <div className="h-5 w-5 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                                            <Plus className="rotate-45 h-3.5 w-3.5" />
                                          </div>
                                          What's Excluded
                                        </h4>
                                        <ul className="space-y-1.5">
                                          {pkg.exclusions.filter(Boolean).map((exc, i) => (
                                            <li key={i} className="text-xs text-slate-450 flex items-start gap-2">
                                              <div className="h-1.5 w-1.5 rounded-full bg-rose-200 mt-1.5 shrink-0" />
                                              <span className="leading-relaxed line-through decoration-slate-300 font-semibold">{exc}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>

                                  {/* Special Booking Rate label section */}
                                  <div className="pt-5 border-t border-slate-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
                                    <div className="text-left w-full">
                                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest block">Special Booking Rate</span>
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-slate-900 tracking-tight font-display">
                                          <FormattedPrice amount={price} />
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">all inclusive group pricing</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </section>

                 {/* Transport / Pick Up Option Selection */}
                {availableTransports.length > 0 && (
                  <section id="transport-selection" className="space-y-6">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                        Pick a Transport Option
                      </h2>
                      <p className="text-sm text-gray-500 font-medium">
                        Select your preferred transfer or meeting arrangement. Vehicles are automatically checked to accommodate your group of <span className="text-primary font-black">{adults + children}</span> traveler(s).
                      </p>
                    </div>

                    {/* 3 Main Options */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {/* 1. Own Transport */}
                      {availableTransports.some(t => t.type === 'meet') && (
                        <div
                          onClick={() => {
                            setSelectedTransportType('meet');
                            const opt = availableTransports.find(t => t.type === 'meet');
                            if (opt) setSelectedTransport(opt);
                            setCustomerData(prev => ({
                              ...prev,
                              pickupAddress: tour?.meetingPoint || "Meet directly at our adventure basecamp."
                            }));
                          }}
                          className={cn(
                            "border-2 rounded-[15px] p-5 transition-all bg-white relative cursor-pointer group flex flex-col justify-between gap-4",
                            selectedTransportType === 'meet'
                              ? "border-primary bg-orange-50/10 shadow-md shadow-primary/5"
                              : "border-gray-150 hover:border-primary/20"
                          )}
                        >
                          <div className="space-y-3 text-left">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "h-10 w-10 rounded-[10px] flex items-center justify-center transition-colors",
                                selectedTransportType === 'meet' ? "bg-primary text-white" : "bg-orange-50 text-primary"
                              )}>
                                <MapPin className="h-5 w-5" />
                              </div>
                              <div>
                                <h3 className="font-extrabold text-gray-950 text-sm leading-snug group-hover:text-primary transition-colors">
                                  Own Transport
                                </h3>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                  Self-Arrival
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">
                              Come directly to our operation basecamp on your own. No pickup service.
                            </p>
                          </div>
                          <div className="border-t border-gray-50 pt-3 flex items-center justify-between text-left">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rate</span>
                            <span className="text-sm font-black text-primary">Free</span>
                          </div>
                        </div>
                      )}

                      {/* 2. Shared Transfer */}
                      {availableTransports.some(t => t.type === 'shared') && (() => {
                        const sOpt = availableTransports.find(t => t.type === 'shared');
                        const rateText = sOpt ? `${formatPrice(sOpt.price)}/person` : "Available";
                        return (
                          <div
                            onClick={() => {
                              setSelectedTransportType('shared');
                              if (sOpt) setSelectedTransport(sOpt);
                              setCustomerData(prev => {
                                const isMeetingPoint = prev.pickupAddress === (tour?.meetingPoint || "Meet directly at our adventure basecamp.");
                                return {
                                  ...prev,
                                  pickupAddress: isMeetingPoint ? "" : prev.pickupAddress
                                };
                              });
                            }}
                            className={cn(
                              "border-2 rounded-[15px] p-5 transition-all bg-white relative cursor-pointer group flex flex-col justify-between gap-4",
                              selectedTransportType === 'shared'
                                ? "border-primary bg-orange-50/10 shadow-md shadow-primary/5"
                                : "border-gray-150 hover:border-primary/20"
                            )}
                          >
                            <div className="space-y-3 text-left">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "h-10 w-10 rounded-[10px] flex items-center justify-center transition-colors",
                                  selectedTransportType === 'shared' ? "bg-primary text-white" : "bg-orange-50 text-primary"
                                )}>
                                  <Bus className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-gray-950 text-sm leading-snug group-hover:text-primary transition-colors">
                                    Shared Transfer
                                  </h3>
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                    Shuttle service
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                Pickup & drop-off shared with other travelers. Fixed timings by area.
                              </p>
                            </div>
                            <div className="border-t border-gray-50 pt-3 flex items-center justify-between text-left">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rate</span>
                              <span className="text-sm font-black text-primary">{rateText}</span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* 3. Private Transfer */}
                      {availableTransports.some(t => t.type === 'private') && (() => {
                        const pOpts = availableTransports.filter(t => t.type === 'private');
                        const totalParticipants = adults + children;
                        const matchingCars = pOpts.filter(t => t.maxCapacity === undefined || t.maxCapacity === null || totalParticipants <= t.maxCapacity);
                        const lowestPrice = matchingCars.length > 0 
                          ? Math.min(...matchingCars.map(c => c.price)) 
                          : pOpts.length > 0 ? Math.min(...pOpts.map(c => c.price)) : 0;
                        const rateText = lowestPrice > 0 ? `From ${formatPrice(lowestPrice)}/car` : "Available";

                        return (
                          <div
                            onClick={() => {
                              setSelectedTransportType('private');
                              const bestPrivateOpt = matchingCars[0] || pOpts[0];
                              if (bestPrivateOpt) setSelectedTransport(bestPrivateOpt);
                              setCustomerData(prev => {
                                const isMeetingPoint = prev.pickupAddress === (tour?.meetingPoint || "Meet directly at our adventure basecamp.");
                                return {
                                  ...prev,
                                  pickupAddress: isMeetingPoint ? "" : prev.pickupAddress
                                };
                              });
                            }}
                            className={cn(
                              "border-2 rounded-[15px] p-5 transition-all bg-white relative cursor-pointer group flex flex-col justify-between gap-4",
                              selectedTransportType === 'private'
                                ? "border-primary bg-orange-50/10 shadow-md shadow-primary/5"
                                : "border-gray-150 hover:border-primary/20"
                            )}
                          >
                            <div className="space-y-3 text-left">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "h-10 w-10 rounded-[10px] flex items-center justify-center transition-colors",
                                  selectedTransportType === 'private' ? "bg-primary text-white" : "bg-orange-50 text-primary"
                                )}>
                                  <Car className="h-5 w-5" />
                                </div>
                                <div>
                                  <h3 className="font-extrabold text-gray-950 text-sm leading-snug group-hover:text-primary transition-colors">
                                    Private Transfer
                                  </h3>
                                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                                    Dedicated car
                                  </p>
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                AC vehicle with professional driver exclusively for your group.
                              </p>
                            </div>
                            <div className="border-t border-gray-50 pt-3 flex items-center justify-between text-left">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rate</span>
                              <span className="text-sm font-black text-primary">{rateText}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Own Transport meeting point info display */}
                    {selectedTransportType === 'meet' && (() => {
                      const mp = parseMeetingPoint(tour?.meetingPoint);
                      return (
                        <div className="mt-4 bg-orange-50/50 border border-primary/25 rounded-xl p-5 text-left animate-in fade-in duration-200">
                          <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] block mb-2">Meeting Point Location:</span>
                          <div className="space-y-2.5">
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                              <div className="space-y-1">
                                <span className="text-sm font-black text-slate-900 block">{mp.venue}</span>
                                {mp.address && mp.address !== mp.venue && (
                                  <p className="text-xs text-slate-600 font-bold leading-relaxed">{mp.address}</p>
                                )}
                              </div>
                            </div>
                            <div className="pl-6 border-t border-orange-200/40 pt-2.5">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Direct Google Maps Link:</span>
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
                        </div>
                      );
                    })()}

                    {/* Sub-options for Private Transfer (car list matching capacity) */}
                    {selectedTransportType === 'private' && (
                      <div className="space-y-4 pt-4 border-t border-gray-100 animate-in fade-in duration-200">
                        <div>
                          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                            Select Your Vehicle
                          </h3>
                          <p className="text-xs text-gray-500 font-medium">
                            Choose from vehicles that match your group size of <span className="text-primary font-bold">{adults + children}</span> pax.
                          </p>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                          {availableTransports
                            .filter(t => t.type === 'private')
                            .map((t, idx) => {
                              const isSelected = selectedTransport?.id === t.id;
                              const totalParticipants = adults + children;
                              const hasCapacity = t.maxCapacity === undefined || t.maxCapacity === null || totalParticipants <= t.maxCapacity;

                              if (!hasCapacity) return null; // Only show cars that match participant count

                              return (
                                <div
                                  key={t.id || idx}
                                  onClick={() => setSelectedTransport(t)}
                                  className={cn(
                                    "border-2 rounded-xl p-4 transition-all bg-white cursor-pointer flex flex-col justify-between gap-3 text-left",
                                    isSelected
                                      ? "border-primary bg-orange-50/10"
                                      : "border-gray-100 hover:border-primary/20"
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                      <div className={cn(
                                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                                        isSelected ? "bg-primary text-white" : "bg-gray-50 text-gray-500"
                                      )}>
                                        <Car className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <h4 className="font-extrabold text-gray-900 text-sm">
                                          {t.name}
                                        </h4>
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                          Capacity: {t.maxCapacity} pax
                                        </span>
                                      </div>
                                    </div>
                                    <span className="text-xs font-black text-primary">
                                      {formatPrice(t.price)}/car
                                    </span>
                                  </div>
                                  {t.description && (
                                    <p className="text-xs text-gray-500 font-medium leading-normal pl-10">
                                      {t.description}
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Hotel Address Input Form for Shared and Private Transfer */}
                    {(selectedTransportType === 'shared' || selectedTransportType === 'private') && (
                      <div className="bg-orange-50/20 border border-primary/20 rounded-2xl p-6 mt-6 space-y-3 animate-in fade-in duration-200">
                        <label className="text-xs font-black text-gray-700 uppercase tracking-widest flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          Hotel Name & Address (For Pickup) <span className="text-rose-500 font-bold">*</span>
                        </label>
                        <p className="text-xs text-gray-500 font-medium">
                          Please enter the complete name of your hotel, resort, or villa, and its address in Bali for our driver to pick you up.
                        </p>
                        <textarea
                          required
                          rows={3}
                          value={customerData.pickupAddress}
                          onChange={(e) =>
                            setCustomerData({
                              ...customerData,
                              pickupAddress: e.target.value,
                            })
                          }
                          placeholder="e.g. Ayana Resort Bali, Jl. Karang Mas Sejahtera, Jimbaran"
                          className="w-full rounded-xl border-2 border-gray-100 p-4 focus:border-primary focus:outline-none bg-white font-bold transition-all text-sm shadow-sm"
                        />
                        {!customerData.pickupAddress.trim() && (
                          <p className="text-[11px] text-rose-500 font-bold animate-pulse">
                            ⚠️ Hotel address is required to arrange your pickup.
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {/* Add-on Selection */}
                <section className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                      Enhance Your Trip
                    </h2>
                    <p className="text-sm text-gray-500 font-medium">
                      Add those extra touches to make your journey perfect.
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6">
                    {/* Explicit "None" Option for Add-ons */}
                    <div
                      onClick={() => setSelectedAddOns([])}
                      className={cn(
                        "border-2 rounded-[15px] p-5 transition-all bg-white relative cursor-pointer group",
                        selectedAddOns.length === 0
                          ? "border-primary bg-orange-50/10"
                          : "border-gray-50 hover:border-primary/20",
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-6 w-6 rounded border-2 transition-all flex items-center justify-center",
                          selectedAddOns.length === 0
                            ? "bg-primary border-primary text-white"
                            : "border-gray-200",
                        )}>
                          {selectedAddOns.length === 0 && <Check className="h-4 w-4" />}
                        </div>
                        <div>
                          <h4 className="font-extrabold text-gray-900">No Add-ons</h4>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">I don't need any extras</p>
                        </div>
                      </div>
                    </div>

                    {tour.addOns?.map((addon, idx) => {
                      const isSelected = !!selectedAddOns.find(
                        (a) => a.id === addon.id,
                      );
                      const isExpanded = expandedAddOn === addon.id;

                      return (
                        <div
                          key={idx}
                          className={cn(
                            "border-2 rounded-[15px] p-5 transition-all bg-white relative group",
                            isSelected
                              ? "border-primary bg-orange-50/10"
                              : "border-gray-50 hover:border-primary/20",
                          )}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4">
                              <button
                                onClick={() => toggleAddOn(addon)}
                                className={cn(
                                  "h-6 w-6 rounded border-2 transition-all flex items-center justify-center mt-1",
                                  isSelected
                                    ? "bg-primary border-primary text-white"
                                    : "border-gray-200",
                                )}
                              >
                                {isSelected && <Check className="h-4 w-4" />}
                              </button>
                              <div>
                                <h4 className="font-extrabold text-gray-900">
                                  {addon.name}
                                </h4>
                                <p className="text-xs font-bold text-primary mt-1 tracking-tight">
                                  <FormattedPrice amount={addon.price} /> / {addon.unit}
                                </p>
                                
                                {isSelected && (
                                  <div className="mt-4 flex items-center gap-4 p-2 bg-white rounded-lg border border-gray-100 shadow-sm w-fit">
                                    <span className="text-xs font-semibold text-gray-500 ml-1">Quantity:</span>
                                    <div className="flex items-center gap-3">
                                      <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); updateAddOnQuantity(addon.id, -1); }}
                                        className="h-6 w-6 rounded-md bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                                      >
                                        <Minus className="h-3 w-3" />
                                      </button>
                                      <span className="text-sm font-black text-gray-900 w-4 text-center">
                                        {selectedAddOns.find(a => a.id === addon.id)?.quantity}
                                      </span>
                                      <button 
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); updateAddOnQuantity(addon.id, 1); }}
                                        className="h-6 w-6 rounded-md bg-gray-50 flex items-center justify-center text-gray-500 hover:bg-gray-100"
                                      >
                                        <Plus className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                setExpandedAddOn(isExpanded ? null : addon.id)
                              }
                              className="text-gray-400 hover:text-primary transition-colors p-1"
                            >
                              <Info className="h-5 w-5" />
                            </button>
                          </div>

                          <AnimatePresence>
                            {isExpanded && addon.description && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{
                                  height: "auto",
                                  opacity: 1,
                                  marginTop: 12,
                                }}
                                exit={{ height: 0, opacity: 0, marginTop: 0 }}
                                className="overflow-hidden"
                              >
                                <p className="text-xs text-gray-500 font-medium leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                                  {addon.description}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="pt-8 hidden md:flex flex-col items-end gap-4">
                  {(spotsLeft !== null && (adults + children) > spotsLeft) && (
                    <div className="flex items-center gap-2 text-red-500 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
                      <Info className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Capacity Exceeded: Only {spotsLeft} spots remaining
                      </span>
                    </div>
                  )}
                  {isUnderMinParticipants && (
                    <div className="flex items-center gap-2 text-red-500 bg-red-50 px-4 py-2 rounded-lg border border-red-100">
                      <Info className="h-4 w-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Fewer than minimum participants required for selected package
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => updateStep("customer")}
                    disabled={isSoldOut || (spotsLeft !== null && (adults + children) > spotsLeft) || isUnderMinParticipants}
                    className="bg-primary text-white px-12 py-5 rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSoldOut ? 'Sold Out' : (spotsLeft !== null && (adults + children) > spotsLeft) ? 'Not Enough Spots' : 
                     isUnderMinParticipants ? 'Under Min Travelers' : 'Continue To Details'} <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Customer Info */}
            {step === "customer" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                    Who's Traveling?
                  </h2>
                  <p className="text-sm text-gray-500 font-medium">
                    Please provide your details for the booking confirmation.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-[20px] border border-gray-100 shadow-sm space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 px-1">
                      Full Name
                    </label>
                    <input
                      required
                      type="text"
                      value={customerData.fullName}
                      onChange={(e) =>
                        setCustomerData({
                          ...customerData,
                          fullName: e.target.value,
                        })
                      }
                      placeholder="e.g. John Alexander"
                      className="w-full rounded-[12px] border-2 border-gray-50 p-4 focus:border-primary focus:outline-none bg-gray-50/30 font-bold transition-all text-sm"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 px-1">
                        Email Address
                      </label>
                      <input
                        required
                        type="email"
                        value={customerData.email}
                        onChange={(e) =>
                          setCustomerData({
                            ...customerData,
                            email: e.target.value,
                          })
                        }
                        placeholder="john@example.com"
                        className="w-full rounded-[12px] border-2 border-gray-50 p-4 focus:border-primary focus:outline-none bg-gray-50/30 font-bold transition-all text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 px-1 uppercase tracking-widest flex items-center gap-2">
                        Nationality
                      </label>
                      <select
                        required
                        value={customerData.nationality}
                        onChange={(e) =>
                          setCustomerData({
                            ...customerData,
                            nationality: e.target.value,
                          })
                        }
                        className="w-full rounded-[12px] border-2 border-gray-50 p-4 focus:border-primary focus:outline-none bg-gray-50/30 font-bold transition-all text-sm appearance-none"
                      >
                        <option value="">Select Country</option>
                        {COUNTRIES_WITH_CODES.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} {c.dialCode ? `(${c.dialCode})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 px-1 uppercase tracking-widest flex items-center gap-2">
                        Phone Number
                      </label>
                      <input
                        required
                        type="tel"
                        value={customerData.phone}
                        onChange={(e) =>
                          setCustomerData({
                            ...customerData,
                            phone: e.target.value,
                          })
                        }
                        placeholder="e.g. 081238363366"
                        className="w-full rounded-[12px] border-2 border-gray-50 p-4 focus:border-primary focus:outline-none bg-gray-50/30 font-bold transition-all text-sm"
                      />
                      {customerData.phone && customerData.nationality && (
                        <p className="text-[11px] text-primary font-bold px-1 animate-in fade-in">
                          Will be saved as: <span className="font-mono text-xs">{getInternationalPhoneNumber(customerData.phone, customerData.nationality)}</span> (for WhatsApp delivery)
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 px-1 uppercase tracking-widest">
                      Special Requirements
                    </label>
                    <textarea
                      rows={4}
                      value={customerData.specialRequirements}
                      onChange={(e) =>
                        setCustomerData({
                          ...customerData,
                          specialRequirements: e.target.value,
                        })
                      }
                      placeholder="Allergies, wheelchair access, dietary preferences..."
                      className="w-full rounded-[12px] border-2 border-gray-50 p-4 focus:border-primary focus:outline-none bg-gray-50/30 font-bold transition-all text-sm"
                    />
                  </div>
                </div>

                <div className="hidden md:flex justify-between items-center">
                  <button
                    onClick={() => updateStep("selection")}
                    className="text-gray-400 font-bold text-sm tracking-tight hover:text-gray-600"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (validateCustomerData()) {
                        updateStep("payment");
                      }
                    }}
                    className="bg-primary text-white px-12 py-5 rounded-full font-black tracking-[0.2em] text-xs shadow-xl shadow-primary/20 hover:opacity-90 transition-all flex items-center gap-3"
                  >
                    Continue To Payment <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Payment */}
            {step === "payment" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                    Secure Payment
                  </h2>
                  <p className="text-sm text-gray-500 font-medium">
                    Choose your preferred way to pay securely.
                  </p>
                </div>

                <div className="grid gap-4">
                  {[
                    {
                      id: "paypal",
                      label: "PayPal",
                      icon: Wallet,
                      des: "Fast and secure payment with your PayPal account",
                      enabled: paymentSettings?.isPaypalEnabled ?? true,
                    },
                    {
                      id: "card",
                      label: "Credit Card (by PayPal)",
                      icon: CreditCard,
                      des: "All major cards accepted. Handled securely by PayPal",
                      enabled: paymentSettings?.creditCardEnabled ?? true,
                    },
                    {
                      id: "bank_transfer",
                      label: "Manual Bank Transfer",
                      icon: Banknote,
                      des: "Direct deposit to our merchant account",
                      enabled: paymentSettings?.isBankTransferEnabled ?? true,
                    },
                    {
                      id: "pay_on_arrival",
                      label: "Cash on Arrival",
                      icon: DollarSign,
                      des: "Pay cash on the day of the activity",
                      enabled: paymentSettings?.isPayOnArrivalEnabled ?? true,
                    },
                  ]
                    .filter((m) => m.enabled)
                    .map((method) => (
                      <div
                        key={method.id}
                        onClick={() =>
                          setPaymentMethod(method.id as PaymentMethod)
                        }
                        className={cn(
                          "p-6 rounded-[20px] border-2 transition-all cursor-pointer flex items-center justify-between bg-white",
                          paymentMethod === method.id
                            ? "border-primary shadow-xl ring-4 ring-orange-50"
                            : "border-gray-50 hover:border-primary/20",
                        )}
                      >
                        <div className="flex items-center gap-6">
                          <div
                            className={cn(
                              "h-14 w-14 rounded-[15px] flex items-center justify-center transition-colors",
                              paymentMethod === method.id
                                ? "bg-primary text-white"
                                : "bg-gray-50 text-gray-400 group-hover:bg-orange-50 group-hover:text-primary",
                            )}
                          >
                            <method.icon className="h-7 w-7" />
                          </div>
                          <div>
                            <p className="font-extrabold text-gray-900">
                              {method.label}
                            </p>
                            <p className="text-xs text-gray-500 font-medium">
                              {method.des}
                            </p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "h-6 w-6 rounded-full border-2 flex items-center justify-center",
                            paymentMethod === method.id
                              ? "bg-primary border-primary text-white"
                              : "border-gray-100",
                          )}
                        >
                          {paymentMethod === method.id && (
                            <Check className="h-3 w-3" />
                          )}
                        </div>
                      </div>
                    ))}
                </div>

                <div className="rounded-[20px] border-2 border-primary/20 p-8 bg-orange-50/20 flex gap-6">
                  <ShieldCheck className="h-10 w-10 text-primary shrink-0" />
                  <div>
                    <h4 className="font-black text-primary text-sm tracking-widest mb-1">
                      Guaranteed Security
                    </h4>
                    <p className="text-xs text-gray-600 font-medium leading-relaxed">
                      Your data and payments are encrypted and protected by
                      international security standards. By proceeding, you agree
                      to our booking terms and conditions.
                    </p>
                  </div>
                </div>

                {paymentMethod === "pay_on_arrival" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-50 rounded-[20px] p-8 border-2 border-dashed border-gray-200 space-y-6"
                  >
                    <div className="flex items-center gap-4 text-gray-900">
                      <div className="h-12 w-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                        <Banknote className="h-6 w-6 text-emerald-500" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm tracking-widest">
                          Cash on Arrival
                        </h4>
                        <p className="text-[10px] text-gray-500 font-bold">
                          Pay directly to our guide/driver
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 text-xs text-gray-600 font-medium leading-relaxed">
                      Please prepare the exact amount of <span className="font-bold text-gray-900">{formatPrice(summary.grandTotal)}</span> in IDR (Indonesian Rupiah) or equivalent USD/AUD. Your booking is confirmed immediately, and you can pay upon arrival at the activity location.
                    </div>
                  </motion.div>
                )}

                {paymentMethod === "bank_transfer" && paymentSettings && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-50 rounded-[20px] p-8 border-2 border-dashed border-gray-200 space-y-6"
                  >
                    <div className="flex items-center gap-4 text-gray-900">
                      <div className="h-12 w-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
                        <Database className="h-6 w-6 text-secondary" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm tracking-widest">
                          Direct Bank Transfer
                        </h4>
                        <p className="text-[10px] text-gray-500 font-bold">
                          Bali Adventours Merchant Account
                        </p>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-8 pt-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-400 tracking-widest">
                          Bank Name
                        </span>
                        <p className="font-bold text-gray-900 border-b border-gray-100 pb-2">
                          {paymentSettings.bankName || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-400 tracking-widest">
                          Account Number
                        </span>
                        <p className="font-mono font-black text-lg text-primary border-b border-gray-100 pb-2">
                          {paymentSettings.accountNumber || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-400 tracking-widest">
                          SWIFT Code
                        </span>
                        <p className="font-mono font-black text-lg text-secondary border-b border-gray-100 pb-2">
                          {paymentSettings.swiftCode || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-400 tracking-widest">
                          Account Holder
                        </span>
                        <p className="font-bold text-gray-900 border-b border-gray-100 pb-2">
                          {paymentSettings.accountHolder || "N/A"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-gray-400 tracking-widest">
                          Amount To Pay
                        </span>
                        <p className="font-black text-xl text-secondary border-b border-gray-100 pb-2">
                          <FormattedPrice amount={summary.amountToPay} />
                        </p>
                      </div>
                    </div>

                    {paymentSettings.bankInstructions && (
                      <div className="bg-white p-4 rounded-xl text-[11px] text-gray-500 font-medium leading-relaxed border border-gray-100">
                        " {paymentSettings.bankInstructions} "
                      </div>
                    )}
                  </motion.div>
                )}

                <div className="space-y-6">
                  <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-100 shadow-sm cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setAgreedToTerms(!agreedToTerms)}>
                    <button
                      type="button"
                      className={cn(
                        "h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all",
                        agreedToTerms ? "bg-primary border-primary text-white" : "border-gray-200"
                      )}
                    >
                      {agreedToTerms && <Check className="h-4 w-4" />}
                    </button>
                    <p className="text-xs text-gray-600 font-medium">
                      By booking this tour you agree to our <Link to="/pages/terms-and-conditions" className="text-primary font-bold hover:underline" target="_blank">Terms and Conditions</Link>
                    </p>
                  </div>

                  <div className="hidden md:flex justify-between items-center mb-4">
                    <button
                      onClick={() => updateStep("customer")}
                      className="text-gray-400 font-black text-xs tracking-widest hover:text-gray-600"
                    >
                      Back
                    </button>
                  </div>

                  {paymentMethod === "bank_transfer" ||
                  paymentMethod === "pay_on_arrival" ||
                  summary.grandTotal <= 0 ? (
                    <div className="hidden md:flex justify-end">
                      <button
                        onClick={() => handleFinalBooking()}
                        disabled={isBooking || !agreedToTerms}
                        className="w-full sm:w-auto bg-primary text-white px-16 py-6 rounded-full font-black tracking-[0.2em] text-sm shadow-2xl shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isBooking ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            Complete Booking <Check className="h-5 w-5" />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className={cn("w-full relative z-0 min-h-[150px] flex flex-col transition-opacity", !agreedToTerms && "opacity-50 pointer-events-none")}>
                      {!agreedToTerms && (
                        <p className="text-xs font-bold text-amber-600 tracking-tight mb-4 animate-bounce">
                          Please agree to Terms & Conditions above
                        </p>
                      )}
                      {paymentSettings && paymentSettings.isPaypalEnabled && (paymentSettings.paypalMode === 'live' ? paymentSettings.paypalClientId : (paymentSettings.paypalSandboxClientId || paymentSettings.paypalClientId)) && (
                        <div className="w-full">
                          <PayPalScriptProvider
                            options={{
                              clientId: (paymentSettings.paypalMode === 'live' 
                                ? paymentSettings.paypalClientId.trim() 
                                : (paymentSettings.paypalSandboxClientId?.trim() || paymentSettings.paypalClientId.trim())),
                              currency: "USD",
                              intent: "capture",
                              components: "buttons"
                            }}
                            key={(paymentSettings.paypalMode === 'live' ? paymentSettings.paypalClientId : (paymentSettings.paypalSandboxClientId || paymentSettings.paypalClientId)) + summary.grandTotal}
                          >
                            <PayPalButtons
                              style={{ 
                                layout: "vertical",
                                shape: "rect",
                                color: "blue",
                                label: "paypal",
                                height: 55
                              }}
                              forceReRender={[summary.amountToPay, paymentSettings.paypalClientId, paymentSettings.paypalSandboxClientId, paymentSettings.paypalMode, agreedToTerms]}
                              createOrder={(data, actions) => {
                                return actions.order.create({
                                  intent: 'CAPTURE',
                                  purchase_units: [
                                    {
                                      amount: {
                                        value: summary.amountToPay.toFixed(2),
                                        currency_code: "USD",
                                      },
                                      description: `${tour?.title} - ${selectedPackage?.name}`,
                                    },
                                  ],
                                });
                              }}
                              onApprove={handlePayPalApprove}
                              onError={(err) => {
                                console.error("PayPal Error:", err);
                                alert("Payment failed. Please ensure your Client ID is correct in Admin settings.");
                              }}
                            />
                          </PayPalScriptProvider>
                        </div>
                      )}
                      {(!paymentSettings || !(paymentSettings.paypalMode === 'live' ? paymentSettings.paypalClientId : (paymentSettings.paypalSandboxClientId || paymentSettings.paypalClientId))) && (
                        <div className="text-gray-400 text-xs font-bold">
                          PayPal is being configured...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Checkout Summary Sidebar */}
          <div className="hidden md:block md:col-span-1">
            <div className="sticky top-28 space-y-8">
              {/* Main Summary Card */}
              <div className="bg-white rounded-[20px] border border-gray-100 shadow-xl overflow-hidden">
                <div className="aspect-video w-full relative">
                  <img
                    src={tour.gallery[0] || ""}
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-orange-500 text-white text-[8px] font-black uppercase tracking-widest rounded-full">
                        Experience
                      </span>
                      <div className="flex text-amber-400">
                        <Star className="h-2 w-2 fill-current" />
                      </div>
                    </div>
                    <h3 className="text-white font-black tracking-tight leading-tight">
                      {tour.title}
                    </h3>
                  </div>
                </div>

              <div className="p-8 space-y-6">
                  {/* Availability Warning for Desktop Sidebar */}
                  {spotsLeft !== null && (
                    <div className={cn(
                      "p-3 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                      isSoldOut ? "bg-red-50 border-red-100 text-red-600" :
                      (adults + children) > spotsLeft ? "bg-red-50 border-red-100 text-red-600 animate-pulse" :
                      isLowCapacity ? "bg-orange-50 border-orange-100 text-orange-600" :
                      "bg-orange-50 border-primary/20 text-primary"
                    )}>
                      {isSoldOut ? (
                        <><Info className="h-3.5 w-3.5" /> Sold Out for this date</>
                      ) : (adults + children) > spotsLeft ? (
                        <><Info className="h-3.5 w-3.5" /> Insufficient spots: Only {spotsLeft} available</>
                      ) : (
                        <><Check className="h-3.5 w-3.5" /> {spotsLeft} spots available</>
                      )}
                    </div>
                  )}

                  {/* Details Strip */}
                  <div className="flex items-center justify-between border-b border-gray-50 pb-6 gap-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-primary" />
                      <div>
                        <p className="text-[10px] font-black text-gray-400 tracking-tighter">
                          Date
                        </p>
                        <p className="font-extrabold text-gray-900 text-xs">
                          {new Date(date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <Users className="h-4 w-4 text-primary" />
                      <div className="flex-1">
                        <p className="text-[10px] font-black text-gray-400 tracking-tighter">
                          Travelers
                        </p>
                        <p className="font-extrabold text-gray-900 text-xs">
                          {adults + children} Total
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Pricing Breakdown */}
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center group">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-gray-400 tracking-tight">
                            Package Price
                          </span>
                          <span className="font-bold text-gray-900 text-sm">
                            {selectedPackage?.name}
                          </span>
                        </div>
                      </div>
                      
                      {/* Detailed Guests Breakdown */}
                      <div className="space-y-1.5 pl-2 border-l-2 border-primary/20">
                        {adults > 0 && (
                          <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                            <div className="flex flex-col">
                              <span>Adults (x{adults})</span>
                              <span className="text-[10px] text-primary font-black"><FormattedPrice amount={applicableTier?.adultPrice || 0} /> / person</span>
                            </div>
                            <span className="font-bold"><FormattedPrice amount={(applicableTier?.adultPrice || 0) * adults} /></span>
                          </div>
                        )}
                        {children > 0 && (
                          <div className="flex justify-between items-center text-xs text-gray-500 font-medium pt-1">
                            <div className="flex flex-col">
                              <span>Children (x{children})</span>
                              <span className="text-[10px] text-primary font-black"><FormattedPrice amount={applicableTier?.childPrice || 0} /> / child</span>
                            </div>
                            <span className="font-bold"><FormattedPrice amount={(applicableTier?.childPrice || 0) * children} /></span>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedTransport && (
                      <div className="space-y-3 pt-4 border-t border-gray-50">
                        <p className="text-xs font-bold text-primary tracking-tight flex items-center gap-1">
                          <Car className="h-3.5 w-3.5" /> Selected Transport
                        </p>
                        <div className="flex justify-between items-start animate-in fade-in slide-in-from-right-2">
                          <div className="text-left">
                            <p className="text-xs text-gray-700 font-bold">{selectedTransport.name}</p>
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider block mt-0.5">
                              {selectedTransport.type === 'meet' ? 'Meet on location' : `${selectedTransport.carType || selectedTransport.type}`}
                            </p>
                          </div>
                          <span className="text-xs font-black text-gray-700">
                            {selectedTransport.type === 'meet' ? 'Free' : <FormattedPrice amount={summary.transportTotal} />}
                          </span>
                        </div>
                      </div>
                    )}

                    {selectedAddOns.length > 0 && (
                      <div className="space-y-3 pt-4 border-t border-gray-50">
                        <p className="text-xs font-bold text-primary tracking-tight">
                          Added Extras
                        </p>
                        {selectedAddOns.map((a) => (
                          <div
                            key={a.id}
                            className="flex justify-between items-center animate-in fade-in slide-in-from-right-2"
                          >
                            <span className="text-xs text-gray-500 font-medium">
                              {a.name}{" "}
                              <span className="text-[10px] font-black opacity-60 ml-1">
                                {a.quantity}x <FormattedPrice amount={a.price} />
                              </span>
                            </span>
                            <span className="text-xs font-bold text-gray-600">
                              <FormattedPrice amount={a.price * a.quantity} />
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Total Bar */}
                  <div className="pt-8 border-t-2 border-dashed border-gray-100">
                    {summary.discount > 0 && (
                      <div className="flex justify-between items-center mb-4 text-primary">
                        <span className="text-xs font-bold tracking-tight">
                          Coupon Discount
                        </span>
                        <span className="font-bold">
                          -<FormattedPrice amount={summary.discount} />
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-baseline mb-2">
                       <span className="text-sm font-bold text-gray-900 tracking-tight">
                         {existingBooking ? "New Total Estimate" : "Total Estimate"}
                       </span>
                       <span className="text-xs font-medium text-gray-400">
                         All taxes included
                       </span>
                    </div>
                    <div className="flex justify-between items-center mb-6">
                       <span className="text-3xl font-black text-primary font-display tracking-tighter leading-none">
                         <FormattedPrice amount={summary.grandTotal} />
                       </span>
                       <div className="h-10 w-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary shadow-inner">
                         <Rocket className="h-4 w-4" />
                       </div>
                    </div>

                    {existingBooking && (
                      <div className="space-y-4 mb-8 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                        <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                          <span>Original Price Paid</span>
                          <span><FormattedPrice amount={summary.amountPaid} /></span>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                          <span className="text-sm font-black text-gray-900">Total to Pay Now</span>
                          <span className="text-2xl font-black text-secondary"><FormattedPrice amount={summary.amountToPay} /></span>
                        </div>
                      </div>
                    )}

                    {/* Desktop Coupon Field - Moved here to be more prominent */}
                    <div className="mt-8 pt-8 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Tag className="h-3 w-3 text-primary" />
                        <h4 className="text-[10px] font-black text-gray-900 uppercase tracking-widest">
                          Have a coupon?
                        </h4>
                      </div>

                      {appliedCoupon ? (
                        <div className="flex items-center justify-between bg-orange-50 p-3 rounded-xl border border-primary/20">
                          <div className="flex items-center gap-2">
                            <Check className="h-3 w-3 text-primary" />
                            <span className="text-[10px] font-bold text-primary">{appliedCoupon.code} Applied</span>
                          </div>
                          <button
                            onClick={() => setAppliedCoupon(null)}
                            className="text-[10px] font-black text-primary hover:text-primary"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="CODE"
                            value={couponInput}
                            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                            className="flex-1 rounded-xl border border-gray-100 bg-gray-50/50 p-3 focus:border-primary focus:outline-none font-bold text-xs uppercase"
                          />
                          <button
                            onClick={handleApplyCoupon}
                            disabled={isValidatingCoupon || !couponInput}
                            className="bg-gray-900 text-white px-4 py-3 rounded-xl font-bold text-[10px] hover:bg-black transition-all disabled:opacity-50"
                          >
                            {isValidatingCoupon ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                          </button>
                        </div>
                      )}
                      {couponError && (
                        <p className="text-[9px] text-red-500 font-bold mt-2 pl-1 italic">
                          {couponError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Removed redundant Coupon Input card below */}


              {/* Assistance Card */}
              <div className="bg-gray-900 rounded-[20px] p-8 text-white relative overflow-hidden group">
                <div className="absolute -right-8 -bottom-8 h-40 w-40 bg-white/5 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700" />
                <div className="relative z-10 space-y-4">
                  <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-orange-400" />
                  </div>
                  <h4 className="font-black tracking-tight text-sm">
                    Need Consultation?
                  </h4>
                  <p className="text-xs text-white/60 font-medium leading-relaxed">
                    Our local experts are available 24/7 to help you refine your
                    itinerary.
                  </p>
                  <button className="flex items-center gap-2 text-xs font-bold tracking-tight text-orange-400 hover:text-white transition-colors">
                    Chat With Us Now <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Booking Bar */}
      <AnimatePresence>
        {showMobileSummary && (
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            className="fixed inset-0 z-[60] bg-black/60 md:hidden"
            onClick={() => setShowMobileSummary(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] p-6 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-gray-900 tracking-tight">Booking Summary</h3>
                <button onClick={() => setShowMobileSummary(false)} className="text-gray-400 hover:text-gray-900">
                  <Plus className="h-6 w-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Selected Date</p>
                    <p className="font-extrabold text-gray-900">{date || 'Select a date'}</p>
                    {selectedTime && (
                      <p className="text-xs font-bold text-primary mt-0.5 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" /> {selectedTime}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="h-16 w-16 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Travelers</p>
                    <p className="font-extrabold text-gray-900">{adults} Adults {children > 0 && `, ${children} Children`}</p>
                  </div>
                </div>

                <div className="h-px bg-gray-100" />

                <div className="space-y-4">
                  {/* Package Breakdown */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-bold">{adults}x Adults {applicableTier ? <span>@ <FormattedPrice amount={applicableTier.adultPrice} /></span> : ''}</span>
                      <span className="font-black text-gray-900"><FormattedPrice amount={adults * (applicableTier?.adultPrice || 0)} /></span>
                    </div>
                    {children > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-500 font-bold">{children}x Children {applicableTier ? <span>@ <FormattedPrice amount={applicableTier.childPrice} /></span> : ''}</span>
                        <span className="font-black text-gray-900"><FormattedPrice amount={children * (applicableTier?.childPrice || 0)} /></span>
                      </div>
                    )}
                  </div>

                  {/* Transport selection breakdown */}
                  {selectedTransport && (
                    <div className="space-y-2 pt-2 border-t border-gray-50 flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-bold flex items-center gap-1">
                        <Car className="h-4 w-4 text-primary animate-pulse" /> {selectedTransport.name} ({selectedTransport.type === 'meet' ? 'Meet on location' : selectedTransport.carType || selectedTransport.type})
                      </span>
                      <span className="font-black text-gray-900">
                        {selectedTransport.type === 'meet' ? 'Free' : <FormattedPrice amount={summary.transportTotal} />}
                      </span>
                    </div>
                  )}

                  {/* Add-ons breakdown */}
                  {selectedAddOns.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-gray-50">
                      {selectedAddOns.map((addon) => (
                        <div key={addon.id} className="flex justify-between items-center text-sm">
                          <span className="text-gray-500 font-bold">
                            {addon.name} {addon.quantity}x <FormattedPrice amount={addon.price} />
                          </span>
                          <span className="font-black text-gray-900"><FormattedPrice amount={addon.price * addon.quantity} /></span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Coupon Discount */}
                  {summary.discount > 0 && (
                    <div className="flex justify-between items-center text-sm text-primary pt-2 border-t border-gray-50">
                      <span className="font-bold flex items-center gap-2">
                        <Tag className="h-4 w-4" /> Coupon Discount {appliedCoupon ? `"${appliedCoupon.code}"` : ''}
                      </span>
                      <span className="font-black">-<FormattedPrice amount={summary.discount} /></span>
                    </div>
                  )}

                  {/* Coupon Input for Mobile Modal */}
                  {!appliedCoupon && (
                    <div className="pt-4 border-t border-gray-50">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Coupon Code"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 p-3 focus:border-primary focus:outline-none font-bold text-xs"
                        />
                        <button
                          onClick={handleApplyCoupon}
                          disabled={isValidatingCoupon || !couponInput}
                          className="bg-gray-900 text-white px-4 py-3 rounded-xl font-bold text-[10px] hover:bg-black transition-all disabled:opacity-50"
                        >
                          {isValidatingCoupon ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                        </button>
                      </div>
                      {couponError && (
                        <p className="text-[10px] text-red-500 font-bold mt-1 pl-1">
                          {couponError}
                        </p>
                      )}
                    </div>
                  )}

                  {appliedCoupon && (
                    <div className="flex items-center justify-between bg-orange-50 p-3 rounded-xl border border-primary/20">
                      <div className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-bold text-primary">{appliedCoupon.code} Applied</span>
                      </div>
                      <button
                        onClick={() => setAppliedCoupon(null)}
                        className="text-[10px] font-bold text-primary"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                    <span className="text-lg font-black text-gray-900">Total Price</span>
                    <span className="text-3xl font-black text-secondary"><FormattedPrice amount={summary.grandTotal} /></span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-50 md:hidden flex items-center justify-between">
        <button 
          onClick={() => setShowMobileSummary(true)}
          className="flex items-center gap-3 text-left"
        >
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xl font-black text-secondary"><FormattedPrice amount={summary.amountToPay} /></p>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
              {existingBooking ? 'Pay Balance' : 'View Summary'}
            </p>
          </div>
        </button>

        <div className="flex flex-col items-end">
          {validationErrors.length > 0 && (
            <p className="text-[8px] font-black text-red-500 uppercase tracking-tighter mb-1 animate-pulse">
              {validationErrors[0]}
            </p>
          )}
          {step === "selection" ? (
            <button
              onClick={() => updateStep("customer")}
              disabled={isSoldOut || (spotsLeft !== null && (adults + children) > spotsLeft) || isUnderMinParticipants}
              className={cn(
                "px-8 py-4 rounded-full font-black uppercase tracking-widest text-[10px] shadow-lg transition-all",
                (date && selectedPackage && (adults + children > 0) && !isUnderMinParticipants) 
                  ? "bg-primary text-white shadow-primary/20" 
                  : "bg-gray-100 text-gray-400 shadow-none border border-gray-200"
              )}
            >
              {isSoldOut ? 'Sold Out' : (spotsLeft !== null && (adults + children) > spotsLeft) ? 'No Spots' : 
               isUnderMinParticipants ? 'Under Min' :
               !date ? 'Pick Date' : !selectedPackage ? 'Pick Package' : 'Continue'}
            </button>
          ) : step === "customer" ? (
            <button
              onClick={() => {
                if (validateStep("customer")) {
                  updateStep("payment");
                } else {
                  alert(validationErrors[0]);
                }
              }}
              className={cn(
                "px-8 py-4 rounded-full font-black uppercase tracking-widest text-[10px] shadow-lg transition-all",
                (customerData.fullName && customerData.email && customerData.phone)
                  ? "bg-primary text-white shadow-primary/20 hover:opacity-90"
                  : "bg-gray-100 text-gray-400 shadow-none border border-gray-200"
              )}
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={() => handleFinalBooking()}
              disabled={isBooking || !agreedToTerms || (paymentMethod === "paypal" && !!paymentSettings?.paypalClientId)}
              className="bg-primary text-white px-8 py-4 rounded-full font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50"
            >
              {isBooking ? <Loader2 className="h-4 w-4 animate-spin" /> : 
               (paymentMethod === "paypal" && (paymentSettings?.paypalClientId || paymentSettings?.paypalSandboxClientId) ? "Pay with PayPal" : "Confirm Booking")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Rocket(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-4 5-4" />
      <path d="M12 15v5s3.03-.55 5-2c2.2-1.62 4-5 4-5" />
      <line x1="11.5" y1="15.5" x2="15.5" y2="11.5" />
    </svg>
  );
}
