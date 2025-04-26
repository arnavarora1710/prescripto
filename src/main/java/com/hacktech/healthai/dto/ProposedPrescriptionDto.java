package com.hacktech.healthai.dto;

// Using record for immutable DTO
public record ProposedPrescriptionDto(
        String medicationName,
        String dosage, // Optional: include for potential dosage checks later
        String frequency // Optional: include for potential frequency checks later
) {
}