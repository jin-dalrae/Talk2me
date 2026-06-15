#!/usr/bin/env bash
set -euo pipefail

SERVICE="${SERVICE:-talk2me-relay}"
REGION="${REGION:-us-central1}"
SECRET_NAME="${SECRET_NAME:-gemini-api-key}"

gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets "GEMINI_API_KEY=${SECRET_NAME}:latest" \
  "$@"
