import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Tour } from '../types';
import { motion } from 'motion/react';
import { Loader2, Users, ChevronRight, Search, Filter, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import FormattedPrice from '../components/FormattedPrice';
import { cn } from '../lib/utils';
import { Helmet } from 'react-helmet-async';
import { useSettings } from '../lib/SettingsContext';
import { formatPageTitle } from '../lib/seoUtils';

export default function PriceList() {
  const { settings } = useSettings();
  const [tours, setTours] = useState<Tour[]>([]);
  const pageTitle = formatPageTitle('Price List', settings?.siteName || 'Bali Adventours', settings?.pageTitleFormat);
  const [categories, setCategories] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [toursSnap, catsSnap] = await Promise.all([
          getDocs(query(collection(db, 'tours'), where('status', '==', 'active'))),
          getDocs(collection(db, 'categories'))
        ]);

        const toursList = toursSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tour));
        toursList.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        setTours(toursList);
        setCategories(catsSnap.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
      } catch (error) {
        console.error('Error fetching data for price list:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const categoryList = useMemo(() => {
    return [{ id: 'all', name: 'All' }, ...categories];
  }, [categories]);

  const filteredTours = useMemo(() => {
    return tours.filter(t => {
      const matchesSearch = t.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategoryId === 'all' || t.categoryId === selectedCategoryId;
      return matchesSearch && matchesCategory;
    });
  }, [tours, searchTerm, selectedCategoryId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
        <p className="text-gray-500 font-medium italic">Preparing current price list...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`View our complete list of tour prices at ${settings?.siteName || 'Bali Adventours'}. Transparent, tiered pricing for the best Bali experiences.`} />
      </Helmet>
      {/* Header Section */}
      <div className="mb-8">
        <motion.h1 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-3xl md:text-4xl font-black text-gray-900 tracking-tighter mb-2"
        >
          Tour <span className="text-primary italic">Price Directory</span>
        </motion.h1>
        <p className="text-gray-500 text-sm font-medium italic">
          Transparent, tiered pricing based on your group size. No hidden fees.
        </p>
      </div>

      {/* Controls Area */}
      <div className="flex flex-col md:flex-row gap-4 mb-8 bg-gray-50 p-4 rounded-2xl border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search tours..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-medium"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {categoryList.slice(0, 5).map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all shadow-sm active:scale-95",
                selectedCategoryId === cat.id 
                  ? "bg-primary text-white" 
                  : "bg-white text-gray-500 hover:bg-gray-100 border border-gray-100"
              )}
            >
              {cat.name}
            </button>
          ))}
          {categoryList.length > 5 && (
            <div className="relative group">
              <button className="h-full px-4 py-2.5 bg-white text-gray-500 hover:bg-gray-100 border border-gray-100 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                More
              </button>
              <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 p-2">
                {categoryList.slice(5).map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors",
                      selectedCategoryId === cat.id ? "bg-primary text-white" : "hover:bg-gray-50 hover:text-primary"
                    )}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simplified List */}
      <div className="space-y-6">
        {filteredTours.length > 0 ? (
          filteredTours.map((tour, idx) => (
            <motion.div
              key={tour.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="px-6 py-4 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-1">
                    {tour.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-white border border-gray-100 rounded text-gray-400">
                      {categoryList.find(c => c.id === tour.categoryId)?.name || 'General'}
                    </span>
                    <span className="text-[10px] font-medium text-gray-400 italic">
                      Duration: {tour.duration}
                    </span>
                  </div>
                </div>
                <Link 
                  to={`/tour/${tour.slug}`}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-gray-900 hover:text-white transition-all shadow-sm active:scale-95 group shrink-0"
                >
                  Book this tour
                  <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Pricing Grid */}
              <div className="p-4 overflow-x-auto">
                <div className="min-w-[600px] grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tour.packages.map((pkg, pIdx) => (
                    <div key={pIdx} className="bg-white border border-gray-50 rounded-xl p-3 flex flex-col gap-2">
                      <div className="flex items-center gap-2 px-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-tight">{pkg.name}</h3>
                      </div>
                      
                      {pkg.meetingPoint && (
                        <div className="flex items-start gap-2 px-1 py-1 bg-orange-50/50 rounded-lg border border-orange-100/30">
                          <MapPin className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-primary tracking-tighter opacity-70 leading-none mb-0.5">{pkg.meetingPointType || 'Meeting Point'}</span>
                            <span className="text-[10px] font-bold text-gray-600 leading-tight">{pkg.meetingPoint}</span>
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-3 gap-1">
                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-tighter px-2">Group Size</div>
                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right">Adult</div>
                        <div className="text-[9px] font-black text-gray-400 uppercase tracking-tighter text-right">Child</div>
                        
                        {pkg.tiers.map((tier, tIdx) => (
                          <React.Fragment key={tIdx}>
                            <div className="px-2 py-1.5 bg-gray-50 rounded flex items-center gap-1.5 text-[11px] font-bold text-gray-700">
                              <Users className="h-2.5 w-2.5 text-gray-300" />
                              {tier.minParticipants === tier.maxParticipants 
                                ? `${tier.minParticipants} Person`
                                : `${tier.minParticipants}-${tier.maxParticipants} Ppl`
                              }
                            </div>
                            <div className="px-2 py-1.5 bg-orange-50/30 rounded text-right text-[11px] font-black text-primary">
                              <FormattedPrice amount={tier.adultPrice} />
                            </div>
                            <div className="px-2 py-1.5 bg-gray-50/50 rounded text-right text-[11px] font-bold text-gray-500">
                              <FormattedPrice amount={tier.childPrice} />
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
            <Search className="h-10 w-10 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900">No tours found</h3>
            <p className="text-xs text-gray-500 italic">Try searching for something else or reset filters.</p>
            <button 
              onClick={() => { setSearchTerm(''); setSelectedCategoryId('all'); }}
              className="mt-6 text-xs font-black uppercase tracking-widest text-primary underline decoration-primary/30 underline-offset-4"
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>

      {/* Footer Hint */}
      <div className="mt-16 text-center text-gray-400">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-4 flex items-center justify-center gap-4">
          <span className="h-px w-10 bg-gray-100" />
          End of Price List
          <span className="h-px w-10 bg-gray-100" />
        </p>
        <p className="text-xs italic leading-relaxed max-w-sm mx-auto mb-6">
          Still confused about the best option for your group? Talk to Gorilla Assistant, our AI travel assistant.
        </p>
        <button 
          onClick={() => window.dispatchEvent(new CustomEvent('open-chat'))}
          className="px-8 py-3 bg-gray-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary transition-all active:scale-95"
        >
          Ask Gorilla Assistant
        </button>
      </div>
    </div>
  );
}
