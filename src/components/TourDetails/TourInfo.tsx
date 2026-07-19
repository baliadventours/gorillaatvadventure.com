import { Check, X, MapPin, Clock, Globe, HelpCircle, MessageSquare, Info, ShieldCheck } from 'lucide-react';
import { Tour } from '../../types';
import { motion } from 'motion/react';
import { useSettings } from '../../lib/SettingsContext';
import SmartImage from '../SmartImage';

interface TourInfoProps {
  tour: Tour;
}

export default function TourInfo({ tour }: TourInfoProps) {
  const { settings } = useSettings();

  const handleWhatsAppContact = () => {
    if (!settings?.whatsappNumber) return;
    
    // Remove non-numeric characters from the phone number for the wa.me link
    const cleanNumber = settings.whatsappNumber.replace(/\D/g, '');
    const message = encodeURIComponent(`Hi! I'm interested in the "${tour.title}" tour. Can you help me with some questions?`);
    window.open(`https://wa.me/${cleanNumber}?text=${message}`, '_blank');
  };
  const sections = [
    { id: 'overview', title: 'Tour Overview', content: tour.description },
    { id: 'highlights', title: 'Tour Highlights', items: tour.highlights },
    { id: 'inclusion', title: 'Inclusion & Exclusion', inclusions: tour.inclusions, exclusions: tour.exclusions },
    { id: 'itinerary', title: 'Tour Itinerary', itinerary: tour.itinerary },
    { id: 'info', title: 'Important Information', content: tour.importantInfo },
    { id: 'languages', title: 'Languages', items: tour.languages },
    { id: 'faq', title: 'FAQ', faqs: tour.faqs },
  ];

  return (
    <div className="space-y-12">
      {/* Overview */}
      <section id="overview" className="scroll-mt-[116px]">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Tour Overview</h2>
        <p className="leading-relaxed text-gray-600 whitespace-pre-wrap">{tour.description}</p>
      </section>

      {/* Highlights */}
      <section id="highlights" className="scroll-mt-[116px]">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">Tour Highlights</h2>
        <ul className="grid gap-y-2.5 gap-x-6 sm:grid-cols-2">
          {(tour.highlights || []).filter(line => line.trim() !== '').map((item, idx) => (
            <li key={idx} className="flex items-start gap-2.5">
              <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-primary mt-0.5 animate-fade-in">
                <Check className="h-3 w-3" />
              </div>
              <span className="text-sm md:text-base text-gray-600 font-medium leading-snug">{item}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Inclusion & Exclusion */}
      <section id="inclusion" className="scroll-mt-[116px]">
        <h2 className="mb-6 text-2xl font-bold text-gray-900">Inclusion & Exclusion</h2>
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Inclusions</h3>
            <ul className="space-y-3">
              {(tour.inclusions || []).filter(line => line.trim() !== '').map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800">Exclusions</h3>
            <ul className="space-y-3">
              {(tour.exclusions || []).filter(line => line.trim() !== '').map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <X className="h-5 w-5 text-red-500" />
                  <span className="text-sm text-gray-600">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Itinerary */}
      <section id="itinerary" className="scroll-mt-[116px]">
        <h2 className="mb-8 text-2xl font-black text-gray-900 tracking-tight">Tour Itinerary</h2>
        <div className="space-y-12">
          {(tour.itinerary || []).map((item, idx) => (
            <div key={idx} className="relative group">
              {idx !== (tour.itinerary || []).length - 1 && (
                <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-orange-100/50 group-hover:bg-orange-200 transition-colors" />
              )}
              <div className="flex gap-6">
                <div className="relative z-10">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary font-black text-white text-xs shadow-lg shadow-orange-100 ring-4 ring-white">
                    {idx + 1}
                  </div>
                </div>
                <div className="flex-1 space-y-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">{item.title}</h3>
                    {item.pickup && (
                      <div className="flex items-center gap-2 text-primary font-bold text-[10px] bg-orange-50 w-fit px-2 py-0.5 rounded-full border border-orange-100">
                        <MapPin className="h-3 w-3" />
                        {typeof item.pickup === 'object' ? item.pickup.description : item.pickup}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-4">
                    {(item.image || (typeof item.pickup === 'object' && item.pickup?.image)) && (
                      <div className="w-full aspect-[3/2] bg-gray-50 overflow-hidden rounded-xl">
                        <SmartImage 
                          src={item.image || (typeof item.pickup === 'object' ? item.pickup?.image : '')} 
                          alt={item.title} 
                          className="group-hover:scale-105" 
                          aspectRatio="auto"
                        />
                      </div>
                    )}
                    <div>
                      <p className="text-sm leading-relaxed text-gray-500 font-medium text-justify">{item.description}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Important Information */}
      <section id="info" className="scroll-mt-[116px]">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Info className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Important Information</h2>
        </div>

        <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden group">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 -mt-10 -mr-10 h-40 w-40 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 bg-orange-500/10 rounded-full blur-3xl" />
          
          <div className="relative z-10 space-y-6">
            {/* Dynamic Info Sections - Forced Single Column */}
            <div className="space-y-6">
              {(tour.infoSections || []).map((section, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-4 bg-primary rounded-full" />
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-widest">
                      {section.title}
                    </h3>
                  </div>
                  <ul className="space-y-1.5">
                    {(section.content || []).filter(line => line.trim() !== '').map((point, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-2.5 group/item">
                        <div className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-white/10 text-primary group-hover/item:bg-primary group-hover/item:text-white transition-all mt-0.5">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                        <span className="text-xs md:text-sm text-gray-300 leading-normal font-light group-hover/item:text-white transition-colors">
                          {point}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="space-y-6 pt-5 border-t border-white/10">
              {/* General Info (Legacy support or fallback) */}
              {tour.importantInfo && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-0.5 w-4 bg-primary rounded-full transition-all" />
                    <h3 className="text-xs sm:text-sm font-bold text-white uppercase tracking-widest">Policy & Terms</h3>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className="text-xs md:text-sm leading-normal text-gray-400 font-light whitespace-pre-wrap">
                      {tour.importantInfo}
                    </p>
                  </div>
                </div>
              )}

              {/* Languages offered */}
              {tour.languages && tour.languages.length > 0 && (
                <div className="space-y-3">
                   <div className="flex items-center gap-3">
                    <div className="h-1 w-6 bg-primary rounded-full" />
                    <h3 className="text-lg font-black text-white uppercase tracking-wider">Languages Offered</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tour.languages.filter(l => l.trim() !== '').map((lang, idx) => (
                      <span key={idx} className="px-4 py-2 bg-white/5 border border-white/10 font-bold text-white rounded-2xl text-xs md:text-sm hover:border-primary transition-all cursor-default">
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Map */}
      <section id="map" className="scroll-mt-[116px]">
        <h2 className="mb-6 text-[10px] font-black text-gray-400 tracking-[0.3em] uppercase opacity-50">Location Map</h2>
        <div className="overflow-hidden rounded-[10px] bg-gray-100 ring-1 ring-gray-100 aspect-[21/9] relative shadow-2xl shadow-gray-200/50">
          <iframe 
            src={tour.locationMapUrl || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3151.835434509374!2d144.9537353153166!3d-37.81033277975171!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6ad642af0f11fd81%3A0x5045675218ce6e0!2sMelbourne%20VIC%2C%20Australia!5e0!3m2!1sen!2sid!4v1625123456789!5m2!1sen!2sid"}
            width="100%" 
            height="100%" 
            style={{ border: 0 }} 
            allowFullScreen 
            loading="lazy"
            title="Location Map"
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-[116px]">
        <h2 className="mb-6 text-2xl font-black text-gray-900 tracking-tight">FAQ</h2>
        <div className="space-y-4">
          {(tour.faqs || []).map((faq, idx) => (
            <div key={idx} className="rounded-[10px] border border-gray-100 bg-white p-5 cursor-default hover:border-orange-100 transition-colors">
              <h3 className="mb-2 font-bold text-gray-900">{faq.question}</h3>
              <p className="text-sm leading-relaxed text-gray-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Custom Itinerary Cta */}
      <section className="rounded-[10px] bg-primary p-8 text-white">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">Need custom itinerary and more questions?</h2>
            <p className="text-orange-100 font-medium">Our experts are here to help you design your perfect trip.</p>
          </div>
          <button 
            onClick={handleWhatsAppContact}
            className="flex items-center gap-2 rounded-[10px] bg-white px-8 py-4 font-bold text-primary transition-all hover:bg-orange-50 active:scale-95 shadow-lg"
          >
            <MessageSquare className="h-5 w-5" /> Contact Experts
          </button>
        </div>
      </section>
    </div>
  );
}
