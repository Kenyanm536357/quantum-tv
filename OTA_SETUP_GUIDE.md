# Quantum TV - OTA Updates Setup Guide

## Your App is Already Ready for OTA! 🎉

Your `app.json` has EAS configured:
```json
{
  "owner": "kenyanm",
  "runtimeVersion": { "policy": "appVersion" },
  "updates": {
	"url": "https://u.expo.dev/dcff3612-a952-43e9-a210-ddefaffcd9e8",
	"enabled": true,
	"checkAutomatically": "ON_LOAD",
	"fallbackToCacheTimeout": 4000
  }
}
```

---

## Prerequisites

1. **Node.js** installed (v16+)
2. **Expo CLI** installed
3. **Expo Account** (sign up at https://expo.dev)
4. **EAS CLI** installed

---

## Step 1: Install EAS CLI

```powershell
npm install -g eas-cli
```

Verify installation:
```powershell
eas --version
```

---

## Step 2: Authenticate with EAS

```powershell
cd C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile
eas login
```

This will open a browser to login with your Expo account (kenyanm).

---

## Step 3: Create eas.json (Build Configuration)

Create a file: `mobile/eas.json`

Content for Android TV / Fire TV:

```json
{
  "cli": {
	"version": ">= 5.0.0"
  },
  "build": {
	"preview": {
	  "android": {
		"buildType": "apk"
	  }
	},
	"preview2": {
	  "android": {
		"buildType": "apk"
	  }
	},
	"production": {
	  "android": {
		"buildType": "aab"
	  }
	}
  },
  "submit": {
	"production": {
	  "android": {
		"serviceAccount": "path/to/service-account-key.json"
	  }
	}
  }
}
```

---

## Step 4: Build Your First OTA-Ready Release

### Build for Android:

```powershell
cd mobile
eas build --platform android --profile production
```

This creates a release APK/AAB with OTA support. The build process takes ~15-20 minutes.

### For Android TV / Fire TV specifically:
```powershell
eas build --platform android --profile production
```

---

## Step 5: Test OTA Updates Locally (Optional)

Update version in `app.json`:
```json
{
  "version": "1.0.14"
}
```

Then deploy update:
```powershell
eas update --platform android --message "fix: video playback issues"
```

---

## Step 6: Deploy OTA Updates Going Forward

After you make code changes and push to GitHub:

### Step 1: Increment version in mobile/app.json
```json
{
  "version": "1.0.14"
}
```

### Step 2: Deploy the update
```powershell
cd mobile
eas update --platform android --message "Your change description"
```

**That's it! Your users will get the update automatically.**

---

## How Users Will Get Updates

With `"checkAutomatically": "ON_LOAD"`, updates check automatically when:
1. ✅ App launches
2. ✅ App comes to foreground from background
3. ✅ After 4 seconds of no update (fallback timeout)

Users can also manually pull down to refresh.

---

## Deployment Workflow

### For Code-Only Changes (Fast OTA):
```powershell
# 1. Make code changes and push to GitHub (already done!)

# 2. Increment version
# Edit mobile/app.json: "version": "1.0.14"

# 3. Deploy OTA update
eas update --platform android --message "fix: video playback black screen"

# Users get update automatically on next app launch!
```

### For Native Code Changes (App Store):
```powershell
# Need to rebuild APK/AAB and resubmit to Google Play / Amazon Appstore
eas build --platform android --profile production
eas submit --platform android
```

---

## Commands Reference

```powershell
# Login to EAS
eas login

# List your projects
eas project:info

# Build for Android
eas build --platform android

# Deploy OTA update
eas update --platform android

# Check update history
eas update:list

# View build history
eas build:list

# View channel information
eas channel:list

# Rollback to previous update
eas update:rollout --channel production --version <version_number>
```

---

## Next Steps for Your App

### Immediate:
1. ✅ Install EAS CLI: `npm install -g eas-cli`
2. ✅ Login: `eas login`
3. ✅ Create `eas.json` in mobile folder

### For First Release Build:
```powershell
cd mobile
eas build --platform android --profile production
```

### For Future Updates:
```powershell
# After code changes:
eas update --platform android --message "Your message"
```

---

## OTA Update Limits

- ✅ Size: Updates must be < 50MB
- ✅ Backwards Compatibility: Updates work only within same native version
- ✅ Instant: No app store review needed for OTA updates
- ⚠️ Native Changes: New packages or Expo SDK upgrades require new build

---

## Monitoring Updates

View update metrics:
```powershell
eas update:list
```

See which users got which versions:
- Expo Dashboard: https://expo.dev/projects/dcff3612-a952-43e9-a210-ddefaffcd9e8

---

## Need Help?

- Expo Updates Docs: https://docs.expo.dev/eas-update/introduction/
- EAS Build: https://docs.expo.dev/eas-build/introduction/
- Discord: https://discord.gg/expo
