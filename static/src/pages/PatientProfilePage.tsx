import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
// We might not need the User type from supabase-js directly anymore
// import { User } from '@supabase/supabase-js'; 
import { Patient, Prescription, Visit } from '../types/app'; // Import types
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { FaUserCircle } from 'react-icons/fa';
import jsPDF from 'jspdf'; // <-- Import jsPDF
import autoTable from 'jspdf-autotable'; // <-- Import autoTable

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
              .order('created_at', { ascending: false }),
            supabase
              .from('visits')
              .select(`
                          *,
                          clinicians: clinician_id ( username )
                      `)
              .eq('patient_id', patientId)
              .order('visit_date', { ascending: false })
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

        {/* History/Insurance Card */}
        <div className="lg:col-span-2 bg-dark-card p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Medical & Insurance Details</h2>
          <div className="space-y-8">
            {/* Medical History */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium text-pastel-lavender">Medical History & Allergens</h3>
              </div>
              {fullPatientData.medical_history && typeof fullPatientData.medical_history === 'object' && Object.keys(fullPatientData.medical_history).length > 0 ? (
                <div className="text-sm bg-dark-input p-5 rounded-lg border border-border-color/50 space-y-3">
                  {Object.entries(fullPatientData.medical_history).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-medium capitalize text-off-white/70">{key.replace(/_/g, ' ')}:</span>
                      <span className="text-off-white text-right">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-off-white/50 italic bg-dark-input p-5 rounded-lg border border-border-color/50">No medical history provided.</p>
              )}
            </div>

            {/* Insurance Details - Restore this section */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-medium text-pastel-lavender">Insurance Details</h3>
                {/* Placeholder button for potential future use */}
                {/* <button onClick={handleAddInsurance} className="...">Update</button> */}
              </div>
              {/* Render insurance details similarly to medical history */}
              {fullPatientData.insurance_details && typeof fullPatientData.insurance_details === 'object' && Object.keys(fullPatientData.insurance_details).length > 0 ? (
                <div className="text-sm bg-dark-input p-5 rounded-lg border border-border-color/50 space-y-3">
                  {Object.entries(fullPatientData.insurance_details).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="font-medium capitalize text-off-white/70">{key.replace(/_/g, ' ')}:</span>
                      <span className="text-off-white text-right">{String(value)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-off-white/50 italic bg-dark-input p-5 rounded-lg border border-border-color/50">No insurance details provided.</p>
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
  );
};

export default PatientProfilePage; 