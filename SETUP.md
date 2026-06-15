# Talk2Me Deploy Setup

This is the Phase 0 deployment path for the current single-service prototype.
It deploys the existing Express static app and `/ws` relay to Cloud Run. Firebase
Auth, Firestore, Stripe, and metering come in later phases from `PLAN.md`.

## Prerequisites

- Google Cloud project with billing enabled.
- `gcloud` installed and authenticated with an account that can deploy Cloud Run.
- A Gemini API key from Google AI Studio.

## One-time Google Cloud setup

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

Create a Secret Manager secret for the Gemini key:

```bash
printf '%s' 'YOUR_GEMINI_API_KEY' | gcloud secrets create gemini-api-key --data-file=-
```

Grant the Cloud Run runtime service account permission to read the secret. If
you use the default Compute service account:

```bash
PROJECT_ID="$(gcloud config get-value project)"
PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Deploy

```bash
npm run deploy:cloud-run -- --project YOUR_PROJECT_ID
```

The script deploys the current directory as a Cloud Run source build, injects
`GEMINI_API_KEY` from Secret Manager, and allows unauthenticated HTTPS access.
Mic capture works on the resulting `https://...run.app` URL.

## Verify

```bash
curl "$(gcloud run services describe talk2me-relay --region us-central1 --format='value(status.url)')/api/health"
```

Then open the service URL in Chrome, allow microphone access, and press Start.

## Current Phase 0 boundaries

- Deployed app is still the single-user prototype.
- The same API key is shared by the relay.
- Data is still local to the container filesystem and not durable across Cloud
  Run instance replacement.
- Do not open this broadly until Phase 3 metering and caps are implemented.
