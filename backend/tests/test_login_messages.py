"""Iteration 6: validate the new auth error messages on /api/auth/login."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or "https://tv-ui-staging-1.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "admin"
ADMIN_PASS = "Quantum2024"

NEW_INVALID_MSG = "Incorrect username or password. Please try again."
NEW_DISABLED_MSG = "This account has been disabled. Contact the admin."
OLD_BAD_PHRASE = "not registered"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["role"] == "admin"
    return data["token"]


# -------- New error message coverage --------

def test_login_nonexistent_user_returns_new_message():
    r = requests.post(f"{API}/auth/login", json={"username": "no_such_user_xyz123", "password": "whatever"}, timeout=15)
    assert r.status_code == 401, r.text
    detail = r.json().get("detail", "")
    assert detail == NEW_INVALID_MSG, f"expected new msg, got: {detail!r}"
    assert OLD_BAD_PHRASE not in detail.lower()


def test_login_wrong_password_returns_new_message(admin_token):
    # Create a user, then try wrong password.
    headers = {"Authorization": f"Bearer {admin_token}"}
    uname = "TEST_wrongpw_user"
    pwd = "rightpw12345"
    # Create
    cr = requests.post(f"{API}/admin/users", json={"username": uname, "password": pwd, "display_name": "wrongpw"}, headers=headers, timeout=15)
    assert cr.status_code in (200, 201), cr.text
    user_id = cr.json().get("id")
    try:
        r = requests.post(f"{API}/auth/login", json={"username": uname, "password": "WRONG_PASSWORD"}, timeout=15)
        assert r.status_code == 401, r.text
        assert r.json().get("detail") == NEW_INVALID_MSG
    finally:
        if user_id:
            requests.delete(f"{API}/users/{user_id}", headers=headers, timeout=15)


def test_login_disabled_user_returns_new_message(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    uname = "TEST_disabled_user"
    pwd = "pw12345"
    cr = requests.post(f"{API}/admin/users", json={"username": uname, "password": pwd, "display_name": "disabled"}, headers=headers, timeout=15)
    assert cr.status_code in (200, 201), cr.text
    user_id = cr.json()["id"]
    try:
        # Disable
        pr = requests.patch(f"{API}/admin/users/{user_id}", json={"status": "disabled"}, headers=headers, timeout=15)
        assert pr.status_code == 200, pr.text
        # Attempt login
        r = requests.post(f"{API}/auth/login", json={"username": uname, "password": pwd}, timeout=15)
        assert r.status_code == 403, r.text
        assert r.json().get("detail") == NEW_DISABLED_MSG
    finally:
        requests.delete(f"{API}/admin/users/{user_id}", headers=headers, timeout=15)


# -------- Regressions --------

def test_admin_login_success():
    r = requests.post(f"{API}/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["role"] == "admin"
    assert data.get("token")


def test_admin_login_case_insensitive():
    r = requests.post(f"{API}/auth/login", json={"username": "ADMIN", "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


def test_user_create_login_delete(admin_token):
    headers = {"Authorization": f"Bearer {admin_token}"}
    uname = "TEST_media_check"
    pwd = "pw12345"
    cr = requests.post(f"{API}/admin/users", json={"username": uname, "password": pwd, "display_name": "media check"}, headers=headers, timeout=15)
    assert cr.status_code in (200, 201), cr.text
    user_id = cr.json()["id"]
    try:
        lr = requests.post(f"{API}/auth/login", json={"username": uname, "password": pwd}, timeout=15)
        assert lr.status_code == 200, lr.text
        body = lr.json()
        assert body["role"] == "user"
        assert body["username"].lower() == uname.lower()
        assert body.get("token")
    finally:
        dr = requests.delete(f"{API}/admin/users/{user_id}", headers=headers, timeout=15)
        assert dr.status_code in (200, 204), dr.text
