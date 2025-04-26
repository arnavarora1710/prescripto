import React from 'react';
import { motion } from 'framer-motion';
import { FaFileMedicalAlt, FaShieldAlt, FaBrain, FaDesktop } from 'react-icons/fa';

const featureVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            delay: i * 0.15, // Stagger the animation slightly
            duration: 0.6,
            ease: "easeOut"
        }
    })
};

const featuresData = [
    {
        icon: <FaFileMedicalAlt className="text-4xl text-cyan-500 mb-4" />,
        title: "Insurance-Aware Prescribing",
        description: "Picks the best option covered under a patient's insurance, displaying cost tiers.",
    },
    {
        icon: <FaShieldAlt className="text-4xl text-green-500 mb-4" />,
        title: "Allergy-Safe Suggestions",
        description: "Filters out drugs interacting with the patient's known allergens.",
    },
    {
        icon: <FaBrain className="text-4xl text-purple-500 mb-4" />,
        title: "Explainable AI",
        description: "LLM-generated summaries clarify decisions for doctors and patients.",
    },
    {
        icon: <FaDesktop className="text-4xl text-orange-500 mb-4" />,
        title: "Interactive Demo",
        description: "Experience real-time, personalized prescription generation.",
    },
];

const Features: React.FC = () => {
    return (
        <motion.section
            id="features"
            className="py-20 md:py-28 bg-gradient-to-b from-blue-100 via-cyan-50 to-emerald-50 overflow-hidden"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
        >
            <div className="container mx-auto px-6">
                <motion.h2
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, amount: 0.5 }}
                    transition={{ duration: 0.5 }}
                    className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-16"
                >
                    Designed for Clinical Excellence
                </motion.h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {featuresData.map((feature, index) => (
                        <motion.div
                            key={index}
                            custom={index}
                            variants={featureVariants}
                            whileHover={{ scale: 1.04, y: -6, boxShadow: "0 12px 25px rgba(0, 0, 0, 0.1)" }}
                            transition={{ type: "spring", stiffness: 300, damping: 15 }}
                            className="bg-gradient-to-br from-white via-blue-50 to-white p-8 rounded-xl shadow-lg border border-gray-200 flex flex-col cursor-pointer overflow-hidden relative"
                        >
                            <div className="absolute -top-4 -left-4 w-20 h-20 bg-blue-100 rounded-full opacity-30 blur-lg"></div>
                            <div className="relative z-10">
                                <div className="text-blue-500 mb-4">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m beaker" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.625 13.5a1.125 1.125 0 1 1 0-2.25 1.125 1.125 0 0 1 0 2.25Zm0 0v5.625a3.375 3.375 0 0 0 3.375 3.375h3.75a3.375 3.375 0 0 0 3.375-3.375V13.5m0-2.25h-9" />
                                    </svg>
                                </div>
                                <h3 className="text-xl font-semibold text-gray-800 mb-3">{feature.title}</h3>
                                <p className="text-gray-600 flex-grow">{feature.description}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </motion.section>
    );
};

export default Features; 