package com.hacktech.healthai.service;

import com.hacktech.healthai.dto.OcrRequestDto;
import com.hacktech.healthai.dto.OcrResponseDto;

public interface OcrService {

    /**
     * Extracts text from an image provided as a Base64 encoded string.
     *
     * @param requestDto The DTO containing the Base64 encoded image.
     * @return OcrResponseDto containing the extracted text.
     * @throws Exception If OCR processing fails.
     */
    OcrResponseDto extractTextFromImage(OcrRequestDto requestDto) throws Exception;

}