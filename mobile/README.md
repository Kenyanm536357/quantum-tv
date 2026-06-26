# Quantum TV — Mobile (Expo)

Native iOS / Android app that streams Live TV, Movies and TV Shows from a user's Plex Media Server. Sign-in uses **Plex's secure PIN OAuth** flow.

## Quick start (development)

```bash
cd mobile
npm install
# add the google fonts package once
npm install @expo-google-fonts/unbounded @expo-google-fonts/outfit
npx expo start
```

Scan the QR code with **Expo Go** (iOS / Android) and you're in.

### Backend URL
Set in `app.json` -> `expo.extra.backendUrl`. It's pre-configured to the preview environment URL.

## Production build (you have an Apple Developer account!)

```bash
# one-time
npm install -g eas-cli
eas login
eas build:configure

# iOS (TestFlight build)
eas build -p ios --profile production

# Android (Google Play APK/AAB)
eas build -p android --profile production
```

For App Store submission later: `eas submit -p ios`.

## Project structure
```
app/
  _layout.tsx          # Root layout, providers & fonts
  index.tsx            # Boot — redirects to /login or /(tabs)/browse
  login.tsx            # Plex PIN sign in
  (tabs)/
    _layout.tsx        # Bottom tab bar (Browse, Live TV, Movies, Series, Search, More)
    browse.tsx         # Featured / Continue Watching / Recently Added
    livetv.tsx         # Plex Live TV channel grid
    movies.tsx         # Movies library grid
    series.tsx         # TV Shows library grid
    search.tsx         # Search across libraries
    more.tsx           # Profile, server picker, disconnect
  player/[rk].tsx      # Full-screen video player (expo-video)
src/
  api.ts               # axios client + colors
  LibraryGrid.tsx      # Shared library grid for movies/shows
```

The whole app talks only to the FastAPI backend (`/api/*`). Your Plex token is encrypted on the backend with Fernet — the mobile app never sees it directly.
