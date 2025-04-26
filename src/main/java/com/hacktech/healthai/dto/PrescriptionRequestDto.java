package com.hacktech.healthai.dto;

import java.util.Map;

// Using Map<String, Object> for flexibility with Supabase JSON types
// Consider creating more specific nested DTOs if the structure is fixed

public class PrescriptionRequestDto {
    private String patientId;
    private String clinicianId;
    private String visitNotes;
    private Map<String, Object> medicalHistory;
    private Map<String, Object> insuranceDetails;

    // Getters and Setters
    public String getPatientId() {
        return patientId;
    }

    public void setPatientId(String patientId) {
        this.patientId = patientId;
    }

    public String getClinicianId() {
        return clinicianId;
    }

    public void setClinicianId(String clinicianId) {
        this.clinicianId = clinicianId;
    }

    public String getVisitNotes() {
        return visitNotes;
    }

    public void setVisitNotes(String visitNotes) {
        this.visitNotes = visitNotes;
    }

    public Map<String, Object> getMedicalHistory() {
        return medicalHistory;
    }

    public void setMedicalHistory(Map<String, Object> medicalHistory) {
        this.medicalHistory = medicalHistory;
    }

    public Map<String, Object> getInsuranceDetails() {
        return insuranceDetails;
    }

    public void setInsuranceDetails(Map<String, Object> insuranceDetails) {
        this.insuranceDetails = insuranceDetails;
    }

    @Override
    public String toString() {
        return "PrescriptionRequestDto{" +
               "patientId='" + patientId + '\'' +
               ", clinicianId='" + clinicianId + '\'' +
               ", visitNotes='" + (visitNotes != null ? visitNotes.substring(0, Math.min(visitNotes.length(), 50)) + "..." : "null") + '\'' + // Avoid logging large notes
               ", medicalHistory=" + medicalHistory +
               ", insuranceDetails=" + insuranceDetails +
               '}';
    }
} 