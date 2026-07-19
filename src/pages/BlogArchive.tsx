import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BlogPost } from '../types';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../lib/SettingsContext';
import { Helmet } from 'react-helmet-async';
import { formatPageTitle } from '../lib/seoUtils';

export default function BlogArchive() {
  const { settings } = useSettings();
  const pageTitle = formatPageTitle('Travel Stories', settings?.siteName || 'Bali Adventours', settings?.pageTitleFormat);
  
  const themeMode = settings?.themeMode || 'default';
  const styleId = themeMode === 'custom' ? settings?.sectionStyles?.blogPage : 'default';

  const location = useLocation();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category');
    if (cat) {
      setSelectedCategory(cat);
    } else {
      setSelectedCategory('All');
    }
  }, [location.search]);

  const categories = ['All', ...new Set(posts.map(post => post.category))].filter(Boolean);

  const filteredPosts = selectedCategory === 'All' 
    ? posts 
    : posts.filter(post => post.category === selectedCategory);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('status', 'in', ['published', 'active'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));
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
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("[BlogArchive Snapshot Error]:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Icons.Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    );
  }

  if (styleId === 'airbnb') {
    return (
      <div className="min-h-screen bg-white">
         <Helmet><title>{pageTitle}</title></Helmet>
         <div className="container mx-auto px-4 lg:px-8 pt-32 pb-20">
            <h1 className="text-4xl font-bold text-gray-900 mb-12">Travel Stories</h1>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
               {posts.map(post => (
                  <Link key={post.id} to={`/blog/${post.slug}`} className="group block">
                     <div className="relative aspect-square overflow-hidden rounded-2xl mb-4">
                        <img src={post.featuredImage} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                     </div>
                     <h3 className="font-bold text-gray-900 group-hover:underline">{post.title}</h3>
                     <p className="text-gray-500 text-sm mt-2 line-clamp-2">{post.excerpt}</p>
                  </Link>
               ))}
            </div>
         </div>
      </div>
    );
  }

  if (styleId === 'modern' || styleId === 'saas') {
     return (
        <div className="min-h-screen bg-[#fafafa]">
           <Helmet><title>{pageTitle}</title></Helmet>
           <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-40 pb-24">
              <div className="mb-20">
                 <h1 className="text-6xl md:text-9xl font-black text-gray-900 tracking-tighter leading-[0.8] mb-8">The <br /> Journal.</h1>
                 <div className="flex gap-4 overflow-x-auto pb-4 pt-8 border-t border-gray-100">
                    {categories.map(cat => (
                       <button key={cat} onClick={() => setSelectedCategory(cat)} className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap", selectedCategory === cat ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-400 border-gray-100 hover:border-gray-900")}>{cat}</button>
                    ))}
                 </div>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                 {filteredPosts.map(post => (
                    <Link key={post.id} to={`/blog/${post.slug}`} className="group bg-white p-4 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all">
                       <div className="relative aspect-[16/10] overflow-hidden rounded-[2rem] mb-6">
                          <img src={post.featuredImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                       </div>
                       <div className="px-4 pb-4">
                          <span className="text-[10px] font-black uppercase tracking-widest text-[#00A651] mb-2 block">{post.category}</span>
                          <h3 className="text-xl font-bold text-gray-900 mb-4 line-clamp-2 leading-[1.1]">{post.title}</h3>
                          <div className="mt-8 pt-6 border-t border-gray-50 flex items-center justify-between">
                             <div className="h-10 w-10 rounded-full bg-[#fafafa] flex items-center justify-center -rotate-45 group-hover:rotate-0 transition-transform">
                                <Icons.ArrowRight className="h-4 w-4 text-gray-900" />
                             </div>
                             <span className="text-[10px] font-black uppercase tracking-widest text-gray-300">Read Article</span>
                          </div>
                       </div>
                    </Link>
                 ))}
              </div>
           </div>
        </div>
     );
  }

  return (
    <div className="bg-white min-h-screen font-sans">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={`Discover travel stories, tips, and inspiration for your next Bali adventure from the experts at ${settings?.siteName || 'Bali Adventours'}.`} />
      </Helmet>
      {/* Header Section */}
      <section className="pt-32 pb-12 text-center border-b border-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight"
          >
            Travel Inspiration
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg text-gray-500 max-w-2xl mx-auto font-medium"
          >
            Discover the best of Bali through our guides, tips, and local insights
          </motion.p>
        </div>
      </section>

      {/* Category Filter */}
      <section className="py-8 border-b border-gray-50 sticky top-[72px] bg-white/80 backdrop-blur-md z-[40]">
        <div className="max-w-7xl mx-auto px-6 overflow-x-auto">
          <div className="flex gap-3 min-w-max">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-5 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap",
                  selectedCategory === cat 
                    ? "bg-gray-900 text-white shadow-lg shadow-gray-200" 
                    : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Blog Content */}
      <section className="py-16 max-w-7xl mx-auto px-6">
        {filteredPosts.length > 0 ? (
          <div className="space-y-24">
            {/* Featured Articles */}
            {selectedCategory === 'All' && (
              <div>
                <h2 className="text-2xl font-black text-gray-900 mb-10">Featured Articles</h2>
                <div className="grid md:grid-cols-2 gap-12">
                  {posts.slice(0, 2).map((post, idx) => (
                    <motion.article 
                      key={post.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="group"
                    >
                      <Link to={`/blog/${post.slug}`}>
                        <div className="relative aspect-[16/9] overflow-hidden rounded-3xl mb-6 shadow-2xl shadow-gray-200/50">
                          <img 
                            src={post.featuredImage || `https://picsum.photos/seed/${post.slug}/1200/800`} 
                            alt={post.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                            <span>{post.category}</span>
                            <span className="h-1 w-1 bg-gray-200 rounded-full" />
                            <span className="flex items-center gap-1">
                              <Icons.Calendar className="h-3.5 w-3.5" />
                              {post.publishedAt?.toDate ? post.publishedAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recent'}
                            </span>
                          </div>
                          <h3 className="text-3xl font-black text-gray-900 group-hover:text-primary transition-colors tracking-tight leading-[1.1]">
                            {post.title}
                          </h3>
                          <p className="text-gray-500 font-medium text-base leading-relaxed line-clamp-2">
                            {post.excerpt}
                          </p>
                          <p className="text-xs font-bold text-gray-400">
                             {post.publishedAt?.toDate ? post.publishedAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Draft'}
                          </p>
                        </div>
                      </Link>
                    </motion.article>
                  ))}
                </div>
              </div>
            )}

            {/* Latest Articles Grid */}
            <div>
              <h2 className="text-2xl font-black text-gray-900 mb-10">
                {selectedCategory === 'All' ? 'Latest Articles' : `${selectedCategory} Articles`}
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16">
                {(selectedCategory === 'All' ? filteredPosts.slice(2) : filteredPosts).map((post, idx) => (
                  <motion.article 
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex flex-col group"
                  >
                    <Link to={`/blog/${post.slug}`}>
                      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl mb-6 shadow-xl shadow-gray-100">
                        <img 
                          src={post.featuredImage || `https://picsum.photos/seed/${post.slug}/800/600`} 
                          alt={post.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 flex flex-col">
                        <div className="mb-4">
                          <span className="px-3 py-1 bg-gray-50 text-gray-500 font-bold text-[9px] rounded-lg uppercase tracking-widest border border-gray-100">
                            {post.category}
                          </span>
                        </div>
                        <h3 className="text-xl font-black text-gray-900 group-hover:text-primary transition-colors leading-tight mb-4 line-clamp-2">
                          {post.title}
                        </h3>
                        <p className="text-sm text-gray-500 font-medium leading-relaxed line-clamp-2 mb-4">
                          {post.excerpt}
                        </p>
                        <div className="mt-auto flex items-center gap-2 text-gray-400 font-bold text-[10px]">
                          <Icons.Clock className="h-3.5 w-3.5" />
                          <span>{post.publishedAt?.toDate ? post.publishedAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recent'}</span>
                        </div>
                      </div>
                    </Link>
                  </motion.article>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-40 text-center">
             <Icons.Inbox className="h-16 w-16 text-gray-200 mx-auto mb-6" />
             <h3 className="text-2xl font-black text-gray-900 mb-2">No Stories Yet</h3>
             <p className="text-gray-500 font-medium">We're currently writing some amazing content for you. Check back soon!</p>
          </div>
        )}
      </section>

      {/* Newsletter Section */}
      <section className="py-24 bg-gray-900 relative overflow-hidden mx-6 rounded-[10px] mb-24">
         <div className="absolute inset-0 bg-primary opacity-10 mix-blend-overlay" />
         <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">Stay in the Loop</h2>
            <p className="text-orange-100/70 font-bold mb-10 text-lg">Get the latest travel tips and exclusive Bali offers delivered to your inbox.</p>
            <form className="flex flex-col md:flex-row gap-4 max-w-lg mx-auto">
               <input 
                 type="email" 
                 placeholder="Your email address" 
                 className="flex-1 px-8 py-5 rounded-[10px] bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:bg-white/20 transition-all font-bold"
               />
               <button className="px-10 py-5 bg-primary text-white font-black rounded-[10px] hover:bg-orange-700 transition-all shadow-xl shadow-orange-950 text-xs">
                 Subscribe
               </button>
            </form>
         </div>
      </section>
    </div>
  );
}
