package com.hacktech.healthai;

// Removed manual dotenv imports
// import io.github.cdimascio.dotenv.Dotenv;
// import org.slf4j.Logger;
// import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration;

@SpringBootApplication(exclude = {
		DataSourceAutoConfiguration.class,
		HibernateJpaAutoConfiguration.class
})
public class HealthaiApplication {

	// Removed logger as it's not needed here anymore
	// private static final Logger logger =
	// LoggerFactory.getLogger(HealthaiApplication.class);

	public static void main(String[] args) {
		// Removed explicit .env loading logic.
		// spring-dotenv library should handle loading automatically.

		// Run Spring Boot
		SpringApplication.run(HealthaiApplication.class, args);
	}

}
