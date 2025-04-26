import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
// We might not need the User type from supabase-js directly anymore
// import { User } from '@supabase/supabase-js'; 
import { Patient, Prescription, Visit } from '../types/app'; // Import types
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { FaUserCircle } from 'react-icons/fa';

// Define a type for the expected RPC response structure
interface PatientDataResponse {
  patient: Patient | null; // Patient now includes email from the RPC
  prescriptions: Prescription[];
  visits: Visit[];
  error?: string; // Include error field if RPC returns error object
}

const PatientProfilePage: React.FC = () => {
  // Get profile and refresh function from context
  const { 
      profile: authProfile, 
      loading: authLoading, 
      error: authError, 
      refreshProfile, // <-- Get refresh function
      updateProfile   // <-- Get update function
  } = useAuth(); 

  // State for this page specifically
  // const [patient, setPatient] = useState<Patient | null>(null); // Now comes from authProfile
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loadingData, setLoadingData] = useState(true); // Separate loading for page data
  const [errorData, setErrorData] = useState<string | null>(null);
  
  // State for upload
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Combine auth state with page-specific state
  const patient = authProfile?.role === 'patient' ? authProfile as Patient : null;
  const loading = authLoading || loadingData;
  const error = authError || errorData;

  // Add logging here to check patient data when available
  useEffect(() => {
      if (patient) {
          console.log("Patient data for date check:", patient);
      }
  }, [patient]);

  // Fetch prescriptions and visits (profile comes from context)
  useEffect(() => {
    // Only fetch if we have a patient profile from auth
    if (patient?.profileId) {
      const patientId = patient.profileId; // Use profileId from context
      const fetchPageData = async () => {
          setLoadingData(true);
          setErrorData(null);
          try {
              // Use Promise.all to fetch concurrently
              const [prescriptionsRes, visitsRes] = await Promise.all([
                  supabase
                      .from('prescriptions')
                      .select(`*`) // Fetching emails via RPC now, simplify select
                      .eq('patient_id', patientId)
                      .order('created_at', { ascending: false }),
                  supabase
                      .from('visits')
                      .select(`*`) // Fetching emails via RPC now, simplify select
                      .eq('patient_id', patientId)
                      .order('visit_date', { ascending: false })
              ]);

              if (prescriptionsRes.error) throw prescriptionsRes.error;
              if (visitsRes.error) throw visitsRes.error;

              // TODO: If clinician email is needed, consider adding to RPC or fetching separately
              setPrescriptions(prescriptionsRes.data || []); 
              setVisits(visitsRes.data || []);

          } catch (err: any) {
              console.error("Error fetching patient page data:", err);
              setErrorData(err.message || "Failed to load prescriptions/visits.");
          } finally {
              setLoadingData(false);
          }
      };
       fetchPageData();
    } else if (!authLoading) {
        // If auth is done loading but no patient profile, set page loading false
        setLoadingData(false); 
        if (!patient) {
            // Set an error if the logged-in user isn't a patient
             setErrorData("Logged in user is not a patient or profile is missing.");
        }
    }
  }, [patient?.profileId, authLoading]); // Re-run if patient ID changes or auth finishes loading

  const handleAddInsurance = () => {
    // TODO: Implement OCR logic or manual form for insurance
    alert('OCR for Insurance Details - Placeholder');
  };

  const handleAddMedicalHistory = () => {
    // TODO: Implement OCR logic or manual form for medical history/allergens
    alert('Update Medical History/Allergens - Placeholder');
  };

  // --- Profile Picture Upload Logic ---
  const handleFileSelectClick = () => {
      fileInputRef.current?.click(); // Trigger hidden file input
  };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      setUploading(true);
      setUploadError(null);
      try {
          if (!event.target.files || event.target.files.length === 0) {
              throw new Error('You must select an image to upload.');
          }
          if (!patient) {
              throw new Error('Patient profile not loaded.');
          }

          const file = event.target.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `${patient.userId}-${Date.now()}.${fileExt}`;
          const filePath = `private/${fileName}`;

          console.log(`Uploading to path: ${filePath}`); // Log the path

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
              .from('profile-pictures')
              .upload(filePath, file, { upsert: true });

          if (uploadError) {
              console.error('Storage Upload Error:', uploadError);
              throw new Error(`Storage Error: ${uploadError.message}`); // Include Supabase error
          }
          console.log("Storage Upload Successful");

          // Create a signed URL instead of public URL
          // Set expiration time (e.g., 1 year in seconds)
          const expiresIn = 60 * 60 * 24 * 365; 
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from('profile-pictures')
                .createSignedUrl(filePath, expiresIn);

          if (signedUrlError) {
              console.error("Signed URL Error:", signedUrlError);
              // Attempt to remove the file if URL generation fails?
              // await supabase.storage.from('profile-pictures').remove([filePath]);
              throw new Error('File uploaded, but failed to create signed URL.');
          }
          
          const signedUrl = signedUrlData?.signedUrl;
          console.log("Signed URL:", signedUrl);

          if (!signedUrl) {
              throw new Error('File uploaded, but signed URL was unexpectedly null.');
          }

          // Log the ID being used for the update
          console.log(`Attempting to update patient profile ID: ${patient.profileId}`);

          // Update the patient table AND request the updated row back
          const { data: updatedPatientData, error: dbError } = await supabase
              .from('patients')
              .update({ profile_picture_url: signedUrl }) // Store the signed URL
              .eq('id', patient.profileId)
              .select() // Ask Supabase to return the updated row(s)
              .maybeSingle(); // Expecting one row or null

          // Log the actual result of the update attempt
          console.log("DB Update Result:", { updatedPatientData, dbError });

          if (dbError) {
              // ... handle DB error (maybe remove storage file) ...
              throw new Error(`DB Update Error: ${dbError.message}`);
          }

          // Explicitly check if the update returned data
          if (!updatedPatientData) {
              console.error("DB Update returned no data. RLS issue or incorrect ID?");
              // Optionally throw an error here or set a specific error message
              // throw new Error("Database update failed to return updated profile data.");
          }
          // console.log("DB Update Successful"); // Keep previous log commented out or remove

          // --- OPTIMISTIC UI UPDATE --- 
          console.log("Optimistically updating profile context with new URL...");
          updateProfile({ profilePictureUrl: signedUrl });

          // Refresh Profile in AuthContext (still good practice for consistency)
          console.log("Profile picture updated in DB, triggering delayed background refresh...");
          setTimeout(() => {
              console.log("Executing delayed refreshProfile...");
              refreshProfile();
          }, 1500); // Delay refresh by 1.5 seconds
          
          alert("Profile picture updated successfully!"); 

      } catch (error: any) {
          console.error(error);
          setUploadError(error.message || 'An unknown error occurred during upload.');
      } finally {
          setUploading(false);
          // Reset file input value so the same file can be selected again if needed
          if(fileInputRef.current) {
              fileInputRef.current.value = "";
          }
      }
  };
  // --- End Upload Logic ---

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center text-white">Loading patient data...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;
  }

  if (!patient) {
     return <div className="container mx-auto px-4 py-8 text-center text-white">No patient data found or user is not a patient.</div>;
  }

  // Main return with patient data available
  console.log("Rendering PatientProfilePage with patient:", patient); // Log again just before render
  return (
    <div className="container mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-bold text-electric-blue mb-6">Patient Profile</h1>
      {uploadError && <p className="text-red-500 text-center mb-4 text-sm">Upload Error: {uploadError}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         {/* Profile Info Card */}
        <div className="md:col-span-1 bg-dark-card p-6 rounded-lg shadow-lg border border-off-white/10">
          <h2 className="text-xl font-semibold text-electric-blue/90 mb-4">Your Information</h2>
          {/* Profile Picture Display & Upload */}
          <div className="mb-4 flex flex-col items-center">
             {patient.profilePictureUrl ? (
                <img 
                    src={patient.profilePictureUrl}
                    alt="Profile" 
                    className="h-24 w-24 rounded-full object-cover mb-3 border-2 border-electric-blue/70"
                />
             ) : (
                <div className="h-24 w-24 rounded-full bg-dark-input flex items-center justify-center mb-3 border-2 border-off-white/20">
                    <FaUserCircle className="h-16 w-16 text-off-white/40" />
                </div>
             )}
             <input 
                type="file"
                ref={fileInputRef}
                onChange={handleProfilePictureUpload}
                accept="image/png, image/jpeg, image/gif"
                style={{ display: 'none' }} // Hide the default input
                disabled={uploading}
             />
             <button
                onClick={handleFileSelectClick}
                disabled={uploading}
                className="mt-2 px-4 py-1 text-xs border border-electric-blue/50 text-electric-blue rounded hover:bg-electric-blue/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? 'Uploading...' : 'Change Picture'}
             </button>
          </div>
          {/* End Profile Picture */}
          <p><span className="font-medium text-off-white/70">Email:</span> {patient.email || 'N/A'}</p>
          <p><span className="font-medium text-off-white/70">Joined:</span> {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'N/A'}</p>
          {/* Add other basic profile fields here if needed */}
        </div>

         {/* History/Insurance Card */}
        <div className="md:col-span-2 bg-dark-card p-6 rounded-lg shadow-lg border border-off-white/10">
          <h2 className="text-xl font-semibold text-electric-blue/90 mb-4">Medical & Insurance Details</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium text-off-white/80 mb-2">Medical History & Allergens</h3>
              <pre className="text-xs bg-dark-input p-3 rounded overflow-auto max-h-40 border border-off-white/20">{JSON.stringify(patient.medical_history, null, 2) || 'No data provided.'}</pre>
              <button
                  onClick={handleAddMedicalHistory}
                  className="mt-2 px-3 py-1 text-xs border border-electric-blue/50 text-electric-blue rounded hover:bg-electric-blue/10 transition"
              >
                  Update History/Allergens
              </button>
            </div>
            <div>
              <h3 className="text-lg font-medium text-off-white/80 mb-2">Insurance Details</h3>
              <pre className="text-xs bg-dark-input p-3 rounded overflow-auto max-h-40 border border-off-white/20">{JSON.stringify(patient.insurance_details, null, 2) || 'No data provided.'}</pre>
              <button
                  onClick={handleAddInsurance}
                  className="mt-2 px-3 py-1 text-xs border border-electric-blue/50 text-electric-blue rounded hover:bg-electric-blue/10 transition"
              >
                  Add/Update Insurance (OCR)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Prescriptions Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-electric-blue/90 mb-4">Prescriptions</h2>
        <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-off-white/10">
          {prescriptions.length > 0 ? (
            <ul className="space-y-4">
              {prescriptions.map((rx) => (
                <li key={rx.id} className="border-b border-off-white/10 pb-3 last:border-b-0">
                  <p className="font-semibold text-lg text-off-white/90">{rx.medication}</p>
                  <p className="text-sm text-off-white/70">Dosage: {rx.dosage || 'N/A'} | Frequency: {rx.frequency || 'N/A'}</p>
                  <p className="text-sm text-off-white/70">Prescriber: {rx.clinician_email || 'Unknown'}</p>
                  <p className="text-sm text-off-white/70">Prescribed on: {new Date(rx.created_at).toLocaleDateString()}</p>
                  {rx.notes && <p className="text-sm mt-1 text-off-white/60 italic">Notes: {rx.notes}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-off-white/70">No prescriptions found.</p>
          )}
        </div>
      </div>

      {/* Visits Section */}
      <div>
        <h2 className="text-2xl font-semibold text-electric-blue/90 mb-4">Visit History</h2>
        <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-off-white/10">
          {visits.length > 0 ? (
            <ul className="space-y-4">
              {visits.map((visit) => (
                <li key={visit.id} className="border-b border-off-white/10 pb-3 last:border-b-0">
                  <p className="font-semibold text-lg text-off-white/90">Visit on {new Date(visit.visit_date).toLocaleString()}</p>
                  <p className="text-sm text-off-white/70">Clinician: {visit.clinician_email || 'Unknown'}</p>
                  <p className="text-sm text-off-white/70">Reason: {visit.reason || 'N/A'}</p>
                  {visit.notes && <p className="text-sm mt-1 text-off-white/60 italic">Notes: {visit.notes}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-off-white/70">No visit history found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientProfilePage; 