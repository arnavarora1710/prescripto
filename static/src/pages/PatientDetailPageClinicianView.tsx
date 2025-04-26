import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Patient, Visit, Prescription } from '../types/app';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FaArrowLeft, FaUser, FaHeartbeat, FaNotesMedical, FaCalendarAlt, FaUserMd, FaEdit, FaSave, FaTimes, FaFileDownload, FaSpinner, FaRegCommentDots, FaFilePrescription, FaStickyNote, FaPills } from 'react-icons/fa';
import { format, formatDistanceToNow } from 'date-fns';

// Define the structure expected from the RPC call (Updated Visit)
interface VisitWithDetails extends Visit {
  // Add any additional properties you need from the Visit type
}

const PatientDetailPageClinicianView: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

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

  // --- PDF Generation Function ---
  const generatePrescriptionPdf = (prescription: Prescription, visit: Visit) => {
    if (!patient) {
      console.error("Patient data is not loaded, cannot generate PDF.");
      alert("Error: Patient data not available.");
      return;
    }

    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
    const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
    let currentY = 15; // Start position

    // --- Header ---
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text("Prescription", pageWidth / 2, currentY, { align: 'center' });
    currentY += 10;

    // --- Patient & Clinician Info ---
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const patientInfoX = 15;
    const clinicianInfoX = pageWidth / 2 + 10;
    const infoStartY = currentY;

    doc.setFont('helvetica', 'bold');
    doc.text("Patient:", patientInfoX, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 5;
    doc.text(`Name: ${patient.username || 'N/A'}`, patientInfoX, currentY);

    currentY = infoStartY; // Reset Y for clinician info
    doc.setFont('helvetica', 'bold');
    doc.text("Prescriber:", clinicianInfoX, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 5;
    doc.text(`Name: ${visit.clinicians?.username || 'N/A'}`, clinicianInfoX, currentY);
    currentY += 5;
    doc.text(`Date: ${new Date(prescription.created_at).toLocaleDateString()}`, clinicianInfoX, currentY);

    currentY = Math.max(currentY, infoStartY + 15); // Adjusted Y ensure Y is below the info block
    currentY += 5;
    doc.setLineWidth(0.2);
    doc.line(15, currentY, pageWidth - 15, currentY); // Divider line
    currentY += 10;

    // --- Prescription Details Table ---
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
      headStyles: { fillColor: [60, 70, 90] }, // Dark blue-gray header
      styles: { fontSize: 10, cellPadding: 2 },
      margin: { left: 15, right: 15 },
      didDrawPage: (data) => {
        currentY = data.cursor?.y || currentY; // Update Y position after table
      }
    });

    currentY += 10;

    // --- Notes ---
    if (prescription.notes) {
      doc.setFont('helvetica', 'bold');
      doc.text("Notes:", 15, currentY);
      currentY += 5;
      doc.setFont('helvetica', 'normal');
      const notesLines = doc.splitTextToSize(prescription.notes, pageWidth - 30);
      doc.text(notesLines, 15, currentY);
      currentY += notesLines.length * 4; // Adjust Y based on number of lines
    }

    currentY += 15;

    // --- Footer / Signature Line ---
    const signatureY = pageHeight - 30; // Position near bottom
    doc.line(clinicianInfoX, signatureY, pageWidth - 15, signatureY);
    doc.setFontSize(9);
    doc.text("Prescriber Signature", clinicianInfoX, signatureY + 4);

    doc.save(`Prescription_${patient.username || 'Patient'}_${new Date(prescription.created_at).toISOString().split('T')[0]}.pdf`);
  };
  // --- End PDF Generation Function ---

  // --- Edit Notes Logic ---
  const handleEditClick = (visit: Visit) => {
    setError(null);
    setEditingVisitId(visit.id);
    setEditNotes(visit.notes || '');
  };

  const handleSaveNotes = async (visitId: string) => {
    if (!patientId) return;
    setIsSavingNotes(true);
    setError(null);
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
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingVisitId(null);
    setEditNotes('');
  };
  // --- End Edit Notes Logic ---

  if (loading) {
    return <div className="container mx-auto px-4 py-16 text-center text-white"><FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-pastel-blue" /> Loading patient details...</div>;
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
          <p className="text-lg text-pastel-lavender font-medium">{patient.username || 'Patient'}</p>
        </div>
        <div className="w-24"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 xl:gap-10">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in transition-shadow hover:shadow-pastel-glow-sm" style={{ animationDelay: '0.1s' }}>
            <h2 className="text-xl sm:text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6 flex items-center">
              <FaUser className="mr-3 text-pastel-lavender" /> Patient Information
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center"><FaUser className="mr-2 w-4 text-off-white/50" /><span className="font-medium text-off-white/70 w-24">Username:</span> <span className="text-off-white/90">{patient.username || 'N/A'}</span></div>
              <div className="flex items-center"><FaCalendarAlt className="mr-2 w-4 text-off-white/50" /><span className="font-medium text-off-white/70 w-24">Joined:</span> <span className="text-off-white/90">{patient.created_at ? format(new Date(patient.created_at), 'PPP') : 'N/A'}</span></div>
            </div>
          </div>

          <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in transition-shadow hover:shadow-pastel-glow-sm" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-xl sm:text-2xl font-semibold text-white border-b border-border-color pb-3 mb-6 flex items-center">
              <FaHeartbeat className="mr-3 text-pastel-lavender" /> Medical History
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
            <ul className="space-y-8 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 -mr-2 custom-scrollbar">
              {visits.map((visit) => (
                <li key={visit.id} className="border-b border-border-color/70 pb-6 last:border-b-0">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline mb-3 gap-2">
                    <p className="font-medium text-base text-pastel-blue flex items-center">
                      <FaCalendarAlt className="mr-2.5 h-4 w-4 text-pastel-blue/80 flex-shrink-0" />
                      Visit on {format(new Date(visit.visit_date), 'PPPp')}
                    </p>
                    <div className="flex flex-col sm:items-end gap-1 text-xs text-off-white/70">
                      <span title={new Date(visit.visit_date).toLocaleString()}> ({formatDistanceToNow(new Date(visit.visit_date), { addSuffix: true })})</span>
                      <span className="flex items-center">
                        <FaUserMd className="mr-1.5 h-3.5 w-3.5 text-pastel-lavender/70" />
                        Clinician: {visit.clinicians?.username || 'N/A'}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-off-white/80 mb-4 flex items-start">
                    <FaRegCommentDots className="mr-2 mt-0.5 h-4 w-4 text-pastel-lavender/70 flex-shrink-0" />
                    <span><span className="font-medium text-off-white/90">Reason:</span> {visit.reason || <span className="italic text-off-white/60">Not specified</span>}</span>
                  </p>
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <h4 className="text-xs font-medium text-pastel-lavender flex items-center">
                        <FaNotesMedical className="mr-1.5 h-3.5 w-3.5" />
                        Visit Notes:
                      </h4>
                      {editingVisitId !== visit.id && (
                        <button
                          onClick={() => handleEditClick(visit)}
                          className="px-2 py-0.5 text-xs border border-pastel-lavender/50 text-pastel-lavender rounded hover:bg-pastel-lavender/10 transition flex-shrink-0 flex items-center"
                        >
                          <FaEdit className="mr-1 h-3 w-3" /> Edit
                        </button>
                      )}
                    </div>
                    {editingVisitId === visit.id ? (
                      <div className="space-y-3 mt-2 animate-fade-in">
                        <textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          rows={5}
                          className="w-full px-3 py-2 rounded-lg bg-dark-input border border-border-color/70 text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-pastel-lavender focus:border-transparent transition duration-150 text-sm font-mono"
                        />
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleSaveNotes(visit.id)}
                            disabled={isSavingNotes}
                            className="flex items-center justify-center px-4 py-1.5 min-w-[80px] text-sm border border-pastel-lavender text-pastel-lavender hover:bg-pastel-lavender/10 rounded-md transition duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSavingNotes ? <FaSpinner className="animate-spin h-4 w-4" /> : <><FaSave className="mr-1.5 h-3 w-3" /> Save</>}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={isSavingNotes}
                            className="flex items-center justify-center px-3 py-1.5 text-sm border border-border-color hover:bg-dark-input text-off-white/80 rounded-md transition disabled:opacity-50"
                          >
                            <FaTimes className="mr-1 h-3 w-3" /> Cancel
                          </button>
                        </div>
                        {error && editingVisitId === visit.id && (
                          <p className="text-red-400 text-xs pt-1">Error saving: {error}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-off-white/90 whitespace-pre-wrap bg-dark-input/50 p-3 rounded-md border border-border-color/30 font-mono text-xs leading-relaxed">
                        {visit.notes || <span className="italic text-off-white/60">No notes recorded.</span>}
                      </p>
                    )}
                  </div>

                  {visit.prescriptions && visit.prescriptions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border-color/30">
                      <h4 className="text-xs font-medium text-pastel-blue mb-2 flex items-center">
                        <FaFilePrescription className="mr-1.5 h-3.5 w-3.5" />
                        Prescriptions ({visit.prescriptions.length}):
                      </h4>
                      <ul className="space-y-3">
                        {visit.prescriptions.map(rx => (
                          <li key={rx.id} className="text-xs bg-dark-input/50 p-3 rounded-lg border border-border-color/40 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="flex-grow">
                              <p className="font-semibold text-off-white mb-1 flex items-center">
                                <FaPills className="mr-2 h-3.5 w-3.5 text-pastel-blue/70 flex-shrink-0" />
                                {rx.medication}
                              </p>
                              <div className="flex items-center text-off-white/70 pl-5 text-[0.7rem] gap-x-3">
                                {rx.dosage && <span>Dosage: <span className="font-medium text-off-white/90">{rx.dosage}</span></span>}
                                {rx.frequency && <span>Frequency: <span className="font-medium text-off-white/90">{rx.frequency}</span></span>}
                              </div>
                              {rx.notes && (
                                <div className="pl-5 mt-1 pt-1 border-t border-border-color/20">
                                  <p className="text-off-white/70 text-[0.7rem] flex items-start">
                                    <FaStickyNote className="mr-1.5 mt-0.5 h-3 w-3 text-pastel-lavender/60 flex-shrink-0" />
                                    <span className="italic">{rx.notes}</span>
                                  </p>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => generatePrescriptionPdf(rx, visit)}
                              className="flex items-center flex-shrink-0 mt-1 sm:mt-0 px-2.5 py-1 text-xs border border-electric-blue/60 text-electric-blue rounded-md hover:bg-electric-blue/10 transition duration-200 active:scale-95 group whitespace-nowrap"
                              title="Download Prescription PDF"
                            >
                              <FaFileDownload className="mr-1.5 h-3 w-3" /> PDF
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-off-white/60 text-center py-6 italic">No visit history found.</p>
          )}
        </div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(187, 222, 251, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(187, 222, 251, 0.5);
        }
      `}</style>
    </div>
  );
};

export default PatientDetailPageClinicianView; 