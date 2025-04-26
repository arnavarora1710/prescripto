import React from 'react';
import { motion } from 'framer-motion';

// Heroicon: Document Text (as a simple logo representation)
const LogoIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const Navbar: React.FC = () => {
  const handleSignIn = () => {
    console.log('Sign In button clicked - Placeholder');
  };

  const navItemVariants = {
    hover: {
      color: '#2563EB', // blue-600
      y: -2, // Add slight lift on hover
      transition: { duration: 0.2, ease: "easeOut" }
    }
  };

  return (
    <motion.nav
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md shadow-sm py-3 px-6 md:px-12 flex justify-between items-center border-b border-gray-200"
    >
      {/* Logo Area */}
      <motion.div className="flex items-center cursor-pointer" whileHover={{ scale: 1.02 }}>
        <LogoIcon />
        <span className="text-xl font-semibold text-gray-800">Prescripto</span>
      </motion.div>

      {/* Navigation Links */}
      <div className="hidden md:flex items-center space-x-8 text-sm font-medium">
        <motion.a href="#hero" className="text-gray-600 relative group" variants={navItemVariants} whileHover="hover">
          <span>Home</span>
          <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
        </motion.a>
        <motion.a href="#features" className="text-gray-600 relative group" variants={navItemVariants} whileHover="hover">
          <span>Features</span>
           <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
        </motion.a>
        <motion.a href="#how-it-works" className="text-gray-600 relative group" variants={navItemVariants} whileHover="hover">
           <span>How It Works</span>
           <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
        </motion.a>
        <motion.a href="#impact" className="text-gray-600 relative group" variants={navItemVariants} whileHover="hover">
           <span>Impact</span>
           <span className="absolute bottom-[-4px] left-0 w-0 h-0.5 bg-blue-600 group-hover:w-full transition-all duration-300"></span>
        </motion.a>
      </div>

      {/* Action Button */}
      <motion.button
        onClick={handleSignIn}
        className="bg-blue-600 text-white font-medium py-2 px-5 rounded-md text-sm shadow-sm hover:shadow-md"
        whileHover={{ scale: 1.03, backgroundColor: '#1D4ED8' /* blue-700 */ }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2 }}
      >
        Clinician Sign In
      </motion.button>
      {/* Mobile menu placeholder */}
    </motion.nav>
  );
};

export default Navbar; 