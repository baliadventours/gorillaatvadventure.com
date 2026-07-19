import React, { useState, useEffect, useRef } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Briefcase, 
  Heart, 
  User, 
  LogOut,
  Sparkles,
  LifeBuoy,
  LineChart
} from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import MobileNav from '../../components/MobileNav';
import { useSettings } from '../../lib/SettingsContext';

import Footer from '../../components/Footer';

export default function DashboardLayout() {
  const { settings } = useSettings();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        setUser(authUser);
        const docRef = doc(db, 'users', authUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        }
      } else {
        navigate('/login', { state: { from: window.location } });
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00A651]"></div>
      </div>
    );
  }

  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/customer/dashboard' },
    { label: 'My Bookings', icon: Briefcase, path: '/customer/bookings' },
    { label: 'Wishlist', icon: Heart, path: '/customer/wishlist' },
    { label: 'My Plans', icon: Sparkles, path: '/customer/my-plans' },
    { label: 'Profile', icon: User, path: '/customer/profile' },
    { label: 'Tickets & Support', icon: LifeBuoy, path: '/customer/tickets' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex pt-20 lg:pt-[116px]">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 h-[calc(100vh-116px)] sticky top-[116px]">
        <div className="h-full flex flex-col p-6">
          <nav className="flex-1 space-y-1">
            {menuItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center gap-3 px-4 py-3 rounded-[12px] text-sm font-semibold transition-all group",
                  isActive 
                    ? "bg-orange-50 text-[#00A651]" 
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="pt-6 border-t border-gray-100">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 w-full rounded-[12px] text-sm font-semibold text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Dashboard Sub-Header & Navigation */}
        <div className="lg:hidden bg-white border-b border-gray-150 flex flex-col w-full z-20 shadow-xs">
          {/* User mini badge banner */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-50 to-white">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-orange-500 to-teal-600 text-white flex items-center justify-center font-black text-sm shadow-inner border border-orange-100">
                {profile?.displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="leading-tight">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Dashboard Space</span>
                <span className="text-xs font-black text-gray-800 truncate max-w-[140px] block">
                  {profile?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'Explorer'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="bg-orange-50 text-[#00A651] border border-orange-100/60 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs">
                <Sparkles className="h-3 w-3 text-orange-500 animate-pulse" />
                Explorer Lvl 1
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sliding Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none px-4 py-2.5 bg-white border-t border-gray-50">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold transition-all shrink-0 border whitespace-nowrap",
                    isActive 
                      ? "bg-[#00A651] text-white border-[#00A651] shadow-sm shadow-orange-100" 
                      : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 md:pb-8">
          <Outlet context={{ user, profile }} />
          <div className="mt-20">
            <Footer />
          </div>
        </main>

        {/* Mobile Stick Menu */}
        <MobileNav />
      </div>
    </div>
  );
}
