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

    // === State for PDF Generation ===
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    // --- PDF Generation Function ---
    const generateVisitPdf = async () => {
        if (!visit || !visit.patients || !visit.clinicians) {
            alert("Visit, patient, or clinician data is not fully loaded. Cannot generate PDF.");
            return;
        }

        setIsGeneratingPdf(true); // Start loading state

        const doc = new jsPDF();
        const pageHeight = doc.internal.pageSize.getHeight();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15; // Slightly larger margin
        const contentWidth = pageWidth - 2 * margin;
        let yPos = 0; // Start Y position from top

        // --- Theme Colors (Approximated from Tailwind config) ---
        // Remove unused colors
        // const electricBlue = [0, 255, 255]; // electric-blue approx RGB
        // const darkBg = [10, 10, 10]; // dark-bg approx RGB
        // const offWhite = [224, 224, 224]; // off-white approx RGB
        // Explicitly type headerColor as a tuple
        const headerColor: [number, number, number] = [0, 100, 150]; // Darker blue for header text

        // --- Helper to add text and update yPos ---
        const addText = (text: string | string[], x: number, y: number, options?: any): number => {
            doc.text(text, x, y, options);
            const lines = Array.isArray(text) ? text.length : 1;
            const fontSize = options?.fontSize || doc.getFontSize(); // Use provided size or current
            return y + lines * (fontSize / 2.8) + 1; // Add a little extra line spacing
        };

        // --- PDF Header Bar --- 
        doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]); // Use dark blue
        doc.rect(0, 0, pageWidth, 20, 'F'); // Filled rectangle for header
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255); // White text
        doc.text("Visit Summary", margin, 13); // Position text within header
        yPos = 25; // Start content below header

        // --- Reset colors ---
        doc.setTextColor(0, 0, 0); // Black text for body
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        // --- Parse Copay Info --- 
        let extractedCopays: string[] = [];
        let totalCopay = 0;
        let copayErrors = 0;
        (visit.prescriptions || []).forEach(rx => {
            let copayInfo = "N/A";
            if (rx.notes) {
                const match = rx.notes.match(/\|\|\s*COPAY_INFO:\s*(.*?)\s*\|\|/);
                if (match && match[1]) {
                    const potentialCopay = match[1].trim();
                    if (!isNaN(parseFloat(potentialCopay)) || ["Not Covered", "N/A", "Error"].includes(potentialCopay)) {
                        copayInfo = potentialCopay;
                    } else { copayInfo = "N/A"; }
                } else { copayInfo = "N/A"; }
            } else { copayInfo = "N/A"; }
            extractedCopays.push(copayInfo);
            if (!isNaN(parseFloat(copayInfo))) { totalCopay += parseFloat(copayInfo); }
            else if (copayInfo === "Error") { copayErrors++; }
        });

        // --- Estimated Copay Banner --- 
        doc.setFillColor(230, 245, 255); // Lighter blue background
        doc.setDrawColor(180, 210, 240); // Border color for banner
        doc.setLineWidth(0.3);
        doc.rect(margin, yPos, contentWidth, 10, 'FD'); // Fill and stroke rectangle
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(50, 70, 90); // Darker text for contrast
        let copayText = `Estimated Total Patient Copay: $${totalCopay.toFixed(2)}`;
        if (copayErrors > 0) { copayText += ` (${copayErrors} item(s) could not be analyzed)`; }
        else { const nonNum = extractedCopays.filter(c => isNaN(parseFloat(c))).length; if (nonNum > 0) { copayText += ` (excluding non-covered/N/A)`; } }
        doc.text(copayText, margin + 2, yPos + 6.5);
        yPos += 15; // Update yPos below banner
        doc.setTextColor(0, 0, 0); // Reset text color

        // --- Visit Details Section --- 
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        yPos = addText('Visit Details', margin, yPos, { fontSize: 12 });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        yPos = addText(`Date: ${format(new Date(visit.visit_date), 'PPPp')}`, margin, yPos, { fontSize: 10 });
        yPos = addText(`Reason: ${visit.reason || 'N/A'}`, margin, yPos, { fontSize: 10 });
        yPos += 4;

        // --- Patient Information Section --- 
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        yPos = addText('Patient Information', margin, yPos, { fontSize: 12 });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        yPos = addText(`Name: ${visit.patients.username || 'N/A'}`, margin, yPos, { fontSize: 10 });
        yPos += 4;

        // --- Clinician Information Section --- 
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        yPos = addText('Clinician Information', margin, yPos, { fontSize: 12 });
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        yPos = addText(`Name: ${visit.clinicians.username || 'N/A'}`, margin, yPos, { fontSize: 10 });
        yPos += 4;

        // --- Visit Notes Section --- 
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        yPos = addText('Visit Notes', margin, yPos, { fontSize: 12 });
        doc.setFontSize(9); // Smaller font for notes
        doc.setFont("helvetica", "normal");
        const notesWithoutCopay = (visit.notes || '').replace(/\|\|\s*COPAY_INFO:.*?\|\|/, '').trim();
        const notesLines = doc.splitTextToSize(notesWithoutCopay || 'No notes recorded.', contentWidth);
        // Add simple background box for notes
        doc.setFillColor(245, 245, 245); // Very light grey
        doc.setDrawColor(220, 220, 220);
        doc.rect(margin, yPos, contentWidth, notesLines.length * (doc.getFontSize() / 2.8) + 4, 'FD');
        yPos = addText(notesLines, margin + 2, yPos + 2, { fontSize: 9 }); // Indent text slightly
        doc.setFontSize(10); // Reset font size
        yPos += 5;

        // --- Prescriptions Table --- 
        const prescriptions = visit.prescriptions || [];
        if (prescriptions.length > 0) {
            doc.setFontSize(12);
            doc.setFont("helvetica", "bold");
            yPos = addText('Prescriptions Issued', margin, yPos, { fontSize: 12 });
            yPos += 2; // Space before table starts

            const head = [['Medication', 'Dosage', 'Frequency', 'Notes', 'Patient Copay']];
            const body = prescriptions.map((rx, index) => {
                const copayInfo = extractedCopays[index] || 'N/A';
                const rxNotesWithoutCopay = (rx.notes || '').replace(/\|\|\s*COPAY_INFO:.*?\|\|/, '').trim();
                return [
                    rx.medication || 'N/A',
                    rx.dosage || 'N/A',
                    rx.frequency || 'N/A',
                    rxNotesWithoutCopay || '',
                    copayInfo,
                ];
            });

            autoTable(doc, {
                head: head,
                body: body,
                startY: yPos,
                theme: 'grid',
                margin: { left: margin, right: margin }, // Ensure table respects margins
                headStyles: {
                    fillColor: headerColor, // Use theme color
                    textColor: 255,
                    fontStyle: 'bold',
                    fontSize: 9,
                    halign: 'center'
                },
                styles: {
                    fontSize: 8.5,
                    cellPadding: 2.5,
                    valign: 'middle'
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245] // Light grey for alternate rows
                },
                columnStyles: {
                    0: { cellWidth: 'auto' }, // Medication
                    1: { cellWidth: 'auto' }, // Dosage
                    2: { cellWidth: 'auto' }, // Frequency
                    3: { cellWidth: 'auto' }, // Notes (expand)
                    4: { cellWidth: 25, halign: 'center' }, // Patient Copay
                },
                didParseCell: function (data) {
                    // Copay styling remains the same
                    if (data.column.index === 4 && data.cell.section === 'body') {
                        const text = data.cell.text[0]?.trim();
                        if (!isNaN(parseFloat(text))) {
                            data.cell.styles.fillColor = [220, 255, 220];
                            data.cell.styles.textColor = [0, 100, 0];
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.text = [`$${parseFloat(text).toFixed(2)}`];
                        } else if (text === "Not Covered") {
                            data.cell.styles.textColor = [200, 0, 0]; // Slightly less intense red
                            data.cell.styles.fontStyle = 'bold';
                        } else {
                            data.cell.styles.textColor = [128, 128, 128]; // Darker Grey text
                        }
                    }
                    // Prevent notes cell from becoming too tall
                    if (data.column.index === 3 && data.cell.section === 'body') {
                        if (data.cell.text && data.cell.text.length > 50) { // Limit notes display length in PDF table
                            data.cell.text = [data.cell.text[0].substring(0, 50) + '...'];
                        }
                    }
                },
                didDrawPage: (data) => {
                    // --- Footer on each page ---
                    doc.setFontSize(8);
                    doc.setTextColor(150, 150, 150); // Grey footer text
                    const footerText = `Generated on ${format(new Date(), 'PPP')}`;
                    const pageNumText = `Page ${data.pageNumber}`;
                    doc.text(footerText, margin, pageHeight - 8);
                    doc.text(pageNumText, pageWidth - margin - doc.getStringUnitWidth(pageNumText) * doc.getFontSize() / doc.internal.scaleFactor, pageHeight - 8);
                },
            });

        } else {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(10);
            addText('No prescriptions recorded for this visit.', margin, yPos + 3, { fontSize: 10 });
        }

        // --- Save the PDF --- 
        doc.save(`Visit_Summary_${visit.patients?.username || 'Patient'}_${format(new Date(visit.visit_date), 'yyyyMMdd')}.pdf`);
        setIsGeneratingPdf(false); // End loading state
    };
    // --- End PDF Generation Function ---

    // === Render Logic ===
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

    // Determine patient/clinician names using visit data
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
                    disabled={isGeneratingPdf || !visit || !visit.patients || !visit.clinicians}
                    className={`flex items-center justify-center px-4 py-2 border rounded-md text-sm font-medium transition duration-150 active:scale-95 ${isGeneratingPdf
                        ? 'border-border-color bg-dark-input text-off-white/50 cursor-not-allowed'
                        : 'border-primary-accent text-primary-accent bg-transparent hover:bg-primary-accent/10 hover:text-primary-accent' // Style similar to other primary actions
                        }`}
                >
                    {isGeneratingPdf ? (
                        <>
                            <FaSpinner className="animate-spin mr-2 h-4 w-4" />
                            Generating PDF...
                        </>
                    ) : (
                        <>
                            <FaFileDownload className="mr-2 h-4 w-4" />
                            Download Visit Summary (PDF)
                        </>
                    )}
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
                                                {(rx.notes || '').replace(/\|\|\s*COPAY_INFO:.*?\|\|/, '').trim()}
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