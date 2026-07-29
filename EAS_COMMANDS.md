# EAS Commands Reference for Quantum TV

## 📋 Setup Commands

```powershell
# Install EAS CLI globally
npm install -g eas-cli

# Login to your Expo account
eas login

# Check authentication
eas whoami

# View project info
eas project:info
```

---

## 🏗️ Building Commands

```powershell
cd C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile

# Preview build (for testing)
eas build --platform android --profile preview

# Production build (for store)
eas build --platform android --profile production

# View build history
eas build:list

# View specific build
eas build:info --id <BUILD_ID>

# Cancel build
eas build:cancel --id <BUILD_ID>
```

---

## 🚀 OTA Update Commands

```powershell
cd C:\Users\kenya\source\repos\Kenyanm536357\quantum-tv\mobile

# Deploy OTA update
eas update --platform android

# Deploy with message
eas update --platform android --message "fix: video playback issues"

# View all updates
eas update:list

# View specific channel updates
eas update:list --channel production

# Get update details
eas update:info --update-id <UPDATE_ID>

# Rollback to previous update
eas update:rollout --channel production --version <VERSION>

# Create new channel
eas channel:create <CHANNEL_NAME>

# View all channels
eas channel:list

# Rename channel
eas channel:rename <OLD_NAME> <NEW_NAME>
```

---

## 📤 App Store Submission

```powershell
# Submit to Google Play
eas submit --platform android

# View submission history
eas submission:list

# Check submission status
eas submission:info --id <SUBMISSION_ID>
```

---

## 🔧 Configuration

```powershell
# Initialize EAS project
eas project:init

# Reconfigure project
eas project:init --force

# Run EAS doctor (check setup)
eas doctor
```

---

## 📊 Monitoring

```powershell
# View deployment dashboard
# https://expo.dev/projects/dcff3612-a952-43e9-a210-ddefaffcd9e8

# List all builds
eas build:list

# List all updates
eas update:list

# List all submissions
eas submission:list
```

---

## 🎯 Your Typical Workflow

### For OTA Updates (Fast):
```powershell
# 1. Make code changes
# 2. Edit mobile/app.json version
# 3. Deploy
cd mobile && eas update --platform android --message "Your message"
```

### For New Build (Slow):
```powershell
# Only when needed (native changes)
eas build --platform android --profile production
```

---

## 🚨 Troubleshooting

```powershell
# Run diagnostics
eas doctor

# Check environment
eas doctor --environment

# Verbose output (for debugging)
eas update --platform android --verbose

# Check logs
eas build:view --id <BUILD_ID>
```

---

## ⚙️ Common Tasks

### Update app version
Edit `mobile/app.json`:
```json
{
  "expo": {
	"version": "1.0.14",
	"android": {
	  "versionCode": 19
	}
  }
}
```

### Deploy with channel
```powershell
eas update --platform android --channel staging
eas update --platform android --channel production
```

### Rollback update
```powershell
# Get version number from update:list
eas update:rollout --channel production --version <VERSION_NUMBER>
```

---

## 🔗 Dashboard & Links

- **Dashboard**: https://expo.dev/projects/dcff3612-a952-43e9-a210-ddefaffcd9e8
- **Docs**: https://docs.expo.dev/eas-update/
- **Account**: https://expo.dev/sign-in (login as: kenyanm)

---

## 💬 Getting Help

```powershell
# Help for any command
eas <COMMAND> --help

# Example:
eas update --help
eas build --help
eas submit --help
```
