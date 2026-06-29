"""Backend tests for case-insensitive login + whitespace trim (Fire TV autocap fix).

Strategy: We create our own throwaway 'test' user (with password '12345') if not
present so the user-side case-insensitive tests can run repeatably. Always
cleaned up at the end.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Quantum2024"
EXISTING_USER = "test"
EXISTING_USER_PW = "12345"


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/auth/login", json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _find_user(s, admin_headers, uname):
    r = s.get(f"{API}/admin/users", headers=admin_headers)
    assert r.status_code == 200
    users = r.json().get("users", [])
    for u in users:
        if u.get("username", "").lower() == uname.lower():
            return u
    return None


@pytest.fixture(scope="session")
def seeded_test_user(s, admin_headers):
    """Make sure 'test'/'12345' user exists. Don't delete if pre-existed."""
    existing = _find_user(s, admin_headers, EXISTING_USER)
    if existing:
        yield existing
        return
    r = s.post(f"{API}/admin/users", headers=admin_headers, json={
        "username": EXISTING_USER, "password": EXISTING_USER_PW, "status": "active",
    })
    assert r.status_code == 200, f"seed create failed: {r.status_code} {r.text}"
    created = r.json()
    yield created
    s.delete(f"{API}/admin/users/{created['id']}", headers=admin_headers)


# ----------------- Admin login: case-insensitive -----------------
class TestAdminLoginCaseInsensitive:
    @pytest.mark.parametrize("uname", ["admin", "ADMIN", "Admin", "aDmIn"])
    def test_admin_login_variants(self, s, uname):
        r = s.post(f"{API}/auth/login", json={"username": uname, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, f"{uname} -> {r.status_code} {r.text}"
        data = r.json()
        assert data["role"] == "admin"
        assert "token" in data and data["token"]

    @pytest.mark.parametrize("uname", ["  admin  ", "\tadmin\n", " ADMIN ", "  Admin\t"])
    def test_admin_login_whitespace_trim(self, s, uname):
        r = s.post(f"{API}/auth/login", json={"username": uname, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, f"{repr(uname)} -> {r.status_code} {r.text}"
        assert r.json()["role"] == "admin"


# ----------------- Existing 'test' user login -----------------
class TestExistingUserLogin:
    def test_original_casing(self, s, seeded_test_user):
        r = s.post(f"{API}/auth/login", json={"username": EXISTING_USER, "password": EXISTING_USER_PW})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["role"] == "user"
        assert d["username"].lower() == "test"

    @pytest.mark.parametrize("uname", ["TEST", "Test", "tEsT"])
    def test_case_insensitive(self, s, seeded_test_user, uname):
        r = s.post(f"{API}/auth/login", json={"username": uname, "password": EXISTING_USER_PW})
        assert r.status_code == 200, f"{uname} -> {r.status_code} {r.text}"
        assert r.json()["role"] == "user"

    def test_whitespace_trim(self, s, seeded_test_user):
        r = s.post(f"{API}/auth/login", json={"username": " test ", "password": EXISTING_USER_PW})
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "user"


# ----------------- Generic 401 error -----------------
class TestLoginGenericErrors:
    def test_wrong_password(self, s, seeded_test_user):
        r = s.post(f"{API}/auth/login", json={"username": EXISTING_USER, "password": "wrong"})
        assert r.status_code == 401
        detail = r.json().get("detail", "").lower()
        assert "not registered" in detail or "not activated" in detail, detail

    def test_unknown_user(self, s):
        r = s.post(f"{API}/auth/login", json={"username": "totally_not_real_zz", "password": "anything"})
        assert r.status_code == 401
        detail = r.json().get("detail", "").lower()
        assert "not registered" in detail or "not activated" in detail, detail


# ----------------- Create-user round trip -----------------
class TestCreateUserRoundTrip:
    def test_create_login_variants_delete(self, s, admin_headers):
        created_id = None
        try:
            r = s.post(f"{API}/admin/users", headers=admin_headers, json={
                "username": "firestick_user",
                "password": "mypw123",
                "display_name": "FireStickUser",
                "status": "active",
            })
            assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
            created = r.json()
            created_id = created["id"]
            assert created["username"] == "firestick_user"

            for uname in ["firestick_user", "FIRESTICK_USER", "Firestick_User", " firestick_user "]:
                lr = s.post(f"{API}/auth/login", json={"username": uname, "password": "mypw123"})
                assert lr.status_code == 200, f"login {repr(uname)} -> {lr.status_code} {lr.text}"
                assert lr.json()["role"] == "user"
        finally:
            if created_id:
                d = s.delete(f"{API}/admin/users/{created_id}", headers=admin_headers)
                assert d.status_code == 200, f"cleanup delete failed: {d.status_code} {d.text}"


# ----------------- Create-user whitespace trim -----------------
class TestCreateUserWhitespaceTrim:
    def test_trim_on_create(self, s, admin_headers):
        created_id = None
        try:
            r = s.post(f"{API}/admin/users", headers=admin_headers, json={
                "username": "  ws_user  ",
                "password": "pw123456",
                "status": "active",
            })
            assert r.status_code == 200, f"create failed: {r.status_code} {r.text}"
            created = r.json()
            created_id = created["id"]
            assert created["username"] == "ws_user", f"stored username not trimmed: {created['username']}"

            lr = s.get(f"{API}/admin/users", headers=admin_headers)
            assert lr.status_code == 200
            users = lr.json().get("users", [])
            matched = [u for u in users if u.get("username") == "ws_user"]
            assert matched, f"ws_user not found in list (sample={users[:3]})"

            for uname in ["ws_user", "WS_USER"]:
                lg = s.post(f"{API}/auth/login", json={"username": uname, "password": "pw123456"})
                assert lg.status_code == 200, f"login {uname} -> {lg.status_code} {lg.text}"
                assert lg.json()["role"] == "user"
        finally:
            if created_id:
                s.delete(f"{API}/admin/users/{created_id}", headers=admin_headers)


# ----------------- Case-insensitive duplicate check -----------------
class TestDuplicateCheck:
    def test_duplicate_mixed_case(self, s, admin_headers, seeded_test_user):
        # 'test' exists (seeded). Creating 'TEST' should return 409.
        r = s.post(f"{API}/admin/users", headers=admin_headers, json={
            "username": "TEST",
            "password": "xxxxxx",
            "status": "active",
        })
        # If it succeeded due to bug, cleanup
        if r.status_code == 200:
            new_id = r.json().get("id")
            if new_id:
                s.delete(f"{API}/admin/users/{new_id}", headers=admin_headers)
        assert r.status_code == 409, f"expected 409, got {r.status_code} {r.text}"
        detail = r.json().get("detail", "").lower()
        assert "already" in detail or "exist" in detail, detail
