package com.hacktech.healthai.service;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.hacktech.healthai.dto.PrescriptionRequestDto;
import com.hacktech.healthai.entity.Prescription;
import com.hacktech.healthai.repository.PrescriptionRepository;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class PrescriptionService {

    private static final Logger logger = LoggerFactory.getLogger(PrescriptionService.class);
    private static final String GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=";
    private final HttpClient httpClient = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_2)
            .connectTimeout(Duration.ofSeconds(20))
            .build();
    private final Gson gson = new Gson();

    @Autowired
    private PrescriptionRepository prescriptionRepository;

    // Inject API Key from environment/application.properties
    @Value("${GEMINI_API_KEY:NOT_FOUND}") // Default value if not found
    private String geminiApiKey;

    // Inject DB properties to verify loading
    @Value("${SUPABASE_HOST:NOT_FOUND}")
    private String supabaseHost;
    @Value("${SUPABASE_DB_USER:NOT_FOUND}")
    private String supabaseDbUser;
    @Value("${SUPABASE_DB_PWD:NOT_FOUND}")
    private String supabaseDbPwd;

    @PostConstruct
    public void verifyConfigLoaded() {
        logger.info("--- Configuration Verification --- ");
        logger.info("SUPABASE_HOST loaded as: {}", supabaseHost);
        logger.info("SUPABASE_DB_USER loaded as: {}", supabaseDbUser);
        // Avoid logging the full password, just check if it looks loaded
        logger.info("SUPABASE_DB_PWD loaded: {}", (supabaseDbPwd != null && !supabaseDbPwd.equals("NOT_FOUND") && !supabaseDbPwd.isEmpty()) ? "Yes" : "NO / NOT_FOUND");
        logger.info("GEMINI_API_KEY loaded: {}", (geminiApiKey != null && !geminiApiKey.equals("NOT_FOUND") && !geminiApiKey.isEmpty()) ? "Yes" : "NO / NOT_FOUND");
        logger.info("----------------------------------");

        if ("NOT_FOUND".equals(geminiApiKey) || "NOT_FOUND".equals(supabaseHost) || "NOT_FOUND".equals(supabaseDbUser) || "NOT_FOUND".equals(supabaseDbPwd) || supabaseDbPwd.isEmpty()) {
             logger.error("CRITICAL: One or more required environment variables (GEMINI_API_KEY, SUPABASE_HOST, SUPABASE_DB_USER, SUPABASE_DB_PWD) were not found. Check .env file and application.properties.");
             // Consider throwing an exception here to prevent application start if config is missing
             // throw new IllegalStateException("Missing required configuration.");
        }
    }

    @Transactional
    public void generateAndSavePrescription(PrescriptionRequestDto requestDto) {
        logger.info("Generating prescription based on request: {}", requestDto);

        // Use the injected API key
        if (geminiApiKey == null || geminiApiKey.isBlank() || "NOT_FOUND".equals(geminiApiKey)) {
            logger.error("GEMINI_API_KEY not configured properly.");
            throw new RuntimeException("API Key configuration error.");
        }

        // 1. Construct Prompt
        String prompt = buildPrompt(requestDto);
        logger.debug("Generated Prompt for LLM: {}", prompt);

        // 2. Call Gemini API
        String llmResponseJson;
        try {
            llmResponseJson = callGeminiApi(prompt, geminiApiKey);
            logger.debug("Received LLM JSON Response: {}", llmResponseJson);
        } catch (Exception e) {
            logger.error("Error calling Gemini API for patientId: {}", requestDto.getPatientId(), e);
            throw new RuntimeException("Failed to get response from Gemini API: " + e.getMessage(), e);
        }

        // 3. Parse LLM Response
        String medication, dosage, frequency;
        String llmResponseText = "Failed to extract text"; // Default if extraction fails
        try {
            llmResponseText = extractTextFromGeminiResponse(llmResponseJson);
            logger.info("Extracted LLM Response Text: {}", llmResponseText);

            Map<String, String> parsedDetails = parsePrescriptionDetails(llmResponseText);
            medication = parsedDetails.getOrDefault("medication", "Parse Error");
            dosage = parsedDetails.getOrDefault("dosage", "Parse Error");
            frequency = parsedDetails.getOrDefault("frequency", "Parse Error");

            if (medication.equals("Parse Error")) {
                 logger.warn("Could not parse medication details from LLM response text: {}", llmResponseText);
            }

        } catch (Exception e) {
            logger.error("Error parsing Gemini API response for patientId: {}: {}", requestDto.getPatientId(), llmResponseJson, e);
            throw new RuntimeException("Failed to parse response from Gemini API: " + e.getMessage(), e);
        }

        String notes = "Generated by AI. LLM Raw Text: " + llmResponseText;
        logger.info("Parsed Prescription Details: Medication={}, Dosage={}, Frequency={}", medication, dosage, frequency);

        // 4. Create Prescription Entity
        Prescription prescription = new Prescription();
        try {
            prescription.setPatientId(UUID.fromString(requestDto.getPatientId()));
            prescription.setClinicianId(UUID.fromString(requestDto.getClinicianId()));
        } catch (IllegalArgumentException e) {
            logger.error("Invalid UUID format provided for patientId or clinicianId: {}", requestDto, e);
            throw new IllegalArgumentException("Invalid patient or clinician ID format.", e);
        }
        prescription.setMedication(medication);
        prescription.setDosage(dosage);
        prescription.setFrequency(frequency);
        prescription.setNotes(notes);
        logger.debug("Prepared Prescription entity: {}", prescription);

        // 5. Save to Database
        try {
            prescriptionRepository.save(prescription);
            logger.info("Prescription saved successfully for patientId: {}", requestDto.getPatientId());
        } catch (Exception e) {
            logger.error("Failed to save prescription to database for patientId: {}", requestDto.getPatientId(), e);
            throw new RuntimeException("Database error while saving prescription.", e);
        }
    }

    private String callGeminiApi(String prompt, String apiKey) throws Exception {
        JsonObject contentPart = new JsonObject();
        contentPart.addProperty("text", prompt);
        JsonArray partsArray = new JsonArray();
        partsArray.add(contentPart);
        JsonObject content = new JsonObject();
        content.add("parts", partsArray);
        JsonArray contentsArray = new JsonArray();
        contentsArray.add(content);
        JsonObject requestBodyJson = new JsonObject();
        requestBodyJson.add("contents", contentsArray);

        String requestBody = gson.toJson(requestBodyJson);
        logger.debug("Sending Gemini Request Body: {}", requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GEMINI_API_BASE_URL + apiKey)) // Use the base URL + key
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            logger.error("Gemini API Error: Status={}, Body={}", response.statusCode(), response.body());
            throw new RuntimeException("Gemini API request failed with status code: " + response.statusCode() + " Body: " + response.body());
        }

        return response.body();
    }

    private String extractTextFromGeminiResponse(String jsonResponse) {
        try {
            JsonObject responseObj = JsonParser.parseString(jsonResponse).getAsJsonObject();
            JsonArray candidates = responseObj.getAsJsonArray("candidates");
            if (candidates != null && !candidates.isEmpty()) {
                JsonObject candidate = candidates.get(0).getAsJsonObject();
                JsonObject content = candidate.getAsJsonObject("content");
                if (content != null) {
                    JsonArray parts = content.getAsJsonArray("parts");
                    if (parts != null && !parts.isEmpty()) {
                        JsonObject part = parts.get(0).getAsJsonObject();
                        if (part.has("text")) {
                            return part.get("text").getAsString();
                        }
                    }
                }
            }
            logger.warn("Could not find 'text' field in the expected path within Gemini response: {}", jsonResponse);
            return "Error: Could not extract text from response";
        } catch (Exception e) {
            logger.error("Failed to parse JSON or extract text from Gemini response: {}", jsonResponse, e);
            return "Error: Failed parsing response structure";
        }
    }

    private Map<String, String> parsePrescriptionDetails(String responseText) {
        Pattern pattern = Pattern.compile("Medication:\s*(.*?)(?:,\s*Dosage:|\s*Dosage:|$)", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(responseText);
        String medication = matcher.find() ? matcher.group(1).trim() : "Parse Error";

        pattern = Pattern.compile("Dosage:\s*(.*?)(?:,\s*Frequency:|\s*Frequency:|$)", Pattern.CASE_INSENSITIVE);
        matcher = pattern.matcher(responseText);
        String dosage = matcher.find() ? matcher.group(1).trim() : "Parse Error";

        pattern = Pattern.compile("Frequency:\s*(.*)", Pattern.CASE_INSENSITIVE);
        matcher = pattern.matcher(responseText);
        String frequency = matcher.find() ? matcher.group(1).trim() : "Parse Error";

        medication = medication.replaceAll("[,.]$", "").trim();
        dosage = dosage.replaceAll("[,.]$", "").trim();
        frequency = frequency.replaceAll("[,.]$", "").trim();

        if (medication.isEmpty() || medication.equals("Parse Error")) medication = "Parse Error";
        if (dosage.isEmpty() || dosage.equals("Parse Error")) dosage = "Parse Error";
        if (frequency.isEmpty() || frequency.equals("Parse Error")) frequency = "Parse Error";

        return Map.of(
                "medication", medication,
                "dosage", dosage,
                "frequency", frequency
        );
    }

    private String buildPrompt(PrescriptionRequestDto requestDto) {
        StringBuilder promptBuilder = new StringBuilder();
        promptBuilder.append("Given the following patient information and visit notes, suggest a prescription.");
        promptBuilder.append("\n\nPatient Medical History/Allergens:\n");
        promptBuilder.append(mapToString(requestDto.getMedicalHistory()));
        promptBuilder.append("\n\nPatient Insurance Details (Consider for formulary/cost if possible):\n");
        promptBuilder.append(mapToString(requestDto.getInsuranceDetails()));
        promptBuilder.append("\n\nVisit Notes (Diagnosis and Treatment Plan):\n");
        promptBuilder.append(requestDto.getVisitNotes());
        promptBuilder.append("\n\nSuggest Medication, Dosage, and Frequency. Format the response clearly, for example: Medication: [Name], Dosage: [Amount], Frequency: [How often]. Respond ONLY with the Medication, Dosage, and Frequency details in the specified format.");

        return promptBuilder.toString();
    }

    private String mapToString(Map<String, Object> map) {
        if (map == null || map.isEmpty()) {
            return "Not Provided";
        }
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, Object> entry : map.entrySet()) {
            sb.append(entry.getKey()).append(": ").append(entry.getValue()).append("\n");
        }
        return sb.toString();
    }
} 