import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, getDocs, addDoc, doc, updateDoc, writeBatch, serverTimestamp, getDoc, orderBy } from 'firebase/firestore';
import { Booking, UserProfile, Payout, PayoutMethod } from '../../types';
import * as Icons from 'lucide-react';
import { cn, formatPrice } from '../../lib/utils';
import { format, isBefore, startOfDay, parseISO, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface PayoutManagerProps {
  currentUserProfile: UserProfile | null;
}

type PayoutTab = 'queue' | 'history' | 'settings';

export default function PayoutManager({ currentUserProfile }: PayoutManagerProps) {
  const [activeTab, setActiveTab] = useState<PayoutTab>('queue');
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<Payout[]>([]);
  const [suppliers, setSuppliers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const isAdmin = currentUserProfile?.role === 'admin';
  const isSupplier = currentUserProfile?.role === 'supplier';

  // State for payout method settings
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>(currentUserProfile?.payoutMethod || {
    type: 'bank_transfer',
    bankName: '',
    accountNumber: '',
    accountHolder: ''
  });

  useEffect(() => {
    // 1. Fetch bookings ready for payout (confirmed, date passed, not yet paid)
    const now = startOfDay(new Date());
    let q = query(
      collection(db, 'bookings')
    );

    const unsubscribeBookings = onSnapshot(q, (snapshot) => {
      const allPending = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Booking[];
      
      // Auto-complete bookings logic: Mark confirmed bookings as completed 1 day after the tour date
      const now = new Date();
      allPending.forEach(async (b) => {
        if (b.status === 'confirmed') {
          try {
            const tourDate = parseISO(b.date);
            const completionDate = addDays(tourDate, 1);
            if (isBefore(completionDate, now)) {
              await updateDoc(doc(db, 'bookings', b.id), {
                status: 'completed',
                updatedAt: serverTimestamp()
              });
            }
          } catch (e) {}
        }
      });

      // Filter out already paid ones (handling missing payoutStatus)
      const unpaid = allPending.filter(b => b.payoutStatus !== 'paid');

      if (isSupplier) {
        setPendingBookings(unpaid.filter(b => b.supplierId === currentUserProfile.uid));
      } else {
        setPendingBookings(unpaid);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching bookings for payout:", error);
      setLoading(false);
    });

    // 2. Fetch payout history
    let payoutQ = query(collection(db, 'payouts'), orderBy('createdAt', 'desc'));
    if (isSupplier) {
      payoutQ = query(collection(db, 'payouts'), where('supplierId', '==', currentUserProfile.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribePayouts = onSnapshot(payoutQ, (snapshot) => {
      const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Payout[];
      setPayoutHistory(history);
    });

    // 3. Fetch suppliers (Admin only)
    if (isAdmin) {
      const fetchSuppliers = async () => {
        const q = query(collection(db, 'users'), where('role', '==', 'supplier'));
        const snap = await getDocs(q);
        setSuppliers(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as UserProfile[]);
      };
      fetchSuppliers();
    }

    return () => {
      unsubscribeBookings();
      unsubscribePayouts();
    };
  }, [currentUserProfile, isAdmin, isSupplier]);

  // Group pending bookings by supplier (for Admin review)
  const groupedBookings = useMemo(() => {
    const groups: { [supplierId: string]: { supplier: UserProfile | null, bookings: Booking[], readyTotal: number, upcomingTotal: number, readyCount: number, upcomingCount: number } } = {};
    const now = startOfDay(new Date());

    pendingBookings.forEach(b => {
      const sid = b.supplierId || 'platform';
      if (!groups[sid]) {
        const supplier = suppliers.find(s => s.uid === sid) || null;
        groups[sid] = { supplier, bookings: [], readyTotal: 0, upcomingTotal: 0, readyCount: 0, upcomingCount: 0 };
      }
      
      groups[sid].bookings.push(b);
      
      const isReadyValue = b.status === 'completed';
      const earnings = b.supplierId ? (b.supplierEarnings || 0) : (b.totalAmount || 0);

      if (isReadyValue) {
        groups[sid].readyTotal += earnings;
        groups[sid].readyCount += 1;
      } else {
        groups[sid].upcomingTotal += earnings;
        groups[sid].upcomingCount += 1;
      }
    });

    return groups;
  }, [pendingBookings, suppliers]);

  const handleUpdatePayoutMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserProfile) return;
    setProcessing(true);
    try {
      await updateDoc(doc(db, 'users', currentUserProfile.uid), {
        payoutMethod,
        updatedAt: serverTimestamp()
      });
      alert('Payout method updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update payout method.');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessPayout = async (supplierId: string, groupBookings: Booking[], amount: number) => {
    if (!isAdmin) return;
    const confirm = window.confirm(`Process payout of ${formatPrice(amount)} for this supplier?`);
    if (!confirm) return;

    setProcessing(true);
    try {
      const batch = writeBatch(db);
      
      // Get supplier details
      const supplierDoc = await getDoc(doc(db, 'users', supplierId));
      const supplierData = supplierDoc.data() as UserProfile;

      // 1. Create Payout record
      const payoutRef = doc(collection(db, 'payouts'));
      const payoutData: Omit<Payout, 'id'> = {
        supplierId,
        supplierName: supplierData.companyName || supplierData.displayName || supplierData.email,
        amount,
        currency: 'USD',
        status: 'completed',
        payoutMethod: supplierData.payoutMethod || { type: 'other', details: 'No method specified' },
        bookingIds: groupBookings.map(b => b.id),
        processedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      batch.set(payoutRef, payoutData);

      // 2. Update all bookings
      groupBookings.forEach(b => {
        const bookingRef = doc(db, 'bookings', b.id);
        batch.update(bookingRef, {
          payoutId: payoutRef.id,
          payoutStatus: 'paid',
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      alert('Payout processed and records updated!');
    } catch (err) {
      console.error(err);
      alert('Error processing payout.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-20">
      <Icons.Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Payout Management</h2>
          <p className="text-gray-500 font-medium">Manage earnings and handle supplier payouts</p>
        </div>

        <div className="flex bg-gray-100 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('queue')}
            className={cn(
               "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
               activeTab === 'queue' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icons.Clock className="h-4 w-4" />
            Payout Queue
            {pendingBookings.length > 0 && (
               <span className="ml-1 px-2 py-0.5 bg-primary text-white text-[8px] rounded-full">
                 {pendingBookings.length}
               </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
               "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
               activeTab === 'history' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icons.History className="h-4 w-4" />
            Payout History
          </button>
          {isSupplier && (
            <button
               onClick={() => setActiveTab('settings')}
               className={cn(
                  "px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  activeTab === 'settings' ? "bg-white text-primary shadow-sm" : "text-gray-500 hover:text-gray-700"
               )}
            >
               <Icons.Settings className="h-4 w-4" />
               Method Setup
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'queue' && (
          <motion.div
            key="queue"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {isAdmin ? (
               // Admin View: Grouped by Supplier
               Object.keys(groupedBookings).length > 0 ? (
                  <div className="grid grid-cols-1 gap-6">
                     {Object.entries(groupedBookings).map(([sid, group]) => (
                        <div key={sid} className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden flex flex-col md:flex-row">
                           <div className="p-8 border-r border-gray-50 bg-gray-50/30 md:w-80">
                              <div className="flex items-center gap-4 mb-6">
                                 <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border border-gray-100">
                                    <Icons.Store className="h-6 w-6" />
                                 </div>
                                 <div className="flex-1">
                                    <h3 className="font-black text-gray-900 leading-tight">
                                       {group.supplier?.companyName || group.supplier?.displayName || sid}
                                    </h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supplier</p>
                                 </div>
                              </div>
                              
                              <div className="space-y-4 mb-8">
                                 <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 flex items-center justify-between">
                                       <span>Ready Payout</span>
                                       <span className="text-orange-500">Available</span>
                                    </p>
                                    <p className="text-2xl font-black text-primary tracking-tight">{formatPrice(group.readyTotal)}</p>
                                    <p className="text-[9px] text-gray-400 font-bold">{group.readyCount} tour(s) passed</p>
                                 </div>
                                 <div>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Bookings Count</p>
                                    <p className="text-xl font-black text-gray-900">{group.bookings.length}</p>
                                 </div>
                              </div>

                              {group.supplier?.payoutMethod && (
                                <div className="mb-8 p-4 bg-white rounded-xl border border-gray-100 shadow-sm">
                                  <p className="text-[10px] font-black text-purple-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                                    <Icons.Wallet className="h-3 w-3" /> Payout Method
                                  </p>
                                  <div className="space-y-1">
                                    <p className="text-xs font-black text-gray-900 uppercase">
                                      {group.supplier.payoutMethod.type.replace('_', ' ')}
                                    </p>
                                    {group.supplier.payoutMethod.type === 'bank_transfer' && (
                                      <div className="text-[10px] text-gray-500 font-medium">
                                        <p>{group.supplier.payoutMethod.bankName}</p>
                                        <p className="font-bold">{group.supplier.payoutMethod.accountNumber}</p>
                                        <p>{group.supplier.payoutMethod.accountHolder}</p>
                                      </div>
                                    )}
                                    {group.supplier.payoutMethod.type === 'paypal' && (
                                      <p className="text-[10px] text-gray-500 font-bold">{group.supplier.payoutMethod.paypalEmail}</p>
                                    )}
                                    {group.supplier.payoutMethod.type === 'other' && (
                                      <p className="text-[10px] text-gray-500 font-medium line-clamp-2">{group.supplier.payoutMethod.details}</p>
                                    )}
                                  </div>
                                </div>
                              )}

                              <button
                                 onClick={() => {
                                   const readyBookings = group.bookings.filter(b => b.status === 'completed');
                                   if (readyBookings.length === 0) {
                                     alert("Nothing ready for payout yet. Please mark bookings as 'Completed' first.");
                                     return;
                                   }
                                   handleProcessPayout(sid, readyBookings, group.readyTotal);
                                 }}
                                 disabled={processing}
                                 className="w-full bg-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all disabled:opacity-50"
                              >
                                 {processing ? 'Processing...' : 'Process Payout'}
                              </button>
                           </div>

                           <div className="flex-1 overflow-x-auto">
                              <table className="w-full text-left">
                                 <thead className="bg-gray-50/50">
                                    <tr>
                                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tour</th>
                                       <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Earnings</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-50">
                                    {group.bookings.map(b => (
                                       <tr key={b.id}>
                                          <td className="px-6 py-4">
                                             <p className="text-xs font-bold text-gray-900">{format(parseISO(b.date), 'dd MMM yyyy')}</p>
                                             <p className="text-[10px] text-gray-400 font-medium">#{b.id.slice(-8).toUpperCase()}</p>
                                          </td>
                                          <td className="px-6 py-4">
                                             <p className="text-xs font-black text-gray-900 line-clamp-1">{b.tourTitle}</p>
                                          </td>
                                          <td className="px-6 py-4">
                                             <p className="text-xs font-black text-primary">{formatPrice(b.supplierEarnings)}</p>
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="text-center py-20 bg-white rounded-[24px] border border-gray-100 border-dashed">
                     <Icons.CheckCircle2 className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                     <h3 className="text-lg font-black text-gray-900">All caught up!</h3>
                     <p className="text-gray-500">No pending payouts found in the queue.</p>
                  </div>
               )
            ) : (
               // Supplier View: Their own Queue
               <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden">
                  <div className="p-8 border-b border-gray-50 bg-gray-50/30 flex flex-col md:flex-row justify-between items-center gap-4">
                     <div>
                        <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">My Payout Queue</h3>
                        <p className="text-xs font-medium text-gray-500">Bookings completed and awaiting processing by Admin</p>
                     </div>
                     <div className="flex gap-8">
                        <div className="text-right">
                           <p className="text-2xl font-black text-primary">
                             {formatPrice(pendingBookings.filter(b => b.status === 'completed').reduce((acc, b) => acc + (b.supplierEarnings || 0), 0))}
                           </p>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ready for Payout</p>
                        </div>
                        <div className="text-right border-l border-gray-100 pl-8">
                           <p className="text-xl font-black text-gray-400">
                             {formatPrice(pendingBookings.filter(b => b.status === 'confirmed').reduce((acc, b) => acc + (b.supplierEarnings || 0), 0))}
                           </p>
                           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Upcoming</p>
                        </div>
                     </div>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-gray-50/50">
                           <tr>
                              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Booking ID</th>
                              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Tour Title</th>
                              <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Your Earnings</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                           {pendingBookings.length > 0 ? pendingBookings.map(b => (
                              <tr key={b.id}>
                                 <td className="px-6 py-4 text-xs font-bold text-gray-900">{format(parseISO(b.date), 'dd MMM yyyy')}</td>
                                 <td className="px-6 py-4 text-xs font-mono text-gray-500 uppercase">#{b.id.slice(-8)}</td>
                                 <td className="px-6 py-4">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                      b.status === 'completed' ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
                                    )}>
                                      {b.status}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-xs font-black text-gray-900">{b.tourTitle}</td>
                                 <td className="px-6 py-4 text-xs font-black text-primary text-right">{formatPrice(b.supplierEarnings)}</td>
                              </tr>
                           )) : (
                              <tr>
                                 <td colSpan={5} className="py-20 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">No pending payouts</td>
                              </tr>
                           )}
                        </tbody>
                     </table>
                  </div>
               </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-[24px] border border-gray-100 shadow-sm overflow-hidden"
          >
             <div className="p-8 border-b border-gray-50 bg-gray-50/30">
                <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Payout History</h3>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                   <thead className="bg-gray-50/50">
                      <tr>
                         <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                         <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reference</th>
                         {isAdmin && <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Supplier</th>}
                         <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Method</th>
                         <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Amount</th>
                         <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-50">
                      {payoutHistory.length > 0 ? payoutHistory.map(p => (
                         <tr key={p.id}>
                            <td className="px-6 py-4 text-xs font-bold text-gray-900">
                               {format(p.createdAt?.toDate ? p.createdAt.toDate() : new Date(), 'dd MMM yyyy')}
                            </td>
                            <td className="px-6 py-4 text-xs font-mono text-gray-500 uppercase">#{p.id.slice(-8)}</td>
                            {isAdmin && <td className="px-6 py-4 text-xs font-black text-gray-900">{p.supplierName}</td>}
                            <td className="px-6 py-4">
                               <span className="text-[10px] font-black bg-gray-100 px-2 py-1 rounded-lg uppercase">
                                  {p.payoutMethod.type.replace('_', ' ')}
                               </span>
                            </td>
                            <td className="px-6 py-4 text-xs font-black text-primary text-right">{formatPrice(p.amount)}</td>
                            <td className="px-6 py-4 text-center">
                               <span className="px-3 py-1 bg-orange-50 text-primary rounded-lg text-[8px] font-black uppercase tracking-widest">
                                  {p.status}
                               </span>
                            </td>
                         </tr>
                      )) : (
                         <tr>
                            <td colSpan={isAdmin ? 6 : 5} className="py-20 text-center text-[10px] font-black uppercase text-gray-400 tracking-widest">No payout history found</td>
                         </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </motion.div>
        )}

        {activeTab === 'settings' && isSupplier && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="max-w-2xl mx-auto"
          >
             <div className="bg-white p-10 rounded-[32px] border border-gray-100 shadow-sm space-y-8">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
                      <Icons.Wallet className="h-6 w-6" />
                   </div>
                   <div>
                      <h3 className="text-xl font-black text-gray-900">Payout Method</h3>
                      <p className="text-gray-500 font-medium">Configure how you want to receive your earnings</p>
                   </div>
                </div>

                <form onSubmit={handleUpdatePayoutMethod} className="space-y-6">
                   <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Method Type</label>
                       <select
                          value={payoutMethod.type}
                          onChange={(e) => setPayoutMethod({ ...payoutMethod, type: e.target.value as any })}
                          className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-900 focus:border-primary outline-none transition-all"
                       >
                          <option value="bank_transfer">Bank Transfer</option>
                          <option value="paypal">PayPal</option>
                          <option value="other">Other</option>
                       </select>
                   </div>

                   {payoutMethod.type === 'bank_transfer' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Bank Name</label>
                            <input
                               type="text"
                               value={payoutMethod.bankName}
                               onChange={(e) => setPayoutMethod({ ...payoutMethod, bankName: e.target.value })}
                               className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-900 focus:border-primary outline-none transition-all"
                               placeholder="e.g. Bank of America"
                            />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Number</label>
                               <input
                                  type="text"
                                  value={payoutMethod.accountNumber}
                                  onChange={(e) => setPayoutMethod({ ...payoutMethod, accountNumber: e.target.value })}
                                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-900 focus:border-primary outline-none transition-all"
                                  placeholder="0000 0000 0000"
                               />
                            </div>
                            <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Holder</label>
                               <input
                                  type="text"
                                  value={payoutMethod.accountHolder}
                                  onChange={(e) => setPayoutMethod({ ...payoutMethod, accountHolder: e.target.value })}
                                  className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-900 focus:border-primary outline-none transition-all"
                                  placeholder="John Doe"
                               />
                            </div>
                         </div>
                      </motion.div>
                   )}

                   {payoutMethod.type === 'paypal' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">PayPal Email</label>
                         <input
                            type="email"
                            value={payoutMethod.paypalEmail}
                            onChange={(e) => setPayoutMethod({ ...payoutMethod, paypalEmail: e.target.value })}
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-900 focus:border-primary outline-none transition-all"
                            placeholder="your-paypal@email.com"
                         />
                      </motion.div>
                   )}

                   {payoutMethod.type === 'other' && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Payment Instructions</label>
                         <textarea
                            value={payoutMethod.details}
                            onChange={(e) => setPayoutMethod({ ...payoutMethod, details: e.target.value })}
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 font-bold text-gray-900 focus:border-primary outline-none transition-all h-32 resize-none"
                            placeholder="Provide any other details for payout..."
                         />
                      </motion.div>
                   )}

                   <button
                      type="submit"
                      disabled={processing}
                      className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-gray-200 hover:bg-black transition-all active:scale-95 disabled:opacity-50"
                   >
                      {processing ? 'Saving...' : 'Save Payout Settings'}
                   </button>
                </form>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
