import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import SmartImage from '../SmartImage';

interface TourGalleryProps {
  images: string[];
}

export default function TourGallery({ images }: TourGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFullGallery, setShowFullGallery] = useState(false);

  // Swipe gesture coordinates for mobile viewports
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  if (!images || images.length === 0) {
    return (
      <div className="aspect-video w-full animate-pulse rounded-[10px] bg-gray-200" />
    );
  }

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  // Keyboard navigation shortcuts
  useEffect(() => {
    if (!showFullGallery) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        setShowFullGallery(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFullGallery, images.length]);

  // Touch Swipe navigation handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  return (
    <div className="space-y-6">
      {/* Mobile Version: Clean Hero Style Slider */}
      <div className="md:hidden -mx-6">
        <div className="relative h-[50vh] md:h-[85vh] w-full overflow-hidden shadow-2xl group">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="h-full w-full"
            >
              <div 
                onClick={() => setShowFullGallery(true)}
                className="h-full w-full cursor-pointer"
              >
                <SmartImage
                  src={images[currentIndex]}
                  alt={`Gallery ${currentIndex}`}
                  aspectRatio="auto"
                  className="h-full w-full object-cover"
                  containerClassName="h-full w-full"
                  priority={currentIndex === 0}
                />
              </div>
            </motion.div>
          </AnimatePresence>
          
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
          
          {/* Progress Indicators */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {images.map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/40"
                )}
              />
            ))}
          </div>

          <button 
            onClick={() => setShowFullGallery(true)}
            className="absolute top-4 right-14 h-10 w-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white z-20 active:scale-90 transition-all border border-white/10"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Desktop Version: Bento Style Grid */}
      <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-1 h-[600px]">
        {/* Main Big Image */}
        <div 
          className="col-span-2 row-span-2 relative overflow-hidden rounded-[10px] group cursor-pointer shadow-sm hover:shadow-xl transition-all duration-500" 
          onClick={() => {
            setCurrentIndex(0);
            setShowFullGallery(true);
          }}
        >
          <SmartImage 
            src={images[0]} 
            alt="Main" 
            className="group-hover:scale-110 duration-1000 ease-out"
            containerClassName="h-full w-full"
            aspectRatio="auto"
            priority
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-700" />
          <div className="absolute bottom-6 left-6 opacity-0 group-hover:opacity-100 transition-all transform translate-y-4 group-hover:translate-y-0">
             <span className="bg-white/90 backdrop-blur-md text-gray-900 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl">
               View Gallery
             </span>
          </div>
        </div>

        {/* Small Images Grid */}
        {[1, 2, 3].map((idx) => (
          <div 
            key={idx}
            className="col-span-1 row-span-1 relative overflow-hidden rounded-[10px] group cursor-pointer shadow-sm hover:shadow-lg transition-all duration-500" 
            onClick={() => {
              setCurrentIndex(idx);
              setShowFullGallery(true);
            }}
          >
            {images[idx] ? (
              <>
                <SmartImage 
                  src={images[idx]} 
                  alt={`Gallery ${idx}`} 
                  containerClassName="h-full w-full" 
                  aspectRatio="auto" 
                  className="group-hover:scale-110 duration-1000 ease-out" 
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-700" />
              </>
            ) : (
              <div className="h-full w-full bg-gray-50 flex items-center justify-center border-2 border-dashed border-gray-100">
                <Maximize2 className="h-6 w-6 text-gray-200" />
              </div>
            )}
          </div>
        ))}

        {/* 5th Slot with "+X More" or Placeholder */}
        <div 
          className="col-span-1 row-span-1 relative overflow-hidden rounded-[10px] group cursor-pointer shadow-sm"
          onClick={() => {
            setCurrentIndex(images.length >= 5 ? 4 : images.length - 1);
            setShowFullGallery(true);
          }}
        >
          {images.length >= 5 ? (
            <>
              <SmartImage 
                src={images[4]} 
                alt="More" 
                containerClassName="h-full w-full"
                aspectRatio="auto"
                className="group-hover:scale-110 duration-1000 ease-out"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 group-hover:bg-black/70 transition-all duration-500 backdrop-blur-[2px] group-hover:backdrop-blur-none">
                <span className="text-4xl font-black text-white transform group-hover:scale-110 transition-transform duration-500">+{images.length - 4}</span>
                <span className="text-[10px] font-black text-white uppercase tracking-[0.3em] mt-2 opacity-90">Photos</span>
              </div>
            </>
          ) : images[4] ? (
            <>
              <SmartImage 
                src={images[4]} 
                alt="Gallery 4" 
                containerClassName="h-full w-full" 
                aspectRatio="auto" 
                className="group-hover:scale-110 duration-1000 ease-out" 
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-700" />
            </>
          ) : (
            <div className="h-full w-full bg-orange-50/30 flex flex-col items-center justify-center border-2 border-dashed border-orange-100/50 group-hover:bg-orange-50 transition-colors">
              <Plus className="h-6 w-6 text-orange-200 group-hover:text-orange-400 transition-colors" />
              <span className="text-[8px] font-black text-orange-300 uppercase tracking-widest mt-2">More Photos</span>
            </div>
          )}
        </div>
      </div>

      {/* Full Gallery Lightbox Overlays with Thumbnail Bars */}
      <AnimatePresence>
        {showFullGallery && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col bg-black/95 select-none"
          >
            {/* Top Toolbar overlay */}
            <div className="flex justify-between items-center px-4 py-3 md:px-6 md:py-4 bg-gradient-to-b from-black/60 to-transparent z-10">
              <span className="text-sm font-semibold text-gray-300 font-mono">
                {currentIndex + 1} / {images.length}
              </span>
              <button 
                onClick={() => setShowFullGallery(false)} 
                className="h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 hover:scale-105 active:scale-95 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Active Display Stage Area */}
            <div 
              className="flex-1 relative flex items-center justify-center min-h-0 w-full px-4 md:px-14"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {/* Previous Image Chevron */}
              <button 
                onClick={handlePrev}
                className="absolute left-6 top-1/2 -translate-y-1/2 hidden md:flex h-12 w-12 rounded-full bg-black/50 hover:bg-black/80 text-white items-center justify-center border border-white/10 shadow-lg hover:scale-110 active:scale-95 transition-all z-20 group"
              >
                <ChevronLeft className="h-6 w-6 text-gray-400 group-hover:text-white transition-colors" />
              </button>

              {/* Central Dynamic Image Display Frame */}
              <div className="w-full h-full flex items-center justify-center max-h-[60vh] md:max-h-[68vh]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="max-w-full max-h-full rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center bg-gray-900"
                  >
                    <SmartImage
                      src={images[currentIndex]}
                      alt={`Lightbox Gallery ${currentIndex}`}
                      aspectRatio="auto"
                      className="max-w-full max-h-[60vh] md:max-h-[68vh] object-contain"
                      containerClassName="max-w-full max-h-[60vh] md:max-h-[68vh]"
                      priority
                    />
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Next Image Chevron */}
              <button 
                onClick={handleNext}
                className="absolute right-6 top-1/2 -translate-y-1/2 hidden md:flex h-12 w-12 rounded-full bg-black/50 hover:bg-black/80 text-white items-center justify-center border border-white/10 shadow-lg hover:scale-110 active:scale-95 transition-all z-20 group"
              >
                <ChevronRight className="h-6 w-6 text-gray-400 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Bottom horizontal thumbnail track panel */}
            <div className="bg-gradient-to-t from-black/80 to-transparent pt-4 pb-6 px-4 md:pb-8 flex flex-col items-center gap-2">
              <div className="w-full max-w-4xl overflow-x-auto scrollbar-none">
                <div className="flex gap-2 justify-start md:justify-center px-4 py-2 min-w-max">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentIndex(idx)}
                      className={cn(
                        "relative h-14 w-20 md:h-16 md:w-24 shrink-0 rounded-lg overflow-hidden border-2 transition-all duration-300",
                        idx === currentIndex 
                          ? "border-orange-500 scale-105 opacity-100 ring-2 ring-orange-500/20 shadow-lg" 
                          : "border-transparent opacity-40 hover:opacity-80 scale-100"
                      )}
                    >
                      <SmartImage
                        src={img}
                        alt={`Thumbnail ${idx}`}
                        aspectRatio="auto"
                        className="h-full w-full object-cover"
                        containerClassName="h-full w-full"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
