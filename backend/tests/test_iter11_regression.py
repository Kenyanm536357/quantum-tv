"""
Iteration 11 regression tests. Main agent's change was mobile-only
(/app/mobile/app/(tabs)/_layout.tsx and livetv.tsx). Verify:
  - Concurrent POSTs to /api/me/live/favorites for same key produce 1 entry (atomic upsert).
  - /api/livetv/channels returns channel list.
  - /api/browse/rows returns rows.
"""
import os
import uuid
import concurrent.futures as cf
import requests
import pytest

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
    device_id = f"e2e-iter11-{uuid.uuid4().hex[:8]}"
    payload = {**USER_CREDS, "device_id": device_id}
    r = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=15)
    if r.status_code in (403, 429):
        _clear_devices()
        r = requests.post(f"{BASE_URL}/api/auth/login", json=payload, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json().get("token") or r.json().get("access_token")


@pytest.fixture(scope="module")
def h(user_token):
    return {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}


def test_favorites_concurrent_add_produces_single_entry(h):
    key = f"iter11-conc-{uuid.uuid4().hex[:6]}"
    # clean
    requests.delete(f"{BASE_URL}/api/me/live/favorites/{key}", headers=h, timeout=15)
    body = {"key": key, "title": "Concurrent", "source": "iptv", "number": 1}

    def _post():
        return requests.post(f"{BASE_URL}/api/me/live/favorites", headers=h, json=body, timeout=15).status_code

    with cf.ThreadPoolExecutor(max_workers=3) as ex:
        statuses = list(ex.map(lambda _: _post(), range(3)))
    assert all(s == 200 for s in statuses), statuses

    items = requests.get(f"{BASE_URL}/api/me/live/favorites", headers=h, timeout=15).json()["items"]
    matches = [i for i in items if i["key"] == key]
    assert len(matches) == 1, f"expected exactly 1 entry after 3 concurrent POSTs, got {len(matches)}: {matches}"

    # cleanup
    requests.delete(f"{BASE_URL}/api/me/live/favorites/{key}", headers=h, timeout=15)


def test_livetv_channels_returns_list(h):
    r = requests.get(f"{BASE_URL}/api/livetv/channels", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # Response could be {"items":[...]} or a bare list
    items = (data.get("channels") or data.get("items")) if isinstance(data, dict) else data
    assert isinstance(items, list)
    assert len(items) > 0, "expected at least one channel"


def test_browse_rows_returns_data(h):
    r = requests.get(f"{BASE_URL}/api/browse/rows", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    rows = data.get("rows") if isinstance(data, dict) else data
    assert isinstance(rows, list)
    assert len(rows) > 0, "expected at least one browse row"
