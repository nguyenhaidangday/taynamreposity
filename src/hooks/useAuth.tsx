import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          const isAdminEmail = user.email === 'nguyen.haidangday@gmail.com';
          
          if (isAdminEmail && (data.role !== 'Admin' || data.status !== 'active')) {
            const updatedProfile = { ...data, role: 'Admin' as const, status: 'active' as const };
            await updateDoc(doc(db, 'users', user.uid), { role: 'Admin', status: 'active' });
            setProfile(updatedProfile);
          } else {
            setProfile(data);
          }
        } else {
          // New user, create profile with pending status
          const isAdminEmail = user.email === 'nguyen.haidangday@gmail.com';
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: isAdminEmail ? 'Admin' : 'Chuyên viên',
            status: 'active',
            createdAt: Timestamp.now(),
          };
          try {
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setProfile(newProfile);
          } catch (error) {
            handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
