package com.hacktech.healthai.dto;

// Using record for immutable DTO
public record ValidationIssueDto(
        String type, // e.g., "ALLERGY", "INTERACTION", "DUPLICATE"
        String medication, // The medication related to the issue
        String details // Description of the issue
) {
}