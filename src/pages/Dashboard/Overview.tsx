import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  Briefcase, 
  Calendar, 
  CheckCircle2, 
  TrendingUp, 
  ArrowRight,
  MapPin,
  Clock,
  DollarSign
} from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Booking, UserProfile } from '../../types';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export default function Overview() {
  const { user, profile } = useOutletContext<{ user: any; profile: UserProfile }>();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    upcoming: 0,
    completed: 0,
    totalSpent: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!user) return;
      
      try {
        setLoading(true);
        // 1. Fetch by userId (logged in account)
        const qUser = query(
          collection(db, 'bookings'),
          where('userId', '==', user.uid)
        );
        
        // 2. Fetch by email (guest bookings with same email)
        const normalizedEmail = user.email?.toLowerCase();
        const rawEmail = user.email;

        const queries = [
          getDocs(qUser),
          getDocs(query(collection(db, 'bookings'), where('customerData.email', '==', normalizedEmail)))
        ];

        if (rawEmail && rawEmail !== normalizedEmail) {
          queries.push(getDocs(query(collection(db, 'bookings'), where('customerData.email', '==', rawEmail))));
        }

        // Also try capitalized version (e.g. Kadek@gmail.com)
        if (normalizedEmail && normalizedEmail.includes('@')) {
          const parts = normalizedEmail.split('@');
          const capitalized = parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + '@' + parts[1];
          if (capitalized !== normalizedEmail && capitalized !== rawEmail) {
            queries.push(getDocs(query(collection(db, 'bookings'), where('customerData.email', '==', capitalized))));
          }
        }

        const snapshots = await Promise.all(queries);
        
        let allBookings: Booking[] = [];
        snapshots.forEach(snap => {
          const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
          allBookings = [...allBookings, ...docs];
        });
        
        // Deduplicate by ID
        const combinedMap = new Map<string, Booking>();
        allBookings.forEach(b => {
          combinedMap.set(b.id, b);
        });
        const bookingData = Array.from(combinedMap.values());
        
        // Sort by createdAt desc
        bookingData.sort((a, b) => {
          const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return dateB - dateA;
        });

        setBookings(bookingData);

        const now = new Date();
        const statsObj = bookingData.reduce((acc, curr) => {
          acc.total++;
          if (curr.status === 'confirmed') {
            const bookingDate = new Date(curr.date);
            if (bookingDate >= now) acc.upcoming++;
            else acc.completed++;
          }
          acc.totalSpent += curr.totalAmount;
          return acc;
        }, { total: 0, upcoming: 0, completed: 0, totalSpent: 0 });

        setStats(statsObj);
      } catch (err) {
        console.error("Error fetching overview data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user]);

  const cards = [
    { label: 'Total Bookings', value: stats.total, icon: Briefcase, color: "bg-orange-50 text-[#00A651]" },
    { label: 'Upcoming', value: stats.upcoming, icon: Calendar, color: "bg-[#EBF5FF] text-[#1E40AF]" },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: "bg-[#EEF2F6] text-[#3B82F6]" },
    { label: 'Total Spent', value: `$${stats.totalSpent.toLocaleString()}`, icon: TrendingUp, color: "bg-amber-50 text-[#D27C2D]" },
  ];

  const upcomingBookings = bookings
    .filter(b => b.status === 'confirmed' && new Date(b.date) >= new Date())
    .slice(0, 3);

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl animate-fade-in">
      <div className="flex flex-col gap-1.5 md:gap-1">
        <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2">
          Welcome back, <span className="text-[#00A651]">{profile?.displayName?.split(' ')[0] || 'Arthur'}</span>! 👋
        </h1>
        <p className="text-xs md:text-sm text-gray-500 leading-normal font-medium">Ready for your next adventure? Check out your upcoming trips below.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white p-4 md:p-6 rounded-[20px] shadow-xs border border-gray-100 flex flex-col md:flex-row items-start md:items-center gap-3.5 hover:shadow-md transition-all duration-300"
          >
            <div className={cn("p-2.5 md:p-3 rounded-[14px] shrink-0", card.color)}>
              <card.icon className="h-5 w-5 md:h-6 md:w-6" />
            </div>
            <div>
              <p className="text-[10px] md:text-xs font-bold text-gray-400 leading-none mb-1.5">{card.label}</p>
              <p className="text-lg md:text-2xl font-black text-gray-900 leading-none">{card.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 leading-none">Upcoming Trips</h2>
            <Link to="/customer/bookings" className="text-sm font-bold text-[#00A651] flex items-center gap-2 hover:underline">
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="py-12 flex justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00A651]"></div>
              </div>
            ) : upcomingBookings.length > 0 ? (
              <div className="space-y-4">
                {upcomingBookings.map((booking) => (
                  <div key={booking.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-[16px] hover:bg-gray-100 transition-colors">
                    <div className="h-16 w-16 bg-white rounded-[12px] flex items-center justify-center text-[#00A651] shadow-sm font-bold text-center leading-tight">
                      <div className="flex flex-col">
                        <span className="text-lg">{new Date(booking.date).getDate()}</span>
                        <span className="text-[10px]">{new Date(booking.date).toLocaleString('default', { month: 'short' })}</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{booking.tourTitle}</h3>
                      <div className="flex items-center gap-4 mt-1">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {booking.time || '08:00 AM'}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <CheckCircle2 className="h-3 w-3 text-orange-500" />
                          Confirmed
                        </div>
                      </div>
                    </div>
                    <Link 
                      to={`/customer/bookings`}
                      className="p-2 text-gray-400 hover:text-gray-900"
                    >
                      <ArrowRight className="h-5 w-5" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="h-10 w-10 text-gray-200" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Upcoming Trips</h3>
                <p className="text-gray-500 mb-8 max-w-xs mx-auto">Start planning your next adventure! Browse our tours to find your perfect experience.</p>
                <Link 
                  to="/tours" 
                  className="inline-flex items-center gap-2 px-8 py-3 bg-[#00A651] text-white rounded-[12px] font-bold text-sm hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
                >
                  Browse tours <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center text-center">
          <div className="w-32 h-32 relative mb-6">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                className="text-gray-100"
              />
              <circle
                cx="64"
                cy="64"
                r="58"
                stroke="currentColor"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={364}
                strokeDashoffset={364 - (364 * Math.min(stats.total, 10)) / 10}
                className="text-[#00A651] transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-gray-900">{stats.total}</span>
              <span className="text-[10px] font-bold text-gray-400">Tours</span>
            </div>
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Level: Explorer</h3>
          <p className="text-sm text-gray-500 mb-8">You've reached <span className="font-bold text-gray-900">Explorer</span> status! Book {10 - Math.min(stats.total, 10)} more tours to unlock Pro rewards.</p>
          <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-400 to-[#00A651]"
              style={{ width: `${(Math.min(stats.total, 10) / 10) * 100}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}


