import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Heart, 
  MapPin, 
  Clock, 
  Star, 
  ArrowRight,
  ChevronRight,
  TrendingUp,
  X
} from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Tour, UserProfile } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export default function Wishlist() {
  const { user, profile } = useOutletContext<{ user: any; profile: UserProfile }>();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTours() {
      if (!profile?.wishlist || profile.wishlist.length === 0) {
        setLoading(false);
        return;
      }

      // Firestore "in" query limits to 10 items. For simple app, it's okay.
      const q = query(
        collection(db, 'tours'),
        where('id', 'in', profile.wishlist.slice(0, 10))
      );

      const snap = await getDocs(q);
      setTours(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tour)));
      setLoading(false);
    }
    fetchTours();
  }, [profile]);

  const removeFromWishlist = async (tourId: string) => {
    if (!user) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        wishlist: arrayRemove(tourId)
      });
      setTours(tours.filter(t => t.id !== tourId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">My Wishlist</h1>
        <p className="text-gray-500">Save your favorite experiences for later</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-80 bg-white rounded-[24px] border border-gray-100 animate-pulse" />
          ))
        ) : tours.length > 0 ? (
          tours.map((tour, i) => (
            <motion.div
              key={tour.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-[24px] border border-gray-100 overflow-hidden hover:shadow-md transition-shadow group flex flex-col"
            >
              <div className="relative h-56 overflow-hidden">
                <img 
                  src={tour.featuredImage || 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=800'} 
                  alt={tour.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute top-4 right-4">
                  <button 
                    onClick={() => removeFromWishlist(tour.id)}
                    className="p-2.5 bg-white border border-gray-100 rounded-full text-red-500 shadow-sm hover:bg-red-50 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {tour.isPopular && (
                  <div className="absolute top-4 left-4">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-bold text-primary shadow-sm">
                      <TrendingUp className="h-3 w-3" />
                      Popular
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                    <MapPin className="h-3 w-3" />
                    {tour.location}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                    <span className="text-xs font-bold text-gray-900">{tour.rating || '4.9'}</span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-4 group-hover:text-[#00A651] transition-colors line-clamp-1">{tour.title}</h3>

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                    <Clock className="h-3.5 w-3.5" />
                    {tour.duration}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                    <TrendingUp className="h-3.5 w-3.5 text-[#00A651]" />
                    Best Price
                  </div>
                </div>

                <div className="mt-auto pt-6 border-t border-gray-50 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 leading-none mb-1">From</p>
                    <p className="text-xl font-black text-gray-900 leading-none">${tour.regularPrice}</p>
                  </div>
                  <Link 
                    to={`/tour/${tour.slug}`}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-[12px] text-xs font-bold hover:bg-[#00A651] transition-all"
                  >
                    View tour
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-[24px] border border-gray-100">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="h-10 w-10 text-gray-200" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Your wishlist is empty</h3>
            <p className="text-gray-500 mb-8 max-w-xs mx-auto">Explore our tours and click the heart icon to save the experiences you love most.</p>
            <Link 
              to="/tours" 
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#00A651] text-white rounded-[12px] font-bold text-sm hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
            >
              Explore tours <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
