import React, { useState } from 'react';
import { FaTimes, FaSpinner, FaCheck } from 'react-icons/fa';
import { Prescription } from '../types/app';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface ReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    prescription: Prescription | null; // Pass the relevant prescription
}

const ReminderModal: React.FC<ReminderModalProps> = ({ isOpen, onClose, prescription }) => {
    const { user } = useAuth();
    const [reminderTime, setReminderTime] = useState('09:00'); // Local time input
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // --- Function to convert local HH:MM to UTC HH:MM ---
    const convertLocalTimeToUTC = (localTime: string): string | null => { // Return null on error
        try {
            console.log("--- Time Conversion Start ---");
            console.log("Input Local Time String:", localTime);
            const [hours, minutes] = localTime.split(':').map(Number);
            console.log("Parsed Hours:", hours, "Minutes:", minutes);
            if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                throw new Error("Invalid time components");
            }
            // Create a date object for today set to the selected local time
            const localDate = new Date();
            localDate.setHours(hours, minutes, 0, 0); // Set local hours/minutes
            console.log("Constructed localDate Object:", localDate.toString()); // Log the full local date string
            console.log("localDate ISO String:", localDate.toISOString()); // Log ISO string (always UTC)
            console.log("localDate getTime():", localDate.getTime()); // Log epoch timestamp

            // Get the UTC hours and minutes
            const utcHours = localDate.getUTCHours();
            const utcMinutes = localDate.getUTCMinutes();
            console.log("Calculated UTC Hours:", utcHours, "UTC Minutes:", utcMinutes);
            const utcHoursStr = utcHours.toString().padStart(2, '0');
            const utcMinutesStr = utcMinutes.toString().padStart(2, '0');
            const result = `${utcHoursStr}:${utcMinutesStr}`;
            console.log("Calculated UTC Time String:", result);
            console.log("--- Time Conversion End ---");

            return result;
        } catch (e) {
            console.error("Error converting time:", e);
            setError("Invalid time format selected.");
            return null; // Indicate error by returning null
        }
    };
    // --- End Time Conversion ---

    const handleSaveReminder = async () => {
        if (!prescription || !user) {
            setError("Cannot save reminder: Missing prescription or user information.");
            return;
        }

        setIsSaving(true);
        setError(null); // Clear previous errors before saving
        setSuccess(false);

        // --- Convert selected local time to UTC ---
        const utcReminderTime = convertLocalTimeToUTC(reminderTime);
        if (utcReminderTime === null) { // Check if conversion failed
            setIsSaving(false);
            // Error state is already set by convertLocalTimeToUTC
            return; // Stop if conversion failed
        }
        console.log(`Saving reminder for ${prescription.medication}. Local Time: ${reminderTime}, UTC Time: ${utcReminderTime}`);
        // -----------------------------------------

        try {
            if (!prescription.patient_id) {
                throw new Error("Patient ID missing from prescription data.");
            }

            const { error: insertError } = await supabase
                .from('medication_reminders')
                .insert({
                    user_id: user.id,
                    patient_id: prescription.patient_id,
                    prescription_id: prescription.id,
                    reminder_time: utcReminderTime, // Store the UTC time string
                    is_active: true,
                });

            if (insertError) {
                if (insertError.code === '23505') {
                    // Check for unique constraint on (prescription_id, user_id) if you add one
                    // Or maybe unique on (prescription_id, reminder_time) ?
                    setError("A reminder might already exist for this medication.");
                } else {
                    throw insertError;
                }
            } else {
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                    // Reset success state when closing automatically
                    setSuccess(false);
                }, 1500);
            }

        } catch (err: any) {
            console.error("Error saving reminder:", err);
            setError(`Failed to save reminder: ${err.message}`);
            setSuccess(false);
        } finally {
            setIsSaving(false);
        }
    };

    // Reset state when modal is closed
    React.useEffect(() => {
        if (!isOpen) {
            setReminderTime('09:00');
            setError(null);
            setSuccess(false);
            setIsSaving(false);
        }
    }, [isOpen]);

    if (!isOpen || !prescription) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={onClose}
        >
            <div
                className="bg-dark-card p-6 rounded-xl shadow-xl border border-border-color w-full max-w-md relative m-4"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1.5 text-off-white/50 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors duration-150"
                    title="Close"
                >
                    <FaTimes className="h-4 w-4" />
                </button>

                <h2 className="text-xl font-semibold text-white mb-4">Set Reminder</h2>
                <p className="text-sm text-primary-accent mb-1">Medication: <span className='font-medium text-off-white'>{prescription.medication}</span></p>
                <p className="text-xs text-off-white/70 mb-5">Select a time (your local time) for your daily reminder.</p> {/* Clarified local time */}

                <div className="space-y-4">
                    <div>
                        <label htmlFor="reminderTime" className="block text-sm font-medium text-off-white/80 mb-1">
                            Reminder Time (Local)
                        </label>
                        <input
                            type="time"
                            id="reminderTime"
                            value={reminderTime}
                            onChange={(e) => {
                                setError(null); // Clear error when user changes time
                                setReminderTime(e.target.value);
                            }}
                            className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-primary-accent focus:ring-1 focus:ring-primary-accent text-sm transition duration-150 text-off-white"
                            disabled={isSaving || success}
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-xs pt-1">{error}</p>
                    )}

                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSaveReminder}
                            disabled={isSaving || success || !!error} // Also disable if there's an error
                            className={`flex items-center justify-center px-5 py-2 min-w-[100px] rounded-md text-sm font-semibold transition duration-150 shadow active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed
                                    ${success ? 'bg-green-600 text-white' : 'bg-primary-accent/80 hover:bg-primary-accent text-dark-bg'}`}
                        >
                            {isSaving ? <FaSpinner className="animate-spin h-4 w-4" /> :
                                success ? <FaCheck className="h-4 w-4" /> :
                                    'Save Reminder'} {/* Updated button text */}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReminderModal;