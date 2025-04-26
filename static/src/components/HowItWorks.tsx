import React from 'react';
import { motion } from 'framer-motion';

const stepVariants = {
  hidden: { opacity: 0, filter: 'blur(4px)', y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    filter: 'blur(0px)',
    y: 0,
    transition: {
      delay: i * 0.2 + 0.3, // Start after line animation
      duration: 0.7,
      ease: "easeOut"
    }
  })
};

// Icons (using simpler versions)
const UserCircleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);
const CpuChipIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 6.75v10.5a2.25 2.25 0 002.25 2.25zM10.5 10.5h3v3h-3v-3z" />
  </svg>
);
const DocumentCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-9 w-9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M9 12h6m2 5.25H7a2.25 2.25 0 01-2.25-2.25V6.75a2.25 2.25 0 012.25-2.25h7.5a2.25 2.25 0 012.25 2.25v4.5m-9 6h9" />
  </svg>
);

const HowItWorks: React.FC = () => {
  return (
    <motion.section
      id="how-it-works"
      className="py-20 md:py-28 bg-dark-bg overflow-hidden relative"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
    >
      {/* Dark grid lines */}
      <div
        className="absolute inset-0 z-0 opacity-[0.06]"
        style={{
          backgroundImage: 'linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}
      ></div>

      {/* Content Wrapper */}
      <div className="container mx-auto px-6 relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: [0.6, 0.01, 0.05, 0.95] }}
          className="text-3xl md:text-4xl font-bold text-center text-electric-blue mb-20"
        >
          Real-Time Prescription Workflow
        </motion.h2>
        <div className="relative max-w-5xl mx-auto">
          {/* Green Connecting line */}
          <motion.div
            className="hidden md:block absolute top-9 left-0 w-full h-0.5 z-0"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 1, delay: 0.2, ease: "easeInOut" }}
            style={{ transformOrigin: 'left' }}
          >
            <div className="w-full h-full bg-terminal-green opacity-50 rounded-full"></div>
          </motion.div>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-10">
            {/* Step 1 - Green Accent */}
            <motion.div
              custom={0}
              variants={stepVariants}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                className="flex items-center justify-center w-20 h-20 mb-5 rounded-full shadow-lg shadow-terminal-green/20 relative bg-dark-card border border-terminal-green/50 text-terminal-green"
                whileHover={{ scale: 1.1, boxShadow: "0 0 15px rgba(0, 255, 0, 0.5)" }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
              >
                <UserCircleIcon />
                <span className="absolute -top-2 -right-2 bg-terminal-green text-dark-bg rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold">1</span>
              </motion.div>
              <h3 className="text-lg font-semibold text-terminal-green mb-2">Patient Profile & Diagnosis</h3>
              <p className="text-off-white/70 text-sm leading-relaxed">
                Patient provides insurance/allergy profile. Doctor inputs the diagnosis via text or voice.
              </p>
            </motion.div>
            {/* Step 2 - Electric Blue Accent */}
            <motion.div
              custom={1}
              variants={stepVariants}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                className="flex items-center justify-center w-20 h-20 mb-5 rounded-full shadow-lg shadow-electric-blue/20 relative bg-dark-card border border-electric-blue/50 text-electric-blue"
                whileHover={{ scale: 1.1, boxShadow: "0 0 15px rgba(0, 255, 255, 0.5)" }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
              >
                <CpuChipIcon />
                <span className="absolute -top-2 -right-2 bg-electric-blue text-dark-bg rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold">2</span>
              </motion.div>
              <h3 className="text-lg font-semibold text-electric-blue mb-2">AI Generates Options</h3>
              <p className="text-off-white/70 text-sm leading-relaxed">
                Prescripto AI instantly analyzes data, checks formulary/allergies, and suggests optimal, safe, covered prescriptions.
              </p>
            </motion.div>
            {/* Step 3 - Off White Accent */}
            <motion.div
              custom={2}
              variants={stepVariants}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                className="flex items-center justify-center w-20 h-20 mb-5 rounded-full shadow-lg shadow-white/10 relative bg-dark-card border border-off-white/40 text-off-white/80"
                whileHover={{ scale: 1.1, boxShadow: "0 0 15px rgba(224, 224, 224, 0.3)" }}
                transition={{ type: "spring", stiffness: 200, damping: 10 }}
              >
                <DocumentCheckIcon />
                <span className="absolute -top-2 -right-2 bg-off-white text-dark-bg rounded-full h-6 w-6 flex items-center justify-center text-xs font-bold">3</span>
              </motion.div>
              <h3 className="text-lg font-semibold text-off-white/90 mb-2">Review & Explain</h3>
              <p className="text-off-white/70 text-sm leading-relaxed">
                Doctor reviews options and LLM explanations, confirms the choice, and prints/sends the prescription.
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.section>
  );
};

export default HowItWorks; 