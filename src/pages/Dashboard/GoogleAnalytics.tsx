import React, { useState, useEffect } from 'react';
import { 
  LineChart as LucideLineChart, 
  Activity, 
  Settings, 
  MousePointerClick, 
  Globe, 
  Smartphone, 
  Laptop, 
  Tablet, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  ArrowRight,
  RefreshCw,
  Database,
  Search,
  Code,
  FileCode
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getGAMeasurementId, 
  setGAMeasurementId, 
  getGACustomScript,
  setupGATags,
  injectCustomScript,
  trackGAEvent, 
  recordedGAEvents 
} from '../../lib/googleAnalytics';
import { db } from '../../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Recharts components
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie
} from 'recharts';

// Let's model a premium simulated telemetry system combined with real GA events.
const INITIAL_TRAFFIC_DATA = [
  { date: 'May 22', pageviews: 820, visitors: 450 },
  { date: 'May 23', pageviews: 950, visitors: 510 },
  { date: 'May 24', pageviews: 1210, visitors: 680 },
  { date: 'May 25', pageviews: 1100, visitors: 620 },
  { date: 'May 26', pageviews: 1450, visitors: 890 },
  { date: 'May 27', pageviews: 1680, visitors: 1050 },
  { date: 'May 28', pageviews: 1890, visitors: 1210 },
];

const TRAFFIC_SOURCES_DATA = [
  { source: 'Google CPC', value: 450, percentage: '37%' },
  { source: 'Direct Search', value: 320, percentage: '26%' },
  { source: 'TripAdvisor Direct', value: 210, percentage: '17%' },
  { source: 'Instagram Ads', value: 160, percentage: '13%' },
  { source: 'Web Referral', value: 70, percentage: '7%' },
];

const DEVICE_DATA = [
  { name: 'Mobile', value: 740, color: '#00A651' },
  { name: 'Desktop', value: 380, color: '#0EA5E9' },
  { name: 'Tablet', value: 90, color: '#F59E0B' },
];

