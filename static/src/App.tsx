import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import Impact from './components/Impact';
import Footer from './components/Footer';
import LoginPage from './pages/LoginPage';
import PatientProfilePage from './pages/PatientProfilePage';
import ClinicianDashboardPage from './pages/ClinicianDashboardPage';
import { AuthProvider } from './context/AuthContext';
import './App.css'; // Keep App.css for potential global overrides if needed

// Removed Placeholder Login Page Component

// Component for the main landing page content
const LandingPage = () => (
  <>
    <Hero />
    <Features />
    <HowItWorks />
    <Impact />
  </>
);

function App() {
  return (
    <AuthProvider>
      <div className="flex flex-col min-h-screen pt-16 bg-dark-bg">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/patient/profile" element={<PatientProfilePage />} />
            <Route path="/clinician/dashboard" element={<ClinicianDashboardPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}

export default App;
