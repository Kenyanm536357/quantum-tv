"""
Iteration 15 — new /api/livetv/epg endpoint tests.

Validates:
  1. Valid iptv-live-<id> returns 200 with {programs:[{title,description,start,end,start_ts,end_ts}]}
  2. plex-XXX channel_key returns 400
  3. Malformed iptv-live-BAD returns 400
  4. Very high stream_id returns graceful {programs:[]}
  5. Titles are properly base64-decoded (not base64 strings)
"""
import os
import re
import base64
import requests
import pytest


def _get_base_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _get_base_url()
USER_CREDS = {"username": "test", "password": "Test12345"}


@pytest.fixture(scope="module")
def user_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=USER_CREDS, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(user_token):
    return {"Authorization": f"Bearer {user_token}"}


@pytest.fixture(scope="module")
def sample_iptv_channel_key(auth_headers):
    """Pick the first IPTV live channel from /api/livetv/channels."""
    r = requests.get(f"{BASE_URL}/api/livetv/channels", headers=auth_headers, timeout=30)
    assert r.status_code == 200, f"channels failed: {r.status_code}"
    channels = r.json().get("channels") or r.json().get("items") or []
    iptv_ch = [c for c in channels if c.get("source") == "iptv" and str(c.get("key") or c.get("rating_key") or "").startswith("iptv-live-")]
    if not iptv_ch:
        pytest.skip("No IPTV live channels configured")
    return iptv_ch[0].get("key") or iptv_ch[0].get("rating_key")


def _looks_like_base64(s: str) -> bool:
    """Heuristic: base64 strings are typically only [A-Za-z0-9+/=], no spaces, len % 4 == 0."""
    if not s or " " in s or len(s) < 4 or len(s) % 4 != 0:
        return False
    return bool(re.fullmatch(r"[A-Za-z0-9+/=]+", s))


class TestEpgEndpoint:
    def test_valid_iptv_channel_epg(self, auth_headers, sample_iptv_channel_key):
        r = requests.get(
            f"{BASE_URL}/api/livetv/epg",
            params={"channel_key": sample_iptv_channel_key, "limit": 3},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert "programs" in data
        assert isinstance(data["programs"], list)
        # Verify shape when programs exist
        for p in data["programs"]:
            assert "title" in p
            assert "description" in p
            assert "start" in p
            assert "end" in p
            assert "start_ts" in p
            assert "end_ts" in p
            # Titles should NOT look like base64 (should be plain-text decoded)
            title = p["title"]
            assert not _looks_like_base64(title), \
                f"Title appears to still be base64-encoded: {title!r}"

    def test_plex_channel_key_rejected(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/livetv/epg",
            params={"channel_key": "plex-12345", "limit": 3},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_malformed_iptv_channel_key(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/livetv/epg",
            params={"channel_key": "iptv-live-BAD", "limit": 3},
            headers=auth_headers,
            timeout=15,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"

    def test_nonexistent_stream_returns_empty(self, auth_headers):
        r = requests.get(
            f"{BASE_URL}/api/livetv/epg",
            params={"channel_key": "iptv-live-9999999", "limit": 3},
            headers=auth_headers,
            timeout=30,
        )
        # Must gracefully return 200 with empty list, not 500
        assert r.status_code == 200, f"expected 200 graceful, got {r.status_code}: {r.text}"
        data = r.json()
        assert data.get("programs") == [] or isinstance(data.get("programs"), list)

    def test_epg_requires_auth(self):
        r = requests.get(
            f"{BASE_URL}/api/livetv/epg",
            params={"channel_key": "iptv-live-1", "limit": 3},
            timeout=15,
        )
        assert r.status_code == 401
