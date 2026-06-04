import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
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
          const isEmailAdmin = user.email === 'andrewmanuel310@gmail.com';
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserData(data);
            setRole(isEmailAdmin ? 'admin' : (data.role || 'user'));

            // Self-healing: if the admin's database role is out-of-sync, correct it
            if (isEmailAdmin && data.role !== 'admin') {
              updateDoc(userDocRef, { role: 'admin' }).catch((err) => {
                console.error("Failed to self-heal admin role:", err);
              });
            }
          } else {
            setUserData(null);
            setRole(isEmailAdmin ? 'admin' : 'user');
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to user data:", error);
          const isEmailAdmin = user.email === 'andrewmanuel310@gmail.com';
          setUserData(null);
          setRole(isEmailAdmin ? 'admin' : 'user');
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

  const isProfileComplete = !!(userData?.displayName && userData?.department && userData?.contactNumber);

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
