package com.hacktech.healthai.dto;

import java.util.Map;

// DTO for insurance coverage details from the insurance_plans table
public record InsuranceCoverageDto(
        String rxNormCode,
        String drugName,
        Integer tier,
        Double copay,
        Boolean covered,
        Boolean priorAuth) {
    // Static factory method to create from JSONB map
    public static InsuranceCoverageDto fromMap(String rxNormCode, Map<String, Object> coverageMap) {
        return new InsuranceCoverageDto(
                rxNormCode,
                (String) coverageMap.getOrDefault("drug_name", "Unknown drug"),
                (Integer) coverageMap.getOrDefault("tier", 999),
                ((Number) coverageMap.getOrDefault("copay", 0.0)).doubleValue(),
                (Boolean) coverageMap.getOrDefault("covered", true),
                (Boolean) coverageMap.getOrDefault("prior_auth", false));
    }
}