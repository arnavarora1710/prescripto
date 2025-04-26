// Base user information (could be expanded)
export interface UserProfile {
    id: string;       // Patient or Clinician table ID
    user_id: string;  // Corresponds to auth.users.id
    email?: string;   // Fetched separately from auth.users if needed
    created_at: string;
    updated_at: string;
}

export interface Patient extends UserProfile {
    insurance_details: any | null; // Or a more specific type if JSON structure is known
    medical_history: any | null;   // Or a more specific type
}

export interface Clinician extends UserProfile {
    // Add clinician-specific fields if any
}

export interface Prescription {
    id: string;
    patient_id: string;
    clinician_id: string;
    medication: string;
    dosage: string | null;
    frequency: string | null;
    notes: string | null;
    created_at: string;
    // Optionally include clinician details if joined
    clinician_email?: string; 
}

export interface Visit {
    id: string;
    patient_id: string;
    clinician_id: string;
    visit_date: string;
    reason: string | null;
    notes: string | null;
    created_at: string;
    // Optionally include clinician/patient details if joined
    clinician_email?: string;
    patient_email?: string;
} 