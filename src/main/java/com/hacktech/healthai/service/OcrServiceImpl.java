package com.hacktech.healthai.service;

import com.hacktech.healthai.dto.OcrRequestDto;
import com.hacktech.healthai.dto.OcrResponseDto;
import net.sourceforge.tess4j.ITesseract;
import net.sourceforge.tess4j.Tesseract;
import net.sourceforge.tess4j.TesseractException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;

@Service
public class OcrServiceImpl implements OcrService {

    private static final Logger log = LoggerFactory.getLogger(OcrServiceImpl.class);
    private final ITesseract tesseractInstance;

    public OcrServiceImpl() {
        tesseractInstance = new Tesseract();
        // Set the datapath explicitly, overriding environment variable lookup
        String tessDataPath = "/opt/homebrew/share/tessdata";
        tesseractInstance.setDatapath(tessDataPath);
        log.info("Tesseract OCR instance initialized with datapath: {}", tessDataPath);
    }

    @Override
    public OcrResponseDto extractTextFromImage(OcrRequestDto requestDto) throws TesseractException, IOException {
        log.info("Received OCR request (base64 image length: {})",
                requestDto.getBase64Image() != null ? requestDto.getBase64Image().length() : 0);

        if (requestDto.getBase64Image() == null || requestDto.getBase64Image().isEmpty()) {
            throw new IllegalArgumentException("Base64 image data cannot be null or empty.");
        }

        // 1. Decode Base64 string to byte[]
        byte[] imageBytes;
        try {
            // Remove potential data URI prefix (e.g., "data:image/png;base64,")
            String base64Image = requestDto.getBase64Image().substring(requestDto.getBase64Image().indexOf(",") + 1);
            imageBytes = Base64.getDecoder().decode(base64Image);
        } catch (IllegalArgumentException e) {
            log.error("Failed to decode Base64 image string.", e);
            throw new IllegalArgumentException("Invalid Base64 image data.", e);
        }

        // 2. Create BufferedImage from byte[]
        BufferedImage bufferedImage;
        try (ByteArrayInputStream bis = new ByteArrayInputStream(imageBytes)) {
            bufferedImage = ImageIO.read(bis);
            if (bufferedImage == null) {
                throw new IOException("Could not read image data; unsupported format or corrupt data.");
            }
        } catch (IOException e) {
            log.error("Failed to read image bytes into BufferedImage.", e);
            throw e; // Re-throw the exception
        }

        // 3. Perform OCR
        String extractedText;
        try {
            log.info("Performing OCR...");
            extractedText = tesseractInstance.doOCR(bufferedImage);
            log.info("OCR completed successfully.");
        } catch (TesseractException e) {
            log.error("Tesseract OCR processing failed: {}", e.getMessage(), e);
            // Consider checking Tesseract installation and tessdata path.
            throw e; // Re-throw the specific TesseractException
        }

        return new OcrResponseDto(extractedText != null ? extractedText.trim() : "");
    }
}