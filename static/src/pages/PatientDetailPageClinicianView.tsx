import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Patient, Visit } from '../types/app';

// Define the structure expected from the RPC call
interface PatientDetailResponse {
  patient: Patient & { username?: string | null };
  visits: Visit[];
}

const PatientDetailPageClinicianView: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<string>('');
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setError('Patient ID not found in URL.');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            console.log(`Fetching patient details via RPC for ID: ${patientId}`);
            
            // Call the RPC function
            const { data: rpcData, error: rpcError } = await supabase.rpc<PatientDetailResponse>(
                'get_patient_details_for_clinician',
                { p_patient_id: patientId } 
            );

            // Check for RPC errors
            if (rpcError) throw rpcError;
            if (!rpcData) throw new Error('RPC returned no data.');

            console.log("RPC Data Received:", rpcData);

            // Set state from RPC results
            if (rpcData.patient) {
                // Ensure email is attached directly if needed, RPC structure might vary
                // The SQL function provided aims to put email directly on the patient object
                setPatient(rpcData.patient);
            } else {
                throw new Error('Patient data not found in RPC response.');
            }
            setVisits(rpcData.visits || []);

        } catch (err: any) {
            console.error("Error calling get_patient_details_for_clinician RPC:", err);
            setError(err.message || "Failed to load patient data via RPC.");
        } finally {
            setLoading(false);
        }
    };

    fetchData();

  }, [patientId]);

  // --- Edit Notes Logic ---
  const handleEditClick = (visit: Visit) => {
    setEditingVisitId(visit.id);
    setEditNotes(visit.notes || '');
  };

  const handleSaveNotes = async (visitId: string) => {
    if (!patientId) return;
    // TODO: Add loading/disabled state for save button
    try {
        console.log(`Saving notes for visit ${visitId}`);
        const { error: updateError } = await supabase
            .from('visits')
            .update({ notes: editNotes })
            .eq('id', visitId);

        if (updateError) throw updateError;

        // Update local state
        setVisits(prevVisits => 
            prevVisits.map(v => v.id === visitId ? { ...v, notes: editNotes } : v)
        );
        setEditingVisitId(null); // Exit edit mode
        console.log('Notes updated successfully!'); // Keep console log for feedback
    } catch (err: any) {
        console.error("Error updating visit notes:", err);
        setError("Failed to save notes: " + err.message); 
    }
  };

  const handleCancelEdit = () => {
    setEditingVisitId(null);
    setEditNotes('');
  };
  // --- End Edit Notes Logic ---

  if (loading) {
    return <div className="container mx-auto px-4 py-8 text-center text-white">Loading patient details...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-8 text-center text-red-500">Error: {error}</div>;
  }

  if (!patient) {
    return <div className="container mx-auto px-4 py-8 text-center text-white">Patient data not found.</div>;
  }

  return (
    <div className="container mx-auto px-6 lg:px-8 py-12 text-off-white font-sans animate-fade-in">
      <div className="flex justify-between items-center mb-10">
        <button 
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-sm border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition duration-200"
        >
          &larr; Go Back 
        </button>
        <div className="text-center flex-grow">
          <h1 className="text-4xl font-bold text-white mb-2">Patient Details</h1>
          <p className="text-lg text-pastel-lavender font-medium">{patient.username || patientId}</p>
        </div>
        <div className="w-[calc(theme(spacing.4)*2+theme(fontSize.sm)*4)]"></div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-8">
            <div className="bg-dark-card p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <h2 className="text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Patient Information</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="font-medium text-off-white/70">Username:</span> <span className="text-off-white/90">{patient.username || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="font-medium text-off-white/70">Joined:</span> <span className="text-off-white/90">{patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'N/A'}</span></div>
              </div>
            </div>

            <div className="bg-dark-card p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <h3 className="text-xl font-semibold text-white mb-5">Medical History</h3>
              {patient.medical_history && typeof patient.medical_history === 'object' && Object.keys(patient.medical_history).length > 0 ? (
                  <div className="text-sm bg-dark-input p-5 rounded-lg border border-border-color/50 space-y-3">
                      {Object.entries(patient.medical_history).map(([key, value]) => (
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
        </div>

        <div className="lg:col-span-2 bg-dark-card p-8 rounded-xl shadow-lg border border-border-color animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6">Visit History</h2>
          {visits.length > 0 ? (
            <ul className="space-y-8">
              {visits.map((visit) => (
                <li key={visit.id} className="border-b border-border-color/70 pb-6 last:border-b-0">
                  <div className="mb-4">
                    <p className="text-base font-medium text-pastel-blue">
                      Visit on: <span className="font-semibold text-white">{new Date(visit.visit_date).toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })}</span>
                    </p>
                    <p className="text-sm text-off-white/70 mt-1">Reason: {visit.reason || 'N/A'}</p>
                  </div>

                  <div className="pl-4 border-l-2 border-pastel-lavender/30">
                    <h4 className="font-medium text-pastel-lavender mb-2 text-sm">Visit Notes:</h4>
                    {editingVisitId === visit.id ? (
                      <div className="space-y-3">
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={5}
                          className="w-full px-3 py-2 rounded-lg bg-dark-input border border-border-color/70 text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-pastel-lavender focus:border-transparent transition duration-150 text-sm"
                        />
                        <div className="flex items-center space-x-3">
                          <button 
                            onClick={() => handleSaveNotes(visit.id)}
                            className="px-5 py-2 text-sm border border-pastel-lavender text-pastel-lavender hover:bg-pastel-lavender/10 rounded-md transition duration-200 font-semibold"
                          >
                            Save Notes
                          </button>
                          <button 
                            onClick={handleCancelEdit}
                            className="px-4 py-1.5 text-sm border border-border-color hover:bg-dark-input text-off-white/80 rounded-md transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-start gap-4">
                        <p className="text-sm text-off-white/90 whitespace-pre-wrap flex-grow min-w-0 bg-dark-input p-3 rounded-md border border-border-color/50">
                          {visit.notes || <span className="italic text-off-white/60">No notes recorded.</span>}
                        </p>
                        <button 
                          onClick={() => handleEditClick(visit)}
                          className="px-3 py-1 text-xs border border-pastel-lavender/50 text-pastel-lavender rounded-md hover:bg-pastel-lavender/10 transition flex-shrink-0 mt-1"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>
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

export default PatientDetailPageClinicianView; 