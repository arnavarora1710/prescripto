package com.hacktech.healthai.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(name = "patients")
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private UUID id;

    @Column(name = "user_id", unique = true, nullable = false)
    private UUID userId; // Matches auth.users(id)

    @Column(name = "username", unique = true)
    private String username;

    @Column(name = "profile_picture_url", columnDefinition = "TEXT")
    private String profilePictureUrl;

    // Map JSONB to String for now, use @JdbcTypeCode(SqlTypes.JSON) for better type
    // safety if needed
    @Column(name = "insurance_details", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) // Recommended for portability
    private String insuranceDetails;

    @Column(name = "medical_history", columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON) // Recommended for portability
    private String medicalHistory;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false, columnDefinition = "timestamp with time zone")
    private OffsetDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false, columnDefinition = "timestamp with time zone")
    private OffsetDateTime updatedAt;

    // Relationships
    @OneToMany(mappedBy = "patient", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Visit> visits;

    @OneToMany(mappedBy = "patient", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Prescription> prescriptions;

    // Constructors, Getters, Setters, etc. (Lombok handles basic getters/setters)
}