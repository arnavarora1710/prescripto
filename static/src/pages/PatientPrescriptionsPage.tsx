import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Prescription } from '../types/app';
import { useAuth } from '../context/AuthContext';
import { FaSpinner, FaArrowLeft, FaFilePrescription, FaUserMd, FaCalendarDay, FaAngleRight, FaBell } from 'react-icons/fa';
// import jsPDF from 'jspdf'; // Unused
// import autoTable from 'jspdf-autotable'; // Unused
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import ReminderModal from '../components/ReminderModal';

const PatientPrescriptionsPage: React.FC = () => {
    const navigate = useNavigate();
    const { profile: authProfile, loading: authLoading, error: authError } = useAuth();

    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loadingPageData, setLoadingPageData] = useState(true);
    const [errorPageData, setErrorPageData] = useState<string | null>(null);

    // State for the reminder modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPrescriptionForModal, setSelectedPrescriptionForModal] = useState<Prescription | null>(null);

    // Get the basic profile from context for checks and ID
    const basicPatientProfile = authProfile?.role === 'patient' ? authProfile : null;
    // Determine if the current view is for a patient
    const isPatientView = authProfile?.role === 'patient';

    // Overall loading combines auth loading and page data loading
    const loading = authLoading || loadingPageData;
    const error = authError || errorPageData;

    useEffect(() => {
        const patientId = basicPatientProfile?.profileId;

        if (patientId) {
            const fetchPrescriptions = async () => {
                setLoadingPageData(true);
                setErrorPageData(null);
                try {
                    console.log(`Fetching ALL prescriptions for patient ID: ${patientId}`);
                    const { data, error } = await supabase
                        .from('prescriptions')
                        .select(`
              *,
              clinicians: clinician_id ( id, username )
            `)
                        .eq('patient_id', patientId)
                        .order('created_at', { ascending: false }); // No limit

                    if (error) throw new Error(`Prescriptions Fetch Error: ${error.message}`);

                    console.log("All Prescriptions Data:", data);
                    setPrescriptions(data || []);

                } catch (err: any) {
                    console.error("Error fetching prescriptions:", err);
                    setErrorPageData(err.message || "Failed to load prescriptions.");
                } finally {
                    setLoadingPageData(false);
                }
            };
            fetchPrescriptions();
        } else if (!authLoading) {
            setLoadingPageData(false);
            if (!basicPatientProfile) {
                setErrorPageData("Logged in user is not a patient or profile is missing.");
            }
        }
    }, [basicPatientProfile?.profileId, authLoading]);

    // --- Add Modal Handler Functions --- 
    // Function to open the modal
    const handleOpenReminderModal = (prescription: Prescription) => {
        setSelectedPrescriptionForModal(prescription);
        setIsModalOpen(true);
    };

    // Function to close the modal
    const handleCloseReminderModal = () => {
        setIsModalOpen(false);
        setSelectedPrescriptionForModal(null);
    };
    // --- End Modal Handler Functions --- 

    // --- PDF Generation Function (Copied from PatientProfilePage) ---
    // const generatePrescriptionPdf = (prescription: Prescription) => {
    // --- End PDF Generation Function ---

    // Render Logic
    return (
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <h1 className="text-3xl sm:text-4xl font-bold text-white">My Prescription History</h1>
                <button
                    onClick={() => navigate('/patient/profile')}
                    className="flex items-center px-4 py-2 border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition duration-200 text-sm font-medium group"
                >
                    <FaArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" /> Back to Profile
                </button>
            </div>

            {/* Loading State - Use primary accent */}
            {loading && (
                <div className="text-center py-10">
                    <FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-primary-accent" /> Loading prescriptions...
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-center mb-6">
                    Error: {error}
                </div>
            )}

            {/* Content - Use primary glow on card hover */}
            {!loading && !error && (
                <div className="animate-fade-in">
                    {prescriptions.length > 0 ? (
                        <ul className="bg-dark-card border border-border-color rounded-xl shadow-lg divide-y divide-border-color/30">
                            {prescriptions.map((rx) => (
                                <li key={rx.id} className="flex items-center justify-between p-3 sm:p-4 hover:bg-dark-input/50 transition duration-150 group">
                                    {rx.visit_id ? (
                                        <Link
                                            to={`/visit/${rx.visit_id}`}
                                            className="flex-grow flex items-center justify-between mr-4"
                                        >
                                            <div className="flex-grow mr-4">
                                                <h2 className="font-semibold text-sm sm:text-base text-primary-accent flex items-center mb-1">
                                                    <FaFilePrescription className="mr-2 h-4 w-4 text-primary-accent/80 flex-shrink-0" />
                                                    {rx.medication || 'Unnamed Prescription'}
                                                </h2>
                                                <div className="text-xs text-off-white/70 flex flex-col sm:flex-row sm:gap-x-4">
                                                    <span className="flex items-center mb-0.5 sm:mb-0">
                                                        <FaCalendarDay className="mr-1.5 h-3 w-3 text-off-white/50 flex-shrink-0" />
                                                        Issued: {format(new Date(rx.created_at), 'PPP')}
                                                    </span>
                                                    <span className="flex items-center">
                                                        <FaUserMd className="mr-1.5 h-3 w-3 text-off-white/50 flex-shrink-0" />
                                                        Prescriber: {rx.clinicians?.username || 'Unknown'}
                                                    </span>
                                                </div>
                                            </div>
                                            <FaAngleRight className="h-5 w-5 text-off-white/40 group-hover:text-primary-accent group-hover:translate-x-1 transition-all duration-200 flex-shrink-0 ml-auto" />
                                        </Link>
                                    ) : (
                                        <div className="flex-grow flex items-center justify-between mr-4 text-off-white/50 italic">
                                            <span>{rx.medication || 'Unnamed Prescription'} (No visit link)</span>
                                        </div>
                                    )}
                                    {isPatientView && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenReminderModal(rx);
                                            }}
                                            className="ml-4 flex-shrink-0 p-2 rounded-full hover:bg-electric-blue/20 text-electric-blue/70 hover:text-electric-blue transition-colors duration-200"
                                            title={`Set reminder for ${rx.medication}`}
                                        >
                                            <FaBell className="h-4 w-4" />
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-off-white/60 text-center py-10 italic">No prescription history found.</p>
                    )}
                </div>
            )}

            {/* Render the Modal */}
            <ReminderModal
                isOpen={isModalOpen}
                onClose={handleCloseReminderModal}
                prescription={selectedPrescriptionForModal}
            />
        </div>
    );
};

export default PatientPrescriptionsPage; 