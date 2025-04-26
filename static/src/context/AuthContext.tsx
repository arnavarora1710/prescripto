import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Session, User } from '@supabase/supabase-js';

// Define the shape of the user profile data we store in the context
export interface UserProfileData {
  profileId: string; // The ID from the patients or clinicians table
  userId: string;    // The ID from auth.users
  role: 'patient' | 'clinician';
  profilePictureUrl: string | null;
  email: string | undefined;
}

// Define the shape of the context value
interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfileData | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfileData>) => void;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define props for the provider component
interface AuthProviderProps {
  children: ReactNode;
}

// Create the provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch profile data (using .then syntax)
  const fetchProfileData = (userId: string): Promise<void> => {
    console.log(`AuthProvider: fetchProfileData (.then) called for user ${userId}`);
    return new Promise((resolve, reject) => {
        supabase.rpc(
            'get_user_role_and_profile_test',
            { test_user_id: userId }
        )
        .then(({ data: profileData, error: rpcError }) => {
            // Log the raw data received from the RPC
            console.log("AuthProvider: Raw RPC Result (.then):", JSON.stringify(profileData)); 
            console.log("AuthProvider: RPC Error (.then):", rpcError);

            // console.log("AuthProvider: fetchProfileData RPC Result (.then)", { profileData, rpcError }); // Keep original log commented out or remove
            if (rpcError) {
                console.error("Error in fetchProfileData (.then):", rpcError);
                setError(rpcError.message || "Failed to fetch profile.");
                setProfile(null);
                reject(rpcError); // Reject the promise on error
                return;
            }

            if (profileData && profileData.length > 0) {
                const fetchedProfile = profileData[0];
                if (fetchedProfile.role && fetchedProfile.profile_id) {
                    // Log the specific profile object being used to set state
                    console.log("AuthProvider: Profile data being set:", JSON.stringify(fetchedProfile));
                    // console.log("AuthProvider: Setting profile state with:", fetchedProfile); // Keep original log commented out or remove
                    setProfile({
                        profileId: fetchedProfile.profile_id,
                        userId: userId,
                        role: fetchedProfile.role,
                        profilePictureUrl: fetchedProfile.profile_picture_url,
                        email: fetchedProfile.user_email
                    });
                    resolve();
                    return;
                }
            }
            // Profile not found or incomplete
            console.log("AuthProvider: Setting profile state to null (not found/incomplete).");
            setProfile(null);
            resolve();
        })
        .catch(err => {
            console.error("Error in fetchProfileData (.catch):", err);
            setError(err.message || "Failed to fetch profile.");
            console.log("AuthProvider: Setting profile state to null (catch block).");
            setProfile(null);
            reject(err);
        });
    });
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      console.log("AuthProvider: fetchInitialData START");
      setLoading(true);
      setError(null);
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
        console.log("AuthProvider: Initial Session fetched", { hasSession: !!currentSession });
        if (sessionError) throw sessionError;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Call fetchProfileData and handle its promise
          await fetchProfileData(currentSession.user.id).catch(() => {
              console.log("Initial profile fetch failed, error set in fetchProfileData.");
          }); 
        } else {
          setProfile(null);
        }
      } catch (err: any) {
        console.error("Auth Init Error:", err);
        setError(err.message || "Auth init failed.");
        setProfile(null);
      } finally {
        setLoading(false);
        console.log("AuthProvider: fetchInitialData FINISHED");
      }
    };

    fetchInitialData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
         console.log("Auth State Change Event:", _event, "User:", newSession?.user?.id);
         setSession(newSession);
         setUser(newSession?.user ?? null);
         
         if (newSession?.user) {
             setLoading(true); 
             setError(null);
             // Call fetchProfileData and handle promise/loading
             fetchProfileData(newSession.user.id)
                .catch(() => {
                    console.log("Auth State Change: Profile fetch failed, error set in fetchProfileData.");
                })
                .finally(() => {
                    setLoading(false);
                    console.log("Auth State Change: Profile fetch attempt finished.");
                });
         } else {
             setProfile(null);
             setLoading(false);
         }
      }
    );

    return () => { subscription?.unsubscribe(); };
  }, []);

  const signOut = async () => {
     setLoading(true);
     const { error: signOutError } = await supabase.auth.signOut();
     if (signOutError) {
        console.error("Sign out error:", signOutError);
        setError("Failed to sign out.");
        setLoading(false); // Ensure loading stops even on error
     } 
     // onAuthStateChange listener will handle clearing state
  };

  // --- Add refreshProfile function --- 
  const refreshProfile = async () => {
    if (!user) {
        console.log("refreshProfile: No user, cannot refresh.");
        return;
    }
    console.log("refreshProfile: Starting manual refresh...");
    setLoading(true); 
    setError(null);
    try {
        console.log("refreshProfile: Calling fetchProfileData...");
        await fetchProfileData(user.id);
        console.log("refreshProfile: Refresh successful.");
    } catch (err) {
        console.error("refreshProfile: Refresh failed.", err);
        // Error state already set by fetchProfileData
    } finally {
        setLoading(false);
    }
  };

  // --- Add updateProfile function --- 
  const updateProfile = (data: Partial<UserProfileData>) => {
      console.log("AuthProvider: updateProfile called with:", JSON.stringify(data));
      setProfile(prevProfile => {
          if (!prevProfile) {
              console.warn("updateProfile called but no existing profile found.");
              // Depending on use case, you might want to initialize a profile here
              // or just return null/previous state.
              return null; 
          }
          const updated = { ...prevProfile, ...data };
          console.log("AuthProvider: Updated profile state:", JSON.stringify(updated));
          return updated;
      });
  };

  // Add updateProfile to the context value
  const value: AuthContextType = {
    session,
    user,
    profile,
    loading,
    error,
    signOut,
    refreshProfile,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use the AuthContext
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 