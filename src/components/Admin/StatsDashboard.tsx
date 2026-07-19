import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, Users, DollarSign, Calendar, ArrowUpRight, ArrowDownRight, 
  Map, MapPin, Globe, ShoppingBag, Clock, CheckCircle2, ChevronRight, PieChart as PieIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { formatPrice } from '../../lib/utils';

interface StatsDashboardProps {
  bookings: any[];
  tours: any[];
  users: any[];
  inquiries?: any[];
  role?: string;
}

const StatsDashboard = ({ bookings, tours, users, inquiries = [], role }: StatsDashboardProps) => {
  const isSupplier = role === 'supplier';
  const isAgent = role === 'agent';
  const isAdmin = role === 'admin';
  
  // 1. Core aggregates
  const totalRevenue = bookings
    .filter(b => (b.paymentStatus === 'paid' || b.status === 'confirmed') && b.status !== 'cancelled')
    .reduce((acc, curr) => acc + (isSupplier ? (curr.supplierEarnings || 0) : (curr.totalAmount || 0)), 0);
  
  const totalAgentEarnings = isAgent ? bookings
    .filter(b => (b.paymentStatus === 'paid' || b.status === 'confirmed') && b.status !== 'cancelled')
    .reduce((acc, curr) => acc + (curr.agentDiscount || 0), 0) : 0;

  const confirmedCount = bookings.filter(b => b.status === 'confirmed').length;
  const pendingCount = bookings.filter(b => b.status === 'pending').length;
  const newInquiriesCount = inquiries.filter(i => i.status === 'new').length;

  const activeToursCount = tours.filter(t => t.status === 'active' || t.status === 'published').length;

  const stats = [
    { 
      label: isSupplier ? 'Your Revenue' : isAgent ? 'Your Earnings' : 'Total Revenue', 
      value: formatPrice(isAgent ? totalAgentEarnings : totalRevenue), 
      icon: DollarSign, 
      color: 'text-primary', 
      bg: 'bg-orange-50', 
      trend: '+12.5%', 
      isUp: true,
      description: 'Based on processed/confirmed sales'
    },
    { 
      label: isAgent ? 'Your Bookings' : 'Confirmed Bookings', 
      value: isAgent ? bookings.length.toString() : confirmedCount.toString(), 
      icon: Calendar, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50', 
      trend: '+8.2%', 
      isUp: true,
      description: 'Legally locked passenger slots'
    },
    { 
      label: isAdmin ? 'Trip Inquiries' : 'Pending Requests', 
      value: isAdmin ? newInquiriesCount.toString() : pendingCount.toString(), 
      icon: isAdmin ? MapPin : Clock, 
      color: isAdmin ? 'text-indigo-600' : 'text-amber-600', 
      bg: isAdmin ? 'bg-indigo-50' : 'bg-amber-50', 
      trend: isAdmin ? (newInquiriesCount > 0 ? 'New' : 'Zero') : '-2.4%', 
      isUp: isAdmin ? (newInquiriesCount > 0) : false,
      description: 'Customers awaiting itinerary reply'
    },
    { 
      label: isSupplier ? 'Your Active Tours' : isAgent ? 'Conversion Base' : 'Total Customers', 
      value: isSupplier 
        ? activeToursCount.toString() 
        : isAgent 
          ? formatPrice(totalRevenue)
          : users.length.toString(), 
      icon: isSupplier ? Map : isAgent ? TrendingUp : Users, 
      color: 'text-purple-600', 
      bg: 'bg-purple-50', 
      trend: '+5.1%', 
      isUp: true,
      description: isSupplier ? 'Tours active in search directory' : isAgent ? 'Direct client passenger value' : 'Registered user profiles'
    },
  ];

  // 2. Parse and normalize booking dates
  const parsedBookings = useMemo(() => {
    return bookings.map(b => {
      let bookingDate = new Date();
      if (b.createdAt) {
        if (typeof b.createdAt.toDate === 'function') {
          bookingDate = b.createdAt.toDate();
        } else if (b.createdAt.seconds) {
          bookingDate = new Date(b.createdAt.seconds * 1000);
        } else if (typeof b.createdAt === 'string') {
          bookingDate = new Date(b.createdAt);
        } else if (b.createdAt instanceof Date) {
          bookingDate = b.createdAt;
        }
      } else if (b.date) {
        bookingDate = new Date(b.date);
      }
      return {
        ...b,
        parsedDate: bookingDate
      };
    });
  }, [bookings]);

  // 3. Last 7 Days aggregated trend chart data
  const chartData = useMemo(() => {
    const data: Record<string, { revenue: number; bookingsCount: number }> = {};
    
    // Initialize past 7 days chronologically
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      data[key] = { revenue: 0, bookingsCount: 0 };
    }

    parsedBookings.forEach(b => {
      const isConfirmedOrPaid = (b.paymentStatus === 'paid' || b.status === 'confirmed') && b.status !== 'cancelled';
      const key = b.parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      if (data[key] !== undefined) {
        if (isConfirmedOrPaid) {
          const rev = isSupplier ? (b.supplierEarnings || 0) : isAgent ? (b.agentDiscount || 0) : (b.totalAmount || 0);
          data[key].revenue += rev;
        }
        if (b.status !== 'cancelled') {
          data[key].bookingsCount += 1;
        }
      }
    });

    return Object.entries(data).map(([name, val]) => ({
      name,
      revenue: val.revenue,
      bookings: val.bookingsCount
    }));
  }, [parsedBookings, isSupplier, isAgent]);

  // 4. Tour Performance Leaderboard
  const leaderBoardTours = useMemo(() => {
    const tourCounts: Record<string, { title: string; count: number; revenue: number }> = {};
    
    parsedBookings.forEach(b => {
      if (b.status === 'cancelled') return;
      const id = b.tourId || 'custom_itinerary';
      const title = b.tourTitle || b.packageName || 'Private Custom Itinerary';
      
      if (!tourCounts[id]) {
        tourCounts[id] = { title, count: 0, revenue: 0 };
      }
      tourCounts[id].count += 1;
      const rev = isSupplier ? (b.supplierEarnings || 0) : isAgent ? (b.agentDiscount || 0) : (b.totalAmount || 0);
      tourCounts[id].revenue += rev;
    });

    return Object.values(tourCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [parsedBookings, isSupplier, isAgent]);

  // 5. Booking Channel Distribution (B2B Travel Agencies, Klook, Viator, etc.)
  const channelData = useMemo(() => {
    const channels: Record<string, number> = {};
    parsedBookings.forEach(b => {
      if (b.status === 'cancelled') return;
      const source = b.bookingSource || 'Direct';
      channels[source] = (channels[source] || 0) + 1;
    });

    const total = Object.values(channels).reduce((a, b) => a + b, 0) || 1;
    const colors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280'];

    return Object.entries(channels)
      .map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
        percentage: Math.round((value / total) * 100)
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 4);
  }, [parsedBookings]);

  // 6. Recent activity stream
  const recentBookings = useMemo(() => {
    return [...parsedBookings]
      .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime())
      .slice(0, 5);
  }, [parsedBookings]);

  return (
    <div className="space-y-6 text-left">
      {/* 1. Header Grid Metrics - grid-cols-2 on mobile for dynamic look */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="p-4 sm:p-5 bg-white rounded-[16px] md:rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl ${stat.bg} ${stat.color} group-hover:scale-105 transition-all duration-300`}>
                  <stat.icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div className={`flex items-center gap-0.5 sm:gap-1 text-[9px] sm:text-[10px] font-black px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-full ${stat.isUp ? 'bg-orange-50 text-primary border border-orange-100/30' : 'bg-red-50 text-red-600 border border-red-100/30'}`}>
                  {stat.isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  <span>{stat.trend}</span>
                </div>
              </div>
              
              <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">{stat.label}</p>
              <p className="text-base sm:text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-none mb-1 sm:mb-2">{stat.value}</p>
            </div>
            <p className="text-[9.5px] sm:text-[10.5px] font-semibold text-gray-400 line-clamp-1 border-t border-gray-50 pt-1.5 sm:pt-2 mt-1 sm:mt-2">{stat.description}</p>
          </motion.div>
        ))}
      </div>

      {/* 2. Main Performance Analytics charts with side breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Left: Operational Trend Timeline (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl md:rounded-[24px] border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 md:mb-6">
            <div>
              <h3 className="font-extrabold text-gray-900 text-sm sm:text-base md:text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                Performance Metrics Overview
              </h3>
              <p className="text-[10.5px] sm:text-xs font-semibold text-gray-400">Weekly analysis of generated turnover and booked trips</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                Revenue
              </span>
              <span className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-gray-500">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Bookings Count
              </span>
            </div>
          </div>

          <div className="h-48 sm:h-64 md:h-72 w-full mt-1 sm:mt-2">
            {bookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2">
                <TrendingUp className="h-10 w-10 stroke-1" />
                <span className="text-xs font-black uppercase tracking-widest text-center">No Real-time Bookings Recorded This Week</span>
                <span className="text-[10px] text-gray-400 text-center">Deploy and start booking tours to generate live stats graphs.</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
                    formatter={(value: any, name: string) => {
                      if (name === 'Revenue') return [formatPrice(value as number), 'Revenue'];
                      return [value, 'Bookings'];
                    }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      borderRadius: '16px', 
                      border: '1px solid #f3f4f6', 
                      boxShadow: '0 10px 25px rgba(0,0,0,0.05)',
                      fontSize: '11px',
                      fontWeight: '700',
                      textAlign: 'left'
                    }} 
                  />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                  <Area type="monotone" dataKey="bookings" name="Bookings" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Right: Booking Channels Distribution */}
        <div className="bg-white rounded-2xl md:rounded-[24px] border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm sm:text-base md:text-lg flex items-center gap-2 mb-0.5 sm:mb-1">
              <PieIcon className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500" />
              Booking Channels
            </h3>
            <p className="text-[10.5px] sm:text-xs font-semibold text-gray-400 mb-4 sm:mb-6">Traffic segmentation and referral distribution</p>

            {channelData.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-gray-300 h-40">
                <Globe className="h-6 w-6 stroke-1.5 mb-2 animate-pulse" />
                <span className="text-[10px] font-black uppercase">Awaiting Client Logins</span>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-5">
                {channelData.map(ch => (
                  <div key={ch.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 max-w-[70%]">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ch.color }} />
                      <div className="min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-gray-800 block truncate">{ch.name}</span>
                        <span className="text-[9.5px] sm:text-[10px] font-bold text-gray-400 leading-none block mt-0.5">{ch.value} unique items</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-black text-gray-900 text-sm sm:text-md font-mono">{ch.percentage}%</span>
                      <div className="w-12 sm:w-16 h-1 bg-gray-50 rounded-full overflow-hidden mt-0.5 sm:mt-1">
                        <div className="h-full rounded-full" style={{ width: `${ch.percentage}%`, backgroundColor: ch.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-gray-50 flex items-center justify-between mt-4 sm:mt-6">
            <span className="text-[9.5px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dynamic Segmentation</span>
            <span className="text-[9.5px] sm:text-xs font-bold text-primary bg-orange-50 px-2.5 py-0.5 rounded-full border border-orange-100/30 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-orange-500 animate-ping" />
              Realtime
            </span>
          </div>
        </div>

      </div>

      {/* 3. Leaders & Timeline Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        
        {/* Top Tours Leaderboard */}
        <div className="bg-white rounded-2xl md:rounded-[24px] border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm sm:text-base md:text-lg flex items-center gap-2 mb-0.5 sm:mb-1">
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              Top Booking Driver Trips
            </h3>
            <p className="text-[10.5px] sm:text-xs font-semibold text-gray-400 mb-4 sm:mb-6">Tours with highest conversion rates & passenger volumes</p>

            {leaderBoardTours.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                <Map className="h-8 w-8 stroke-1 mb-2" />
                <p className="text-[10px] font-bold uppercase">No Tour Reservations Logged Yet</p>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-5">
                {leaderBoardTours.map((t, idx) => {
                  const maxCount = leaderBoardTours[0]?.count || 1;
                  const ratio = Math.round((t.count / maxCount) * 100);
                  
                  return (
                    <div key={idx} className="space-y-1.5 sm:space-y-2">
                       <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2 max-w-[65%] min-w-0">
                          <span className="w-4 h-4 rounded bg-purple-50 text-purple-600 font-extrabold flex items-center justify-center text-[9px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-gray-800 font-black truncate text-xs sm:text-sm">{t.title}</span>
                        </div>
                        <span className="font-black text-gray-900 font-mono text-[10px] sm:text-xs text-right shrink-0">{t.count} bookings ({formatPrice(t.revenue)})</span>
                      </div>
                      <div className="w-full h-1.5 bg-gray-50 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" style={{ width: `${ratio}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Transactions & Stream Timeline */}
        <div className="bg-white rounded-2xl md:rounded-[24px] border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-gray-900 text-sm sm:text-base md:text-lg flex items-center gap-2 mb-0.5 sm:mb-1">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              Live Operations Stream
            </h3>
            <p className="text-[10.5px] sm:text-xs font-semibold text-gray-400 mb-4 sm:mb-6">Chronological tracking feed of incoming system activities</p>

            {recentBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-300">
                <CheckCircle2 className="h-8 w-8 stroke-1 mb-2 animate-pulse" />
                <p className="text-[10px] font-bold uppercase">No Recent Transactions Detected</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentBookings.map((b, idx) => {
                  const isConfirmed = b.status === 'confirmed';
                  const isPending = b.status === 'pending';
                  const isCancelled = b.status === 'cancelled';
                  
                  return (
                    <div key={b.id || idx} className="flex items-start justify-between p-3 bg-gray-50/50 hover:bg-gray-50 border border-gray-100 rounded-xl transition-all gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className="mt-1.5 h-2 w-2 rounded-full flex items-center justify-center relative shrink-0">
                          <span className={`h-2 w-2 rounded-full ${
                            isConfirmed ? 'bg-orange-500 animate-pulse' : 
                            isPending ? 'bg-amber-500 animate-pulse' : 
                            isCancelled ? 'bg-red-500' : 'bg-gray-400'
                          }`} />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-xs font-bold text-gray-800 line-clamp-1 truncate">
                            {b.customerData?.fullName || 'Anonymous Traveler'}
                          </p>
                          <p className="text-[10px] font-semibold text-gray-400 line-clamp-1 mt-0.5 truncate">
                            {b.tourTitle || b.packageName || 'Private Tour'}
                          </p>
                          <p className="text-[9px] font-semibold text-gray-400 font-mono mt-0.5">
                            {b.parsedDate.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} • {b.bookingSource || 'Direct'}
                          </p>
                        </div>
                      </div>

                      <div className="text-right flex flex-col justify-between items-end gap-1 shrink-0">
                        <span className="text-[11px] sm:text-xs font-black text-gray-900 font-mono">
                          {formatPrice(isSupplier ? (b.supplierEarnings || 0) : isAgent ? (b.agentDiscount || 0) : (b.totalAmount || 0))}
                        </span>
                        <span className={`text-[8.5px] uppercase font-bold px-1.5 py-0.5 rounded-full border leading-none ${
                          isConfirmed ? 'text-orange-700 bg-orange-50 border-orange-100' :
                          isPending ? 'text-amber-700 bg-amber-50 border-amber-100' :
                          isCancelled ? 'text-red-700 bg-red-50 border-red-100' : 'text-gray-700 bg-gray-50 border-gray-100'
                        }`}>
                          {b.status === 'review_required' ? 'Review Needed' : b.status || 'Received'}
                        </span>
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
};

export default StatsDashboard;
