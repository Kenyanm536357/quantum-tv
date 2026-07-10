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

## Implemented (IPTV Live TV merge into user players — 2026-07-01)
- ✅ **IPTV proxy stack** (server.py): three new endpoints — `/api/iptv/p/{kind}/{id}.{ext}` (manifest rewrite), `/api/iptv/pass?k=` (Fernet-encrypted upstream segment passthrough), `/api/iptv/logo?u=` (HTTPS logo proxy). Users never see the IPTV origin or credentials.
- ✅ **Live TV merge**: `/api/livetv/channels` now returns Plex + IPTV channels in one array, each item tagged `source: "plex" | "iptv"`. IPTV keys use `iptv-live-<streamId>`.
- ✅ **Stream URL minting**: `/api/stream/{rk}` recognises `iptv-*` keys, mints a 6-hour scoped JWT, returns an absolute HTTPS URL for `<video>`/expo-video.
- ✅ **Metadata stub**: `/api/metadata/{rk}` synthesises a minimal doc for `iptv-*` keys so the player title/thumb render correctly.
- ✅ **Web UI** (`Watch.js` LiveTV): source-filter chips (All / Plex / IPTV), search box, 300-item display cap with overflow hint, LIVE badges, contain-fit logos, sort dropdown intact.
- ✅ **Mobile UI** (`app/(tabs)/livetv.tsx`): matching chips + search, FlatList perf (initialNumToRender=20, removeClippedSubviews). Focusable / D-Pad friendly.
- ✅ **Hardening**: `ext` whitelist on `iptv_proxy` (m3u8/ts/mp4/mkv only); segment URLs Fernet-encrypted so proxy can't be pointed at arbitrary hosts.
- ✅ **v1.0.6 APK** rebuilding on EAS with all these mobile changes plus the TV Pairing flow from prior session.
- ✅ Verified: iteration_9 — 15/15 pytest, 100% frontend Playwright, end-to-end network trace (livetv → metadata → stream → m3u8 → segments) all 200.

## Implemented (Subscriptions + Seasons/Episodes — 2026-06-30)
- ✅ **Subscription system (Setplex/Nora-style)**: 1–12 month plans, auto-expiration, KS-XXX-XXX account numbers, `subscription_status` pill (active/expiring/expired) with `days_left`, manual extend +N months from admin.
- ✅ **Device slots**: admin sets `max_devices` (default 3). On login the mobile app sends `device_id` (cached in AsyncStorage), `device_model`, `device_name` — backend auto-registers into the first open slot. Device limit hit → 403 with clear message. Admin can set-primary / remove devices.
- ✅ **Notes tab** per subscriber (admin can add timestamped notes; delete on demand).
- ✅ **Expired-subscription login**: 403 with detail "Your subscription has expired. Contact the admin to renew."
- ✅ **Manage Drawer** (Subscription / Devices / Notes tabs) accessible from each user row.
- ✅ **Search-bar overlap fix**: `.qtv-input` padding split into `padding-block` + `:where()`-wrapped `padding-inline` so Tailwind `pl-10` always wins.
- ✅ **TV Show seasons + episodes**: New `/watch/show/:rk` page. Backend exposes `index`, `parent_index`, `parent_rating_key`, `grandparent_rating_key`, `parent_thumb`, `grandparent_thumb` for proper season/episode shapes. MediaCard auto-routes shows to /watch/show, movies/episodes to /watch/play.
- ✅ **APK v1.0.5** queued on EAS with device-id + expired-state UX.
- ✅ Verified: iteration_8 — 100% backend + frontend tests pass.

## Implemented (Preview/Production environment banner + auto-refresh — 2026-06-29 #3)
- ✅ Added `IS_PRODUCTION_BACKEND` detection in `/app/frontend/src/api.js` (regex match on quantumtv.app / emergent.host).
- ✅ Amber warning banner with `AlertTriangle` icon now renders on the admin login page AND on every admin shell page when on PREVIEW. Banner explains that users created here won't appear on the Fire Stick and links to https://quantumtv.app/login. Banner is hidden on production. (Solves root-cause of "users not syncing": preview and production have separate MongoDBs; banner makes the mismatch unmissable.)
- ✅ Users page now refreshes every 20s + on window focus + has a manual refresh button. Modal shows a big success screen with the literal credentials so admin can't be unsure whether the user was created.
- ✅ `/app/mobile/.env` `EXPO_PUBLIC_BACKEND_URL` now canonically points at https://quantumtv.app (was emergent.host — same DB but less obvious). Existing v1.0.3 APK still works because emergent.host still serves the production DB; only future EAS builds use the new value.
- ✅ Verified: 22/22 frontend tests pass (iteration_5).

