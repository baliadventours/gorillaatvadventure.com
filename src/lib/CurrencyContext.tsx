import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
];

interface CurrencyContextType {
  selectedCurrency: string;
  setCurrency: (code: string) => void;
  rates: Record<string, number>;
  convert: (amount: number, from?: string) => number;
  formatPrice: (amount: number, from?: string) => string;
  isLoading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrency] = useState(() => {
    return localStorage.getItem('preferred_currency') || 'USD';
  });
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRates = async (force = false) => {
      try {
        const cached = localStorage.getItem('currency_rates_cache');
        if (cached && !force) {
          const { rates: cachedRates, timestamp } = JSON.parse(cached);
          // 24 hour cache
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            setRates(cachedRates);
            setIsLoading(false);
            return;
          }
        }

        setIsLoading(true);
        const apiKey = import.meta.env.VITE_CURRENCY_API_KEY || '627b0b6c69788a442750e7f7';
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`);
        const data = await response.json();
        
        if (data.result === 'success') {
          setRates(data.conversion_rates);
          localStorage.setItem('currency_rates_cache', JSON.stringify({
            rates: data.conversion_rates,
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Failed to fetch currency rates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRates();
  }, []);

  const setCurrency = (code: string) => {
    setSelectedCurrency(code);
    localStorage.setItem('preferred_currency', code);
  };

  const convert = (amount: number, from: string = 'USD') => {
    if (from === selectedCurrency) return amount;
    // Base everything on USD
    const amountInUSD = from === 'USD' ? amount : amount / (rates[from] || 1);
    return amountInUSD * (rates[selectedCurrency] || 1);
  };

  const formatPrice = (amount: number, from: string = 'USD') => {
    const converted = convert(amount, from);
    const currencyInfo = SUPPORTED_CURRENCIES.find(c => c.code === selectedCurrency);
    const symbol = currencyInfo?.symbol || '$';
    
    return `${symbol}${converted.toLocaleString(undefined, {
      minimumFractionDigits: selectedCurrency === 'IDR' ? 0 : 2,
      maximumFractionDigits: selectedCurrency === 'IDR' ? 0 : 2,
    })}`;
  };

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setCurrency, rates, convert, formatPrice, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
