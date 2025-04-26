import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Patient, Visit } from '../types/app'; // Assuming Visit type exists
import { useAuth } from '../context/AuthContext'; // Need clinician ID
import { FaSearch, FaTimes, FaUserCircle } from 'react-icons/fa'; // Icons

type PatientSearchResult = Pick<Patient, 'id' | 'username' | 'profile_picture_url'>;

const AddNewVisitPage: React.FC = () => {
    const navigate = useNavigate();
    const { profile: authProfile, loading: authLoading } = useAuth();
    const clinicianId = authProfile?.role === 'clinician' ? authProfile.profileId : null;

    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<PatientSearchResult | null>(null);
    const [visitReason, setVisitReason] = useState('');
    const [visitNotes, setVisitNotes] = useState('');

    const [loadingSearch, setLoadingSearch] = useState(false);
    const [loadingSubmit, setLoadingSubmit] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Debounced search effect
    useEffect(() => {
        // Clear results if search term is empty or a patient is selected
        if (!searchTerm.trim() || selectedPatient) {
            setSearchResults([]);
            setLoadingSearch(false);
            return;
        }

        // Debounce mechanism
        setLoadingSearch(true);
        setError(null); // Clear previous errors on new search
        const timerId = setTimeout(async () => {
            try {
                console.log(`Searching for patients like: ${searchTerm}`);
                const { data, error: searchError } = await supabase
                    .from('patients')
                    .select('id, username, profile_picture_url')
                    .ilike('username', `%${searchTerm}%`) // Case-insensitive search
                    .limit(10); // Limit results

                if (searchError) throw searchError;

                console.log("Search results:", data);
                setSearchResults(data || []);
            } catch (err: any) {
                console.error("Error searching patients:", err);
                setError(`Failed to search patients: ${err.message}`);
                setSearchResults([]); // Clear results on error
            } finally {
                setLoadingSearch(false);
            }
        }, 500); // 500ms debounce

        // Cleanup function
        return () => clearTimeout(timerId);
    }, [searchTerm, selectedPatient]); // Re-run when searchTerm changes or patient selected

    const handleSelectPatient = (patient: PatientSearchResult) => {
        setSelectedPatient(patient);
        setSearchTerm(''); // Clear search term after selection
        setSearchResults([]); // Clear search results
        setError(null); // Clear any search errors
    };

    const handleClearSelection = () => {
        setSelectedPatient(null);
        setError(null);
        setSuccessMessage(null);
        setVisitReason('');
        setVisitNotes('');
    };

    const handleCreateVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient || !clinicianId || !visitReason.trim()) {
            setError("Please select a patient and enter a visit reason.");
            return;
        }

        setLoadingSubmit(true);
        setError(null);
        setSuccessMessage(null);

        try {
            console.log(`Creating visit for patient ${selectedPatient.id} by clinician ${clinicianId}`);
            const { data: newVisit, error: insertError } = await supabase
                .from('visits')
                .insert({
                    patient_id: selectedPatient.id,
                    clinician_id: clinicianId,
                    visit_date: new Date().toISOString(),
                    reason: visitReason.trim(),
                    notes: visitNotes.trim() || null, // Store null if notes are empty/whitespace
                })
                .select() // Optionally select the newly created visit
                .single(); // Expect a single record back

            if (insertError) throw insertError;

            console.log("Visit created successfully:", newVisit);
            // --- Simulate Prescription Creation (Backend would handle this) ---
            console.log("Simulating prescription creation for visit:", newVisit.id);
            // In a real scenario, you might call another RPC or handle this based on backend logic triggered by the visit insert.
            // Example: await supabase.rpc('create_prescription_for_visit', { p_visit_id: newVisit.id, p_medication: 'SimulatedMed' });

            setSuccessMessage(`Visit for ${selectedPatient.username || 'Patient'} created successfully!`);
            // Reset form partially or fully
            // setVisitReason('');
            // setVisitNotes('');
            // setSelectedPatient(null); // Or keep patient selected for potential follow-up action?

            // Navigate back to dashboard after a short delay
            setTimeout(() => {
                navigate('/clinician/dashboard');
            }, 2000); // 2 second delay before redirect

        } catch (err: any) {
            console.error("Error creating visit:", err);
            setError(`Failed to create visit: ${err.message}`);
        } finally {
            setLoadingSubmit(false);
        }
    };

    // Check if clinician profile is still loading or missing
    if (authLoading) {
        return <div className="container mx-auto px-4 py-8 text-center text-white">Loading clinician data...</div>;
    }
    if (!clinicianId) {
        return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: Clinician profile not found or user is not a clinician. Cannot add visit.</div>;
    }


    return (
        <div className="container mx-auto px-6 lg:px-8 py-12 text-off-white font-sans max-w-4xl">
            <div className="flex justify-between items-center mb-10">
                <button
                    onClick={() => navigate(-1)} // Go back to the previous page
                    className="px-4 py-2 text-sm border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition duration-200"
                >
                    &larr; Go Back
                </button>
                <h1 className="text-3xl md:text-4xl font-bold text-white text-center flex-grow">Add New Visit</h1>
                <div className="w-[calc(theme(spacing.4)*2+theme(fontSize.sm)*4)]"></div> {/* Spacer */}
            </div>

            {/* Stage 1: Patient Search */}
            {!selectedPatient && (
                <div className="bg-dark-card p-8 rounded-xl shadow-lg border border-border-color mb-8 animate-fade-in">
                    <h2 className="text-2xl font-semibold text-white mb-6">1. Find Patient</h2>
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by patient username..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-3 pl-10 rounded-md bg-dark-input border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150"
                            disabled={loadingSearch}
                        />
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-off-white/40" />
                    </div>

                    {/* Search Results */}
                    {loadingSearch && <p className="text-center mt-4 text-off-white/70">Searching...</p>}
                    {error && !loadingSearch && <p className="text-red-400 text-center mt-4">{error}</p>}

                    {searchResults.length > 0 && !loadingSearch && (
                        <ul className="mt-4 space-y-2 max-h-60 overflow-y-auto border border-border-color rounded-md p-2 bg-dark-input/50">
                            {searchResults.map(patient => (
                                <li
                                    key={patient.id}
                                    onClick={() => handleSelectPatient(patient)}
                                    className="flex items-center space-x-3 p-3 rounded-md hover:bg-electric-blue/20 cursor-pointer transition duration-150 group"
                                >
                                    {patient.profile_picture_url ? (
                                        <img src={patient.profile_picture_url} alt="Profile" className="h-8 w-8 rounded-full object-cover flex-shrink-0 border border-transparent group-hover:border-electric-blue" />
                                    ) : (
                                        <FaUserCircle className="h-8 w-8 text-off-white/40 flex-shrink-0 group-hover:text-electric-blue" />
                                    )}
                                    <span className="text-off-white/90 group-hover:text-white font-medium">{patient.username || `ID: ${patient.id.substring(0, 8)}...`}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    {!loadingSearch && searchTerm.trim() && searchResults.length === 0 && (
                        <p className="text-center mt-4 text-off-white/60 italic">No patients found matching "{searchTerm}".</p>
                    )}
                </div>
            )}

            {/* Stage 2: Visit Details */}
            {selectedPatient && (
                <div className="bg-dark-card p-8 rounded-xl shadow-lg border border-border-color animate-fade-in">
                    <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-color">
                        <h2 className="text-2xl font-semibold text-white">2. Enter Visit Details</h2>
                        <button
                            onClick={handleClearSelection}
                            className="text-xs text-off-white/60 hover:text-red-400 flex items-center space-x-1 transition duration-150"
                            title="Change Patient"
                        >
                            <FaTimes />
                            <span>Change Patient</span>
                        </button>
                    </div>

                    {/* Selected Patient Info */}
                    <div className="flex items-center space-x-4 mb-8 p-4 bg-dark-input rounded-lg border border-border-color/50">
                        {selectedPatient.profile_picture_url ? (
                            <img src={selectedPatient.profile_picture_url} alt="Profile" className="h-12 w-12 rounded-full object-cover border-2 border-pastel-lavender" />
                        ) : (
                            <FaUserCircle className="h-12 w-12 text-off-white/40" />
                        )}
                        <div>
                            <p className="text-lg font-semibold text-white">{selectedPatient.username || 'Patient'}</p>
                            <p className="text-sm text-off-white/60">ID: {selectedPatient.id}</p>
                        </div>
                    </div>

                    {/* Visit Form */}
                    <form onSubmit={handleCreateVisit} className="space-y-6">
                        <div>
                            <label htmlFor="visitReason" className="block text-sm font-medium text-off-white/80 mb-1">
                                Reason for Visit <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="visitReason"
                                type="text"
                                required
                                value={visitReason}
                                onChange={(e) => setVisitReason(e.target.value)}
                                className="w-full px-4 py-2 rounded-md bg-dark-input border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150"
                                placeholder="e.g., Follow-up, Checkup, Consultation"
                                disabled={loadingSubmit}
                            />
                        </div>

                        <div>
                            <label htmlFor="visitNotes" className="block text-sm font-medium text-off-white/80 mb-1">
                                Visit Notes
                            </label>
                            <textarea
                                id="visitNotes"
                                rows={6}
                                value={visitNotes}
                                onChange={(e) => setVisitNotes(e.target.value)}
                                className="w-full px-4 py-2 rounded-md bg-dark-input border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150"
                                placeholder="Enter observations, diagnosis, treatment plan, etc."
                                disabled={loadingSubmit}
                            />
                        </div>

                        {/* Error/Success Messages */}
                        {error && <p className="text-red-400 text-center text-sm">{error}</p>}
                        {successMessage && <p className="text-green-400 text-center text-sm">{successMessage}</p>}

                        <div>
                            <button
                                type="submit"
                                disabled={loadingSubmit || !!successMessage} // Disable after success until redirect
                                className="w-full flex justify-center py-3 px-4 border border-electric-blue rounded-md shadow-sm text-sm font-medium text-electric-blue bg-transparent hover:bg-electric-blue hover:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-electric-blue disabled:opacity-50 disabled:cursor-not-allowed transition duration-150"
                            >
                                {loadingSubmit ? (
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : 'Save Visit'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AddNewVisitPage; 