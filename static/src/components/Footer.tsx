import React from 'react';
import { motion } from 'framer-motion';

const Footer: React.FC = () => {
    return (
        <motion.footer
            className="bg-dark-card text-off-white/60 py-8 border-t border-terminal-green/30 relative overflow-hidden mt-auto"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
        >
            {/* Optional: Add back a very subtle noise/static effect if desired */}
            {/* <div
                className="absolute inset-0 z-0 opacity-[0.015]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 250 250' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' fill='%2300ff00'/%3E%3C/svg%3E")`
                 }}
            ></div> */}

            <div className="container mx-auto px-6 text-center md:flex md:justify-between md:items-center relative z-10">
                <p className="text-sm text-off-white/50 mb-4 md:mb-0">
                    &copy; {new Date().getFullYear()} Prescripto AI | Personalized Prescriptions, Intelligently Optimized.
                </p>
                <div className="flex justify-center space-x-6 text-sm">
                    <a href="#" className="text-off-white/70 hover:text-electric-blue hover:underline transition duration-300">Privacy Policy</a>
                    <a href="#" className="text-off-white/70 hover:text-electric-blue hover:underline transition duration-300">Terms of Service</a>
                    <a href="#" className="text-off-white/70 hover:text-electric-blue hover:underline transition duration-300">Contact Us</a>
                </div>
            </div>
        </motion.footer>
    );
};

export default Footer; 