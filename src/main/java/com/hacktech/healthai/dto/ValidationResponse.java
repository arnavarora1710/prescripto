package com.hacktech.healthai.dto;

import java.util.List;

// Using record for immutable DTO
public record ValidationResponse(
        List<ValidationIssueDto> validationIssues) {
}