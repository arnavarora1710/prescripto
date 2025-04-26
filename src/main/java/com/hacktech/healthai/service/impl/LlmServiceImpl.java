package com.hacktech.healthai.service.impl;

import com.hacktech.healthai.service.LlmService;
import org.springframework.stereotype.Service;

@Service
public class LlmServiceImpl implements LlmService {

    @Override
    public String getCompletion(String prompt) {
        // TODO: Implement actual call to LLM service
        System.out.println("Received prompt in LlmServiceImpl: " + prompt);
        // Return a placeholder response for now
        return "Placeholder LLM response for prompt: [" + prompt + "]";
    }
}