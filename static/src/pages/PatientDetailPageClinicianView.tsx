import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Patient, Visit } from '../types/app';
import { FaArrowLeft, FaUser, FaHeartbeat, FaNotesMedical, FaCalendarAlt, FaSpinner, FaRegCommentDots, FaFilePrescription, FaAngleRight } from 'react-icons/fa';
import { format, formatDistanceToNow } from 'date-fns';

// Define the structure expected from the RPC call (Updated Visit)
interface VisitWithDetails extends Visit {
  // Add any additional properties you need from the Visit type
}

const PatientDetailPageClinicianView: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
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

        // Call the RPC function - Let TS infer the type for now
        const { data: rpcData, error: rpcError } = await supabase.rpc(
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
        setError(err.message || "Failed to load patient data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();

  }, [patientId]);

  if (loading) {
    return <div className="container mx-auto px-4 py-16 text-center text-white"><FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-primary-accent" /> Loading patient details...</div>;
  }

  if (error) {
    return <div className="container mx-auto px-4 py-16 text-center"><div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg inline-block">Error: {error}</div></div>;
  }

  if (!patient) {
    return <div className="container mx-auto px-4 py-16 text-center text-white">Patient data not found.</div>;
  }

  return (
    <div className="container mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
      <div className="flex justify-between items-center mb-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center px-4 py-2 border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition duration-200 text-sm font-medium group"
        >
          <FaArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" /> Go Back
        </button>
        <div className="text-center flex-grow">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-1">Patient Details</h1>
          <p className="text-lg text-primary-accent font-medium">{patient.username || 'Patient'}</p>
        </div>
        <div className="w-24"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-10">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in transition-shadow hover:shadow-primary-glow-sm" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-xl sm:text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6 flex items-center">
              <FaUser className="mr-3 text-primary-accent" /> Patient Information
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center"><FaUser className="mr-2 w-4 text-off-white/50" /><span className="font-medium text-off-white/70 w-24">Username:</span> <span className="text-off-white/90">{patient.username || 'N/A'}</span></div>
              <div className="flex items-center"><FaCalendarAlt className="mr-2 w-4 text-off-white/50" /><span className="font-medium text-off-white/70 w-24">Joined:</span> <span className="text-off-white/90">{patient.created_at ? format(new Date(patient.created_at), 'PPP') : 'N/A'}</span></div>
            </div>
          </div>

          <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in transition-shadow hover:shadow-primary-glow-sm" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-xl sm:text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6 flex items-center">
              <FaHeartbeat className="mr-3 text-primary-accent" /> Medical History
            </h2>
            {patient.medical_history && typeof patient.medical_history === 'object' && Object.keys(patient.medical_history).length > 0 ? (
              <ul className="text-sm space-y-3">
                {Object.entries(patient.medical_history).map(([key, value]) => (
                  <li key={key} className="flex justify-between items-start p-3 bg-dark-input/40 rounded-lg border border-border-color/30">
                    <span className="font-medium capitalize text-off-white/80 break-words">{key.replace(/_/g, ' ')}</span>
                    <span className="text-off-white text-right ml-4 break-words">{String(value)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-off-white/60 italic text-center py-4">No medical history provided.</p>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in transition-shadow hover:shadow-blue-glow-sm" style={{ animationDelay: '0.3s' }}>
          <h2 className="text-xl sm:text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6 flex items-center">
            <FaNotesMedical className="mr-3 text-pastel-blue" /> Visit History ({visits.length})
          </h2>
          {visits.length > 0 ? (
            <ul className="divide-y divide-border-color/30 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 -mr-2 custom-scrollbar">
              {visits.map((visit) => (
                <li key={visit.id}>
                  <Link
                    to={`/visit/${visit.id}`}
                    className="flex items-center justify-between p-3 sm:p-4 hover:bg-dark-input/50 transition duration-150 group"
                  >
                    <div className="flex-grow mr-4">
                      <p className="font-medium text-sm sm:text-base text-pastel-blue flex items-center mb-1">
                        <FaCalendarAlt className="mr-2 h-4 w-4 text-pastel-blue/80 flex-shrink-0" />
                        Visit on {format(new Date(visit.visit_date), 'PPP')}
                      </p>
                      <div className="text-xs text-off-white/70 flex flex-col sm:flex-row sm:items-center sm:gap-x-4">
                        <span className="flex items-center mb-0.5 sm:mb-0" title={new Date(visit.visit_date).toLocaleString()}>
                          Relative: {formatDistanceToNow(new Date(visit.visit_date), { addSuffix: true })}
                        </span>
                        <span className="flex items-start">
                          <FaRegCommentDots className="mr-1.5 mt-0.5 h-3 w-3 text-off-white/50 flex-shrink-0" />
                          <span>Reason: {visit.reason ? (visit.reason.length > 40 ? visit.reason.substring(0, 40) + '...' : visit.reason) : <span className="italic text-off-white/60">N/A</span>}</span>
                        </span>
                      </div>
                      {visit.prescriptions && visit.prescriptions.length > 0 && (
                        <p className="text-xs mt-1 text-pastel-blue/70 flex items-center">
                          <FaFilePrescription className="mr-1.5 h-3 w-3" /> Contains Prescriptions ({visit.prescriptions.length})
                        </p>
                      )}
                    </div>
                    <FaAngleRight className="h-5 w-5 text-off-white/40 group-hover:text-pastel-blue group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-off-white/60 text-center py-6 italic">No visit history found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientDetailPageClinicianView; 