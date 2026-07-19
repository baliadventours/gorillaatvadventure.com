import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Star, Clock, Globe, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '../lib/utils';
import FormattedPrice from './FormattedPrice';
import { Tour } from '../types';
import { motion } from 'motion/react';
import { db } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useSettings } from '../lib/SettingsContext';
import { useAuth } from '../lib/AuthContext';

import SmartImage from './SmartImage';

interface TourCardProps {
  tour: Tour;
  index?: number;
  viewMode?: 'grid' | 'list';
  variant?: 'default' | 'minimal' | 'modern' | 'premium';
}

export default function TourCard({ tour, index = 0, viewMode = 'grid', variant = 'default' }: TourCardProps) {
  const { labels } = useSettings();
  const { user, profile, wishlist } = useAuth();
  const navigate = useNavigate();
  
  const isWishlisted = wishlist.includes(tour.id);
  const agentDiscount = profile?.role === 'agent' ? (profile.discountRate || 0) : 0;

  const basePrice = tour.discountPrice || tour.regularPrice;
  const agentPrice = agentDiscount > 0 ? basePrice * (1 - agentDiscount / 100) : null;

  const hasDiscount = tour.regularPrice && tour.discountPrice && (tour.regularPrice > tour.discountPrice);
  const discountPercent = hasDiscount ? Math.round(((tour.regularPrice - tour.discountPrice || 0) / (tour.regularPrice || 1)) * 105) : 0;

  // Filter labels for this tour
  const imageLabel = labels.find(l => l.id === tour.imageLabelId);
  const belowTitleLabel = labels.find(l => l.id === tour.belowTitleLabelId);
  const priceLabel = labels.find(l => l.id === tour.priceLabelId);

  const toggleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      navigate('/login');
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    try {
      if (isWishlisted) {
        await updateDoc(userRef, {
          wishlist: arrayRemove(tour.id)
        });
      } else {
        await updateDoc(userRef, {
          wishlist: arrayUnion(tour.id)
        });
      }
    } catch (err) {
      console.error("Error updating wishlist:", err);
    }
  };

  if (variant === 'minimal') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="group"
      >
        <Link to={`/tour/${tour.slug || tour.id}`} className="block">
          <div className="relative aspect-square overflow-hidden rounded-xl mb-3">
             <SmartImage 
               src={tour.featuredImage || tour.gallery?.[0]} 
               alt={tour.title}
               className="group-hover:scale-110 transition-transform duration-700"
               aspectRatio="square"
             />
             <button onClick={toggleWishlist} className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors">
                <Heart className={cn("h-5 w-5", isWishlisted && "fill-rose-500 text-rose-500")} />
             </button>
          </div>
          <div className="flex justify-between items-start">
             <div>
                <h4 className="font-bold text-gray-900 group-hover:underline line-clamp-1 text-sm">{tour.title}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{tour.duration}</p>
             </div>
             <p className="font-bold text-gray-900 text-sm"><FormattedPrice amount={tour.discountPrice || tour.regularPrice} /></p>
          </div>
        </Link>
      </motion.div>
    );
  }

  if (variant === 'modern') {
     return (
       <motion.div
         initial={{ opacity: 0, y: 30 }}
         whileInView={{ opacity: 1, y: 0 }}
         viewport={{ once: true }}
         className="group relative bg-white rounded-xl p-3 shadow-sm hover:shadow-xl transition-all border border-gray-100"
       >
          <Link to={`/tour/${tour.slug || tour.id}`} className="block">
             <div className="relative aspect-[4/3] rounded-lg overflow-hidden mb-4">
                <SmartImage 
                  src={tour.featuredImage || tour.gallery?.[0]} 
                  alt={tour.title}
                  className="group-hover:scale-105 transition-all"
                />
                <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm px-2 py-1 rounded-lg text-[9px] font-black uppercase text-gray-900 flex items-center gap-1 border border-gray-100">
                   <Clock className="h-3 w-3" /> {tour.duration}
                </div>
                <div className="absolute bottom-3 right-3 bg-gray-950 text-white px-3 py-1.5 rounded-lg font-black text-xs">
                   <FormattedPrice amount={tour.discountPrice || tour.regularPrice} />
                </div>
             </div>
             <div className="px-1 pb-2">
                <h4 className="text-base font-black text-gray-900 line-clamp-1 group-hover:text-primary transition-colors">{tour.title}</h4>
                <div className="flex items-center gap-1 text-amber-400 mt-1">
                   {[1,2,3,4,5].map(s => <Star key={s} className="h-2.5 w-2.5 fill-current" />)}
                   <span className="text-[10px] font-bold text-gray-550 ml-1">4.9 (120 reviews)</span>
                </div>
             </div>
          </Link>
       </motion.div>
     );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "50px" }}
      transition={{ duration: 0.4, delay: Math.min(index * 0.05, 0.3), ease: "easeOut" }}
    >
      <div className="group relative bg-transparent">
        <Link 
          to={`/tour/${tour.slug || tour.id}`}
          className={cn(
            "block",
            viewMode === 'list' && "flex flex-col md:flex-row gap-6 md:items-center"
          )}
        >
          {/* Image Container with cleaner less-rounded limits */}
          <div className={cn(
            "relative overflow-hidden rounded-xl",
            viewMode === 'grid' ? "mb-4" : "md:w-72 shrink-0"
          )}>
            <SmartImage 
              src={tour.featuredImage || tour.gallery?.[0] || "https://picsum.photos/seed/placeholder/800/600"} 
              alt={tour.title} 
              className="group-hover:scale-105"
              aspectRatio={viewMode === 'grid' ? "standard" : "video"}
              containerClassName="rounded-xl"
              width={viewMode === 'grid' ? 600 : 400}
              priority={index < 4}
            />
            
            {/* Top Right Wishlist Button */}
            <button 
              onClick={toggleWishlist}
              className={cn(
                "absolute top-3 right-3 p-2 rounded-lg backdrop-blur-md transition-all z-10",
                isWishlisted 
                  ? "bg-white text-rose-500 shadow-lg" 
                  : "bg-white/85 text-gray-500 hover:bg-white hover:text-rose-500"
              )}
            >
              <Heart className={cn("h-4 w-4", isWishlisted && "fill-current")} />
            </button>

            {/* Smart Overlay Badges: top-left corner */}
            <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5 z-10 pointer-events-none">
              {imageLabel ? (
                <div 
                  className="rounded-md backdrop-blur-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white border border-white/20 shadow-sm"
                  style={{ 
                    backgroundColor: `${imageLabel.color}D9` || 'rgba(16, 185, 129, 0.85)',
                  }}
                >
                  {imageLabel.name}
                </div>
              ) : tour.isPopular && (
                <div className="rounded-md bg-primary/90 backdrop-blur-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white border border-orange-500/20 shadow-sm">
                  Best Seller
                </div>
              )}
              {priceLabel && (
                <div 
                  className="rounded-md backdrop-blur-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white border border-white/20 shadow-sm"
                  style={{ 
                    backgroundColor: `${priceLabel.color}D9` || 'rgba(59, 130, 246, 0.85)',
                  }}
                >
                  {priceLabel.name}
                </div>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className={cn(
            "space-y-2.5 flex-1",
            viewMode === 'list' && "py-2"
          )}>
            <div className="w-full space-y-1">
              <h3 className={cn(
                "font-black text-gray-900 leading-snug group-hover:text-primary transition-colors",
                viewMode === 'grid' ? "text-base line-clamp-2" : "text-lg line-clamp-1"
              )}>
                {tour.title}
              </h3>
              {belowTitleLabel && (
                <div 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[8.5px] font-black uppercase tracking-wider"
                  style={{ 
                    color: belowTitleLabel.color || '#059669',
                    backgroundColor: `${belowTitleLabel.color}0D`,
                    borderColor: `${belowTitleLabel.color}25`
                  }}
                >
                  <span>{belowTitleLabel.name}</span>
                </div>
              )}
            </div>

            {viewMode === 'list' && tour.description && (
              <p className="text-gray-500 text-xs font-medium line-clamp-2 pr-8">{tour.description}</p>
            )}
            
            {/* Meta Info Icons */}
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-gray-550 font-bold">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                <span>{tour.duration}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                <span>English</span>
              </div>
            </div>
            
            {/* Pricing and Sub-Action Column */}
            <div className={cn(
              "flex items-center justify-between gap-1.5 pt-2 border-t border-gray-100",
              viewMode === 'list' ? "pt-3.5" : "pt-2"
            )}>
              <div className="flex flex-col min-w-0">
                <div className="flex items-baseline gap-1 flex-wrap">
                  <span className={cn(
                    "font-black tracking-tight text-gray-900 shrink-0",
                    viewMode === 'list' ? "text-xl" : "text-base sm:text-lg",
                    agentPrice ? "text-primary" : "text-gray-900"
                  )}>
                    <FormattedPrice amount={agentPrice || basePrice} />
                  </span>
                  <span className="text-[9px] font-bold text-gray-500 shrink-0">/person</span>
                </div>
                {agentPrice ? (
                   <div className="flex items-center gap-1 flex-wrap mt-0.5 min-w-0">
                      <span className="text-[8px] font-black text-primary bg-orange-50 px-1 py-0.5 rounded uppercase tracking-tighter truncate">Agent</span>
                      <span className="text-[10px] font-bold text-gray-500 line-through truncate">
                        <FormattedPrice amount={basePrice} />
                      </span>
                   </div>
                ) : tour.regularPrice && tour.discountPrice && (tour.regularPrice > tour.discountPrice) ? (
                  <div className="flex items-center gap-1 flex-wrap mt-0.5 min-w-0">
                    <span className="text-xs font-bold text-gray-500 line-through truncate">
                      <FormattedPrice amount={tour.regularPrice} />
                    </span>
                    <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded tracking-tighter shrink-0 select-none">
                      Save {discountPercent}%
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Star Rating and Review Count replacing the Explore button */}
              <div className="flex items-center gap-1 bg-amber-500/5 group-hover:bg-amber-500/10 border border-amber-500/10 px-2.5 py-1.5 rounded-lg text-xs select-none shrink-0 transition-colors">
                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                <span className="font-black text-gray-900 text-[11.5px] leading-none">{tour.rating ? tour.rating.toFixed(1) : '4.9'}</span>
                <span className="text-[10px] font-bold text-gray-500 leading-none">({tour.reviewsCount || 120})</span>
              </div>
            </div>
          </div>
        </Link>
      </div>
    </motion.div>
  );
}

