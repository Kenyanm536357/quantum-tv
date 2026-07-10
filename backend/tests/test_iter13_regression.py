"""
Iteration 13 regression tests.

Two backend hardening fixes since iter12:
  1. /api/metadata/{rk}/children now returns 200 {items:[]} on Plex 400/404
     (previously bubbled 500 for movies/episodes).
  2. /api/stream/{rk}?direct=true on a show/season/artist/album rating_key
     now returns HTTPException(400) with a "pick an episode" style message
     (previously fell through to a broken HLS URL).

Also re-verifies iter10/11/12 flows are still healthy.
"""
import os
import uuid
import requests
import pytest

def _get_base_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL"):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _get_base_url()
USER_CREDS = {"username": "test", "password": "Test12345"}
ADMIN_CREDS = {"username": "admin", "password": "Quantum2024"}
USER_ID = "f638b065-1fc0-41cb-8400-9a226a97b997"


# ---------- auth helpers ----------
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
                    requests.delete(
                        f"{BASE_URL}/api/admin/users/{USER_ID}/devices/{did}",
                        headers=h, timeout=15,
                    )
    except Exception:
        pass


@pytest.fixture(scope="module")
def user_token():
    device_id = f"e2e-iter13-{uuid.uuid4().hex[:8]}"
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


