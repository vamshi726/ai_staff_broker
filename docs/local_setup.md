# Local Setup Guide

Follow this guide to get the **AI Staff Broker** project running on your local machine.

---

## 📋 Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [Git](https://git-scm.com/)

You will also need accounts and API credentials for:
- [Supabase](https://supabase.com/) (Database, Auth, and Storage)
- [Sarvam AI](https://www.sarvam.ai/) (STT, TTS, and Translation APIs)
- [OpenAI](https://openai.com/) or [Google Gemini](https://ai.google.dev/) (for task decomposition logic)

---

## 🚀 Step-by-Step Installation

### 1. Configure Environment Variables
Create a file named `.env` in the root of the project and populate it with your configuration credentials:

```env
# Supabase Configuration
SUPABASE_PROJECT_ID="your_supabase_project_id"
SUPABASE_URL="https://your_supabase_project_id.supabase.co"
SUPABASE_PUBLISHABLE_KEY="your_anon_publishable_key"
SUPABASE_SERVICE_ROLE_KEY="your_service_role_key" # Required for admin functions

# Vite Frontend Variables (Exposed to Client)
VITE_SUPABASE_PROJECT_ID="your_supabase_project_id"
VITE_SUPABASE_URL="https://your_supabase_project_id.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="your_anon_publishable_key"

# AI Provider Integrations
SARVAM_API_KEY="your_sarvam_api_key"

# Core LLM Providers (The pipeline supports automatic fallback)
GEMINI_API_KEY="your_gemini_api_key"
OPENAI_API_KEY="your_openai_api_key"
```

---

### 2. Configure your Supabase Dashboard
To get the backend features working properly, you must configure a few settings in your remote Supabase Dashboard:

#### A. Set up Supabase Storage Bucket
1. Log in to the [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Storage** in the sidebar.
3. Click **New Bucket**.
4. Name the bucket `voice` (must be exact).
5. Toggle the bucket visibility to **Public**. 
   * *Note: If the bucket is not public, workers' browsers will get 400 Bad Request errors when trying to play translated tasks.*

#### B. Disable Email Confirmation (For Development)
Supabase aggressively rate-limits signups during development if verification emails are sent.
1. Go to **Authentication** -> **Providers** -> **Email**.
2. Toggle off **Confirm email** (or enable auto-confirm).
3. Save the changes.

#### C. Deploy Database Schema
1. Navigate to the project's `supabase/migrations/` directory.
2. You will find several `.sql` files representing migrations.
3. Go to **SQL Editor** in your Supabase Dashboard.
4. Open the files in sequential order (by timestamp prefix) and execute them in the editor:
   - `20260606191928_1df3eb13-5b08-412b-ac60-0590dbd45865.sql` (Creates core schemas, RLS rules, indexes, and triggers)
   - `20260606191944_209b4e43-bfc5-44ec-b8d9-eecb93e79904.sql` (Grants execute permissions to functions)
   - `20260607064109_60edc369-0789-4164-b7a1-395f723b2a3e.sql` (Adjusts user role insertion policies)
   - `20260607064813_f080e160-cba3-4932-9e89-195fb2d446bf.sql` (Updates organization retrieval policy rules)

---

### 3. Install Dependencies & Start the Server
Navigate to the project directory in your terminal and run:

```bash
# Install NPM dependencies
npm install

# Start the local development server (Vite + TanStack Start)
npm run dev
```

The application will start, typically on [http://localhost:8080](http://localhost:8080).

---

## 🛠️ Troubleshooting & Common Gotchas

### 1. `400 Bad Request` / `Bucket not found` on Voice Instruction Audio Playback
* **Cause**: The `voice` storage bucket was created as private, or the bucket name isn't exactly `voice`.
* **Fix**: Ensure the bucket is named `voice` and the **Public** toggle is enabled in the bucket settings.

### 2. `429 Too Many Requests` on Signup
* **Cause**: You have hit Supabase Auth's default rate limits due to email confirmations.
* **Fix**: Turn off **Confirm email** in the Authentication settings of your Supabase dashboard.

### 3. "AI task extraction failed" / "Missing AI API Key"
* **Cause**: The application cannot find a valid LLM key in `.env`.
* **Fix**: Ensure either `GEMINI_API_KEY` or `OPENAI_API_KEY` is set correctly in `.env`. Restart the server after editing the file.
