"""Iteration 7: subscription management + device slots + notes endpoints."""
import os
import re
from datetime import datetime, timezone, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tv-ui-staging-1.preview.emergentagent.com").rstrip("/")
ADMIN_USER = "admin"
ADMIN_PASS = "Quantum2024"

ACCT_RE = re.compile(r"^KS-\d{3}-\d{3}$")

# ---------- fixtures ----------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"username": ADMIN_USER, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _make_user(admin_headers, suffix, months=6, max_devices=5, password="pw_iter7"):
    username = f"TEST_iter7_{suffix}"
    r = requests.post(
        f"{BASE_URL}/api/admin/users",
        headers=admin_headers,
        json={"username": username, "password": password,
              "subscription_months": months, "max_devices": max_devices},
    )
    return username, password, r


@pytest.fixture
def cleanup_users(admin_headers):
    created = []
    yield created
    for uid in created:
        requests.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=admin_headers)


# ---------- tests ----------
class TestCreateUser:
    def test_create_user_returns_account_number_and_subscription_fields(self, admin_headers, cleanup_users):
        username, password, r = _make_user(admin_headers, "create", months=6, max_devices=5)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["subscription_months"] == 6
        assert data["max_devices"] == 5
        assert "id" in data
        cleanup_users.append(data["id"])

        # GET to verify persisted
        g = requests.get(f"{BASE_URL}/api/admin/users/{data['id']}", headers=admin_headers)
        assert g.status_code == 200, g.text
        full = g.json()
        assert ACCT_RE.match(full["account_number"]), full["account_number"]
        assert full["subscription_months"] == 6
        assert full["max_devices"] == 5
        assert full["subscription_status"] == "active"
        assert full["days_left"] >= 175  # 6 months ~ 180 days


class TestLoginDeviceRegistration:
    def test_login_auto_registers_device(self, admin_headers, cleanup_users):
        username, password, r = _make_user(admin_headers, "dev1", months=6, max_devices=5)
        user_id = r.json()["id"]
        cleanup_users.append(user_id)

        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": username, "password": password,
            "device_id": "dev-1", "device_model": "AFTKA", "device_name": "Living Room",
        })
        assert login.status_code == 200, login.text
        body = login.json()
        assert body["role"] == "user"
        assert ACCT_RE.match(body["account_number"])
        assert body["subscription"]["status"] == "active"
        assert body["subscription"]["days_left"] >= 175
        assert "expires_at" in body["subscription"]

        # Verify device list
        full = requests.get(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers).json()
        assert len(full["devices"]) == 1
        d = full["devices"][0]
        assert d["id"] == "dev-1"
        assert d["model"] == "AFTKA"
        assert d["name"] == "Living Room"
        assert d["primary"] is True

    def test_device_limit_enforced(self, admin_headers, cleanup_users):
        username, password, r = _make_user(admin_headers, "limit", months=3, max_devices=2)
        user_id = r.json()["id"]
        cleanup_users.append(user_id)
        for i in range(2):
            lr = requests.post(f"{BASE_URL}/api/auth/login", json={
                "username": username, "password": password,
                "device_id": f"dev-{i}", "device_model": "M", "device_name": f"D{i}",
            })
            assert lr.status_code == 200, lr.text
        over = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": username, "password": password,
            "device_id": "dev-X", "device_model": "M", "device_name": "Extra",
        })
        assert over.status_code == 403
        assert "Device limit reached (2)" in over.json().get("detail", "")


class TestSubscriptionExpiry:
    def test_expired_login_blocked(self, admin_headers, cleanup_users):
        username, password, r = _make_user(admin_headers, "expired")
        user_id = r.json()["id"]
        cleanup_users.append(user_id)
        # Force expired
        p = requests.patch(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers,
                           json={"set_expires_at": "2020-01-01T00:00:00+00:00"})
        assert p.status_code == 200
        lr = requests.post(f"{BASE_URL}/api/auth/login",
                           json={"username": username, "password": password})
        assert lr.status_code == 403
        assert "subscription has expired" in lr.json().get("detail", "").lower()

    def test_extend_months_from_future(self, admin_headers, cleanup_users):
        username, password, r = _make_user(admin_headers, "extend", months=6)
        user_id = r.json()["id"]
        cleanup_users.append(user_id)
        before = requests.get(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers).json()
        before_days = before["days_left"]
        p = requests.patch(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers,
                           json={"extend_months": 3})
        assert p.status_code == 200
        after = requests.get(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers).json()
        assert after["days_left"] - before_days >= 85  # ~90 day increase

    def test_extend_months_from_now_when_expired(self, admin_headers, cleanup_users):
        username, password, r = _make_user(admin_headers, "extexp")
        user_id = r.json()["id"]
        cleanup_users.append(user_id)
        requests.patch(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers,
                       json={"set_expires_at": "2020-01-01T00:00:00+00:00"})
        p = requests.patch(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers,
                           json={"extend_months": 3})
        assert p.status_code == 200
        after = requests.get(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers).json()
        assert after["days_left"] >= 85  # ~90 days from now
        assert after["subscription_status"] == "active"

    def test_subscription_view_statuses(self, admin_headers, cleanup_users):
        username, password, r = _make_user(admin_headers, "statuses")
        user_id = r.json()["id"]
        cleanup_users.append(user_id)

        def _set(days_offset):
            target = (datetime.now(timezone.utc) + timedelta(days=days_offset)).isoformat()
            requests.patch(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers,
                           json={"set_expires_at": target})
            return requests.get(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers).json()

        assert _set(30)["subscription_status"] == "active"
        assert _set(5)["subscription_status"] == "expiring"
        assert _set(-1)["subscription_status"] == "expired"


