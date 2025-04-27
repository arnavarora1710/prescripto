package com.hacktech.healthai.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Data // Includes @Getter, @Setter, @ToString, @EqualsAndHashCode,
      // @RequiredArgsConstructor
@NoArgsConstructor
@AllArgsConstructor
public class PrescribedDrugDto {
    private String medication;
    private String dosage;
    private String frequency;
    private String notes;
    private String status; // e.g., 'APPROVED', 'REJECTED', 'NEEDS_REVIEW'
    private String rationale; // Rationale for approval/rejection
    private String drugBankId; // Add any other relevant fields from the original FinalPrescription type
    private Double interactionRiskScore; // Or keep this info only in the frontend?
}