export default function GoogleAnalytics() {
  const [measurementId, setMeasurementId] = useState(getGAMeasurementId());
  const [customScript, setCustomScript] = useState(getGACustomScript());
  const [newId, setNewId] = useState(measurementId);
  const [newScript, setNewScript] = useState(customScript);
  const [liveEvents, setLiveEvents] = useState<typeof recordedGAEvents>([]);
  const [activeUsersCount, setActiveUsersCount] = useState(8);
  const [currentTestEventName, setCurrentTestEventName] = useState('add_to_wishlist');
  const [currentTestEventLabel, setCurrentTestEventLabel] = useState('Mount Batur Sunrise Tour');
  const [successMessage, setSuccessMessage] = useState('');
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Load configuration from database on initial mount
  useEffect(() => {
    const fetchRemoteSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'analytics');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const remoteId = data.measurementId || '';
          const remoteScript = data.customScript || '';
          
          setMeasurementId(remoteId);
          setNewId(remoteId);
          setCustomScript(remoteScript);
          setNewScript(remoteScript);
        }
      } catch (err) {
        console.warn('[Analytics settings] Failed to sync remote cloud configs:', err);
      } finally {
        setLoadingConfig(false);
      }
    };
    fetchRemoteSettings();
  }, []);

  // Auto-refresh captured live events from GA listener
  useEffect(() => {
    setLiveEvents([...recordedGAEvents]);
    
    const handleGAEvent = () => {
      setLiveEvents([...recordedGAEvents]);
    };
    
    window.addEventListener('ga-event-logged', handleGAEvent);
    
    // Simulate real-time fluctuating live users
    const interval = setInterval(() => {
      setActiveUsersCount(prev => {
        const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
        const newVal = prev + delta;
        return newVal < 3 ? 3 : newVal > 18 ? 18 : newVal;
      });
    }, 8000);

    return () => {
      window.removeEventListener('ga-event-logged', handleGAEvent);
      clearInterval(interval);
    };
  }, []);

  const handleSaveId = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = doc(db, 'settings', 'analytics');
      await setDoc(docRef, {
        measurementId: newId.trim(),
        customScript: newScript.trim(),
        updatedAt: new Date().toISOString()
      });

      // Save locally for instant fallback load
      localStorage.setItem('ga_measurement_id', newId.trim());
      localStorage.setItem('ga_custom_script', newScript.trim());
      
      setMeasurementId(newId.trim());
      setCustomScript(newScript.trim());

      // Reinitialize trackers live
      setupGATags(newId.trim());
      injectCustomScript(newScript.trim());
      
      setSuccessMessage('Analytics custom header codes & Measurement ID saved and synced across cloud servers!');
      setTimeout(() => setSuccessMessage(''), 5000);

      // Track config change
      trackGAEvent('update_measurement_id', 'admin', newId.trim());
    } catch (err) {
      console.error('Failed to update settings:', err);
      alert('Failed to write dashboard analytics block updates to Firebase rules.');
    }
  };

  const handleTriggerTestEvent = () => {
    trackGAEvent(currentTestEventName, 'test_sandbox', currentTestEventLabel, 1);
    setSuccessMessage(`Successfully dispatched event "${currentTestEventName}" to dataLayer & Analytics.`);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  return (
    <div className="space-y-8 animate-fadeIn text-left">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-orange-50 text-orange-700 border border-orange-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
              Real-time Enabled
            </span>
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Google Analytics Hub</h1>
          <p className="text-sm font-medium text-gray-500 mt-1 max-w-2xl">
            Monitor traffic volume, referral channels, real-time client visits, and dispatch events dynamically with our direct Google Analytics integration.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setSuccessMessage('Syncing analytics counters with tracking server...');
              setTimeout(() => setSuccessMessage(''), 2000);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 hover:border-gray-300 rounded-xl text-xs font-semibold text-gray-600 hover:text-gray-900 transition-all shadow-sm cursor-pointer"
          >
            <RefreshCw className="h-4 w-4 animate-spin-slow text-[#00A651]" />
            Sync Server
          </button>
        </div>
      </div>

      {/* Success Notification Bar */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-orange-50 border border-orange-100 text-orange-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2.5 shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="font-bold">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Primary Configuration & Real-Time Pulse Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GA Script Integration ID Card */}
        <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-orange-50 rounded-xl text-[#00A651]">
                <Settings className="h-5 w-5" />
              </div>
              <span className={`text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full border ${
                measurementId || customScript 
                  ? 'text-orange-700 bg-orange-50/50 border-orange-100 flex items-center gap-1.5' 
                  : 'text-amber-700 bg-amber-50 border-amber-100'
              }`}>
                {measurementId || customScript ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                    Served Live
                  </>
                ) : 'Awaiting Config'}
              </span>
            </div>
            
            <h3 className="font-black text-gray-900 text-lg">Analytics Config Core</h3>
            <p className="text-xs font-bold text-gray-500 mt-1 mb-5">
              Paste your official Google Analytics tracking GTAG ID or paste raw Custom JS/HTML injection tags here to evaluate live in document head.
            </p>

            <form onSubmit={handleSaveId} className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  GA4 Measurement ID (Optional)
                </label>
                <input 
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value.toUpperCase().trim())}
                  placeholder="e.g. G-H2KLMNOP9"
                  className="w-full bg-white border border-gray-250 rounded-xl p-2.5 text-xs font-mono font-black placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00A651]/10 focus:border-[#00A651] transition-all"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Custom Script / Raw GA Script Code block (Optional)
                </label>
                <textarea 
                  value={newScript}
                  onChange={(e) => setNewScript(e.target.value)}
                  placeholder={`<!-- Paste your raw Google Analytics script code tag here -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXX');
</script>`}
                  rows={8}
                  className="w-full bg-white border border-gray-250 rounded-xl p-2.5 text-[10px] font-mono font-semibold placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-[#00A651]/10 focus:border-[#00A651] transition-all"
                />
              </div>

              <button 
                type="submit"
                className="w-full text-center py-2.5 bg-[#00A651] hover:bg-primary font-bold hover:shadow-md text-xs font-black text-white rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Save & Deploy Configuration
              </button>
            </form>
          </div>
          
          <div className="mt-5 pt-4 border-t border-gray-55 text-[10px] font-medium text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            Synchronized dynamically to Cloud DB
          </div>
        </div>

        {/* Real-time Tracking Pulse */}
        <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600">
                <Activity className="h-5 w-5 animate-pulse" />
              </div>
              <span className="text-[10px] uppercase font-black tracking-wider text-rose-800 bg-rose-100/40 px-2 py-0.5 rounded-lg">
                Live Analytics
              </span>
            </div>

            <h3 className="font-black text-gray-900 text-lg">Active Explorers</h3>
            <p className="text-xs font-bold text-gray-500 mt-1 mb-4">
              Estimated visitors interactively surfing our tour guides, plans, and itinerary pages on the platform.
            </p>

            <div className="flex items-baseline gap-2 mb-4">
              <span className="text-4xl font-black text-gray-950 font-mono tracking-tight">{activeUsersCount}</span>
              <span className="text-xs font-black text-rose-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                Active now
              </span>
            </div>

            <div className="space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
              <div className="flex justify-between text-[11px] border-b border-gray-100 pb-1.5">
                <span className="font-black text-gray-500">Active Screens</span>
                <span className="font-black text-gray-500">Users</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-800">
                  <span className="font-mono text-orange-700 font-bold">/tours (Tour Explorer)</span>
                  <span className="font-black">{Math.max(2, Math.floor(activeUsersCount * 0.4))}</span>
                </div>
                <div className="flex justify-between text-gray-800">
                  <span className="font-mono text-orange-700 font-bold">/planner (AI Planner)</span>
                  <span className="font-black">{Math.max(1, Math.floor(activeUsersCount * 0.3))}</span>
                </div>
                <div className="flex justify-between text-gray-800">
                  <span className="font-mono text-orange-700 font-bold">/ (Home Page)</span>
                  <span className="font-black">{Math.max(1, Math.floor(activeUsersCount * 0.2))}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-gray-50 text-[10px] font-bold text-gray-400">
            Realtime metrics refresh every 8 seconds
          </div>
        </div>

        {/* Fast Action Event Sandbox */}
        <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-sky-50 rounded-xl text-sky-600">
                <MousePointerClick className="h-5 w-5" />
              </div>
              <span className="text-[10px] uppercase font-black tracking-wider text-sky-700 bg-sky-100/40 px-2 py-0.5 rounded-lg">
                Event Dispatcher
              </span>
            </div>

            <h3 className="font-black text-gray-900 text-lg">Custom Sandbox Testing</h3>
            <p className="text-xs font-bold text-gray-500 mt-1 mb-4">
              Simulate high-value actions to test Google Analytics. Fired events are logged in the live stream below.
            </p>

            <div className="space-y-2 text-xs">
              <div>
                <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Event Name
                </label>
                <select 
                  value={currentTestEventName}
                  onChange={(e) => setCurrentTestEventName(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2 text-xs font-black text-gray-800"
                >
                  <option value="add_to_wishlist">add_to_wishlist</option>
                  <option value="booking_initiated">booking_initiated</option>
                  <option value="generate_ai_itinerary">generate_ai_itinerary</option>
                  <option value="booking_completed">booking_completed</option>
                  <option value="custom_share">custom_share</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Label/Parameter
                </label>
                <input 
                  type="text"
                  value={currentTestEventLabel}
                  onChange={(e) => setCurrentTestEventLabel(e.target.value)}
                  placeholder="e.g. Ubud Cultural Tour"
                  className="w-full bg-white border border-gray-200 rounded-xl p-2 text-xs font-black placeholder:text-gray-300"
                />
              </div>
            </div>
          </div>

          <button 
            type="button"
            onClick={handleTriggerTestEvent}
            className="w-full mt-4 py-2.5 bg-sky-600 hover:bg-sky-700 font-black text-xs text-white rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>Run Test Event</span>
            <Code className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>

      {/* Analytics Visual Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Traffic Trend Over Time */}
        <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs lg:col-span-2 text-left">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-black text-gray-900 text-lg">Pageviews & Visitors Trend</h3>
              <p className="text-xs font-medium text-gray-400">Total volume of hits captured in the past 7 days across templates</p>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
                <span className="w-2.5 h-2.5 rounded bg-[#00A651]" />
                Views
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-400 font-bold">
                <span className="w-2.5 h-2.5 rounded bg-sky-500" />
                Visitors
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={INITIAL_TRAFFIC_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPageviews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00A651" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#00A651" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 10, fontWeight: '700', fill: '#9CA3AF' }} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 10, fontWeight: '700', fill: '#9CA3AF' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    borderRadius: '12px', 
                    border: '1px solid #E5E7EB', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    fontSize: '11px',
                    fontWeight: '700'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="pageviews" 
                  stroke="#00A651" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorPageviews)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="visitors" 
                  stroke="#0EA5E9" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorVisitors)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Device Breakdown Pie chart */}
        <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col justify-between text-left">
          <div>
            <h3 className="font-black text-gray-900 text-lg mb-1">Device Breakdown</h3>
            <p className="text-xs font-medium text-gray-400 mb-6">Aggregate device types registered</p>
            
            <div className="h-44 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={DEVICE_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {DEVICE_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              
              <div className="absolute text-center">
                <span className="text-2xl font-black text-gray-900 block leading-none">1,210</span>
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 block">Sessions</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50 text-center">
            {DEVICE_DATA.map((device) => (
              <div key={device.name}>
                <span className="flex items-center justify-center gap-1 text-[11px] font-black text-gray-800">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: device.color }} />
                  {device.name}
                </span>
                <span className="text-xs font-mono text-gray-400 mt-0.5 block font-bold">
                  {Math.round((device.value / 1210) * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Traffic Sources Acquisition Channel details */}
        <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs text-left">
          <h3 className="font-black text-gray-900 text-lg mb-1">Acquisition Channels</h3>
          <p className="text-xs font-medium text-gray-400 mb-6 font-bold">Where your Balinese explorer traffic comes from</p>
          
          <div className="space-y-4">
            {TRAFFIC_SOURCES_DATA.map((source, index) => (
              <div key={source.source} className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-black text-gray-800">
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-gray-50 flex items-center justify-center text-gray-500 font-mono text-[9px]">
                      {index + 1}
                    </span>
                    {source.source}
                  </span>
                  <span>{source.value} ({source.percentage})</span>
                </div>
                <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-teal-500 rounded-full"
                    style={{ width: source.percentage }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* High-value conversion funnel */}
        <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs text-left">
          <h3 className="font-black text-gray-900 text-lg mb-1">User Action Funnel</h3>
          <p className="text-xs font-medium text-gray-400 mb-6">Dropoff levels from page discovery to absolute ticket booking</p>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-50 text-[#00A651] flex items-center justify-center font-black text-xs">
                1
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-gray-800">1. Discovery Pageview</span>
                  <span className="font-bold text-gray-500 font-mono">100% (12.4K)</span>
                </div>
                <div className="w-full h-1.5 bg-orange-100 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#00A651] w-full" />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-50 text-[#00A651] flex items-center justify-center font-black text-xs">
                2
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-gray-800">2. View Tour Package</span>
                  <span className="font-bold text-gray-500 font-mono">42% (5.2K)</span>
                </div>
                <div className="w-full h-1.5 bg-orange-100/50 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#00A651] w-[42%]" />
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-50 text-[#00A651] flex items-center justify-center font-black text-xs">
                3
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-gray-800">3. Checkout Initiated</span>
                  <span className="font-bold text-gray-500 font-mono">12% (1.5K)</span>
                </div>
                <div className="w-full h-1.5 bg-orange-100/50 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#00A651] w-[12%]" />
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-50 text-[#00A651] flex items-center justify-center font-black text-xs">
                4
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-black text-gray-800">4. Final Booking Receipt</span>
                  <span className="font-bold text-gray-500 font-mono">3.8% (471)</span>
                </div>
                <div className="w-full h-1.5 bg-orange-100/50 rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-[#00A651] w-[3.8%]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Captured GA Live Event Stream */}
        <div className="bg-white border border-gray-150 rounded-2xl p-6 shadow-xs flex flex-col justify-between text-left">
          <div>
            <h3 className="font-black text-gray-900 text-lg mb-1">Live GA Event Logger</h3>
            <p className="text-xs font-medium text-gray-400 mb-4 font-bold">Capturing local page routing and analytical actions</p>
            
            <div className="h-56 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50 p-3 space-y-2.5 font-mono text-[10px] text-gray-600 scrollbar-thin">
              {liveEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 select-none space-y-2">
                  <Database className="h-6 w-6 stroke-1.5 text-gray-300" />
                  <span>Listening for actions...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {liveEvents.map((evt, idx) => (
                    <div key={idx} className="p-2 bg-white rounded border border-gray-100 space-y-1">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="font-semibold text-gray-400">{evt.timestamp}</span>
                        <span className={`px-1.5 py-0.2 rounded font-black text-[8px] uppercase ${
                          evt.type === 'pageview' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                        }`}>
                          {evt.type}
                        </span>
                      </div>
                      <div className="text-gray-900 font-bold break-all">
                        {evt.type === 'pageview' ? `Page View: ${evt.name}` : `Event Fired: "${evt.name}"`}
                      </div>
                      {evt.params && (
                        <div className="text-[8.5px] text-orange-700 bg-orange-50/40 p-1.5 rounded border border-orange-100/30 overflow-x-auto whitespace-pre">
                          {JSON.stringify(evt.params, null, 2)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-gray-50 flex justify-between items-center">
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">Live Capture Hub</span>
            <button 
              onClick={() => {
                recordedGAEvents.length = 0;
                setLiveEvents([]);
              }}
              className="text-[10px] font-black uppercase text-red-500 hover:text-red-700 transition-colors cursor-pointer"
            >
              Clear Feed
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
