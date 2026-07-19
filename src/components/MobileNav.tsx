import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, Sparkles, Calendar, User, MessageCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function MobileNav() {
  const location = useLocation();
  const path = location.pathname;
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const navItems = [
    { label: 'Explore', path: '/', icon: Compass },
    { label: 'Inspire', path: '/blog', icon: Sparkles },
    { label: 'Plan', path: '/planner', icon: Calendar },
    { label: 'Chat', icon: MessageCircle, isAction: true },
    { label: 'Account', path: '/customer/dashboard', icon: User },
  ];

  const handleAction = (item: any) => {
    if (item.label === 'Chat') {
      window.dispatchEvent(new CustomEvent('chat:toggle'));
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-[60] bg-white border-t border-gray-100 flex items-center justify-around h-[72px] px-2 pb-safe md:hidden">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = !item.isAction && (path === item.path || (item.path !== '/' && path.startsWith(item.path!)));
        
        if (item.isAction) {
          return (
            <button
              key={item.label}
              onClick={() => handleAction(item)}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
                "text-gray-500 hover:text-gray-700"
              )}
            >
              <div className="p-1.5 rounded-full transition-colors bg-transparent">
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {item.label}
              </span>
            </button>
          );
        }

        // Redirect to login if guest and clicking protected route
        const targetPath = (!user && item.path !== '/' && item.path !== '/blog') ? '/login' : item.path!;
        
        return (
          <Link
            key={item.path}
            to={targetPath}
            className={cn(
              "flex flex-col items-center gap-1 min-w-[64px] transition-colors",
              isActive ? "text-primary" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <div className={cn(
              "p-1.5 rounded-full transition-colors",
              isActive ? "bg-primary/10" : "bg-transparent"
            )}>
              <Icon className={cn("h-5 w-5", isActive && "fill-current")} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
