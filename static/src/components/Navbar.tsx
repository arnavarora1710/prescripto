import React from 'react';
import { motion } from 'framer-motion';
import { FaLaptopMedical } from 'react-icons/fa'; // Import FaLaptopMedical icon

// Logo Icon - using FaLaptopMedical
const LogoIcon = () => (
  <FaLaptopMedical className="h-6 w-6 text-electric-blue mr-2 group-hover:animate-pulse-glow" />
);

const Navbar: React.FC = () => {
  const handleSignIn = () => {
    console.log('Sign In button clicked - Placeholder');
    // Add actual sign-in logic here
  };

  const navItemVariants = {
    hover: {
      color: '#00ffff', // electric-blue
      textShadow: '0 0 8px rgba(0, 255, 255, 0.7)', // Add glow effect
      y: -1,
      transition: { duration: 0.2, ease: "easeOut" }
    }
  };

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
      // Dark background, subtle border using green accent (maybe rename to health-green conceptually)
      className="fixed top-0 left-0 right-0 z-50 bg-dark-bg/80 backdrop-blur-sm shadow-md py-3 px-6 md:px-12 flex justify-between items-center border-b border-terminal-green/30"
    >
      {/* Logo Area */}
      <motion.div className="flex items-center cursor-pointer group" whileHover={{ scale: 1.02 }}>
        <LogoIcon />
        <span className="text-xl font-semibold text-electric-blue hover:text-terminal-green transition-colors duration-200">Prescripto AI</span>
      </motion.div>

      {/* Navigation Links */}
      <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-off-white/80">
        <motion.a href="#hero" variants={navItemVariants} whileHover="hover" className="cursor-pointer">
          Overview
        </motion.a>
        <motion.a href="#features" variants={navItemVariants} whileHover="hover" className="cursor-pointer">
          Features
        </motion.a>
        <motion.a href="#how-it-works" variants={navItemVariants} whileHover="hover" className="cursor-pointer">
           Workflow
        </motion.a>
        <motion.a href="#impact" variants={navItemVariants} whileHover="hover" className="cursor-pointer">
           Impact
        </motion.a>
      </div>

      {/* Action Button - Green Accent */}
      <motion.button
        onClick={handleSignIn}
        className="bg-dark-card text-terminal-green font-medium py-2 px-5 rounded-sm text-sm border border-terminal-green/50 hover:bg-terminal-green/10 hover:shadow-[0_0_15px_rgba(0,255,0,0.5)] transition-all duration-300 cursor-pointer"
        whileHover={{ scale: 1.05, y: -1 }}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.2 }}
      >
        Clinician Portal
      </motion.button>
    </motion.nav>
  );
};

export default Navbar; 