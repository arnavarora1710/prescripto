import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Visit } from '../types/app';
import { useAuth } from '../context/AuthContext';
import { FaSpinner, FaArrowLeft } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

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
              clinicians: clinician_id ( username )
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
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold text-white">My Visit History</h1>
                <button
                    onClick={() => navigate('/patient/profile')}
                    className="flex items-center px-4 py-2 border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition text-sm font-medium">
                    <FaArrowLeft className="mr-2 h-4 w-4" /> Back to Profile
                </button>
            </div>

            {loading && (
                <div className="text-center py-10">
                    <FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-pastel-blue" /> Loading visit history...
                </div>
            )}

            {error && (
                <div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-center mb-6">
                    Error: {error}
                </div>
            )}

            {!loading && !error && (
                <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in">
                    {visits.length > 0 ? (
                        <ul className="space-y-6">
                            {visits.map((visit) => (
                                <li key={visit.id} className="border-b border-border-color/40 pb-5 last:border-b-0">
                                    <p className="font-semibold text-base sm:text-lg text-pastel-blue mb-1">Visit on {new Date(visit.visit_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                                    <p className="text-sm text-off-white/70 mb-2">Clinician: {visit.clinicians?.username || 'Unknown'}</p>
                                    <p className="text-sm text-off-white/80 mb-2"><span className="font-medium text-off-white/90">Reason:</span> {visit.reason || 'N/A'}</p>
                                    {visit.notes && (
                                        <div className="mt-3 pt-3 border-t border-border-color/30">
                                            <p className="text-xs font-medium text-pastel-lavender mb-1">Notes:</p>
                                            <p className="text-sm text-off-white/80 italic whitespace-pre-wrap bg-dark-input/50 p-3 rounded-md border border-border-color/30">{visit.notes}</p>
                                        </div>
                                    )}
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