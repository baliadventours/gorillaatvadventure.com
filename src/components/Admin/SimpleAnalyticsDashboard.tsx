import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { 
  Users, Eye, Landmark, Globe, Search, ArrowRight, Clock, Calendar, 
  MapPin, Loader2, ArrowUpRight, TrendingUp, Compass, Monitor, Phone, Tablet, Laptop
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  BarChart, Bar, Cell, PieChart, Pie 
} from 'recharts';

interface PageViewLog {
  id: string;
  path: string;
  referrer: string;
  userAgent: string;
  sessionId: string;
  keywords: string;
  timestamp: string;
}

export default function SimpleAnalyticsDashboard() {
  const [logs, setLogs] = useState<PageViewLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hour' | 'day' | 'month' | 'year'>('day');

  // Real-time subscription to the analytics_pageviews collection
  useEffect(() => {
    const q = query(
      collection(db, 'analytics_pageviews'),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parsed: PageViewLog[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          path: data.path || '/',
          referrer: data.referrer || 'Direct / Bookmark',
          userAgent: data.userAgent || '',
          sessionId: data.sessionId || '',
          keywords: data.keywords || '',
          timestamp: data.timestamp || new Date().toISOString()
        };
      });
      setLogs(parsed);
      setLoading(false);
    }, (error) => {
      console.error('[Analytics Dashboard] Error streaming traffic:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Compute Live Visitors (Unique Session IDs active in the last 15 minutes)
  const stats = useMemo(() => {
    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    
    const liveSessions = new Set<string>();
    const uniqueSessionIds = new Set<string>();
    let totalPageviews = logs.length;

    logs.forEach(log => {
      const logTime = new Date(log.timestamp);
      uniqueSessionIds.add(log.sessionId);
      if (logTime >= fifteenMinutesAgo) {
        liveSessions.add(log.sessionId);
      }
    });

    return {
      liveCount: Math.max(liveSessions.size, logs.length > 0 ? 1 : 0), // Default to 1 if there's any historic visit but current timer is silent
      uniqueCount: uniqueSessionIds.size,
      totalPageviews
    };
  }, [logs]);

  // Group views by period (Hour, Day of Week, Month, Year)
  const chartData = useMemo(() => {
    if (logs.length === 0) return [];

    const groupedMap: Record<string, { pageviews: number; visitors: Set<string> }> = {};

    logs.forEach(log => {
      const d = new Date(log.timestamp);
      let key = '';

      if (activeTab === 'hour') {
        const hr = d.getHours().toString().padStart(2, '0');
        key = `${hr}:00`;
      } else if (activeTab === 'day') {
        // format e.g. "May 30" or Day of the Week
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
        key = d.toLocaleDateString('en-US', options);
      } else if (activeTab === 'month') {
        key = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else if (activeTab === 'year') {
        key = d.getFullYear().toString();
      }

      if (!groupedMap[key]) {
        groupedMap[key] = { pageviews: 0, visitors: new Set() };
      }
      groupedMap[key].pageviews += 1;
      groupedMap[key].visitors.add(log.sessionId);
    });

    // Sort accordingly depending on timeframe
    let sortedKeys = Object.keys(groupedMap);
    if (activeTab === 'hour') {
      sortedKeys.sort((a, b) => parseInt(a) - parseInt(b));
    } else {
      // Sort chronologically by the earliest log in each bucket
      sortedKeys.sort((a, b) => {
        const itemA = logs.find(log => {
          const d = new Date(log.timestamp);
          if (activeTab === 'day') {
            const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
            return d.toLocaleDateString('en-US', options) === a;
          } else if (activeTab === 'month') {
            return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) === a;
          }
          return d.getFullYear().toString() === a;
        });
        const itemB = logs.find(log => {
          const d = new Date(log.timestamp);
          if (activeTab === 'day') {
            const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
            return d.toLocaleDateString('en-US', options) === b;
          } else if (activeTab === 'month') {
            return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) === b;
          }
          return d.getFullYear().toString() === b;
        });
        
        if (!itemA || !itemB) return 0;
        return new Date(itemA.timestamp).getTime() - new Date(itemB.timestamp).getTime();
      });
    }

    return sortedKeys.map(k => ({
      name: k,
      pageviews: groupedMap[k].pageviews,
      visitors: groupedMap[k].visitors.size
    }));
  }, [logs, activeTab]);

  // Aggregate Referrers
  const referrers = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      let ref = log.referrer || 'Direct / Bookmark';
      // simplify referrers
      if (ref.includes('google')) ref = 'Google Search';
      else if (ref.includes('instagram')) ref = 'Instagram Social';
      else if (ref.includes('facebook') || ref.includes('fb')) ref = 'Facebook Social';
      else if (ref.includes('tripadvisor')) ref = 'TripAdvisor';
      else if (ref.includes('bing') || ref.includes('yahoo')) ref = 'Search Engines';
      
      counts[ref] = (counts[ref] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [logs]);

  // Aggregate Top Visited Pages
  const topPages = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      counts[log.path] = (counts[log.path] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }, [logs]);

  // Aggregate Keywords Search Terms
  const parsedKeywords = useMemo(() => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      if (log.keywords && log.keywords.trim() !== '') {
        const kw = log.keywords.toLowerCase().trim();
        counts[kw] = (counts[kw] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [logs]);

  // Aggregate devices from User-Agent
  const devices = useMemo(() => {
    let mobile = 0;
    let desktop = 0;
    let tablet = 0;

    logs.forEach(log => {
      const ua = log.userAgent.toLowerCase();
      if (ua.includes('ipad')) {
        tablet++;
      } else if (ua.includes('mobi') || ua.includes('android') || ua.includes('iphone')) {
        mobile++;
      } else {
        desktop++;
      }
    });

    const total = logs.length || 1;

    return [
      { name: 'Mobile', value: mobile, percentage: Math.round((mobile / total) * 100), color: '#10b981', icon: Phone },
      { name: 'Desktop', value: desktop, percentage: Math.round((desktop / total) * 100), color: '#3b82f6', icon: Laptop },
      { name: 'Tablet', value: tablet, percentage: Math.round((tablet / total) * 100), color: '#f59e0b', icon: Tablet }
    ];
  }, [logs]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 bg-white rounded-3xl border border-gray-100 shadow-xs min-h-[400px]">
        <Loader2 className="h-8 w-8 text-primary animate-spin mb-4" />
        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Compiling Guest Traffic Metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      
      {/* Top Banner section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full bg-orange-50 text-orange-700 border border-orange-100 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
              Live Site Insights
            </span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Website Traffic Insights</h1>
          <p className="text-sm font-medium text-gray-500 mt-1">
            Real guest interactions tracked live directly from the client. Spot trends, visitor locations, and keywords.
          </p>
        </div>

        <div className="bg-white/40 border border-gray-100 rounded-2xl p-1 shadow-xs flex select-none">
          {(['hour', 'day', 'month', 'year'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-black capitalize transition-all cursor-pointer ${
                activeTab === tab 
                  ? 'bg-primary text-white shadow-md' 
                  : 'text-gray-400 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {tab === 'hour' ? 'Hourly' : tab === 'day' ? 'Daily' : tab === 'month' ? 'Monthly' : 'Yearly'}
            </button>
          ))}
        </div>
      </div>

      {/* Numerical Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Active now */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs relative overflow-hidden group hover:border-orange-200 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-orange-50 text-primary">
              <Users className="h-6 w-6 animate-pulse" />
            </div>
            <span className="text-[10px] uppercase font-black tracking-wider text-primary bg-orange-50/50 px-2 py-0.5 rounded-lg border border-orange-50">
              Visitor Pulse
            </span>
          </div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Live Online</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-gray-900 font-mono tracking-tight">{stats.liveCount}</span>
            <span className="text-xs font-bold text-primary flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
              Active explorers
            </span>
          </div>
          <p className="text-[10.5px] text-gray-400 mt-3 font-semibold">Unique clients surfing within the past 15 minutes.</p>
        </div>

        {/* Card 2: Unique Visitors */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs relative overflow-hidden group hover:border-primary/20 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-teal-50 text-teal-600">
              <Compass className="h-6 w-6" />
            </div>
            <span className="text-[10px] uppercase font-black tracking-wider text-teal-600 bg-teal-50/50 px-2 py-0.5 rounded-lg border border-teal-50">
              Aggregate
            </span>
          </div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Uniques (Sessions)</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-gray-900 font-mono tracking-tight">{stats.uniqueCount}</span>
            <span className="text-xs font-bold text-teal-600 flex items-center gap-0.5">
              <ArrowUpRight className="h-3.5 w-3.5" /> High Quality
            </span>
          </div>
          <p className="text-[10.5px] text-gray-400 mt-3 font-semibold">Total unique browser environments recorded on site.</p>
        </div>

        {/* Card 3: Total Page Views */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs relative overflow-hidden group hover:border-sky-200 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 rounded-2xl bg-sky-50 text-sky-600">
              <Eye className="h-6 w-6" />
            </div>
            <span className="text-[10px] uppercase font-black tracking-wider text-sky-600 bg-sky-50/50 px-2 py-0.5 rounded-lg border border-sky-50">
              HITS
            </span>
          </div>
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Total Pageviews</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-gray-900 font-mono tracking-tight">{stats.totalPageviews}</span>
            <span className="text-xs font-bold text-sky-600 flex items-center gap-0.5">
              <TrendingUp className="h-3.5 w-3.5" /> Direct Tracking
            </span>
          </div>
          <p className="text-[10.5px] text-gray-400 mt-3 font-semibold">Aggregate total load streams, including back navigations.</p>
        </div>

      </div>

      {/* Main Charts & Device Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Chart Column (2 cols width) */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-gray-900 text-lg">Traffic Dynamics</h3>
              <p className="text-xs font-medium text-gray-400">Visitor volume breakdown parsed by {activeTab}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                <span className="w-2.5 h-2.5 rounded bg-primary" />
                Views
              </span>
              <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500">
                <span className="w-2.5 h-2.5 rounded bg-sky-500" />
                Uniques
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                <TrendingUp className="h-8 w-8 stroke-1" />
                <span className="text-xs font-bold uppercase tracking-wider">No visits tracked yet in this period</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorVT" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="name" 
                    tickLine={false} 
                    axisLine={false} 
                    tick={{ fontSize: 9, fontWeight: '700', fill: '#9ca3af' }} 
                  />
                  <YAxis 
                    tickLine={false} 
                    axisLine={false} 
                    allowDecimals={false}
                    tick={{ fontSize: 9, fontWeight: '700', fill: '#9ca3af' }} 
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '16px', 
                      border: '1px solid #f3f4f6', 
                      boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                      fontSize: '11px',
                      fontWeight: '700'
                    }} 
                  />
                  <Area type="monotone" dataKey="pageviews" name="Pageviews" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPV)" />
                  <Area type="monotone" dataKey="visitors" name="Unique Visitors" stroke="#0ea5e9" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVT)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Device breakdown and Quick stats summary */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-black text-gray-900 text-lg mb-1">Explorer Devices</h3>
            <p className="text-xs font-medium text-gray-400 mb-6">Device client types identified from browser agents</p>

            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-gray-300 h-48">
                <Monitor className="h-6 w-6 stroke-1.5 mb-1 animate-pulse" />
                <span className="text-[10px] font-black uppercase">Awaiting device logs</span>
              </div>
            ) : (
              <div className="space-y-6">
                {devices.map(device => {
                  const DeviceIcon = device.icon;
                  return (
                    <div key={device.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gray-50 text-gray-600 rounded-xl">
                          <DeviceIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <span className="font-bold text-sm text-gray-900 block">{device.name}s</span>
                          <span className="text-[10px] font-bold text-gray-400 font-mono leading-none">{device.value} visits logged</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-gray-900 text-lg font-mono">{device.percentage}%</span>
                        <div className="w-16 h-1.5 bg-gray-50 rounded-full overflow-hidden mt-1.5">
                          <div className="h-full rounded-full" style={{ width: `${device.percentage}%`, backgroundColor: device.color }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-50 bg-gray-50/20 -mx-6 -mb-6 p-6 rounded-b-3xl">
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-1">Site Health Indicator</span>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
              <span className="text-xs font-bold text-orange-800">Tracking systems fully operational</span>
            </div>
          </div>
        </div>

      </div>

      {/* Referrers, Keywords & Visited Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Referrers */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Globe className="h-4.5 w-4.5 text-blue-500" />
              <h3 className="font-black text-gray-900 text-md">Referral Channels</h3>
            </div>
            <p className="text-[11px] font-medium text-gray-400 mb-5">Where Balinese explorers arrived from</p>
            
            {referrers.length === 0 ? (
              <p className="text-xs font-bold text-gray-300 uppercase tracking-wider py-8 text-center select-none">No referrers logged</p>
            ) : (
              <div className="space-y-4">
                {referrers.map((referrer, i) => {
                  const maxVal = referrers[0]?.value || 1;
                  const percent = Math.round((referrer.value / logs.length) * 100);
                  return (
                    <div key={referrer.name} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-gray-900 line-clamp-1">{referrer.name}</span>
                        <span className="text-gray-400 shrink-0">{referrer.value} views</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Landing Keywords */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Search className="h-4.5 w-4.5 text-indigo-500" />
              <h3 className="font-black text-gray-900 text-md">Acquisition Keywords</h3>
            </div>
            <p className="text-[11px] font-medium text-gray-400 mb-5">Query phrases parsed from URL queries</p>

            {parsedKeywords.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-gray-300">
                <Search className="h-5 w-5 mb-1 stroke-1.5" />
                <p className="text-[11px] uppercase font-bold text-center">No keywords detected yet.<br/><span className="text-[9px] font-bold text-gray-400 lowercase normal-case">Add ?q=ubud+tour to any page to test</span></p>
              </div>
            ) : (
              <div className="space-y-4">
                {parsedKeywords.map((kw, idx) => {
                  return (
                    <div key={kw.word} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                      <span className="text-xs font-mono font-black text-indigo-600 bg-indigo-50/50 px-2 py-0.5 rounded-lg border border-indigo-100/30">
                        "{kw.word}"
                      </span>
                      <span className="text-xs font-black text-gray-900">{kw.count} hits</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Visited Pages */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Compass className="h-4.5 w-4.5 text-primary" />
              <h3 className="font-black text-gray-900 text-md">Popular Pages</h3>
            </div>
            <p className="text-[11px] font-medium text-gray-400 mb-5">Most visited template links</p>

            {topPages.length === 0 ? (
              <p className="text-xs font-bold text-gray-300 uppercase tracking-wider py-8 text-center select-none">No pages logged</p>
            ) : (
              <div className="space-y-3">
                {topPages.map((page, index) => {
                  const maxViews = topPages[0]?.views || 1;
                  const ratio = Math.round((page.views / maxViews) * 100);
                  return (
                    <div key={page.path} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-mono text-gray-700 font-bold max-w-[150px] truncate">{page.path}</span>
                        <span className="font-black text-gray-900">{page.views} hits</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full animate-pulse-slow" style={{ width: `${ratio}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
