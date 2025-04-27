import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Visit, Prescription, Patient, Clinician } from '../types/app'; // Import necessary types
import { useAuth } from '../context/AuthContext'; // To check user role if needed

// Combined Icons from both branches
import {
    FaSpinner, FaArrowLeft, FaCalendarAlt, FaUserMd, FaNotesMedical,
    FaRegCommentDots, FaFilePrescription, FaPills, FaStickyNote,
    FaUserCircle, FaFileDownload, FaBell, FaRobot
} from 'react-icons/fa';

import { format } from 'date-fns';

// Import PDF generation libraries (from HEAD)
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Import Reminder Modal component (from incoming)
import ReminderModal from '../components/ReminderModal';

// Define a type for the full visit details expected from the database/RPC
interface FullVisitDetails extends Visit {
    prescriptions?: Prescription[];
    patients?: Patient;      // Changed from patient to patients to match potential join result
    clinicians?: Clinician;  // Changed from clinician to clinicians
    drawing_image_url?: string | null; // Add the drawing image URL property
}

const VisitDetailPage: React.FC = () => {
    const { visitId } = useParams<{ visitId: string }>();
    const navigate = useNavigate();
    const { profile: authProfile, loading: authLoading } = useAuth();

    const [visit, setVisit] = useState<FullVisitDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // === State for Reminder Modal ===
    const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
    const [selectedPrescriptionForReminder, setSelectedPrescriptionForReminder] = useState<Prescription | null>(null);

    // === Functions to handle modal ===
    const handleOpenReminderModal = (prescription: Prescription) => {
        setSelectedPrescriptionForReminder(prescription);
        setIsReminderModalOpen(true);
    };

    const handleCloseReminderModal = () => {
        setIsReminderModalOpen(false);
        setSelectedPrescriptionForReminder(null); // Clear selection on close
    };
    // === End Modal Handling ===

    useEffect(() => {
        if (!visitId) {
            setError('Visit ID not found in URL.');
            setLoading(false);
            return;
        }

        const fetchVisitDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                console.log(`Fetching details for visit ID: ${visitId}`);
                // Fetch visit, related patient, clinician, and prescriptions in one go
                const { data, error: fetchError } = await supabase
                    .from('visits')
                    .select(`
                        *,
                        patients (*),
                        clinicians (*),
                        prescriptions (*)
                    `)
                    .eq('id', visitId)
                    .single(); // Expecting only one visit

                if (fetchError) throw fetchError;
                if (!data) throw new Error("Visit not found.");

                console.log("Visit Details Data:", data);
                // Cast the data to FullVisitDetails for type safety
                setVisit(data as FullVisitDetails);

            } catch (err: any) {
                console.error("Error fetching visit details:", err);
                setError(err.message || "Failed to load visit details.");
            } finally {
                setLoading(false);
            }
        };

        fetchVisitDetails();
    }, [visitId]);

    // --- PDF Generation Function ---
    const generateVisitPdf = () => {
        if (!visit) {
            console.error("Visit data is not loaded, cannot generate PDF.");
            alert("Error: Visit data not available to generate PDF.");
            return;
        }

        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
        const margin = 15;
        const maxLineWidth = pageWidth - margin * 2;
        let currentY = 15; // Start position

        // --- Header ---
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text("Visit Summary", pageWidth / 2, currentY, { align: 'center' });
        currentY += 10;

        // --- Visit Info ---
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Visit Details", margin, currentY);
        currentY += 6;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Date: ${format(new Date(visit.visit_date), 'PPPp')}`, margin, currentY);
        currentY += 5;
        const patientName = visit.patients?.username || 'N/A'; // Extract for filename too
        doc.text(`Patient: ${patientName}`, margin, currentY);
        currentY += 5;
        doc.text(`Clinician: ${visit.clinicians?.username || 'N/A'}`, margin, currentY);
        currentY += 5;
        const reasonLines = doc.splitTextToSize(`Reason: ${visit.reason || 'N/A'}`, maxLineWidth);
        doc.text(reasonLines, margin, currentY);
        currentY += (reasonLines.length * 4) + 5;


        // --- Visit Notes ---
        if (visit.notes) {
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text("Visit Notes", margin, currentY);
            currentY += 6;
            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            const cleanedNotes = visit.notes.replace(/\*/g, '');
            const notesLines = doc.splitTextToSize(cleanedNotes, maxLineWidth);
            doc.setDrawColor(200);
            doc.rect(margin - 1, currentY - 3, maxLineWidth + 2, (notesLines.length * 3.5) + 5);
            doc.text(notesLines, margin, currentY);
            currentY += (notesLines.length * 3.5) + 8;
        }

        // --- Add Drawing Image ---
        if (visit.drawing_image_url && typeof visit.drawing_image_url === 'string' && visit.drawing_image_url.startsWith('data:image')) {
            try {
                currentY += 5; // Add space before drawing
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.text("Associated Drawing", margin, currentY);
                currentY += 6;

                const imageData = visit.drawing_image_url;
                const imageProps = doc.getImageProperties(imageData);

                // Calculate image dimensions to fit page width
                const imgWidth = imageProps.width;
                const imgHeight = imageProps.height;
                const aspectRatio = imgWidth / imgHeight;
                let pdfImgWidth = maxLineWidth;
                let pdfImgHeight = pdfImgWidth / aspectRatio;

                // Check if height exceeds remaining page space (basic check)
                const remainingSpace = pageHeight - currentY - 20; // Leave margin at bottom
                if (pdfImgHeight > remainingSpace) {
                    pdfImgHeight = remainingSpace;
                    pdfImgWidth = pdfImgHeight * aspectRatio;
                    // Center smaller image if width is now less than maxLineWidth
                    if (pdfImgWidth < maxLineWidth) {
                        // margin = (pageWidth - pdfImgWidth) / 2; // Re-center
                    }
                }
                // Center the image horizontally
                const imageX = (pageWidth - pdfImgWidth) / 2;


                doc.addImage(imageData, imageProps.fileType, imageX, currentY, pdfImgWidth, pdfImgHeight);
                currentY += pdfImgHeight + 8; // Move Y below image + padding

            } catch (imgError) {
                console.error("Error adding drawing image to PDF:", imgError);
                doc.setFontSize(9);
                doc.setTextColor(255, 0, 0); // Red color for error
                doc.text("Error embedding drawing image.", margin, currentY);
                doc.setTextColor(0); // Reset text color
                currentY += 5;
            }
        }
        // --- End Add Drawing Image ---


        // --- Prescriptions Table ---
        if (visit.prescriptions && visit.prescriptions.length > 0) {
            // Check if table needs a new page
            const tableHeaderHeight = 10; // Approximate height of header
            const tableRowHeight = 8 * visit.prescriptions.length; // Rough estimate
            if (currentY + tableHeaderHeight + tableRowHeight > pageHeight - 20) {
                doc.addPage();
                currentY = 15; // Reset Y for new page
            }

            currentY += 5;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text("Prescriptions Issued", margin, currentY);
            currentY += 6;

            autoTable(doc, {
                startY: currentY,
                head: [['Medication', 'Dosage', 'Frequency', 'Notes']],
                body: visit.prescriptions.map(rx => [
                    rx.medication || 'N/A',
                    rx.dosage || 'N/A',
                    rx.frequency || 'N/A',
                    rx.notes || 'N/A'
                ]),
                theme: 'grid',
                headStyles: { fillColor: [60, 70, 90] },
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: {
                    3: { cellWidth: 'auto' }
                },
                margin: { left: margin, right: margin },
                didDrawPage: (data) => {
                    currentY = data.cursor?.y || currentY; // Update Y position
                }
            });
            // autoTable updates currentY via the hook
            currentY += 5;
        } else {
            if (currentY + 15 > pageHeight - 20) { // Check space before adding text
                doc.addPage();
                currentY = 15;
            }
            doc.setFontSize(10);
            doc.setFont('helvetica', 'italic');
            doc.text("No prescriptions were issued during this visit.", margin, currentY);
            currentY += 10;
        }

        // --- Footer (ensure it's drawn on the last page) ---
        const finalPageNum = (doc as any).internal.getNumberOfPages(); // Access internal property
        doc.setPage(finalPageNum); // Go to the last page
        const footerY = pageHeight - 10;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Generated on ${format(new Date(), 'PPP')} | Visit ID: ${visit.id}`, margin, footerY);
        doc.text(`Prescripto Visit Summary`, pageWidth - margin, footerY, { align: 'right' }); // Fixed typo


        doc.save(`Visit_Summary_${patientName.replace(/\s+/g, '_')}_${format(new Date(visit.visit_date), 'yyyyMMdd')}.pdf`);
    };
    // --- End PDF Generation Function ---

    // --- Render Logic ---
    if (authLoading || loading) {
        return (
            <div className="container mx-auto px-4 py-16 text-center text-white">
                <FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-primary-accent" /> Loading visit details...
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto px-4 py-16 text-center">
                <div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg inline-block">
                    Error: {error}
                </div>
            </div>
        );
    }

    if (!visit) {
        return (
            <div className="container mx-auto px-4 py-16 text-center text-white">
                Visit data not found.
            </div>
        );
    }

    // Determine patient/clinician names
    const patientName = visit.patients?.username || 'Patient';
    const clinicianName = visit.clinicians?.username || 'Clinician';
    const isPatientView = authProfile?.role === 'patient';

    return (
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <button
                    onClick={() => navigate(-1)} // Go back
                    className="flex items-center px-4 py-2 border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition duration-200 text-sm font-medium group"
                >
                    <FaArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" /> Back
                </button>
                <h1 className="text-3xl sm:text-4xl font-bold text-white text-center flex-grow">Visit Details</h1>
                <div className="w-24 flex justify-end"> {/* Adjusted spacer width */}
                    {isPatientView && visitId && (
                        <button
                            onClick={() => navigate(`/visit/${visitId}/chat`)}
                            className="flex items-center px-4 py-2 border border-electric-blue text-electric-blue rounded-md hover:bg-electric-blue/10 transition duration-200 text-sm font-medium group active:scale-95"
                            title="Chat with AI about this visit"
                        >
                            <FaRobot className="mr-2 h-4 w-4 group-hover:animate-pulse" /> Chat
                        </button>
                    )}
                </div>
            </div>

            {/* Add Download PDF Button */}
            <div className="mb-6 text-right">
                <button
                    onClick={generateVisitPdf}
                    className="inline-flex items-center px-4 py-2 border border-pastel-blue text-pastel-blue rounded-md shadow-sm text-sm font-medium bg-transparent hover:bg-pastel-blue hover:text-dark-card focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-bg focus:ring-pastel-blue transition duration-150 active:scale-95 group"
                >
                    <FaFileDownload className="mr-2 h-4 w-4" />
                    Download PDF Summary
                </button>
            </div>

            {/* Main Content Card */}
            <div className="bg-dark-card p-6 sm:p-8 rounded-xl shadow-lg border border-border-color animate-fade-in">

                {/* Visit Info Section */}
                <div className="border-b border-border-color/40 pb-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                        <p className="font-semibold text-lg text-primary-accent flex items-center">
                            <FaCalendarAlt className="mr-2.5 h-4 w-4 text-primary-accent/80" />
                            Visit on {format(new Date(visit.visit_date), 'PPPp')}
                        </p>
                        <p className="text-sm text-off-white/70 flex items-center">
                            {isPatientView ? <FaUserMd className="mr-2 h-4 w-4 text-off-white/50" /> : <FaUserCircle className="mr-2 h-4 w-4 text-off-white/50" />}
                            {isPatientView ? `Clinician: ${clinicianName}` : `Patient: ${patientName}`}
                        </p>
                    </div>
                    <p className="text-sm text-off-white/80 flex items-start">
                        <FaRegCommentDots className="mr-2 mt-0.5 h-4 w-4 text-pastel-blue/70 flex-shrink-0" />
                        <span><span className="font-medium text-off-white/90">Reason:</span> {visit.reason || <span className="italic text-off-white/60">N/A</span>}</span>
                    </p>
                </div>

                {/* Visit Notes Section */}
                <div className="mb-6">
                    <h2 className="text-xl font-semibold text-pastel-lavender mb-3 flex items-center">
                        <FaNotesMedical className="mr-2.5 h-5 w-5" />
                        Visit Notes
                    </h2>
                    {visit.notes ? (
                        <p className="text-sm text-off-white/90 whitespace-pre-wrap bg-dark-input/50 p-4 rounded-md border border-border-color/30 font-mono text-xs leading-relaxed">
                            {visit.notes}
                        </p>
                    ) : (
                        <p className="text-sm text-off-white/60 italic pl-1">No notes were recorded for this visit.</p>
                    )}
                </div>

                {/* === REMOVE Chatbot Link Section === */}
                {/* 
                <div className="mt-6 mb-6 pt-6 border-t border-border-color/40">
                    <button
                        onClick={() => navigate(`/visit/${visitId}/chat`)} // Link to visit-specific chat
                        className="w-full group flex items-center justify-center px-4 py-2.5 border border-pastel-mint/60 text-pastel-mint rounded-md hover:bg-pastel-mint/10 hover:border-pastel-mint transition duration-200 text-sm font-medium whitespace-nowrap active:scale-95"
                    >
                        <FaRobot className="mr-2 h-4 w-4 transition-colors duration-200 group-hover:text-pastel-mint" /> Ask AI About This Visit
                    </button>
                    <p className="text-xs text-center mt-2 text-off-white/50">Get explanations about notes or prescriptions from this visit.</p>
                </div>
                */}

                {/* Prescriptions Section (if any) */}
                {visit.prescriptions && visit.prescriptions.length > 0 && (
                    <div className="pt-6 border-t border-border-color/40">
                        <h2 className="text-xl font-semibold text-pastel-blue mb-4 flex items-center">
                            <FaFilePrescription className="mr-2.5 h-5 w-5" />
                            Prescriptions Issued ({visit.prescriptions.length})
                        </h2>
                        <ul className="space-y-4">
                            {visit.prescriptions.map((rx) => (
                                <li key={rx.id} className="bg-dark-input/60 p-4 rounded-lg border border-border-color/50 shadow-sm">
                                    {/* Prescription Header (Medication & Reminder Button) */}
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="font-semibold text-base text-off-white flex items-center">
                                            <FaPills className="mr-2 h-4 w-4 text-pastel-blue/70" />
                                            {rx.medication}
                                        </p>
                                        {/* === Conditionally Render Reminder Button === */}
                                        {isPatientView && (
                                            <button
                                                onClick={() => handleOpenReminderModal(rx)} // Open modal with current rx
                                                className="p-1.5 text-off-white/50 hover:text-pastel-peach hover:bg-pastel-peach/10 rounded-full transition-colors duration-150"
                                                title="Set reminder for this medication"
                                            >
                                                <FaBell className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                    {/* Prescription Details */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs pl-6 text-off-white/80 mb-2">
                                        <span><span className="font-medium text-off-white/90">Dosage:</span> {rx.dosage || 'N/A'}</span>
                                        <span><span className="font-medium text-off-white/90">Frequency:</span> {rx.frequency || 'N/A'}</span>
                                    </div>
                                    {rx.notes && (
                                        <div className="mt-2 pt-2 border-t border-border-color/20 pl-6">
                                            <p className="text-xs font-medium text-off-white/90 mb-0.5 flex items-center">
                                                <FaStickyNote className="mr-1.5 h-3 w-3 text-pastel-lavender/80" /> Notes:
                                            </p>
                                            <p className="text-xs text-off-white/70 italic whitespace-pre-wrap">
                                                {rx.notes}
                                            </p>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            {/* === Render Reminder Modal === */}
            <ReminderModal
                isOpen={isReminderModalOpen}
                onClose={handleCloseReminderModal}
                prescription={selectedPrescriptionForReminder}
            />
        </div>
    );
};

export default VisitDetailPage; 