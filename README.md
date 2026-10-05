# Quantum TV

Quantum TV is a cross-device streaming app for Live TV, movies, and TV shows using the app's Xtream-based media service. The mobile/TV client is built with Expo, React Native, and TypeScript; the API is FastAPI with MongoDB.

## Current release

- App version and OTA runtime: **1.0.14**
- EAS project: [`@kenyanm/quantum-tv`](https://expo.dev/accounts/kenyanm/projects/quantum-tv)
- Android release profile: **`production`** (APK, production update channel)
- Backend: Railway production service at [`https://quantum-tv-production.up.railway.app`](https://quantum-tv-production.up.railway.app)

## Recent updates

- Favorites now bring together Live TV channels, movies, shows, and episodes in one place.
- Settings includes an Android Auto boot option for Android TV / Fire TV devices. It is off by default and takes effect after installing a compatible native Android build. Operating-system and device policies may affect launch-at-boot behavior.
- Backend maintenance loops retry after unexpected failures, MongoDB startup initialization retries with backoff, and upstream streaming connections have bounded timeouts and cleanup.
- The Android JavaScript update for runtime 1.0.14 is published to the **production** OTA channel: [update group `bdab776e-f1b9-4160-a6a6-d515ce164291`](https://expo.dev/accounts/kenyanm/projects/quantum-tv/updates/bdab776e-f1b9-4160-a6a6-d515ce164291).
- The native Android **production** APK build (version code 54) completed. [View build logs and download the APK](https://expo.dev/accounts/kenyanm/projects/quantum-tv/builds/c0e3b272-66d8-4cb0-8335-ec02c15e7bcb).

## Mobile app development

```sh
cd mobile
npm install
npx expo start
```

The app uses `mobile/app.json` and `mobile/app.config.js` for Expo configuration. Keep the release/runtime version at 1.0.14 unless intentionally coordinating a new native release and runtime migration.

## Production builds and OTA

Run EAS commands from the `mobile` directory and use the **production** profile/channel for release work. Fire TV and Android TV APKs use the same Android production profile.

```sh
cd mobile
npx eas-cli build --platform android --profile production
npx eas-cli update --channel production --platform android --message "Describe the JavaScript update" --non-interactive
```

OTA updates can deliver compatible JavaScript and assets only. Changes to native Android code, config plugins, permissions, or native dependencies require a new production build before the feature is available on devices. The production channel currently targets runtime 1.0.14.

## Backend

The backend source is in `backend/`. Railway production is linked to the `quantum-tv` service. To deploy backend changes, review the diff and deploy from the repository root using the linked Railway project:

```sh
railway status
railway up --service quantum-tv
```

Streaming reliability improvements reduce the chance that a recoverable task or upstream issue interrupts service, but cannot guarantee that third-party providers, network connections, or hosting infrastructure will never fail.

## Project layout

- `mobile/` — Expo Router app for Android TV / Fire TV and iOS.
- `backend/` — FastAPI API, IPTV catalog caching, favorites, and stream proxying.
- `frontend/` — web control panel.
