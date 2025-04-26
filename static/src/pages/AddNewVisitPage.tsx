import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Patient } from '../types/app'; // Patient type should include medical/insurance details
import { useAuth } from '../context/AuthContext'; // Need clinician ID
import { FaSearch, FaTimes, FaUserCircle, FaSpinner, FaArrowLeft, FaUserPlus, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'; // Removed FaNotesMedical

// Define a type for the full patient data needed for prescription generation
type FullPatientData = Patient; // Use the existing Patient type which should include history/insurance

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
    const [loadingSubmit, setLoadingSubmit] = useState(false); // For saving visit
    const [loadingPrescription, setLoadingPrescription] = useState(false); // For generating prescription
    const [searchError, setSearchError] = useState<string | null>(null); // Specific search error
    const [submitError, setSubmitError] = useState<string | null>(null); // Specific submit/visit error
    const [errorPrescription, setErrorPrescription] = useState<string | null>(null); // Prescription specific error
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Ref for focusing search input on load
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Debounced search effect
    useEffect(() => {
        // Clear results if search term is empty or a patient is selected
        if (!searchTerm.trim() || selectedPatient) {
            setSearchResults([]);
            setSearchError(null); // Clear search error too
            setLoadingSearch(false);
            return;
        }

        // Debounce mechanism
        setLoadingSearch(true);
        setSearchError(null); // Clear previous search errors
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
                setSearchError(`Failed to search patients: ${err.message}`);
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
        setSearchError(null); // Clear any search errors
        setErrorPrescription(null); // Clear prescription errors too
        setSubmitError(null); // Clear submit errors
        setSuccessMessage(null); // Clear success messages
        setVisitReason('');
        setVisitNotes('');
    };

    const handleClearSelection = () => {
        setSelectedPatient(null);
        setSearchError(null);
        setSubmitError(null);
        setErrorPrescription(null);
        setSuccessMessage(null);
        setVisitReason('');
        setVisitNotes('');
        // Optionally focus search input again
        searchInputRef.current?.focus();
    };

    const handleCreateVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient || !clinicianId || !visitReason.trim()) {
            setSubmitError("Please select a patient and enter a visit reason.");
            return;
        }

        setLoadingSubmit(true);
        setLoadingPrescription(false); // Ensure prescription loading is false initially
        setSubmitError(null);
        setErrorPrescription(null);
        setSuccessMessage(null);

        let visitCreated = false;
        let patientData: FullPatientData | null = null;
        let newVisitId: string | null = null; // Store the visit ID

        try {
            // --- 1. Create the Visit Record ---
            console.log(`Creating visit for patient ${selectedPatient.id} by clinician ${clinicianId}`);
            const { data: newVisit, error: insertError } = await supabase
                .from('visits')
                .insert({
                    patient_id: selectedPatient.id,
                    clinician_id: clinicianId,
                    visit_date: new Date().toISOString(),
                    reason: visitReason.trim(),
                    notes: visitNotes.trim() || null,
                })
                .select('id') // Select the ID of the newly created visit
                .single();

            if (insertError) throw new Error(`Visit Creation Error: ${insertError.message}`);
            if (!newVisit?.id) throw new Error("Visit created but failed to get visit ID.");

            newVisitId = newVisit.id; // Store the ID
            console.log("Visit created successfully, ID:", newVisitId);
            visitCreated = true;
            // Update success message immediately, will be updated again after prescription attempt
            setSuccessMessage(`Visit for ${selectedPatient.username || 'Patient'} created. Attempting prescription generation...`);

            // --- 2. Fetch Full Patient Data ---
            console.log(`Fetching full data for patient ID: ${selectedPatient.id}`);
            const { data: fetchedPatient, error: fetchPatientError } = await supabase
                .from('patients')
                .select('*') // Select all columns
                .eq('id', selectedPatient.id)
                .single();

            if (fetchPatientError) throw new Error(`Failed to fetch patient details: ${fetchPatientError.message}`);
            if (!fetchedPatient) throw new Error("Patient details not found after visit creation.");
            patientData = fetchedPatient as FullPatientData;
            console.log("Full patient data fetched:", patientData);

            // --- 3. Call Gemini API Client-Side ---
            setLoadingPrescription(true);
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error("Gemini API Key not configured in frontend environment variables (VITE_GEMINI_API_KEY).");
            }

            // Use the latest recommended model - gemini-1.5-flash-latest
            const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

            // Construct a more direct, formatting-focused prompt for the demo
            const prompt = `
For demonstration purposes, format the following clinical notes into a standard prescription structure.
Assume a hypothetical prescription based SOLELY on the notes provided below.
Output ONLY the prescription details in the format:
Medication: [Example Medication]
Dosage: [Example Dosage]
Frequency: [Example Frequency]
Notes: [Notes based on input, or leave blank]

Input Data:
- Visit Reason: ${visitReason.trim()}
- Clinician Notes: ${visitNotes.trim()}
- Patient History Snippet: ${JSON.stringify(patientData.medical_history || '{}').substring(0, 100)}...

Generate formatted prescription structure:
Your prescription just needs to be a suggestion that a doctor would later review and confirm.
`;

            console.log("Calling Gemini API with updated prompt...");
            const geminiResponse = await fetch(geminiApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    // Optional: Add safety settings if needed
                    // safetySettings: [ ... ], 
                    // generationConfig: { ... } 
                }),
            });

            if (!geminiResponse.ok) {
                const errorData = await geminiResponse.json().catch(() => ({ message: 'Unknown error structure from Gemini' }));
                console.error("Gemini API Error Response:", errorData);
                throw new Error(`Gemini API call failed: ${geminiResponse.status} ${geminiResponse.statusText} - ${errorData?.error?.message || 'No details'}`);
            }

            const geminiResult = await geminiResponse.json();
            console.log("Gemini API Raw Response:", JSON.stringify(geminiResult));

            // --- 4. Parse Gemini Response & Insert Prescription ---
            const generatedText = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!generatedText) {
                throw new Error("Gemini response did not contain generated text.");
            }
            console.log("Gemini Generated Text:", generatedText);

            // Basic parsing (adjust regex/logic as needed based on Gemini output format)
            const medicationMatch = generatedText.match(/Medication:\s*(.*)/i);
            const dosageMatch = generatedText.match(/Dosage:\s*(.*)/i);
            const frequencyMatch = generatedText.match(/Frequency:\s*(.*)/i);
            const notesMatch = generatedText.match(/Notes:\s*(.*)/i);

            const medication = medicationMatch?.[1]?.trim() || null;
            const dosage = dosageMatch?.[1]?.trim() || null;
            const frequency = frequencyMatch?.[1]?.trim() || null;
            const prescriptionNotes = notesMatch?.[1]?.trim() || null;

            if (!medication) {
                // If no medication was parsed, maybe Gemini didn't think one was needed.
                console.log("No medication found in Gemini response. Skipping prescription insert.");
                setSuccessMessage(`Visit created for ${selectedPatient.username || 'Patient'}. No prescription generated.`);
            } else {
                console.log("Parsed Prescription:", { medication, dosage, frequency, prescriptionNotes });
                // Insert into Supabase prescriptions table
                const { error: rxInsertError } = await supabase
                    .from('prescriptions')
                    .insert({
                        patient_id: selectedPatient.id,
                        clinician_id: clinicianId,
                        visit_id: newVisitId, // Link prescription to the visit
                        medication: medication,
                        dosage: dosage,
                        frequency: frequency,
                        notes: prescriptionNotes,
                        // generated_by_ai: true // Optional flag
                    });

                if (rxInsertError) {
                    throw new Error(`Failed to save generated prescription: ${rxInsertError.message}`);
                }
                console.log("Prescription saved successfully to Supabase.");
                setSuccessMessage(`Visit created and prescription generated & saved successfully for ${selectedPatient.username || 'Patient'}!`);
            }

            // --- 5. Redirect ---
            setTimeout(() => {
                navigate('/clinician/dashboard');
            }, 2500); // Slightly longer delay to read success message

        } catch (err: any) {
            console.error("Error during visit creation or prescription generation/saving:", err);
            if (visitCreated && !loadingPrescription) {
                // Error happened while fetching patient data or before Gemini call
                setSubmitError(`Visit created, but failed before prescription generation: ${err.message}`);
                // Optionally clear the partial success message
                setSuccessMessage(null);
            } else if (visitCreated && loadingPrescription) {
                // Error happened during Gemini call or Supabase prescription insert
                setErrorPrescription(`Visit created, but prescription generation/saving failed: ${err.message}`);
                // Keep partial success message, indicating visit was made
                setSuccessMessage(`Visit for ${selectedPatient.username || 'Patient'} created, but automatic prescription failed.`);
            } else {
                // Error happened during visit creation itself
                setSubmitError(`Failed to create visit: ${err.message}`);
            }
        } finally {
            setLoadingSubmit(false);
            setLoadingPrescription(false);
        }
    };

    // Check if clinician profile is still loading or missing
    if (authLoading) {
        return <div className="container mx-auto px-4 py-16 text-center text-white"><FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-pastel-blue" /> Loading clinician data...</div>;
    }
    if (!clinicianId) {
        return (
            <div className="container mx-auto px-4 py-16 text-center">
                <div className="bg-red-900/60 border border-red-700 text-red-200 px-6 py-4 rounded-lg inline-flex items-center">
                    <FaExclamationTriangle className="mr-3 h-5 w-5" />
                    <span>Error: Clinician profile not found or user is not a clinician. Cannot add visit.</span>
                </div>
            </div>
        );
    }


    return (
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans max-w-3xl">
            {/* Header */}
            <div className="flex justify-between items-center mb-10">
                <button
                    onClick={() => navigate(-1)} // Go back to the previous page
                    className="flex items-center px-4 py-2 border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition duration-200 text-sm font-medium group"
                >
                    <FaArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" /> Go Back
                </button>
                <h1 className="text-3xl md:text-4xl font-bold text-white text-center flex-grow">Add New Visit</h1>
                {/* Spacer to balance back button */}
                <div className="w-24"></div>
            </div>

            {/* Stage 1: Patient Search */}
            {!selectedPatient && (
                <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color mb-8 animate-fade-in transition-shadow hover:shadow-blue-glow-sm">
                    <h2 className="text-xl sm:text-2xl font-semibold text-white mb-6 flex items-center">
                        <FaSearch className="mr-3 text-pastel-blue" /> 1. Find Patient
                    </h2>
                    <div className="relative">
                        <input
                            ref={searchInputRef} // Assign ref
                            type="text"
                            placeholder="Search by patient username..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-4 py-2.5 pl-10 rounded-md bg-dark-input border border-border-color text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150"
                            disabled={loadingSearch}
                        />
                        <FaSearch className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-off-white/40 pointer-events-none" />
                    </div>

                    {/* Search Results */}
                    <div className="mt-4 min-h-[80px]"> {/* Min height to prevent layout shift */}
                        {loadingSearch && (
                            <div className="flex justify-center items-center text-off-white/70 py-4">
                                <FaSpinner className="animate-spin mr-2" /> Searching...
                            </div>
                        )}
                        {searchError && !loadingSearch && (
                            <p className="text-red-400 text-center py-4 px-2 text-sm">{searchError}</p>
                        )}

                        {searchResults.length > 0 && !loadingSearch && (
                            <ul className="space-y-2 max-h-60 overflow-y-auto border border-border-color rounded-md p-2 bg-dark-input/50 custom-scrollbar">
                                {searchResults.map(patient => (
                                    <li
                                        key={patient.id}
                                        onClick={() => handleSelectPatient(patient)}
                                        className="flex items-center space-x-3 p-3 rounded-md hover:bg-electric-blue/20 cursor-pointer transition duration-150 group"
                                    >
                                        {patient.profile_picture_url ? (
                                            <img src={patient.profile_picture_url} alt="Profile" className="h-8 w-8 rounded-full object-cover flex-shrink-0 border border-border-color group-hover:border-electric-blue" />
                                        ) : (
                                            <FaUserCircle className="h-8 w-8 text-off-white/40 flex-shrink-0 group-hover:text-electric-blue" />
                                        )}
                                        <span className="text-off-white/90 group-hover:text-white font-medium">{patient.username || `ID: ${patient.id.substring(0, 8)}...`}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {!loadingSearch && searchTerm.trim() && searchResults.length === 0 && !searchError && (
                            <p className="text-center py-4 text-off-white/60 italic">No patients found matching "{searchTerm}".</p>
                        )}
                    </div>
                </div>
            )}

            {/* Stage 2: Visit Details */}
            {selectedPatient && (
                <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in transition-shadow hover:shadow-pastel-glow-sm">
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 pb-4 border-b border-border-color gap-2">
                        <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center">
                            <FaUserPlus className="mr-3 text-pastel-lavender" /> 2. Enter Visit Details For:
                        </h2>
                        {/* Selected Patient Info Inline */}
                        <div className="flex items-center space-x-3 p-2 bg-dark-input rounded-lg border border-border-color/50 flex-shrink-0">
                            {selectedPatient.profile_picture_url ? (
                                <img src={selectedPatient.profile_picture_url} alt="Profile" className="h-8 w-8 rounded-full object-cover border border-pastel-lavender" />
                            ) : (
                                <FaUserCircle className="h-8 w-8 text-off-white/40" />
                            )}
                            <p className="text-base font-semibold text-white">{selectedPatient.username || 'Selected Patient'}</p>
                            <button
                                onClick={handleClearSelection}
                                className="ml-2 text-xs text-off-white/60 hover:text-red-400 flex items-center space-x-1 transition duration-150 p-1 hover:bg-red-900/20 rounded-full"
                                title="Change Patient"
                            >
                                <FaTimes />
                            </button>
                        </div>
                    </div>

                    {/* Visit Form */}
                    <form onSubmit={handleCreateVisit} className="space-y-6">
                        {/* Reason Input */}
                        <div>
                            <label htmlFor="visitReason" className="block text-sm font-medium text-off-white/80 mb-1">
                                Reason for Visit <span className="text-red-400">*</span>
                            </label>
                            <input
                                id="visitReason"
                                type="text"
                                required
                                value={visitReason}
                                onChange={(e) => setVisitReason(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-md bg-dark-input border border-border-color text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150"
                                placeholder="e.g., Follow-up, Checkup, Consultation"
                                disabled={loadingSubmit || loadingPrescription} // Disable if submitting visit or generating Rx
                            />
                        </div>

                        {/* Notes Input */}
                        <div>
                            <label htmlFor="visitNotes" className="block text-sm font-medium text-off-white/80 mb-1">
                                Visit Notes (Diagnosis, Treatment Plan)
                            </label>
                            <textarea
                                id="visitNotes"
                                rows={6}
                                value={visitNotes}
                                onChange={(e) => setVisitNotes(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-md bg-dark-input border border-border-color text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150 font-mono text-sm"
                                placeholder="Enter observations, diagnosis, treatment plan for LLM..."
                                disabled={loadingSubmit || loadingPrescription} // Disable if submitting visit or generating Rx
                            />
                        </div>

                        {/* Error/Success Messages */}
                        <div className="min-h-[40px] space-y-2"> {/* Container for messages */}
                            {submitError && (
                                <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 rounded-md text-center text-sm flex items-center justify-center gap-2">
                                    <FaExclamationTriangle className="h-4 w-4" /> {submitError}
                                </div>
                            )}
                            {errorPrescription && (
                                <div className="bg-orange-900/60 border border-orange-700 text-orange-200 px-4 py-2 rounded-md text-center text-sm flex items-center justify-center gap-2">
                                    <FaExclamationTriangle className="h-4 w-4" /> {errorPrescription}
                                </div>
                            )}
                            {successMessage && !errorPrescription && (
                                <div className="bg-green-900/60 border border-green-700 text-green-200 px-4 py-2 rounded-md text-center text-sm flex items-center justify-center gap-2">
                                    <FaCheckCircle className="h-4 w-4" /> {successMessage}
                                </div>
                            )}
                        </div>

                        {/* Show specific loading message for prescription generation */}
                        {loadingPrescription && (
                            <div className="flex items-center justify-center text-sm text-pastel-blue py-2 animate-pulse">
                                <FaSpinner className="animate-spin h-5 w-5 text-electric-blue" />
                                <span>Generating prescription...</span>
                            </div>
                        )}

                        {/* Submit Button */}
                        <div>
                            <button
                                type="submit"
                                disabled={loadingSubmit || loadingPrescription || (!!successMessage && !errorPrescription && !submitError)} // Disable if loading or full success without errors
                                className="w-full group flex justify-center items-center py-3 px-4 border border-electric-blue rounded-md shadow-sm text-sm font-medium text-electric-blue bg-transparent hover:bg-electric-blue hover:text-dark-bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-electric-blue disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 ease-in-out active:scale-95"
                            >
                                {loadingSubmit ? (
                                    <svg className="animate-spin h-5 w-5 text-electric-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : loadingPrescription ? (
                                    <FaSpinner className="animate-spin h-5 w-5 text-electric-blue" />
                                ) : (
                                    <span className="group-hover:scale-105 transition-transform duration-200 ease-in-out">Save Visit & Generate Prescription</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}
            {/* Custom Scrollbar CSS */}
            <style>{`
             .custom-scrollbar::-webkit-scrollbar {
                 width: 6px;
             }
             .custom-scrollbar::-webkit-scrollbar-track {
                 background: transparent;
             }
             .custom-scrollbar::-webkit-scrollbar-thumb {
                 background-color: rgba(187, 222, 251, 0.3); /* pastel-blue with transparency */
                 border-radius: 3px;
             }
             .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                 background-color: rgba(187, 222, 251, 0.5);
             }
           `}</style>
        </div>
    );
};

export default AddNewVisitPage; 