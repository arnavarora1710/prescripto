package com.hacktech.healthai.dto;

public class OcrResponseDto {

    private String extractedText;

    // Default constructor
    public OcrResponseDto() {
    }

    // Constructor with fields
    public OcrResponseDto(String extractedText) {
        this.extractedText = extractedText;
    }

    // Getter
    public String getExtractedText() {
        return extractedText;
    }

    // Setter
    public void setExtractedText(String extractedText) {
        this.extractedText = extractedText;
    }
}