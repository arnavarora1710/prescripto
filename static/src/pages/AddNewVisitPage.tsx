import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Patient } from '../types/app'; // Patient type should include medical/insurance details
import { useAuth } from '../context/AuthContext'; // Need clinician ID
import { FaSearch, FaTimes, FaUserCircle, FaSpinner, FaArrowLeft, FaUserPlus, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa'; // Removed FaNotesMedical
import { v4 as uuidv4 } from 'uuid'; // Import uuid

// Define the delimiter used for parsing LLM recommendations
const RECOMMENDATION_DELIMITER = "---RECOMMENDATION---";

// Define a type for the full patient data needed for prescription generation
type FullPatientData = Patient; // Use the existing Patient type which should include history/insurance

type PatientSearchResult = Pick<Patient, 'id' | 'username' | 'profile_picture_url'>;

// --- DTO Types matching backend (for validation request/response) ---
interface ProposedPrescriptionDto {
    medicationName: string;
    dosage: string | null;
    frequency: string | null;
}

interface CurrentPrescriptionDto {
    medicationName: string;
}

interface PrescriptionValidationRequest {
    patientId: string;
    proposedPrescriptions: ProposedPrescriptionDto[];
    patientAllergies: string[];
    currentPrescriptions: CurrentPrescriptionDto[];
}

interface ValidationIssueDto {
    type: string;
    medication: string;
    details: string;
}

interface ValidationResponse {
    validationIssues: ValidationIssueDto[];
}
// --- End DTO Types ---

// --- Recommendation State Structure ---
interface Recommendation {
    id: string; // Unique key for React lists
    medicationName: string;
    dosage: string;
    frequency: string;
    llmNotes: string; // Notes from the LLM suggestion
    status: 'pending' | 'approved' | 'rejected';
    clinicianComment: string;
    validationIssue?: string; // To display backend warnings
}
// --- End Recommendation State Structure ---

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
    const [visitId, setVisitId] = useState<string | null>(null); // Declare visitId state HERE

    // Ref for focusing search input on load
    const searchInputRef = useRef<HTMLInputElement>(null);

    // --- New State for Recommendation Workflow ---
    const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
    const [isValidated, setIsValidated] = useState(false);
    const [canFinalize, setCanFinalize] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false); // Loading state for finalize
    const [finalizeError, setFinalizeError] = useState<string | null>(null); // Error during finalization
    // Store fetched patient data needed for validation/finalization
    const [fullPatientDataForVisit, setFullPatientDataForVisit] = useState<FullPatientData | null>(null);
    const [currentPrescriptionsList, setCurrentPrescriptionsList] = useState<CurrentPrescriptionDto[]>([]);
    const [patientAllergiesList, setPatientAllergiesList] = useState<string[]>([]);
    const [canRegenerate, setCanRegenerate] = useState(false); // State to control regeneration button visibility
    const [loadingRegenerate, setLoadingRegenerate] = useState(false); // State for regeneration loading indicator
    // --- End New State ---

    // const [searchParams] = useSearchParams();
    // const patientId = searchParams.get("patientId");

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
        setRecommendations([]); // Clear previous recommendations
        setIsValidated(false);
        setCanFinalize(false);
        setVisitId(null);
        setFullPatientDataForVisit(null);
        setCurrentPrescriptionsList([]);
        setPatientAllergiesList([]);
        fetchPatientContextData(patient.id); // Fetch data needed for validation
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

    // --- Function to Parse LLM Output ---
    const parseLlmRecommendations = (generatedText: string | undefined): Recommendation[] => {
        if (!generatedText) return [];
        console.log("Parsing LLM Text:", generatedText);

        const recommendations: Recommendation[] = [];
        const chunks = generatedText.split(RECOMMENDATION_DELIMITER);

        for (const chunk of chunks) {
            const trimmedChunk = chunk.trim();
            if (!trimmedChunk) continue; // Skip empty chunks

            // More flexible regex to match labels (case-insensitive, optional words)
            const medicationMatch = trimmedChunk.match(/Medication(?: Name)?:\s*(.*)/i);
            const dosageMatch = trimmedChunk.match(/Dosage:\s*(.*)/i);
            const frequencyMatch = trimmedChunk.match(/Frequency:\s*(.*)/i);
            const notesMatch = trimmedChunk.match(/(?:LLM )?Notes:\s*(.*)/is); // Allow "LLM Notes:" or "Notes:"

            const medication = medicationMatch?.[1]?.trim();

            // Only add if a medication name was found in the chunk
            if (medication) {
                recommendations.push({
                    id: `rec-${uuidv4()}`, // Use uuid for a more robust unique id
                    medicationName: medication,
                    dosage: dosageMatch?.[1]?.trim() || 'N/A',
                    frequency: frequencyMatch?.[1]?.trim() || 'N/A',
                    llmNotes: notesMatch?.[1]?.trim() || 'N/A',
                    status: 'pending',
                    clinicianComment: '',
                    validationIssue: undefined
                });
            }
        }

        console.log("Parsed Recommendations:", recommendations);
        return recommendations;
    };
    // --- End Parsing Function ---

    const handleCreateVisit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPatient || !clinicianId || !visitReason.trim() || !visitNotes.trim()) {
            setSubmitError("Please select a patient and enter visit reason and notes.");
            return;
        }

        // Reset states
        setLoadingSubmit(true);
        setLoadingPrescription(true);
        setSubmitError(null);
        setErrorPrescription(null);
        setSuccessMessage(null);
        setRecommendations([]);
        setVisitId(null);
        setIsValidated(false);
        setCanFinalize(false);
        setFinalizeError(null);
        let createdVisitId: string | null = null; // Local variable for this execution

        try {
            // --- 1. Create Visit Record ---
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
                .select('id')
                .single();
            if (insertError) throw new Error(`Visit Creation Error: ${insertError.message}`);
            if (!newVisit?.id) throw new Error("Visit created but failed to get visit ID.");
            createdVisitId = newVisit.id;
            setVisitId(createdVisitId); // Update state
            console.log("Visit created successfully, ID:", createdVisitId);
            setSuccessMessage(`Visit created. Generating recommendations...`);

            // --- 2. Fetch Full Patient Data (if needed) ---
            let patientData = fullPatientDataForVisit;
            if (!patientData) {
                 await fetchPatientContextData(selectedPatient.id);
                 // Re-fetch from state after update
                 patientData = fullPatientDataForVisit; 
                 // Check again after attempting fetch
                 if (!patientData) throw new Error("Failed to load patient data before LLM call.");
            }
           
            // --- 3. Call Gemini API Client-Side ---
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            if (!apiKey) throw new Error("Gemini API Key not configured.");
            const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
            const prompt = `
Clinician requesting prescription recommendations for patient: ${selectedPatient.username} (ID: ${selectedPatient.id}).
Visit Reason: ${visitReason}
Clinician Notes: ${visitNotes}

Patient Context:
Allergies: ${patientAllergiesList.join(', ')}
Current Medications: ${currentPrescriptionsList.map(p => p.medicationName).join(', ')}
Relevant Medical History: ${JSON.stringify(patientData.medical_history || '{}').substring(0, 100)}...

Suggest up to 3 distinct prescription options appropriate for the visit reason and clinician notes, considering the patient context. For each option, provide:
1. Medication Name
2. Dosage (e.g., "10mg", "500mg") or "N/A"
3. Frequency (e.g., "once daily", "twice daily", "as needed") or "N/A"
4. Brief Notes/Rationale (max 20 words, explaining why this drug might be suitable).

Format each recommendation clearly, separated by "${RECOMMENDATION_DELIMITER}".
Example format:
Medication Name: [Name]
Dosage: [Dosage]
Frequency: [Frequency]
LLM Notes: [Rationale]
${RECOMMENDATION_DELIMITER}
Medication Name: [Name 2]
Dosage: [Dosage 2]
Frequency: [Frequency 2]
LLM Notes: [Rationale 2]
${RECOMMENDATION_DELIMITER}
... (up to 3 total)
`;

            // Debugging: Log data sent to Gemini
            console.log("--- Data for Gemini Prompt ---");
            console.log("Visit Reason:", visitReason);
            console.log("Visit Notes:", visitNotes);
            console.log("Allergies:", patientAllergiesList);
            console.log("Current Meds:", currentPrescriptionsList);
            console.log("History (raw):", patientData?.medical_history);
            console.log("Prompt sent to Gemini:", prompt);
            console.log("--- End Data --- ");

            console.log("Calling Gemini API...");
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
                 const errorData = await geminiResponse.json().catch(() => ({ message: 'Unknown error structure' }));
                 throw new Error(`Gemini API call failed: ${geminiResponse.status} - ${errorData?.error?.message || 'Details unavailable'}`);
            }
            const geminiResult = await geminiResponse.json();
            const generatedText = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!generatedText) throw new Error("Gemini response did not contain text.");
            console.log("Gemini Generated Text:", generatedText);

            // --- 4. Parse LLM Response and Set State for Review --- 
            const parsedRecs = parseLlmRecommendations(generatedText);
            setRecommendations(parsedRecs);
            
            if (parsedRecs.length > 0) {
                setSuccessMessage("Recommendations generated. Please review and validate below.");
            } else {
                setSuccessMessage("Visit created. No recommendations generated by AI.");
                setIsValidated(true); 
                setCanFinalize(true);
            }

            // --- STOP before inserting prescription to DB --- 

        } catch (err: any) {
            console.error("Error during visit creation or recommendation generation:", err);
            setErrorPrescription(err.message || "An unknown error occurred.");
            setSuccessMessage(null); // Clear success message on error
             // Optional: Consider rolling back the visit if recommendations fail spectacularly
             // if (createdVisitId) { console.warn("Need to decide if visit should be deleted on error"); }
        } finally {
            setLoadingSubmit(false);
            setLoadingPrescription(false);
        }
    };

    // Helper to fetch patient allergies and current prescriptions
    const fetchPatientContextData = async (patientId: string) => {
        try {
            console.log("Fetching context data (allergies, current meds) for", patientId);
            // Fetch full patient data again (might already have it, but ensure it's fresh)
            const { data: patientData, error: patientError } = await supabase
                .from('patients')
                .select('*')
                .eq('id', patientId)
                .single();
            if (patientError) throw new Error(`Patient Fetch Error: ${patientError.message}`);
            if (!patientData) throw new Error("Patient not found");
            setFullPatientDataForVisit(patientData as FullPatientData);

            // Fetch current prescriptions
            const { data: currentMeds, error: medsError } = await supabase
                .from('prescriptions')
                .select('medicationName:medication') // Select only medication name
                .eq('patient_id', patientId)
                // TODO: Add logic to filter for *active* prescriptions if necessary
                // .eq('status', 'active') 
            if (medsError) throw new Error(`Current Meds Fetch Error: ${medsError.message}`);
            setCurrentPrescriptionsList((currentMeds as CurrentPrescriptionDto[]) || []);
            console.log("Fetched Current Meds:", currentMeds);

            // Parse allergies (Replace with more robust parsing as needed)
            const history = patientData.medical_history as any;
            let allergies: string[] = [];
            if (history && typeof history === 'object') {
                 if (Array.isArray(history.allergies)) {
                     allergies = history.allergies.filter((a: any) => typeof a === 'string');
                 } else {
                    // Fallback basic check (improve this)
                    Object.entries(history).forEach(([key, value]) => {
                        if (typeof key === 'string' && key.toLowerCase().includes('allergy') && typeof value === 'string') {
                           allergies.push(value);
                        }
                    });
                 }
            }
            setPatientAllergiesList(allergies);
            console.log("Parsed Allergies:", allergies);

        } catch (error: any) {
            console.error("Error fetching patient context data:", error);
            setErrorPrescription(`Failed to load patient details for validation: ${error.message}`);
            // Reset potentially dependent state
            setCurrentPrescriptionsList([]);
            setPatientAllergiesList([]);
            setFullPatientDataForVisit(null);
        }
    };

    // --- Handlers for Recommendation Review ---
    const handleStatusChange = (id: string, newStatus: 'approved' | 'rejected') => {
        const updatedRecommendations = recommendations.map(rec => {
            if (rec.id === id) {
                // Reset validation issue if status changes
                return { ...rec, status: newStatus, validationIssue: undefined };
            }
            return rec;
        });

        // Determine if regeneration should be possible AFTER updating statuses
        const allowRegeneration = updatedRecommendations.some(rec => rec.status === 'rejected');

        setRecommendations(updatedRecommendations);
        setCanRegenerate(allowRegeneration); // Set based on whether any are rejected
        setIsValidated(false); // Reset validation status on any change
        setErrorPrescription(null); // Clear previous validation errors
        setFinalizeError(null); // Clear finalize errors
        setSuccessMessage(null); // Clear success message
    };

    const handleCommentChange = (id: string, comment: string) => {
        setRecommendations(prev =>
            prev.map(r => (r.id === id ? { ...r, clinicianComment: comment } : r))
        );
    };

    const handleValidation = async () => {
        const approved = recommendations.filter(r => r.status === 'approved');
        if (approved.length === 0) {
            alert("Please approve at least one recommendation to validate.");
            return;
        }
        if (!selectedPatient) {
            alert("Patient context lost. Please re-select patient.");
            return;
        }

        setLoadingPrescription(true); // Use loading indicator
        setErrorPrescription(null); // Clear previous errors
        setIsValidated(false);
        setCanFinalize(false);

        const requestBody: PrescriptionValidationRequest = {
            patientId: selectedPatient.id,
            proposedPrescriptions: approved.map(r => ({
                medicationName: r.medicationName,
                dosage: r.dosage,
                frequency: r.frequency
            })),
            patientAllergies: patientAllergiesList,
            currentPrescriptions: currentPrescriptionsList
        };

        try {
            console.log("Sending validation request:", requestBody);
            const response = await fetch('/api/prescriptions/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Validation request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const result: ValidationResponse = await response.json();
            console.log("Validation response:", result);

            // Update validation issues in state
            let hasIssues = result.validationIssues.length > 0;
            setRecommendations(prev => prev.map(rec => {
                const issue = result.validationIssues.find(vi => vi.medication === rec.medicationName);
                // Only mark approved items with issues if needed, or mark all matching meds
                return { ...rec, validationIssue: issue ? issue.details : undefined };
            }));

            setIsValidated(true);
            setCanFinalize(!hasIssues); // Can finalize only if NO issues
            if (hasIssues) {
                 setErrorPrescription("Validation found potential issues. Please review warnings.");
            } else {
                setSuccessMessage("Validation successful. Ready to finalize.");
            }

        } catch (error: any) {
            console.error("Validation API Error:", error);
            setErrorPrescription(`Validation Call Failed: ${error.message}`);
            setIsValidated(false);
            setCanFinalize(false);
        } finally {
             setLoadingPrescription(false);
        }
    };

    const handleFinalize = async () => {
        if (!visitId || !selectedPatient || !clinicianId) {
             setFinalizeError("Cannot finalize: Missing visit, patient, or clinician context.");
             return;
        }
        const finalPrescriptions = recommendations.filter(r => r.status === 'approved');
        if (finalPrescriptions.length === 0) {
            // If finalizing without any approved meds, maybe just navigate?
            console.log("No prescriptions approved. Navigating back.");
            navigate('/clinician/dashboard');
            return;
        }

        setIsFinalizing(true);
        setFinalizeError(null);
        setSuccessMessage(null);

        const prescriptionsToInsert = finalPrescriptions.map(fp => ({
            patient_id: selectedPatient.id,
            clinician_id: clinicianId,
            visit_id: visitId,
            medication: fp.medicationName,
            dosage: fp.dosage,
            frequency: fp.frequency,
            notes: fp.clinicianComment || null, // Save clinician comment as notes
        }));

        try {
             console.log("Inserting final prescriptions:", prescriptionsToInsert);
            const { error: insertError } = await supabase
                .from('prescriptions')
                .insert(prescriptionsToInsert);

            if (insertError) {
                throw new Error(`Failed to save final prescriptions: ${insertError.message}`);
            }

            console.log("Final prescriptions saved successfully.");
            setSuccessMessage("Visit and approved prescriptions finalized successfully!");
            // Redirect after a short delay
            setTimeout(() => {
                 navigate('/clinician/dashboard');
            }, 2000);

        } catch (error: any) {
            console.error("Error finalizing prescriptions:", error);
            setFinalizeError(`Failed to finalize: ${error.message}`);
        } finally {
             setIsFinalizing(false);
        }
    };

    // Function to handle regeneration of suggestions
    const handleRegenerate = useCallback(async () => {
        if (!visitNotes || !selectedPatient || !fullPatientDataForVisit) {
            setErrorPrescription("Cannot regenerate: Missing visit notes, patient selection, or patient context.");
            return;
        }

        setLoadingRegenerate(true);
        setErrorPrescription(null);
        setSuccessMessage(null);
        setFinalizeError(null);
        setIsValidated(false);
        setCanFinalize(false);
        // Clear old recommendations visually *before* fetching new ones
        // setRecommendations([]); // Decide if you want this, or keep old ones until new arrive

        const rejectedRecommendationsText = recommendations
            .filter(rec => rec.status === 'rejected')
            .map(rec => `- ${rec.medicationName}: Reason: ${rec.clinicianComment || 'No reason provided'}`)
            .join('\n');

        const patientData = fullPatientDataForVisit; // Already fetched and in state

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
             setErrorPrescription("Gemini API Key not configured.");
             setLoadingRegenerate(false);
             return;
        }
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const regenerationPrompt = `
Clinician requesting *new* prescription recommendations for patient: ${selectedPatient.username} (ID: ${selectedPatient.id}).

Previously Rejected Recommendations (Do NOT suggest these again for the listed reasons):
${rejectedRecommendationsText || 'None'}

Original Visit Context:
Visit Reason: ${visitReason}
Clinician Notes: ${visitNotes}
Allergies: ${patientAllergiesList.join(', ')}
Current Medications: ${currentPrescriptionsList.map(p => p.medicationName).join(', ')}
Relevant Medical History: ${JSON.stringify(patientData.medical_history || '{}').substring(0, 100)}...

Suggest up to 3 *new* and *distinct* prescription options appropriate for the original visit reason and clinician notes, considering the patient context and avoiding the rejected options above. For each new option, provide:
1. Medication Name
2. Dosage
3. Frequency
4. Brief Notes/Rationale

Format each recommendation clearly, separated by "${RECOMMENDATION_DELIMITER}".
`;

        try {
            console.log("Calling Gemini API for regeneration...");
            console.log("Regeneration Prompt:", regenerationPrompt);

            const geminiResponse = await fetch(geminiApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: regenerationPrompt }] }],
                }),
            });

            if (!geminiResponse.ok) {
                const errorData = await geminiResponse.json().catch(() => ({ message: 'Unknown error structure' }));
                throw new Error(`Gemini API regeneration call failed: ${geminiResponse.status} - ${errorData?.error?.message || 'Details unavailable'}`);
            }

            const geminiResult = await geminiResponse.json();
            const generatedText = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!generatedText) throw new Error("Gemini regeneration response did not contain text.");

            console.log("Gemini Regenerated Text:", generatedText);
            const parsedRecs = parseLlmRecommendations(generatedText);

            if (parsedRecs.length > 0) {
                setRecommendations(parsedRecs); // Replace old recommendations
                setSuccessMessage("New recommendations generated.");
                setCanRegenerate(false); // Hide regenerate button until another rejection
            } else {
                setErrorPrescription("AI could not generate new recommendations based on the constraints.");
                 // Keep canRegenerate true so user can try again or modify rejection notes
            }

        } catch (error: any) {
            console.error("Error regenerating recommendations:", error);
            setErrorPrescription(`Regeneration Failed: ${error.message}`);
             // Keep canRegenerate true so user can try again
        } finally {
            setLoadingRegenerate(false);
        }
    }, [visitReason, visitNotes, selectedPatient, recommendations, patientAllergiesList, currentPrescriptionsList, fullPatientDataForVisit, clinicianId]); // Added dependencies

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
                                disabled={loadingSubmit || loadingPrescription || recommendations.length > 0}
                                className="w-full group flex justify-center items-center py-3 px-4 border border-electric-blue rounded-md shadow-sm text-sm font-medium text-electric-blue bg-transparent hover:bg-electric-blue hover:text-dark-bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-electric-blue disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 ease-in-out active:scale-95"
                            >
                                {(loadingSubmit || loadingPrescription) ? (
                                    <svg className="animate-spin h-5 w-5 text-electric-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <span className="group-hover:scale-105 transition-transform duration-200 ease-in-out">Save Visit & Generate Recommendations</span>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Recommendation Review Section (conditionally rendered) */} 
            {recommendations.length > 0 && (
                <div className="mt-10 p-6 bg-dark-card border border-border-color rounded-xl shadow-lg animate-fade-in">
                    <h2 className="text-2xl font-semibold text-white mb-6 border-b border-border-color pb-3">Review AI Recommendations</h2>
                    <div className="space-y-5">
                        {recommendations.map((rec) => (
                            <div key={rec.id} className={`p-4 rounded-lg border transition-all duration-200 ${rec.status === 'approved' ? 'border-green-500/50 bg-green-900/20' : rec.status === 'rejected' ? 'border-red-500/50 bg-red-900/20 opacity-60' : 'border-border-color/50 bg-dark-input/30 hover:bg-dark-input/50'}`}>
                                {/* Medication Details */} 
                                <p className="font-semibold text-base text-pastel-blue mb-1">{rec.medicationName}</p>
                                <p className="text-sm text-off-white/80 mb-1">Dosage: {rec.dosage} | Frequency: {rec.frequency}</p>
                                {rec.llmNotes && <p className="text-xs italic text-off-white/60 mt-2 mb-3 border-t border-border-color/30 pt-2">Notes from AI: {rec.llmNotes}</p>}

                                {/* Validation Warning */} 
                                {rec.validationIssue && (
                                     <div className="my-2 p-2 bg-orange-900/40 border border-orange-700 rounded text-orange-200 text-xs flex items-center">
                                         <FaExclamationTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                                         <span>{rec.validationIssue}</span>
                                     </div>
                                )}

                                {/* Clinician Comment */} 
                                <textarea
                                    placeholder="Add clinician notes/comments for this prescription..."
                                    value={rec.clinicianComment}
                                    onChange={(e) => handleCommentChange(rec.id, e.target.value)}
                                    rows={2}
                                    className="w-full mt-2 px-3 py-2 text-sm rounded-md bg-dark-input border border-border-color/70 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue transition duration-150 disabled:opacity-50"
                                    disabled={rec.status === 'rejected'}
                                />

                                {/* Action Buttons */} 
                                <div className="flex justify-end space-x-3 mt-3">
                                    <button 
                                        type="button"
                                        onClick={() => handleStatusChange(rec.id, 'rejected')}
                                        className={`px-3 py-1 text-xs rounded font-medium transition duration-150 ${rec.status === 'rejected' ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-dark-bg border border-border-color text-off-white/70 hover:bg-red-700/30 hover:text-red-300'}`}
                                    >
                                        Reject
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => handleStatusChange(rec.id, 'approved')}
                                        className={`px-3 py-1 text-xs rounded font-medium transition duration-150 ${rec.status === 'approved' ? 'bg-green-600/80 hover:bg-green-600 text-white' : 'bg-dark-bg border border-border-color text-off-white/70 hover:bg-green-700/30 hover:text-green-300'}`}
                                    >
                                        Approve
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Validation/Finalize Buttons */} 
                    <div className="mt-8 pt-6 border-t border-border-color flex flex-col sm:flex-row justify-end items-center gap-4">
                         {errorPrescription && !loadingPrescription && 
                            <p className="text-red-400 text-sm text-left flex-grow mr-4">{errorPrescription}</p>} 
                         {finalizeError && !isFinalizing && 
                            <p className="text-red-400 text-sm text-left flex-grow mr-4">{finalizeError}</p>} 
                         {successMessage && !loadingPrescription && !isFinalizing &&
                             <p className="text-green-400 text-sm text-left flex-grow mr-4">{successMessage}</p>}

                        <button
                            type="button"
                            onClick={handleValidation}
                            disabled={loadingPrescription || isFinalizing}
                            className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-electric-blue text-electric-blue rounded-md hover:bg-electric-blue/10 disabled:opacity-50 transition text-sm font-medium"
                        >
                             {loadingPrescription ? <FaSpinner className="animate-spin mr-2" /> : <FaCheckCircle className="mr-2" />}
                             {loadingPrescription ? 'Validating...' : 'Validate Selections'}
                        </button>
                        <button
                            type="button"
                            onClick={handleFinalize}
                            disabled={!isValidated || !canFinalize || isFinalizing || loadingPrescription}
                            className="w-full sm:w-auto flex items-center justify-center px-4 py-2 border border-pastel-green text-pastel-green rounded-md hover:bg-pastel-green/10 disabled:opacity-50 disabled:cursor-not-allowed transition text-sm font-medium"
                        >
                             {isFinalizing ? <FaSpinner className="animate-spin mr-2" /> : <FaUserPlus className="mr-2" />}
                             {isFinalizing ? 'Finalizing...' : 'Finalize Prescriptions'}
                        </button>
                    </div>
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