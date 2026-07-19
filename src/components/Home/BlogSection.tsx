import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { BlogPost } from '../../types';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, User } from 'lucide-react';
import SmartImage from '../SmartImage';

import { useSettings } from '../../lib/SettingsContext';

export default function BlogSection() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const { settings } = useSettings();

  const themeMode = settings?.themeMode || 'default';
  const styleId = themeMode === 'custom' ? settings?.sectionStyles?.inspiration : 'default';

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('status', 'in', ['published', 'active'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as BlogPost));
      postsData.sort((a, b) => {
        const getTimestampMillis = (val: any): number => {
          if (!val) return 0;
          if (typeof val.toMillis === "function") return val.toMillis();
          if (typeof val.seconds === "number") return val.seconds * 1000;
          if (val instanceof Date) return val.getTime();
          if (typeof val === "string" || typeof val === "number") return new Date(val).getTime() || 0;
          return 0;
        };
        return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
      });
      setPosts(postsData.slice(0, 3));
    }, (error) => {
      console.error("[BlogSection Snapshot Error]:", error);
    });
    return unsubscribe;
  }, []);

  const renderContent = () => {
    switch (styleId) {
      case 'airbnb-classic':
      case 'airbnb-fluid':
        return (
          <section className="container mx-auto px-4 py-20 lg:px-8">
            <div className="flex items-center justify-between mb-8">
               <h2 className="text-2xl font-bold text-gray-900">Inspiration for your next trip</h2>
               <Link to="/blog" className="text-sm font-bold text-gray-900 underline underline-offset-4">Explore more</Link>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
               {posts.map(post => (
                  <Link key={post.id} to={`/blog/${post.slug}`} className="group block">
                     <div className="relative aspect-square overflow-hidden rounded-2xl mb-4">
                        <SmartImage src={post.featuredImage} alt={post.title} className="group-hover:scale-105 transition-transform duration-500" />
                     </div>
                     <h3 className="font-bold text-gray-900 group-hover:underline line-clamp-2">{post.title}</h3>
                  </Link>
               ))}
            </div>
          </section>
        );

      case 'modern-dark':
      case 'modern-glass':
        return (
          <section className="py-24 bg-gray-950 overflow-hidden">
             <div className="container mx-auto px-4 lg:px-8">
                <div className="text-center mb-16">
                   <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-4 italic uppercase">The Feed</h2>
                   <p className="text-orange-400 font-bold tracking-widest uppercase text-xs">Stories from the core.</p>
                </div>
                <div className="grid md:grid-cols-3 gap-8">
                   {posts.map(post => (
                      <Link key={post.id} to={`/blog/${post.slug}`} className="group relative bg-white/5 rounded-[2.5rem] p-4 flex flex-col hover:bg-white/10 transition-colors border border-white/5">
                         <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem] mb-6">
                            <SmartImage src={post.featuredImage} alt={post.title} className="group-hover:scale-110 grayscale group-hover:grayscale-0 transition-all duration-700" />
                         </div>
                         <div className="px-4 pb-4">
                            <h3 className="text-xl font-bold text-white mb-4 line-clamp-2 leading-[1.1] ">{post.title}</h3>
                            <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between">
                               <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Active Thread</span>
                               <div className="h-8 w-8 rounded-full bg-orange-400 text-gray-950 flex items-center justify-center -rotate-45 group-hover:rotate-0 transition-transform"><ArrowRight className="h-4 w-4" /></div>
                            </div>
                         </div>
                      </Link>
                   ))}
                </div>
             </div>
          </section>
        );

      case 'minimal-grid':
      case 'minimal-type':
        return (
          <section className="container mx-auto px-4 py-24 border-b border-gray-100">
             <div className="grid lg:grid-cols-4 gap-12">
                <div className="lg:col-span-1">
                   <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-300 mb-6 block">Index / 03</span>
                   <h2 className="text-4xl font-black text-gray-900 uppercase tracking-tighter leading-none mb-8">The <br /> Periodic</h2>
                   <Link to="/blog" className="text-[10px] font-black uppercase tracking-[0.3em] border-b border-gray-900 pb-1">All entries</Link>
                </div>
                <div className="lg:col-span-3 grid md:grid-cols-3 gap-12">
                   {posts.map(post => (
                      <Link key={post.id} to={`/blog/${post.slug}`} className="group border-l border-gray-100 pl-6">
                         <span className="text-[9px] font-black text-gray-300 uppercase mb-4 block">{post.category}</span>
                         <h3 className="text-lg font-black text-gray-900 mb-6 line-clamp-3 uppercase leading-tight group-hover:text-gray-400 transition-colors">{post.title}</h3>
                         <div className="h-px w-0 bg-gray-900 group-hover:w-full transition-all" />
                      </Link>
                   ))}
                </div>
             </div>
          </section>
        );

      case 'premium-serif':
      case 'premium-full':
        return (
          <section className="py-24 bg-[#fdfcfb]">
             <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                   <h2 className="text-4xl md:text-6xl font-serif text-gray-900 mb-4 italic">Editorial</h2>
                </div>
                <div className="grid md:grid-cols-3 gap-16">
                   {posts.map(post => (
                      <Link key={post.id} to={`/blog/${post.slug}`} className="group block">
                         <div className="aspect-[4/5] overflow-hidden mb-8 shadow-2xl">
                            <SmartImage src={post.featuredImage} alt={post.title} className="group-hover:scale-110 transition-transform duration-1000" />
                         </div>
                         <h3 className="text-xl font-serif text-gray-900 italic text-center px-4 leading-relaxed group-hover:text-amber-700 transition-colors line-clamp-2">
                           "{post.title}"
                         </h3>
                      </Link>
                   ))}
                </div>
             </div>
          </section>
        );

      case 'saas-clean':
      case 'saas-dash':
        return (
          <section className="py-24 bg-[#fafafa]">
             <div className="container mx-auto px-4">
                <div className="flex items-center gap-4 mb-12">
                   <div className="h-px flex-1 bg-gray-100" />
                   <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.4em]">Development Log</h2>
                   <div className="h-px flex-1 bg-gray-100" />
                </div>
                <div className="grid md:grid-cols-3 gap-6">
                   {posts.map(post => (
                      <Link key={post.id} to={`/blog/${post.slug}`} className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl transition-all group">
                         <div className="flex items-center gap-4 mb-6">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{post.category}</span>
                         </div>
                         <h3 className="text-2xl font-black text-gray-900 mb-6 leading-tight group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                         <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase">
                            <span>Read Release</span>
                            <ArrowRight className="h-3 w-3" />
                         </div>
                      </Link>
                   ))}
                </div>
             </div>
          </section>
        );

      default:
        return (
          <section className="container mx-auto px-4 py-20 lg:px-8 bg-white overflow-hidden">
            <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="max-w-2xl">
                <span className="text-secondary text-xs font-black mb-4 block">Explore more</span>
                <h2 className="text-3xl md:text-5xl font-black text-gray-900 tracking-tight leading-none">Travel Inspiration</h2>
                <p className="mt-4 text-gray-500 font-medium text-lg">Tips, guides, and stories from the island of the gods.</p>
              </div>
              <Link to="/blog" className="flex items-center gap-2 text-gray-900 font-black text-xs group border-b-2 border-secondary pb-2">
                Read all posts <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
    
            <div className="grid gap-8 md:grid-cols-3">
              {posts.map((post) => (
                <Link key={post.id} to={`/blog/${post.slug}`} className="group block">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-[10px] mb-6 shadow-xl shadow-gray-200/50">
                    <SmartImage 
                      src={post.featuredImage || `https://picsum.photos/seed/${post.slug}/800/600`}
                      alt={post.title}
                      className="group-hover:scale-110"
                      aspectRatio="auto"
                      width={600}
                      quality={80}
                    />
                    <div className="absolute top-4 left-4">
                      <span className="px-4 py-1.5 bg-primary text-white rounded-[10px] text-[10px] font-black uppercase tracking-widest shadow-sm">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
                      <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> {post.publishedAt?.toDate ? post.publishedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'}</span>
                      <span className="h-1 w-1 bg-gray-200 rounded-full" />
                      <span className="flex items-center gap-1.5"><User className="h-3 w-3" /> {post.author || 'Admin'}</span>
                    </div>
                    <h3 className="text-xl font-black text-gray-900 group-hover:text-primary transition-colors tracking-tight leading-tight line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-gray-500 font-medium line-clamp-2 leading-relaxed">
                      {post.excerpt}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
    }
  };

  return renderContent();
}
