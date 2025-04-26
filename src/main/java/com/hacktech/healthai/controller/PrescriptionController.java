package com.hacktech.healthai.controller;

import com.hacktech.healthai.dto.PrescriptionRequestDto;
import com.hacktech.healthai.service.PrescriptionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/prescriptions")
public class PrescriptionController {

    private static final Logger logger = LoggerFactory.getLogger(PrescriptionController.class);

    @Autowired
    private PrescriptionService prescriptionService;

    @PostMapping("/generate")
    public ResponseEntity<?> generatePrescription(@RequestBody PrescriptionRequestDto requestDto) {
        logger.info("Received request to generate prescription: {}", requestDto);
        try {
            // TODO: Replace with actual service call and response handling
            prescriptionService.generateAndSavePrescription(requestDto);
            logger.info("Prescription generation process initiated successfully for patientId: {}", requestDto.getPatientId());
            // Return a simple success response for now
            return ResponseEntity.ok().body("{\"message\": \"Prescription generation started successfully.\"}");
        } catch (Exception e) {
            logger.error("Error initiating prescription generation for patientId: {}", requestDto.getPatientId(), e);
            // Return a generic error response
            return ResponseEntity.internalServerError().body("{\"error\": \"Failed to start prescription generation: " + e.getMessage() + "\"}");
        }
    }
} 