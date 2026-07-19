import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, limit, getDocs, where } from 'firebase/firestore';
import { Tour, UrgencyPoint } from '../types';
import { 
  Share2, MapPin, Clock, Star, 
  ChevronRight, Calendar, Users, 
  Info, Languages, MessageCircle, ShieldCheck, LucideIcon, ArrowLeft, Globe, CheckCircle2, ChevronDown, Check, X
} from 'lucide-react';
import * as Icons from 'lucide-react';
import TourGallery from '../components/TourDetails/TourGallery';
import TourInfo from '../components/TourDetails/TourInfo';
import BookingForm from '../components/TourDetails/BookingForm';
import ReviewSection from '../components/TourDetails/ReviewSection';
import SmartImage from '../components/SmartImage';
import Loader from '../components/Loader';
import FormattedPrice from '../components/FormattedPrice';
import { cn, formatPrice } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import TourCard from '../components/TourCard';
import { Helmet } from 'react-helmet-async';

import { useSettings } from '../lib/SettingsContext';

import { generateTourSchema } from '../lib/seoUtils';

export default function TourDetail() {
  const { slug } = useParams();
  const { labels, settings } = useSettings();
  const [tour, setTour] = useState<Tour | null>(() => {
    if (typeof window !== 'undefined' && (window as any).__PRELOADED_DATA__) {
      const preloaded = (window as any).__PRELOADED_DATA__;
      if (preloaded.slug === slug || preloaded.id === slug) {
        return preloaded;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined' && (window as any).__PRELOADED_DATA__) {
      const preloaded = (window as any).__PRELOADED_DATA__;
      if (preloaded.slug === slug || preloaded.id === slug) {
        return false;
      }
    }
    return true;
  });
  const [similarTours, setSimilarTours] = useState<Tour[]>([]);
  const [urgencyPoints, setUrgencyPoints] = useState<UrgencyPoint[]>([]);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [showAllPhotos, setShowAllPhotos] = useState(false);
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const tourLabels = labels.filter(l => tour?.labelIds?.includes(l.id));

  useEffect(() => {
    const fetchTour = async () => {
      if (!slug) return;
      setLoading(true);
      try {
        let qSnap = await getDocs(query(collection(db, 'tours'), where('slug', '==', slug), limit(1)));
        
        let docSnap: any = !qSnap.empty ? qSnap.docs[0] : null;

        if (!docSnap) {
          // Fallback: try fetching as ID
          const idRef = doc(db, 'tours', slug);
          const idSnap = await getDoc(idRef);
          if (idSnap.exists()) {
            docSnap = idSnap;
          }
        }
        
        if (docSnap) {
          const fetchedTour = { id: docSnap.id, ...docSnap.data() } as Tour;
          
          // Check if it's either published or active
          const allowedStatuses = ['published', 'active'];
          if (fetchedTour.status && !allowedStatuses.includes(fetchedTour.status)) {
            navigate('/tours');
            return;
          }

          setTour(fetchedTour);
          
          // Fetch similar tours logic
          const getSimilarTours = async () => {
            try {
              // 1. Try same category
              let finalSimilar: Tour[] = [];
              if (docSnap.data().categoryId) {
                const qCat = query(
                  collection(db, 'tours'), 
                  where('categoryId', '==', docSnap.data().categoryId),
                  limit(5)
                );
                const qSnapCat = await getDocs(qCat);
                finalSimilar = qSnapCat.docs
                  .map(d => ({ id: d.id, ...d.data() } as Tour))
                  .filter(t => t.id !== docSnap.id);
              }

              // 2. Fallback to any tours if not enough
              if (finalSimilar.length < 3) {
                const qAll = query(collection(db, 'tours'), limit(10));
                const qSnapAll = await getDocs(qAll);
                const otherTours = qSnapAll.docs
                  .map(d => ({ id: d.id, ...d.data() } as Tour))
                  .filter(t => t.id !== docSnap.id && !finalSimilar.some(st => st.id === t.id));
                
                finalSimilar = [...finalSimilar, ...otherTours];
              }

              setSimilarTours(finalSimilar.slice(0, 4));
            } catch (err) {
              console.error("Error fetching similar tours", err);
            }
          };

          getSimilarTours();

          // Fetch all urgency points
          const urgencySnap = await getDocs(collection(db, 'urgencyPoints'));
          setUrgencyPoints(urgencySnap.docs.map(d => ({ id: d.id, ...d.data() } as UrgencyPoint)));
        } else {
          setTour(null);
        }
      } catch (error) {
        console.error("Error fetching tour", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [slug]);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: tour?.title,
        text: tour?.description,
        url: window.location.href,
      });
    } else {
      alert("Link copied to clipboard!");
      navigator.clipboard.writeText(window.location.href);
    }
  };

  const siteUrl = window.location.origin;
  const siteName = settings?.siteName || 'Bali Adventours';
  const tourPrice = tour?.discountPrice || tour?.regularPrice || 0;
  
  const tourTitle = tour ? 
    (settings?.tourTitleFormat || '{{title}} | {{siteName}}')
      .replace('{{title}}', tour.title)
      .replace('{{siteName}}', siteName) : 
    siteName;

  const seoDescription = tour ? 
    `Book ${tour.title} from just $${tourPrice}. Explore ${tour.location} with Bali's top-rated guides. ${tour.duration} experience with ${tour.rating || 5.0}/5 stars.` : 
    "Discover amazing Bali tours and activities with Bali Adventours.";

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": siteUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Tours",
        "item": `${siteUrl}/tours`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": tour?.title,
        "item": window.location.href
      }
    ]
  };

  const jsonLd = tour ? generateTourSchema(tour, siteUrl, settings) : null;

  if (loading) return <Loader />;

  if (!tour) return <div className="p-20 text-center">Tour not found</div>;

  const galleryImages = (() => {
    const baseGallery = tour.gallery || [];
    if (tour.featuredImage) {
      const cleaned = baseGallery.filter(img => img !== tour.featuredImage);
      return [tour.featuredImage, ...cleaned];
    }
    return baseGallery;
  })();

  return (
    <div className="min-h-screen bg-white w-full">
      <Helmet>
        <title>{tourTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={window.location.href} />
        <meta property="og:title" content={tourTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={tour.featuredImage || tour.gallery?.[0] || settings?.ogImage || "https://i.ibb.co.com/pvLCVYkM/ALAS-HARUM8-optimized.webp"} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="product" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={tourTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={tour.featuredImage || tour.gallery?.[0] || settings?.ogImage || "https://i.ibb.co.com/pvLCVYkM/ALAS-HARUM8-optimized.webp"} />
        {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>
      {isMobile ? (
        <div className="block md:hidden w-full">
        {/* Hero Gallery Slider */}
        <div className="relative w-full">
          <TourGallery images={galleryImages} />
          
          <div className="absolute top-4 left-4 z-10">
            <button 
              onClick={() => navigate(-1)}
              className="h-10 w-10 flex items-center justify-center bg-black/20 backdrop-blur-md border border-white/20 rounded-full text-white active:scale-95 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>

          <div className="absolute bottom-6 left-6 right-6 z-10 pointer-events-none">
            <h1 className="text-2xl font-black text-white leading-tight shadow-sm">
              {tour.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-[10px] font-black">
                <Star className="h-3 w-3 fill-current text-amber-400" />
                {tour.rating ? `${tour.rating.toFixed(1)} Rating` : 'New'}
              </div>
              <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white text-[10px] font-black">
                <Clock className="h-3 w-3" />
                {tour.duration}
              </div>
            </div>
          </div>
        </div>

        {/* Full-screen Gallery Overlay */}
        <AnimatePresence>
          {showAllPhotos && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black flex flex-col pt-safe"
            >
              <div className="flex items-center justify-between p-6">
                <button onClick={() => setShowAllPhotos(false)} className="h-10 w-10 flex items-center justify-center bg-white/10 rounded-full text-white">
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="text-center">
                  <h3 className="text-white font-black text-xs uppercase tracking-widest">Gallery</h3>
                  <p className="text-white/40 text-[10px] font-bold">{galleryImages.length} Photos</p>
                </div>
                <div className="w-10 h-10" />
              </div>
              
              <div className="flex-1 overflow-y-auto px-4 pb-12">
                <div className="grid grid-cols-2 gap-4">
                  {galleryImages.map((img, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={cn(
                        "rounded-2xl overflow-hidden bg-white/5",
                        i % 3 === 0 ? "col-span-2 aspect-video" : "aspect-square"
                      )}
                    >
                      <SmartImage src={img} alt={`${tour.title} ${i}`} aspectRatio="auto" />
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sticky Book Now Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white border-t border-gray-100 p-4 flex items-center justify-between gap-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] md:hidden">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Starting from</span>
            <span className="text-2xl font-black text-primary"><FormattedPrice amount={tour.discountPrice || tour.regularPrice} /></span>
          </div>
          <Link 
            to={`/checkout/${tour.id}`}
            className="flex-1 bg-primary text-white py-4 rounded-[50px] font-black text-sm text-center shadow-lg shadow-orange-100 active:scale-95 transition-all"
          >
            Book Now
          </Link>
        </div>

        {/* Content Section */}
        <div className="px-6 py-10 space-y-12 pb-32">
          {/* Overview */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Overview</h2>
            <p className="text-sm leading-relaxed text-gray-500 font-medium">{tour.description}</p>
          </section>

          {/* Tour Highlights */}
          <section className="space-y-4">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Tour Highlights</h2>
            <div className="grid grid-cols-1 gap-2">
              {tour.highlights?.slice(0, 10).map((h, i) => (
                <div key={i} className="flex gap-3 p-2.5 bg-gray-50/50 rounded-xl border border-gray-100/40">
                  <div className="h-7 w-7 md:h-8 md:w-8 shrink-0 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm font-black text-xs">
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="flex items-center">
                    <p className="text-sm md:text-base font-semibold text-gray-900 leading-snug pr-4">{h}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Included / Not Included */}
          <section className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-orange-500" /> What's Included
              </h2>
              <ul className="space-y-3">
                {tour.inclusions?.filter(l => l.trim() !== '').map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-500 font-medium">
                    <Check className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                <X className="h-5 w-5 text-rose-500" /> What's Not Included
              </h2>
              <ul className="space-y-3">
                {tour.exclusions?.filter(l => l.trim() !== '').map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-500 font-medium">
                    <X className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Itinerary Timeline */}
          <section className="space-y-8">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Your Itinerary</h2>
            <div className="space-y-12">
              {(tour.itinerary || []).map((step, i) => (
                <div key={i} className="relative group">
                  {i !== (tour.itinerary || []).length - 1 && (
                    <div className="absolute left-[15px] top-8 bottom-[-40px] w-0.5 bg-orange-100/50" />
                  )}
                  <div className="flex gap-4">
                    <div className="relative z-10">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-black text-white text-[10px] shadow-lg ring-4 ring-white">
                        {i + 1}
                      </div>
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-base font-black text-gray-900 leading-tight">{step.title}</h3>
                        {step.pickup && (
                          <div className="flex items-center gap-1.5 text-primary font-bold text-[9px] bg-orange-50 w-fit px-2 py-0.5 rounded-full border border-orange-100">
                            <MapPin className="h-2.5 w-2.5" />
                            {typeof step.pickup === 'object' ? (step.pickup as any).description : step.pickup}
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-3">
                        {(step.image || (typeof step.pickup === 'object' && (step.pickup as any)?.image)) && (
                          <div className="w-full aspect-[4/3] bg-gray-50 overflow-hidden rounded-xl">
                            <SmartImage 
                              src={step.image || (typeof step.pickup === 'object' ? (step.pickup as any)?.image : '')} 
                              alt={step.title} 
                              aspectRatio="auto"
                            />
                          </div>
                        )}
                        <p className="text-xs leading-relaxed text-gray-500 font-medium">{step.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Booking Widget (Inline for mobile screens, replacing the fixed footer) */}
          <section className="md:hidden space-y-4 pt-6 border-t border-gray-100/60">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Select Date & Travelers</h2>
            <BookingForm tour={tour} />
          </section>

          {/* Important Info */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">Important Information</h2>
            <div className="bg-gray-50 border border-gray-100/65 rounded-xl p-4.5 space-y-5">
              <div className="space-y-5">
                {/* Dynamic Info Sections */}
                {(tour.infoSections || []).map((section, idx) => (
                  <div key={idx} className="space-y-1.5">
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-800">
                      {section.title}
                    </h3>
                    <ul className="space-y-1">
                      {(section.content || []).filter((line: string) => line.trim() !== '').map((point: string, pIdx: number) => (
                        <li key={pIdx} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm text-gray-500 font-light leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="space-y-5 pt-4 border-t border-gray-200">
                {/* General Info Fallback */}
                {tour.importantInfo && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-800">Policy & Terms</h3>
                    <p className="text-xs sm:text-sm text-gray-500 font-light leading-relaxed whitespace-pre-wrap">
                      {tour.importantInfo}
                    </p>
                  </div>
                )}

                {/* Languages offered */}
                {tour.languages && tour.languages.length > 0 && (
                  <div className="space-y-1.5">
                    <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-800">Languages Offered</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {tour.languages.filter(l => l.trim() !== '').map((lang, idx) => (
                        <span key={idx} className="px-3 py-1 bg-white border border-gray-100 font-bold text-gray-600 rounded-full text-xs shadow-sm">
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* FAQ Accordion */}
          <section className="space-y-6">
            <h2 className="text-xl font-black text-gray-900 tracking-tight">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {tour.faqs?.map((faq, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl overflow-hidden border border-gray-100">
                  <button 
                    onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left active:bg-gray-100 transition-colors"
                  >
                    <span className="text-sm font-bold text-gray-800">{faq.question}</span>
                    <ChevronDown className={cn("h-5 w-5 text-gray-400 transition-transform", activeFaq === i && "rotate-180")} />
                  </button>
                  {activeFaq === i && (
                    <div className="px-5 pb-5 animate-in slide-in-from-top-2">
                      <p className="text-xs leading-relaxed text-gray-500">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Reviews Section */}
          <section className="space-y-12">
            <ReviewSection tourId={tour.id} />
          </section>

          {/* Related Tours Section Mobile */}
          {similarTours.length > 0 && (
            <section className="space-y-8 pt-8 border-t border-gray-100">
               <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight">Related Tours</h2>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-1">Handpicked for you</p>
                  </div>
                  <Link to="/tours" className="text-[10px] font-black text-primary uppercase tracking-widest bg-orange-50 px-3 py-1.5 rounded-full">Explore All</Link>
               </div>
               <div className="grid grid-cols-1 gap-8">
                 {similarTours.slice(0, 2).map((st, i) => (
                   <TourCard key={st.id} tour={st} index={i} />
                 ))}
               </div>
            </section>
          )}
        </div>
        </div>
      ) : (
        <div className="hidden md:block">
        {/* Breadcrumb */}
        <div className="bg-gray-50 py-4">
          <div className="container mx-auto px-4 lg:px-8">
            <nav className="flex items-center gap-2 text-xs font-medium text-gray-500">
              <Link to="/" className="hover:text-blue-600">Home</Link>
              <ChevronRight className="h-3 w-3" />
              <Link to="/tours" className="hover:text-blue-600">Tours</Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-gray-900 truncate max-w-[200px] md:max-w-none">{tour.title}</span>
            </nav>
          </div>
        </div>

        <main className="container mx-auto px-4 py-8 lg:px-8">
          {/* Title & Share */}
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="space-y-4">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
                {tour.title}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-sm font-medium text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="flex text-amber-500">
                    <Star className="h-4 w-4 fill-current" />
                  </div>
                  <span className="text-gray-900 font-bold">{tour.rating || 'No rating'}</span>
                  <span className="text-xs font-bold text-gray-400">({tour.reviewsCount || 0} Reviews)</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-primary rounded-full text-xs font-bold border border-orange-100">
                  <MapPin className="h-3 w-3" />
                  <span>{tour.location}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-primary rounded-full text-xs font-bold border border-orange-100">
                  <Clock className="h-3 w-3" />
                  <span>{tour.duration}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={handleShare}
              className="flex items-center justify-center gap-2 rounded-[10px] border border-gray-200 px-6 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-gray-50 hover:border-gray-300 active:scale-95"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>

          {/* Gallery */}
          <TourGallery images={galleryImages} />

          {/* Dynamic Urgency Points */}
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {urgencyPoints
              .filter(point => tour?.urgencyPointIds?.includes(point.id))
              .map(point => {
                const IconComponent = (Icons as any)[point.icon] || ShieldCheck;
                return (
                  <div key={point.id} className="flex gap-4 p-4 rounded-2xl bg-orange-50/50 border border-orange-100/50 group hover:bg-orange-50 transition-colors">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-white flex items-center justify-center text-primary shadow-sm">
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-gray-900 tracking-tight">{point.title}</h4>
                      <p className="text-[11px] text-gray-500 font-medium leading-tight mt-1">{point.description}</p>
                    </div>
                  </div>
                );
            })}
          </div>

          <div className="mt-12 flex flex-col lg:flex-row gap-12 items-start">
            <div className="flex-1 lg:w-2/3 space-y-16">
              <TourInfo tour={tour} />
              <ReviewSection tourId={tour.id} />
            </div>
            <aside className="hidden md:block lg:w-1/3 lg:sticky lg:top-[120px] h-fit self-start z-10">
              <BookingForm tour={tour} />
            </aside>
          </div>

          {/* Related Tours Section Desktop */}
          {similarTours.length > 0 && (
            <div className="mt-24 pt-16 border-t border-gray-100">
              <div className="flex items-end justify-between mb-12">
                <div>
                   <h2 className="text-3xl font-black text-gray-900 tracking-tight">You Might Also Like</h2>
                   <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-2">More adventures wait in {tour.location}</p>
                </div>
                <Link to="/tours" className="group flex items-center gap-2 text-sm font-black text-primary uppercase tracking-widest h-12 px-8 rounded-full border-2 border-orange-50 hover:bg-orange-50 transition-all">
                  Browse All Tours <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {similarTours.map((st, i) => (
                  <TourCard key={st.id} tour={st} index={i} />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
      )}
    </div>
  );
}