class TestDevicesAdmin:
    def test_patch_primary_and_delete(self, admin_headers, cleanup_users):
        username, password, r = _make_user(admin_headers, "devmgmt", months=3, max_devices=3)
        user_id = r.json()["id"]
        cleanup_users.append(user_id)
        # Register two devices
        for i in range(2):
            requests.post(f"{BASE_URL}/api/auth/login", json={
                "username": username, "password": password,
                "device_id": f"d-{i}", "device_model": "M", "device_name": f"N{i}",
            })
        # Flip primary to d-1
        p = requests.patch(f"{BASE_URL}/api/admin/users/{user_id}/devices/d-1",
                           headers=admin_headers, json={"primary": True})
        assert p.status_code == 200
        u = requests.get(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers).json()
        primaries = {d["id"]: d["primary"] for d in u["devices"]}
        assert primaries["d-1"] is True
        assert primaries["d-0"] is False
        # Delete d-0
        d = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}/devices/d-0", headers=admin_headers)
        assert d.status_code == 200
        assert d.json().get("remaining") == 1
        u2 = requests.get(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers).json()
        assert len(u2["devices"]) == 1
        assert u2["devices"][0]["id"] == "d-1"


class TestNotes:
    def test_note_create_and_delete(self, admin_headers, cleanup_users):
        username, password, r = _make_user(admin_headers, "notes")
        user_id = r.json()["id"]
        cleanup_users.append(user_id)
        # Empty text -> 400
        bad = requests.post(f"{BASE_URL}/api/admin/users/{user_id}/notes",
                            headers=admin_headers, json={"text": "   "})
        assert bad.status_code == 400
        # Good
        good = requests.post(f"{BASE_URL}/api/admin/users/{user_id}/notes",
                             headers=admin_headers, json={"text": "Hello"})
        assert good.status_code == 200
        n = good.json()
        assert n["text"] == "Hello"
        assert n["author"] == "admin"
        assert "id" in n and "created_at" in n
        # Verify persisted
        u = requests.get(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers).json()
        assert any(x["id"] == n["id"] for x in u["notes"])
        # Delete
        d = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}/notes/{n['id']}",
                            headers=admin_headers)
        assert d.status_code == 200
        u2 = requests.get(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers).json()
        assert all(x["id"] != n["id"] for x in u2["notes"])


class TestMeSubscription:
    def test_me_subscription_endpoint(self, admin_headers, cleanup_users):
        username, password, r = _make_user(admin_headers, "me", months=4, max_devices=4)
        user_id = r.json()["id"]
        cleanup_users.append(user_id)
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "username": username, "password": password,
            "device_id": "dev-me", "device_model": "M", "device_name": "Me",
        })
        token = login.json()["token"]
        me = requests.get(f"{BASE_URL}/api/me/subscription",
                          headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200, me.text
        b = me.json()
        assert ACCT_RE.match(b["account_number"])
        assert b["subscription"]["status"] == "active"
        assert b["max_devices"] == 4
        assert b["devices_count"] == 1


class TestCaseInsensitiveLogin:
    def test_admin_case_insensitive(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"username": "ADMIN", "password": "Quantum2024"})
        assert r.status_code == 200
        assert r.json()["role"] == "admin"

    def test_user_case_insensitive(self, admin_headers, cleanup_users):
        # use existing 'test'/'12345' if present; otherwise create one
        ex = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"username": "TEST", "password": "12345"})
        if ex.status_code != 200:
            username, password, r = _make_user(admin_headers, "caseins", password="12345")
            cleanup_users.append(r.json()["id"])
            ex = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"username": username.upper(), "password": "12345"})
        assert ex.status_code == 200, ex.text
        assert ex.json()["role"] == "user"
