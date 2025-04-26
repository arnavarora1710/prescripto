import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { FaEye, FaEyeSlash } from 'react-icons/fa'; // Import eye icons

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
  const [showPassword, setShowPassword] = useState(false); // State for password visibility

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
    // Use min-h-screen and flex to center vertically
    <div className="min-h-screen flex flex-col items-center justify-center bg-dark-bg text-off-white p-4 animate-fade-in">
      {/* Card Styling */}
      <div className="bg-dark-card p-8 sm:p-10 rounded-xl shadow-xl w-full max-w-md border border-border-color hover:shadow-blue-glow-sm transition-shadow duration-300">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center text-electric-blue">
          {isSignUp ? 'Create Account' : 'Access Your Portal'}
        </h1>

        {/* Improved Error/Message Display */}
        {error && <p className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded-md text-center mb-4 text-sm animate-fade-in">{error}</p>}
        {message && <p className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-2 rounded-md text-center mb-4 text-sm animate-fade-in">{message}</p>}

        <form onSubmit={isSignUp ? handleSignUp : handleSignIn} className="space-y-6">
          {/* Email Input */}
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
              className="w-full px-4 py-2.5 rounded-md bg-dark-input border border-border-color text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150"
              placeholder="you@example.com"
              disabled={loading}
            />
          </div>

          {/* Password Input with Visibility Toggle */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-off-white/80 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'} // Toggle type
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                required
                minLength={6} // Supabase default minimum
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-md bg-dark-input border border-border-color text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150 pr-10" // Add padding for icon
                placeholder="••••••••"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-off-white/50 hover:text-electric-blue transition-colors duration-150"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {/* Role Selection for Sign Up */}
          {isSignUp && (
            <fieldset className="text-sm"> {/* Use fieldset for grouping */}
              <legend className="block font-medium text-off-white/80 mb-2">I am signing up as a:</legend>
              <div className="flex items-center space-x-6">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="radio"
                    name="role"
                    value="patient"
                    checked={role === 'patient'}
                    onChange={() => setRole('patient')}
                    className="form-radio h-4 w-4 text-electric-blue bg-dark-input border-border-color focus:ring-electric-blue transition duration-150"
                    disabled={loading}
                  />
                  <span className="ml-2 text-off-white/90 group-hover:text-white transition-colors duration-150">Patient</span>
                </label>
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="radio"
                    name="role"
                    value="clinician"
                    checked={role === 'clinician'}
                    onChange={() => setRole('clinician')}
                    className="form-radio h-4 w-4 text-electric-blue bg-dark-input border-border-color focus:ring-electric-blue transition duration-150"
                    disabled={loading}
                  />
                  <span className="ml-2 text-off-white/90 group-hover:text-white transition-colors duration-150">Clinician</span>
                </label>
              </div>
            </fieldset>
          )}

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full group flex justify-center items-center py-3 px-4 border border-electric-blue rounded-md shadow-sm text-sm font-medium text-electric-blue bg-transparent hover:bg-electric-blue hover:text-dark-bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-electric-blue disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 ease-in-out"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-electric-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <span className="group-hover:scale-105 transition-transform duration-200 ease-in-out">
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </span>
              )}
            </button>
          </div>
        </form>

        {/* Toggle Sign In/Sign Up */}
        <div className="mt-8 text-center">
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
            className="text-sm font-medium text-electric-blue/80 hover:text-electric-blue hover:underline focus:outline-none focus:underline transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
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