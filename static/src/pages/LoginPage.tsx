import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';

// Type for the data returned by the RPC functions
type ProfileCreationResult = { id: string } | null;

// --- RPC Call Wrappers ---
const callHandleNewPatient = async (): Promise<ProfileCreationResult> => {
  console.log('Calling handle_new_patient RPC...');
  const { data, error } = await supabase.rpc('handle_new_patient');
  if (error) {
    console.error("Error calling handle_new_patient RPC:", error);
    return null;
  }
  console.log('handle_new_patient RPC returned patient ID:', data);
  return data ? { id: data } : null;
};

const callHandleNewClinician = async (): Promise<ProfileCreationResult> => {
  console.log('Calling handle_new_clinician RPC...');
  const { data, error } = await supabase.rpc('handle_new_clinician');
  if (error) {
    console.error("Error calling handle_new_clinician RPC:", error);
    return null;
  }
  console.log('handle_new_clinician RPC returned clinician ID:', data);
  return data ? { id: data } : null;
};

// --- Component ---
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between Sign In and Sign Up
  const [role, setRole] = useState<'patient' | 'clinician'>('patient'); // Default role for sign up
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null); // For success/info messages

  // Handle redirect and role checking after auth events
  useEffect(() => {
    const handleAuthChange = async (event: string, session: any) => {
      // We only act on SIGNED_IN event
      if (event === 'SIGNED_IN' && session?.user) {
        setLoading(true);
        setError(null);
        setMessage(null);
        const user: User = session.user;
        console.log("User signed in:", user.id);

        // 1. Check if role info is in metadata (comes from sign up options.data)
        const signUpRole = user.user_metadata?.role;
        console.log("Role from metadata (sign up flow)?", signUpRole);

        if (signUpRole === 'patient') {
          const patientProfile = await callHandleNewPatient();
          if (patientProfile) {
            console.log("Redirecting to patient profile after sign up...");
            navigate('/patient/profile');
          } else {
            setError("Sign up complete, but failed to create patient profile. Please contact support.");
          }
        } else if (signUpRole === 'clinician') {
          const clinicianProfile = await callHandleNewClinician();
          if (clinicianProfile) {
            console.log("Redirecting to clinician dashboard after sign up...");
            navigate('/clinician/dashboard');
          } else {
            setError("Sign up complete, but failed to create clinician profile. Please contact support.");
          }
        } else {
          // 2. No role metadata - this was likely a sign IN. Check existing profiles.
          console.log("No sign-up role found in metadata. Checking existing profiles for sign-in...");
          // Check patient profile first
          const { data: patient, error: patientError } = await supabase
            .from('patients')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();

          if (patientError) console.error("Error checking patient profile:", patientError);

          if (patient) {
            console.log("Found existing patient profile. Redirecting...");
            navigate('/patient/profile');
          } else {
            // Check clinician profile if patient not found
            const { data: clinician, error: clinicianError } = await supabase
              .from('clinicians')
              .select('id')
              .eq('user_id', user.id)
              .maybeSingle();

            if (clinicianError) console.error("Error checking clinician profile:", clinicianError);

            if (clinician) {
              console.log("Found existing clinician profile. Redirecting...");
              navigate('/clinician/dashboard');
            } else {
              // User exists in auth, but no profile found after sign-in.
              console.warn("User signed in but no patient or clinician profile found.");
              setError("Sign in successful, but no profile found for your account. Please sign up first or contact support.");
              // Stay on login page, potentially sign them out?
              // await supabase.auth.signOut();
            }
          }
        }
        setLoading(false);
      }
      // Handle SIGNED_OUT or other events if needed
      // else if (event === 'SIGNED_OUT') {
      //   console.log("User signed out");
      // }
    };

    // Check initial session state
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log("Existing session found on page load.");
        // Avoid triggering full check on load if user is just visiting the page while logged in
        // handleAuthChange('SIGNED_IN', session); // <-- Might cause redirect loops if user is already on dashboard
      }
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(handleAuthChange);

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role: role }, // Pass role during sign up
        },
      });

      if (signUpError) throw signUpError;

      // Check if email confirmation is required
      if (data.user && data.user.identities?.length === 0) {
        setMessage("Sign up successful! Please check your email to confirm your account.");
      } else if (data.session) {
        // Auto-confirm is on or user already exists maybe?
        // onAuthStateChange will handle the redirect via SIGNED_IN event.
        setMessage("Sign up successful! Redirecting...");
        // The handleAuthChange listener will catch the SIGNED_IN event
      } else {
        setMessage("Sign up successful! Please check your email to confirm your account.");
      }

    } catch (err: any) {
      console.error("Error during sign up:", err);
      setError(err.message || "An error occurred during sign up.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;

      // If sign-in is successful, onAuthStateChange will fire with SIGNED_IN,
      // and the useEffect hook will handle profile checking and redirection.
      // setMessage("Sign in successful! Redirecting..."); // Optional message

    } catch (err: any) {
      console.error("Error during sign in:", err);
      setError(err.message || "Invalid login credentials."); // Provide clearer message for common errors
    } finally {
      // setLoading(false); // Remove this - let the onAuthStateChange handler manage loading state post-auth
    }
  };

  return (
    <div className="flex flex-col items-center justify-center flex-grow text-white pt-20 pb-12 px-4">
      <div className="bg-dark-card p-8 md:p-10 rounded-lg shadow-xl w-full max-w-md border border-off-white/10">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center text-electric-blue">
          {isSignUp ? 'Create Account' : 'Access Your Portal'}
        </h1>

        {error && <p className="text-red-500 text-center mb-4 text-sm">{error}</p>}
        {message && <p className="text-green-400 text-center mb-4 text-sm">{message}</p>}

        <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-off-white/80 mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-dark-input border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-off-white/80 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              required
              minLength={6} // Supabase default minimum
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-dark-input border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150"
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          {isSignUp && (
            <div className="text-sm">
              <span className="block font-medium text-off-white/80 mb-2">I am signing up as a:</span>
              <div className="flex items-center space-x-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="patient"
                    checked={role === 'patient'}
                    onChange={() => setRole('patient')}
                    className="form-radio h-4 w-4 text-electric-blue bg-dark-input border-off-white/40 focus:ring-electric-blue transition duration-150"
                    disabled={loading}
                  />
                  <span className="ml-2 text-off-white/90">Patient</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="clinician"
                    checked={role === 'clinician'}
                    onChange={() => setRole('clinician')}
                    className="form-radio h-4 w-4 text-electric-blue bg-dark-input border-off-white/40 focus:ring-electric-blue transition duration-150"
                    disabled={loading}
                  />
                  <span className="ml-2 text-off-white/90">Clinician</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-electric-blue rounded-md shadow-sm text-sm font-medium text-electric-blue bg-transparent hover:bg-electric-blue hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-electric-blue disabled:opacity-50 disabled:cursor-not-allowed transition duration-150"
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-electric-blue group-hover:text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : isSignUp ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setMessage(null);
              // Reset fields when switching modes? Optional.
              // setEmail('');
              // setPassword('');
            }}
            disabled={loading}
            className="inline-block cursor-pointer px-4 py-2 rounded-md border border-electric-blue/50 text-sm font-medium text-electric-blue transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

        <p className="mt-8 text-xs text-off-white/50 text-center">
          By signing in or signing up, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default LoginPage; 