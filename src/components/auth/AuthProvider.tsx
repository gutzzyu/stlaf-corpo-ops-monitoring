import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';

interface AuthContextType {
  user: User | null;
  role: 'user' | 'admin' | null;
  loading: boolean;
  isAdmin: boolean;
  userData: any | null;
  isProfileComplete: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  loading: true,
  isAdmin: false,
  userData: null,
  isProfileComplete: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'user' | 'admin' | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        // Use onSnapshot for real-time updates to handle profile completion instantly
        const userDocRef = doc(db, 'users', user.uid);
        const unsubscribeSnapshot = onSnapshot(userDocRef, (userDoc) => {
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setRole(data.role || 'user');
          } else {
            setUserData(null);
            setRole('user');
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user data:", error);
          setUserData(null);
          setRole('user');
          setLoading(false);
        });

        return () => unsubscribeSnapshot();
      } else {
        setUserData(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const isProfileComplete = !!(userData?.displayName && userData?.department);

  return (
    <AuthContext.Provider value={{ 
      user, 
      role, 
      loading, 
      isAdmin: role === 'admin',
      userData,
      isProfileComplete
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
