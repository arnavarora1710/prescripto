import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Import useNavigate and Link
import { supabase } from '../lib/supabaseClient';
// import { User } from '@supabase/supabase-js'; // Remove unused import
import { Clinician, Visit, Patient, Prescription } from '../types/app'; // Import types - Added Prescription
import { useAuth } from '../context/AuthContext'; // Import useAuth
import { FaUserCircle, FaPlus, FaEdit, FaSpinner, FaArrowRight, FaRegCommentDots, FaCalendarAlt, FaAngleRight } from 'react-icons/fa'; // Removed FaSignOutAlt
import { formatDistanceToNow } from 'date-fns'; // For relative time

// Helper type for patient details needed on dashboard
// Assuming Patient type already includes medical_history: any or JSONValue
type PatientSummary = Pick<Patient, 'id' | 'user_id' | 'medical_history' | 'profile_picture_url' | 'username'>;

// Update Visit type locally to ensure prescriptions are included
// Assume patient_username is already part of the base Visit type from the RPC/type definition
interface VisitWithDetails extends Visit {
  prescriptions?: Prescription[];
}

const ClinicianDashboardPage: React.FC = () => {
  const { profile: authProfile, loading: authLoading, error: authError, refreshProfile, updateProfile } = useAuth(); // Removed logout
  const navigate = useNavigate(); // Initialize useNavigate

  const clinician = authProfile?.role === 'clinician' ? (authProfile as unknown as Clinician) : null;

  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [recentVisits, setRecentVisits] = useState<VisitWithDetails[]>([]); // Use updated type
  const [errorData, setErrorData] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loading = authLoading; // Use authLoading directly
  const error = authError || errorData;

  // Use username from authProfile for welcome message
  const clinicianUsername = authProfile?.username;

  useEffect(() => {
    console.log("ClinicianDashboard Effect: Running with authLoading:", authLoading, "authProfile:", authProfile);

    if (!authLoading && authProfile?.role === 'clinician' && authProfile.profileId) {
      const currentClinicianId = authProfile.profileId;

      const fetchData = async () => {
        setErrorData(null);
        try {
          console.log(`Fetching dashboard data for clinician: ${currentClinicianId}`);
          // Adjust the type expected from the RPC call
          // Let TypeScript infer the return type from the RPC definition if possible, remove explicit generic
          const { data: dashboardData, error: rpcError } = await supabase.rpc(
            'get_clinician_dashboard_data',
            { p_clinician_id: currentClinicianId }
          );
          console.log("RPC Result:", { dashboardData, rpcError });

          if (rpcError) throw rpcError;
          if (!dashboardData) throw new Error("RPC returned no data.");

          console.log("Data from RPC before setting state:", JSON.stringify(dashboardData));
          setPatients(dashboardData.associated_patients || []);
          // Ensure recent_visits is treated as VisitWithDetails[]
          // Cast the result to the extended type
          setRecentVisits(dashboardData.recent_visits as VisitWithDetails[] || []);
          console.log("Attempted to set recentVisits state with:", JSON.stringify(dashboardData.recent_visits || []));

        } catch (err: any) {
          console.error("Error fetching clinician dashboard data:", err);
          setErrorData(err.message || "Failed to fetch clinician data.");
        }
      };

      // Fetch only if data isn't already loaded (simple check)
      if (recentVisits.length === 0 && patients.length === 0) {
        console.log("ClinicianDashboard Effect: Conditions met, calling fetchData...");
        fetchData();
      }

    } else if (!authLoading && authProfile && authProfile.role !== 'clinician') {
      setErrorData("Logged in user is not a clinician.");
    } else if (!authLoading && !authProfile) {
      setErrorData("Clinician profile not found."); // Changed message
    } else {
      console.log(`ClinicianDashboard Effect: Conditions not met. authLoading: ${authLoading}, Has profile: ${!!authProfile}, Is clinician: ${authProfile?.role === 'clinician'}`);
    }
    // Dependency array includes profileId, authLoading, and role
  }, [authProfile?.profileId, authLoading, authProfile?.role, recentVisits.length, patients.length]);

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
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center text-white"><FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-primary-accent" /> Loading dashboard data...</div>;
  }

  if (error) {
    return <div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-center mb-6 container mx-auto max-w-4xl">Error: {error}</div>;
  }

  if (!clinician) {
    // Provide a more helpful message or redirect option
    return (
      <div className="container mx-auto px-4 py-16 text-center text-white">
        <p className="text-xl mb-4">Access Denied</p>
        <p className="text-off-white/70 mb-6">You must be logged in as a clinician to view this page.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-2 border border-primary-accent text-primary-accent rounded-md hover:bg-primary-accent hover:text-dark-bg transition duration-200 active:scale-95">
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-white">Clinician Dashboard</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/clinician/add-visit')}
            className="flex items-center px-4 py-2 border border-primary-accent rounded-md shadow-sm text-sm font-medium text-primary-accent bg-transparent hover:bg-primary-accent hover:text-dark-bg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-primary-accent transition duration-150 whitespace-nowrap group active:scale-95"
          >
            <FaPlus className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform duration-200" />
            New Visit
          </button>
          <button
            onClick={() => { /* TODO: Implement logout */ alert('Logout functionality not yet implemented in context.'); }}
            className="flex items-center px-4 py-2 border border-border-color text-off-white/70 rounded-md hover:bg-dark-card hover:text-red-400 hover:border-red-500/50 transition duration-150 text-sm group"
            title="Logout"
          >
            <FaEdit className="mr-2 h-4 w-4 transition-colors duration-150" />
            Logout
          </button>
        </div>
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6 text-center animate-fade-in">
          <span className="block sm:inline">Upload Error: {uploadError}</span>
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color mb-12 flex flex-col md:flex-row items-center space-y-6 md:space-y-0 md:space-x-8 animate-fade-in hover:shadow-primary-glow-sm transition-shadow duration-300">
        <div className="flex-shrink-0 relative group">
          {/* Profile Picture */}
          {authProfile?.profilePictureUrl ? (
            <img
              src={authProfile.profilePictureUrl}
              alt="Profile"
              className="h-24 w-24 rounded-full object-cover border-4 border-primary-accent shadow-md transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-dark-input flex items-center justify-center border-4 border-border-color text-off-white/30 transition-colors duration-300 group-hover:border-primary-accent">
              <FaUserCircle className="h-16 w-16" />
            </div>
          )}
          {/* Upload Overlay */}
          <label className="absolute inset-0 flex items-center justify-center bg-black/70 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer">
            <div className="text-center">
              <FaEdit className="h-5 w-5 text-white mx-auto mb-1" />
              <span className="text-white text-xs font-medium">
                {uploading ? 'Uploading...' : 'Change'}
              </span>
            </div>
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
        {/* Welcome Message */}
        <div className="text-center md:text-left flex-grow">
          <p className="text-xl sm:text-2xl text-white font-semibold mb-1">Welcome, {clinicianUsername || 'Clinician'}!</p>
          <p className="text-base text-off-white/70">Manage your patients and view recent activity.</p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-10">
        {/* Patient List Column */}
        <div className="lg:col-span-1 bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in transition-shadow hover:shadow-primary-glow-sm" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-xl sm:text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Your Patients ({patients.length})</h2>
          {patients.length > 0 ? (
            <ul className="space-y-3 max-h-[calc(100vh-500px)] overflow-y-auto pr-2 -mr-2 custom-scrollbar"> {/* Added custom-scrollbar class */}
              {patients.map((p) => (
                <li
                  key={p.id}
                  className="text-off-white/90 bg-dark-input/30 hover:bg-primary-accent/10 border border-transparent hover:border-primary-accent/30 cursor-pointer p-3 rounded-lg flex items-center space-x-4 transition duration-200 group"
                  onClick={() => navigate(`/clinician/patient/${p.id}`)}
                  title={`View details for ${p.username || 'patient'}`}
                >
                  {/* Patient Avatar */}
                  {p.profile_picture_url ? (
                    <img
                      src={p.profile_picture_url}
                      alt={`Profile of ${p.username || 'patient'}`}
                      className="h-10 w-10 rounded-full object-cover flex-shrink-0 border-2 border-border-color group-hover:border-primary-accent transition-colors duration-200"
                    />
                  ) : (
                    <FaUserCircle className="h-10 w-10 text-off-white/40 flex-shrink-0 group-hover:text-primary-accent transition-colors duration-200" />
                  )}
                  {/* Patient Name */}
                  <span className="truncate text-base font-medium flex-grow group-hover:text-white transition-colors duration-200">{p.username || 'Patient'}</span>
                  <FaArrowRight className="h-4 w-4 text-off-white/30 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-off-white/60 text-center py-4 italic">No patients assigned yet.</p>
          )}
        </div>

        {/* Recent Visits Column */}
        <div className="lg:col-span-2 bg-dark-card p-6 rounded-xl shadow-lg border border-border-color animate-fade-in transition-shadow hover:shadow-primary-glow-sm" style={{ animationDelay: '0.2s' }}>
          <h2 className="text-xl sm:text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Recent Visits</h2>
          {recentVisits.length > 0 ? (
            <ul className="divide-y divide-border-color/30">
              {recentVisits.map((visit) => (
                <li key={visit.id}>
                  <Link
                    to={`/visit/${visit.id}`}
                    className="flex items-center justify-between p-3 sm:p-4 hover:bg-dark-input/50 transition duration-150 group"
                  >
                    <div className="flex-grow mr-4">
                      <p className="font-medium text-sm sm:text-base text-primary-accent flex items-center mb-1">
                        <FaUserCircle className="mr-2 h-4 w-4 text-primary-accent/80 flex-shrink-0" />
                        Patient: {visit.patient_username || 'Patient'}
                      </p>
                      <div className="text-xs text-off-white/70 flex flex-col sm:flex-row sm:items-center sm:gap-x-4">
                        <span className="flex items-center mb-0.5 sm:mb-0" title={new Date(visit.visit_date).toLocaleString()}>
                          <FaCalendarAlt className="mr-1.5 h-3 w-3 text-off-white/50 flex-shrink-0" />
                          {formatDistanceToNow(new Date(visit.visit_date), { addSuffix: true })}
                        </span>
                        <span className="flex items-start">
                          <FaRegCommentDots className="mr-1.5 mt-0.5 h-3 w-3 text-off-white/50 flex-shrink-0" />
                          <span>Reason: {visit.reason ? (visit.reason.length > 40 ? visit.reason.substring(0, 40) + '...' : visit.reason) : <span className="italic text-off-white/60">N/A</span>}</span>
                        </span>
                      </div>
                    </div>
                    <FaAngleRight className="h-5 w-5 text-off-white/40 group-hover:text-primary-accent group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-off-white/60 text-center py-6 italic">No recent visits found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClinicianDashboardPage; 