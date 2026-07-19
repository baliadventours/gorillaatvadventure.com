import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, MessageCircle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { useLocation } from 'react-router-dom';
import Markdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  parts: string;
}

import { useSettings } from '../lib/SettingsContext';
import { handleChatbotRequest } from '../services/chatbotService';

export default function Chatbot() {
  const { settings } = useSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'model', 
      parts: "Halo! I'm Gorilla Assistant, your Bali Adventours assistant. Selamat Datang to Bali! \n\nWhat we can help you today?\n1. **Check a booking status**\n2. **Book a tour**\n3. **General Questions**\n4. **Chat with Real Person**" 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const suggestedActions = [
    { label: "Check booking status", icon: "🔍", action: "I want to check my booking status" },
    { label: "Book a tour", icon: "🌴", action: "I want to book a tour" },
    { label: "Full Price List", icon: "💰", action: "I want to see the full price list" },
    { label: "Chat with Real Person", icon: "💬", action: "whatsapp" },
    { label: "General Questions", icon: "❓", action: "I have some general questions" }
  ];

  const handleAction = (action: { label: string, icon: string, action: string }) => {
    if (action.action === 'whatsapp') {
      const waNumber = (settings?.whatsappNumber || settings?.supportPhone || '+6281234567890').replace(/\D/g, '');
      const waText = encodeURIComponent("Hi! I have a question about Bali Adventours.");
      window.open(`https://wa.me/${waNumber}?text=${waText}`, '_blank');
      return;
    }
    handleSend(action.action);
  };

  // Hide on admin/supplier/agent pages
  const isHidden = location.pathname.startsWith('/admin') || 
                   location.pathname.startsWith('/supplier') || 
                   location.pathname.startsWith('/agent');

  useEffect(() => {
    const handleToggle = () => setIsOpen(prev => !prev);
    window.addEventListener('chat:toggle', handleToggle);
    return () => window.removeEventListener('chat:toggle', handleToggle);
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (overrideInput?: any) => {
    const textToSend = typeof overrideInput === 'string' ? overrideInput : input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', parts: textToSend };
    setMessages(prev => [...prev, userMessage]);
    if (typeof overrideInput !== 'string') setInput('');
    setIsLoading(true);

    try {
      const origin = window.location.origin;
      const data = await handleChatbotRequest([...messages, userMessage], origin);

      setMessages(prev => [...prev, { role: 'model', parts: data.text }]);
    } catch (error: any) {
      console.error('Chat Error:', error);
      const waNumber = (settings?.whatsappNumber || settings?.supportPhone || '+6281246502939').replace(/\D/g, '');
      const waText = encodeURIComponent("Hi! I have a question about Bali Adventours.");
      const waLink = `https://wa.me/${waNumber}?text=${waText}`;
      
      setMessages(prev => [...prev, { 
        role: 'model', 
        parts: `Our chatbot now can not respond to your questions, please [chat with us on WhatsApp](${waLink}) for assistance!` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isHidden) return null;

  return (
    <div className={cn(
      "fixed z-50 flex flex-col items-end transition-all duration-300",
      "bottom-[88px] right-4 md:bottom-6 md:right-6"
    )}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[350px] sm:w-[400px] h-[500px] bg-white rounded-[32px] shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 bg-primary text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center border border-white/30 backdrop-blur-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-xs uppercase tracking-widest">Gorilla Assistant</h3>
                  <p className="text-[10px] font-medium text-orange-100 italic">Online & ready to help</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
              {messages.map((m, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "flex flex-col max-w-[85%]",
                    m.role === 'user' ? "ml-auto" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "px-4 py-3 rounded-[20px] text-xs leading-relaxed",
                    m.role === 'user' 
                      ? "bg-primary text-white rounded-br-none font-medium" 
                      : "bg-white border border-gray-100 text-gray-700 rounded-bl-none shadow-sm"
                  )}>
                    <div className="markdown-content prose prose-sm prose-orange max-w-none text-inherit">
                      <Markdown
                        components={{
                          a: ({ node, ...props }) => (
                            <a 
                              {...props} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-primary font-bold underline hover:text-orange-700 transition-colors cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                            />
                          )
                        }}
                      >
                        {m.parts}
                      </Markdown>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2">
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested Actions */}
            <div className="px-4 pb-2 bg-white flex flex-wrap gap-2">
              {messages.length === 1 && suggestedActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleAction(action)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-[10px] font-bold border border-orange-100 hover:bg-orange-100 transition-colors"
                >
                  <span>{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask me anything..."
                className="flex-1 bg-gray-50 border border-gray-100 rounded-[20px] px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 placeholder:text-gray-400"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="p-3 bg-primary text-white rounded-full hover:bg-orange-700 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 md:w-16 md:h-16 rounded-full shadow-2xl items-center justify-center transition-all duration-300 hover:scale-110 hidden md:flex",
          isOpen ? "bg-white text-gray-900 rotate-90 flex" : "bg-primary text-white",
          isOpen ? "fixed bottom-[88px] right-4 md:bottom-6 md:right-6" : ""
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!isOpen && (
           <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        )}
      </button>
    </div>
  );
}
