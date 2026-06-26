"""Backend API tests for Quantum TV - admin auth, settings, user mgmt, Plex PIN flow, auth gating."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://740c242f-4923-4028-ac71-f7cfb28f51cc.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "quantum2026"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/admin/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data.get("username") == ADMIN_USERNAME
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ---------------- Health ----------------
class TestHealth:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        d = r.json()
        assert d["service"] == "quantum-tv"
        assert d["status"] == "ok"


# ---------------- Admin auth ----------------
class TestAdminAuth:
    def test_login_success(self, s):
        r = s.post(f"{API}/admin/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/admin/login", json={"username": ADMIN_USERNAME, "password": "wrong"})
        assert r.status_code == 401

    def test_login_wrong_username(self, s):
        r = s.post(f"{API}/admin/login", json={"username": "nobody", "password": "x"})
        assert r.status_code == 401

    def test_admin_me(self, s, admin_headers):
        r = s.get(f"{API}/admin/me", headers=admin_headers)
        assert r.status_code == 200
        assert r.json()["role"] == "admin"


# ---------------- Admin protected endpoints reject missing token ----------------
class TestAdminProtected:
    ENDPOINTS = ["/admin/stats", "/admin/users", "/admin/servers", "/admin/activity", "/admin/settings", "/admin/me"]

    @pytest.mark.parametrize("ep", ENDPOINTS)
    def test_requires_token(self, s, ep):
        r = s.get(f"{API}{ep}")
        assert r.status_code == 401, f"{ep} expected 401, got {r.status_code}"

    @pytest.mark.parametrize("ep", ENDPOINTS)
    def test_invalid_token(self, s, ep):
        r = s.get(f"{API}{ep}", headers={"Authorization": "Bearer not.a.jwt"})
        assert r.status_code == 401

    @pytest.mark.parametrize("ep", ENDPOINTS)
    def test_with_token_ok(self, s, ep, admin_headers):
        r = s.get(f"{API}{ep}", headers=admin_headers)
        assert r.status_code == 200, f"{ep} -> {r.status_code} {r.text[:200]}"


# ---------------- Admin settings ----------------
class TestAdminSettings:
    def test_get_returns_defaults(self, s, admin_headers):
        r = s.get(f"{API}/admin/settings", headers=admin_headers)
        assert r.status_code == 200
        d = r.json()
        for k in ("service_name", "allow_new_signups", "require_invite", "motd"):
            assert k in d

    def test_update_and_persist(self, s, admin_headers):
        suffix = uuid.uuid4().hex[:6]
        new_name = f"Quantum TV {suffix}"
        new_motd = f"Test MOTD {suffix}"
        r = s.put(f"{API}/admin/settings", headers=admin_headers,
                  json={"service_name": new_name, "motd": new_motd, "allow_new_signups": False})
        assert r.status_code == 200
        # read-after-write
        r2 = s.get(f"{API}/admin/settings", headers=admin_headers)
        d = r2.json()
        assert d["service_name"] == new_name
        assert d["motd"] == new_motd
        assert d["allow_new_signups"] is False

        # public /api/config reflects it
        r3 = s.get(f"{API}/config")
        assert r3.status_code == 200
        assert r3.json()["service_name"] == new_name


# ---------------- Admin users PATCH ----------------
class TestAdminUserStatus:
    def test_invalid_status_400(self, s, admin_headers):
        r = s.patch(f"{API}/admin/users/nonexistent-id", headers=admin_headers, json={"status": "bogus"})
        assert r.status_code == 400

    @pytest.mark.parametrize("status", ["banned", "active", "revoked"])
    def test_valid_status_on_missing_user(self, s, admin_headers, status):
        # User likely does not exist -> 404 acceptable per review spec ("200 even though user may not exist (404)")
        r = s.patch(f"{API}/admin/users/nonexistent-{uuid.uuid4().hex}",
                    headers=admin_headers, json={"status": status})
        assert r.status_code in (200, 404), f"{status} -> {r.status_code} {r.text}"


# ---------------- Plex PIN flow ----------------
class TestPlexPin:
    def test_create_pin(self, s):
        r = s.post(f"{API}/plex/pin")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("pin_id", "code", "auth_url", "client_identifier"):
            assert k in d and d[k]
        assert d["auth_url"].startswith("https://app.plex.tv/auth#?")
        # poll fresh pin -> linked false
        r2 = s.get(f"{API}/plex/pin/{d['pin_id']}")
        assert r2.status_code == 200
        assert r2.json()["linked"] is False

    def test_poll_nonexistent_pin_404(self, s):
        r = s.get(f"{API}/plex/pin/999999999")
        assert r.status_code == 404


# ---------------- User auth gating ----------------
class TestUserAuthGating:
    USER_ENDPOINTS = [
        "/me", "/servers", "/libraries", "/recently-added", "/continue-watching",
        "/search?q=x", "/livetv/channels", "/stream/123",
    ]

    @pytest.mark.parametrize("ep", USER_ENDPOINTS)
    def test_no_token(self, s, ep):
        r = s.get(f"{API}{ep}")
        assert r.status_code == 401, f"{ep} -> {r.status_code}"

    @pytest.mark.parametrize("ep", USER_ENDPOINTS)
    def test_bad_token(self, s, ep):
        r = s.get(f"{API}{ep}", headers={"Authorization": "Bearer abc.def.ghi"})
        assert r.status_code == 401
