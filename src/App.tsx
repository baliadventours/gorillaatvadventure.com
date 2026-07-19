/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import Header from './components/Header';
import Footer from './components/Footer';
import { SettingsProvider } from './lib/SettingsContext';
import { CurrencyProvider } from './lib/CurrencyContext';
import { AuthProvider } from './lib/AuthContext';
import GlobalPopup from './components/GlobalPopup';
import MobileNav from './components/MobileNav';
import { cn } from './lib/utils';
import Loader from './components/Loader';
import { initGA, trackGAPageview } from './lib/googleAnalytics';
import { logSimplePageView } from './lib/simpleAnalytics';

// Critical pages imported directly for instant load
import Home from './pages/Home';

// Lazy load non-critical pages for performance
const Tours = lazy(() => import('./pages/Tours'));
const TourDetail = lazy(() => import('./pages/TourDetail'));
const Admin = lazy(() => import('./pages/Admin'));
const Checkout = lazy(() => import('./pages/Checkout'));
const BookingSuccess = lazy(() => import('./pages/BookingSuccess'));
const BookingTracker = lazy(() => import('./pages/BookingTracker'));
const Contact = lazy(() => import('./pages/Contact'));
const About = lazy(() => import('./pages/About'));
const Destinations = lazy(() => import('./pages/Destinations'));
const BlogArchive = lazy(() => import('./pages/BlogArchive'));
const BlogPostDetail = lazy(() => import('./pages/BlogPostDetail'));
const Auth = lazy(() => import('./pages/Auth'));
const PriceList = lazy(() => import('./pages/PriceList'));
const DashboardLayout = lazy(() => import('./pages/Dashboard/DashboardLayout'));
const Overview = lazy(() => import('./pages/Dashboard/Overview'));
const Bookings = lazy(() => import('./pages/Dashboard/Bookings'));
const Wishlist = lazy(() => import('./pages/Dashboard/Wishlist'));
const Profile = lazy(() => import('./pages/Dashboard/Profile'));
const MyPlans = lazy(() => import('./pages/Dashboard/MyPlans'));
const Tickets = lazy(() => import('./pages/Dashboard/Tickets'));
const GoogleAnalytics = lazy(() => import('./pages/Dashboard/GoogleAnalytics'));
const AIPlanner = lazy(() => import('./pages/AIPlanner'));
const AIHub = lazy(() => import('./pages/AIHub'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));

// Lazy load non-critical components
const Chatbot = lazy(() => import('./components/Chatbot'));

function AppContent() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const isSupplier = location.pathname.startsWith('/supplier');
  const isAgent = location.pathname.startsWith('/agent');
  const isAuth = location.pathname === '/login';
  const isDashboard = location.pathname.startsWith('/customer');
  const isCheckout = location.pathname.startsWith('/checkout');
  const isTourDetail = location.pathname.startsWith('/tour/');

  // Track Google Analytics pageviews on route modifications
  useEffect(() => {
    // Initial loading of ga scripts
    initGA();
  }, []);

  useEffect(() => {
    const fullPath = location.pathname + location.search;
    trackGAPageview(fullPath);
    logSimplePageView(fullPath);
  }, [location.pathname, location.search]);

  // Prevent mobile zooming (pinch zoom & double tap auto-zoom)
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    let lastTouchEnd = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        const target = e.target as HTMLElement;
        const isInteractive = 
          target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.tagName === 'SELECT' || 
          target.isContentEditable ||
          target.closest('button') ||
          target.closest('a') ||
          target.closest('.interactive');
        
        if (!isInteractive) {
          e.preventDefault();
        }
      }
      lastTouchEnd = now;
    };

    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('gesturestart', handleGestureStart, { passive: false });
    document.addEventListener('gesturechange', handleGestureStart, { passive: false });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('gesturestart', handleGestureStart);
      document.removeEventListener('gesturechange', handleGestureStart);
    };
  }, []);
  
  // Hide main nav components on certain pages
  const hideMainLayout = isAdmin || isSupplier || isAgent || isAuth;
  const hideMobileNav = hideMainLayout || isTourDetail || isCheckout;
  const hideFooter = hideMainLayout || isDashboard;

  return (
    <div className={cn(
      "flex min-h-screen flex-col font-sans antialiased text-gray-900 bg-white w-full max-w-full",
      !isTourDetail && "overflow-x-hidden",
      !hideMobileNav && "pb-[72px] md:pb-0"
    )}>
      {!hideMainLayout && <div className="no-print"><Header /></div>}
      <main className={cn(
        "flex-1",
        !hideMainLayout && !isDashboard && (
          isCheckout ? "md:pt-[120px]" : 
          isTourDetail ? "pt-16 md:pt-[120px]" : 
          "pt-[80px] md:pt-[120px]"
        )
      )}>
        <Suspense fallback={<Loader />}>
          <Routes>
            <Route path="/login" element={<Auth />} />
            <Route path="/customer" element={<DashboardLayout />}>
              <Route path="dashboard" element={<Overview />} />
              <Route path="bookings" element={<Bookings />} />
              <Route path="wishlist" element={<Wishlist />} />
              <Route path="my-plans" element={<MyPlans />} />
              <Route path="profile" element={<Profile />} />
              <Route path="tickets" element={<Tickets />} />
              <Route path="google-analytics" element={<GoogleAnalytics />} />
            </Route>
            <Route path="/" element={<Home />} />
            <Route path="/tours" element={<Tours />} />
            <Route path="/blog" element={<BlogArchive />} />
            <Route path="/blog/:slug" element={<BlogPostDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/planner" element={<AIPlanner />} />
            <Route path="/ai-hub" element={<AIHub />} />
            <Route path="/price-list" element={<PriceList />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/destinations" element={<Destinations />} />
            <Route path="/tour/:slug" element={<TourDetail />} />
            <Route path="/checkout/:tourId" element={<Checkout />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="/supplier/*" element={<Admin />} />
            <Route path="/agent/*" element={<Admin />} />
            <Route path="/track-booking" element={<BookingTracker />} />
            <Route path="/booking-success/:id" element={<BookingSuccess />} />
            <Route path="/booking-confirmation/:id" element={<BookingSuccess />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </Suspense>
      </main>
      {!hideFooter && <div className="no-print"><Footer /></div>}
      {!hideMobileNav && <div className="no-print"><MobileNav /></div>}
      <Suspense fallback={null}>
        <Chatbot />
      </Suspense>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <SettingsProvider>
        <AuthProvider>
          <CurrencyProvider>
            <ScrollToTop />
            <GlobalPopup />
            <AppContent />
          </CurrencyProvider>
        </AuthProvider>
      </SettingsProvider>
    </Router>
  );
}
