FROM maven:3.9-eclipse-temurin-21-alpine AS build

WORKDIR /app

# Copy pom.xml first to leverage Docker cache
COPY pom.xml .
# Copy Maven wrapper
COPY .mvn .mvn
COPY mvnw mvnw.cmd ./

# Copy source code
COPY src ./src
COPY static ./static

# Build the Spring Boot application without frontend
RUN mvn clean package -DskipTests -Dfrontend.skip=true

# Final image
FROM eclipse-temurin:21-jre

WORKDIR /app

# Copy JAR from build stage
COPY --from=build /app/target/*.jar app.jar

# Copy the latest frontend build directly
COPY static/dist /app/static/

# Copy Google Cloud service account key
COPY gcloud-key.json /app/gcloud-key.json

# Environment variables
ENV SPRING_PROFILES_ACTIVE=docker
ENV SPRING_WEB_RESOURCES_STATIC_LOCATIONS=file:/app/static/
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/gcloud-key.json

# Expose port
EXPOSE 8080

# Run the application
ENTRYPOINT ["java", "-jar", "app.jar"] 