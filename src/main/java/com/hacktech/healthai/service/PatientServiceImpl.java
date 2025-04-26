package com.hacktech.healthai.service;

import org.springframework.stereotype.Service;
import com.hacktech.healthai.dto.PatientDto;

@Service
public class PatientServiceImpl implements PatientService {

    @Override
    public PatientDto createPatient(PatientDto dto) {
        // For now, just echo back the DTO.
        // Later, we’ll persist this to the database.
        return dto;
    }
}