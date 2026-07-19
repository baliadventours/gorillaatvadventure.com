import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { 
  collection, addDoc, query, where, getDocs, serverTimestamp 
} from 'firebase/firestore';
import { Tour, Booking } from '../../types';
import * as Icons from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { extractBookingFromEmail, ExtractedBooking } from '../../services/geminiService';

interface ImportBookingProps {
  onSuccess?: () => void;
  commSettings?: any;
}

export default function ImportBooking({ onSuccess, commSettings }: ImportBookingProps) {
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>('ai');
  const [emailText, setEmailText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [tours, setTours] = useState<Tour[]>([]);
  const [loadingTours, setLoadingTours] = useState(true);
  
  // Form State
  const [formData, setFormData] = useState<Partial<ExtractedBooking>>({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    tourTitle: '',
    date: '',
    adults: 1,
    children: 0,
    totalAmount: 0,
    currency: 'USD',
    source: 'Manual'
  });

  const [selectedTourId, setSelectedTourId] = useState('');

  useEffect(() => {
    async function fetchTours() {
      try {
        const q = query(collection(db, 'tours'), where('status', '==', 'active'));
        const snap = await getDocs(q);
        setTours(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tour)));
      } catch (err) {
        console.error("Error fetching tours:", err);
      } finally {
        setLoadingTours(false);
      }
    }
    fetchTours();
  }, []);

  const handleExtract = async () => {
    if (!emailText.trim()) return;
    setIsExtracting(true);
    try {
      const extracted = await extractBookingFromEmail(emailText, commSettings?.geminiApiKey);
      setFormData(extracted);
      
      // Try to auto-match tour
      const matchedTour = tours.find(t => 
        t.title.toLowerCase().includes(extracted.tourTitle.toLowerCase()) ||
        extracted.tourTitle.toLowerCase().includes(t.title.toLowerCase())
      );
      if (matchedTour) {
        setSelectedTourId(matchedTour.id);
      }
      
      setActiveTab('manual');
    } catch (error: any) {
      alert("AI Extraction failed: " + error.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customerName || !formData.date || !selectedTourId) {
      alert("Please fill all required fields and select a tour.");
      return;
    }

    const selectedTour = tours.find(t => t.id === selectedTourId);
    if (!selectedTour) return;

    // Check for duplicates
    try {
      const bookingsRef = collection(db, 'bookings');
      
      // 1. Check by Reference ID
      if (formData.bookingReference) {
        const qRef = query(bookingsRef, where('paymentId', '==', formData.bookingReference));
        const snapRef = await getDocs(qRef);
        if (!snapRef.empty) {
          const confirm = window.confirm(`A booking with Reference ID "${formData.bookingReference}" already exists. Are you sure you want to add it again?`);
          if (!confirm) return;
        }
      }

      // 2. Check by Name + Date + Pax (Fuzzy check for same person same day)
      const qPax = query(
        bookingsRef, 
        where('customerData.fullName', '==', formData.customerName),
        where('date', '==', formData.date)
      );
      const snapPax = await getDocs(qPax);
      const isDuplicatePax = snapPax.docs.some(doc => {
        const d = doc.data() as Booking;
        return d.participants.adults === formData.adults && d.participants.children === formData.children;
      });

      if (isDuplicatePax) {
        const confirm = window.confirm(`A booking for "${formData.customerName}" on ${formData.date} with the same number of participants already exists. Are you sure you want to add it again?`);
        if (!confirm) return;
      }

      const bookingData: Omit<Booking, 'id'> = {
        tourId: selectedTourId,
        tourTitle: selectedTour.title,
        userId: 'admin-manual', // Manual bookings made by admin
        customerData: {
          fullName: formData.customerName || '',
          email: formData.customerEmail || '',
          phone: formData.customerPhone || '',
          specialRequirements: formData.specialRequirements || ''
        },
        date: formData.date || '',
        participants: {
          adults: formData.adults || 1,
          children: formData.children || 0
        },
        packageName: formData.packageName || selectedTour.packages[0]?.name || 'Standard',
        selectedAddOns: [],
        totalAmount: formData.totalAmount || 0,
        status: 'confirmed',
        paymentMethod: 'Outside System',
        paymentStatus: 'paid',
        paymentId: formData.bookingReference || `EXT-${Date.now()}`,
        bookingSource: formData.source || 'Manual',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, 'bookings'), bookingData);
      alert("Booking saved successfully!");
      if (onSuccess) onSuccess();
      
      // Reset
      setFormData({
        customerName: '',
        customerEmail: '',
        customerPhone: '',
        tourTitle: '',
        date: '',
        adults: 1,
        children: 0,
        totalAmount: 0,
        currency: 'USD',
        source: 'Manual'
      });
      setSelectedTourId('');
      setEmailText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'bookings');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">External Booking Importer</h2>
        <p className="text-gray-500 font-medium">Add bookings from Klook, Viator, or manual sources to centralize your schedule.</p>
      </div>

      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 p-2 bg-gray-50/50">
          <button
            onClick={() => setActiveTab('ai')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-4 rounded-[16px] text-sm font-black transition-all",
              activeTab === 'ai' ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Icons.Bot className="h-4 w-4" /> AI Email Extractor
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-4 rounded-[16px] text-sm font-black transition-all",
              activeTab === 'manual' ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
            )}
          >
            <Icons.Edit2 className="h-4 w-4" /> Manual Entry
          </button>
        </div>

        <div className="p-8">
          {activeTab === 'ai' ? (
            <div className="space-y-6">
              <div className="p-6 bg-orange-50 rounded-[20px] border border-orange-100 flex items-start gap-4">
                <div className="h-10 w-10 bg-primary text-white rounded-xl flex items-center justify-center shrink-0">
                  <Icons.Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Magic Extraction</h4>
                  <p className="text-xs text-gray-600 font-medium mt-1">Copy and paste the entire confirmation email text from Klook, Viator, or GetYourGuide below. Didi AI will parse it for you.</p>
                </div>
              </div>

              <div className="space-y-4">
                <textarea
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder="Paste email content here..."
                  className="w-full h-64 p-6 rounded-[20px] border-2 border-gray-50 bg-gray-50/30 focus:border-primary focus:bg-white focus:outline-none transition-all font-medium text-sm leading-relaxed"
                />
                <button
                  onClick={handleExtract}
                  disabled={isExtracting || !emailText.trim()}
                  className="w-full bg-primary text-white py-5 rounded-[18px] font-black text-sm tracking-widest uppercase shadow-xl hover:shadow-orange-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3"
                >
                  {isExtracting ? (
                    <>
                      <Icons.Loader2 className="h-5 w-5 animate-spin" />
                      Didi is Analyzing...
                    </>
                  ) : (
                    <>
                      <Icons.Bot className="h-5 w-5" />
                      Extract with Didi AI
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-10">
              {/* Form Sections */}
              <div className="grid md:grid-cols-2 gap-8">
                {/* Customer Info */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.User className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Customer Details</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Full Name *</label>
                      <input
                        required
                        value={formData.customerName}
                        onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                        className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-primary focus:outline-none transition-all font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Email Address</label>
                      <input
                        type="email"
                        value={formData.customerEmail}
                        onChange={e => setFormData({ ...formData, customerEmail: e.target.value })}
                        className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-primary focus:outline-none transition-all font-bold text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Phone / WhatsApp</label>
                      <input
                        value={formData.customerPhone}
                        onChange={e => setFormData({ ...formData, customerPhone: e.target.value })}
                        className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-primary focus:outline-none transition-all font-bold text-sm"
                        placeholder="+62..."
                      />
                    </div>
                  </div>
                </div>

                {/* Tour Info */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Icons.Compass className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Booking Logic</h3>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Select Tour *</label>
                      <select
                        required
                        value={selectedTourId}
                        onChange={e => setSelectedTourId(e.target.value)}
                        className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-primary focus:outline-none transition-all font-bold text-sm"
                      >
                        <option value="">Select an active tour...</option>
                        {tours.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                      {formData.tourTitle && !selectedTourId && (
                        <p className="text-[10px] text-amber-600 font-bold mt-1">AI found: "{formData.tourTitle}". Please map it to a tour.</p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Booking Date *</label>
                        <input
                          type="date"
                          required
                          value={formData.date}
                          onChange={e => setFormData({ ...formData, date: e.target.value })}
                          className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-primary focus:outline-none transition-all font-bold text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Source *</label>
                        <select
                          required
                          value={formData.source}
                          onChange={e => setFormData({ ...formData, source: e.target.value })}
                          className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-primary focus:outline-none transition-all font-bold text-sm"
                        >
                          <option value="Manual">Manual Entry</option>
                          <option value="Klook">Klook</option>
                          <option value="Viator">Viator</option>
                          <option value="GetYourGuide">GetYourGuide</option>
                          <option value="Agent">Agent / Affiliate</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Finance & Pax */}
                <div className="p-6 bg-gray-50 rounded-[24px] space-y-6">
                   <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Adults</label>
                        <input
                          type="number"
                          min="1"
                          value={formData.adults}
                          onChange={e => setFormData({ ...formData, adults: Number(e.target.value) })}
                          className="w-full p-3 rounded-xl border border-gray-100 bg-white focus:border-primary focus:outline-none transition-all font-black text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-1">Children</label>
                        <input
                          type="number"
                          min="0"
                          value={formData.children}
                          onChange={e => setFormData({ ...formData, children: Number(e.target.value) })}
                          className="w-full p-3 rounded-xl border border-gray-100 bg-white focus:border-primary focus:outline-none transition-all font-black text-center"
                        />
                      </div>
                   </div>
                   
                   <div className="pt-4 border-t border-gray-200">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Total Paid (for record)</label>
                      <div className="relative">
                        <Icons.DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="number"
                          step="0.01"
                          value={formData.totalAmount}
                          onChange={e => setFormData({ ...formData, totalAmount: Number(e.target.value) })}
                          className="w-full pl-10 pr-4 py-4 rounded-xl border border-gray-100 bg-white focus:border-primary focus:outline-none transition-all font-black"
                        />
                      </div>
                   </div>
                </div>

                {/* Additional */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">External Reference #</label>
                    <input
                      value={formData.bookingReference}
                      onChange={e => setFormData({ ...formData, bookingReference: e.target.value })}
                      placeholder="e.g. Klook ID, Viator ID"
                      className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-primary focus:outline-none transition-all font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block mb-2">Special Notes</label>
                    <textarea
                      rows={2}
                      value={formData.specialRequirements}
                      onChange={e => setFormData({ ...formData, specialRequirements: e.target.value })}
                      className="w-full p-4 rounded-xl border border-gray-100 bg-gray-50/50 focus:bg-white focus:border-primary focus:outline-none transition-all font-medium text-sm"
                      placeholder="Pick up details, allergies, etc."
                    />
                  </div>
                </div>
              </div>

              <div className="pt-10 flex gap-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className="px-8 py-5 rounded-[18px] font-bold text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary text-white py-5 rounded-[18px] font-black text-sm tracking-widest uppercase shadow-xl hover:shadow-orange-200 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                >
                  <Icons.Save className="h-5 w-5" />
                  Save External Booking
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
