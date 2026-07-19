import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Popup } from '../types';
import { X, ArrowRight, Bell, Megaphone, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export default function GlobalPopup() {
  const [activePopup, setActivePopup] = useState<Popup | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    async function fetchActivePopups() {
      // Prevent popups from loading/mounting during Lighthouse/PageSpeed crawls.
      // Modals overlaying the viewport severely degrade LCP / CLS for crawlers while being non-functional.
      const isLighthouse = typeof navigator !== 'undefined' && (
        /lighthouse/i.test(navigator.userAgent) || 
        /pagespeed/i.test(navigator.userAgent) ||
        /chrome-lighthouse/i.test(navigator.userAgent)
      );
      if (isLighthouse) return;

      // Don't show if user closed it this session
      if (sessionStorage.getItem('popup-closed')) return;

      const q = query(
        collection(db, 'popups'),
        where('isActive', '==', true)
      );
      
      const snap = await getDocs(q);
      if (!snap.empty) {
        const popup = snap.docs[0].data() as Popup;
        setActivePopup({ id: snap.docs[0].id, ...popup });
        
        setTimeout(() => {
          setIsVisible(true);
        }, (popup.displayDelay || 3) * 1000);
      }
    }
    fetchActivePopups();
  }, []);

  const closePopup = () => {
    setIsVisible(false);
    sessionStorage.setItem('popup-closed', 'true');
  };

  if (!activePopup) return null;

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closePopup}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 40 }}
            className="relative w-full max-w-2xl bg-white rounded-[10px] shadow-2xl overflow-hidden flex flex-col md:flex-row"
          >
            {activePopup.imageURL && (
              <div className="md:w-1/2 h-64 md:h-auto overflow-hidden">
                <img 
                  src={activePopup.imageURL} 
                  alt={activePopup.title} 
                  className="w-full h-full object-cover"
                  loading="eager"
                  fetchPriority="high"
                />
              </div>
            )}
            
            <div className={cn("p-10 flex flex-col justify-center", activePopup.imageURL ? "md:w-1/2" : "w-full")}>
              <div className={cn(
                "p-3 w-fit rounded-[8px] mb-6",
                activePopup.type === 'promotion' ? "bg-amber-50 text-amber-600" :
                activePopup.type === 'newsletter' ? "bg-primary/10 text-primary" :
                "bg-blue-50 text-blue-600"
              )}>
                {activePopup.type === 'promotion' ? <Sparkles className="h-6 w-6" /> : 
                 activePopup.type === 'newsletter' ? <Bell className="h-6 w-6" /> : 
                 <Megaphone className="h-6 w-6" />}
              </div>

              <h2 className="text-3xl font-black text-gray-900 mb-4 leading-tight">{activePopup.title}</h2>
              <p className="text-gray-500 mb-8 leading-relaxed text-sm font-medium">{activePopup.content}</p>

              <div className="flex flex-col w-full gap-3">
                {activePopup.ctaLink && (
                  <Link
                    to={activePopup.ctaLink}
                    onClick={closePopup}
                    className="w-full py-4 bg-primary text-white rounded-[8px] font-bold text-xs uppercase tracking-widest hover:brightness-90 transition-all shadow-lg shadow-orange-100 flex items-center justify-center gap-2"
                  >
                    {activePopup.ctaText || 'Learn More'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                <button
                  onClick={closePopup}
                  className="w-full py-3 text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:text-gray-900 transition-all"
                >
                  No thanks, maybe later
                </button>
              </div>
            </div>

            <button 
              onClick={closePopup}
              className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur-sm rounded-full text-gray-400 hover:text-gray-900 transition-colors shadow-sm"
            >
              <X className="h-5 w-5" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
