package com.hacktech.healthai.controller;

import com.hacktech.healthai.dto.LlmRequestDto;
import com.hacktech.healthai.dto.LlmResponseDto;
import com.hacktech.healthai.service.LlmService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/llm")
public class LlmController {

    private final LlmService llmService;

    @Autowired
    public LlmController(LlmService llmService) {
        this.llmService = llmService;
    }

    @PostMapping("/completion")
    public LlmResponseDto getLlmCompletion(@RequestBody LlmRequestDto requestDto) {
        String response = llmService.getCompletion(requestDto.getPrompt());
        return new LlmResponseDto(response);
    }
}