package com.hacktech.healthai.dto;

// Represents a currently prescribed medication provided by the frontend
public record CurrentPrescriptionDto(
        String medicationName
// Add dosage, frequency if needed for more complex validation later
) {
}