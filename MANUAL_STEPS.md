# SkipIt 3.0 — Manual Setup & Secret Configuration Guide

This guide details all external, dashboard, and secret configuration steps that require your own developer credentials, Google Cloud console access, Firebase setup, Supabase migration execution, key rotation, and git history scrubbing.

---

## 1. Supabase Database Migration & Storage Setup

### Step 1.1: Apply Schema Reconciliation Migration
The repository contains the idempotent reconciliation migration `infrastructure/supabase/migrations/20261118000000_reconcile_schema.sql`.
1. Log in to your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. In the left navigation, click on **SQL Editor**.
4. Click **New query**.
5. Copy and paste the entire contents of `infrastructure/supabase/migrations/20261118000000_reconcile_schema.sql`.
6. Click **Run** (or press Ctrl+Enter / Cmd+Enter).
7. Confirm that the output status displays `Success. No rows returned`.
8. Run schema verification from your terminal to verify all tables and columns:
   ```bash
   node scripts/verify_schema.js
   ```

### Step 1.2: Configure Storage Buckets
1. In the Supabase Dashboard, click on **Storage** in the left sidebar.
2. Ensure the following buckets exist with the correct access rules:
   - `avatars`: **Public** (Access: Public). For user profile photos.
   - `listing-images`: **Public** (Access: Public). For item photographs.
   - `kyc-documents`: **Private** (Access: Private / RLS only). For government ID and selfie proofs. (Accessed only via short-lived 5-minute signed URLs).
   - `chat-attachments`: **Private** (Access: Private / RLS only). For private chat photo attachments.

---

## 2. Google OAuth 2.0 Credentials Setup

### Step 2.1: Google Cloud Console Configuration
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Select your project (or create a new project named `SkipIt`).
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   - User Type: **External**
   - App name: `SkipIt`
   - User support email: Select your email
   - Developer contact email: Select your email
   - Scopes: Add `email`, `profile`, `openid`
   - Save and continue.
4. Navigate to **APIs & Services** > **Credentials** > **Create Credentials** > **OAuth client ID**:
   - **Web Application Client ID:**
     - Name: `SkipIt Web Client`
     - Authorized JavaScript origins: `http://localhost:3000`, `https://yourdomain.com`
     - Authorized redirect URIs: `http://localhost:3000`, `https://yourdomain.com`
     - Copy the generated Client ID (e.g., `xxx-web.apps.googleusercontent.com`).
   - **Android Client ID:**
     - Name: `SkipIt Android Client`
     - Package name: `com.skipit.skipit`
     - SHA-1 certificate fingerprint:
       - Run `cd apps/mobile/android && ./gradlew signingReport` to obtain your debug/release SHA-1 fingerprint.
       - Paste the SHA-1 fingerprint.
     - Copy the generated Client ID.
   - **iOS Client ID (Optional for Apple devices):**
     - Name: `SkipIt iOS Client`
     - Bundle ID: `com.skipit.skipit`
     - Copy the generated Client ID.

### Step 2.2: Configure Environment Variables
1. In backend `.env`:
   ```env
   GOOGLE_CLIENT_IDS=xxx-web.apps.googleusercontent.com,xxx-android.apps.googleusercontent.com,xxx-ios.apps.googleusercontent.com
   ```
2. In web `.env.local` or Render environment settings:
   ```env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx-web.apps.googleusercontent.com
   ```

---

## 3. Firebase Cloud Messaging (Push Notifications) Setup

### Step 3.1: Firebase Project & Android / iOS Registration
1. Visit the [Firebase Console](https://console.firebase.google.com/).
2. Create or link your `SkipIt` project.
3. Click **Add App** > **Android**:
   - Package name: `com.skipit.skipit`
   - Download the generated `google-services.json` file.
   - Place this file at: `apps/mobile/android/app/google-services.json` (Note: This path is gitignored).
4. Click **Add App** > **iOS**:
   - Bundle identifier: `com.skipit.skipit`
   - Download `GoogleService-Info.plist`.
   - Place this file at: `apps/mobile/ios/Runner/GoogleService-Info.plist` (Note: This path is gitignored).

### Step 3.2: Service Account Generation for Backend
1. In Firebase Console, go to **Project settings** (gear icon) > **Service accounts**.
2. Select **Firebase Admin SDK** > **Node.js**.
3. Click **Generate new private key**, then click **Generate key**.
4. Configure the backend using either method:
   - **File Path:** Save the JSON file (e.g., `config/firebase-service-account.json`, gitignored) and set:
     ```env
     FIREBASE_SERVICE_ACCOUNT_JSON=./config/firebase-service-account.json
     ```
   - **Raw JSON String (Recommended for Cloud / Render):**
     Minify the JSON into a single string and set:
     ```env
     FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"...","private_key":"..."}
     ```

---

## 4. Mobile Release Signing Setup (Android)

1. Generate an upload keystore if you don't already have one:
   ```bash
   keytool -genkey -v -keystore skipit-release.keystore -alias skipit -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Place the `.keystore` file in `apps/mobile/android/`.
3. Create `apps/mobile/android/key.properties` (gitignored):
   ```properties
   storePassword=your_keystore_password
   keyPassword=your_key_password
   keyAlias=skipit
   storeFile=../skipit-release.keystore
   ```
4. Build the release APK / Bundle:
   ```bash
   cd apps/mobile
   flutter build appbundle --release --dart-define=API_BASE_URL=https://api.yourdomain.com/api/v1 --dart-define=WS_URL=wss://api.yourdomain.com
   ```

---

## 5. Security Key Rotation

Because prior git commits or local testing may have exposed development keys, rotate the following in production:

1. **Supabase Service Role Key:**
   - In Supabase Dashboard > **Project Settings** > **API**.
   - Under **Project API keys**, click **Reset** for `service_role` (secret).
   - Update your backend hosting environment (Render, etc.) with the new key.
2. **JWT Secret:**
   - Generate a brand new cryptographically random 64-character secret:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Update `JWT_SECRET` in your backend environment variables.
3. **Database Passwords:**
   - In Supabase Dashboard > **Project Settings** > **Database** > **Reset database password**.

---

## 6. Permanent Git History Purge (Removing Committed Backups)

To completely remove legacy database dump files or sensitive backups from the git commit history, run `git-filter-repo`.

### Step-by-Step Instructions:
1. Ensure your working tree is clean and push your `hardening-and-rental-flow` branch to your private fork/remote.
2. Install `git-filter-repo`:
   ```bash
   pip install git-filter-repo
   ```
3. In a fresh clone of the repository:
   ```bash
   git clone <repo-url> skipit-purge-temp
   cd skipit-purge-temp
   ```
4. Permanently purge the `backups/` directory from all commits across all branches:
   ```bash
   git filter-repo --path backups --invert-paths
   ```
5. Inspect the git history to verify all backup files are excised:
   ```bash
   git log --all --full-history -- "backups/*"
   ```
6. Re-add your git remote and force-push the cleaned branches to the remote repository:
   ```bash
   git remote add origin <repo-url>
   git push origin --force --all
   git push origin --force --tags
   ```
