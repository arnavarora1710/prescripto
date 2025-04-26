import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
// We might not need the User type from supabase-js directly anymore
// import { User } from '@supabase/supabase-js'; 
import { Patient, Prescription, Visit, JSONValue } from '../types/app'; // Import types, including JSONValue
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { FaUserCircle, FaPlus, FaCamera, FaTimes } from 'react-icons/fa';
import jsPDF from 'jspdf'; // <-- Import jsPDF
import autoTable from 'jspdf-autotable'; // <-- Import autoTable
import Webcam from 'react-webcam'; // <-- Import Webcam

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
  // Get profile and refresh function from context
  const {
    profile: authProfile,
    loading: authLoading,
    error: authError,
    refreshProfile, // <-- Get refresh function
    updateProfile   // <-- Get update function
  } = useAuth();

  // State for visits and prescriptions
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
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

  useEffect(() => {
    // Use the profileId from the basic context profile
    const patientId = basicPatientProfile?.profileId;

    if (patientId) {
      const fetchPageData = async () => {
        setLoadingPageData(true);
        setErrorPageData(null);
        setFullPatientData(null); // Reset patient data on new fetch
        try {
          console.log(`PatientProfilePage: Fetching full data for patient ID: ${patientId}`);
          // Fetch full patient details, prescriptions, and visits concurrently
          const [patientRes, prescriptionsRes, visitsRes] = await Promise.all([
            supabase
              .from('patients')
              .select('*') // Fetch all columns for the patient
              .eq('id', patientId)
              .single(), // Expect only one patient record
            supabase
              .from('prescriptions')
              .select(`
                          *,
                          clinicians: clinician_id ( username )
                      `)
              .eq('patient_id', patientId)
              .order('created_at', { ascending: false })
              .limit(5), // <-- Limit prescriptions
            supabase
              .from('visits')
              .select(`
                          *,
                          clinicians: clinician_id ( username )
                      `)
              .eq('patient_id', patientId)
              .order('visit_date', { ascending: false })
              .limit(5) // <-- Limit visits
          ]);

          // Check for errors
          if (patientRes.error) throw new Error(`Patient Fetch Error: ${patientRes.error.message}`);
          if (prescriptionsRes.error) throw new Error(`Prescriptions Fetch Error: ${prescriptionsRes.error.message}`);
          if (visitsRes.error) throw new Error(`Visits Fetch Error: ${visitsRes.error.message}`);

          if (!patientRes.data) throw new Error("Patient record not found.");

          // Set all the fetched data
          console.log("Patient Data:", patientRes.data);
          console.log("Prescriptions Data (with clinician attempt):", prescriptionsRes.data);
          console.log("Visits Data (with clinician attempt):", visitsRes.data);
          setFullPatientData(patientRes.data); // Set the full patient data
          setPrescriptions(prescriptionsRes.data || []);
          setVisits(visitsRes.data || []);

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

      alert("Profile picture updated successfully!");

    } catch (error: any) {
      console.error(error);
      setUploadError(error.message || 'An unknown error occurred during upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };
  // --- End Upload Logic ---

  // --- PDF Generation Function for Patient ---
  const generatePrescriptionPdfForPatient = (prescription: Prescription) => {
    // Use the fullPatientData fetched by the page for patient details
    if (!fullPatientData) {
      console.error("Patient data is not loaded, cannot generate PDF.");
      alert("Error: Patient data not available.");
      return;
    }

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    let currentY = 15;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("Prescription Record", pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // Patient & Prescriber Info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const patientInfoX = 15;
    const clinicianInfoX = pageWidth / 2 + 10;
    const infoStartY = currentY;

    doc.setFont('helvetica', 'bold');
    doc.text("Patient:", patientInfoX, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 5;
    doc.text(`Name: ${fullPatientData.username || 'N/A'}`, patientInfoX, currentY);
    // Add DOB if available

    currentY = infoStartY; // Reset Y
    doc.setFont('helvetica', 'bold');
    doc.text("Prescriber:", clinicianInfoX, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 5;
    // Access prescriber name from the joined data on the prescription object
    doc.text(`Name: ${prescription.clinicians?.username || 'Unknown'}`, clinicianInfoX, currentY);
    currentY += 5;
    doc.text(`Date Issued: ${new Date(prescription.created_at).toLocaleDateString()}`, clinicianInfoX, currentY);

    currentY = Math.max(currentY, infoStartY + 15); // Ensure Y is below the info block
    currentY += 5;
    doc.setLineWidth(0.2);
    doc.line(15, currentY, pageWidth - 15, currentY); // Divider
    currentY += 10;

    // Prescription Details Table
    autoTable(doc, {
      startY: currentY,
      head: [['Medication', 'Dosage', 'Frequency']],
      body: [
        [
          prescription.medication || 'N/A',
          prescription.dosage || 'N/A',
          prescription.frequency || 'N/A',
        ],
      ],
      theme: 'grid',
      headStyles: { fillColor: [60, 70, 90] },
      styles: { fontSize: 10, cellPadding: 2 },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        currentY = data.cursor?.y || currentY; // Update Y
      }
    });

    currentY += 10;

    // Notes
    if (prescription.notes) {
      doc.setFont('helvetica', 'bold');
      doc.text("Notes:", 15, currentY);
      currentY += 5;
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(prescription.notes, pageWidth - 30);
      doc.text(notesLines, 15, currentY);
      currentY += notesLines.length * 4;
    }

    // Footer Info (Optional)
    currentY = pageHeight - 15;
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("This is a record of a prescription generated via Prescripto.", pageWidth / 2, currentY, { align: 'center' });

    doc.save(`Prescription_Record_${new Date(prescription.created_at).toISOString().split('T')[0]}.pdf`);
  };
  // --- End PDF Generation Function ---

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
      console.log("Medical history updated successfully");

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
      alert("Insurance details updated successfully!"); // Simple feedback

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
      alert("OCR complete. Review the extracted text and manually update fields if needed.");

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
    return <div className="container mx-auto px-4 py-8 text-center text-white">Loading patient data...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;
  }

  // Use the fully fetched patient data for rendering checks and display
  if (!fullPatientData) {
    return <div className="container mx-auto px-4 py-8 text-center text-white">No patient data found or user is not a patient.</div>;
  }

  // Use fullPatientData for rendering details now
  console.log("Rendering PatientProfilePage with fullPatientData:", fullPatientData);
  return (
    <div className="container mx-auto px-6 lg:px-8 py-12 text-off-white font-sans">
      <h1 className="text-4xl font-bold text-white mb-10 text-center">Patient Profile</h1>
      {uploadError && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6 text-center animate-fade-in">
          <span className="block sm:inline">Upload Error: {uploadError}</span>
        </div>
      )}

      {/* Profile Card Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
        {/* Profile Info Card */}
        <div className="lg:col-span-1 bg-dark-card p-8 rounded-xl shadow-lg border border-border-color flex flex-col items-center animate-fade-in transition duration-300 hover:shadow-pastel-glow-sm">
          {/* Profile Picture Display & Upload */}
          <div className="mb-6 relative group">
            {authProfile?.profilePictureUrl ? (
              <img
                src={authProfile.profilePictureUrl}
                alt="Profile"
                className="h-36 w-36 rounded-full object-cover border-4 border-pastel-lavender shadow-md"
              />
            ) : (
              <div className="h-36 w-36 rounded-full bg-dark-input flex items-center justify-center border-4 border-border-color text-off-white/30">
                <FaUserCircle className="h-28 w-28" />
              </div>
            )}
            {/* Overlay Button */}
            <label className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer">
              <span className="text-white text-sm font-medium">
                {uploading ? 'Uploading...' : 'Change'}
              </span>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleProfilePictureUpload}
                accept="image/png, image/jpeg, image/gif"
                className="sr-only"
                disabled={uploading}
              />
            </label>
          </div>
          {/* Basic Info */}
          <div className="text-center">
            <p className="text-xl font-semibold text-white mb-1">{fullPatientData.username || 'N/A'}</p>
            <p className="text-sm text-off-white/60">
              Joined: {fullPatientData.created_at ? new Date(fullPatientData.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </div>
        </div>

        {/* Combined Medical History & Insurance Card */}
        <div className="lg:col-span-2 bg-dark-card p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Medical & Insurance Details</h2>
          <div className="space-y-8">
            {/* Combined Medical History Display (including allergies) */}
            <div>
              <h3 className="text-lg font-medium text-pastel-lavender mb-3">Medical History & Allergies</h3>
              <div className="text-sm bg-dark-input p-5 rounded-lg border border-border-color/50 space-y-3 mb-6">
                {fullPatientData.medical_history &&
                  typeof fullPatientData.medical_history === 'object' &&
                  fullPatientData.medical_history !== null &&
                  !Array.isArray(fullPatientData.medical_history) && // Ensure it's an object
                  Object.keys(fullPatientData.medical_history).length > 0 ? (
                  Object.entries(fullPatientData.medical_history).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-medium capitalize text-off-white/70">{key.replace(/_/g, ' ')}:</span>
                      {/* Display value, handle potential non-string values gracefully */}
                      <span className="text-off-white text-right">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-off-white/50 italic">No medical history or allergy information provided.</p>
                )}
              </div>

              {/* Add/Update History Item Input */}
              <div className="mt-4 space-y-2">
                <label className="block text-sm font-medium text-off-white/70 mb-1">
                  Add/Update History Item (Condition, Allergy, etc.)
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input
                    id="allergyNameInput" // Keeping ID same for now
                    type="text"
                    value={allergyNameInput}
                    onChange={(e) => setAllergyNameInput(e.target.value)}
                    placeholder="Item Name (e.g., Penicillin, Hypertension)"
                    className="px-3 py-1.5 rounded-md bg-dark-card border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-transparent transition duration-150 text-sm"
                    disabled={updatingHistory}
                  />
                  <input
                    id="allergyDescInput" // Keeping ID same for now
                    type="text"
                    value={allergyDescInput}
                    onChange={(e) => setAllergyDescInput(e.target.value)}
                    placeholder="Description/Details (e.g., Rash, Diagnosed 2020)"
                    className="px-3 py-1.5 rounded-md bg-dark-card border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-transparent transition duration-150 text-sm"
                    disabled={updatingHistory}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={handleAddHistoryItem}
                    disabled={updatingHistory || !allergyNameInput.trim()}
                    className="px-3 py-1.5 bg-electric-blue/20 text-electric-blue hover:bg-electric-blue/30 border border-electric-blue/50 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 flex items-center"
                  >
                    <FaPlus className="mr-1.5 h-3 w-3" /> Add / Update
                  </button>
                </div>
                {historyUpdateError && <p className="text-red-400 text-xs mt-1">{historyUpdateError}</p>}
              </div>
            </div>

            {/* Insurance Details Section */}
            <div>
              <h3 className="text-lg font-medium text-pastel-lavender mb-3">Insurance Details</h3>

              {/* Display Existing/Saved Insurance */}
              <div className="text-sm bg-dark-input p-5 rounded-lg border border-border-color/50 space-y-3 mb-6">
                {fullPatientData.insurance_details &&
                  typeof fullPatientData.insurance_details === 'object' &&
                  fullPatientData.insurance_details !== null &&
                  Object.keys(fullPatientData.insurance_details).length > 0 ? (
                  Object.entries(fullPatientData.insurance_details).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-medium capitalize text-off-white/70">{key.replace(/_/g, ' ')}:</span>
                      <span className="text-off-white text-right">{String(value) || 'N/A'}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-off-white/50 italic">No insurance details provided.</p>
                )}
              </div>

              {/* Manual Input Fields */}
              <div className="space-y-3 mb-4">
                <div>
                  <label htmlFor="insuranceProvider" className="block text-xs font-medium text-off-white/70 mb-1">Provider Name</label>
                  <input
                    id="insuranceProvider"
                    type="text"
                    value={insuranceProvider}
                    onChange={(e) => setInsuranceProvider(e.target.value)}
                    placeholder="e.g., Blue Cross"
                    className="w-full px-3 py-1.5 rounded-md bg-dark-card border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-transparent transition duration-150 text-sm"
                    disabled={updatingInsurance}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="policyNumber" className="block text-xs font-medium text-off-white/70 mb-1">Policy/Member Number</label>
                    <input
                      id="policyNumber"
                      type="text"
                      value={policyNumber}
                      onChange={(e) => setPolicyNumber(e.target.value)}
                      placeholder="e.g., X123456789"
                      className="w-full px-3 py-1.5 rounded-md bg-dark-card border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-transparent transition duration-150 text-sm"
                      disabled={updatingInsurance}
                    />
                  </div>
                  <div>
                    <label htmlFor="groupNumber" className="block text-xs font-medium text-off-white/70 mb-1">Group Number (Optional)</label>
                    <input
                      id="groupNumber"
                      type="text"
                      value={groupNumber}
                      onChange={(e) => setGroupNumber(e.target.value)}
                      placeholder="e.g., G9876"
                      className="w-full px-3 py-1.5 rounded-md bg-dark-card border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-1 focus:ring-electric-blue focus:border-transparent transition duration-150 text-sm"
                      disabled={updatingInsurance}
                    />
                  </div>
                </div>
                {insuranceUpdateError && <p className="text-red-400 text-xs mt-1">{insuranceUpdateError}</p>}
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveInsurance}
                    disabled={updatingInsurance}
                    className="px-4 py-1.5 bg-pastel-blue/20 text-pastel-blue hover:bg-pastel-blue/30 border border-pastel-blue/50 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 flex items-center"
                  >
                    {updatingInsurance ? 'Saving...' : 'Save Manual Details'}
                  </button>
                </div>
              </div>

              {/* OCR Section */}
              <div className="mt-6 pt-6 border-t border-border-color/50">
                <h4 className="text-md font-medium text-pastel-lavender/90 mb-3">Upload/Scan Card for OCR</h4>
                {/* --- Camera View (Conditional) --- */}
                {showCamera && (
                  <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 p-4 animate-fade-in">
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      width={640} // Adjust width as needed
                      height={480} // Adjust height as needed
                      videoConstraints={{
                        width: 1280,
                        height: 720,
                        facingMode: facingMode
                      }}
                      className="rounded-lg border-4 border-electric-blue mb-4 max-w-full h-auto"
                    />
                    <div className="flex space-x-4">
                      <button onClick={handleCapture} className="px-6 py-3 bg-electric-blue text-white rounded-lg font-semibold text-lg">
                        Capture Photo
                      </button>
                      <button onClick={handleCloseCamera} className="px-4 py-2 bg-gray-600 text-white rounded-lg">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {/* --- End Camera View --- */}

                {!showCamera && (
                  <div className="flex items-center flex-wrap gap-3 mb-3">
                    {/* File Upload Button */}
                    <input
                      type="file"
                      accept="image/*"
                      ref={insuranceFileInputRef}
                      onChange={handleInsuranceOcrUpload}
                      className="hidden"
                      disabled={ocrLoading || showCamera}
                    />
                    <button
                      onClick={() => insuranceFileInputRef.current?.click()}
                      disabled={ocrLoading || showCamera}
                      className="px-4 py-1.5 bg-dark-input hover:bg-dark-card border border-off-white/30 text-off-white/90 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 flex items-center"
                    >
                      {ocrLoading && !showCamera ? 'Processing...' : <><FaCamera className="mr-1.5" /> Choose Image File</>}
                    </button>

                    {/* Camera Buttons */}
                    <button
                      onClick={() => handleOpenCamera('environment')} // Back camera
                      disabled={ocrLoading || showCamera}
                      className="px-4 py-1.5 bg-dark-input hover:bg-dark-card border border-off-white/30 text-off-white/90 rounded-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 flex items-center"
                    >
                      <FaCamera className="mr-1.5" /> Scan with Camera
                    </button>
                    {/* Optional: Add button for front camera if needed */}
                    {/* <button onClick={() => handleOpenCamera('user')} ... >Scan with Front Camera</button> */}
                  </div>
                )}

                {ocrLoading && <p className="text-sm text-pastel-blue mb-2">Processing OCR...</p>}
                {ocrError && <p className="text-red-400 text-xs mb-2">{ocrError}</p>}

                {ocrResultText && (
                  <div className="mt-4">
                    <label htmlFor="ocrResult" className="block text-xs font-medium text-off-white/70 mb-1">Extracted Text (Review & Copy)</label>
                    <textarea
                      id="ocrResult"
                      readOnly
                      value={ocrResultText}
                      rows={5}
                      className="w-full px-3 py-2 rounded-lg bg-dark-input border border-border-color/70 text-off-white/80 placeholder-off-white/50 text-xs"
                      placeholder="Extracted text will appear here..."
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Prescriptions & Visits */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Prescriptions Section */}
          <div className="bg-dark-card p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Prescriptions</h2>
            {prescriptions.length > 0 ? (
              <ul className="space-y-6">
                {prescriptions.map((rx) => (
                  <li key={rx.id} className="border-b border-border-color/70 pb-5 last:border-b-0">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-grow">
                        <p className="font-semibold text-lg text-pastel-blue mb-1">{rx.medication}</p>
                        <p className="text-xs text-off-white/60 mb-1">Prescribed on: {new Date(rx.created_at).toLocaleDateString()}</p>
                        <p className="text-sm text-off-white/80 mb-2">Dosage: {rx.dosage || 'N/A'} | Frequency: {rx.frequency || 'N/A'}</p>
                        {/* Ensure clinician username is accessed correctly */}
                        <p className="text-sm text-off-white/80">Prescriber: {rx.clinicians?.username || 'Unknown'}</p>
                        {rx.notes && (
                          <div className="mt-3 pt-3 border-t border-border-color/50">
                            <p className="text-xs font-medium text-pastel-lavender mb-1">Notes:</p>
                            <p className="text-sm text-off-white/80 italic">{rx.notes}</p>
                          </div>
                        )}
                      </div>
                      {/* Download Button for Patient */}
                      <button
                        onClick={() => generatePrescriptionPdfForPatient(rx)}
                        className="px-3 py-1 mt-1 text-xs border border-electric-blue/50 text-electric-blue rounded-md hover:bg-electric-blue/10 transition flex-shrink-0"
                        title="Download Prescription PDF"
                      >
                        Download PDF
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-off-white/60 text-center py-4">No prescriptions found.</p>
            )}
          </div>

          {/* Visits Section */}
          <div className="bg-dark-card p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <h2 className="text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Visit History</h2>
            {visits.length > 0 ? (
              <ul className="space-y-6">
                {visits.map((visit) => (
                  <li key={visit.id} className="border-b border-border-color/70 pb-5 last:border-b-0">
                    <p className="font-medium text-lg text-pastel-blue mb-1">Visit on {new Date(visit.visit_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    <p className="text-sm text-off-white/80 mb-2">Reason: {visit.reason || 'N/A'}</p>
                    <p className="text-sm text-off-white/80">Clinician: {(visit as any).clinicians?.username || 'Unknown'}</p>
                    {visit.notes && (
                      <div className="mt-3 pt-3 border-t border-border-color/50">
                        <p className="text-xs font-medium text-pastel-lavender mb-1">Notes:</p>
                        <p className="text-sm text-off-white/80 italic whitespace-pre-wrap">{visit.notes}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-off-white/60 text-center py-4">No visit history found.</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default PatientProfilePage; 