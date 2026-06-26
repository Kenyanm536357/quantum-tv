# Quantum TV — Product Requirements Document

## Original problem statement
> Build a mobile app: I want the app to stream live tv and movies from a Plex server credentials.
> ...I need a control panel side for me specifically so I can log into the admin panel on the app or the web that wires to the Quantum TV app and controls the Plex servers user — basically a Plex admin panel makeover.

## User-confirmed choices
- **Platform**: Native iOS / Android via **Expo (React Native)**. User has an Apple developer account.
- **Plex connection**: Plex OAuth (PIN flow) — no manual server URL entry required from end users.
- **Sections**: Live TV, Movies, TV Shows, Recently Added / Continue Watching, Search.
- **Design**: Match Quantum TV style (dark navy, purple→cyan gradient, neon, glass, bottom-tab navigation, "LIVE" red badges).
- **Admin**: A web (+ mobile-accessible) admin console wired to the same backend.

## Architecture
- `/app/backend/` — **FastAPI** + **MongoDB** (`motor`) backend on port 8001.
  - Plex PIN OAuth, server discovery, libraries, items, recently-added, continue-watching, search, live TV, transcoded HLS / direct stream URLs, image proxy.
  - Admin auth (JWT), user management, settings, activity, server aggregate view.
  - Plex tokens encrypted at rest with Fernet.
- `/app/frontend/` — **React (CRA + Tailwind)** admin web console on port 3000. Pages: Dashboard, Users, Plex Servers, Activity, Settings, Login.
- `/app/mobile/` — **Expo Router (TypeScript)** native mobile app. Pages: Login (Plex PIN), Browse (continue + recent + featured), Live TV grid, Movies, Series, Search, More (profile + server picker + disconnect), Player (`expo-video`).

## Implemented (MVP — 2026-06-26)
- ✅ Backend with 25+ endpoints (Plex PIN, resources, libraries, items, recently-added, continue-watching, search, livetv, stream, image proxy, admin login/stats/users/servers/settings/activity).
- ✅ Fernet-encrypted token storage in MongoDB.
- ✅ Admin web console: login + dashboard + users (ban/restore/delete) + servers + activity + settings (persists). Dark/neon Quantum TV branding using the user's own logo.
- ✅ Expo native mobile app scaffolded with full Plex PIN sign-in, bottom-tab navigation (Browse/Live TV/Movies/Series/Search/More), library grids, search, player using `expo-video`, server picker, disconnect.
- ✅ JWT auth (HS256), 30-day mobile tokens, 7-day admin tokens.
- ✅ Testing agent: backend 47/47 pytest assertions PASS; admin web UI verified end-to-end.

## Prioritised backlog
### P1
- Wire Plex playback session reporting back to admin Activity (`/api/admin/activity`) so the dashboard shows real "now playing" data instead of last-login synthesis.
- Tighten CORS allowlist to the production origin (currently `*`).
- HMAC-sign image proxy payload instead of raw base64 (currently exposes Plex token to anyone with the URL).
- Honour `user.status` in `get_current_user` so banned/revoked users get 403 on mobile.
- iOS / Android EAS production build profiles (`mobile/eas.json`) + push notification setup.

### P2
- TV Guide screen (EPG grid) using `/livetv/channels` + program data.
- Bookmarks, History, Reminders (mentioned in the reference design's bottom sheet).
- Multi-server load-balancing in the admin.
- Refresh-token rotation when Plex revokes a token.

## Next action items
1. (Owner) Open the Expo mobile app via Expo Go to sign into a real Plex account and validate Movies/Live TV streaming end-to-end on a phone.
2. (Owner) Set production CORS origin in `/app/backend/server.py` and rotate `FERNET_KEY` + `JWT_SECRET` before App Store / Play Store launch.
3. (Future) `eas build -p ios --profile production` for TestFlight.
