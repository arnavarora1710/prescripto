package com.hacktech.healthai.controller;

import com.hacktech.healthai.dto.PrescriptionValidationRequest;
import com.hacktech.healthai.dto.ValidationResponse;
import com.hacktech.healthai.service.ValidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/prescriptions")
@RequiredArgsConstructor // Lombok for constructor injection
public class ValidationController {

    // Dependency Injection: Spring injects the service bean
    private final ValidationService validationService;

    @PostMapping("/validate")
    public ResponseEntity<ValidationResponse> validatePrescriptions(
            @RequestBody PrescriptionValidationRequest request) {
        // Delegate the core logic to the service layer
        ValidationResponse response = validationService.validatePrescriptions(request);
        return ResponseEntity.ok(response); // Return 200 OK with the validation results
    }

}