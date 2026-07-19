import React, { Suspense, useState, useEffect, useRef } from 'react';

interface LazySectionProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  threshold?: number;
  rootMargin?: string;
}

export default function LazySection({ 
  children, 
  fallback = <div className="h-40 animate-pulse bg-gray-50 rounded-3xl" />,
  threshold = 0.1,
  rootMargin = '200px'
}: LazySectionProps) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, [threshold, rootMargin]);

  return (
    <div ref={sectionRef} className="min-h-[1px]">
      {isVisible ? (
        <Suspense fallback={fallback}>
          {children}
        </Suspense>
      ) : fallback}
    </div>
  );
}
