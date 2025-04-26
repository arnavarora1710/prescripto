package com.hacktech.healthai.dto;

import java.util.List;

// Updated request DTO - Frontend provides necessary data
public record PrescriptionValidationRequest(
                // patientId might still be useful for logging/context, but not for DB lookup
                String patientId,
                List<ProposedPrescriptionDto> proposedPrescriptions,
                List<String> patientAllergies, // Frontend provides known allergies
                List<CurrentPrescriptionDto> currentPrescriptions // Frontend provides current meds
// Add other relevant patient history fields (e.g., conditions) as needed
) {
}