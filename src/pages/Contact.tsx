import { Mail, Phone, MapPin, Send, MessageSquare, Globe, LayoutGrid, Zap } from 'lucide-react';
import { useSettings } from '../lib/SettingsContext';
import { Helmet } from 'react-helmet-async';
import { formatPageTitle } from '../lib/seoUtils';
import { cn } from '../lib/utils';

export default function Contact() {
  const { settings } = useSettings();
  const pageTitle = formatPageTitle('Contact Us', settings?.siteName || 'Bali Adventours', settings?.pageTitleFormat);
  
  const themeMode = settings?.themeMode || 'default';
  const styleId = themeMode === 'custom' ? settings?.sectionStyles?.contactPage : 'default';

  const renderContent = () => {
    switch (styleId) {
      case 'airbnb-classic':
      case 'airbnb-fluid':
        return (
          <div className="min-h-screen bg-white">
            <div className="container mx-auto px-4 lg:px-8 py-32">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">Contact Us</h1>
              <p className="text-lg text-gray-600 mb-12 max-w-2xl">We're here to help you with your booking, answer your questions, and make your trip to Bali unforgettable.</p>
              <div className="grid md:grid-cols-2 gap-16">
                <div className="space-y-8">
                  <div className="border-b border-gray-200 pb-8">
                    <h3 className="text-lg font-bold mb-2">Customer Support</h3>
                    <p className="text-gray-500 mb-4">Our team is available 24/7 to assist you via WhatsApp or Email.</p>
                    <a href={`https://wa.me/${settings?.whatsappNumber?.replace(/\D/g, '')}`} className="inline-block px-6 py-3 border border-gray-900 rounded-xl font-bold hover:bg-gray-50 transition-colors">Chat with us</a>
                  </div>
                  <div className="border-b border-gray-200 pb-8">
                    <h3 className="text-lg font-bold mb-2">Office Address</h3>
                    <p className="text-gray-500">{settings?.officeAddress}</p>
                    <p className="text-gray-500">Bali, Indonesia</p>
                  </div>
                </div>
                <div className={cn(
                  "p-8 rounded-3xl",
                  styleId === 'airbnb-fluid' ? "bg-white border border-gray-200 shadow-xl" : "bg-[#f7f7f7]"
                )}>
                  <h3 className="text-xl font-bold mb-6">Send a message</h3>
                  <div className="space-y-4">
                    <input placeholder="Full Name" className="w-full p-4 rounded-xl border border-gray-200 focus:ring-0 bg-white" />
                    <input placeholder="Email Address" className="w-full p-4 rounded-xl border border-gray-200 focus:ring-0 bg-white" />
                    <textarea placeholder="How can we help?" rows={4} className="w-full p-4 rounded-xl border border-gray-200 focus:ring-0 bg-white" />
                    <button className="w-full py-4 bg-primary text-white rounded-xl font-bold hover:brightness-90 transition-all">Send</button>
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
             "min-h-screen pt-40 pb-24 transition-colors duration-500",
             styleId === 'modern-dark' ? "bg-gray-950 text-white" : "bg-[#fafafa] text-gray-900"
          )}>
            <div className="max-w-5xl mx-auto px-4">
              <div className="text-center mb-24">
                 <h1 className="text-6xl md:text-9xl font-black tracking-tighter mb-6 uppercase leading-none">Connect.</h1>
                 <p className={cn(
                   "font-medium leading-relaxed max-w-sm mx-auto",
                   styleId === 'modern-dark' ? "text-gray-400" : "text-gray-500"
                 )}>Reach out to our specialized travel engineers for priority handling.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                 {[
                   { icon: MessageSquare, label: 'Chat', val: 'Instant' },
                   { icon: Mail, label: 'Email', val: settings?.supportEmail },
                   { icon: Phone, label: 'Phone', val: settings?.supportPhone }
                 ].map((item, i) => (
                    <div key={i} className={cn(
                      "p-8 rounded-[2rem] border transition-all hover:-translate-y-1 text-center",
                      styleId === 'modern-dark' ? "bg-white/5 border-white/10" : "bg-white border-gray-100 shadow-sm"
                    )}>
                       <item.icon className="h-6 w-6 text-primary mx-auto mb-4" />
                       <h4 className="font-black text-xs uppercase tracking-widest mb-1 opacity-50">{item.label}</h4>
                       <p className="font-medium text-sm truncate">{item.val}</p>
                    </div>
                 ))}
              </div>
              <div className={cn(
                "rounded-[3.5rem] p-8 md:p-16 transition-all",
                styleId === 'modern-dark' ? "bg-white text-gray-900 shadow-2xl" : "bg-gray-900 text-white shadow-2xl"
              )}>
                 <h3 className="text-3xl font-black mb-8 tracking-tight">Direct inquiry</h3>
                 <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <input placeholder="Name" className={cn(
                         "w-full border rounded-2xl p-5 text-sm focus:outline-none focus:border-primary transition-colors",
                         styleId === 'modern-dark' ? "bg-gray-50 border-gray-200 text-gray-900" : "bg-white/5 border-white/10 text-white"
                       )} />
                       <input placeholder="Email" className={cn(
                         "w-full border rounded-2xl p-5 text-sm focus:outline-none focus:border-primary transition-colors",
                         styleId === 'modern-dark' ? "bg-gray-50 border-gray-200 text-gray-900" : "bg-white/5 border-white/10 text-white"
                       )} />
                    </div>
                    <textarea placeholder="Message" rows={6} className={cn(
                      "w-full border rounded-2xl p-5 text-sm focus:outline-none focus:border-primary transition-colors h-full",
                      styleId === 'modern-dark' ? "bg-gray-50 border-gray-200 text-gray-900" : "bg-white/5 border-white/10 text-white"
                    )} />
                 </div>
                 <button className={cn(
                   "mt-8 px-12 py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:scale-105",
                   styleId === 'modern-dark' ? "bg-gray-900 text-white" : "bg-primary text-white"
                 )}>Dispatch Inquiry</button>
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
                   <span className="font-mono text-[10px] uppercase tracking-[0.4em] text-gray-400 mb-8">Contact / Registry</span>
                   <h1 className="text-6xl md:text-9xl font-black text-gray-900 tracking-tighter leading-none mb-12 uppercase">
                     The <br /> Support
                   </h1>
                   <div className="max-w-md space-y-12">
                      <div className="grid grid-cols-2 gap-8">
                         <div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-gray-300">Electronic</h4>
                            <p className="text-sm font-bold text-gray-900 underline underline-offset-4 mb-2">{settings?.supportEmail}</p>
                            <p className="text-sm font-bold text-gray-900 underline underline-offset-4">{settings?.supportPhone}</p>
                         </div>
                         <div>
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-gray-300">Physical</h4>
                            <p className="text-sm font-bold text-gray-900 leading-relaxed uppercase">{settings?.officeAddress}</p>
                         </div>
                      </div>
                      <div className="flex gap-4 items-center pt-8">
                         <div className="h-px bg-gray-900 flex-1" />
                         <span className="text-[10px] font-black uppercase tracking-[0.3em]">Bali, ID</span>
                      </div>
                   </div>
                </div>
                <div className="bg-gray-50 p-12 lg:p-24 flex flex-col justify-center">
                   <div className="max-w-md w-full space-y-6">
                      <h3 className="font-black text-xs uppercase tracking-widest mb-12">Submit Intake</h3>
                      <input placeholder="SUBJECT" className="w-full bg-transparent border-b border-gray-200 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-gray-900" />
                      <input placeholder="EMAIL" className="w-full bg-transparent border-b border-gray-200 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-gray-900" />
                      <textarea placeholder="MESSAGE" rows={4} className="w-full bg-transparent border-b border-gray-200 py-4 text-xs font-black uppercase tracking-widest focus:outline-none focus:border-gray-900" />
                      <button className="pt-8 flex items-center gap-6 group">
                         <span className="h-[1px] w-12 bg-gray-900 transition-all group-hover:w-24" />
                         <span className="text-[10px] font-black uppercase tracking-[0.5em]">Send Intake</span>
                      </button>
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
            <div className="container mx-auto px-4 lg:px-8 text-center mb-24">
               <div className="flex items-center justify-center gap-4 mb-8">
                  <div className={cn("h-px w-8", styleId === 'premium-full' ? "bg-amber-400/30" : "bg-gray-200")} />
                  <span className="font-serif italic text-amber-500 tracking-widest uppercase text-xs">Assistance</span>
                  <div className={cn("h-px w-8", styleId === 'premium-full' ? "bg-amber-400/30" : "bg-gray-200")} />
               </div>
               <h1 className={cn(
                 "text-5xl md:text-8xl font-serif tracking-widest leading-tight mb-12 uppercase",
                 styleId === 'premium-full' ? "text-white" : "text-gray-900"
               )}>
                 A Personal <br /> Dialogue
               </h1>
            </div>

            <div className="container mx-auto px-4 lg:px-8">
               <div className="max-w-4xl mx-auto">
                  <div className="grid md:grid-cols-2 gap-20">
                     <div className="space-y-12">
                        <section>
                           <h3 className="font-serif text-2xl italic mb-6">Inquiry</h3>
                           <p className="text-sm uppercase tracking-[0.2em] leading-loose opacity-70 mb-4">
                             For bespoke itinerary design or private group bookings, please contact our concierge team.
                           </p>
                           <p className="text-lg font-serif italic text-amber-500">{settings?.supportEmail}</p>
                        </section>
                        <section>
                           <h3 className="font-serif text-2xl italic mb-6">Headquarters</h3>
                           <p className="text-sm uppercase tracking-[0.2em] leading-loose opacity-70">
                             {settings?.officeAddress}<br />
                             Ubud, Gianyar - Bali
                           </p>
                        </section>
                     </div>
                     <div className="space-y-8">
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Identity</label>
                           <input className="w-full bg-transparent border-b border-gray-200 py-3 text-sm focus:outline-none focus:border-amber-500 font-serif" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Electronic Mail</label>
                           <input className="w-full bg-transparent border-b border-gray-200 py-3 text-sm focus:outline-none focus:border-amber-500 font-serif" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Dialogue</label>
                           <textarea rows={4} className="w-full bg-transparent border-b border-gray-200 py-3 text-sm focus:outline-none focus:border-amber-500 font-serif" />
                        </div>
                        <button className="text-[10px] font-black uppercase tracking-[0.4em] border-b border-amber-500 pb-2 text-amber-500 hover:text-white transition-all">Request Contact</button>
                     </div>
                  </div>
               </div>
            </div>
          </div>
        );

      case 'saas-clean':
      case 'saas-dash':
        return (
          <div className="min-h-screen bg-[#fafafa] pt-32 pb-20 text-gray-900">
             <div className="container mx-auto px-4 lg:px-8">
                <div className="max-w-4xl mx-auto text-center mb-16">
                   <h1 className="text-5xl md:text-7xl font-black text-gray-900 tracking-tighter mb-8 italic">
                     Support <span className="text-primary not-italic">Infrastructure.</span>
                   </h1>
                   <p className="text-xl text-gray-400 font-medium leading-relaxed max-w-2xl mx-auto">
                     Our support team utilizes state-of-the-art logistics to solve your travel queries in record time.
                   </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-8 items-stretch">
                   <div className="lg:col-span-4 space-y-4">
                      {[
                        { title: 'Global Support', desc: 'Active 24/7 in 5 languages.', icon: Globe },
                        { title: 'Documentation', desc: 'Read our comprehensive guides.', icon: LayoutGrid },
                        { title: 'Priority Status', desc: 'Enterprise accounts receive dedicated agents.', icon: Zap }
                      ].map((card, i) => (
                        <div key={i} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:translate-x-2 transition-all group">
                           <card.icon className="h-6 w-6 text-primary mb-4" />
                           <h4 className="font-black text-xs uppercase tracking-widest mb-2">{card.title}</h4>
                           <p className="text-gray-400 text-sm font-medium">{card.desc}</p>
                        </div>
                      ))}
                   </div>
                   <div className="lg:col-span-8 bg-white rounded-[2.5rem] border border-gray-100 shadow-xl p-8 md:p-12">
                      <div className="flex items-center justify-between mb-12">
                         <h3 className="text-2xl font-black tracking-tight">Open Ticket</h3>
                         <span className="px-3 py-1 bg-orange-50 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">Live Now</span>
                      </div>
                      <div className="grid md:grid-cols-2 gap-8 mb-8">
                         <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300">Name</label>
                            <input className="w-full bg-gray-50 border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                         </div>
                         <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-300">Email</label>
                            <input className="w-full bg-gray-50 border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
                         </div>
                      </div>
                      <div className="space-y-4 mb-8">
                         <label className="text-[10px] font-black uppercase tracking-widest text-gray-300">Issue Category</label>
                         <select className="w-full bg-gray-50 border-none rounded-xl p-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 appearance-none">
                            <option>Booking Modification</option>
                            <option>Payment Issue</option>
                            <option>Partnership Inquiry</option>
                            <option>General Support</option>
                         </select>
                      </div>
                      <button className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-primary transition-all">Submit Support Request</button>
                   </div>
                </div>
             </div>
          </div>
        );

      default:
        return (
          <div className="min-h-screen bg-white">
            {/* Hero */}
            <section className="bg-orange-900 pt-40 pb-24 px-4 text-center">
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mb-6">Get in Touch</h1>
              <p className="text-orange-100/60 max-w-2xl mx-auto font-medium text-lg italic">We're here to help you plan your perfect adventure. Reach out to our experts.</p>
            </section>
      
            <section className="container mx-auto px-4 py-24">
              <div className="grid lg:grid-cols-3 gap-12">
                {/* Contact Info Cards */}
                <div className="lg:col-span-1 space-y-6">
                  {[
                    { icon: Phone, title: 'Call Us', detail: settings?.supportPhone || '+62 123 456 789', desc: 'Mon-Sun, 8am-8pm WITA', color: 'emerald' },
                    { icon: Mail, title: 'Email Us', detail: settings?.supportEmail || 'info@gorillaatvadventure.com', desc: 'We reply within 24 hours', color: 'blue' },
                    { icon: MapPin, title: 'Visit Us', detail: settings?.officeAddress || 'Jl. Raya Ubud, Gianyar', desc: 'Bali, Indonesia 80571', color: 'orange' }
                  ].map((item, i) => (
                    <div key={i} className="bg-gray-50 p-8 rounded-[20px] transition-all hover:shadow-xl group">
                      <div className={`h-12 w-12 rounded-xl bg-${item.color}-50 flex items-center justify-center text-${item.color === 'emerald' ? 'emerald' : item.color}-600 mb-6 group-hover:scale-110 transition-transform`}>
                        <item.icon className="h-6 w-6" />
                      </div>
                      <h3 className="text-xl font-black text-gray-900 mb-2">{item.title}</h3>
                      <p className="text-lg font-bold text-gray-900 mb-1">{item.detail}</p>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{item.desc}</p>
                    </div>
                  ))}
                </div>
      
                {/* Contact Form */}
                <div className="lg:col-span-2 bg-white rounded-[30px] border border-gray-100 p-10 md:p-16 shadow-2xl shadow-orange-900/5 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                      <Send className="h-40 w-40 rotate-12" />
                   </div>
                   
                   <div className="relative z-10">
                      <h2 className="text-3xl font-black text-gray-900 tracking-tight mb-8">Send us a Message</h2>
                      <form className="space-y-6">
                         <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                               <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Full Name</label>
                               <input placeholder="John Doe" className="w-full bg-gray-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 font-bold text-gray-900 transition-all" />
                            </div>
                            <div className="space-y-2">
                               <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Email Address</label>
                               <input type="email" placeholder="john@example.com" className="w-full bg-gray-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 font-bold text-gray-900 transition-all" />
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Subject</label>
                            <input placeholder="What are you interested in?" className="w-full bg-gray-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 font-bold text-gray-900 transition-all" />
                         </div>
                         <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Your Message</label>
                            <textarea rows={6} placeholder="Tell us about your travel plans..." className="w-full bg-gray-50 border-none rounded-xl p-4 focus:ring-2 focus:ring-primary/20 font-bold text-gray-900 transition-all" />
                         </div>
                         <button type="button" className="bg-primary text-white px-10 py-5 rounded-2xl font-black tracking-widest text-sm uppercase shadow-xl hover:shadow-2xl hover:bg-orange-700 transition-all flex items-center gap-3">
                            Send Message <Send className="h-4 w-4" />
                         </button>
                      </form>
                   </div>
                </div>
              </div>
            </section>
      
            {/* Map Placeholder */}
            <section className="bg-gray-100 h-[400px] w-full mt-24 relative flex items-center justify-center">
               <div className="text-center">
                  <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h4 className="text-gray-400 font-black text-xs">Interactive map coming soon</h4>
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
        <meta name="description" content={`Get in touch with the team at ${settings?.siteName || 'Bali Adventours'}. We are here to help you plan your perfect Bali adventure tour.`} />
      </Helmet>
      {renderContent()}
    </>
  );
}
