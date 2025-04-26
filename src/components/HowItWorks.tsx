import React from 'react';
import { motion } from 'framer-motion';

const stepVariants = {
  hidden: { opacity: 0, x: -40 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: i * 0.2,
      duration: 0.6,
      ease: "easeOut"
    }
  })
};

const HowItWorks: React.FC = () => {
  return (
    <motion.section
      id="how-it-works"
      className="py-20 md:py-28 bg-white overflow-hidden relative"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: 'radial-gradient(#d1d5db 1px, transparent 1px)',
          backgroundSize: '15px 15px',
          opacity: 0.2
        }}
      ></div>
      <div className="container mx-auto px-6 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-16"
        >
          Streamlined Prescribing in 3 Steps
        </motion.h2>
        <div className="relative max-w-4xl mx-auto">
          {/* Colored & Animated Connecting line */}
          <motion.div
            className="hidden md:block absolute top-10 left-0 w-full h-1 z-0"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1, delay: 0.4, ease: "easeInOut" }}
            style={{ transformOrigin: 'left' }}
          >
            <div className="w-full h-full bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 rounded-full"></div>
           </motion.div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 text-center">
            {/* Step 1 */}
            <motion.div
              custom={0}
              variants={stepVariants}
              className="flex flex-col items-center"
            >
              <motion.div
                className="flex items-center justify-center w-20 h-20 mb-6 rounded-full font-bold text-3xl border-2 shadow-lg relative bg-white
                           border-cyan-400 text-cyan-600"
                initial={{ scale: 0, rotate: -45 }}
                whileInView={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.3 }}
              >
                 {/* Heroicon: User Circle */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </motion.div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">1. Input Patient Context</h3>
              <p className="text-gray-600 text-sm sm:text-base px-4 md:px-0">
                  Securely integrate or input relevant patient history, current conditions, medications, and insurance details.
              </p>
            </motion.div>
            {/* Step 2 */}
            <motion.div
              custom={1}
              variants={stepVariants}
              className="flex flex-col items-center"
            >
              <motion.div
                className="flex items-center justify-center w-20 h-20 mb-6 rounded-full font-bold text-3xl border-2 shadow-lg relative bg-white
                           border-blue-400 text-blue-600"
                initial={{ scale: 0, rotate: -45 }}
                whileInView={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.5 }}
              >
                {/* Heroicon: Cpu Chip */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
                </svg>
              </motion.div>
               <h3 className="text-xl font-semibold text-gray-800 mb-3">2. AI Analysis & Suggestions</h3>
               <p className="text-gray-600 text-sm sm:text-base px-4 md:px-0">
                 Our AI analyzes the complete picture, generating safe, effective, and cost-conscious prescription options based on the latest clinical data.
               </p>
            </motion.div>
            {/* Step 3 */}
            <motion.div
              custom={2}
              variants={stepVariants}
              className="flex flex-col items-center"
            >
              <motion.div
                 className="flex items-center justify-center w-20 h-20 mb-6 rounded-full font-bold text-3xl border-2 shadow-lg relative bg-white
                            border-purple-400 text-purple-600"
                initial={{ scale: 0, rotate: -45 }}
                whileInView={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 100, damping: 15, delay: 0.7 }}
              >
                {/* Heroicon: Document Check */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m.75 12 3 3m0 0 3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </motion.div>
               <h3 className="text-xl font-semibold text-gray-800 mb-3">3. Clinician Review & e-Prescribe</h3>
               <p className="text-gray-600 text-sm sm:text-base px-4 md:px-0">
                 Review the AI-generated recommendations, make final adjustments, and electronically prescribe with confidence in just a few clicks.
               </p>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default HowItWorks; 