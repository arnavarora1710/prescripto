import React from 'react';
import { motion } from 'framer-motion';

const featureVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.15,
            duration: 0.6,
            ease: [0.6, 0.01, 0.05, 0.95]
        }
    }),
    hover: {
        y: -5,
        boxShadow: "0 0 20px rgba(175, 238, 238, 0.4)", // Consistent Pastel Turquoise Glow
        transition: { type: "spring", stiffness: 300, damping: 15 }
    }
};

// Define Icon components locally within Features
const AIBrainIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        {/* Icon representing cost/insurance check - Using a chip/brain like icon */}
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.092 1.21-.138 2.43-.138 3.662v1.5a4.5 4.5 0 004.5 4.5h3.75a4.5 4.5 0 004.5-4.5v-1.5zM12 15.75a3 3 0 01-3-3A3 3 0 0112 9.75a3 3 0 013 3 3 3 0 01-3 3z" />
    </svg>
);
const ShieldCheckIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        {/* Good fit for safety */}
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.623 0-1.602-.39-3.115-1.07-4.418" />
    </svg>
);
const IntegrationIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        {/* Icon representing explanation/docs - Using a document icon */}
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h.008v.008H8.25v-.008zm0 2.25h.008v.008H8.25V17.25zm0 2.25h.008V19.5H8.25v-.008zm2.25-4.5h.008v.008H10.5v-.008zm0 2.25h.008v.008H10.5V17.25zm0 2.25h.008V19.5H10.5v-.008zm2.25-4.5h.008v.008H12.75v-.008zm0 2.25h.008v.008H12.75V17.25zm0 2.25h.008V19.5H12.75v-.008zM6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
    </svg>
);

const Features: React.FC = () => {
    return (
        <motion.section
            id="features"
            className="py-20 md:py-28 bg-dark-card overflow-hidden"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
        >
            <div className="container mx-auto px-6">
                <motion.h2
                    initial={{ opacity: 0, y: -30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.6, ease: [0.6, 0.01, 0.05, 0.95] }}
                    className="text-3xl md:text-4xl font-bold text-center text-electric-blue mb-16"
                >
                    Core Intelligence Features
                </motion.h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
                    {/* Card 1 -> Insurance-Aware Prescribing */}
                    <motion.div
                        custom={0}
                        variants={featureVariants}
                        whileHover="hover"
                        className="bg-dark-bg p-8 rounded-sm border border-terminal-green/40 flex flex-col cursor-pointer h-full overflow-hidden shadow-lg shadow-terminal-green/10"
                    >
                        <div className="mb-5 flex-shrink-0 text-terminal-green">
                            <AIBrainIcon /> 
                        </div>
                        <h3 className="text-xl font-semibold text-terminal-green mb-3 flex-shrink-0">Insurance-Aware Prescribing</h3>
                        <p className="text-off-white/70 text-sm leading-relaxed flex-grow">
                            Picks the best medication options covered under the patient's specific insurance plan, displaying cost tier and prior authorization flags.
                        </p>
                        <div className="mt-auto pt-4">
                            <span className="block h-1 w-12 bg-terminal-green rounded-full opacity-50"></span>
                        </div>
                    </motion.div>
                    {/* Card 2 -> Allergy-Safe Suggestions */}
                    <motion.div
                        custom={1}
                        variants={featureVariants}
                        whileHover={{...featureVariants.hover, boxShadow: "0 0 20px rgba(173, 216, 230, 0.5)"} /* Pastel Blue glow */}
                        className="bg-dark-bg p-8 rounded-sm border border-electric-blue/40 flex flex-col cursor-pointer h-full overflow-hidden shadow-lg shadow-electric-blue/10"
                    >
                        <div className="mb-5 flex-shrink-0 text-electric-blue">
                            <ShieldCheckIcon /> 
                        </div>
                        <h3 className="text-xl font-semibold text-electric-blue mb-3 flex-shrink-0">Allergy-Safe Suggestions</h3>
                        <p className="text-off-white/70 text-sm leading-relaxed flex-grow">
                            Automatically filters out drugs based on the patient's known allergens, preventing potentially harmful interactions.
                        </p>
                        <div className="mt-auto pt-4">
                            <span className="block h-1 w-12 bg-electric-blue rounded-full opacity-50"></span>
                        </div>
                    </motion.div>
                    {/* Card 3 -> Explainable AI */}
                    <motion.div
                        custom={2}
                        variants={featureVariants}
                         whileHover={{...featureVariants.hover, boxShadow: "0 0 20px rgba(211, 211, 211, 0.3)"} /* Pastel Gray glow */}
                        className="bg-dark-bg p-8 rounded-sm border border-off-white/30 flex flex-col cursor-pointer h-full overflow-hidden shadow-lg shadow-white/5"
                    >
                        <div className="mb-5 flex-shrink-0 text-off-white/80">
                            <IntegrationIcon /> 
                        </div>
                        <h3 className="text-xl font-semibold text-off-white/90 mb-3 flex-shrink-0">Explainable AI Summaries</h3>
                        <p className="text-off-white/70 text-sm leading-relaxed flex-grow">
                            Provides clear, LLM-generated summaries explaining the rationale behind prescription choices for enhanced transparency.
                        </p>
                        <div className="mt-auto pt-4">
                            <span className="block h-1 w-12 bg-off-white rounded-full opacity-40"></span>
                        </div>
                    </motion.div>
                </div>
            </div>
        </motion.section>
    );
};

export default Features; 