import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Patient } from '../types/app'; // Patient type should include medical/insurance details
import { useAuth } from '../context/AuthContext'; // Need clinician ID
import { FaSearch, FaTimes, FaUserCircle, FaSpinner, FaArrowLeft, FaUserPlus, FaCheckCircle, FaExclamationTriangle, FaQrcode, FaTabletAlt } from 'react-icons/fa'; // Removed FaNotesMedical
import { v4 as uuidv4 } from 'uuid'; // Import uuid
// Import the new QR code library
import QRCode from "react-qr-code";
import { GoogleGenerativeAI } from "@google/generative-ai"; // Import Gemini

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
    copayInfo?: string; // e.g., "$10.00", "Not Covered", "N/A"
}
// --- End Recommendation State Structure ---

// Define the structure for the drawing update payload
interface DrawingUpdatePayload {
    base64image: string; // Match DB schema: lowercase 'i'
}

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
    const [insuranceCoverage, setInsuranceCoverage] = useState<any | null>(null); // State for coverage JSON
    const [canRegenerate, setCanRegenerate] = useState(false);
    const [loadingRegenerate, setLoadingRegenerate] = useState(false);
    // --- End New State ---

    // --- Drawing State (Remove file-related state) ---
    const [drawingImagePreviewUrl, setDrawingImagePreviewUrl] = useState<string | null>(null);
    const [drawingBase64, setDrawingBase64] = useState<string | null>(null); // Keep this for QR/LLM
    const [processingDrawing, setProcessingDrawing] = useState(false);
    const [drawingError, setDrawingError] = useState<string | null>(null);
    // --- End Drawing State ---

    // Add back QR code related state
    const [showQrCode, setShowQrCode] = useState(false);
    const [drawingChannelId, setDrawingChannelId] = useState<string | null>(null);
    const [isListeningForDrawing, setIsListeningForDrawing] = useState(false);

    // --- Refs ---
    const drawingChannelRef = useRef<any>(null); // Store Supabase channel instance

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
        }, 300); // Increased debounce slightly

        // Cleanup function
        return () => clearTimeout(timerId);
    }, [searchTerm, selectedPatient]); // Re-run when searchTerm changes or patient selected

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(event.target.value);
        // NOTE: Ensure no other search logic is directly called here.
        // The useEffect hook handles the debounced search.
    };

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
        // Reset drawing state
        setDrawingImagePreviewUrl(null);
        setProcessingDrawing(false);
        setDrawingError(null);
        // Fetch context
        fetchPatientContextData(patient.id);
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

    // --- LLM Processing Function (Now takes base64 string) ---
    const processDrawingWithLLM = async (base64ImageData: string) => {
        console.log("Processing uploaded drawing with LLM...");
        setProcessingDrawing(true); // Ensure loading state is on
        setDrawingError(null);
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setDrawingError("Gemini API Key not configured.");
            setProcessingDrawing(false);
            return;
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Or gemini-pro-vision

            // --- Extract Mime Type and Raw Base64 Data --- 
            let rawBase64Data = '';
            let mimeType = 'image/png'; // Default
            const dataUrlMatch = base64ImageData.match(/^data:(image\/\w+);base64,/);
            if (dataUrlMatch && dataUrlMatch[1]) {
                mimeType = dataUrlMatch[1];
                rawBase64Data = base64ImageData.substring(dataUrlMatch[0].length);
                console.log(`Extracted Mime Type: ${mimeType}`);
            } else {
                // Fallback if it doesn't have the prefix (shouldn't happen with canvas dataURL)
                console.warn("Base64 data did not have expected data URL prefix. Assuming PNG.");
                rawBase64Data = base64ImageData;
            }

            // Add logging for the raw data
            console.log(`Sending Base64 data (length: ${rawBase64Data.length}), starts with: ${rawBase64Data.substring(0, 50)}...`);

            if (!rawBase64Data) {
                throw new Error("Processed base64 data is empty.");
            }
            // --- End Extraction and Logging --- 

            const prompt = "Transcribe the handwriting and drawings in this image into concise clinical visit notes. Focus on medical terms, symptoms, and potential diagnoses or plans. Format the output clearly.";
            const imagePart = {
                inlineData: {
                    mimeType: mimeType, // Use extracted mime type
                    data: rawBase64Data, // Use the raw base64 data without prefix
                },
            };

            const result = await model.generateContent([prompt, imagePart]);
            const response = result.response;
            const text = response.text();

            console.log("LLM Transcription Result:", text);
            // --- Add asterisk removal here ---
            const cleanedText = text ? text.replace(/\*/g, '') : '';
            // Append transcription to existing notes or set if notes are empty
            setVisitNotes(prev => prev ? `${prev}\n\n--- Transcribed Notes from Drawing ---\n${cleanedText}` : cleanedText);
            setDrawingError(null);

        } catch (error: any) {
            console.error("Error processing drawing with Gemini:", error);
            setDrawingError(`AI transcription failed: ${error.response?.data?.error?.message || error.message || 'Unknown error'}`);
            // Keep the image preview visible so user knows upload happened but processing failed
        } finally {
            setProcessingDrawing(false);
        }
    };
    // --- End LLM Processing Function ---

    const parseLlmRecommendations = (generatedText: string | undefined): Recommendation[] => {
        if (!generatedText) return [];
        console.log("Parsing LLM Text:", generatedText);

        const recommendations: Recommendation[] = [];
        const chunks = generatedText.split(RECOMMENDATION_DELIMITER);

        // Function to remove asterisks
        const stripAsterisks = (text: string | undefined | null): string => {
            return text ? text.replace(/\*/g, '').trim() : '';
        };

        for (const chunk of chunks) {
            const trimmedChunk = chunk.trim();
            if (!trimmedChunk) continue; // Skip empty chunks

            // More flexible regex to match labels (case-insensitive, optional words)
            const medicationMatch = trimmedChunk.match(/Medication(?: Name)?:\s*(.*)/i);
            const dosageMatch = trimmedChunk.match(/Dosage:\s*(.*)/i);
            const frequencyMatch = trimmedChunk.match(/Frequency:\s*(.*)/i);
            const notesMatch = trimmedChunk.match(/(?:LLM )?Notes:\s*(.*)/is); // Allow "LLM Notes:" or "Notes:"

            const medication = stripAsterisks(medicationMatch?.[1]);

            // Only add if a medication name was found in the chunk
            if (medication) {
                recommendations.push({
                    id: `rec-${uuidv4()}`, // Use uuid for a more robust unique id
                    medicationName: medication,
                    dosage: stripAsterisks(dosageMatch?.[1]) || 'N/A',
                    frequency: stripAsterisks(frequencyMatch?.[1]) || 'N/A',
                    llmNotes: stripAsterisks(notesMatch?.[1]) || 'N/A',
                    status: 'pending',
                    clinicianComment: '',
                    validationIssue: undefined,
                    copayInfo: undefined // Initialize copayInfo
                });
            }
        }

        console.log("Parsed Recommendations (Asterisks Removed):", recommendations);
        return recommendations;
    };

    // --- Function to Extract Copay Info using LLM ---
    const extractCopayFromNotes = async (notes: string): Promise<string> => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey || !notes) {
            console.warn("Gemini API Key or notes missing, cannot extract copay.");
            return "N/A";
        }

        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

            const prompt = `Analyze the following prescription notes and extract only the patient's copay amount or coverage status.
            Notes: "${notes}"

            Desired Output Rules:
            1. If a specific dollar amount is mentioned (e.g., "Copay $10", "Expected cost: $25.50"), return only the number (e.g., "10", "25.50").
            2. If the notes indicate it's not covered or not listed (e.g., "Not listed in formulary", "Not covered"), return "Not Covered".
            3. If no clear copay or coverage information is found, return "N/A".

            Return ONLY the extracted value ("10", "25.50", "Not Covered", or "N/A"). Do not include currency symbols or any other text.`;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text().trim();

            // Basic validation
            if (!isNaN(parseFloat(text)) || text === "Not Covered" || text === "N/A") {
                return text;
            } else {
                console.warn(`Unexpected LLM output for copay extraction from notes "${notes}":`, text);
                return "N/A"; // Default to N/A on unexpected output
            }
        } catch (error) {
            console.error(`Error calling Gemini for copay extraction from notes "${notes}":`, error);
            return "Error"; // Indicate an error occurred
        }
    };
    // --- End Copay Extraction Function ---

    const handleCreateVisit = async (e?: React.FormEvent) => { // Made event optional
        if (e) e.preventDefault(); // Prevent default if called from form submit
        if (!selectedPatient || !clinicianId || (!visitReason.trim() && !visitNotes.trim() && !drawingBase64)) {
            setSubmitError("Please select a patient and enter visit reason or provide notes/drawing.");
            return;
        }

        // Reset states
        setLoadingSubmit(true);
        setLoadingPrescription(true);
        setSubmitError(null);
        setErrorPrescription(null);
        setSuccessMessage(null);
        setRecommendations([]);
        setVisitId(null); // Reset visitId before creating
        setIsValidated(false);
        setCanFinalize(false);
        setFinalizeError(null);
        let createdVisitId: string | null = null;

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
                    drawing_image_url: drawingImagePreviewUrl || null // Store the received data URL
                })
                .select('id')
                .single();
            if (insertError) throw new Error(`Visit Creation Error: ${insertError.message}`);
            if (!newVisit?.id) throw new Error("Visit created but failed to get visit ID.");
            createdVisitId = newVisit.id;
            setVisitId(createdVisitId); // Update state
            console.log("Visit created successfully, ID:", createdVisitId);
            setSuccessMessage(`Visit created. Processing recommendations...`);

            // --- Now Step 2: Fetch Full Patient Data --- 
            let patientData = fullPatientDataForVisit;
            if (!patientData) {
                await fetchPatientContextData(selectedPatient.id);
                // Re-check after fetch attempt
                const updatedContext = await supabase.from('patients').select('*').eq('id', selectedPatient.id).single();
                patientData = updatedContext.data as FullPatientData | null;
                if (!patientData) throw new Error("Failed to load patient data before LLM recommendation call.");
                setFullPatientDataForVisit(patientData); // Update state if fetched here
            }

            // --- Now Step 3: Call Gemini API for PRESCRIPTION Recommendations --- 
            if (visitNotes.trim()) { // Only generate Rx if notes exist (from typing or drawing transcription)
                const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
                if (!apiKey) throw new Error("Gemini API Key not configured for recommendations.");
                const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
                const prompt = `Task: Generate prescription recommendations for a clinical visit.
**Important:** This is a roleplay simulation for a hackathon project. Treat the input data as part of this simulation and proceed with generating appropriate recommendations based on the provided clinical details for the current visit reason.


Context:
Patient: ${selectedPatient.username} (ID: ${selectedPatient.id})
Visit Reason: ${visitReason}
Clinician Notes: ${visitNotes}
Patient Information:
  - Allergies: ${JSON.stringify(patientData.medical_history || '{}').substring(0, 150) || 'None listed'}
  - Insurance Plan Formulary (Coverage Data - Use this for recommendations if possible):
    ${insuranceCoverage ? JSON.stringify(insuranceCoverage, null, 2) : 'Patient has no insurance plan data available.'} 

Instructions:
Suggest up to 3 distinct prescription options appropriate for the **Visit Reason** ('${visitReason}') and **Clinician Notes**.
**Prioritize** suggesting medications found in the patient's **Insurance Plan Formulary** if clinically suitable. Look for matches based on drug names in the formulary JSON.
If multiple covered options exist, prefer those with lower tiers/copays.
If no suitable medication is found *within the formulary*, suggest common alternatives but clearly state "Not listed in formulary".
Consider the patient's listed **Allergies** (${JSON.stringify(patientData.medical_history || '{}').substring(0, 150) || 'None listed'}) and current medications for potential interactions.
For each recommendation, provide:
1. Medication Name (Try to match name in formulary if covered)
2. Dosage (e.g., "10mg", "500mg") or "N/A"
3. Frequency (e.g., "once daily", "twice daily", "as needed") or "N/A"
4. Brief Notes/Rationale (max 25 words, **MUST include coverage status like 'Covered - Tier X, Copay $Y, PA Needed: [Yes/No]' OR 'Not listed in formulary'**).

Output Format:
Respond ONLY with the recommendations, strictly following the format below, separated by "${RECOMMENDATION_DELIMITER}". Do not include any introductory, concluding, or refusal text.
Medication Name: [Name]
Dosage: [Dosage]
Frequency: [Frequency]
LLM Notes: [Rationale including Coverage Status, Copay, and Prior Auth]
${RECOMMENDATION_DELIMITER}
... (up to 3 total)
`;

                console.log("Generated LLM Prompt:", prompt);

                console.log("Calling Gemini API for prescription recommendations...");
                const geminiResponse = await fetch(geminiApiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
                });
                if (!geminiResponse.ok) {
                    const errorData = await geminiResponse.json().catch(() => ({ message: 'Unknown error structure' }));
                    throw new Error(`Gemini Recommendation API call failed: ${geminiResponse.status} - ${errorData?.error?.message || 'Details unavailable'}`);
                }
                const geminiResult = await geminiResponse.json();
                const generatedText = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!generatedText) console.warn("Gemini recommendation response did not contain text."); // Don't throw, maybe no recs needed

                console.log("Gemini Recommendation Text:", generatedText);
                const parsedRecs = parseLlmRecommendations(generatedText);
                setRecommendations(parsedRecs);

                if (parsedRecs.length > 0) {
                    setSuccessMessage("Visit saved & recommendations generated. Review below.");
                } else {
                    setSuccessMessage("Visit saved. No recommendations generated by AI.");
                    setIsValidated(true); // Allow finalizing immediately if no recs
                    setCanFinalize(true);
                }
            } else {
                // No notes were entered or generated
                setSuccessMessage("Visit saved. No notes provided for recommendation generation.");
                setRecommendations([]);
                setIsValidated(true); // Allow finalizing
                setCanFinalize(true);
            }

        } catch (err: any) {
            console.error("Error during visit creation/processing:", err);
            // Basic error for user
            setSubmitError(err.message || "An unknown error occurred during saving or processing.");
            setSuccessMessage(null);
            // Consider if visit should be deleted if subsequent steps fail significantly?
            if (createdVisitId) {
                console.warn("Visit created but subsequent processing failed. Visit ID:", createdVisitId);
                // Maybe add a UI element to allow user to delete this incomplete visit?
            }
        } finally {
            setLoadingSubmit(false);
            setLoadingPrescription(false); // Turn off both loaders
        }
    };

    const fetchPatientContextData = async (patientId: string) => {
        try {
            console.log("Fetching context data (patient, allergies, current meds, insurance) for", patientId);
            // Fetch full patient data again (might already have it, but ensure it's fresh)
            const { data: patientData, error: patientError } = await supabase
                .from('patients')
                .select('*, insurance_details') // Ensure insurance_details is selected
                .eq('id', patientId)
                .single();
            if (patientError) throw new Error(`Patient Fetch Error: ${patientError.message}`);
            if (!patientData) throw new Error("Patient not found");
            setFullPatientDataForVisit(patientData as FullPatientData);

            // --- Fetch Insurance Coverage --- 
            setInsuranceCoverage(null); // Reset coverage
            const insuranceDetails = patientData.insurance_details as any;
            if (insuranceDetails && insuranceDetails.group_number) {
                console.log(`Fetching insurance plan for group number: ${insuranceDetails.group_number}`);
                const { data: planData, error: planError } = await supabase
                    .from('insurance_plans')
                    .select('coverage')
                    .eq('group_number', insuranceDetails.group_number)
                    .maybeSingle(); // Use maybeSingle as plan might not exist

                if (planError) {
                    console.error("Error fetching insurance plan:", planError);
                    // Don't throw error, just proceed without coverage data
                } else if (planData && planData.coverage) {
                    setInsuranceCoverage(planData.coverage);
                    console.log("Fetched Insurance Coverage Data:", planData.coverage);
                } else {
                    console.log("No matching insurance plan found for group number:", insuranceDetails.group_number);
                }
            } else {
                console.log("Patient has no insurance details or group number recorded.");
            }
            // --- End Fetch Insurance --- 

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

            // Parse allergies (Updated Logic)
            const history = patientData.medical_history as any;
            let allergies: string[] = [];
            if (history && typeof history === 'object' && !Array.isArray(history)) {
                // Directly use the keys of the medical_history object as allergies
                allergies = Object.keys(history);
            }
            setPatientAllergiesList(allergies);
            console.log("Parsed Allergies (Keys):", allergies);

        } catch (error: any) {
            console.error("Error fetching patient context data:", error);
            setErrorPrescription(`Failed to load patient details for validation: ${error.message}`);
            // Reset potentially dependent state
            setCurrentPrescriptionsList([]);
            setPatientAllergiesList([]);
            setFullPatientDataForVisit(null);
            setInsuranceCoverage(null); // Reset coverage on error
        }
    };

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

        // --- Extract Copay Info BEFORE Inserting --- 
        const copayExtractionPromises = finalPrescriptions.map(async (fp) => {
            // Extract copay from the original LLM notes
            const copay = await extractCopayFromNotes(fp.llmNotes);
            return { ...fp, copayInfo: copay }; // Return the prescription with copayInfo added
        });

        const prescriptionsWithCopay = await Promise.all(copayExtractionPromises);
        // --- End Copay Extraction --- 

        // Map prescriptions for insertion, now including the extracted copay info in the notes
        const prescriptionsToInsert = prescriptionsWithCopay.map(fp => {
            // Combine original notes, clinician comment, and copay info
            let combinedNotes = fp.llmNotes;
            if (fp.clinicianComment) {
                combinedNotes += `\n\nClinician Comment: ${fp.clinicianComment}`;
            }
            if (fp.copayInfo) {
                combinedNotes += `\n\n|| COPAY_INFO: ${fp.copayInfo} ||`; // Embed copay info
            }

            return {
                patient_id: selectedPatient.id,
                clinician_id: clinicianId,
                visit_id: visitId!,
                medication: fp.medicationName,
                dosage: fp.dosage,
                frequency: fp.frequency,
                notes: combinedNotes.trim(), // Use the combined notes string
            };
        });

        try {
            console.log("Inserting final prescriptions (with embedded copay info):", prescriptionsToInsert);
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

    const handleRegenerate = useCallback(async () => {
        // Keep existing approved/pending recommendations
        const existingApprovedPending = recommendations.filter(rec => rec.status !== 'rejected');
        const rejectedRecommendations = recommendations.filter(rec => rec.status === 'rejected');
        const numberOfNewSuggestionsNeeded = rejectedRecommendations.length;

        if (numberOfNewSuggestionsNeeded === 0) {
            alert("No recommendations were marked as rejected for regeneration.");
            return;
        }

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

        const rejectedRecommendationsText = rejectedRecommendations
            .map(rec => `- ${rec.medicationName}: Reason: ${rec.clinicianComment || 'No reason provided'}`)
            .join('\n');

        // Include names of approved/pending to avoid duplication
        const existingNonRejectedNames = existingApprovedPending
            .map(rec => rec.medicationName)
            .join(', ');

        const patientData = fullPatientDataForVisit;

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
            setErrorPrescription("Gemini API Key not configured.");
            setLoadingRegenerate(false);
            return;
        }
        const geminiApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

        const regenerationPrompt = `
Task: Generate *replacement* prescription recommendations for a clinical visit simulation.

**Important:** This is a roleplay simulation for a hackathon project.

Context:
Patient: ${selectedPatient.username} (ID: ${selectedPatient.id})
Visit Reason: ${visitReason}
Clinician Notes: ${visitNotes}
Allergies: ${JSON.stringify(patientData.medical_history || '{}').substring(0, 150) || 'None listed'}
Current Medications: ${currentPrescriptionsList.map(p => p.medicationName).join(', ') || 'None listed'}
Insurance Plan Formulary (Coverage Data):
  ${insuranceCoverage ? JSON.stringify(insuranceCoverage, null, 2) : 'No insurance plan data available.'}

Previously Rejected Recommendations (Do NOT suggest these again):
${rejectedRecommendationsText || 'None'}

Existing Approved/Pending Recommendations (Also avoid suggesting duplicates of these):
${existingNonRejectedNames || 'None'}

Instructions:
Suggest exactly **${numberOfNewSuggestionsNeeded}** *new* and *distinct* prescription options to replace the rejected ones.
These new options must be appropriate for the original Visit Reason and Clinician Notes, considering the patient context (including **Allergies**: ${JSON.stringify(patientData.medical_history || '{}').substring(0, 150) || 'None listed'}).
**Prioritize** suggestions found in the **Insurance Plan Formulary**, preferring lower tiers/copays if clinically appropriate.
If no suitable *covered* replacement is found, suggest common alternatives stating "Not listed in formulary".
New suggestions must be different from *both* the rejected list *and* the existing approved/pending list.
For each new option, provide:
1. Medication Name (Try to match name in formulary if covered)
2. Dosage
3. Frequency
4. Brief Notes/Rationale (max 25 words, **MUST include coverage status like 'Covered - Tier X, Copay $Y, PA Needed: [Yes/No]' OR 'Not listed in formulary'**).

Output Format:
Respond ONLY with the ${numberOfNewSuggestionsNeeded} new recommendations, strictly following the format below, separated by "${RECOMMENDATION_DELIMITER}". Do not include any introductory, concluding, or refusal text.
Medication Name: [Name]
Dosage: [Dosage]
Frequency: [Frequency]
LLM Notes: [Rationale including Coverage Status, Copay, and Prior Auth]
${RECOMMENDATION_DELIMITER}
... (exactly ${numberOfNewSuggestionsNeeded} times)
`;

        try {
            console.log("Calling Gemini API for REPLACEMENT recommendations...");
            console.log("Regeneration Prompt:", regenerationPrompt);

            const geminiResponse = await fetch(geminiApiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: regenerationPrompt }] }] }),
            });

            if (!geminiResponse.ok) {
                const errorData = await geminiResponse.json().catch(() => ({ message: 'Unknown error structure' }));
                throw new Error(`Gemini API regeneration call failed: ${geminiResponse.status} - ${errorData?.error?.message || 'Details unavailable'}`);
            }

            const geminiResult = await geminiResponse.json();
            const generatedText = geminiResult?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!generatedText) throw new Error("Gemini regeneration response did not contain text.");

            console.log("Gemini Regenerated Text:", generatedText);
            const newParsedRecs = parseLlmRecommendations(generatedText);

            if (newParsedRecs.length > 0) {
                // **Merge** new recommendations with existing approved/pending ones
                // Reset copayInfo for newly generated ones
                const finalRecs = [
                    ...existingApprovedPending,
                    ...newParsedRecs.map(rec => ({ ...rec, copayInfo: undefined }))
                ];
                setRecommendations(finalRecs);
                setSuccessMessage("New recommendations generated to replace rejected ones.");
                setCanRegenerate(false); // Hide regenerate button until another rejection
            } else {
                setErrorPrescription("AI could not generate suitable replacements based on the constraints.");
                // Keep existing approved/pending, user might need to manually adjust or change rejections
                setRecommendations(existingApprovedPending);
                // Keep canRegenerate true? Or false? Maybe false is better to avoid loop.
                setCanRegenerate(false);
            }

        } catch (error: any) {
            console.error("Error regenerating recommendations:", error);
            setErrorPrescription(`Regeneration Failed: ${error.message}`);
            // Keep existing state, allow user to try again maybe?
            setRecommendations(existingApprovedPending); // Revert to only approved/pending
            setCanRegenerate(true); // Allow retry
        } finally {
            setLoadingRegenerate(false);
        }
    }, [visitReason, visitNotes, selectedPatient, recommendations, patientAllergiesList, currentPrescriptionsList, fullPatientDataForVisit, parseLlmRecommendations, extractCopayFromNotes]); // Added extractCopayFromNotes dependency

    // Subscribe to Supabase channel for drawing updates
    const listenForDrawingUpdates = useCallback((channelId: string) => {
        // Add log here
        console.log(`Setting up Supabase channel listener for: ${channelId}`);
        console.log(`Listening on channel: drawing-updates-${channelId}`);
        setIsListeningForDrawing(true);

        drawingChannelRef.current = supabase
            .channel(`drawing-updates-${channelId}`)
            .on<DrawingUpdatePayload>(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'drawing_updates', filter: `channel_id=eq.${channelId}` },
                (payload) => {
                    // Log the raw payload immediately upon receiving
                    console.log('Raw payload received from Supabase channel:', JSON.stringify(payload, null, 2));
                    // Fix: Use lowercase 'base64image' to match DB schema
                    if (payload.new && payload.new.base64image) {
                        console.log('Processing payload.new.base64image...'); // Add log here too
                        setDrawingBase64(payload.new.base64image);
                        setDrawingImagePreviewUrl(payload.new.base64image); // Show preview
                        setShowQrCode(false); // Hide QR code
                        setIsListeningForDrawing(false); // Stop listening indicator
                        if (drawingChannelRef.current) {
                            supabase.removeChannel(drawingChannelRef.current); // Unsubscribe
                            drawingChannelRef.current = null;
                        }
                        setDrawingError(null); // Clear previous errors
                        // Automatically process the drawing
                        processDrawingWithLLM(payload.new.base64image);
                    } else {
                        console.warn("Received payload without new image data:", payload);
                        setDrawingError("Received update from tablet, but image data was missing.");
                    }
                }
            )
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log(`Successfully subscribed to channel: drawing-updates-${channelId}`);
                } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error(`Channel subscription error (${status}):`, err);
                    setDrawingError(`Failed to connect to drawing sync service (${status}). Please try again.`);
                    setIsListeningForDrawing(false);
                    setShowQrCode(false); // Hide QR code on error
                }
            });

        // Cleanup function for useEffect or component unmount
        return () => {
            if (drawingChannelRef.current) {
                console.log("Cleaning up Supabase channel subscription.");
                supabase.removeChannel(drawingChannelRef.current);
                drawingChannelRef.current = null;
            }
        };
    }, [processDrawingWithLLM]); // Add processDrawingWithLLM dependency

    const handleDrawNotesClick = () => {
        const newChannelId = uuidv4();
        setDrawingChannelId(newChannelId);
        setShowQrCode(true);
        listenForDrawingUpdates(newChannelId);
    };

    const handleCancelDrawing = () => {
        setShowQrCode(false);
        setDrawingChannelId(null);
        setIsListeningForDrawing(false);
        if (drawingChannelRef.current) {
            supabase.removeChannel(drawingChannelRef.current);
            drawingChannelRef.current = null;
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
                            onChange={handleSearchChange}
                            className="w-full px-4 py-2.5 pl-10 rounded-md bg-dark-input border border-border-color text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150"
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

                    {/* Show EITHER Notes Input OR Drawing QR Code section */}
                    {!showQrCode && !processingDrawing && (
                        <form onSubmit={handleCreateVisit} className="space-y-6 mt-6 animate-fade-in">
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
                                    disabled={loadingSubmit || loadingPrescription || recommendations.length > 0}
                                />
                            </div>

                            {/* Notes Input OR Draw Button */}
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
                                    disabled={loadingSubmit || loadingPrescription || recommendations.length > 0}
                                />
                                {/* Draw Notes Button */}
                                <button
                                    type="button"
                                    onClick={handleDrawNotesClick}
                                    disabled={loadingSubmit || loadingPrescription || recommendations.length > 0}
                                    className="mt-3 group inline-flex items-center px-4 py-2 border border-pastel-blue/70 text-pastel-blue rounded-md shadow-sm text-sm font-medium bg-transparent hover:bg-pastel-blue/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-pastel-blue disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 ease-in-out"
                                >
                                    <FaTabletAlt className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
                                    Draw Notes on Tablet Instead
                                </button>
                            </div>

                            {/* --- MOVED Preview Area (for QR received drawing) --- */}
                            {drawingImagePreviewUrl && !showQrCode && (
                                <div className="flex justify-center my-4"> {/* Added my-4 for spacing */}
                                    <div className="p-4 border border-border-color rounded-lg inline-block bg-dark-input/50 animate-fade-in">
                                        <p className="text-sm text-pastel-mint mb-2">Received drawing:</p>
                                        <img src={drawingImagePreviewUrl} alt="Drawing Preview" className="max-h-48 rounded" />
                                    </div>
                                </div>
                            )}
                            {/* --- End Moved Preview Area --- */}

                            {/* Show processing indicator only if actively processing *after* receiving */}
                            {processingDrawing && !showQrCode && drawingBase64 && (
                                <div className="flex items-center justify-center text-sm text-pastel-blue py-4 animate-pulse">
                                    <FaSpinner className="animate-spin h-5 w-5 mr-3" />
                                    <span>Processing received drawing for transcription...</span>
                                </div>
                            )}

                            {/* Error/Success Messages */}
                            <div className="min-h-[40px] space-y-2">
                                {submitError && <p className="text-red-400 text-sm flex items-center"><FaExclamationTriangle className="mr-2" /> {submitError}</p>}
                                {errorPrescription && <p className="text-red-400 text-sm flex items-center"><FaExclamationTriangle className="mr-2" /> {errorPrescription}</p>}
                                {/* Show success only if not loading prescription */}
                                {successMessage && !loadingPrescription && <p className="text-green-400 text-sm flex items-center"><FaCheckCircle className="mr-2" /> {successMessage}</p>}
                            </div>

                            {/* Show specific loading message for prescription generation */}
                            {loadingPrescription && (
                                <div className="flex items-center justify-center text-sm text-pastel-blue py-2 animate-pulse">
                                    <FaSpinner className="animate-spin h-5 w-5 text-electric-blue" />
                                    <span>Generating prescription...</span>
                                </div>
                            )}

                            {/* Generate Suggestions Button (Submit) */}
                            <div>
                                <button
                                    type="submit" // Triggers form onSubmit -> handleCreateVisit
                                    disabled={loadingSubmit || loadingPrescription || recommendations.length > 0 || (!visitReason.trim() && !visitNotes.trim() && !drawingBase64)}
                                    className="w-full group flex justify-center items-center py-3 px-4 border border-electric-blue rounded-md shadow-sm text-sm font-medium text-electric-blue bg-transparent hover:bg-electric-blue hover:text-dark-bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-electric-blue disabled:opacity-50 disabled:cursor-not-allowed transition duration-200 ease-in-out"
                                >
                                    {loadingSubmit || loadingPrescription ? (
                                        <FaSpinner className="animate-spin h-5 w-5 text-electric-blue" />
                                    ) : (
                                        <span className="group-hover:scale-105 transition-transform duration-200 ease-in-out">Generate Prescription Suggestions</span>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Drawing Processing Indicator (Only shown when uploading file) */}
                    {processingDrawing && !showQrCode && (
                        <div className="flex items-center justify-center text-sm text-pastel-blue py-6 animate-pulse mt-2">
                            <FaSpinner className="animate-spin h-5 w-5 mr-3" />
                            <span>Processing uploaded drawing for transcription...</span>
                        </div>
                    )}

                    {/* --- QR Code Display Section --- */}
                    {(showQrCode || (isListeningForDrawing && !drawingImagePreviewUrl)) && (
                        <div className="mt-6 p-6 border border-dashed border-border-color rounded-lg text-center animate-fade-in bg-dark-input/30">
                            <h3 className="text-lg font-semibold text-pastel-blue mb-4 flex items-center justify-center">
                                <FaQrcode className="mr-2" /> Scan to Draw Notes
                            </h3>
                            <p className="text-sm text-off-white/70 mb-5">
                                Scan the QR code with another device (like a tablet) to open the drawing canvas. Notes will appear here automatically.
                            </p>
                            {/* Container for QR code and Link */}
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-white rounded-lg inline-block shadow-lg">
                                    {drawingChannelId && (
                                        <QRCode
                                            value={`https://prescripto-service-961908516332.us-central1.run.app/draw/${drawingChannelId}`} // URL for QR code
                                            size={180}
                                            level="M" // Error correction level
                                        />
                                    )}
                                </div>
                                {/* Display the URL text as a clickable link */}
                                {drawingChannelId && (
                                    <a
                                        href={`https://prescripto-service-961908516332.us-central1.run.app/draw/${drawingChannelId}`}
                                        target="_blank" // Open in new tab
                                        rel="noopener noreferrer" // Security measure
                                        className="block text-xs text-pastel-blue hover:text-electric-blue hover:underline mt-1 break-all transition-colors duration-150"
                                        title="Open drawing page in new tab"
                                    >
                                        Open Drawing Link: <span className="font-mono">{`.../draw/${drawingChannelId.substring(0, 8)}...`}</span>
                                    </a>
                                )}
                            </div>

                            {isListeningForDrawing && (
                                <div className="flex items-center justify-center text-sm text-pastel-blue py-2 animate-pulse mt-4"> {/* Added mt-4 */}
                                    <FaSpinner className="animate-spin h-4 w-4 mr-2" />
                                    <span>Waiting for notes from tablet...</span>
                                </div>
                            )}
                            {drawingError && (
                                <p className="text-red-400 text-xs pt-1 mt-2">{drawingError}</p>
                            )}
                            <button
                                onClick={handleCancelDrawing}
                                className="mt-5 px-4 py-2 border border-red-500/70 text-red-400 rounded-md shadow-sm text-sm font-medium bg-transparent hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-card focus:ring-red-500 transition duration-200 ease-in-out" // Added mt-5
                            >
                                Cancel Drawing Sync
                            </button>
                        </div>
                    )}
                    {/* --- End QR Code Display Section --- */}

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

                    {/* Regeneration Button - Appears only when possible */}
                    {canRegenerate && (
                        <div className="mt-4 flex justify-center">
                            <button
                                type="button"
                                onClick={handleRegenerate}
                                disabled={loadingRegenerate}
                                className="flex items-center justify-center px-4 py-2 border border-orange-400 text-orange-400 rounded-md hover:bg-orange-400/10 disabled:opacity-50 transition text-sm font-medium"
                            >
                                {loadingRegenerate ? <FaSpinner className="animate-spin mr-2" /> : <FaCheckCircle className="mr-2" />}
                                {loadingRegenerate ? 'Regenerating...' : 'Regenerate Suggestions (Based on Rejections)'}
                            </button>
                        </div>
                    )}
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