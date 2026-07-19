import { useState, useEffect, FormEvent, ChangeEvent, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { 
  collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, serverTimestamp, query, orderBy,
  getDoc, setDoc, getDocs, collectionGroup, where 
} from 'firebase/firestore';
import { Tour, TourPackage, PricingTier, AddOn, TransportOption, Coupon, PageContent, ImportantInfoSection, UrgencyPoint, Booking, Review, UserProfile, Guide, BlogPost, CommunicationSettings, SiteSettings, BookingLog, TourLabel, Category, TourType, LocationMeta, Inquiry } from '../types';
import RichTextEditor from '../components/RichTextEditor';
import { sendBookingEmail } from '../lib/emailService';
import { sendWhatsAppNotification, getWhatsAppLink, generateBookingMessage, sendCustomWhatsApp } from '../lib/whatsappService';
import * as LucideIcons from 'lucide-react';
const Icons = LucideIcons;
import { 
  Plus, Edit2, Trash2, Save, X, Check,
  Layout, Image as ImageIcon, DollarSign, Map as MapIcon, 
  Info, List, CheckCircle, ChevronRight, 
  PlusCircle, MinusCircle, MessageCircle, Database,
  Upload, Loader2, BarChart3, FileText, TrendingUp, 
  MessageSquare, Monitor, Users, CreditCard, Settings, Wallet,
  Calendar as CalendarIcon, LayoutGrid, Clock, Briefcase, Star,
  Layers, Users2, ChevronDown, PieChart, Tag, MapPin, Globe,
  ShieldAlert, BookOpen, ShieldCheck, Phone, CheckCheck, Copy,
  Sparkles, Wand2, Lightbulb, LogOut, LifeBuoy,
  Camera, Compass, Waves, Mountain, Sun, Tent,
  Bike, Bus, Car, Plane, Sailboat, Palmtree, Navigation, Activity,
  User, CheckCircle2, AlertCircle, FileCode, Terminal, ChevronLeft,
  Share2, Printer, XCircle, ExternalLink, UserCheck, ArrowRight,
  ArrowLeft, Clock4, Ban, Bot,
  Zap, Send, Mail, Search
} from 'lucide-react';

import { cn, formatPrice } from '../lib/utils';
import { uploadImage } from '../lib/imgbb';
import SimpleAnalyticsDashboard from '../components/Admin/SimpleAnalyticsDashboard';

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox: string[];
}

const OSMLocationSelector = ({ onLocationSelect }: { onLocationSelect: (url: string) => void }) => {
  const [queryText, setQueryText] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchLocation = async (text: string) => {
    if (text.length < 3) return;
    setLoading(true);
    setIsOpen(true);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5`);
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('OSM Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (queryText) searchLocation(queryText);
    }, 500);
    return () => clearTimeout(timer);
  }, [queryText]);

  const selectPlace = (place: NominatimResult) => {
    const { lat, lon, boundingbox } = place;
    // OSM Embed URL format using bounding box
    const bbox = `${boundingbox[2]},${boundingbox[0]},${boundingbox[3]},${boundingbox[1]}`;
    const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lon}`;
    onLocationSelect(embedUrl);
    setQueryText(place.display_name);
    setIsOpen(false);
  };

  return (
    <div className="relative group" ref={dropdownRef}>
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors">
        <Search className="h-4 w-4" />
      </div>
      <input 
        value={queryText}
        onChange={(e) => setQueryText(e.target.value)}
        onFocus={() => queryText && setIsOpen(true)}
        className="w-full rounded-2xl border-2 border-orange-100 bg-orange-50/10 pl-11 pr-10 py-4 font-bold text-sm focus:border-primary focus:bg-white focus:outline-none transition-all shadow-sm"
        placeholder="Find location on OpenStreetMap..."
      />
      {loading && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 text-orange-500 animate-spin" />
        </div>
      )}

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {results.map((result) => (
            <button
              key={result.place_id}
              type="button"
              onClick={() => selectPlace(result)}
              className="w-full text-left px-5 py-4 hover:bg-gray-50 flex items-start gap-3 transition-colors border-b border-gray-50 last:border-0"
            >
              <MapPin className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-gray-900 line-clamp-1">{result.display_name}</p>
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">OpenStreetMap Result</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

import { generateTourData, GeneratedTour, generateBlogPostData, GeneratedBlogPost } from '../services/geminiService';
import { COUNTRIES, TIME_SLOTS } from '../constants';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  addDays,
  isBefore,
  subMonths, 
  isToday,
  parseISO 
} from 'date-fns';

import GeneralSettings from '../components/Admin/GeneralSettings';
import PopupManager from '../components/Admin/PopupManager';
import TourListing from '../components/Admin/TourListing';
import BookingDetailModal from '../components/Admin/BookingDetailModal';
import BookingManagementPanel from '../components/Admin/BookingManager';
import StatsDashboard from '../components/Admin/StatsDashboard';
import BookingReports from '../components/Admin/BookingReports';
import PayoutManager from '../components/Admin/PayoutManager';
import BulkAvailabilityModal from '../components/Admin/BulkAvailabilityModal';
import ImportBooking from '../components/Admin/ImportBooking';
import TicketManager from '../components/Admin/TicketManager';
import GoogleAnalytics from './Dashboard/GoogleAnalytics';
import AIHubManager from '../components/Admin/AIHubManager';

type MenuId = 'dashboard' | 'tours' | 'all-tours' | 'categories' | 'tour-types' | 'locations' | 'addons' | 'transports' | 'coupons' | 'schedule' | 'blog' | 'ai-hub' | 'analytics' | 'google-analytics' | 'reviews' | 'communication' | 'payments' | 'settings' | 'users' | 'users-admins' | 'users-suppliers' | 'users-agents' | 'users-customers' | 'payment-settings' | 'pages' | 'urgency-points' | 'timeslots' | 'bookings' | 'import-bookings' | 'guides' | 'overview' | 'inventory' | 'operations' | 'content' | 'settings-group' | 'general-settings' | 'popups-manager' | 'labels' | 'partners' | 'suppliers' | 'agents' | 'company-profile' | 'access-roles' | 'reports' | 'payouts' | 'live-inventory' | 'backup' | 'inquiries' | 'tickets';
type Tab = 'basic' | 'content' | 'inclusions' | 'pricing' | 'itinerary' | 'addOns' | 'transports' | 'faq' | 'info' | 'seo';

const MetaManager = ({ type, items }: { type: 'categories' | 'tour-types' | 'locations' | 'labels', items: (Category | TourType | LocationMeta | TourLabel)[] }) => {
  const [newValue, setNewValue] = useState('');
  const [newIcon, setNewIcon] = useState('');
  const [newColor, setNewColor] = useState('#10b981');
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  
  const collectionName = type === 'categories' ? 'categories' : type === 'tour-types' ? 'tourTypes' : type === 'labels' ? 'tourLabels' : 'locationMeta';
  const label = type === 'categories' ? 'Category' : type === 'tour-types' ? 'Tour Type' : type === 'labels' ? 'Label' : 'Location';

  const PRESET_ICONS = [
    'Tag', 'Globe', 'MapPin', 'Camera', 'Compass', 'Waves', 'Mountain', 'Sun', 'Tent', 
    'Bike', 'Bus', 'Car', 'Plane', 'Sailboat', 'Palmtree', 'Navigation', 'Activity'
  ];

  const PRESET_COLORS = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6b7280', '#06b6d4', '#f97316'
  ];

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    try {
      const data = { 
        name: newValue,
        ...(type === 'categories' && { icon: newIcon }),
        ...(type === 'labels' && { color: newColor })
      };

      if (editingItem) {
        await updateDoc(doc(db, collectionName, editingItem.id), data);
        alert(`Success: ${label} updated!`);
      } else {
        await addDoc(collection(db, collectionName), data);
        alert(`Success: ${label} created!`);
      }
      
      setNewValue('');
      setNewIcon('');
      setNewColor('#10b981');
      setIsAdding(false);
      setEditingItem(null);
    } catch (error) {
      console.error(`Error saving ${label}`, error);
      alert(`Error: Failed to save ${label}. Check permissions.`);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      setNewIcon(url);
    } catch (error) {
      console.error("Upload error", error);
      alert("Failed to upload icon");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Delete this ${label}?`)) {
      await deleteDoc(doc(db, collectionName, id));
    }
  };

  const startEdit = (item: any) => {
    setEditingItem(item);
    setNewValue(item.name);
    setNewIcon(item.icon || '');
    setIsAdding(true);
  };

  const IconDisplay = ({ icon, className }: { icon?: string, className?: string }) => {
    if (!icon) {
       if (type === 'categories') return <Tag className={cn("h-5 w-5", className)} />;
       if (type === 'tour-types') return <Globe className={cn("h-5 w-5", className)} />;
       return <MapPin className={cn("h-5 w-5", className)} />;
    }
    
    if (icon.startsWith('http')) {
      return <img src={icon} className={cn("h-5 w-5 object-contain", className)} referrerPolicy="no-referrer" />;
    }
    
    const IconComponent = (LucideIcons as any)[icon] || (type === 'categories' ? LucideIcons.Tag : type === 'tour-types' ? LucideIcons.Globe : LucideIcons.MapPin);
    return <IconComponent className={cn("h-5 w-5", className)} />;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">{label} Management</h2>
          <p className="text-gray-500 font-medium">Add and organize your {label.toLowerCase()} descriptors.</p>
        </div>
        <button 
          onClick={() => {
            setIsAdding(true);
            setEditingItem(null);
            setNewValue('');
            setNewIcon('');
          }}
          className="bg-primary text-white px-6 py-3 rounded-[10px] font-bold text-sm tracking-wide flex items-center gap-2 shadow-lg shadow-orange-200"
        >
          <Plus className="h-4 w-4" /> Add New {label}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-[10px] border-2 border-primary border-dashed flex flex-col gap-6 motion-safe:animate-in motion-safe:slide-in-from-top-4 shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">
              {editingItem ? `Editing ${label}: ${editingItem.name}` : `Add New ${label}`}
            </h3>
          </div>
          <div className="flex gap-4 items-center">
            <input 
              autoFocus
              required
              placeholder={`Enter ${label.toLowerCase()} name...`}
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              className="flex-1 rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all font-bold"
            />
            <div className="flex gap-2">
              <button type="submit" className="bg-primary text-white px-8 py-4 rounded-[10px] font-black text-xs shadow-xl active:scale-95 transition-all">
                {editingItem ? 'Update' : 'Save'} {label}
              </button>
              <button type="button" onClick={() => {
                setIsAdding(false);
                setEditingItem(null);
              }} className="text-gray-400 font-bold px-4">Cancel</button>
            </div>
          </div>

          {type === 'categories' && (
            <div className="space-y-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Category Icon</p>
              
              <div className="flex flex-wrap gap-2">
                {PRESET_ICONS.map(iconName => (
                  <button
                    key={iconName}
                    type="button"
                    onClick={() => setNewIcon(iconName)}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-all",
                      newIcon === iconName ? "bg-primary border-primary text-white shadow-lg shadow-orange-100" : "bg-gray-50 border-gray-50 text-gray-400 hover:border-orange-200"
                    )}
                  >
                    <IconDisplay icon={iconName} />
                  </button>
                ))}
                
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    id="icon-upload"
                  />
                  <label 
                    htmlFor="icon-upload"
                    className={cn(
                      "flex items-center justify-center p-3 rounded-[10px] border-2 border-dashed transition-all cursor-pointer h-[46px] w-[46px]",
                      newIcon.startsWith('http') ? "bg-primary border-primary text-white shadow-lg shadow-orange-100" : "border-gray-200 text-gray-400 hover:border-primary hover:text-primary"
                    )}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </label>
                </div>
              </div>

              {newIcon.startsWith('http') && (
                <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-[10px] border border-orange-100">
                  <img src={newIcon} className="h-8 w-8 object-contain" referrerPolicy="no-referrer" />
                  <p className="text-xs font-bold text-gray-600">Custom image uploaded</p>
                  <button type="button" onClick={() => setNewIcon('')} className="ml-auto text-red-500 font-bold text-xs">Remove</button>
                </div>
              )}
            </div>
          )}
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-[10px] border border-gray-100 shadow-sm flex items-center justify-between group hover:border-primary transition-all">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 bg-orange-50 rounded-[10px] flex items-center justify-center text-primary transition-transform group-hover:scale-110">
                <IconDisplay icon={(item as any).icon} />
              </div>
              <span className="font-extrabold text-gray-900 tracking-tight">{item.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={() => startEdit(item)}
                className="p-2 text-gray-400 hover:text-primary transition-colors bg-gray-50 rounded-lg"
                title="Edit"
              >
                <Edit2 className="h-4 w-4" />
              </button>
              <button 
                onClick={() => handleDelete(item.id)}
                className="p-2 text-gray-300 hover:text-red-600 transition-colors bg-gray-50 rounded-lg"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CouponManager = ({ items }: { items: Coupon[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<Coupon | null>(null);
  const [formData, setFormData] = useState<Partial<Coupon>>({ 
    code: '', 
    discountType: 'percentage', 
    discountValue: 0, 
    minBookingValue: 0, 
    isActive: true 
  });

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.code?.trim()) return;
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'coupons', editingItem.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        alert("Success: Coupon updated!");
      } else {
        await addDoc(collection(db, 'coupons'), { 
          ...formData,
          createdAt: serverTimestamp()
        });
        alert("Success: Coupon created!");
      }
      setFormData({ code: '', discountType: 'percentage', discountValue: 0, minBookingValue: 0, isActive: true });
      setIsAdding(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Error saving Coupon", error);
      alert("Error: Failed to save Coupon.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Delete this Coupon?`)) {
      await deleteDoc(doc(db, 'coupons', id));
    }
  };

  const startEdit = (coupon: Coupon) => {
    setEditingItem(coupon);
    setFormData(coupon);
    setIsAdding(true);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Coupons</h2>
          <p className="text-gray-500 font-medium">Create and manage discount codes for your tours.</p>
        </div>
        <button 
          onClick={() => {
            setIsAdding(true);
            setEditingItem(null);
            setFormData({ code: '', discountType: 'percentage', discountValue: 0, minBookingValue: 0, isActive: true });
          }}
          className="bg-primary text-white px-6 py-3 rounded-[10px] font-bold text-sm tracking-wide flex items-center gap-2 shadow-lg shadow-orange-200"
        >
          <Plus className="h-4 w-4" /> Add New Coupon
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSave} className="bg-white p-8 rounded-[10px] border border-gray-100 space-y-6 motion-safe:animate-in motion-safe:slide-in-from-top-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-primary uppercase tracking-widest">
              {editingItem ? `Editing Coupon: ${editingItem.code}` : 'Create New Coupon'}
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Coupon Code</label>
              <input 
                required
                placeholder="e.g. SUMMER25"
                value={formData.code}
                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Discount Type</label>
              <select 
                value={formData.discountType}
                onChange={e => setFormData({ ...formData, discountType: e.target.value as any })}
                className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none bg-white font-bold"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Discount Value</label>
              <input 
                required
                type="number"
                value={formData.discountValue}
                onChange={e => setFormData({ ...formData, discountValue: Number(e.target.value) })}
                className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Min. Booking ($)</label>
              <input 
                required
                type="number"
                value={formData.minBookingValue}
                onChange={e => setFormData({ ...formData, minBookingValue: Number(e.target.value) })}
                className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-gray-50">
             <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 font-bold px-4">Cancel</button>
             <button type="submit" className="bg-primary text-white px-10 py-4 rounded-[10px] font-bold text-sm tracking-wide shadow-xl active:scale-95 transition-all">Create Coupon</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-[10px] border border-gray-100 shadow-sm flex flex-col gap-4 group hover:border-primary transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-orange-50 rounded-xl flex items-center justify-center text-primary">
                  <Tag className="h-6 w-6" />
                </div>
                <div>
                  <span className="font-bold text-gray-900 text-lg tracking-tight block">{item.code}</span>
                  <span className="text-sm font-semibold text-primary">
                    {item.discountType === 'percentage' ? `${item.discountValue}% Off` : `$${item.discountValue} Off`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => startEdit(item)}
                  className="p-2 text-gray-400 hover:text-primary transition-colors bg-gray-50 rounded-lg"
                  title="Edit"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-gray-300 hover:text-red-500 transition-colors bg-gray-50 rounded-lg"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-50">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Min. Spend: ${item.minBookingValue}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const PageManager = () => {
    const [pages, setPages] = useState<PageContent[]>([]);
    const [editingPage, setEditingPage] = useState<Partial<PageContent> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'pages'), (snapshot) => {
            setPages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PageContent)));
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingPage?.title || !editingPage?.slug) return;

        try {
            const pageData = {
                title: editingPage.title,
                slug: editingPage.slug.toLowerCase().replace(/ /g, '-'),
                content: editingPage.content || '',
                seo: editingPage.seo || { title: '', description: '' },
                updatedAt: serverTimestamp()
            };

            if (editingPage.id) {
                await updateDoc(doc(db, 'pages', editingPage.id), pageData);
            } else {
                await addDoc(collection(db, 'pages'), pageData);
            }
            setEditingPage(null);
            alert("Page saved successfully!");
        } catch (err) {
            console.error(err);
            alert("Failed to save page.");
        }
    };

    if (loading) return (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>
    );

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-gray-900 tracking-tight">Static Pages</h2>
                    <p className="text-gray-500 font-medium">Manage your Terms and Conditions, Privacy Policy, and other content pages.</p>
                </div>
                <button 
                  onClick={() => setEditingPage({ title: '', slug: '', content: '' })}
                  className="bg-primary text-white px-6 py-3 rounded-[10px] font-bold text-sm tracking-wide flex items-center gap-2 shadow-lg shadow-orange-200"
                >
                  <Plus className="h-4 w-4" /> Create New Page
                </button>
            </div>

            {editingPage && (
                <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className="bg-white rounded-[20px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
                    >
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="text-xl font-black text-gray-900 tracking-tight">
                                {editingPage.id ? 'Edit Page' : 'New Page'}
                            </h3>
                            <button onClick={() => setEditingPage(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="h-6 w-6 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500">Page Title</label>
                                    <input 
                                      required
                                      value={editingPage.title}
                                      onChange={e => setEditingPage({ ...editingPage, title: e.target.value })}
                                      className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none font-bold"
                                      placeholder="e.g. Terms and Conditions"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500">URL Slug</label>
                                    <input 
                                      required
                                      value={editingPage.slug}
                                      onChange={e => setEditingPage({ ...editingPage, slug: e.target.value.toLowerCase().replace(/ /g, '-') })}
                                      className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none font-bold text-gray-500"
                                      placeholder="e.g. terms-and-conditions"
                                      disabled={!!editingPage.id}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-gray-500">Page Content (HTML/Markdown supported)</label>
                                <textarea 
                                  required
                                  rows={10}
                                  value={editingPage.content}
                                  onChange={e => setEditingPage({ ...editingPage, content: e.target.value })}
                                  className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none font-medium min-h-[200px]"
                                  placeholder="Paste your page content here..."
                                />
                            </div>

                            <div className="pt-6 border-t border-gray-100 space-y-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icons.Share2 className="h-4 w-4 text-primary" />
                                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">SEO Settings (Custom Meta)</h4>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Meta Title</label>
                                        <input 
                                            value={editingPage.seo?.title || ''}
                                            onChange={e => setEditingPage({ ...editingPage, seo: { ...editingPage.seo, title: e.target.value } })}
                                            className="w-full rounded-[8px] border border-gray-100 p-3 text-sm focus:border-primary outline-none"
                                            placeholder="SEO Browser Title"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-gray-400 uppercase">Meta Description</label>
                                        <textarea 
                                            value={editingPage.seo?.description || ''}
                                            onChange={e => setEditingPage({ ...editingPage, seo: { ...editingPage.seo, description: e.target.value } })}
                                            className="w-full rounded-[8px] border border-gray-100 p-3 text-sm focus:border-primary outline-none"
                                            rows={2}
                                            placeholder="Short SEO description..."
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                                <button type="button" onClick={() => setEditingPage(null)} className="px-8 py-4 font-bold text-gray-400">Cancel</button>
                                <button type="submit" className="bg-primary text-white px-12 py-4 rounded-[10px] font-bold text-sm tracking-wide shadow-xl active:scale-95 transition-all">
                                    {editingPage.id ? 'Save Changes' : 'Create Page'}
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pages.map(page => (
                    <div key={page.id} className="bg-white p-8 rounded-[10px] border border-gray-100 shadow-sm transition-all hover:border-primary group hover:shadow-md">
                        <div className="flex items-center justify-between mb-6">
                            <div className="h-14 w-14 rounded-[10px] bg-orange-50 text-primary flex items-center justify-center transition-transform group-hover:scale-110">
                                <FileText className="h-7 w-7" />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingPage(page)} className="p-2 text-gray-400 hover:text-primary transition-colors hover:bg-gray-50 rounded-lg"><Edit2 className="h-5 w-5" /></button>
                                <button 
                                  onClick={async () => {
                                    if (confirm("Delete this page?")) await deleteDoc(doc(db, 'pages', page.id));
                                  }}
                                  className="p-2 text-gray-400 hover:text-red-600 transition-colors hover:bg-red-50 rounded-lg"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 tracking-tight mb-2 group-hover:text-primary transition-colors">{page.title}</h3>
                        <p className="text-sm font-semibold text-primary tracking-tight mb-4">/{page.slug}</p>
                        <p className="text-xs text-gray-500 line-clamp-3 font-medium leading-relaxed">
                            {(page.content || '').replace(/<[^>]*>/g, '').substring(0, 150)}...
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BookingTimeManager = () => {
    const [slots, setSlots] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'timeslots'), (snap) => {
            if (snap.exists()) {
                setSlots(snap.data().slots || []);
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    const toggleSlot = async (time: string) => {
        const newSlots = slots.includes(time) 
            ? slots.filter(s => s !== time) 
            : [...slots, time].sort();
        
        try {
            await setDoc(doc(db, 'settings', 'timeslots'), { slots: newSlots });
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>;

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Global Time Slots</h2>
                <p className="text-gray-500 font-medium">Configure the default available 30-minute intervals for your tours.</p>
            </div>

            <div className="bg-white p-8 rounded-[10px] border border-gray-100 shadow-sm space-y-8">
                <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-[10px] border border-primary/10">
                    <div className="h-10 w-10 bg-primary text-white rounded-lg flex items-center justify-center">
                        <Clock className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900">Default Availability</p>
                        <p className="text-xs text-gray-500 font-medium">Selected slots will be available for customers at checkout by default.</p>
                    </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                    {TIME_SLOTS.map(time => {
                        const isSelected = slots.includes(time);
                        return (
                            <button
                                key={time}
                                onClick={() => toggleSlot(time)}
                                className={cn(
                                    "py-3 rounded-xl text-xs font-bold transition-all border-2",
                                    isSelected 
                                        ? "bg-primary text-white border-primary shadow-lg shadow-orange-100" 
                                        : "bg-white text-gray-400 border-gray-50 hover:border-orange-200"
                                )}
                            >
                                {time}
                            </button>
                        );
                    })}
                </div>

                <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                        {slots.length} Active Slots Selected
                    </p>
                    <button 
                        onClick={async () => {
                            if(confirm("Clear all slots?")) await setDoc(doc(db, 'settings', 'timeslots'), { slots: [] });
                        }}
                        className="text-xs font-bold text-red-500 hover:underline"
                    >
                        Clear All
                    </button>
                </div>
            </div>
        </div>
    );
};

  const AnalyticsManager = ({ bookings, tours }: { bookings: Booking[], tours: Tour[] }) => {
    const [viewMode, setViewMode] = useState<'traffic' | 'sales'>('traffic');

    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight text-left">Performance Analytics</h2>
            <p className="text-gray-500 font-medium text-left">Deep dive into your guest interactions, conversions, and booking metrics.</p>
          </div>
          
          <div className="bg-gray-100/60 p-1 rounded-xl flex gap-1 self-start select-none">
            <button
              onClick={() => setViewMode('traffic')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'traffic'
                  ? 'bg-white text-gray-950 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icons.Globe className="w-3.5 h-3.5 text-primary" />
              Guest Traffic
            </button>
            <button
              onClick={() => setViewMode('sales')}
              className={`px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'sales'
                  ? 'bg-white text-gray-950 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icons.DollarSign className="w-3.5 h-3.5 text-primary" />
              Sales & Bookings
            </button>
          </div>
        </div>

        {viewMode === 'traffic' ? (
          <SimpleAnalyticsDashboard />
        ) : (
          <div className="space-y-8 animate-fadeIn text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               <div className="bg-white p-8 rounded-[20px] border border-gray-100 shadow-sm">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Total Revenue</p>
                  <h3 className="text-4xl font-black text-gray-900 tracking-tighter">
                    ${bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0).toLocaleString()}
                  </h3>
                  <div className="mt-4 flex items-center gap-2 text-primary font-bold text-xs">
                     <Icons.TrendingUp className="h-4 w-4" /> Syncing with master systems
                  </div>
               </div>
               <div className="bg-white p-8 rounded-[20px] border border-gray-100 shadow-sm">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Average Booking Value</p>
                  <h3 className="text-4xl font-black text-gray-900 tracking-tighter">
                    ${bookings.length > 0 ? Math.round(bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0) / bookings.length) : 0}
                  </h3>
                  <div className="mt-4 flex items-center gap-2 text-blue-600 font-bold text-xs">
                     <Icons.Users className="h-4 w-4" /> Based on {bookings.length} bookings
                  </div>
               </div>
               <div className="bg-white p-8 rounded-[20px] border border-gray-100 shadow-sm">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Conversion Rate</p>
                  <h3 className="text-4xl font-black text-gray-900 tracking-tighter">3.2%</h3>
                  <div className="mt-4 flex items-center gap-2 text-amber-600 font-bold text-xs">
                     <Icons.Monitor className="h-4 w-4" /> From organic traffic
                  </div>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[20px] border border-gray-100 shadow-sm">
               <h3 className="font-black text-gray-900 mb-8">Tour Popularity</h3>
               <div className="space-y-6">
                  {tours.slice(0, 5).map((tour, i) => {
                    const tourBookings = bookings.filter(b => b.tourId === tour.id).length;
                    const percentage = bookings.length > 0 ? (tourBookings / bookings.length) * 100 : 0;
                    return (
                      <div key={i} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <span className="font-bold text-sm text-gray-900">{tour.title}</span>
                          <span className="text-xs font-black text-gray-500">{tourBookings} Bookings</span>
                        </div>
                        <div className="h-2 bg-gray-50 rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${Math.max(percentage * 5, 2)}%` }} />
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ReviewManager = ({ tours }: { tours: Tour[] }) => {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [newReview, setNewReview] = useState<Partial<Review>>({
      rating: 5,
      userName: '',
      nationality: 'Australia',
      title: '',
      comment: '',
      userPhoto: '',
      images: [],
      tourDate: new Date().toISOString().split('T')[0],
      status: 'approved'
    });
    const [targetTourId, setTargetTourId] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [uploadingImages, setUploadingImages] = useState(false);

    useEffect(() => {
      const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          setReviews(snapshot.docs.map(doc => ({ 
            id: doc.id, 
            refPath: doc.ref.path, // Store the path for easier matching
            ...doc.data() 
          } as any)));
          setLoading(false);
        },
        (error) => {
          console.error("Reviews snapshot error:", error);
          setLoading(false);
        }
      );
      return unsubscribe;
    }, []);

    const handleCreateReview = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!targetTourId || !newReview.userName || !newReview.comment) {
        alert("Please fill in all required fields.");
        return;
      }

      try {
        const tour = tours.find(t => t.id === targetTourId);
        const reviewData = {
          ...newReview,
          tourId: targetTourId,
          tourTitle: tour?.title || 'Tour',
          status: 'approved',
          isVerified: true,
          label: 'Verified Guest',
          createdAt: serverTimestamp(),
          userId: auth.currentUser?.uid || 'admin'
        };

        await addDoc(collection(db, 'reviews'), reviewData);

        // Recalculate rating
        const reviewsSnap = await getDocs(query(collection(db, 'reviews'), where('tourId', '==', targetTourId), where('status', '==', 'approved')));
        const approvedReviews = reviewsSnap.docs.map(d => d.data() as Review);
        const count = approvedReviews.length;
        const avg = count > 0 
          ? parseFloat((approvedReviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1))
          : 0;
            
        await updateDoc(doc(db, 'tours', targetTourId), {
          rating: avg,
          reviewsCount: count
        });

        alert("Review created successfully!");
        setShowAddForm(false);
        setNewReview({
          rating: 5,
          userName: '',
          nationality: 'Australia',
          title: '',
          comment: '',
          userPhoto: '',
          images: [],
          tourDate: new Date().toISOString().split('T')[0],
          status: 'approved'
        });
        setTargetTourId('');
      } catch (err) {
        console.error(err);
        alert("Error creating review");
      }
    };

    const handleDelete = async (review: any) => {
      if (confirm(`Delete review from ${review.userName}?`)) {
        try {
          const docRef = doc(db, review.refPath);
          const tourId = review.tourId;
          
          await deleteDoc(docRef);
          
          // Recalculate tour average rating
          if (tourId) {
            const reviewsSnap = await getDocs(query(collection(db, 'reviews'), where('tourId', '==', tourId), where('status', '==', 'approved')));
            const approvedReviews = reviewsSnap.docs.map(d => d.data() as Review);
            
            const count = approvedReviews.length;
            const avg = count > 0 
              ? parseFloat((approvedReviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1))
              : 0;
              
            await updateDoc(doc(db, 'tours', tourId), {
              rating: avg,
              reviewsCount: count
            });
          }
          alert("Review deleted.");
        } catch (error) {
          console.error("Error deleting", error);
        }
      }
    };

    const handleModerate = async (review: any, status: 'approved' | 'rejected') => {
      try {
        const docRef = doc(db, review.refPath);
        await updateDoc(docRef, { status });
        
        // Recalculate tour average rating
        const tourId = review.tourId;
        if (tourId) {
          const reviewsSnap = await getDocs(query(collection(db, 'reviews'), where('tourId', '==', tourId), where('status', '==', 'approved')));
          const approvedReviews = reviewsSnap.docs.map(d => d.data() as Review);
          
          const count = approvedReviews.length;
          const avg = count > 0 
            ? parseFloat((approvedReviews.reduce((sum, r) => sum + r.rating, 0) / count).toFixed(1))
            : 0;
            
          await updateDoc(doc(db, 'tours', tourId), {
            rating: avg,
            reviewsCount: count
          });
        }
        
        alert(`Review ${status}!`);
      } catch (error) {
        console.error("Error moderating", error);
      }
    };

    if (loading) return <div className="flex justify-center p-20"><Icons.Loader2 className="animate-spin text-primary" /></div>;

    return (
      <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Guest Reviews</h2>
          <p className="text-gray-500 font-medium text-sm">Monitor and moderate all client feedback across all tours.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
           {/* View Switcher */}
           <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
             <button 
               onClick={() => setViewMode('list')}
               className={cn(
                 "p-2 rounded-lg transition-all",
                 viewMode === 'list' ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
               )}
               title="List View"
             >
               <Icons.List className="h-4 w-4" />
             </button>
             <button 
               onClick={() => setViewMode('grid')}
               className={cn(
                 "p-2 rounded-lg transition-all",
                 viewMode === 'grid' ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
               )}
               title="Grid View"
             >
               <Icons.LayoutGrid className="h-4 w-4" />
             </button>
           </div>

           <button 
             onClick={() => setShowAddForm(!showAddForm)}
             className="bg-primary text-white px-6 py-3 rounded-[10px] font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all"
           >
             {showAddForm ? <Icons.X className="h-4 w-4" /> : <Icons.Plus className="h-4 w-4" />}
             {showAddForm ? 'Cancel' : 'Write Review'}
           </button>
           <div className="flex items-center gap-4 bg-orange-50 px-6 py-3 rounded-[10px] border border-orange-100">
              <div className="flex flex-col items-center">
                 <span className="text-xl font-black text-primary">{reviews.filter(r => (r as any).status === 'approved').length}</span>
                 <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Approved</span>
              </div>
              <div className="w-px h-6 bg-orange-100" />
              <div className="flex flex-col items-center">
                 <span className="text-xl font-black text-amber-500">{reviews.filter(r => !(r as any).status || (r as any).status === 'pending').length}</span>
                 <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none">Pending</span>
              </div>
           </div>
        </div>
      </div>

        {showAddForm && (
          <form onSubmit={handleCreateReview} className="bg-white p-8 rounded-[10px] border border-orange-100 shadow-sm space-y-6 motion-safe:animate-in motion-safe:fade-in">
             <h3 className="font-black text-gray-900 uppercase tracking-widest text-xs">Create Professional Admin Review</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Select Tour</label>
                   <select 
                     value={targetTourId}
                     onChange={e => setTargetTourId(e.target.value)}
                     className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold focus:border-primary focus:bg-white focus:outline-none transition-all"
                   >
                     <option value="">Select Tour...</option>
                     {tours.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Guest Name</label>
                   <input 
                     type="text" 
                     value={newReview.userName}
                     onChange={e => setNewReview({...newReview, userName: e.target.value})}
                     className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold focus:border-primary focus:bg-white focus:outline-none transition-all"
                     placeholder="John Doe"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Nationality</label>
                   <select 
                     value={newReview.nationality}
                     onChange={e => setNewReview({...newReview, nationality: e.target.value})}
                     className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold focus:border-primary focus:bg-white focus:outline-none transition-all"
                   >
                     {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Guest Avatar</label>
                   <div className="flex items-center gap-4">
                     <div className="h-14 w-14 rounded-full bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden">
                       {newReview.userPhoto ? (
                         <img src={newReview.userPhoto} className="h-full w-full object-cover" />
                       ) : (
                         <Icons.User className="h-6 w-6 text-gray-300" />
                       )}
                     </div>
                     <div className="flex-1">
                       <label className="relative cursor-pointer bg-white border-2 border-gray-100 px-4 py-2 rounded-lg text-[10px] font-bold text-gray-600 hover:border-primary transition-all inline-block">
                         {uploadingAvatar ? (
                           <div className="flex items-center gap-2">
                             <Icons.Loader2 className="h-3 w-3 animate-spin" />
                             Uploading...
                           </div>
                         ) : 'Choose Photo'}
                         <input 
                           type="file" 
                           className="hidden" 
                           accept="image/*"
                           onChange={async (e) => {
                             const file = e.target.files?.[0];
                             if (file) {
                               try {
                                 setUploadingAvatar(true);
                                 const url = await uploadImage(file);
                                 setNewReview({...newReview, userPhoto: url});
                               } catch (err) {
                                 alert("Upload failed");
                               } finally {
                                 setUploadingAvatar(false);
                               }
                             }
                           }}
                         />
                       </label>
                       {newReview.userPhoto && (
                         <button 
                           type="button" 
                           onClick={() => setNewReview({...newReview, userPhoto: ''})}
                           className="ml-2 text-[10px] font-bold text-red-500 underline"
                         >
                           Remove
                         </button>
                       )}
                     </div>
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Rating</label>
                   <input 
                     type="number" 
                     min="1" max="5"
                     value={newReview.rating}
                     onChange={e => setNewReview({...newReview, rating: parseInt(e.target.value)})}
                     className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold focus:border-primary focus:bg-white focus:outline-none transition-all"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tour Date</label>
                   <input 
                     type="date" 
                     value={newReview.tourDate}
                     onChange={e => setNewReview({...newReview, tourDate: e.target.value})}
                     className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold focus:border-primary focus:bg-white focus:outline-none transition-all"
                   />
                </div>
             </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Review Headline / Highlight</label>
              <input 
                type="text" 
                value={newReview.title || ''}
                onChange={e => setNewReview({...newReview, title: e.target.value})}
                className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold focus:border-primary focus:bg-white focus:outline-none transition-all"
                placeholder="e.g. Unforgettable Sunrise Experience!"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Comment</label>
              <textarea 
                value={newReview.comment}
                onChange={e => setNewReview({...newReview, comment: e.target.value})}
                className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold focus:border-primary focus:bg-white focus:outline-none transition-all h-32"
                placeholder="Write the review content here..."
              />
            </div>

             <div className="space-y-4 pt-4 border-t border-gray-50">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Experience Photos (Optional)</label>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {(newReview.images || []).map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-100 group">
                      <img src={img} className="h-full w-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setNewReview({ ...newReview, images: newReview.images?.filter((_, i) => i !== idx) })}
                        className="absolute top-1 right-1 bg-white/90 p-1 rounded-full text-red-500 shadow-sm opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Icons.X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary hover:bg-orange-50/10 transition-all">
                    {uploadingImages ? (
                      <Icons.Loader2 className="h-6 w-6 animate-spin text-primary" />
                    ) : (
                      <>
                        <Icons.Camera className="h-6 w-6 text-gray-300" />
                        <span className="text-[8px] font-black text-gray-400 uppercase">Add Photo</span>
                      </>
                    )}
                    <input 
                      type="file" 
                      className="hidden" 
                      multiple 
                      accept="image/*"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          try {
                            setUploadingImages(true);
                            const urls = await Promise.all(files.map(f => uploadImage(f)));
                            setNewReview({ ...newReview, images: [...(newReview.images || []), ...urls] });
                          } catch (err) {
                            alert("Upload failed");
                          } finally {
                            setUploadingImages(false);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
             </div>

             <button type="submit" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all">
                Publish Verified Review
             </button>
          </form>
        )}

        <div className={cn(
          "grid gap-6",
          viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"
        )}>
          {reviews.map(review => {
            const status = (review as any).status || 'pending';
            return (
              <div key={review.id} className={cn(
                "bg-white p-8 rounded-[10px] border shadow-sm flex flex-col gap-6 group transition-all",
                viewMode === 'list' ? "md:flex-row md:items-start" : "flex-col",
                status === 'approved' ? "border-orange-100" : status === 'rejected' ? "border-red-100 opacity-60" : "border-amber-200 bg-amber-50/10"
              )}>
                <div className={cn(
                  "h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center shrink-0 border border-gray-100 overflow-hidden",
                  viewMode === 'grid' && "mx-auto"
                )}>
                  {review.userPhoto ? (
                    <img src={review.userPhoto} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-2xl font-black text-primary">{review.userName.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 space-y-4">
                  <div className={cn(
                    "flex flex-col justify-between gap-4",
                    viewMode === 'list' ? "md:flex-row md:items-center" : "items-center text-center"
                  )}>
                    <div className="flex-1">
                      <div className={cn(
                        "flex items-center gap-3",
                        viewMode === 'grid' && "justify-center"
                      )}>
                        <h3 className="font-black text-gray-900 text-lg flex items-center gap-2">
                           {review.userName}
                           {review.nationality && (
                             <span className="text-[10px] font-bold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                               <Icons.Globe className="h-2.5 w-2.5" /> {review.nationality}
                             </span>
                           )}
                        </h3>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                          status === 'approved' ? "bg-orange-100 text-orange-700" : 
                          status === 'rejected' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {status}
                        </span>
                      </div>
                      <p className={cn(
                        "text-xs font-bold text-gray-400 flex flex-wrap items-center gap-2 mt-0.5",
                        viewMode === 'grid' && "justify-center"
                      )}>
                         <span className="flex items-center gap-2"><Icons.Calendar className="h-3 w-3" /> Traveled on {review.tourDate || 'Unknown Date'}</span>
                         {review.tourTitle && <span className="text-primary">• Experience: {review.tourTitle}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Icons.Star key={s} className={cn("h-4 w-4", review.rating >= s ? "fill-current" : "text-gray-200")} />
                      ))}
                    </div>
                  </div>
                  <div className={cn(
                    "space-y-2",
                    viewMode === 'grid' && "text-center"
                  )}>
                     {review.title && <h4 className={cn("font-black text-gray-900", viewMode === 'list' ? "border-l-4 border-primary pl-3" : "text-lg")}>{review.title}</h4>}
                     <p className="text-gray-600 text-sm leading-relaxed line-clamp-4">{review.comment}</p>
                  </div>
                  
                  {((review as any).images && (review as any).images.length > 0) ? (
                    <div className={cn(
                      "flex flex-wrap gap-2 mt-4",
                      viewMode === 'grid' && "justify-center"
                    )}>
                      {(review as any).images.map((img: string, idx: number) => (
                        <div key={idx} className="h-16 w-16 rounded-lg overflow-hidden border border-gray-100 shadow-sm cursor-zoom-in" onClick={() => window.open(img, '_blank')}>
                           <img src={img} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                    </div>
                  ) : review.image && (
                    <div className={cn(
                      "mt-4 rounded-xl overflow-hidden border border-gray-100 h-24 w-40 shadow-sm cursor-zoom-in",
                      viewMode === 'grid' && "mx-auto"
                    )} onClick={() => window.open(review.image, '_blank')}>
                       <img src={review.image} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  )}
                  
                  <div className="pt-6 border-t border-gray-50 flex items-center justify-end gap-3 flex-wrap">
                    {status !== 'approved' && (
                      <button 
                        onClick={() => handleModerate(review, 'approved')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-[10px] font-black uppercase tracking-widest hover:bg-orange-700 transition-all shadow-lg shadow-orange-100"
                      >
                        <Check className="h-3 w-3" /> Approve
                      </button>
                    )}
                    {status !== 'rejected' && (
                      <button 
                        onClick={() => handleModerate(review, 'rejected')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border-2 border-red-50 text-red-600 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all"
                      >
                        <X className="h-3 w-3" /> Reject
                      </button>
                    )}
                    <button 
                      onClick={() => handleDelete(review)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border-2 border-gray-50 text-gray-400 text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {reviews.length === 0 && (
            <div className="p-20 text-center text-gray-400 bg-white rounded-[10px] border border-gray-100 border-dashed">
               No reviews collected yet.
            </div>
          )}
        </div>
      </div>
    );
  };  const UserManager = ({ users, setUsers, onDeleteUser, roleFilter, allTours = [], resetForm, setFormData, formData, setActiveMenu }: { 
    users: UserProfile[], 
    setUsers: (u: UserProfile[]) => void, 
    onDeleteUser: (u: UserProfile) => void, 
    roleFilter?: UserProfile['role'], 
    allTours?: Tour[],
    resetForm: () => void,
    setFormData: (f: any) => void,
    formData: any,
    setActiveMenu: (m: any) => void
  }) => {
    const [loading, setLoading] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [isAddingPartner, setIsAddingPartner] = useState(false);
    const [newPartner, setNewPartner] = useState<Partial<UserProfile>>({
      role: roleFilter || 'supplier',
      status: 'active',
      displayName: '',
      email: '',
      companyName: '',
      commissionRate: 10,
      discountRate: 15
    });

    // Update newPartner role if roleFilter changes
    useEffect(() => {
      if (roleFilter) {
        setNewPartner(prev => ({ ...prev, role: roleFilter }));
      }
    }, [roleFilter]);

    useEffect(() => {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
        setLoading(false);
      });
      return unsubscribe;
    }, []);

    const filteredUsers = useMemo(() => {
      if (!roleFilter) return users;
      return users.filter(u => u.role === roleFilter);
    }, [users, roleFilter]);

    const handleCreatePartner = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newPartner.email || !newPartner.displayName) {
        alert("Email and Name are required");
        return;
      }
      
      const tempId = `u_${Math.random().toString(36).substr(2, 9)}`;
      console.log("[Admin] Attempting to create user:", {
        email: newPartner.email,
        role: newPartner.role,
        currentUser: auth.currentUser?.email,
        authUid: auth.currentUser?.uid,
        tempId
      });
      
      setLoading(true);
      try {
        const partnerData = {
          ...newPartner,
          uid: tempId,
          photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(newPartner.displayName || '')}&background=random`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        console.log("[Admin] Target path: users/" + tempId);
        await setDoc(doc(db, 'users', tempId), partnerData);
        console.log("[Admin] User created successfully");
        
        setIsAddingPartner(false);
        setNewPartner({
          role: roleFilter || 'supplier',
          status: 'active',
          displayName: '',
          email: '',
          companyName: '',
          commissionRate: 10,
          discountRate: 15
        });
        alert(`${newPartner.role?.charAt(0).toUpperCase()}${newPartner.role?.slice(1)} account created! Note: They still need to sign up with this email to access their dashboard.`);
      } catch (error: any) {
        console.error("Error creating user", error);
        if (error.code === 'permission-denied') {
          handleFirestoreError(error, OperationType.WRITE, `users/${tempId}`);
        }
        alert("Failed to create user. " + (error.message || ""));
      } finally {
        setLoading(false);
      }
    };
;

    const handleSaveUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!editingUser) return;
      try {
        await updateDoc(doc(db, 'users', editingUser.uid), {
          role: editingUser.role,
          status: editingUser.status || 'active',
          commissionRate: Number(editingUser.commissionRate || 0),
          discountRate: Number(editingUser.discountRate || 0),
          companyName: editingUser.companyName || '',
          publicEmail: editingUser.publicEmail || '',
          taxId: editingUser.taxId || '',
          phoneNumber: editingUser.phoneNumber || '',
          website: editingUser.website || '',
          instagramUrl: editingUser.instagramUrl || '',
          facebookUrl: editingUser.facebookUrl || '',
          twitterUrl: editingUser.twitterUrl || '',
          tiktokUrl: editingUser.tiktokUrl || '',
          payoutMethod: editingUser.payoutMethod || null,
          updatedAt: serverTimestamp()
        });
        setEditingUser(null);
        alert("User updated successfully!");
      } catch (error) {
        console.error("Error updating user", error);
        alert("Failed to update user.");
      }
    };

    const handleDeleteUserLocal = async (user: UserProfile) => {
      setLoading(true);
      await onDeleteUser(user);
      setLoading(false);
    };

    if (loading) return <div className="flex justify-center p-20"><Icons.Loader2 className="animate-spin text-primary" /></div>;

    const roleName = roleFilter ? roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1) : 'System';

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">{roleName} Users</h2>
            <p className="text-gray-500 font-medium">Manage permissions, roles, and financial terms.</p>
          </div>
          <button 
            onClick={() => setIsAddingPartner(true)}
            className="px-6 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all flex items-center gap-2"
          >
            <Icons.PlusCircle className="h-4 w-4" /> Add New {roleFilter || 'User'}
          </button>
        </div>

        <div className="bg-white rounded-[10px] border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">User Profile</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                {roleFilter === 'supplier' && (
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Tours</th>
                )}
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Commission/Discount</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredUsers.map(u => (
                <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                       <img src={u.photoURL} className="h-10 w-10 rounded-full border-2 border-white shadow-sm" referrerPolicy="no-referrer" />
                       <div>
                         <p className="text-sm font-black text-gray-900">{u.displayName}</p>
                         <p className="text-[10px] font-bold text-gray-400 tracking-tight">{u.email}</p>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                     <span className={cn(
                       "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider",
                       u.role === 'admin' ? "bg-red-50 text-red-600" :
                       u.role === 'supplier' ? "bg-purple-50 text-purple-600" :
                       u.role === 'agent' ? "bg-blue-50 text-blue-600" :
                       "bg-gray-100 text-gray-500"
                     )}>
                       {u.role}
                     </span>
                  </td>
                  <td className="px-6 py-4">
                     <div className="flex items-center gap-1.5">
                       <div className={cn(
                         "h-1.5 w-1.5 rounded-full",
                         u.status === 'active' || !u.status ? "bg-orange-500" :
                         u.status === 'pending' ? "bg-amber-500" : "bg-red-500"
                       )} />
                       <span className="text-[10px] font-black uppercase text-gray-600 tracking-widest">
                         {u.status || 'active'}
                       </span>
                     </div>
                  </td>
                  {roleFilter === 'supplier' && (
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {allTours.filter(t => t.supplierId === u.uid).map(t => (
                          <button
                            key={t.id}
                            onClick={() => window.open(`/tours/${t.slug}`, '_blank')}
                            className="bg-gray-100 text-[9px] font-black uppercase text-gray-500 px-2 py-1 rounded-md hover:bg-primary/10 hover:text-primary transition-all whitespace-nowrap"
                            title={t.title}
                          >
                            {t.title}
                          </button>
                        ))}
                        {allTours.filter(t => t.supplierId === u.uid).length === 0 && (
                          <div className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-xl border border-dashed border-gray-200 w-full">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-tight">No Tours Assigned</span>
                            <button 
                              onClick={() => {
                                resetForm();
                                setFormData({ ...formData, supplierId: u.uid, supplierName: u.companyName || u.displayName });
                                setActiveMenu('tours');
                              }}
                              className="text-[9px] font-bold text-primary hover:underline mt-0.5"
                            >
                              + Create First Tour
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 text-xs font-black text-gray-900">
                    {u.role === 'supplier' ? `${u.commissionRate || 0}% Fee` : 
                     u.role === 'agent' ? `${u.discountRate || 0}% Disc` : 
                     '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                     <div className="flex justify-end gap-2">
                       <button 
                         onClick={() => setEditingUser(u)}
                         className="p-2 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-all"
                         title="Edit User"
                       >
                          <Icons.Settings className="h-4 w-4" />
                       </button>
                       <button 
                         onClick={() => handleDeleteUserLocal(u)}
                         className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                         title="Delete User"
                       >
                          <Icons.Trash2 className="h-4 w-4" />
                       </button>
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add New Partner Modal */}
        <AnimatePresence>
          {isAddingPartner && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAddingPartner(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-8 flex items-center justify-between border-b border-gray-50 flex-shrink-0">
                  <div>
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Create New {roleFilter ? roleName : 'User'}</h3>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">Manual account setup</p>
                  </div>
                  <button onClick={() => setIsAddingPartner(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                    <Icons.X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-8 pt-6 space-y-8 overflow-y-auto custom-scrollbar flex-grow">
                  <form onSubmit={handleCreatePartner} id="create-partner-form" className="space-y-6">
                    {!roleFilter && (
                      <div className="space-y-2">
                         <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">User Role</label>
                         <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {(['admin', 'supplier', 'agent', 'customer'] as UserProfile['role'][]).map(r => (
                              <button 
                                key={r}
                                type="button" 
                                onClick={() => setNewPartner({...newPartner, role: r})}
                                className={cn(
                                  "p-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest", 
                                  newPartner.role === r 
                                    ? "border-primary bg-orange-50 text-orange-700" 
                                    : "border-gray-50 text-gray-400"
                                )}>
                                 {r}
                              </button>
                            ))}
                         </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Full Name / Contact Person</label>
                        <input
                          required
                          type="text"
                          value={newPartner.displayName}
                          onChange={(e) => setNewPartner({...newPartner, displayName: e.target.value})}
                          className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                          placeholder="e.g. John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email (Primary for notifications)</label>
                        <input
                          required
                          type="email"
                          value={newPartner.email}
                          onChange={(e) => setNewPartner({...newPartner, email: e.target.value})}
                          className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                          placeholder="partner@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Company Name</label>
                        <input
                          type="text"
                          value={newPartner.companyName}
                          onChange={(e) => setNewPartner({...newPartner, companyName: e.target.value})}
                          className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                          placeholder="e.g. Bali Tours Ltd."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                          {newPartner.role === 'supplier' ? 'Commission Fee (%)' : 'Wholesale Discount (%)'}
                        </label>
                        <input
                          type="number"
                          value={newPartner.role === 'supplier' ? newPartner.commissionRate : newPartner.discountRate}
                          onChange={(e) => setNewPartner({
                            ...newPartner, 
                            [newPartner.role === 'supplier' ? 'commissionRate' : 'discountRate']: Number(e.target.value)
                          })}
                          className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Account Status</label>
                        <div className="flex h-11 items-center px-4 bg-gray-50 rounded-2xl">
                           <span className="text-xs font-bold text-gray-900">Active</span>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-4 flex-shrink-0">
                  <button 
                    type="button" 
                    onClick={() => setIsAddingPartner(false)}
                    className="flex-1 py-4 bg-white text-gray-500 border border-gray-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-gray-100 transition-all font-sans"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    form="create-partner-form"
                    disabled={loading}
                    className="flex-[2] py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-orange-700 transition-all shadow-xl shadow-orange-100 disabled:opacity-50 font-sans"
                  >
                    {loading ? "Creating..." : "Save Partner Profile"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* User Edit Modal */}
        <AnimatePresence>
          {editingUser && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingUser(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-8 flex items-center justify-between border-b border-gray-50 flex-shrink-0">
                  <div className="flex items-center gap-4">
                    <img src={editingUser.photoURL} className="h-12 w-12 rounded-full border-2 border-primary/10" referrerPolicy="no-referrer" />
                    <div>
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">Edit Profile</h3>
                      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">{editingUser.displayName}</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingUser(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                    <Icons.X className="h-5 w-5" />
                  </button>
                </div>

                <div className="p-8 pt-6 space-y-8 overflow-y-auto custom-scrollbar flex-grow">
                  <form onSubmit={handleSaveUser} id="edit-user-form" className="space-y-6 pb-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Access Role</label>
                        <select
                          value={editingUser.role}
                          onChange={(e) => setEditingUser({...editingUser, role: e.target.value as any})}
                          className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="customer">Customer</option>
                          <option value="agent">Agent (Wholesale)</option>
                          <option value="supplier">Supplier (Vendor)</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Account Status</label>
                        <select
                          value={editingUser.status || 'active'}
                          onChange={(e) => setEditingUser({...editingUser, status: e.target.value as any})}
                          className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20"
                        >
                          <option value="active">Active</option>
                          <option value="pending">Pending Approval</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                    </div>

                    {editingUser.role === 'supplier' && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 bg-purple-50/50 p-6 rounded-3xl border border-purple-100">
                        <div className="flex items-center gap-3 mb-2">
                          <Icons.Store className="h-5 w-5 text-purple-600" />
                          <h4 className="text-sm font-black text-purple-900 uppercase tracking-tight">Supplier Configuration</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">Platform Commission (%)</label>
                            <input
                              type="number"
                              value={editingUser.commissionRate}
                              onChange={(e) => setEditingUser({...editingUser, commissionRate: Number(e.target.value)})}
                              className="w-full bg-white border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                              placeholder="e.g. 15"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">Company Name</label>
                            <input
                              type="text"
                              value={editingUser.companyName}
                              onChange={(e) => setEditingUser({...editingUser, companyName: e.target.value})}
                              className="w-full bg-white border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                                placeholder="Legal Entity Name"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">Public / Support Email</label>
                            <input
                              type="email"
                              value={editingUser.publicEmail}
                              onChange={(e) => setEditingUser({...editingUser, publicEmail: e.target.value})}
                              className="w-full bg-white border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                              placeholder="For guest contact"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">WhatsApp / Phone</label>
                            <input
                              type="text"
                              value={editingUser.phoneNumber}
                              onChange={(e) => setEditingUser({...editingUser, phoneNumber: e.target.value})}
                              className="w-full bg-white border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                              placeholder="+62..."
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">Website</label>
                            <input
                              type="url"
                              value={editingUser.website}
                              onChange={(e) => setEditingUser({...editingUser, website: e.target.value})}
                              className="w-full bg-white border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                              placeholder="https://..."
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">Instagram</label>
                            <input
                              type="text"
                              value={editingUser.instagramUrl}
                              onChange={(e) => setEditingUser({...editingUser, instagramUrl: e.target.value})}
                              className="w-full bg-white border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                              placeholder="@handle or URL"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-purple-400 uppercase tracking-widest px-1">Facebook</label>
                            <input
                              type="text"
                              value={editingUser.facebookUrl}
                              onChange={(e) => setEditingUser({...editingUser, facebookUrl: e.target.value})}
                              className="w-full bg-white border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                              placeholder="URL"
                            />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-purple-100">
                          <div className="flex items-center gap-3 mb-4">
                            <Icons.Wallet className="h-4 w-4 text-purple-600" />
                            <h5 className="text-[10px] font-black text-purple-900 uppercase tracking-widest">Payout Settings</h5>
                          </div>
                          
                          <div className="space-y-4">
                            <select
                              value={editingUser.payoutMethod?.type || 'bank_transfer'}
                              onChange={(e) => setEditingUser({
                                ...editingUser, 
                                payoutMethod: { 
                                  ...(editingUser.payoutMethod || { type: 'bank_transfer' }), 
                                  type: e.target.value as any 
                                }
                              })}
                              className="w-full bg-white border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                            >
                              <option value="bank_transfer">Bank Transfer</option>
                              <option value="paypal">PayPal</option>
                              <option value="other">Other Method</option>
                            </select>

                            {(!editingUser.payoutMethod || editingUser.payoutMethod.type === 'bank_transfer') && (
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Bank Name</label>
                                  <input 
                                    type="text" 
                                    value={editingUser.payoutMethod?.bankName || ''}
                                    onChange={(e) => setEditingUser({
                                      ...editingUser,
                                      payoutMethod: { ...editingUser.payoutMethod!, type: 'bank_transfer', bankName: e.target.value }
                                    })}
                                    className="w-full bg-white border-none rounded-xl py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Account Number</label>
                                  <input 
                                    type="text" 
                                    value={editingUser.payoutMethod?.accountNumber || ''}
                                    onChange={(e) => setEditingUser({
                                      ...editingUser,
                                      payoutMethod: { ...editingUser.payoutMethod!, type: 'bank_transfer', accountNumber: e.target.value }
                                    })}
                                    className="w-full bg-white border-none rounded-xl py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                                  />
                                </div>
                                <div className="space-y-1 col-span-2">
                                  <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Account Holder</label>
                                  <input 
                                    type="text" 
                                    value={editingUser.payoutMethod?.accountHolder || ''}
                                    onChange={(e) => setEditingUser({
                                      ...editingUser,
                                      payoutMethod: { ...editingUser.payoutMethod!, type: 'bank_transfer', accountHolder: e.target.value }
                                    })}
                                    className="w-full bg-white border-none rounded-xl py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                                  />
                                </div>
                              </div>
                            )}

                            {editingUser.payoutMethod?.type === 'paypal' && (
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">PayPal Email</label>
                                <input 
                                  type="email" 
                                  value={editingUser.payoutMethod?.paypalEmail || ''}
                                  onChange={(e) => setEditingUser({
                                    ...editingUser,
                                    payoutMethod: { ...editingUser.payoutMethod!, type: 'paypal', paypalEmail: e.target.value }
                                  })}
                                  className="w-full bg-white border-none rounded-xl py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                                />
                              </div>
                            )}

                            {editingUser.payoutMethod?.type === 'other' && (
                              <div className="space-y-1">
                                <label className="text-[9px] font-bold text-gray-400 uppercase ml-1">Payout Details</label>
                                <textarea 
                                  rows={2}
                                  value={editingUser.payoutMethod?.details || ''}
                                  onChange={(e) => setEditingUser({
                                    ...editingUser,
                                    payoutMethod: { ...editingUser.payoutMethod!, type: 'other', details: e.target.value }
                                  })}
                                  className="w-full bg-white border-none rounded-xl py-2 px-3 text-sm font-bold focus:ring-2 focus:ring-purple-200"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {editingUser.role === 'agent' && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                        <div className="flex items-center gap-3 mb-2">
                          <Icons.BadgePercent className="h-5 w-5 text-blue-600" />
                          <h4 className="text-sm font-black text-blue-900 uppercase tracking-tight">Agent Configuration</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-1">Base Discount (%)</label>
                            <input
                              type="number"
                              value={editingUser.discountRate}
                              onChange={(e) => setEditingUser({...editingUser, discountRate: Number(e.target.value)})}
                              className="w-full bg-white border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-200"
                              placeholder="e.g. 10"
                            />
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest px-1">Company / Branch</label>
                             <input
                               type="text"
                               value={editingUser.companyName}
                               onChange={(e) => setEditingUser({...editingUser, companyName: e.target.value})}
                               className="w-full bg-white border-none rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-blue-200"
                               placeholder="Agency Name"
                             />
                           </div>
                        </div>
                      </motion.div>
                    )}

                  </form>
                </div>

                <div className="p-6 bg-gray-50 border-t border-gray-100 flex gap-4 flex-shrink-0">
                  <button
                    type="submit"
                    form="edit-user-form"
                    className="flex-1 bg-gray-900 text-white rounded-2xl py-4 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-gray-200 hover:bg-black transition-all active:scale-95 font-sans"
                  >
                    Commit Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="flex-1 bg-white text-gray-500 border border-gray-200 rounded-2xl py-4 font-black uppercase text-[10px] tracking-widest hover:bg-gray-100 transition-all active:scale-95 font-sans"
                  >
                    Discard
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const PaymentManager = () => {
  const [settings, setSettings] = useState({
    paypalClientId: '',
    paypalSecret: '',
    paypalSandboxClientId: '',
    paypalSandboxSecret: '',
    paypalMode: 'sandbox' as 'live' | 'sandbox',
    isPaypalEnabled: false,
    creditCardEnabled: false,
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    swiftCode: '',
    bankInstructions: '',
    isPayOnArrivalEnabled: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'payment');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as any);
        }
      } catch (err) {
        console.error("Error fetching settings", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'settings', 'payment'), settings);
      alert("Success: Payment configuration saved!");
    } catch (err) {
      console.error(err);
      alert("Error: Failed to save configuration. Check permissions.");
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <p className="text-gray-400 font-bold text-xs tracking-widest uppercase">Loading encrypted settings...</p>
    </div>
  );

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Payment Gateways</h2>
        <p className="text-gray-500 font-medium">Configure secure customer checkout and automated payouts.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={handleSave} className="bg-white p-10 rounded-[10px] border border-gray-100 shadow-sm space-y-10">
            <div className="space-y-8">
              {/* PayPal Header Toggle */}
              <div className="flex items-center justify-between p-6 bg-orange-50/30 rounded-2xl border border-orange-100">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-orange-100">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-gray-900">PayPal Express Checkout</h4>
                    <p className="text-xs text-primary font-bold mt-0.5">Primary Gateway</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setSettings({...settings, paypalMode: 'sandbox'})}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                        settings.paypalMode === 'sandbox' 
                          ? "bg-white text-orange-600 shadow-sm" 
                          : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      Sandbox
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({...settings, paypalMode: 'live'})}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all",
                        settings.paypalMode === 'live' 
                          ? "bg-white text-primary shadow-sm" 
                          : "text-gray-400 hover:text-gray-600"
                      )}
                    >
                      Live
                    </button>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={settings.isPaypalEnabled}
                      onChange={e => setSettings({...settings, isPaypalEnabled: e.target.checked})}
                      className="sr-only peer" 
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>
              </div>

              {/* Client ID Section */}
              <div className={cn("space-y-6 transition-all duration-500", !settings.isPaypalEnabled && "opacity-40 grayscale pointer-events-none")}>
                {settings.paypalMode === 'live' ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-primary tracking-widest uppercase flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                        Live PayPal Client ID
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <CreditCard className="h-4 w-4 text-gray-300 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                        <input 
                          type="text"
                          placeholder="Enter your Production Client ID"
                          value={settings.paypalClientId}
                          onChange={e => setSettings({...settings, paypalClientId: e.target.value})}
                          className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 pl-12 focus:border-orange-500 focus:bg-white focus:outline-none transition-all font-mono text-sm tracking-tight"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Live Client Secret (Optional)</label>
                      <input 
                        type="password"
                        placeholder="Required for some advanced features"
                        value={settings.paypalSecret || ''}
                        onChange={e => setSettings({...settings, paypalSecret: e.target.value})}
                        className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-orange-500 focus:bg-white focus:outline-none transition-all font-mono text-sm tracking-tight"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-orange-600 tracking-widest uppercase flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                        Sandbox PayPal Client ID
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <Icons.Terminal className="h-4 w-4 text-gray-300 group-focus-within:text-orange-500 transition-colors" />
                        </div>
                        <input 
                          type="text"
                          placeholder="Enter your Sandbox Client ID"
                          value={settings.paypalSandboxClientId || ''}
                          onChange={e => setSettings({...settings, paypalSandboxClientId: e.target.value})}
                          className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 pl-12 focus:border-orange-500 focus:bg-white focus:outline-none transition-all font-mono text-sm tracking-tight"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Sandbox Client Secret (Optional)</label>
                      <input 
                        type="password"
                        placeholder="Enter your Sandbox Client Secret"
                        value={settings.paypalSandboxSecret || ''}
                        onChange={e => setSettings({...settings, paypalSandboxSecret: e.target.value})}
                        className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-orange-500 focus:bg-white focus:outline-none transition-all font-mono text-sm tracking-tight"
                      />
                    </div>
                  </div>
                )}
                
                <div className="bg-gray-50 p-4 rounded-xl flex gap-3 text-gray-400">
                  <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <p className="text-[10px] leading-relaxed font-medium capitalize">
                    {settings.paypalMode === 'live' ? (
                      <>Retrieve your <span className="text-gray-900 font-bold">Live Credentials</span> from the <a href="https://developer.paypal.com/dashboard/applications/live" target="_blank" className="text-primary underline font-black">Production Dashboard</a>.</>
                    ) : (
                      <>
                        Test transactions using your <span className="text-gray-900 font-bold">Sandbox Credentials</span>. 
                        <br />
                        <span className="text-orange-600 font-black mt-1 block">Important: Log in with a "Personal" buyer account from <a href="https://developer.paypal.com/dashboard/accounts" target="_blank" className="underline">PayPal Accounts</a>. You cannot pay using your Business/Merchant account.</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Advanced CC Toggle */}
              <div className={cn("pt-6 border-t border-gray-50 transition-all duration-500", !settings.isPaypalEnabled && "opacity-0 invisible h-0 overflow-hidden")}>
                <label className="flex items-center gap-4 cursor-pointer group p-4 hover:bg-gray-50 rounded-xl transition-all">
                  <div className={cn(
                    "h-6 w-6 rounded border-2 flex items-center justify-center transition-all",
                    settings.creditCardEnabled ? "bg-primary border-primary text-white" : "border-gray-200"
                  )}>
                    {settings.creditCardEnabled && <Check className="h-4 w-4" />}
                  </div>
                  <input 
                    type="checkbox"
                    checked={settings.creditCardEnabled}
                    onChange={e => setSettings({...settings, creditCardEnabled: e.target.checked})}
                    className="hidden"
                  />
                  <div>
                    <span className="text-sm font-black text-gray-900 group-hover:text-primary transition-colors">Direct Card Entry</span>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Allow customers to pay via card without leaving checkout</p>
                  </div>
                </label>
              </div>

              {/* Bank Transfer Settings */}
              <div className="pt-8 border-t border-gray-50 space-y-6">
                <div>
                  <h4 className="text-sm font-black text-gray-900 flex items-center gap-2">
                    <Database className="h-4 w-4 text-secondary" /> Manual Bank Transfer Details
                  </h4>
                  <p className="text-[10px] text-gray-400 font-medium">These details will be shown to customers who choose manual bank transfer.</p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Bank Name</label>
                    <input 
                      type="text"
                      placeholder="e.g. Bank Central Asia (BCA)"
                      value={settings.bankName || ''}
                      onChange={e => setSettings({...settings, bankName: e.target.value})}
                      className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Account Number</label>
                    <input 
                      type="text"
                      placeholder="e.g. 1234567890"
                      value={settings.accountNumber || ''}
                      onChange={e => setSettings({...settings, accountNumber: e.target.value})}
                      className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">SWIFT Code</label>
                    <input 
                      type="text"
                      placeholder="e.g. BCACIDJA"
                      value={settings.swiftCode || ''}
                      onChange={e => setSettings({...settings, swiftCode: e.target.value})}
                      className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Account Holder Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. PT Bali Adventours"
                    value={settings.accountHolder || ''}
                    onChange={e => setSettings({...settings, accountHolder: e.target.value})}
                    className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Payment Instructions</label>
                  <textarea 
                    rows={3}
                    placeholder="e.g. Please include your Booking ID as the reference number."
                    value={settings.bankInstructions || ''}
                    onChange={e => setSettings({...settings, bankInstructions: e.target.value})}
                    className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold text-sm"
                  />
                </div>
              </div>

              {/* Pay on Arrival Settings */}
              <div className="pt-8 border-t border-gray-50 space-y-6">
                <div className="flex items-center justify-between p-6 bg-emerald-50/30 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-100">
                      <DollarSign className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-gray-900">Pay on Arrival (Cash)</h4>
                      <p className="text-xs text-emerald-600 font-bold mt-0.5">Toggle cash payment availability at checkout</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={settings.isPayOnArrivalEnabled ?? true}
                      onChange={e => setSettings({...settings, isPayOnArrivalEnabled: e.target.checked})}
                      className="sr-only peer" 
                    />
                    <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-primary text-white py-5 rounded-[10px] font-bold text-sm tracking-wide shadow-2xl shadow-orange-100 hover:bg-orange-700 transition-all flex items-center justify-center gap-3 active:scale-95"
            >
              <Save className="h-4 w-4" /> Save Global Configuration
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-900 rounded-[10px] p-8 text-white relative overflow-hidden">
            <div className="absolute -right-8 -bottom-8 h-40 w-40 bg-white/5 rounded-full blur-3xl" />
            <h4 className="text-xl font-bold mb-4 flex items-center gap-2 relative z-10">
              <Star className="h-5 w-5 text-amber-400 fill-current" /> Security Note
            </h4>
            <p className="text-sm text-gray-400 leading-relaxed font-medium relative z-10">
              Clients never store sensitive payment data. We strictly use modern redirect or component-based methods ensuring 
              <span className="text-white font-bold ml-1">PCI-DSS compliance</span> at all times.
            </p>
          </div>

          <div className="rounded-[10px] border border-gray-100 p-8 space-y-4">
            <h4 className="text-xs font-black text-gray-900 tracking-widest uppercase">Transaction Preview</h4>
            <div className="p-4 rounded-xl bg-gray-50 space-y-2">
              <div className="flex justify-between text-[10px] font-bold text-gray-400">
                <span>Fee (2.9% + $0.30)</span>
                <span>-$3.20</span>
              </div>
              <div className="flex justify-between text-xs font-black text-primary border-t border-gray-100 pt-2">
                <span>Next Payout Deposit</span>
                <span>$96.80</span>
              </div>
            </div>
            <p className="text-[9px] text-gray-400">Estimated for a $100.00 booking through PayPal Express.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const UrgencyPointManager = ({ items }: { items: UrgencyPoint[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<UrgencyPoint>>({ 
    title: '', 
    description: '',
    icon: 'ShieldCheck'
  });

  const icons = [
    { name: 'ShieldCheck', icon: ShieldCheck },
    { name: 'Calendar', icon: CalendarIcon },
    { name: 'Info', icon: Info },
    { name: 'CreditCard', icon: CreditCard },
    { name: 'Clock', icon: Clock },
    { name: 'MapPin', icon: MapPin },
    { name: 'CheckCircle', icon: CheckCircle },
    { name: 'MessageSquare', icon: MessageSquare }
  ];

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) return;
    try {
      await addDoc(collection(db, 'urgencyPoints'), formData);
      setFormData({ title: '', description: '', icon: 'ShieldCheck' });
      setIsAdding(false);
      alert("Success: Urgency Point created!");
    } catch (error) {
      console.error("Error saving Urgency Point", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Delete this Urgency Point?`)) {
      await deleteDoc(doc(db, 'urgencyPoints', id));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Urgency Points</h2>
          <p className="text-gray-500 font-medium text-sm">Key trust features and urgency highlights shown on tour pages.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-primary text-white px-6 py-3 rounded-[10px] font-bold text-sm flex items-center gap-2 shadow-lg shadow-orange-200 active:scale-95 transition-all"
        >
          <Plus className="h-4 w-4" /> Add New Point
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="bg-white p-8 rounded-[10px] border border-gray-100 space-y-6 motion-safe:animate-in motion-safe:slide-in-from-top-4 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Feature Title</label>
              <input 
                required 
                value={formData.title} 
                onChange={e => setFormData({ ...formData, title: e.target.value })} 
                className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold" 
                placeholder="e.g. Free Cancellation"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Short Description</label>
              <input 
                value={formData.description} 
                onChange={e => setFormData({ ...formData, description: e.target.value })} 
                className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold" 
                placeholder="e.g. Up to 24 hours before"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Visual Icon</label>
              <div className="flex flex-wrap gap-2">
                {icons.map(ic => (
                  <button 
                    key={ic.name}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: ic.name })}
                    className={cn(
                      "p-3 rounded-xl border-2 transition-all",
                      formData.icon === ic.name ? "bg-primary text-white border-primary shadow-lg shadow-orange-100" : "bg-white text-gray-400 border-gray-50 hover:border-orange-200"
                    )}
                  >
                    <ic.icon className="h-5 w-5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-6 border-t border-gray-50">
            <button type="button" onClick={() => setIsAdding(false)} className="px-6 py-3 font-bold text-gray-400 text-sm">Cancel</button>
            <button type="submit" className="bg-primary text-white px-10 py-4 rounded-xl font-bold text-sm tracking-wide shadow-xl active:scale-95 transition-all">Save Urgency Point</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => {
          const IconComp = icons.find(ic => ic.name === item.icon)?.icon || ShieldCheck;
          return (
            <div key={item.id} className="bg-white p-6 rounded-[10px] border border-gray-100 shadow-sm flex items-start justify-between group hover:border-primary transition-all">
              <div className="flex gap-4">
                <div className="h-12 w-12 bg-orange-50 rounded-xl flex items-center justify-center text-primary shrink-0 transition-transform group-hover:scale-110">
                  <IconComp className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-gray-900 tracking-tight text-lg mb-1 truncate">{item.title}</h3>
                  <p className="text-gray-500 text-xs font-medium leading-relaxed">{item.description}</p>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(item.id)} 
                className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AddOnManager = ({ items }: { items: AddOn[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<AddOn>>({ name: '', description: '', price: 0, unit: 'per person' });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;
    try {
      await addDoc(collection(db, 'globalAddOns'), { ...formData, price: Number(formData.price) });
      setFormData({ name: '', description: '', price: 0, unit: 'per person' });
      setIsAdding(false);
      alert("Success: Add-on created!");
    } catch (error) {
      console.error("Error saving Add-on", error);
      alert("Error: Failed to save Add-on. Check permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Delete this Add-on?`)) {
      await deleteDoc(doc(db, 'globalAddOns', id));
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Global Add-ons</h2>
          <p className="text-gray-500 font-medium">Create add-ons once and pick them for any tour.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-primary text-white px-6 py-3 rounded-[10px] font-bold text-sm tracking-wide flex items-center gap-2 shadow-lg shadow-orange-200"
        >
          <Plus className="h-4 w-4" /> Add New Add-on
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="bg-white p-8 rounded-[10px] border-2 border-primary border-dashed space-y-4 motion-safe:animate-in motion-safe:slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-semibold text-gray-500">Add-on Name</label>
              <input 
                required
                placeholder="e.g. Airport Transfer"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400">Price ($)</label>
              <input 
                required
                type="number"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400">Unit</label>
              <select 
                value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value as any })}
                className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none bg-white font-bold"
              >
                <option value="per person">Per Person</option>
                <option value="per booking">Per Booking</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400">Description</label>
            <textarea 
              placeholder="Detailed description of the service..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
             <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 font-bold px-4">Cancel</button>
             <button type="submit" className="bg-primary text-white px-10 py-4 rounded-[10px] font-bold text-sm tracking-wide shadow-xl">Create Add-on</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-[10px] border border-gray-100 shadow-sm flex flex-col gap-4 group hover:border-primary transition-all">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-orange-50 rounded-[10px] flex items-center justify-center text-primary">
                  <PlusCircle className="h-5 w-5" />
                </div>
                <div>
                  <span className="font-extrabold text-gray-900 tracking-tight block">{item.name}</span>
                  <span className="text-[10px] font-black text-primary">{formatPrice(item.price)} / {item.unit}</span>
                </div>
              </div>
              <button 
                onClick={() => handleDelete(item.id)}
                className="p-2 text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
            {item.description && (
              <p className="text-xs text-gray-500 font-medium border-t border-gray-50 pt-3">{item.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const TransportOptionManager = ({ items }: { items: TransportOption[] }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<TransportOption>>({
    name: '',
    type: 'meet',
    carType: '',
    price: 0,
    priceType: 'per_person',
    description: '',
    maxCapacity: undefined
  });

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;
    try {
      await addDoc(collection(db, 'globalTransports'), {
        ...formData,
        price: Number(formData.price),
        maxCapacity: formData.maxCapacity ? Number(formData.maxCapacity) : null
      });
      setFormData({
        name: '',
        type: 'meet',
        carType: '',
        price: 0,
        priceType: 'per_person',
        description: '',
        maxCapacity: undefined
      });
      setIsAdding(false);
      alert("Success: Transport Option created!");
    } catch (error) {
      console.error("Error saving Transport Option", error);
      alert("Error: Failed to save Transport Option.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Delete this Transport Option?`)) {
      try {
        await deleteDoc(doc(db, 'globalTransports', id));
      } catch (error) {
        console.error("Error deleting Transport Option", error);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Global Transports</h2>
          <p className="text-gray-500 font-medium">Create transfer and pickup options to link with your tours.</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-primary text-white px-6 py-3 rounded-[10px] font-bold text-sm tracking-wide flex items-center gap-2 shadow-lg shadow-orange-200"
        >
          <Plus className="h-4 w-4" /> Add New Option
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleCreate} className="bg-white p-8 rounded-[10px] border-2 border-primary border-dashed space-y-6 motion-safe:animate-in motion-safe:slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Option Name</label>
              <input 
                required
                placeholder="e.g. SHARED TRANSFER (Toyota Commuter)"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-500">Transfer Type</label>
              <select 
                value={formData.type}
                onChange={e => {
                  const val = e.target.value as any;
                  setFormData({ 
                    ...formData, 
                    type: val,
                    price: val === 'meet' ? 0 : formData.price 
                  });
                }}
                className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none bg-white font-bold"
              >
                <option value="meet">Meet on location</option>
                <option value="shared">Shared transfer</option>
                <option value="private">Private transfer</option>
              </select>
            </div>
          </div>

          {formData.type !== 'meet' && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in duration-200">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Type of Car / Vehicle</label>
                <input 
                  placeholder="e.g. SUV, Luxury Coach, Mini-bus"
                  value={formData.carType}
                  onChange={e => setFormData({ ...formData, carType: e.target.value })}
                  className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Max Capacity (pax)</label>
                <input 
                  type="number"
                  placeholder="e.g. 5, 10, 40"
                  value={formData.maxCapacity || ''}
                  onChange={e => setFormData({ ...formData, maxCapacity: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Price ($)</label>
                <input 
                  required
                  type="number"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                  className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-500">Pricing Basis</label>
                <select 
                  value={formData.priceType}
                  onChange={e => setFormData({ ...formData, priceType: e.target.value as any })}
                  className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none bg-white font-bold"
                >
                  <option value="per_person">Per Person</option>
                  <option value="per_car">Per Vehicle/Car</option>
                </select>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500">Description</label>
            <textarea 
              placeholder="e.g. Comfortable air-conditioned pickup from major city hotels."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 mt-4">
             <button type="button" onClick={() => setIsAdding(false)} className="text-gray-400 font-bold px-4">Cancel</button>
             <button type="submit" className="bg-primary text-white px-10 py-4 rounded-[10px] font-bold text-sm tracking-wide shadow-xl">Create Option</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map(item => (
          <div key={item.id} className="bg-white p-6 rounded-[10px] border border-gray-100 shadow-sm flex flex-col justify-between gap-4 group hover:border-primary transition-all">
            <div>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-orange-50 rounded-[10px] flex items-center justify-center text-primary">
                    <Car className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="font-extrabold text-gray-900 tracking-tight block leading-snug">{item.name}</span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block mt-0.5">
                      Type: {item.type === 'meet' ? 'Meet on Location' : item.type === 'shared' ? 'Shared Transfer' : 'Private Transfer'}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-gray-300 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>

              {(item.carType || (item.maxCapacity !== undefined && item.maxCapacity !== null)) && (
                <div className="mt-3 text-xs font-semibold text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                  {item.carType && (
                    <span>Vehicle: <span className="font-extrabold text-gray-700">{item.carType}</span></span>
                  )}
                  {item.maxCapacity !== undefined && item.maxCapacity !== null && (
                    <span>Max Capacity: <span className="font-extrabold text-gray-700">{item.maxCapacity} pax</span></span>
                  )}
                </div>
              )}

              {item.description && (
                <p className="text-xs text-gray-500 font-medium border-t border-gray-50 pt-3 mt-3">{item.description}</p>
              )}
            </div>

            <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-400 uppercase">Rate</span>
              <span className="text-sm font-black text-primary">
                {item.type === 'meet' ? 'Free' : `${formatPrice(item.price)} / ${item.priceType === 'per_person' ? 'person' : 'vehicle'}`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const COLLECTION_METADATA = [
  { id: 'tours', name: 'Tours', desc: 'Tour products, rates, and configurations', category: 'Pillars', icon: Compass },
  { id: 'bookings', name: 'Bookings', desc: 'Customer reservations, tickets, status', category: 'Pillars', icon: Briefcase },
  { id: 'users', name: 'Users & Roles', desc: 'Administrative and partner profiles', category: 'Pillars', icon: Users },
  { id: 'coupons', name: 'Coupons', desc: 'Discount vouchers and codes', category: 'Finance', icon: Tag },
  { id: 'inventory', name: 'Inventory Slots', desc: 'Schedules and pricing templates', category: 'Pillars', icon: CalendarIcon },
  { id: 'guides', name: 'Guides', desc: 'Tour guide logs and register', category: 'Pillars', icon: UserCheck },
  { id: 'reviews', name: 'Reviews', desc: 'Customer testimonials and feedback stars', category: 'Quality', icon: Star },
  { id: 'categories', name: 'Categories', desc: 'Tour categorization groups', category: 'Settings', icon: LayoutGrid },
  { id: 'locationMeta', name: 'Locations', desc: 'Tour regional descriptors', category: 'Settings', icon: MapPin },
  { id: 'tourTypes', name: 'Tour Types', desc: 'Activity tags and categories', category: 'Settings', icon: Layers },
  { id: 'tourLabels', name: 'Labels', desc: 'Badge highlights like "Best Seller"', category: 'Settings', icon: Tag },
  { id: 'urgencyPoints', name: 'Urgency Flashers', desc: 'Urgency counts and details', category: 'Settings', icon: Zap },
  { id: 'popups', name: 'Popups', desc: 'Notification modals and alerts', category: 'Quality', icon: Monitor },
  { id: 'pages', name: 'Pages', desc: 'Custom policy and info web pages', category: 'Content', icon: FileCode },
  { id: 'posts', name: 'Blog Posts', desc: 'Blog news and write-ups', category: 'Content', icon: BookOpen },
  { id: 'globalAddOns', name: 'Add-ons', desc: 'Optional booking supplements', category: 'Settings', icon: PlusCircle },
  { id: 'globalTransports', name: 'Transports', desc: 'Global transport options', category: 'Settings', icon: Car },
  { id: 'payouts', name: 'Payouts', desc: 'Finance splits and transaction receipts', category: 'Finance', icon: Wallet },
  { id: 'partnerSettings', name: 'Profiles & Partners', desc: 'Agent and supplier settings', category: 'Settings', icon: Users2 },
  { id: 'communicationSettings', name: 'Templates', desc: 'Automated email & WhatsApp script blocks', category: 'Settings', icon: MessageSquare },
  { id: 'generalSettings', name: 'Settings', desc: 'Currency configurations, headers, setups', category: 'Settings', icon: Settings }
];

const BackupManager = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Partial backup states
  const [backupMode, setBackupMode] = useState<'full' | 'selective'>('full');
  const [selectedCollections, setSelectedCollections] = useState<string[]>(
    COLLECTION_METADATA.map(c => c.id)
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');

  // Selective Restore states
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [parsedBackup, setParsedBackup] = useState<any | null>(null);
  const [restoreCollections, setRestoreCollections] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Toggle collection selection for backup
  const toggleCollection = (id: string) => {
    if (selectedCollections.includes(id)) {
      setSelectedCollections(selectedCollections.filter(c => c !== id));
    } else {
      setSelectedCollections([...selectedCollections, id]);
    }
  };

  const selectAllCollections = () => {
    setSelectedCollections(COLLECTION_METADATA.map(c => c.id));
  };

  const clearAllCollections = () => {
    setSelectedCollections([]);
  };

  // Filter collections for dynamic UI
  const filteredCollections = useMemo(() => {
    return COLLECTION_METADATA.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            c.desc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === 'all' || c.category.toLowerCase() === activeTab.toLowerCase();
      return matchesSearch && matchesTab;
    });
  }, [searchQuery, activeTab]);

  const handleBackup = async (format: 'json' | 'csv' = 'json') => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    const user = auth.currentUser;
    if (!user) {
      setError('No authenticated user found. Please log in again.');
      setIsLoading(false);
      return;
    }

    if (format === 'json' && backupMode === 'selective' && selectedCollections.length === 0) {
      setError('Please select at least one collection to back up.');
      setIsLoading(false);
      return;
    }
    
    try {
      const token = await user.getIdToken();
      
      // Determine what to backup. CSV specializes in bookings. Partial backup requests specified collections.
      const colParam = format === 'csv' 
        ? 'bookings' 
        : (backupMode === 'full' ? '' : selectedCollections.join(','));

      const response = await fetch(`/api/admin/backup${colParam ? `?collections=${colParam}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Backup failed');
      }
      const fullData = await response.json();
      
      let finalBlob: Blob;
      let filename: string;

      if (format === 'csv') {
        // For CSV, we'll specialize in Bookings as it's the most requested
        const bookings = fullData.data.bookings || [];
        if (bookings.length === 0) {
          setSuccess(null);
          setError('No bookings found in the database to export to CSV.');
          setIsLoading(false);
          return;
        }

        const headers = [
          'ID', 'Reference', 'Date', 'Tour', 'Customer Name', 'Customer Email', 'Phone', 
          'Status', 'Total Amount', 'Supplier Name', 'Payment Method'
        ];
        
        const rows = bookings.map((b: any) => [
          b.id,
          b.reference || b.id?.substring(0, 8).toUpperCase(),
          b.date,
          `"${(b.tourTitle || 'N/A').replace(/"/g, '""')}"`,
          `"${(b.customerData?.fullName || 'N/A').replace(/"/g, '""')}"`,
          b.customerData?.email || 'N/A',
          `'${b.customerData?.phone || ''}`, // Force string in Excel
          b.status,
          b.totalAmount,
          `"${(b.supplierName || 'System').replace(/"/g, '""')}"`,
          b.paymentMethod || 'manual'
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map((r: any) => r.join(','))
        ].join('\n');

        finalBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        filename = `bookings-export-${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        finalBlob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
        const prefix = backupMode === 'selective' ? 'partial' : 'full';
        filename = `${prefix}-backup-${new Date().toISOString().split('T')[0]}.json`;
      }

      const url = window.URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setSuccess(`${format.toUpperCase()} Backup downloaded successfully!`);
    } catch (err: any) {
      setError(err.message || 'Backup failed');
    } finally {
      setIsLoading(false);
    }
  };

  const processSelectedFile = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Please upload a valid JSON backup file.');
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.data) {
        throw new Error('Invalid backup file format. Missing "data" layer.');
      }

      setRestoreFile(file);
      setParsedBackup(parsed);

      const cols = Object.keys(parsed.data).filter(col => {
        return Array.isArray(parsed.data[col]) && parsed.data[col].length > 0;
      });

      setRestoreCollections(cols); // Select all found collections by default
      setSuccess(`Backup file "${file.name}" parsed successfully! Select collections below to restore.`);
      setError(null);
    } catch (err: any) {
      setError(`Failed to read the backup: ${err.message}`);
      setSuccess(null);
      setRestoreFile(null);
      setParsedBackup(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processSelectedFile(file);
    }
    e.target.value = '';
  };

  const executeRestore = async () => {
    if (!parsedBackup || !restoreFile) return;

    if (restoreCollections.length === 0) {
      setError('Please select at least one collection to restore.');
      return;
    }

    if (!window.confirm(`WARNING: This will overwrite or merge data in the selected collections (${restoreCollections.join(', ')}). Are you absolutely sure you want to proceed?`)) {
      return;
    }

    setRestoreLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('No authenticated user found. Please login again.');
      
      const filteredData: Record<string, any[]> = {};
      for (const col of restoreCollections) {
        if (parsedBackup.data[col]) {
          filteredData[col] = parsedBackup.data[col];
        }
      }

      const token = await user.getIdToken();
      const response = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ data: filteredData })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Restore failed');
      }

      const statsMsg = Object.entries(result.stats || {})
        .map(([col, cnt]) => `${COLLECTION_METADATA.find(c => c.id === col)?.name || col}: ${cnt} items`)
        .join(', ');
      
      setSuccess(`Restore completed successfully! Restored details: ${statsMsg}`);
      setRestoreFile(null);
      setParsedBackup(null);
    } catch (err: any) {
      setError(err.message || 'Restore failed');
    } finally {
      setRestoreLoading(false);
    }
  };

  const toggleRestoreCollection = (id: string) => {
    if (restoreCollections.includes(id)) {
      setRestoreCollections(restoreCollections.filter(c => c !== id));
    } else {
      setRestoreCollections([...restoreCollections, id]);
    }
  };

  const categories = ['all', 'Pillars', 'Settings', 'Finance', 'Content', 'Quality'];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">System Backup & Restore</h2>
        <p className="text-gray-500 font-medium">Backup your site data or restore specific sections with complete precision.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Backup Selection & Operations */}
        <div className="bg-white p-8 rounded-[10px] border border-gray-100 shadow-sm space-y-6 xl:col-span-8">
          <div className="flex items-center gap-4 p-6 bg-orange-50 rounded-[10px] border border-orange-100 text-orange-800">
            <div className="h-12 w-12 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
              <Compass className="h-6 w-6" />
            </div>
            <div className="flex-grow">
              <h4 className="font-black text-lg">System Export Options</h4>
              <p className="text-sm font-medium opacity-80">Export all site variables, tours, metadata or configure partial downloads.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
            <div className="flex items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
              <button
                onClick={() => setBackupMode('full')}
                className={cn(
                  "px-4 py-2.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all",
                  backupMode === 'full' 
                    ? "bg-white text-gray-900 shadow-sm border border-gray-100" 
                    : "text-gray-500 hover:text-gray-900"
                )}
              >
                Full Backup
              </button>
              <button
                onClick={() => setBackupMode('selective')}
                className={cn(
                  "px-4 py-2.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all",
                  backupMode === 'selective' 
                    ? "bg-white text-primary shadow-sm border border-gray-100" 
                    : "text-gray-500 hover:text-primary"
                )}
              >
                Partial Backup
              </button>
            </div>

            {backupMode === 'selective' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllCollections}
                  className="text-[10px] font-black uppercase text-gray-500 hover:text-gray-900 tracking-widest bg-gray-50 px-3 py-2 rounded-lg border border-gray-100"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearAllCollections}
                  className="text-[10px] font-black uppercase text-gray-400 hover:text-red-500 tracking-widest bg-gray-50 px-3 py-2 rounded-lg border border-gray-100"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>

          {backupMode === 'selective' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-grow">
                  <Search className="absolute left-4 top-3.5 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search database collections..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 placeholder-gray-400 font-medium text-sm rounded-xl border-2 border-gray-100 focus:border-primary focus:outline-none transition-all"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveTab(cat)}
                      className={cn(
                        "whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold transition-all capitalize border",
                        activeTab === cat 
                          ? "bg-primary/5 text-primary border-primary/20" 
                          : "bg-white text-gray-500 border-gray-100 hover:bg-gray-50"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {filteredCollections.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-100 text-gray-400 font-bold text-sm">
                  No collections match your criteria.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-1">
                  {filteredCollections.map(col => {
                    const IconComp = col.icon;
                    const isSelected = selectedCollections.includes(col.id);
                    return (
                      <div
                        key={col.id}
                        onClick={() => toggleCollection(col.id)}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all cursor-pointer flex gap-3.5 items-start group relative",
                          isSelected 
                            ? "bg-orange-50/40 border-primary shadow-sm" 
                            : "bg-white border-gray-100 hover:border-gray-200"
                        )}
                      >
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border",
                          isSelected 
                            ? "bg-primary text-white border-primary" 
                            : "bg-gray-50 text-gray-400 border-gray-100 group-hover:bg-gray-100 group-hover:text-gray-600"
                        )}>
                          <IconComp className="h-5 w-5" />
                        </div>
                        <div className="flex-grow min-w-0 pr-6">
                          <span className="font-extrabold text-gray-900 tracking-tight text-sm block">{col.name}</span>
                          <span className="text-[10px] font-mono text-gray-400 tracking-tight block mt-0.5">{col.id}</span>
                          <p className="text-xs text-gray-400 font-medium leading-relaxed mt-1.5 line-clamp-2">{col.desc}</p>
                        </div>
                        <div className="absolute top-4 right-4 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all shrink-0">
                          {isSelected && <Check className="h-3 w-3 text-primary stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="p-3.5 bg-orange-50 rounded-xl border border-orange-100 flex items-center gap-3">
                <ShieldCheck className="h-4.5 w-4.5 text-primary stroke-[2.5] shrink-0" />
                <span className="text-xs text-gray-600 font-bold">
                  {selectedCollections.length} of {COLLECTION_METADATA.length} collections selected for backup. ({COLLECTION_METADATA.length - selectedCollections.length} will be omitted).
                </span>
              </div>
            </div>
          )}

            <div className="border-t border-gray-50 pt-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
              <p className="text-xs text-gray-500 font-bold max-w-md">
                {backupMode === 'full' 
                  ? "A Full Backup is highly recommended before performing system imports, running major schema adjustments, or changing system pricing guides." 
                  : `Exporting a partial backup with ${selectedCollections.length} target collections.`}
              </p>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => handleBackup('json')}
                  disabled={isLoading || restoreLoading}
                  className="bg-primary text-white px-6 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-orange-700 transition-all shadow-xl shadow-orange-50 disabled:opacity-50 flex items-center justify-center gap-3 flex-grow sm:flex-grow-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Working...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4" /> Export JSON
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleBackup('csv')}
                  disabled={isLoading || restoreLoading}
                  className="bg-blue-600 text-white px-6 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-50 disabled:opacity-50 flex items-center justify-center gap-3 flex-grow sm:flex-grow-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Working...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4" /> Export Bookings CSV
                    </>
                  )}
                </button>
              </div>
            </div>
        </div>

        {/* Restore Column */}
        <div className="space-y-8 xl:col-span-4">
          {/* Main Restore Upload View */}
          <div className="bg-white p-8 rounded-[10px] border border-gray-100 shadow-sm space-y-6 flex flex-col">
            <div className="flex items-center gap-4 p-6 bg-amber-50 rounded-[10px] border border-amber-100 text-amber-800">
              <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-black text-lg">Selective Restore</h4>
                <p className="text-sm font-medium opacity-80">Upload a JSON backup file to browse and import select data blocks.</p>
              </div>
            </div>

            <p className="text-sm text-gray-500 font-medium">
              Upload a previously exported JSON backup file. You can preview the records inside the file and selectively choose which collections to restore into the database.
            </p>

            {/* Draggable upload box */}
            {!parsedBackup ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-4.5 text-center transition-all bg-gray-50/50 cursor-pointer hover:bg-gray-50 hover:border-amber-400 group relative min-h-[220px]",
                  isDragging ? "border-amber-500 bg-amber-50/30 ring-4 ring-amber-500/10" : "border-gray-200"
                )}
              >
                <input 
                  type="file" 
                  accept=".json" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={handleFileChange}
                  disabled={isLoading || restoreLoading}
                />
                <div className="h-14 w-14 bg-amber-100/50 text-amber-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <span className="font-extrabold text-gray-800 text-sm block">Drag & Drop backup file</span>
                  <span className="text-xs text-gray-400 font-bold mt-1 block">or <span className="text-amber-500 font-extrabold group-hover:underline">browse files</span> on your computer</span>
                </div>
                <span className="text-[10px] font-mono text-gray-300">Supported formats: .json</span>
              </div>
            ) : (
              <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="min-w-0 pr-3">
                    <span className="font-extrabold text-gray-800 text-sm block truncate">{restoreFile?.name}</span>
                    <span className="text-[10px] font-mono text-gray-400 block mt-0.5">Size: {(restoreFile?.size || 0) > 1024 * 1024 ? `${((restoreFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB` : `${((restoreFile?.size || 0) / 1024).toFixed(1)} KB`}</span>
                  </div>
                  <button
                    onClick={() => {
                      setRestoreFile(null);
                      setParsedBackup(null);
                      setError(null);
                    }}
                    className="p-1.5 hover:bg-gray-200 text-gray-400 hover:text-gray-800 transition-all rounded-lg shrink-0"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Preview Backup Contents</span>
                    <p className="text-xs text-gray-400 font-medium mt-1">Select the collections you wish to restore into the database.</p>
                  </div>

                  <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                    {Object.keys(parsedBackup.data || {}).map(colId => {
                      const colItems = parsedBackup.data[colId];
                      if (!Array.isArray(colItems) || colItems.length === 0) return null;
                      
                      const colMeta = COLLECTION_METADATA.find(c => c.id === colId);
                      const isSelected = restoreCollections.includes(colId);
                      
                      return (
                        <div
                          key={colId}
                          onClick={() => toggleRestoreCollection(colId)}
                          className={cn(
                            "p-3 rounded-lg border-2 transition-all cursor-pointer flex items-center justify-between",
                            isSelected 
                              ? "bg-amber-50/30 border-amber-500/80" 
                              : "bg-white border-gray-100 hover:border-gray-200"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "h-8 w-8 rounded-md flex items-center justify-center shrink-0 border",
                              isSelected ? "bg-amber-500 text-white border-amber-500" : "bg-gray-50 text-gray-400 border-gray-100"
                            )}>
                              {colMeta ? <colMeta.icon className="h-4.5 w-4.5" /> : <Database className="h-4.5 w-4.5" />}
                            </div>
                            <div>
                              <span className="font-extrabold text-sm text-gray-800">{colMeta?.name || colId}</span>
                              <span className="text-[10px] text-gray-400 font-mono block mt-0.5">{colItems.length} records detected</span>
                            </div>
                          </div>
                          
                          <div className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected ? "border-amber-500/80 bg-amber-500" : "border-gray-200"
                          )}>
                            {isSelected && <Check className="h-3 w-3 text-white stroke-[3.5]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-gray-400">
                      {restoreCollections.length} collections selected
                    </span>
                    <button
                      type="button"
                      onClick={executeRestore}
                      disabled={restoreLoading || restoreCollections.length === 0}
                      className="bg-amber-500 text-white px-5 py-3 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {restoreLoading ? (
                        <>
                          <Icons.Loader2 className="h-3 w-3 animate-spin" /> Restoring...
                        </>
                      ) : (
                        <>
                          <Icons.RefreshCw className="h-3 w-3" /> Commit Restore
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {(error || success) && (
        <div className={cn(
          "p-5 rounded-xl border-2 font-bold text-sm leading-relaxed shadow-sm",
          error ? "bg-red-50 border-red-200 text-red-600" : "bg-orange-50 border-orange-200 text-primary"
        )}>
          {error || success}
        </div>
      )}
    </div>
  );
};

const CommunicationManager = () => {
  const [settings, setSettings] = useState<CommunicationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{success: boolean, message: string} | null>(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<{success: boolean, message: string} | null>(null);
  const [testWhatsAppLoading, setTestWhatsAppLoading] = useState(false);
  const [testWhatsAppStatus, setTestWhatsAppStatus] = useState<{success: boolean, message: string} | null>(null);

  // WABA Custom Tester State
  const [wabaTestPhone, setWabaTestPhone] = useState('');
  const [wabaTestMode, setWabaTestMode] = useState<'template' | 'text'>('template');
  const [wabaTestTemplateName, setWabaTestTemplateName] = useState('');
  const [wabaTestLanguage, setWabaTestLanguage] = useState('id');
  const [wabaTestBody, setWabaTestBody] = useState('This is a custom test message sent from the Bali AdvenTours admin panel playground.');

  // WhatsApp Session Management
  const [waSessionStatus, setWaSessionStatus] = useState<any>(null);
  const [waSessionLoading, setWaSessionLoading] = useState(false);
  const [waQrCode, setWaQrCode] = useState<string | null>(null);
  const [waActionMessage, setWaActionMessage] = useState<string | null>(null);

  // Email Diagnostic Logs
  const [diagnosticLogs, setDiagnosticLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchDiagnosticLogs = async () => {
    setLogsLoading(true);
    try {
      const q = query(collection(db, 'email_logs'), orderBy('createdAt', 'desc'));
      const logSnap = await getDocs(q);
      const logs = logSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDiagnosticLogs(logs.slice(0, 25)); // Use slice for safe client-side paging limit
    } catch (err) {
      console.error("Error fetching logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const MERGE_TAGS = [
    { tag: '{{customerName}}', description: 'Full name of the customer' },
    { tag: '{{tourTitle}}', description: 'Name of the tour booked' },
    { tag: '{{bookingId}}', description: 'Unique booking reference ID' },
    { tag: '{{date}}', description: 'Date of the tour' },
    { tag: '{{time}}', description: 'Time or time slot of the tour' },
    { tag: '{{guests}}', description: 'Number of guests (Adults + Children)' },
    { tag: '{{totalAmount}}', description: 'Total price of the booking' },
    { tag: '{{paymentMethod}}', description: 'The payment method used' },
    { tag: '{{pickupAddress}}', description: 'Pickup location address' },
    { tag: '{{status}}', description: 'Current status of the booking' },
    { tag: '{{paymentInstructions}}', description: 'Bank details (only for pending email)' },
    { tag: '{{supportPhone}}', description: 'Your company support phone' },
    { tag: '{{whatsappLink}}', description: 'Direct link to chat with support' },
    { tag: '{{guideName}}', description: "Assigned guide's name" },
    { tag: '{{guideWhatsapp}}', description: "Assigned guide's WhatsApp number" },
    { tag: '{{bookingDate}}', description: 'The date of the tour' },
    { tag: '{{customer_name}}', description: 'Full name of the customer' },
    { tag: '{{tour_title}}', description: 'Name of the tour booked' },
    { tag: '{{booking_date}}', description: 'The date of the tour' },
    { tag: '{{guide_name}}', description: "Assigned guide's name" },
    { tag: '{{guide_whatsapp}}', description: "Assigned guide's WhatsApp number" },
  ];

  const handleWhatsAppTemplateChange = (type: keyof CommunicationSettings['whatsappTemplates'], field: 'message' | 'enabled', value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      whatsappTemplates: {
        ...settings.whatsappTemplates,
        [type]: {
          ...settings.whatsappTemplates[type],
          [field]: value
        }
      }
    });
  };

  const handleSendTestWhatsApp = async () => {
    if (!settings) return;
    if (!settings.adminNotificationPhone) {
      setTestWhatsAppStatus({ success: false, message: 'Please set an Admin Notification Phone number first in the fields below.' });
      return;
    }
    setTestWhatsAppLoading(true);
    setTestWhatsAppStatus(null);
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const currentProvider = settings.whatsappProvider || 'openwa';
      
      const bodyData: any = {
        receiver: settings.adminNotificationPhone,
        customMessage: `*WhatsApp Test Message*\n\nThis is a diagnostic connection test notification from your Bali AdvenTours admin panel.\n\nProvider: ${currentProvider.toUpperCase()}\nTime: ${new Date().toLocaleString()}`,
        type: 'test',
        provider: currentProvider,
      };

      if (currentProvider === 'waba') {
        bodyData.wabaAccessToken = settings.wabaAccessToken;
        bodyData.wabaPhoneNumberId = settings.wabaPhoneNumberId;
        bodyData.wabaTemplateName = settings.wabaTemplateName;
        bodyData.wabaLanguageCode = settings.wabaLanguageCode || 'en';
      } else {
        bodyData.token = settings.openwaApiKey;
        bodyData.baseUrl = settings.openwaBaseUrl || 'https://openwa-dashboard-production-b24e.up.railway.app';
        bodyData.sessionId = settings.openwaSessionId;
      }

      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify(bodyData)
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setTestWhatsAppStatus({ 
          success: true, 
          message: `Test message successfully sent via ${currentProvider.toUpperCase()}! Please check your phone for the receipt.` 
        });
      } else {
        let errorMsg = data.error || 'Failed to send WhatsApp message.';
        // Clean up HTML error messages from nginx or other proxies
        if (errorMsg.includes('<html') || errorMsg.includes('<!DOCTYPE')) {
          errorMsg = 'Received an HTML error page. This usually means the API Base URL is incorrect or the endpoint does not exist (404/405).';
        }
        setTestWhatsAppStatus({ success: false, message: errorMsg });
      }
    } catch (error: any) {
      setTestWhatsAppStatus({ success: false, message: error.message || 'An unexpected error occurred.' });
    } finally {
      setTestWhatsAppLoading(false);
    }
  };

  const handleSendWabaPlayground = async () => {
    if (!settings) return;
    const phoneToUse = wabaTestPhone.trim() || settings.adminNotificationPhone;
    if (!phoneToUse) {
      setTestWhatsAppStatus({ success: false, message: 'Please specify a recipient phone number first.' });
      return;
    }
    setTestWhatsAppLoading(true);
    setTestWhatsAppStatus(null);
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      
      const bodyData: any = {
        receiver: phoneToUse,
        type: 'custom_waba_test',
        provider: 'waba',
        wabaAccessToken: settings.wabaAccessToken,
        wabaPhoneNumberId: settings.wabaPhoneNumberId,
        customMessage: wabaTestBody.trim()
      };

      if (wabaTestMode === 'template') {
        bodyData.wabaTemplateName = wabaTestTemplateName.trim() || settings.wabaTemplateName || 'booking_confirmation';
        bodyData.wabaLanguageCode = wabaTestLanguage.trim() || settings.wabaLanguageCode || 'id';
      }

      const response = await fetch('/api/send-whatsapp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify(bodyData)
      });
      
      const data = await response.json();
      if (response.ok && data.success) {
        setTestWhatsAppStatus({ 
          success: true, 
          message: `WABA test message successfully sent to ${phoneToUse}! Mode: ${wabaTestMode.toUpperCase()}.` 
        });
      } else {
        setTestWhatsAppStatus({ success: false, message: data.error || 'WABA test message failed to send.' });
      }
    } catch (error: any) {
      setTestWhatsAppStatus({ success: false, message: error.message || 'An unexpected error occurred.' });
    } finally {
      setTestWhatsAppLoading(false);
    }
  };

  const handleFetchWhatsAppQR = async () => {
    try {
      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch('/api/whatsapp-qr', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (data.success && data.data?.qrCode) {
        setWaQrCode(data.data.qrCode);
      } else if (data.error) {
        console.warn('QR code fetch failed:', data.error);
      }
    } catch (err) {
      console.error('Failed to fetch QR:', err);
    }
  };

  const handleCheckWhatsAppStatus = async () => {
    setWaSessionLoading(true);
    setWaActionMessage(null);
    try {
      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch('/api/whatsapp-status', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setWaSessionStatus(data.data);
        if (data.data?.status === 'qr_ready') {
          await handleFetchWhatsAppQR();
        } else {
          setWaQrCode(null);
        }
      } else {
        setWaActionMessage(`Error: ${data.error}`);
        setWaSessionStatus({ status: 'failed', error: data.error });
      }
    } catch (err: any) {
      setWaActionMessage(`Error: ${err.message}`);
    } finally {
      setWaSessionLoading(false);
    }
  };

  const handleStartWhatsAppSession = async () => {
    setWaSessionLoading(true);
    setWaActionMessage("Starting session, please wait...");
    setWaQrCode(null);
    try {
      const user = auth.currentUser;
      const idToken = user ? await user.getIdToken() : '';
      const res = await fetch('/api/whatsapp-start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (data.success) {
        setWaActionMessage("Session initialization requested successfully. Checking status...");
        setTimeout(() => {
          handleCheckWhatsAppStatus();
        }, 1500);
      } else {
        setWaActionMessage(`Failed to start session: ${data.error}`);
      }
    } catch (err: any) {
      setWaActionMessage(`Error: ${err.message}`);
    } finally {
      setWaSessionLoading(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!settings) return;
    setTestEmailLoading(true);
    setTestEmailStatus(null);
    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : null;
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
        },
        body: JSON.stringify({
          to: settings.adminNotificationEmail,
          subject: 'Test Email - Bali AdvenTours',
          html: `<div style="font-family: sans-serif; padding: 20px; border: 2px solid #0d9488; border-radius: 10px;">
            <h2 style="color: #0d9488;">Email Configuration Test</h2>
            <p>Success! This is a test email from your <strong>Bali AdvenTours</strong> website.</p>
            <p><strong>Provider used:</strong> ${settings.emailProvider.toUpperCase()}</p>
            <p>If you're seeing this, your transactional emails are now working correctly.</p>
            <hr />
            <small>Sent at: ${new Date().toLocaleString()}</small>
          </div>`,
          type: 'test'
        })
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { success: false, error: text || 'Server returned an invalid response (500).' };
      }

      if (response.ok && data.success) {
        if (data.skipped) {
          setTestEmailStatus({ 
            success: false, 
            message: `Email was NOT sent because the active provider is configured as 'none' or 'Disabled'. Please select your provider (e.g., Mailjet, Resend, etc.), fill in the credentials, and click 'Save settings' at the bottom of the page before sending a test.`
          });
        } else {
          setTestEmailStatus({ success: true, message: 'Test email sent successfully! Please check your inbox (' + settings.adminNotificationEmail + ').' });
        }
      } else {
        // If it's a known server error string masquerading as HTML
        const displayError = data.error?.includes('A server error occurred') 
          ? 'The Vercel Server crashed while trying to load the email handler. This usually means a missing environment variable or configuration file.'
          : (data.error || 'Failed to send test email.');
          
        setTestEmailStatus({ success: false, message: displayError });
      }
    } catch (error: any) {
      setTestEmailStatus({ success: false, message: error.message || 'An unexpected error occurred.' });
    } finally {
      setTestEmailLoading(false);
    }
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, 'communicationSettings', 'global');
      const snap = await getDoc(docRef);
      
      const defaults: CommunicationSettings = {
        id: 'settings',
        emailProvider: 'none',
        senderEmail: 'booking@gorillatvadventure.com',
        senderName: 'Gorilla ATV Adventure Bookings',
        adminNotificationEmail: import.meta.env.VITE_ADMIN_EMAIL || 'baliadventours@gmail.com',
        adminNotificationPhone: '+10000000000',
        whatsappEnabled: false,
        whatsappProvider: 'openwa',
        wabaAccessToken: '',
        wabaPhoneNumberId: '',
        wabaTemplateName: '',
        wabaLanguageCode: 'id',
        wabaVerifyToken: 'baliadventours',
        whatsappTemplates: {
          booking_confirmation: {
            message: "Halo {{customerName}}, booking anda untuk {{tourTitle}} pada tanggal {{date}} telah dikonfirmasi. Booking ID: {{bookingId}}",
            enabled: true
          },
          booking_status_updated: {
            message: "Halo {{customerName}}, status booking anda {{bookingId}} telah diperbarui menjadi: {{status}}",
            enabled: true
          },
          admin_notification: {
            message: "New Booking Alert! {{customerName}} booked {{tourTitle}} for {{date}}. Total: {{totalAmount}}",
            enabled: true
          },
          guide_assigned: {
            message: "*Guide Assigned*\n\nHello {{customer_name}}, we have assigned a guide for your tour \"{{tour_title}}\" on {{booking_date}}.\n\n*Your Guide:* {{guide_name}}\n*Guide WhatsApp:* {{guide_whatsapp}}\n\nOur guide will contact you soon for pickup details. Enjoy your trip!",
            enabled: true
          }
        },
        templates: {} as any
      };

      if (snap.exists()) {
        const data = snap.data() as any;
        // Merge templates specifically to ensure new ones are added
        setSettings({ 
          ...defaults, 
          ...data,
          whatsappTemplates: {
            ...defaults.whatsappTemplates,
            ...(data.whatsappTemplates || {})
          }
        });
      } else {
        await setDoc(docRef, defaults);
        setSettings(defaults);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchDiagnosticLogs();
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setSaveStatus(null);
    try {
      await setDoc(doc(db, 'communicationSettings', 'global'), settings);
      setSaveStatus({ success: true, message: "Settings saved successfully!" });
      setTimeout(() => setSaveStatus(null), 6000);
    } catch (err: any) {
      console.error(err);
      setSaveStatus({ success: false, message: `Error saving settings: ${err.message || err}` });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Icons.Loader2 className="animate-spin text-primary" /></div>;
  if (!settings) return null;

  return (
    <div className="space-y-12">
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight">Communication Settings</h2>
        <p className="text-gray-500 font-medium">Configure how you communicate with your guests via email.</p>
      </div>

      {/* Email Testing Tool (Fixed Position) */}
      <div className="bg-primary rounded-[10px] p-8 shadow-2xl shadow-primary/20 text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
          <Icons.Zap className="h-48 w-48 rotate-12" />
        </div>
        
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-2 max-w-xl">
             <div className="flex items-center gap-3">
                <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Diagnostic tool</span>
                <span className="h-1.5 w-1.5 bg-orange-300 rounded-full animate-pulse"></span>
             </div>
             <h3 className="text-3xl font-black tracking-tight">Email Connection Tester</h3>
             <p className="text-orange-50 text-sm font-medium">Verify your Gmail or SMTP settings instantly without making a real booking. We will send a test email to <strong>{settings.adminNotificationEmail}</strong>.</p>
          </div>
          <button 
            type="button" 
            onClick={handleSendTestEmail}
            disabled={testEmailLoading || settings.emailProvider === 'none'}
            className="bg-white text-primary px-10 py-5 rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shrink-0"
          >
            {testEmailLoading ? <Icons.Loader2 className="h-5 w-5 animate-spin" /> : <Icons.Send className="h-5 w-5" />}
            {testEmailLoading ? 'Running test...' : 'Send Test mail'}
          </button>
        </div>

        {testEmailStatus && (
           <div className={`mt-8 p-6 rounded-2xl border-2 animate-in fade-in zoom-in duration-300 ${testEmailStatus.success ? 'bg-white/10 border-white/20 text-white' : 'bg-red-500/20 border-red-500/30 text-white'}`}>
             <div className="flex items-start gap-4">
                {testEmailStatus.success ? <Icons.CheckCircle2 className="h-8 w-8 text-white shrink-0" /> : <Icons.AlertCircle className="h-8 w-8 text-white shrink-0" />}
                <div className="space-y-1">
                   <p className="text-lg font-black tracking-tight">{testEmailStatus.success ? 'System Online!' : 'Connection Refused'}</p>
                   <p className="text-sm font-medium opacity-90">{testEmailStatus.message}</p>
                   {!testEmailStatus.success && (
                      <div className="mt-4 bg-black/20 p-4 rounded-xl text-xs font-mono leading-relaxed border border-white/10">
                         <span className="font-black text-white underline mb-1 block">QUICK FIX FOR GMAIL:</span>
                         1. Ensure <a href="https://myaccount.google.com/security" target="_blank" className="underline font-bold">2-Step Verification</a> is ON.<br/>
                         2. Generate a 16-character <strong>App Password</strong>.<br/>
                         3. Use that code instead of your regular password.
                      </div>
                   )}
                </div>
             </div>
           </div>
        )}
      </div>

      {/* WhatsApp Testing Tool */}
      <div className="bg-[#075E54] rounded-[10px] p-8 shadow-2xl shadow-[#075E54]/20 text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
          <Icons.Phone className="h-48 w-48 rotate-12" />
        </div>
        
        {settings.whatsappProvider === 'waba' ? (
          <div className="relative space-y-6">
            <div className="flex items-center gap-3">
              <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">WABA Play Area</span>
              <span className="h-1.5 w-1.5 bg-orange-400 rounded-full animate-pulse"></span>
            </div>
            
            <div>
              <h3 className="text-3xl font-black tracking-tight">WABA Direct Dispatch Tester</h3>
              <p className="text-orange-50 text-sm font-medium mt-1">
                Trigger and monitor custom Meta WABA notifications directly. Perfect for testing templates or session-based messaging.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-black/15 p-6 rounded-2xl border border-white/10 mt-4 text-left">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-orange-200 tracking-wider">Recipient Phone Number</label>
                <input
                  type="text"
                  value={wabaTestPhone}
                  onChange={e => setWabaTestPhone(e.target.value)}
                  placeholder={settings.adminNotificationPhone || 'e.g. +62812345678'}
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm focus:bg-white/15 focus:outline-none focus:border-orange-400 transition-all font-mono placeholder:text-white/30 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-orange-200 tracking-wider">Message Mode</label>
                <select
                  value={wabaTestMode}
                  onChange={e => setWabaTestMode(e.target.value as 'template' | 'text')}
                  className="w-full rounded-xl bg-[#075E54] border border-white/20 px-4 py-3 text-sm focus:outline-none focus:border-orange-400 transition-all text-white font-bold cursor-pointer font-sans"
                >
                  <option value="template">Template Message (Meta Approved Template)</option>
                  <option value="text">Standard Text Message (Requires Open Session)</option>
                </select>
              </div>

              {wabaTestMode === 'template' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-orange-200 tracking-wider">Template Name</label>
                  <input
                    type="text"
                    value={wabaTestTemplateName}
                    onChange={e => setWabaTestTemplateName(e.target.value)}
                    placeholder={settings.wabaTemplateName || 'e.g. booking_confirmation'}
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm focus:bg-white/15 focus:outline-none focus:border-orange-400 transition-all font-mono placeholder:text-white/30 text-white"
                  />
                </div>
              )}

              {wabaTestMode === 'template' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-orange-200 tracking-wider">Template Language Code</label>
                  <input
                    type="text"
                    value={wabaTestLanguage}
                    onChange={e => setWabaTestLanguage(e.target.value)}
                    placeholder={settings.wabaLanguageCode || 'id'}
                    className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm focus:bg-white/15 focus:outline-none focus:border-orange-400 transition-all font-mono placeholder:text-white/30 text-white"
                  />
                </div>
              )}

              <div className="col-span-full space-y-2">
                <label className="text-[10px] font-black uppercase text-orange-200 tracking-wider">
                  {wabaTestMode === 'template' 
                    ? 'Template Parameters (Body Variable 1)' 
                    : 'Standard Message Text'}
                </label>
                <textarea
                  rows={3}
                  value={wabaTestBody}
                  onChange={e => setWabaTestBody(e.target.value)}
                  placeholder="Enter the body message or the template custom string..."
                  className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm focus:bg-white/15 focus:outline-none focus:border-orange-400 transition-all placeholder:text-white/30 text-white"
                />
                <p className="text-[10px] text-orange-200/70 font-medium">
                  {wabaTestMode === 'template' 
                    ? 'Note: Meta approved templates usually expect dynamic parameters. We will map this message to {{1}}.' 
                    : 'Note: Meta requires that standard text messages be sent only when there is an active customer-initiated chat window open within 24 hours.'}
                </p>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={handleSendWabaPlayground}
                disabled={testWhatsAppLoading || !settings.whatsappEnabled}
                className="bg-white text-[#075E54] px-10 py-4 rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 cursor-pointer"
              >
                {testWhatsAppLoading ? <Icons.Loader2 className="h-5 w-5 animate-spin" /> : <Icons.MessageSquare className="h-5 w-5" />}
                {testWhatsAppLoading ? 'Dispatched...' : 'Trigger WABA Dispatch'}
              </button>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-2 max-w-xl">
               <div className="flex items-center gap-3">
                  <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">WhatsApp diagnostic</span>
                  <span className="h-1.5 w-1.5 bg-orange-400 rounded-full animate-pulse"></span>
               </div>
               <h3 className="text-3xl font-black tracking-tight">WhatsApp Connection Tester</h3>
               <p className="text-orange-50 text-sm font-medium">Verify your OpenWA configuration instantly. We will send a test message to <strong>{settings.adminNotificationPhone || 'No number set'}</strong>.</p>
            </div>
            <button 
              type="button" 
              onClick={handleSendTestWhatsApp}
              disabled={testWhatsAppLoading || !settings.whatsappEnabled}
              className="bg-white text-[#075E54] px-10 py-5 rounded-2xl font-black text-sm tracking-widest uppercase shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 shrink-0"
            >
              {testWhatsAppLoading ? <Icons.Loader2 className="h-5 w-5 animate-spin" /> : <Icons.MessageSquare className="h-5 w-5" />}
              {testWhatsAppLoading ? 'Sending...' : 'Send Test WhatsApp'}
            </button>
          </div>
        )}

        {testWhatsAppStatus && (
           <div className={`mt-8 p-6 rounded-2xl border-2 animate-in fade-in zoom-in duration-300 ${testWhatsAppStatus.success ? 'bg-white/10 border-white/20 text-white' : 'bg-red-500/20 border-red-500/30 text-white'}`}>
             <div className="flex items-start gap-4 text-left">
                {testWhatsAppStatus.success ? <Icons.CheckCircle2 className="h-8 w-8 text-white shrink-0" /> : <Icons.AlertCircle className="h-8 w-8 text-white shrink-0" />}
                <div className="space-y-1">
                   <p className="text-lg font-black tracking-tight">{testWhatsAppStatus.success ? 'WhatsApp Online!' : 'Send Failed'}</p>
                   <p className="text-sm font-medium opacity-90">{testWhatsAppStatus.message}</p>
                   {!testWhatsAppStatus.success && settings.whatsappProvider !== 'waba' && (
                      <div className="mt-4 bg-black/20 p-4 rounded-xl text-xs font-mono leading-relaxed border border-white/10 opacity-90 text-left">
                         <span className="font-black text-white underline mb-1 block">QUICK FIX:</span>
                         1. Ensure <strong>OpenWA Base URL</strong> and <strong>Session Name</strong> ({settings.openwaSessionId || 'baliadventours'}) are correct.<br/>
                         2. Verify your <strong>OpenWA API Key</strong>.<br/>
                         3. <strong>SESSION NOT RUNNING:</strong> Use the live controls below to start the WhatsApp session and generate your authentication QR code.
                      </div>
                   )}
                   {!testWhatsAppStatus.success && settings.whatsappProvider === 'waba' && (
                      <div className="mt-4 bg-black/20 p-4 rounded-xl text-xs font-mono leading-relaxed border border-white/10 opacity-90 text-left">
                         <span className="font-black text-white underline mb-1 block">QUICK FIX FOR WABA:</span>
                         1. Ensure <strong>WABA Access Token</strong> and <strong>Phone Number ID</strong> are correct in communication settings.<br/>
                         2. Double check if your recipient phone number is fully formatted with country code (e.g., 628123456789).<br/>
                         3. If sending in Template Mode, confirm the template name and language code exist and are approved in Meta WhatsApp Manager.<br/>
                         4. In Non-Template Mode, ensure the recipient has initiated contact within the last 24 hours.
                      </div>
                   )}
                </div>
             </div>
           </div>
        )}

        {/* Real-time Session Connector */}
        {settings.whatsappProvider !== 'waba' && (
          <div className="mt-8 pt-8 border-t border-white/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 text-left">
                <h4 className="text-lg font-bold flex items-center gap-2">
                  <Icons.Settings className="h-5 w-5" />
                  Live Session Control
                </h4>
                <p className="text-xs text-orange-100">
                  Manage the active WhatsApp connection state on your gateway dynamically.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCheckWhatsAppStatus}
                  disabled={waSessionLoading}
                  className="bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/25 text-white px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {waSessionLoading ? <Icons.Loader2 className="h-4 w-4 animate-spin" /> : <Icons.RefreshCw className="h-4 w-4" />}
                  Check Connection Status
                </button>
                <button
                  type="button"
                  onClick={handleStartWhatsAppSession}
                  disabled={waSessionLoading}
                  className="bg-orange-500 hover:bg-primary border border-orange-400 text-white px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <Icons.Play className="h-4 w-4 fill-current" />
                  Initialize/Start Session
                </button>
              </div>
            </div>

            {waActionMessage && (
              <div className="mt-4 text-xs font-mono bg-black/30 p-3 rounded-lg text-orange-300 text-left">
                {waActionMessage}
              </div>
            )}

            {waSessionStatus && (
              <div className="mt-6 bg-white/10 border border-white/15 p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 text-left">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-250">Session ID</span>
                  <p className="font-mono text-sm font-bold">{waSessionStatus.name || settings.openwaSessionId || 'baliadventours'}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-250">Connection State</span>
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      waSessionStatus.status === 'ready' ? 'bg-orange-400 animate-pulse' :
                      waSessionStatus.status === 'qr_ready' ? 'bg-yellow-400 animate-pulse' :
                      waSessionStatus.status === 'initializing' || waSessionStatus.status === 'authenticating' ? 'bg-indigo-400 animate-pulse' : 'bg-red-450'
                    }`}></span>
                    <p className="font-bold uppercase tracking-wider text-sm">{waSessionStatus.status || 'UNKNOWN'}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase text-emerald-250">Linked Phone</span>
                  <p className="text-sm font-bold">{waSessionStatus.phone ? `+${waSessionStatus.phone}` : 'Not linked'}</p>
                </div>
              </div>
            )}

            {waQrCode && (
              <div className="mt-6 flex flex-col items-center bg-white text-gray-900 p-6 rounded-2xl max-w-sm mx-auto shadow-xl border border-white/20 animate-in zoom-in duration-300">
                <span className="text-xs font-black text-[#075E54] uppercase tracking-widest mb-3">Scan this QR Code via WhatsApp</span>
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <img src={waQrCode} alt="WhatsApp QR Code" className="w-[200px] h-[200px]" referrerPolicy="no-referrer" />
                </div>
                <p className="text-[10px] text-gray-500 text-center font-medium mt-3 leading-relaxed">
                  Open WhatsApp on your phone, navigate to Linked Devices, and scan the QR code to authenticate the <strong>{settings.openwaSessionId || 'baliadventours'}</strong> session.
                </p>
                <button
                  type="button"
                  onClick={handleCheckWhatsAppStatus}
                  className="mt-4 w-full bg-[#075E54] hover:bg-[#128C7E] text-white py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                >
                  I Scanned It! Verify Connection
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-12">
        {saveStatus && (
          <div className={`p-5 rounded-xl border-2 ${saveStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'} flex items-start gap-4 font-bold text-sm animate-in fade-in duration-200`}>
            {saveStatus.success ? <Icons.CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" /> : <Icons.AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />}
            <div className="space-y-1">
              <p className="font-black">{saveStatus.success ? 'Success!' : 'Error Saving Settings'}</p>
              <p className="font-medium text-xs opacity-90">{saveStatus.message}</p>
            </div>
          </div>
        )}
        <section className="bg-white p-8 rounded-[10px] border border-gray-100 shadow-sm space-y-8">
            <div className="flex items-center justify-between mb-2">
               <div className="flex items-center gap-4">
                 <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <Icons.Sparkles className="h-5 w-5" />
                 </div>
                 <h3 className="text-xl font-bold text-gray-900">AI Intelligence (Google Gemini)</h3>
               </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
               <div className="space-y-4">
                 <div className="space-y-2">
                   <div className="flex justify-between items-center">
                     <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Gemini API Key</label>
                     <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">Securely Stored</span>
                   </div>
                   <input 
                     type="password"
                     value={settings.geminiApiKey || ''}
                     onChange={e => setSettings({ ...settings, geminiApiKey: e.target.value })}
                     placeholder="Enter your Google AI Studio API Key"
                     className="w-full rounded-[10px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-indigo-500 focus:bg-white focus:outline-none transition-all font-mono"
                   />
                   <p className="text-[10px] text-gray-400 font-medium">This key powers the AI Tour Builder. You can get a free key from Google AI Studio.</p>
                 </div>
               </div>
               
               <div className="bg-indigo-50/30 p-6 rounded-xl border border-indigo-100">
                 <div className="flex gap-4">
                   <Icons.Lightbulb className="h-6 w-6 text-indigo-600 shrink-0" />
                   <div className="space-y-2">
                      <h4 className="font-bold text-gray-900 text-sm">How it works</h4>
                      <p className="text-xs text-gray-600 font-medium leading-relaxed">
                         The API key is used to communicate with Gemini 1.5 Flash. 
                         It's stored in your secure database and used whenever you click "AI Magic Builder".
                      </p>
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 mt-2 hover:underline"
                      >
                        Get Key Here <Icons.Globe className="h-3 w-3" />
                      </a>
                   </div>
                 </div>
               </div>
            </div>
         </section>
        <section className="bg-white p-8 rounded-[10px] border border-gray-100 shadow-sm space-y-8">
           <div className="flex items-center gap-4 mb-2">
              <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center text-primary">
                 <Icons.Mail className="h-5 w-5" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Email Provider</h3>
           </div>
           
           <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="space-y-2">
                 <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Select Provider</label>
                 <select 
                   value={settings.emailProvider}
                   onChange={e => setSettings({ ...settings, emailProvider: e.target.value as any })}
                   className="w-full rounded-[10px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold appearance-none bg-white"
                 >
                   <option value="none">Disabled (No Emails)</option>
                   <option value="resend">Resend (Recommended)</option>
                   <option value="sendgrid">SendGrid</option>
                    <option value="brevo">Brevo (Sendinblue)</option>
                    <option value="gmail">Gmail SMTP (Direct Method)</option>
                     <option value="enginemailer">Enginemailer</option>
                     <option value="mailjet">Mailjet</option>
                 </select>
              </div>

              {settings.emailProvider === 'gmail' && (
                <>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Gmail Address</label>
                    <input 
                      type="email"
                      value={settings.gmailUser || ''}
                      onChange={e => setSettings({ ...settings, gmailUser: e.target.value })}
                      placeholder="baliadventours@gmail.com"
                      className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold"
                    />
                  </div>
                  <div className="space-y-2 lg:col-span-1">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Google App Password</label>
                    <input 
                      type="password"
                      value={settings.gmailAppPassword || ''}
                      onChange={e => setSettings({ ...settings, gmailAppPassword: e.target.value })}
                      placeholder="xxxx xxxx xxxx xxxx"
                      className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                    />
                  </div>
                  <div className="md:col-span-2 lg:col-span-3 bg-secondary/5 p-6 rounded-xl border border-secondary/20">
                    <div className="flex gap-4">
                      <Icons.Info className="h-6 w-6 text-secondary shrink-0" />
                      <div className="space-y-2">
                         <h4 className="font-bold text-gray-900 text-sm underline">How to get a Google App Password?</h4>
                         <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4 font-medium leading-relaxed">
                            <li>Turn on <strong>2-Step Verification</strong> in your Google Account settings.</li>
                            <li>Search for "App Passwords" in your account search bar.</li>
                            <li>Select "Mail" and "Other (Custom name)" and type "Bali Website".</li>
                            <li>Copy the 16-character code and paste it here.</li>
                         </ul>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {settings.emailProvider !== 'none' && settings.emailProvider !== 'gmail' && settings.emailProvider !== 'mailjet' && (
                <div className="space-y-2 lg:col-span-2">
                   <div className="flex justify-between items-center">
                     <label className="text-xs font-black text-gray-400 uppercase tracking-widest">API Key</label>
                     <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">Env Vars Supported</span>
                   </div>
                   <input 
                     type="password"
                     value={settings.emailApiKey || ''}
                     onChange={e => setSettings({ ...settings, emailApiKey: e.target.value })}
                     placeholder={
                       settings.emailProvider === "enginemailer"
                         ? "Enter your Enginemailer API key or use ENGINEMAILER_API_KEY env var"
                         : `Enter your ${settings.emailProvider} API key or use BREVO_API_KEY env var`
                     }
                     className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                   />
                   <p className="text-[10px] text-gray-400 font-medium">Use the "Settings" menu to add your API key securely as an environment variable.</p>
                </div>
              )}

              {settings.emailProvider === 'mailjet' && (
                <>
                  <div className="space-y-2">
                     <div className="flex justify-between items-center">
                       <label className="text-xs font-black text-gray-400 uppercase tracking-widest font-mono">Mailjet API Key (Public)</label>
                       <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">Or use Env Vars</span>
                     </div>
                     <input 
                       type="text"
                       value={settings.emailApiKey?.includes(':') ? settings.emailApiKey.split(':')[0] : (settings.emailApiKey || '')}
                       onChange={e => {
                         const currentSecret = settings.emailApiKey?.includes(':') ? settings.emailApiKey.split(':')[1] : '';
                         setSettings({ ...settings, emailApiKey: `${e.target.value.trim()}:${currentSecret}` });
                       }}
                       placeholder="Enter Mailjet Public API Key"
                       className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                     />
                  </div>
                  <div className="space-y-2">
                     <label className="text-xs font-black text-gray-400 uppercase tracking-widest font-mono">Mailjet API Secret (Private)</label>
                     <input 
                       type="password"
                       value={settings.emailApiKey?.includes(':') ? settings.emailApiKey.split(':')[1] : ''}
                       onChange={e => {
                         const currentKey = settings.emailApiKey?.includes(':') ? settings.emailApiKey.split(':')[0] : (settings.emailApiKey || '');
                         setSettings({ ...settings, emailApiKey: `${currentKey}:${e.target.value.trim()}` });
                       }}
                       placeholder="Enter Mailjet Private Secret Key"
                       className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                     />
                  </div>
                </>
              )}

              <div className="space-y-2">
                 <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Sender Email</label>
                 <input 
                   required
                   type="email"
                   value={settings.senderEmail}
                   onChange={e => setSettings({ ...settings, senderEmail: e.target.value })}
                   className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold"
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Sender Name</label>
                 <input 
                   required
                   value={settings.senderName}
                   onChange={e => setSettings({ ...settings, senderName: e.target.value })}
                   className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold"
                 />
              </div>

              <div className="space-y-2">
                 <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Admin Notification Email</label>
                 <input 
                   required
                   type="email"
                   value={settings.adminNotificationEmail}
                   onChange={e => setSettings({ ...settings, adminNotificationEmail: e.target.value })}
                   className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold"
                 />
              </div>
           </div>
        </section>

        <section className="bg-white p-8 rounded-[10px] border border-gray-100 shadow-sm space-y-8">
           <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-orange-50 rounded-lg flex items-center justify-center text-[#075E54]">
                   <Icons.Phone className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">WhatsApp Automation</h3>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settings.whatsappEnabled} 
                    onChange={e => setSettings({ ...settings, whatsappEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-checked:bg-primary rounded-full relative transition-all after:content-[''] after:absolute after:h-5 after:w-5 after:bg-white after:rounded-full after:top-0.5 after:left-0.5 peer-checked:after:left-5.5 after:transition-all"></div>
                  <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Master Switch</span>
                </label>
              </div>
           </div>

           <div className="grid md:grid-cols-2 gap-8">
               <div className="space-y-4">
                 <div className="space-y-2">
                   <label className="text-xs font-black text-gray-400 uppercase tracking-widest">WhatsApp Gateway Provider</label>
                   <select 
                     value={settings.whatsappProvider || 'openwa'}
                     onChange={e => setSettings({ ...settings, whatsappProvider: e.target.value as 'openwa' | 'waba' })}
                     className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold cursor-pointer"
                   >
                     <option value="openwa">OpenWA (Self-hosted / REST Gateway)</option>
                     <option value="waba">WABA (WhatsApp Business Platform / Cloud API)</option>
                   </select>
                   <p className="text-[10px] text-gray-400 font-medium">Choose between your own self-hosted OpenWA instance or official Meta Cloud API.</p>
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Admin Notification Phone</label>
                   <input 
                     type="text"
                     value={settings.adminNotificationPhone || ''}
                     onChange={e => setSettings({ ...settings, adminNotificationPhone: e.target.value })}
                     placeholder="+628xxx"
                     className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-bold"
                   />
                   <p className="text-[10px] text-gray-400 font-medium">Phone number that will receive new booking alerts.</p>
                 </div>

                 {(settings.whatsappProvider === 'waba') ? (
                   <>
                     <div className="space-y-2">
                       <label className="text-xs font-black text-gray-400 uppercase tracking-widest">WABA Access Token</label>
                       <input 
                         type="password"
                         value={settings.wabaAccessToken || ''}
                         onChange={e => setSettings({ ...settings, wabaAccessToken: e.target.value })}
                         placeholder="Meta System User token"
                         className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                       />
                       <p className="text-[10px] text-gray-400 font-medium">System User token with whatsapp_business_messaging permissions.</p>
                     </div>

                     <div className="space-y-2">
                       <label className="text-xs font-black text-gray-400 uppercase tracking-widest">WABA Phone Number ID</label>
                       <input 
                         type="text"
                         value={settings.wabaPhoneNumberId || ''}
                         onChange={e => setSettings({ ...settings, wabaPhoneNumberId: e.target.value })}
                         placeholder="e.g. 104847294829"
                         className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                       />
                       <p className="text-[10px] text-gray-400 font-medium">The Phone Number ID displayed in your Facebook App Developer console.</p>
                     </div>

                     <div className="space-y-2">
                       <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Default Template Name (Optional)</label>
                       <input 
                         type="text"
                         value={settings.wabaTemplateName || ''}
                         onChange={e => setSettings({ ...settings, wabaTemplateName: e.target.value })}
                         placeholder="e.g. booking_confirmation"
                         className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                       />
                       <p className="text-[10px] text-gray-400 font-medium">If empty, standard text messages are used. If specified, WABA template message is triggered.</p>
                     </div>

                     <div className="space-y-2">
                       <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Template Language Code</label>
                       <input 
                         type="text"
                         value={settings.wabaLanguageCode || 'id'}
                         onChange={e => setSettings({ ...settings, wabaLanguageCode: e.target.value })}
                         placeholder="e.g. id, en"
                          className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">WABA Webhook Verify Token</label>
                        <input 
                          type="text"
                          value={settings.wabaVerifyToken || 'baliadventours'}
                          onChange={e => setSettings({ ...settings, wabaVerifyToken: e.target.value })}
                          placeholder="e.g. baliadventours"
                          className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                        />
                        <p className="text-[10px] text-gray-400 font-medium">Configure this string as the Verification Token in your Meta Developer App Webhook settings.</p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Template Language Code</label>
                        <input 
                          type="text"
                          value={settings.wabaLanguageCode || 'id'}
                          onChange={e => setSettings({ ...settings, wabaLanguageCode: e.target.value })}
                          placeholder="e.g. id, en"
                         className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                       />
                     </div>
                   </>
                 ) : (
                   <>
                     <div className="space-y-2">
                       <label className="text-xs font-black text-gray-400 uppercase tracking-widest">OpenWA API Key</label>
                       <input 
                         type="password"
                         value={settings.openwaApiKey || ''}
                         onChange={e => setSettings({ ...settings, openwaApiKey: e.target.value })}
                         placeholder="Enter your OpenWA API key"
                         className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                       />
                       <p className="text-[10px] text-gray-400 font-medium">Get this from your OpenWA Dashboard.</p>
                     </div>

                     <div className="space-y-2">
                       <label className="text-xs font-black text-gray-400 uppercase tracking-widest">OpenWA Session Name</label>
                       <input 
                         type="text"
                         value={settings.openwaSessionId || ''}
                         onChange={e => setSettings({ ...settings, openwaSessionId: e.target.value })}
                         placeholder="e.g. baliadventours"
                         className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                       />
                       <p className="text-[10px] text-gray-400 font-medium">Required for multi-session dashboards. Tip: If the name doesn't work, try using just the number (e.g. 62812...).</p>
                     </div>

                     <div className="space-y-2">
                       <label className="text-xs font-black text-gray-400 uppercase tracking-widest">OpenWA Base URL</label>
                       <input 
                         type="text"
                         value={settings.openwaBaseUrl || ''}
                         onChange={e => setSettings({ ...settings, openwaBaseUrl: e.target.value })}
                         placeholder="https://your-openwa-instance.railway.app"
                         className="w-full rounded-[12px] border-2 border-gray-50 bg-gray-50/50 p-4 focus:border-primary focus:bg-white focus:outline-none transition-all font-mono"
                       />
                       <p className="text-[10px] text-gray-400 font-medium">The URL of your OpenWA instance.</p>
                     </div>
                   </>
                 )}
               </div>
               
               {settings.whatsappProvider === 'waba' ? (
                 <div className="bg-[#E7F3FF] p-6 rounded-xl border border-blue-100 flex flex-col justify-between">
                   <div className="flex gap-4">
                     <Icons.ShieldCheck className="h-6 w-6 text-blue-600 shrink-0" />
                     <div className="space-y-2">
                        <h4 className="font-bold text-gray-900 text-sm">WABA Cloud API Active</h4>
                        <p className="text-xs text-gray-600 font-medium leading-relaxed">
                           System uses <strong>WhatsApp Business Platform (Cloud API)</strong> from Meta to deliver transaction notifications.
                        </p>
                        <div className="mt-4 p-4 bg-white/50 rounded-lg border border-blue-100/20">
                           <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest mb-1">Configuration Guide</p>
                           <ul className="text-[9px] text-gray-500 list-disc pl-4 space-y-1">
                             <li>Create a Meta Developer app and set up <strong>WhatsApp</strong> product.</li>
                             <li className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100/50 my-2 space-y-1">
                               <p className="font-bold text-blue-800 text-[10px] uppercase">Webhook Configuration (Copy these to Meta App):</p>
                               <div className="space-y-1 text-left">
                                 <div>
                                   <span className="font-semibold text-gray-700 block">Callback URL:</span>
                                   <div className="flex items-center gap-1.5 mt-0.5">
                                     <code className="bg-white px-2 py-1 rounded border text-[10px] font-mono select-all flex-1 break-all text-blue-900 font-bold">
                                       {typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook'}
                                     </code>
                                     <button
                                       type="button"
                                       onClick={() => {
                                         const url = typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : '/api/whatsapp/webhook';
                                         navigator.clipboard.writeText(url);
                                         alert('Callback URL copied to clipboard!');
                                       }}
                                       className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                     >
                                       Copy
                                     </button>
                                   </div>
                                 </div>
                                 <div className="pt-1">
                                   <span className="font-semibold text-gray-700 block">Verify Token:</span>
                                   <div className="flex items-center gap-1.5 mt-0.5">
                                     <code className="bg-white px-2 py-1 rounded border text-[10px] font-mono select-all flex-1 text-blue-900 font-bold">
                                       {settings.wabaVerifyToken || 'baliadventours'}
                                     </code>
                                     <button
                                       type="button"
                                       onClick={() => {
                                         navigator.clipboard.writeText(settings.wabaVerifyToken || 'baliadventours');
                                         alert('Verify Token copied to clipboard!');
                                       }}
                                       className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                     >
                                       Copy
                                     </button>
                                   </div>
                                 </div>
                               </div>
                             </li>
                             <li>Obtain a Permanent <strong>System User Access Token</strong> with <code>whatsapp_business_messaging</code> permission.</li>
                             <li>Configure your WABA <strong>Phone Number ID</strong> (found in Meta Developer Portal).</li>
                             <li>
                               <strong>Pro Tip:</strong> Create a template on Meta Manager with a single body parameter <code>{"{{1}}"}</code>. The system will automatically inject the full booking details into it for 100% dynamic notifications!
                             </li>
                           </ul>
                        </div>
                     </div>
                   </div>
                 </div>
               ) : (
                 <div className="bg-orange-50 p-6 rounded-xl border border-orange-100 flex flex-col justify-between">
                   <div className="flex gap-4">
                     <Icons.ShieldCheck className="h-6 w-6 text-primary shrink-0" />
                     <div className="space-y-2">
                        <h4 className="font-bold text-gray-900 text-sm">OpenWA API Connected</h4>
                        <p className="text-xs text-gray-600 font-medium leading-relaxed">
                           System uses your custom <strong>OpenWA</strong> server to send notifications. Ideal for advanced self-hosted instance configurations.
                        </p>
                        <div className="mt-4 p-4 bg-white/50 rounded-lg border border-orange-100/20">
                           <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Configuration Needed</p>
                           <ul className="text-[9px] text-gray-500 list-disc pl-4 space-y-1">
                             <li>Get your <strong>API Key</strong> from your <a href="https://openwa-dashboard-production-b24e.up.railway.app/message-tester" target="_blank" className="underline font-bold">OpenWA Dashboard</a>.</li>
                             <li>Configure the Session ID and verify your server is scanning and active.</li>
                             <li>Ensure the <strong>Base URL</strong> matches your hosted OpenWA instance.</li>
                           </ul>
                        </div>
                     </div>
                   </div>
                 </div>
               )}
            </div>

           <div className="space-y-6 pt-4">
              <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">Automation Templates</h4>
              
              <div className="grid grid-cols-1 gap-4">
                {settings.whatsappTemplates && Object.keys(settings.whatsappTemplates).map((key) => {
                   const template = settings.whatsappTemplates[key as keyof typeof settings.whatsappTemplates];
                   return (
                     <div key={key} className="bg-gray-50/50 rounded-xl p-6 border border-gray-100 space-y-4">
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{key.replace(/_/g, ' ')}</span>
                           <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox" 
                                checked={template?.enabled}
                                onChange={e => {
                                   const next = { ...settings };
                                   next.whatsappTemplates[key as keyof typeof settings.whatsappTemplates].enabled = e.target.checked;
                                   setSettings(next);
                                }}
                                className="sr-only peer"
                              />
                              <div className="w-8 h-4 bg-gray-200 peer-checked:bg-[#0668E1] rounded-full relative transition-all after:content-[''] after:absolute after:h-3 after:w-3 after:bg-white after:rounded-full after:top-0.5 after:left-0.5 peer-checked:after:left-4 after:transition-all"></div>
                           </label>
                        </div>
                        <textarea 
                           rows={3}
                           value={template?.message}
                           onChange={e => {
                              const next = { ...settings };
                              next.whatsappTemplates[key as keyof typeof settings.whatsappTemplates].message = e.target.value;
                              setSettings(next);
                           }}
                           className="w-full bg-white rounded-xl border-2 border-gray-100 p-4 text-sm font-medium focus:border-[#0668E1] transition-all focus:outline-none" 
                        />
                     </div>
                   )
                })}
              </div>
           </div>
        </section>

        <section className="bg-white p-10 rounded-[10px] border border-gray-100 shadow-sm overflow-hidden relative">
           <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
              <Icons.FileCode className="h-40 w-40" />
           </div>
           
           <div className="relative space-y-8">
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                   <Icons.FileCode className="h-8 w-8" />
                </div>
                <div>
                   <h3 className="text-2xl font-black text-gray-900 tracking-tight">Email Content Engine</h3>
                   <p className="text-sm font-medium text-gray-500">Email templates are now strictly managed via source code for maximum reliability.</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-10">
                 <div className="space-y-6">
                    <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
                       <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                          <Icons.Search className="h-4 w-4 text-primary" />
                          Where to edit content?
                       </h4>
                       <p className="text-xs text-gray-600 leading-relaxed font-semibold">
                          To update the subject line or body of any automated email, you must modify the following file in your project directory:
                       </p>
                       <code className="block p-4 bg-gray-900 text-orange-400 font-mono text-xs rounded-xl border border-gray-700 shadow-lg">
                          /src/services/emailTemplates.ts
                       </code>
                       <div className="flex items-center gap-2 text-[10px] text-amber-600 font-black uppercase bg-amber-50 p-3 rounded-lg border border-amber-100">
                          <Icons.AlertCircle className="h-4 w-4" />
                          Database Overrides are now Disabled
                       </div>
                    </div>
                    
                    <div className="p-6 bg-orange-50 rounded-2xl border border-orange-100 space-y-3">
                       <h4 className="text-sm font-black text-orange-900 uppercase tracking-widest">Available Merge Tags</h4>
                       <div className="grid grid-cols-2 gap-2">
                          {MERGE_TAGS.slice(0, 8).map(tag => (
                             <div key={tag.tag} className="bg-white/60 p-2 rounded-lg text-[10px] font-bold text-gray-700 border border-orange-200">
                                {tag.tag}
                             </div>
                          ))}
                          <div className="bg-primary text-white p-2 rounded-lg text-[10px] font-black text-center uppercase">
                             + Many More
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <div className="bg-gray-900 rounded-3xl p-8 text-white relative overflow-hidden group shadow-2xl">
                       <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 bg-primary/20 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000"></div>
                       <div className="relative space-y-6">
                          <div className="flex items-center gap-4">
                             <div className="h-10 w-10 bg-primary rounded-xl flex items-center justify-center shadow-lg">
                                <Icons.Terminal className="h-5 w-5 text-white" />
                             </div>
                             <p className="text-sm font-black uppercase tracking-widest">Developer Mode Active</p>
                          </div>
                          <p className="text-sm text-gray-300 font-medium leading-relaxed">
                            "By moving templates to the code, your emails are now version-controlled and faster to load. No more sync issues between database and code."
                          </p>
                          <div className="pt-4 flex items-center gap-3">
                             <div className="h-1 w-12 bg-primary rounded-full"></div>
                             <span className="text-[10px] font-black tracking-widest uppercase text-gray-400">Bali AdvenTours System</span>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
        </section>

        <div className="flex justify-end pt-8 border-t border-gray-100">
           <button 
             type="submit" 
             disabled={isSaving}
             className="bg-primary text-white px-12 py-4 rounded-xl font-black text-sm tracking-widest uppercase shadow-xl hover:bg-orange-700 transition-all flex items-center gap-2"
           >
             {isSaving ? <Icons.Loader2 className="animate-spin h-5 w-5" /> : <Icons.Save className="h-5 w-5" />}
             Save Communication Settings
           </button>
        </div>
      </form>

      {/* NEW: Real-time Email Trace & Diagnostic Console */}
      <div className="bg-white p-8 rounded-[10px] border border-gray-100 shadow-sm space-y-6 mt-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-gray-50 rounded-lg flex items-center justify-center text-gray-700">
              <Icons.Terminal className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Email Trace & Log Analyzer</h3>
              <p className="text-xs text-gray-500 font-medium">Investigate real-time email triggers, supplier alerts, and trace failure points instantly.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchDiagnosticLogs}
            disabled={logsLoading}
            className="bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl font-bold text-xs tracking-wider uppercase transition-all flex items-center gap-2 border border-gray-100 disabled:opacity-55"
          >
            {logsLoading ? <Icons.Loader2 className="h-4 w-4 animate-spin text-gray-500" /> : <Icons.RefreshCw className="h-4 w-4" />}
            Refresh Trace Logs
          </button>
        </div>

        {logsLoading && diagnosticLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-3">
            <Icons.Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs font-bold uppercase tracking-wider">Fetching live channel records...</p>
          </div>
        ) : diagnosticLogs.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500 border border-dashed border-gray-200">
            <Icons.MailCheck className="h-10 w-10 mx-auto text-gray-300 mb-3" />
            <p className="text-sm font-bold">No dispatch histories logged yet.</p>
            <p className="text-xs text-gray-450 mt-1">Try triggering a "Send Test mail" above to populate the local tracker.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden border border-gray-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-400 uppercase tracking-widest text-[9px] font-black border-b border-gray-100">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Trigger / Email Type</th>
                    <th className="p-4">Recipient (To)</th>
                    <th className="p-4">Mailer Provider</th>
                    <th className="p-4">Delivery Status</th>
                    <th className="p-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {diagnosticLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const dateDisplay = log.createdAt?.seconds 
                      ? new Date(log.createdAt.seconds * 1000).toLocaleString() 
                      : (log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Just now');

                    return (
                      <>
                        <tr 
                          key={log.id} 
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="hover:bg-gray-50/50 cursor-pointer transition-colors duration-150"
                        >
                          <td className="p-4 font-mono text-gray-500">{dateDisplay}</td>
                          <td className="p-4 font-bold text-gray-900">
                            <span className="font-mono bg-gray-105 px-2 py-0.5 rounded text-gray-700 font-medium">
                              {log.type}
                            </span>
                          </td>
                          <td className="p-4 text-gray-600 font-medium break-all max-w-[200px]">{log.to}</td>
                          <td className="p-4 font-mono text-gray-500 uppercase">{log.provider || 'N/A'}</td>
                          <td className="p-4">
                            {log.status === 'success' && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-orange-700 border border-orange-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                                Delivered
                              </span>
                            )}
                            {log.status === 'skipped' && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500"></span>
                                Skipped
                              </span>
                            )}
                            {log.status === 'failed' && (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-750 border border-rose-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                                Def refused
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              type="button"
                              className="text-primary hover:text-emerald-750 font-black uppercase tracking-wider text-[10px] hover:underline"
                            >
                              {isExpanded ? 'Collapse' : 'Analyze'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/70">
                            <td colSpan={6} className="p-6 border-b border-gray-100">
                              <div className="bg-gray-950 text-gray-200 p-6 rounded-2xl font-mono text-xs space-y-4 shadow-inner max-w-full overflow-x-auto relative leading-relaxed">
                                <span className="absolute top-4 right-4 text-[10px] font-bold text-gray-550 border border-gray-800 px-2 py-0.5 rounded">
                                  ID: {log.id}
                                </span>
                                <div>
                                  <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest">SUBJECT LINE</p>
                                  <p className="text-white font-bold">{log.subject || 'N/A'}</p>
                                </div>
                                {log.bookingId && (
                                  <div>
                                    <p className="text-gray-500 text-[10px] uppercase font-black tracking-widest">BOOKING REFERENCE</p>
                                    <p className="text-orange-400 font-bold">#{log.bookingId.toUpperCase()}</p>
                                  </div>
                                )}
                                {log.reason && (
                                  <div>
                                    <p className="text-gray-550 text-[10px] uppercase font-black tracking-widest">DECISION REASON</p>
                                    <p className={`${log.status === 'failed' ? 'text-rose-400' : 'text-amber-400'} font-bold`}>
                                      {log.reason}
                                    </p>
                                  </div>
                                )}
                                {log.errorDetails && (
                                  <div>
                                    <p className="text-rose-405 text-[10px] uppercase font-black tracking-widest mb-1.5">STACK TRACE / DETAILS</p>
                                    <pre className="bg-black/40 p-4 border border-rose-950/20 rounded-xl text-rose-300 font-mono text-[11px] leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto">
                                      {log.errorDetails}
                                    </pre>
                                  </div>
                                )}
                                <div className="pt-2 flex items-center gap-1.5 text-gray-500 text-[10px]">
                                  <Icons.Info className="h-3.5 w-3.5 text-gray-500" />
                                  Email processed at container server node and logged atomically to Firebase.
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 font-medium">
              Showing the latest 25 delivery trace attempts. Expand any trace log to review complete payload details and connection stack traces.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const PartnerListing = ({ 
  type, 
  users, 
  onSelect,
  onDelete,
  onViewTours,
  allTours = [],
  resetForm,
  setFormData,
  formData,
  setActiveMenu
}: { 
  type: 'supplier' | 'agent', 
  users: UserProfile[], 
  onSelect: (user: UserProfile) => void,
  onDelete: (user: UserProfile) => void,
  onViewTours?: (user: UserProfile) => void,
  allTours?: Tour[],
  resetForm: () => void,
  setFormData: (f: any) => void,
  formData: any,
  setActiveMenu: (m: any) => void
}) => {
  const filteredUsers = users.filter(u => u.role === type);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">
          {type === 'supplier' ? 'Official Suppliers' : 'Travel Agents'}
        </h2>
        <p className="text-gray-500 font-medium">
          {type === 'supplier' ? 'Manage your product providers and their tour inventory.' : 'Manage affiliated agents and their booking performance.'}
        </p>
      </div>

      <div className="bg-white rounded-[10px] border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Name / Company</th>
              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Contact Info</th>
              {type === 'supplier' && (
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Tours</th>
              )}
              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">
                {type === 'supplier' ? 'Commission Rate' : 'Agent Discount'}
              </th>
              <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filteredUsers.map(u => (
              <tr key={u.uid} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img src={u.photoURL} className="h-10 w-10 rounded-full border border-gray-100" referrerPolicy="no-referrer" />
                    <div>
                      <p className="text-sm font-black text-gray-900">{u.displayName}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{u.companyName || 'Individual'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-xs font-bold text-gray-600">{u.email}</p>
                  <p className="text-[10px] text-gray-400 font-medium">{u.phoneNumber || 'No Phone'}</p>
                </td>
                {type === 'supplier' && (
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {allTours.filter(t => t.supplierId === u.uid).map(t => (
                        <button
                          key={t.id}
                          onClick={() => window.open(`/tours/${t.slug}`, '_blank')}
                          className="bg-gray-100 text-[9px] font-black uppercase text-gray-500 px-2 py-1 rounded-md hover:bg-primary/10 hover:text-primary transition-all whitespace-nowrap"
                          title={t.title}
                        >
                          {t.title}
                        </button>
                      ))}
                      {allTours.filter(t => t.supplierId === u.uid).length === 0 && (
                        <div className="flex flex-col items-center justify-center p-2 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tight">No Tours Assigned</span>
                          <button 
                            onClick={() => {
                              resetForm();
                              setFormData({ ...formData, supplierId: u.uid, supplierName: u.companyName || u.displayName });
                              setActiveMenu('tours');
                            }}
                            className="text-[9px] font-bold text-primary hover:underline mt-1"
                          >
                            + Create First Tour
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                )}
                <td className="px-6 py-4">
                  <span className="text-sm font-black text-primary">
                    {type === 'supplier' ? `${u.commissionRate || 10}%` : `${u.discountRate || 0}%`}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => onSelect(u)}
                      className="bg-primary/10 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                      View Details
                    </button>
                    {type === 'supplier' && onViewTours && (
                      <button 
                        onClick={() => onViewTours(u)}
                        className="bg-orange-50 text-primary hover:bg-primary hover:text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Tours
                      </button>
                    )}
                    <button 
                      onClick={() => onDelete(u)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      title="Delete Partner"
                    >
                      <Icons.Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">
                  No {type}s found in the system.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default function Admin() {
  const navigate = useNavigate();
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  // Client-side image WebP conversion tracker UI notifications
  const [optToast, setOptToast] = useState<{
    originalName: string;
    originalSizeKb: number;
    optimizedSizeKb: number;
    percentSaved: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const handleOptimized = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setOptToast(customEvent.detail);
        // Auto-dismiss after 7 seconds
        setTimeout(() => {
          setOptToast(prev => {
            if (prev?.originalName === customEvent.detail.originalName) {
              return null;
            }
            return prev;
          });
        }, 7000);
      }
    };

    window.addEventListener('image-optimized', handleOptimized);
    return () => {
      window.removeEventListener('image-optimized', handleOptimized);
    };
  }, []);
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Failed to log out. Please try again.');
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.role === 'admin') {
      alert("For security reasons, admin accounts cannot be deleted directly from the dashboard.");
      return;
    }

    const confirmation = window.confirm(
      `Are you sure you want to delete ${user.displayName || user.email}?\n\n` +
      `This will permanently remove their profile, settings, and partner associations. This action cannot be undone.`
    );

    if (!confirmation) return;

    try {
      await deleteDoc(doc(db, 'users', user.uid));
      alert("User profile deleted successfully.");
    } catch (error) {
      console.error("Error deleting user", error);
      alert("Failed to delete user profile. They may have active associations.");
    }
  };

  const [tours, setTours] = useState<Tour[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tourTypes, setTourTypes] = useState<TourType[]>([]);
  const [locations, setLocations] = useState<LocationMeta[]>([]);
  const [labels, setLabels] = useState<TourLabel[]>([]);
  const [globalAddOns, setGlobalAddOns] = useState<AddOn[]>([]);
  const [globalTransports, setGlobalTransports] = useState<TransportOption[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  // Reusable Platform-wide Media Gallery Picker state
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [gallerySelected, setGallerySelected] = useState<string[]>([]);
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [galleryCallback, setGalleryCallback] = useState<((urls: string[]) => void) | null>(null);
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryFilterTab, setGalleryFilterTab] = useState('all');

  const openMediaGallery = async (callback: (urls: string[]) => void, multiSelect = false) => {
    setGalleryCallback(() => callback);
    setIsMultiSelect(multiSelect);
    setGallerySelected([]);
    setGallerySearch('');
    setGalleryFilterTab('all');
    setIsGalleryOpen(true);
    setLoadingGallery(true);
    
    try {
      const urlsSet = new Set<string>();
      
      // 1. Scan in-memory Tours
      tours.forEach(t => {
        if (t.featuredImage) urlsSet.add(t.featuredImage);
        if (t.gallery) t.gallery.forEach(url => { if (url) urlsSet.add(url); });
        if (t.itinerary) {
          t.itinerary.forEach(day => {
            if (day.image) urlsSet.add(day.image);
            if (typeof day.pickup === 'object' && day.pickup?.image) {
              urlsSet.add(day.pickup.image);
            }
          });
        }
        if (t.seo?.ogImage) urlsSet.add(t.seo.ogImage);
      });

      // 2. Scan Tour Editor form state (current edit session)
      if (formData?.featuredImage) urlsSet.add(formData.featuredImage);
      if (formData?.gallery) formData.gallery.forEach(url => { if (url) urlsSet.add(url); });
      if (formData?.itinerary) {
        formData.itinerary.forEach(day => {
          if (day.image) urlsSet.add(day.image);
          if (typeof day.pickup === 'object' && day.pickup?.image) {
            urlsSet.add(day.pickup.image);
          }
        });
      }
      if (formData?.seo?.ogImage) urlsSet.add(formData.seo.ogImage);

      // 3. Scan posts from Firestore
      const postsSnap = await getDocs(collection(db, 'posts'));
      postsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.featuredImage) urlsSet.add(data.featuredImage);
        if (data.gallery) {
          (data.gallery as string[]).forEach(url => { if (url) urlsSet.add(url); });
        }
        if (data.seo?.ogImage) urlsSet.add(data.seo.ogImage);
      });

      const cleanUrls = Array.from(urlsSet).filter(url => 
        url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'))
      );
      setGalleryUrls(cleanUrls);
    } catch (err) {
      console.error("Error building media gallery list:", err);
    } finally {
      setLoadingGallery(false);
    }
  };

  const filteredGalleryUrls = useMemo(() => {
    let result = galleryUrls;
    
    // 1. Tab filtering
    if (galleryFilterTab === 'unsplash') {
      result = result.filter(url => url.toLowerCase().includes('unsplash') || url.toLowerCase().includes('picsum'));
    } else if (galleryFilterTab === 'imgbb') {
      result = result.filter(url => url.toLowerCase().includes('ibb.co'));
    } else if (galleryFilterTab === 'other') {
      result = result.filter(url => !url.toLowerCase().includes('unsplash') && !url.toLowerCase().includes('picsum') && !url.toLowerCase().includes('ibb.co'));
    }

    // 2. Keyword Search filtering
    if (gallerySearch.trim()) {
      const q = gallerySearch.toLowerCase();
      result = result.filter(url => url.toLowerCase().includes(q));
    }

    return result;
  }, [galleryUrls, galleryFilterTab, gallerySearch]);

  const handleToggleSelectImage = (url: string) => {
    if (isMultiSelect) {
      if (gallerySelected.includes(url)) {
        setGallerySelected(prev => prev.filter(u => u !== url));
      } else {
        setGallerySelected(prev => [...prev, url]);
      }
    } else {
      setGallerySelected([url]);
    }
  };

  const handleConfirmPickImages = () => {
    if (galleryCallback && gallerySelected.length > 0) {
      galleryCallback(gallerySelected);
    }
    setIsGalleryOpen(false);
  };

  const CompanyProfile = ({ userData, isAdminEdit = false }: { userData: UserProfile, isAdminEdit?: boolean }) => {
    const [profile, setProfile] = useState<UserProfile>(userData);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      setProfile(userData);
    }, [userData]);

    const handleSave = async (e: React.FormEvent) => {
      e.preventDefault();
      setSaving(true);
      try {
        await updateDoc(doc(db, 'users', profile.uid), {
          companyName: profile.companyName || '',
          publicEmail: profile.publicEmail || '',
          phoneNumber: profile.phoneNumber || '',
          website: profile.website || '',
          instagramUrl: profile.instagramUrl || '',
          facebookUrl: profile.facebookUrl || '',
          twitterUrl: profile.twitterUrl || '',
          tiktokUrl: profile.tiktokUrl || '',
          updatedAt: serverTimestamp()
        });
        alert("Success: Profile updated!");
        if (isAdminEdit && !profile.uid.includes(currentUserProfile?.uid || '')) {
           // If admin is editing a partner, we might want to refresh the selectedPartner
           setSelectedPartner({...profile});
        }
      } catch (err) {
        console.error(err);
        alert("Error: Failed to update profile.");
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Edit Profile Information</h2>
          <p className="text-gray-500 font-medium tracking-tight">Public brand details and direct contact channels.</p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          <div className="bg-white rounded-[10px] border border-gray-100 shadow-sm p-8 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Display Name</label>
                <div className="px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold text-gray-500 border border-transparent">
                  {profile.displayName}
                </div>
                <p className="text-[10px] text-gray-400 px-1 mt-1">Primary name is managed by system</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email Address</label>
                <div className="px-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold text-gray-500 border border-transparent">
                  {profile.email}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Company / Brand Name</label>
                <input
                  type="text"
                  value={profile.companyName || ''}
                  onChange={e => setProfile({...profile, companyName: e.target.value})}
                  className="w-full bg-gray-50 border-gray-100 hover:border-gray-200 rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all focus:outline-none"
                  placeholder="Official Brand Name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Public / Support Email</label>
                <input
                  type="email"
                  value={profile.publicEmail || ''}
                  onChange={e => setProfile({...profile, publicEmail: e.target.value})}
                  className="w-full bg-gray-50 border-gray-100 hover:border-gray-200 rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all focus:outline-none"
                  placeholder="contact@yourcompany.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">WhatsApp / Contact Phone</label>
                <input
                  type="text"
                  value={profile.phoneNumber || ''}
                  onChange={e => setProfile({...profile, phoneNumber: e.target.value})}
                  className="w-full bg-gray-50 border-gray-100 hover:border-gray-200 rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all focus:outline-none"
                  placeholder="+62 8..."
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Official Website</label>
                <input
                  type="url"
                  value={profile.website || ''}
                  onChange={e => setProfile({...profile, website: e.target.value})}
                  className="w-full bg-gray-50 border-gray-100 hover:border-gray-200 rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all focus:outline-none"
                  placeholder="https://www.yourwebsite.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Instagram</label>
                <input
                  type="text"
                  value={profile.instagramUrl || ''}
                  onChange={e => setProfile({...profile, instagramUrl: e.target.value})}
                  className="w-full bg-gray-50 border-gray-100 hover:border-gray-200 rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all focus:outline-none"
                  placeholder="@handle"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Facebook</label>
                <input
                  type="url"
                  value={profile.facebookUrl || ''}
                  onChange={e => setProfile({...profile, facebookUrl: e.target.value})}
                  className="w-full bg-gray-50 border-gray-100 hover:border-gray-200 rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all focus:outline-none"
                  placeholder="URL"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">TikTok</label>
                <input
                  type="text"
                  value={profile.tiktokUrl || ''}
                  onChange={e => setProfile({...profile, tiktokUrl: e.target.value})}
                  className="w-full bg-gray-50 border-gray-100 hover:border-gray-200 rounded-2xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all focus:outline-none"
                  placeholder="@handle"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="px-12 py-4 bg-gray-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all active:scale-95 disabled:opacity-50"
            >
              {saving ? "Saving Changes..." : "Update Profile"}
            </button>
          </div>
        </form>
      </div>
    );
  };
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  // Auto-complete bookings logic: Mark confirmed bookings as completed 1 day after the tour date
  useEffect(() => {
    if (!bookings.length || !currentUserProfile) return;

    // Only Admin can perform bulk auto-completes to avoid client-side update storms
    // But suppliers should also see their bookings auto-complete for their own view
    const now = new Date();
    
    // Find segments that are ready to be marked as completed
    const readyToComplete = bookings.filter(b => {
      if (b.status !== 'confirmed') return false;
      try {
        const tourDate = parseISO(b.date);
        const completionDate = addDays(tourDate, 1);
        return isBefore(completionDate, now);
      } catch (e) {
        return false;
      }
    });

    if (readyToComplete.length > 0) {
      readyToComplete.forEach(async (b) => {
        try {
          await updateDoc(doc(db, 'bookings', b.id), {
            status: 'completed',
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          // Ignore errors if they happen due to permission issues or concurrent updates
        }
      });
    }
  }, [bookings, currentUserProfile]);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [urgencyPoints, setUrgencyPoints] = useState<UrgencyPoint[]>([]);
  
  const [activeMenu, setActiveMenu] = useState<MenuId>('dashboard');
  const [expandedMenu, setExpandedMenu] = useState<string | null>('tours');
  const [tourSupplierFilter, setTourSupplierFilter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('basic');
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  // --- PROGRESSIVE WEB APP & NOTIFICATION STATES ---
  const [inAppNotifications, setInAppNotifications] = useState<{
    id: number;
    title: string;
    body: string;
    url: string;
    read: boolean;
    createdAt: Date;
  }[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(
    'Notification' in window ? Notification.permission === 'granted' : false
  );
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  const isInitialBookingsLoaded = useRef(false);
  const isInitialInquiriesLoaded = useRef(false);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA installment selection: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      console.warn("Notifications are not supported in this browser.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermissionGranted(permission === 'granted');
      if (permission === 'granted') {
        triggerPWSNotification(
          "Alerts Enabled!",
          "Excellent! You will now receive high-priority desktop & mobile notifications for booking inquiries."
        );
      }
    } catch (err) {
      console.error("Error setting notification permission:", err);
    }
  };

  const triggerPWSNotification = (title: string, body: string, url: string = '/admin') => {
    // 1. Play alert chime
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-600.wav');
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("Audio chime autoplay postponed until click gesture:", err);
        });
      }
    } catch (err) {
      console.warn("Audio chime autoplay postponed until click gesture:", err);
    }

    // 2. Dispatch a system notification
    if ('Notification' in window && Notification.permission === 'granted') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          reg.showNotification(title, {
            body,
            icon: 'https://i.ibb.co.com/20xQH0xN/android-chrome-512x512.png',
            badge: 'https://i.ibb.co.com/20xQH0xN/android-chrome-512x512.png',
            vibrate: [200, 100, 200],
            data: { url }
          } as any);
        }).catch(() => {
          new Notification(title, { body });
        });
      } else {
        new Notification(title, { body });
      }
    }

    // 3. Keep in-app feed updated
    setInAppNotifications(prev => [
      { id: Date.now(), title, body, url, read: false, createdAt: new Date() },
      ...prev
    ]);
  };

  const [isUploading, setIsUploading] = useState(false);
  const [isAiBuilding, setIsAiBuilding] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [selectedCopySourceTourId, setSelectedCopySourceTourId] = useState('');
  const [copyPackages, setCopyPackages] = useState(true);
  const [copyInclusions, setCopyInclusions] = useState(true);
  const [copyFaqs, setCopyFaqs] = useState(true);
  const [copyImportantInfo, setCopyImportantInfo] = useState(true);
  const [copyHighlights, setCopyHighlights] = useState(false);
  const [copyItinerary, setCopyItinerary] = useState(false);
  const [aiGenMode, setAiGenMode] = useState<'complete' | 'partial'>('complete');
  const [commSettings, setCommSettings] = useState<CommunicationSettings | null>(null);
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<UserProfile | null>(null);
  
  // Shared Booking State for Detail Modal
  const [globalSelectedBooking, setGlobalSelectedBooking] = useState<Booking | null>(null);
  const [originalBooking, setOriginalBooking] = useState<Booking | null>(null);
  const [isBookingDetailOpen, setIsBookingDetailOpen] = useState(false);
  const [isEditingTrip, setIsEditingTrip] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [assignBooking, setAssignBooking] = useState<Booking | null>(null);
  const [allGuides, setAllGuides] = useState<Guide[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loadingStates, setLoadingStates] = useState({
    updatingBooking: false,
    deletingBooking: false,
    addingNote: false,
    assigningGuide: false,
    statusUpdating: false,
    sendingWA: false,
  });

  const [formData, setFormData] = useState<Partial<Tour>>({
    title: '',
    slug: '',
    description: '',
    categoryId: '',
    tourTypeId: '',
    locationId: '',
    location: '',
    duration: '',
    regularPrice: 0,
    discountPrice: 0,
    gallery: [],
    featuredImage: '',
    highlights: [],
    inclusions: [],
    exclusions: [],
    itinerary: [],
    infoSections: [],
    languages: [],
    packages: [],
    addOnIds: [],
    transportIds: [],
    meetingPoint: '',
    labelIds: [],
    imageLabelId: '',
    belowTitleLabelId: '',
    priceLabelId: '',
    faqs: [],
    locationMapUrl: '',
    importantInfo: '',
    supplierId: '',
    supplierName: '',
    status: 'draft'
  });

  const [highlightsText, setHighlightsText] = useState('');
  const [inclusionsText, setInclusionsText] = useState('');
  const [exclusionsText, setExclusionsText] = useState('');
  const [languagesText, setLanguagesText] = useState('');
  
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiBuilding(true);
    try {
      const data = await generateTourData(aiPrompt, commSettings?.geminiApiKey);
      if (aiGenMode === 'complete') {
        setFormData(prev => ({
          ...prev,
          title: data.title,
          description: data.description,
          duration: data.duration,
          highlights: data.highlights,
          inclusions: data.inclusions,
          exclusions: data.exclusions,
          itinerary: data.itinerary.map(item => ({
            day: item.day,
            title: item.title,
            description: item.description
          })),
          importantInfo: data.importantInfo || ''
        }));
      } else {
        // partial update: only replace tour description, highlights, inclusions, exclusions
        setFormData(prev => ({
          ...prev,
          description: data.description,
          highlights: data.highlights,
          inclusions: data.inclusions,
          exclusions: data.exclusions,
          importantInfo: data.importantInfo || prev.importantInfo || ''
        }));
      }
      setHighlightsText(data.highlights.join('\n'));
      setInclusionsText(data.inclusions.join('\n'));
      setExclusionsText(data.exclusions.join('\n'));
      setShowAiModal(false);
      setAiPrompt('');
      alert("Success! Tour content generated by AI. Please review and save.");
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      alert(error.message || "Failed to generate tour content. Please try again.");
    } finally {
      setIsAiBuilding(false);
    }
  };

  const handleFastCopyContent = () => {
    if (!selectedCopySourceTourId) {
      alert("Please select a source tour first.");
      return;
    }
    const sourceTour = tours.find(t => t.id === selectedCopySourceTourId);
    if (!sourceTour) {
      alert("Selected source tour not found.");
      return;
    }

    setFormData(prev => {
      const updated = { ...prev };
      
      if (copyPackages && sourceTour.packages) {
        updated.packages = sourceTour.packages.map(pkg => ({
          ...pkg,
          name: pkg.name || ""
        }));
      }
      
      if (copyInclusions) {
        updated.inclusions = [...(sourceTour.inclusions || [])];
        updated.exclusions = [...(sourceTour.exclusions || [])];
        setInclusionsText((sourceTour.inclusions || []).join('\n'));
        setExclusionsText((sourceTour.exclusions || []).join('\n'));
      }
      
      if (copyFaqs) {
        updated.faqs = sourceTour.faqs ? sourceTour.faqs.map(faq => ({ ...faq })) : [];
      }
      
      if (copyImportantInfo) {
        updated.importantInfo = sourceTour.importantInfo || '';
      }
      
      if (copyHighlights && sourceTour.highlights) {
        updated.highlights = [...(sourceTour.highlights || [])];
        setHighlightsText((sourceTour.highlights || []).join('\n'));
      }
      
      if (copyItinerary && sourceTour.itinerary) {
        updated.itinerary = sourceTour.itinerary ? sourceTour.itinerary.map(item => ({ ...item })) : [];
      }
      
      return updated;
    });

    setShowCopyModal(false);
    alert(`Successfully copied selected elements from "${sourceTour.title}"! Remember to save or publish the tour.`);
  };

  const [expandedPackages, setExpandedPackages] = useState<number[]>([]);
  const [expandedItinerary, setExpandedItinerary] = useState<number[]>([]);

  useEffect(() => {
    if (!editingId && formData.title) {
        const generatedSlug = formData.title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove non-alphanumeric except space and dash
            .replace(/\s+/g, '-') // Replace spaces with dashes
            .replace(/-+/g, '-') // Remove consecutive dashes
            .trim();
        setFormData(prev => ({ ...prev, slug: generatedSlug }));
    }
  }, [formData.title, editingId]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setIsAuthorized(false);
        navigate('/login');
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        
        let userData = snap.data() as UserProfile | undefined;
        let userRole = userData?.role;

        // Auto-upgrade master admin
        const adminEmailRaw = (import.meta.env.VITE_ADMIN_EMAIL || 'baliadventours@gmail.com').trim().toLowerCase();
        if (user.email && user.email.trim().toLowerCase() === adminEmailRaw && userRole !== 'admin') {
          const profileData = {
            email: user.email,
            role: 'admin' as const,
            updatedAt: serverTimestamp()
          };
          await setDoc(userRef, profileData, { merge: true });
          userRole = 'admin';
          userData = { uid: user.uid, ...profileData } as UserProfile;
        } else if (userData) {
          userData.uid = user.uid;
        }

        if (userRole === 'admin' || userRole === 'supplier' || userRole === 'agent') {
          setCurrentUserProfile(userData || null);
          setIsAuthorized(true);
        } else {
          console.warn("Unauthorized access attempt to dashboard", user.email);
          setIsAuthorized(false);
          alert("Unauthorized access. Dashboard privileges required.");
          navigate('/');
        }
      } catch (err) {
        console.error("Error verifying admin status:", err);
        setIsAuthorized(false);
        navigate('/');
      }
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (isAuthorized !== true || !currentUserProfile) return;
    
    const isSupplier = currentUserProfile.role === 'supplier';
    const isAgent = currentUserProfile.role === 'agent';

    // Tours Query
    let toursQuery;
    if (isSupplier) {
      toursQuery = query(collection(db, 'tours'), where('supplierId', '==', currentUserProfile.uid), orderBy('createdAt', 'desc'));
    } else if (isAgent) {
      toursQuery = query(collection(db, 'tours'), where('status', 'in', ['published', 'active']), orderBy('createdAt', 'desc'));
    } else {
      toursQuery = query(collection(db, 'tours'), orderBy('createdAt', 'desc'));
    }
    
    let unsubToursFallback: (() => void) | null = null;
    let unsubBookingsFallback: (() => void) | null = null;
    let unsubGuidesFallback: (() => void) | null = null;

    const unsubscribe = onSnapshot(toursQuery, (snapshot) => {
      setTours(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Tour)));
    }, (error) => {
      console.warn("Tours snapshot error:", error);
      if (error.code === 'permission-denied') {
        handleFirestoreError(error, OperationType.LIST, 'tours');
      }
      // Fallback to simpler query if composite index is missing
      if (isSupplier) {
        if (unsubToursFallback) unsubToursFallback();
        unsubToursFallback = onSnapshot(query(collection(db, 'tours'), where('supplierId', '==', currentUserProfile.uid)), (snap) => {
          setTours(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tour)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'tours-fallback'));
      } else if (isAgent) {
        if (unsubToursFallback) unsubToursFallback();
        unsubToursFallback = onSnapshot(query(collection(db, 'tours'), where('status', 'in', ['published', 'active'])), (snap) => {
          setTours(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tour)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'tours-fallback'));
      }
    });

    // Bookings Query
    let bookingsQuery;
    if (isSupplier) {
      bookingsQuery = query(collection(db, 'bookings'), where('supplierId', '==', currentUserProfile.uid), orderBy('date', 'asc'));
    } else if (isAgent) {
      bookingsQuery = query(collection(db, 'bookings'), where('userId', '==', currentUserProfile.uid), orderBy('date', 'asc'));
    } else {
      bookingsQuery = query(collection(db, 'bookings'), orderBy('date', 'asc'));
    }

    const unsubscribeBookings = onSnapshot(bookingsQuery, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Booking));
      setBookings(data);

      if (isInitialBookingsLoaded.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const booking = change.doc.data() as Booking;
            const tourTitle = booking.tourTitle || "Selected Tour Activity";
            const customerName = booking.customerData?.fullName || "A Customer";
            triggerPWSNotification(
              "New Booking Received!",
              `${customerName} just booked "${tourTitle}". Click to view details.`,
              '/admin'
            );
          }
        });
      } else {
        isInitialBookingsLoaded.current = true;
      }
    }, (error) => {
       console.warn("Bookings snapshot error:", error);
       if (error.code === 'permission-denied') {
         handleFirestoreError(error, OperationType.LIST, 'bookings');
       }
       if (isSupplier) {
         if (unsubBookingsFallback) unsubBookingsFallback();
         unsubBookingsFallback = onSnapshot(query(collection(db, 'bookings'), where('supplierId', '==', currentUserProfile.uid)), (snap) => {
            setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
         }, (err) => handleFirestoreError(err, OperationType.LIST, 'bookings-fallback'));
       } else if (isAgent) {
         if (unsubBookingsFallback) unsubBookingsFallback();
         unsubBookingsFallback = onSnapshot(query(collection(db, 'bookings'), where('userId', '==', currentUserProfile.uid)), (snap) => {
            setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() } as Booking)));
         }, (err) => handleFirestoreError(err, OperationType.LIST, 'bookings-fallback'));
       }
    });

    const unsubscribeCategories = onSnapshot(collection(db, 'categories'), (snapshot) => {
      setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'categories'));

    const unsubscribeInquiries = onSnapshot(query(collection(db, 'inquiries'), orderBy('createdAt', 'desc')), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Inquiry));
      setInquiries(data);

      if (isInitialInquiriesLoaded.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const inquiry = change.doc.data() as Inquiry;
            const tourTitle = inquiry.planTitle || inquiry.summary || "Selected Tour Package";
            const customerName = inquiry.userName || "Interested traveler";
            triggerPWSNotification(
              "💬 New Trip Inquiry!",
              `${customerName} registered interest for "${tourTitle}". Click to open inquiries.`,
              '/admin'
            );
          }
        });
      } else {
        isInitialInquiriesLoaded.current = true;
      }
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'inquiries'));

    const unsubscribeTypes = onSnapshot(collection(db, 'tourTypes'), (snapshot) => {
      setTourTypes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TourType)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tourTypes'));

    let unsubscribeUsers = () => {};
    if (!isSupplier && !isAgent) {
      unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
          setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    }

    const unsubscribeLocations = onSnapshot(collection(db, 'locationMeta'), (snapshot) => {
      setLocations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as LocationMeta)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'locationMeta'));

    const unsubscribeAddOns = onSnapshot(collection(db, 'globalAddOns'), (snapshot) => {
      setGlobalAddOns(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as AddOn)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'globalAddOns'));

    const unsubscribeTransports = onSnapshot(collection(db, 'globalTransports'), (snapshot) => {
      setGlobalTransports(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TransportOption)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'globalTransports'));

    const unsubscribeCoupons = onSnapshot(collection(db, 'coupons'), (snapshot) => {
      setCoupons(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Coupon)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'coupons'));

    const unsubscribeUrgency = onSnapshot(collection(db, 'urgencyPoints'), (snapshot) => {
      setUrgencyPoints(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UrgencyPoint)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'urgencyPoints'));

    // Filter guides based on supplierId if the user is a supplier
    let guidesQuery;
    if (isSupplier) {
      guidesQuery = query(collection(db, 'guides'), where('supplierId', '==', currentUserProfile.uid), orderBy('name', 'asc'));
    } else {
      guidesQuery = query(collection(db, 'guides'), orderBy('name', 'asc'));
    }
    
    const unsubscribeGuides = onSnapshot(
      guidesQuery, 
      (snapshot) => {
        setAllGuides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guide)));
      },
      (error) => {
        console.warn("Guides global snapshot error:", error);
        handleFirestoreError(error, OperationType.LIST, 'guides');
        // Fallback for missing indices
        if (isSupplier) {
          if (unsubGuidesFallback) unsubGuidesFallback();
          unsubGuidesFallback = onSnapshot(query(collection(db, 'guides'), where('supplierId', '==', currentUserProfile.uid)), (snap) => {
             setAllGuides(snap.docs.map(d => ({ id: d.id, ...d.data() } as Guide)));
          });
        }
      }
    );

    const unsubscribeLabels = onSnapshot(collection(db, 'tourLabels'), (snapshot) => {
      setLabels(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TourLabel)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tourLabels'));

    const unsubscribeComm = onSnapshot(doc(db, 'communicationSettings', 'global'), (snap) => {
      if (snap.exists()) {
        setCommSettings(snap.data() as CommunicationSettings);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'communicationSettings/global'));

    const unsubscribeSiteSettings = onSnapshot(doc(db, 'settings', 'general'), (snap) => {
      if (snap.exists()) {
        setSiteSettings(snap.data() as SiteSettings);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'settings/general'));

    return () => {
      unsubscribe();
      if (unsubToursFallback) unsubToursFallback();
      if (unsubBookingsFallback) unsubBookingsFallback();
      if (unsubGuidesFallback) unsubGuidesFallback();
      unsubscribeCategories();
      unsubscribeTypes();
      unsubscribeLocations();
      unsubscribeAddOns();
      unsubscribeTransports();
      unsubscribeCoupons();
      unsubscribeUrgency();
      unsubscribeBookings();
      unsubscribeGuides();
      unsubscribeLabels();
      unsubscribeComm();
      unsubscribeSiteSettings();
      unsubscribeUsers();
    };
  }, [isAuthorized]);

  // Auto-recalculate Price for Admin Manual Updates
  useEffect(() => {
    if (!isEditingTrip || !globalSelectedBooking || tours.length === 0) return;

    const tour = tours.find(t => t.id === globalSelectedBooking.tourId);
    if (!tour) return;

    const pkg = tour.packages.find(p => p.name === globalSelectedBooking.packageName);
    if (!pkg || !pkg.tiers || pkg.tiers.length === 0) return;

    const adults = globalSelectedBooking.participants.adults;
    const children = globalSelectedBooking.participants.children;

    // Pricing Logic
    const adultTier = pkg.tiers.find(
      (t) => adults >= t.minParticipants && adults <= t.maxParticipants,
    ) || (adults < (pkg.tiers[0]?.minParticipants || 0) ? pkg.tiers[0] : pkg.tiers[pkg.tiers.length - 1]);
    
    const childTier = children > 0 
      ? (pkg.tiers.find((t) => children >= t.minParticipants && children <= t.maxParticipants) || 
         (children < (pkg.tiers[0]?.minParticipants || 0) ? pkg.tiers[0] : pkg.tiers[pkg.tiers.length - 1]))
      : adultTier;

    const adultRate = adultTier?.adultPrice || 0;
    const childRate = childTier?.childPrice || 0;
    
    const packageTotal = (adultRate * adults) + (childRate * children);
    
    // Add-ons total
    const addonsTotal = (globalSelectedBooking.selectedAddOns || []).reduce(
      (sum, addon) => sum + (addon.price * addon.quantity), 
      0
    );

    const newTotal = packageTotal + addonsTotal;

    // Only update if the price has actually changed and it's not a manual override 
    // We check against the current value to avoid infinite loops
    if (newTotal !== globalSelectedBooking.totalAmount) {
      setGlobalSelectedBooking(prev => {
        if (!prev) return null;
        return { ...prev, totalAmount: newTotal };
      });
    }
  }, [
    isEditingTrip,
    globalSelectedBooking?.participants.adults,
    globalSelectedBooking?.participants.children,
    globalSelectedBooking?.packageName,
    JSON.stringify(globalSelectedBooking?.selectedAddOns),
    globalSelectedBooking?.tourId,
    tours
  ]);

  const menuItems = useMemo(() => {
    const isSupplier = currentUserProfile?.role === 'supplier';
    const isAgent = currentUserProfile?.role === 'agent';
    
    interface MenuItem {
      id: string;
      label: string;
      icon?: any;
      hidden?: boolean;
      children?: { id: string; label: string; hidden?: boolean }[];
    }

    const items: MenuItem[] = [
      { 
        id: 'dashboard', 
        label: 'Dashboard', 
        icon: Layout,
      },
      { 
        id: 'overview', 
        label: 'Performance', 
        icon: LayoutGrid,
        hidden: isSupplier || isAgent,
        children: [
          { id: 'analytics', label: 'Analytics' },
          { id: 'google-analytics', label: 'Google Analytics' }
        ]
      },
      { 
        id: 'inventory', 
        label: 'Inventory', 
        icon: MapIcon,
        hidden: isAgent,
        children: [
          { id: 'all-tours', label: 'All Tours' },
          { id: 'tours', label: 'Add New Tour' },
          { id: 'live-inventory', label: 'Live Availability' },
          { id: 'categories', label: 'Categories', hidden: isSupplier },
          { id: 'locations', label: 'Location Zones', hidden: isSupplier },
          { id: 'labels', label: 'General Labels', hidden: isSupplier },
          { id: 'addons', label: 'Global Add-ons', hidden: isSupplier },
          { id: 'transports', label: 'Global Transports', hidden: isSupplier },
          { id: 'urgency-points', label: 'Urgency Features', hidden: isSupplier },
          { id: 'coupons', label: 'Coupons', hidden: isSupplier }
        ].filter(c => !c.hidden)
      },
      { 
        id: 'operations', 
        label: 'Operations', 
        icon: Briefcase,
        children: [
          { id: 'bookings', label: isAgent ? 'My Bookings' : 'Manage Bookings' },
          { id: 'import-bookings', label: 'Import Booking', hidden: isAgent || isSupplier },
          { 
            id: 'inquiries', 
            label: 'Inquiries', 
            hidden: isAgent || isSupplier,
            count: inquiries.filter(i => i.status === 'new').length || undefined 
          },
          { id: 'schedule', label: 'Calendar', hidden: isAgent },
          { id: 'reports', label: 'Booking Reports' }, // Added here
          { id: 'guides', label: 'Guides/Drivers', hidden: isAgent },
          { id: 'timeslots', label: 'Time Slots', hidden: isSupplier || isAgent }
        ].filter(c => !c.hidden)
      },
      {
        id: 'tickets',
        label: 'Support & Tickets',
        icon: LifeBuoy,
        hidden: isSupplier || isAgent
      },
      { 
        id: 'content', 
        label: 'Content', 
        icon: FileText,
        hidden: isSupplier || isAgent,
        children: [
          { id: 'blog', label: 'Travel Blog' },
          { id: 'ai-hub', label: 'AI Travel Hub' },
          { id: 'pages', label: 'Static Pages' },
          { id: 'reviews', label: 'Reviews' },
          { id: 'popups-manager', label: 'Popups' }
        ]
      },
      { 
        id: 'users-group', 
        label: 'Users', 
        icon: Users,
        hidden: isSupplier || isAgent,
        children: [
          { id: 'users-admins', label: 'Administrators' },
          { id: 'users-suppliers', label: 'Suppliers' },
          { id: 'users-agents', label: 'Agents' },
          { id: 'users-customers', label: 'Customers' }
        ]
      },
      { 
        id: 'finance',
        label: 'Finance',
        icon: Wallet,
        children: [
          { id: 'payouts', label: 'Payouts' }
        ]
      },
      { 
        id: 'settings-group', 
        label: 'Settings', 
        icon: Settings,
        children: [
          { id: 'company-profile', label: 'My Company Profile', hidden: !isSupplier && !isAgent },
          { id: 'payment-settings', label: 'Payments', hidden: isSupplier || isAgent },
          { id: 'communication', label: 'Communication', hidden: isSupplier || isAgent },
          { id: 'access-roles', label: 'User Roles', hidden: isSupplier || isAgent },
          { id: 'general-settings', label: 'General', hidden: isSupplier || isAgent },
          { id: 'backup', label: 'Full Site Backup', hidden: isSupplier || isAgent }
        ].filter(c => !c.hidden)
      }
    ];

    return items.filter(i => !i.hidden);
  }, [currentUserProfile]);

  const activeMenuItemLabel = useMemo(() => {
    const top = menuItems.find(m => m.id === activeMenu);
    if (top) return top.label;
    const child = menuItems.flatMap(m => m.children || []).find(c => c.id === activeMenu);
    return child?.label || 'Admin Dashboard';
  }, [menuItems, activeMenu]);

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Icons.Loader2 className="h-12 w-12 text-primary animate-spin" />
          <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

  if (isAuthorized === false) {
    return null;
  }

  const handleAssignToGuide = async (booking: Booking, guide: Guide) => {
    if (currentUserProfile?.role === 'supplier' && guide.supplierId !== currentUserProfile.uid) {
        alert("Action restricted: You can only assign guides you have created.");
        return;
    }
    if (!booking) return;

    setLoadingStates(prev => ({ ...prev, assigningGuide: true }));
    try {
      const tourDoc = await getDoc(doc(db, 'tours', booking.tourId));
      const tour = tourDoc.exists() ? tourDoc.data() as Tour : null;
      
      let message = `*Tour Details Assignment*\n\n`;
      message += `Name of guest: ${booking.customerData.fullName}\n`;
      message += `No of guest: ${booking.participants.adults} Adults, ${booking.participants.children} Children\n`;
      message += `Pick up address: ${booking.customerData.pickupAddress || 'N/A'}\n`;
      message += `Guest Whatsapp Number: ${booking.customerData.phone}\n`;
      message += `Tour date: ${booking.date}\n`;
      message += `Tours: ${booking.tourTitle}\n`;
      message += `Package Booked: ${booking.packageName}\n`;
      
      if (booking.selectedAddOns && booking.selectedAddOns.length > 0) {
        message += `\n*Add-ons:*\n`;
        booking.selectedAddOns.forEach(addon => {
          message += `- ${addon.name} (x${addon.quantity})\n`;
        });
      }
      
      if (tour && tour.itinerary && tour.itinerary.length > 0) {
         message += `\n*Itinerary:*\n`;
         tour.itinerary.forEach(item => {
           message += `- ${item.title}\n`;
         });
      }

      const enrichedBookingForWhatsApp = {
        ...booking,
        assignedGuideId: guide.id,
        assignedGuideName: guide.name,
        assignedGuideWhatsapp: guide.whatsapp
      };

      // Send Automated WhatsApp via Whapi to Guide
      try {
        await sendCustomWhatsApp(guide.whatsapp, message, enrichedBookingForWhatsApp, true, false);
        console.log(`[WhatsApp] Auto-sent assignment to guide with Manifest PDF: ${guide.name}`);
      } catch (waErr) {
        console.error('[WhatsApp] Failed to auto-send to guide:', waErr);
      }

      // Send Automated WhatsApp via Whapi to Customer
      try {
        const commSettingsSnap = await getDoc(doc(db, 'communicationSettings', 'global'));
        const commSettings = commSettingsSnap.exists() ? commSettingsSnap.data() as CommunicationSettings : null;
        
        let customerMsg = `*Guide Assigned*\n\nHello ${booking.customerData.fullName}, we have assigned a guide for your tour "${booking.tourTitle}" on ${booking.date}.\n\n*Your Guide:* ${guide.name}\n*Guide WhatsApp:* ${guide.whatsapp}\n\nOur guide will contact you soon for pickup details. Enjoy your trip!`;
        
        if (commSettings?.whatsappTemplates?.guide_assigned?.enabled) {
          const template = commSettings.whatsappTemplates.guide_assigned.message;
          customerMsg = generateBookingMessage(template, {
            ...booking,
            assignedGuideName: guide.name,
            assignedGuideWhatsapp: guide.whatsapp
          });
        }
        
        await sendCustomWhatsApp(booking.customerData.phone || '', customerMsg, enrichedBookingForWhatsApp, false, true);
        console.log(`[WhatsApp] Auto-sent notification to customer with Tour Voucher PDF: ${booking.customerData.fullName}`);
      } catch (waErr) {
        console.error('[WhatsApp] Failed to auto-send to customer:', waErr);
      }

      // Send Email Notification for Guide Assigned
      try {
        await sendBookingEmail('guide_assigned', {
          ...booking,
          assignedGuideName: guide.name,
          assignedGuideWhatsapp: guide.whatsapp
        });
      } catch (emailErr) {
        console.error('Failed to send guide assignment email:', emailErr);
      }

      // Update Booking with assigned guide
      const newLog: BookingLog = {
        timestamp: new Date().toISOString(),
        message: `Guide assigned: ${guide.name} (${guide.whatsapp})`,
        type: 'assignment',
        userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin'
      };

      await updateDoc(doc(db, 'bookings', booking.id), {
        assignedGuideId: guide.id,
        assignedGuideName: guide.name,
        assignedGuideWhatsapp: guide.whatsapp,
        updatedAt: serverTimestamp(),
        logs: [
          ...(booking.logs || []),
          newLog
        ]
      });
      setIsAssignOpen(false);
      setAssignBooking(null);
      alert("Success! Guide assigned and WhatsApp notifications sent via API.");
    } catch (error) {
      console.error(error);
      handleFirestoreError(error, 'update' as any, `bookings/${booking?.id}`);
    } finally {
      setLoadingStates(prev => ({ ...prev, assigningGuide: false }));
    }
  };

  const handlePrintManifest = (booking: Booking) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const primaryColor = siteSettings?.primaryColor || '#10b981';
    const logoUrl = siteSettings?.logoURL;
    const siteName = siteSettings?.siteName || 'Bali Adventours';

    const manifestHtml = `
      <html>
        <head>
          <title>Tour Manifest - ${booking.id.toUpperCase()}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
            
            :root {
              --primary: ${primaryColor};
              --primary-light: ${primaryColor}15;
              --text-main: #1a1a1a;
              --text-muted: #64748b;
              --border-color: #f1f5f9;
            }

            body { 
              font-family: 'Plus Jakarta Sans', sans-serif; 
              color: var(--text-main); 
              line-height: 1.5; 
              padding: 0; 
              margin: 0; 
              background: #fff; 
            }

            .container { 
              max-width: 900px; 
              margin: 20px auto; 
              padding: 40px;
              border: 1px solid var(--border-color);
              border-radius: 24px;
            }

            .header { 
              display: flex; 
              justify-content: space-between; 
              align-items: flex-start; 
              margin-bottom: 40px; 
            }

            .logo-container { 
              display: flex; 
              flex-direction: column;
              gap: 8px;
            }
            
            .logo-img { height: 48px; width: auto; object-fit: contain; }
            .logo-placeholder { 
                background: var(--primary); 
                color: white; 
                padding: 10px 20px; 
                border-radius: 12px; 
                font-weight: 800; 
                font-size: 18px;
                display: block;
            }
            
            .booking-badge {
                background: var(--primary-light);
                color: var(--primary);
                padding: 6px 12px;
                border-radius: 100px;
                font-size: 11px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .manifest-title-area {
                margin-bottom: 40px;
            }
            .manifest-title-area h1 {
                font-size: 38px;
                font-weight: 800;
                margin: 0;
                letter-spacing: -0.04em;
                color: var(--text-main);
            }
            .manifest-title-area p {
                color: var(--text-muted);
                font-weight: 500;
                margin: 4px 0 0;
                font-size: 16px;
            }

            .main-grid {
                display: grid;
                grid-template-columns: 1.8fr 1.2fr;
                gap: 32px;
            }

            .section { margin-bottom: 24px; }
            .section-label {
                font-size: 10px;
                font-weight: 900;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.12em;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .section-label::after {
                content: '';
                flex: 1;
                height: 1px;
                background: var(--border-color);
            }

            .info-card {
                background: #fcfdfe;
                border: 1px solid var(--border-color);
                border-radius: 16px;
                padding: 20px;
            }

            .data-row {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px;
            }
            .data-item .label {
                font-size: 9px;
                font-weight: 700;
                color: var(--text-muted);
                text-transform: uppercase;
                margin-bottom: 2px;
                display: block;
            }
            .data-item .value {
                font-size: 13px;
                font-weight: 700;
                color: var(--text-main);
                display: block;
            }
            .data-item.full { grid-column: span 2; }

            .pax-summary {
                display: flex;
                gap: 12px;
                margin-top: 16px;
            }
            .pax-pill {
                background: #fff;
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 10px 16px;
                flex: 1;
                text-align: center;
            }
            .pax-pill .count {
                font-size: 18px;
                font-weight: 800;
                color: var(--primary);
                display: block;
            }
            .pax-pill .label {
                font-size: 9px;
                font-weight: 700;
                color: var(--text-muted);
                text-transform: uppercase;
            }

            .addon-box {
                border: 1px solid var(--border-color);
                border-radius: 16px;
                overflow: hidden;
            }
            .addon-line {
                display: flex;
                justify-content: space-between;
                padding: 10px 16px;
                background: #fff;
                border-bottom: 1px solid var(--border-color);
            }
            .addon-line:last-child { border-bottom: none; }
            .addon-name { font-weight: 600; font-size: 12px; }
            .addon-qty { font-weight: 800; color: var(--primary); }

            .notes-area {
                background: #fff9eb;
                border-radius: 16px;
                padding: 16px;
                color: #854d0e;
                font-size: 12px;
                font-weight: 600;
                border: 1px solid #fef3c7;
                line-height: 1.5;
            }

            .footer {
                margin-top: 40px;
                padding-top: 24px;
                border-top: 1px solid var(--border-color);
                display: flex;
                justify-content: space-between;
                font-size: 10px;
                color: var(--text-muted);
                font-weight: 600;
            }

            @media print {
              body { padding: 0; }
              .container {
                  margin: 0;
                  padding: 10px;
                  border: none;
                  max-width: 100%;
              }
              @page { margin: 1cm; }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo-container">
                ${logoUrl ? `<img src="${logoUrl}" class="logo-img" alt="${siteName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : ''}
                <span class="logo-placeholder" style="${logoUrl ? 'display:none;' : ''}">${siteName.toUpperCase()}</span>
              </div>
              <div style="text-align: right;">
                <div class="booking-badge">#${booking.id.toUpperCase()}</div>
                <div style="margin-top: 6px; font-size:11px; font-weight:700; color: var(--text-muted);">Booking Reference</div>
              </div>
            </div>

            <div class="manifest-title-area">
              <h1>Tour Manifest</h1>
              <p>Operational summary for on-ground field team</p>
            </div>

            <div class="main-grid">
              <div class="left-col">
                <div class="section">
                  <div class="section-label">General Information</div>
                  <div class="info-card">
                    <div class="data-row">
                      <div class="data-item full">
                        <span class="label">Tour / Activity Name</span>
                        <span class="value" style="font-size: 16px; color: var(--primary);">${booking.tourTitle}</span>
                      </div>
                      <div class="data-item">
                        <span class="label">Package Type</span>
                        <span class="value">${booking.packageName}</span>
                      </div>
                      <div class="data-item">
                        <span class="label">Trip Date</span>
                        <span class="value">${booking.date}</span>
                      </div>
                      <div class="data-item">
                        <span class="label">Meeting / Pickup</span>
                        <span class="value">${booking.time || booking.timeSlot || 'TBA'}</span>
                      </div>
                      <div class="data-item">
                        <span class="label">Status</span>
                        <span class="value" style="text-transform: uppercase;">${booking.status}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="section">
                  <div class="section-label">Participant Details</div>
                  <div class="info-card">
                    <div class="data-row">
                      <div class="data-item">
                        <span class="label">Guest Name</span>
                        <span class="value">${booking.customerData.fullName}</span>
                      </div>
                      <div class="data-item">
                        <span class="label">Nationality</span>
                        <span class="value">${booking.customerData.nationality || 'N/A'}</span>
                      </div>
                      <div class="data-item">
                        <span class="label">Contact Number</span>
                        <span class="value">${booking.customerData.phone}</span>
                      </div>
                      <div class="data-item">
                        <span class="label">Email</span>
                        <span class="value">${booking.customerData.email}</span>
                      </div>
                    </div>
                    
                    <div class="pax-summary">
                      <div class="pax-pill">
                        <span class="count">${booking.participants.adults}</span>
                        <span class="label">Adults</span>
                      </div>
                      <div class="pax-pill">
                        <span class="count">${booking.participants.children}</span>
                        <span class="label">Children</span>
                      </div>
                      <div class="pax-pill" style="background: var(--primary-light); border-color: var(--primary);">
                        <span class="count">${booking.participants.adults + booking.participants.children}</span>
                        <span class="label" style="color: var(--primary);">Total Pax</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="section">
                    <div class="section-label">Pickup & Arrival Info</div>
                    <div class="info-card">
                        <div class="data-item full">
                            <span class="label">Location / Hotel Name</span>
                            <span class="value">${booking.customerData.pickupAddress || 'No Pickup Requested'}</span>
                        </div>
                    </div>
                </div>
              </div>

              <div class="right-col">
                ${booking.selectedAddOns?.length > 0 ? `
                <div class="section">
                  <div class="section-label">Booked Add-Ons</div>
                  <div class="addon-box">
                    ${booking.selectedAddOns.map(addon => `
                      <div class="addon-line">
                        <span class="addon-name">${addon.name}</span>
                        <span class="addon-qty">x${addon.quantity}</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
                ` : ''}

                <div class="section">
                    <div class="section-label">Special Requirements</div>
                    <div class="notes-area">
                        ${booking.customerData.specialRequirements || 'No special requirements noted for this trip.'}
                    </div>
                </div>

                <div class="section">
                    <div class="section-label">Guide Assignment</div>
                    <div class="info-card" style="padding: 16px;">
                        <span class="label" style="font-size: 9px; margin-bottom: 2px;">Assigned Field Team</span>
                        <span class="value">${booking.assignedGuideName || 'Pending Assignment'}</span>
                        ${booking.assignedGuideWhatsapp ? `<span class="label" style="font-size: 8px; margin-top: 4px;">Contact: ${booking.assignedGuideWhatsapp}</span>` : ''}
                    </div>
                </div>
              </div>
            </div>

            <div class="footer">
              <span>Verified Operational Document • ${siteName}</span>
              <span>Generated: ${new Date().toLocaleString()}</span>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 1200);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(manifestHtml);
    printWindow.document.close();
  };

  const updateBookingStatus = async (id: string, status: 'confirmed' | 'cancelled' | 'pending' | 'review_required' | 'completed') => {
    if (currentUserProfile?.role !== 'admin') {
        alert("Action restricted: Payments and status updates must be processed by the Super Admin.");
        return;
    }
    
    setLoadingStates(prev => ({ ...prev, statusUpdating: true }));
    try {
      await updateDoc(doc(db, 'bookings', id), { status });
      
      // Send Email Notification
      const bookingSnap = await getDoc(doc(db, 'bookings', id));
      if (bookingSnap.exists()) {
         const bookingData = { id: bookingSnap.id, ...bookingSnap.data() } as Booking;
         
         const emailPromises: Promise<any>[] = [];

         if (status === 'confirmed') {
           // Customer: Booking Status Changed from Pending to Confirmed
           emailPromises.push(sendBookingEmail('booking_status_confirmed', bookingData));
           // Admin: Booking Confirmed by Admin
           emailPromises.push(sendBookingEmail('admin_booking_confirmed', bookingData));
           // Supplier: Booking Confirmed by Admin
           emailPromises.push(sendBookingEmail('supplier_booking_confirmed', bookingData));
         } else if (status === 'cancelled') {
           // Customer: Booking Canceled (Approved by admin)
           emailPromises.push(sendBookingEmail('booking_cancelled', bookingData));
           // Admin: Booking Canceled Approved
           emailPromises.push(sendBookingEmail('admin_booking_cancellation_approved', bookingData));
           // Supplier: Booking Canceled Approved
           emailPromises.push(sendBookingEmail('supplier_booking_cancellation_approved', bookingData));
         } else if (status === 'completed') {
           // Customer: Tour Completed, Thank you and Review Request
           emailPromises.push(sendBookingEmail('tour_completed_review_request', bookingData));
           // Admin: Booking Completed
           emailPromises.push(sendBookingEmail('admin_booking_completed', bookingData));
           // Supplier: Booking Completed
           emailPromises.push(sendBookingEmail('supplier_booking_completed', bookingData));
         } else if (status === 'review_required') {
           if (bookingData.cancellationRequested) {
             emailPromises.push(sendBookingEmail('booking_cancellation_request', bookingData));
             emailPromises.push(sendBookingEmail('admin_booking_cancellation_request', bookingData));
             emailPromises.push(sendBookingEmail('supplier_booking_cancellation_request', bookingData));
           } else {
             emailPromises.push(sendBookingEmail('booking_change_request', bookingData));
             emailPromises.push(sendBookingEmail('admin_booking_change_request', bookingData));
             emailPromises.push(sendBookingEmail('supplier_booking_change_request', bookingData));
           }
         } else {
           emailPromises.push(sendBookingEmail('booking_status_updated', bookingData));
         }

         await Promise.all(emailPromises).catch(err => console.error("Error sending role-based status emails:", err));
         
         // Trigger WhatsApp
         await sendWhatsAppNotification('booking_status_updated', bookingData);
      }

      alert(`Booking status changed to ${status} successfully and notifications sent!`);
    } catch (err) {
      console.error(err);
      alert("Failed to update status.");
    } finally {
      setLoadingStates(prev => ({ ...prev, statusUpdating: false }));
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (currentUserProfile?.role !== 'admin') {
        alert("Action restricted: Only the Super Admin can delete bookings.");
        return;
    }
    if (confirm("Are you sure you want to PERMANENTLY delete this booking? This action cannot be undone.")) {
      setLoadingStates(prev => ({ ...prev, deletingBooking: true }));
      try {
        await deleteDoc(doc(db, 'bookings', id));
        setIsBookingDetailOpen(false);
        setGlobalSelectedBooking(null);
        alert("Booking deleted successfully!");
      } catch (err) {
        console.error(err);
        alert("Failed to delete booking.");
      } finally {
        setLoadingStates(prev => ({ ...prev, deletingBooking: false }));
      }
    }
  };

  const handleAddInternalNote = async () => {
    if (!newNote.trim() || !globalSelectedBooking) return;
    
    setLoadingStates(prev => ({ ...prev, addingNote: true }));
    const newLog: BookingLog = {
      timestamp: new Date().toISOString(),
      message: newNote,
      type: 'note',
      userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin'
    };
    
    const updatedLogs = [...(globalSelectedBooking.logs || []), newLog];
    const updatedBooking = { ...globalSelectedBooking, logs: updatedLogs };
    
    setGlobalSelectedBooking(updatedBooking);
    setNewNote('');
    
    try {
      await updateDoc(doc(db, 'bookings', globalSelectedBooking.id), {
        logs: updatedLogs,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      setLoadingStates(prev => ({ ...prev, addingNote: false }));
    }
  };

  const handleSaveBookingChange = async (e: FormEvent) => {
    e.preventDefault();
    if (currentUserProfile?.role !== 'admin') {
        alert("Action restricted: Booking modifications must be processed by the Super Admin.");
        return;
    }
    if (!globalSelectedBooking) return;
    setLoadingStates(prev => ({ ...prev, updatingBooking: true }));
    try {
      const { id, ...data } = globalSelectedBooking;
      
      // Handle Auto-logging of changes
      const newLogs: BookingLog[] = [...(globalSelectedBooking.logs || [])];
      const adminName = auth.currentUser?.displayName || auth.currentUser?.email || 'Admin';
      
      if (originalBooking) {
        if (globalSelectedBooking.status !== originalBooking.status) {
          newLogs.push({
            timestamp: new Date().toISOString(),
            message: `Status changed from ${originalBooking.status} to ${globalSelectedBooking.status}`,
            type: 'status_change',
            userName: adminName
          });
        }
        if (globalSelectedBooking.date !== originalBooking.date) {
            newLogs.push({
              timestamp: new Date().toISOString(),
              message: `Tour date changed from ${originalBooking.date} to ${globalSelectedBooking.date}`,
              type: 'system',
              userName: adminName
            });
        }
        if (globalSelectedBooking.paymentStatus !== originalBooking.paymentStatus) {
            newLogs.push({
              timestamp: new Date().toISOString(),
              message: `Payment status changed from ${originalBooking.paymentStatus} to ${globalSelectedBooking.paymentStatus}`,
              type: 'system',
              userName: adminName
            });
        }
        if (globalSelectedBooking.packageName !== originalBooking.packageName) {
            newLogs.push({
              timestamp: new Date().toISOString(),
              message: `Package changed from ${originalBooking.packageName} to ${globalSelectedBooking.packageName}`,
              type: 'system',
              userName: adminName
            });
        }
        if (globalSelectedBooking.participants.adults !== originalBooking.participants.adults || globalSelectedBooking.participants.children !== originalBooking.participants.children) {
            newLogs.push({
              timestamp: new Date().toISOString(),
              message: `Participants updated: ${globalSelectedBooking.participants.adults}A, ${globalSelectedBooking.participants.children}C`,
              type: 'system',
              userName: adminName
            });
        }
      }

      const finalData = { ...data, logs: newLogs };
      await updateDoc(doc(db, 'bookings', id), finalData as any);
      
      // Determine logical change for specific email branding and send to stakeholders
      const emailPromises: Promise<any>[] = [];
      const updatedBookingWithLogs = { ...globalSelectedBooking, logs: newLogs } as Booking;
      
      if (originalBooking) {
        const statusChanged = globalSelectedBooking.status !== originalBooking.status;
        const dateChanged = globalSelectedBooking.date !== originalBooking.date;
        const participantsChanged = 
          globalSelectedBooking.participants.adults !== originalBooking.participants.adults ||
          globalSelectedBooking.participants.children !== originalBooking.participants.children;
        const addOnsChanged = JSON.stringify(globalSelectedBooking.selectedAddOns || []) !== JSON.stringify(originalBooking.selectedAddOns || []);
        
        const isApproved = statusChanged && 
          originalBooking.status === 'review_required' && 
          globalSelectedBooking.status === 'confirmed';

        if (isApproved) {
          // Booking Change Approved
          emailPromises.push(sendBookingEmail('booking_change_approved', updatedBookingWithLogs));
          emailPromises.push(sendBookingEmail('admin_booking_change_approved', updatedBookingWithLogs));
          emailPromises.push(sendBookingEmail('supplier_booking_change_approved', updatedBookingWithLogs));
        } else if (statusChanged) {
          if (globalSelectedBooking.status === 'confirmed') {
            emailPromises.push(sendBookingEmail('booking_status_confirmed', updatedBookingWithLogs));
            emailPromises.push(sendBookingEmail('admin_booking_confirmed', updatedBookingWithLogs));
            emailPromises.push(sendBookingEmail('supplier_booking_confirmed', updatedBookingWithLogs));
          } else if (globalSelectedBooking.status === 'cancelled') {
            emailPromises.push(sendBookingEmail('booking_cancelled', updatedBookingWithLogs));
            emailPromises.push(sendBookingEmail('admin_booking_cancellation_approved', updatedBookingWithLogs));
            emailPromises.push(sendBookingEmail('supplier_booking_cancellation_approved', updatedBookingWithLogs));
          } else if (globalSelectedBooking.status === 'completed') {
            emailPromises.push(sendBookingEmail('tour_completed_review_request', updatedBookingWithLogs));
            emailPromises.push(sendBookingEmail('admin_booking_completed', updatedBookingWithLogs));
            emailPromises.push(sendBookingEmail('supplier_booking_completed', updatedBookingWithLogs));
          } else {
            emailPromises.push(sendBookingEmail('booking_status_updated', updatedBookingWithLogs));
          }
        } else if (dateChanged || participantsChanged || addOnsChanged) {
          // Booking Changed by admin
          emailPromises.push(sendBookingEmail('booking_updated_by_admin', updatedBookingWithLogs));
          emailPromises.push(sendBookingEmail('admin_booking_change_approved', updatedBookingWithLogs));
          emailPromises.push(sendBookingEmail('supplier_booking_change_approved', updatedBookingWithLogs));
        } else if (globalSelectedBooking.paymentStatus !== originalBooking.paymentStatus && globalSelectedBooking.paymentStatus === 'paid') {
          emailPromises.push(sendBookingEmail('booking_payment_received', updatedBookingWithLogs));
        } else {
          // Default fallback
          emailPromises.push(sendBookingEmail('booking_status_updated', updatedBookingWithLogs));
        }
      } else {
        emailPromises.push(sendBookingEmail('booking_status_updated', updatedBookingWithLogs));
      }
      
      // Trigger notifications in the background to ensure instant and ultra-resilient save operations
      Promise.all([
        ...emailPromises,
        sendWhatsAppNotification('booking_status_updated', updatedBookingWithLogs).catch(err => console.error("Error sending WhatsApp save notification:", err))
      ]).catch(err => {
        console.error("Error processing booking save notifications:", err);
      });
      
      alert("Booking updated successfully and notifications sent!");
      setIsBookingDetailOpen(false);

      setOriginalBooking(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `bookings/${globalSelectedBooking?.id}`);
      console.error(err);
      alert("Failed to save booking. " + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoadingStates(prev => ({ ...prev, updatingBooking: false }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      // Hydrate selected add-ons from global list for frontend snapshots
      const selectedAddOnObjects = globalAddOns.filter(a => formData.addOnIds?.includes(a.id));
      const selectedTransportObjects = globalTransports.filter(t => formData.transportIds?.includes(t.id));

      const isSupplier = currentUserProfile?.role === 'supplier';
      const dataToSave = {
        ...formData,
        ...(isSupplier && {
          supplierId: currentUserProfile.uid,
          supplierName: currentUserProfile.companyName || currentUserProfile.displayName,
          status: editingId ? (formData.status || 'draft') : 'draft'
        }),
        addOns: selectedAddOnObjects, // Full objects for frontend
        transports: selectedTransportObjects, // Full objects for frontend
        highlights: highlightsText.split('\n').filter(line => line.trim() !== ''),
        inclusions: inclusionsText.split('\n').filter(line => line.trim() !== ''),
        exclusions: exclusionsText.split('\n').filter(line => line.trim() !== ''),
        languages: languagesText.split('\n').filter(line => line.trim() !== ''),
        packages: (formData.packages || []).map(pkg => ({
          ...pkg,
          inclusions: (pkg.inclusions || []).filter(l => l.trim() !== ''),
          exclusions: (pkg.exclusions || []).filter(l => l.trim() !== '')
        })),
        infoSections: (formData.infoSections || []).map(section => ({
          ...section,
          content: Array.isArray(section.content) ? section.content.filter(l => l.trim() !== '') : []
        })),
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, 'tours', editingId), dataToSave);
      } else {
        await addDoc(collection(db, 'tours'), {
          ...dataToSave,
          createdAt: serverTimestamp(),
        });
        resetForm();
      }
      alert("Success!");
    } catch (error) {
      console.error("Error saving tour", error);
      alert("Error saving tour. Check permissions.");
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setExpandedPackages([]);
    setExpandedItinerary([]);
    setActiveTab('basic');
    setHighlightsText('');
    setInclusionsText('');
    setExclusionsText('');
    setLanguagesText('');
    setFormData({
      title: '', slug: '', description: '', categoryId: '', tourTypeId: '', locationId: '',
      location: '', duration: '',
      regularPrice: 0, discountPrice: 0, gallery: [], featuredImage: '',
      highlights: [], inclusions: [], exclusions: [], itinerary: [],
      languages: [], packages: [], addOnIds: [], transportIds: [], meetingPoint: '', labelIds: [], 
      imageLabelId: '', belowTitleLabelId: '', priceLabelId: '',
      faqs: [], locationMapUrl: '',
      infoSections: [], importantInfo: '',
      maxCapacity: 0, slotCapacity: 0,
      supplierId: '', supplierName: '', status: 'draft'
    });
  };

  const handleEdit = (tour: Tour) => {
    setEditingId(tour.id);
    setExpandedPackages([]);
    setExpandedItinerary([]);
    setHighlightsText(tour.highlights?.join('\n') || '');
    setInclusionsText(tour.inclusions?.join('\n') || '');
    setExclusionsText(tour.exclusions?.join('\n') || '');
    setLanguagesText(tour.languages?.join('\n') || '');
    setFormData({
      ...formData, // default values
      ...tour,
      gallery: tour.gallery || [],
      highlights: tour.highlights || [],
      inclusions: tour.inclusions || [],
      exclusions: tour.exclusions || [],
      itinerary: tour.itinerary || [],
      packages: tour.packages || [],
      addOns: tour.addOns || [],
      faqs: tour.faqs || [],
      languages: tour.languages || [],
      labelIds: tour.labelIds || [],
      infoSections: tour.infoSections || []
    });
    setActiveTab('basic');
    setActiveMenu('tours');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloneTour = async (tour: Tour) => {
    if (!confirm(`Clone "${tour.title}"?`)) return;
    try {
      const { id, createdAt, updatedAt, ...clonedData } = tour;
      const newTitle = `${clonedData.title} (Copy)`;
      const newSlug = `${clonedData.slug}-copy-${Math.floor(Math.random() * 1000)}`;
      
      await addDoc(collection(db, 'tours'), {
        ...clonedData,
        title: newTitle,
        slug: newSlug,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      alert("Tour cloned successfully!");
    } catch (error) {
      console.error("Error cloning tour", error);
      alert("Failed to clone tour.");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this tour?")) {
      await deleteDoc(doc(db, 'tours', id));
    }
  };

  // Helper for adding/removing items in arrays
  const addArrayItem = (field: keyof Tour, defaultValue: any) => {
    const current = Array.isArray(formData[field]) ? (formData[field] as any[]) : [];
    const newList = [...current, defaultValue];
    setFormData({ ...formData, [field]: newList });
    
    // Automatically expand the new item
    if (field === 'packages') {
      setExpandedPackages(prev => [...prev, current.length]);
    } else if (field === 'itinerary') {
      setExpandedItinerary(prev => [...prev, current.length]);
    }
  };

  const updateArrayItem = (field: keyof Tour, index: number, value: any) => {
    const current = Array.isArray(formData[field]) ? [...(formData[field] as any[])] : [];
    current[index] = value;
    setFormData({ ...formData, [field]: current });
  };

  const removeArrayItem = (field: keyof Tour, index: number) => {
    const current = Array.isArray(formData[field]) ? [...(formData[field] as any[])] : [];
    current.splice(index, 1);
    setFormData({ ...formData, [field]: current });

    // Update expanded states
    if (field === 'packages') {
      setExpandedPackages(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
    } else if (field === 'itinerary') {
      setExpandedItinerary(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
    }
  };

  const handleItineraryImageUpload = async (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const url = await uploadImage(file);
      const newItinerary = [...(formData.itinerary || [])];
      newItinerary[index] = { ...newItinerary[index], image: url };
      setFormData({ ...formData, itinerary: newItinerary });
    } catch (error) {
      alert("Image upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  // File Upload to Imgbb (Multi-file Support)
  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadImage(file as File));
      const urls = await Promise.all(uploadPromises);
      const currentGallery = formData.gallery || [];
      setFormData({ ...formData, gallery: [...currentGallery, ...urls] });
    } catch (error) {
      alert("Upload failed. Make sure your IMGBB API key is correct.");
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'basic', label: 'Basic Info', icon: Layout },
    { id: 'content', label: 'Highlights', icon: ImageIcon },
    { id: 'inclusions', label: 'Incl/Excl', icon: CheckCircle },
    { id: 'pricing', label: 'Pricing & Pkgs', icon: DollarSign },
    { id: 'itinerary', label: 'Itinerary', icon: MapIcon },
    { id: 'addOns', label: 'Add-ons', icon: PlusCircle },
    { id: 'transports', label: 'Transports', icon: Car },
    { id: 'info', label: 'Important Info', icon: ShieldAlert },
    { id: 'faq', label: 'Policies & FAQ', icon: Info },
    { id: 'seo', label: 'SEO Settings', icon: Globe },
  ];

  const seedDummyData = async () => {
    // Get the first supplier to assign dummy tours to if exists
    const firstSupplier = users.find(u => u.role === 'supplier');
    const supplierId = firstSupplier?.uid || '';
    const supplierName = firstSupplier ? (firstSupplier.companyName || firstSupplier.displayName) : '';

    const dummyTours: Partial<Tour>[] = [
      {
        title: "Ultimate Bali Adventure: Jungle & Beaches",
        slug: "ultimate-bali-adventure",
        supplierId,
        supplierName,
        status: 'published',
        description: "Experience the best of Bali in this 7-day comprehensive tour. From the lush jungles of Ubud to the pristine beaches of Uluwatu, this tour covers the island's most iconic spots. You'll visit ancient temples, witness traditional kecak dances, and enjoy world-class surf breaks. Our expert local guides will ensure you get an authentic experience away from the crowds.",
        highlights: ["Sunrise hike at Mount Batur", "Ubud Monkey Forest visit", "Tegalalang Rice Terrace tour", "Surfing lessons in Canggu"],
        inclusions: ["6 nights accommodation", "Daily breakfast", "Private transport"],
        exclusions: ["International flights", "Travel insurance", "Personal expenses"],
        itinerary: [
          { day: 1, title: "Arrival in Denpasar", description: "Pick up from airport and check-in at your hotel in Seminyak." },
          { day: 2, title: "Cultural Ubud", description: "Visit the Monkey Forest and Tegalalang Rice Terraces." }
        ],
        importantInfo: "Bring comfortable walking shoes and swimwear.",
        languages: ["English", "Indonesian"],
        location: "Ubud & Seminyak",
        locationMapUrl: "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1010372!2d114.475!3d-8.45!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2dd141d3e8101539%3A0x740dfc3444053b6!2sBali!5e0!3m2!1sen!2sid!4v1713480000000!5m2!1sen!2sid",
        duration: "7 Days",
        gallery: ["https://picsum.photos/seed/bali-jungle/1200/800", "https://picsum.photos/seed/bali-beach/1200/800", "https://picsum.photos/seed/bali-temple/1200/800"],
        regularPrice: 1200,
        discountPrice: 999,
        packages: [
          {
            name: "Standard Package",
            inclusions: ["Airport Transfer", "Breakfast"],
            exclusions: ["Lunch", "Dinner"],
            tiers: [{ minParticipants: 1, maxParticipants: 10, adultPrice: 999, childPrice: 799 }]
          }
        ],
        faqs: [{ question: "Is it difficult?", answer: "Moderate fitness required." }]
      },
      {
        title: "Nusa Penida Island Escape",
        slug: "nusa-penida-escape",
        supplierId,
        supplierName,
        status: 'published',
        description: "Rugged Nusa islands adventure.",
        highlights: ["Broken Beach", "Angel Billabong"],
        itinerary: [{ day: 1, title: "Arrival", description: "Boat to Nusa." }],
        location: "Nusa Penida",
        duration: "3 Days",
        gallery: ["https://picsum.photos/seed/nusa1/1200/800"],
        regularPrice: 450,
        packages: [
          {
            name: "Standard",
            inclusions: ["Boat Transfer"],
            exclusions: ["Dinner"],
            tiers: [{ minParticipants: 1, maxParticipants: 10, adultPrice: 450, childPrice: 350 }]
          }
        ]
      }
    ];

    try {
      for (const tour of dummyTours) {
        await addDoc(collection(db, 'tours'), {
          ...tour,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      // Seed urgency points if none exist
      if (urgencyPoints.length === 0) {
        const defaultUrgency = [
          { title: "Free Cancellation", description: "Up to 24 hours in advance", icon: "CheckCircle" },
          { title: "Instant Confirmation", description: "Receive your voucher immediately", icon: "Clock" },
          { title: "No Hidden Fees", description: "All taxes and service fees included", icon: "Calendar" }
        ];
        defaultUrgency.forEach(p => addDoc(collection(db, 'urgencyPoints'), p));
      }

      // Seed a sample page if none exist
      const pagesSnap = await getDocs(collection(db, 'pages'));
      if (pagesSnap.empty) {
        await addDoc(collection(db, 'pages'), {
          title: "Terms and Conditions",
          slug: "terms-and-conditions",
          content: "Welcome to Bali Adventours. By booking with us, you agree to...",
          updatedAt: serverTimestamp()
        });
      }
      
      alert("Dummy tours, urgency points, and pages seeded successfully!");
    } catch (error) {
       console.error("Error seeding", error);
       alert("Failed to seed. Make sure you are an admin.");
    }
  };

  const ScheduleCalendar = () => {
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    // Data is managed by parent Admin component
    const loading = false;

    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate,
    });

    const getBookingsForDay = (day: Date) => {
      return bookings.filter(b => {
        try {
          const bookingDate = parseISO(b.date);
          return isSameDay(bookingDate, day);
        } catch (e) {
          return false;
        }
      });
    };

    const nextMonth = () => setViewDate(addMonths(viewDate, 1));
    const previousMonth = () => setViewDate(subMonths(viewDate, 1));
    const goToToday = () => {
      setViewDate(new Date());
      setSelectedDate(new Date());
    };

    const selectedDayBookings = getBookingsForDay(selectedDate);
    const totalGuests = selectedDayBookings.reduce((sum, b) => sum + (b.participants.adults + b.participants.children), 0);
    const totalRevenue = selectedDayBookings.reduce((sum, b) => sum + b.totalAmount, 0);

    if (loading) return <div className="flex justify-center p-20"><Icons.Loader2 className="animate-spin text-primary" /></div>;

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Tour Schedule Calendar</h2>
            <p className="text-gray-500 font-medium text-sm">View and manage your tour bookings by date</p>
          </div>
          <button 
            onClick={() => setActiveMenu('bookings')}
            className="px-6 py-3 rounded-xl border-2 border-gray-100 font-black text-xs uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2"
          >
            <Icons.List className="h-4 w-4" /> View All Bookings
          </button>
        </div>

        <div className="bg-white rounded-[10px] border border-gray-100 shadow-sm overflow-hidden p-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-8">
               <div className="flex items-center gap-2">
                 <button onClick={previousMonth} className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 group transition-all">
                    <Icons.ChevronLeft className="h-5 w-5 group-hover:text-gray-900" />
                 </button>
                 <h3 className="text-xl font-black text-gray-900 min-w-[160px] text-center">
                    {format(viewDate, 'MMMM yyyy')}
                 </h3>
                 <button onClick={nextMonth} className="p-2 hover:bg-gray-50 rounded-lg text-gray-400 group transition-all">
                    <Icons.ChevronRight className="h-5 w-5 group-hover:text-gray-900" />
                 </button>
               </div>
            </div>
            <button 
              onClick={goToToday}
              className="px-5 py-2.5 rounded-xl bg-primary text-white font-black text-xs uppercase tracking-[0.1em] hover:bg-orange-700 transition-all flex items-center gap-2 shadow-lg shadow-orange-100"
            >
              <Icons.Calendar className="h-4 w-4" /> Today
            </button>
          </div>

          <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden bg-gray-100 border border-gray-100">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-gray-50 py-4 text-center">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{day}</span>
              </div>
            ))}
            
            {calendarDays.map((day, idx) => {
              const dayBookings = getBookingsForDay(day);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, monthStart);
              const guestsCount = dayBookings.reduce((sum, b) => sum + (b.participants.adults + b.participants.children), 0);

              return (
                <div 
                  key={idx}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    "min-h-[140px] bg-white p-4 transition-all cursor-pointer relative",
                    !isCurrentMonth && "bg-gray-50/30",
                    isSelected && "ring-2 ring-primary ring-inset z-10 bg-orange-50/30"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={cn(
                      "text-sm font-black transition-colors",
                      !isCurrentMonth ? "text-gray-300" : isToday(day) ? "text-primary" : "text-gray-500",
                      isSelected && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayBookings.length > 0 && (
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        dayBookings.some(b => b.status === 'confirmed') ? "bg-orange-500" : "bg-amber-500"
                      )} />
                    )}
                  </div>

                  {dayBookings.length > 0 && isCurrentMonth && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-black text-gray-900 leading-tight">
                        {dayBookings.length} booking{dayBookings.length > 1 ? 's' : ''}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400">
                         <Icons.Users className="h-2.5 w-2.5" />
                         {guestsCount} people
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details */}
        <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
           <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </h3>
                <p className="text-gray-500 font-bold text-sm">
                  {selectedDayBookings.length} booking{selectedDayBookings.length !== 1 ? 's' : ''} scheduled
                </p>
              </div>
              <div className="flex items-center gap-8 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                 <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Guests</p>
                    <p className="text-2xl font-black text-gray-900">{totalGuests}</p>
                 </div>
                 <div className="w-px h-10 bg-gray-100" />
                 <div className="text-right">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Revenue</p>
                    <p className="text-2xl font-black text-primary font-mono">{formatPrice(totalRevenue)}</p>
                 </div>
              </div>
           </div>

           <div className="grid gap-4">
              {selectedDayBookings.map(booking => (
                <div key={booking.id} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:border-primary/50 transition-all group flex flex-col md:flex-row md:items-center justify-between gap-6">
                   <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors shrink-0">
                         <Icons.MapPin className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                         <div className="flex items-center gap-3">
                           <h4 className="font-black text-gray-900 text-lg">{booking.tourTitle}</h4>
                           <div className="flex gap-2">
                             <span className={cn(
                               "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                               booking.status === 'confirmed' ? "bg-orange-100 text-orange-700" :
                               booking.status === 'cancelled' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                             )}>
                               {booking.status}
                             </span>
                             {booking.bookingSource && (
                               <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 border border-gray-200">
                                 {booking.bookingSource}
                               </span>
                             )}
                           </div>
                         </div>
                         <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-bold text-gray-400">Guest:</span>
                               <span className="text-xs font-black text-gray-700">{booking.customerData.fullName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-bold text-gray-400">Email:</span>
                               <span className="text-xs font-bold text-gray-700">{booking.customerData.email}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-bold text-gray-400">Guests:</span>
                               <span className="text-xs font-black text-gray-700">{booking.participants.adults + booking.participants.children}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-bold text-gray-400">Total:</span>
                               <span className="text-xs font-black text-primary font-mono">{formatPrice(booking.totalAmount)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-bold text-gray-400">Guide:</span>
                               <span className="text-xs font-black text-primary uppercase tracking-tight">{booking.assignedGuideName || 'Not Assigned'}</span>
                            </div>
                         </div>
                      </div>
                   </div>
                   <button 
                     onClick={() => {
                        setGlobalSelectedBooking(booking);
                        setOriginalBooking(booking);
                        setIsBookingDetailOpen(true);
                     }}
                     className="px-6 py-3 rounded-xl border-2 border-gray-50 text-gray-900 font-black text-xs uppercase tracking-widest hover:border-primary hover:text-primary transition-all self-end md:self-center"
                   >
                     View Details
                   </button>
                </div>
              ))}               {selectedDayBookings.length === 0 && (
                <div className="p-12 text-center bg-gray-50/50 rounded-[10px] border border-gray-100 border-dashed">
                  <p className="text-gray-400 font-bold text-sm uppercase tracking-widest">No tours scheduled for this day</p>
                </div>
              )}
           </div>
        </div>
      </div>
    );
  };

  const BlogManager = () => {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPost, setEditingPost] = useState<Partial<BlogPost> | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isAiModalOpen, setIsAiModalOpen] = useState(false);

    const handleGenerateBlog = async () => {
      if (!aiPrompt.trim()) return;
      setIsGenerating(true);
      try {
        const genData = await generateBlogPostData(aiPrompt, commSettings?.geminiApiKey);
        setEditingPost({
          ...editingPost,
          title: genData.title,
          excerpt: genData.excerpt,
          content: genData.content,
          category: genData.category,
          tags: genData.tags,
          slug: genData.title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
        });
        setIsAiModalOpen(false);
        setAiPrompt('');
        alert("Success! AI has generated the blog post content.");
      } catch (err: any) {
        alert(err.message || "Failed to generate blog post.");
      } finally {
        setIsGenerating(false);
      }
    };

    useEffect(() => {
      const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost)));
        setLoading(false);
      }, (error) => {
        console.error("Posts fetch error:", error);
        setLoading(false);
      });
      return unsubscribe;
    }, []);

    const handleSavePost = async (e: FormEvent) => {
      e.preventDefault();
      if (!editingPost?.title || !editingPost?.slug) return;

      const postData = {
        ...editingPost,
        seo: editingPost.seo || { title: '', description: '' },
        updatedAt: serverTimestamp(),
      };

      if (!postData.createdAt) {
        postData.createdAt = serverTimestamp();
      }

      try {
        if (editingPost.id) {
          await updateDoc(doc(db, 'posts', editingPost.id), postData);
        } else {
          await addDoc(collection(db, 'posts'), postData);
        }
        setIsModalOpen(false);
        setEditingPost(null);
      } catch (err) {
        console.error("Error saving post:", err);
      }
    };

    const handleDeletePost = async (id: string) => {
      if (confirm("Delete this post?")) {
        await deleteDoc(doc(db, 'posts', id));
      }
    };

    if (loading) return <div className="flex justify-center p-20"><Icons.Loader2 className="animate-spin text-primary" /></div>;

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Blog Articles</h2>
            <p className="text-gray-500 font-medium text-sm">Create and manage your stories and news.</p>
          </div>
          <button 
            onClick={() => { setEditingPost({ status: 'draft', tags: [] }); setIsModalOpen(true); }}
            className="bg-primary text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-2"
          >
            <Icons.Plus className="h-4 w-4" /> New Article
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-[10px] border border-gray-100 shadow-sm overflow-hidden group">
              <div className="aspect-video relative overflow-hidden">
                <img 
                  src={post.featuredImage || 'https://picsum.photos/seed/blog/800/600'} 
                  className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 right-4 flex gap-2">
                  <button onClick={() => { setEditingPost(post); setIsModalOpen(true); }} className="p-2 bg-white/90 backdrop-blur rounded-lg text-blue-600 shadow-lg">
                    <Icons.Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDeletePost(post.id)} className="p-2 bg-white/90 backdrop-blur rounded-lg text-red-600 shadow-lg">
                    <Icons.Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="absolute bottom-4 left-4">
                  <span className={cn(
                    "px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest",
                    post.status === 'published' ? "bg-orange-500 text-white" : "bg-amber-500 text-white"
                  )}>
                    {post.status}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">{post.category}</span>
                </div>
                <h3 className="font-black text-gray-900 line-clamp-1 mb-2">{post.title}</h3>
                <p className="text-xs text-gray-500 line-clamp-2">{post.excerpt}</p>
              </div>
            </div>
          ))}
        </div>

        <AnimatePresence>
          {isModalOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsModalOpen(false)}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl shadow-2xl p-8 space-y-6 scrollbar-hide"
              >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <h3 className="text-xl font-black text-gray-900">{editingPost?.id ? 'Edit Article' : 'New Article'}</h3>
                      {!editingPost?.id && (
                        <button
                          type="button"
                          onClick={() => setIsAiModalOpen(true)}
                          className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/5 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all border border-primary/20"
                        >
                          <Sparkles className="h-3 w-3" /> AI Write
                        </button>
                      )}
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                      <Icons.X className="h-6 w-6" />
                    </button>
                  </div>

                <form onSubmit={handleSavePost} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Title</label>
                      <input 
                        required
                        value={editingPost?.title || ''}
                        onChange={e => setEditingPost({ 
                          ...editingPost, 
                          title: e.target.value, 
                          slug: e.target.value
                            .toLowerCase()
                            .replace(/[^\w\s-]/g, '')
                            .replace(/\s+/g, '-')
                            .replace(/-+/g, '-') 
                        })}
                        placeholder="Article Title"
                        className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold text-sm focus:border-primary focus:bg-white outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Slug</label>
                      <input 
                        required
                        value={editingPost?.slug || ''}
                        onChange={e => setEditingPost({ ...editingPost, slug: e.target.value })}
                        placeholder="url-slug"
                        className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold text-sm focus:border-primary focus:bg-white outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Category</label>
                      <input 
                        value={editingPost?.category || ''}
                        onChange={e => setEditingPost({ ...editingPost, category: e.target.value })}
                        placeholder="e.g. Travel Tips"
                        className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold text-sm focus:border-primary focus:bg-white outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Author</label>
                      <input 
                        value={editingPost?.author || ''}
                        onChange={e => setEditingPost({ ...editingPost, author: e.target.value })}
                        placeholder="Author Name"
                        className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold text-sm focus:border-primary focus:bg-white outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Status</label>
                      <select 
                        value={editingPost?.status || 'draft'}
                        onChange={e => setEditingPost({ ...editingPost, status: e.target.value as any, publishedAt: e.target.value === 'published' ? (editingPost?.publishedAt || serverTimestamp()) : null })}
                        className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold text-sm focus:border-primary focus:bg-white outline-none transition-all appearance-none"
                      >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Featured Image</label>
                    <div className="flex gap-4 items-center">
                      <div className="h-24 w-40 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl overflow-hidden relative group">
                        <img 
                          src={editingPost?.featuredImage || 'https://picsum.photos/seed/placeholder/800/600'} 
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                          <Icons.Upload className="h-6 w-6 text-white" />
                          <input 
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                try {
                                  const url = await uploadImage(file);
                                  setEditingPost({ ...editingPost, featuredImage: url });
                                } catch (err) {
                                  alert("Upload failed.");
                                }
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] font-bold text-gray-400">Paste Image URL, Upload, or Pick from Gallery</p>
                          <button
                            type="button"
                            onClick={() => {
                              openMediaGallery((urls) => {
                                if (urls[0]) {
                                  setEditingPost({ ...editingPost, featuredImage: urls[0] });
                                }
                              }, false);
                            }}
                            className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black px-2.5 py-1 rounded-md border border-blue-100 flex items-center gap-1 transition-all"
                          >
                            <ImageIcon className="h-3 w-3" />
                            Pick from Gallery
                          </button>
                        </div>
                        <input 
                          value={editingPost?.featuredImage || ''}
                          onChange={e => setEditingPost({ ...editingPost, featuredImage: e.target.value })}
                          placeholder="https://..."
                          className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold text-sm focus:border-primary focus:bg-white outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Tags (Comma separated)</label>
                    <input 
                      value={editingPost?.tags?.join(', ') || ''}
                      onChange={e => setEditingPost({ ...editingPost, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                      placeholder="e.g. Travel, Bali, Adventure"
                      className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-bold text-sm focus:border-primary focus:bg-white outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Short Excerpt</label>
                    <textarea 
                      rows={2}
                      value={editingPost?.excerpt || ''}
                      onChange={e => setEditingPost({ ...editingPost, excerpt: e.target.value })}
                      placeholder="Brief summary for archive page..."
                      className="w-full rounded-xl border-2 border-gray-50 bg-gray-50/50 p-4 font-medium text-sm focus:border-primary focus:bg-white outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Full Content</label>
                    <RichTextEditor 
                      content={editingPost?.content || ''}
                      onChange={(html) => setEditingPost({ ...editingPost, content: html })}
                      placeholder="Start writing your article..."
                    />
                  </div>

                  <div className="pt-6 border-t border-gray-100 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Icons.Share2 className="h-4 w-4 text-primary" />
                        <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">SEO Settings (Custom Meta)</h4>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Meta Title</label>
                            <input 
                                value={editingPost?.seo?.title || ''}
                                onChange={e => setEditingPost({ ...editingPost, seo: { ...editingPost.seo, title: e.target.value } })}
                                className="w-full rounded-[8px] border border-gray-100 p-3 text-sm focus:border-primary outline-none"
                                placeholder="SEO Browser Title"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase">Meta Description</label>
                            <textarea 
                                value={editingPost?.seo?.description || ''}
                                onChange={e => setEditingPost({ ...editingPost, seo: { ...editingPost.seo, description: e.target.value } })}
                                className="w-full rounded-[8px] border border-gray-100 p-3 text-sm focus:border-primary outline-none"
                                rows={2}
                                placeholder="Short SEO description..."
                            />
                        </div>
                    </div>
                  </div>

                  <button type="submit" className="w-full bg-primary text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all shadow-xl shadow-orange-100">
                    Save Article
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAiModalOpen && (
            <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAiModalOpen(false)}
                className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 space-y-6"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-black text-gray-900">AI Magic Writer</h3>
                  </div>
                  <button onClick={() => setIsAiModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                    <Icons.X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-gray-500 font-medium leading-relaxed">
                    Tell the AI what you want to write about. Be specific for better results (e.g., "Write a guide about the best waterfalls in Ubud for 2024").
                  </p>
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Describe your article ideas..."
                    className="w-full h-32 rounded-2xl border-2 border-gray-50 bg-gray-50/50 p-4 font-medium text-sm focus:border-primary focus:bg-white outline-none transition-all resize-none"
                    disabled={isGenerating}
                  />
                  
                  <button 
                    onClick={handleGenerateBlog}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="w-full bg-primary text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" /> Generate Magic Content
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const GuideManager = () => {
    const [guides, setGuides] = useState<Guide[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [whatsapp, setWhatsapp] = useState('');
    const [editingGuide, setEditingGuide] = useState<Guide | null>(null);

    useEffect(() => {
      if (!currentUserProfile) return;
      const isSupplier = currentUserProfile.role === 'supplier';
      
      let q;
      if (isSupplier) {
        q = query(collection(db, 'guides'), where('supplierId', '==', currentUserProfile.uid), orderBy('name', 'asc'));
      } else {
        q = query(collection(db, 'guides'), orderBy('name', 'asc'));
      }

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          setGuides(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guide)));
          setLoading(false);
        },
        (error) => {
          console.error("Guide fetch error:", error);
          // Fallback if index missing
          if (isSupplier) {
            onSnapshot(query(collection(db, 'guides'), where('supplierId', '==', currentUserProfile.uid)), (snap) => {
               setGuides(snap.docs.map(d => ({ id: d.id, ...d.data() } as Guide)));
            });
          }
          setLoading(false);
        }
      );
      return unsubscribe;
    }, [currentUserProfile?.uid]);

    const handleSubmit = async (e: FormEvent) => {
      e.preventDefault();
      if (!currentUserProfile) return;

      try {
        if (editingGuide) {
          await updateDoc(doc(db, 'guides', editingGuide.id), {
            name,
            whatsapp,
          });
          setEditingGuide(null);
        } else {
          await addDoc(collection(db, 'guides'), {
            name,
            whatsapp,
            isActive: true,
            supplierId: currentUserProfile.role === 'supplier' ? currentUserProfile.uid : null,
            createdByAdmin: currentUserProfile.role === 'admin'
          });
        }
        setName('');
        setWhatsapp('');
      } catch (err) {
        handleFirestoreError(err, 'write' as any, editingGuide ? `guides/${editingGuide.id}` : 'guides');
      }
    };

    const toggleActive = async (guide: Guide) => {
      await updateDoc(doc(db, 'guides', guide.id), { isActive: !guide.isActive });
    };

    const handleDelete = async (id: string) => {
      if (confirm("Delete this guide?")) {
        try {
          await deleteDoc(doc(db, 'guides', id));
          alert("Guide deleted successfully");
        } catch (error) {
          console.error("Delete failed", error);
          alert("Failed to delete guide. Check permissions.");
        }
      }
    };

    if (loading) return <div className="flex justify-center p-20"><Icons.Loader2 className="animate-spin text-primary" /></div>;

    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">Drivers & Guides</h2>
            <p className="text-gray-500 font-medium text-sm">Manage your field team and their contact details.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Full Name</label>
            <input 
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Ketut Wijaya"
              className="w-full rounded-xl border border-gray-100 p-4 font-bold text-sm focus:border-primary outline-none transition-all bg-gray-50/50"
            />
          </div>
          <div className="flex-1 space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">WhatsApp Number</label>
            <input 
              required
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="e.g. 628123456789"
              className="w-full rounded-xl border border-gray-100 p-4 font-bold text-sm focus:border-primary outline-none transition-all bg-gray-50/50"
            />
          </div>
          <div className="flex gap-2 self-end h-[58px]">
            <button type="submit" className="bg-primary text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-orange-700 transition-all">
              {editingGuide ? 'Update' : 'Add'} Driver/Guide
            </button>
            {editingGuide && (
              <button 
                type="button" 
                onClick={() => {
                  setEditingGuide(null);
                  setName('');
                  setWhatsapp('');
                }} 
                className="bg-gray-100 text-gray-500 px-6 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guides.map(guide => (
            <div key={guide.id} className="bg-white p-6 rounded-[20px] border border-gray-100 shadow-sm hover:border-primary/50 transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-orange-50 flex items-center justify-center text-primary font-black border border-orange-100">
                    {guide.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-black text-gray-900">{guide.name}</h4>
                    <a 
                      href={`https://wa.me/${guide.whatsapp}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-xs font-bold text-primary hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <Phone className="h-3 w-3" /> +{guide.whatsapp}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <button 
                      onClick={() => {
                        setEditingGuide(guide);
                        setName(guide.name);
                        setWhatsapp(guide.whatsapp);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="p-2 text-primary hover:bg-orange-50 rounded-lg transition-all"
                      title="Edit"
                   >
                      <Icons.Edit2 className="h-4 w-4" />
                   </button>
                   <button 
                      onClick={() => toggleActive(guide)}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        guide.isActive ? "text-primary bg-orange-50 border border-orange-100" : "text-gray-400 bg-gray-50 border border-gray-100"
                      )}
                      title={guide.isActive ? "Active" : "Inactive"}
                   >
                      <CheckCheck className="h-4 w-4" />
                   </button>
                   <button onClick={() => handleDelete(guide.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="h-4 w-4" />
                   </button>
                </div>
              </div>
            </div>
          ))}
          {guides.length === 0 && (
            <div className="col-span-full p-20 text-center bg-gray-50/50 rounded-[20px] border border-gray-100 border-dashed">
               <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">No guides or drivers registered yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const LiveInventoryManager = () => {
    const [selectedTourId, setSelectedTourId] = useState<string>('all');
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isBulkOpen, setIsBulkOpen] = useState(false);
    const [editingCapacityId, setEditingCapacityId] = useState<string | null>(null);
    const [tempCapacity, setTempCapacity] = useState<number>(0);

    useEffect(() => {
      let q = query(collection(db, "inventory"));
      if (selectedTourId !== 'all') {
        q = query(collection(db, "inventory"), where("tourId", "==", selectedTourId));
      }
      
      const unsub = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setInventoryItems(items);
      });
      return () => unsub();
    }, [selectedTourId]);

    const filteredInventory = useMemo(() => {
      // Map existing records by tourId + timeSlot
      const inventoryMap = new Map();
      inventoryItems.forEach(item => {
        if (item.date === selectedDate) {
          inventoryMap.set(`${item.tourId}_${item.timeSlot}`, item);
        }
      });

      // Show all tours or selected tour
      const toursToShow = selectedTourId === 'all' ? tours : tours.filter(t => t.id === selectedTourId);
      
      const dayRecords: any[] = [];
      toursToShow.forEach(tour => {
        const slots = tour.timeSlots?.length ? tour.timeSlots : ['daily'];
        slots.forEach(slot => {
          const existing = inventoryMap.get(`${tour.id}_${slot}`);
          if (existing) {
            dayRecords.push(existing);
          } else if (tour.maxCapacity || tour.slotCapacity) {
             dayRecords.push({
               id: `temp_${tour.id}_${slot}`,
               tourId: tour.id,
               date: selectedDate,
               timeSlot: slot,
               bookedCount: 0,
               maxCapacity: (tour.slotCapacity && slot !== 'daily') ? tour.slotCapacity : (tour.maxCapacity || 999),
               isPlaceholder: true
             });
          }
        });
      });

      return dayRecords;
    }, [inventoryItems, selectedDate, selectedTourId, tours]);

    const handleUpdateCapacity = async (item: any) => {
      if (tempCapacity < item.bookedCount) {
        alert("Capacity cannot be less than already booked spots.");
        return;
      }
      
      setLoading(true);
      try {
        const invId = item.isPlaceholder ? `${item.tourId}_${item.date}_${item.timeSlot}` : item.id;
        const invRef = doc(db, 'inventory', invId);
        
        if (item.isPlaceholder) {
          await setDoc(invRef, {
            tourId: item.tourId,
            date: item.date,
            timeSlot: item.timeSlot,
            bookedCount: 0,
            maxCapacity: tempCapacity,
            updatedAt: serverTimestamp()
          });
        } else {
          await updateDoc(invRef, {
            maxCapacity: tempCapacity,
            updatedAt: serverTimestamp()
          });
        }
        setEditingCapacityId(null);
      } catch (err) {
        console.error(err);
        alert("Failed to update capacity.");
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="space-y-8 font-sans">
        <div className="bg-white rounded-[10px] p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-3xl font-black text-gray-900 tracking-tighter uppercase">
                Live <span className="text-primary tracking-normal">Inventory</span>
              </h2>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                <p className="text-sm text-gray-500 font-medium tracking-tight">Real-time occupancy tracking for {selectedDate}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4">
              <button 
                onClick={() => setIsBulkOpen(true)}
                className="px-6 py-3 bg-primary text-white rounded-[10px] text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-100 flex items-center gap-2"
              >
                <PlusCircle className="h-4 w-4" /> Bulk Setup
              </button>
              <button 
                onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                className="px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-[10px] text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Today
              </button>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Filter by Tour</label>
                <select 
                  value={selectedTourId}
                  onChange={(e) => setSelectedTourId(e.target.value)}
                  className="w-full md:w-64 bg-gray-50 border border-gray-100 rounded-[10px] px-4 py-3 text-xs font-bold focus:border-primary focus:bg-white outline-none transition-all appearance-none"
                >
                  <option value="all">All Tours</option>
                  {tours.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">View Date</label>
                <input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-gray-50 border border-gray-100 rounded-[10px] px-4 py-3 text-xs font-bold focus:border-primary focus:bg-white outline-none transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredInventory.map((item) => {
            const tour = tours.find(t => t.id === item.tourId);
            const remaining = Math.max(0, item.maxCapacity - item.bookedCount);
            const percentage = Math.min(100, Math.round((item.bookedCount / item.maxCapacity) * 100));
            
            return (
              <div key={item.id} className={cn(
                "bg-white rounded-[15px] border p-6 shadow-sm hover:shadow-md transition-all group",
                item.isPlaceholder ? "border-gray-50 opacity-80" : "border-orange-100"
              )}>
                <div className="flex justify-between items-start mb-4">
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform",
                    item.isPlaceholder ? "bg-gray-50 text-gray-400" : "bg-orange-50 text-primary"
                  )}>
                    <Icons.Database className="h-5 w-5" />
                  </div>
                  <div className={cn(
                    "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest",
                    remaining === 0 ? "bg-red-50 text-red-600 border border-red-100" :
                    remaining <= 5 ? "bg-orange-50 text-orange-600 border border-orange-100" :
                    "bg-orange-50 text-primary border border-orange-100"
                  )}>
                    {remaining === 0 ? 'Sold Out' : `${remaining} Spots Left`}
                  </div>
                </div>

                <h3 className="font-black text-gray-900 leading-tight mb-1 line-clamp-1">{tour?.title || 'Unknown Tour'}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{item.date}</span>
                  <div className="h-1 w-1 rounded-full bg-gray-200" />
                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">{item.timeSlot}</span>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold text-gray-500">
                    <span>{item.isPlaceholder ? 'Available' : 'Occupancy'}</span>
                    {editingCapacityId === item.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          autoFocus
                          value={tempCapacity}
                          onChange={(e) => setTempCapacity(parseInt(e.target.value) || 0)}
                          className="w-16 bg-gray-50 border border-orange-500 rounded px-1 py-0.5 text-center text-xs font-bold outline-none"
                        />
                        <button onClick={() => handleUpdateCapacity(item)} disabled={loading} className="text-orange-500 p-0.5 hover:bg-orange-50 rounded">
                          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        </button>
                        <button onClick={() => setEditingCapacityId(null)} className="text-red-400 p-0.5 hover:bg-red-50 rounded">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div 
                        onClick={() => {
                          setTempCapacity(item.maxCapacity);
                          setEditingCapacityId(item.id);
                        }}
                        className="text-gray-900 cursor-pointer hover:bg-gray-50 px-1 rounded transition-colors"
                        title="Click to edit capacity"
                      >
                        {item.bookedCount} / {item.maxCapacity}
                      </div>
                    )}
                  </div>
                  <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                    <div 
                      className={cn(
                        "h-full transition-all duration-1000",
                        percentage > 90 ? "bg-red-500" : percentage > 70 ? "bg-orange-500" : "bg-primary"
                      )} 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                   {item.isPlaceholder ? (
                     <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1">
                       <Icons.CheckCircle2 className="h-3 w-3" /> Fully Available
                     </div>
                   ) : (
                     <button 
                       onClick={() => {
                          if (confirm(`Reset inventory for ${tour?.title} on ${item.date}?`)) {
                             updateDoc(doc(db, "inventory", item.id), { bookedCount: 0 });
                          }
                       }}
                       className="text-[9px] font-black text-red-400 uppercase tracking-widest hover:text-red-600 transition-colors"
                     >
                       Reset Count
                     </button>
                   )}
                   <div className="text-[9px] font-black text-gray-200 uppercase tracking-widest">
                     ID: {tour?.id?.substring(0, 4)}
                   </div>
                </div>
              </div>
            );
          })}
          
          {filteredInventory.length === 0 && (
            <div className="col-span-full bg-white p-20 rounded-[15px] border border-dashed border-gray-200 text-center">
              <Icons.Database className="h-10 w-10 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">No tours found with capacity limits.</p>
              <p className="text-[10px] text-gray-400 mt-1 italic">Set a Daily Capacity in the Pricing tab of a tour to track inventory.</p>
            </div>
          )}
        </div>

        <BulkAvailabilityModal 
          isOpen={isBulkOpen}
          onClose={() => setIsBulkOpen(false)}
          tours={tours}
        />
      </div>
    );

  };

  const BookingManager = ({ initialView }: { initialView?: 'list' | 'daily' | 'calendar' }) => {
    if (Date.now() < 0) console.log(OldBookingManagerReserved);
    return (
      <BookingManagementPanel
        setGlobalSelectedBooking={setGlobalSelectedBooking}
        setOriginalBooking={setOriginalBooking}
        setIsBookingDetailOpen={setIsBookingDetailOpen}
        setAssignBooking={setAssignBooking}
        setIsAssignOpen={setIsAssignOpen}
        handlePrintManifest={handlePrintManifest}
        updateBookingStatus={updateBookingStatus}
        handleDeleteBooking={handleDeleteBooking}
        allGuides={allGuides}
        currentUserProfile={currentUserProfile}
        bookings={bookings}
        initialView={initialView}
        tours={tours}
      />
    );
  };

  const OldBookingManagerReserved = ({ initialView }: { initialView?: 'list' | 'daily' | 'calendar' }) => {
    const [viewMode, setViewMode] = useState<'list' | 'daily' | 'calendar'>(initialView || 'list');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterScheduled, setFilterScheduled] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
      if (initialView) {
        setViewMode(initialView);
      }
    }, [initialView]);

    // Daily dispatch view states
    const [selectedDailyDate, setSelectedDailyDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
    const [dispatchFilter, setDispatchFilter] = useState<string>('all');

    // Calendar view states
    const [viewDate, setViewDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());

    const guides = allGuides;

    const daysAroundSelected = useMemo(() => {
      try {
        const pivotStr = selectedDailyDate || format(new Date(), 'yyyy-MM-dd');
        const pivotDate = parseISO(pivotStr);
        return Array.from({ length: 7 }).map((_, i) => {
          const d = addDays(pivotDate, i - 3);
          const dateStr = format(d, 'yyyy-MM-dd');
          const dayName = format(d, 'EEE');
          const dayNum = format(d, 'd');
          
          const count = bookings
            .filter(b => b.date === dateStr)
            .filter(b => {
              if (currentUserProfile?.role === 'supplier') {
                return b.supplierId === currentUserProfile.uid;
              }
              return true;
            })
            .filter(b => b.status !== 'cancelled').length;
          
          return {
            dateStr,
            dayName,
            dayNum,
            count,
            isCurrent: dateStr === selectedDailyDate,
            isToday: dateStr === format(new Date(), 'yyyy-MM-dd')
          };
        });
      } catch (e) {
        return [];
      }
    }, [selectedDailyDate, bookings, currentUserProfile]);

    const dailyStats = useMemo(() => {
      const activeForDay = bookings
        .filter(b => b.date === selectedDailyDate)
        .filter(b => {
          if (currentUserProfile?.role === 'supplier') {
            return b.supplierId === currentUserProfile.uid;
          }
          return true;
        });
      const total = activeForDay.length;
      const cancelledCount = activeForDay.filter(b => b.status === 'cancelled').length;
      const activeCount = total - cancelledCount;
      
      const totalPax = activeForDay
        .filter(b => b.status !== 'cancelled')
        .reduce((sum, b) => sum + ((b.participants?.adults || 0) + (b.participants?.children || 0)), 0);
        
      const assigned = activeForDay
        .filter(b => b.status !== 'cancelled' && b.assignedGuideId)
        .length;
        
      const unassigned = activeCount - assigned;
      
      return {
        total,
        totalPax,
        assigned,
        activeCount,
        unassigned,
        cancelledCount
      };
    }, [bookings, selectedDailyDate, currentUserProfile]);

    const filteredBookingsForSelectedDay = useMemo(() => {
      const dayBookings = bookings
        .filter(b => b.date === selectedDailyDate)
        .filter(b => {
          if (currentUserProfile?.role === 'supplier') {
            return b.supplierId === currentUserProfile.uid;
          }
          return true;
        });
      
      return dayBookings.filter(b => {
        if (dispatchFilter === 'all') return true;
        if (dispatchFilter === 'unassigned') return b.status !== 'cancelled' && !b.assignedGuideId;
        if (dispatchFilter === 'assigned') return b.status !== 'cancelled' && b.assignedGuideId;
        if (dispatchFilter === 'cancelled') return b.status === 'cancelled';
        return true;
      });
    }, [bookings, selectedDailyDate, dispatchFilter, currentUserProfile]);

    // Calendar Calculations
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate,
    });

    const getBookingsForDay = (day: Date) => {
      const dayStr = format(day, 'yyyy-MM-dd');
      return bookings
        .filter(b => b.date === dayStr)
        .filter(b => {
          if (currentUserProfile?.role === 'supplier') {
            return b.supplierId === currentUserProfile.uid;
          }
          return true;
        })
        .filter(b => filterStatus === 'all' || b.status === filterStatus)
        .filter(b => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return (
            b.id.toLowerCase().includes(q) || 
            b.customerData.fullName.toLowerCase().includes(q) || 
            b.customerData.email.toLowerCase().includes(q) ||
            (b.tourTitle || '').toLowerCase().includes(q) ||
            (b.customerData.phone || '').toLowerCase().includes(q)
          );
        });
    };

    const nextMonth = () => setViewDate(addMonths(viewDate, 1));
    const previousMonth = () => setViewDate(subMonths(viewDate, 1));
    const goToToday = () => {
      setViewDate(new Date());
      setSelectedDate(new Date());
    };

    const selectedDayBookings = getBookingsForDay(selectedDate);
    const totalGuests = selectedDayBookings.reduce((sum, b) => sum + ((b.participants?.adults || 0) + (b.participants?.children || 0)), 0);
    const totalRevenue = selectedDayBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    const filteredBookings = useMemo(() => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

      return bookings
        .filter(b => {
          if (currentUserProfile?.role === 'supplier') {
            return b.supplierId === currentUserProfile.uid;
          }
          return true;
        })
        .filter(b => filterStatus === 'all' || b.status === filterStatus)
        .filter(b => {
          if (filterScheduled === 'all') return true;
          if (filterScheduled === 'today') return b.date === todayStr;
          if (filterScheduled === 'tomorrow') return b.date === tomorrowStr;
          if (filterScheduled === 'other') return b.date !== todayStr && b.date !== tomorrowStr;
          return true;
        })
        .filter(b => {
          if (!searchQuery.trim()) return true;
          const q = searchQuery.toLowerCase();
          return (
            b.id.toLowerCase().includes(q) || 
            b.customerData.fullName.toLowerCase().includes(q) || 
            b.customerData.email.toLowerCase().includes(q) ||
            (b.tourTitle || '').toLowerCase().includes(q) ||
            (b.customerData.phone || '').toLowerCase().includes(q)
          );
        })
        .sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateB.getTime() - dateA.getTime(); // newest first
        });
    }, [bookings, filterStatus, filterScheduled, searchQuery, currentUserProfile]);

    const handleQuickStatusChange = async (booking: Booking, newStatus: any) => {
      try {
        const newLog: BookingLog = {
          timestamp: new Date().toISOString(),
          message: `Booking Status updated to: ${newStatus.toUpperCase()}`,
          type: 'status_change',
          userName: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin'
        };

        await updateDoc(doc(db, 'bookings', booking.id), {
          status: newStatus,
          updatedAt: serverTimestamp(),
          logs: [...(booking.logs || []), newLog]
        });
        alert(`Status updated to ${newStatus.toUpperCase()}`);
      } catch (err) {
        console.error(err);
        alert("Failed to change status.");
      }
    };

    // Calculate quick stats
    const stats = useMemo(() => {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const active = bookings.filter(b => {
        if (currentUserProfile?.role === 'supplier') {
          return b.supplierId === currentUserProfile.uid;
        }
        return true;
      });
      const todayBookings = active.filter(b => b.date === todayStr && b.status !== 'cancelled').length;
      const totalAmount = active.filter(b => b.status === 'confirmed' || b.status === 'completed')
                                .reduce((acc, current) => acc + (current.totalAmount || 0), 0);
      return {
        total: active.length,
        pending: active.filter(b => b.status === 'pending').length,
        today: todayBookings,
        revenue: totalAmount
      };
    }, [bookings, currentUserProfile]);


  
    return (
      <div className="space-y-6 text-gray-850 font-sans">
        
        {/* Simple Top KPI Stat Badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Bookings</p>
            <p className="text-xl font-black text-gray-900 mt-1">{stats.total}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Pending Bookings</p>
            <p className="text-xl font-black text-amber-600 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Active Trips Today</p>
            <p className="text-xl font-black text-primary mt-1">{stats.today}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Settled Revenue</p>
            <p className="text-xl font-black text-primary mt-1">{formatPrice(stats.revenue)}</p>
          </div>
        </div>

        {/* Simplified Header and Filters panel */}
        <div className="bg-white rounded-[12px] p-6 border border-gray-100 shadow-xs space-y-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 pb-2">
            <div className="space-y-1">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                Booking Management
              </h2>
              <p className="text-xs text-gray-400 font-medium">Simple workspace to manage guest lists, assign guides, and track status.</p>
            </div>

            <div className="flex items-center gap-1 bg-gray-55 p-1 rounded-lg border border-gray-100 self-start xl:self-auto">
              <button 
                onClick={() => setViewMode('list')}
                className={cn(
                  "px-3.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer",
                  viewMode === 'list' 
                    ? "bg-white text-primary shadow-xs border border-gray-200" 
                    : "text-gray-400 hover:text-gray-655"
                )}
              >
                <Icons.List className="h-3.5 w-3.5" />
                List View
              </button>
              <button 
                onClick={() => setViewMode('daily')}
                className={cn(
                  "px-3.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer",
                  viewMode === 'daily' 
                    ? "bg-white text-primary shadow-xs border border-gray-200" 
                    : "text-gray-400 hover:text-gray-655"
                )}
              >
                <Icons.Clock4 className="h-3.5 w-3.5" />
                Daily/Dispatch
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={cn(
                  "px-3.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer",
                  viewMode === 'calendar' 
                    ? "bg-white text-primary shadow-xs border border-gray-200" 
                    : "text-gray-400 hover:text-gray-655"
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Calendar View
              </button>
            </div>
            
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search guests, email, or tour..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-10 py-2.5 bg-gray-55 border border-transparent rounded-[8px] text-xs font-bold focus:border-primary focus:bg-white focus:ring-0 outline-none transition-all shadow-inner"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors"
                  >
                    <Icons.X className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-gray-105">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block font-sans">By Status:</span>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider outline-none text-gray-700 font-sans"
              >
                <option value="all">All Statuses</option>
                <option value="pending">🟡 Pending</option>
                <option value="review_required">🟣 Review Required</option>
                <option value="confirmed">🟢 Confirmed</option>
                <option value="completed">💙 Completed</option>
                <option value="cancelled">🔴 Cancelled</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block font-sans">Scheduled:</span>
              <select
                value={filterScheduled}
                onChange={e => setFilterScheduled(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-wider outline-none text-gray-700 font-sans"
              >
                <option value="all">All Scheduled</option>
                <option value="today">Today</option>
                <option value="tomorrow">Tomorrow</option>
                <option value="other">Other Day</option>
              </select>
            </div>

            <div className="ml-auto text-xs font-bold text-gray-400 uppercase tracking-widest font-sans">
              Showing {filteredBookings.length} bookings
            </div>
          </div>
        </div>
  
        {/* Transparent global backdrop to close any active row dropdown overlay */}
        {openMenuId && (
          <div 
            className="fixed inset-0 z-40 bg-transparent" 
            onClick={(e) => {
              e.stopPropagation();
              setOpenMenuId(null);
            }} 
          />
        )}

        {viewMode === 'list' && (
          <>
            <div className="hidden lg:block bg-white rounded-[12px] border border-gray-100 shadow-sm overflow-hidden min-h-[300px]">
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full text-left font-sans border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[140px]">ID / Date Info</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[160px]">Customer</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[200px]">Tour & Package</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[100px]">Financials</th>
                  {currentUserProfile?.role === 'admin' && (
                    <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[120px]">Supplier</th>
                  )}
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[100px]">Source</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-[120px]">Status</th>
                  <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center min-w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredBookings.map((booking, idx) => {
                  const isLastRows = idx >= filteredBookings.length - 2 && filteredBookings.length > 2;
                  return (
                    <tr 
                      key={booking.id} 
                      className="hover:bg-gray-50/60 transition-colors cursor-pointer group" 
                      onClick={() => { 
                        setGlobalSelectedBooking(booking); 
                        setOriginalBooking(booking); 
                        setIsBookingDetailOpen(true); 
                      }}
                    >
                      <td className="px-5 py-5 border-r border-gray-50">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono text-[10px] font-black text-primary tracking-tighter uppercase leading-none">#{booking.id.slice(-8)}</span>
                          <span className="text-xs font-black text-gray-900 uppercase tracking-tight">{booking.date}</span>
                          {booking.time && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Icons.Clock className="h-3.5 w-3.5 text-gray-300" />
                              <span className="text-[10px] text-gray-400 font-bold">{booking.time}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-5 border-r border-gray-50">
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-gray-900 group-hover:text-primary transition-colors leading-tight">{booking.customerData.fullName}</span>
                          <span className="text-[10px] text-gray-400 font-bold tracking-tight mt-0.5">{booking.customerData.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-5 border-r border-gray-50">
                        <div className="max-w-[220px]">
                          <span className="text-xs font-black text-gray-900 block truncate leading-tight mb-1">{booking.tourTitle}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold text-primary uppercase tracking-wider">{booking.packageName}</span>
                          </div>
                          {booking.assignedGuideName && (
                            <div className="mt-1 flex items-center gap-1 bg-blue-50 border border-blue-100 rounded-md py-0.5 px-1.5 w-fit">
                              <Icons.User className="h-2.5 w-2.5 text-blue-500" />
                              <span className="text-[8px] font-black text-blue-600 uppercase tracking-wide">
                                {booking.assignedGuideName}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-5 border-r border-gray-50">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-gray-900 leading-none mb-1">{formatPrice(booking.totalAmount)}</span>
                          <span className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{(booking.paymentMethod || 'manual').replace('_', ' ')}</span>
                        </div>
                      </td>
                      {currentUserProfile?.role === 'admin' && (
                        <td className="px-5 py-5 border-r border-gray-50">
                          <div className="flex flex-col">
                            <span className="text-xs font-black text-blue-600 truncate max-w-[120px]">{booking.supplierName || 'System'}</span>
                            <span className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Vendor</span>
                          </div>
                        </td>
                      )}
                      <td className="px-5 py-5 border-r border-gray-50">
                        <div className="flex flex-col">
                          <span className={cn(
                            "text-[8px] font-black uppercase px-2 py-0.5 rounded-md w-fit mb-0.5 border tracking-[0.05em]",
                            booking.bookingSource === 'Klook' ? "bg-orange-50 text-orange-600 border-orange-100" :
                            booking.bookingSource === 'Viator' ? "bg-yellow-50 text-yellow-600 border-yellow-100" :
                            booking.bookingSource === 'GetYourGuide' ? "bg-red-50 text-red-600 border-red-100" :
                            booking.bookingSource === 'Manual' ? "bg-purple-50 text-purple-600 border-purple-100" :
                            booking.bookedBy?.role === 'agent' ? "bg-blue-50 text-blue-600 border-blue-100" :
                            "bg-orange-50 text-primary border-orange-100"
                          )}>
                            {booking.bookingSource || (booking.bookedBy ? booking.bookedBy.role : 'Direct')}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-5 border-r border-gray-50">
                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-[0.05em]",
                          booking.status === 'completed' ? "bg-blue-50 text-blue-700 border border-blue-100" :
                          booking.status === 'confirmed' ? "bg-orange-50 text-orange-700 border border-orange-100" :
                          booking.status === 'cancelled' ? "bg-red-50 text-red-700 border-red-100" :
                          booking.status === 'review_required' ? "bg-blue-50 text-blue-700 border border-blue-100 animate-pulse" :
                          "bg-amber-50 text-amber-700 border-amber-100"
                        )}>
                          <div className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            booking.status === 'completed' ? "bg-blue-500" :
                            booking.status === 'confirmed' ? "bg-orange-500" :
                            booking.status === 'cancelled' ? "bg-red-500" :
                            booking.status === 'review_required' ? "bg-blue-500" :
                            "bg-amber-500"
                          )} />
                          {booking.status.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="px-5 py-5 text-center">
                        <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {/* Primary, clean details callout */}
                            <button
                              onClick={() => {
                                setGlobalSelectedBooking(booking);
                                setOriginalBooking(booking);
                                setIsBookingDetailOpen(true);
                              }}
                              className="px-2.5 py-1.5 hover:bg-gray-100 text-gray-700 hover:text-black border border-gray-200 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                              title="Full Details"
                            >
                              Open
                            </button>
                            
                            {/* Interactive, premium actions dropdown menu */}
                            <button
                              onClick={() => setOpenMenuId(openMenuId === booking.id ? null : booking.id)}
                              className={cn(
                                "p-1.5 rounded-lg border transition-all text-gray-500 hover:text-black",
                                openMenuId === booking.id ? "bg-gray-100 border-gray-300" : "bg-white border-gray-200 hover:bg-gray-50"
                              )}
                              title="All Contextual Actions"
                            >
                              <Icons.MoreHorizontal className="h-4 w-4" />
                            </button>
                          </div>

                          {openMenuId === booking.id && (
                            <div className={cn(
                              "absolute right-0 w-60 rounded-xl bg-white border border-gray-200 shadow-2xl z-50 overflow-visible py-1 text-left animate-in fade-in slide-in-from-top-1 duration-150",
                              isLastRows ? "bottom-full mb-2" : "top-full mt-2"
                            )}>
                              <div className="px-3.5 py-2 text-[8px] font-black text-gray-400 uppercase border-b border-gray-50 tracking-widest flex justify-between items-center bg-gray-50">
                                <span>Ref: #{booking.id.slice(-6).toUpperCase()}</span>
                                <span className="font-bold text-primary">{booking.date}</span>
                              </div>

                              <button
                                onClick={() => {
                                  setGlobalSelectedBooking(booking);
                                  setOriginalBooking(booking);
                                  setIsBookingDetailOpen(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-black flex items-center gap-2.5 font-bold transition-colors"
                              >
                                <Icons.ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                                Edit Booking Details
                              </button>

                              <button
                                onClick={() => {
                                  handlePrintManifest(booking);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-black flex items-center gap-2.5 font-bold transition-colors"
                              >
                                <Icons.Printer className="h-3.5 w-3.5 text-gray-400" />
                                Print Manifest Sheet
                              </button>

                              <button
                                disabled={loadingStates.sendingWA}
                                onClick={async () => {
                                  setOpenMenuId(null);
                                  const template = commSettings?.whatsappTemplates?.booking_confirmation?.message || 
                                    "Hello {{customerName}}, your booking for {{tourTitle}} on {{date}} is confirmed.";
                                  const message = generateBookingMessage(template, booking);
                                  try {
                                    await sendCustomWhatsApp(booking.customerData.phone || '', message);
                                    alert("Message sent successfully via Whapi!");
                                  } catch (err) {
                                    console.error('[WhatsApp] API Error:', err);
                                    const link = getWhatsAppLink(booking.customerData.phone || '', message);
                                    window.open(link, '_blank');
                                  }
                                }}
                                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-black flex items-center gap-2.5 font-bold transition-colors disabled:opacity-50"
                              >
                                <Icons.MessageSquare className="h-3.5 w-3.5 text-orange-500" />
                                Send Guest WhatsApp
                              </button>

                              <button
                                onClick={() => {
                                  setAssignBooking(booking);
                                  setIsAssignOpen(true);
                                  setOpenMenuId(null);
                                }}
                                className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-black flex items-center gap-2.5 font-bold transition-colors"
                              >
                                <Icons.Share2 className="h-3.5 w-3.5 text-blue-500" />
                                Assign Guide
                              </button>

                              {(booking.status === 'confirmed' || currentUserProfile?.role === 'admin') && (
                                <div className="border-t border-gray-100 my-1" />
                              )}

                              {booking.status === 'confirmed' && (
                                <button
                                  disabled={loadingStates.statusUpdating}
                                  onClick={async () => {
                                    setOpenMenuId(null);
                                    await updateBookingStatus(booking.id, 'completed');
                                  }}
                                  className="w-full px-4 py-1.5 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-2.5 font-bold transition-colors disabled:opacity-50"
                                >
                                  {loadingStates.statusUpdating ? <Icons.Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icons.CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />}
                                  Mark as Completed
                                </button>
                              )}

                              {currentUserProfile?.role === 'admin' && (
                                <>
                                  {booking.status !== 'confirmed' && booking.status !== 'completed' && (
                                    <button 
                                      onClick={async () => {
                                        setOpenMenuId(null);
                                        await updateBookingStatus(booking.id, 'confirmed');
                                      }} 
                                      className="w-full px-4 py-2 text-xs text-primary hover:bg-orange-50 flex items-center gap-2.5 font-bold transition-colors"
                                    >
                                      <Icons.CheckCircle className="h-3.5 w-3.5 text-orange-500" />
                                      Confirm Payment
                                    </button>
                                  )}
                                  
                                  {booking.status !== 'cancelled' && (
                                    <button 
                                      onClick={async () => {
                                        setOpenMenuId(null);
                                        await updateBookingStatus(booking.id, 'cancelled');
                                      }} 
                                      className="w-full px-4 py-2 text-xs text-red-650 hover:bg-red-55 flex items-center gap-2.5 font-bold transition-colors"
                                    >
                                      <Icons.XCircle className="h-3.5 w-3.5 text-red-500" />
                                      Cancel Booking
                                    </button>
                                  )}

                                  <button 
                                    onClick={async () => {
                                      setOpenMenuId(null);
                                      if (confirm("Permanently delete this booking record? This structural mutation cannot be undone.")) {
                                        await handleDeleteBooking(booking.id);
                                      }
                                    }} 
                                    className="w-full px-4 py-2 text-xs text-red-705 hover:bg-red-55 flex items-center gap-2.5 font-black transition-colors pt-2 border-t border-gray-100"
                                  >
                                    <Icons.Trash2 className="h-3.5 w-3.5 text-red-600" />
                                    Delete Permanently
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredBookings.length === 0 && (
              <div className="p-20 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">
                No bookings found matching current options.
              </div>
            )}
          </div>
        </div>

        {/* Mobile Interface (md and down) - Beautiful Card Layout */}
        <div className="block lg:hidden space-y-4">
          {filteredBookings.map((booking) => (
            <div 
              key={booking.id}
              className="bg-white rounded-xl border border-gray-200 shadow-xs p-5 space-y-4 relative hover:border-primary transition-all cursor-pointer"
              onClick={() => { 
                setGlobalSelectedBooking(booking); 
                setOriginalBooking(booking); 
                setIsBookingDetailOpen(true); 
              }}
            >
              {/* Mobile Card Header */}
              <div className="flex items-center justify-between border-b border-gray-50 pb-3 mt-0.5">
                <div className="flex flex-col">
                  <span className="font-mono text-xs font-black text-primary tracking-tight leading-none uppercase">#{booking.id.slice(-8)}</span>
                  <span className="text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
                    Source: <span className="text-gray-600 font-black">{booking.bookingSource || 'Direct'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className={cn(
                    "px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-[0.05em] border-gray-200 border",
                    booking.status === 'completed' ? "bg-blue-50 text-blue-700" :
                    booking.status === 'confirmed' ? "bg-orange-50 text-orange-700" :
                    booking.status === 'cancelled' ? "bg-red-50 text-red-700" :
                    booking.status === 'review_required' ? "bg-blue-50 text-blue-700 animate-pulse" :
                    "bg-amber-50 text-amber-700"
                  )}>
                    {booking.status.replace('_', ' ')}
                  </span>
                  
                  {/* Dropdown triggers for mobile card actions */}
                  <div className="relative">
                    <button 
                      onClick={() => setOpenMenuId(openMenuId === booking.id ? null : booking.id)}
                      className={cn(
                        "p-1.5 rounded-lg border transition-all text-gray-500 hover:text-black",
                        openMenuId === booking.id ? "bg-gray-100 border-gray-300" : "bg-white border-gray-200"
                      )}
                    >
                      <Icons.MoreVertical className="h-4 w-4" />
                    </button>
                    
                    {openMenuId === booking.id && (
                      <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-gray-200 shadow-xl z-50 overflow-hidden py-1 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                        <button
                          onClick={() => {
                            setGlobalSelectedBooking(booking);
                            setOriginalBooking(booking);
                            setIsBookingDetailOpen(true);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-bold transition-colors"
                        >
                          <Icons.ExternalLink className="h-3.5 w-3.5 text-gray-400" />
                          View / Edit Details
                        </button>

                        <button
                          onClick={() => {
                            handlePrintManifest(booking);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-bold transition-colors"
                        >
                          <Icons.Printer className="h-3.5 w-3.5 text-gray-400" />
                          Print Manifest Sheet
                        </button>

                        <button
                          disabled={loadingStates.sendingWA}
                          onClick={async () => {
                            setOpenMenuId(null);
                            const template = commSettings?.whatsappTemplates?.booking_confirmation?.message || 
                              "Hello {{customerName}}, your booking for {{tourTitle}} on {{date}} is confirmed.";
                            const message = generateBookingMessage(template, booking);
                            try {
                              await sendCustomWhatsApp(booking.customerData.phone || '', message);
                              alert("Message sent successfully!");
                            } catch (err) {
                              const link = getWhatsAppLink(booking.customerData.phone || '', message);
                              window.open(link, '_blank');
                            }
                          }}
                          className="w-full px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-bold transition-colors"
                        >
                          <Icons.MessageSquare className="h-3.5 w-3.5 text-orange-500" />
                          WhatsApp Customer
                        </button>

                        <button
                          onClick={() => {
                            setAssignBooking(booking);
                            setIsAssignOpen(true);
                            setOpenMenuId(null);
                          }}
                          className="w-full px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-bold transition-colors"
                        >
                          <Icons.Share2 className="h-3.5 w-3.5 text-blue-500" />
                          Assign Guide
                        </button>

                        {(booking.status === 'confirmed' || currentUserProfile?.role === 'admin') && (
                          <div className="border-t border-gray-100 my-1" />
                        )}

                        {booking.status === 'confirmed' && (
                          <button
                            onClick={async () => {
                              setOpenMenuId(null);
                              await updateBookingStatus(booking.id, 'completed');
                            }}
                            className="w-full px-4 py-2.5 text-xs text-blue-600 hover:bg-blue-50 flex items-center gap-2.5 font-bold transition-colors"
                          >
                            <Icons.CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                            Mark as Completed
                          </button>
                        )}

                        {currentUserProfile?.role === 'admin' && (
                          <>
                            {booking.status !== 'confirmed' && booking.status !== 'completed' && (
                              <button 
                                onClick={async () => {
                                  setOpenMenuId(null);
                                  await updateBookingStatus(booking.id, 'confirmed');
                                }} 
                                className="w-full px-4 py-2.5 text-xs text-primary hover:bg-orange-50 flex items-center gap-2.5 font-bold transition-colors"
                              >
                                <Icons.CheckCircle className="h-3.5 w-3.5 text-orange-500" />
                                Confirm Payment
                              </button>
                            )}
                            
                            {booking.status !== 'cancelled' && (
                              <button 
                                onClick={async () => {
                                  setOpenMenuId(null);
                                  await updateBookingStatus(booking.id, 'cancelled');
                                }} 
                                className="w-full px-4 py-2.5 text-xs text-red-650 hover:bg-red-50 flex items-center gap-2.5 font-bold transition-colors"
                              >
                                <Icons.XCircle className="h-3.5 w-3.5 text-red-500" />
                                Cancel Booking
                              </button>
                            )}

                            <button 
                              onClick={async () => {
                                setOpenMenuId(null);
                                if (confirm("Permanently delete this booking record?")) {
                                  await handleDeleteBooking(booking.id);
                                }
                              }} 
                              className="w-full px-4 py-2.5 text-xs text-red-700 hover:bg-red-55 flex items-center gap-2.5 font-black transition-colors pt-2 border-t border-gray-100"
                            >
                              <Icons.Trash2 className="h-3.5 w-3.5 text-red-600" />
                              Delete Permanently
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Mobile Card Body details */}
              <div className="grid grid-cols-2 gap-3 pb-1 text-left font-sans">
                <div className="col-span-2">
                  <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Tour & Package</h5>
                  <p className="text-xs font-black text-gray-900 mt-0.5 leading-tight">{booking.tourTitle}</p>
                  <p className="text-[10px] font-bold text-primary uppercase mt-0.5">{booking.packageName}</p>
                </div>
                
                <div>
                  <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Customer</h5>
                  <p className="text-xs font-black text-gray-900 mt-0.5 leading-tight truncate">{booking.customerData.fullName}</p>
                  <p className="text-[10px] text-gray-400 tracking-tight mt-0.5 truncate">{booking.customerData.email}</p>
                </div>

                <div>
                  <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Travel Date</h5>
                  <p className="text-xs font-black text-gray-900 mt-0.5">{booking.date}</p>
                  {booking.time && (
                    <p className="text-[10px] font-bold text-primary">{booking.time}</p>
                  )}
                </div>

                <div>
                  <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Total Charge</h5>
                  <p className="text-sm font-black text-primary mt-0.5">{formatPrice(booking.totalAmount)}</p>
                </div>

                <div>
                  <h5 className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Payment Method</h5>
                  <p className="text-[10px] font-black text-gray-400 uppercase mt-1">{(booking.paymentMethod || 'manual').replace('_', ' ')}</p>
                </div>

                {booking.assignedGuideName && (
                  <div className="col-span-2 mt-1 bg-gray-50 border border-gray-100 rounded-lg p-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Icons.User className="h-3.5 w-3.5 text-blue-500" />
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-wider">Assigned Guide</p>
                        <p className="text-xs font-black text-blue-600 uppercase leading-none mt-1">{booking.assignedGuideName}</p>
                      </div>
                    </div>
                    {booking.assignedGuideWhatsapp && (
                      <span className="text-[10px] font-bold text-primary bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-md">
                        WA Active
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {filteredBookings.length === 0 && (
            <div className="p-10 text-center text-gray-400 font-bold uppercase text-xs tracking-widest bg-white border border-gray-100 rounded-xl">
              No bookings found for the current options.
            </div>
          )}
        </div>
          </>
        )}

        {viewMode === 'daily' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Real-time Dispatch Date Navigation Console */}
            <div className="bg-white rounded-[12px] p-5 border border-gray-100 shadow-sm space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-50 pb-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-black tracking-widest text-primary uppercase">Active Dispatch Date</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        try {
                          const prev = addDays(parseISO(selectedDailyDate), -1);
                          setSelectedDailyDate(format(prev, 'yyyy-MM-dd'));
                        } catch(e){}
                      }}
                      className="p-1.5 hover:bg-gray-50 border border-gray-100 rounded-lg transition-colors"
                      title="Previous Day"
                    >
                      <Icons.ChevronLeft className="h-4 w-4 text-gray-500" />
                    </button>
                    <h3 className="text-base font-black text-gray-900 tracking-tight select-none">
                      {(() => {
                        try {
                          return format(parseISO(selectedDailyDate), 'EEEE, d MMMM yyyy');
                        } catch (e) {
                          return selectedDailyDate;
                        }
                      })()}
                    </h3>
                    <button 
                      onClick={() => {
                        try {
                          const next = addDays(parseISO(selectedDailyDate), 1);
                          setSelectedDailyDate(format(next, 'yyyy-MM-dd'));
                        } catch(e){}
                      }}
                      className="p-1.5 hover:bg-gray-50 border border-gray-100 rounded-lg transition-colors"
                      title="Next Day"
                    >
                      <Icons.ChevronRight className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto">
                  <div className="relative">
                    <Icons.CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <input 
                      type="date" 
                      value={selectedDailyDate} 
                      onChange={(e) => {
                        if (e.target.value) {
                          setSelectedDailyDate(e.target.value);
                        }
                      }}
                      className="pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs font-black uppercase tracking-wider text-gray-700 bg-white focus:outline-none focus:border-primary cursor-pointer shadow-xs min-w-[130px]"
                    />
                  </div>
                  <button 
                    onClick={() => setSelectedDailyDate(format(new Date(), 'yyyy-MM-dd'))}
                    className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-150 rounded-lg text-[9px] font-black uppercase tracking-wider text-gray-600 transition-colors"
                  >
                    Today
                  </button>
                </div>
              </div>

              {/* Weekly Navigation Strip */}
              <div className="grid grid-cols-7 gap-2">
                {daysAroundSelected.map((day) => (
                  <button
                    key={day.dateStr}
                    onClick={() => setSelectedDailyDate(day.dateStr)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all relative",
                      day.isCurrent
                        ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/20"
                        : "bg-gray-50/50 hover:bg-gray-50 border-gray-100"
                    )}
                  >
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-widest",
                      day.isCurrent ? "text-primary" : "text-gray-400"
                    )}>
                      {day.dayName}
                    </span>
                    <span className={cn(
                      "text-sm font-black mt-0.5",
                      day.isCurrent ? "text-primary" : "text-gray-800"
                    )}>
                      {day.dayNum}
                    </span>
                    {day.count > 0 && (
                      <span className={cn(
                        "absolute -top-1.5 -right-1 text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border",
                        day.isCurrent
                          ? "bg-primary text-white border-white"
                          : "bg-gray-100 text-gray-600 border-gray-200"
                      )}>
                        {day.count}
                      </span>
                    )}
                    {day.isToday && !day.isCurrent && (
                      <span className="absolute bottom-1 w-1 h-1 bg-primary rounded-full" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Daily Dispatch KPI Summary Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
                <div className="p-2.5 bg-gray-50 text-gray-500 rounded-lg">
                  <Icons.Briefcase className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Bookings</h4>
                  <p className="text-lg font-black text-gray-900 leading-none mt-1">{dailyStats.total} Jobs</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
                <div className="p-2.5 bg-blue-50/70 text-blue-600 rounded-lg">
                  <Icons.Users className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Active Guest Load</h4>
                  <p className="text-lg font-black text-gray-900 leading-none mt-1">{dailyStats.totalPax} Pax Total</p>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-xs flex items-center gap-3">
                <div className="p-2.5 bg-orange-50 text-primary rounded-lg">
                  <Icons.CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Guide Dispatched</h4>
                  <p className="text-lg font-black text-gray-900 leading-none mt-1">{dailyStats.assigned} / {dailyStats.activeCount}</p>
                </div>
              </div>

              {/* Safety Dispatch Alert Card */}
              <div className={cn(
                "p-4 rounded-xl border shadow-xs flex items-center gap-3 transition-colors",
                dailyStats.unassigned > 0 
                  ? "bg-amber-50/50 border-amber-200 text-amber-800" 
                  : (dailyStats.activeCount > 0 
                    ? "bg-orange-50/50 border-orange-100 text-orange-800"
                    : "bg-gray-50 border-gray-100 text-gray-500")
              )}>
                <div className={cn(
                  "p-2.5 rounded-lg",
                  dailyStats.unassigned > 0 ? "bg-amber-100 text-amber-700" : "bg-orange-100/80 text-orange-700"
                )}>
                  {dailyStats.unassigned > 0 ? (
                    <Icons.ShieldAlert className="h-5 w-5 animate-pulse" />
                  ) : (
                    <Icons.ShieldCheck className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Dispatch Safety Check</h4>
                  <p className="text-xs font-bold leading-normal mt-0.5">
                    {dailyStats.unassigned > 0 ? (
                      <span className="text-amber-800 tracking-tight font-black">{dailyStats.unassigned} Needs Guide Assignment!</span>
                    ) : (
                      dailyStats.activeCount > 0 ? (
                        <span className="text-orange-700 tracking-tight font-black">All Bookings Fully Dispatched!</span>
                      ) : (
                        <span className="text-gray-500 font-bold">No active tours on this day</span>
                      )
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Audit Dispatch Sub-tabs + Filter Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Bookings', count: dailyStats.total, color: 'text-gray-600 bg-gray-50 border-gray-100' },
                  { id: 'unassigned', label: '⚠️ Unassigned Only', count: dailyStats.unassigned, color: 'text-amber-700 bg-amber-50 border-amber-150', highlight: dailyStats.unassigned > 0 },
                  { id: 'assigned', label: '✅ Scheduled (Assigned)', count: dailyStats.assigned, color: 'text-blue-700 bg-blue-50 border-blue-100' },
                  { id: 'cancelled', label: 'Cancelled Tours', count: dailyStats.cancelledCount, color: 'text-red-700 bg-red-50 border-red-100' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setDispatchFilter(tab.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all",
                      dispatchFilter === tab.id
                        ? "bg-primary text-white border-primary shadow-xs"
                        : "bg-white text-gray-500 border-gray-100 hover:text-gray-700 hover:bg-gray-50"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded-md text-[8px] font-black",
                      dispatchFilter === tab.id 
                        ? "bg-white/20 text-white" 
                        : (tab.highlight ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-600")
                    )}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
              
              <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest pr-2">
                Showing {filteredBookingsForSelectedDay.length} of {dailyStats.total} Bookings
              </div>
            </div>

            {/* Selected Date Listings Grid */}
            {filteredBookingsForSelectedDay.length === 0 ? (
              <div className="p-20 text-center bg-white border border-gray-100 rounded-[12px] flex flex-col items-center justify-center space-y-3">
                <Icons.Briefcase className="h-8 w-8 text-gray-300" />
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                  No bookings matching current dispatch filter on this day.
                </p>
                <button 
                  onClick={() => setDispatchFilter('all')}
                  className="px-3 py-1 bg-gray-50 text-[10px] font-bold text-primary uppercase border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredBookingsForSelectedDay.map((booking) => (
                  <div 
                    key={booking.id}
                    onClick={() => {
                      setGlobalSelectedBooking(booking);
                      setOriginalBooking(booking);
                      setIsBookingDetailOpen(true);
                    }}
                    className={cn(
                      "bg-white rounded-xl border p-5 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer group space-y-4",
                      booking.status === 'cancelled'
                        ? "border-red-100 opacity-75 hover:border-red-300"
                        : (!booking.assignedGuideId 
                          ? "border-amber-200 bg-amber-50/10 hover:border-amber-450" 
                          : "border-gray-100 hover:border-primary")
                    )}
                  >
                    <div className="space-y-3.5">
                      {/* Booking Card Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-[10px] font-black text-primary tracking-tighter uppercase leading-none">
                            #{booking.id.slice(-8)}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Icons.Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-[10px] text-gray-400 font-bold">{booking.time || "No set time"}</span>
                          </div>
                        </div>

                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.05em] border",
                          booking.status === 'completed' ? "bg-blue-50 text-blue-700 border-blue-100" :
                          booking.status === 'confirmed' ? "bg-orange-50 text-orange-700 border-orange-100 animate-pulse" :
                          booking.status === 'cancelled' ? "bg-red-50 text-red-700 border-red-100" :
                          booking.status === 'review_required' ? "bg-amber-50 text-amber-700 border-amber-100 animate-pulse" :
                          "bg-amber-50 text-amber-700 border-amber-100"
                        )}>
                          {booking.status.replace('_', ' ')}
                        </div>
                      </div>

                      {/* Tour Package Details */}
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-gray-900 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {booking.tourTitle}
                        </h4>
                        <p className="text-[9px] font-black text-primary uppercase tracking-wider">
                          {booking.packageName}
                        </p>
                      </div>

                      {/* Pax & Customer Directory Details */}
                      <div className="bg-gray-50/60 rounded-lg p-2.5 border border-gray-100/60 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Guest Lead</span>
                          <span className="font-black text-gray-800 text-[11px] truncate max-w-[150px]">
                            {booking.customerData.fullName}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">WhatsApp</span>
                          <span className="font-bold text-gray-600 text-[10px] truncate max-w-[150px]">
                            {booking.customerData.phone || "No Whatsapp"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Travel Capacity</span>
                          <span className="font-black text-primary text-[11px]">
                            {(booking.participants?.adults || 0) + (booking.participants?.children || 0)} Passengers ({booking.participants?.adults || 0} A, {booking.participants?.children || 0} C)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Integrated Interactive Dispatcher (Guide assignment) */}
                    <div className="pt-3.5 border-t border-gray-50 space-y-3">
                      {booking.status !== 'cancelled' ? (
                        <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                              Guide / Driver Assigned
                            </label>
                            {booking.assignedGuideId ? (
                              <span className="text-[8px] font-black text-primary uppercase bg-orange-50 border border-orange-100 px-1 py-0.2 rounded">
                                Dispatched
                              </span>
                            ) : (
                              <span className="text-[8px] font-black text-amber-600 uppercase bg-amber-50 border border-amber-100 px-1 py-0.2 rounded">
                                Needs Assignment
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <select
                              value={booking.assignedGuideId || ''}
                              onChange={async (e) => {
                                const val = e.target.value;
                                if (!val) {
                                  try {
                                    await updateDoc(doc(db, 'bookings', booking.id), {
                                      assignedGuideId: null,
                                      assignedGuideName: null,
                                      assignedGuideWhatsapp: null,
                                    });
                                    // Append logging event
                                    const timelineRef = collection(db, 'bookings', booking.id, 'timeline');
                                    await addDoc(timelineRef, {
                                      status: booking.status,
                                      message: `Guide unassigned by scheduler`,
                                      notes: '',
                                      timestamp: new Date(),
                                      userId: currentUserProfile?.uid || 'system',
                                      userName: currentUserProfile?.displayName || 'Admin'
                                    });
                                  } catch(err) {
                                    console.error("Failed to unassign guide", err);
                                  }
                                } else {
                                  const selectedGuide = guides.find(g => g.id === val);
                                  if (selectedGuide) {
                                    await handleAssignToGuide(booking, selectedGuide);
                                  }
                                }
                              }}
                              className={cn(
                                "w-full pl-3 pr-8 py-2 rounded-lg text-xs font-bold outline-none border transition-all appearance-none cursor-pointer bg-no-repeat bg-[right_8px_center]",
                                booking.assignedGuideId 
                                  ? "bg-blue-50/50 text-blue-700 border-blue-200 focus:border-blue-400" 
                                  : "bg-amber-50/50 text-amber-700 border-amber-200 focus:border-amber-400"
                              )}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234B5563' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`,
                                backgroundSize: '12px'
                              }}
                            >
                              <option value="">-- No Guide / Driver --</option>
                              {guides.map(guide => (
                                <option key={guide.id} value={guide.id}>
                                  {guide.name} {guide.whatsapp ? `(+${guide.whatsapp})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-center text-red-700 text-[10px] font-black uppercase tracking-wider">
                          Booking Cancelled - No Guide Needed
                        </div>
                      )}

                      {/* Price & Contact details footer */}
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Total Booked Vol</p>
                          <p className="text-sm font-black text-gray-900 mt-1">{formatPrice(booking.totalAmount)}</p>
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setGlobalSelectedBooking(booking);
                            setOriginalBooking(booking);
                            setIsBookingDetailOpen(true);
                          }}
                          className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-150 text-[9px] font-black uppercase tracking-wider rounded-lg text-gray-655 flex items-center gap-1 transition-colors"
                        >
                          Details & Logs
                          <Icons.ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode === 'calendar' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Calendar Grid Section */}
            <div className="bg-white rounded-[12px] border border-gray-100 shadow-sm overflow-hidden p-6 md:p-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={previousMonth} 
                    className="p-2 hover:bg-gray-50 border border-gray-100 rounded-lg text-gray-500 hover:text-black transition-colors"
                    type="button"
                  >
                    <Icons.ChevronLeft className="h-4 w-4" />
                  </button>
                  <h3 className="text-base font-black text-gray-900 min-w-[140px] text-center uppercase tracking-wider">
                    {format(viewDate, 'MMMM yyyy')}
                  </h3>
                  <button 
                    onClick={nextMonth} 
                    className="p-2 hover:bg-gray-50 border border-gray-100 rounded-lg text-gray-500 hover:text-black transition-colors"
                    type="button"
                  >
                    <Icons.ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button 
                  onClick={goToToday}
                  className="px-4 py-2 rounded-lg bg-primary text-white font-black text-[10px] uppercase tracking-wider hover:bg-orange-700 transition-colors flex items-center gap-1.5 shadow-sm shadow-orange-100 cursor-pointer"
                  type="button"
                >
                  <Icons.Calendar className="h-3.5 w-3.5" /> Today
                </button>
              </div>

              <div className="grid grid-cols-7 gap-px rounded-xl overflow-hidden bg-gray-150 border border-gray-150 shadow-inner">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="bg-gray-50 py-3 text-center">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{day}</span>
                  </div>
                ))}
                
                {calendarDays.map((day, idx) => {
                  const dayBookings = getBookingsForDay(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const isCurrentMonth = isSameMonth(day, monthStart);
                  const guestsCount = dayBookings.reduce((sum, b) => sum + ((b.participants?.adults || 0) + (b.participants?.children || 0)), 0);

                  return (
                    <div 
                      key={idx}
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "min-h-[105px] bg-white p-2.5 transition-all cursor-pointer relative flex flex-col justify-between hover:bg-primary/[0.02]",
                        !isCurrentMonth && "bg-gray-50/20 text-gray-350",
                        isSelected && "ring-2 ring-primary ring-inset z-10 bg-primary/[0.03]"
                      )}
                    >
                      <div className="flex justify-between items-start">
                        <span className={cn(
                          "text-xs font-black transition-colors",
                          !isCurrentMonth ? "text-gray-300" : isToday(day) ? "text-primary font-extrabold" : "text-gray-650",
                          isSelected && "text-primary font-black"
                        )}>
                          {format(day, 'd')}
                        </span>
                        {dayBookings.length > 0 && isCurrentMonth && (
                          <span className={cn(
                            "flex h-2 w-2 rounded-full",
                            dayBookings.some(b => b.status === 'pending') ? "bg-amber-500" : "bg-orange-500"
                          )} />
                        )}
                      </div>

                      {dayBookings.length > 0 && isCurrentMonth && (
                        <div className="space-y-0.5">
                          <div className="text-[9px] font-black text-gray-900 leading-none">
                            {dayBookings.length} Job{dayBookings.length > 1 ? 's' : ''}
                          </div>
                          <div className="text-[8px] font-bold text-gray-400 flex items-center gap-0.5">
                            <Icons.Users className="h-2 w-2" />
                            {guestsCount} Pax
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Day KPI + Detail Pane */}
            <div className="space-y-6 flex-1">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-gray-905 tracking-tight flex items-center gap-2">
                    <Icons.Calendar className="h-5 w-5 text-primary" />
                    {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                  </h3>
                  <p className="text-xs text-gray-400 font-bold uppercase mt-1 tracking-wider">
                    {selectedDayBookings.length} booking{selectedDayBookings.length !== 1 ? 's' : ''} scheduled
                  </p>
                </div>
                <div className="flex items-center gap-6 bg-white px-5 py-3 rounded-xl border border-gray-100 shadow-xs self-start md:self-auto text-xs font-black">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Total Guests</p>
                    <p className="text-base font-black text-gray-950">{totalGuests} Pax</p>
                  </div>
                  <div className="w-px h-8 bg-gray-100" />
                  <div className="text-right">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Day Revenue</p>
                    <p className="text-base font-black text-primary font-mono">{formatPrice(totalRevenue)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {selectedDayBookings.map(booking => (
                  <div 
                    key={booking.id} 
                    onClick={() => {
                        setGlobalSelectedBooking(booking);
                        setOriginalBooking(booking);
                        setIsBookingDetailOpen(true);
                    }}
                    className={cn(
                      "bg-white p-5 rounded-xl border flex flex-col justify-between hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group space-y-4",
                      booking.status === 'cancelled'
                        ? "border-red-100 opacity-75 hover:border-red-350"
                        : (!booking.assignedGuideId 
                          ? "border-amber-200 bg-amber-50/10 hover:border-amber-450" 
                          : "border-gray-100 hover:border-primary")
                    )}
                  >
                    <div className="space-y-3.5 flex-1">
                      {/* Booking Card Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-[10px] font-black text-primary tracking-tighter uppercase leading-none">
                            #{booking.id.slice(-8)}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Icons.Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-[10px] text-gray-400 font-bold">{booking.time || "No set time"}</span>
                          </div>
                        </div>

                        <div className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-[0.05em] border",
                          booking.status === 'completed' ? "bg-blue-50 text-blue-700 border-blue-100" :
                          booking.status === 'confirmed' ? "bg-orange-50 text-orange-700 border-orange-100" :
                          booking.status === 'cancelled' ? "bg-red-50 text-red-700 border-red-100" :
                          "bg-amber-50 text-amber-700 border-amber-100"
                        )}>
                          {booking.status.replace('_', ' ')}
                        </div>
                      </div>

                      {/* Tour Package Details */}
                      <div className="space-y-1">
                        <h4 className="text-xs font-black text-gray-900 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                          {booking.tourTitle}
                        </h4>
                        <p className="text-[9px] font-black text-primary uppercase tracking-wider">
                          {booking.packageName}
                        </p>
                      </div>

                      {/* Guest info card */}
                      <div className="bg-gray-50/60 rounded-lg p-2.5 border border-gray-100/60 space-y-1.5 text-xs">
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Guest Lead</span>
                          <span className="font-black text-gray-800 text-[11px] truncate max-w-[150px]">
                            {booking.customerData.fullName}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">WhatsApp</span>
                          <span className="font-bold text-gray-600 text-[10px] truncate max-w-[150px]">
                            {booking.customerData.phone || "No Whatsapp"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Travel Capacity</span>
                          <span className="font-black text-primary text-[11px]">
                            {(booking.participants?.adults || 0) + (booking.participants?.children || 0)} Passengers ({booking.participants?.adults || 0} A, {booking.participants?.children || 0} C)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Integrated Guide Selector */}
                    <div className="pt-3 border-t border-gray-50 space-y-3">
                      {booking.status !== 'cancelled' ? (
                        <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider">
                              Guide / Driver Assigned
                            </label>
                            {booking.assignedGuideId ? (
                              <span className="text-[8px] font-black text-primary uppercase bg-orange-50 border border-orange-100 px-1 py-0.2 rounded">
                                Dispatched
                              </span>
                            ) : (
                              <span className="text-[8px] font-black text-amber-600 uppercase bg-amber-50 border border-amber-100 px-1 py-0.2 rounded">
                                Needs Assignment
                              </span>
                            )}
                          </div>
                          <div className="relative">
                            <select
                              value={booking.assignedGuideId || ''}
                              onChange={async (e) => {
                                const val = e.target.value;
                                if (!val) {
                                  try {
                                    await updateDoc(doc(db, 'bookings', booking.id), {
                                      assignedGuideId: null,
                                      assignedGuideName: null,
                                      assignedGuideWhatsapp: null,
                                    });
                                    const timelineRef = collection(db, 'bookings', booking.id, 'timeline');
                                    await addDoc(timelineRef, {
                                      status: booking.status,
                                      message: `Guide unassigned by scheduler`,
                                      notes: '',
                                      timestamp: new Date(),
                                      userId: currentUserProfile?.uid || 'system',
                                      userName: currentUserProfile?.displayName || 'Admin'
                                    });
                                  } catch(err) {
                                    console.error(err);
                                  }
                                } else {
                                  const selectedGuide = guides.find(g => g.id === val);
                                  if (selectedGuide) {
                                    await handleAssignToGuide(booking, selectedGuide);
                                  }
                                }
                              }}
                              className={cn(
                                "w-full pl-3 pr-8 py-2 rounded-lg text-xs font-bold outline-none border transition-all appearance-none cursor-pointer bg-no-repeat bg-[right_8px_center]",
                                booking.assignedGuideId 
                                  ? "bg-blue-50/50 text-blue-700 border-blue-200 focus:border-blue-400" 
                                  : "bg-amber-50/50 text-amber-700 border-amber-200 focus:border-amber-400"
                              )}
                              style={{
                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%234B5563' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7' /%3E%3C/svg%3E")`,
                                backgroundSize: '12px'
                              }}
                            >
                              <option value="">-- No Guide / Driver --</option>
                              {guides.map(guide => (
                                <option key={guide.id} value={guide.id}>
                                  {guide.name} {guide.whatsapp ? `(+${guide.whatsapp})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-center text-red-750 text-[10px] font-black uppercase tracking-wider">
                          Booking Cancelled - No Guide Needed
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Total Booked Vol</p>
                          <p className="text-sm font-black text-gray-900 mt-1">{formatPrice(booking.totalAmount)}</p>
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setGlobalSelectedBooking(booking);
                            setOriginalBooking(booking);
                            setIsBookingDetailOpen(true);
                          }}
                          className="px-3.5 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-150 text-[9px] font-black uppercase tracking-wider rounded-lg text-gray-655 flex items-center gap-1 transition-colors"
                        >
                          Details & Logs
                          <Icons.ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {selectedDayBookings.length === 0 && (
                  <div className="col-span-full p-12 text-center bg-gray-50/50 rounded-xl border border-gray-150 border-dashed">
                    <p className="text-gray-400 font-bold text-xs uppercase tracking-widest">No tours scheduled for this day</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const InquiryManager = () => {
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

    const filteredInquiries = useMemo(() => {
      return inquiries
        .filter(i => filterStatus === 'all' || i.status === filterStatus)
        .filter(i => {
           if (!searchQuery.trim()) return true;
           const q = searchQuery.toLowerCase();
           return (
             i.userName.toLowerCase().includes(q) ||
             i.userEmail.toLowerCase().includes(q) ||
             (i.planTitle || '').toLowerCase().includes(q)
           );
        });
    }, [filterStatus, searchQuery]);

    const updateInquiryStatus = async (id: string, status: Inquiry['status']) => {
      try {
        await updateDoc(doc(db, 'inquiries', id), { 
          status,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Failed to update inquiry status:", err);
        alert("Failed to update status. Check permissions.");
      }
    };

    const handleDeleteInquiry = async (id: string) => {
      if (confirm("Are you sure you want to delete this inquiry?")) {
        try {
          await deleteDoc(doc(db, 'inquiries', id));
        } catch (err) {
          console.error("Failed to delete inquiry:", err);
          alert("Failed to delete inquiry.");
        }
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white rounded-[10px] p-8 border border-gray-100 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Trip Inquiries</h2>
              <p className="text-sm text-gray-500 font-medium">Manage user-generated AI travel plans and follow ups.</p>
            </div>
            <div className="relative flex-1 max-w-md">
              <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input 
                placeholder="Search inquiries..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl text-sm font-bold focus:border-primary focus:bg-white outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-50">
            {['all', 'new', 'followed_up', 'converted', 'cancelled'].map(s => (
              <button 
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                  filterStatus === s ? "bg-primary text-white" : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                )}
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-[10px] border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900 border-b border-gray-800">
                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Plan Details</th>
                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[9px] font-black text-gray-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredInquiries.map(inquiry => (
                <tr key={inquiry.id} className="hover:bg-gray-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-gray-900 uppercase">
                        {inquiry.createdAt?.toDate ? format(inquiry.createdAt.toDate(), 'dd MMM yyyy') : 'Recently'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-bold">
                        {inquiry.createdAt?.toDate ? format(inquiry.createdAt.toDate(), 'HH:mm') : '-'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-900 group-hover:text-primary transition-colors">{inquiry.userName}</span>
                      <span className="text-[10px] text-gray-400 font-bold">{inquiry.userEmail}</span>
                      {inquiry.userPhone && <span className="text-[9px] text-primary font-black mt-1">{inquiry.userPhone}</span>}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="max-w-xs">
                      <span className="text-xs font-black text-gray-900 block truncate">{inquiry.planTitle}</span>
                      <p className="text-[10px] text-gray-400 font-medium line-clamp-1 mt-0.5">{inquiry.summary}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                      inquiry.status === 'new' ? "bg-blue-50 text-blue-600" :
                      inquiry.status === 'followed_up' ? "bg-amber-50 text-amber-600" :
                      inquiry.status === 'converted' ? "bg-orange-50 text-primary" :
                      "bg-gray-50 text-gray-400"
                    )}>
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        inquiry.status === 'new' ? "bg-blue-500" :
                        inquiry.status === 'followed_up' ? "bg-amber-500" :
                        inquiry.status === 'converted' ? "bg-orange-500" :
                        "bg-gray-500"
                      )} />
                      {inquiry.status.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      <button 
                        onClick={() => setSelectedInquiry(inquiry)}
                        className="p-2 text-gray-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-all"
                        title="View Full Plan"
                      >
                        <Icons.ExternalLink className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={async () => {
                          const msg = `Hello ${inquiry.userName}, I saw your generated trip plan: ${inquiry.planTitle}. I'd love to help you customize it!`;
                          try {
                            await sendCustomWhatsApp(inquiry.userPhone || '', msg);
                            updateInquiryStatus(inquiry.id, 'followed_up');
                            alert("Follow-up message sent successfully via Whapi!");
                          } catch (err) {
                            console.error('[WhatsApp] API Error:', err);
                            const link = getWhatsAppLink(inquiry.userPhone || '', msg);
                            window.open(link, '_blank');
                          }
                        }}
                        className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition-all"
                        title="Follow up via WhatsApp API"
                      >
                        <Icons.MessageSquare className="h-4 w-4" />
                      </button>
                      <select 
                        value={inquiry.status}
                        onChange={(e) => updateInquiryStatus(inquiry.id, e.target.value as any)}
                        className="text-[9px] font-black uppercase tracking-widest bg-gray-50 border-none rounded-lg px-2 py-1 outline-none text-gray-500 cursor-pointer"
                      >
                        <option value="new">Mark New</option>
                        <option value="followed_up">Followed Up</option>
                        <option value="converted">Converted</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button 
                        onClick={() => handleDeleteInquiry(inquiry.id)}
                        className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete"
                      >
                        <Icons.Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredInquiries.length === 0 && (
            <div className="p-20 text-center text-gray-400 font-bold uppercase text-xs tracking-widest border-t border-gray-50">
              No inquiries found.
            </div>
          )}
        </div>

        {/* Inquiry Detail Modal */}
        <AnimatePresence>
          {selectedInquiry && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setSelectedInquiry(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[20px] shadow-2xl overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <div className="bg-gray-900 p-8 text-white flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
                      <Icons.Map className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">{selectedInquiry.planTitle}</h3>
                      <p className="text-gray-400 font-bold text-xs uppercase tracking-widest mt-1">AI Generated Itinerary Inquery</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedInquiry(null)}
                    className="h-10 w-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
                  >
                    <Icons.X className="h-6 w-6" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 space-y-10 scrollbar-hide">
                  <div className="grid md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Customer Profile</h4>
                        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
                          <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                            <span className="text-xs font-bold text-gray-500">Name</span>
                            <span className="text-sm font-black text-gray-900">{selectedInquiry.userName}</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                            <span className="text-xs font-bold text-gray-500">Email</span>
                            <span className="text-sm font-black text-gray-900">{selectedInquiry.userEmail}</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-xs font-bold text-gray-500">Phone</span>
                            <span className="text-sm font-black text-primary">{selectedInquiry.userPhone || 'Not Provided'}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Trip Preferences</h4>
                        <div className="bg-orange-50/30 rounded-2xl p-6 border border-orange-100/50 grid grid-cols-2 gap-4">
                          {selectedInquiry.formData && Object.entries(selectedInquiry.formData).map(([key, value]) => {
                            if (['name', 'email', 'phone', 'isConsent'].includes(key)) return null;
                            const labels: Record<string, string> = {
                              from: 'Traveling From',
                              tripTiming: 'Trip Timing',
                              duration: 'Duration (Days)',
                              persons: 'Number of People',
                              interests: 'Interests',
                              places: 'Preferred Places',
                              food: 'Food Preferences',
                              hotspots: 'Must Visit',
                              experience: 'Vibe/Experience',
                              hotelType: 'Hotel Style',
                              budget: 'Budget Range'
                            };
                            return (
                              <div key={key} className="space-y-1">
                                <p className="text-[8px] font-black text-primary uppercase tracking-widest leading-none">{labels[key] || key}</p>
                                <p className="text-xs font-extrabold text-gray-900 capitalize">{String(value)}</p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Icons.Sparkles className="h-3 w-3 text-amber-500" />
                        AI Summary
                      </h4>
                      <div className="bg-amber-50/30 rounded-2xl p-6 border border-amber-100/50">
                        <p className="text-sm font-bold text-gray-800 leading-relaxed italic">
                          "{selectedInquiry.summary}"
                        </p>
                      </div>
                      
                      <div className="pt-4 border-t border-gray-100 mt-6">
                         <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Full Itinerary</h4>
                         <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-100 scrollbar-track-transparent">
                            {selectedInquiry.itinerary?.dailyPlans?.map((day: any, idx: number) => (
                              <div key={idx} className="p-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-primary/20 transition-colors">
                                <h5 className="text-xs font-black text-gray-900 mb-2 flex items-center gap-2">
                                  <span className="h-5 w-5 rounded bg-primary/10 text-primary flex items-center justify-center text-[10px]">D{day.day}</span>
                                  {day.title}
                                </h5>
                                <div className="space-y-2 ml-7 border-l-2 border-gray-50 pl-4 py-1">
                                   {day.activities?.map((activity: any, aIdx: number) => (
                                     <div key={aIdx} className="space-y-0.5">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tight">{activity.time}</p>
                                        <p className="text-[11px] text-gray-700 font-bold leading-tight">{activity.title}</p>
                                        <p className="text-[10px] text-gray-500 font-medium leading-relaxed italic">{activity.description}</p>
                                     </div>
                                   ))}
                                   {day.accommodationRecommendation && (
                                     <div className="mt-3 p-2 bg-orange-50/50 rounded-lg border border-orange-100/50">
                                       <p className="text-[8px] font-black text-primary uppercase tracking-widest">Recommended Stay</p>
                                       <p className="text-[10px] font-bold text-gray-900">{day.accommodationRecommendation.name}</p>
                                     </div>
                                   )}
                                </div>
                              </div>
                            ))}
                            {!selectedInquiry.itinerary?.dailyPlans && (
                              <p className="text-xs text-gray-400 italic">Itinerary details missing or in legacy format.</p>
                            )}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 bg-gray-50 border-t border-gray-100 shrink-0 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inquiry ID:</span>
                    <code className="text-xs font-bold text-gray-600 bg-white px-3 py-1 rounded-lg border border-gray-200">
                      {selectedInquiry.id}
                    </code>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setSelectedInquiry(null)}
                      className="px-6 py-3 rounded-xl font-black text-xs text-gray-500 hover:bg-gray-100 transition-all uppercase tracking-widest"
                    >
                      Close Window
                    </button>
                    <button 
                      onClick={async () => {
                        const msg = `Hi ${selectedInquiry.userName}, I'm following up on your ${selectedInquiry.planTitle} trip plan!`;
                        try {
                          await sendCustomWhatsApp(selectedInquiry.userPhone || '', msg);
                          alert("Follow-up sent successfully via Whapi!");
                        } catch (err) {
                          console.error('[WhatsApp] API Error:', err);
                          window.open(getWhatsAppLink(selectedInquiry.userPhone || '', msg), '_blank');
                        }
                      }}
                      className="px-8 py-3 bg-primary text-white rounded-xl font-black text-xs hover:bg-orange-700 transition-all shadow-xl shadow-orange-100 uppercase tracking-widest flex items-center gap-2"
                    >
                      <Icons.Send className="h-4 w-4" /> Send Offer
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] relative">
      {/* Mobile Sidebar Backdrop Overlay */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/30 z-45 transition-opacity backdrop-blur-sm"
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-100 transition-all duration-300 shadow-sm",
          isSidebarOpen ? "w-72 translate-x-0" : "w-20 -translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center gap-3">
            <div className="bg-primary h-10 w-10 rounded-[10px] flex items-center justify-center shrink-0">
              <span className="text-white font-black text-xl tracking-tighter">BA</span>
            </div>
            {isSidebarOpen && (
              <span className="font-black text-gray-900 tracking-tight text-lg truncate uppercase">
                {currentUserProfile?.role === 'admin' ? 'Admin Panel' : 
                 currentUserProfile?.role === 'supplier' ? 'Supplier Portal' : 
                 currentUserProfile?.role === 'agent' ? 'Agent Portal' : 'Admin'}
              </span>
            )}
          </div>

          <nav className="flex-1 px-4 space-y-1 overflow-y-auto mt-4 scrollbar-hide">
            {menuItems.map((item) => {
              const isActive = activeMenu === item.id;
              const isChildActive = item.children?.some(c => activeMenu === c.id);
              const isExpanded = expandedMenu === item.id;

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    onClick={() => {
                        setSelectedPartner(null);
                        if (item.children) {
                            if (!isSidebarOpen) {
                                setIsSidebarOpen(true);
                                setExpandedMenu(item.id);
                            } else {
                                setExpandedMenu(isExpanded ? null : item.id);
                            }
                        } else {
                            setActiveMenu(item.id as MenuId);
                            setExpandedMenu(null);
                        }
                        if (item.id === 'tours') setActiveTab('basic');
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 rounded-[10px] transition-all group",
                      isActive || isChildActive
                        ? "bg-orange-50 text-primary" 
                        : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", isActive || isChildActive ? "text-primary" : "text-gray-400 group-hover:text-gray-900")} />
                    {isSidebarOpen && <span className="font-bold text-sm tracking-tight">{item.label}</span>}
                    {isSidebarOpen && item.children && (
                        <ChevronDown className={cn("ml-auto h-4 w-4 opacity-50 transition-transform", isExpanded && "rotate-180")} />
                    )}
                  </button>
                  {isSidebarOpen && isExpanded && item.children && (
                    <div className="ml-9 space-y-1">
                      {item.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => {
                            setSelectedPartner(null);
                            if (child.id === 'tours') {
                                resetForm();
                                setActiveMenu('tours');
                            } else {
                                setActiveMenu(child.id as MenuId);
                            }
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between group/child",
                            activeMenu === child.id ? "text-primary bg-orange-50/50 rounded-lg" : "text-gray-400 hover:text-primary"
                          )}
                        >
                          <span>{child.label}</span>
                          {(child as any).count && (
                            <span className="bg-primary text-white text-[8px] px-1.5 py-0.5 rounded-full font-black">
                              {(child as any).count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="px-4 py-2 space-y-1 border-t border-gray-50 bg-gray-50/10">
            <button
              onClick={handleLogout}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-[10px] transition-all group",
                "text-red-500 hover:bg-red-50 hover:text-red-700"
              )}
            >
              <LogOut className="h-5 w-5" />
              {isSidebarOpen && <span className="font-bold text-sm tracking-tight">Log Out</span>}
            </button>
          </div>

          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-6 border-t border-gray-50 text-gray-400 hover:text-gray-900 transition-colors flex justify-center"
          >
            {isSidebarOpen ? <ChevronRight className="h-5 w-5 rotate-180" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300 min-h-screen min-w-0 overflow-x-hidden pt-12 md:pt-0 pb-16 md:pb-0",
        isSidebarOpen ? "md:pl-72" : "md:pl-20"
      )}>
        {/* Dynamic Header */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-4">
           <div className="flex items-center gap-3">
              {/* Hamburger Toggle on Mobile */}
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all focus:outline-none"
              >
                <Icons.Menu className="h-5 w-5" />
              </button>
              <h2 className="text-sm md:text-xl font-black tracking-tight text-gray-900 truncate">
                {activeMenuItemLabel}
              </h2>
           </div>
           <div className="flex items-center gap-2 md:gap-4 shrink-0">
              {/* Unified Notification Center */}
              <div className="relative">
                <button
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="relative p-2 rounded-xl border border-gray-100 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-all shadow-sm bg-white cursor-pointer"
                  title="Notifications Alert"
                >
                  <Icons.Bell className="h-4 w-4 md:h-5 w-5" />
                  {inAppNotifications.some(n => !n.read) && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-black h-4 w-4 md:h-5 md:w-5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                      {inAppNotifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>

                {/* Notifications Panel Dropdown */}
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                    <div className="absolute right-0 mt-3 w-72 md:w-96 bg-white rounded-2xl border border-gray-100 shadow-2xl z-50 p-4 md:p-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2 overflow-hidden max-h-[450px] flex flex-col">
                      <div className="flex items-center justify-between pb-3 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                          <Icons.Bell className="h-4 w-4 text-primary animate-bounce" />
                          <h4 className="text-xs md:text-sm font-black text-gray-900 uppercase tracking-wider">Notifications</h4>
                        </div>
                        <div className="flex gap-2">
                          {inAppNotifications.length > 0 && (
                            <button 
                              onClick={() => setInAppNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                              className="text-[9.5px] font-bold text-primary hover:underline"
                            >
                              Mark read
                            </button>
                          )}
                          <button 
                            onClick={() => setInAppNotifications([])}
                            className="text-[9.5px] font-bold text-red-500 hover:underline"
                          >
                            Clear all
                          </button>
                        </div>
                      </div>

                      {/* Permission status prompt inside center */}
                      {!notificationPermissionGranted && (
                        <div className="mt-3 p-3 bg-orange-50 border border-orange-100/50 rounded-xl text-center">
                          <p className="text-[10px] text-orange-800 font-bold mb-2">Enable Push Alerts for instant booking updates!</p>
                          <button
                            onClick={requestNotificationPermission}
                            className="w-full bg-primary text-white text-[9.5px] font-black uppercase tracking-wider py-1.5 rounded-lg shadow-sm hover:bg-orange-700 transition-all cursor-pointer"
                          >
                            Enable System Notifications
                          </button>
                        </div>
                      )}

                      {/* Notification list */}
                      <div className="mt-3 overflow-y-auto space-y-2.5 max-h-[260px] flex-1 pr-1">
                        {inAppNotifications.length === 0 ? (
                          <div className="py-6 text-center text-gray-400">
                            <Icons.Inbox className="h-8 w-8 mx-auto opacity-40 mb-2" />
                            <p className="text-[10px] font-bold">No notifications yet.</p>
                            <p className="text-[9px] font-medium text-gray-400 mt-0.5">Real-time alerts appear instantly here when clients book!</p>
                          </div>
                        ) : (
                          inAppNotifications.map(notification => (
                            <div 
                              key={notification.id}
                              className={cn(
                                "p-3 rounded-xl border text-left transition-all cursor-pointer",
                                notification.read ? "bg-gray-50/50 border-gray-50" : "bg-orange-50/20 border-orange-100"
                              )}
                              onClick={() => {
                                setInAppNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
                                setActiveMenu(notification.url.includes('inquiries') ? 'inquiries' : 'bookings');
                                setIsNotificationsOpen(false);
                              }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h5 className="text-[11px] font-black text-gray-900 leading-tight">{notification.title}</h5>
                                {!notification.read && <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0 mt-1" />}
                              </div>
                              <p className="text-[10px] text-gray-500 font-semibold mt-1 leading-normal">{notification.body}</p>
                              <span className="text-[8px] text-gray-400 font-bold mt-1.5 block">
                                {new Date(notification.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <button 
                onClick={seedDummyData} 
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-amber-50 text-amber-700 text-xs font-black hover:bg-amber-100 transition-all border border-amber-100"
              >
                <Database className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Seed</span>
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] bg-red-50 text-red-700 text-xs font-black hover:bg-red-100 transition-all border border-red-100"
                title="Log Out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white shadow-sm overflow-hidden shrink-0">
                <img src={auth.currentUser?.photoURL || ''} className="h-full w-full object-cover" />
              </div>
           </div>
        </header>

        <div className="p-4 md:p-8">
          {/* Dashboard View */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-6 md:space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 tracking-tight">
                    {currentUserProfile?.role === 'admin' ? 'Executive Dashboard' : 
                     currentUserProfile?.role === 'supplier' ? 'Supplier Dashboard' : 
                     currentUserProfile?.role === 'agent' ? 'Agent Portal' : 'Admin Dashboard'}
                  </h1>
                  <p className="text-sm text-gray-550 font-medium">Daily performance & operations briefing.</p>
                </div>
                <div className="flex sm:justify-end shrink-0">
                  <div className="bg-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border border-gray-100 flex items-center gap-2 sm:gap-3 shadow-xs">
                    <div className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-orange-500 animate-pulse" />
                    <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">Live System Status</span>
                  </div>
                </div>
              </div>

              <StatsDashboard bookings={bookings} tours={tours} users={users} inquiries={inquiries} role={currentUserProfile?.role} />

              {/* Quick Actions and Profile Preview */}
              {(currentUserProfile?.role === 'supplier' || currentUserProfile?.role === 'agent' || currentUserProfile?.role === 'admin') && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs">
                    <h3 className="font-extrabold tracking-tight text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 text-sm sm:text-base">
                       <Icons.Zap className="h-5 w-5 text-amber-500" />
                       Quick Actions
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                       {isInstallable && (
                         <div className="col-span-2 md:col-span-3 p-4 sm:p-5 rounded-2xl border border-orange-100 bg-orange-50/50 flex flex-col md:flex-row items-center gap-4 justify-between">
                           <div className="flex items-center gap-3 w-full md:w-auto">
                             <div className="p-2 sm:p-3 bg-white rounded-xl shadow-xs text-primary shrink-0">
                               <Icons.Download className="h-5 w-5" />
                             </div>
                             <div className="text-left py-0.5">
                               <h4 className="font-extrabold text-xs sm:text-sm text-gray-900">Install Bali Adventours Mobile App</h4>
                               <p className="text-[9.5px]/normal sm:text-[10px]/relaxed text-gray-500 font-semibold max-w-md mt-0.5">Add the application directly to your home screen for rapid offline-first access and push alerts.</p>
                             </div>
                           </div>
                           <button
                             onClick={handleInstallApp}
                             className="w-full md:w-auto shrink-0 bg-primary hover:bg-orange-700 text-white text-[10.5px] font-black uppercase tracking-wider px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl shadow-xs cursor-pointer transition-all"
                           >
                             Install Web App
                           </button>
                         </div>
                       )}
                       {currentUserProfile.role === 'admin' && (
                         <>
                           <button 
                             onClick={() => setActiveMenu('bookings')}
                             className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 flex flex-col items-center justify-center gap-3 hover:bg-blue-100 transition-all font-black text-[11px] group"
                           >
                             <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                               <Briefcase className="h-6 w-6" />
                             </div>
                             Manage Bookings
                           </button>
                           <button 
                             onClick={() => setActiveMenu('inquiries')}
                             className={cn(
                               "p-4 sm:p-6 rounded-xl sm:rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all font-black text-[11px] group",
                               inquiries.some(i => i.status === 'new')
                                 ? "border-orange-100 bg-orange-50 text-orange-700 hover:bg-orange-100"
                                 : "border-gray-100 bg-gray-50 text-gray-500 hover:bg-gray-100"
                             )}
                           >
                             <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform relative">
                               <Icons.MessageSquare className="h-6 w-6" />
                               {inquiries.some(i => i.status === 'new') && (
                                 <div className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full border-2 border-white" />
                               )}
                             </div>
                             Trip Inquiries
                           </button>
                           <button 
                             onClick={() => setActiveMenu('tours')}
                             className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-purple-100 bg-purple-50 text-purple-700 flex flex-col items-center justify-center gap-3 hover:bg-purple-100 transition-all font-black text-[11px] group"
                           >
                             <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                               <Icons.Map className="h-6 w-6" />
                             </div>
                             Add New Tour
                           </button>
                         </>
                       )}
                       {currentUserProfile.role === 'supplier' && (
                         <>
                           <button 
                             onClick={() => setActiveMenu('tours')}
                             className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-orange-100 bg-orange-50 text-orange-700 flex flex-col items-center justify-center gap-3 hover:bg-orange-100 transition-all font-black text-[11px] group"
                           >
                             <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                              <Icons.Map className="h-6 w-6" />
                             </div>
                             Add New Tour
                           </button>
                           <button 
                             onClick={() => setActiveMenu('bookings')}
                             className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 flex flex-col items-center justify-center text-center gap-3 hover:bg-blue-100 transition-all font-black text-[11px] group"
                           >
                             <div className="p-2.5 sm:p-3 bg-white rounded-xl shadow-xs group-hover:scale-105 transition-transform shrink-0">
                               <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
                             </div>
                             Manage Bookings
                           </button>
                           <button 
                             onClick={() => setActiveMenu('company-profile')}
                             className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-purple-100 bg-purple-50 text-purple-700 flex flex-col items-center justify-center text-center gap-3 hover:bg-purple-100 transition-all font-black text-[11px] group"
                           >
                             <div className="p-2.5 sm:p-3 bg-white rounded-xl shadow-xs group-hover:scale-105 transition-transform shrink-0">
                               <Icons.Settings className="h-5 w-5 sm:h-6 sm:w-6" />
                             </div>
                             Edit Profile
                           </button>
                         </>
                       )}
                       {currentUserProfile.role === 'agent' && (
                         <>
                           <button 
                             onClick={() => navigate('/')}
                             className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-primary/10 bg-primary/5 text-primary flex flex-col items-center justify-center text-center gap-3 hover:bg-primary/10 transition-all font-black text-[11px] group"
                           >
                             <div className="p-2.5 sm:p-3 bg-white rounded-xl shadow-xs group-hover:scale-105 transition-transform shrink-0">
                               <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />
                             </div>
                             Explore Tours
                           </button>
                           <button 
                             onClick={() => setActiveMenu('bookings')}
                             className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-blue-100 bg-blue-50 text-blue-700 flex flex-col items-center justify-center text-center gap-3 hover:bg-blue-100 transition-all font-black text-[11px] group"
                           >
                             <div className="p-2.5 sm:p-3 bg-white rounded-xl shadow-xs group-hover:scale-105 transition-transform shrink-0">
                               <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                             </div>
                             My Bookings
                           </button>
                           <button 
                             onClick={() => setActiveMenu('company-profile')}
                             className="p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-purple-100 bg-purple-50 text-purple-700 flex flex-col items-center justify-center text-center gap-3 hover:bg-purple-100 transition-all font-black text-[11px] group"
                           >
                             <div className="p-2.5 sm:p-3 bg-white rounded-xl shadow-xs group-hover:scale-105 transition-transform shrink-0">
                               <Icons.User className="h-5 w-5 sm:h-6 sm:w-6" />
                             </div>
                             Edit Profile
                           </button>
                         </>
                       )}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs flex flex-col justify-between overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none">
                      <Icons.UserCheck className="h-24 w-24" />
                    </div>
                    <div className="relative">
                      <h3 className="font-extrabold tracking-tight text-gray-900 mb-4 sm:mb-6 flex items-center gap-2 text-sm sm:text-base">
                        <Icons.UserCheck className="h-5 w-5 text-orange-500" />
                        Your Public Profile
                      </h3>
                      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl border-2 border-gray-50 shadow-xs overflow-hidden bg-gray-100 flex items-center justify-center shrink-0">
                          {currentUserProfile?.photoURL ? (
                            <img 
                              src={currentUserProfile.photoURL} 
                              className="h-full w-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <Icons.User className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-gray-900 leading-none mb-1 truncate text-base sm:text-lg">
                            {currentUserProfile?.companyName || currentUserProfile?.displayName || 'Loading...'}
                          </p>
                          <p className="text-[9.5px] font-bold text-primary uppercase tracking-widest leading-none">
                            {currentUserProfile?.role || 'User'} Account
                          </p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 sm:space-y-3 font-medium">
                        <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100 gap-2">
                          <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">WhatsApp</span>
                          <span className="text-xs font-bold text-gray-700 truncate">{currentUserProfile?.phoneNumber || 'Not Set'}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100 gap-2">
                          <span className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest shrink-0">Public Email</span>
                          <span className="text-xs font-bold text-gray-700 truncate min-w-0 max-w-[150px] sm:max-w-none">{currentUserProfile?.publicEmail || currentUserProfile?.email || 'Not Set'}</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={() => setActiveMenu('company-profile')}
                      className="mt-5 w-full py-2.5 sm:py-3 rounded-xl bg-gray-900 text-white font-black text-[9.5px] sm:text-[10px] uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      Complete Profile <Icons.ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                 <div className="lg:col-span-2 space-y-6 md:space-y-8">
                    {/* Scheduled Tours Section */}
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs overflow-hidden min-w-0">
                       <div className="flex items-center justify-between mb-6 md:mb-8">
                         <div>
                            <h3 className="font-black tracking-tight text-gray-900 text-sm sm:text-base md:text-lg">Scheduled Tours</h3>
                            <p className="text-xs font-bold text-gray-400">Scheduled for today and tomorrow</p>
                         </div>
                         <CalendarIcon className="h-5 w-5 text-gray-400 shrink-0" />
                       </div>
                       
                       <div className="space-y-3 sm:space-y-4">
                          {(() => {
                             const today = format(new Date(), 'yyyy-MM-dd');
                             const tom = format(addDays(new Date(), 1), 'yyyy-MM-dd');
                             
                             const scheduledBookings = bookings.filter(b => b.date === today || b.date === tom);
                             
                             if (scheduledBookings.length === 0) {
                                 return <p className="text-sm text-gray-400 text-center py-8">No tours scheduled for today or tomorrow.</p>
                             }

                             return scheduledBookings.map((booking, idx) => (
                                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 sm:p-4 bg-gray-50 rounded-xl border border-gray-100 group hover:border-primary transition-all gap-3 overflow-hidden min-w-0">
                                   <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                                      <div className={cn(
                                         "h-10 w-10 rounded-[10px] flex items-center justify-center font-black text-xs shrink-0",
                                         booking.date === today ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                                      )}>
                                         {booking.date === today ? 'TODAY' : 'TOM'}
                                      </div>
                                      <div className="min-w-0">
                                         <p className="font-bold text-gray-900 text-sm group-hover:text-primary transition-colors truncate">{booking.tourTitle}</p>
                                         <p className="text-xs text-gray-400 font-bold truncate">{booking.customerData.fullName} • {booking.participants.adults + booking.participants.children} Pax</p>
                                      </div>
                                   </div>
                                   <div className="text-left sm:text-right shrink-0">
                                      <p className="font-black text-gray-900 text-sm leading-none sm:leading-normal">{booking.timeSlot || booking.time || 'TBA'}</p>
                                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 sm:mt-1">{booking.status}</p>
                                   </div>
                                </div>
                             ));
                          })()}
                       </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs h-96 overflow-hidden min-w-0 flex flex-col justify-between">
                       <div className="flex items-center justify-between mb-4">
                         <h3 className="font-black tracking-tight text-gray-900 text-sm sm:text-base md:text-lg">Revenue Analytics</h3>
                         <TrendingUp className="h-5 w-5 text-gray-400 shrink-0" />
                       </div>
                       <div className="flex items-end justify-between h-56 gap-1 sm:gap-1.5 md:gap-2 min-w-0">
                          {[40, 70, 45, 90, 65, 80, 50, 60, 85, 45, 75, 95].map((h, i) => (
                            <div key={i} className="flex-1 bg-orange-100 rounded-t-sm hover:bg-primary transition-colors cursor-pointer group relative" style={{ height: `${h}%` }}>
                               <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                  ${h}k
                               </div>
                            </div>
                          ))}
                       </div>
                       <div className="flex justify-between mt-4 text-[10px] font-black text-gray-400 px-1 border-t border-gray-50 pt-3">
                          <span>Jan</span>
                          <span>Jun</span>
                          <span>Dec</span>
                       </div>
                    </div>
                 </div>
                 <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6 md:p-8 shadow-xs flex flex-col justify-between overflow-hidden min-w-0">
                    <div>
                      <h3 className="font-black tracking-tight text-gray-900 mb-4 sm:mb-6 text-sm sm:text-base md:text-lg">Popular Tours</h3>
                      <div className="space-y-4 md:space-y-6">
                         {tours.slice(0, 3).map((tour, i) => (
                           <div key={i} className="flex items-center gap-3 sm:gap-4 p-1 rounded-xl transition-all min-w-0">
                              <img src={tour.gallery[0] || ''} className="h-10 w-10 sm:h-12 sm:w-12 rounded-[10px] object-cover shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-xs sm:text-sm text-gray-900 truncate" title={tour.title}>{tour.title}</p>
                                <p className="text-[10px] font-bold text-primary leading-none mt-1">34 Bookings</p>
                              </div>
                           </div>
                         ))}
                      </div>
                    </div>
                    <button 
                      onClick={() => setActiveMenu('schedule')}
                      className="w-full mt-6 md:mt-8 py-3 rounded-xl bg-primary text-white font-black text-[10.5px] uppercase tracking-wider hover:bg-orange-700 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm shrink-0"
                    >
                      <CalendarIcon className="h-3.5 w-3.5" /> View Schedule Calendar
                    </button>
                 </div>
              </div>
            </div>
          )}

          {/* Tour List View */}
          {activeMenu === 'all-tours' && (
            <div className="space-y-6">
              {tourSupplierFilter && (
                <div className="bg-orange-50 border border-orange-100 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center text-primary">
                      <Icons.Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-orange-800 uppercase tracking-widest">Supplier Filter Active</p>
                      <p className="text-sm font-bold text-primary">{users.find(u => u.uid === tourSupplierFilter)?.displayName || 'Unknown Supplier'}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setTourSupplierFilter(null)}
                    className="px-4 py-2 bg-white text-primary rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-sm"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
              <TourListing 
                tours={tourSupplierFilter ? tours.filter(t => t.supplierId === tourSupplierFilter) : tours}
                categories={categories}
                handleEdit={handleEdit}
                handleDelete={handleDelete}
                handleCloneTour={handleCloneTour}
                resetForm={resetForm}
                setActiveMenu={setActiveMenu}
              />
            </div>
          )}

          {/* Meta Management (Categories, Types, Locations) */}
          {activeMenu === 'analytics' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <AnalyticsManager bookings={bookings} tours={tours} />
            </div>
          )}

          {activeMenu === 'google-analytics' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <GoogleAnalytics />
            </div>
          )}
          {['categories', 'tour-types', 'locations', 'labels'].includes(activeMenu) && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
               <MetaManager 
                 type={activeMenu as 'categories' | 'tour-types' | 'locations' | 'labels'}
                 items={
                   activeMenu === 'categories' ? categories : 
                   activeMenu === 'tour-types' ? tourTypes : 
                   activeMenu === 'labels' ? labels :
                   locations
                 }
               />
            </div>
          )}
          {activeMenu === 'addons' && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <AddOnManager items={globalAddOns} />
             </div>
          )}
          {activeMenu === 'transports' && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <TransportOptionManager items={globalTransports} />
             </div>
          )}
          {activeMenu === 'bookings' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <BookingManagementPanel
                setGlobalSelectedBooking={setGlobalSelectedBooking}
                setOriginalBooking={setOriginalBooking}
                setIsBookingDetailOpen={setIsBookingDetailOpen}
                setAssignBooking={setAssignBooking}
                setIsAssignOpen={setIsAssignOpen}
                handlePrintManifest={handlePrintManifest}
                updateBookingStatus={updateBookingStatus}
                handleDeleteBooking={handleDeleteBooking}
                allGuides={allGuides}
                currentUserProfile={currentUserProfile}
                bookings={bookings}
                tours={tours}
              />
            </div>
          )}
          {activeMenu === 'import-bookings' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <ImportBooking 
                onSuccess={() => setActiveMenu('bookings')}
                commSettings={commSettings}
              />
            </div>
          )}
          {activeMenu === 'inquiries' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <InquiryManager />
            </div>
          )}
          {activeMenu === 'tickets' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <TicketManager />
            </div>
          )}
          {activeMenu === 'live-inventory' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
               <LiveInventoryManager />
            </div>
          )}
          {activeMenu === 'guides' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <GuideManager />
            </div>
          )}
          {activeMenu === 'schedule' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <BookingManagementPanel
                setGlobalSelectedBooking={setGlobalSelectedBooking}
                setOriginalBooking={setOriginalBooking}
                setIsBookingDetailOpen={setIsBookingDetailOpen}
                setAssignBooking={setAssignBooking}
                setIsAssignOpen={setIsAssignOpen}
                handlePrintManifest={handlePrintManifest}
                updateBookingStatus={updateBookingStatus}
                handleDeleteBooking={handleDeleteBooking}
                allGuides={allGuides}
                currentUserProfile={currentUserProfile}
                bookings={bookings}
                initialView="calendar"
                tours={tours}
              />
            </div>
          )}
          {activeMenu === 'reports' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
               <BookingReports currentUserProfile={currentUserProfile} />
            </div>
          )}
          {activeMenu === 'payouts' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
               <PayoutManager currentUserProfile={currentUserProfile} />
            </div>
          )}
          {activeMenu === 'coupons' && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <CouponManager items={coupons} />
             </div>
          )}
          {activeMenu === 'pages' && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <PageManager />
             </div>
          )}
          {activeMenu === 'blog' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
               <BlogManager />
            </div>
          )}
          {activeMenu === 'ai-hub' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
               <AIHubManager />
            </div>
          )}
          {(['users', 'users-admins', 'users-suppliers', 'users-agents', 'users-customers'] as MenuId[]).includes(activeMenu) && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
               <UserManager 
                 users={users} 
                 setUsers={setUsers} 
                 onDeleteUser={handleDeleteUser} 
                 allTours={tours}
                 resetForm={resetForm}
                 setFormData={setFormData}
                 formData={formData}
                 setActiveMenu={setActiveMenu}
                 roleFilter={
                   activeMenu === 'users-admins' ? 'admin' :
                   activeMenu === 'users-suppliers' ? 'supplier' :
                   activeMenu === 'users-agents' ? 'agent' :
                   activeMenu === 'users-customers' ? 'customer' :
                   undefined
                 }
               />
            </div>
          )}
          {activeMenu === 'access-roles' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <div className="bg-white p-10 rounded-[10px] border border-gray-100 shadow-sm relative overflow-hidden">
                    {/* Decorative Background */}
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Icons.ShieldCheck className="h-64 w-64 text-primary" />
                    </div>

                    <div className="relative z-10">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="h-14 w-14 rounded-[10px] bg-orange-50 text-primary flex items-center justify-center">
                          <Icons.ShieldAlert className="h-8 w-8" />
                        </div>
                        <div>
                          <h2 className="text-3xl font-black text-gray-900 tracking-tight">Access Control & Roles</h2>
                          <p className="text-gray-500 font-medium">Define and understand system permissions for each user type.</p>
                        </div>
                      </div>
                      
                      <div className="grid md:grid-cols-2 gap-8 mt-12">
                          {[
                              { 
                                role: 'Administrator', 
                                id: 'users-admins',
                                icon: Icons.ShieldCheck,
                                color: 'bg-red-50 text-red-600 border-red-100',
                                permissions: [
                                  'Full system access & settings',
                                  'Manage all users & partners',
                                  'Inventory & pricing control',
                                  'Financial reporting & analytics',
                                  'Communication & email settings'
                                ]
                              },
                              { 
                                role: 'Supplier / Partner', 
                                id: 'users-suppliers',
                                icon: Icons.Briefcase,
                                color: 'bg-purple-50 text-purple-600 border-purple-100',
                                permissions: [
                                  'Manage company tours & packets',
                                  'View & update booking status',
                                  'Manage assigned guides',
                                  'Payout & earnings tracking',
                                  'Tour review management'
                                ]
                              },
                              { 
                                role: 'Travel Agent', 
                                id: 'users-agents',
                                icon: Icons.Users2,
                                color: 'bg-blue-50 text-blue-600 border-blue-100',
                                permissions: [
                                  'Special agent discount rates',
                                  'Manage client bookings',
                                  'Bulk booking capabilities',
                                  'Commission-based dashboard',
                                  'Advanced booking priority'
                                ]
                              },
                              { 
                                role: 'Customer / Traveler', 
                                id: 'users-customers',
                                icon: Icons.Users,
                                color: 'bg-orange-50 text-primary border-orange-100',
                                permissions: [
                                  'Book any public tour/package',
                                  'View personal booking history',
                                  'Leave review & ratings',
                                  'Manage personal profile',
                                  'Favorite tours wishlist'
                                ]
                              }
                          ].map((r, i) => (
                              <div className="flex flex-col p-8 bg-white rounded-[10px] border border-gray-100 hover:border-primary hover:shadow-xl hover:shadow-orange-50 transition-all group">
                                  <div className="flex items-center justify-between mb-6">
                                    <div className={cn("h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner", r.color)}>
                                        <r.icon className="h-7 w-7" />
                                    </div>
                                    <button 
                                      onClick={() => setActiveMenu(r.id as MenuId)}
                                      className="text-xs font-black uppercase tracking-widest text-gray-400 hover:text-primary transition-colors flex items-center gap-2"
                                    >
                                      Manage Users <Icons.ArrowRight className="h-4 w-4" />
                                    </button>
                                  </div>
                                  
                                  <h3 className="text-xl font-black text-gray-900 mb-2 group-hover:text-primary transition-colors">{r.role}</h3>
                                  <div className="space-y-3 mt-4">
                                    {r.permissions.map((p, pi) => (
                                      <div key={pi} className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                        <Icons.CheckCircle2 className="h-4 w-4 text-orange-500 shrink-0" />
                                        {p}
                                      </div>
                                    ))}
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="mt-12 p-6 bg-gray-50 rounded-[10px] border border-gray-100 flex items-center gap-4">
                        <Icons.Info className="h-5 w-5 text-gray-400 shrink-0" />
                        <p className="text-xs text-gray-400 font-bold leading-relaxed">
                          Note: System roles are currently fixed. Manual permission overrides can be requested by contacting the technical support team.
                        </p>
                      </div>
                    </div>
                </div>
            </div>
          )}
          {activeMenu === 'urgency-points' && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <UrgencyPointManager items={urgencyPoints} />
             </div>
          )}
          {activeMenu === 'reviews' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <ReviewManager tours={tours} />
            </div>
          )}
          {activeMenu === 'communication' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <CommunicationManager />
            </div>
          )}
          {activeMenu === 'payment-settings' && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <PaymentManager />
             </div>
          )}
          {activeMenu === 'company-profile' && currentUserProfile && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <CompanyProfile userData={currentUserProfile} />
             </div>
          )}
          {activeMenu === 'general-settings' && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <GeneralSettings />
             </div>
          )}
          {activeMenu === 'backup' && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <BackupManager />
             </div>
          )}
          {activeMenu === 'popups-manager' && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <PopupManager />
             </div>
          )}
          {activeMenu === 'timeslots' && (
             <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                <BookingTimeManager />
             </div>
          )}
          {/* Add/Edit Tour View */}
          {activeMenu === 'tours' && (
            <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-white p-3 sm:p-4 rounded-[10px] border border-gray-100 shadow-xs">
                <div className="flex gap-2 overflow-x-auto select-none scrollbar-none pb-1 sm:pb-0 w-full sm:w-auto shrink-0 whitespace-nowrap">
                  <button onClick={() => { setActiveTab('basic'); setEditingId(null); }} className={cn("px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer", !editingId ? "bg-primary text-white" : "text-gray-400 hover:bg-gray-50")}>+ Add New Tour</button>
                  <button 
                    onClick={() => {
                        if (editingId) {
                          setAiGenMode('partial');
                        } else {
                          setAiGenMode('complete');
                          resetForm();
                        }
                        setShowAiModal(true);
                    }} 
                    className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg bg-primary text-white flex items-center gap-2 shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" /> {editingId ? "AI Rewrite Assistant" : "AI Magic Builder"}
                  </button>
                  <button onClick={() => setActiveMenu('all-tours')} className="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg text-gray-400 hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
                    <List className="h-4 w-4" /> View Tour List
                  </button>
                </div>
                {editingId && (
                  <button onClick={resetForm} className="text-red-600 text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-lg cursor-pointer sm:ml-auto whitespace-nowrap">
                    <X className="h-4 w-4" /> Cancel Editing
                  </button>
                )}
              </div>

              <div className="bg-white rounded-[10px] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden flex flex-col md:flex-row min-h-[700px] relative">
                
                {/* Mobile Slider Tab Navigation - Sticky and sleek */}
                <div className="md:hidden sticky top-0 z-20 w-full bg-white border-b border-gray-100 flex flex-col shrink-0">
                  <div className="flex items-center overflow-x-auto select-none scrollbar-none px-4 py-3 gap-2 scroll-smooth">
                    {tabs.map((tab) => {
                      const isActive = activeTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shrink-0 border cursor-pointer",
                            isActive 
                              ? "bg-primary text-white border-primary shadow-xs" 
                              : "bg-gray-50/70 border-gray-100 text-gray-400 hover:text-gray-600 hover:bg-gray-100/80"
                          )}
                        >
                          <tab.icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-white" : "text-gray-400")} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                    
                    {/* Fast Copy Tools inside mobile tab slider as a quick action */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCopySourceTourId('');
                        setShowCopyModal(true);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all shrink-0 border bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100 cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>Fast Copy</span>
                    </button>
                  </div>
                </div>

                {/* Desktop Sidebar Tab Navigation */}
                <div className="hidden md:flex w-64 bg-gray-50/50 border-r border-gray-100 p-6 flex-col gap-2 shrink-0">
                  <div className="mb-6 px-2">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Tour Settings</h3>
                  </div>
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all group relative overflow-hidden cursor-pointer",
                        activeTab === tab.id 
                          ? "bg-white text-primary shadow-sm border border-orange-50 translate-x-2" 
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      )}
                    >
                      {activeTab === tab.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                      <tab.icon className={cn("h-4 w-4 transition-transform group-hover:scale-110", activeTab === tab.id ? "text-primary" : "text-gray-300")} />
                      <span>{tab.label}</span>
                      {activeTab === tab.id && <ChevronRight className="ml-auto h-3 w-3 text-primary animate-pulse" />}
                    </button>
                  ))}

                  <div className="mt-auto pt-6 border-t border-gray-100 px-2 space-y-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCopySourceTourId('');
                        setShowCopyModal(true);
                      }}
                      className="w-full text-left bg-gradient-to-br from-orange-50/50 to-teal-50/30 hover:from-orange-50 hover:to-teal-50 border border-orange-100/50 rounded-xl p-3.5 space-y-1 cursor-pointer transition-all active:scale-[0.98] group"
                    >
                      <div className="flex items-center gap-1.5 text-orange-700">
                        <Copy className="h-3.5 w-3.5 group-hover:rotate-12 transition-all" />
                        <span className="text-[10px] font-black uppercase tracking-wider">Fast Copy Tools</span>
                      </div>
                      <p className="text-[9.5px] font-semibold text-gray-500 leading-normal">
                        Copy packages, Incl/Excl, FAQs, or terms from another tour with 1-click.
                      </p>
                    </button>

                    <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-50">
                      <p className="text-[9px] font-black text-primary uppercase mb-1">Status</p>
                      <div className="flex items-center gap-2">
                        <div className={cn("h-2 w-2 rounded-full", formData.status === 'published' ? 'bg-orange-500' : 'bg-amber-500')} />
                        <span className="text-[10px] font-bold text-gray-900 uppercase">{formData.status || 'Draft'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[800px] scrollbar-hide">
                  <form onSubmit={handleSubmit} className="p-4 sm:p-6 md:p-10 space-y-6 md:space-y-8">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Tour Title</label>
                        <input
                        required
                        placeholder="e.g. Bali Tropical Jungle Trek"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
                        />
                    </div>
                    {currentUserProfile?.role === 'admin' ? (
                      <div className="space-y-2">
                          <label className="text-sm font-bold text-gray-700">Assigned Supplier</label>
                          <select
                            value={formData.supplierId}
                            onChange={e => {
                              const s = users.find(u => u.uid === e.target.value);
                              setFormData({ 
                                ...formData, 
                                supplierId: e.target.value,
                                supplierName: s ? (s.companyName || s.displayName) : '',
                                supplierEmail: s ? (s.publicEmail || s.email) : ''
                              });
                            }}
                            className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all bg-white font-bold"
                          >
                            <option value="">No Supplier (Direct)</option>
                            {users.filter(u => u.role === 'supplier').map(s => {
                              const email = s.publicEmail || s.email;
                              return (
                                <option key={s.uid} value={s.uid}>
                                  {s.companyName || s.displayName} ({email || 'NO EMAIL'})
                                </option>
                              );
                            })}
                          </select>
                          {formData.supplierId && !users.find(u => u.uid === formData.supplierId)?.email && !users.find(u => u.uid === formData.supplierId)?.publicEmail && (
                            <p className="text-[10px] text-red-500 font-bold mt-1 animate-pulse">
                              ⚠️ Warning: This supplier has no email set. They will not receive booking notifications!
                            </p>
                          )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Tour Slug (URL)</label>
                        <input
                        required
                        placeholder="bali-tropical-jungle-trek"
                        value={formData.slug}
                        onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all bg-gray-50"
                        />
                      </div>
                    )}
                  </div>

                  {currentUserProfile?.role === 'admin' && (
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Tour Slug (URL)</label>
                        <input
                        required
                        placeholder="bali-tropical-jungle-trek"
                        value={formData.slug}
                        onChange={e => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                        className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all bg-gray-50"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-700">Approval Status</label>
                        <select
                          value={formData.status}
                          onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                          className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all bg-white font-bold"
                        >
                          <option value="published">Published</option>
                          <option value="pending">Pending Review</option>
                          <option value="draft">Draft</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Move Labels here for higher visibility */}
                  <div className="space-y-4 pt-4 bg-orange-50/10 p-6 rounded-2xl border border-dashed border-orange-100">
                    <div className="flex items-center justify-between">
                       <h3 className="text-sm font-black text-gray-900 border-l-4 border-primary pl-4">General Badge Labels</h3>
                       <span className="text-[10px] font-bold text-gray-400">Select badges to display on tour cards</span>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {labels.map(l => (
                        <label 
                          key={l.id}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer",
                            formData.labelIds?.includes(l.id) ? "border-primary bg-white shadow-sm" : "border-gray-50 bg-gray-50/30"
                          )}
                        >
                          <input 
                            type="checkbox"
                            className="hidden"
                            checked={formData.labelIds?.includes(l.id) || false}
                            onChange={(e) => {
                              const ids = formData.labelIds || [];
                              const newIds = e.target.checked ? [...ids, l.id] : ids.filter(id => id !== l.id);
                              
                              // Clear placements if label is removed
                              const updates: any = { labelIds: newIds };
                              if (!e.target.checked) {
                                if (formData.imageLabelId === l.id) updates.imageLabelId = '';
                                if (formData.belowTitleLabelId === l.id) updates.belowTitleLabelId = '';
                                if (formData.priceLabelId === l.id) updates.priceLabelId = '';
                              }
                              
                              setFormData({ ...formData, ...updates });
                            }}
                          />
                          <div className={cn(
                            "h-4 w-4 rounded border transition-all flex items-center justify-center shrink-0",
                            formData.labelIds?.includes(l.id) ? "bg-primary border-primary text-white" : "border-gray-300"
                          )}>
                             {formData.labelIds?.includes(l.id) && <Check className="h-3 w-3" />}
                          </div>
                          <span className="text-xs font-bold text-gray-700 truncate">{l.name}</span>
                          {l.color && (
                             <div className="h-2 w-2 rounded-full ml-auto" style={{ backgroundColor: l.color }} />
                          )}
                        </label>
                      ))}
                    </div>
                    {labels.length === 0 && (
                      <p className="text-[10px] text-gray-400 font-medium">No labels created yet. Go to Inventory &gt; General Labels to add some.</p>
                    )}

                    <div className="pt-6 mt-6 border-t border-orange-100/50">
                      <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Label Placements</h4>
                      <div className="grid md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">On Image Placement</label>
                          <select 
                            value={formData.imageLabelId || ''}
                            onChange={e => setFormData({ ...formData, imageLabelId: e.target.value })}
                            className="w-full rounded-[10px] border-2 border-gray-100 p-3 text-xs focus:border-primary focus:outline-none transition-all"
                          >
                            <option value="">No Label</option>
                            {labels.filter(l => formData.labelIds?.includes(l.id)).map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">Below Title Placement</label>
                          <select 
                            value={formData.belowTitleLabelId || ''}
                            onChange={e => setFormData({ ...formData, belowTitleLabelId: e.target.value })}
                            className="w-full rounded-[10px] border-2 border-gray-100 p-3 text-xs focus:border-primary focus:outline-none transition-all"
                          >
                            <option value="">No Label</option>
                            {labels.filter(l => formData.labelIds?.includes(l.id)).map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-gray-500 uppercase">On Price Placement</label>
                          <select 
                            value={formData.priceLabelId || ''}
                            onChange={e => setFormData({ ...formData, priceLabelId: e.target.value })}
                            className="w-full rounded-[10px] border-2 border-gray-100 p-3 text-xs focus:border-primary focus:outline-none transition-all"
                          >
                            <option value="">No Label</option>
                            {labels.filter(l => formData.labelIds?.includes(l.id)).map(l => (
                              <option key={l.id} value={l.id}>{l.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Detailed Location</label>
                      <input
                        required
                        placeholder="e.g. Ubud, Bali"
                        value={formData.location}
                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                        className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-gray-700">Duration</label>
                      <input
                        required
                        placeholder="e.g. 5 Days / 4 Nights"
                        value={formData.duration}
                        onChange={e => setFormData({ ...formData, duration: e.target.value })}
                        className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-black text-gray-900 border-l-4 border-primary pl-4">Urgency Features</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {urgencyPoints.map(point => (
                        <label 
                          key={point.id}
                          className={cn(
                            "flex items-start gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer",
                            formData.urgencyPointIds?.includes(point.id) ? "border-primary bg-orange-50/10" : "border-gray-50 bg-gray-50/30 hover:border-orange-100"
                          )}
                        >
                          <input 
                            type="checkbox"
                            className="hidden"
                            checked={formData.urgencyPointIds?.includes(point.id) || false}
                            onChange={(e) => {
                              const ids = formData.urgencyPointIds || [];
                              setFormData({
                                ...formData,
                                urgencyPointIds: e.target.checked ? [...ids, point.id] : ids.filter(id => id !== point.id)
                              });
                            }}
                          />
                          <div className={cn(
                            "h-5 w-5 rounded border-2 transition-all flex items-center justify-center mt-0.5",
                            formData.urgencyPointIds?.includes(point.id) ? "bg-primary border-primary text-white" : "border-gray-300"
                          )}>
                            {formData.urgencyPointIds?.includes(point.id) && <Check className="h-3 w-3" />}
                          </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900">{point.title}</p>
                        <p className="text-xs text-gray-500 line-clamp-1">{point.description}</p>
                      </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-black text-gray-900 border-l-4 border-primary pl-4">Available Time Slots</h3>
                    <div className="bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                        {TIME_SLOTS.map(time => (
                          <button
                            key={time}
                            type="button"
                            onClick={() => {
                              const slots = formData.timeSlots || [];
                              setFormData({
                                ...formData,
                                timeSlots: slots.includes(time) ? slots.filter(s => s !== time) : [...slots, time].sort()
                              });
                            }}
                            className={cn(
                              "py-2 rounded-lg text-[10px] font-bold border transition-all",
                              formData.timeSlots?.includes(time) ? "bg-primary text-white border-primary shadow-sm" : "bg-white text-gray-500 border-gray-100 hover:border-orange-200"
                            )}
                          >
                            {time}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <CheckCircle className="h-3 w-3 text-primary" />
                        <span className="text-[10px] font-bold text-gray-500">
                          {formData.timeSlots?.length || 0} time slot(s) selected
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6 pt-4 border-t border-gray-50 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-primary text-[10px]">Category</label>
                      <select 
                        value={formData.categoryId}
                        onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                        className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none bg-white text-sm font-bold"
                      >
                        <option value="">Select Category</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-primary text-[10px]">Tour Type</label>
                      <select 
                        value={formData.tourTypeId}
                        onChange={e => setFormData({ ...formData, tourTypeId: e.target.value })}
                        className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none bg-white text-sm font-bold"
                      >
                        <option value="">Select Type</option>
                        {tourTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-primary text-[10px]">Location Zone</label>
                      <select 
                        value={formData.locationId}
                        onChange={e => setFormData({ ...formData, locationId: e.target.value })}
                        className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none bg-white text-sm font-bold"
                      >
                        <option value="">Select Zone</option>
                        {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Description</label>
                    <textarea
                      required
                      rows={6}
                      placeholder="A compelling story about this tour..."
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Highlights & Gallery Tab */}
              {activeTab === 'content' && (
                <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Layout className="h-4 w-4 text-primary" /> Tour Highlights (One per line)
                    </label>
                    <textarea
                      rows={8}
                      placeholder="Visit sacred temples&#10;Sunset dinner on the beach&#10;Private jungle trek..."
                      value={highlightsText}
                      onChange={e => setHighlightsText(e.target.value)}
                      className="w-full rounded-[10px] border-2 border-gray-100 p-4 font-medium focus:border-primary focus:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-4 pt-6 border-t border-gray-50">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-gray-900 border-l-4 border-blue-600 pl-3">Gallery (Select Featured Image)</h3>
                      <div className="flex gap-2.5">
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={isUploading}
                          />
                          <button type="button" className="text-orange-700 text-sm font-bold flex items-center gap-1 py-1.5 px-3 bg-orange-50 rounded-lg border border-orange-100 hover:bg-orange-100 transition-colors">
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            Upload New Images
                          </button>
                        </div>
                        
                        <button 
                          type="button" 
                          onClick={() => {
                            openMediaGallery((urls) => {
                              const currentGallery = formData.gallery || [];
                              setFormData({ ...formData, gallery: [...currentGallery, ...urls] });
                            }, true);
                          }}
                          className="text-blue-700 text-sm font-bold flex items-center gap-1 py-1.5 px-3 bg-blue-50 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors"
                        >
                          <ImageIcon className="h-4 w-4" />
                          Pick From Gallery
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                       {formData.gallery?.map((url, i) => {
                        const isFeatured = formData.featuredImage === url;
                        return (
                          <div key={i} className={cn("relative aspect-square overflow-hidden rounded-[10px] bg-gray-100 group border-2 transition-all", isFeatured ? "border-primary ring-4 ring-orange-50" : "border-gray-100")}>
                            <img src={url} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                               <button 
                                 type="button"
                                 onClick={() => setFormData({ ...formData, featuredImage: url })}
                                 className="px-3 py-1 bg-white text-gray-900 text-xs font-black uppercase rounded-[5px] hover:bg-primary hover:text-white transition-all"
                               >
                                 {isFeatured ? 'Featured' : 'Set Featured'}
                               </button>
                               <button 
                                type="button" 
                                onClick={() => {
                                  if (isFeatured) setFormData({ ...formData, featuredImage: '' });
                                  removeArrayItem('gallery', i);
                                }} 
                                className="px-3 py-1 bg-red-600 text-white text-xs font-black uppercase rounded-[5px] hover:bg-red-700 transition-all"
                              >
                                Delete
                              </button>
                            </div>
                            {isFeatured && (
                              <div className="absolute top-2 left-2 bg-primary text-white p-1 rounded-full shadow-lg">
                                <Star className="h-3 w-3 fill-current" />
                              </div>
                            )}
                          </div>
                        );
                       })}
                    </div>
                  </div>

                    <div className="space-y-4 pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="h-4 w-4 text-orange-500" />
                        <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Free Map Builder (OpenStreetMap)</h4>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500">Search Location</label>
                        <OSMLocationSelector onLocationSelect={(embedUrl) => {
                          setFormData({ ...formData, locationMapUrl: embedUrl });
                        }} />
                        <p className="text-[10px] text-primary/60 font-medium italic px-1">
                          Type a place name to instantly generate a free OpenStreetMap embed.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-gray-500">Map Embed URL (iframe src)</label>
                        <input
                          placeholder="https://www.openstreetmap.org/export/embed.html?..."
                          value={formData.locationMapUrl}
                          onChange={e => setFormData({ ...formData, locationMapUrl: e.target.value })}
                          className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all font-mono text-[10px]"
                        />
                      </div>
                    </div>

                </div>
              )}

               {/* Inclusions & Exclusions Tab */}
              {activeTab === 'inclusions' && (
                <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                   <div className="space-y-4">
                    <label className="text-sm font-bold text-primary flex items-center gap-2 uppercase tracking-tight text-[10px]">
                      <CheckCircle className="h-4 w-4" /> General Inclusions (One per line)
                    </label>
                    <textarea 
                      rows={8}
                      value={inclusionsText}
                      onChange={e => setInclusionsText(e.target.value)}
                      placeholder="e.g. Safety Equipment&#10;Professional Guide"
                      className="w-full rounded-[10px] border-2 border-gray-100 p-4 text-sm focus:border-primary focus:outline-none font-medium min-h-[150px]"
                    />
                  </div>

                  <div className="space-y-4">
                    <label className="text-sm font-bold text-red-600 flex items-center gap-2 uppercase tracking-tight text-[10px]">
                      <X className="h-4 w-4" /> General Exclusions (One per line)
                    </label>
                    <textarea 
                      rows={8}
                      value={exclusionsText}
                      onChange={e => setExclusionsText(e.target.value)}
                      placeholder="e.g. Personal Expenses&#10;Gratuities"
                      className="w-full rounded-[10px] border-2 border-gray-100 p-4 text-sm focus:border-red-400 focus:outline-none font-medium min-h-[150px]"
                    />
                  </div>
                </div>
              )}

              {/* Pricing Tab */}
              {activeTab === 'pricing' && (
                <div className="space-y-12 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                  <div className="grid md:grid-cols-2 gap-6 p-6 bg-gray-50 rounded-[10px] border-2 border-dashed border-gray-200">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-gray-500">Display Price (Starts From)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="number"
                          required
                          value={formData.regularPrice || ''}
                          onChange={e => setFormData({ ...formData, regularPrice: Number(e.target.value) })}
                          className="w-full rounded-[10px] border-2 border-white bg-white p-4 pl-12 text-2xl font-black text-primary shadow-sm focus:border-primary focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-xs font-semibold text-gray-500">Discount Info (Optional)</label>
                       <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                          type="number"
                          value={formData.discountPrice || ''}
                          onChange={e => setFormData({ ...formData, discountPrice: Number(e.target.value) })}
                          className="w-full rounded-[10px] border-2 border-white bg-white p-4 pl-12 text-2xl font-black text-secondary shadow-sm focus:border-secondary focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6 p-6 bg-blue-50/50 rounded-[10px] border border-blue-100">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-blue-800 flex items-center gap-2 uppercase tracking-tight text-[10px]">
                        <Icons.Users className="h-4 w-4" /> Daily Capacity
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 20"
                        value={formData.maxCapacity || ''}
                        onChange={e => setFormData({ ...formData, maxCapacity: Number(e.target.value) })}
                        className="w-full rounded-[10px] border-2 border-white bg-white p-4 font-bold text-gray-900 focus:border-blue-400 focus:outline-none transition-all"
                      />
                      <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-1">Total participants allowed per day</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-blue-800 flex items-center gap-2 uppercase tracking-tight text-[10px]">
                        <Icons.Clock4 className="h-4 w-4" /> Capacity Per Slot (Optional)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 10"
                        value={formData.slotCapacity || ''}
                        onChange={e => setFormData({ ...formData, slotCapacity: Number(e.target.value) })}
                        className="w-full rounded-[10px] border-2 border-white bg-white p-4 font-bold text-gray-900 focus:border-blue-400 focus:outline-none transition-all"
                      />
                      <p className="text-[9px] text-blue-500 font-bold uppercase tracking-widest mt-1">Leave blank to use Daily Capacity for slots</p>
                    </div>
                  </div>

                  {/* Complex Packages Section */}
                  <div className="space-y-8">
                     <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black text-gray-900 tracking-tight">Tiered Pricing Packages</h3>
                        <button 
                          type="button" 
                          onClick={() => addArrayItem('packages', { name: '', details: '', inclusions: [], exclusions: [], meetingPoint: '', meetingPointType: 'Meeting Point', tiers: [{ minParticipants: 1, maxParticipants: 1, adultPrice: 0, childPrice: 0 }] })} 
                          className="flex items-center gap-2 rounded-[10px] bg-primary px-6 py-2 text-sm font-bold text-white shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all"
                        >
                          <PlusCircle className="h-4 w-4" /> New Package
                        </button>
                    </div>

                    <div className="space-y-12">
                      {formData.packages?.map((pkg, pIdx) => (
                        <div key={pIdx} className="relative rounded-[15px] border-2 border-gray-100 bg-white shadow-sm group overflow-hidden transition-all hover:border-orange-100">
                          <div 
                            className="p-5 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 transition-colors" 
                            onClick={() => setExpandedPackages(prev => prev.includes(pIdx) ? prev.filter(i => i !== pIdx) : [...prev, pIdx])}
                          >
                             <div className="flex items-center gap-4">
                                <div className={cn(
                                  "h-10 w-10 rounded-xl flex items-center justify-center font-black transition-all shadow-sm",
                                  expandedPackages.includes(pIdx) ? "bg-primary text-white scale-110" : "bg-white text-gray-400 border border-gray-100"
                                )}>
                                   {pIdx + 1}
                                </div>
                                <div>
                                   <h4 className="font-black text-gray-900 tracking-tight">{pkg.name || `Unnamed Package`}</h4>
                                   {pkg.tiers && pkg.tiers.length > 0 && !expandedPackages.includes(pIdx) && (
                                     <p className="text-[10px] font-bold text-primary uppercase tracking-widest mt-0.5">
                                       {pkg.tiers.length} Pricing {pkg.tiers.length === 1 ? 'Tier' : 'Tiers'}
                                     </p>
                                   )}
                                </div>
                             </div>
                             <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                   <button 
                                     type="button" 
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       const clonedPkg = { ...pkg, name: `${pkg.name} (Copy)` };
                                       const currentPackages = [...(formData.packages || [])];
                                       currentPackages.splice(pIdx + 1, 0, clonedPkg);
                                       setFormData({ ...formData, packages: currentPackages });
                                       setExpandedPackages(prev => [...prev.map(i => i > pIdx ? i + 1 : i), pIdx + 1]);
                                     }}
                                     className="p-2 text-orange-400 hover:text-primary hover:bg-orange-50 rounded-lg transition-all"
                                     title="Clone Package"
                                   >
                                     <Copy className="h-5 w-5" />
                                   </button>
                                   <button 
                                     type="button" 
                                     onClick={(e) => { e.stopPropagation(); removeArrayItem('packages', pIdx); }}
                                     className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                     title="Delete Package"
                                   >
                                     <Trash2 className="h-5 w-5" />
                                   </button>
                                </div>
                                <div className="w-px h-6 bg-gray-200 mx-1" />
                                <ChevronDown className={cn("h-6 w-6 text-gray-400 transition-transform duration-500", expandedPackages.includes(pIdx) && "rotate-180")} />
                             </div>
                          </div>

                          {expandedPackages.includes(pIdx) && (
                            <div className="p-8 space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2">
                              {/* Package Header */}
                              <div className="space-y-4">
                                <div className="grid md:grid-cols-2 gap-6">
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Package Name</label>
                                    <input
                                      value={pkg.name}
                                      onChange={e => {
                                        const newPkg = { ...pkg, name: e.target.value };
                                        updateArrayItem('packages', pIdx, newPkg);
                                      }}
                                      className="w-full rounded-[10px] border-2 border-gray-100 p-4 font-bold text-primary focus:border-primary focus:outline-none transition-all"
                                      placeholder="e.g. Silver Package"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Package Details / Intro</label>
                                    <input
                                      value={pkg.details || ''}
                                      onChange={e => {
                                        const newPkg = { ...pkg, details: e.target.value };
                                        updateArrayItem('packages', pIdx, newPkg);
                                      }}
                                      className="w-full rounded-[10px] border-2 border-gray-100 p-4 font-medium text-sm focus:border-primary focus:outline-none transition-all"
                                      placeholder="A brief explanation of this package option..."
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Tiers Table */}
                              <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pricing Tiers</h4>
                                  <button 
                                    type="button" 
                                    onClick={() => {
                                      const newPkg = { ...pkg, tiers: [...pkg.tiers, { minParticipants: 1, maxParticipants: 1, adultPrice: 0, childPrice: 0 }] };
                                      updateArrayItem('packages', pIdx, newPkg);
                                    }}
                                    className="text-xs font-bold text-primary hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-all"
                                  >
                                    + Add Tier
                                  </button>
                                </div>
                                <div className="overflow-hidden rounded-[15px] border border-gray-100 shadow-sm">
                                  <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                      <tr>
                                        <th className="px-6 py-4">Min Pax</th>
                                        <th className="px-6 py-4">Max Pax</th>
                                        <th className="px-6 py-4">Adult ($)</th>
                                        <th className="px-6 py-4">Child ($)</th>
                                        <th className="px-6 py-4"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {pkg.tiers.map((tier, tIdx) => (
                                        <tr key={tIdx} className="hover:bg-gray-50/50 transition-colors">
                                          <td className="px-6 py-4">
                                            <input 
                                              type="number" 
                                              value={tier.minParticipants} 
                                              onChange={e => {
                                                const newTiers = [...pkg.tiers];
                                                newTiers[tIdx] = { ...tier, minParticipants: Number(e.target.value) };
                                                updateArrayItem('packages', pIdx, { ...pkg, tiers: newTiers });
                                              }}
                                              className="w-16 rounded-[8px] border-2 border-gray-50 p-2 font-bold text-center focus:border-primary focus:outline-none" 
                                            />
                                          </td>
                                          <td className="px-6 py-4">
                                            <input 
                                              type="number" 
                                              value={tier.maxParticipants} 
                                              onChange={e => {
                                                const newTiers = [...pkg.tiers];
                                                newTiers[tIdx] = { ...tier, maxParticipants: Number(e.target.value) };
                                                updateArrayItem('packages', pIdx, { ...pkg, tiers: newTiers });
                                              }}
                                              className="w-16 rounded-[8px] border-2 border-gray-50 p-2 font-bold text-center focus:border-primary focus:outline-none" 
                                            />
                                          </td>
                                          <td className="px-6 py-4">
                                            <input 
                                              type="number" 
                                              value={tier.adultPrice} 
                                              onChange={e => {
                                                const newTiers = [...pkg.tiers];
                                                newTiers[tIdx] = { ...tier, adultPrice: Number(e.target.value) };
                                                updateArrayItem('packages', pIdx, { ...pkg, tiers: newTiers });
                                              }}
                                              className="w-24 rounded-[8px] border-2 border-gray-50 p-2 font-black text-primary focus:border-primary focus:outline-none" 
                                            />
                                          </td>
                                          <td className="px-6 py-4">
                                            <input 
                                              type="number" 
                                              value={tier.childPrice} 
                                              onChange={e => {
                                                const newTiers = [...pkg.tiers];
                                                newTiers[tIdx] = { ...tier, childPrice: Number(e.target.value) };
                                                updateArrayItem('packages', pIdx, { ...pkg, tiers: newTiers });
                                              }}
                                              className="w-24 rounded-[8px] border-2 border-gray-50 p-2 font-black text-secondary focus:border-secondary focus:outline-none" 
                                            />
                                          </td>
                                          <td className="px-6 py-4">
                                            <button 
                                              type="button" 
                                              onClick={() => {
                                                const newTiers = [...pkg.tiers];
                                                newTiers.splice(tIdx, 1);
                                                updateArrayItem('packages', pIdx, { ...pkg, tiers: newTiers });
                                              }}
                                              className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                              <MinusCircle className="h-4 w-4" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>

                              {/* Package Inclusions/Exclusions */}
                              <div className="grid md:grid-cols-2 gap-8 pt-6 border-t border-gray-50">
                                <div className="space-y-4">
                                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inclusions (One per line)</label>
                                   <textarea 
                                     rows={5}
                                     placeholder="e.g. Hotel pickup&#10;Mineral water"
                                     value={(pkg.inclusions || []).join('\n')}
                                     onChange={e => {
                                       updateArrayItem('packages', pIdx, { ...pkg, inclusions: e.target.value.split('\n') });
                                     }}
                                     className="w-full rounded-xl border-2 border-gray-50 p-4 text-xs font-medium focus:border-primary focus:outline-none min-h-[120px] bg-gray-50/30"
                                   />
                                </div>
                                <div className="space-y-4">
                                   <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Exclusions (One per line)</label>
                                   <textarea 
                                     rows={5}
                                     placeholder="e.g. Lunch&#10;Gratuities"
                                     value={(pkg.exclusions || []).join('\n')}
                                     onChange={e => {
                                       updateArrayItem('packages', pIdx, { ...pkg, exclusions: e.target.value.split('\n') });
                                     }}
                                     className="w-full rounded-xl border-2 border-gray-50 p-4 text-xs font-medium focus:border-amber-200 focus:outline-none min-h-[120px] bg-gray-50/30"
                                   />
                                </div>
                              </div>

                              {/* Meeting Point / Pickup Location Section */}
                              <div className="pt-8 border-t-2 border-dashed border-gray-50 space-y-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center text-primary">
                                      <MapPin className="h-4 w-4" />
                                    </div>
                                    <h4 className="text-sm font-black text-gray-900 uppercase tracking-tight">Location Details</h4>
                                  </div>
                                  <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-100">
                                    <button
                                      type="button"
                                      onClick={() => updateArrayItem('packages', pIdx, { ...pkg, meetingPointType: 'Meeting Point' })}
                                      className={cn(
                                        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                        (pkg.meetingPointType === 'Meeting Point' || !pkg.meetingPointType) ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                                      )}
                                    >
                                      Meeting Point
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateArrayItem('packages', pIdx, { ...pkg, meetingPointType: 'Pick up Location' })}
                                      className={cn(
                                        "px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all",
                                        pkg.meetingPointType === 'Pick up Location' ? "bg-white text-primary shadow-sm" : "text-gray-400 hover:text-gray-600"
                                      )}
                                    >
                                      Pick up Location
                                    </button>
                                  </div>
                                </div>

                                <div className="grid gap-6">
                                  <div className="space-y-4">
                                    <div className="space-y-2">
                                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                        Location Address
                                      </label>
                                      <textarea
                                        rows={2}
                                        placeholder="Enter the meeting point address or pick up area..."
                                        value={pkg.meetingPoint || ''}
                                        onChange={e => updateArrayItem('packages', pIdx, { ...pkg, meetingPoint: e.target.value })}
                                        className="w-full rounded-xl border-2 border-gray-100 p-4 text-xs font-bold focus:border-primary outline-none transition-all"
                                      />
                                      <p className="text-[9px] text-gray-400 font-medium italic">Example: Sanur Beach Harbor or Jimbaran Area Hotels</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Itinerary Tab */}
              {activeTab === 'itinerary' && (
                <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 border-l-4 border-blue-600 pl-3 uppercase tracking-wider text-sm">Day-by-Day Journey</h3>
                    <button type="button" onClick={() => addArrayItem('itinerary', { day: (formData.itinerary?.length || 0) + 1, title: '', description: '' })} className="font-bold text-blue-600 flex items-center gap-2">
                       <PlusCircle className="h-5 w-5" /> Add New Day
                    </button>
                  </div>
                   <div className="space-y-6">
                    {formData.itinerary?.map((item, i) => (
                      <div key={i} className="group relative border-2 border-gray-100 rounded-[15px] transition-all bg-white shadow-sm overflow-hidden hover:border-blue-100">
                        <div 
                          className="p-5 bg-gray-50/50 border-b border-gray-100 flex items-center justify-between cursor-pointer hover:bg-gray-100/50 transition-colors"
                          onClick={() => setExpandedItinerary(prev => prev.includes(i) ? prev.filter(idx => idx !== i) : [...prev, i])}
                        >
                           <div className="flex items-center gap-4">
                              <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center font-black transition-all shadow-sm",
                                expandedItinerary.includes(i) ? "bg-blue-600 text-white scale-110" : "bg-white text-gray-400 border border-gray-100"
                              )}>
                                 {item.day}
                              </div>
                              <div>
                                 <h4 className="font-black text-gray-900 tracking-tight">{item.title || `Day ${item.day}`}</h4>
                                 {!expandedItinerary.includes(i) && item.description && (
                                   <p className="text-[10px] font-bold text-gray-400 line-clamp-1 mt-0.5">{item.description}</p>
                                 )}
                              </div>
                           </div>
                           <div className="flex items-center gap-3">
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); removeArrayItem('itinerary', i); }} 
                                className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                title="Delete Day"
                              >
                                 <Trash2 className="h-5 w-5"/>
                              </button>
                              <div className="w-px h-6 bg-gray-200 mx-1" />
                              <ChevronDown className={cn("h-6 w-6 text-gray-400 transition-transform duration-500", expandedItinerary.includes(i) && "rotate-180")} />
                           </div>
                        </div>

                        {expandedItinerary.includes(i) && (
                          <div className="p-8 space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2">
                            <input 
                              placeholder="Day Title (e.g. Arrival & Discovery)"
                              value={item.title} 
                              onChange={e => updateArrayItem('itinerary', i, { ...item, title: e.target.value })}
                              className="w-full font-black text-2xl mb-1 border-none focus:ring-0 p-0 text-gray-900 placeholder:text-gray-200"
                            />
                            
                            <div className="space-y-4 pt-4 border-t border-gray-50">
                              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Arrival / Pick-up Details</label>
                              <div className="flex gap-6 items-start">
                                <div className="flex-1 bg-gray-50/50 p-4 rounded-xl border-2 border-gray-50 focus-within:border-blue-200 focus-within:bg-white transition-all">
                                  <input 
                                    placeholder="Pick Up details (e.g. 08:30 AM at Hotel Lobby)"
                                    value={typeof item.pickup === 'object' ? item.pickup?.description : item.pickup || ''} 
                                    onChange={e => updateArrayItem('itinerary', i, { 
                                      ...item, 
                                      pickup: { ...(typeof item.pickup === 'object' ? item.pickup : {}), description: e.target.value } 
                                    })}
                                    className="w-full text-sm font-bold text-blue-600 bg-transparent border-none focus:ring-0 p-0 placeholder:text-blue-200"
                                  />
                                </div>
                                <div className="w-32 aspect-video rounded-[10px] bg-gray-50 border-2 border-dashed border-gray-200 overflow-hidden relative group shadow-inner">
                                   {typeof item.pickup === 'object' && item.pickup?.image ? (
                                     <>
                                       <img src={item.pickup.image} className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                          <button 
                                            type="button" 
                                            onClick={() => {
                                              openMediaGallery((urls) => {
                                                if (urls[0]) {
                                                  updateArrayItem('itinerary', i, { 
                                                    ...item, 
                                                    pickup: { ...(typeof item.pickup === 'object' ? item.pickup : {}), image: urls[0], description: typeof item.pickup === 'object' ? item.pickup?.description || '' : item.pickup || '' } 
                                                  });
                                                }
                                              }, false);
                                            }} 
                                            className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition-colors"
                                            title="Change Image from Gallery"
                                          >
                                            <ImageIcon className="h-4 w-4" />
                                          </button>
                                          <button type="button" onClick={() => updateArrayItem('itinerary', i, { ...item, pickup: { ...item.pickup, image: '' } })} className="bg-red-600 text-white p-2 rounded-full hover:bg-red-700 transition-colors" title="Delete Image"><Trash2 className="h-4 w-4" /></button>
                                       </div>
                                     </>
                                   ) : (
                                     <div className="h-full w-full flex flex-col justify-center items-center p-2 relative">
                                        <div className="flex gap-2 mb-1.5 shrink-0 z-10">
                                          {/* Upload */}
                                          <div className="relative">
                                            <button type="button" className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 p-1.5 rounded-md text-xs font-bold leading-none shrink-0 shadow-xs flex items-center justify-center">
                                              <Upload className="h-3.5 w-3.5 text-gray-400" />
                                            </button>
                                            <input 
                                              type="file" 
                                              onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                  try {
                                                    const url = await uploadImage(file);
                                                    updateArrayItem('itinerary', i, { 
                                                      ...item, 
                                                      pickup: { ...(typeof item.pickup === 'object' ? item.pickup : {}), image: url, description: typeof item.pickup === 'object' ? item.pickup?.description || '' : item.pickup || '' } 
                                                    });
                                                  } catch (err) {
                                                    alert("Failed to upload pickup image");
                                                  }
                                                }
                                              }} 
                                              className="absolute inset-0 opacity-0 cursor-pointer" 
                                            />
                                          </div>
                                          
                                          {/* Gallery */}
                                          <button 
                                            type="button" 
                                            onClick={() => {
                                              openMediaGallery((urls) => {
                                                if (urls[0]) {
                                                  updateArrayItem('itinerary', i, { 
                                                    ...item, 
                                                    pickup: { ...(typeof item.pickup === 'object' ? item.pickup : {}), image: urls[0], description: typeof item.pickup === 'object' ? item.pickup?.description || '' : item.pickup || '' } 
                                                  });
                                                }
                                              }, false);
                                            }}
                                            className="bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-600 p-1.5 rounded-md text-xs font-bold leading-none shrink-0 shadow-xs flex items-center justify-center"
                                          >
                                            <ImageIcon className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                        <span className="text-[8px] text-gray-400 font-extrabold uppercase scale-90">Image</span>
                                     </div>
                                   )}
                                </div>
                              </div>
                            </div>

                            <div className="grid md:grid-cols-4 gap-8 pt-4 border-t border-gray-50">
                              <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Main Description</label>
                                <textarea 
                                  placeholder="What will happen on this day? Be descriptive and engaging..."
                                  rows={6}
                                  value={item.description}
                                  onChange={e => updateArrayItem('itinerary', i, { ...item, description: e.target.value })}
                                  className="w-full text-sm font-medium text-gray-600 border-none focus:ring-0 p-0 bg-transparent scrollbar-hide min-h-[150px]"
                                />
                              </div>
                              <div className="md:col-span-2 space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex justify-between items-center">
                                  <span>Featured Day Image</span>
                                </label>
                                <div className="relative aspect-video rounded-2xl bg-gray-100 border-4 border-white shadow-xl overflow-hidden group">
                                   {item.image ? (
                                     <>
                                       <img src={item.image} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                          <button 
                                            type="button" 
                                            onClick={() => {
                                              openMediaGallery((urls) => {
                                                if (urls[0]) {
                                                  updateArrayItem('itinerary', i, { ...item, image: urls[0] });
                                                }
                                              }, false);
                                            }} 
                                            className="bg-blue-600 text-white p-3 rounded-full hover:bg-blue-700 transition-colors shadow-lg"
                                            title="Change image from Gallery"
                                          >
                                            <ImageIcon className="h-6 w-6" />
                                          </button>
                                          <button type="button" onClick={() => updateArrayItem('itinerary', i, { ...item, image: '' })} className="bg-red-600 text-white p-3 rounded-full hover:bg-red-700 transition-colors shadow-lg" title="Delete image"><Trash2 className="h-6 w-6" /></button>
                                       </div>
                                     </>
                                   ) : (
                                     <div className="h-full w-full flex flex-col items-center justify-center gap-3 bg-gray-50/50 p-6">
                                       <div className="flex gap-4">
                                         {/* Drop/Upload */}
                                         <div className="relative">
                                           <button type="button" className="flex items-center gap-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 duration-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm">
                                             <Upload className="h-4 w-4 text-gray-500" />
                                             Upload Image
                                           </button>
                                           <input type="file" onChange={(e) => handleItineraryImageUpload(i, e)} className="absolute inset-0 opacity-0 cursor-pointer" />
                                         </div>
                                         
                                         {/* Gallery */}
                                         <button 
                                           type="button" 
                                           onClick={() => {
                                             openMediaGallery((urls) => {
                                               if (urls[0]) {
                                                 updateArrayItem('itinerary', i, { ...item, image: urls[0] });
                                               }
                                             }, false);
                                           }}
                                           className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-600 duration-200 px-4 py-2 rounded-xl text-xs font-bold shadow-sm"
                                         >
                                           <ImageIcon className="h-4 w-4" />
                                           Pick Gallery
                                         </button>
                                       </div>
                                       <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Choose featured photo for Day {item.day}</span>
                                     </div>
                                   )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add-ons Selection Tab */}
              {activeTab === 'addOns' && (
                <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                   <div className="bg-orange-50 p-6 rounded-[10px] border border-orange-100 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                         <PlusCircle className="h-6 w-6" />
                      </div>
                      <div>
                         <h4 className="font-black text-gray-900 text-sm tracking-tight">Global Add-ons Selection</h4>
                         <p className="text-xs text-gray-500 font-medium">Select the add-ons available for this specific tour.</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {globalAddOns.map(addon => {
                        const isSelected = formData.addOnIds?.includes(addon.id);
                        return (
                          <div 
                            key={addon.id} 
                            onClick={() => {
                              const currentIds = formData.addOnIds || [];
                              const newIds = isSelected 
                                ? currentIds.filter(id => id !== addon.id)
                                : [...currentIds, addon.id];
                              setFormData({ ...formData, addOnIds: newIds });
                            }}
                            className={cn(
                              "p-6 rounded-[10px] border-2 transition-all cursor-pointer flex items-center justify-between group",
                              isSelected ? "border-primary bg-orange-50/20" : "border-gray-100 bg-white hover:border-orange-200"
                            )}
                          >
                             <div className="flex items-center gap-3">
                                <div className={cn("h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all", isSelected ? "bg-primary border-primary" : "border-gray-200")}>
                                   {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
                                </div>
                                <div>
                                   <p className="font-bold text-gray-900 group-hover:text-primary transition-colors text-sm">{addon.name}</p>
                                   <p className="text-xs font-bold text-primary tracking-tight">{formatPrice(addon.price)} / {addon.unit}</p>
                                </div>
                             </div>
                          </div>
                        );
                      })}
                      {globalAddOns.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 font-bold border-2 border-dashed border-gray-100 rounded-[10px]">
                           No global add-ons found. Please create them in the Add-ons Menu.
                        </div>
                      )}
                   </div>
                </div>
              )}

              {/* Transports Selection Tab */}
              {activeTab === 'transports' && (
                <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                   <div className="bg-orange-50 p-6 rounded-[10px] border border-orange-100 flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center text-primary shadow-sm">
                         <Car className="h-6 w-6" />
                      </div>
                      <div>
                         <h4 className="font-black text-gray-900 text-sm tracking-tight">Global Transports & Meeting Point Configuration</h4>
                         <p className="text-xs text-gray-500 font-medium">Configure meeting points and toggle transfer options available for this specific tour.</p>
                      </div>
                   </div>

                   {(() => {
                     const rawAddress = formData.meetingPoint || "";
                     const urlRegex = /(https?:\/\/[^\s]+)/g;
                     const match = rawAddress.match(urlRegex);
                     const currentLink = match ? match[0] : "";
                     const currentTitle = rawAddress.replace(urlRegex, "").replace(/^[\s\-,.:;]+|[\s\-,.:;]+$/g, "").trim();

                     return (
                       <div className="space-y-4 bg-white p-6 rounded-[10px] border border-gray-100 shadow-sm">
                         <h4 className="font-bold text-sm text-gray-900 border-b border-gray-50 pb-2 flex items-center gap-2">
                           <MapPin className="h-4 w-4 text-primary" />
                           Default Meeting Point Details
                         </h4>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <label className="text-xs font-semibold text-gray-500 block">The Location Title</label>
                             <input 
                               placeholder="e.g. Gorilla ATV Adventure Basecamp"
                               value={currentTitle}
                               onChange={e => {
                                 const newTitle = e.target.value;
                                 setFormData({
                                   ...formData,
                                   meetingPoint: currentLink ? `${newTitle}\n${currentLink}` : newTitle
                                 });
                               }}
                               className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all font-bold text-gray-800"
                             />
                           </div>
                           
                           <div className="space-y-2">
                             <label className="text-xs font-semibold text-gray-500 block">Google Maps Link</label>
                             <input 
                               placeholder="e.g. https://maps.app.goo.gl/nM2C85Qdv4BQ4BgE6"
                               value={currentLink}
                               onChange={e => {
                                 const newLink = e.target.value;
                                 setFormData({
                                   ...formData,
                                   meetingPoint: newLink ? `${currentTitle}\n${newLink}` : currentTitle
                                 });
                               }}
                               className="w-full rounded-[10px] border-2 border-gray-100 p-4 focus:border-primary focus:outline-none transition-all font-bold text-gray-800"
                             />
                           </div>
                         </div>
                         <p className="text-xs text-gray-400">
                           This title and clickable map link will be displayed to customers when they select the self-arrival ("Own Transport") option on checkout and in confirmations.
                         </p>
                       </div>
                     );
                   })()}

                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {globalTransports.map(t => {
                        const isSelected = formData.transportIds?.includes(t.id);
                        return (
                          <div 
                            key={t.id} 
                            onClick={() => {
                              const currentIds = formData.transportIds || [];
                              const newIds = isSelected 
                                ? currentIds.filter(id => id !== t.id)
                                : [...currentIds, t.id];
                              setFormData({ ...formData, transportIds: newIds });
                            }}
                            className={cn(
                              "p-6 rounded-[10px] border-2 transition-all cursor-pointer flex flex-col justify-between group",
                              isSelected ? "border-primary bg-orange-50/20" : "border-gray-100 bg-white hover:border-orange-200"
                            )}
                          >
                             <div className="flex items-center gap-3">
                                <div className={cn("h-6 w-6 rounded-md border-2 flex items-center justify-center transition-all", isSelected ? "bg-primary border-primary" : "border-gray-200")}>
                                   {isSelected && <CheckCircle className="h-4 w-4 text-white" />}
                                </div>
                                <div>
                                   <p className="font-bold text-gray-900 group-hover:text-primary transition-colors text-sm">{t.name}</p>
                                   <p className="text-xs font-black text-gray-400 uppercase tracking-wider block mt-0.5">Type: {t.type}</p>
                                   <p className="text-xs font-bold text-primary tracking-tight mt-1">
                                     {t.type === 'meet' ? 'Free' : `${formatPrice(t.price)} / ${t.priceType === 'per_person' ? 'person' : 'vehicle'}`}
                                   </p>
                                </div>
                             </div>
                          </div>
                        );
                      })}
                      {globalTransports.length === 0 && (
                        <div className="col-span-full py-12 text-center text-gray-400 font-bold border-2 border-dashed border-gray-100 rounded-[10px]">
                           No global transport options found. Please create them in the Global Transports Menu.
                        </div>
                      )}
                   </div>
                </div>
              )}

              {/* Important Info Tab */}
              {activeTab === 'info' && (
                <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-gray-900 tracking-tight">Dynamic Info Sections</h3>
                      <p className="text-sm text-gray-500 font-medium">Add sections like "What to Bring", "Cancellation Policy", etc.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => addArrayItem('infoSections', { title: '', content: [] })}
                      className="bg-primary text-white px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" /> Add Section
                    </button>
                  </div>
                  
                  <div className="space-y-6">
                    {formData.infoSections?.map((section, sIdx) => (
                      <div key={sIdx} className="p-6 bg-gray-50 rounded-[15px] border border-gray-100 relative group">
                        <button 
                          type="button" 
                          onClick={() => removeArrayItem('infoSections', sIdx)}
                          className="absolute top-4 right-4 text-red-300 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Section Title</label>
                            <input 
                              placeholder="e.g. What to Bring"
                              value={section.title}
                              onChange={e => {
                                const newSections = [...(formData.infoSections || [])];
                                newSections[sIdx] = { ...newSections[sIdx], title: e.target.value };
                                setFormData({ ...formData, infoSections: newSections });
                              }}
                              className="w-full bg-white rounded-xl border-2 border-gray-100 p-4 text-lg font-black text-gray-900 focus:outline-none focus:border-primary transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Content (One item per line)</label>
                            <textarea 
                              rows={5}
                              placeholder="Point 1&#10;Point 2&#10;Point 3..."
                              value={Array.isArray(section.content) ? section.content.join('\n') : ''}
                              onChange={e => {
                                const newSections = [...(formData.infoSections || [])];
                                newSections[sIdx] = { ...newSections[sIdx], content: e.target.value.split('\n') };
                                setFormData({ ...formData, infoSections: newSections });
                              }}
                              className="w-full bg-white rounded-xl border-2 border-gray-100 p-4 text-sm font-medium focus:border-primary focus:outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!formData.infoSections || formData.infoSections.length === 0) && (
                      <div className="py-20 text-center border-2 border-dashed border-gray-200 rounded-[20px]">
                        <ShieldAlert className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold uppercase text-xs tracking-widest">No info sections added yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* FAQ Tab */}
              {activeTab === 'faq' && (
                <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-black text-gray-900 tracking-tight">Frequently Asked Questions</h3>
                    <button 
                      type="button" 
                      onClick={() => addArrayItem('faqs', { question: '', answer: '' })} 
                      className="text-xs font-black text-primary uppercase tracking-widest hover:underline flex items-center gap-2"
                    >
                      <PlusCircle className="h-4 w-4" /> Add Question
                    </button>
                  </div>
                  
                  <div className="space-y-8">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-gray-400 tracking-widest uppercase">Policy & Terms (Direct Content)</label>
                        <textarea 
                          rows={6}
                          placeholder="General policy and terms for this tour..."
                          value={formData.importantInfo || ''}
                          onChange={e => setFormData({ ...formData, importantInfo: e.target.value })}
                          className="w-full rounded-[10px] border-2 border-gray-100 p-4 text-sm font-medium focus:border-primary focus:outline-none transition-all"
                        />
                    </div>

                    <div className="space-y-6">
                      {formData.faqs?.map((faq, fIdx) => (
                        <div key={fIdx} className="space-y-3 p-6 bg-gray-50 rounded-[15px] relative group border border-gray-100">
                          <button 
                            type="button" 
                            onClick={() => removeArrayItem('faqs', fIdx)}
                            className="absolute top-4 right-4 text-red-300 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Question</label>
                            <input
                              placeholder="e.g. Is lunch included?"
                              value={faq.question}
                              onChange={e => {
                                const newFaqs = [...(formData.faqs || [])];
                                newFaqs[fIdx] = { ...faq, question: e.target.value };
                                setFormData({ ...formData, faqs: newFaqs });
                              }}
                              className="w-full font-bold text-gray-900 border-b-2 border-gray-200 bg-transparent py-2 focus:border-primary focus:outline-none transition-all"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Detailed Answer</label>
                            <textarea
                              placeholder="Write the response here..."
                              rows={3}
                              value={faq.answer}
                              onChange={e => {
                                const newFaqs = [...(formData.faqs || [])];
                                newFaqs[fIdx] = { ...faq, answer: e.target.value };
                                setFormData({ ...formData, faqs: newFaqs });
                              }}
                              className="w-full text-sm font-medium text-gray-600 bg-white rounded-xl p-4 focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm"
                            />
                          </div>
                        </div>
                      ))}
                      {(!formData.faqs || formData.faqs.length === 0) && (
                        <div className="py-12 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest">
                          No FAQs added for this tour yet.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'seo' && (
                <div className="space-y-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
                  <div className="bg-orange-50/30 p-8 rounded-3xl border border-dashed border-orange-100 mb-8">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="h-12 w-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-primary border border-orange-50">
                        <Icons.Search className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-900 tracking-tight">Search Engine Optimization</h3>
                        <p className="text-gray-500 font-medium text-sm leading-relaxed">Customize how this tour appears on Google, Bing, and Social Media.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center justify-between">
                          Meta Title
                          <span className={cn("text-[9px] font-bold", (formData.seo?.title || '').length > 60 ? "text-amber-500" : "text-gray-300")}>
                            {(formData.seo?.title || '').length} / 60
                          </span>
                        </label>
                        <input 
                          value={formData.seo?.title || ''}
                          onChange={e => setFormData({ ...formData, seo: { ...formData.seo, title: e.target.value } })}
                          className="w-full rounded-2xl border-2 border-gray-100 p-4 font-bold text-sm focus:border-primary focus:outline-none transition-all"
                          placeholder="Recommended: Max 60 characters"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1 flex items-center justify-between">
                          Meta Description
                          <span className={cn("text-[9px] font-bold", (formData.seo?.description || '').length > 160 ? "text-amber-500" : "text-gray-300")}>
                            {(formData.seo?.description || '').length} / 160
                          </span>
                        </label>
                        <textarea 
                          rows={4}
                          value={formData.seo?.description || ''}
                          onChange={e => setFormData({ ...formData, seo: { ...formData.seo, description: e.target.value } })}
                          className="w-full rounded-2xl border-2 border-gray-100 p-4 font-medium text-sm focus:border-primary focus:outline-none transition-all min-h-[120px]"
                          placeholder="Short summary for search results (Max 160 chars)"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">Keywords</label>
                        <input 
                          value={formData.seo?.keywords || ''}
                          onChange={e => setFormData({ ...formData, seo: { ...formData.seo, keywords: e.target.value } })}
                          className="w-full rounded-2xl border-2 border-gray-100 p-4 font-bold text-sm focus:border-primary focus:outline-none transition-all"
                          placeholder="e.g. bali trekking, mount batur, sunrise tour"
                        />
                      </div>

                      <div className="space-y-4">
                        <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-1">OG Image (Social Preview)</label>
                        <div className="flex gap-4 items-start">
                          <div className="w-32 aspect-video rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 overflow-hidden relative group shrink-0">
                            {formData.seo?.ogImage ? (
                              <img 
                                src={formData.seo.ogImage} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                                alt="SEO Preview"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                <Icons.Image className="h-6 w-6 mb-1" />
                                <span className="text-[8px] font-black">No Preview</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                              <Icons.Upload className="h-5 w-5 text-white" />
                              <input 
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    try {
                                      const url = await uploadImage(file);
                                      setFormData({ ...formData, seo: { ...formData.seo, ogImage: url } });
                                    } catch (err) {
                                      alert("Upload failed.");
                                    }
                                  }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                            </div>
                          </div>
                          <div className="flex-1 space-y-2">
                            <p className="text-[9px] font-bold text-gray-400 uppercase">Image URL (recommended 1200x630px)</p>
                            <input 
                              value={formData.seo?.ogImage || ''}
                              onChange={e => setFormData({ ...formData, seo: { ...formData.seo, ogImage: e.target.value } })}
                              placeholder="https://..."
                              className="w-full rounded-xl border border-gray-100 p-3 text-xs focus:border-primary focus:outline-none transition-all"
                            />
                            {formData.featuredImage && !formData.seo?.ogImage && (
                              <button 
                                type="button"
                                onClick={() => setFormData({ ...formData, seo: { ...formData.seo, ogImage: formData.featuredImage } })}
                                className="text-[9px] font-black text-primary uppercase hover:underline"
                              >
                                Use Featured Image as OG Image
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 mt-4">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Google Search Preview</h4>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-1.5 max-w-xl">
                      <div className="flex items-center gap-2 text-[11px] text-gray-600">
                        <span>gorillaatvadventure.com</span>
                        <span>›</span>
                        <span className="text-gray-400">tours</span>
                        <span>›</span>
                        <span className="text-gray-400">{formData.slug || 'tour-slug'}</span>
                      </div>
                      <h5 className="text-xl text-blue-800 hover:underline cursor-pointer font-medium leading-tight line-clamp-1">
                        {formData.seo?.title || formData.title || 'Tour Title – Gorilla ATV Adventure'}
                      </h5>
                      <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
                        {formData.seo?.description || (highlightsText ? highlightsText.split('\n')[0] : 'Discover the beauty of Bali with this amazing tour experience...') }
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="pt-8 border-t border-gray-100 flex justify-end gap-4">
                 <button
                  type="submit"
                  className="flex items-center gap-2 rounded-[10px] bg-primary px-12 py-4 font-black text-white transition-all hover:bg-orange-700 hover:shadow-2xl active:scale-95 shadow-lg shadow-orange-200"
                >
                  <Save className="h-5 w-5" />
                  {editingId ? 'UPDATE TOUR' : 'PUBLISH TOUR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}

      {/* Supplier & Agent Management */}
      {(activeMenu === 'suppliers' || activeMenu === 'agents') && (
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
          {selectedPartner ? (
            <div className="space-y-8">
              <button 
                onClick={() => setSelectedPartner(null)}
                className="flex items-center gap-2 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-all"
              >
                <Icons.ArrowLeft className="h-4 w-4" /> Back to Listing
              </button>

              <div className="bg-white rounded-[10px] border border-gray-100 p-10 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-[0.03]">
                  <Icons.Users className="h-40 w-40" />
                </div>
                
                <div className="relative flex flex-col md:flex-row md:items-center gap-8 border-b border-gray-100 pb-10 mb-10">
                  <img src={selectedPartner.photoURL} className="h-24 w-24 rounded-[10px] border-4 border-gray-50 shadow-sm" referrerPolicy="no-referrer" />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <h3 className="text-3xl font-black text-gray-900 tracking-tight">{selectedPartner.displayName}</h3>
                       <span className={cn(
                         "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                         selectedPartner.role === 'supplier' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                       )}>
                         {selectedPartner.role}
                       </span>
                    </div>
                    <p className="text-gray-500 font-medium tracking-tight">Joined {selectedPartner.createdAt?.toDate ? format(selectedPartner.createdAt.toDate(), 'MMMM d, yyyy') : 'Unknown'}</p>
                    <div className="flex flex-wrap gap-6 mt-6">
                      <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl">
                        <Icons.Mail className="h-4 w-4 text-primary" />
                        <span className="text-xs font-black text-gray-700 tracking-tight">{selectedPartner.email}</span>
                      </div>
                      <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl">
                        <Icons.Phone className="h-4 w-4 text-primary" />
                        <span className="text-xs font-black text-gray-700 tracking-tight">{selectedPartner.phoneNumber || 'No Whatsapp'}</span>
                      </div>
                      <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl">
                        <Icons.Briefcase className="h-4 w-4 text-primary" />
                        <span className="text-xs font-black text-gray-700 tracking-tight">{selectedPartner.companyName || 'No Company Name'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => setSelectedPartner({...selectedPartner, _isEditing: !(selectedPartner as any)._isEditing} as any)}
                      className={cn(
                        "px-6 py-3 rounded-[10px] text-[10px] font-black uppercase tracking-widest transition-all shadow-sm",
                        (selectedPartner as any)._isEditing ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {(selectedPartner as any)._isEditing ? 'View Stats' : 'Edit Company Details'}
                    </button>
                  </div>
                </div>

                <div className="grid lg:grid-cols-12 gap-10">
                  <div className="lg:col-span-8 space-y-10">
                    {(selectedPartner as any)._isEditing ? (
                       <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-4">
                          <CompanyProfile userData={selectedPartner} isAdminEdit={true} />
                       </div>
                    ) : (
                       <div className="relative grid md:grid-cols-2 gap-10">
                        <div className="space-y-10">
                           {selectedPartner.role === 'supplier' ? (
                             <div className="space-y-6">
                                <h4 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                                  <Icons.Map className="h-5 w-5 text-primary" /> Owned Tours ({tours.filter(t => t.supplierId === selectedPartner.uid).length})
                                </h4>
                                <div className="space-y-3">
                                   {tours.filter(t => t.supplierId === selectedPartner.uid).slice(0, 5).map(tour => (
                                     <div key={tour.id} className="p-4 bg-gray-50 rounded-[10px] border border-gray-100 flex items-center justify-between hover:border-primary transition-all group">
                                        <div className="flex items-center gap-3">
                                           <img src={tour.gallery[0] || ''} className="h-10 w-10 rounded-[10px] object-cover shadow-sm" />
                                           <div>
                                              <p className="text-sm font-black text-gray-900 group-hover:text-primary transition-colors">{tour.title}</p>
                                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{tour.location}</p>
                                           </div>
                                        </div>
                                        <Icons.ArrowRight className="h-4 w-4 text-gray-300" />
                                     </div>
                                   ))}
                                </div>
                             </div>
                           ) : (
                             <div className="space-y-6">
                                <h4 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                                  <Icons.Briefcase className="h-5 w-5 text-primary" /> Agent Bookings ({bookings.filter(b => b.userId === selectedPartner.uid).length})
                                </h4>
                                <div className="space-y-3">
                                   {bookings.filter(b => b.userId === selectedPartner.uid).slice(0, 5).map(booking => (
                                     <div key={booking.id} className="p-4 bg-gray-50 rounded-[10px] border border-gray-100 flex items-center justify-between hover:border-primary transition-all group">
                                        <div>
                                           <p className="text-sm font-black text-gray-900 group-hover:text-primary transition-colors">{booking.tourTitle}</p>
                                           <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{booking.date} • {booking.participants.adults} Pax</p>
                                        </div>
                                        <span className="text-[10px] font-black uppercase text-primary bg-orange-50 px-2 py-0.5 rounded-md">{booking.status}</span>
                                     </div>
                                   ))}
                                </div>
                             </div>
                           )}

                           <div className="space-y-6">
                              <h4 className="text-lg font-black text-gray-900 tracking-tight flex items-center gap-2">
                                <Icons.BarChart3 className="h-5 w-5 text-primary" /> Performance metrics
                              </h4>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-6 bg-orange-50 rounded-[10px] border border-orange-100">
                                   <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Total Value</p>
                                   <p className="text-2xl font-black text-orange-900">
                                     {formatPrice(bookings.filter(b => (selectedPartner.role === 'supplier' ? b.supplierId : b.userId) === selectedPartner.uid && b.status === 'confirmed').reduce((acc, b) => acc + b.totalAmount, 0))}
                                   </p>
                                </div>
                                <div className="p-6 bg-blue-50 rounded-[10px] border border-blue-100">
                                   <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Share Value</p>
                                   <p className="text-2xl font-black text-blue-900">
                                     {selectedPartner.role === 'supplier' 
                                       ? formatPrice(bookings.filter(b => b.supplierId === selectedPartner.uid && b.status === 'confirmed').reduce((acc, b) => acc + (b.supplierEarnings || 0), 0))
                                       : formatPrice(bookings.filter(b => b.userId === selectedPartner.uid && b.status === 'confirmed').reduce((acc, b) => acc + (b.agentDiscount || 0), 0))}
                                   </p>
                                </div>
                              </div>
                           </div>
                        </div>

                        <div className="p-8 bg-gray-50 rounded-[10px] border border-gray-100">
                           <div className="flex items-center gap-3 mb-6 text-gray-900">
                              <Icons.Lock className="h-4 w-4" />
                              <h5 className="font-black text-sm uppercase tracking-widest">Financial Setup</h5>
                           </div>
                           <div className="space-y-6">
                              <div className="flex items-center justify-between p-4 bg-white rounded-[10px] border border-gray-100">
                                 <span className="text-sm font-medium text-gray-500">{selectedPartner.role === 'supplier' ? 'Commission Rate' : 'Discount Rate'}</span>
                                 <span className="text-lg font-black text-gray-900">{selectedPartner.role === 'supplier' ? selectedPartner.commissionRate : selectedPartner.discountRate}%</span>
                              </div>
                              <button 
                                onClick={() => setActiveMenu('users')}
                                className="w-full py-4 bg-white border border-gray-200 rounded-2xl text-xs font-black uppercase tracking-widest hover:border-primary transition-all text-gray-600 shadow-sm"
                              >
                                Update Financial Terms
                              </button>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="lg:col-span-4 space-y-6">
                    <div className="bg-gray-50 rounded-[10px] p-8 border border-gray-100">
                      <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-6">Partner Info</h4>
                      <div className="space-y-4">
                        <div className="p-4 bg-white rounded-2xl border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Company</p>
                          <p className="text-sm font-bold text-gray-900">{selectedPartner.companyName || 'N/A'}</p>
                        </div>
                        <div className="p-4 bg-white rounded-2xl border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Public Email</p>
                          <p className="text-sm font-bold text-gray-900">{selectedPartner.publicEmail || selectedPartner.email}</p>
                        </div>
                        <div className="p-4 bg-white rounded-2xl border border-gray-100">
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">WhatsApp</p>
                          <p className="text-sm font-bold text-gray-900">{selectedPartner.phoneNumber || 'N/A'}</p>
                        </div>
                      </div>
                      
                      {! (selectedPartner as any)._isEditing && (
                        <button 
                          onClick={() => setSelectedPartner({...selectedPartner, _isEditing: true} as any)}
                          className="w-full mt-6 py-4 border-2 border-dashed border-gray-200 rounded-2xl text-[10px] font-black uppercase text-gray-400 hover:border-primary hover:text-primary transition-all"
                        >
                          Quick Edit Profile
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <PartnerListing 
              type={activeMenu === 'suppliers' ? 'supplier' : 'agent'} 
              users={users} 
              onSelect={setSelectedPartner} 
              onDelete={handleDeleteUser}
              resetForm={resetForm}
              setFormData={setFormData}
              formData={formData}
              setActiveMenu={setActiveMenu}
              onViewTours={(u) => {
                setTourSupplierFilter(u.uid);
                setActiveMenu('all-tours');
              }}
              allTours={tours}
            />
          )}
        </div>
      )}

      {/* Other Views Placeholders */}
        {['schedule', 'payments'].includes(activeMenu) && (
           <div className="h-[70vh] flex flex-col items-center justify-center bg-white rounded-[10px] border border-gray-100 border-dashed motion-safe:animate-in motion-safe:fade-in">
              <div className="h-20 w-20 bg-orange-50 rounded-full flex items-center justify-center mb-6">
                {menuItems.find(m => m.id === activeMenu)?.icon && (
                  (() => {
                    const Icon = menuItems.find(m => m.id === activeMenu)?.icon;
                    return <Icon className="h-10 w-10 text-primary" />;
                  })()
                )}
              </div>
              <h3 className="text-2xl font-black tracking-tight text-gray-900 mb-2">
                {activeMenuItemLabel} Module
              </h3>
              <p className="text-gray-400 font-medium">This professional suite is currently being optimized for your workflow.</p>
           </div>
        )}

        </div>
      </main>

      {/* Global Booking Modals */}
      <AnimatePresence>
        {isAssignOpen && assignBooking && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssignOpen(false)}
              className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-black text-gray-900">Assign Guide</h3>
                <button onClick={() => setIsAssignOpen(false)} className="text-gray-400 hover:text-gray-900">
                  <Icons.X className="h-6 w-6" />
                </button>
              </div>
              
              <p className="text-sm text-gray-500 font-medium">Select a guide to send the tour details via WhatsApp.</p>

              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                {allGuides.map(guide => {
                  const isAlreadyBooked = bookings.some(b => 
                    b.assignedGuideId === guide.id && 
                    b.date === assignBooking.date && 
                    b.id !== assignBooking.id &&
                    b.status !== 'cancelled'
                  );

                  return (
                    <button 
                      key={guide.id}
                      disabled={isAlreadyBooked || loadingStates.assigningGuide}
                      onClick={() => handleAssignToGuide(assignBooking, guide)}
                      className={cn(
                        "w-full p-4 rounded-2xl border transition-all text-left group flex items-center justify-between",
                        (isAlreadyBooked || loadingStates.assigningGuide)
                          ? "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed" 
                          : "border-gray-100 hover:border-orange-500 hover:bg-orange-50"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center font-black transition-all",
                          (isAlreadyBooked || loadingStates.assigningGuide)
                            ? "bg-gray-200 text-gray-400" 
                            : "bg-orange-50 text-primary group-hover:bg-primary group-hover:text-white"
                        )}>
                          {loadingStates.assigningGuide ? <Icons.Loader2 className="h-4 w-4 animate-spin" /> : guide.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <p className={cn("font-black", isAlreadyBooked ? "text-gray-400" : "text-gray-900 group-hover:text-orange-700")}>{guide.name}</p>
                             {isAlreadyBooked && (
                               <span className="text-[9px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md uppercase tracking-tighter">Unavailable Today</span>
                             )}
                          </div>
                          <p className="text-[10px] font-bold text-gray-400">+{guide.whatsapp}</p>
                        </div>
                      </div>
                      {!isAlreadyBooked && <Icons.ArrowRight className="h-4 w-4 text-orange-200 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />}
                      {isAlreadyBooked && <Icons.Ban className="h-4 w-4 text-gray-300" />}
                    </button>
                  );
                })}
                {allGuides.length === 0 && (
                  <p className="text-center py-10 text-xs font-bold text-gray-400 uppercase tracking-widest">No active guides found.</p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <BookingDetailModal 
        isOpen={isBookingDetailOpen}
        onClose={() => { setIsBookingDetailOpen(false); setIsEditingTrip(false); }}
        booking={globalSelectedBooking}
        setBooking={setGlobalSelectedBooking}
        isEditingTrip={isEditingTrip}
        setIsEditingTrip={setIsEditingTrip}
        tours={tours}
        newNote={newNote}
        setNewNote={setNewNote}
        handleAddInternalNote={handleAddInternalNote}
        handleSaveBookingChange={handleSaveBookingChange}
        handlePrintManifest={handlePrintManifest}
        handleDeleteBooking={handleDeleteBooking}
        sendBookingEmail={sendBookingEmail}
        formatPrice={formatPrice}
        userRole={currentUserProfile?.role}
        loadingStates={loadingStates}
        updateBookingStatus={updateBookingStatus}
        onAssignGuide={(b) => { setAssignBooking(b); setIsAssignOpen(true); }}
      />

      <AnimatePresence>
        {showAiModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isAiBuilding && setShowAiModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[32px] overflow-hidden shadow-2xl"
            >
              <div className="bg-primary p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight">AI Tour Magic</h3>
                    <p className="text-white/80 font-medium text-sm">Describe your tour, we'll build the details.</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Wand2 className="h-3 w-3" /> Your Tour Prompt or Itinerary
                  </label>
                  <textarea
                    rows={6}
                    placeholder="e.g. Create a 3-day luxury tour in Ubud featuring Tegalalang Rice Terrace, Monkey Forest, and private yoga sessions. High-end dining at Locavore included."
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="w-full rounded-2xl border-2 border-gray-100 p-6 focus:border-primary focus:outline-none bg-gray-50/50 transition-all font-medium text-sm leading-relaxed"
                  />
                  <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl">
                    <Lightbulb className="h-5 w-5 text-primary shrink-0" />
                    <div className="space-y-1">
                      <p className="text-[11px] text-orange-800 font-bold leading-relaxed">
                        Best Prompt Tip:
                      </p>
                      <p className="text-[10px] text-orange-700/80 font-medium leading-relaxed">
                        "Tell a story about a day in Ubud. We'll start with coffee at a local farm, then hike the Campuhan Ridge for views, and finish with a sunset dinner. Focus on the authentic Bali vibe."
                      </p>
                      <p className="text-[9px] text-primary/60 mt-1">
                        *AI will automatically add Hotel Pick-up & Drop-off.
                      </p>
                    </div>
                  </div>
                </div>

                {editingId && (
                  <div className="space-y-2 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">AI Generation Mode</label>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <button
                        type="button"
                        onClick={() => setAiGenMode('partial')}
                        className={cn(
                          "px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                          aiGenMode === 'partial'
                            ? "bg-primary text-white border-primary shadow-md shadow-orange-100"
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        Rewrite Details Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiGenMode('complete')}
                        className={cn(
                          "px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border",
                          aiGenMode === 'complete'
                            ? "bg-primary text-white border-primary shadow-md shadow-orange-100"
                            : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                        )}
                      >
                        Complete Rebuild
                      </button>
                    </div>
                    <p className="text-[9.5px] text-gray-400 font-semibold leading-relaxed mt-1">
                      {aiGenMode === 'partial' 
                        ? "AI updates description, highlights, inclusions, exclusions, and terms. Preserves existing packages (pricing) and daily itinerary."
                        : "AI completely replaces every single setting of this tour with freshly generated content, including Title and Itinerary."
                      }
                    </p>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    disabled={isAiBuilding}
                    onClick={() => setShowAiModal(false)}
                    className="flex-1 px-8 py-4 rounded-xl border border-gray-100 font-black text-xs text-gray-500 uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={isAiBuilding || !aiPrompt.trim()}
                    onClick={handleAiGenerate}
                    className="flex-[2] bg-primary text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isAiBuilding ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Mastering Your Tour...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Tour Magic
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showCopyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCopyModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[32px] overflow-hidden shadow-2xl z-10"
            >
              <div className="bg-gradient-to-r from-teal-600 to-primary p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    <Copy className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black tracking-tight font-sans">Fast Copy Elements</h3>
                    <p className="text-teal-50 font-medium text-xs">Instantly copy components of another tour and save valuable time.</p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block animate-pulse">Select Source Tour</label>
                  <select
                    value={selectedCopySourceTourId}
                    onChange={(e) => setSelectedCopySourceTourId(e.target.value)}
                    className="w-full rounded-xl border-2 border-gray-100 p-4 focus:border-orange-500 focus:outline-none bg-gray-50/50 transition-all font-bold text-sm text-gray-700 cursor-pointer"
                  >
                    <option value="">-- Choose an Existing Tour to Copy From --</option>
                    {tours
                      .filter(t => t.id !== editingId)
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))
                    }
                  </select>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">Select Elements to Copy</label>
                  <div className="grid grid-cols-2 gap-3.5">
                    <label className={cn(
                      "flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer select-none transition-all",
                      copyPackages ? "bg-orange-50/40 border-orange-200 text-orange-950" : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={copyPackages} 
                        onChange={() => setCopyPackages(!copyPackages)}
                        className="rounded accent-primary"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-black uppercase">Packages & Pricing</span>
                      </div>
                    </label>

                    <label className={cn(
                      "flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer select-none transition-all",
                      copyInclusions ? "bg-orange-50/40 border-orange-200 text-orange-950" : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={copyInclusions} 
                        onChange={() => setCopyInclusions(!copyInclusions)}
                        className="rounded accent-primary"
                      />
                      <span className="text-xs font-black uppercase">Inclusions & Exclusions</span>
                    </label>

                    <label className={cn(
                      "flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer select-none transition-all",
                      copyFaqs ? "bg-orange-50/40 border-orange-200 text-orange-950" : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={copyFaqs} 
                        onChange={() => setCopyFaqs(!copyFaqs)}
                        className="rounded accent-primary"
                      />
                      <span className="text-xs font-black uppercase">FAQs & Policies</span>
                    </label>

                    <label className={cn(
                      "flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer select-none transition-all",
                      copyImportantInfo ? "bg-orange-50/40 border-orange-200 text-orange-950" : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={copyImportantInfo} 
                        onChange={() => setCopyImportantInfo(!copyImportantInfo)}
                        className="rounded accent-primary"
                      />
                      <span className="text-xs font-black uppercase">Important Info / Terms</span>
                    </label>

                    <label className={cn(
                      "flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer select-none transition-all",
                      copyHighlights ? "bg-orange-50/40 border-orange-200 text-orange-950" : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={copyHighlights} 
                        onChange={() => setCopyHighlights(!copyHighlights)}
                        className="rounded accent-primary"
                      />
                      <span className="text-xs font-black uppercase">Highlights</span>
                    </label>

                    <label className={cn(
                      "flex items-center gap-3 p-3.5 border rounded-xl cursor-pointer select-none transition-all",
                      copyItinerary ? "bg-orange-50/40 border-orange-200 text-orange-950" : "bg-white border-gray-100 text-gray-500 hover:bg-gray-50"
                    )}>
                      <input 
                        type="checkbox" 
                        checked={copyItinerary} 
                        onChange={() => setCopyItinerary(!copyItinerary)}
                        className="rounded accent-primary"
                      />
                      <span className="text-xs font-black uppercase">Itinerary</span>
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCopyModal(false)}
                    className="flex-1 px-8 py-4 rounded-xl border border-gray-100 font-black text-xs text-gray-500 uppercase tracking-widest hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!selectedCopySourceTourId}
                    onClick={handleFastCopyContent}
                    className="flex-[2] bg-primary text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-orange-100 hover:bg-orange-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <Copy className="h-4 w-4" />
                    Copy selected items
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Reusable Platform Media Gallery Modal */}
        {isGalleryOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsGalleryOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-4xl bg-white rounded-[32px] overflow-hidden shadow-2xl z-10 flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 md:p-8 text-white relative shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsGalleryOpen(false)} 
                  className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <ImageIcon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                      Media Gallery <span className="bg-white/20 text-[10px] tracking-wider font-extrabold px-2.5 py-0.5 rounded-full uppercase">Explore & Pick</span>
                    </h3>
                    <p className="text-white/80 font-medium text-xs md:text-sm mt-1">Select from images uploaded across all your tours, blogs, and itineraries.</p>
                  </div>
                </div>
              </div>

              {/* Subheader / Search & Tags */}
              <div className="p-4 md:p-6 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/50 shrink-0">
                <div className="relative w-full md:max-w-xs">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search image URL or source..."
                    value={gallerySearch}
                    onChange={(e) => setGallerySearch(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold leading-none focus:outline-none focus:border-blue-500 transition-all"
                  />
                </div>
                
                <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none py-1">
                  {['all', 'unsplash', 'imgbb', 'other'].map(tab => (
                    <button
                      type="button"
                      key={tab}
                      onClick={() => setGalleryFilterTab(tab)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border shrink-0",
                        galleryFilterTab === tab
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "bg-white border-gray-200 text-gray-400 hover:text-gray-700"
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Grid Content */}
              <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50/30">
                {loadingGallery ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Scanning platform media...</p>
                  </div>
                ) : filteredGalleryUrls.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-2xl bg-white">
                    <ImageIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">No images found</p>
                    <p className="text-[10px] text-gray-400/80 font-medium">Try checking other categories or upload a new image first.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {filteredGalleryUrls.map((url) => {
                      const isSelected = gallerySelected.includes(url);
                      return (
                        <div 
                          key={url}
                          onClick={() => handleToggleSelectImage(url)}
                          className={cn(
                            "relative aspect-square rounded-2xl overflow-hidden cursor-pointer group border-4 transition-all duration-300 shadow-sm bg-white",
                            isSelected
                              ? "border-blue-600 ring-4 ring-blue-50"
                              : "border-transparent hover:border-gray-100"
                          )}
                        >
                          <img src={url} alt="" className="h-full w-full object-cover group-hover:scale-105 duration-500 transition-transform" referrerPolicy="no-referrer" />
                          <div className={cn(
                            "absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center",
                            isSelected ? "opacity-100 bg-blue-600/30" : "opacity-0 group-hover:opacity-100"
                          )}>
                            {isSelected ? (
                              <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg transform scale-110 duration-200">
                                <Check className="h-5 w-5 stroke-[3]" />
                              </div>
                            ) : (
                              <span className="bg-white/95 text-gray-900 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                {isMultiSelect ? 'Select' : 'Choose'}
                              </span>
                            )}
                          </div>
                          
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/85 text-white/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            title="Open direct image link"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-6 md:p-8 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 shrink-0">
                <div className="leading-tight">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Selection Overview</span>
                  <span className="text-xs font-black text-gray-700">
                    Selected {gallerySelected.length} {isMultiSelect ? '' : '(Max 1)'} image{gallerySelected.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsGalleryOpen(false)}
                    className="px-6 py-3 rounded-xl border border-gray-200 font-black text-xs text-gray-500 uppercase tracking-widest hover:bg-white bg-transparent transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={gallerySelected.length === 0}
                    onClick={handleConfirmPickImages}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Use Selected ({gallerySelected.length})
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Image Converter Success Status Dashboard */}
      <AnimatePresence>
        {optToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed bottom-6 right-6 z-[9999] bg-white border border-gray-100 p-4 rounded-xl shadow-2xl shadow-orange-500/10 max-w-sm w-full font-sans overflow-hidden flex flex-col gap-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-gray-900 tracking-tight">WebP Converter Active</h4>
                  <p className="text-[10px] font-bold text-gray-405 text-primary">Successfully Optimized</p>
                </div>
              </div>
              <button 
                onClick={() => setOptToast(null)}
                className="text-gray-300 hover:text-gray-500 transition-colors p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-2.5 flex flex-col gap-1.5 text-xs font-mono">
              <div className="flex justify-between items-center text-gray-500 text-[10px]">
                <span>Original file</span>
                <span className="truncate max-w-[120px] font-semibold" title={optToast.originalName}>{optToast.originalName}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500 text-[10px]">
                <span>Format converted</span>
                <span className="font-extrabold text-primary bg-orange-50 px-1.5 py-0.5 rounded text-[9px] uppercase">webp</span>
              </div>
              <div className="h-px bg-gray-100" />
              <div className="flex justify-between items-center">
                <span className="text-gray-600 font-bold">Size saved</span>
                <span className="text-primary font-black">-{optToast.percentSaved}%</span>
              </div>
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-gray-400">File footprint</span>
                <span className="text-gray-700 font-bold">
                  {optToast.originalSizeKb > 1024 ? `${(optToast.originalSizeKb/1024).toFixed(1)} MB` : `${optToast.originalSizeKb} KB`} → <span className="text-primary font-black">{optToast.optimizedSizeKb > 1024 ? `${(optToast.optimizedSizeKb/1024).toFixed(1)} MB` : `${optToast.optimizedSizeKb} KB`}</span>
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 text-[9px] font-semibold text-gray-400 select-none">
              <Check className="h-3 w-3 text-orange-500" />
              <span>Reduced raw footprint for lightning-fast loads!</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
