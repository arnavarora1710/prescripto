import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Prescription } from '../types/app';
import { useAuth } from '../context/AuthContext';
import { FaDownload, FaSpinner, FaArrowLeft, FaFilePrescription, FaUserMd, FaCalendarDay, FaPills, FaStickyNote, FaInfoCircle } from 'react-icons/fa';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const PatientPrescriptionsPage: React.FC = () => {
    const navigate = useNavigate();
    const { profile: authProfile, loading: authLoading, error: authError } = useAuth();

    const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
    const [loadingPageData, setLoadingPageData] = useState(true);
    const [errorPageData, setErrorPageData] = useState<string | null>(null);

    // Get the basic profile from context for checks and ID
    const basicPatientProfile = authProfile?.role === 'patient' ? authProfile : null;
    const patientUsername = basicPatientProfile?.username || 'Patient'; // Get username for PDF if needed

    // Overall loading combines auth loading and page data loading
    const loading = authLoading || loadingPageData;
    const error = authError || errorPageData;

    useEffect(() => {
        const patientId = basicPatientProfile?.profileId;

        if (patientId) {
            const fetchPrescriptions = async () => {
                setLoadingPageData(true);
                setErrorPageData(null);
                try {
                    console.log(`Fetching ALL prescriptions for patient ID: ${patientId}`);
                    const { data, error } = await supabase
                        .from('prescriptions')
                        .select(`
              *,
              clinicians: clinician_id ( id, username )
            `)
                        .eq('patient_id', patientId)
                        .order('created_at', { ascending: false }); // No limit

                    if (error) throw new Error(`Prescriptions Fetch Error: ${error.message}`);

                    console.log("All Prescriptions Data:", data);
                    setPrescriptions(data || []);

                } catch (err: any) {
                    console.error("Error fetching prescriptions:", err);
                    setErrorPageData(err.message || "Failed to load prescriptions.");
                } finally {
                    setLoadingPageData(false);
                }
            };
            fetchPrescriptions();
        } else if (!authLoading) {
            setLoadingPageData(false);
            if (!basicPatientProfile) {
                setErrorPageData("Logged in user is not a patient or profile is missing.");
            }
        }
    }, [basicPatientProfile?.profileId, authLoading]);

    // --- PDF Generation Function (Copied from PatientProfilePage) ---
    const generatePrescriptionPdf = (prescription: Prescription) => {
        // Use patientUsername from auth context if available
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
        doc.text(`Name: ${patientUsername}`, patientInfoX, currentY);

        currentY = infoStartY; // Reset Y
        doc.setFont('helvetica', 'bold');
        doc.text("Prescriber:", clinicianInfoX, currentY);
        doc.setFont('helvetica', 'normal');
        currentY += 5;
        doc.text(`Name: ${prescription.clinicians?.username || 'Unknown'}`, clinicianInfoX, currentY);
        currentY += 5;
        doc.text(`Date Issued: ${new Date(prescription.created_at).toLocaleDateString()}`, clinicianInfoX, currentY);

        currentY = Math.max(currentY, infoStartY + 15);
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
                currentY = data.cursor?.y || currentY;
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

        currentY = pageHeight - 15;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("This is a record of a prescription generated via Prescripto.", pageWidth / 2, currentY, { align: 'center' });

        doc.save(`Prescription_Record_${new Date(prescription.created_at).toISOString().split('T')[0]}.pdf`);
    };
    // --- End PDF Generation Function ---

    // Render Logic
    return (
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <h1 className="text-3xl sm:text-4xl font-bold text-white">My Prescription History</h1>
                <button
                    onClick={() => navigate('/patient/profile')}
                    className="flex items-center px-4 py-2 border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition duration-200 text-sm font-medium group"
                >
                    <FaArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" /> Back to Profile
                </button>
            </div>

            {/* Loading State */}
            {loading && (
                <div className="text-center py-10">
                    <FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-pastel-blue" /> Loading prescriptions...
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-center mb-6">
                    Error: {error}
                </div>
            )}

            {/* Content */}
            {!loading && !error && (
                <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in">
                    {prescriptions.length > 0 ? (
                        <ul className="space-y-8">
                            {prescriptions.map((rx) => (
                                <li key={rx.id} className="border-b border-border-color/40 pb-6 last:border-b-0">
                                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                                        {/* Prescription Title */}
                                        <h2 className="font-semibold text-lg sm:text-xl text-pastel-blue flex items-center">
                                            <FaFilePrescription className="mr-3 h-5 w-5 text-pastel-blue/80 flex-shrink-0" />
                                            {rx.medication || 'Unnamed Prescription'}
                                        </h2>
                                        {/* Download Button */}
                                        <button
                                            onClick={() => generatePrescriptionPdf(rx)}
                                            className="flex items-center flex-shrink-0 px-3 py-1.5 text-xs border border-electric-blue/60 text-electric-blue rounded-md hover:bg-electric-blue/10 transition duration-200 active:scale-95 group whitespace-nowrap"
                                            title="Download Prescription PDF"
                                        >
                                            <FaDownload className="mr-1.5 h-3 w-3" /> Download PDF
                                        </button>
                                    </div>

                                    {/* Prescription Details Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                        <div className="flex items-center text-off-white/80">
                                            <FaCalendarDay className="mr-2.5 h-4 w-4 text-pastel-lavender/70 flex-shrink-0" />
                                            <span><span className="font-medium text-off-white/90">Date Issued:</span> {format(new Date(rx.created_at), 'PPP')}</span>
                                        </div>
                                        <div className="flex items-center text-off-white/80">
                                            <FaUserMd className="mr-2.5 h-4 w-4 text-pastel-lavender/70 flex-shrink-0" />
                                            <span><span className="font-medium text-off-white/90">Prescriber:</span> {rx.clinicians?.username || 'Unknown'}</span>
                                        </div>
                                        <div className="flex items-center text-off-white/80">
                                            <FaPills className="mr-2.5 h-4 w-4 text-pastel-lavender/70 flex-shrink-0" />
                                            <span><span className="font-medium text-off-white/90">Dosage:</span> {rx.dosage || 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center text-off-white/80">
                                            <FaInfoCircle className="mr-2.5 h-4 w-4 text-pastel-lavender/70 flex-shrink-0" />
                                            <span><span className="font-medium text-off-white/90">Frequency:</span> {rx.frequency || 'N/A'}</span>
                                        </div>
                                    </div>

                                    {/* Prescription Notes */}
                                    {rx.notes && (
                                        <div className="mt-4 pt-4 border-t border-border-color/30">
                                            <p className="text-xs font-medium text-pastel-lavender mb-1.5 flex items-center">
                                                <FaStickyNote className="mr-1.5 h-3.5 w-3.5" />
                                                Notes:
                                            </p>
                                            <p className="text-sm text-off-white/80 italic whitespace-pre-wrap bg-dark-input/50 p-3 rounded-md border border-border-color/30 font-mono text-xs leading-relaxed">
                                                {rx.notes}
                                            </p>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-off-white/60 text-center py-10 italic">No prescription history found.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default PatientPrescriptionsPage; 