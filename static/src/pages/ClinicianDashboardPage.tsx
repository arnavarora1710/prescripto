import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
// import { User } from '@supabase/supabase-js'; // Remove unused import
import { Clinician, Visit, Patient } from '../types/app'; // Import types

// Helper type for patient details needed on dashboard
type PatientSummary = Pick<Patient, 'id' | 'user_id'> & { email: string | undefined };

// Define type for the expected RPC response structure
interface ClinicianDashboardData {
  recent_visits: (Visit & { patient_email?: string })[];
  associated_patients: PatientSummary[];
}

const ClinicianDashboardPage: React.FC = () => {
  const [clinician, setClinician] = useState<Clinician | null>(null);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // 1. Get current user
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session?.user) {
          throw new Error("User not logged in.");
        }
        const currentUser = session.user;

        // 2. Get clinician profile linked to the user
        const { data: clinicianData, error: clinicianError } = await supabase
          .from('clinicians')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();

         if (clinicianError) {
           if (clinicianError.code === 'PGRST116') {
              throw new Error("Clinician profile not found. Please ensure you are logged in as a clinician.");
           } else {
              throw clinicianError;
           }
         }
        if (!clinicianData) throw new Error("Clinician profile data is unexpectedly null.");
        // Add email for display
        const clinicianProfile: Clinician = { ...clinicianData, email: currentUser.email };
        setClinician(clinicianProfile);
        const currentClinicianId = clinicianData.id;

        // --- Fetch Dashboard Data using RPC --- 
        console.log(`Fetching dashboard data for clinician: ${currentClinicianId}`);
        // @ts-expect-error - TS Version/Type conflict? Syntax seems correct.
        const { data: dashboardData, error: rpcError } = await supabase.rpc<ClinicianDashboardData>(
            'get_clinician_dashboard_data',
            { p_clinician_id: currentClinicianId }
        );

        console.log("RPC Result:", { dashboardData, rpcError });

        if (rpcError) throw rpcError;
        if (!dashboardData) throw new Error("RPC returned no data.");

        // Update state with data from RPC
        setPatients(dashboardData.associated_patients || []);
        setRecentVisits(dashboardData.recent_visits || []); // RPC now includes patient_email

      } catch (err: any) {
        console.error("Error fetching clinician data:", err);
        setError(err.message || "Failed to fetch clinician data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
      <h1 className="text-3xl font-bold text-electric-blue mb-6">Clinician Dashboard</h1>
      <p className="mb-6 text-lg text-off-white/80">Welcome, {clinician.email || 'Clinician'}!</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient List */} 
        <div className="lg:col-span-1 bg-dark-card p-6 rounded-lg shadow-lg border border-off-white/10">
          <h2 className="text-xl font-semibold text-electric-blue/90 mb-4">Your Patients ({patients.length})</h2>
          {patients.length > 0 ? (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {patients.map((p) => (
                <li key={p.id} className="text-off-white/80 hover:text-white">
                  {/* TODO: Link to a patient detail page? */} 
                  {p.email || `Patient ID: ${p.id.substring(0, 8)}...`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-off-white/70">No patients found yet.</p>
          )}
        </div>

        {/* Recent Visits */}
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