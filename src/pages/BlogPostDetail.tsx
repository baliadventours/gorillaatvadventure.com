import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BlogPost, Tour } from '../types';
import TourCard from '../components/TourCard';
import { motion } from 'motion/react';
import * as Icons from 'lucide-react';
import { cn } from '../lib/utils';
import SmartImage from '../components/SmartImage';

import { Helmet } from 'react-helmet-async';
import { generateBlogSchema } from '../lib/seoUtils';
import { useSettings } from '../lib/SettingsContext';

function splitHtmlContent(html: string): [string, string] {
  if (!html) return ['', ''];
  const regex = /<\/p>/gi;
  const matches = [...html.matchAll(regex)];
  
  if (matches.length <= 2) {
    return [html, ''];
  }
  
  const midMatchIndex = Math.floor(matches.length / 2);
  const midMatch = matches[midMatchIndex];
  if (!midMatch || midMatch.index === undefined) {
    return [html, ''];
  }

  const splitPosition = midMatch.index + 4; // safety check: index is present
  const first = html.substring(0, splitPosition);
  const second = html.substring(splitPosition);
  
  return [first, second];
}

export default function BlogPostDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { settings } = useSettings();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentPosts, setRecentPosts] = useState<BlogPost[]>([]);
  const [allCategories, setAllCategories] = useState<{name: string, count: number}[]>([]);
  const [toc, setToc] = useState<{ level: number; text: string; id: string }[]>([]);
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [matchedTours, setMatchedTours] = useState<Tour[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  const siteUrl = window.location.origin;
  const siteName = settings?.siteName || 'Bali Adventours';
  const blogSchema = post ? generateBlogSchema(post, siteUrl, settings) : null;

  const blogTitle = post ? 
    (settings?.blogTitleFormat || '{{title}} - {{siteName}}')
      .replace('{{title}}', post.title)
      .replace('{{siteName}}', siteName) : 
    siteName;

  const seoDescription = post?.excerpt || (post?.content ? post.content.replace(/<[^>]*>/g, '').slice(0, 160) : post?.title);

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": siteUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Blog",
        "item": `${siteUrl}/blog`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": post?.title,
        "item": window.location.href
      }
    ]
  };

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;
      
      const q = query(
        collection(db, 'posts'),
        where('slug', '==', slug),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        const data = doc.data();
        if (['published', 'active'].includes(data.status || '')) {
          setPost({ id: doc.id, ...data } as BlogPost);
        }
      }
      setLoading(false);
    };

    const fetchSidebarData = async () => {
      const q = query(
        collection(db, 'posts'),
        where('status', 'in', ['published', 'active'])
      );
      const snapshot = await getDocs(q);
      const postsData = snapshot.docs.map(doc => doc.data() as BlogPost);
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
      setRecentPosts(postsData.slice(0, 5));
      
      const counts: Record<string, number> = {};
      postsData.forEach(p => {
        if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
      });
      setAllCategories(Object.entries(counts).map(([name, count]) => ({ name, count })));
    };

    fetchPost();
    fetchSidebarData();
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    const fetchRelatedTours = async () => {
      if (!post) return;
      try {
        const q = query(
          collection(db, 'tours'),
          where('status', 'in', ['published', 'active'])
        );
        const snapshot = await getDocs(q);
        const allTours = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tour));
        
        // Match attributes: tags, category, custom title tokens
        const searchTags = (post.tags || []).map(t => t.toLowerCase());
        const categoryKeyword = post.category ? post.category.toLowerCase() : '';
        const titleWords = post.title.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 3 && !['with', 'your', 'bali', 'tour', 'best', 'trip', 'travel', 'guide', 'from', 'each', 'what', 'where', 'when', 'them', 'that', 'this'].includes(w));
        
        const scoredTours = allTours.map(tour => {
          let score = 0;
          const tourTitleLower = tour.title.toLowerCase();
          const tourDescLower = tour.description ? tour.description.toLowerCase() : '';
          const tourHighlights = (tour.highlights || []).map(h => h.toLowerCase());
          
          // Match tags
          searchTags.forEach(tag => {
            if (tourTitleLower.includes(tag)) score += 5;
            if (tourDescLower.includes(tag)) score += 2;
            tourHighlights.forEach(h => {
              if (h.includes(tag)) score += 3;
            });
          });
          
          // Match category
          if (categoryKeyword) {
            if (tourTitleLower.includes(categoryKeyword)) score += 5;
            if (tourDescLower.includes(categoryKeyword)) score += 2;
          }
          
          // Match title words
          titleWords.forEach(word => {
            if (tourTitleLower.includes(word)) score += 4;
            if (tourDescLower.includes(word)) score += 1;
          });

          // Boost popular tours if there is matching affinity
          if (score > 0 && tour.isPopular) {
            score += 2;
          }
          
          // Boost higher rating tours
          if (score > 0 && tour.rating) {
            score += tour.rating / 5;
          }

          return { tour, score };
        });

        let finalSelection: Tour[] = [];
        const positivelyScored = scoredTours.filter(item => item.score > 0);
        
        if (positivelyScored.length > 0) {
          positivelyScored.sort((a, b) => b.score - a.score);
          finalSelection = positivelyScored.slice(0, 3).map(item => item.tour);
        }
        
        if (finalSelection.length < 3) {
          const popularTours = allTours
            .filter(t => !finalSelection.some(sel => sel.id === t.id))
            .sort((a, b) => {
              if (a.isPopular && !b.isPopular) return -1;
              if (!a.isPopular && b.isPopular) return 1;
              const ratingDiff = (b.rating || 0) - (a.rating || 0);
              if (ratingDiff !== 0) return ratingDiff;
              return (b.reviewsCount || 0) - (a.reviewsCount || 0);
            });
            
          const needed = 3 - finalSelection.length;
          finalSelection = [...finalSelection, ...popularTours.slice(0, needed)];
        }
        
        setMatchedTours(finalSelection.slice(0, 3));
      } catch (err) {
        console.error("Error fetching related tours for article:", err);
      }
    };
    
    fetchRelatedTours();
  }, [post]);

  // Extract TOC and assign IDs to headings after content is rendered
  useEffect(() => {
    if (!loading && post && contentRef.current) {
      const headingElements = contentRef.current.querySelectorAll('h1, h2, h3');
      const generatedToc: { level: number; text: string; id: string }[] = [];
      
      headingElements.forEach((el, index) => {
        const text = el.textContent || '';
        const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') || `heading-${index}`;
        el.setAttribute('id', id);
        el.classList.add('scroll-mt-24'); // Add smooth scroll offset
        
        const level = parseInt(el.tagName.substring(1));
        generatedToc.push({ level, text, id });
      });
      
      setToc(generatedToc);
    }
  }, [loading, post]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Icons.Loader2 className="h-12 w-12 text-primary animate-spin" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6 text-center">
        <Icons.FileQuestion className="h-20 w-20 text-gray-200 mb-6" />
        <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">Article Not Found</h1>
        <p className="text-gray-500 font-medium mb-8">The story you're looking for might have been moved or doesn't exist.</p>
        <Link to="/blog" className="px-8 py-4 bg-primary text-white font-black rounded-[10px] text-xs hover:bg-orange-700 transition-all">
          Back to blog
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen font-sans">
      <Helmet>
        <title>{blogTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={window.location.href} />
        <meta property="og:title" content={blogTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={post.featuredImage || settings?.ogImage || "https://i.ibb.co.com/pvLCVYkM/ALAS-HARUM8-optimized.webp"} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={blogTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={post.featuredImage || settings?.ogImage || "https://i.ibb.co.com/pvLCVYkM/ALAS-HARUM8-optimized.webp"} />
        {blogSchema && <script type="application/ld+json">{JSON.stringify(blogSchema)}</script>}
        <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>
      </Helmet>
      {/* Breadcrumbs */}
      <nav className="pt-24 pb-6 bg-white border-b border-gray-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <Link to="/" className="hover:text-primary transition-colors text-gray-500">Home</Link>
            <Icons.ChevronRight className="h-3 w-3" />
            <Link to="/blog" className="hover:text-primary transition-colors text-gray-500">Blog</Link>
            <Icons.ChevronRight className="h-3 w-3" />
            <span className="text-gray-300 truncate max-w-xs">{post.title}</span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 mb-8 tracking-tighter leading-[1.1]">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-6 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <Icons.User className="h-4 w-4 text-primary" />
                <span className="text-gray-900">{post.author || 'Bali Adventours'}</span>
              </div>
              <div className="flex items-center gap-2 border-l border-gray-100 pl-6">
                <Icons.Calendar className="h-4 w-4 text-primary" />
                <span className="text-gray-900">
                  {post.publishedAt?.toDate ? post.publishedAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2 border-l border-gray-100 pl-6">
                <Icons.Clock className="h-4 w-4 text-primary" />
                <span className="text-gray-900">3:08 pm</span>
              </div>
              <div className="flex items-center gap-2 border-l border-gray-100 pl-6">
                <Icons.MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-gray-900">No Comments</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content & Sidebar */}
      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_320px] gap-16">
            {/* Left Column: Post Content */}
            <div className="space-y-12">
              <div className="aspect-[16/9] w-full rounded-2xl overflow-hidden shadow-2xl shadow-gray-200">
                <SmartImage 
                  src={post.featuredImage || 'https://picsum.photos/seed/featured/1200/800'} 
                  alt={post.title}
                  aspectRatio="video"
                  width={1200}
                  quality={85}
                />
              </div>

              {(() => {
                const [firstHalf, secondHalf] = splitHtmlContent(post.content);
                return (
                  <div ref={contentRef} className="space-y-12">
                    <div 
                      className="prose prose-lg prose-orange max-w-none font-medium text-gray-600 leading-[1.8]
                        prose-headings:font-black prose-headings:text-gray-900 prose-headings:tracking-tight
                        prose-p:mb-8 prose-p:leading-relaxed
                        prose-img:rounded-2xl prose-img:shadow-xl prose-img:my-10
                        prose-ul:text-[15px] prose-li:my-1
                        prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-gray-50 prose-blockquote:py-6 prose-blockquote:px-8 prose-blockquote:rounded-r-2xl prose-blockquote:text-gray-900 prose-blockquote:italic
                      "
                      dangerouslySetInnerHTML={{ __html: firstHalf }}
                    />

                    {matchedTours.length > 0 && (
                      <div className="my-12 bg-gray-50/70 border border-gray-100/80 rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                          <div>
                            <span className="text-[#00A651] font-black text-[10px] uppercase tracking-wider bg-orange-50 px-3 py-1 rounded-full">
                              Featured Adventures
                            </span>
                            <h3 className="text-xl md:text-2xl font-black text-gray-900 mt-3 tracking-tight">
                              Recommended Trips For Your Journey
                            </h3>
                          </div>
                          <p className="text-[11px] text-gray-400 font-bold max-w-xs leading-relaxed">
                            Based on the locations, attractions, and activities mentioned in this article.
                          </p>
                        </div>

                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                          {matchedTours.map((tour, index) => (
                            <TourCard key={tour.id} tour={tour} index={index} variant="modern" />
                          ))}
                        </div>
                      </div>
                    )}

                    {secondHalf && (
                      <div 
                        className="prose prose-lg prose-orange max-w-none font-medium text-gray-600 leading-[1.8]
                          prose-headings:font-black prose-headings:text-gray-900 prose-headings:tracking-tight
                          prose-p:mb-8 prose-p:leading-relaxed
                          prose-img:rounded-2xl prose-img:shadow-xl prose-img:my-10
                          prose-ul:text-[15px] prose-li:my-1
                          prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:bg-gray-50 prose-blockquote:py-6 prose-blockquote:px-8 prose-blockquote:rounded-r-2xl prose-blockquote:text-gray-900 prose-blockquote:italic
                        "
                        dangerouslySetInnerHTML={{ __html: secondHalf }}
                      />
                    )}
                  </div>
                );
              })()}

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="pt-10 border-t border-gray-50 flex flex-wrap gap-2">
                  {post.tags.map(tag => (
                    <span key={tag} className="px-4 py-2 bg-gray-50 text-gray-500 font-bold text-[10px] rounded-lg border border-gray-100 hover:text-primary hover:border-primary transition-all cursor-pointer uppercase tracking-widest">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Sidebar */}
            <aside className="space-y-12">
              {/* Table of Contents */}
              {toc.length > 0 && (
                <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                  <button 
                    onClick={() => setIsTocOpen(!isTocOpen)}
                    className="w-full px-6 py-4 bg-gray-50 flex items-center justify-between group"
                  >
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Table of Contents</h3>
                    <Icons.ChevronDown className={cn("h-4 w-4 text-gray-400 transition-transform group-hover:text-gray-900", isTocOpen && "rotate-180")} />
                  </button>
                  <motion.div 
                    initial={false}
                    animate={{ height: isTocOpen ? 'auto' : 0, opacity: isTocOpen ? 1 : 0 }}
                    className="overflow-hidden"
                  >
                    <nav className="p-6 space-y-3 bg-white border-t border-gray-50">
                      {toc.map((item, idx) => (
                        <a 
                          key={idx} 
                          href={`#${item.id}`}
                          className={cn(
                            "flex items-start gap-2 text-sm font-medium transition-all hover:text-primary",
                            item.level === 3 ? "ml-4 text-gray-400" : (item.level === 1 ? "text-gray-900" : "text-gray-600")
                          )}
                        >
                          <span className="text-gray-300">●</span>
                          <span>{item.text}</span>
                        </a>
                      ))}
                    </nav>
                  </motion.div>
                </div>
              )}

              {/* Categories Sidebar */}
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-4">
                  Categories
                  <div className="h-px flex-1 bg-gray-100" />
                </h3>
                <div className="space-y-3">
                  {allCategories.map((cat, i) => (
                    <Link 
                      key={i} 
                      to={`/blog?category=${cat.name}`}
                      className="flex items-center gap-2 text-[13px] font-bold text-gray-600 hover:text-primary transition-all group"
                    >
                      <div className="w-1.5 h-1.5 bg-gray-200 rounded-[2px] transition-colors group-hover:bg-primary" />
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Recent Posts Sidebar */}
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-4">
                  Recent Posts
                  <div className="h-px flex-1 bg-gray-100" />
                </h3>
                <div className="space-y-6">
                  {recentPosts.map((rPost, i) => (
                    <Link key={i} to={`/blog/${rPost.slug}`} className="block group">
                      <h4 className="text-sm font-black text-gray-900 group-hover:text-primary transition-colors leading-snug mb-1">
                        {rPost.title}
                      </h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        {rPost.publishedAt?.toDate ? rPost.publishedAt.toDate().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recent'}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Archives Sidebar */}
              <div>
                <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-6 flex items-center gap-4">
                  Archives
                  <div className="h-px flex-1 bg-gray-100" />
                </h3>
                <div className="space-y-3">
                  {['November 2025', 'September 2025', 'August 2025', 'July 2025', 'June 2025', 'May 2025', 'January 2025'].map((month, i) => (
                    <Link 
                      key={i} 
                      to="/blog"
                      className="flex items-center gap-2 text-[13px] font-bold text-gray-600 hover:text-primary transition-all group"
                    >
                      <div className="w-1.5 h-1.5 bg-gray-200 rounded-[2px] transition-colors group-hover:bg-primary" />
                      {month}
                    </Link>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </div>
  );
}
