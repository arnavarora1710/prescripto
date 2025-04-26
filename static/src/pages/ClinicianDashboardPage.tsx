import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import { supabase } from '../lib/supabaseClient';
// import { User } from '@supabase/supabase-js'; // Remove unused import
import { Clinician, Visit, Patient } from '../types/app'; // Import types
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { FaUserCircle } from 'react-icons/fa'; // Import icon

// Helper type for patient details needed on dashboard
// Assuming Patient type already includes medical_history: any or JSONValue
type PatientSummary = Pick<Patient, 'id' | 'user_id' | 'medical_history' | 'profile_picture_url' | 'username'>;

// Define type for the expected RPC response structure
interface ClinicianDashboardData {
  recent_visits: (Visit & { patient_username?: string });
  associated_patients: PatientSummary[];
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

  // Use username from authProfile for welcome message
  const clinicianUsername = authProfile?.username;

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
    <div className="container mx-auto px-6 lg:px-8 py-12 text-off-white font-sans">
      <h1 className="text-4xl font-bold text-white mb-10 text-center">Clinician Dashboard</h1>
      {uploadError && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6 text-center animate-fade-in">
              <span className="block sm:inline">Upload Error: {uploadError}</span>
          </div>
      )}

      <div className="bg-dark-card p-8 rounded-xl shadow-lg border border-border-color mb-12 flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8 animate-fade-in">
         <div className="flex-shrink-0 relative group">
            {authProfile?.profilePictureUrl ? (
               <img 
                   src={authProfile.profilePictureUrl}
                   alt="Profile" 
                   className="h-28 w-28 rounded-full object-cover border-4 border-pastel-lavender shadow-md"
               />
            ) : (
               <div className="h-28 w-28 rounded-full bg-dark-input flex items-center justify-center border-4 border-border-color text-off-white/30"> 
                   <FaUserCircle className="h-20 w-20" />
               </div>
            )}
            
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
         <div className="text-center md:text-left">
             <p className="text-3xl text-white font-semibold mb-1">Welcome, {clinicianUsername || 'Clinician'}!</p>
             <p className="text-base text-off-white/70">Manage your patients and view recent activity.</p>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 bg-dark-card p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Your Patients ({patients.length})</h2>
          {patients.length > 0 ? (
            <ul className="space-y-3 max-h-[calc(100vh-450px)] overflow-y-auto pr-2 custom-scrollbar">
              {patients.map((p) => (
                  <li 
                      key={p.id} 
                      className="text-off-white/90 hover:bg-pastel-lavender/10 hover:text-white cursor-pointer p-4 rounded-lg flex items-center space-x-4 transition duration-200 group"
                      onClick={() => navigate(`/clinician/patient/${p.id}`)}
                  >
                      {p.profile_picture_url ? (
                          <img 
                              src={p.profile_picture_url}
                              alt={`Profile of ${p.username || 'patient'}`}
                              className="h-10 w-10 rounded-full object-cover flex-shrink-0 border-2 border-transparent group-hover:border-pastel-lavender transition-colors"
                          />
                      ) : (
                          <FaUserCircle className="h-10 w-10 text-off-white/40 flex-shrink-0 group-hover:text-pastel-lavender transition-colors" />
                      )}
                      <span className="truncate text-base font-medium">{p.username || `Patient ID: ${p.id.substring(0, 8)}...`}</span>
                  </li>
              ))}
            </ul>
          ) : (
            <p className="text-off-white/60 text-center py-4">No patients assigned yet.</p>
          )}
        </div>

        <div className="lg:col-span-2 bg-dark-card p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Recent Visits</h2>
           {recentVisits.length > 0 ? (
            <ul className="space-y-6">
              {recentVisits.map((visit) => (
                <li key={visit.id} className="border-b border-border-color/70 pb-5 last:border-b-0">
                  <div className="flex justify-between items-baseline mb-2">
                      <p className="font-medium text-base text-pastel-blue">
                          Patient: <span className="font-semibold text-white">{visit.patient_username || 'Unknown'}</span>
                      </p>
                      <p className="text-xs text-off-white/60">
                          {new Date(visit.visit_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                  </div>
                  <p className="text-sm text-off-white/80 mb-3">Reason: {visit.reason || 'N/A'}</p>
                  {visit.notes && (
                      <div className="mt-3 pt-3 border-t border-border-color/50">
                         <p className="text-xs font-medium text-pastel-lavender mb-1">Notes:</p>
                         <p className="text-sm text-off-white/90 italic whitespace-pre-wrap bg-dark-input p-3 rounded-md">{visit.notes}</p>
                      </div>
                  )}
                 </li>
              ))}
            </ul>
          ) : (
            <p className="text-off-white/60 text-center py-4">No recent visits found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicianDashboardPage; 