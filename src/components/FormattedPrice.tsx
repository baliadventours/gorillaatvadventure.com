import { useCurrency } from '../lib/CurrencyContext';

interface FormattedPriceProps {
  amount: number;
  from?: string;
  className?: string;
  showCurrencyCode?: boolean;
}

export default function FormattedPrice({ amount, from = 'USD', className = '', showCurrencyCode = false }: FormattedPriceProps) {
  const { formatPrice, selectedCurrency } = useCurrency();
  
  return (
    <span className={className}>
      {formatPrice(amount, from)}
      {showCurrencyCode && <span className="ml-1 text-[0.8em] opacity-60 font-bold tracking-widest">{selectedCurrency}</span>}
    </span>
  );
}
