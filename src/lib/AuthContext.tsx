import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  wishlist: string[];
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  wishlist: []
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [wishlist, setWishlist] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (authUser) => {
      setUser(authUser);
      if (!authUser) {
        setProfile(null);
        setWishlist([]);
        setLoading(false);
      }
    });

    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (!user) return;

    // Listen to user profile changes including wishlist
    const unsubscribeProfile = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setProfile(data);
        setWishlist(data.wishlist || []);
      }
      setLoading(false);
    }, (error) => {
      console.error("AuthContext profile error:", error);
      setLoading(false);
    });

    return unsubscribeProfile;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, loading, wishlist }}>
      {children}
    </AuthContext.Provider>
  );
};
