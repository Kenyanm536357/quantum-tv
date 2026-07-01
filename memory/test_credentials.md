# Quantum TV — Test Credentials

## Admin
- Username: `admin`
- Password: `Quantum2024`

## User (regular)
- Username: `test`
- Password: `Test12345`

## curl
```bash
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
# User login
curl -s -X POST "$API_URL/api/auth/login" -H "Content-Type: application/json" \
  -d '{"username":"test","password":"Test12345","device_id":"dev-1"}'
# Admin login
curl -s -X POST "$API_URL/api/admin/login" -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Quantum2024"}'
```
