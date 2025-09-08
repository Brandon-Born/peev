# PEEV Setup Guide

## Environment Variables Setup

### Required Environment Variables for Vercel Deployment

Add these environment variables to your Vercel project settings:

#### Frontend Firebase Configuration (Client SDK)
```bash
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef123
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEF123
```

#### Backend Firebase Configuration (Admin SDK)
```bash
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here...\n-----END PRIVATE KEY-----"
```

#### Email Service Configuration (Resend)
```bash
RESEND_API_KEY=re_your_resend_api_key
```

#### Security Configuration
```bash
CRON_SECRET=your_secure_random_string_for_cron_protection
```

## Firebase Admin SDK Setup

### Step 1: Create Service Account
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** > **Service Accounts**
4. Click **Generate New Private Key**
5. Download the JSON file

### Step 2: Extract Service Account Values
From the downloaded JSON file, extract these values for Vercel environment variables:

```json
{
  "type": "service_account",
  "project_id": "your_project_id",           // → FIREBASE_PROJECT_ID
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",  // → FIREBASE_PRIVATE_KEY
  "client_email": "firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com",   // → FIREBASE_CLIENT_EMAIL
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

**Important:** When adding `FIREBASE_PRIVATE_KEY` to Vercel, keep the quotes and escape the newlines properly.

## Resend Email Service Setup

### Step 1: Create Resend Account
1. Go to [Resend](https://resend.com/)
2. Create an account
3. Verify your email domain (or use their test domain for development)

### Step 2: Get API Key
1. Go to **API Keys** in your Resend dashboard
2. Create a new API key
3. Copy the key (starts with `re_`)
4. Add to Vercel as `RESEND_API_KEY`

### Step 3: Configure Email Domain
- **Development**: You can use the default `onboarding@resend.dev` domain
- **Production**: Add and verify your own domain in Resend dashboard

Update the `from` address in `/api/sendExpirationAlerts.js`:
```javascript
from: 'PEEV Alerts <alerts@yourdomain.com>', // Replace with your domain
```

## Security Setup

### CRON_SECRET
Generate a secure random string to protect your cron endpoint:

```bash
# Generate a secure random string (macOS/Linux)
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Add this value as `CRON_SECRET` in Vercel environment variables.

## Vercel Deployment

### Step 1: Connect Repository
1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **New Project**
3. Import your GitHub repository

### Step 2: Configure Build Settings
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### Step 3: Add Environment Variables
1. Go to **Project Settings** > **Environment Variables**
2. Add all the variables listed above
3. Make sure to set them for **Production**, **Preview**, and **Development** environments

### Step 4: Deploy
1. Click **Deploy**
2. Vercel will automatically build and deploy your app
3. The cron job will be automatically configured to run daily at 8 AM UTC

## Firebase Security Rules Deployment

Deploy the security rules from `firestore-security-rules.txt`:

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not done already)
firebase init firestore

# Deploy security rules
firebase deploy --only firestore:rules
```

## Testing the Email System

### Manual Test
You can manually trigger the expiration alert system:

```bash
curl -X POST "https://your-vercel-app.vercel.app/api/sendExpirationAlerts?secret=YOUR_CRON_SECRET"
```

### Development Test
For local development, create a `.env.local` file with all environment variables and run:

```bash
npm run dev
```

## Monitoring

### View Logs
1. Go to Vercel Dashboard > Your Project
2. Click on **Functions** tab
3. Click on `sendExpirationAlerts` to view logs

### Check Cron Job Status
1. Go to Vercel Dashboard > Your Project > Settings
2. Click on **Cron Jobs** to see execution history

## Troubleshooting

### Common Issues

1. **Firebase Admin SDK Authentication Error**
   - Verify service account credentials are correct
   - Ensure private key includes proper line breaks (`\n`)

2. **Resend Email Delivery Issues**
   - Check if domain is verified in Resend dashboard
   - Verify API key is correct
   - Check Resend logs for delivery status

3. **Cron Job Not Running**
   - Verify cron syntax in `vercel.json`
   - Check that `CRON_SECRET` matches between environment and function
   - View function logs in Vercel dashboard

4. **Firebase Permission Errors**
   - Ensure Firestore security rules are deployed
   - Verify service account has proper permissions
   - Check that team documents have correct structure

### Support
For technical issues, check:
- Vercel function logs
- Firebase Console logs
- Resend delivery logs
- Browser developer console for frontend issues
