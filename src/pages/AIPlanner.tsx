import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { 
  Sparkles, 
  User, 
  MapPin, 
  Calendar, 
  Users, 
  Compass, 
  Globe, 
  Heart, 
  Utensils, 
  Home as HomeIcon, 
  Wallet,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  Car,
  Bed,
  UtensilsCrossed,
  Info,
  ChevronRight,
  Plus,
  Printer,
  Mail,
  Phone,
  Check,
  Award,
  BookOpen,
  Map,
  Smile,
  Umbrella,
  HeartHandshake
} from 'lucide-react';
import { cn } from '../lib/utils';
import { generateItinerary, GeneratedItinerary } from '../services/geminiService';
import { useSettings } from '../lib/SettingsContext';
import { Link } from 'react-router-dom';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

const STAGES = [
  { id: 'essentials', title: 'Arrival & Contact', subtitle: 'Who are you?', icon: User },
  { id: 'timing_crew', title: 'Dates & Companions', subtitle: 'When and with who?', icon: Calendar },
  { id: 'vibes_stay', title: 'Location & Habitat', subtitle: 'Where to rest?', icon: HomeIcon },
  { id: 'passions_dreams', title: 'Bali Desires & Food', subtitle: 'Sights & tastes', icon: Compass }
];

export default function AIPlanner() {
  const { settings } = useSettings();
  const location = useLocation();
  const [currentStage, setCurrentStage] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Custom active day selection in generated view for high interactive refinement
  const [activeDayIdx, setActiveDayIdx] = useState(0);

  const [formData, setFormData] = useState({
    name: '',
    from: '',
    email: '',
    tripTiming: '',
    duration: '5',
    persons: '2',
    interests: '',
    places: '',
    food: '',
    hotspots: '',
    experience: 'Adventure',
    hotelType: 'Luxury Boutique',
    budget: 'Middle $100-200/day',
    phone: ''
  });

  useEffect(() => {
    if (location.state?.savedPlan) {
      setItinerary(location.state.savedPlan.itinerary);
      if (location.state.savedPlan.userEmail) {
        setFormData(prev => ({ ...prev, email: location.state.savedPlan.userEmail }));
      }
    }
  }, [location.state]);

  const handleNext = () => {
    if (currentStage < STAGES.length - 1) {
      setCurrentStage(currentStage + 1);
    } else {
      handleSubmit();
    }
  };

  const handlePrev = () => {
    if (currentStage > 0) {
      setCurrentStage(currentStage - 1);
    }
  };

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.name.trim()) {
      alert("Please provide your name so Gorilla Assistant knows how to greet you.");
      setCurrentStage(0);
      return;
    }
    if (!formData.email.trim()) {
      alert("Please enter your email so we can send you the itinerary.");
      setCurrentStage(0);
      return;
    }

    setIsGenerating(true);
    setSaveSuccess(false);
    try {
      let apiKey = '';
      const commRef = doc(db, 'settings', 'communication');
      const commSnap = await getDoc(commRef);
      if (commSnap.exists()) {
        apiKey = commSnap.data().geminiApiKey || '';
      }

      // Format persons for the prompt
      const formattedData = {
        ...formData,
        persons: formData.persons === 'Just me' ? '1 Person (Solo Traveler)' : `${formData.persons} People`
      };

      const result = await generateItinerary(formattedData, apiKey);
      setItinerary(result);
      setActiveDayIdx(0);

      // Automatically save to inquiries for admin follow-up
      try {
        await addDoc(collection(db, 'inquiries'), {
          userName: formData.name || 'Anonymous',
          userEmail: formData.email || '',
          userPhone: formData.phone || '',
          planTitle: result.planTitle || 'Bali Trip Plan',
          summary: result.summary || '',
          itinerary: result,
          formData: formattedData,
          createdAt: serverTimestamp(),
          status: 'new',
          userId: auth.currentUser?.uid || 'anonymous'
        });
      } catch (saveErr) {
        console.error("Failed to save inquiry lead:", saveErr);
      }
    } catch (error) {
      console.error("Generation error:", error);
      alert("Failed to generate itinerary. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveToAccount = async () => {
    if (!auth.currentUser) {
      alert("Please login to save your trip plans.");
      return;
    }
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'saved_itineraries'), {
        userId: auth.currentUser.uid,
        userName: formData.name,
        userEmail: formData.email,
        itinerary: itinerary,
        createdAt: serverTimestamp(),
        planTitle: itinerary?.planTitle,
        summary: itinerary?.summary
      });
      setSaveSuccess(true);
      alert("Trip saved successfully to your account!");
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save trip. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendEmail = async () => {
    if (!itinerary) return;
    
    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        },
        body: JSON.stringify({
          to: formData.email,
          type: 'trip_plan',
          extraInfo: {
            "{{planTitle}}": itinerary.planTitle,
            "{{summary}}": itinerary.summary,
            "{{planContent}}": `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <p>You can view your full itinerary anytime in your customer dashboard under "My Plans".</p>
                <a href="${window.location.origin}/customer/my-plans" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">View My Plans</a>
                <p style="margin-top: 30px; font-size: 12px; color: #999;">Generated by Bali Adventours AI Travel Planner</p>
              </div>
            `
          }
        })
      });

      if (response.ok) {
        alert(`Trip plan sent to ${formData.email} successfully!`);
      } else {
        throw new Error("Failed to send email");
      }
    } catch (error) {
      console.error("Email error:", error);
      alert("Failed to send email. Please check your connection.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Helper to quickly append multi-tags
  const handleTagToggle = (field: 'interests' | 'places' | 'food' | 'hotspots', value: string) => {
    const currentList = formData[field] ? formData[field].split(',').map(s => s.trim().toLowerCase()) : [];
    const lowerVal = value.trim().toLowerCase();
    
    if (currentList.includes(lowerVal)) {
      // Remove
      const filtered = currentList.filter(item => item !== lowerVal);
      // Re-capitalize correctly based on tag matching
      const capitalized = filtered.map(item => item.charAt(0).toUpperCase() + item.slice(1)).join(', ');
      setFormData(prev => ({ ...prev, [field]: capitalized }));
    } else {
      // Add
      const updated = [...currentList, lowerVal];
      const capitalized = updated.map(item => item.charAt(0).toUpperCase() + item.slice(1)).join(', ');
      setFormData(prev => ({ ...prev, [field]: capitalized }));
    }
  };

  const isTagSelected = (field: 'interests' | 'places' | 'food' | 'hotspots', value: string) => {
    if (!formData[field]) return false;
    return formData[field].split(',').map(s => s.trim().toLowerCase()).includes(value.trim().toLowerCase());
  };

  // Modern Generated Itinerary Layout
  if (itinerary) {
    return (
      <div className="min-h-screen bg-zinc-50 pb-24 font-sans text-zinc-800">
        {/* Top Hero Showcase Banner */}
        <div className="relative h-[340px] md:h-[420px] flex items-center justify-center text-center overflow-hidden print:hidden">
          <img 
            src="https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=2000" 
            className="absolute inset-0 w-full h-full object-cover brightness-[0.65]"
            alt="Beautiful Bali"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 via-zinc-950/20 to-black/30" />
          
          <div className="container mx-auto px-4 relative z-10 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="space-y-4"
            >
              <div className="inline-flex items-center gap-2 bg-orange-500/25 backdrop-blur-md text-orange-300 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider border border-orange-400/30">
                <Sparkles className="h-3 w-3 animate-pulse text-orange-400" />
                Gorilla Assistant's Professional AI Blueprint
              </div>
              <h1 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">
                {itinerary.planTitle}
              </h1>
              <p className="text-sm md:text-base text-zinc-100 font-medium leading-relaxed max-w-xl mx-auto opacity-90">
                {itinerary.summary}
              </p>
            </motion.div>
          </div>
        </div>

        {/* Action Header Nav */}
        <div className="container mx-auto px-4 mt-6 max-w-7xl relative z-20 no-print">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 mb-8">
            <button 
              onClick={() => setItinerary(null)}
              className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 transition-colors text-xs font-bold px-4 py-2 hover:bg-zinc-50 rounded-xl"
            >
              <ArrowLeft className="h-4 w-4" /> Start Dynamic Re-plan
            </button>
            
            <div className="flex flex-wrap gap-2 items-center">
              {location.state?.savedPlan && (
                <Link 
                  to="/customer/my-plans"
                  className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 transition-colors px-4 py-2.5 rounded-xl text-xs font-bold"
                >
                  <BookOpen className="h-4 w-4" /> Go to Saved Plans
                </Link>
              )}
              <button 
                onClick={() => window.print()}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <Printer className="h-4 w-4" /> Print PDF
              </button>
              <button 
                onClick={handleSendEmail}
                disabled={isSendingEmail}
                className="bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-1.5"
              >
                {isSendingEmail ? (
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                ) : (
                  <Mail className="h-4 w-4" />
                )} 
                {isSendingEmail ? 'Sending...' : 'Send to Email'}
              </button>
              <button 
                onClick={handleSaveToAccount}
                disabled={isSaving || saveSuccess}
                className={cn(
                  "rounded-xl px-5 py-2.5 text-xs font-extrabold transition-all flex items-center gap-1.5 shadow-sm",
                  saveSuccess 
                    ? "bg-primary text-white cursor-default" 
                    : "bg-orange-500 text-white hover:bg-primary"
                )}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Plan Secured
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Save Plan to Account
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Main Grid Content */}
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Main Pillar: Chronological Planner Guide */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Day Quick Navigation Tabs */}
              <div className="bg-white p-3 rounded-2xl shadow-sm border border-zinc-100 overflow-x-auto flex gap-1.5 scrollbar-thin scrollbar-thumb-zinc-200 no-print">
                {itinerary.dailyPlans.map((day, idx) => (
                  <button
                    key={day.day}
                    onClick={() => setActiveDayIdx(idx)}
                    className={cn(
                      "px-4 py-3 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2",
                      activeDayIdx === idx 
                        ? "bg-orange-500 text-white shadow-sm" 
                        : "bg-zinc-50 text-zinc-600 hover:bg-zinc-100"
                    )}
                  >
                    <span className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black leading-none",
                      activeDayIdx === idx ? "bg-white text-primary" : "bg-zinc-200 text-zinc-700"
                    )}>
                      {day.day}
                    </span>
                    Day {day.day}
                  </button>
                ))}
              </div>

              {/* Day Detail Block */}
              <AnimatePresence mode="wait">
                {itinerary.dailyPlans.map((day, dayIdx) => {
                  if (dayIdx !== activeDayIdx) return null;
                  return (
                    <motion.div
                      key={day.day}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25 }}
                      className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden"
                    >
                      {/* Day Header Block */}
                      <div className="p-6 md:p-8 bg-gradient-to-r from-zinc-50 to-white border-b border-zinc-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] font-extrabold text-primary uppercase tracking-widest bg-orange-50 px-2.5 py-1 rounded-full">
                              Destination Day {day.day}
                            </span>
                          </div>
                          <h2 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight leading-snug">
                            {day.title}
                          </h2>
                        </div>
                        <div className="text-rose-500 bg-rose-50 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0">
                          <Compass className="h-4 w-4" /> Expansive Explorer
                        </div>
                      </div>

                      {/* Day Segment Activities */}
                      <div className="p-6 md:p-8 space-y-8 relative">
                        {/* Connecting Timeline Ribbon */}
                        <div className="absolute left-[34px] top-10 bottom-10 w-0.5 bg-zinc-100 hidden md:block" />

                        {day.activities.map((activity, idx) => (
                          <div key={idx} className="relative flex flex-col md:flex-row gap-4 md:gap-8 items-start hover:bg-zinc-50/50 p-2 rounded-2xl transition-all">
                            
                            {/* Visual Symbol Frame */}
                            <div className="flex items-center gap-4 shrink-0">
                              <div className={cn(
                                "h-11 w-11 rounded-2xl flex items-center justify-center relative z-10 shadow-sm border",
                                activity.type === 'activity' ? "bg-orange-50 text-primary border-orange-100" :
                                activity.type === 'meal' ? "bg-amber-50 text-amber-600 border-amber-100" :
                                activity.type === 'hotel' ? "bg-sky-50 text-sky-600 border-sky-100" :
                                "bg-zinc-50 text-zinc-600 border-zinc-200"
                              )}>
                                {activity.type === 'activity' && <Compass className="h-5 w-5" />}
                                {activity.type === 'meal' && <UtensilsCrossed className="h-5 w-5" />}
                                {activity.type === 'hotel' && <Bed className="h-5 w-5" />}
                                {activity.type === 'transport' && <Car className="h-5 w-5" />}
                              </div>
                              <div className="md:w-16">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider block">Time slot</span>
                                <span className="text-xs font-extrabold text-zinc-900">{activity.time}</span>
                              </div>
                            </div>

                            {/* Core Content Box */}
                            <div className="flex-1 md:pt-1">
                              <h3 className="text-base font-bold text-zinc-900 mb-1 flex items-center gap-2">
                                {activity.title}
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md",
                                  activity.type === 'activity' ? "bg-orange-100 text-orange-800" :
                                  activity.type === 'meal' ? "bg-amber-100 text-amber-800" :
                                  activity.type === 'hotel' ? "bg-sky-100 text-sky-800" :
                                  "bg-zinc-100 text-zinc-800"
                                )}>
                                  {activity.type}
                                </span>
                              </h3>
                              <p className="text-sm text-zinc-500 leading-relaxed font-medium">
                                {activity.description}
                              </p>
                            </div>

                          </div>
                        ))}
                      </div>

                      {/* Elegant Stay Box */}
                      <div className="m-6 p-6 bg-orange-50/30 rounded-2xl border border-orange-500/10 flex flex-col md:flex-row gap-5 items-start">
                        <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary shrink-0 border border-orange-100">
                          <HomeIcon className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[9px] font-black text-primary/70 uppercase tracking-widest mb-1">Recommended Stay</p>
                          <h4 className="text-base font-black text-zinc-800 mb-1">{day.accommodationRecommendation.name}</h4>
                          <p className="text-xs text-zinc-600 font-medium leading-relaxed italic">
                            "{day.accommodationRecommendation.reason}"
                          </p>
                          {day.accommodationRecommendation.estimatedPrice && (
                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white rounded-full border border-orange-100/60 shadow-sm">
                              <Wallet className="h-3.5 w-3.5 text-orange-500" />
                              <span className="text-[10px] font-black text-zinc-700 uppercase tracking-wider">
                                {day.accommodationRecommendation.estimatedPrice}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Entire Chronology print list (Hidden on screen, shown on print) */}
              <div className="hidden print:block space-y-8">
                {itinerary.dailyPlans.map((day) => (
                  <div key={day.day} className="bg-white p-6 rounded-2xl border border-zinc-200 page-break-after">
                    <h2 className="text-xl font-black mb-4 border-b pb-2">Day {day.day} - {day.title}</h2>
                    <div className="space-y-4">
                      {day.activities.map((act, i) => (
                        <div key={i} className="flex gap-4 border-b border-zinc-100 pb-3 last:border-0">
                          <div className="w-20 shrink-0 text-xs font-black">{act.time}</div>
                          <div>
                            <h3 className="text-sm font-extrabold">{act.title} [{act.type}]</h3>
                            <p className="text-xs text-zinc-600">{act.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>

            {/* Right Side: Smart Recommendation Widgets */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Estimated Budget Break */}
              <div className="bg-zinc-900 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
                <div className="flex items-center gap-2 mb-4 text-orange-400">
                  <Wallet className="h-5 w-5" />
                  <h3 className="text-xs font-black tracking-widest uppercase">Finances Estimate</h3>
                </div>
                <div className="mb-4">
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">Est. Total Funds</p>
                  <p className="text-3xl font-black tracking-tight text-white mt-0.5">{itinerary.estimatedTotalBudget.amount}</p>
                </div>
                <div className="pt-4 border-t border-zinc-800">
                  <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                    {itinerary.estimatedTotalBudget.breakdown}
                  </p>
                </div>
              </div>

              {/* Recommended Matches */}
              <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  <h3 className="text-xs font-black text-zinc-900 tracking-wider uppercase">Vetted Tour Matches</h3>
                </div>
                <p className="text-xs text-zinc-400 font-medium mb-4">Gorilla Assistant has linked these proprietary private tours with your passion details:</p>
                <div className="space-y-3">
                  {itinerary.recommendedTours && itinerary.recommendedTours.length > 0 ? (
                    itinerary.recommendedTours.map((rec) => (
                      <Link 
                        to={`/tour/${rec.slug}`}
                        key={rec.tourId || rec.slug} 
                        className="block group bg-zinc-50 rounded-2xl p-4 hover:bg-primary transition-all duration-300"
                      >
                        <h4 className="text-sm font-extrabold text-zinc-800 group-hover:text-white transition-colors mb-1">
                          {rec.title}
                        </h4>
                        <p className="text-[11px] text-zinc-500 group-hover:text-orange-100/90 transition-colors leading-relaxed font-semibold">
                          {rec.reason}
                        </p>
                        <div className="mt-3 flex items-center gap-1 text-[9px] font-black uppercase text-primary group-hover:text-white transition-colors">
                          Explore Experience <ChevronRight className="h-3 w-3" />
                        </div>
                      </Link>
                    ))
                  ) : (
                    <div className="text-center py-6 text-zinc-400 text-xs">
                      No matching set tours found. Contact Gorilla Assistant via WhatsApp for a custom invoice!
                    </div>
                  )}
                </div>
              </div>

              {/* Travel Advisory and Local Tips */}
              <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="h-5 w-5 text-orange-500" />
                  <h3 className="text-xs font-black text-zinc-900 tracking-wider uppercase">Local Hospitality Advisory</h3>
                </div>
                <div className="space-y-3.5">
                  {itinerary.travelTips.map((tip, i) => (
                    <div key={i} className="flex gap-2.5 items-start">
                      <div className="h-5 w-5 rounded-full bg-orange-50 text-primary flex items-center justify-center shrink-0 mt-0.5 text-[10px] font-black">
                        {i + 1}
                      </div>
                      <p className="text-xs text-zinc-600 font-semibold leading-relaxed">
                        {tip}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-28 relative overflow-hidden font-sans text-zinc-800">
      
      {/* Visual Organic Background Ambient Highlights */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-orange-100/40 rounded-full blur-[120px] -z-10 translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-[550px] h-[550px] bg-orange-100/30 rounded-full blur-[120px] -z-10 -translate-x-1/3 translate-y-1/3" />

      <div className="w-full max-w-6xl relative z-10">
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.03 }}
              className="text-center space-y-8 max-w-md mx-auto"
            >
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-orange-500/25 rounded-full blur-3xl animate-pulse" />
                <div className="relative w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-xl border border-zinc-100/80">
                  <Loader2 className="h-10 w-10 text-orange-500 animate-spin" />
                </div>
              </div>
              <div className="space-y-4">
                <h2 className="text-3xl md:text-4xl font-black text-zinc-900 tracking-tight leading-tight">
                  Gorilla Assistant is drafting your <span className="text-primary">dream trip...</span>
                </h2>
                <p className="text-sm text-zinc-500 font-medium max-w-xs mx-auto">
                  Cross-referencing active private tours, checking hotel capacities & parsing food guides.
                </p>
                
                <div className="flex flex-col items-center gap-2.5 pt-6">
                  {[
                    "Querying active private driver itineraries",
                    "Assuring scenic lunch spots without tourist traps",
                    "Verifying your dietary profile against local cafés",
                    "Calculating budget-optimized daily costs"
                  ].map((text, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.4 }}
                      className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-left"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      {text}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              
              {/* LEFT SIDE: Dynamic Preview Journey Card/Ticket */}
              <div className="lg:col-span-4 flex flex-col justify-between bg-white rounded-3xl p-6 shadow-sm border border-zinc-100 lg:sticky lg:top-28">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-11 h-11 bg-orange-500 rounded-2xl flex items-center justify-center shadow-md shadow-orange-500/10">
                      <Sparkles className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-primary uppercase tracking-wider block">Co-Pilot Assistant</span>
                      <h3 className="font-bold text-zinc-950 text-sm">Meet Gorilla Assistant</h3>
                    </div>
                  </div>

                  {/* Speech Bubble */}
                  <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-100 text-xs font-semibold text-zinc-600 leading-relaxed mb-6 relative">
                    <div className="absolute top-4 -left-2 w-4 h-4 bg-zinc-50 border-l border-b border-zinc-100 rotate-45" />
                    "Halo! Type your wishes & I will merge local intelligence with smart AI models to build a custom travel blueprint."
                  </div>

                  {/* Real-Time Live Ticket */}
                  <div className="border border-dashed border-zinc-200 rounded-2xl p-5 bg-gradient-to-br from-zinc-50 to-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-orange-500/5 rounded-full blur-xl" />
                    
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-4 border-b pb-2">
                      Journey Specifications
                    </span>

                    <div className="space-y-3.5 text-xs text-zinc-700">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-bold">Explorer</span>
                        <span className="font-extrabold text-zinc-900">{formData.name || 'Anonymous Traveler'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-bold">From</span>
                        <span className="font-extrabold text-zinc-900">{formData.from || 'Choose origin'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-bold">Duration</span>
                        <span className="font-extrabold text-primary">{formData.duration} Days</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-bold">Crew Count</span>
                        <span className="font-extrabold text-zinc-900">
                          {formData.persons === 'Just me' ? '1 Person (Solo)' : `${formData.persons} Persons`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-bold">Vibe Focus</span>
                        <span className="font-extrabold text-zinc-900">{formData.experience}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-bold">Accommodation</span>
                        <span className="font-extrabold text-zinc-900 truncate max-w-[150px]">{formData.hotelType}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 font-bold">Daily Budget</span>
                        <span className="font-extrabold text-zinc-900 truncate max-w-[150px]">{formData.budget.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-zinc-100 flex items-center gap-3 text-xs text-zinc-400 font-bold justify-center">
                  <HeartHandshake className="h-4 w-4 text-orange-500" />
                  100% Tailored Private Itinerary
                </div>
              </div>

              {/* RIGHT SIDE: Progressive Segments Card */}
              <div className="lg:col-span-8 bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-zinc-100 flex flex-col justify-between">
                <div>
                  {/* Phase header progress */}
                  <div className="flex justify-between gap-4 border-b border-zinc-100 pb-5 mb-8 overflow-x-auto">
                    {STAGES.map((s, idx) => (
                      <button
                        key={s.id}
                        disabled={idx > currentStage + 1} // Limit jumping way forward before validating
                        onClick={() => setCurrentStage(idx)}
                        className={cn(
                          "flex items-center gap-2.5 pb-2.5 transition-all outline-none shrink-0 border-b-2 text-left",
                          idx === currentStage 
                            ? "border-orange-500 text-zinc-950 font-black" 
                            : idx < currentStage
                            ? "border-orange-200 text-primary font-bold"
                            : "border-transparent text-zinc-400 hover:text-zinc-650"
                        )}
                      >
                        <s.icon className={cn(
                          "h-4 w-4 shrink-0",
                          idx === currentStage ? "text-orange-500" : "text-zinc-400"
                        )} />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wider block leading-none">Stage {idx + 1}</p>
                          <p className="text-xs mt-0.5">{s.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentStage}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-6"
                    >
                      {/* STAGE 1: Essentials */}
                      {currentStage === 0 && (
                        <div className="space-y-6">
                          <div>
                            <h2 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                              Let's get the essentials sorted first
                            </h2>
                            <p className="text-xs text-zinc-400 font-medium">This helps us customize communications & save your data.</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-orange-500" /> Full Name
                              </label>
                              <input 
                                type="text"
                                className="w-full bg-zinc-50 border border-zinc-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition-all"
                                placeholder="E.g. Wayan Smith"
                                value={formData.name}
                                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5 text-orange-500" /> Coming From
                              </label>
                              <input 
                                type="text"
                                className="w-full bg-zinc-50 border border-zinc-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition-all"
                                placeholder="City or Country (e.g. Sydney, Australia)"
                                value={formData.from}
                                onChange={(e) => setFormData(prev => ({ ...prev, from: e.target.value }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <Mail className="h-3.5 w-3.5 text-orange-500" /> Email Address
                              </label>
                              <input 
                                type="email"
                                className="w-full bg-zinc-50 border border-zinc-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition-all"
                                placeholder="For sharing the blueprint..."
                                value={formData.email}
                                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                              />
                            </div>

                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 text-orange-500" /> WhatsApp Number (Optional)
                              </label>
                              <input 
                                type="tel"
                                className="w-full bg-zinc-50 border border-zinc-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition-all"
                                placeholder="E.g. +61 400 123 456"
                                value={formData.phone}
                                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* STAGE 2: Dates & Companion Crew */}
                      {currentStage === 1 && (
                        <div className="space-y-6">
                          <div>
                            <h2 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                              When are you visiting & who is coming?
                            </h2>
                            <p className="text-xs text-zinc-400 font-medium">Understanding group size and budget parameters narrows the stay options perfectly.</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5 text-orange-500" /> Estimated Timeline / Month
                              </label>
                              <input 
                                type="text"
                                className="w-full bg-zinc-50 border border-zinc-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 rounded-xl px-4 py-3 text-sm font-bold text-zinc-900 outline-none transition-all"
                                placeholder="E.g. July 2026, or Oct 12"
                                value={formData.tripTiming}
                                onChange={(e) => setFormData(prev => ({ ...prev, tripTiming: e.target.value }))}
                              />
                            </div>

                            {/* Duration Counter */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-orange-500" /> Journey Duration (Days)
                              </label>
                              <div className="flex items-center gap-4 bg-zinc-50 border border-zinc-200 rounded-xl p-1.5 max-w-[180px]">
                                <button 
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, duration: Math.max(1, parseInt(prev.duration) - 1).toString() }))}
                                  className="w-10 h-10 rounded-lg bg-white shadow-sm hover:bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-700 transition"
                                >
                                  -
                                </button>
                                <span className="text-base font-black text-zinc-900 flex-1 text-center">{formData.duration}</span>
                                <button 
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, duration: (parseInt(prev.duration) + 1).toString() }))}
                                  className="w-10 h-10 rounded-lg bg-white shadow-sm hover:bg-zinc-100 flex items-center justify-center text-sm font-bold text-zinc-700 transition"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Travelers Pill List */}
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <Users className="h-3.5 w-3.5 text-orange-500" /> Group Size / Crew count
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {['Just me', '2', '3', '4', '5', 'More than 5'].map((v) => (
                                  <button
                                    key={v}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, persons: v }))}
                                    className={cn(
                                      "px-4 py-2.5 rounded-xl text-xs font-bold transition-all border",
                                      formData.persons === v 
                                        ? "bg-zinc-900 border-zinc-900 text-white shadow-sm" 
                                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300"
                                    )}
                                  >
                                    {v}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Budget Range Selection */}
                            <div className="space-y-2 md:col-span-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <Wallet className="h-3.5 w-3.5 text-orange-500" /> Daily Budget Level
                              </label>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {[
                                  { id: 'Budget $50/day', label: 'Budget ($50)' },
                                  { id: 'Middle $100-200/day', label: 'Mid-Tier ($100+)' },
                                  { id: 'Upper $300-500/day', label: 'High-End ($300+)' },
                                  { id: 'Luxury $500++/day', label: 'Ultra Luxury ($500+)' }
                                ].map((b) => (
                                  <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, budget: b.id }))}
                                    className={cn(
                                      "px-3 py-3 rounded-xl text-xs font-bold text-center transition-all border",
                                      formData.budget === b.id 
                                        ? "bg-orange-500 border-orange-500 text-white shadow-sm" 
                                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300"
                                    )}
                                  >
                                    {b.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* STAGE 3: Location & Habitation */}
                      {currentStage === 2 && (
                        <div className="space-y-6">
                          <div>
                            <h2 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                              Location Preferences & Stay Style
                            </h2>
                            <p className="text-xs text-zinc-400 font-medium font-sans">Bali offers very distinct zones. Beach club hub Canggu, cultural Ubud, or high cliffs Uluwatu?</p>
                          </div>

                          <div className="space-y-5 pt-4">
                            {/* Trip Vibe Selection */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <Compass className="h-3.5 w-3.5 text-orange-500" /> Trip General Vibe Focus
                              </label>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {[
                                  { id: 'Romantic', label: 'Romantic & Honeymoon' },
                                  { id: 'Adventure', label: 'Active & Adventure' },
                                  { id: 'Family', label: 'Family & Group Fun' },
                                  { id: 'Wellness', label: 'Wellness & Spiritual' }
                                ].map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, experience: item.id }))}
                                    className={cn(
                                      "px-3 py-3 rounded-xl text-[11px] font-extrabold text-center transition-all border",
                                      formData.experience === item.id 
                                        ? "bg-zinc-900 border-zinc-900 text-white shadow-sm" 
                                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300"
                                    )}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Preferred Places Tags */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 justify-between">
                                <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-orange-500" /> Preferred Beach Hub / Villages</span>
                                <span className="text-[9px] text-zinc-400 lowercase italic">select multiples</span>
                              </label>
                              
                              <div className="flex flex-wrap gap-1.5">
                                {['Ubud', 'Canggu', 'Nusa Dua', 'Seminyak', 'Sanur', 'Uluwatu', 'Amed', 'Kintamani'].map((tag) => {
                                  const selected = isTagSelected('places', tag);
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => handleTagToggle('places', tag)}
                                      className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                                        selected 
                                          ? "bg-orange-500 border-orange-500 text-white shadow-xs" 
                                          : "bg-zinc-100 hover:bg-zinc-200 border-none text-zinc-600"
                                      )}
                                    >
                                      {selected ? '✓ ' : '+ '} {tag}
                                    </button>
                                  );
                                })}
                              </div>
                              <input 
                                type="text"
                                className="w-full bg-zinc-50 border border-zinc-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 rounded-xl px-4 py-3 text-xs font-bold text-zinc-800 outline-none transition-all mt-2"
                                placeholder="Any other places? E.g. Nusa Penida, Lovina"
                                value={formData.places}
                                onChange={(e) => setFormData(prev => ({ ...prev, places: e.target.value }))}
                              />
                            </div>

                            {/* Hotel preference */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                                <HomeIcon className="h-3.5 w-3.5 text-orange-500" /> Preferred Habitation Type
                              </label>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {[
                                  'Private Pool Villa',
                                  'Luxury Boutique',
                                  'Eco Bamboo Lodge',
                                  'Surf Camp Guesthouse',
                                  'Clifftop Resort'
                                ].map((hotel) => (
                                  <button
                                    key={hotel}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, hotelType: hotel }))}
                                    className={cn(
                                      "px-3 py-3 rounded-xl text-center text-[10px] font-extrabold tracking-wider transition-all border truncate",
                                      formData.hotelType === hotel 
                                        ? "bg-orange-500 border-orange-500 text-white shadow-sm" 
                                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:border-zinc-300"
                                    )}
                                  >
                                    {hotel}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* STAGE 4: Dreams & Food */}
                      {currentStage === 3 && (
                        <div className="space-y-6">
                          <div>
                            <h2 className="text-xl md:text-2xl font-black text-zinc-900 tracking-tight">
                              Bali Sights, Food & Active Desires
                            </h2>
                            <p className="text-xs text-zinc-400 font-medium">Fine-tune the fun parts of the algorithm.</p>
                          </div>

                          <div className="space-y-4 pt-4">
                            
                            {/* Passions & Interests */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-rose-500" /> Passion Tag Selectors</label>
                              <div className="flex flex-wrap gap-1.5">
                                {['Adventure', 'Beach Club', 'Waterfall', 'Temple', 'Photography', 'Hiking', 'Cooking Class', 'Yoga', 'Nightlife', 'Snorkeling'].map((tag) => {
                                  const selected = isTagSelected('interests', tag);
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => handleTagToggle('interests', tag)}
                                      className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                                        selected 
                                          ? "bg-rose-500 border-rose-500 text-white" 
                                          : "bg-zinc-100 hover:bg-zinc-200 border-none text-zinc-600"
                                      )}
                                    >
                                      {tag}
                                    </button>
                                  );
                                })}
                              </div>
                              <textarea 
                                className="w-full bg-zinc-50 border border-zinc-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/10 rounded-xl px-4 py-3 text-xs font-bold text-zinc-800 outline-none transition-all resize-none h-16"
                                placeholder="Describe more parameters (e.g. loves private swings, quiet temples, local culture...)"
                                value={formData.interests}
                                onChange={(e) => setFormData(prev => ({ ...prev, interests: e.target.value }))}
                              />
                            </div>

                            {/* Food Preferences */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1"><Utensils className="h-3.5 w-3.5 text-orange-500" /> Dietary Focus & Culinary Preference</label>
                              <div className="flex flex-wrap gap-1.5">
                                {['Local Balinese', 'Vegetarian', 'Vegan', 'Seafood Feast', 'Fine Dining', 'Halal', 'Gluten Free'].map((tag) => {
                                  const selected = isTagSelected('food', tag);
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => handleTagToggle('food', tag)}
                                      className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                                        selected 
                                          ? "bg-orange-500 border-orange-500 text-white" 
                                          : "bg-zinc-100 hover:bg-zinc-200 border-none text-zinc-600"
                                      )}
                                    >
                                      {tag}
                                    </button>
                                  );
                                })}
                              </div>
                              <input 
                                type="text"
                                className="w-full bg-zinc-50 border border-zinc-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 rounded-xl px-4 py-3 text-xs font-bold text-zinc-800 outline-none transition-all mt-1"
                                placeholder="Other specific restrictions e.g. peanut allergy"
                                value={formData.food}
                                onChange={(e) => setFormData(prev => ({ ...prev, food: e.target.value }))}
                              />
                            </div>

                            {/* Must-Visit Spots */}
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                                <Sparkles className="h-3.5 w-3.5 text-orange-500" /> Key Landmarks You Don't Want to Miss
                              </label>
                              <div className="flex flex-wrap gap-1.5">
                                {['Mount Batur', 'Sacred Monkey Forest', 'Lempuyang Gateway', 'Tukad Cepung', 'Tegallalang', 'Uluwatu Sunset'].map((tag) => {
                                  const selected = isTagSelected('hotspots', tag);
                                  return (
                                    <button
                                      key={tag}
                                      type="button"
                                      onClick={() => handleTagToggle('hotspots', tag)}
                                      className={cn(
                                        "px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                                        selected 
                                          ? "bg-zinc-900 border-zinc-900 text-white" 
                                          : "bg-zinc-100 hover:bg-zinc-200 border-none text-zinc-600"
                                      )}
                                    >
                                      {tag}
                                    </button>
                                  );
                                })}
                              </div>
                              <input 
                                type="text"
                                className="w-full bg-zinc-50 border border-zinc-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 rounded-xl px-4 py-3 text-xs font-bold text-zinc-800 outline-none transition-all mt-1"
                                placeholder="Any other hotspots? e.g. Tanah Lot"
                                value={formData.hotspots}
                                onChange={(e) => setFormData(prev => ({ ...prev, hotspots: e.target.value }))}
                              />
                            </div>

                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Progress Indicators & Core Controls */}
                <div className="flex items-center justify-between pt-8 mt-10 border-t border-zinc-100">
                  <div className="flex gap-1">
                    {STAGES.map((_, idx) => (
                      <div 
                        key={idx}
                        className={cn(
                          "h-1.5 rounded-full transition-all duration-300",
                          idx === currentStage ? "w-8 bg-orange-500" : idx < currentStage ? "w-3 bg-orange-300" : "w-1.5 bg-zinc-180"
                        )}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-3">
                    {currentStage > 0 && (
                      <button 
                        type="button"
                        onClick={handlePrev}
                        className="px-4 py-2.5 text-xs font-bold text-zinc-400 hover:text-zinc-800 transition-colors"
                      >
                        Back
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={handleNext}
                      className="bg-orange-500 hover:bg-primary text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md shadow-orange-500/10"
                    >
                      {currentStage === STAGES.length - 1 ? 'Generate Blueprint' : 'Continue'}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

              </div>
              
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
