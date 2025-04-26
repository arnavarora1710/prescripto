import React from 'react';
import { motion } from 'framer-motion';

const impactVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      delay: i * 0.15 + 0.2,
      duration: 0.5,
      ease: "easeOut"
    }
  }),
  hover: {
    y: -6,
    scale: 1.03,
    boxShadow: "0 0 25px rgba(175, 238, 238, 0.4)", // Consistent Pastel Turquoise Glow
    transition: { type: "spring", stiffness: 250, damping: 15 }
  }
};

const Impact: React.FC = () => {
  return (
    <motion.section
      id="impact"
      className="py-20 md:py-28 bg-gradient-to-b from-dark-bg to-[#050505] text-off-white overflow-hidden relative"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
    >
      {/* Subtle moving grid for dark background */}
      <div
        className="absolute inset-0 z-0 opacity-[0.05]"
        style={{
          backgroundImage: 'linear-gradient(#00ff00 1px, transparent 1px), linear-gradient(90deg, #00ff00 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          animation: 'moveGrid 20s linear infinite'
        }}
      >
        <style>
          {`
          @keyframes moveGrid {
            0% { background-position: 0 0; }
            100% { background-position: 120px 60px; } // Move diagonally
          }
        `}
        </style>
      </div>

      {/* Content Wrapper */}
      <div className="container mx-auto px-6 text-center relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: -30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: [0.6, 0.01, 0.05, 0.95] }}
          className="text-3xl md:text-4xl font-bold mb-16 text-electric-blue drop-shadow-md"
        >
          Impact at the Point of Care
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10 max-w-5xl mx-auto">
          {/* Metric 1 -> No Surprise Bills */}
          <motion.div
            custom={0}
            variants={impactVariants}
            whileHover="hover"
            className="bg-dark-card/70 backdrop-blur-sm p-8 rounded-sm shadow-lg shadow-terminal-green/10 border border-terminal-green/40 transform transition-all duration-300"
          >
            <div className="text-5xl font-bold mb-3 text-terminal-green drop-shadow-lg">✓</div> {/* Checkmark instead of % */}
            <p className="text-lg text-off-white font-semibold">Eliminate Surprise Bills</p>
            <p className="text-sm text-off-white/60 mt-2 leading-relaxed">Ensures prescribed medications are covered by patient insurance, preventing unexpected costs.</p>
          </motion.div>
          {/* Metric 2 -> No Allergic Reactions */}
          <motion.div
            custom={1}
            variants={impactVariants}
            whileHover="hover"
            className="bg-dark-card/70 backdrop-blur-sm p-8 rounded-sm shadow-lg shadow-electric-blue/10 border border-electric-blue/40 transform transition-all duration-300"
          >
            <div className="text-5xl font-bold mb-3 text-electric-blue drop-shadow-lg">✓</div> {/* Checkmark */}
            <p className="text-lg text-off-white font-semibold">Prevent Allergic Reactions</p>
            <p className="text-sm text-off-white/60 mt-2 leading-relaxed">Actively filters prescriptions against known patient allergies for enhanced safety.</p>
          </motion.div>
          {/* Metric 3 -> Reduced Rework */}
          <motion.div
            custom={2}
            variants={impactVariants}
            whileHover="hover"
            className="bg-dark-card/70 backdrop-blur-sm p-8 rounded-sm shadow-lg shadow-white/5 border border-off-white/30 transform transition-all duration-300"
          >
            <div className="text-5xl font-bold mb-3 text-off-white/90 drop-shadow-md">✓</div> {/* Checkmark */}
            <p className="text-lg text-off-white font-semibold">Reduce Prescription Rework</p>
            <p className="text-sm text-off-white/60 mt-2 leading-relaxed">Minimizes delays and rework caused by denied prescriptions due to coverage or safety issues.</p>
          </motion.div>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="mt-12 text-off-white/40 italic text-xs"
        >
          Revolutionizing point-of-care decision-making with patient-centered AI.
        </motion.p>
      </div>
    </motion.section>
  );
};

export default Impact; 