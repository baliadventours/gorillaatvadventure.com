import { Target, Users, ShieldCheck, Heart, Award, Sparkles, ArrowRight, Check, Zap } from 'lucide-react';
import { useSettings } from '../lib/SettingsContext';
import { Helmet } from 'react-helmet-async';
import { formatPageTitle } from '../lib/seoUtils';
import { cn } from '../lib/utils';

export default function About() {
  const { settings } = useSettings();
  const pageTitle = formatPageTitle('About Us', settings?.siteName || 'Bali Adventours', settings?.pageTitleFormat);
  
  const themeMode = settings?.themeMode || 'default';
  const styleId = themeMode === 'custom' ? settings?.sectionStyles?.aboutPage : 'default';

  const renderContent = () => {
    switch (styleId) {
      case 'airbnb-classic':
      case 'airbnb-fluid':
        return (
          <div className="min-h-screen bg-white pb-20">
            <div className="container mx-auto px-4 lg:px-8 pt-32">
              <h1 className="text-4xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-16">
                {styleId === 'airbnb-fluid' ? 'Living the Balinese dream.' : 'About us.'}
              </h1>
              <div className="grid lg:grid-cols-2 gap-20 items-start">
                <div className="space-y-12">
                   <div className="group">
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-primary transition-colors">Our Mission</h2>
                      <p className="text-gray-600 leading-relaxed text-lg font-medium">
                        At {settings?.siteName}, we provide a platform for travelers to discover the heart of Bali. We believe in travel that is authentic, immersive, and respectful to the island's unique heritage.
                      </p>
                   </div>
                   <div className="group">
                      <h2 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-primary transition-colors">Local Experts</h2>
                      <p className="text-gray-600 leading-relaxed">
                        Every experience is hand-picked by local experts who call Bali home. From the early morning misty treks on Mt. Batur to the hidden waterfalls of Munduk, we ensure you see the Bali that others miss.
                      </p>
                   </div>
                   <div className="pt-8 border-t border-gray-100 flex gap-12">
                      <div>
                        <div className="text-3xl font-black text-gray-900">500+</div>
                        <div className="text-sm text-gray-400 font-bold uppercase tracking-widest">Experiences</div>
                      </div>
                      <div>
                        <div className="text-3xl font-black text-gray-900">10k+</div>
                        <div className="text-sm text-gray-400 font-bold uppercase tracking-widest">Reviews</div>
                      </div>
                   </div>
                </div>
                <div className={cn(
                  "grid grid-cols-2 gap-4",
                   styleId === 'airbnb-fluid' ? "animate-in fade-in slide-in-from-right-12 duration-1000" : ""
                )}>
                  <div className="space-y-4">
                     <img src="https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&q=80&w=600" className="rounded-[40px] shadow-2xl" alt="Bali 1" />
                     <div className="aspect-square bg-orange-50 rounded-[40px] flex items-center justify-center p-8">
                        <Sparkles className="h-12 w-12 text-primary animate-pulse" />
                     </div>
                  </div>
                  <div className="space-y-4 pt-12">
                     <div className="aspect-[3/4] bg-gray-900 rounded-[40px] overflow-hidden">
                        <img src="https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?auto=format&fit=crop&q=80&w=600" className="w-full h-full object-cover opacity-80" alt="Bali 2" />
                     </div>
                     <img src="https://images.unsplash.com/photo-1537953391648-7326d0ca012e?auto=format&fit=crop&q=80&w=600" className="rounded-[40px] shadow-2xl" alt="Bali 3" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'modern-dark':
      case 'modern-glass':
        return (
          <div className={cn(
            "min-h-screen py-32 transition-colors duration-500",
            styleId === 'modern-dark' ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"
          )}>
            <div className="container mx-auto px-4 lg:px-8">
              <div className="max-w-4xl">
                 <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full mb-8">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary">The Narrative</span>
                 </div>
                 <h1 className="text-6xl md:text-9xl font-black tracking-tighter leading-[0.85] mb-12 uppercase">
                   Engineering <br /> <span className={cn(
                     "italic",
                     styleId === 'modern-dark' ? "text-gray-700" : "text-gray-300"
                   )}>Better</span> Journeys
                 </h1>
                 <p className={cn(
                   "text-xl md:text-2xl font-medium leading-relaxed max-w-2xl mb-20",
                   styleId === 'modern-dark' ? "text-gray-400" : "text-gray-500"
                 )}>
                   We combine advanced logistics with deep cultural expertise to create the most sophisticated travel experience in Indonesia.
                 </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {[
                   { title: 'The Vision', desc: 'A world where travel is more than a trophy—it is a transformation.' },
                   { title: 'The Method', desc: 'Proprietary route design and 1:1 expert local partnerships.' },
                   { title: 'The impact', desc: '100% carbon neutral operations and 70% direct community reinvestment.' }
                 ].map((item, i) => (
                   <div key={i} className={cn(
                     "p-10 rounded-[40px] border transition-all hover:-translate-y-2",
                     styleId === 'modern-dark' ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-gray-100 shadow-sm hover:shadow-xl"
                   )}>
                      <h3 className="font-black text-xs uppercase tracking-widest mb-4 opacity-50">{item.title}</h3>
                      <p className="text-lg font-bold leading-snug">{item.desc}</p>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        );

      case 'minimal-grid':
      case 'minimal-type':
        return (
          <div className="min-h-screen bg-white">
             <div className="grid lg:grid-cols-2 min-h-screen">
                <div className="p-12 lg:p-24 flex flex-col justify-center border-r border-gray-100">
                   <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-gray-400 mb-8">About / 01</span>
                   <h1 className="text-5xl md:text-8xl font-black text-gray-900 tracking-tighter leading-none mb-12 uppercase">
                     The <br /> Essence
                   </h1>
                   <div className="max-w-md space-y-8">
                      <p className="text-sm font-bold text-gray-400 leading-relaxed uppercase tracking-wide">
                        {settings?.siteName} remains dedicated to the original spirit of Balinese exploration. We prioritize stillness, accuracy, and depth.
                      </p>
                      <p className="text-sm font-bold text-gray-900 leading-relaxed">
                        Our collection is small by choice. We only provide tours that we have personally vetted, refined, and perfected over years of operation.
                      </p>
                      <div className="flex gap-4 items-center pt-8">
                         <div className="h-px bg-gray-900 flex-1" />
                         <span className="text-[10px] font-black uppercase tracking-[0.3em]">Est. 2012</span>
                      </div>
                   </div>
                </div>
                <div className="bg-gray-50 relative overflow-hidden flex items-center justify-center">
                   <img 
                    src="https://images.unsplash.com/photo-1501179691627-eeaa65ea017c?auto=format&fit=crop&q=80&w=1000" 
                    className="w-full h-full object-cover filter grayscale" 
                    alt="Minimal Bali" 
                   />
                   <div className="absolute inset-0 bg-white/10 backdrop-blur-3xl" />
                   <div className="relative z-10 w-full max-w-md p-12 bg-white/80 backdrop-blur-md rounded-2xl shadow-2xl border border-white/50">
                      <h4 className="font-black text-xs uppercase tracking-widest mb-6">Directory</h4>
                      <ul className="space-y-4">
                         {['Curation', 'Sustainability', 'Logistics', 'Philosophy'].map(item => (
                           <li key={item} className="flex items-center justify-between group cursor-pointer pb-4 border-b border-gray-100">
                              <span className="text-sm font-black uppercase tracking-widest group-hover:translate-x-2 transition-transform">{item}</span>
                              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                           </li>
                         ))}
                      </ul>
                   </div>
                </div>
             </div>
          </div>
        );

      case 'premium-serif':
      case 'premium-full':
        return (
          <div className={cn(
            "min-h-screen pt-40 pb-20",
            styleId === 'premium-full' ? "bg-[#111] text-[#d4cfc8]" : "bg-white text-gray-900"
          )}>
            <div className="container mx-auto px-4 lg:px-8 text-center mb-32">
               <div className="flex items-center justify-center gap-4 mb-8">
                  <div className={cn("h-px w-8", styleId === 'premium-full' ? "bg-amber-400/30" : "bg-gray-200")} />
                  <span className="font-serif italic text-amber-500 tracking-widest uppercase text-xs">Exclusivity</span>
                  <div className={cn("h-px w-8", styleId === 'premium-full' ? "bg-amber-400/30" : "bg-gray-200")} />
               </div>
               <h1 className={cn(
                 "text-5xl md:text-8xl font-serif tracking-widest leading-tight mb-12 uppercase",
                 styleId === 'premium-full' ? "text-white" : "text-gray-900"
               )}>
                 A Life <br /> Less Ordinary
               </h1>
            </div>

            <div className="container mx-auto px-4 lg:px-8">
               <div className="grid lg:grid-cols-12 gap-16 items-center">
                  <div className="lg:col-span-4 space-y-12">
                     <section>
                        <h3 className="font-serif text-2xl italic mb-6">The Pedigree</h3>
                        <p className="text-sm uppercase tracking-[0.2em] leading-loose opacity-70">
                          Founded by a collective of anthropologists and travel connoisures, {settings?.siteName} has redefined luxury as knowledge.
                        </p>
                     </section>
                     <section>
                        <h3 className="font-serif text-2xl italic mb-6">The Stewardship</h3>
                        <p className="text-sm uppercase tracking-[0.2em] leading-loose opacity-70">
                          We act as custodians of Balinese culture, ensuring every guest interaction generates lasting positive value for the community.
                        </p>
                     </section>
                  </div>
                  <div className="lg:col-span-8 flex flex-col md:flex-row gap-8">
                     <div className="flex-1 bg-gray-50 aspect-[3/4] rounded-sm overflow-hidden border border-gray-100">
                        <img src="https://images.unsplash.com/photo-1537944434965-cf4679d1a598?auto=format&fit=crop&q=80&w=600" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000" alt="Premium 1" />
                     </div>
                     <div className="flex-1 bg-gray-50 aspect-[3/4] rounded-sm overflow-hidden border border-gray-100 mt-12">
                        <img src="https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&q=80&w=600" className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000" alt="Premium 2" />
                     </div>
                  </div>
               </div>
            </div>
          </div>
        );

      case 'saas-clean':
      case 'saas-dash':
        return (
          <div className="min-h-screen bg-[#fafafa] pt-32 pb-20">
             <div className="container mx-auto px-4 lg:px-8">
                <div className="max-w-4xl mx-auto text-center mb-24">
                   <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tighter mb-8">
                     The Operating System for <span className="text-primary italic">Adventure.</span>
                   </h1>
                   <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-2xl mx-auto">
                     We've built a robust infrastructure to handle everything from planning to execution, so you can focus on the experience.
                   </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                   {[
                     { icon: Users, title: 'Collaborative', desc: 'Plan with your group in real-time.' },
                     { icon: ShieldCheck, title: 'Enterprise Safety', desc: 'Rigorous safety protocols for every route.' },
                     { icon: Target, title: 'Precision', desc: 'Every detail of your itinerary synchronized.' },
                     { icon: Zap, title: 'Automated', desc: 'Instant confirmations and active tracking.' }
                   ].map((feature, i) => (
                     <div key={i} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
                        <div className="h-12 w-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 group-hover:bg-primary group-hover:text-white transition-all mb-6">
                           <feature.icon className="h-6 w-6" />
                        </div>
                        <h4 className="font-black text-gray-900 text-xs uppercase tracking-widest mb-3">{feature.title}</h4>
                        <p className="text-gray-400 text-sm font-medium leading-relaxed">{feature.desc}</p>
                     </div>
                   ))}
                </div>

                <div className="mt-16 bg-gray-900 rounded-[3rem] p-12 text-white relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-1/2 h-full bg-primary/20 -skew-x-12 translate-x-1/2" />
                   <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                      <div>
                         <h3 className="text-3xl font-black mb-6 tracking-tight">Our Stack</h3>
                         <p className="text-gray-400 font-medium leading-relaxed mb-8">
                           We use a combination of local wisdom and modern technology to power your Balinese adventure.
                         </p>
                         <ul className="space-y-4">
                            {['24/7 Priority Support', 'Live GPS Tracking', 'Verified Local Partners'].map(item => (
                              <li key={item} className="flex items-center gap-3">
                                 <Check className="h-4 w-4 text-orange-400" />
                                 <span className="text-sm font-bold uppercase tracking-widest">{item}</span>
                              </li>
                            ))}
                         </ul>
                      </div>
                      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 shadow-2xl">
                         <div className="aspect-video bg-gray-800 rounded-xl overflow-hidden">
                            <img src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&q=80&w=800" className="w-full h-full object-cover opacity-50" alt="Dashboard Preview" />
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        );

      default:
        return (
          <div className="min-h-screen bg-white">
            <Helmet>
              <title>{pageTitle}</title>
              <meta name="description" content={`Learn more about ${settings?.siteName || 'Bali Adventours'}, our mission to provide authentic Bali experiences and our dedication to sustainable tourism.`} />
            </Helmet>
            {/* Hero */}
            <section className="relative h-[60vh] flex items-center justify-center overflow-hidden pt-20">
              <div className="absolute inset-0 z-0">
                <img src="https://picsum.photos/seed/bali-about/1920/1080" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" />
              </div>
              <div className="relative z-10 container mx-auto px-4 text-center">
                 <span className="inline-block px-4 py-1.5 bg-orange-500 text-white rounded-full text-[10px] font-black mb-6">Our story</span>
                 <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight leading-tight">Crafting memories <br/> beyond destinations</h1>
              </div>
            </section>
      
            {/* Mission & Vision */}
            <section className="container mx-auto px-4 py-24">
              <div className="grid lg:grid-cols-2 gap-20 items-center">
                 <div className="space-y-8">
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight">Experience Bali Like <br/> A Local Expert</h2>
                    <p className="text-lg text-gray-500 font-medium leading-relaxed">
                      Founded with a passion for authentic exploration, {settings?.siteName} has been at the forefront of sustainable and immersive tourism for over a decade. We don't just sell tours; we curate life-changing experiences that connect you with the soul of Indonesia.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-8 pt-8">
                       <div className="space-y-3">
                          <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center text-primary">
                             <Target className="h-5 w-5" />
                          </div>
                          <h4 className="font-black text-gray-900 text-xs">Our mission</h4>
                          <p className="text-sm text-gray-400 font-medium leading-relaxed">To provide world-class travel services while preserving local culture and environment.</p>
                       </div>
                       <div className="space-y-3">
                          <div className="h-10 w-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                             <Sparkles className="h-5 w-5" />
                          </div>
                          <h4 className="font-black text-gray-900 text-xs">Our vision</h4>
                          <p className="text-sm text-gray-400 font-medium leading-relaxed">Becoming the most trusted gateway for travelers to discover the hidden gems of Indonesia.</p>
                       </div>
                    </div>
                 </div>
                 <div className="relative">
                    <div className="aspect-[4/5] rounded-[40px] overflow-hidden shadow-2xl">
                       <img src="https://picsum.photos/seed/bali-nature/800/1000" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="absolute -bottom-10 -left-10 bg-white p-8 rounded-[30px] shadow-2xl hidden md:block max-w-[280px]">
                       <div className="flex items-center gap-4 mb-4">
                          <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center text-white font-black text-xl">10+</div>
                          <span className="font-black text-gray-900 leading-none">Years of <br/> Excellence</span>
                       </div>
                       <p className="text-xs text-gray-400 font-medium">Serving over 50,000 satisfied travelers from 80+ countries worldwide.</p>
                    </div>
                 </div>
              </div>
            </section>
      
            {/* Values */}
            <section className="bg-gray-50 py-24">
              <div className="container mx-auto px-4">
                 <div className="text-center max-w-2xl mx-auto mb-20">
                    <h2 className="text-4xl font-black text-gray-900 tracking-tight mb-4">Our Core Values</h2>
                    <p className="text-gray-500 font-medium">The principles that guide every decision we make and every tour we create.</p>
                 </div>
                 
                 <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {[
                      { icon: Users, title: 'People First', desc: 'Our guests and our local community are the heart of our business.', color: 'blue' },
                      { icon: ShieldCheck, title: 'Safety Always', desc: 'Uncompromising standards of safety and professional guidance.', color: 'emerald' },
                      { icon: Heart, title: 'Authenticity', desc: 'Real experiences, real people, and real connections.', color: 'orange' },
                      { icon: Award, title: 'Quality Service', desc: 'Continuous improvement in every touchpoint of our journey.', color: 'purple' }
                    ].map((val, i) => (
                      <div key={i} className="bg-white p-10 rounded-[30px] border border-gray-100 shadow-sm hover:shadow-xl transition-all text-center">
                         <div className={`h-16 w-16 bg-${val.color}-50 flex items-center justify-center text-${val.color === 'emerald' ? 'emerald' : val.color}-600 rounded-2xl mx-auto mb-8`}>
                            <val.icon className="h-8 w-8" />
                         </div>
                         <h3 className="text-xl font-black text-gray-900 mb-4">{val.title}</h3>
                         <p className="text-sm text-gray-500 font-medium leading-relaxed">{val.desc}</p>
                      </div>
                    ))}
                 </div>
              </div>
            </section>
          </div>
        );
    }
  };

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`Learn more about ${settings?.siteName || 'Bali Adventours'}, our mission to provide authentic Bali experiences and our dedication to sustainable tourism.`} />
      </Helmet>
      {renderContent()}
    </>
  );
}
