import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Tour } from '../../types';
import TourCard from '../TourCard';
import { Star } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useSettings } from '../../lib/SettingsContext';

export default function TopRatedTours() {
  const [tours, setTours] = useState<Tour[]>([]);
  const { settings } = useSettings();

  const themeMode = settings?.themeMode || 'default';
  const styleId = themeMode === 'custom' ? settings?.sectionStyles?.guestFavorites : 'default';

  useEffect(() => {
    // Fetch active tours and filter/sort client-side to prevent composite index errors
    const q = query(
      collection(db, 'tours'), 
      where('status', 'in', ['published', 'active'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allTours = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Tour));
      let ratedTours = allTours
        .filter(t => (t.rating ?? 4.9) >= 4.5)
        .sort((a, b) => (b.rating ?? 4.9) - (a.rating ?? 4.9));
      
      if (ratedTours.length === 0) {
        ratedTours = allTours;
      }
      setTours(ratedTours.slice(0, 8));
    }, (error) => {
      console.error("Error in TopRatedTours onSnapshot:", error);
    });
    return unsubscribe;
  }, []);

  const renderContent = () => {
    switch (styleId) {
      case 'airbnb-classic':
      case 'airbnb-fluid':
        return (
          <section className="container mx-auto px-4 py-16 lg:px-8 border-t border-gray-100 mt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">What guests are raving about</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {tours.slice(0, 4).map((tour, index) => (
                <TourCard key={tour.id} tour={tour} index={index} variant="minimal" />
              ))}
            </div>
          </section>
        );

      case 'modern-dark':
      case 'modern-glass':
        return (
          <section className="py-24 overflow-hidden relative">
            <div className="container mx-auto px-4 lg:px-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-8">
                <div>
                  <span className="text-primary font-black text-[10px] uppercase tracking-widest">Highly Rated</span>
                  <h2 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tighter mt-4">Explorer Picks</h2>
                </div>
                <p className="max-w-xs text-gray-400 font-medium leading-relaxed">Top-rated tours vetted by thousands of satisfied adventourists.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {tours.map((tour, index) => (
                  <TourCard key={tour.id} tour={tour} index={index} variant="modern" />
                ))}
              </div>
            </div>
          </section>
        );

      case 'minimal-grid':
      case 'minimal-type':
        return (
          <section className="container mx-auto px-4 py-24 lg:px-8 border-y border-gray-100">
            <div className="grid lg:grid-cols-[1fr,3fr] gap-16">
              <div className="sticky top-24 h-fit">
                <h2 className="text-4xl font-black text-gray-900 tracking-tighter uppercase mb-6 leading-none">Curated <br /> Favorites</h2>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-300">Selection 2024</p>
              </div>
              <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-3">
                {tours.slice(0, 6).map((tour, index) => (
                  <TourCard key={tour.id} tour={tour} index={index} variant="minimal" />
                ))}
              </div>
            </div>
          </section>
        );

      case 'premium-serif':
      case 'premium-full':
        return (
          <section className="py-24 bg-[#fdfcfb]">
            <div className="container mx-auto px-4">
               <div className="text-center mb-16">
                  <span className="font-serif italic text-amber-600 text-lg">The Guest Favorites</span>
                  <div className="h-px w-24 bg-amber-200 mx-auto mt-4" />
               </div>
               <div className="grid gap-16 sm:grid-cols-2">
                  {tours.slice(0, 4).map((tour, index) => (
                     <div key={tour.id} className="flex flex-col md:flex-row gap-8 items-center bg-white p-4 rounded-xl shadow-sm border border-amber-50">
                        <div className="w-full md:w-1/2 aspect-video overflow-hidden rounded-lg">
                           <img src={tour.gallery?.[0] || tour.featuredImage} className="w-full h-full object-cover" alt={tour.title} />
                        </div>
                        <div className="w-full md:w-1/2 space-y-4">
                           <div className="flex items-center gap-1 text-amber-500">
                              {[1,2,3,4,5].map(s => <Star key={s} className="h-3 w-3 fill-amber-500" />)}
                           </div>
                           <h3 className="text-xl font-serif text-gray-900">{tour.title}</h3>
                           <p className="text-xs text-gray-400 leading-relaxed italic line-clamp-3">{tour.description}</p>
                           <Link to={`/tour/${tour.slug}`} className="inline-block text-[10px] font-black uppercase tracking-widest text-amber-600 border-b border-amber-200 pb-1">Enter Experience</Link>
                        </div>
                     </div>
                  ))}
               </div>
            </div>
          </section>
        );

      case 'saas-clean':
      case 'saas-dash':
        return (
          <section className="py-24 container mx-auto px-4">
             <div className="bg-gray-900 rounded-[3rem] p-12 md:p-20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1/3 h-full bg-primary/10 -skew-x-12" />
                <div className="relative z-10">
                   <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-12">Performance <br /> Leaderboard</h2>
                   <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                      {tours.slice(0, 4).map((tour, index) => (
                         <div key={tour.id} className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-all">
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-[0.2em] mb-4 block">Rank #{index + 1}</span>
                            <h3 className="text-lg font-bold text-white mb-2 leading-tight">{tour.title}</h3>
                            <div className="flex items-center gap-2 mb-6">
                               <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                               <span className="text-xs font-black text-white">{tour.rating}</span>
                               <span className="text-xs font-bold text-gray-500">({tour.reviewsCount})</span>
                            </div>
                            <Link to={`/tour/${tour.slug}`} className="block w-full py-2.5 bg-white text-gray-900 rounded-xl text-center text-[10px] font-black uppercase tracking-widest">Connect</Link>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          </section>
        );

      default:
        return (
          <section className="container mx-auto px-4 py-20 lg:px-8 bg-gray-50/50 rounded-[40px] my-10">
            <div className="mb-12 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                <span className="text-gray-400 text-sm font-bold tracking-widest">Top rated experiences</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight leading-none">Guest Favorites</h2>
              <p className="mt-4 text-gray-500 font-medium text-lg">The most loved tours by our explorers</p>
            </div>

            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
              {tours.map((tour, index) => (
                <TourCard key={tour.id} tour={tour} index={index} />
              ))}
            </div>
          </section>
        );
    }
  };

  return renderContent();
}
