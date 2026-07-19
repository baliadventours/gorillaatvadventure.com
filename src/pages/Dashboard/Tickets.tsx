import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { 
  collection, addDoc, updateDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { SupportTicket, TicketMessage } from '../../types';
import { 
  LifeBuoy, PlusCircle, MessageSquare, Send, CheckCircle2, Clock, AlertCircle, X, ArrowLeft 
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function Tickets() {
  const { user, profile } = useOutletContext<{ user: any; profile: any }>();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<'Booking' | 'Tour Details' | 'Payment' | 'Feedback' | 'General Inquiry'>('Booking');
  const [message, setMessage] = useState('');
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active support ticket computation
  const activeTicket = tickets.find(t => t.id === activeTicketId);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'supportTickets'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedTickets: SupportTicket[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        fetchedTickets.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : data.updatedAt,
          messages: (data.messages || []).map((m: any) => ({
            ...m,
            timestamp: m.timestamp?.toDate ? m.timestamp.toDate() : m.timestamp
          }))
        } as SupportTicket);
      });

      // Sort client-side by createdAt desc
      fetchedTickets.sort((a, b) => {
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

      setTickets(fetchedTickets);
      setLoading(false);
    }, (error) => {
      console.error('[Clientside Ticket OnSnapshot Error]:', error);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || submitting) return;
    setSubmitting(true);
    try {
      const initialMessage: TicketMessage = {
        id: crypto.randomUUID(),
        senderId: user.uid,
        senderName: profile?.fullName || user.displayName || user.email || 'Customer',
        senderRole: 'customer',
        text: message.trim(),
        timestamp: new Date()
      };

      const newTicket = {
        userId: user.uid,
        userName: profile?.fullName || user.displayName || user.email || 'Customer',
        userEmail: user.email || '',
        subject: subject.trim(),
        category,
        status: 'open',
        messages: [initialMessage],
        type: 'web',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'supportTickets'), newTicket);
      setIsCreateOpen(false);
      setSubject('');
      setMessage('');
      setActiveTicketId(docRef.id);
    } catch (err: any) {
      console.error('[Create Ticket Error]:', err);
      alert('Failed to send support ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket) return;

    try {
      const newMessage: TicketMessage = {
        id: crypto.randomUUID(),
        senderId: user.uid,
        senderName: profile?.fullName || user.displayName || user.email || 'Customer',
        senderRole: 'customer',
        text: replyText.trim(),
        timestamp: new Date()
      };

      const updatedMessages = [...activeTicket.messages, newMessage];

      await updateDoc(doc(db, 'supportTickets', activeTicket.id), {
        messages: updatedMessages,
        status: 'open', // set status back to open/active when customer answers
        updatedAt: serverTimestamp()
      });

      setReplyText('');
    } catch (err) {
      console.error('[Reply Ticket Error]:', err);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            Open
          </span>
        );
      case 'replied':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3" />
            Replied
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-xs font-bold uppercase tracking-wider">
            <AlertCircle className="h-3 w-3" />
            Pending
          </span>
        );
      case 'closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-500 rounded-full text-xs font-bold uppercase tracking-wider">
            <X className="h-3 w-3" />
            Closed
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex h-[350px] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <LifeBuoy className="text-orange-500 h-7 w-7" /> Support Tickets
          </h1>
          <p className="text-sm text-gray-400 mt-1">Need help? Create a support request or contact Bali Adventours team.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-orange-500 hover:bg-primary rounded-[12px] shadow-md shadow-orange-500/10 transition-all cursor-pointer"
        >
          <PlusCircle className="h-4 w-4" />
          Create Support Ticket
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[500px]">
        {/* Ticket List Column */}
        <div className={cn(
          "lg:col-span-4 bg-white border border-gray-100 rounded-[20px] shadow-sm flex flex-col overflow-hidden",
          activeTicketId && "hidden lg:flex"
        )}>
          <div className="p-5 border-b border-gray-50 bg-gray-50/50">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">Your Ticket List ({tickets.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50 max-h-[550px]">
            {tickets.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <MessageSquare className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-bold">No active tickets yet</p>
                <p className="text-xs text-gray-300 mt-1">Click top right button to create one!</p>
              </div>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTicketId(t.id)}
                  className={cn(
                    "w-full text-left p-5 hover:bg-gray-50/80 transition-colors flex flex-col gap-2.5 relative border-l-4",
                    t.id === activeTicketId ? "border-l-orange-500 bg-orange-50/10" : "border-l-transparent"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-primary bg-orange-50 px-2.5 py-1 rounded-md">
                      {t.category}
                    </span>
                    {getStatusBadge(t.status)}
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm line-clamp-1">{t.subject}</h4>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-gray-400 font-medium">
                    <span>
                      {t.messages.length} messaging {t.messages.length === 1 ? 'turn' : 'turns'}
                    </span>
                    <span>
                      {t.createdAt instanceof Date ? t.createdAt.toLocaleDateString() : 'Just now'}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Messaging Pane Column */}
        <div className={cn(
          "lg:col-span-8 bg-white border border-gray-100 rounded-[20px] shadow-sm flex flex-col overflow-hidden",
          !activeTicketId && "hidden lg:flex"
        )}>
          {activeTicket ? (
            <div className="flex-1 flex flex-col h-[600px]">
              {/* Active Ticket Header */}
              <div className="p-5 border-b border-gray-100 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTicketId(null)}
                    className="lg:hidden p-2 hover:bg-gray-50 rounded-full text-gray-500"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-gray-900 text-md">{activeTicket.subject}</h3>
                      {getStatusBadge(activeTicket.status)}
                    </div>
                    <span className="text-xs text-gray-400 font-medium">Category: {activeTicket.category}</span>
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-5 bg-slate-50/55 space-y-4">
                {activeTicket.messages.map((m) => {
                  const isMe = m.senderId === user?.uid;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "flex flex-col max-w-[80%] rounded-[16px] p-4 shadow-sm",
                        isMe 
                          ? "ml-auto bg-orange-500 text-white rounded-tr-none" 
                          : "mr-auto bg-white text-gray-800 border border-gray-100 rounded-tl-none"
                      )}
                    >
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider mb-1",
                        isMe ? "text-orange-100" : "text-gray-400"
                      )}>
                        {isMe ? 'You' : m.senderName}
                      </span>
                      <p className="text-sm whitespace-pre-line leading-relaxed">{m.text}</p>
                      <span className={cn(
                        "text-[9px] text-right mt-1.5 self-end block opacity-80",
                        isMe ? "text-orange-100" : "text-gray-400"
                      )}>
                        {m.timestamp instanceof Date 
                          ? m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                          : 'Just now'
                        }
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Reply Send Drawer */}
              <div className="p-4 border-t border-gray-100 bg-white">
                {activeTicket.status === 'closed' ? (
                  <div className="p-3 bg-gray-50 rounded-xl text-center text-xs text-gray-400 font-bold border border-gray-100 uppercase tracking-wider">
                    This ticket has been marked as completed/closed. Please open another.
                  </div>
                ) : (
                  <form onSubmit={handleSendReply} className="flex gap-3">
                    <input
                      type="text"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your message reply..."
                      className="flex-1 py-3 px-4 bg-gray-50 focus:bg-white border border-orange-50 rounded-[12px] focus:outline-none focus:border-orange-500 text-sm font-medium transition-all"
                    />
                    <button
                      type="submit"
                      disabled={!replyText.trim()}
                      className="p-3 bg-orange-500 hover:bg-primary disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-[12px] transition-colors cursor-pointer shrink-0"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </form>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400 h-[600px]">
              <LifeBuoy className="h-16 w-16 text-orange-100 mb-4 animate-pulse" />
              <h3 className="font-extrabold text-gray-700 text-lg">Support Inbox</h3>
              <p className="text-sm text-gray-400 mt-2 max-w-sm">Select a ticket from the left panel to review or send messages, or create a new support ticket.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Ticket Modal */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[24px] shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-md font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                  <LifeBuoy className="h-5 w-5 text-orange-500" /> Create New Support Ticket
                </h2>
                <button
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateTicket} className="p-6 space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Cannot finalize booking checkout"
                    className="w-full font-semibold text-sm border-2 border-orange-50 rounded-xl px-4 py-3 bg-orange-50/10 focus:bg-white focus:border-orange-500 focus:outline-none transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Category</label>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    className="w-full font-bold text-sm border-2 border-orange-50 rounded-xl px-4 py-3 bg-orange-50/10 focus:bg-white focus:border-orange-500 focus:outline-none transition-all"
                  >
                    <option value="Booking">Booking Issues</option>
                    <option value="Tour Details">Tour Package Information</option>
                    <option value="Payment">Billing / Payouts</option>
                    <option value="Feedback">App Feedback</option>
                    <option value="General Inquiry">General Questions</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Describe your issue</label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Please provide full details of your problem or request..."
                    className="w-full font-semibold text-sm border-2 border-orange-50 rounded-xl px-4 py-3 bg-orange-50/10 focus:bg-white focus:border-orange-500 focus:outline-none transition-all resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="flex-1 py-3 border-2 border-gray-100 hover:bg-gray-50 rounded-xl text-sm font-black uppercase tracking-wider text-gray-500 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-orange-500 hover:bg-primary disabled:bg-gray-200 text-white rounded-xl text-sm font-black uppercase tracking-wider transition-colors cursor-pointer"
                  >
                    {submitting ? 'Sending...' : 'Send Request'}
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
