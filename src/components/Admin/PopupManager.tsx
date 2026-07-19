import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, addDoc, deleteDoc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Popup } from '../../types';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  ExternalLink,
  Loader2,
  Check,
  X,
  Megaphone,
  Clock,
  Layout,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function PopupManager() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPopup, setEditingPopup] = useState<Popup | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Popup>>({
    title: '',
    content: '',
    imageURL: '',
    ctaText: '',
    ctaLink: '',
    isActive: true,
    displayDelay: 3,
    type: 'promotion'
  });

  useEffect(() => {
    fetchPopups();
  }, []);

  async function fetchPopups() {
    const q = query(collection(db, 'popups'), orderBy('updatedAt', 'desc'));
    const snap = await getDocs(q);
    setPopups(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Popup)));
    setLoading(false);
  }

  const handleCreate = () => {
    setEditingPopup(null);
    setFormData({
      title: '',
      content: '',
      imageURL: '',
      ctaText: '',
      ctaLink: '',
      isActive: true,
      displayDelay: 3,
      type: 'promotion'
    });
    setIsModalOpen(true);
  };

  const handleEdit = (popup: Popup) => {
    setEditingPopup(popup);
    setFormData(popup);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this popup?')) return;
    await deleteDoc(doc(db, 'popups', id));
    setPopups(popups.filter(p => p.id !== id));
  };

  const handleToggle = async (popup: Popup) => {
    const updated = { ...popup, isActive: !popup.isActive };
    await setDoc(doc(db, 'popups', popup.id), updated);
    setPopups(popups.map(p => p.id === popup.id ? updated : p));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      if (editingPopup) {
        await setDoc(doc(db, 'popups', editingPopup.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'popups'), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      fetchPopups();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="h-64 flex items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Popups & Announcements</h2>
          <p className="text-gray-500">Manage marketing and informational popups</p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-[10px] font-bold text-sm hover:brightness-90 transition-all shadow-lg shadow-orange-100"
        >
          <Plus className="h-4 w-4" />
          Create New Popup
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {popups.map((popup) => (
          <div key={popup.id} className="bg-white p-6 rounded-[24px] border border-gray-100 flex flex-col group">
            <div className="flex justify-between items-start mb-4">
              <div className={cn(
                "p-3 rounded-[12px]",
                popup.type === 'promotion' ? "bg-amber-50 text-amber-600" :
                popup.type === 'newsletter' ? "bg-primary/10 text-primary" :
                "bg-blue-50 text-blue-600"
              )}>
                <Megaphone className="h-5 w-5" />
              </div>
              <button 
                onClick={() => handleToggle(popup)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                  popup.isActive ? "bg-orange-50 text-primary" : "bg-gray-50 text-gray-400"
                )}
              >
                {popup.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                {popup.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
            
            <h3 className="text-lg font-bold text-gray-900 mb-2 truncate">{popup.title}</h3>
            <p className="text-sm text-gray-500 line-clamp-3 mb-6 flex-1">{popup.content}</p>
            
            <div className="flex items-center gap-4 text-xs font-bold text-gray-400 mb-6">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {popup.displayDelay}s Delay
              </div>
              <div className="flex items-center gap-1.5">
                <Layout className="h-3.5 w-3.5" />
                {popup.type}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-6 border-t border-gray-50">
              <button 
                onClick={() => handleEdit(popup)}
                className="flex-1 py-2.5 bg-gray-50 text-gray-900 rounded-[10px] text-xs font-bold hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
              >
                <Edit2 className="h-3.5 w-3.5" /> Edit
              </button>
              <button 
                onClick={() => handleDelete(popup.id)}
                className="flex-1 py-2.5 bg-red-50 text-red-500 rounded-[10px] text-xs font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          </div>
        ))}

        {popups.length === 0 && (
          <div className="col-span-full py-20 text-center bg-gray-50 rounded-[24px] border-2 border-dashed border-gray-200">
            <Megaphone className="h-10 w-10 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Popups Found</h3>
            <p className="text-sm text-gray-500">Create your first marketing popup to engage your visitors.</p>
          </div>
        )}
      </div>

      {/* Popup Editor Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <form onSubmit={handleSubmit}>
                <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{editingPopup ? 'Edit Popup' : 'New Popup'}</h2>
                    <p className="text-sm text-gray-500">Configure your popup's behavior and content</p>
                  </div>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Title</label>
                      <input 
                        required
                        type="text" 
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-primary"
                        placeholder="Save 10% on your first tour!"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Type</label>
                      <select 
                        value={formData.type}
                        onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                        className="w-full bg-gray-50 border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-primary"
                      >
                        <option value="promotion">Promotion</option>
                        <option value="newsletter">Newsletter</option>
                        <option value="info">Information</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Content</label>
                    <textarea 
                      required
                      rows={3}
                      value={formData.content}
                      onChange={(e) => setFormData({...formData, content: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-primary"
                      placeholder="Enter the main message of your popup..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">CTA Text</label>
                      <input 
                        type="text" 
                        value={formData.ctaText}
                        onChange={(e) => setFormData({...formData, ctaText: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-primary"
                        placeholder="Book Now"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">CTA Link</label>
                      <input 
                        type="text" 
                        value={formData.ctaLink}
                        onChange={(e) => setFormData({...formData, ctaLink: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-primary"
                        placeholder="/tours"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Display Delay (Seconds)</label>
                      <input 
                        type="number" 
                        value={formData.displayDelay}
                        onChange={(e) => setFormData({...formData, displayDelay: parseInt(e.target.value)})}
                        className="w-full bg-gray-50 border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-primary"
                        min="0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">Image URL (Optional)</label>
                      <input 
                        type="text" 
                        value={formData.imageURL}
                        onChange={(e) => setFormData({...formData, imageURL: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-[12px] px-4 py-3 text-sm focus:ring-2 focus:ring-primary"
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                      className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer" 
                    />
                    <span className="text-sm font-bold text-gray-900 group-hover:text-primary transition-colors">Activate popup immediately</span>
                  </label>
                </div>

                <div className="p-8 bg-gray-50/50 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-white border border-gray-200 rounded-[12px] font-bold text-sm text-gray-700 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={saving}
                    className="flex-[2] py-3 bg-primary text-white rounded-[12px] font-bold text-sm hover:brightness-90 transition-all shadow-lg shadow-orange-100 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {editingPopup ? 'Save Changes' : 'Create Popup'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
