import React from 'react';
import { FcGoogle } from 'react-icons/fc'; // Import Google icon

const LoginPage: React.FC = () => {
  // Combined handler for Supabase Google Auth
  const handleGoogleSignIn = async () => {
    console.log('Google Sign In/Up Clicked - Placeholder');
    // TODO: Implement Supabase Google Auth logic here
    // This one function will handle both sign-in and sign-up via Google.
    // After successful auth, you'll check if the user exists in your
    // patients or clinicians table and redirect accordingly, or prompt
    // for role selection if they are a new user.
  };

  return (
    <div className="flex flex-col items-center justify-center flex-grow text-white pt-20 pb-12 px-4">
      <div className="bg-dark-card p-8 md:p-10 rounded-lg shadow-xl w-full max-w-md border border-off-white/10">
        <h1 className="text-3xl md:text-4xl font-bold mb-6 text-center text-electric-blue">Access Your Portal</h1>
        <p className="text-center text-off-white/70 mb-8 text-sm md:text-base">
          Sign in or create an account using your Google account to continue.
        </p>
        
        <button 
          onClick={handleGoogleSignIn}
          className="w-full bg-white text-gray-700 font-semibold py-3 px-6 rounded-md hover:bg-gray-100 transition duration-200 ease-in-out transform hover:-translate-y-1 shadow-md hover:shadow-lg flex items-center justify-center space-x-3 border border-gray-300"
        >
          <FcGoogle className="w-6 h-6" />
          <span>Sign In / Sign Up with Google</span>
        </button>
        
        <p className="mt-8 text-xs text-off-white/50 text-center">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default LoginPage; 