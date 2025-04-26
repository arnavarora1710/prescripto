package com.hacktech.healthai.dto;

public class LlmResponseDto {
    private String response;

    public LlmResponseDto(String response) {
        this.response = response;
    }

    // Getters and Setters
    public String getResponse() {
        return response;
    }

    public void setResponse(String response) {
        this.response = response;
    }
}