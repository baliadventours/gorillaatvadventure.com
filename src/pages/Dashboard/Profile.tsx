import React, { useState, useEffect } from 'react';
import { useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import { 
  User, 
  Mail, 
  Phone, 
  Globe, 
  Calendar, 
  Camera,
  Shield,
  Bell,
  Check,
  Loader2,
  Lock,
  ChevronRight,
  LogOut,
  Wallet
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile, updateEmail, updatePassword, signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

type TabType = 'personal' | 'security' | 'notifications' | 'payout';

export default function Profile() {
  const { user, profile } = useOutletContext<{ user: any; profile: UserProfile }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>(
    (location.state as any)?.tab || 'personal'
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    displayName: profile?.displayName || '',
    phoneNumber: profile?.phoneNumber || '',
    country: profile?.country || '',
    dateOfBirth: profile?.dateOfBirth || '',
    bio: profile?.bio || ''
  });

  const [payoutData, setPayoutData] = useState({
    type: profile?.payoutMethod?.type || 'bank_transfer' as 'bank_transfer' | 'paypal' | 'other',
    bankName: profile?.payoutMethod?.bankName || '',
    accountNumber: profile?.payoutMethod?.accountNumber || '',
    accountHolder: profile?.payoutMethod?.accountHolder || '',
    paypalEmail: profile?.payoutMethod?.paypalEmail || '',
    details: profile?.payoutMethod?.details || ''
  });

  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        displayName: profile.displayName || '',
        phoneNumber: profile.phoneNumber || '',
        country: profile.country || '',
        dateOfBirth: profile.dateOfBirth || '',
        bio: profile.bio || ''
      });
      if (profile.role === 'supplier') {
        setPayoutData({
          type: profile.payoutMethod?.type || 'bank_transfer',
          bankName: profile.payoutMethod?.bankName || '',
          accountNumber: profile.payoutMethod?.accountNumber || '',
          accountHolder: profile.payoutMethod?.accountHolder || '',
          paypalEmail: profile.payoutMethod?.paypalEmail || '',
          details: profile.payoutMethod?.details || ''
        });
      }
    }
  }, [profile]);

  const handlePersonalUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // Update Auth profile
      if (formData.displayName !== user.displayName) {
        await updateProfile(user, { displayName: formData.displayName });
      }

      // Update Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        ...formData,
        updatedAt: serverTimestamp()
      });

      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handlePayoutUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        payoutMethod: payoutData,
        updatedAt: serverTimestamp()
      });

      setMessage({ type: 'success', text: 'Payout method updated successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    ...(profile?.role === 'supplier' ? [{ id: 'payout', label: 'Payout Method', icon: Wallet }] : []),
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-900 leading-tight">Profile Settings</h1>
        <p className="text-gray-500">Manage your account settings and preferences</p>
      </div>

      <div className="bg-white rounded-[24px] shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-4 md:px-6 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-1.5 py-4 px-3 md:py-6 md:px-4 text-xs md:text-sm font-bold border-b-2 transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "border-[#00A651] text-[#00A651]" 
                  : "border-transparent text-gray-400 hover:text-gray-900"
              )}
            >
              <tab.icon className="h-4 w-4 shrink-0" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'personal' && (
              <motion.div
                key="personal"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <form onSubmit={handlePersonalUpdate} className="space-y-8">
                  <div className="flex flex-col md:flex-row gap-8 items-start">
                    <div className="relative group">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-gray-50 group-hover:border-orange-50 transition-colors">
                        <img 
                          src={profile?.photoURL || user?.photoURL} 
                          alt="Avatar" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-gray-100 text-[#00A651] hover:bg-orange-50 transition-colors">
                        <Camera className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Your Photo</h3>
                      <p className="text-sm text-gray-500 mb-4">This will be displayed on your profile and bookings.</p>
                      <div className="flex gap-3">
                        <button type="button" className="text-xs font-bold text-[#00A651] hover:underline">Change Photo</button>
                        <button type="button" className="text-xs font-bold text-red-500 hover:underline">Remove</button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 ml-1">Full name</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input 
                          type="text" 
                          value={formData.displayName}
                          onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                          className="w-full bg-gray-50 border-none rounded-[12px] pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                          placeholder="Your full name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 opacity-60">
                      <label className="text-xs font-bold text-gray-400 ml-1">Email address</label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input 
                          type="email" 
                          disabled
                          value={user?.email || ''}
                          className="w-full bg-gray-50 border-none rounded-[12px] pl-12 pr-4 py-3 text-sm cursor-not-allowed"
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 ml-1">Email cannot be changed directly.</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 ml-1">Phone number</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input 
                          type="text" 
                          value={formData.phoneNumber}
                          onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                          className="w-full bg-gray-50 border-none rounded-[12px] pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                          placeholder="+1 234 567 890"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 ml-1">Country</label>
                      <div className="relative">
                        <Globe className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input 
                          type="text" 
                          value={formData.country}
                          onChange={(e) => setFormData({...formData, country: e.target.value})}
                          className="w-full bg-gray-50 border-none rounded-[12px] pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                          placeholder="USA"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 ml-1">Date of birth</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input 
                          type="date" 
                          value={formData.dateOfBirth}
                          onChange={(e) => setFormData({...formData, dateOfBirth: e.target.value})}
                          className="w-full bg-gray-50 border-none rounded-[12px] pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 ml-1">Bio / about you</label>
                    <textarea 
                      rows={4}
                      value={formData.bio}
                      onChange={(e) => setFormData({...formData, bio: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                      placeholder="Tell us about yourself and your travel style..."
                    />
                  </div>

                  <div className="pt-4 flex flex-col md:flex-row gap-4">
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 px-10 py-3 bg-[#00A651] text-white rounded-[12px] font-bold text-sm hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Save Changes
                    </button>
                    {message && (
                      <p className={cn(
                        "text-sm font-bold self-center",
                        message.type === 'success' ? 'text-[#00A651]' : 'text-red-500'
                      )}>
                        {message.text}
                      </p>
                    )}
                  </div>
                </form>

                <div className="mt-12 pt-8 border-t border-gray-100 md:hidden">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Account Actions</h3>
                  <p className="text-sm text-gray-500 mb-6">Manage your session and account access.</p>
                  <button 
                    onClick={() => {
                      const handleLogout = async () => {
                        await signOut(auth);
                        navigate('/');
                      };
                      handleLogout();
                    }}
                    className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-[12px] bg-red-50 text-red-600 font-bold text-sm active:bg-red-100 transition-all border border-red-100"
                  >
                    <LogOut className="h-5 w-5" />
                    Sign Out from Account
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'payout' && profile?.role === 'supplier' && (
              <motion.div
                key="payout"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <form onSubmit={handlePayoutUpdate} className="space-y-8">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Payout Preferences</h3>
                    <p className="text-sm text-gray-500">Configure how you would like to receive your earnings.</p>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Payout Type</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {[
                        { id: 'bank_transfer', label: 'Bank Transfer', icon: Shield },
                        { id: 'paypal', label: 'PayPal', icon: Mail },
                        { id: 'other', label: 'Other Method', icon: Globe }
                      ].map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setPayoutData({...payoutData, type: method.id as any})}
                          className={cn(
                            "flex flex-col items-center gap-3 p-6 rounded-2xl border-2 transition-all group",
                            payoutData.type === method.id 
                              ? "bg-orange-50 border-[#00A651] text-[#00A651]" 
                              : "bg-white border-gray-100 text-gray-400 hover:border-orange-200"
                          )}
                        >
                          <method.icon className={cn(
                            "h-6 w-6 transition-transform group-hover:scale-110",
                            payoutData.type === method.id ? "text-[#00A651]" : "text-gray-300"
                          )} />
                          <span className="text-xs font-black uppercase tracking-widest">{method.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-6 rounded-[20px] border border-gray-100">
                    {payoutData.type === 'bank_transfer' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500">Bank Name</label>
                          <input 
                            type="text" 
                            required
                            value={payoutData.bankName}
                            onChange={(e) => setPayoutData({...payoutData, bankName: e.target.value})}
                            className="w-full bg-white border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                            placeholder="e.g. Bank of Central Asia"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-500">Account Number</label>
                          <input 
                            type="text" 
                            required
                            value={payoutData.accountNumber}
                            onChange={(e) => setPayoutData({...payoutData, accountNumber: e.target.value})}
                            className="w-full bg-white border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                            placeholder="e.g. 1234567890"
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <label className="text-xs font-bold text-gray-500">Account Holder Name</label>
                          <input 
                            type="text" 
                            required
                            value={payoutData.accountHolder}
                            onChange={(e) => setPayoutData({...payoutData, accountHolder: e.target.value})}
                            className="w-full bg-white border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                            placeholder="e.g. John Doe"
                          />
                        </div>
                      </>
                    )}

                    {payoutData.type === 'paypal' && (
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-gray-500">PayPal Email Address</label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input 
                            type="email" 
                            required
                            value={payoutData.paypalEmail}
                            onChange={(e) => setPayoutData({...payoutData, paypalEmail: e.target.value})}
                            className="w-full bg-white border-none rounded-[12px] pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                            placeholder="paypal@your-business.com"
                          />
                        </div>
                      </div>
                    )}

                    {payoutData.type === 'other' && (
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-xs font-bold text-gray-500">Payment Details</label>
                        <textarea 
                          rows={4}
                          required
                          value={payoutData.details}
                          onChange={(e) => setPayoutData({...payoutData, details: e.target.value})}
                          className="w-full bg-white border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all"
                          placeholder="Please specify your preferred payment method and relevant details (e.g. Crypto Wallet, Wise, etc.)"
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex flex-col md:flex-row gap-4">
                    <button 
                      type="submit" 
                      disabled={loading}
                      className="inline-flex items-center justify-center gap-2 px-10 py-3 bg-[#00A651] text-white rounded-[12px] font-bold text-sm hover:bg-orange-700 transition-all shadow-lg shadow-orange-100 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Update Payout Method
                    </button>
                    {message && (
                      <p className={cn(
                        "text-sm font-bold self-center",
                        message.type === 'success' ? 'text-[#00A651]' : 'text-red-500'
                      )}>
                        {message.text}
                      </p>
                    )}
                  </div>
                </form>
              </motion.div>
            )}

            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="p-6 bg-blue-50 rounded-[20px] flex items-start gap-4">
                  <Shield className="h-6 w-6 text-blue-500 shrink-0" />
                  <div>
                    <h4 className="font-bold text-blue-900 mb-1">Security Recommendation</h4>
                    <p className="text-sm text-blue-700">We recommend changing your password every 3 months to keep your account secure.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Change Password</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 ml-1">Current password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input type="password" placeholder="••••••••" className="w-full bg-gray-50 border-none rounded-[12px] pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 ml-1">New password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input type="password" placeholder="••••••••" className="w-full bg-gray-50 border-none rounded-[12px] pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 ml-1">Confirm new password</label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input type="password" placeholder="••••••••" className="w-full bg-gray-50 border-none rounded-[12px] pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#00A651] transition-all" />
                        </div>
                      </div>
                      <button className="w-full py-3 bg-gray-900 text-white rounded-[12px] font-bold text-sm hover:bg-gray-800 transition-all">Update Password</button>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Account Activity</h3>
                    <div className="space-y-4">
                      {[1, 2].map((i) => (
                        <div key={i} className="p-4 bg-gray-50 rounded-[16px] flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg shadow-sm">
                              <Globe className="h-4 w-4 text-gray-400" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-gray-900">Chrome on macOS</p>
                              <p className="text-[10px] text-gray-400">San Francisco, CA • {i === 1 ? 'Current' : '2 days ago'}</p>
                            </div>
                          </div>
                          <button className="text-[10px] font-bold text-red-500 hover:underline">Log Out</button>
                        </div>
                      ))}
                    </div>
                    <button className="text-xs font-bold text-[#00A651] hover:underline flex items-center gap-1">
                      See all login activity <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Email Notifications</h3>
                      <p className="text-sm text-gray-500">Pick what you want to hear from us in your inbox.</p>
                    </div>
                    <div className="space-y-4">
                      {[
                        { label: 'Booking Updates', desc: 'Get notified about your reservation and itinerary.' },
                        { label: 'Exclusive Offers', desc: 'Be the first to know about discounts and new tours.' },
                        { label: 'Travel Safety', desc: 'Important information regarding your travel destination.' },
                      ].map((item) => (
                        <label key={item.label} className="flex items-start gap-4 cursor-pointer group">
                          <div className="relative flex items-center">
                            <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-gray-300 text-[#00A651] focus:ring-[#00A651] cursor-pointer" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900 group-hover:text-[#00A651] transition-colors">{item.label}</p>
                            <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Push Notifications</h3>
                      <p className="text-sm text-gray-500">Enable real-time updates on your mobile device.</p>
                    </div>
                    <div className="p-6 bg-gray-50 rounded-[24px] border border-dashed border-gray-200 text-center">
                      <Bell className="h-8 w-8 text-gray-300 mx-auto mb-4" />
                      <p className="text-sm font-bold text-gray-900 mb-2">Enable Browser Notifications</p>
                      <p className="text-xs text-gray-400 mb-6 px-4">Receive instant alerts for booking confirmations and pick-up reminders.</p>
                      <button className="px-6 py-2 bg-white border border-gray-100 rounded-full text-xs font-bold text-gray-900 shadow-sm hover:bg-gray-100 transition-all">Enable Now</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
