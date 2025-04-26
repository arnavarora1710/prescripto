package com.hacktech.healthai.dto;

public class OcrRequestDto {

    private String base64Image;

    // Default constructor (required for Jackson deserialization)
    public OcrRequestDto() {
    }

    // Constructor with fields
    public OcrRequestDto(String base64Image) {
        this.base64Image = base64Image;
    }

    // Getter
    public String getBase64Image() {
        return base64Image;
    }

    // Setter
    public void setBase64Image(String base64Image) {
        this.base64Image = base64Image;
    }
}