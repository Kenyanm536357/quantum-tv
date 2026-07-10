"""
Tests for the new Live TV favorites + recently-watched endpoints (iteration 10).
Endpoints under test:
  GET/POST/DELETE /api/me/live/favorites[/{key}]
  GET/POST/DELETE /api/me/live/recent[/{key}]
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tv-ui-staging-1.preview.emergentagent.com").rstrip("/")
USER_CREDS = {"username": "test", "password": "Test12345"}
ADMIN_CREDS = {"username": "admin", "password": "Quantum2024"}
USER_ID = "f638b065-1fc0-41cb-8400-9a226a97b997"


def _admin_token():
    r = requests.post(f"{BASE_URL}/api/admin/login", json=ADMIN_CREDS, timeout=15)
    r.raise_for_status()
    return r.json()["token"]


def _clear_devices():
    tok = _admin_token()
    h = {"Authorization": f"Bearer {tok}"}
    # list devices
    try:
        rr = requests.get(f"{BASE_URL}/api/admin/users/{USER_ID}", headers=h, timeout=15)
        if rr.status_code == 200:
            for d in (rr.json().get("devices") or []):
                did = d.get("device_id") or d.get("id")
                if did:
                    requests.delete(f"{BASE_URL}/api/admin/users/{USER_ID}/devices/{did}", headers=h, timeout=15)
    except Exception:
        pass


@pytest.fixture(scope="module")
def user_token():
    device_id = f"e2e-test-{uuid.uuid4().hex[:8]}"
    payload = {**USER_CREDS, "device_id": device_id}
    r = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=15)
    if r.status_code in (403, 429):
        _clear_devices()
        r = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, r.json()
    return tok


@pytest.fixture(scope="module")
def h(user_token):
    return {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}


# ---------- auth guard ----------
def test_favorites_requires_auth():
    r = requests.get(f"{BASE_URL}/api/me/live/favorites", timeout=15)
    assert r.status_code == 401, r.status_code


def test_recent_requires_auth():
    r = requests.get(f"{BASE_URL}/api/me/live/recent", timeout=15)
    assert r.status_code == 401, r.status_code

    r = requests.post(f"{BASE_URL}/api/me/live/recent", json={"key": "x"}, timeout=15)
    assert r.status_code == 401, r.status_code


# ---------- favorites ----------
def test_favorites_full_flow(h):
    # start clean: try deleting the keys we'll use
    for k in ["test-fav-A", "test-fav-B"]:
        requests.delete(f"{BASE_URL}/api/me/live/favorites/{k}", headers=h, timeout=15)

    r = requests.get(f"{BASE_URL}/api/me/live/favorites", headers=h, timeout=15)
    assert r.status_code == 200
    initial = r.json()["items"]
    initial_keys = {i["key"] for i in initial}
    assert "test-fav-A" not in initial_keys

    # add one
    body = {"key": "test-fav-A", "title": "Test A", "logo": "http://x/a.png", "number": 100, "source": "iptv"}
    r = requests.post(f"{BASE_URL}/api/me/live/favorites", headers=h, json=body, timeout=15)
    assert r.status_code == 200, r.text

    r = requests.get(f"{BASE_URL}/api/me/live/favorites", headers=h, timeout=15)
    items = r.json()["items"]
    match = [i for i in items if i["key"] == "test-fav-A"]
    assert len(match) == 1
    assert match[0]["title"] == "Test A"
    assert match[0]["source"] == "iptv"
    assert match[0]["number"] == 100

    # upsert: same key, new title -> still 1, title refreshed
    body2 = {**body, "title": "Test A Updated"}
    r = requests.post(f"{BASE_URL}/api/me/live/favorites", headers=h, json=body2, timeout=15)
    assert r.status_code == 200
    items = requests.get(f"{BASE_URL}/api/me/live/favorites", headers=h, timeout=15).json()["items"]
    match = [i for i in items if i["key"] == "test-fav-A"]
    assert len(match) == 1, f"duplicate detected: {match}"
    assert match[0]["title"] == "Test A Updated"

    # delete
    r = requests.delete(f"{BASE_URL}/api/me/live/favorites/test-fav-A", headers=h, timeout=15)
    assert r.status_code == 200
    items = requests.get(f"{BASE_URL}/api/me/live/favorites", headers=h, timeout=15).json()["items"]
    assert not any(i["key"] == "test-fav-A" for i in items)


# ---------- recent ----------
def test_recent_full_flow(h):
    # clear all first
    r = requests.delete(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15)
    assert r.status_code == 200
    r = requests.get(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15)
    assert r.status_code == 200
    assert r.json()["items"] == []

    # add same key twice -> exactly one entry
    body_a = {"key": "test-rec-A", "title": "Rec A", "source": "iptv", "number": 1}
    requests.post(f"{BASE_URL}/api/me/live/recent", headers=h, json=body_a, timeout=15)
    time.sleep(0.1)
    requests.post(f"{BASE_URL}/api/me/live/recent", headers=h, json=body_a, timeout=15)
    items = requests.get(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15).json()["items"]
    a_entries = [i for i in items if i["key"] == "test-rec-A"]
    assert len(a_entries) == 1, f"expected 1 A entry, got {len(a_entries)}: {items}"

    # add B -> B is first
    body_b = {"key": "test-rec-B", "title": "Rec B", "source": "iptv", "number": 2}
    time.sleep(0.1)
    requests.post(f"{BASE_URL}/api/me/live/recent", headers=h, json=body_b, timeout=15)
    items = requests.get(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15).json()["items"]
    assert items[0]["key"] == "test-rec-B"
    assert items[1]["key"] == "test-rec-A"

    # re-post A -> A is first again
    time.sleep(0.1)
    requests.post(f"{BASE_URL}/api/me/live/recent", headers=h, json=body_a, timeout=15)
    items = requests.get(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15).json()["items"]
    assert items[0]["key"] == "test-rec-A"
    assert items[1]["key"] == "test-rec-B"
    # still exactly one A
    assert len([i for i in items if i["key"] == "test-rec-A"]) == 1

    # delete single
    r = requests.delete(f"{BASE_URL}/api/me/live/recent/test-rec-A", headers=h, timeout=15)
    assert r.status_code == 200
    items = requests.get(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15).json()["items"]
    assert not any(i["key"] == "test-rec-A" for i in items)
    assert any(i["key"] == "test-rec-B" for i in items)

    # clear all
    r = requests.delete(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15)
    assert r.status_code == 200
    items = requests.get(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15).json()["items"]
    assert items == []


def test_recent_watched_at_field(h):
    requests.delete(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15)
    requests.post(f"{BASE_URL}/api/me/live/recent", headers=h,
                  json={"key": "test-rec-ts", "title": "TS", "source": "iptv"}, timeout=15)
    items = requests.get(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15).json()["items"]
    assert items and "watched_at" in items[0]
    # cleanup
    requests.delete(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15)