## Implemented (Mobile-responsive admin + watch surfaces — 2026-06-29 #2)
- ✅ Backend `/api/auth/login` is now case-insensitive and trims whitespace (fixes Fire TV / iOS Safari autocap breaking sign-in). Same trim + case-insensitive duplicate check on `/api/admin/users` create. 18/18 backend tests pass.
- ✅ Admin Control Panel mobile-responsive overhaul: desktop sidebar → slide-out drawer w/ hamburger, Users + Activity tables → cards on mobile, Dashboard stats 2x2 on mobile, Modal slides up from bottom. 11/11 frontend tests pass.
- ✅ Watch / Live TV surface mobile-responsive overhaul (`/app/frontend/src/pages/Watch.js`): MediaCard gained `fluid` prop, all H1s scale text-2xl→3xl→4xl, mobile tab strip horizontal-scrolls below header, Row carousel loading skeleton now has internal overflow-x-auto (fixes 454px horizontal bleed on mobile Browse), `<main>` has defensive overflow-x-hidden, FeaturedHero scales h-[220px]→360px, Player title + action buttons stack cleanly on mobile, all grids use 3 cols on mobile / 6 on desktop with fluid posters. 10/10 retests pass.
- ✅ Test user `test` / `12345` reseeded; verified case-insensitive login works for `test`, `Test`, `TEST`, ` test `.

## Implemented (Fire TV keyboard fix — 2026-06-29)
- ✅ Added reusable `mobile/src/TVTextInput.tsx` — wraps any `TextInput` in a focusable `Pressable` and explicitly calls `ref.focus()` on Select-press so the on-screen keyboard opens on Fire TV / Android TV (bare `TextInput` is not D-pad-focusable on the `react-native-tvos` fork).
- ✅ Replaced `<TextInput />` on Login (username + password) and Search screens with `TVTextInput`.
- ✅ Username field is now the TV preferred-focus target on the Login screen.
- ✅ EAS build #7 produced APK **v1.0.3 (versionCode 4)** and was uploaded to the Fire TV downloader at `/api/q` (sha256: `acb2b3776451`). Short URL: https://is.gd/uorYZt (preview) / https://quantumtv.app/api/q (production).

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

## Session 2026-07-08
- ✅ Discovered v1.0.11 EAS build had finished (build a831ae64) but was never uploaded to `/api/q`. Downloaded artifact and uploaded to PRODUCTION `quantumtv.app/api/q` with `?version=1.0.11` (sha256 c0e28b6a2100, 88.9MB). Download link verified serving APK (HTTP 200).
- ✅ Removed leftover `scale: 1.02` transform on Browse hero card (`/app/mobile/app/(tabs)/browse.tsx`) — user disliked "weird movement".
- ✅ Bumped app.json to v1.0.12 (versionCode 13) and started EAS build 680ec05d-ce8d-4b03-bc32-9883423fb24f (profile firetv). Free-tier build takes hours; when finished, download artifact and upload to `/api/q?version=1.0.12`.
- ℹ️ Expo auth: user provided EXPO_TOKEN (in chat, 2026-07-08). Use `export EXPO_TOKEN=...` with eas-cli.
- ℹ️ EAS warns `expo-updates` not installed — installing it (P1) would enable OTA JS updates, no more APK reinstalls via Downloader.

## Pending
- v1.0.12 build in progress on EAS → upload to /api/q when done.
- iOS TestFlight build (user requested; needs Apple Developer credentials + eas.json ios profile).
- Favorites + Recently Watched strips on Live TV (P1).

