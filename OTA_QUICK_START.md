# OTA Updates - Quick Start

Your Quantum TV app is already configured for OTA updates!

## ✅ What's Already Set Up

- EAS Project ID: `dcff3612-a952-43e9-a210-ddefaffcd9e8`
- Owner: `kenyanm`
- Updates enabled in app.json
- Runtime version policy: `appVersion`

---

## 🚀 Getting Started with OTA (3 Steps)

### Step 1: Install EAS CLI

Open PowerShell and run:
```powershell
npm install -g eas-cli
```

### Step 2: Authenticate

```powershell
eas login
```

This will open a browser to login with your Expo account (kenyanm).

### Step 3: Make First Production Build

For your FIRST release, create a build with native code + OTA support:

```powershell
cd C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile
eas build --platform android --profile production
```

This creates an APK/AAB you can submit to Google Play or Amazon Appstore. Takes 15-20 mins.

---

## 📱 After First Build: Deploy OTA Updates

After your app is installed on user devices, deploy updates this way:

### Quick OTA Deployment:

```powershell
cd C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile

# Increment version (optional but recommended)
# Edit app.json: change "version": "1.0.13" to "1.0.14"

# Deploy
eas update --platform android --message "fix: video playback issues"
```

Users get the update automatically on next app launch! No store review needed.

---

## 📊 Workflow Example

You just fixed video playback:

```powershell
# 1. Code is already pushed to GitHub (done!)

# 2. Go to mobile folder
cd mobile

# 3. Update version in app.json
# Change: "version": "1.0.13" → "1.0.14"

# 4. Deploy OTA
eas update --platform android --message "fix: videos not playing and back arrow not hiding"

# Done! Users get fix on next launch.
```

---

## 🔄 Update Lifecycle

```
Code Changes → Git Push → Update Version → EAS Update → Users Get Update
	 (done!)    (done!)      (manual)         (fast)         (automatic)
```

---

## 📋 Useful Commands

```powershell
# View all your updates
eas update:list

# View deployment history
eas build:list

# Check update channels
eas channel:list

# See project info
eas project:info

# View app on dashboard
# https://expo.dev/projects/dcff3612-a952-43e9-a210-ddefaffcd9e8
```

---

## 🔑 Key Points

✅ **OTA Updates are FAST** - No app store review, instant deployment
✅ **Users must have the base APK installed first** - Initial app store release required once
✅ **OTA updates are automatic** - Checks on app launch, updates in background
✅ **Works for code/assets** - Native code changes still need new build + store submission
✅ **Version matters** - Use `runtimeVersion: "appVersion"` policy in app.json (already set)

---

## 📖 Next Commands to Run

1. **Install EAS:**
```powershell
npm install -g eas-cli
```

2. **Login:**
```powershell
eas login
```

3. **First Build:**
```powershell
cd C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile
eas build --platform android --profile production
```

4. **Future Updates:**
```powershell
eas update --platform android --message "Your update message"
```

---

## 🆘 If You Hit Issues

- **"eas not found"**: npm install -g eas-cli
- **"Not authenticated"**: eas login
- **"Project not linked"**: eas project:init
- **Build failed**: Check eas build:list for logs

---

## 📚 Learn More

- Expo Updates Docs: https://docs.expo.dev/eas-update/introduction/
- EAS Build: https://docs.expo.dev/eas-build/introduction/
- Your Dashboard: https://expo.dev/projects/dcff3612-a952-43e9-a210-ddefaffcd9e8
