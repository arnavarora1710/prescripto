package com.hacktech.healthai.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.GenericGenerator;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "prescriptions")
public class Prescription {

    @Id
    @GeneratedValue(generator = "UUID")
    @GenericGenerator(
        name = "UUID",
        strategy = "org.hibernate.id.UUIDGenerator"
    )
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "clinician_id", nullable = false)
    private UUID clinicianId;

    @Column(name = "medication", nullable = false)
    private String medication;

    @Column(name = "dosage")
    private String dosage;

    @Column(name = "frequency")
    private String frequency;

    @Column(name = "notes")
    private String notes;

    @CreationTimestamp // Automatically set the value on creation
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getPatientId() {
        return patientId;
    }

    public void setPatientId(UUID patientId) {
        this.patientId = patientId;
    }

    public UUID getClinicianId() {
        return clinicianId;
    }

    public void setClinicianId(UUID clinicianId) {
        this.clinicianId = clinicianId;
    }

    public String getMedication() {
        return medication;
    }

    public void setMedication(String medication) {
        this.medication = medication;
    }

    public String getDosage() {
        return dosage;
    }

    public void setDosage(String dosage) {
        this.dosage = dosage;
    }

    public String getFrequency() {
        return frequency;
    }

    public void setFrequency(String frequency) {
        this.frequency = frequency;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public String toString() {
        return "Prescription{" +
                "id=" + id +
                ", patientId=" + patientId +
                ", clinicianId=" + clinicianId +
                ", medication='" + medication + '\'' +
                ", dosage='" + dosage + '\'' +
                ", frequency='" + frequency + '\'' +
                ", notes='" + notes + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
} 