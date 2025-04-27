import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Patient, JSONValue } from '../types/app';
import { useAuth } from '../context/AuthContext';
import { FaUserCircle, FaPlus, FaCamera, FaSpinner, FaEdit, FaCheckCircle, FaExclamationTriangle, FaFileMedicalAlt, FaCalendarCheck, FaSave, FaTimes, FaFileImage, FaUserEdit, FaHistory, FaShieldAlt, FaTrash, FaLanguage } from 'react-icons/fa';
import Webcam from 'react-webcam';
import { useNavigate } from 'react-router-dom';

// --- STEP 1: Add Google AI SDK Import --- 
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// --- Add Type for OCR Response ---
interface OcrResponseDto {
  extractedText: string | null;
}
// --- End Type Definition ---

// Define a type for the expected RPC response structure
/* // Remove unused interface
interface PatientDataResponse {
  patient: Patient | null; // Patient now includes email from the RPC
  prescriptions: Prescription[];
  visits: Visit[];
  error?: string; // Include error field if RPC returns error object
}
*/

const PatientProfilePage: React.FC = () => {
  const navigate = useNavigate(); // Initialize useNavigate
  // Get profile and refresh function from context
  const {
    profile: authProfile,
    loading: authLoading,
    error: authError,
    refreshProfile, // <-- Get refresh function
    updateProfile   // <-- Get update function
  } = useAuth();

  // State for visits and prescriptions
  // const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  // const [visits, setVisits] = useState<Visit[]>([]);
  // State for the FULL patient record fetched by this page
  const [fullPatientData, setFullPatientData] = useState<Patient | null>(null);
  // Separate loading/error state for this page's data
  const [loadingPageData, setLoadingPageData] = useState(true);
  const [errorPageData, setErrorPageData] = useState<string | null>(null);

  // State for upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- State for Allergy Input ---
  const [allergyNameInput, setAllergyNameInput] = useState('');
  const [allergyDescInput, setAllergyDescInput] = useState('');
  const [updatingHistory, setUpdatingHistory] = useState(false);
  const [historyUpdateError, setHistoryUpdateError] = useState<string | null>(null);
  // --- End Allergy State ---

  // --- State for Insurance Input & OCR ---
  const [insuranceProvider, setInsuranceProvider] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [groupNumber, setGroupNumber] = useState(''); // Optional field
  const [updatingInsurance, setUpdatingInsurance] = useState(false);
  const [insuranceUpdateError, setInsuranceUpdateError] = useState<string | null>(null);
  const [isEditingInsurance, setIsEditingInsurance] = useState(false); // <-- State for Edit Mode
  // New state for language preference
  const [preferredLanguage, setPreferredLanguage] = useState<string>('en'); // Default to English
  const [updatingLanguage, setUpdatingLanguage] = useState(false);
  const [languageUpdateError, setLanguageUpdateError] = useState<string | null>(null);

  const insuranceFileInputRef = useRef<HTMLInputElement>(null);
  const webcamRef = useRef<Webcam>(null); // <-- Ref for webcam
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResultText, setOcrResultText] = useState<string | null>(null);
  const [geminiLoading, setGeminiLoading] = useState(false); // <-- State for Gemini loading
  const [geminiError, setGeminiError] = useState<string | null>(null); // <-- State for Gemini error
  // --- End Insurance/OCR State ---

  // --- State for Camera ---
  const [showCamera, setShowCamera] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'user' or 'environment'
  // --- End Camera State ---

  // Get the basic profile from context for checks and ID
  const basicPatientProfile = authProfile?.role === 'patient' ? authProfile : null;
  // Overall loading combines auth loading and page data loading
  const loading = authLoading || loadingPageData;
  const error = authError || errorPageData;

  const [successMessage, setSuccessMessage] = useState<string | null>(null); // Add success state if not already present

  // --- STEP 2: Get Gemini API Key from Environment ---
  // WARNING: Even using .env, VITE_ variables are embedded in the build output
  // and accessible client-side. This is still insecure for production.
  // Use a backend proxy for secure API key handling.
  const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
  let genAI: GoogleGenerativeAI | null = null;
  let geminiInitializationError: string | null = null;

  if (!GEMINI_API_KEY) {
    console.error("VITE_GEMINI_API_KEY environment variable is not set.");
    geminiInitializationError = "Gemini API Key not configured. AI features disabled.";
    // Note: We will check for this error before calling Gemini functions.
  } else {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }

  // --- STEP 3: Function to call Gemini for parsing ---
  const callGeminiForParsing = async (text: string): Promise<{ provider: string | null, policyNumber: string | null, groupNumber: string | null } | null> => {
    // Check if Gemini was initialized successfully
    if (!genAI || geminiInitializationError) {
      setGeminiError(geminiInitializationError || "Gemini client not initialized.");
      return null;
    }

    setGeminiLoading(true);
    setGeminiError(null);
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // Or your preferred model

      const prompt = `Extract insurance details from the following text. Respond ONLY with a valid JSON object containing the keys "provider", "policyNumber", and "groupNumber". Use null or an empty string if a value cannot be found. Do not include any explanatory text before or after the JSON. Text: \\n\\n${text}`;

      console.log("Sending prompt to Gemini:", prompt);

      const generationConfig = {
        // temperature: 0.9, // Adjust creativity/determinism if needed
        // topK: 1,
        // topP: 1,
        maxOutputTokens: 2048, // Adjust as needed
        responseMimeType: "application/json", // Enforce JSON output
      };

      const safetySettings = [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
      ];

      // Corrected generateContent call signature
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
        safetySettings,
      });
      const response = result.response;

      // Check for safety blocks or other issues before accessing text()
      if (!response || response.promptFeedback?.blockReason) {
        const blockReason = response?.promptFeedback?.blockReason;
        const safetyRatings = response?.candidates?.[0]?.safetyRatings;
        console.error('Gemini request blocked. Reason:', blockReason, 'Ratings:', safetyRatings);
        throw new Error(`Gemini request blocked due to safety settings (Reason: ${blockReason || 'Unknown'}).`);
      }

      const responseText = response.text();

      console.log("Raw Gemini Response Text:", responseText);

      // Try parsing the JSON response
      try {
        const parsedJson = JSON.parse(responseText);
        // Basic validation of the structure
        if (typeof parsedJson === 'object' && parsedJson !== null &&
          'provider' in parsedJson && 'policyNumber' in parsedJson && 'groupNumber' in parsedJson) {
          console.log("Parsed Insurance Details from Gemini:", parsedJson);
          return {
            provider: parsedJson.provider || null,
            policyNumber: parsedJson.policyNumber || null,
            groupNumber: parsedJson.groupNumber || null,
          };
        } else {
          throw new Error("Gemini response JSON missing expected keys.");
        }
      } catch (parseError: any) {
        console.error("Failed to parse Gemini JSON response:", parseError, "Raw text:", responseText);
        throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
      }

    } catch (error: any) {
      console.error("Error calling Gemini API:", error);
      setGeminiError(`Gemini API Error: ${error.message}`);
      return null;
    } finally {
      setGeminiLoading(false);
    }
  };
  // --- End Gemini Parsing Function ---

  useEffect(() => {
    // Use the profileId from the basic context profile
    const patientId = basicPatientProfile?.profileId;

    if (patientId) {
      const fetchPageData = async () => {
        setLoadingPageData(true);
        setErrorPageData(null);
        setFullPatientData(null); // Reset patient data on new fetch
        try {
          console.log(`PatientProfilePage: Fetching ONLY patient data for ID: ${patientId}`);
          // Fetch ONLY full patient details
          const { data: patientData, error: patientError } = await supabase
            .from('patients')
            .select('*') // Fetch all columns for the patient
            .eq('id', patientId)
            .single(); // Expect only one patient record

          // Check for errors
          if (patientError) throw new Error(`Patient Fetch Error: ${patientError.message}`);
          if (!patientData) throw new Error("Patient record not found.");

          // Set ONLY the patient data
          console.log("Patient Data:", patientData);
          setFullPatientData(patientData); // Set the full patient data
          // Set initial language preference from fetched data
          if (patientData.preferred_language) { // Assuming column name is preferred_language
            setPreferredLanguage(patientData.preferred_language);
          }

        } catch (err: any) {
          console.error("Error fetching patient page data:", err);
          setErrorPageData(err.message || "Failed to load page data.");
        } finally {
          setLoadingPageData(false);
        }
      };
      fetchPageData();
    } else if (!authLoading) {
      // If auth is done loading but no patient profile ID, set page loading false
      setLoadingPageData(false);
      if (!basicPatientProfile) {
        setErrorPageData("Logged in user is not a patient or profile is missing.");
      }
    }
    // Dependency: only re-run if the patient's profile ID changes or auth finishes loading
  }, [basicPatientProfile?.profileId, authLoading]);

  // --- Populate Manual Fields from existing data ---
  useEffect(() => {
    if (fullPatientData?.insurance_details && typeof fullPatientData.insurance_details === 'object') {
      const details = fullPatientData.insurance_details as Record<string, string>;
      setInsuranceProvider(details.provider || '');
      setPolicyNumber(details.policy_number || '');
      setGroupNumber(details.group_number || '');
    }
  }, [fullPatientData?.insurance_details]);
  // --- End Populate Fields ---

  // const handleAddInsurance = () => {
  //   // TODO: Implement OCR logic or manual form for insurance
  //   alert('OCR for Insurance Details - Placeholder');
  // };

  // const handleAddMedicalHistory = () => {
  //   // TODO: Implement OCR logic or manual form for medical history/allergens
  //   alert('Update Medical History/Allergens - Placeholder');
  // };

  // --- Profile Picture Upload Logic ---
  // const handleFileSelectClick = () => {
  //     fileInputRef.current?.click(); // Trigger hidden file input
  // };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setUploading(true);
    setUploadError(null);
    setSuccessMessage(null); // Clear previous success
    try {
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }
      // Use IDs from the basic profile from context
      if (!basicPatientProfile?.userId || !basicPatientProfile?.profileId) {
        throw new Error('Patient profile context not fully loaded.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      // Use userId for the filename
      const fileName = `${basicPatientProfile.userId}-${Date.now()}.${fileExt}`;
      const filePath = `private/${fileName}`;

      console.log(`Uploading to path: ${filePath}`);

      const { error: uploadErr } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) {
        console.error('Storage Upload Error:', uploadErr);
        throw new Error(`Storage Error: ${uploadErr.message}`);
      }
      console.log("Storage Upload Successful");

      const expiresIn = 60 * 60 * 24 * 365;
      const { data: signedUrlData, error: signedUrlErr } = await supabase.storage
        .from('profile-pictures')
        .createSignedUrl(filePath, expiresIn);

      if (signedUrlErr) {
        console.error("Signed URL Error:", signedUrlErr);
        throw new Error('File uploaded, but failed to create signed URL.');
      }

      const signedUrl = signedUrlData?.signedUrl;
      console.log("Signed URL:", signedUrl);
      if (!signedUrl) {
        throw new Error('File uploaded, but signed URL was unexpectedly null.');
      }

      // Use profileId for the update
      console.log(`Attempting to update patient profile ID: ${basicPatientProfile.profileId}`);
      const { data: updatedPatientData, error: dbError } = await supabase
        .from('patients')
        .update({ profile_picture_url: signedUrl })
        .eq('id', basicPatientProfile.profileId) // Use profileId here
        .select()
        .maybeSingle();

      console.log("DB Update Result:", { updatedPatientData, dbError });
      if (dbError) throw new Error(`DB Update Error: ${dbError.message}`);
      if (!updatedPatientData) console.error("DB Update returned no data. RLS?");

      // Optimistic UI update for the context
      updateProfile({ profilePictureUrl: signedUrl });

      // Update local full patient data optimistically as well
      setFullPatientData(prevData => prevData ? { ...prevData, profile_picture_url: signedUrl } : null);

      // Background refresh (optional but good practice)
      setTimeout(() => refreshProfile(), 1500);

      setSuccessMessage("Profile picture updated successfully!"); // Set success
      setTimeout(() => setSuccessMessage(null), 3000); // Clear after 3s

    } catch (error: any) {
      console.error(error);
      setUploadError(error.message || 'An unknown error occurred during upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  // --- End Upload Logic ---

  // --- Handle Add/Update Medical History Item (Revised for Clarity) --- 
  const handleAddUpdateHistoryItem = async () => {
    const key = allergyNameInput.trim();
    const value = allergyDescInput.trim();

    if (!key) {
      setHistoryUpdateError("Item name/key cannot be empty.");
      return;
    }
    if (!fullPatientData?.id) {
      setHistoryUpdateError("Cannot update history: Patient data not fully loaded.");
      return;
    }

    setUpdatingHistory(true);
    setHistoryUpdateError(null);
    setSuccessMessage(null);

    try {
      // Clone existing or initialize
      let currentHistory: Record<string, JSONValue> = {};
      if (
        fullPatientData.medical_history &&
        typeof fullPatientData.medical_history === 'object' &&
        !Array.isArray(fullPatientData.medical_history) &&
        fullPatientData.medical_history !== null
      ) {
        currentHistory = JSON.parse(JSON.stringify(fullPatientData.medical_history));
      }

      // Add/update the item
      currentHistory[key] = value || 'Not Specified'; // Use 'Not Specified' if value is empty

      // Update database
      const { data: updatedPatient, error: updateError } = await supabase
        .from('patients')
        .update({ medical_history: currentHistory as JSONValue })
        .eq('id', fullPatientData.id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (!updatedPatient) throw new Error("Update successful but no patient data returned.");

      // Update local state and UI
      setFullPatientData(updatedPatient);
      setAllergyNameInput('');
      setAllergyDescInput('');
      setSuccessMessage(`Medical history item "${key}" updated successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any) {
      console.error("Error updating medical history:", err);
      setHistoryUpdateError(`Failed to update history: ${err.message}`);
    } finally {
      setUpdatingHistory(false);
    }
  };

  // --- Handle Delete Medical History Item --- 
  const handleDeleteHistoryItem = async (keyToDelete: string) => {
    if (!fullPatientData?.id || !fullPatientData.medical_history) {
      setHistoryUpdateError("Cannot delete item: Patient or history data not loaded.");
      return;
    }
    if (typeof fullPatientData.medical_history !== 'object' || Array.isArray(fullPatientData.medical_history)) {
      setHistoryUpdateError("Cannot delete item: Invalid history format.");
      return;
    }

    // Confirmation dialog
    if (!window.confirm(`Are you sure you want to delete the history item "${keyToDelete}"?`)) {
      return;
    }

    setUpdatingHistory(true); // Use the same loading state
    setHistoryUpdateError(null);
    setSuccessMessage(null);

    try {
      // Clone history and delete the key
      const currentHistory = JSON.parse(JSON.stringify(fullPatientData.medical_history));
      delete currentHistory[keyToDelete];

      // Update database
      const { data: updatedPatient, error: updateError } = await supabase
        .from('patients')
        .update({ medical_history: currentHistory as JSONValue })
        .eq('id', fullPatientData.id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (!updatedPatient) throw new Error("Update successful but no patient data returned.");

      // Update local state
      setFullPatientData(updatedPatient);
      setSuccessMessage(`History item "${keyToDelete}" deleted successfully!`);
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any) {
      console.error("Error deleting medical history item:", err);
      setHistoryUpdateError(`Failed to delete history item: ${err.message}`);
    } finally {
      setUpdatingHistory(false);
    }
  };

  // --- Handle Save Insurance (Manual - Now called from Edit Mode) ---
  const handleSaveInsurance = async () => {
    if (!fullPatientData?.id) {
      setInsuranceUpdateError("Cannot update insurance: Patient data not fully loaded.");
      return;
    }
    // Basic validation: require provider and policy number?
    if (!insuranceProvider.trim() || !policyNumber.trim()) {
      setInsuranceUpdateError("Provider and Policy Number are required.");
      return;
    }

    setUpdatingInsurance(true);
    setInsuranceUpdateError(null);
    setSuccessMessage(null); // Clear previous success

    const newInsuranceDetails = {
      provider: insuranceProvider.trim(),
      policy_number: policyNumber.trim(),
      group_number: groupNumber.trim() || null, // Store null if empty
      // Add other fields as needed
    };

    try {
      const { data: updatedPatient, error: updateError } = await supabase
        .from('patients')
        .update({ insurance_details: newInsuranceDetails as JSONValue })
        .eq('id', fullPatientData.id)
        .select()
        .single();

      if (updateError) throw updateError;
      if (!updatedPatient) throw new Error("Update successful but no patient data returned.");

      // Update local state
      setFullPatientData(updatedPatient);
      setSuccessMessage("Insurance details updated successfully!"); // Set success
      setTimeout(() => setSuccessMessage(null), 3000); // Clear after 3s

    } catch (err: any) {
      console.error("Error updating insurance details:", err);
      setInsuranceUpdateError(`Failed to save insurance details: ${err.message}`);
    } finally {
      setUpdatingInsurance(false);
    }
  };
  // --- End Handle Save Insurance ---

  // --- Function to handle saving language preference ---
  const handleSaveLanguage = async () => {
    if (!fullPatientData?.id) {
      setLanguageUpdateError("Cannot update language: Patient data not fully loaded.");
      return;
    }
    setUpdatingLanguage(true);
    setLanguageUpdateError(null);
    setSuccessMessage(null);

    try {
      const { data: updatedPatient, error: updateError } = await supabase
        .from('patients')
        .update({ preferred_language: preferredLanguage })
        .eq('id', fullPatientData.id)
        .select('preferred_language') // Select only the updated field to confirm
        .single();

      if (updateError) throw updateError;
      if (!updatedPatient) throw new Error("Update successful but no patient data returned.");

      // Update local state (already updated via setPreferredLanguage)
      // Optionally update fullPatientData if needed elsewhere
      setFullPatientData(prev => prev ? { ...prev, preferred_language: preferredLanguage } : null);

      setSuccessMessage(`Language preference updated to ${preferredLanguage === 'en' ? 'English' : preferredLanguage}.`);
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (err: any) {
      console.error("Error updating language preference:", err);
      setLanguageUpdateError(`Failed to save language: ${err.message}`);
    } finally {
      setUpdatingLanguage(false);
    }
  };
  // --- End Language Save Function ---

  // --- Helper function to handle saving and exiting edit mode ---
  const handleSaveInsuranceAndExitEditMode = async () => {
    await handleSaveInsurance();
    // Only exit edit mode if save was successful (no error)
    if (!insuranceUpdateError) {
      setIsEditingInsurance(false);
    }
  };
  // --- End Helper Function ---

  // --- Centralized OCR Request Function ---
  const processOcrRequest = async (base64Image: string | null) => {
    if (!base64Image) {
      setOcrError("No image data provided for OCR.");
      return;
    }

    setOcrLoading(true);
    setOcrError(null);
    setOcrResultText(null);
    setSuccessMessage(null); // Clear previous success

    try {
      console.log("Sending image to OCR endpoint...");
      const backendUrl = '/ocr'; // Adjust if needed

      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ base64Image: base64Image }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Could not parse error response' }));
        throw new Error(`OCR request failed: ${response.status} - ${errorData?.message || response.statusText}`);
      }

      const result: OcrResponseDto = await response.json();
      console.log("OCR Result Text:", result.extractedText);
      const extractedText = result.extractedText || "No text detected.";
      setOcrResultText(extractedText);
      // setSuccessMessage("OCR complete. Review the extracted text below."); // Initial message removed

      // --- STEP 5: Call Gemini for parsing and update ---
      if (extractedText !== "No text detected." && extractedText.trim().length > 0) {
        const parsedData = await callGeminiForParsing(extractedText);
        if (parsedData) {
          // --- MODIFIED: Populate state and enter edit mode instead of auto-saving ---
          // await updateInsuranceWithParsedData(parsedData); // REMOVED auto-save
          setInsuranceProvider(parsedData.provider || '');
          setPolicyNumber(parsedData.policyNumber || '');
          setGroupNumber(parsedData.groupNumber || '');
          setIsEditingInsurance(true); // Enter edit mode
          setInsuranceUpdateError(null); // Clear any previous edit errors
          setSuccessMessage("AI extracted details. Please review and save changes.");
          setTimeout(() => setSuccessMessage(null), 5000); // Longer timeout for review
          // --- End Modification ---
        } else {
          // Handle case where Gemini call failed but OCR succeeded
          setGeminiError(prev => prev || "Gemini parsing failed. Please enter details manually or try scanning again.");
        }
      } else if (extractedText !== "No text detected.") {
        console.warn("OCR returned minimal text, skipping Gemini parsing.");
        setOcrError("OCR detected very little text. Please try scanning again or enter manually.");
      } else {
        // OCR detected nothing
        setSuccessMessage("OCR complete. No text detected.");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
      // --- End Gemini Call ---

    } catch (err: any) {
      console.error("Error during OCR processing:", err);
      setOcrError(`OCR Error: ${err.message}`);
    } finally {
      setOcrLoading(false);
    }
  };
  // --- End Centralized OCR Function ---

  // --- Handle Insurance Card OCR Upload (File) ---
  const handleInsuranceOcrUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    const file = event.target.files[0];

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      // Call central processor
      await processOcrRequest(reader.result as string);
      // Reset file input value
      if (insuranceFileInputRef.current) {
        insuranceFileInputRef.current.value = "";
      }
    };
    reader.onerror = (error) => {
      console.error("Error reading file:", error);
      setOcrError("Error reading file.");
      setOcrLoading(false); // Ensure loading stops
    };
  };
  // --- End OCR File Upload Handler ---

  // --- Camera Handling Functions ---
  const handleOpenCamera = (mode: 'user' | 'environment') => {
    setFacingMode(mode);
    setShowCamera(true);
    setOcrError(null); // Clear errors when opening camera
    setOcrResultText(null);
  };

  const handleCloseCamera = () => {
    setShowCamera(false);
    setOcrError(null);
  };

  const handleCapture = useCallback(async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setShowCamera(false); // Close camera after capture
      await processOcrRequest(imageSrc); // Process the captured image
    }
  }, [webcamRef, processOcrRequest]); // Add processOcrRequest dependency
  // --- End Camera Handling ---

  if (loading) {
    return <div className="container mx-auto px-4 py-16 text-center text-white"><FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-primary-accent" /> Loading patient data...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-16 text-center"><div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg inline-block">Error: {error}</div></div>;
  }

  if (!fullPatientData) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-white">
        <p className="text-xl mb-4">Patient Not Found</p>
        <p className="text-off-white/70 mb-6">No patient data found for this profile, or you may not be logged in as a patient.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2 border border-primary-accent text-primary-accent rounded-md hover:bg-primary-accent hover:text-dark-bg transition duration-200 active:scale-95">
          Go to Login
        </button>
      </div>
    );
  }

  // Use fullPatientData for rendering details now
  console.log("Rendering PatientProfilePage with fullPatientData:", fullPatientData);
  return (
    <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-10 text-center">My Patient Profile</h1>

      {/* --- Alert Banners --- */}
      <div className="mb-6 space-y-3">
        {uploadError && (
          <div className="flex items-center bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative animate-fade-in">
            <FaExclamationTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <span className="block sm:inline text-sm">Upload Error: {uploadError}</span>
          </div>
        )}
        {historyUpdateError && (
          <div className="flex items-center bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative animate-fade-in">
            <FaExclamationTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <span className="block sm:inline text-sm">History Update Error: {historyUpdateError}</span>
          </div>
        )}
        {insuranceUpdateError && (
          <div className="flex items-center bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative animate-fade-in">
            <FaExclamationTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <span className="block sm:inline text-sm">Insurance Update Error: {insuranceUpdateError}</span>
          </div>
        )}
        {ocrError && (
          <div className="flex items-center bg-orange-900/60 border border-orange-700 text-orange-200 px-4 py-3 rounded-lg relative animate-fade-in">
            <FaExclamationTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <span className="block sm:inline text-sm">OCR Error: {ocrError}</span>
          </div>
        )}
        {geminiError && (
          <div className="flex items-center bg-orange-900/60 border border-orange-700 text-orange-200 px-4 py-3 rounded-lg relative animate-fade-in">
            <FaExclamationTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <span className="block sm:inline text-sm">AI Error: {geminiError}</span>
          </div>
        )}
        {successMessage && (
          <div className="flex items-center bg-green-900/60 border border-green-700 text-green-200 px-4 py-3 rounded-lg relative animate-fade-in">
            <FaCheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            <span className="block sm:inline text-sm">{successMessage}</span>
          </div>
        )}
      </div>

      {/* --- Main Content Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* --- Left Column (Profile Card & Actions) --- */}
        <div className="md:col-span-1 space-y-8">
          {/* Profile Card */}
          <div className="bg-dark-card p-6 rounded-xl shadow-lg border border-border-color flex flex-col items-center text-center animate-fade-in transition-shadow duration-300 hover:shadow-primary-glow-sm">
            {/* Profile Picture & Change Button */}
            <div className="flex-shrink-0 mb-4 relative group w-32 h-32">
              {authProfile?.profilePictureUrl ? (
                <img src={authProfile.profilePictureUrl} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-primary-accent shadow-md transition-transform duration-300 group-hover:scale-105" />
              ) : (
                <div className="w-full h-full rounded-full bg-dark-input flex items-center justify-center border-4 border-border-color text-off-white/30 transition-colors duration-300 group-hover:border-primary-accent"><FaUserCircle className="h-20 w-20" /></div>
              )}
              <label className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer">
                <div className="text-center">
                  <FaUserEdit className="h-6 w-6 text-white mx-auto mb-1" />
                  <span className="text-white text-xs font-medium">{uploading ? 'Uploading...' : 'Change Pic'}</span>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleProfilePictureUpload} accept="image/png, image/jpeg, image/gif" className="sr-only" disabled={uploading} />
              </label>
            </div>
            {/* Basic Info */}
            <div className="flex-grow mb-4">
              <p className="text-2xl font-semibold text-white mb-1">{fullPatientData.username || 'N/A'}</p>
              <p className="text-sm text-off-white/60">
                Member Since: {fullPatientData.created_at ? new Date(fullPatientData.created_at).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            {/* Navigation Buttons */}
            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => navigate('/patient/prescriptions')}
                className="w-full group flex items-center justify-center px-4 py-2.5 border border-primary-accent/70 text-primary-accent rounded-md hover:bg-primary-accent/10 hover:border-primary-accent transition duration-200 text-sm font-medium whitespace-nowrap active:scale-95"
              >
                <FaFileMedicalAlt className="mr-2 h-4 w-4 transition-colors duration-200 group-hover:text-primary-accent" /> View Prescriptions
              </button>
              <button
                onClick={() => navigate('/patient/visits')}
                className="w-full group flex items-center justify-center px-4 py-2.5 border border-pastel-blue/60 text-pastel-blue rounded-md hover:bg-pastel-blue/10 hover:border-pastel-blue transition duration-200 text-sm font-medium whitespace-nowrap active:scale-95"
              >
                <FaCalendarCheck className="mr-2 h-4 w-4 transition-colors duration-200 group-hover:text-pastel-blue" /> View Visits
              </button>
            </div>
          </div>
        </div>

        {/* --- Right Column (Medical & Insurance) --- */}
        <div className="md:col-span-2 space-y-8">
          {/* --- Medical History Card --- */}
          <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-border-color">
              <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center">
                <FaHistory className="mr-3 text-primary-accent" /> Medical History & Allergies
              </h2>
            </div>

            {/* Display Medical History */}
            <div className="text-sm space-y-3 mb-6 min-h-[60px]">
              {fullPatientData.medical_history &&
                typeof fullPatientData.medical_history === 'object' &&
                fullPatientData.medical_history !== null &&
                !Array.isArray(fullPatientData.medical_history) &&
                Object.keys(fullPatientData.medical_history).length > 0 ? (
                <ul className="space-y-3">
                  {Object.entries(fullPatientData.medical_history).map(([key, value]) => (
                    <li key={key} className="flex justify-between items-start p-3 bg-dark-input/40 rounded-lg border border-border-color/30 group">
                      <div>
                        <p className="font-medium capitalize text-off-white/90 break-words">{key.replace(/_/g, ' ')}</p>
                        <p className="text-off-white/70 break-words mt-0.5">{String(value) || <span className="italic">No details</span>}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteHistoryItem(key)}
                        disabled={updatingHistory}
                        className="ml-4 p-1.5 text-off-white/40 hover:text-red-500 hover:bg-red-900/30 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0"
                        title={`Delete item: ${key}`}
                      >
                        <FaTrash className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-off-white/60 italic text-center py-4">No medical history or allergy information provided.</p>
              )}
            </div>

            {/* Add/Update History Form */}
            <div className="mt-6 pt-6 border-t border-border-color/50">
              <h3 className="text-md font-semibold text-primary-accent mb-3">Add / Update History Item</h3>
              <div className="p-4 bg-dark-input/30 border border-border-color/30 rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    id="allergyNameInput"
                    type="text"
                    value={allergyNameInput}
                    onChange={(e) => setAllergyNameInput(e.target.value)}
                    placeholder="Item Name (e.g., Penicillin Allergy)"
                    className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-primary-accent focus:ring-1 focus:ring-primary-accent text-sm transition duration-150 placeholder:text-off-white/50"
                    disabled={updatingHistory}
                  />
                  <input
                    id="allergyDescInput"
                    type="text"
                    value={allergyDescInput}
                    onChange={(e) => setAllergyDescInput(e.target.value)}
                    placeholder="Description/Details (Optional)"
                    className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-primary-accent focus:ring-1 focus:ring-primary-accent text-sm transition duration-150 placeholder:text-off-white/50"
                    disabled={updatingHistory}
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleAddUpdateHistoryItem}
                    disabled={updatingHistory || !allergyNameInput.trim()}
                    className="flex items-center justify-center px-4 py-2 min-w-[130px] bg-primary-accent/80 hover:bg-primary-accent text-dark-bg rounded-md text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 shadow active:scale-95"
                  >
                    {updatingHistory ? <FaSpinner className="animate-spin mr-2 h-4 w-4" /> : <FaPlus className="mr-1.5 h-4 w-4" />} Add / Update
                  </button>
                </div>
              </div>
            </div>
          </div>{/* End Medical History Card */}

          {/* --- Insurance Details Card --- */}
          <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-color">
              <h2 className="text-xl sm:text-2xl font-semibold text-white flex items-center">
                <FaShieldAlt className="mr-3 text-pastel-blue" /> Insurance Details
              </h2>
              {/* --- Edit Button --- */}
              {!isEditingInsurance && (
                <button
                  onClick={() => {
                    const details = fullPatientData.insurance_details as Record<string, string> | null;
                    setInsuranceProvider(details?.provider || '');
                    setPolicyNumber(details?.policy_number || '');
                    setGroupNumber(details?.group_number || '');
                    setInsuranceUpdateError(null);
                    setIsEditingInsurance(true);
                  }}
                  className="flex items-center text-sm text-pastel-blue hover:text-primary-accent disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 p-1 rounded"
                  disabled={updatingInsurance || geminiLoading || !!geminiInitializationError}
                  title="Edit Insurance Details"
                >
                  <FaEdit className="mr-1 h-3.5 w-3.5" /> Edit
                </button>
              )}
            </div>

            {/* --- Conditional Rendering for Display/Edit --- */}
            {!isEditingInsurance ? (
              // --- Display View --- 
              <div className="text-sm space-y-3 mb-6 min-h-[60px]">
                {fullPatientData.insurance_details &&
                  typeof fullPatientData.insurance_details === 'object' &&
                  fullPatientData.insurance_details !== null &&
                  !Array.isArray(fullPatientData.insurance_details) &&
                  Object.keys(fullPatientData.insurance_details).filter(k => {
                    const details = fullPatientData.insurance_details as Record<string, JSONValue>;
                    return k !== 'ocr_raw_text' && details[k];
                  }).length > 0 ? (
                  <ul className="space-y-3">
                    {Object.entries(fullPatientData.insurance_details).map(([key, value]) => (
                      key !== 'ocr_raw_text' && value && (
                        <li key={key} className="flex justify-between items-start p-3 bg-dark-input/40 rounded-lg border border-border-color/30">
                          <span className="font-medium capitalize text-off-white/80 w-1/3 mr-2 flex-shrink-0 break-words">{key.replace(/_/g, ' ')}:</span>
                          <span className="text-off-white text-right flex-grow break-words">{String(value)}</span>
                        </li>
                      )
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-off-white/60 italic text-center py-4">No insurance details provided. Use OCR below or click 'Edit' to add manually.</p>
                )}
              </div>
            ) : (
              // --- Edit View --- 
              <div className="space-y-3 mb-6 p-4 bg-dark-input/30 border border-border-color/30 rounded-lg animate-fade-in">
                <div>
                  <label htmlFor="insuranceProviderEdit" className="block text-xs font-medium text-off-white/80 mb-1">Provider Name</label>
                  <input
                    id="insuranceProviderEdit"
                    type="text"
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    placeholder="Insurance Company Name"
                    className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-primary-accent focus:ring-1 focus:ring-primary-accent text-sm transition duration-150"
                    disabled={updatingInsurance}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="policyNumberEdit" className="block text-xs font-medium text-off-white/80 mb-1">Policy/Member Number</label>
                    <input
                      id="policyNumberEdit"
                      type="text"
                      value={policyNumber}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      placeholder="Policy or Member ID"
                      className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-primary-accent focus:ring-1 focus:ring-primary-accent text-sm transition duration-150"
                      disabled={updatingInsurance}
                    />
                  </div>
                  <div>
                    <label htmlFor="groupNumberEdit" className="block text-xs font-medium text-off-white/80 mb-1">Group Number (Optional)</label>
                    <input
                      id="groupNumberEdit"
                      type="text"
                      value={groupNumber}
                      onChange={(e) => setGroupNumber(e.target.value)}
                      placeholder="Group Number"
                      className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-primary-accent focus:ring-1 focus:ring-primary-accent text-sm transition duration-150"
                      disabled={updatingInsurance}
                    />
                  </div>
                </div>
                {insuranceUpdateError && (
                  <p className="text-red-400 text-xs pt-1">Error: {insuranceUpdateError}</p>
                )}
                <div className="flex justify-end pt-2 space-x-3">
                  <button
                    onClick={() => setIsEditingInsurance(false)}
                    disabled={updatingInsurance}
                    className="flex items-center justify-center px-4 py-2 min-w-[100px] bg-dark-input hover:bg-border-color/50 text-off-white/80 rounded-md text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 shadow active:scale-95"
                  >
                    <FaTimes className="mr-1.5 h-4 w-4" /> Cancel
                  </button>
                  <button
                    onClick={handleSaveInsuranceAndExitEditMode}
                    disabled={updatingInsurance || !insuranceProvider.trim() || !policyNumber.trim()}
                    className="flex items-center justify-center px-4 py-2 min-w-[120px] bg-primary-accent/80 hover:bg-primary-accent text-dark-bg rounded-md text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 shadow active:scale-95"
                  >
                    {updatingInsurance ? <FaSpinner className="animate-spin mr-2 h-4 w-4" /> : <FaSave className="mr-1.5 h-4 w-4" />} Save Changes
                  </button>
                </div>
              </div>
            )}

            {/* --- OCR Section --- */}
            <div className="mt-6 pt-6 border-t border-border-color/50">
              <h3 className="text-md font-semibold text-pastel-blue/90 mb-3">Scan Card / Upload Image</h3>
              {/* Gemini Warning */}
              {geminiInitializationError && (
                <p className="text-orange-400 text-xs mb-3 flex items-center">
                  <FaExclamationTriangle className="mr-1.5 h-4 w-4" /> {geminiInitializationError} (AI parsing disabled)
                </p>
              )}
              {/* Camera View */}
              {showCamera && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4 animate-fade-in">
                  <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" width={640} height={480} videoConstraints={{ width: 1280, height: 720, facingMode: facingMode }} className="rounded-lg border-4 border-primary-accent mb-4 max-w-full h-auto shadow-lg" />
                  <div className="flex space-x-4">
                    <button onClick={handleCapture} className="px-6 py-3 bg-primary-accent text-dark-bg rounded-lg font-semibold text-lg shadow hover:bg-primary-accent/90 transition active:scale-95">Capture Photo</button>
                    <button onClick={handleCloseCamera} className="px-4 py-2 bg-gray-600 text-white rounded-lg shadow hover:bg-gray-700 transition">Cancel</button>
                  </div>
                </div>
              )}
              {/* OCR Buttons */}
              {!showCamera && (
                <div className="flex items-center flex-wrap gap-3 mb-4">
                  <input type="file" accept="image/*" ref={insuranceFileInputRef} onChange={handleInsuranceOcrUpload} className="hidden" disabled={ocrLoading || showCamera || !!geminiInitializationError} />
                  <button onClick={() => insuranceFileInputRef.current?.click()} disabled={ocrLoading || showCamera || !!geminiInitializationError} className="flex items-center px-4 py-2 bg-dark-input hover:bg-dark-card border border-border-color/70 text-off-white/90 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 active:scale-95">
                    {ocrLoading ? <FaSpinner className="animate-spin mr-2 h-4 w-4" /> : <FaFileImage className="mr-1.5 h-4 w-4" />} Upload Image
                  </button>
                  <button onClick={() => handleOpenCamera('environment')} disabled={ocrLoading || showCamera || !!geminiInitializationError} className="flex items-center px-4 py-2 bg-dark-input hover:bg-dark-card border border-border-color/70 text-off-white/90 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 active:scale-95">
                    <FaCamera className="mr-1.5 h-4 w-4" /> Use Camera
                  </button>
                </div>
              )}
              {/* OCR Status/Result */}
              <div className="min-h-[20px]">
                {ocrLoading && <p className="text-sm text-pastel-blue/90 mb-2 flex items-center animate-pulse"><FaSpinner className="animate-spin mr-2" /> Processing OCR...</p>}
                {geminiLoading && <p className="text-sm text-pastel-blue/90 mb-2 flex items-center animate-pulse"><FaSpinner className="animate-spin mr-2" /> Analyzing text with AI...</p>}
              </div>
              {ocrResultText && !isEditingInsurance && (
                <div className="mt-4">
                  <label htmlFor="ocrResult" className="block text-xs font-medium text-off-white/80 mb-1">Extracted Text (AI attempted to parse details)</label>
                  <textarea
                    id="ocrResult"
                    readOnly
                    value={ocrResultText}
                    rows={5}
                    className="w-full px-3 py-2 rounded-lg bg-dark-input border border-border-color/70 text-off-white/90 text-xs font-mono focus:ring-1 focus:ring-primary-accent focus:border-primary-accent opacity-80"
                  />
                </div>
              )}
            </div>{/* End OCR Section */}
          </div>{/* End Insurance Details Card */}

          {/* Language Preference Card */}
          <div className="bg-dark-card p-6 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center">
              <FaLanguage className="mr-2 text-pastel-peach" /> Language Preference
            </h2>
            <p className="text-xs text-off-white/60 mb-3">Select the language for AI-generated summaries and chat.</p>
            <div className="flex items-center space-x-4">
              <select
                id="languageSelect"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="flex-grow px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-primary-accent focus:ring-1 focus:ring-primary-accent text-sm transition duration-150"
                disabled={updatingLanguage}
              >
                <option value="en">English</option>
                <option value="es">Español (Spanish)</option>
                {/* Add other languages as needed */}
                {/* <option value="fr">Français (French)</option> */}
              </select>
              <button
                onClick={handleSaveLanguage}
                disabled={updatingLanguage || (fullPatientData && fullPatientData.preferred_language === preferredLanguage)}
                className="flex items-center justify-center px-4 py-2 min-w-[90px] bg-pastel-peach/80 hover:bg-pastel-peach text-dark-bg rounded-md text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 shadow active:scale-95"
              >
                {updatingLanguage ? <FaSpinner className="animate-spin h-4 w-4" /> : <FaSave className="h-4 w-4" />}
              </button>
            </div>
            {languageUpdateError && (
              <p className="text-red-400 text-xs pt-2">Error: {languageUpdateError}</p>
            )}
          </div>
        </div>{/* End Right Column */}
      </div>{/* End Main Content Grid */}
    </div>
  );
};

export default PatientProfilePage; 