## Session 2026-07-08 (part 2 — OTA updates)
- ✅ Installed `expo-updates` (~0.25.28) + ran `eas update:configure` → app.json now has `updates.url` (u.expo.dev/dcff3612…) and `runtimeVersion: {policy: appVersion}`.
- ✅ Built **v1.0.13 (versionCode 14)** with OTA baked in (EAS build e25f4749). Uploaded to PRODUCTION `quantumtv.app/api/q?version=1.0.13` (sha 01f52bb37319, 91MB). Verified serving.
- ✅ Published baseline OTA update to channel `firetv` (update group 5892372d-c57b-404e-8623-290a9dee535a). Pipeline verified end-to-end.
- 🔧 HOW TO PUSH OTA UPDATES: `cd /app/mobile && export EXPO_TOKEN=<token> && npx eas-cli update --channel firetv --message "..." --non-interactive`. DO NOT bump app.json version for JS-only fixes (runtimeVersion=appVersion means OTA only reaches builds with same version, currently 1.0.13). Bump version ONLY when native deps/config change → then full APK rebuild + upload to /api/q.
- 🔧 ARM64 container fix: x86_64 hermesc wrapped with qemu-user-static (`/app/mobile/scripts/fix-hermesc.sh`, wired as package.json postinstall). Required for `eas update` local export. qemu-user-static installed via apt.
- 🔧 Added `/app/mobile/app.config.js`: dedupes android.permissions/intentFilters (expo config loader duplicated them, which EAS Update manifest validation rejects).
- ℹ️ v1.0.12 build (680ec05d) finished but was superseded by 1.0.13 — never uploaded, intentionally.

## Session 2026-07-08/10 (part 3 — blue screen fix + collapsible rail)
- 🐛 ROOT CAUSE of user's "blue screen on activation": splash screen (logo.png = blue gradient square) stuck on screen, never hiding — side-effect of adding expo-updates. Fix: `SplashScreen.preventAutoHideAsync()` + explicit `hideAsync()` after fonts load in `/app/mobile/app/_layout.tsx`.
- ✅ Fixed login screen over-padding: was using SAFE.left (incl. rail width) on both sides; now uses SAFE.right.
- ✅ Netflix-style collapsible TV nav rail (`/app/mobile/app/(tabs)/_layout.tsx`): collapsed 68px icon-only by default (SIDE_RAIL_W=68 in responsive.ts, drives content SAFE.left), expands to 230px (SIDE_RAIL_EXPANDED_W) while D-pad focus is inside rail via onFocus/onBlur + 120ms collapse timer, collapses on selection. Expanded rail overlays content (absolute, elevation 20). No animations per user preference.
- ✅ Published 2 OTA updates to channel firetv (runtime 1.0.13): splash fix (7791a757) + collapsible rail (group in eas_update4).
- ✅ Rebuilt APK v1.0.13 versionCode 15 (build 59c1e021) with all fixes embedded → uploaded to PRODUCTION /api/q (sha 6a706190f164, 91MB). Verified serving.
- ⚠️ USER VERIFICATION PENDING: blue screen fix + rail collapse behavior on Fire Stick. User can either OTA-heal (force-stop → open → wait 20s → force-stop → reopen) or reinstall from Downloader link.


## Session 2026-07-10 (Live TV Favorites + Recently Watched + Channel Jump — P1 + P3)
- ✅ **Backend** (`/app/backend/server.py` ~lines 1895-2000): 8 new endpoints under `/api/me/live/*`:
  - `GET/POST /favorites` and `DELETE /favorites/{key}` — pinned channels (star)
  - `GET/POST /recent`, `DELETE /recent` (clear-all), `DELETE /recent/{key}` — most-recent-first list capped at 20
  - Storage: SNAPSHOTS on user document (`live_favorites`, `live_recent`) with fields `{key,title,logo,number,source,watched_at?}` — snapshots survive IPTV key churn.
  - Atomic upserts via mongo aggregation-pipeline update (`$filter+$concatArrays+$slice`) so a rapid double-click can't produce dupes.
  - `get_current_user` projection extended to include the new fields.
- ✅ **Web frontend** (`/app/frontend/src/pages/Watch.js`): New `LiveChannelCard` + `LiveChannelRow` components rendered inside `LiveTV`.
  - ⭐ **Favorites row** and **Recently Watched row** appear at the top of `/watch/live`. Both hidden while user is filtering (search text OR non-`all` source chip) so the filter doesn't feel misleading.
  - **Star button** (`data-testid="live-fav-<key>"`) top-right of every channel card toggles favorite. Star fills gold when active.
  - **Recently Watched** is auto-populated when the user clicks any channel card (fire-and-forget mutation before nav).
  - Newest useMutation invalidates `live-favorites` / `live-recent` react-query keys.
