import React, { useState, useEffect } from 'react';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Sparkles, Calendar, Trash2, ChevronRight, MapPin, Printer } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';

export default function MyPlans() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      if (!auth.currentUser) return;
      
      try {
        const q = query(
          collection(db, 'saved_itineraries'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        const fetchedPlans = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        fetchedPlans.sort((a: any, b: any) => {
          const getTimestampMillis = (val: any): number => {
            if (!val) return 0;
            if (val instanceof Date) return val.getTime();
            if (typeof val.toMillis === 'function') return val.toMillis();
            if (typeof val.seconds === 'number') return val.seconds * 1000;
            if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime() || 0;
            return 0;
          };
          return getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt);
        });
        
        setPlans(fetchedPlans);
      } catch (error) {
        console.error("Error fetching plans:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this plan?")) return;
    
    try {
      await deleteDoc(doc(db, 'saved_itineraries', id));
      setPlans(plans.filter(p => p.id !== id));
    } catch (error) {
      console.error("Delete error:", error);
      alert("Failed to delete plan");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-orange-500" />
          My AI Travel Plans
        </h1>
        <p className="text-gray-500 mt-1">Manage all your AI-generated travel itineraries here.</p>
      </div>

      {plans.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200">
          <div className="bg-orange-50 h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="h-8 w-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">No saved plans yet</h3>
          <p className="text-gray-500 mt-2 max-w-sm mx-auto">
            Use our AI Travel Planner to create a customized itinerary for your Bali trip.
          </p>
          <Link 
            to="/planner"
            className="mt-6 inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all"
          >
            Create Your First Plan
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.map((plan) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={plan.id}
              className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-xl transition-all group"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-orange-50 text-primary px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    AI Generated
                  </div>
                  <button 
                    onClick={() => handleDelete(plan.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-2 leading-tight group-hover:text-primary transition-colors">
                  {plan.planTitle}
                </h3>
                <p className="text-gray-500 text-sm line-clamp-2 mb-4">
                  {plan.summary}
                </p>

                <div className="flex flex-wrap gap-4 text-xs font-semibold text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {plan.createdAt?.toDate ? plan.createdAt.toDate().toLocaleDateString() : 'Recent'}
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                <Link 
                  to="/planner"
                  state={{ savedPlan: plan }}
                  className="text-gray-900 font-bold text-sm flex items-center gap-1 hover:gap-2 transition-all"
                >
                  View Full Plan <ChevronRight className="h-4 w-4" />
                </Link>
                <div className="flex items-center gap-2">
                  {/* Share/Actions Button could go here */}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
