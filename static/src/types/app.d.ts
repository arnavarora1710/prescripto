// Define a type for flexible JSON storage
export type JSONValue = string | number | boolean | null | JSONValue[] | { [key: string]: JSONValue };

export interface Patient {
    id: string;
    user_id: string;
    username: string | null;
    medical_history?: JSONValue | null; // Store conditions, allergies, etc.
    insurance_details?: JSONValue | null; // Store provider, policy number, etc.
    profile_picture_url?: string | null;
    created_at: string;
    preferred_language?: string | null; // Add preferred language field
}

export interface Clinician {
    clinician_id: string;
}

export interface Visit {
    created_at: string;
}

export interface Prescription {
    created_at: string;
}

// Add other interfaces if needed 