- ✅ **Mobile TV app** (`/app/mobile/app/(tabs)/livetv.tsx`): Rewritten with:
  - **Favorites + Recently Watched rows** via `TVFocusGuideView` + horizontal `FlatList` (matching Browse's Netflix-style row pattern).
  - **Long-press to favorite/unfavorite** a channel (works with D-pad Select long-press on Fire TV).
  - Gold star badge on the card when a channel is favorited.
  - **Channel-number quick jump** — two paths for TV:
    1. `useTVEventHandler` intercepts digit key presses (0-9) — works with USB keyboards & 3rd-party remotes that send numeric keycodes. Buffered with 1.6s auto-commit timeout; float overlay banner shows current buffer.
    2. **"🔢 Jump" button** in the header opens a full D-pad-friendly numpad modal (1-9, 0, ⌫, Go, Clear, Close) — works with the vanilla Fire TV remote which has no digit keys.
  - Commit logic finds the channel with matching `number` field and calls `openChannel` (records recent + navigates to player).
- ✅ **OTA update pushed** to channel `firetv` (runtime 1.0.13) — group `0e601035-d30c-4d4d-aea9-0da6bb3e21fd`. User's installed APK v1.0.13b will fetch this on next launch.
- ✅ Verified via `testing_agent_v3_fork` iteration_10 — 5/5 pytest pass, 100% frontend playwright pass (star toggle, persistence on reload, recent auto-record, filter-hides-rows all confirmed). No bugs found.
- ⚠️ **PRODUCTION BACKEND NOT YET REDEPLOYED**: the new `/api/me/live/*` endpoints exist in PREVIEW only. Once the user clicks "Redeploy" on `quantumtv.app`, the mobile OTA will light up (until then, star clicks / row queries will 404 silently and rows will hide gracefully because both are wrapped in `if (!items?.length) return null`).


## Session 2026-07-10 (HOTFIX: Fire TV nav-rail focus getting stuck on Browse)
- **Bug**: After the prior OTA push, Fire TV user reported D-pad up/down snapped focus back to "Browse" every time, blocking navigation. Gray/dark rail background bled visually.
- **Root cause** (verified from screen recording IMG_6649.mov):
  1. `hasTVPreferredFocus={active}` was being re-applied on every re-render inside `TVSideRail`. React Native TV's native focus finder re-honors this prop on subsequent renders, snapping focus back to whichever tab was currently "active" (Browse) on every D-pad event.
  2. Rail's outer `width` toggled between `SIDE_RAIL_W` (68px) and `SIDE_RAIL_EXPANDED_W` (~230px) on expand/collapse, causing layout thrash mid-focus-transition which broke the focus finder.
  3. Semi-transparent `rgba(6,7,20,0.94)` rail background revealed content behind — the "gray border not covering panel" the user reported.
- **Fix** (`/app/mobile/app/(tabs)/_layout.tsx`):
  - Pinned the **outer container width** to `SIDE_RAIL_EXPANDED_W` always (`position:absolute`, `pointerEvents="box-none"`). Only the INNER rail resizes now, so parent layout never thrashes.
  - Captured the initial tab index in an `initialTabIndex` **ref at mount** — pass `hasTVPreferredFocus={i === initialTabIndex.current}` so it fires only once on first mount, never on subsequent re-renders.
  - Rail background is now solid `#060714` (both collapsed and expanded states).
  - Extended `onBlur` collapse delay 120ms → 180ms so a sibling's `onFocus` reliably cancels the collapse during same-frame D-pad transitions.
  - Cleared collapse timer on unmount.
- Applied same **mount-ref pattern** to `hasPreferredFocus` on the first grid card in `/app/mobile/app/(tabs)/livetv.tsx` (via `initialShowStripsRef`) to avoid the same failure mode on LiveTV.
- **OTA pushed** to channel `firetv` (runtime 1.0.13) — group `10c00b2c-0d3f-472c-a6a6-7a845b5f8be1`. Fire TV picks it up on next app launch (force-stop → reopen for fastest pickup).
- **Regression verified**: `testing_agent_v3_fork` iteration_11 — backend 8/8 pytest pass, frontend 100% pass on all 7 top-nav routes + live favorites/recent flows. No regressions.
- **User verification pending**: user still needs to confirm Fire TV rail navigation is fixed after picking up the OTA (Playwright cannot drive a Fire TV D-pad).
