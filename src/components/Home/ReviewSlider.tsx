import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Review } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Quote, Star, ChevronLeft, ChevronRight } from 'lucide-react';

import { useSettings } from '../../lib/SettingsContext';

export default function ReviewSlider() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const { settings } = useSettings();

  const themeMode = settings?.themeMode || 'default';
  const styleId = themeMode === 'custom' ? settings?.sectionStyles?.reviews : 'default';

  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('status', '==', 'approved')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Review));
      const sorted = data
        .sort((a: any, b: any) => {
          const timeA = a.createdAt?.seconds 
            ? a.createdAt.seconds * 1000 + (a.createdAt.nanoseconds || 0) / 1000000
            : (a.createdAt instanceof Date ? a.createdAt.getTime() : typeof a.createdAt === 'number' ? a.createdAt : 0);
          const timeB = b.createdAt?.seconds 
            ? b.createdAt.seconds * 1000 + (b.createdAt.nanoseconds || 0) / 1000000
            : (b.createdAt instanceof Date ? b.createdAt.getTime() : typeof b.createdAt === 'number' ? b.createdAt : 0);
          return timeB - timeA;
        })
        .slice(0, 3);
      setReviews(sorted);
    });
    return unsubscribe;
  }, []);

  const renderContent = () => {
    switch (styleId) {
      case 'airbnb-classic':
      case 'airbnb-fluid':
        return (
          <section className="container mx-auto px-4 py-20 lg:px-8 bg-[#f7f7f7] rounded-3xl my-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-12 flex items-center gap-2">
               <Star className="h-6 w-6 text-primary fill-primary" />
               4.9 · 500+ reviews
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
               {reviews.map(review => (
                  <div key={review.id} className="space-y-4">
                     <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-200">
                           <img src={review.userPhoto || `https://i.pravatar.cc/100?u=${review.id}`} alt={review.userName} />
                        </div>
                        <div>
                           <h4 className="font-bold text-gray-900">{review.userName}</h4>
                           <p className="text-sm text-gray-500">{review.nationality || 'Verified traveler'}</p>
                        </div>
                     </div>
                     <p className="text-gray-900 leading-relaxed line-clamp-4">"{review.comment}"</p>
                  </div>
               ))}
            </div>
          </section>
        );

      case 'modern-dark':
      case 'modern-glass':
        return (
          <section className="py-24 bg-gray-950 overflow-hidden relative">
             <div className="container mx-auto px-4 lg:px-8 relative z-10 text-center">
                <span className="text-orange-400 font-black text-[10px] uppercase tracking-[0.3em] mb-4 block">Testimonials</span>
                <h2 className="text-4xl md:text-7xl font-black text-white tracking-tighter mb-16">Real Stories · Real Alpha</h2>
                <div className="grid md:grid-cols-3 gap-6">
                   {reviews.map(review => (
                      <div key={review.id} className="bg-white/5 backdrop-blur-md p-10 rounded-[3rem] border border-white/10 text-left hover:bg-white/10 transition-colors">
                         <Quote className="h-8 w-8 text-orange-400 mb-6" />
                         <p className="text-white font-medium text-lg mb-8 leading-relaxed italic">"{review.comment}"</p>
                         <div className="flex items-center gap-4">
                            <img src={review.userPhoto || 'https://i.pravatar.cc/100'} className="h-10 w-10 rounded-full border-2 border-orange-400" alt={review.userName} />
                            <div>
                               <h4 className="text-white font-black text-xs uppercase tracking-widest">{review.userName}</h4>
                               <p className="text-gray-500 text-[10px] uppercase font-bold">{review.nationality}</p>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </section>
        );

      case 'minimal-grid':
      case 'minimal-type':
        return (
          <section className="container mx-auto px-4 py-24 border-b border-gray-100">
             <div className="flex flex-col items-center mb-20">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-300 mb-4">Archives / Feedback</span>
                <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter italic">The Dialog</h2>
             </div>
             <div className="grid md:grid-cols-2 gap-px bg-gray-100 border border-gray-100">
                {reviews.slice(0, 4).map(review => (
                   <div key={review.id} className="bg-white p-16 flex flex-col justify-center">
                      <p className="text-2xl font-bold text-gray-900 mb-8 leading-tight">"{review.comment}"</p>
                      <div className="flex items-center justify-between">
                         <span className="text-[10px] font-black uppercase text-gray-900 tracking-widest">{review.userName}</span>
                         <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">{review.nationality}</span>
                      </div>
                   </div>
                ))}
             </div>
          </section>
        );

      case 'premium-serif':
      case 'premium-full':
        return (
          <section className="py-32 bg-[#1a1a1a]">
             <div className="container mx-auto px-4 text-center">
                <div className="max-w-4xl mx-auto">
                   <Quote className="h-12 w-12 text-amber-500/20 mx-auto mb-12" />
                   <div className="grid gap-20">
                      {reviews.slice(0, 1).map(review => (
                         <div key={review.id} className="space-y-12">
                            <h3 className="text-3xl md:text-5xl font-serif text-white italic leading-relaxed">"{review.comment}"</h3>
                            <div className="flex flex-col items-center gap-4">
                               <div className="h-16 w-16 rounded-full border border-amber-500/30 p-1">
                                  <img src={review.userPhoto || 'https://i.pravatar.cc/100'} className="h-full w-full rounded-full object-cover grayscale" alt={review.userName} />
                               </div>
                               <div>
                                  <h4 className="text-white text-xs font-black uppercase tracking-[0.3em]">{review.userName}</h4>
                                  <p className="text-amber-500 text-[10px] uppercase font-bold italic mt-2">{review.nationality}</p>
                               </div>
                            </div>
                         </div>
                      ))}
                   </div>
                </div>
             </div>
          </section>
        );

      case 'saas-clean':
      case 'saas-dash':
        return (
          <section className="py-24 container mx-auto px-4">
             <div className="grid lg:grid-cols-3 gap-8">
                <div className="bg-primary p-12 rounded-[3rem] text-white flex flex-col justify-center">
                   <h2 className="text-4xl font-black tracking-tight leading-none mb-6">User <br /> Sentiment</h2>
                   <p className="text-white/70 font-medium mb-8">Metrics that matter. See why our confirmation engine is the industry standard.</p>
                   <div className="flex gap-1 text-amber-300">
                      {[1,2,3,4,5].map(s => <Star key={s} className="h-5 w-5 fill-amber-300" />)}
                   </div>
                </div>
                {reviews.slice(0, 2).map(review => (
                   <div key={review.id} className="bg-white border border-gray-100 p-12 rounded-[3rem] shadow-sm flex flex-col justify-between">
                      <p className="text-xl font-bold text-gray-900 mb-10 leading-relaxed italic">"{review.comment}"</p>
                      <div className="flex items-center gap-4">
                         <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center text-primary font-black">
                            {review.userName?.charAt(0)}
                         </div>
                         <div>
                            <h4 className="font-bold text-gray-900">{review.userName}</h4>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{review.nationality}</p>
                         </div>
                      </div>
                   </div>
                ))}
             </div>
          </section>
        );

      default:
        return (
          <section className="container mx-auto px-4 py-20 lg:px-8">
            <div className="mb-12 text-center">
              <span className="text-primary text-xs font-black mb-4 block">What they say</span>
              <h2 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight leading-none">Guest Reviews</h2>
            </div>
  
            <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
              {reviews.map((review) => (
                <div key={review.id} className="bg-gray-950 rounded-2xl p-8 relative overflow-hidden shadow-2xl flex flex-col justify-between group hover:-translate-y-1 transition-transform">
                  <div className="absolute top-0 right-0 p-6 opacity-5">
                    <Quote className="h-16 w-16 text-white" />
                  </div>
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-1 mb-6">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={`h-3 w-3 ${i < (review.rating || 5) ? 'text-amber-400 fill-amber-400' : 'text-gray-800'}`} 
                        />
                      ))}
                    </div>
  
                    <p className="text-base text-white/90 leading-relaxed mb-8 line-clamp-4">
                      "{review.comment}"
                    </p>
                  </div>
  
                  <div className="flex items-center gap-4 pt-6 border-t border-white/5">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-black text-sm border border-primary/20 overflow-hidden shrink-0">
                      {review.userPhoto ? (
                        <img src={review.userPhoto} className="w-full h-full object-cover" />
                      ) : (
                        review.userName?.charAt(0) || 'U'
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-white font-black text-sm tracking-wider truncate">{review.userName}</h4>
                      <p className="text-gray-500 font-bold text-[10px] tracking-widest truncate">{review.nationality || 'Verified traveler'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
    }
  };

  return renderContent();
}

