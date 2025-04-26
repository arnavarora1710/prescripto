import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Visit } from '../types/app';
import { useAuth } from '../context/AuthContext';
import { FaSpinner, FaArrowLeft, FaCalendarAlt, FaUserMd, FaNotesMedical, FaRegCommentDots, FaAngleRight } from 'react-icons/fa';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';

const PatientVisitsPage: React.FC = () => {
    const navigate = useNavigate();
    const { profile: authProfile, loading: authLoading, error: authError } = useAuth();

    const [visits, setVisits] = useState<Visit[]>([]);
    const [loadingPageData, setLoadingPageData] = useState(true);
    const [errorPageData, setErrorPageData] = useState<string | null>(null);

    // Get the basic profile from context for checks and ID
    const basicPatientProfile = authProfile?.role === 'patient' ? authProfile : null;

    // Overall loading combines auth loading and page data loading
    const loading = authLoading || loadingPageData;
    const error = authError || errorPageData;

    useEffect(() => {
        const patientId = basicPatientProfile?.profileId;

        if (patientId) {
            const fetchVisits = async () => {
                setLoadingPageData(true);
                setErrorPageData(null);
                try {
                    console.log(`Fetching ALL visits for patient ID: ${patientId}`);
                    const { data, error } = await supabase
                        .from('visits')
                        .select(`
                          *,
                          clinicians: clinician_id ( id, username ) 
                        `)
                        .eq('patient_id', patientId)
                        .order('visit_date', { ascending: false }); // No limit

                    if (error) throw new Error(`Visits Fetch Error: ${error.message}`);

                    console.log("All Visits Data:", data);
                    setVisits(data || []);

                } catch (err: any) {
                    console.error("Error fetching visits:", err);
                    setErrorPageData(err.message || "Failed to load visit history.");
                } finally {
                    setLoadingPageData(false);
                }
            };
            fetchVisits();
        } else if (!authLoading) {
            setLoadingPageData(false);
            if (!basicPatientProfile) {
                setErrorPageData("Logged in user is not a patient or profile is missing.");
            }
        }
    }, [basicPatientProfile?.profileId, authLoading]);

    // Render Logic
    return (
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
            <div className="flex items-center justify-between mb-10">
                <h1 className="text-3xl sm:text-4xl font-bold text-white">My Visit History</h1>
                <button
                    onClick={() => navigate('/patient/profile')}
                    className="flex items-center px-4 py-2 border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition duration-200 text-sm font-medium group"
                >
                    <FaArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" /> Back to Profile
                </button>
            </div>

            {loading && (
                <div className="text-center py-10">
                    <FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-primary-accent" /> Loading visit history...
                </div>
            )}

            {error && (
                <div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-center mb-6">
                    Error: {error}
                </div>
            )}

            {!loading && !error && (
                <div className="animate-fade-in">
                    {visits.length > 0 ? (
                        <ul className="bg-dark-card border border-border-color rounded-xl shadow-lg divide-y divide-border-color/30">
                            {visits.map((visit) => (
                                <li key={visit.id}>
                                    <Link
                                        to={`/visit/${visit.id}`}
                                        className="flex items-center justify-between p-4 sm:p-5 hover:bg-dark-input/50 transition duration-150 group"
                                    >
                                        <div className="flex-grow mr-4">
                                            <p className="font-medium text-sm sm:text-base text-primary-accent flex items-center mb-1">
                                                <FaCalendarAlt className="mr-2 h-3.5 w-3.5 text-primary-accent/80 flex-shrink-0" />
                                                Visit on {format(new Date(visit.visit_date), 'PPP')}
                                            </p>
                                            <p className="text-xs text-off-white/70 flex items-center mb-1">
                                                <FaUserMd className="mr-2 h-3.5 w-3.5 text-off-white/50 flex-shrink-0" />
                                                Clinician: {visit.clinicians?.username || 'Unknown'}
                                            </p>
                                            <p className="text-xs text-off-white/70 flex items-start">
                                                <FaRegCommentDots className="mr-2 mt-0.5 h-3 w-3 text-off-white/50 flex-shrink-0" />
                                                <span>Reason: {visit.reason ? (visit.reason.length > 60 ? visit.reason.substring(0, 60) + '...' : visit.reason) : <span className="italic text-off-white/60">N/A</span>}</span>
                                            </p>
                                        </div>
                                        <FaAngleRight className="h-5 w-5 text-off-white/40 group-hover:text-primary-accent group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-off-white/60 text-center py-10 italic">No visit history found.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default PatientVisitsPage; 