# Deployment Instructions for Prescripto on Google Cloud Run

This document outlines the steps to deploy updates to the Prescripto application running on Google Cloud Run.

## Prerequisites

*   `gcloud` CLI installed and authenticated (`gcloud auth login`, `gcloud config set project prescripto-458019`).
*   Docker and Docker Buildx installed.
*   `npm` installed.
*   Google Cloud project (`prescripto-458019`) with Cloud Run and Artifact Registry APIs enabled.
*   Artifact Registry repository created (e.g., `us-central1-docker.pkg.dev/prescripto-458019/prescripto-repo`).
*   Docker authenticated with Artifact Registry (`gcloud auth configure-docker us-central1-docker.pkg.dev`).
*   Cloud Run service (`prescripto-service`) already created and configured with necessary environment variables and secrets.

## Deployment Steps

1.  **Rebuild Frontend Assets:**
    If you made changes to the frontend code (`static/src/...`), rebuild the static assets:
    ```bash
    cd static
    npm install --legacy-peer-deps # Use if dependency issues arise, otherwise just npm install
    npm run build
    cd ..
    ```
    *Note: It's recommended to fix dependency issues properly instead of relying on `--legacy-peer-deps` long-term.*

2.  **Build Docker Image (for AMD64):**
    Build the image specifically for the `linux/amd64` architecture required by Cloud Run. This command also tags the image for Artifact Registry.
    ```bash
    docker buildx build --platform linux/amd64 -t us-central1-docker.pkg.dev/prescripto-458019/prescripto-repo/prescripto-app:latest --load .
    ```

3.  **Push Docker Image:**
    Push the newly built and tagged image to Google Artifact Registry.
    ```bash
    docker push us-central1-docker.pkg.dev/prescripto-458019/prescripto-repo/prescripto-app:latest
    ```

4.  **Redeploy Cloud Run Service:**
    Deploy the new image version to your Cloud Run service.
    ```bash
    gcloud run deploy prescripto-service --project=prescripto-458019 --region=us-central1 --image=us-central1-docker.pkg.dev/prescripto-458019/prescripto-repo/prescripto-app:latest
    ```

Your update should now be live at the service URL provided after the deployment command completes. 