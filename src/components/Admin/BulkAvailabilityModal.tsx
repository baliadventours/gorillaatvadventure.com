import { useState, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import { X, Calendar, Database, Loader2, Save, CheckCircle2 } from 'lucide-react';
import { Tour } from '../../types';
import { db } from '../../lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface BulkAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  tours: Tour[];
}

export default function BulkAvailabilityModal({ isOpen, onClose, tours }: BulkAvailabilityModalProps) {
  const [selectedTourIds, setSelectedTourIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));
  const [capacity, setCapacity] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  if (!isOpen) return null;

  const handleApply = async () => {
    if (selectedTourIds.length === 0) {
      alert("Please select at least one tour.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      alert("Start date cannot be after end date.");
      return;
    }

    setLoading(true);
    try {
      const dates: string[] = [];
      let current = new Date(startDate);
      const last = new Date(endDate);
      while (current <= last) {
        dates.push(format(current, 'yyyy-MM-dd'));
        current = addDays(current, 1);
      }

      const totalOperations = selectedTourIds.length * dates.length;
      setProgress({ current: 0, total: totalOperations });

      // Use batches for performance (max 500 ops per batch)
      let batch = writeBatch(db);
      let count = 0;
      let processed = 0;

      for (const tourId of selectedTourIds) {
        const tour = tours.find(t => t.id === tourId);
        if (!tour) continue;

        const slots = tour.timeSlots?.length ? tour.timeSlots : ['daily'];

        for (const date of dates) {
          for (const slot of slots) {
            const invId = `${tourId}_${date}_${slot}`;
            const invRef = doc(db, 'inventory', invId);
            
            // We need to check if it exists to preserve bookedCount if any
            const snap = await getDoc(invRef);
            if (snap.exists()) {
              batch.update(invRef, { 
                maxCapacity: capacity, 
                updatedAt: serverTimestamp() 
              });
            } else {
              batch.set(invRef, {
                tourId,
                date,
                timeSlot: slot,
                bookedCount: 0,
                maxCapacity: capacity,
                updatedAt: serverTimestamp()
              });
            }

            count++;
            if (count >= 400) { // Safety margin
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
          processed++;
          setProgress(prev => ({ ...prev, current: processed }));
        }
      }

      if (count > 0) {
        await batch.commit();
      }

      alert("Availability updated successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to update availability. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative bg-white w-full max-w-2xl rounded-[20px] shadow-2xl overflow-hidden font-sans"
      >
        <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Bulk <span className="text-primary">Availability</span></h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Set capacity for multiple tours and dates at once</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-100 shadow-sm">
            <X className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh] scrollbar-hide">
          {/* Select Tours */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
               <label className="text-xs font-black text-gray-400 uppercase tracking-widest">1. Select Trips/Tours</label>
               <button 
                onClick={() => setSelectedTourIds(selectedTourIds.length === tours.length ? [] : tours.map(t => t.id))}
                className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
               >
                 {selectedTourIds.length === tours.length ? 'Deselect All' : 'Select All'}
               </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {tours.map(tour => (
                <button
                  key={tour.id}
                  onClick={() => {
                    if (selectedTourIds.includes(tour.id)) {
                      setSelectedTourIds(selectedTourIds.filter(id => id !== tour.id));
                    } else {
                      setSelectedTourIds([...selectedTourIds, tour.id]);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
                    selectedTourIds.includes(tour.id) 
                      ? "bg-orange-50 border-primary shadow-sm" 
                      : "bg-gray-50 border-gray-100 opacity-60 hover:opacity-100"
                  )}
                >
                  <div className={cn(
                    "h-5 w-5 rounded-md flex items-center justify-center transition-colors",
                    selectedTourIds.includes(tour.id) ? "bg-primary text-white" : "border-2 border-gray-200"
                  )}>
                    {selectedTourIds.includes(tour.id) && <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <span className={cn("text-[11px] font-bold flex-1 line-clamp-1", selectedTourIds.includes(tour.id) ? "text-gray-900" : "text-gray-500")}>
                    {tour.title}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Date Range */}
            <div className="space-y-4">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">2. Set Date Range</label>
              <div className="space-y-3">
                <div className="relative group">
                   <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary" />
                   <input 
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all"
                   />
                   <span className="absolute -top-2 left-6 bg-white px-2 py-0.5 text-[8px] font-black text-gray-400 uppercase tracking-widest">Start Date</span>
                </div>
                <div className="relative group">
                   <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary" />
                   <input 
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all"
                   />
                   <span className="absolute -top-2 left-6 bg-white px-2 py-0.5 text-[8px] font-black text-gray-400 uppercase tracking-widest">End Date</span>
                </div>
              </div>
            </div>

            {/* Capacity */}
            <div className="space-y-4">
              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">3. Set Capacity/Seats</label>
              <div className="relative group">
                <Database className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary" />
                <input 
                  type="number"
                  min="1"
                  value={capacity}
                  onChange={(e) => setCapacity(parseInt(e.target.value) || 0)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-primary outline-none transition-all"
                  placeholder="e.g. 100"
                />
                <span className="absolute -top-2 left-6 bg-white px-2 py-0.5 text-[8px] font-black text-gray-400 uppercase tracking-widest">Seats per Day</span>
              </div>
              <p className="text-[10px] font-medium text-gray-400 leading-relaxed italic">
                * This will override existing capacity limits for the selected dates while preserving current booking counts.
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 bg-gray-50/50 border-t border-gray-100">
           {loading ? (
             <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Updating Availability...</span>
                  <span className="text-[10px] font-black text-primary uppercase">{Math.round((progress.current / progress.total) * 100)}%</span>
                </div>
                <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                    className="h-full bg-primary"
                  />
                </div>
             </div>
           ) : (
             <button 
               onClick={handleApply}
               className="w-full py-5 bg-primary text-white rounded-[15px] font-black text-sm tracking-widest uppercase shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all flex items-center justify-center gap-3"
             >
                <Save className="h-5 w-5" /> Update Capacity for {selectedTourIds.length} Tours
             </button>
           )}
        </div>
      </motion.div>
    </div>
  );
}
