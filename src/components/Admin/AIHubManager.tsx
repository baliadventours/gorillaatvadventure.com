import React, { useState, useEffect } from 'react';
import { 
  db,
  auth,
  handleFirestoreError,
  OperationType 
} from '../../lib/firebase';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Sparkles, 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  Check, 
  X, 
  HelpCircle, 
  BookOpen, 
  Lightbulb, 
  Eye, 
  ThumbsUp, 
  Loader2, 
  RefreshCcw, 
  Globe 
} from 'lucide-react';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  isPublished: boolean;
  views: number;
  helpfulCount: number;
  createdAt?: any;
}

interface TravelTip {
  id: string;
  title: string;
  content: string;
  category: string;
  isPublished: boolean;
  createdAt?: any;
}

export default function AIHubManager() {
  const [activeTab, setActiveTab] = useState<'faq' | 'tips'>('faq');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [tips, setTips] = useState<TravelTip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing state
  const [editingFaq, setEditingFaq] = useState<Partial<FAQ> | null>(null);
  const [editingTip, setEditingTip] = useState<Partial<TravelTip> | null>(null);

  // AI Generator state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiCategory, setAiCategory] = useState('Logistics');
  const [generating, setGenerating] = useState(false);
  const [generatedFaqs, setGeneratedFaqs] = useState<{ question: string; answer: string }[]>([]);
  const [generatedTip, setGeneratedTip] = useState<{ title: string; content: string } | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Fetch Data Function
  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const faqsQuery = query(collection(db, 'aiFaqs'), orderBy('helpfulCount', 'desc'));
      const faqsSnap = await getDocs(faqsQuery);
      const loadedFaqs = faqsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as FAQ[];

      const tipsQuery = query(collection(db, 'aiTips'), orderBy('category', 'asc'));
      const tipsSnap = await getDocs(tipsQuery);
      const loadedTips = tipsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TravelTip[];

      setFaqs(loadedFaqs);
      setTips(loadedTips);
    } catch (err: any) {
      console.error("Error fetching AI Hub Content", err);
      setError("Failed to fetch data from database. Make sure security rules allow access.");
      handleFirestoreError(err, OperationType.LIST, 'aiFaqs/aiTips');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Save/Update FAQ
  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFaq?.question || !editingFaq?.answer || !editingFaq?.category) return;

    try {
      if (editingFaq.id) {
        // Update existing
        const docRef = doc(db, 'aiFaqs', editingFaq.id);
        await updateDoc(docRef, {
          question: editingFaq.question,
          answer: editingFaq.answer,
          category: editingFaq.category,
          isPublished: editingFaq.isPublished ?? true
        });
      } else {
        // Add new
        await addDoc(collection(db, 'aiFaqs'), {
          question: editingFaq.question,
          answer: editingFaq.answer,
          category: editingFaq.category,
          isPublished: editingFaq.isPublished ?? true,
          views: 0,
          helpfulCount: 0,
          createdAt: serverTimestamp()
        });
      }
      setEditingFaq(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to save FAQ.");
      handleFirestoreError(err, editingFaq.id ? OperationType.UPDATE : OperationType.CREATE, editingFaq.id ? `aiFaqs/${editingFaq.id}` : 'aiFaqs');
    }
  };

  // Delete FAQ
  const handleDeleteFaq = async (id: string) => {
    if (!confirm("Are you sure you want to delete this FAQ?")) return;
    try {
      await deleteDoc(doc(db, 'aiFaqs', id));
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete FAQ.");
      handleFirestoreError(err, OperationType.DELETE, `aiFaqs/${id}`);
    }
  };

  // Save/Update Tip
  const handleSaveTip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTip?.title || !editingTip?.content || !editingTip?.category) return;

    try {
      if (editingTip.id) {
        const docRef = doc(db, 'aiTips', editingTip.id);
        await updateDoc(docRef, {
          title: editingTip.title,
          content: editingTip.content,
          category: editingTip.category,
          isPublished: editingTip.isPublished ?? true
        });
      } else {
        await addDoc(collection(db, 'aiTips'), {
          title: editingTip.title,
          content: editingTip.content,
          category: editingTip.category,
          isPublished: editingTip.isPublished ?? true,
          createdAt: serverTimestamp()
        });
      }
      setEditingTip(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to save Travel Tip.");
      handleFirestoreError(err, editingTip.id ? OperationType.UPDATE : OperationType.CREATE, editingTip.id ? `aiTips/${editingTip.id}` : 'aiTips');
    }
  };

  // Delete Tip
  const handleDeleteTip = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Travel Tip?")) return;
    try {
      await deleteDoc(doc(db, 'aiTips', id));
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to delete Travel Tip.");
      handleFirestoreError(err, OperationType.DELETE, `aiTips/${id}`);
    }
  };

  // AI Content Generator Endpoint Request
  const handleGenerateAIContent = async () => {
    if (!aiPrompt.trim()) return;
    setGenerating(true);
    setGeneratedFaqs([]);
    setGeneratedTip(null);

    try {
      const idToken = auth.currentUser ? await auth.currentUser.getIdToken() : '';
      const response = await fetch('/api/admin/generate-ai-hub', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          type: activeTab,
          prompt: aiPrompt,
          category: aiCategory
        })
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || "Generation failed");
      }

      if (activeTab === 'faq') {
        setGeneratedFaqs(resData.data || []);
      } else {
        setGeneratedTip(resData.data || null);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to generate AI contents. Check if GEMINI_API_KEY is configured.");
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyGeneratedFaq = async (item: { question: string; answer: string }) => {
    try {
      await addDoc(collection(db, 'aiFaqs'), {
        question: item.question,
        answer: item.answer,
        category: aiCategory,
        isPublished: true,
        views: 0,
        helpfulCount: 0,
        createdAt: serverTimestamp()
      });
      setGeneratedFaqs(prev => prev.filter(f => f.question !== item.question));
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to add FAQ");
      handleFirestoreError(err, OperationType.CREATE, 'aiFaqs');
    }
  };

  const handleApplyGeneratedTip = async () => {
    if (!generatedTip) return;
    try {
      await addDoc(collection(db, 'aiTips'), {
        title: generatedTip.title,
        content: generatedTip.content,
        category: aiCategory,
        isPublished: true,
        createdAt: serverTimestamp()
      });
      setGeneratedTip(null);
      setShowAiModal(false);
      fetchData();
    } catch (err) {
      console.error(err);
      alert("Failed to add Tip");
      handleFirestoreError(err, OperationType.CREATE, 'aiTips');
    }
  };

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter ? faq.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  const filteredTips = tips.filter(tip => {
    const matchesSearch = tip.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tip.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter ? tip.category === categoryFilter : true;
    return matchesSearch && matchesCategory;
  });

  const categories = activeTab === 'faq' 
    ? ['Logistics', 'Culture', 'Safety', 'Attractions', 'General']
    : ['Adventure', 'Culture', 'Budget', 'Food', 'Logistics', 'Packing'];

  return (
    <div id="ai-hub-manager-root" className="bg-white rounded-2xl border border-gray-100 p-6 lg:p-8 space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-primary/10 rounded-lg text-primary text-xs font-semibold">
              <Sparkles className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight font-sans">
              AI Travel Hub Content Manager
            </h1>
          </div>
          <p className="text-sm font-semibold text-gray-400">
            Write, review, and auto-generate highly semantic questions, facts, and travel lists to dominate AI research models and search robots.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setAiPrompt('');
              setGeneratedFaqs([]);
              setGeneratedTip(null);
              setAiCategory(categories[0]);
              setShowAiModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-black text-white hover:bg-neutral-800 transition-all rounded-xl text-xs font-black"
          >
            <Sparkles className="h-4 w-4 text-orange-400" />
            AI Generator
          </button>
          <button
            onClick={() => {
              if (activeTab === 'faq') {
                setEditingFaq({ question: '', answer: '', category: 'Logistics', isPublished: true });
              } else {
                setEditingTip({ title: '', content: '', category: 'Logistics', isPublished: true });
              }
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary hover:bg-primary/20 transition-all rounded-xl text-xs font-black"
          >
            <Plus className="h-4 w-4" />
            Manual Add
          </button>
        </div>
      </div>

      {/* Tabs / Filters Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        {/* Nav tabs */}
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => { setActiveTab('faq'); setCategoryFilter(''); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'faq' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <HelpCircle className="h-4 w-4" />
            Bali AI FAQs ({faqs.length})
          </button>
          <button
            onClick={() => { setActiveTab('tips'); setCategoryFilter(''); }}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === 'tips' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Lightbulb className="h-4 w-4" />
            Travel Smart Tips ({tips.length})
          </button>
        </div>

        {/* Inputs */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search box */}
          <div className="relative flex-1 md:flex-initial min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search content..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-50/60 border border-gray-200/80 rounded-xl text-xs font-medium w-full text-gray-800 focus:ring-1 focus:ring-primary focus:bg-white"
            />
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 outline-none"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <button 
            onClick={fetchData}
            className="p-2 bg-gray-100 hover:bg-gray-200/80 rounded-xl text-gray-600 transition-all"
            title="Refresh database"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {/* Editor Modal Overlay (If Editing) */}
      {(editingFaq !== null || editingTip !== null) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 lg:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { setEditingFaq(null); setEditingTip(null); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            {editingFaq !== null && (
              <form onSubmit={handleSaveFaq} className="space-y-4">
                <h3 className="text-lg font-black text-gray-900 mb-4 font-sans flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  {editingFaq.id ? 'Edit Bali AI FAQ' : 'Create New AI FAQ'}
                </h3>

                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Question Topic</label>
                  <input
                    type="text"
                    required
                    value={editingFaq.question || ''}
                    onChange={(e) => setEditingFaq(prev => ({ ...prev!, question: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/80 rounded-xl text-sm font-medium text-gray-800"
                    placeholder="e.g., When is the best time to visit Mount Batur?"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider">SEO Answer Content</label>
                  <textarea
                    required
                    rows={5}
                    value={editingFaq.answer || ''}
                    onChange={(e) => setEditingFaq(prev => ({ ...prev!, answer: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/80 rounded-xl text-sm font-medium text-gray-800"
                    placeholder="Provide a highly informative, detailed response. Use lists of tips or bullet facts to get higher rankings."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Category</label>
                    <select
                      value={editingFaq.category || 'Logistics'}
                      onChange={(e) => setEditingFaq(prev => ({ ...prev!, category: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/80 rounded-xl text-sm font-bold text-gray-700"
                    >
                      {['Logistics', 'Culture', 'Safety', 'Attractions', 'General'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      id="faq-published"
                      checked={editingFaq.isPublished ?? true}
                      onChange={(e) => setEditingFaq(prev => ({ ...prev!, isPublished: e.target.checked }))}
                      className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="faq-published" className="text-xs font-bold text-gray-700">
                      Publish to Active Travel Hub page
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setEditingFaq(null)}
                    className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-black text-white hover:bg-neutral-800 transition-all rounded-xl text-xs font-black"
                  >
                    {editingFaq.id ? 'Update FAQ' : 'Add FAQ to Database'}
                  </button>
                </div>
              </form>
            )}

            {editingTip !== null && (
              <form onSubmit={handleSaveTip} className="space-y-4">
                <h3 className="text-lg font-black text-gray-900 mb-4 font-sans flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-primary" />
                  {editingTip.id ? 'Edit Travel smart Tip' : 'Create New Travel smart Tip'}
                </h3>

                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Tip Headline / Title</label>
                  <input
                    type="text"
                    required
                    value={editingTip.title || ''}
                    onChange={(e) => setEditingTip(prev => ({ ...prev!, title: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/80 rounded-xl text-sm font-medium text-gray-800"
                    placeholder="e.g., Respect local norms: Temple dress code guide"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Detailed Tip Content</label>
                  <textarea
                    required
                    rows={5}
                    value={editingTip.content || ''}
                    onChange={(e) => setEditingTip(prev => ({ ...prev!, content: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/80 rounded-xl text-sm font-medium text-gray-800"
                    placeholder="Draft highly practical travel steps. Keep it factual and semantic."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Category Category</label>
                    <select
                      value={editingTip.category || 'Logistics'}
                      onChange={(e) => setEditingTip(prev => ({ ...prev!, category: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/80 rounded-xl text-sm font-bold text-gray-700"
                    >
                      {['Adventure', 'Culture', 'Budget', 'Food', 'Logistics', 'Packing'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      id="tip-published"
                      checked={editingTip.isPublished ?? true}
                      onChange={(e) => setEditingTip(prev => ({ ...prev!, isPublished: e.target.checked }))}
                      className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary"
                    />
                    <label htmlFor="tip-published" className="text-xs font-bold text-gray-700">
                      Publish to Active Travel Hub page
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setEditingTip(null)}
                    className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all rounded-xl text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-black text-white hover:bg-neutral-800 transition-all rounded-xl text-xs font-black"
                  >
                    {editingTip.id ? 'Update Tip' : 'Add Tip to Database'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* AI GENERATOR MODAL */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 lg:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAiModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-900 transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <Sparkles className="h-5 w-5 text-primary animate-pulse" />
              <h3 className="text-lg font-black text-gray-900 font-sans">
                AI Automated Travel Content Generator
              </h3>
            </div>

            <div className="p-4 bg-orange-50 text-orange-800/90 text-xs font-semibold rounded-xl border border-orange-100 leading-relaxed">
              <strong>Dominating search results:</strong> Gemini will create highly factual, clean responses enriched with Balinese vocabulary terms (with English meanings). This structure has high topical authority for bots and AI web miners.
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-11 animate-in">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Destination Theme or Keyword</label>
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="e.g., Ubud Temples, Uluwatu monkeys, Bali ATM safety, Nyepi"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/85 rounded-xl text-xs font-bold text-gray-700 focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-wider">Select Category Zone</label>
                    <select
                      value={aiCategory}
                      onChange={(e) => setAiCategory(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200/85 rounded-xl text-xs font-bold text-gray-700 outline-none"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateAIContent}
                    disabled={generating || !aiPrompt.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-black text-white hover:bg-neutral-800 disabled:bg-gray-200 disabled:text-gray-400 transition-all rounded-xl text-xs font-black mt-2"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        Generating expert SEO answers...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-orange-400" />
                        Generate semantic elements using AI
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200/60 max-h-[400px] overflow-y-auto">
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest block mb-3">
                    GENERATED REAL-TIME DRAFTS
                  </span>

                  {generating && (
                    <div className="py-12 flex flex-col items-center justify-center text-gray-400 text-xs">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                      Consulting Bali databases...
                    </div>
                  )}

                  {!generating && generatedFaqs.length === 0 && !generatedTip && (
                    <div className="py-12 text-center text-gray-400 text-xs font-bold">
                      Enter a topic on the left and click generate to review draft entries.
                    </div>
                  )}

                  {/* Generated FAQs List */}
                  {generatedFaqs.map((faq, index) => (
                    <div key={index} className="p-3 bg-white rounded-lg border border-gray-100 mb-3 space-y-2 relative">
                      <h4 className="text-xs font-extrabold text-gray-900 leading-snug">Q: {faq.question}</h4>
                      <p className="text-xs font-medium text-gray-600 line-clamp-3">{faq.answer}</p>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleApplyGeneratedFaq(faq)}
                          className="flex items-center gap-1.5 px-3 py-1 bg-primary text-white hover:bg-primary-dark transition-all rounded-md text-[10px] font-black shadow-sm"
                        >
                          <Check className="h-3 w-3" /> Approve and Add
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Generated Tip Output */}
                  {generatedTip && (
                    <div className="p-3 bg-white rounded-lg border border-gray-100 mb-3 space-y-2">
                      <h4 className="text-xs font-extrabold text-primary leading-snug">{generatedTip.title}</h4>
                      <p className="text-xs font-medium text-gray-600">{generatedTip.content}</p>
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={handleApplyGeneratedTip}
                          className="flex items-center gap-1.5 px-3 py-1 bg-primary text-white hover:bg-primary-dark transition-all rounded-md text-[10px] font-black shadow-sm"
                        >
                          <Check className="h-3 w-3" /> Approve and Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tables & Datagrid */}
      {loading ? (
        <div className="py-24 flex items-center justify-center text-gray-400 text-xs font-bold gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          Loading AI Hub content lists...
        </div>
      ) : activeTab === 'faq' ? (
        <div className="overflow-x-auto">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-16 text-gray-400 font-bold text-xs bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              No matching Bali FAQs found. Click MANUAL ADD or AI GENERATOR to seed facts.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-xs font-black text-gray-400 uppercase tracking-widest bg-gray-50/50">
                  <th className="py-4 px-4 w-1/3">Question Topic</th>
                  <th className="py-4 px-4 w-1/3">Detailed SEO Answer</th>
                  <th className="py-4 px-4">Category</th>
                  <th className="py-4 px-4 text-center">Stats</th>
                  <th className="py-4 px-4 text-center">Status</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFaqs.map(faq => (
                  <tr key={faq.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-all group">
                    <td className="py-4 px-4 font-extrabold text-xs text-gray-900 leading-tight">
                      {faq.question}
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-gray-500 max-w-sm truncate whitespace-nowrap">
                      {faq.answer}
                    </td>
                    <td className="py-4 px-4">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-extrabold">
                        {faq.category}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center space-y-0.5">
                      <div className="flex justify-center items-center gap-1.5 text-[10px] font-bold text-gray-400 justify-content">
                        <Eye className="h-3.5 w-3.5" />
                        <span>{faq.views || 0}</span>
                      </div>
                      <div className="flex justify-center items-center gap-1.5 text-[10px] font-bold text-orange-500">
                        <ThumbsUp className="h-3.5 w-3.5" />
                        <span>{faq.helpfulCount || 0}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                        faq.isPublished 
                          ? 'bg-orange-50 text-primary' 
                          : 'bg-amber-50 text-amber-600'
                      }`}>
                        {faq.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => setEditingFaq(faq)}
                          className="p-1.5 hover:bg-gray-100 hover:text-black text-gray-400 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFaq(faq.id)}
                          className="p-1.5 hover:bg-red-50 hover:text-red-600 text-gray-400 rounded-lg transition-all"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTips.length === 0 ? (
            <div className="col-span-full text-center py-16 text-gray-400 font-bold text-xs bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
              No Travel Smart Tips designed yet. Click MANUAL ADD or AI GENERATOR to populate.
            </div>
          ) : (
            filteredTips.map(tip => (
              <div key={tip.id} className="relative bg-gray-50/45 border border-gray-100 rounded-2xl p-5 hover:shadow-sm transition-all group flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    <span className="px-2 py-1 bg-primary/10 text-primary rounded-lg text-[10px] font-extrabold uppercase tracking-wider">
                      {tip.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                      tip.isPublished 
                        ? 'bg-orange-100 text-orange-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {tip.isPublished ? 'Live' : 'Draft'}
                    </span>
                  </div>

                  <h3 className="text-sm font-extrabold text-gray-900 font-sans tracking-tight leading-snug">
                    {tip.title}
                  </h3>
                  <p className="text-xs font-semibold text-gray-500 line-clamp-4 leading-relaxed">
                    {tip.content}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-gray-200/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingTip(tip)}
                    className="p-1.5 bg-white hover:bg-gray-100 text-gray-600 border border-gray-200/60 rounded-xl transition-all"
                    title="Edit"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTip(tip.id)}
                    className="p-1.5 bg-white hover:bg-red-50 hover:text-red-600 text-gray-600 border border-gray-200/60 rounded-xl transition-all"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
