import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useCurrency, SUPPORTED_CURRENCIES } from '../lib/CurrencyContext';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function CurrencySwitcher({ variant = 'default' }: { variant?: 'default' | 'minimal' }) {
  const { selectedCurrency, setCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentCurrency = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency);

  if (variant === 'minimal') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 text-[10px] font-black text-white/80 hover:text-white transition-colors tracking-widest px-2 py-1"
        >
          <Globe className="h-3 w-3 text-primary" />
          {currentCurrency?.code}
          <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", isOpen && "rotate-180")} />
        </button>
        
        <AnimatePresence>
          {isOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute right-0 mt-2 w-48 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-[150] p-1"
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <button
                  key={currency.code}
                  onClick={() => {
                    setCurrency(currency.code);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold transition-all",
                    selectedCurrency === currency.code 
                      ? "bg-primary text-white" 
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <div className="flex flex-col items-start">
                    <span className="uppercase tracking-widest">{currency.code}</span>
                    <span className="text-[8px] opacity-60 font-medium">{currency.name}</span>
                  </div>
                  <span className="font-mono text-xs">{currency.symbol}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-xl hover:bg-gray-100 transition-all active:scale-95"
      >
        <Globe className="h-4 w-4 text-primary" />
        <span className="text-xs font-black text-gray-900">{selectedCurrency}</span>
        <ChevronDown className={cn("h-3 w-3 text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[120] p-2"
          >
            <div className="grid grid-cols-1 gap-1">
              {SUPPORTED_CURRENCIES.map((currency) => (
                <button
                  key={currency.code}
                  onClick={() => {
                    setCurrency(currency.code);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-bold transition-all",
                    selectedCurrency === currency.code 
                      ? "bg-orange-50 text-primary" 
                      : "text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <div className="flex flex-col items-start leading-tight">
                    <span className="font-black text-gray-900 group-hover:text-primary transition-colors">{currency.code}</span>
                    <span className="text-[10px] text-gray-400 font-medium">{currency.name}</span>
                  </div>
                  <span className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center font-mono font-black text-xs text-gray-400">
                    {currency.symbol}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
