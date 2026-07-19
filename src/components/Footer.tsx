import { Plane, Instagram, Facebook, Twitter } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSettings } from '../lib/SettingsContext';

export default function Footer() {
  const { settings } = useSettings();
  
  const themeMode = settings?.themeMode || 'default';
  // Custom or fallback directly to Airbnb style for cohesive visual alignment with traveler views
  const styleId = themeMode === 'custom' ? (settings?.sectionStyles?.footer || 'airbnb-classic') : 'airbnb-classic';

  const renderContent = () => {
    switch (styleId) {
      case 'airbnb-classic':
      case 'airbnb-fluid':
      default: // Use as standard fallback for an elegant, unified, and real-link modern layout
        return (
          <footer className="bg-gray-50 pt-16 pb-24 text-gray-950 border-t border-gray-200/60 font-sans">
            <div className="container mx-auto px-4 lg:px-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pb-12 border-b border-gray-200/50">
                  <div>
                     <h3 className="font-extrabold text-xs text-gray-900 mb-4 uppercase tracking-widest">Destinations</h3>
                     <ul className="space-y-4 text-sm font-semibold text-gray-500">
                        <li><Link to="/tours" className="hover:text-primary transition-colors">All Tours & Journeys</Link></li>
                        <li><Link to="/destinations" className="hover:text-primary transition-colors">Explore Regions & Villages</Link></li>
                        <li><Link to="/price-list" className="hover:text-primary transition-colors">Price List & Packages</Link></li>
                     </ul>
                  </div>
                  <div>
                     <h3 className="font-extrabold text-xs text-gray-900 mb-4 uppercase tracking-widest">Customer Support</h3>
                     <ul className="space-y-4 text-sm font-semibold text-gray-500">
                        <li><Link to="/contact" className="hover:text-primary transition-colors">Help & Contact Center</Link></li>
                        <li><Link to="/track-booking" className="hover:text-primary transition-colors">Track My Booking</Link></li>
                        <li><Link to="/ai-hub" className="hover:text-primary transition-colors">Smart Travel Advisory & FAQ</Link></li>
                     </ul>
                  </div>
                  <div>
                     <h3 className="font-extrabold text-xs text-gray-900 mb-4 uppercase tracking-widest">Company</h3>
                     <ul className="space-y-4 text-sm font-semibold text-gray-500">
                        <li><Link to="/about" className="hover:text-primary transition-colors">Our Story & Philosophy</Link></li>
                        <li><Link to="/blog" className="hover:text-primary transition-colors">Travel Blog & Journals</Link></li>
                        <li><Link to="/planner" className="hover:text-primary transition-colors">AI Trip Planner</Link></li>
                     </ul>
                  </div>
               </div>
               <div className="pt-8 flex flex-col md:flex-row justify-between items-center gap-6 text-sm font-semibold text-gray-400">
                  <div className="flex flex-wrap justify-center md:justify-start gap-3 items-center">
                     <span className="font-bold text-gray-800">© {new Date().getFullYear()} {settings?.siteName || 'Gorilla ATV Adventure'}.</span>
                     <span className="hidden md:inline text-gray-300">·</span>
                     <Link to="/about" className="hover:underline hover:text-primary transition-colors">About</Link>
                     <span className="text-gray-300">·</span>
                     <Link to="/terms" className="hover:underline hover:text-primary transition-colors">Terms</Link>
                     <span className="text-gray-300">·</span>
                     <Link to="/privacy" className="hover:underline hover:text-primary transition-colors">Privacy Policy</Link>
                     <span className="text-gray-300">·</span>
                     <Link to="/contact" className="hover:underline hover:text-primary transition-colors">Contact</Link>
                     <span className="text-gray-300">·</span>
                     <Link to="/tours" className="hover:underline hover:text-primary transition-colors">Tours</Link>
                  </div>
                  <div className="flex items-center gap-6">
                     <span className="flex items-center gap-1.5 font-extrabold text-gray-700">
                        <Plane className="h-4 w-4 text-primary" /> English (UK)
                     </span>
                     <div className="flex gap-4">
                        {settings?.facebookUrl && (
                          <a href={settings.facebookUrl} className="text-gray-400 hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                            <Facebook className="h-5 w-5" />
                          </a>
                        )}
                        {settings?.instagramUrl && (
                          <a href={settings.instagramUrl} className="text-gray-400 hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                            <Instagram className="h-5 w-5" />
                          </a>
                        )}
                        {settings?.twitterUrl && (
                          <a href={settings.twitterUrl} className="text-gray-400 hover:text-primary transition-colors" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                            <Twitter className="h-5 w-5" />
                          </a>
                        )}
                     </div>
                  </div>
               </div>
            </div>
          </footer>
        );
    }
  };

  return renderContent();
}
