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
    // Placeholder state and logic
    const [reminderTime, setReminderTime] = useState('09:00'); // Default time
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleSaveReminder = async () => {
        if (!prescription || !user) {
            setError("Cannot save reminder: Missing prescription or user information.");
            return;
        }
        setIsSaving(true);
        setError(null);
        setSuccess(false);
        console.log(`Saving reminder for ${prescription.medication} at ${reminderTime}`);
        // --- Updated Supabase call --- 
        try {
            // Ensure patient_id is available on the prescription object
            if (!prescription.patient_id) {
                throw new Error("Patient ID missing from prescription data.");
            }

            const { error: insertError } = await supabase
                .from('medication_reminders')
                .insert({
                    user_id: user.id,
                    patient_id: prescription.patient_id, // Get patient_id from the prescription prop
                    prescription_id: prescription.id,
                    reminder_time: reminderTime, // Format HH:MM is okay for TIME type
                    is_active: true, // Default to active
                });

            if (insertError) {
                // Handle potential unique constraint violation gracefully
                if (insertError.code === '23505') { // Code for unique_violation
                    setError("A reminder already exists for this medication at this time.");
                } else {
                    throw insertError;
                }
            } else {
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                }, 1500);
            }

        } catch (err: any) {
            console.error("Error saving reminder:", err);
            setError(`Failed to save reminder: ${err.message}`);
            setSuccess(false); // Ensure success is false on error
        } finally {
            setIsSaving(false);
        }
        // --- End Placeholder ---
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
            onClick={onClose} // Close on overlay click
        >
            <div
                className="bg-dark-card p-6 rounded-xl shadow-xl border border-border-color w-full max-w-md relative m-4"
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-1.5 text-off-white/50 hover:text-red-400 hover:bg-red-900/20 rounded-full transition-colors duration-150"
                    title="Close"
                >
                    <FaTimes className="h-4 w-4" />
                </button>

                <h2 className="text-xl font-semibold text-white mb-4">Set Reminder</h2>
                <p className="text-sm text-primary-accent mb-1">Medication: <span className='font-medium text-off-white'>{prescription.medication}</span></p>
                <p className="text-xs text-off-white/70 mb-5">Select a time for your daily reminder.</p>

                {/* Reminder Form */}
                <div className="space-y-4">
                    <div>
                        <label htmlFor="reminderTime" className="block text-sm font-medium text-off-white/80 mb-1">
                            Reminder Time
                        </label>
                        <input
                            type="time"
                            id="reminderTime"
                            value={reminderTime}
                            onChange={(e) => setReminderTime(e.target.value)}
                            className="w-full px-3 py-2 rounded-md bg-dark-input border border-border-color/70 focus:border-primary-accent focus:ring-1 focus:ring-primary-accent text-sm transition duration-150 text-off-white"
                            disabled={isSaving || success}
                        />
                        {/* Add frequency options later if needed (daily, specific days, etc.) */}
                    </div>

                    {error && (
                        <p className="text-red-400 text-xs">Error: {error}</p>
                    )}

                    {/* Save Button */}
                    <div className="flex justify-end pt-2">
                        <button
                            onClick={handleSaveReminder}
                            disabled={isSaving || success}
                            className={`flex items-center justify-center px-5 py-2 min-w-[100px] rounded-md text-sm font-semibold transition duration-150 shadow active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed 
                                    ${success ? 'bg-green-600 text-white' : 'bg-primary-accent/80 hover:bg-primary-accent text-dark-bg'}`}
                        >
                            {isSaving ? <FaSpinner className="animate-spin h-4 w-4" /> :
                                success ? <FaCheck className="h-4 w-4" /> :
                                    'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReminderModal; 