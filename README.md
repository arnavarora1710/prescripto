# Prescripto 🚀

**Your AI + Doctor–Powered Prescription Companion**

<p align="center">
  <video controls loop muted width="720">
    <source src="https://github.com/arnavarora1710/prescripto/blob/4cf88263917c7cafeb7942dc5f5961bf9a34d73f/static/public/trailer.mp4?raw=true" type="video/mp4" />
    🎬 Your browser does not support embedded videos.
  </video>
</p>

---

## Project Overview

### 1️⃣ User Experience & Design

- **Intuitive 3-step flow**: Search patient → capture notes (text or drawing) → review AI suggestions.
- **Slick UI/UX**: Responsive layouts, clear icons, consistent colors, accessible components.
- **Innovative drawing sync**: QR-code integration for real-time tablet sketching.

### 2️⃣ Impact

- Solves a **widespread pain point**: eliminates confusion around dosing, allergies, and copays.
- Drives **medication adherence** by surfacing hidden interactions and cost surprises.
- Empowers patients & clinicians with **transparent decision support**.

### 3️⃣ Functionality

- **Full demo ready**: register clinician, search/select patient, generate/approve prescriptions.
- **AI transcription**: Gemini-powered OCR for hand-drawn notes.
- **Supabase backend**: stores visits, prescriptions, and drawing updates.

### 4️⃣ Scalability

- **Modular Spring Boot** backend with CSP endpoint—scales horizontally.
- **Postgres + Supabase**: connection pooling, role-based access, seamless upgrades.
- Plug-and-play for real insurance APIs & FHIR standards.

### 5️⃣ AI/ML Implementation

- **Dual Gemini integrations**: LLM prescription suggestion & LLM-guided copay extraction.
- **Advanced prompt engineering**: allergy-safe, coverage-aware recommendations.
- **Server-side orchestration** ensures secure API usage & low latency.

## 🚀 Getting Started

**Prerequisites:** Node.js, Java 17, Maven/Gradle, Supabase account, Gemini API key.

1. **Clone the repo**
   ```bash
   git clone https://github.com/yourorg/prescripto.git
   cd prescripto
   ```
2. **Install & Configure**
   - Frontend: `cd static && npm install && cp .env.example .env && fill in keys`
   - Backend: `cd main && mvn clean install`
3. **Run services**
   ```bash
   # Start Supabase (if self-hosted) or ensure credentials in .env
   cd static && npm run dev
   cd main && mvn spring-boot:run
   ```
4. **Open in browser**: `http://localhost:8080`

---

## 📈 Roadmap & Next Steps

- **Mobile app**: React Native / Flutter support.
- **HIPAA-compliant**: deploy with audit logging.
- **Expand database**: add more drugs and formularies.