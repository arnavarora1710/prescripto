import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Visit, Prescription, Patient, Clinician } from '../types/app'; // Import necessary types
import { useAuth } from '../context/AuthContext'; // To check user role if needed
import { FaSpinner, FaArrowLeft, FaCalendarAlt, FaUserMd, FaNotesMedical, FaRegCommentDots, FaFilePrescription, FaPills, FaStickyNote, FaUserCircle } from 'react-icons/fa';
import { format } from 'date-fns';

// Define a type for the full visit details expected from the database/RPC
interface FullVisitDetails extends Visit {
    prescriptions?: Prescription[];
    patients?: Patient;      // Changed from patient to patients to match potential join result
    clinicians?: Clinician;  // Changed from clinician to clinicians
}

const VisitDetailPage: React.FC = () => {
    const { visitId } = useParams<{ visitId: string }>();
    const navigate = useNavigate();
    const { profile: authProfile, loading: authLoading } = useAuth();

    const [visit, setVisit] = useState<FullVisitDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!visitId) {
            setError('Visit ID not found in URL.');
            setLoading(false);
            return;
        }

        const fetchVisitDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                console.log(`Fetching details for visit ID: ${visitId}`);
                // Fetch visit, related patient, clinician, and prescriptions in one go
                const { data, error: fetchError } = await supabase
                    .from('visits')
                    .select(`
                        *,
                        patients (*),
                        clinicians (*),
                        prescriptions (*)
                    `)
                    .eq('id', visitId)
                    .single(); // Expecting only one visit

                if (fetchError) throw fetchError;
                if (!data) throw new Error("Visit not found.");

                console.log("Visit Details Data:", data);
                // Cast the data to FullVisitDetails for type safety
                setVisit(data as FullVisitDetails);

            } catch (err: any) {
                console.error("Error fetching visit details:", err);
                setError(err.message || "Failed to load visit details.");
            } finally {
                setLoading(false);
            }
        };

        fetchVisitDetails();
    }, [visitId]);

    // --- Render Logic ---
    if (authLoading || loading) {
        return (
            <div className="container mx-auto px-4 py-16 text-center text-white">
                <FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-primary-accent" /> Loading visit details...
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-16 text-center">
                <div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg inline-block">
                    Error: {error}
                </div>
            </div>
        );
    }

    if (!visit) {
        return (
            <div className="container mx-auto px-4 py-16 text-center text-white">
                Visit data not found.
            </div>
        );
    }

    // Determine patient/clinician names
    const patientName = visit.patients?.username || 'Patient';
    const clinicianName = visit.clinicians?.username || 'Clinician';
    const isPatientView = authProfile?.role === 'patient';

    return (
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <button
                    onClick={() => navigate(-1)} // Go back
                    className="flex items-center px-4 py-2 border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition duration-200 text-sm font-medium group"
                >
                    <FaArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" /> Back
                </button>
                <h1 className="text-3xl sm:text-4xl font-bold text-white text-center flex-grow">Visit Details</h1>
                <div className="w-20"></div> {/* Spacer */}
            </div>

            {/* Main Content Card */}
            <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in">

                {/* Visit Info Section */}
                <div className="border-b border-border-color/40 pb-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                        <p className="font-semibold text-lg text-primary-accent flex items-center">
                            <FaCalendarAlt className="mr-2.5 h-4 w-4 text-primary-accent/80" />
                            Visit on {format(new Date(visit.visit_date), 'PPPp')}
                        </p>
                        <p className="text-sm text-off-white/70 flex items-center">
                            {isPatientView ? <FaUserMd className="mr-2 h-4 w-4 text-off-white/50" /> : <FaUserCircle className="mr-2 h-4 w-4 text-off-white/50" />}
                            {isPatientView ? `Clinician: ${clinicianName}` : `Patient: ${patientName}`}
                        </p>
                    </div>
                    <p className="text-sm text-off-white/80 flex items-start">
                        <FaRegCommentDots className="mr-2 mt-0.5 h-4 w-4 text-pastel-blue/70 flex-shrink-0" />
                        <span><span className="font-medium text-off-white/90">Reason:</span> {visit.reason || <span className="italic text-off-white/60">N/A</span>}</span>
                    </p>
                </div>

                {/* Visit Notes Section */}
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-pastel-lavender mb-3 flex items-center">
                        <FaNotesMedical className="mr-2.5 h-5 w-5" />
                        Visit Notes
                    </h2>
                    {visit.notes ? (
                        <p className="text-sm text-off-white/90 whitespace-pre-wrap bg-dark-input/50 p-4 rounded-md border border-border-color/30 font-mono text-xs leading-relaxed">
                            {visit.notes}
                        </p>
                    ) : (
                        <p className="text-sm text-off-white/60 italic pl-1">No notes were recorded for this visit.</p>
                    )}
                </div>

                {/* Prescriptions Section (if any) */}
                {visit.prescriptions && visit.prescriptions.length > 0 && (
                    <div className="pt-6 border-t border-border-color/40">
                        <h2 className="text-xl font-semibold text-pastel-blue mb-4 flex items-center">
                            <FaFilePrescription className="mr-2.5 h-5 w-5" />
                            Prescriptions Issued ({visit.prescriptions.length})
                        </h2>
                        <ul className="space-y-4">
                            {visit.prescriptions.map((rx) => (
                                <li key={rx.id} className="bg-dark-input/60 p-4 rounded-lg border border-border-color/50 shadow-sm">
                                    <p className="font-semibold text-base text-off-white mb-1.5 flex items-center">
                                        <FaPills className="mr-2 h-4 w-4 text-pastel-blue/70" />
                                        {rx.medication}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs pl-6 text-off-white/80 mb-2">
                                        <span><span className="font-medium text-off-white/90">Dosage:</span> {rx.dosage || 'N/A'}</span>
                                        <span><span className="font-medium text-off-white/90">Frequency:</span> {rx.frequency || 'N/A'}</span>
                                    </div>
                                    {rx.notes && (
                                        <div className="mt-2 pt-2 border-t border-border-color/20 pl-6">
                                            <p className="text-xs font-medium text-off-white/90 mb-0.5 flex items-center">
                                                <FaStickyNote className="mr-1.5 h-3 w-3 text-pastel-lavender/80" /> Notes:
                                            </p>
                                            <p className="text-xs text-off-white/70 italic whitespace-pre-wrap">
                                                {rx.notes}
                                            </p>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VisitDetailPage; 