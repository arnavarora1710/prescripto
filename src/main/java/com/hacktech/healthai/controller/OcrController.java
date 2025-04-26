package com.hacktech.healthai.controller;

import com.hacktech.healthai.dto.OcrRequestDto;
import com.hacktech.healthai.dto.OcrResponseDto;
import com.hacktech.healthai.service.OcrService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/ocr")
public class OcrController {

    private static final Logger log = LoggerFactory.getLogger(OcrController.class);
    private final OcrService ocrService;

    @Autowired
    public OcrController(OcrService ocrService) {
        this.ocrService = ocrService;
    }

    @PostMapping
    public ResponseEntity<?> performOcr(@RequestBody OcrRequestDto requestDto) {
        if (requestDto == null || requestDto.getBase64Image() == null || requestDto.getBase64Image().isEmpty()) {
            log.warn("Received OCR request with empty or missing image data.");
            // Consider a more specific error response DTO
            return ResponseEntity.badRequest().body("Missing or empty 'base64Image' field in request.");
        }

        try {
            OcrResponseDto responseDto = ocrService.extractTextFromImage(requestDto);
            log.info("Successfully processed OCR request.");
            return ResponseEntity.ok(responseDto);
        } catch (Exception e) {
            log.error("Error processing OCR request: {}", e.getMessage(), e);
            // Consider a more specific error response DTO
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Failed to process image due to an internal error.");
        }
    }
}