import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, getDocs, where } from 'firebase/firestore';
import { Tour, Category, LocationMeta } from '../types';
import * as LucideIcons from 'lucide-react';
import { Search, Filter, X, ChevronDown, Tag, Compass } from 'lucide-react';
import FormattedPrice from '../components/FormattedPrice';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import TourCard from '../components/TourCard';
import { Helmet } from 'react-helmet-async';
import { useSettings } from '../lib/SettingsContext';
import { formatPageTitle } from '../lib/seoUtils';

type SortOption = 'newest' | 'price-low' | 'price-high' | 'rating';

const DEFAULT_FALLBACK_TOURS: Tour[] = [
  {
    id: "ubud-day-tour-seed",
    slug: "ubud-day-tour",
    title: "Ubud Day Tour: Monkey Forest, Rice Terraces & Waterfall",
    description: "Spend a day getting to know the real Ubud, the place everyone falls in love with.",
    duration: "6-8 Hours",
    regularPrice: 45,
    discountPrice: 35,
    featuredImage: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
    gallery: ["https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80"],
    rating: 4.9,
    reviewsCount: 124,
    isPopular: true,
    categoryId: "culture-fallback",
    status: "published",
    highlights: ["Sacred Monkey Forest Sanctuary", "Tegalalang Rice Terraces", "Tegenungan Waterfall"],
    inclusions: ["AC transport", "Driver guide", "Entrance tickets"],
    exclusions: ["Lunch", "Personal expenses"],
    itinerary: [],
    location: "Ubud, Bali",
    locationMapUrl: "",
    languages: ["English", "Indonesian"],
    packages: [],
    faqs: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "mount-batur-trek-seed",
    slug: "mount-batur-sunrise-trek",
    title: "Mount Batur Sunrise Trekking with Natural Hot Spring",
    description: "Hike up to the active volcano Mount Batur to see an incredibly spectacular sunrise over Bali island.",
    duration: "8-10 Hours",
    regularPrice: 65,
    discountPrice: 49,
    featuredImage: "https://images.unsplash.com/photo-1518548419070-2c61b179ad65?auto=format&fit=crop&w=600&q=80",
    gallery: ["https://images.unsplash.com/photo-1518548419070-2c61b179ad65?auto=format&fit=crop&w=600&q=80"],
    rating: 4.8,
    reviewsCount: 96,
    isPopular: true,
    categoryId: "history-fallback",
    status: "published",
    highlights: ["Sunrise view from volcanic peak", "Natural thermal hot spring soak", "Coffee plantation visit"],
    inclusions: ["Hotel pickup/dropoff", "Local trekking guide", "Breakfast at summit", "Hot spring tickets"],
    exclusions: ["Gratuities"],
    itinerary: [],
    location: "Kintamani, Bali",
    locationMapUrl: "",
    languages: ["English", "Indonesian"],
    packages: [],
    faqs: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "nusa-penida-tour-seed",
    slug: "nusa-penida-one-day-tour",
    title: "Nusa Penida One Day Tour with Snorkeling Activities",
    description: "Sail away to exotic Nusa Penida island and visit iconic Kelingking Beach, Broken Beach, and snorkel with mantas.",
    duration: "10-12 Hours",
    regularPrice: 75,
    discountPrice: 59,
    featuredImage: "https://images.unsplash.com/photo-1537953773315-221350741d53?auto=format&fit=crop&w=600&q=80",
    gallery: ["https://images.unsplash.com/photo-1537953773315-221350741d53?auto=format&fit=crop&w=600&q=80"],
    rating: 4.9,
    reviewsCount: 148,
    isPopular: true,
    categoryId: "beach-fallback",
    status: "published",
    highlights: ["Kelingking T-Rex Beach", "Broken Beach / Angel Billabong", "Snorkeling with Manta Rays"],
    inclusions: ["Fast boat ticket return", "Island private transport", "Lunch", "Snorkeling gear and boat"],
    exclusions: ["Retribution fee"],
    itinerary: [],
    location: "Nusa Penida, Bali",
    locationMapUrl: "",
    languages: ["English", "Indonesian"],
    packages: [],
    faqs: [],
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: "uluwatu-kecak-seed",
    slug: "uluwatu-temple-sunset-kecak-dance",
    title: "Uluwatu Temple Sunset Tour with Kecak Fire Dance Show",
    description: "Watch the incredible sunset over the Indian Ocean from Uluwatu cliff temple, then watch the legendary Kecak dance.",
    duration: "5-6 Hours",
    regularPrice: 39,
    discountPrice: 29,
    featuredImage: "https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=600&q=80",
    gallery: ["https://images.unsplash.com/photo-1544644181-1484b3fdfc62?auto=format&fit=crop&w=600&q=80"],
    rating: 4.7,
    reviewsCount: 82,
    isPopular: false,
    categoryId: "culture-fallback",
    status: "published",
    highlights: ["Uluwatu cliff-top temple", "Sunset ocean panorama", "Kecak Fire Dance performance"],
    inclusions: ["AC private car", "Driver guide", "Uluwatu temple tickets", "Kecak dance tickets"],
    exclusions: ["Dinner"],
    itinerary: [],
    location: "Uluwatu, Bali",
    locationMapUrl: "",
    languages: ["English", "Indonesian"],
    packages: [],
    faqs: [],
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export default function Tours() {
  const { settings } = useSettings();
  const [searchParams] = useSearchParams();
  const [tours, setTours] = useState<Tour[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("bali_cached_tours");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return DEFAULT_FALLBACK_TOURS;
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("bali_cached_categories");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [
      { id: "culture-fallback", name: "Art & Culture", icon: "Compass" },
      { id: "beach-fallback", name: "Beach", icon: "Sun" },
      { id: "food-fallback", name: "Food & Drink", icon: "Tag" },
      { id: "history-fallback", name: "History", icon: "Activity" }
    ] as Category[];
  });
  const [locations, setLocations] = useState<LocationMeta[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("bali_cached_locations");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedTours = localStorage.getItem("bali_cached_tours");
        if (cachedTours && JSON.parse(cachedTours).length > 0) {
          return false;
        }
      } catch (e) {}
    }
    return true;
  });

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [priceRange, setPriceRange] = useState<number>(2000);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    // Sync with URL params
    const q = searchParams.get('search');
    const loc = searchParams.get('location');
    const cat = searchParams.get('category');
    
    if (q !== null) setSearchTerm(q);
    if (loc !== null) setSelectedLocation(loc);
    if (cat !== null) setSelectedCategory(cat);
  }, [searchParams]);

  useEffect(() => {
    // Fetch categories and locations
    const fetchMetadata = async () => {
      const catSnap = await getDocs(collection(db, 'categories'));
      const locSnap = await getDocs(collection(db, 'locationMeta'));
      const catData = catSnap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      const locData = locSnap.docs.map(d => ({ id: d.id, ...d.data() } as LocationMeta));
      
      setCategories(catData);
      setLocations(locData);
      
      try {
        localStorage.setItem("bali_cached_categories", JSON.stringify(catData));
        localStorage.setItem("bali_cached_locations", JSON.stringify(locData));
      } catch (e) {}
    };
    fetchMetadata();

    const q = query(
      collection(db, 'tours'), 
      where('status', 'in', ['published', 'active'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tourData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Tour));
      tourData.sort((a, b) => {
        const getTimestampMillis = (val: any): number => {
          if (!val) return 0;
          if (typeof val.toMillis === "function") return val.toMillis();
          if (typeof val.seconds === "number") return val.seconds * 1000;
          if (val instanceof Date) return val.getTime();
          if (typeof val === "string" || typeof val === "number") return new Date(val).getTime() || 0;
          return 0;
        };
        return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
      });
      setTours(tourData);
      setLoading(false);
      try {
        localStorage.setItem("bali_cached_tours", JSON.stringify(tourData));
      } catch (e) {}
    }, (error) => {
      console.error("[Tours Page Snapshot Error]:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const categoryMap = useMemo(() => {
    return new Map(categories.map(c => [c.id, c.name]));
  }, [categories]);

  const locationMap = useMemo(() => {
    return new Map(locations.map(l => [l.id, l.name]));
  }, [locations]);

  const filteredAndSortedTours = useMemo(() => {
    const filtered = tours.filter(tour => {
      // Token-based descriptive search
      const searchLower = searchTerm.trim().toLowerCase();
      let matchesSearch = true;
      
      if (searchLower) {
        const tokens = searchLower.split(/\s+/).filter(Boolean);
        const catName = categoryMap.get(tour.categoryId || '') || '';
        const locName = locationMap.get(tour.locationId || '') || '';
        
        matchesSearch = tokens.every(token => {
          const inTitle = tour.title?.toLowerCase().includes(token);
          const inLoc = tour.location?.toLowerCase().includes(token) || tour.locationId?.toLowerCase().includes(token);
          const inDesc = tour.description?.toLowerCase().includes(token);
          const inCat = catName.toLowerCase().includes(token);
          const inLocMeta = locName.toLowerCase().includes(token);
          const inHighlights = tour.highlights?.some(h => h.toLowerCase().includes(token));
          const inSeoKeywords = tour.seo?.keywords?.toLowerCase().includes(token);
          const inSlug = tour.slug?.toLowerCase().includes(token);

          return inTitle || inLoc || inDesc || inCat || inLocMeta || inHighlights || inSeoKeywords || inSlug;
        });
      }

      const matchesCategory = selectedCategory === 'all' || tour.categoryId === selectedCategory;
      const matchesLocation = selectedLocation === 'all' || tour.locationId === selectedLocation;
      const price = tour.discountPrice || tour.regularPrice;
      const matchesPrice = price <= priceRange;

      return matchesSearch && matchesCategory && matchesLocation && matchesPrice;
    });

    return filtered.sort((a, b) => {
      const priceA = a.discountPrice || a.regularPrice;
      const priceB = b.discountPrice || b.regularPrice;

      switch (sortBy) {
        case 'price-low': return priceA - priceB;
        case 'price-high': return priceB - priceA;
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'newest':
        default:
          return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
      }
    });
  }, [tours, searchTerm, selectedCategory, selectedLocation, priceRange, sortBy, categoryMap, locationMap]);

  const pageTitle = formatPageTitle('All Adventure Tours', settings?.siteName || 'Bali Adventours', settings?.pageTitleFormat);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content="Browse our complete list of adventure tours in Bali. Filter by activity type, location and price to find your perfect expedition." />
      </Helmet>

      {/* Page Header */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50/70 via-gray-50/20 to-white pt-28 pb-16 border-b border-gray-100/80">
        {/* Subtle decorative mesh background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-70 pointer-events-none" />
        <div className="container mx-auto px-4 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 text-[10px] font-black uppercase tracking-widest rounded-full mb-4 shadow-sm border border-orange-100/40">
              <Compass className="h-3 w-3 animate-spin" style={{ animationDuration: '30s' }} /> Curated Expeditions
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 tracking-tight mb-4">
              Choose your adventure
            </h1>
            <p className="text-gray-500 font-medium text-base md:text-lg leading-relaxed max-w-2xl">
              Explore our curated collection of Bali's most extraordinary expeditions, from majestic peaks to coastal sanctuaries.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-12 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-12">
          {/* Sidebar Filter */}
          <aside className="lg:w-72 flex-shrink-0 animate-fadeIn">
            {/* Mobile Filter Toggle */}
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden w-full flex items-center justify-between px-5 py-3.5 bg-white border border-gray-200 rounded-xl font-black text-xs text-gray-900 mb-6 shadow-sm active:scale-98 transition-all"
            >
              <span className="flex items-center gap-2"><Filter className="h-4 w-4 text-primary" /> Filters & Categories</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform text-gray-400", showFilters && "rotate-180")} />
            </button>

            <div className={cn(
              "bg-white border border-gray-200 p-6 rounded-2xl space-y-6 lg:block lg:sticky lg:top-32 shadow-[0_10px_30px_rgba(0,0,0,0.04)] text-left duration-300 transition-all",
              showFilters ? "block animate-fadeIn" : "hidden"
            )}>
              {/* Search */}
              <div className="space-y-2 pb-5 border-b border-gray-200/60">
                <h3 className="text-xs font-black text-gray-700">Keyword Search</h3>
                <div className="relative group/search">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within/search:text-primary transition-colors" />
                  <input 
                    type="text"
                    placeholder="Search adventures..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full bg-white border border-gray-200/80 rounded-xl py-2.5 pl-10 pr-9 focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:bg-white focus:border-primary/30 transition-all text-xs font-black text-gray-900 placeholder:text-gray-400 shadow-sm"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Destination Dropdown */}
              <div className="space-y-2 pb-5 border-b border-gray-200/60">
                <h3 className="text-xs font-black text-gray-700">Destination</h3>
                <div className="relative">
                  <select
                    value={selectedLocation}
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="w-full appearance-none bg-white hover:bg-white border border-gray-200 hover:border-gray-300 rounded-xl py-2.5 pl-3.5 pr-10 text-xs font-black text-gray-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/10 focus:bg-white focus:border-primary/30 transition-all shadow-sm"
                  >
                    <option value="all">Across Bali (All Districts)</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

               {/* Vertical Organized Categories selection */}
              <div className="space-y-2 pb-5 border-b border-gray-200/60">
                <h3 className="text-xs font-black text-gray-700">Activity Type</h3>
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                  <button 
                    onClick={() => setSelectedCategory('all')}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-black transition-all duration-200 group border text-left",
                      selectedCategory === 'all' 
                        ? "bg-gray-950 border-gray-950 text-white shadow-sm" 
                        : "bg-transparent border-transparent text-gray-550 hover:bg-white hover:border-gray-200 hover:text-gray-900 cursor-pointer"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <Compass className="h-4 w-4 shrink-0 text-primary group-hover:scale-110 duration-200 transition-transform" />
                      <span>All Types</span>
                    </span>
                    {selectedCategory === 'all' && (
                      <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                    )}
                  </button>
                  {categories.map(cat => {
                    const isSelected = selectedCategory === cat.id;
                    return (
                      <button 
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-black transition-all duration-200 group border text-left",
                          isSelected 
                            ? "bg-gray-950 border-gray-950 text-white shadow-sm" 
                            : "bg-transparent border-transparent text-gray-550 hover:bg-white hover:border-gray-200 hover:text-gray-900 cursor-pointer"
                        )}
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {cat.icon && (
                            <div className="shrink-0 flex items-center justify-center">
                              {cat.icon.startsWith('http') ? (
                                <img src={cat.icon} className="h-4 w-4 object-contain" referrerPolicy="no-referrer" alt="" />
                              ) : (() => {
                                const IconComponent = (LucideIcons as any)[cat.icon] || Tag;
                                return <IconComponent className="h-4 w-4 text-primary group-hover:scale-110 duration-200 transition-transform" />;
                              })()}
                            </div>
                          )}
                          <span className="truncate">{cat.name}</span>
                        </span>
                        {isSelected && (
                          <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price Filter range */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-black text-gray-700">Max Price</h3>
                  <span className="text-[10px] font-black text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-100/30"><FormattedPrice amount={priceRange} /></span>
                </div>
                <input 
                  type="range"
                  min="50"
                  max="2000"
                  step="50"
                  value={priceRange}
                  onChange={e => setPriceRange(Number(e.target.value))}
                  className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 accent-primary focus:outline-none"
                />
                <div className="flex justify-between text-[9px] font-black text-gray-400 tracking-wider">
                  <span><FormattedPrice amount={50} /></span>
                  <span><FormattedPrice amount={2000} />+</span>
                </div>
              </div>

              {/* Active Clear Filter Button */}
              {(searchTerm || selectedCategory !== 'all' || selectedLocation !== 'all' || priceRange < 2000) && (
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                    setSelectedLocation('all');
                    setPriceRange(2000);
                  }}
                  className="w-full py-2.5 mt-2 bg-rose-50/60 text-rose-600 border border-rose-100 hover:bg-rose-500 hover:text-white hover:border-rose-500 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer active:scale-97"
                >
                  <X className="h-3.5 w-3.5" /> Clear Filters
                </button>
              )}
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="mb-10 flex flex-col sm:flex-row items-center justify-between gap-6 pb-6 border-b border-gray-100">
              <div className="flex items-center gap-6">
                <p className="text-xs font-bold text-gray-400">
                  Showing <span className="text-gray-900 font-black">{filteredAndSortedTours.length}</span> adventures
                </p>
                <div className="hidden sm:flex items-center bg-gray-50/80 p-1 rounded-xl border border-gray-100/80 shadow-inner">
                  <button 
                    onClick={() => setViewMode('grid')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      viewMode === 'grid' ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <LucideIcons.LayoutGrid className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      viewMode === 'list' ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <LucideIcons.List className="h-4 w-4" />
                  </button>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider hidden sm:inline-block">Sort by:</span>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="appearance-none bg-white border border-gray-150 rounded-2xl py-2.5 pl-4 pr-10 text-xs font-black text-gray-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-gray-300 transition-all text-right shadow-sm"
                  >
                    <option value="newest">Featured</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="rating">Top Rated</option>
                  </select>
                  <ChevronDown className="absolute right-4.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Grid */}
            {loading && tours.length === 0 ? (
              <div className={cn(
                "grid gap-8",
                viewMode === 'grid' ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
              )}>
                  {[1,2,3,4,5,6].map(n => (
                      <div key={n} className={cn(
                        "space-y-4 animate-pulse",
                        viewMode === 'list' && "flex flex-col md:flex-row gap-6 items-start"
                      )}>
                          <div className={cn(
                            "bg-gray-50 rounded-xl",
                            viewMode === 'grid' ? "aspect-[4/3] w-full" : "aspect-video md:w-72 shrink-0"
                          )} />
                          <div className="space-y-3 flex-1 w-full">
                            <div className="h-2 bg-gray-100 rounded-full w-1/3" />
                            <div className="h-4 bg-gray-100 rounded-full w-full" />
                            <div className="h-2 bg-gray-100 rounded-full w-1/4" />
                          </div>
                      </div>
                  ))}
              </div>
            ) : (
              <>
                {filteredAndSortedTours.length > 0 ? (
                  <div className={cn(
                    "grid gap-x-8 gap-y-10",
                    viewMode === 'grid' ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
                  )}>
                    {filteredAndSortedTours.map((tour, index) => (
                      <TourCard key={tour.id} tour={tour} index={index} viewMode={viewMode} />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-16">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center py-20 px-4 text-center bg-gray-50/50 rounded-2xl border border-gray-100 shadow-sm"
                    >
                      <div className="relative mb-6">
                        <div className="absolute inset-0 bg-orange-100 rounded-full blur-xl opacity-40 animate-pulse" />
                        <div className="relative h-20 w-20 bg-white rounded-full flex items-center justify-center border border-gray-100 shadow-md">
                          <Search className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <h3 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight mb-2">
                        No adventures found
                      </h3>
                      <p className="text-gray-400 font-semibold text-xs md:text-sm max-w-sm mb-8 leading-relaxed">
                        We couldn't find any tours matching <span className="text-gray-800">"{searchTerm}"</span> or other applied filters. Try adjusting them or clear filters below.
                      </p>
                      
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedCategory('all');
                          setSelectedLocation('all');
                          setPriceRange(2000);
                        }}
                        className="inline-flex items-center gap-2 px-6 py-3.5 bg-gray-900 hover:bg-primary text-white transition-all text-[10px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-gray-950/10 active:scale-97 cursor-pointer"
                      >
                        <X className="h-4 w-4" /> Clear filters & refresh list
                      </button>
                    </motion.div>

                    {/* Popular / Recommended Adventures Block */}
                    {tours.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="border-t border-gray-100 pt-16"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                          <div>
                            <span className="text-[10px] font-black text-primary uppercase tracking-widest block mb-1">Recommended for you</span>
                            <h4 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">
                              Our Most Popular Adventures
                            </h4>
                          </div>
                          <button 
                            onClick={() => {
                              setSearchTerm('');
                              setSelectedCategory('all');
                              setSelectedLocation('all');
                              setPriceRange(2000);
                            }}
                            className="text-[10px] font-black text-primary hover:text-orange-800 uppercase tracking-widest flex items-center gap-1.5 transition-colors self-start"
                          >
                            Explore full inventory <Compass className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
                          {tours
                            .filter(t => t.isPopular || (t.rating && t.rating >= 4.8))
                            .slice(0, 3)
                            .map((tour, idx) => (
                              <TourCard key={tour.id} tour={tour} index={idx} viewMode="grid" />
                            ))
                          }
                        </div>
                      </motion.div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