# ---------- library picker helpers ----------
@pytest.fixture(scope="module")
def libraries(h):
    r = requests.get(f"{BASE_URL}/api/libraries", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # try both common shapes
    libs = data.get("libraries") or data.get("items") or data
    assert isinstance(libs, list) and libs, f"no libraries: {data}"
    return libs


def _pick_lib(libraries, type_):
    for l in libraries:
        t = (l.get("type") or l.get("Type") or "").lower()
        if t == type_:
            return l
    return None


def _lib_key(lib):
    return lib.get("key") or lib.get("id") or lib.get("Key")


def _first_item_rk(h, lib_key):
    r = requests.get(
        f"{BASE_URL}/api/libraries/{lib_key}/items",
        headers=h, params={"limit": 1}, timeout=30,
    )
    assert r.status_code == 200, r.text
    items = r.json().get("items") or []
    assert items, f"no items in library {lib_key}"
    return str(items[0].get("rating_key") or items[0].get("ratingKey") or items[0].get("id")), items[0]


# ================================================================
# FIX 1: /api/metadata/{rk}/children on a movie no longer 500s
# ================================================================
def test_children_on_movie_returns_empty_not_500(h, libraries):
    movie_lib = _pick_lib(libraries, "movie")
    if not movie_lib:
        pytest.skip("no movie library available in this Plex instance")
    rk, item = _first_item_rk(h, _lib_key(movie_lib))
    r = requests.get(f"{BASE_URL}/api/metadata/{rk}/children", headers=h, timeout=30)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert "items" in body
    assert isinstance(body["items"], list)
    # movies have no children — should be []
    assert body["items"] == [], f"expected empty list for movie children, got {body}"


# ================================================================
# REGRESSION: /children on a show still returns actual children
# ================================================================
def test_children_on_show_still_works(h, libraries):
    show_lib = _pick_lib(libraries, "show")
    if not show_lib:
        pytest.skip("no show library available in this Plex instance")
    rk, item = _first_item_rk(h, _lib_key(show_lib))
    r = requests.get(f"{BASE_URL}/api/metadata/{rk}/children", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body.get("items"), list)
    # a show should have >=1 season
    assert len(body["items"]) >= 1, f"show {rk} returned zero children: {body}"


# ================================================================
# FIX 2: /api/stream on a show rating_key returns 400 with helpful msg
# ================================================================
def test_stream_on_show_returns_400_pick_episode(h, libraries):
    show_lib = _pick_lib(libraries, "show")
    if not show_lib:
        pytest.skip("no show library available")
    rk, _ = _first_item_rk(h, _lib_key(show_lib))
    r = requests.get(
        f"{BASE_URL}/api/stream/{rk}",
        headers=h, params={"direct": "true"}, timeout=30,
    )
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
    detail = (r.json().get("detail") or "").lower()
    assert ("episode" in detail) or ("show" in detail) or ("season" in detail), \
        f"detail did not mention episode/show/season: {detail}"


# ================================================================
# REGRESSION: /api/stream on a movie still returns a playable url
# ================================================================
def test_stream_on_movie_still_returns_url(h, libraries):
    movie_lib = _pick_lib(libraries, "movie")
    if not movie_lib:
        pytest.skip("no movie library available")
    rk, _ = _first_item_rk(h, _lib_key(movie_lib))
    r = requests.get(
        f"{BASE_URL}/api/stream/{rk}",
        headers=h, params={"direct": "true"}, timeout=30,
    )
    assert r.status_code == 200, f"expected 200 for movie stream, got {r.status_code}: {r.text}"
    body = r.json()
    assert body.get("url"), f"no url returned: {body}"
    assert body.get("type") in ("direct", "hls"), f"unexpected type: {body}"


# ================================================================
# REGRESSION: /api/stream on an IPTV live channel still returns hls
# ================================================================
def test_stream_iptv_live_channel(h):
    r = requests.get(f"{BASE_URL}/api/livetv/channels", headers=h, timeout=60)
    assert r.status_code == 200, r.text
    channels = r.json().get("channels") or []
    iptv = [c for c in channels if c.get("source") == "iptv"]
    if not iptv:
        pytest.skip("no IPTV channels configured")
    key = iptv[0]["key"]
    assert key.startswith("iptv-live-"), f"unexpected iptv key: {key}"
    rr = requests.get(f"{BASE_URL}/api/stream/{key}", headers=h, timeout=30)
    assert rr.status_code == 200, f"iptv stream failed: {rr.status_code} {rr.text}"
    body = rr.json()
    assert body.get("url"), f"no url in iptv stream response: {body}"
    assert body.get("type") == "hls", f"expected type=hls, got: {body}"


# ================================================================
# REGRESSION: /api/livetv/channels IPTV enrichment fields still present
# ================================================================
def test_livetv_iptv_enrichment_still_present(h):
    r = requests.get(f"{BASE_URL}/api/livetv/channels", headers=h, timeout=60)
    assert r.status_code == 200, r.text
    channels = r.json().get("channels") or []
    iptv = [c for c in channels if c.get("source") == "iptv"]
    if not iptv:
        pytest.skip("no IPTV channels")
    sample = iptv[0]
    for field in ("country", "genre", "category_id", "category_name"):
        assert field in sample, f"missing enrichment field {field} in {sample}"
        assert sample[field] is not None, f"{field} is None"


# ================================================================
# REGRESSION: favorites/recent CRUD still works
# ================================================================
def test_live_favorites_crud(h):
    # clean slate
    fav_key = f"iptv-live-test-{uuid.uuid4().hex[:6]}"
    # add
    r = requests.post(
        f"{BASE_URL}/api/me/live/favorites",
        headers=h, json={"key": fav_key}, timeout=15,
    )
    assert r.status_code in (200, 201), f"add fav failed: {r.status_code} {r.text}"
    # list
    r = requests.get(f"{BASE_URL}/api/me/live/favorites", headers=h, timeout=15)
    assert r.status_code == 200
    body = r.json()
    keys = [f.get("key") if isinstance(f, dict) else f for f in (body.get("favorites") or body.get("items") or body)]
    assert fav_key in keys, f"favorite not stored: {body}"
    # delete
    r = requests.delete(
        f"{BASE_URL}/api/me/live/favorites/{fav_key}",
        headers=h, timeout=15,
    )
    assert r.status_code in (200, 204)


def test_live_recent_endpoint(h):
    # POST a recent
    key = f"iptv-live-test-{uuid.uuid4().hex[:6]}"
    r = requests.post(
        f"{BASE_URL}/api/me/live/recent",
        headers=h, json={"key": key, "title": "Test Chan"}, timeout=15,
    )
    assert r.status_code in (200, 201), f"add recent failed: {r.status_code} {r.text}"
    # GET
    r = requests.get(f"{BASE_URL}/api/me/live/recent", headers=h, timeout=15)
    assert r.status_code == 200
