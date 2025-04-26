package com.hacktech.healthai.service;

public interface LlmService {
    /**
     * Sends the given prompt to the configured Large Language Model
     * and returns the generated completion.
     *
     * @param prompt The input text prompt.
     * @return The LLM's response string.
     */
    String getCompletion(String prompt);
}