// Define the structure for Patient data
export interface Patient {
    id: string;
    user_id: string;
    username: string | null;
    created_at: string;
    medical_history: JSONValue | null;
    insurance_details: JSONValue | null;
    profile_picture_url?: string | null;
    preferred_language?: string | null;
}

// Define the structure for Clinician data
export interface Clinician {
    id: string;
    user_id: string;
    username: string | null;
    created_at: string;
    profile_picture_url?: string | null;
}

// Base user information (could be expanded)
export interface UserProfile {
    userId: string;
    profileId: string; // ID from either patients or clinicians table
    role: 'patient' | 'clinician' | null;
    email?: string;
    username?: string | null;
    profilePictureUrl?: string | null;
}

// Define the structure for Prescription data
export interface Prescription {
    id: string;
    patient_id: string;
    clinician_id: string;
    visit_id?: string | null; // Now includes visit_id
    medication: string;
    dosage: string | null;
    frequency: string | null;
    notes: string | null;
    created_at: string;
    // Optional: Add fields if you join clinician/patient names in queries
    clinicians?: { username?: string | null };
}

// Define the structure for Visit data
export interface Visit {
    id: string;
    patient_id: string;
    clinician_id: string;
    visit_date: string; // ISO 8601 format
    reason: string | null;
    notes: string | null;
    created_at: string;
    // Optional: Add fields if you join clinician/patient names in queries
    clinicians?: { username?: string | null };
    patients?: { username?: string | null };
    patient_username?: string; // This might come from specific RPC calls
    // Add the embedded prescriptions array
    prescriptions?: Prescription[];
}

// Type for JSON data (e.g., medical history, insurance)
export type JSONValue =
    | string
    | number
    | boolean
    | null
    | { [key: string]: JSONValue }
    | JSONValue[]; 