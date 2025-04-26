import React from 'react';
import { motion } from 'framer-motion';
import { FaLaptopMedical, FaUserCircle } from 'react-icons/fa'; // Import FaLaptopMedical and FaUserCircle icons
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate
import { useAuth } from '../context/AuthContext'; // Import useAuth hook

// Logo Icon - using FaLaptopMedical
const LogoIcon = () => (
  <FaLaptopMedical className="h-6 w-6 text-electric-blue mr-2 group-hover:animate-pulse-glow" />
);

// Fallback Profile Icon - Takes size class as prop
const ProfilePlaceholderIcon = ({ sizeClass }: { sizeClass: string }) => (
  <FaUserCircle className={`${sizeClass} text-off-white/60`} />
);

const Navbar: React.FC = () => {
  const { profile, loading, signOut } = useAuth(); // Get auth state
  const navigate = useNavigate();

  const navItemVariants = {
    hover: {
      color: '#00ffff', // electric-blue
      textShadow: '0 0 8px rgba(0, 255, 255, 0.7)', // Add glow effect
      y: -1,
      transition: { duration: 0.2, ease: "easeOut" }
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Add smooth scroll
  };

  const handleProfileClick = () => {
    if (profile) {
      const path = profile.role === 'patient' ? '/patient/profile' : '/clinician/dashboard';
      navigate(path);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/'); // Redirect to home after sign out
  };

  // Add logging here
  console.log('Navbar Render:', { 
    loading, 
    profileExists: !!profile, 
    profilePictureUrl: profile?.profilePictureUrl 
  });

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      // Dark background, subtle border using green accent (maybe rename to health-green conceptually)
      className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/80 backdrop-blur-sm shadow-md py-3 px-6 md:px-12 flex justify-between items-center border-b border-terminal-green/30"
    >
      {/* Logo Area */}
      <Link 
        to="/" 
        className="group" 
        onClick={scrollToTop} // Add onClick handler here
      > 
        <motion.div
          className="flex items-center" 
          whileHover={{ scale: 1.02 }} 
        >
          <LogoIcon /> 
          <span className="text-xl font-semibold text-electric-blue group-hover:text-terminal-green transition-colors duration-200"> {/* Text color changes on group hover */}
            Prescripto
          </span>
        </motion.div>
      </Link>

      {/* Navigation Links - Updated hrefs */}
      <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-off-white/80">
        <motion.a href="/#hero" onClick={scrollToTop} variants={navItemVariants} whileHover="hover" className="cursor-pointer">
          Overview
        </motion.a>
        <motion.a href="/#features" variants={navItemVariants} whileHover="hover" className="cursor-pointer">
          Features
        </motion.a>
        <motion.a href="/#how-it-works" variants={navItemVariants} whileHover="hover" className="cursor-pointer">
           Workflow
        </motion.a>
        <motion.a href="/#impact" variants={navItemVariants} whileHover="hover" className="cursor-pointer">
           Impact
        </motion.a>
      </div>

      {/* Auth Area: Profile Pic/Button or Login Button */}
      <div className="flex items-center space-x-4">
        {loading ? (
          <div className="h-8 w-20 bg-dark-input/50 rounded animate-pulse"></div> // Simple loading placeholder
        ) : profile ? (
          <div className="relative group">
             <motion.button
              onClick={handleProfileClick}
              className="rounded-full overflow-hidden border-2 border-electric-blue/50 hover:border-electric-blue focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-electric-blue transition-all duration-200"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              title={`Go to ${profile.role} ${profile.role === 'patient' ? 'profile' : 'dashboard'}`}
             >
              {/* Check for non-null AND non-empty string */}
              {profile.profilePictureUrl && profile.profilePictureUrl !== '' ? (
                <img
                  src={profile.profilePictureUrl}
                  alt="Profile"
                  className="h-8 w-8 object-cover"
                />
              ) : (
                <div className="h-8 w-8 flex items-center justify-center"> {/* Centering container */}
                  <ProfilePlaceholderIcon sizeClass="h-7 w-7" /> 
                </div>
              )}
            </motion.button>
            {/* Simple Dropdown/Tooltip on hover for Sign Out */}
            <div className="absolute right-0 mt-1 w-32 bg-dark-card border border-off-white/10 rounded-md shadow-lg py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none group-hover:pointer-events-auto">
                 <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-off-white/80 hover:bg-electric-blue/10 hover:text-electric-blue"
                >
                    Sign Out
                </button>
            </div>
          </div>
        ) : (
          <Link to="/login">
            <motion.button
              className="bg-dark-card text-terminal-green font-medium py-2 px-5 rounded-sm text-sm border border-terminal-green/50 hover:bg-terminal-green/10 hover:shadow-[0_0_15px_rgba(0,255,0,0.5)] transition-all duration-300 cursor-pointer"
              whileHover={{ scale: 1.05, y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.2 }}
            >
              Sign In
            </motion.button>
          </Link>
        )}
      </div>
    </motion.nav>
  );
};

export default Navbar; 