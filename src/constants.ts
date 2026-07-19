export const COUNTRIES = [
  "Australia", "United States", "United Kingdom", "Germany", "France", "Japan", 
  "Singapore", "Malaysia", "China", "Indonesia", "Canada", "Netherlands", 
  "Russia", "South Korea", "India", "Other"
];

export const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? '00' : '30';
  return `${hours.toString().padStart(2, '0')}:${minutes}`;
});
