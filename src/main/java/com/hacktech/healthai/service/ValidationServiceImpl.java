package com.hacktech.healthai.service;

import com.hacktech.healthai.dto.PrescriptionValidationRequest;
import com.hacktech.healthai.dto.ProposedPrescriptionDto;
import com.hacktech.healthai.dto.ValidationIssueDto;
import com.hacktech.healthai.dto.ValidationResponse;
import com.hacktech.healthai.dto.CurrentPrescriptionDto;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor // Lombok annotation for constructor injection
public class ValidationServiceImpl implements ValidationService {

    private static final Logger logger = LoggerFactory.getLogger(ValidationServiceImpl.class);

    @Override
    public ValidationResponse validatePrescriptions(PrescriptionValidationRequest request) {
        List<ValidationIssueDto> issues = new ArrayList<>();
        String patientIdForLogging = request.patientId() != null ? request.patientId() : "Unknown";

        // Log the received data for debugging
        logger.debug("Received validation request for patient ID: {}", patientIdForLogging);
        logger.debug("Proposed Prescriptions: {}", request.proposedPrescriptions());
        logger.debug("Provided Allergies: {}", request.patientAllergies());
        logger.debug("Provided Current Prescriptions: {}", request.currentPrescriptions());

        try {
            // Get data directly from the request
            List<String> allergies = request.patientAllergies() != null ? request.patientAllergies()
                    : new ArrayList<>();
            List<CurrentPrescriptionDto> currentPrescriptions = request.currentPrescriptions() != null
                    ? request.currentPrescriptions()
                    : new ArrayList<>();

            // --- Perform Validations using provided data ---
            for (ProposedPrescriptionDto proposed : request.proposedPrescriptions()) {
                // a) Allergy Check (Simple Example: exact match on name)
                if (allergies.stream().anyMatch(allergy -> allergy.equalsIgnoreCase(proposed.medicationName()))) {
                    logger.warn("Potential Allergy for patient {}: {}", patientIdForLogging, proposed.medicationName());
                    issues.add(new ValidationIssueDto("ALLERGY", proposed.medicationName(),
                            "Patient reported allergy to " + proposed.medicationName()));
                }

                // b) Duplicate Therapy Check (Simple Example: exact match on name)
                if (currentPrescriptions.stream().anyMatch(current -> current.medicationName() != null &&
                        current.medicationName().equalsIgnoreCase(proposed.medicationName()))) {
                    logger.warn("Potential Duplicate for patient {}: {}", patientIdForLogging,
                            proposed.medicationName());
                    issues.add(new ValidationIssueDto("DUPLICATE", proposed.medicationName(),
                            "Patient is already prescribed " + proposed.medicationName()));
                }

                // c) Interaction Check (Placeholder - requires external data/library)
                // TODO: Implement drug interaction checks using provided currentPrescriptions
                // list

            }

        } catch (Exception e) {
            logger.error("Error during validation logic for patient ID {}: {}", patientIdForLogging, e.getMessage(), e);
            issues.add(new ValidationIssueDto("VALIDATION_ERROR", "N/A",
                    "An internal error occurred during validation logic."));
        }

        logger.info("Validation complete for patient {}. Found {} issues.", patientIdForLogging, issues.size());
        return new ValidationResponse(issues);
    }
}