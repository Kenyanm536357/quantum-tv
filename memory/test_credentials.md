# Quantum TV — Test Credentials

## Admin Web Panel (only you)
- URL: `${REACT_APP_BACKEND_URL}/login`
- Username: `admin`
- Password: `Quantum2024`

Sourced from `/app/backend/.env` (`ADMIN_USERNAME` / `ADMIN_PASSWORD`).

## User accounts (mobile app)
- Created by the admin inside the admin panel → Users → "New user".
- Each user has username + password + active/disabled status.
- Disabled users cannot sign in.

## Plex
- Linked once by the admin via Dashboard → "Connect Plex" (PIN OAuth, no manual token).
- All users stream from the admin's Plex server.

## API base
Backend external URL: `https://740c242f-4923-4028-ac71-f7cfb28f51cc.preview.emergentagent.com`. All endpoints under `/api/*`.

## Quick admin login curl
```
curl -s -X POST $URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Quantum2024"}'
```
