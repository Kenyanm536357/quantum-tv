# Quantum TV — Test Credentials

## Admin Web Panel
- URL: `${REACT_APP_BACKEND_URL}/login` (web admin panel)
- Username: `admin`
- Password: `quantum2026`

Sourced from `/app/backend/.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`). Rotate before production.

## Plex Sign-in (mobile app)
No shared credentials — each user signs in with their own Plex account via the PIN OAuth flow.
For QA: any Plex account with at least one Media Server attached can be used.

## API base
Backend external URL: `https://740c242f-4923-4028-ac71-f7cfb28f51cc.preview.emergentagent.com`. All endpoints under `/api/*`.

## Quick admin login curl
```
curl -s -X POST $URL/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"quantum2026"}'
```
