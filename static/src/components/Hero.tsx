import React from 'react';
import { motion } from 'framer-motion';

// Removed the separate HeroVisual component

const Hero: React.FC = () => {
  return (
    <motion.section
      id="hero"
      className="relative bg-gradient-to-br from-cyan-100 via-blue-200 to-indigo-300 pt-32 pb-20 md:pt-40 md:pb-28 min-h-[85vh] flex items-center overflow-hidden"
    >
      {/* Background Shapes Layer */}
      <div className="absolute inset-0 z-0 overflow-hidden">
            <motion.div
                className="absolute -top-20 -left-40 w-96 h-96 bg-blue-300 rounded-full filter blur-3xl opacity-40 animate-blob"
                style={{ animationDelay: '0s' }}
            />
            <motion.div
                className="absolute -bottom-20 -right-20 w-80 h-80 bg-purple-300 rounded-full filter blur-3xl opacity-40 animate-blob"
                style={{ animationDelay: '3s' }}
            />
             <motion.div
                className="absolute top-1/3 right-1/4 w-72 h-72 bg-cyan-200 rounded-lg filter blur-3xl opacity-30 animate-blob transform rotate-45"
                style={{ animationDelay: '6s' }}
            />
      </div>

      {/* Content Layer */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-xl md:max-w-2xl text-center md:text-left">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight drop-shadow-sm"
          >
            Smarter Prescriptions, Healthier Patients.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
            className="text-lg md:text-xl text-gray-700 mb-10 leading-relaxed"
          >
            Prescripto empowers clinicians with AI-driven insights to optimize medication choices, enhance safety, and streamline the prescribing process for better patient care.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
            className="flex flex-col sm:flex-row justify-center md:justify-start items-center space-y-4 sm:space-y-0 sm:space-x-5"
          >
            <motion.a
              href="#features"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-md shadow-md text-base transition duration-300 ease-in-out transform hover:-translate-y-0.5"
              whileHover={{ scale: 1.03, boxShadow: "0px 8px 20px rgba(37, 99, 235, 0.3)" }}
              whileTap={{ scale: 0.98 }}
            >
              Discover Features
            </motion.a>
            <motion.button
              onClick={() => console.log('Request Demo clicked - Placeholder')}
              className="bg-white text-blue-600 font-medium py-3 px-8 rounded-md shadow-sm border border-gray-300 hover:bg-gray-50 hover:border-gray-400 transition duration-300 ease-in-out text-base transform hover:-translate-y-0.5"
              whileHover={{ scale: 1.03, boxShadow: "0px 8px 15px rgba(0, 0, 0, 0.08)" }}
              whileTap={{ scale: 0.98 }}
            >
              Request a Demo
            </motion.button>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

export default Hero; 