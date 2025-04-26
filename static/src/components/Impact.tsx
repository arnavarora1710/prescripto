import React from 'react';
import { motion } from 'framer-motion';

const impactVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.15,
      duration: 0.5,
      ease: "easeOut"
    }
  })
};

const Impact: React.FC = () => {
  return (
    <motion.section
      id="impact"
      className="py-20 md:py-28 bg-gradient-to-br from-blue-700 via-indigo-800 to-purple-900 text-white overflow-hidden relative"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.1 }}
    >
      {/* Background Pattern Overlay */}
      <div
        className="absolute inset-0 z-0 opacity-10"
        style={{
            backgroundImage:
                'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%), ' +
                'linear-gradient(-45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%)',
            backgroundSize: '30px 30px',
        }}
      ></div>

      {/* Content Wrapper should be relative and z-10 */}
      <div className="container mx-auto px-6 text-center relative z-10">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5 }}
          className="text-3xl md:text-4xl font-bold mb-16"
        >
          Proven Results for Your Practice
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Metric 1 */}
          <motion.div
            custom={0}
            variants={impactVariants}
            whileHover={{ y: -5, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
            className="bg-gradient-to-br from-cyan-500 to-blue-600 p-8 rounded-lg shadow-xl border border-cyan-400/50 transform transition-transform duration-300"
          >
            <div className="text-5xl font-bold mb-3 text-white drop-shadow-md">40%</div>
            <p className="text-lg text-blue-100 font-semibold">Reduction in Errors</p>
            <p className="text-sm text-blue-200 mt-2">Minimizing adverse drug events and enhancing patient safety.</p>
          </motion.div>
          {/* Metric 2 */}
          <motion.div
            custom={1}
            variants={impactVariants}
            whileHover={{ y: -5, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
            className="bg-gradient-to-br from-green-500 to-emerald-600 p-8 rounded-lg shadow-xl border border-green-400/50 transform transition-transform duration-300"
          >
            <div className="text-5xl font-bold mb-3 text-white drop-shadow-md">25%</div>
            <p className="text-lg text-emerald-100 font-semibold">Faster Workflow</p>
            <p className="text-sm text-emerald-200 mt-2">Saving valuable clinician time and improving operational efficiency.</p>
          </motion.div>
          {/* Metric 3 */}
          <motion.div
            custom={2}
            variants={impactVariants}
            whileHover={{ y: -5, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
            className="bg-gradient-to-br from-yellow-400 to-amber-500 p-8 rounded-lg shadow-xl border border-yellow-300/50 transform transition-transform duration-300"
          >
            <div className="text-5xl font-bold mb-3 text-white drop-shadow-md">15%</div>
            <p className="text-lg text-amber-100 font-semibold">Improved Adherence</p>
             <p className="text-sm text-amber-200 mt-2">Optimizing medication choices based on cost-effectiveness and coverage.</p>
          </motion.div>
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-12 text-blue-200 italic text-xs"
        >
          *Metrics based on aggregated data from pilot programs and internal studies. Individual results may vary.
        </motion.p>
      </div>
    </motion.section>
  );
};

export default Impact; 