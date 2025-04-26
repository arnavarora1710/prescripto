package com.hacktech.healthai.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "prescriptions")
public class Prescription {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "clinician_id", nullable = false)
    private Clinician clinician;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "visit_id") // Nullable based on your schema
    private Visit visit;

    @Column(name = "medication", nullable = false, columnDefinition = "TEXT")
    private String medication;

    @Column(name = "dosage", columnDefinition = "TEXT")
    private String dosage;

    @Column(name = "frequency", columnDefinition = "TEXT")
    private String frequency;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "timestamp with time zone")
    private OffsetDateTime createdAt;

    // Constructors, Getters, Setters, etc.
}