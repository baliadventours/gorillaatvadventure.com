import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { 
  Star, 
  MessageCircle, 
  Send, 
  Globe, 
  Calendar, 
  Image as ImageIcon, 
  Camera, 
  Loader2, 
  User, 
  Flag,
  CheckCircle2,
  Plus,
  X
} from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, where } from 'firebase/firestore';
import { Review } from '../../types';
import { cn } from '../../lib/utils';
import { uploadImage } from '../../lib/imgbb';
import SmartImage from '../SmartImage';
import { motion, AnimatePresence } from 'motion/react';

interface ReviewSectionProps {
  tourId: string;
}

const COUNTRIES = [
  "Australia", "United States", "United Kingdom", "Germany", "France", "Japan", 
  "Singapore", "Malaysia", "China", "Indonesia", "Canada", "Netherlands", 
  "Russia", "South Korea", "India", "Other"
];

export default function ReviewSection({ tourId }: ReviewSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form State
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [name, setName] = useState(auth.currentUser?.displayName || '');
  const [nationality, setNationality] = useState('');
  const [tourDate, setTourDate] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [userAvatar, setUserAvatar] = useState(auth.currentUser?.photoURL || '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [honeypot, setHoneypot] = useState(''); // Anti-spam honeypot

  const [isMobile, setIsMobile] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [showWriteModal, setShowWriteModal] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'reviews'),
      where('tourId', '==', tourId)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Review[];
        const filtered = data
          .filter((r: any) => r.status === 'approved')
          .sort((a: any, b: any) => {
            const timeA = a.createdAt?.seconds 
              ? a.createdAt.seconds * 1000 + (a.createdAt.nanoseconds || 0) / 1000000
              : (a.createdAt instanceof Date ? a.createdAt.getTime() : typeof a.createdAt === 'number' ? a.createdAt : 0);
            const timeB = b.createdAt?.seconds 
              ? b.createdAt.seconds * 1000 + (b.createdAt.nanoseconds || 0) / 1000000
              : (b.createdAt instanceof Date ? b.createdAt.getTime() : typeof b.createdAt === 'number' ? b.createdAt : 0);
            return timeB - timeA;
          });
        setReviews(filtered);
      },
      (error) => {
        console.error("Reviews snapshot error:", error);
      }
    );

    return unsubscribe;
  }, [tourId]);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (images.length + files.length > 5) {
      alert("Maximum 5 images allowed per review");
      return;
    }

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadImage(file));
      const urls = await Promise.all(uploadPromises);
      setImages(prev => [...prev, ...urls]);
    } catch (error) {
      alert("Failed to upload some images. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Anti-spam check: Honeypot
    if (honeypot) {
      console.warn("Spam detected via honeypot");
      return;
    }

    if (!auth.currentUser) {
      alert("Please login to leave a review");
      return;
    }

    if (!nationality) {
      alert("Please select your nationality");
      return;
    }

    if (comment.length < 50) {
      alert("Feedback is too short. Please provide at least 50 characters to help other travelers.");
      return;
    }

    // Anti-spam: Check for repetitive characters or words
    const repetitiveCharRegex = /(.)\1{9,}/; // Same character 10+ times
    if (repetitiveCharRegex.test(comment)) {
      alert("Please provide a more detailed and natural review.");
      return;
    }

    const words = comment.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    if (words.length > 20 && uniqueWords.size / words.length < 0.3) {
      alert("Please provide a more detailed and unique review.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get tour title for the review record
      const tourSnap = await getDoc(doc(db, 'tours', tourId));
      const tourTitle = tourSnap.exists() ? tourSnap.data().title : 'Unknown Tour';

      await addDoc(collection(db, 'reviews'), {
        tourId,
        tourTitle,
        userId: auth.currentUser.uid,
        userName: name || 'Anonymous',
        userPhoto: userAvatar || auth.currentUser.photoURL || '',
        nationality,
        tourDate,
        rating,
        title,
        comment,
        image: images[0] || '', // Keep for backward compatibility
        images: images,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      
      alert("Review submitted! It will be visible after approval.");
      
      // Reset form
      setComment('');
      setTitle('');
      setRating(5);
      setNationality('');
      setTourDate('');
      setImages([]);
      setUserAvatar(auth.currentUser?.photoURL || '');
    } catch (error) {
      console.error("Error adding review", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const averageRating = reviews.filter(r => r.rating).length > 0 
    ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : "0";

  return (
    <div id="reviews" className="space-y-8 scroll-mt-[116px]">
      {/* Header with stats and Write Review Trigger */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Traveler Reviews</h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span className="text-xs font-black text-amber-600">{averageRating}</span>
            </div>
            <span className="text-xs font-bold text-gray-400">Based on {reviews.length} experiences</span>
          </div>
        </div>
        
        <button 
          onClick={() => setShowWriteModal(true)}
          className="flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100 active:scale-95 transition-all w-full md:w-auto"
        >
          <Plus className="h-4 w-4" /> Write a Review
        </button>
      </div>

      {/* Reviews Slider */}
      <div className="relative group -mx-4 px-4 overflow-hidden">
        <div className="flex overflow-x-auto gap-4 pb-8 scroll-smooth snap-x snap-mandatory no-scrollbar px-1">
          {reviews.length === 0 ? (
            <div className="w-full py-16 bg-gray-50 rounded-3xl border border-dashed border-gray-200 text-center flex flex-col justify-center items-center">
              <MessageCircle className="h-10 w-10 text-gray-300 mb-2" />
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">No reviews yet</p>
              <button 
                onClick={() => setShowWriteModal(true)}
                className="mt-4 text-xs font-black text-primary hover:underline"
              >
                Be the first to review
              </button>
            </div>
          ) : (
            <>
              {reviews.slice(0, 5).map((review) => (
                <div 
                  key={review.id} 
                  className="w-[280px] sm:w-[320px] shrink-0 snap-start snap-always bg-white p-6 rounded-3xl flex flex-col border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)]"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i} 
                          className={cn(
                            "h-3 w-3",
                            i < (review.rating || 5) ? "fill-amber-500 text-amber-500" : "fill-gray-100 text-gray-100"
                          )} 
                        />
                      ))}
                    </div>
                    {review.tourDate && (
                      <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{review.tourDate}</span>
                    )}
                  </div>
                  
                  <blockquote className="flex-1 space-y-3 mb-6">
                    {review.title && (
                      <h4 className="text-sm font-black text-gray-900 leading-tight">"{review.title}"</h4>
                    )}
                    <p className="text-xs leading-relaxed text-gray-500 font-medium line-clamp-4 italic">
                      {review.comment}
                    </p>
                  </blockquote>

                  <div className="flex items-center gap-3 pt-4 border-t border-gray-50">
                    <div className="h-10 w-10 rounded-full bg-orange-50 flex items-center justify-center text-primary font-black text-xs border border-orange-100 overflow-hidden shrink-0">
                      {review.userPhoto ? (
                        <img src={review.userPhoto} className="w-full h-full object-cover" />
                      ) : (
                        review.userName?.charAt(0) || <User className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-wider truncate">{review.userName}</h5>
                      <p className="text-[9px] text-gray-400 font-bold tracking-widest truncate">{review.nationality || 'Verified Traveler'}</p>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* View All Card */}
              {reviews.length > 5 && (
                <button 
                  onClick={() => setShowAllModal(true)}
                  className="w-[200px] shrink-0 snap-start snap-always bg-gray-50 p-6 rounded-3xl flex flex-col items-center justify-center border border-dashed border-gray-200 group hover:border-primary transition-colors"
                >
                  <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center text-gray-400 shadow-sm mb-4 group-hover:scale-110 group-hover:text-primary transition-all">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-black text-gray-900 uppercase tracking-widest">View All</span>
                  <span className="text-[10px] font-bold text-gray-400 mt-1">{reviews.length} Reviews</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* All Reviews Modal */}
      <AnimatePresence>
        {showAllModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAllModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl max-h-[85vh] bg-white rounded-[32px] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Verified Traveler Reviews</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Based on {reviews.length} real experiences</p>
                </div>
                <button onClick={() => setShowAllModal(false)} className="h-10 w-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 no-scrollbar">
                {reviews.map((review) => (
                  <div key={review.id} className="flex gap-4 md:gap-8 pb-8 border-b border-gray-50 last:border-0 last:pb-0">
                    <div className="shrink-0">
                      <div className="h-12 w-12 md:h-16 md:w-16 rounded-full bg-orange-50 flex items-center justify-center text-primary font-black text-base border border-orange-100 overflow-hidden shadow-sm">
                        {review.userPhoto ? (
                          <img src={review.userPhoto} className="w-full h-full object-cover" />
                        ) : (
                          review.userName?.charAt(0) || 'U'
                        )}
                      </div>
                    </div>
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-lg font-black text-gray-900 tracking-tight">{review.userName}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{review.nationality || 'Verified Guest'}</span>
                            <span className="h-1 w-1 rounded-full bg-gray-300" />
                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{review.tourDate}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={cn(
                                "h-4 w-4",
                                i < (review.rating || 5) ? "fill-amber-400 text-amber-400" : "fill-gray-100 text-gray-100"
                              )} 
                            />
                          ))}
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        {review.title && <h5 className="font-black text-gray-900">{review.title}</h5>}
                        <p className="text-sm leading-relaxed text-gray-600 font-medium italic">"{review.comment}"</p>
                      </div>

                      {review.images && review.images.length > 0 && (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 pt-2">
                          {review.images.map((img, i) => (
                            <div key={i} className="aspect-square rounded-xl overflow-hidden bg-gray-50 border border-gray-100 group cursor-zoom-in" onClick={() => window.open(img, '_blank')}>
                              <SmartImage src={img} alt={`Review ${i}`} aspectRatio="square" className="group-hover:scale-110 transition-transform duration-500" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Write Review Modal */}
      <AnimatePresence>
        {showWriteModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowWriteModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-[32px] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-6 md:p-8 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div>
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">Write a Review</h3>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">Share your experience with others</p>
                </div>
                <button onClick={() => setShowWriteModal(false)} className="h-10 w-10 flex items-center justify-center bg-gray-50 rounded-full text-gray-400 hover:text-gray-900 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {auth.currentUser ? (
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 no-scrollbar pb-10">
                  {/* Rating Selector */}
                  <div className="flex flex-col items-center justify-center space-y-4 py-4 bg-gray-50/50 rounded-3xl border border-gray-100">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">How was your experience?</span>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setRating(s)}
                          className="transition-transform hover:scale-110 active:scale-90"
                        >
                          <Star className={cn("h-10 w-10 transition-colors", rating >= s ? "fill-amber-400 text-amber-400" : "text-gray-200 fill-gray-100")} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Your Name</label>
                      <input 
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. John Doe"
                        className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:bg-white focus:border-primary focus:outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Nationality</label>
                      <select 
                        required
                        value={nationality}
                        onChange={(e) => setNationality(e.target.value)}
                        className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:bg-white focus:border-primary focus:outline-none transition-all appearance-none"
                      >
                        <option value="">Select country</option>
                        {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Tour Date</label>
                    <input 
                      type="date"
                      required
                      value={tourDate}
                      onChange={(e) => setTourDate(e.target.value)}
                      className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:bg-white focus:border-primary focus:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Headline</label>
                    <input 
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Amazing sunrise trek!"
                      className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:bg-white focus:border-primary focus:outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Review Details</label>
                    <textarea 
                      required
                      rows={4}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us about the guides, the locations, and the highlights of your trip..."
                      className="w-full bg-gray-50/50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold focus:bg-white focus:border-primary focus:outline-none transition-all resize-none leading-relaxed"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Photos (Up to 5)</label>
                    <div className="flex flex-wrap gap-3">
                      {images.map((url, idx) => (
                        <div key={idx} className="relative h-20 w-20 rounded-xl overflow-hidden border border-gray-100 group">
                          <img src={url} className="h-full w-full object-cover" />
                          <button 
                            type="button" 
                            onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-5 w-5 text-white" />
                          </button>
                        </div>
                      ))}
                      {images.length < 5 && (
                        <div className="relative h-20 w-20 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-1 bg-gray-50 transition-colors hover:border-primary cursor-pointer group">
                          {isUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : (
                            <>
                              <Camera className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                              <span className="text-[8px] font-black text-gray-400 uppercase">Add</span>
                            </>
                          )}
                          <input 
                            type="file" 
                            multiple 
                            accept="image/*" 
                            disabled={isUploading}
                            onChange={handleImageUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || isUploading}
                    className="w-full bg-primary text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-orange-100 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" /> Submitting...
                      </span>
                    ) : 'Submit Review'}
                  </button>
                </form>
              ) : (
                <div className="p-12 text-center space-y-6">
                  <div className="h-20 w-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                    <User className="h-10 w-10" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xl font-black text-gray-900 tracking-tight">Login Required</h4>
                    <p className="text-sm font-bold text-gray-500">Only verified guests who have booked with us can share their experiences.</p>
                  </div>
                  <button 
                    onClick={() => window.location.href = '/login'}
                    className="bg-primary text-white px-8 py-4 rounded-full font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100"
                  >
                    Sign In to Continue
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
