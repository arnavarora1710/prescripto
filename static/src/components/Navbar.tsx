import React from 'react';
import { motion } from 'framer-motion';
import { FaLaptopMedical, FaUserCircle, FaSignInAlt, FaHeartbeat, FaSignOutAlt } from 'react-icons/fa'; // Import FaLaptopMedical, FaUserCircle, and FaSignInAlt icons
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate
import { useAuth } from '../context/AuthContext'; // Import useAuth hook

// Logo Icon - Removed animate-pulse
const LogoIcon = () => (
  <FaHeartbeat className="h-7 w-7 text-electric-blue group-hover:text-terminal-green transition-colors duration-300" />
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
      textShadow: '0 0 10px rgba(0, 255, 255, 0.8)', // Brighter glow
      scale: 1.05, // Slight scale up
      y: -3, // Target y position, spring will create bounce
      transition: {
        duration: 0.3, // Overall duration hint (spring might adjust)
        ease: "easeOut",
        type: "spring", // Apply spring to all properties in hover
        stiffness: 300,
        damping: 15
      }
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
      initial={{ y: -100, opacity: 0 }} // Start further up
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }} // Slightly adjusted timing
      // NEW STYLING: Centered, rounded rectangle navbar
      className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-screen-lg bg-dark-card/80 backdrop-blur-lg shadow-xl rounded-xl py-3 px-6 md:px-10 flex justify-between items-center border border-electric-blue/30"
    >
      {/* Logo Area - Enhanced hover */}
      <Link
        to="/"
        className="group"
        onClick={scrollToTop} // Add onClick handler here
      >
        <motion.div
          className="flex items-center"
          whileHover={{ scale: 1.05, filter: 'drop-shadow(0 0 8px rgba(0, 255, 255, 0.5))' }} // Scale and add glow on hover
          transition={{ type: "spring", stiffness: 300 }}
        >

          <LogoIcon />
        </motion.div>
      </Link>

      {/* Navigation Links - Apply new variants, improve base text style */}
      <div className="hidden md:flex items-center space-x-10 text-base font-medium text-off-white tracking-wide"> {/* Brighter base color, add tracking */}
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
      <div className="flex items-center space-x-3 md:space-x-4">
        {loading ? (
          <div className="h-8 w-20 bg-dark-input/50 rounded animate-pulse"></div> // Simple loading placeholder
        ) : profile ? (
          <div className="flex items-center space-x-3">
            <motion.button
              onClick={handleProfileClick}
              className="rounded-full overflow-hidden border-2 border-electric-blue/40 hover:border-electric-blue/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-electric-blue transition-all duration-300 hover:shadow-blue-glow-sm"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              title={`Go to ${profile.role === 'patient' ? 'profile' : 'dashboard'}`}
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

            <motion.button
              onClick={handleSignOut}
              className="flex items-center justify-center h-8 w-8 rounded-full text-off-white/60 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/50 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-dark-card focus:ring-red-500"
              title="Sign Out"
              whileHover={{ scale: 1.1, rotate: -5 }}
              whileTap={{ scale: 0.9 }}
            >
              <FaSignOutAlt className="h-4 w-4" />
            </motion.button>
          </div>
        ) : (
          <Link to="/login">
            <motion.button
              className="group flex items-center space-x-2 bg-transparent text-electric-blue font-semibold py-2 px-5 rounded-lg text-sm border-2 border-electric-blue/70 hover:bg-electric-blue hover:text-dark-bg hover:border-electric-blue hover:shadow-[0_0_18px_rgba(0,255,255,0.6)] transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-electric-blue"
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <FaSignInAlt className="transition-colors duration-300" />
              <span>Sign In</span>
            </motion.button>
          </Link>
        )}
      </div>
    </motion.nav>
  );
};

export default Navbar; 