import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImageIcon } from 'lucide-react';
import { cn, sanitizeImageUrl } from '../lib/utils';
import { getCloudflareImageUrl, type CloudflareTransformOptions } from '../lib/cloudflare-images';

interface SmartImageProps extends CloudflareTransformOptions {
  src?: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'wide' | 'auto' | 'standard';
  objectFit?: 'cover' | 'contain' | 'fill';
  priority?: boolean;
}

// Global flag to track if Cloudflare transformation is working
let isCloudflareAvailable = true;

const isHighPerformanceCDN = (url: string) => {
  if (!url) return true;
  return (
    url.includes('images.unsplash.com') ||
    url.includes('lh3.googleusercontent.com') ||
    url.includes('googleusercontent.com') ||
    url.startsWith('/') ||
    url.startsWith('data:') ||
    url.startsWith('blob:') ||
    url.includes('localhost') ||
    url.includes('127.0.0.1')
  );
};

const getOptimizedImageUrl = (src: string, width?: number, height?: number, quality = 75) => {
  if (!src) return '';
  const cleanUrl = src.trim();
  
  // If it's an ImgBB url, return the original URL directly to let browser load it with referrerPolicy="no-referrer"
  if (cleanUrl.includes('ibb.co') || cleanUrl.includes('imgbb.com')) {
    return cleanUrl;
  }
  
  // Return early if local asset or high-performance CDN
  if (isHighPerformanceCDN(cleanUrl)) {
    return cleanUrl;
  }

  // Optimize external URLs using high-performance public image proxy
  try {
    let query = `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}`;
    if (width) query += `&w=${width}`;
    if (height) query += `&h=${height}`;
    query += `&q=${quality}&output=auto`; // wsrv.nl dynamically serves WebP or AVIF based on browser accept headers
    return query;
  } catch (e) {
    return cleanUrl;
  }
};

export default function SmartImage({
  src,
  alt,
  className,
  containerClassName,
  aspectRatio = 'standard',
  objectFit = 'cover',
  priority = false,
  ...transformOptions
}: SmartImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const cleanSrc = src ? sanitizeImageUrl(src) : undefined;

  const shouldSkipCloudflare = (url: string) => {
    if (!url) return true;
    return url.includes('ibb.co') || url.includes('imgbb.com');
  };

  // Determine the best source URL to render initially
  const getInitialSrc = () => {
    if (!cleanSrc) return undefined;
    if (useFallback) return cleanSrc;
    
    // Choose a default safe max width depending on aspectRatio if not specified
    const defaultWidth = transformOptions.width || (aspectRatio === 'square' || aspectRatio === 'portrait' ? 480 : 1000);
    const defaultHeight = transformOptions.height;
    
    // First, try high-performance wsrv.nl proxy which works globally and does auto-WebP conversion
    return getOptimizedImageUrl(cleanSrc, defaultWidth, defaultHeight, transformOptions.quality);
  };

  const currentSrc = getInitialSrc();

  // Reset states if the source changes
  useEffect(() => {
    setIsLoaded(false);
    setError(false);
    setUseFallback(false);
  }, [cleanSrc]);

  // Handle cached images and image-load timeout safeties
  useEffect(() => {
    if (!cleanSrc || !currentSrc) return;

    // If already complete (from cache), load instantly to avoid showing skeleton
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoaded(true);
      return;
    }

    // Safety fallback: if proxy doesn't load within 15 seconds (e.g. extremely slow proxy response), trigger fallback to original
    const timer = setTimeout(() => {
      if (!isLoaded && !useFallback && currentSrc !== cleanSrc) {
        setUseFallback(true);
      }
    }, 15000);

    return () => clearTimeout(timer);
  }, [currentSrc, isLoaded, useFallback, cleanSrc]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    if (!useFallback && currentSrc && currentSrc !== cleanSrc) {
      // If our optimized proxy URL failed, fall back to the original source URL
      setUseFallback(true);
    } else {
      setError(true);
    }
  };

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
    wide: 'aspect-[21/9]',
    auto: 'h-full w-full',
    standard: 'aspect-[4/3]'
  };

  if (!cleanSrc) {
    return (
      <div className={cn(
        "relative overflow-hidden bg-gray-100 flex flex-col items-center justify-center text-gray-400 p-4 text-center",
        aspectRatio === 'auto' ? "h-full w-full" : aspectClasses[aspectRatio],
        containerClassName
      )}>
        <ImageIcon className="h-6 w-6 mb-2" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Image Unavailable</span>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative overflow-hidden bg-gray-100",
      aspectRatio === 'auto' ? "h-full w-full" : aspectClasses[aspectRatio],
      containerClassName
    )}>
      {/* 
        We render the img tag directly to let the browser's native preload scanner start loading immediately.
        We layer a loading skeleton on top using absolute positioning, which fades out gracefully once the image is ready.
      */}
      <AnimatePresence>
        {!isLoaded && !error && (
          <motion.div
            key="placeholder"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100"
          >
            <div className="w-full h-full animate-pulse bg-gray-200 flex items-center justify-center">
              <ImageIcon className="h-8 w-8 text-gray-300 animate-pulse" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 text-gray-400 p-4 text-center">
          <ImageIcon className="h-6 w-6 mb-2" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Image Unavailable</span>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "w-full h-full transition-opacity duration-300",
            objectFit === 'cover' ? "object-cover" : objectFit === 'contain' ? "object-contain" : "object-fill",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "low"}
          decoding="async"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
