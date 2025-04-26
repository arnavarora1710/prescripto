import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { supabase } from '../lib/supabaseClient';
// import { User } from '@supabase/supabase-js'; // Remove unused import
import { Clinician, Visit, Patient } from '../types/app'; // Import types
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { FaUserCircle } from 'react-icons/fa'; // Import icon

// Helper type for patient details needed on dashboard
// Assuming Patient type already includes medical_history: any or JSONValue
type PatientSummary = Pick<Patient, 'id' | 'user_id' | 'medical_history' | 'profile_picture_url'> & { 
    email: string | undefined 
};

// Define type for the expected RPC response structure
interface ClinicianDashboardData {
  recent_visits: (Visit & { patient_email?: string })[];
  associated_patients: PatientSummary[]; // Use updated PatientSummary
}

const ClinicianDashboardPage: React.FC = () => {
  const { 
      profile: authProfile,
      loading: authLoading,
      error: authError,
      refreshProfile,
      updateProfile
  } = useAuth();
  const navigate = useNavigate(); // Initialize useNavigate

  const clinician = authProfile?.role === 'clinician' ? authProfile as unknown as Clinician : null;
  
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [errorData, setErrorData] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loading = authLoading;
  const error = authError || errorData;

  useEffect(() => {
    console.log("ClinicianDashboard Effect: Running with authLoading:", authLoading, "authProfile:", authProfile);

    if (!authLoading && authProfile?.role === 'clinician' && authProfile.profileId && recentVisits.length === 0) {
      const currentClinicianId = authProfile.profileId;

      const fetchData = async () => {
          setErrorData(null);
          try {
              console.log(`Fetching dashboard data for clinician: ${currentClinicianId}`);
              // @ts-expect-error - Assuming RPC call is correct
              const { data: dashboardData, error: rpcError } = await supabase.rpc<ClinicianDashboardData>(
                  'get_clinician_dashboard_data',
                  { p_clinician_id: currentClinicianId }
              );
              console.log("RPC Result:", { dashboardData, rpcError });

              if (rpcError) throw rpcError;
              if (!dashboardData) throw new Error("RPC returned no data.");

              console.log("Data from RPC before setting state:", JSON.stringify(dashboardData));
              setPatients(dashboardData.associated_patients || []);
              setRecentVisits(dashboardData.recent_visits || []);
              console.log("Attempted to set recentVisits state with:", JSON.stringify(dashboardData.recent_visits || []));

          } catch (err: any) {
              console.error("Error fetching clinician dashboard data:", err);
              setErrorData(err.message || "Failed to fetch clinician data.");
          } 
      };
      
      console.log("ClinicianDashboard Effect: Conditions met, calling fetchData...");
      fetchData();

    } else if (!authLoading && authProfile && authProfile.role !== 'clinician') {
        setErrorData("Logged in user is not a clinician.");
    } else if (!authLoading && !authProfile) {
        setErrorData("Clinician profile not found.");
    } else {
        console.log(`ClinicianDashboard Effect: Conditions not met. authLoading: ${authLoading}, Has profile: ${!!authProfile}, Is clinician: ${authProfile?.role === 'clinician'}, Visits loaded: ${recentVisits.length > 0}`);
    }
  }, [authProfile?.profileId, authLoading, recentVisits.length]);

  const handleFileSelectClick = () => {
      fileInputRef.current?.click();
  };

  const handleProfilePictureUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      setUploading(true);
      setUploadError(null);
      try {
          if (!event.target.files || event.target.files.length === 0) {
              throw new Error('You must select an image to upload.');
          }
          if (!authProfile || !authProfile.userId || !authProfile.profileId) { 
              throw new Error('Clinician profile not loaded or missing IDs.');
          }

          const file = event.target.files[0];
          const fileExt = file.name.split('.').pop();
          const fileName = `${authProfile.userId}-${Date.now()}.${fileExt}`;
          const filePath = `private/${fileName}`;

          console.log(`Uploading clinician picture to path: ${filePath}`);
          const { error: uploadErr } = await supabase.storage
              .from('profile-pictures')
              .upload(filePath, file, { upsert: true });
          if (uploadErr) throw new Error(`Storage Error: ${uploadErr.message}`);
          console.log("Clinician picture Storage Upload Successful");

          const expiresIn = 60 * 60 * 24 * 365;
          const { data: urlData, error: urlErr } = await supabase.storage
              .from('profile-pictures')
              .createSignedUrl(filePath, expiresIn);
          if (urlErr) throw new Error('Failed to create signed URL.');
          const signedUrl = urlData?.signedUrl;
          if (!signedUrl) throw new Error('Signed URL was unexpectedly null.');
          console.log("Clinician picture Signed URL:", signedUrl);

          console.log(`Attempting to update clinician profile ID: ${authProfile.profileId}`);
          const { data: updatedData, error: dbErr } = await supabase
              .from('clinicians')
              .update({ profile_picture_url: signedUrl })
              .eq('id', authProfile.profileId)
              .select()
              .maybeSingle();
          console.log("Clinician DB Update Result:", { updatedData, dbErr });
          if (dbErr) throw new Error(`DB Update Error: ${dbErr.message}`);
          if (!updatedData) console.error("Clinician DB Update returned no data. RLS issue or incorrect ID?");

          console.log("Optimistically updating profile context for clinician...");
          updateProfile({ profilePictureUrl: signedUrl });

          console.log("Triggering delayed background refresh for clinician...");
          setTimeout(() => {
              console.log("Executing delayed refreshProfile for clinician...");
              refreshProfile();
          }, 1500);

          alert("Clinician profile picture updated successfully!");

      } catch (error: any) {
          console.error("Clinician profile upload error:", error);
          setUploadError(error.message || 'An unknown error occurred.');
      } finally {
          setUploading(false);
          if(fileInputRef.current) fileInputRef.current.value = "";
      }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center text-white">Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;
  }

  if (!clinician) {
     return <div className="container mx-auto px-4 py-8 text-center text-white">No clinician data found.</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-bold text-electric-blue mb-4">Clinician Dashboard</h1>
      {uploadError && <p className="text-red-500 text-center mb-4 text-sm">Upload Error: {uploadError}</p>}

      <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-off-white/10 mb-6 flex items-center space-x-4">
         <div className="flex-shrink-0">
            {console.log('Clinician PFP URL Check:', authProfile?.profilePictureUrl)}
            {authProfile?.profilePictureUrl ? (
               <img 
                   src={authProfile.profilePictureUrl}
                   alt="Profile" 
                   className="h-20 w-20 rounded-full object-cover border-2 border-electric-blue/70"
               />
            ) : (
               <div className="h-20 w-20 rounded-full bg-dark-input flex items-center justify-center border-2 border-off-white/20">
                   <FaUserCircle className="h-16 w-16 text-off-white/40" />
               </div>
            )}
            <input 
               type="file"
               ref={fileInputRef}
               onChange={handleProfilePictureUpload}
               accept="image/png, image/jpeg, image/gif"
               style={{ display: 'none' }}
               disabled={uploading}
            />
            <button
               onClick={handleFileSelectClick}
               disabled={uploading}
               className="mt-2 block w-full text-center px-3 py-1 text-xs border border-electric-blue/50 text-electric-blue rounded hover:bg-electric-blue/10 transition disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {uploading ? 'Uploading...' : 'Change'}
            </button>
         </div>
         <div>
             <p className="text-lg text-off-white/80 font-semibold">Welcome, {clinician.email || 'Clinician'}!</p>
             <p className="text-sm text-off-white/60">ID: {clinician.id}</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-dark-card p-6 rounded-lg shadow-lg border border-off-white/10 relative">
          <h2 className="text-xl font-semibold text-electric-blue/90 mb-4">Your Patients ({patients.length})</h2>
          {patients.length > 0 ? (
            <ul className="space-y-1 max-h-96 overflow-y-auto pr-2">
              {patients.map((p) => {
                  return (
                      <li 
                          key={p.id} 
                          className="text-off-white/80 hover:bg-dark-hover/50 cursor-pointer p-1.5 rounded flex items-center space-x-2 transition-colors duration-150"
                          onClick={() => {
                              console.log(`Navigating to patient details for: ${p.id}`);
                              navigate(`/clinician/patient/${p.id}`); // Navigate on click
                          }}
                      >
                          {p.profile_picture_url ? (
                              <img 
                                  src={p.profile_picture_url}
                                  alt={`Profile of ${p.email || 'patient'}`}
                                  className="h-6 w-6 rounded-full object-cover flex-shrink-0"
                              />
                          ) : (
                              <FaUserCircle className="h-6 w-6 text-off-white/40 flex-shrink-0" />
                          )}
                          <span className="truncate">{p.email || `Patient ID: ${p.id.substring(0, 8)}...`}</span>
                      </li>
                  );
              })}
            </ul>
          ) : (
            <p className="text-off-white/70">No patients found yet.</p>
          )}
        </div>

        <div className="lg:col-span-2 bg-dark-card p-6 rounded-lg shadow-lg border border-off-white/10">
          <h2 className="text-xl font-semibold text-electric-blue/90 mb-4">Recent Visits</h2>
           {recentVisits.length > 0 ? (
            <ul className="space-y-4">
              {recentVisits.map((visit) => (
                <li key={visit.id} className="border-b border-off-white/10 pb-3 last:border-b-0">
                  <p className="font-semibold text-off-white/90">Patient: {(visit as any).patient_email || 'Unknown'}</p>
                  <p className="text-sm text-off-white/70">Date: {new Date(visit.visit_date).toLocaleString()}</p>
                  <p className="text-sm text-off-white/70">Reason: {visit.reason || 'N/A'}</p>
                  {visit.notes && <p className="text-sm mt-1 text-off-white/60 italic">Notes: {visit.notes}</p>}
                 </li>
              ))}
            </ul>
          ) : (
            <p className="text-off-white/70">No recent visits found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicianDashboardPage; 