package com.hacktech.healthai.service;

import com.hacktech.healthai.dto.OcrRequestDto;
import com.hacktech.healthai.dto.OcrResponseDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

// Google Cloud Vision Imports
import com.google.cloud.vision.v1.AnnotateImageRequest;
import com.google.cloud.vision.v1.AnnotateImageResponse;
import com.google.cloud.vision.v1.BatchAnnotateImagesResponse;
import com.google.cloud.vision.v1.Feature;
import com.google.cloud.vision.v1.Image;
import com.google.cloud.vision.v1.ImageAnnotatorClient;
import com.google.cloud.vision.v1.ImageSource;
import com.google.protobuf.ByteString;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Service
public class OcrServiceImpl implements OcrService {

    private static final Logger log = LoggerFactory.getLogger(OcrServiceImpl.class);
    private final ImageAnnotatorClient visionClient;
    private final boolean visionApiDisabled;

    @Autowired
    public OcrServiceImpl(@Value("${DISABLE_VISION_API:false}") boolean disableVisionApi) throws IOException {
        this.visionApiDisabled = disableVisionApi;

        if (visionApiDisabled) {
            log.info("Google Cloud Vision API is disabled via configuration. OCR service will return mock responses.");
            this.visionClient = null;
        } else {
            // Initialize the client using Application Default Credentials (ADC)
            // Ensure you have authenticated via `gcloud auth application-default login`
            // or set the GOOGLE_APPLICATION_CREDENTIALS environment variable.
            this.visionClient = ImageAnnotatorClient.create();
            log.info("OcrServiceImpl initialized with Google Cloud Vision client using ADC.");
        }
    }

    @Override
    public OcrResponseDto extractTextFromImage(OcrRequestDto requestDto) throws Exception {
        log.info("Received OCR request for processing (base64 image length: {})",
                requestDto.getBase64Image() != null ? requestDto.getBase64Image().length() : 0);

        if (requestDto.getBase64Image() == null || requestDto.getBase64Image().isEmpty()) {
            throw new IllegalArgumentException("Base64 image data cannot be null or empty.");
        }

        // Return mock response if Vision API is disabled
        if (visionApiDisabled) {
            log.info("Vision API is disabled. Returning mock OCR response.");
            return new OcrResponseDto("OCR processing is disabled. This is a mock response.");
        }

        List<AnnotateImageRequest> requests = new ArrayList<>();
        ByteString imgBytes;

        try {
            String base64Image = requestDto.getBase64Image();
            // Remove potential data URI prefix (e.g., "data:image/png;base64,")
            if (base64Image.contains(",")) {
                base64Image = base64Image.substring(base64Image.indexOf(",") + 1);
            }
            imgBytes = ByteString.copyFrom(Base64.getDecoder().decode(base64Image));
        } catch (IllegalArgumentException e) {
            log.error("Base64 decoding error: {}", e.getMessage(), e);
            throw new Exception("Invalid Base64 image data.");
        }

        Image img = Image.newBuilder().setContent(imgBytes).build();
        Feature feat = Feature.newBuilder().setType(Feature.Type.TEXT_DETECTION).build();
        AnnotateImageRequest visionRequest = AnnotateImageRequest.newBuilder().addFeatures(feat).setImage(img).build();
        requests.add(visionRequest);

        try {
            log.info("Calling Google Cloud Vision batchAnnotateImages...");
            // Performs text detection on the image files
            BatchAnnotateImagesResponse response = visionClient.batchAnnotateImages(requests);
            log.info("Google Cloud Vision processing completed.");
            List<AnnotateImageResponse> responses = response.getResponsesList();

            if (responses.isEmpty()) {
                log.warn("Google Cloud Vision returned no responses.");
                return new OcrResponseDto("No text detected (Vision API returned no response).");
            }

            AnnotateImageResponse res = responses.get(0);
            if (res.hasError()) {
                log.error("Google Cloud Vision API Error: {}", res.getError().getMessage());
                throw new Exception("Google Cloud Vision API Error: " + res.getError().getMessage());
            }

            // Get the full text annotation
            String extractedText = "";
            if (res.hasFullTextAnnotation()) {
                extractedText = res.getFullTextAnnotation().getText();
                log.info("Successfully extracted text from Google Cloud Vision. Text length: {}",
                        extractedText.length());
            } else {
                log.info("Google Cloud Vision did not find any text.");
                extractedText = "No text detected.";
            }

            return new OcrResponseDto(extractedText);

        } catch (Exception e) {
            log.error("Unexpected error during Google Cloud Vision processing: {}", e.getMessage(), e);
            // You might want to check for specific Google Cloud exceptions if needed
            throw new Exception("An unexpected error occurred during OCR processing: " + e.getMessage());
        }
        // Note: The ImageAnnotatorClient should be closed when the application shuts
        // down.
        // Spring Boot manages the lifecycle of beans, so direct closing isn't usually
        // needed here unless explicitly required or using try-with-resources for the
        // client
        // within the method (which creates a new client per request, less efficient).
    }
}