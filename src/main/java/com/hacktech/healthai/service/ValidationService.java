package com.hacktech.healthai.service;

import com.hacktech.healthai.dto.PrescriptionValidationRequest;
import com.hacktech.healthai.dto.ValidationResponse;

public interface ValidationService {
    ValidationResponse validatePrescriptions(PrescriptionValidationRequest request);
}