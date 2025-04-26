import React from 'react';
import { motion } from 'framer-motion';

const Footer: React.FC = () => {
    return (
        <motion.footer
            className="bg-slate-800 text-gray-400 py-10 border-t-4 border-cyan-500 relative overflow-hidden"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.8 }}
        >
            <div
                className="absolute inset-0 z-0 opacity-[0.03]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
            ></div>

            <div className="container mx-auto px-6 text-center md:flex md:justify-between md:items-center relative z-10">
                <p className="text-sm mb-4 md:mb-0">
                    &copy; {new Date().getFullYear()} Prescripto. AI-Powered Clinical Decision Support.
                </p>
                <div className="flex justify-center space-x-5 text-sm">
                    <a href="#" className="hover:text-white transition duration-300">Privacy Policy</a>
                    <a href="#" className="hover:text-white transition duration-300">Terms of Service</a>
                    <a href="#" className="hover:text-white transition duration-300">Contact Us</a>
                </div>
            </div>
        </motion.footer>
    );
};

export default Footer; 