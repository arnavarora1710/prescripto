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
import PatientDetailPageClinicianView from './pages/PatientDetailPageClinicianView';
import AddNewVisitPage from './pages/AddNewVisitPage';
import PatientPrescriptionsPage from './pages/PatientPrescriptionsPage';
import PatientVisitsPage from './pages/PatientVisitsPage';
import { AuthProvider } from './context/AuthContext';
import './App.css'; // Keep App.css for potential global overrides if needed
import VisitDetailPage from './pages/VisitDetailPage';
import ChatbotPage from './pages/ChatbotPage';

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
            <Route path="/patient/prescriptions" element={<PatientPrescriptionsPage />} />
            <Route path="/patient/visits" element={<PatientVisitsPage />} />
            <Route path="/clinician/dashboard" element={<ClinicianDashboardPage />} />
            <Route
              path="/clinician/patient/:patientId"
              element={<PatientDetailPageClinicianView />}
            />
            <Route
              path="/clinician/add-visit"
              element={<AddNewVisitPage />}
            />
            <Route path="/visit/:visitId" element={<VisitDetailPage />} />
            <Route path="/visit/:visitId/chat" element={<ChatbotPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}

export default App;
