import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { Booking, UserProfile } from '../../types';
import * as Icons from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  isWithinInterval,
  parseISO
} from 'date-fns';

interface BookingReportsProps {
  currentUserProfile: UserProfile | null;
}

type Period = 'daily' | 'weekly' | 'monthly' | 'annually';

export default function BookingReports({ currentUserProfile }: BookingReportsProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [suppliers, setSuppliers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('monthly');
  const [referenceDate, setReferenceDate] = useState<Date>(new Date());
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('all');

  const isAdmin = currentUserProfile?.role === 'admin';
  const isSupplier = currentUserProfile?.role === 'supplier';

  useEffect(() => {
    let q = query(collection(db, 'bookings'), where('status', '==', 'confirmed'));
    
    // If user is a supplier, they only see their own bookings
    if (isSupplier) {
      q = query(collection(db, 'bookings'), 
        where('status', '==', 'confirmed'),
        where('supplierId', '==', currentUserProfile.uid)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      setBookings(bookingsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUserProfile, isSupplier]);

  useEffect(() => {
    if (isAdmin) {
      const fetchSuppliers = async () => {
        const q = query(collection(db, 'users'), where('role', '==', 'supplier'));
        const snapshot = await getDocs(q);
        const suppliersData = snapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        })) as UserProfile[];
        setSuppliers(suppliersData);
      };
      fetchSuppliers();
    }
  }, [isAdmin]);

  const navigatePeriod = (direction: 'prev' | 'next') => {
    switch (period) {
      case 'daily':
        setReferenceDate(prev => direction === 'prev' ? subDays(prev, 1) : addDays(prev, 1));
        break;
      case 'weekly':
        setReferenceDate(prev => direction === 'prev' ? subWeeks(prev, 1) : addWeeks(prev, 1));
        break;
      case 'monthly':
        setReferenceDate(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
        break;
      case 'annually':
        setReferenceDate(prev => direction === 'prev' ? subYears(prev, 1) : addYears(prev, 1));
        break;
    }
  };

  const filteredBookings = useMemo(() => {
    let filtered = bookings;

    if (isAdmin && selectedSupplierId !== 'all') {
      filtered = filtered.filter(b => b.supplierId === selectedSupplierId);
    }

    let start: Date;
    let end: Date;

    switch (period) {
      case 'daily':
        start = startOfDay(referenceDate);
        end = endOfDay(referenceDate);
        break;
      case 'weekly':
        start = startOfWeek(referenceDate);
        end = endOfWeek(referenceDate);
        break;
      case 'monthly':
        start = startOfMonth(referenceDate);
        end = endOfMonth(referenceDate);
        break;
      case 'annually':
        start = startOfYear(referenceDate);
        end = endOfYear(referenceDate);
        break;
      default:
        start = startOfMonth(referenceDate);
        end = endOfMonth(referenceDate);
    }

    return filtered.filter(b => {
      const bookingDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
      return isWithinInterval(bookingDate, { start, end });
    });
  }, [bookings, period, selectedSupplierId, isAdmin, referenceDate]);

  const periodLabel = useMemo(() => {
    switch (period) {
      case 'daily':
        return format(referenceDate, 'EEEE, dd MMM yyyy');
      case 'weekly':
        return `${format(startOfWeek(referenceDate), 'dd MMM')} - ${format(endOfWeek(referenceDate), 'dd MMM yyyy')}`;
      case 'monthly':
        return format(referenceDate, 'MMMM yyyy');
      case 'annually':
        return format(referenceDate, 'yyyy');
    }
  }, [period, referenceDate]);

  const stats = useMemo(() => {
    return filteredBookings.reduce((acc, b) => {
      acc.totalBookingValue += b.totalAmount || 0;
      acc.totalCommission += b.merchantFee || 0;
      acc.totalNetEarnings += b.supplierEarnings || 0;
      acc.totalBookings += 1;
      return acc;
    }, {
      totalBookingValue: 0,
      totalCommission: 0,
      totalNetEarnings: 0,
      totalBookings: 0
    });
  }, [filteredBookings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Icons.Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Booking Reports</h2>
          <p className="text-gray-500 font-medium">Analyze your booking performance and earnings</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period Navigation */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => navigatePeriod('prev')}
              className="p-2 hover:bg-white rounded-lg transition-all text-gray-400 hover:text-primary"
            >
              <Icons.ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-4 text-[10px] font-black uppercase tracking-widest text-gray-600 min-w-[150px] text-center">
              {periodLabel}
            </span>
            <button
              onClick={() => navigatePeriod('next')}
              className="p-2 hover:bg-white rounded-lg transition-all text-gray-400 hover:text-primary"
            >
              <Icons.ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setReferenceDate(new Date())}
            className="px-4 py-2 bg-white border-2 border-gray-100 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:border-primary hover:text-primary transition-all shadow-sm"
          >
            Today
          </button>

          {/* Period Filter */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            {(['daily', 'weekly', 'monthly', 'annually'] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  period === p ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Supplier Filter (Admin Only) */}
          {isAdmin && (
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="bg-white border-2 border-gray-100 rounded-xl px-4 py-2 text-xs font-bold focus:border-primary outline-none transition-all"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map(s => (
                <option key={s.uid} value={s.uid}>{s.companyName || s.displayName || s.email}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
              <Icons.ShoppingBag className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-lg">Orders</span>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{stats.totalBookings}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total Bookings</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center text-primary">
              <Icons.DollarSign className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black text-primary uppercase tracking-widest bg-orange-50 px-2 py-1 rounded-lg">Revenue</span>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{formatPrice(stats.totalBookingValue)}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Booking Value</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
              <Icons.Percent className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest bg-orange-50 px-2 py-1 rounded-lg">Platform</span>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{formatPrice(stats.totalCommission)}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Commission</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-10 w-10 bg-purple-50 rounded-xl flex items-center justify-center text-purple-600">
              <Icons.Wallet className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest bg-purple-50 px-2 py-1 rounded-lg">Profit</span>
          </div>
          <div>
            <p className="text-2xl font-black text-gray-900">{formatPrice(stats.totalNetEarnings)}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Net Earnings</p>
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-50 flex items-center justify-between">
          <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Recent Bookings in this Period</h3>
          <span className="px-3 py-1 bg-gray-100 text-gray-500 rounded-lg text-[10px] font-black uppercase tracking-widest">{filteredBookings.length} Results</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tour / Customer</th>
                {isAdmin && <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>}
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Value</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Commission</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Net Earning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredBookings.length > 0 ? filteredBookings.map((b) => (
                <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">{format(b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt), 'dd MMM yyyy')}</p>
                    <p className="text-[10px] text-gray-400 font-medium">#{b.id.slice(-8).toUpperCase()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-gray-900 line-clamp-1">{b.tourTitle}</p>
                    <p className="text-xs font-bold text-gray-500">{b.customerData?.fullName}</p>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black uppercase tracking-widest">
                        {(() => {
                           if (!b.supplierId || b.supplierId === 'admin') return 'Platform';
                           const supplier = suppliers.find(s => s.uid === b.supplierId);
                           if (supplier) return supplier.companyName || supplier.displayName || 'Supplier';
                           return b.supplierId?.slice(0, 8) || 'Platform';
                        })()}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4">
                    <p className="text-sm font-black text-gray-900">{formatPrice(b.totalAmount)}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-bold text-orange-600">{formatPrice(b.merchantFee || 0)}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-sm font-black text-primary">{formatPrice(b.supplierEarnings || 0)}</p>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="px-6 py-20 text-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                    No bookings found for this period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
