import React from 'react';
import { motion } from 'framer-motion';

// Simplified Background Effect - Scanlines & Subtle Grid
const AnimatedBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/* Subtle grid using pseudo-elements might be better handled in CSS, but this adds another layer */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)',
          backgroundSize: '70px 70px',
          maskImage: 'radial-gradient(ellipse at center, white 50%, transparent 100%)', // Fade out grid edges
        }}
      ></div>
      {/* Overlay Scanline effect - can be combined with body scanline */}
      {/* <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: 'linear-gradient(rgba(0, 255, 0, 1) 1px, transparent 1px)', backgroundSize: '1px 4px', animation: 'scanline 10s linear infinite' }}></div> */}
    </div>
  );
};

const Hero: React.FC = () => {
  return (
    <motion.section
      id="hero"
      className="relative bg-dark-bg pt-32 pb-20 md:pt-40 md:pb-28 min-h-[85vh] flex items-center overflow-hidden"
    >
      <AnimatedBackground />

      {/* Content Layer */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-xl md:max-w-2xl text-center md:text-left">
          <motion.h1
            initial={{ opacity: 0, y: 50, filter: 'blur(5px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-electric-blue mb-6 leading-tight cursor-default"
            style={{ textShadow: '0 0 10px rgba(0, 255, 255, 0.4)' }}
          >
            Personalized Prescriptions,
            <br />
            Intelligently Optimized.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
            className="text-lg md:text-xl text-off-white/80 mb-10 leading-relaxed"
          >
            Prescripto AI assists doctors in real-time, generating insurance-aware, allergen-safe, and cost-effective treatment plans explained clearly by LLM intelligence.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex flex-col sm:flex-row justify-center md:justify-start items-center space-y-4 sm:space-y-0 sm:space-x-5"
          >
            {/* Buttons reflecting key actions/info */}
            <motion.a
              href="#features"
              className="bg-dark-card text-electric-blue font-medium py-3 px-8 rounded-sm border border-electric-blue/50 hover:bg-electric-blue/10 hover:shadow-[0_0_15px_rgba(0,255,255,0.5)] transition-all duration-300 text-base transform hover:-translate-y-1 cursor-pointer"
              whileHover={{ scale: 1.03, boxShadow: "0 0 15px rgba(0, 255, 255, 0.5)" }}
              whileTap={{ scale: 0.98 }}
            >
              See Key Features
            </motion.a>
            <motion.button
              onClick={() => console.log('Learn More clicked - Placeholder')}
              className="bg-dark-card text-terminal-green font-medium py-3 px-8 rounded-sm border border-terminal-green/50 hover:bg-terminal-green/10 hover:shadow-[0_0_15px_rgba(0,255,0,0.5)] transition-all duration-300 text-base transform hover:-translate-y-1 cursor-pointer"
              whileHover={{ scale: 1.03, boxShadow: "0 0 15px rgba(0, 255, 0, 0.5)" }}
              whileTap={{ scale: 0.98 }}
            >
              Learn More
            </motion.button>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};

export default Hero; 