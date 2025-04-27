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
        // Ensure all required data is loaded
        if (!visit || !visit.patients || !visit.clinicians) {
            alert("Visit, patient, or clinician data is not fully loaded. Cannot generate PDF.");
            return;
        }

        setIsGeneratingPdf(true); // Start loading state

        const doc = new jsPDF();
        const margin = 10;
        let yPos = margin + 10; // Initial Y position

        // --- Helper to add text and update yPos ---
        const addText = (text: string | string[], x: number, y: number, options?: any): number => {
            doc.text(text, x, y, options);
            // Estimate height added by text (crude approximation)
            const lines = Array.isArray(text) ? text.length : 1;
            const fontSize = doc.getFontSize();
            // Adjust multiplier as needed based on line spacing etc.
            return y + lines * (fontSize / 2.8); // jsPDF uses points, approx 2.8 pts/mm
        };

        // --- NEW: Parse Copay Info from Notes --- 
        let extractedCopays: string[] = [];
        let totalCopay = 0;
        let copayErrors = 0; // Track errors during parsing

        (visit.prescriptions || []).forEach(rx => {
            let copayInfo = "N/A"; // Default
            if (rx.notes) {
                // Regex to find the embedded copay info
                const match = rx.notes.match(/\|\|\s*COPAY_INFO:\s*(.*?)\s*\|\|/);
                if (match && match[1]) {
                    const potentialCopay = match[1].trim();
                    // Validate the extracted value
                    if (!isNaN(parseFloat(potentialCopay)) || potentialCopay === "Not Covered" || potentialCopay === "N/A" || potentialCopay === "Error") {
                        copayInfo = potentialCopay;
                    } else {
                        console.warn(`Found embedded COPAY_INFO but value was unexpected: "${potentialCopay}" in notes for ${rx.medication}. Defaulting to N/A.`);
                        copayInfo = "N/A"; // Default if format is wrong
                    }
                } else {
                    // If delimiter not found, maybe it wasn't added? Default to N/A
                    console.warn(`COPAY_INFO delimiter not found in notes for ${rx.medication}. Defaulting to N/A.`);
                    copayInfo = "N/A";
                }
            } else {
                copayInfo = "N/A"; // No notes, so N/A
            }
            extractedCopays.push(copayInfo);

            // Calculate total, tracking errors
            if (!isNaN(parseFloat(copayInfo))) {
                totalCopay += parseFloat(copayInfo);
            } else if (copayInfo === "Error") {
                copayErrors++;
            }
        });
        // --- End Copay Parsing ---

        // --- PDF Header --- 
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        yPos = addText('Visit Summary', margin, yPos);
        yPos += 5; // Add some space after the title

        // --- Estimated Copay Rectangle --- 
        const rectX = margin;
        const rectY = yPos;
        const rectWidth = doc.internal.pageSize.getWidth() - 2 * margin;
        const rectHeight = 12; // Adjust height as needed
        const borderRadius = 3;

        doc.setFillColor(220, 255, 220); // Light green background
        doc.roundedRect(rectX, rectY, rectWidth, rectHeight, borderRadius, borderRadius, 'F'); // 'F' for fill

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 100, 0); // Dark green text

        let copayText = `Estimated Total Patient Copay: $${totalCopay.toFixed(2)}`;
        if (copayErrors > 0) {
            copayText += ` (${copayErrors} item(s) could not be analyzed)`;
        } else {
            const nonNumericCount = extractedCopays.filter(c => isNaN(parseFloat(c))).length;
            if (nonNumericCount > 0) {
                copayText += ` (excluding non-covered/N/A items)`;
            }
        }

        // Center the text vertically within the rectangle
        const textWidth = doc.getStringUnitWidth(copayText) * doc.getFontSize() / doc.internal.scaleFactor;
        const textX = rectX + (rectWidth - textWidth) / 2;
        const textY = rectY + rectHeight / 2 + 3; // Adjust '+3' for vertical alignment

        doc.text(copayText, textX, textY);

        doc.setTextColor(0, 0, 0); // Reset text color
        yPos += rectHeight + 8; // Update yPos after the rectangle

        // --- Visit Details Section --- 
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        yPos = addText(`Date: ${format(new Date(visit.visit_date), 'PPPp')}`, margin, yPos);
        // Removed Time line as PPPp includes time
        yPos += 5;

        // --- Patient Details Section --- 
        doc.setFont("helvetica", "bold");
        yPos = addText('Patient Information', margin, yPos);
        doc.setFont("helvetica", "normal");
        // Use visit.patients
        yPos = addText(`Name: ${visit.patients.username || 'N/A'}`, margin, yPos);
        yPos += 5;

        // --- Clinician Details Section --- 
        doc.setFont("helvetica", "bold");
        yPos = addText('Clinician Information', margin, yPos);
        doc.setFont("helvetica", "normal");
        // Use visit.clinicians
        yPos = addText(`Name: ${visit.clinicians.username || 'N/A'}`, margin, yPos);
        yPos += 8;

        // --- Visit Notes Section --- 
        doc.setFont("helvetica", "bold");
        yPos = addText('Visit Notes', margin, yPos);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        // Display notes *without* the embedded copay info
        const notesWithoutCopay = (visit.notes || '').replace(/\|\|\s*COPAY_INFO:.*?\|\|/, '').trim();
        const notesLines = doc.splitTextToSize(notesWithoutCopay || 'No notes recorded.', doc.internal.pageSize.getWidth() - 2 * margin);
        yPos = addText(notesLines, margin, yPos);
        doc.setFontSize(12); // Reset font size
        yPos += 8;

        // --- Prescriptions Table --- 
        doc.setFont("helvetica", "bold");
        yPos = addText('Prescriptions', margin, yPos);
        yPos -= 2; // Adjust space before table

        const prescriptions = visit.prescriptions || [];

        if (prescriptions.length > 0) {
            const head = [['Medication', 'Dosage', 'Frequency', 'Notes', 'Patient Copay']];
            const body = prescriptions.map((rx, index) => {
                // Use the parsed copay from the loop above
                const copayInfo = extractedCopays[index] || 'N/A';
                // Display notes *without* the embedded copay info
                const rxNotesWithoutCopay = (rx.notes || '').replace(/\|\|\s*COPAY_INFO:.*?\|\|/, '').trim();

                return [
                    rx.medication || 'N/A',
                    rx.dosage || 'N/A',
                    rx.frequency || 'N/A',
                    rxNotesWithoutCopay || '', // Use notes without copay info
                    copayInfo, // Use the parsed value
                ];
            });

            autoTable(doc, {
                head: head,
                body: body,
                startY: yPos,
                theme: 'grid',
                headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
                styles: { fontSize: 9, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 'auto' }, // Medication
                    1: { cellWidth: 'auto' }, // Dosage
                    2: { cellWidth: 'auto' }, // Frequency
                    3: { cellWidth: 'auto' }, // Notes
                    4: { cellWidth: 25, halign: 'center' }, // Patient Copay
                },
                // Styling remains the same, uses the parsed copayInfo value
                didParseCell: function (data) {
                    if (data.column.index === 4 && data.cell.section === 'body') {
                        const text = data.cell.text[0]?.trim(); // Get the text content
                        if (!isNaN(parseFloat(text))) { // It's a number (copay amount)
                            data.cell.styles.fillColor = [220, 255, 220]; // Light green background
                            data.cell.styles.textColor = [0, 100, 0];     // Dark green text
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.text = [`$${parseFloat(text).toFixed(2)}`]; // Add $ sign and format
                        } else if (text === "Not Covered") {
                            data.cell.styles.textColor = [255, 0, 0]; // Red text
                            data.cell.styles.fontStyle = 'bold';
                        } else { // N/A or Error
                            data.cell.styles.textColor = [150, 150, 150]; // Grey text
                        }
                    }
                },
                didDrawPage: (_data) => {
                    // Footer can be added here if needed for multi-page docs
                    // console.log("Drew page", _data.pageNumber);
                },
            });

        } else {
            doc.setFont("helvetica", "normal");
            addText('No prescriptions recorded for this visit.', margin, yPos + 5);
        }

        // --- Save the PDF --- 
        // Use patient details from visit state
        doc.save(`Visit_Summary_${visit.patients?.username || 'Patient'}_${format(new Date(visit.visit_date), 'yyyyMMdd')}.pdf`);
        setIsGeneratingPdf(false); // End loading state
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