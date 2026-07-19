import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { LocationMeta } from '../types';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight, ExternalLink } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useSettings } from '../lib/SettingsContext';
import { formatPageTitle } from '../lib/seoUtils';

export default function Destinations() {
  const { settings } = useSettings();
  const [locations, setLocations] = useState<LocationMeta[]>([]);
  const pageTitle = formatPageTitle('Our Destinations', settings?.siteName || 'Bali Adventours', settings?.pageTitleFormat);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'locationMeta'), (snapshot) => {
      setLocations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LocationMeta)));
    });
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`Explore the top destinations in Bali with ${settings?.siteName || 'Bali Adventours'}. From Ubud's jungles to Uluwatu's cliffs.`} />
      </Helmet>
      {/* Hero */}
      <section className="bg-gray-900 pt-40 pb-24 text-center px-4">
         <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6">Our Top Destinations</h1>
         <p className="text-gray-400 max-w-2xl mx-auto font-medium text-lg leading-relaxed">From the lush jungles of Ubud to the turquoise waters of Nusa Penida, explore the best of Bali and beyond.</p>
      </section>

      <section className="container mx-auto px-4 py-24">
         <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {locations.map((loc, i) => (
               <div key={loc.id} className="group relative aspect-[4/5] rounded-[30px] overflow-hidden shadow-2xl">
                  <img 
                    src={`https://picsum.photos/seed/${loc.name.toLowerCase()}/800/1000`} 
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  
                  <div className="absolute inset-0 p-8 flex flex-col justify-end">
                     <span className="inline-block w-fit px-3 py-1 bg-orange-500 text-white rounded-lg text-[10px] font-black mb-4">Popular spot</span>
                     <h3 className="text-3xl font-black text-white tracking-tight mb-2 group-hover:text-orange-400 transition-colors">{loc.name}</h3>
                     <p className="text-gray-300 text-sm font-medium mb-8 opacity-0 group-hover:opacity-100 transition-all translate-y-4 group-hover:translate-y-0">
                        Discover the breathtaking beauty and unique cultural heritage of {loc.name}. Book your local guide today.
                     </p>
                     <Link 
                       to={`/tours`}
                       className="flex items-center gap-3 text-white font-black text-xs group/btn"
                     >
                        View tours <div className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover/btn:bg-primary transition-colors"><ArrowRight className="h-4 w-4" /></div>
                     </Link>
                  </div>
               </div>
            ))}
            {locations.length === 0 && (
               [1,2,3].map(n => (
                  <div key={n} className="aspect-[4/5] bg-gray-100 rounded-[30px] animate-pulse" />
               ))
            )}
         </div>
      </section>

      {/* Partners/Affiliates */}
      <section className="py-24 border-t border-gray-50">
         <div className="container mx-auto px-4 text-center">
            <h4 className="text-[10px] font-black text-gray-400 mb-12">Expertly guided trips in</h4>
            <div className="flex flex-wrap items-center justify-center gap-12 opacity-30 grayscale contrast-150">
               {['Ubud', 'Seminyak', 'Kuta', 'Canggu', 'Uluwatu', 'Nusa Dua'].map(v => (
                  <span key={v} className="text-4xl font-black tracking-tighter">{v}</span>
               ))}
            </div>
         </div>
      </section>
    </div>
  );
}
