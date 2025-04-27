import React, { useState, useEffect } from 'react';
// Remove unused supabase import
// import { supabase } from '../lib/supabaseClient';
// Removed User, PatientWithUser, ClinicianWithUser imports
import { Patient, Clinician } from '../types/app'; // Keep Patient and Clinician
import { Session } from '@supabase/supabase-js';

interface ProfileManagementProps {
    session: Session | null;
    profileId: string | null;
    userRole: 'patient' | 'clinician' | null;
}

const ProfileManagement: React.FC<ProfileManagementProps> = ({ session, profileId, userRole }) => {
    // Update state types to use correct interfaces
    const [patient, setPatient] = useState<Patient | null>(null);
    const [clinician, setClinician] = useState<Clinician | null>(null);
    // Removed unused user state
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Mock fetch functions (replace with actual Supabase calls)
    const fetchPatientDetails = async (patientId: string, userId: string) => {
        console.log(`Mock fetching patient details for patientId: ${patientId}, userId: ${userId}`);
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        // Provide mock data conforming to the Patient interface
        setPatient({
            id: patientId, // Keep as string
            user_id: userId, // Keep as string
            username: `mock_patient_${userId}`, // Example username
            created_at: new Date().toISOString(), // Add required created_at
            medical_history: null, // Add required field
            insurance_details: null, // Add required field
            // Add optional fields if needed/available
            // profile_picture_url: null,
            // preferred_language: 'en',
        });
    };

    const fetchClinicianDetails = async (clinicianId: string, userId: string) => {
        console.log(`Mock fetching clinician details for clinicianId: ${clinicianId}, userId: ${userId}`);
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        // Provide mock data conforming to the Clinician interface
        setClinician({
            id: clinicianId, // Keep as string
            user_id: userId, // Keep as string
            username: `mock_clinician_${userId}`, // Example username
            created_at: new Date().toISOString(), // Add required created_at
            // Add optional fields if needed/available
            // profile_picture_url: null,
        });
    };


    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            setError(null);

            // Ensure session, user, profileId, and userRole are available
            if (!session?.user || !profileId || !userRole) {
                setError("User session, profile ID, or role is missing.");
                setLoading(false);
                return;
            }

            const userId = session.user.id; // userId is available directly

            try {
                if (userRole === 'patient') {
                    // Call mock fetch for patient
                    await fetchPatientDetails(profileId, userId); // Pass profileId and userId as strings
                } else if (userRole === 'clinician') {
                    // Call mock fetch for clinician
                    await fetchClinicianDetails(profileId, userId); // Pass profileId and userId as strings
                } else {
                    setError("Invalid user role specified.");
                }
            } catch (err) {
                console.error("Error fetching profile:", err);
                setError(err instanceof Error ? err.message : "An unknown error occurred");
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [session, profileId, userRole]); // Dependencies remain the same

    // Render logic based on patient or clinician data
    const renderProfileDetails = () => {
        if (userRole === 'patient' && patient) {
            return (
                <div>
                    <h3>Patient Profile</h3>
                    {/* Display patient-specific details */}
                    <p><strong>Patient ID:</strong> {patient.id}</p>
                    <p><strong>User ID:</strong> {patient.user_id}</p>
                    <p><strong>Username:</strong> {patient.username || 'N/A'}</p>
                    <p><strong>Created At:</strong> {new Date(patient.created_at).toLocaleDateString()}</p>
                    {/* Add other relevant patient fields */}
                    <p><strong>Medical History:</strong> {JSON.stringify(patient.medical_history) || 'N/A'}</p>
                    <p><strong>Insurance Details:</strong> {JSON.stringify(patient.insurance_details) || 'N/A'}</p>
                    <p><strong>Preferred Language:</strong> {patient.preferred_language || 'N/A'}</p>
                    <p><strong>Profile Picture URL:</strong> {patient.profile_picture_url || 'N/A'}</p>
                </div>
            );
        } else if (userRole === 'clinician' && clinician) {
            return (
                <div>
                    <h3>Clinician Profile</h3>
                    {/* Display clinician-specific details */}
                    <p><strong>Clinician ID:</strong> {clinician.id}</p>
                    <p><strong>User ID:</strong> {clinician.user_id}</p>
                    <p><strong>Username:</strong> {clinician.username || 'N/A'}</p>
                    <p><strong>Created At:</strong> {new Date(clinician.created_at).toLocaleDateString()}</p>
                    <p><strong>Profile Picture URL:</strong> {clinician.profile_picture_url || 'N/A'}</p>
                    {/* Add other relevant clinician fields */}
                </div>
            );
        }
        return <p>No profile data to display.</p>; // Fallback message
    };

    // Add loading and error handling in the main return
    if (loading) {
        return <div>Loading profile...</div>; // Basic loading indicator
    }

    if (error) {
        return <div style={{ color: 'red' }}>Error: {error}</div>; // Basic error display
    }

    return (
        <div>
            {renderProfileDetails()}
        </div>
    );
};

export default ProfileManagement; 