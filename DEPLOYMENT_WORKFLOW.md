# OTA Deployment Workflow for Quantum TV

## Current State ✅

Your code fix has been:
- ✅ **Committed** to git (commit: 50436b6)
- ✅ **Pushed** to GitHub main branch
- ✅ **Ready** for OTA deployment

## Phase 1: Initial Setup (One-time)

### 1. Install EAS CLI
```powershell
npm install -g eas-cli
```

### 2. Authenticate with Expo
```powershell
eas login
# Opens browser - login with kenyanm account
```

### 3. Create First Production Build

This is a NATIVE build containing your app code + OTA runtime. Users must download this first.

```powershell
cd C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile
eas build --platform android --profile production
```

**What happens:**
- EAS builds your app
- Includes Expo Updates runtime
- Creates APK/AAB file
- Takes ~15-20 minutes
- You get a download link

**Next:**
- Download the APK
- Submit to Google Play or Amazon Appstore
- Users install it

---

## Phase 2: Deploy OTA Updates (After Users Have App Installed)

Once users have your app installed with OTA support, deploy updates fast!

### Deployment Steps:

#### 1. Make Code Changes
```powershell
# Already done!
# You fixed: video playback & back arrow issues
# Changes in: mobile/app/player/[rk].tsx
```

#### 2. Commit to Git
```powershell
# Already done!
# Commit 50436b6 pushed to GitHub
```

#### 3. Update Version Number
```powershell
# Edit: C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile\app.json

# Change from:
"version": "1.0.13"

# To:
"version": "1.0.14"

# Also increment Android versionCode:
"versionCode": 19  # was 18, now 19
```

#### 4. Deploy OTA Update
```powershell
cd C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile

eas update --platform android --message "fix: video playback black screen and back arrow auto-hide during playback"
```

**What happens:**
- Your code is bundled as an update
- Uploaded to Expo servers
- Users get it automatically on next app launch
- Takes ~2-3 minutes
- No app store review needed!

---

## 📊 Timeline Comparison

### Traditional (Manual):
1. Make changes
2. Increment version
3. Build new APK/AAB
4. Submit to Play Store
5. Wait for review (2-7 days)
6. Users download new version from store
7. ⏱️ Total: 2-7+ days

### OTA (This Approach):
1. Make changes ✅ (done)
2. Increment version
3. Deploy OTA with `eas update`
4. Users get automatically on next launch
5. ⏱️ Total: minutes!

---

## 🔄 Workflow After Initial Build

Every time you fix something:

```powershell
# 1. Make code changes
# 2. Commit and push to GitHub

cd C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile

# 3. Update version in app.json (or let EAS ask)
# Edit app.json: "version": "X.Y.Z"

# 4. Deploy
eas update --platform android --message "Your fix description"

# Done! Users get update automatically next time they open app.
```

---

## 🔴 When You Need a New Build (Not OTA)

Sometimes you need to rebuild the native app:

- 📦 Added new npm package
- 🎯 Upgraded Expo SDK version
- 🔧 Changed native configuration
- 📱 Major update needed

**In these cases:**
```powershell
# Do full build instead of OTA
eas build --platform android --profile production

# Then submit to store
eas submit --platform android
```

---

## 📱 User Experience

### First Install:
1. User downloads app from store (APK with OTA runtime)
2. Opens app for first time
3. App checks Expo servers automatically

### Getting Updates:
1. User opens app
2. App checks for updates silently in background
3. If update exists, downloads it (next time user opens app)
4. Updates applied automatically
5. User sees latest version next time they restart

**No action needed from user!**

---

## 📋 Complete First-Time Commands

```powershell
#=== SETUP (One time) ===

# 1. Install EAS
npm install -g eas-cli

# 2. Login
eas login

# 3. Go to mobile folder
cd C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile

# 4. First build
eas build --platform android --profile production

# [Download APK, submit to store, users install]

#=== AFTER FIRST BUILD: OTA UPDATES ===

# For each update:
cd mobile
# Update version in app.json
eas update --platform android --message "Your message"

# Users get it automatically!
```

---

## 🎯 Your Current Status

✅ Code changes made and pushed
✅ App.json already has EAS config
✅ Ready to build when you are

**Next action:** Run the build commands above!

---

## 💡 Pro Tips

1. **Always increment version** - Helps track updates
2. **Meaningful messages** - Describe what changed
3. **Check updates list** - `eas update:list` to see deployment history
4. **Monitor dashboard** - https://expo.dev/projects/dcff3612-a952-43e9-a210-ddefaffcd9e8
5. **Test before deploying** - Build locally first if possible

---

## ❓ FAQ

**Q: Do I need to rebuild for every fix?**
A: No! Only for code changes. For config/native changes, yes.

**Q: Can users skip updates?**
A: Not if you require them. Fallback timeout auto-applies after 4 seconds.

**Q: What if update is buggy?**
A: Rollback previous version: `eas update:rollout --channel production --version <VERSION>`

**Q: How big can updates be?**
A: Up to 50MB per update

**Q: Do users need internet?**
A: Yes, to download updates. App works offline after cached.

