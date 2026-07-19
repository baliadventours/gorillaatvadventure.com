import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, query, collection, where, getDocs, deleteDoc } from 'firebase/firestore';
import { Mail, Lock, User, ArrowRight, Github, Chrome, Apple, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useSettings } from '../lib/SettingsContext';

type AuthMode = 'signin' | 'signup' | 'forgot';

export default function Auth() {
  const { settings } = useSettings();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from?.pathname || '/';

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    setError(null);
    setResetSent(false);
  };

  const handleSocialLogin = async (provider: 'google' | 'apple') => {
    setLoading(true);
    setError(null);
    try {
      if (provider === 'google') {
        const result = await signInWithPopup(auth, new GoogleAuthProvider());
        const user = result.user;
        
        // Ensure profile exists
        const profileRef = doc(db, 'users', user.uid);
        const profileSnap = await getDoc(profileRef);
        
        if (!profileSnap.exists()) {
          try {
            // Check if there's an existing profile with this email (e.g. manually created partner)
            const q = query(collection(db, 'users'), where('email', '==', user.email));
            const existingProfiles = await getDocs(q);
            
            let migratedData = {};
            if (!existingProfiles.empty) {
              const oldProfile = existingProfiles.docs[0];
              if (oldProfile.id !== user.uid) {
                console.log("[Auth] Merging manually created profile with new Auth profile:", oldProfile.id);
                migratedData = oldProfile.data();
                
                // --- DATA MIGRATION: Update Tours & Bookings that referenced the old ID ---
                try {
                  const toursQuery = query(collection(db, 'tours'), where('supplierId', '==', oldProfile.id));
                  const tourSnaps = await getDocs(toursQuery);
                  for (const tourDoc of tourSnaps.docs) {
                    await updateDoc(doc(db, 'tours', tourDoc.id), { supplierId: user.uid });
                  }
                  
                  const bookingsQuery = query(collection(db, 'bookings'), where('supplierId', '==', oldProfile.id));
                  const bookingSnaps = await getDocs(bookingsQuery);
                  for (const bookingDoc of bookingSnaps.docs) {
                    await updateDoc(doc(db, 'bookings', bookingDoc.id), { supplierId: user.uid });
                  }
                  
                  const userBookingsQuery = query(collection(db, 'bookings'), where('userId', '==', oldProfile.id));
                  const userBookingSnaps = await getDocs(userBookingsQuery);
                  for (const bookingDoc of userBookingSnaps.docs) {
                    await updateDoc(doc(db, 'bookings', bookingDoc.id), { userId: user.uid });
                  }
                } catch (dataMigError) {
                  console.warn("[Auth] Failed to migrate related data (tours/bookings):", dataMigError);
                }

                // Clean up the temporary ID to avoid duplicates
                try {
                  await deleteDoc(doc(db, 'users', oldProfile.id));
                } catch (delError) {
                  console.warn("[Auth] Could not delete old temporary profile during social login migration:", delError);
                }
              }
            }

            await setDoc(profileRef, {
              ...migratedData, // Preserve manually set role, commission, etc.
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || (migratedData as any)?.displayName || 'Traveler',
              photoURL: user.photoURL || (migratedData as any)?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'T')}&background=random`,
              role: (migratedData as any)?.role || 'customer',
              createdAt: (migratedData as any)?.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (mergeError) {
            console.error("[Auth] Social login merge failed:", mergeError);
            // Fallback for social
            await setDoc(profileRef, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || 'Traveler',
              photoURL: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'T')}&background=random`,
              role: 'customer',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }
        
        // Refresh snap for role check
        const finalSnap = await getDoc(profileRef);
        const userRole = (finalSnap.data() as any)?.role || 'customer';
        
        if (from === '/') {
          if (userRole === 'admin') navigate('/admin', { replace: true });
          else if (userRole === 'supplier') navigate('/supplier', { replace: true });
          else if (userRole === 'agent') navigate('/agent', { replace: true });
          else navigate('/customer/dashboard', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      } else {
        setError('Apple login is not configured yet. Please use Google or Email.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'signin' || mode === 'signup') {
        const user = (await (mode === 'signin' 
          ? signInWithEmailAndPassword(auth, email, password)
          : createUserWithEmailAndPassword(auth, email, password))).user;

        if (mode === 'signup') {
          try {
            // Check for existing manually created profile
            const q = query(collection(db, 'users'), where('email', '==', user.email));
            const existingProfiles = await getDocs(q);
            
            let migratedData = {};
            if (!existingProfiles.empty) {
              const oldProfile = existingProfiles.docs[0];
              if (oldProfile.id !== user.uid) {
                console.log("[Auth] Merging existing profile entry:", oldProfile.id);
                migratedData = oldProfile.data();

                // --- DATA MIGRATION: Update Tours & Bookings that referenced the old ID ---
                try {
                  const toursQuery = query(collection(db, 'tours'), where('supplierId', '==', oldProfile.id));
                  const tourSnaps = await getDocs(toursQuery);
                  for (const tourDoc of tourSnaps.docs) {
                    await updateDoc(doc(db, 'tours', tourDoc.id), { supplierId: user.uid });
                  }
                  
                  const bookingsQuery = query(collection(db, 'bookings'), where('supplierId', '==', oldProfile.id));
                  const bookingSnaps = await getDocs(bookingsQuery);
                  for (const bookingDoc of bookingSnaps.docs) {
                    await updateDoc(doc(db, 'bookings', bookingDoc.id), { supplierId: user.uid });
                  }
                  
                  const userBookingsQuery = query(collection(db, 'bookings'), where('userId', '==', oldProfile.id));
                  const userBookingSnaps = await getDocs(userBookingsQuery);
                  for (const bookingDoc of userBookingSnaps.docs) {
                    await updateDoc(doc(db, 'bookings', bookingDoc.id), { userId: user.uid });
                  }
                } catch (dataMigError) {
                  console.warn("[Auth] Failed to migrate related data (tours/bookings):", dataMigError);
                }

                try {
                  await deleteDoc(doc(db, 'users', oldProfile.id));
                } catch (delError) {
                  console.warn("[Auth] Could not delete temporary profile, continuing...", delError);
                }
              }
            }

            await setDoc(doc(db, 'users', user.uid), {
              ...migratedData,
              uid: user.uid,
              email: user.email,
              displayName: fullName || (migratedData as any)?.displayName || 'Traveler',
              photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || (migratedData as any)?.displayName || 'T')}&background=random`,
              role: (migratedData as any)?.role || 'customer',
              createdAt: (migratedData as any)?.createdAt || serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (mergeError) {
            console.error("[Auth] Merging failed, falling back to clean signup:", mergeError);
            // Fallback: Create basic profile even if merging fails
            await setDoc(doc(db, 'users', user.uid), {
              uid: user.uid,
              email: user.email,
              displayName: fullName || 'Traveler',
              photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName || 'T')}&background=random`,
              role: 'customer',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
        }

        const profileSnap = await getDoc(doc(db, 'users', user.uid));
        const userRole = (profileSnap.data() as any)?.role || 'customer';

        if (from === '/') {
          if (userRole === 'admin') navigate('/admin', { replace: true });
          else if (userRole === 'supplier') navigate('/supplier', { replace: true });
          else if (userRole === 'agent') navigate('/agent', { replace: true });
          else navigate('/customer/dashboard', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <Link to="/" className="flex items-center gap-2 group mb-8">
        {settings?.logoURL ? (
          <img src={settings.logoURL} alt={settings.siteName} className="h-16 md:h-24 w-auto object-contain transition-transform group-hover:scale-105" />
        ) : (
          <div className="flex flex-col -space-y-1 items-center">
            <span className="text-2xl font-bold text-gray-900 leading-tight">{settings?.siteName.split(' ')[0] || 'bali'}</span>
            <span className="text-2xl font-bold text-[#00A651] leading-tight">{settings?.siteName.split(' ').slice(1).join(' ') || 'adventours'}</span>
          </div>
        )}
      </Link>

      <div className="w-full max-w-md bg-white rounded-[20px] shadow-sm border border-gray-100 p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {mode === 'signin' ? 'Welcome back!' : mode === 'signup' ? 'Create an account' : 'Reset password'}
              </h1>
              <p className="text-gray-500 text-sm">
                {mode === 'signin' ? 'Please sign in to your account' : mode === 'signup' ? 'Start your adventure with us' : "Enter your email to receive a reset link"}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 text-red-600 text-sm rounded-[10px] border border-red-100">
                {error}
              </div>
            )}

            {resetSent ? (
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-50 text-[#00A651] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-bold mb-2">Check your email</h3>
                <p className="text-gray-500 mb-6 text-sm">We've sent a password reset link to <span className="font-semibold text-gray-900">{email}</span></p>
                <button 
                  onClick={() => setMode('signin')}
                  className="text-[#00A651] font-bold text-sm hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === 'signup' && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 ml-1">Full name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input 
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-[10px] pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 ml-1">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-50 border-none rounded-[10px] pl-11 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                      placeholder="john@example.com"
                    />
                  </div>
                </div>

                {mode !== 'forgot' && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-xs font-bold text-gray-400">Password</label>
                      {mode === 'signin' && (
                        <button 
                          type="button"
                          onClick={() => setMode('forgot')}
                          className="text-xs font-bold text-[#00A651] hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      <input 
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-gray-50 border-none rounded-[10px] pl-11 pr-11 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                        placeholder="••••••••"
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#00A651] text-white py-3 rounded-[10px] font-bold text-sm flex items-center justify-center gap-2 hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                    <>
                      {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {mode !== 'forgot' && !resetSent && (
              <>
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-100"></div>
                  </div>
                  <div className="relative flex justify-center text-xs font-bold">
                    <span className="bg-white px-4 text-gray-400">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => handleSocialLogin('google')}
                    className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 rounded-[10px] border border-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all"
                  >
                    <Chrome className="h-4 w-4 text-red-500" />
                    Google
                  </button>
                  <button 
                    onClick={() => handleSocialLogin('apple')}
                    className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 rounded-[10px] border border-gray-100 text-sm font-bold text-gray-700 hover:bg-gray-100 transition-all"
                  >
                    <Apple className="h-4 w-4" />
                    Apple
                  </button>
                </div>
              </>
            )}

            <div className="mt-8 text-center">
              <p className="text-gray-500 text-sm">
                {mode === 'signin' ? "Don't have an account?" : "Already have an account?"}{' '}
                <button 
                  onClick={() => handleModeChange(mode === 'signin' ? 'signup' : 'signin')}
                  className="text-[#00A651] font-bold hover:underline"
                >
                  {mode === 'signin' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
              {mode === 'forgot' && (
                <button 
                  onClick={() => setMode('signin')}
                  className="mt-2 text-gray-400 text-sm font-medium hover:text-[#00A651]"
                >
                  Back to Sign In
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <Link to="/" className="mt-8 text-gray-400 text-sm font-medium hover:text-gray-600 transition-colors">
        ← Back to home
      </Link>

      <div className="mt-12 text-center max-w-sm">
        <p className="text-xs text-gray-400 leading-relaxed">
          "Just browsing? You can still book tours as a guest without creating an account."
        </p>
      </div>
    </div>
  );
}
