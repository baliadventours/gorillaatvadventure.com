import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { cn, getSafeImageUrl } from '../../lib/utils';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Category } from '../../types';

interface MobileHomeHeaderProps {
  onCategoryChange?: (categoryId: string) => void;
  selectedCategoryId?: string;
}

export default function MobileHomeHeader({ onCategoryChange, selectedCategoryId = 'all' }: MobileHomeHeaderProps) {
  const [categories, setCategories] = useState<Category[]>(() => {
    if (typeof window !== 'undefined' && (window as any).__PRELOADED_DATA__?.categories) {
      return (window as any).__PRELOADED_DATA__.categories;
    }
    return [];
  });
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;
    navigate(`/tours?search=${encodeURIComponent(searchTerm)}`);
  };

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      setCategories(cats);
    });
    return unsubscribe;
  }, []);

  const IconDisplay = ({ icon, isActive }: { icon?: string, isActive: boolean }) => {
    if (!icon) return <LucideIcons.LayoutGrid className={cn("h-6 w-6", isActive && "fill-primary/20")} />;
    
    if (icon.startsWith('http')) {
      return (
        <div className="h-6 w-6 relative">
          <img src={getSafeImageUrl(icon)} className="h-full w-full object-contain" referrerPolicy="no-referrer" />
          {isActive && <div className="absolute inset-0 bg-primary/20 rounded-full blur-[4px]" />}
        </div>
      );
    }
    
    const IconComponent = (LucideIcons as any)[icon] || LucideIcons.LayoutGrid;
    return <IconComponent className={cn("h-6 w-6", isActive && "fill-primary/20")} />;
  };

  return (
    <div className="md:hidden bg-white px-4 pb-6 pt-2">
      {/* Search Input */}
      <form onSubmit={handleSearch} className="relative mb-6">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
          <LucideIcons.Search className="h-5 w-5" />
        </div>
        <input 
          type="text" 
          placeholder="Where to go?"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-gray-50 border-none rounded-2xl py-4 pl-12 pr-12 text-sm font-bold placeholder:text-gray-400 focus:ring-1 focus:ring-primary/20 transition-all"
        />
        <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-primary">
          <div className="p-1.5 bg-gray-100 rounded-lg active:scale-95 transition-transform">
            <LucideIcons.SlidersHorizontal className="h-4 w-4" />
          </div>
        </button>
      </form>

      {/* Categories Horizontal Scroll */}
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar -mx-4 px-4">
        {categories.length === 0 ? (
          // Skeleton for categories
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 min-w-[72px] shrink-0 animate-pulse">
              <div className="p-3 rounded-2xl bg-gray-100 h-12 w-12" />
              <div className="h-2 bg-gray-100 rounded-full w-8" />
            </div>
          ))
        ) : (
          <>
            <button 
              onClick={() => onCategoryChange?.('all')}
              className={cn(
                "flex flex-col items-center gap-2 min-w-[72px] shrink-0",
                selectedCategoryId === 'all' ? "text-primary" : "text-gray-400"
              )}
            >
              <div className={cn(
                "p-3 rounded-2xl transition-all",
                selectedCategoryId === 'all' ? "bg-primary/5 scale-110" : "bg-transparent"
              )}>
                <LucideIcons.Compass className={cn("h-6 w-6", selectedCategoryId === 'all' && "fill-primary/20")} />
              </div>
              <span className={cn(
                "text-[10px] font-black tracking-widest uppercase",
                selectedCategoryId === 'all' ? "text-primary" : "text-gray-400"
              )}>
                ALL
              </span>
              {selectedCategoryId === 'all' && (
                <div className="w-1.5 h-1.5 bg-primary rounded-full mt-[-4px]" />
              )}
            </button>

            {categories.map((cat) => {
              const isActive = selectedCategoryId === cat.id;
              return (
                <button 
                  key={cat.id}
                  onClick={() => onCategoryChange?.(cat.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 min-w-[72px] shrink-0",
                    isActive ? "text-primary" : "text-gray-400"
                  )}
                >
                  <div className={cn(
                    "p-3 rounded-2xl transition-all",
                    isActive ? "bg-primary/5 scale-110" : "bg-transparent"
                  )}>
                    <IconDisplay icon={cat.icon} isActive={isActive} />
                  </div>
                  <span className={cn(
                    "text-[10px] font-black tracking-widest uppercase",
                    isActive ? "text-primary" : "text-gray-400"
                  )}>
                    {cat.name}
                  </span>
                  {isActive && (
                    <div className="w-1.5 h-1.5 bg-primary rounded-full mt-[-4px]" />
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
