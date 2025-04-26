package com.hacktech.healthai.dto;

public class PatientDto {
    private Long id; // will be null on create
    private String name;
    private String allergy; // e.g. “penicillin”
    private String insurance; // e.g. “BlueCross PPO”
}
