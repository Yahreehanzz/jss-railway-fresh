# Google OAuth Setup Guide

The teacher setup modal has been updated to use **Google Sign-In** for email verification instead of manual email+phone entry and OTP.

## Setup Steps:

### 1. Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable "Google Identity Services API"

### 2. Create OAuth 2.0 Credentials
1. Go to "Credentials" → "Create Credentials" → "OAuth client ID"
2. Select "Web application"
3. Add authorized JavaScript origins:
   - `http://localhost:3000`
   - `http://localhost:5000`
   - Your Railway domain: `https://your-app.railway.app`

4. Add authorized redirect URIs (same as above + `/`)
5. Copy your **Client ID**

### 3. Update in index.html
Find this line (around line 38820):
```javascript
client_id: 'YOUR_GOOGLE_CLIENT_ID_HERE', // REPLACE WITH YOUR CLIENT ID
```

Replace with your actual Client ID:
```javascript
client_id: '123456789-abcdefg.apps.googleusercontent.com', // Your actual ID
```

### 4. Test Locally
1. Run the app locally: `npm start`
2. Open http://localhost:3000
3. Test teacher login and setup flow
4. Click "Sign in with Google" button
5. Verify it works before deploying

### 5. Deploy to Railway
```bash
git add .
git commit -m "Feat: Add Google OAuth integration for teacher email verification"
git push
```

## What Changed:

**Old Flow:**
- Country selection
- Account creation  
- Manual email + Phone number
- OTP verification
- Loading & Complete

**New Flow (5 steps):**
1. Country selection
2. Account creation
3. **Google Sign-In** (replaces email+phone+OTP)
4. Email confirmation (auto-displayed)
5. Loading & Complete

## Benefits:
✅ Free (no Twilio/SMS costs)
✅ Secure OAuth 2.0
✅ Real-time verification
✅ Professional UX
✅ No OTP delivery delays
✅ Auto-fills with Google account email

## If Google OAuth Button Issues:
The button uses Google Identity Services SDK. If it doesn't render:
1. Check browser console for errors
2. Verify Client ID is correct
3. Ensure domain is authorized in Google Cloud
4. Check that Google SDK loaded: `console.log(window.google)`

## For Production:
- Replace `YOUR_GOOGLE_CLIENT_ID_HERE` with actual ID before deploying
- Test thoroughly on Railway environment
- Verify email values match teacher database emails
