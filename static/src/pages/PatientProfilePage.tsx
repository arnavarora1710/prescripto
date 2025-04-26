import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
// We might not need the User type from supabase-js directly anymore
// import { User } from '@supabase/supabase-js'; 
import { Patient, Prescription, Visit, JSONValue } from '../types/app'; // Import types, including JSONValue
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { FaUserCircle, FaPlus, FaCamera, FaTimes, FaDownload, FaSpinner, FaEdit, FaCheckCircle, FaExclamationTriangle, FaFileMedicalAlt, FaCalendarCheck } from 'react-icons/fa';
import jsPDF from 'jspdf'; // <-- Import jsPDF
import autoTable from 'jspdf-autotable'; // <-- Import autoTable
import Webcam from 'react-webcam'; // <-- Import Webcam
import { useNavigate } from 'react-router-dom'; // Import useNavigate

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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  const insuranceFileInputRef = React.useRef<HTMLInputElement>(null);
  const webcamRef = React.useRef<Webcam>(null); // <-- Ref for webcam
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrResultText, setOcrResultText] = useState<string | null>(null);
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

  // --- Handle Add/Update Medical History Item (including Allergies) --- 
  const handleAddHistoryItem = async () => {
    const key = allergyNameInput.trim(); // Use name input as the key
    const value = allergyDescInput.trim(); // Use description input as the value

    if (!key) { // Require a key/name
      setHistoryUpdateError("Item name/key cannot be empty.");
      return;
    }
    if (!fullPatientData?.id) {
      setHistoryUpdateError("Cannot update history: Patient data not fully loaded.");
      return;
    }

    setUpdatingHistory(true);
    setHistoryUpdateError(null);
    setSuccessMessage(null); // Clear previous success

    try {
      // Clone existing medical history or initialize if null/undefined/not an object
      let currentHistory: Record<string, JSONValue> = {};
      if (fullPatientData.medical_history &&
        typeof fullPatientData.medical_history === 'object' &&
        !Array.isArray(fullPatientData.medical_history) &&
        fullPatientData.medical_history !== null) {
        currentHistory = JSON.parse(JSON.stringify(fullPatientData.medical_history));
      }

      // Add/update the key-value pair directly in the history object
      currentHistory[key] = value || 'N/A'; // Assign value, default to 'N/A' if empty

      // Update the database
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
      setAllergyNameInput(''); // Clear the name input field
      setAllergyDescInput(''); // Clear the description input field
      setSuccessMessage("Medical history updated successfully!"); // Set success
      setTimeout(() => setSuccessMessage(null), 3000); // Clear after 3s

    } catch (err: any) {
      console.error("Error updating medical history:", err);
      setHistoryUpdateError(`Failed to update history: ${err.message}`);
    } finally {
      setUpdatingHistory(false);
    }
  };
  // --- End Handle Add History Item ---

  // --- Handle Save Insurance (Manual) ---
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
      setOcrResultText(result.extractedText || "No text extracted.");
      setSuccessMessage("OCR complete. Review the extracted text and manually update fields if needed."); // Set success

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
    return <div className="container mx-auto px-4 py-16 text-center text-white"><FaSpinner className="animate-spin inline-block mr-3 h-6 w-6" /> Loading patient data...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-16 text-center text-red-400">Error: {error}</div>;
  }

  // Use the fully fetched patient data for rendering checks and display
  if (!fullPatientData) {
    return <div className="container mx-auto px-4 py-16 text-center text-white">No patient data found or user is not a patient.</div>;
  }

  // Use fullPatientData for rendering details now
  console.log("Rendering PatientProfilePage with fullPatientData:", fullPatientData);
  return (
    <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
      <h1 className="text-3xl sm:text-4xl font-bold text-white mb-10 text-center">Patient Information</h1>

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
        {successMessage && (
          <div className="flex items-center bg-green-900/60 border border-green-700 text-green-200 px-4 py-3 rounded-lg relative animate-fade-in">
            <FaCheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
            <span className="block sm:inline text-sm">{successMessage}</span>
          </div>
        )}
      </div>

      {/* --- Single Column Layout --- */}
      <div className="flex flex-col space-y-8">

        {/* --- Profile Card --- */}
        <div className="bg-dark-card p-6 rounded-xl shadow-lg border border-border-color flex flex-col sm:flex-row items-center text-center sm:text-left space-y-4 sm:space-y-0 sm:space-x-6 animate-fade-in transition duration-300 hover:shadow-pastel-glow-sm">
          {/* Profile Picture & Change Button */}
          <div className="flex-shrink-0 mb-4 sm:mb-0 relative group w-32 h-32 sm:w-24 sm:h-24">
            {authProfile?.profilePictureUrl ? (
              <img src={authProfile.profilePictureUrl} alt="Profile" className="w-full h-full rounded-full object-cover border-4 border-pastel-lavender/50 shadow-md" />
            ) : (
              <div className="w-full h-full rounded-full bg-dark-input flex items-center justify-center border-4 border-border-color text-off-white/30"><FaUserCircle className="h-16 w-16 sm:h-20 sm:h-20" /></div>
            )}
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer">
              <div className="text-center">
                <FaEdit className="h-5 w-5 text-white mx-auto mb-1" />
                <span className="text-white text-xs font-medium">{uploading ? 'Uploading...' : 'Change'}</span>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleProfilePictureUpload} accept="image/png, image/jpeg, image/gif" className="sr-only" disabled={uploading} />
            </label>
          </div>
          {/* Basic Info */}
          <div className="flex-grow">
            <p className="text-2xl font-semibold text-white mb-1">{fullPatientData.username || 'N/A'}</p>
            <p className="text-sm text-off-white/60">
              Joined: {fullPatientData.created_at ? new Date(fullPatientData.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
          {/* Navigation Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:ml-auto">
            <button
              onClick={() => navigate('/patient/prescriptions')}
              className="flex items-center justify-center px-4 py-2 border border-electric-blue/60 text-electric-blue rounded-md hover:bg-electric-blue/10 transition text-sm font-medium whitespace-nowrap">
              <FaFileMedicalAlt className="mr-2 h-4 w-4" /> View Prescriptions
            </button>
            <button
              onClick={() => navigate('/patient/visits')}
              className="flex items-center justify-center px-4 py-2 border border-pastel-lavender/60 text-pastel-lavender rounded-md hover:bg-pastel-lavender/10 transition text-sm font-medium whitespace-nowrap">
              <FaCalendarCheck className="mr-2 h-4 w-4" /> View Visits
            </button>
          </div>
        </div>

        {/* --- Medical & Insurance Card --- */}
        <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-xl sm:text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Medical History & Insurance</h2>

          {/* --- Medical History Section (Content remains the same) --- */}
          <div className="mb-8">
            {/* ... (Existing Medical History display and input form) ... */}
            <h3 className="text-lg font-semibold text-pastel-lavender mb-4">Medical History & Allergies</h3>
            {/* Display */}
            <div className="text-sm bg-dark-input p-4 rounded-lg border border-border-color/50 space-y-3 mb-6 min-h-[60px]">
              {fullPatientData.medical_history &&
                typeof fullPatientData.medical_history === 'object' &&
                fullPatientData.medical_history !== null &&
                !Array.isArray(fullPatientData.medical_history) &&
                Object.keys(fullPatientData.medical_history).length > 0 ? (
                Object.entries(fullPatientData.medical_history).map(([key, value]) => (
                  <dl key={key} className="flex flex-col sm:flex-row sm:justify-between sm:items-start py-1 border-b border-border-color/20 last:border-b-0">
                    <dt className="font-medium capitalize text-off-white/80 w-full sm:w-1/3 mr-2 flex-shrink-0 break-words">{key.replace(/_/g, ' ')}:</dt>
                    <dd className="text-off-white text-left sm:text-right flex-grow break-words mt-1 sm:mt-0">{typeof value === 'string' ? value : JSON.stringify(value)}</dd>
                  </dl>
                ))
              ) : (
                <p className="text-sm text-off-white/60 italic py-2">No medical history or allergy information provided.</p>
              )}
            </div>
            {/* Input */}
            <div className="mt-4 p-4 bg-dark-input/30 border border-border-color/30 rounded-lg space-y-3">
              <label className="block text-sm font-medium text-off-white/90">
                Add/Update History Item (Condition, Allergy, etc.)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  id="allergyNameInput"
                  type="text"
                  value={allergyNameInput}
                  onChange={(e) => setAllergyNameInput(e.target.value)}
                  placeholder="Item Name (e.g., Penicillin)"
                  className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue text-sm transition duration-150"
                  disabled={updatingHistory}
                />
                <input
                  id="allergyDescInput"
                  type="text"
                  value={allergyDescInput}
                  onChange={(e) => setAllergyDescInput(e.target.value)}
                  placeholder="Description/Details (e.g., Rash)"
                  className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue text-sm transition duration-150"
                  disabled={updatingHistory}
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleAddHistoryItem}
                  disabled={updatingHistory || !allergyNameInput.trim()}
                  className="flex items-center justify-center px-4 py-2 min-w-[120px] bg-electric-blue/80 hover:bg-electric-blue text-white rounded-md text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 shadow"
                >
                  {updatingHistory ? <FaSpinner className="animate-spin mr-2 h-4 w-4" /> : <FaPlus className="mr-1.5 h-4 w-4" />} Add / Update
                </button>
              </div>
            </div>
          </div>{/* End Medical History Section */}

          {/* --- Insurance Details Section (Content remains the same) --- */}
          <div className="pt-8 border-t border-border-color">
            {/* ... (Existing Insurance display, input, and OCR sections) ... */}
            <h3 className="text-lg font-semibold text-pastel-lavender mb-4">Insurance Details</h3>
            {/* Display */}
            <div className="text-sm bg-dark-input p-4 rounded-lg border border-border-color/50 space-y-3 mb-6 min-h-[60px]">
              {fullPatientData.insurance_details &&
                typeof fullPatientData.insurance_details === 'object' &&
                fullPatientData.insurance_details !== null &&
                Object.keys(fullPatientData.insurance_details).length > 0 ? (
                Object.entries(fullPatientData.insurance_details).map(([key, value]) => (
                  <dl key={key} className="flex flex-col sm:flex-row sm:justify-between sm:items-start py-1 border-b border-border-color/20 last:border-b-0">
                    <dt className="font-medium capitalize text-off-white/80 w-full sm:w-1/3 mr-2 flex-shrink-0 break-words">{key.replace(/_/g, ' ')}:</dt>
                    <dd className="text-off-white text-left sm:text-right flex-grow break-words mt-1 sm:mt-0">{String(value) || 'N/A'}</dd>
                  </dl>
                ))
              ) : (
                <p className="text-sm text-off-white/60 italic py-2">No insurance details provided.</p>
              )}
            </div>
            {/* Manual Input */}
            <div className="space-y-3 mb-6 p-4 bg-dark-input/30 border border-border-color/30 rounded-lg">
              <label className="block text-sm font-medium text-off-white/90 mb-1">
                Update Insurance Details Manually
              </label>
              <div>
                <label htmlFor="insuranceProvider" className="block text-xs font-medium text-off-white/80 mb-1">Provider Name</label>
                <input
                  id="insuranceProvider"
                  type="text"
                  value={insuranceProvider}
                  onChange={(e) => setInsuranceProvider(e.target.value)}
                  placeholder="Insurance Company Name"
                  className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue text-sm transition duration-150"
                  disabled={updatingInsurance}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="policyNumber" className="block text-xs font-medium text-off-white/80 mb-1">Policy/Member Number</label>
                  <input
                    id="policyNumber"
                    type="text"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    placeholder="Policy or Member ID"
                    className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue text-sm transition duration-150"
                    disabled={updatingInsurance}
                  />
                </div>
                <div>
                  <label htmlFor="groupNumber" className="block text-xs font-medium text-off-white/80 mb-1">Group Number (Optional)</label>
                  <input
                    id="groupNumber"
                    type="text"
                    value={groupNumber}
                    onChange={(e) => setGroupNumber(e.target.value)}
                    placeholder="Group Number"
                    className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-electric-blue focus:ring-1 focus:ring-electric-blue text-sm transition duration-150"
                    disabled={updatingInsurance}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  onClick={handleSaveInsurance}
                  disabled={updatingInsurance || !insuranceProvider.trim() || !policyNumber.trim()}
                  className="flex items-center justify-center px-4 py-2 min-w-[120px] bg-pastel-blue/80 hover:bg-pastel-blue text-dark-bg rounded-md text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition duration-150 shadow"
                >
                  {updatingInsurance ? <FaSpinner className="animate-spin mr-2 h-4 w-4" /> : <FaPlus className="mr-1.5 h-4 w-4" />} Save Details
                </button>
              </div>
            </div>
            {/* OCR Section */}
            <div className="mt-6 pt-6 border-t border-border-color/50">
              <h4 className="text-md font-semibold text-pastel-lavender/90 mb-3">Or Upload/Scan Card</h4>
              {/* Camera View (Conditional) */}
              {showCamera && (
                <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4 animate-fade-in">
                  <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" width={640} height={480} videoConstraints={{ width: 1280, height: 720, facingMode: facingMode }} className="rounded-lg border-4 border-electric-blue mb-4 max-w-full h-auto shadow-lg" />
                  <div className="flex space-x-4">
                    <button onClick={handleCapture} className="px-6 py-3 bg-electric-blue text-white rounded-lg font-semibold text-lg shadow hover:bg-electric-blue/90 transition">Capture Photo</button>
                    <button onClick={handleCloseCamera} className="px-4 py-2 bg-gray-600 text-white rounded-lg shadow hover:bg-gray-700 transition">Cancel</button>
                  </div>
                </div>
              )}
              {/* OCR Buttons (when camera off) */}
              {!showCamera && (
                <div className="flex items-center flex-wrap gap-3 mb-3">
                  <input type="file" accept="image/*" ref={insuranceFileInputRef} onChange={handleInsuranceOcrUpload} className="hidden" disabled={ocrLoading || showCamera} />
                  <button onClick={() => insuranceFileInputRef.current?.click()} disabled={ocrLoading || showCamera} className="flex items-center px-4 py-2 bg-dark-input hover:bg-dark-card border border-border-color/70 text-off-white/90 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition duration-150">
                    {ocrLoading && !showCamera ? <FaSpinner className="animate-spin mr-2" /> : <FaCamera className="mr-1.5" />} Choose Image
                  </button>
                  <button onClick={() => handleOpenCamera('environment')} disabled={ocrLoading || showCamera} className="flex items-center px-4 py-2 bg-dark-input hover:bg-dark-card border border-border-color/70 text-off-white/90 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition duration-150">
                    <FaCamera className="mr-1.5" /> Scan with Camera
                  </button>
                </div>
              )}
              {/* OCR Status/Result */}
              {ocrLoading && <p className="text-sm text-pastel-blue mb-2 flex items-center"><FaSpinner className="animate-spin mr-2" /> Processing OCR...</p>}
              {ocrError && <p className="text-red-400 text-xs mb-2">{ocrError}</p>}
              {ocrResultText && (
                <div className="mt-4">
                  <label htmlFor="ocrResult" className="block text-xs font-medium text-off-white/80 mb-1">Extracted Text (Review & Copy to fields above)</label>
                  <textarea
                    id="ocrResult"
                    readOnly
                    value={ocrResultText}
                    rows={5}
                    className="w-full px-3 py-2 rounded-lg bg-dark-input border border-border-color/70 text-off-white/90 text-xs font-mono focus:ring-1 focus:ring-electric-blue focus:border-electric-blue"
                  />
                </div>
              )}
            </div>{/* End OCR Section */}
          </div>{/* End Insurance Details Section */}
        </div>{/* End Medical & Insurance Card */}

      </div>{/* End Single Column Layout */}

    </div>
  );
};

export default PatientProfilePage; 