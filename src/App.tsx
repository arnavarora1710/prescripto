import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import Impact from './components/Impact';
import Footer from './components/Footer';
import './App.css'; // Keep App.css for potential global overrides if needed

function App() {
  return (
    <div className="flex flex-col min-h-screen pt-16">
      <Navbar />
      <main className="flex-grow">
        <Hero />
        <Features />
        <HowItWorks />
        <Impact />
      </main>
      <Footer />
    </div>
  );
}

export default App;
