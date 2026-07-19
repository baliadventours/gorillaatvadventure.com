import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export default function SearchForm() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (keyword.trim()) {
      params.append('search', keyword.trim());
    }
    navigate(`/tours?${params.toString()}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="w-full relative z-40"
    >
      <form onSubmit={handleSearch} className="w-full">
        <div className={cn(
          "bg-white rounded-full p-2 pl-6 shadow-[0_24px_50px_-12px_rgba(0,0,0,0.12)] border transition-all duration-300 flex items-center gap-3",
          isFocused ? "border-primary/40 ring-4 ring-primary/5" : "border-gray-150"
        )}>
          <Search className="h-5 w-5 text-gray-400 shrink-0" />
          <input 
            type="text"
            placeholder="What do you want to experience?"
            value={keyword}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => setKeyword(e.target.value)}
            className="flex-1 bg-transparent border-none py-3 text-sm md:text-base font-semibold text-gray-950 placeholder:text-gray-400 focus:outline-none focus:ring-0"
          />
          <button 
            type="submit"
            className="bg-primary hover:bg-orange-700 text-white font-black py-3 px-6 md:px-8 rounded-full shadow-md shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all duration-200 text-xs md:text-sm uppercase tracking-widest flex items-center gap-2"
          >
            <span>Search</span>
          </button>
        </div>
      </form>
    </motion.div>
  );
}
