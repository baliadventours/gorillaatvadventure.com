import React, { useState, useEffect } from 'react';
import { useSettings } from '../lib/SettingsContext';
import { Helmet } from 'react-helmet-async';
import { formatPageTitle } from '../lib/seoUtils';
import { cn } from '../lib/utils';
import { 
  db,
  handleFirestoreError,
  OperationType 
} from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  increment, 
  query, 
  where, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { 
  Sparkles, 
  HelpCircle, 
  Lightbulb, 
  Search, 
  ThumbsUp, 
  Eye, 
  ChevronDown, 
  ChevronUp, 
  Plane, 
  Compass, 
  MapPin, 
  MessageSquare, 
  Loader2, 
  ArrowRight,
  Globe,
  CheckCircle
} from 'lucide-react';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  isPublished: boolean;
  views: number;
  helpfulCount: number;
}

interface TravelTip {
  id: string;
  title: string;
  content: string;
  category: string;
  isPublished: boolean;
}

export default function AIHub() {
  const { settings } = useSettings();
  const pageTitle = formatPageTitle('AI Travel Hub & Bali FAQ', settings?.siteName || 'Bali Adventours', settings?.pageTitleFormat);

  const [activeSegment, setActiveSegment] = useState<'faq' | 'tips' | 'concierge'>('faq');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [tips, setTips] = useState<TravelTip[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded FAQs
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Upvoted IDs (Local state to prevent duplicate voting)
  const [upvotedIds, setUpvotedIds] = useState<string[]>([]);

  // Search/Filters
  const [activeFaqCategory, setActiveFaqCategory] = useState<string>('All');
  const [activeTipCategory, setActiveTipCategory] = useState<string>('All');

  // AI Concierge
  const [conciergeQuery, setConciergeQuery] = useState('');
  const [conciergeReply, setConciergeReply] = useState('');
  const [conciergeSources, setConciergeSources] = useState<any[]>([]);
  const [conciergeLoading, setConciergeLoading] = useState(false);
  const [conciergeFellBack, setConciergeFellBack] = useState(false);

  // Load Seed / Data
  const loadData = async () => {
    setLoading(true);
    try {
      const faqsQuery = query(collection(db, 'aiFaqs'), where('isPublished', '==', true));
      const faqsSnap = await getDocs(faqsQuery);
      const loadedFaqs = faqsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FAQ[];

      const tipsQuery = query(collection(db, 'aiTips'), where('isPublished', '==', true));
      const tipsSnap = await getDocs(tipsQuery);
      const loadedTips = tipsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TravelTip[];

      // Sort
      setFaqs(loadedFaqs.sort((a, b) => (b.helpfulCount || 0) - (a.helpfulCount || 0)));
      setTips(loadedTips);
    } catch (err) {
      console.error("Error loading AI Hub data", err);
      handleFirestoreError(err, OperationType.LIST, 'aiFaqs/aiTips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Load local upvotes
    try {
      const stored = localStorage.getItem('bali_ai_hub_upvotes');
      if (stored) setUpvotedIds(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Update views
  const handleFaqClick = async (faq: FAQ) => {
    if (expandedFaqId === faq.id) {
      setExpandedFaqId(null);
      return;
    }
    setExpandedFaqId(faq.id);

    try {
      const faqRef = doc(db, 'aiFaqs', faq.id);
      await updateDoc(faqRef, {
        views: increment(1)
      });
      // update state locally
      setFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, views: (f.views || 0) + 1 } : f));
    } catch (e) {
      console.error(e);
      handleFirestoreError(e, OperationType.UPDATE, `aiFaqs/${faq.id}`);
    }
  };

  // Upvote FAQ helper
  const handleUpvoteFaq = async (e: React.MouseEvent, faqId: string) => {
    e.stopPropagation();
    if (upvotedIds.includes(faqId)) return;

    try {
      const faqRef = doc(db, 'aiFaqs', faqId);
      await updateDoc(faqRef, {
        helpfulCount: increment(1)
      });
      
      const newUpvotes = [...upvotedIds, faqId];
      setUpvotedIds(newUpvotes);
      localStorage.setItem('bali_ai_hub_upvotes', JSON.stringify(newUpvotes));

      // Update state locally
      setFaqs(prev => prev.map(f => f.id === faqId ? { ...f, helpfulCount: (f.helpfulCount || 0) + 1 } : f));
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.UPDATE, `aiFaqs/${faqId}`);
    }
  };

  // Ask Concierge
  const handleAskConcierge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conciergeQuery.trim()) return;

    setConciergeLoading(true);
    setConciergeReply('');
    setConciergeSources([]);
    setConciergeFellBack(false);

    try {
      const res = await fetch('/api/gemini/ask-concierge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: conciergeQuery })
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Concierge failed to respond");
      }

      setConciergeReply(resData.answer || '');
      setConciergeSources(resData.sources || []);
      setConciergeFellBack(!!resData.fellBack);
    } catch (error: any) {
      console.error(error);
      setConciergeReply(error.message || "I apologize, but our AI Travel Concierge is facing a temporary connectivity issue. Please try rephrasing your search or check your internet connection.");
    } finally {
      setConciergeLoading(false);
    }
  };

  // Categories
  const faqCategories = ['All', 'Logistics', 'Culture', 'Safety', 'Attractions', 'General'];
  const tipCategories = ['All', 'Adventure', 'Culture', 'Budget', 'Food', 'Logistics', 'Packing'];

  const filteredFaqs = faqs.filter(faq => {
    if (activeFaqCategory === 'All') return true;
    return faq.category === activeFaqCategory;
  });

  const filteredTips = tips.filter(tip => {
    if (activeTipCategory === 'All') return true;
    return tip.category === activeTipCategory;
  });

  // Dynamic structured data for search engine/AI agent crawler indexing
  const faqSchemaMarkup = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "name": "Bali Travel Interactive FAQ - Bali Adventours",
    "description": "Vetted travel facts regarding culture, safety, logistics, and attractions in Bali.",
    "mainEntity": faqs.slice(0, 30).map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <div id="ai-hub-public-page" className="min-h-screen bg-gray-50 pt-28 pb-20 font-sans text-gray-900">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content="Access our official Bali Travel Advisory and live Expert Concierge. Vetted locally for vacationers, fully structured with Schema.org JSON-LD for AI search engines and crawler agents." />
        <meta name="keywords" content="Bali Travel Advisory, Verified Bali Guides, Bali travel hacks, Bali FAQ schema, Bali local concierge, Bali Adventours" />
        {faqs.length > 0 && (
          <script type="application/ld+json">
            {JSON.stringify(faqSchemaMarkup)}
          </script>
        )}
      </Helmet>

      {/* Premium Vetted Advisory Header */}
      <div className="bg-white border-b border-gray-100 py-12 md:py-16 mb-12">
        <div className="container mx-auto px-4 lg:px-8">
          <div className="max-w-4xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-800 rounded-full border border-orange-100/60">
              <Compass className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-orange-800">Verified Travel Advisory Hub</span>
            </div>
            
            <div className="space-y-3">
              <h1 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight leading-none font-sans">
                Bali Advisory &amp; <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-teal-700">Expert Concierge</span>
              </h1>
              <p className="text-gray-500 text-base md:text-lg max-w-2xl font-medium leading-relaxed">
                The authoritative, zero-bloat handbook. Get trusted Balinese culture rules, transport protocols, and safety tips curated by local operation experts.
              </p>
            </div>

            {/* Local Team Vetted Promise Panel */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-orange-50/50 border border-orange-100/60 rounded-2xl">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-700 flex-shrink-0">
                <CheckCircle className="h-5 w-5" />
              </span>
              <div>
                <h4 className="text-sm font-black text-orange-950 font-sans tracking-tight">Verified Locally &amp; Built for Smart Travel</h4>
                <p className="text-xs text-orange-800/80 font-medium leading-relaxed mt-0.5">
                  Avoid outdated blogs. All travel advice, local protocols, and logs are continuously maintained by our active on-the-ground team of Balinese private drivers and tour managers. Perfect for visitor planning, and structured cleanly for modern search engines.
                </p>
              </div>
            </div>

            {/* Segment Controls */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => setActiveSegment('faq')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border",
                  activeSegment === 'faq' ? "bg-black text-white border-black shadow-md shadow-black/10" : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                )}
              >
                <HelpCircle className="h-4 w-4" />
                Vetted Traveler Handbook (FAQ)
              </button>
              <button
                onClick={() => setActiveSegment('tips')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border",
                  activeSegment === 'tips' ? "bg-black text-white border-black shadow-md shadow-black/10" : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                )}
              >
                <Lightbulb className="h-4 w-4" />
                Insider Travel Hacks &amp; Tips
              </button>
              <button
                onClick={() => setActiveSegment('concierge')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 border border-primary/20",
                  activeSegment === 'concierge' ? "bg-primary text-white border-primary shadow-md shadow-primary/25" : "bg-orange-50/50 hover:bg-orange-50 text-orange-800"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Instant Local Concierge (Real-time)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Page Content */}
      <div className="container mx-auto px-4 lg:px-8">
        
        {/* FAQS SEGMENT */}
        {activeSegment === 'faq' && (
          <div className="grid lg:grid-cols-4 gap-8 items-start">
            {/* Sidebar Categories */}
            <div className="space-y-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 mb-2">
                Categories
              </h3>
              <div className="flex flex-col gap-1">
                {faqCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveFaqCategory(cat)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all",
                      activeFaqCategory === cat 
                        ? "bg-primary/10 text-primary" 
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Accordion list */}
            <div className="lg:col-span-3 space-y-4">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-gray-400 text-xs font-bold bg-white rounded-2xl border border-gray-100">
                  <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                  Fetching Vetted Traveler FAQ Handbook...
                </div>
              ) : filteredFaqs.length === 0 ? (
                <div className="py-20 text-center text-gray-400 text-xs font-extrabold bg-white rounded-2xl border border-dashed border-gray-200">
                  No published FAQs in this category category. Checked back soon!
                </div>
              ) : (
                filteredFaqs.map(faq => (
                  <div 
                    key={faq.id} 
                    className="bg-white border border-gray-100 hover:border-gray-200 rounded-2xl shadow-sm overflow-hidden transition-all duration-350"
                  >
                    {/* Collapsible Trigger */}
                    <button
                      onClick={() => handleFaqClick(faq)}
                      className="w-full text-left p-5 md:p-6 flex justify-between items-start gap-4 hover:bg-gray-50/50 transition-colors"
                    >
                      <div className="space-y-1">
                        <span className="px-2 py-0.5 bg-gray-100 rounded-md text-[9px] font-black uppercase text-gray-400 tracking-wider">
                          {faq.category}
                        </span>
                        <h3 className="text-base font-extrabold text-gray-900 font-sans tracking-tight leading-snug">
                          {faq.question}
                        </h3>
                      </div>
                      <span className="mt-1 text-gray-400 p-1 bg-gray-50 rounded-lg group-hover:text-gray-700">
                        {expandedFaqId === faq.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </span>
                    </button>

                    {/* Explainer / Accordion Body */}
                    {expandedFaqId === faq.id && (
                      <div className="px-5 md:px-6 pb-6 pt-2 border-t border-gray-50/80 space-y-5">
                        <p className="text-sm font-semibold text-gray-600 leading-relaxed whitespace-pre-line">
                          {faq.answer}
                        </p>
                        
                        {/* Rating/Votes Panel */}
                        <div className="flex flex-wrap items-center justify-between pt-4 border-t border-gray-100 text-xs text-gray-400 font-bold gap-3">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                              <Eye className="h-4 w-4 text-gray-300" />
                              <span>{faq.views || 0} views</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-orange-500">
                              <ThumbsUp className="h-4 w-4" />
                              <span>{faq.helpfulCount || 0} felt this was helpful</span>
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span>Was this answer helpful?</span>
                            <button
                              onClick={(e) => handleUpvoteFaq(e, faq.id)}
                              disabled={upvotedIds.includes(faq.id)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all",
                                upvotedIds.includes(faq.id)
                                  ? "bg-orange-50 text-primary border-orange-100"
                                  : "bg-white hover:bg-gray-50 text-gray-600 border-gray-200"
                              )}
                            >
                              <ThumbsUp className="h-3 w-3" />
                              {upvotedIds.includes(faq.id) ? "Thank you!" : "Yes, helpful"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TIPS SEGMENT */}
        {activeSegment === 'tips' && (
          <div className="space-y-6">
            {/* Category selection */}
            <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest px-3 mr-2">
                Filter:
              </span>
              {tipCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveTipCategory(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-xs font-black transition-all",
                    activeTipCategory === cat 
                      ? "bg-black text-white" 
                      : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid display */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-gray-400 text-xs font-bold bg-white rounded-2xl border border-gray-100">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                Fetching Insider Travel Hacks...
              </div>
            ) : filteredTips.length === 0 ? (
              <div className="py-20 text-center text-gray-400 text-xs font-extrabold bg-white rounded-2xl border border-dashed border-gray-200">
                No published tips in this category zone. Check back soon!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTips.map(tip => (
                  <div key={tip.id} className="bg-white border border-gray-100 hover:border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                    <div className="space-y-3">
                      <span className="inline-block px-2.5 py-1 bg-orange-50 text-orange-800 rounded-lg text-[10px] font-extrabold uppercase tracking-widest">
                        {tip.category}
                      </span>
                      <h3 className="text-base font-extrabold text-gray-950 font-sans tracking-tight leading-snug">
                        {tip.title}
                      </h3>
                      <p className="text-sm font-semibold text-gray-500 leading-relaxed whitespace-pre-line">
                        {tip.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* AI CONCIERGE SEARCH */}
        {activeSegment === 'concierge' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-gray-100 p-6 md:p-8 rounded-2xl shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                <div>
                  <h2 className="text-lg font-black text-gray-900 font-sans">
                    Real-Time Advisory &amp; Concierge Desk
                  </h2>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Grounded local intelligence
                  </p>
                </div>
              </div>

              <p className="text-gray-500 text-sm font-semibold leading-relaxed">
                Need fast updates on ferry schedules, Nyepi dates, dress regulations, or visa fees? Ask below! This desk is equipped with Google Search grounding to scan live local records and summarize accurate, real-time facts with absolute transparency.
              </p>

              <form onSubmit={handleAskConcierge} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={conciergeQuery}
                  onChange={(e) => setConciergeQuery(e.target.value)}
                  placeholder="e.g., Do I need cash for taxis at Denpasar Airport? Can I visit temples during Nyepi?"
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 focus:bg-white outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  type="submit"
                  disabled={conciergeLoading || !conciergeQuery.trim()}
                  className="px-6 py-3 bg-primary text-white hover:bg-orange-700 transition-all rounded-xl text-xs font-black flex items-center gap-2"
                >
                  {conciergeLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      Searching live records...
                    </>
                  ) : (
                    <>
                      Ask Concierge
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* REPLY SECTION */}
              {conciergeLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 text-xs font-bold bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  Gathering up-to-the-minute regulations, schedules, and advisory archives...
                </div>
              ) : conciergeReply ? (
                <div className="bg-gray-50/50 p-6 rounded-xl border border-gray-100 space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest">
                    <Sparkles className="h-4 w-4 text-orange-500" />
                    Live Concierge Advisory Report
                  </div>

                  {conciergeFellBack && (
                    <div id="concierge-quota-fallback-notice" className="p-4 bg-amber-50/80 border border-amber-100 rounded-xl text-xs font-semibold text-amber-800 flex items-start gap-2.5 leading-relaxed">
                      <Sparkles className="h-4.5 w-4.5 text-amber-600 flex-shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <span className="font-extrabold text-amber-900 uppercase tracking-wider block mb-0.5 text-[10px]">Real-time Search Grounding Paused</span>
                        Google Search grounding has reached the API quota limit of our Google AI Studio Free Tier. To maintain your travel flow, we safely routed your request through our core offline AI model instead!
                      </div>
                    </div>
                  )}
                  
                  <div className="text-sm font-semibold text-gray-700 leading-relaxed whitespace-pre-line space-y-2">
                    {conciergeReply}
                  </div>

                  {conciergeSources.length > 0 && (
                    <div className="pt-4 border-t border-gray-100 space-y-2">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1">
                        <Globe className="h-3.5 w-3.5" /> Factual citations & live references:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {conciergeSources.map((src, idx) => (
                          <a 
                            key={idx}
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 hover:border-orange-200 hover:text-primary transition-all text-[10px] font-bold text-gray-500 rounded-lg"
                          >
                            <Globe className="h-3 w-3" />
                            {src.title || `Reference [${idx + 1}]`}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
