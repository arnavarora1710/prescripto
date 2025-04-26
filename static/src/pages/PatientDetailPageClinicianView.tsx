import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Patient, Visit } from '../types/app';

// Define the structure expected from the RPC call
interface PatientDetailResponse {
  patient: Patient & { email?: string }; // Patient type might need explicit email
  visits: Visit[];
}

const PatientDetailPageClinicianView: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
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

        // Update local state to reflect changes immediately
        setVisits(prevVisits => 
            prevVisits.map(v => v.id === visitId ? { ...v, notes: editNotes } : v)
        );
        setEditingVisitId(null); // Exit edit mode
        alert('Notes updated successfully!'); // Provide user feedback
    } catch (err: any) {
        console.error("Error updating visit notes:", err);
        setError("Failed to save notes: " + err.message);
        // Optionally keep edit mode open on error?
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
    <div className="container mx-auto px-4 py-8 text-white">
      <h1 className="text-3xl font-bold text-electric-blue mb-6">
        Patient Details: {patient.email || patientId} {/* Display email if available */}
      </h1>
      
      {/* Placeholder for Patient Info */}
      <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-off-white/10 mb-6">
        <h2 className="text-xl font-semibold text-electric-blue/90 mb-4">Patient Information</h2>
        <p>ID: {patient.id}</p>
        <p>Email: {patient.email || 'N/A'}</p>
        <p>Joined: {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : 'N/A'}</p>
        {/* Display Medical History (Readonly) */}
        <div className="mt-4">
            <h3 className="text-lg font-medium text-off-white/80 mb-2">Medical History</h3>
            <pre className="text-xs bg-dark-input p-3 rounded overflow-auto max-h-40 border border-off-white/20">
                {patient.medical_history ? JSON.stringify(patient.medical_history, null, 2) : 'No data provided.'}
            </pre>
        </div>
        {/* Add more patient details display here if needed */}
      </div>

      {/* Placeholder for Visits List & Editing */}
      <div className="bg-dark-card p-6 rounded-lg shadow-lg border border-off-white/10">
        <h2 className="text-xl font-semibold text-electric-blue/90 mb-4">Visit History</h2>
        {visits.length > 0 ? (
          <ul className="space-y-6"> {/* Increased spacing */} 
            {visits.map((visit) => (
              <li key={visit.id} className="border-b border-off-white/10 pb-4 last:border-b-0">
                <p><span className="font-medium text-off-white/70">Date:</span> {new Date(visit.visit_date).toLocaleString()}</p>
                <p><span className="font-medium text-off-white/70">Reason:</span> {visit.reason || 'N/A'}</p>
                <div className="mt-2">
                  <p className="font-medium text-off-white/70 mb-1">Notes:</p>
                  {editingVisitId === visit.id ? (
                    // Edit Mode
                    <div className="space-y-2">
                      <textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 rounded-md bg-dark-input border border-off-white/20 text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150 text-sm"
                      />
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleSaveNotes(visit.id)}
                          className="px-3 py-1 text-xs bg-electric-blue/80 hover:bg-electric-blue text-white rounded transition"
                        >
                          Save
                        </button>
                        <button 
                          onClick={handleCancelEdit}
                          className="px-3 py-1 text-xs border border-off-white/30 hover:bg-off-white/10 text-off-white/80 rounded transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <div className="flex justify-between items-start">
                      <p className="text-sm text-off-white/90 whitespace-pre-wrap">{visit.notes || <span className="italic text-off-white/60">No notes recorded.</span>}</p>
                      <button 
                        onClick={() => handleEditClick(visit)}
                        className="ml-4 px-2 py-0.5 text-xs border border-electric-blue/50 text-electric-blue rounded hover:bg-electric-blue/10 transition flex-shrink-0"
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
          <p className="text-off-white/70">No visit history found.</p>
        )}
      </div>
    </div>
  );
};

export default PatientDetailPageClinicianView; 