package com.hacktech.healthai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestTemplate;

@Configuration
public class AppConfig {

    /**
     * Creates a RestTemplate bean to be used for making HTTP requests.
     * Spring will manage this bean and inject it where needed (e.g., in OcrServiceImpl).
     * @return A RestTemplate instance.
     */
    @Bean
    public RestTemplate restTemplate() {
        return new RestTemplate();
    }
} 