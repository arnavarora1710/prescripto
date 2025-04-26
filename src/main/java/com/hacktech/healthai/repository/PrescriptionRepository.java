package com.hacktech.healthai.repository;

import com.hacktech.healthai.entity.Prescription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface PrescriptionRepository extends JpaRepository<Prescription, UUID> {
    // Basic CRUD methods are inherited
    // Add custom query methods here if needed later
} 