"""
Iteration 12 regression tests.

Backend change: /api/livetv/channels now enriches each IPTV channel with
`country`, `genre`, `category_id`, `category_name` — derived via
_classify_live_category on the Xtream category name. Plex live channels
are unaffected.

Verify:
  1. Every IPTV channel has non-null string `country` and `genre` (never None).
  2. Plex channels don't need those fields (may be missing/None — no assertion).
  3. Response shape: {channels:[{key,title,source,number,logo,...}]}
  4. Classification heuristic (_classify_live_category) unit-tested via the
     live server: at minimum "USA"→country=USA, "UK"→UK, "Canada"→Canada,
     "Sports"→genre=Sports, "News"→News, "Kids"→Kids, unknown→Other/General.
  5. Regression: metadata endpoints for Plex show/season still work.
  6. Regression: /api/browse/rows still works.
"""
import os
import re
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://tv-ui-staging-1.preview.emergentagent.com").rstrip("/")
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
                    requests.delete(f"{BASE_URL}/api/admin/users/{USER_ID}/devices/{did}", headers=h, timeout=15)
    except Exception:
        pass


@pytest.fixture(scope="module")
def user_token():
    device_id = f"e2e-iter12-{uuid.uuid4().hex[:8]}"
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


@pytest.fixture(scope="module")
def channels(h):
    r = requests.get(f"{BASE_URL}/api/livetv/channels", headers=h, timeout=60)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "channels" in data, f"expected 'channels' key, got: {list(data.keys())}"
    return data["channels"]


# ================================================================
# Iteration 12 NEW: country/genre enrichment
# ================================================================
def test_response_shape(channels):
    assert isinstance(channels, list)
    assert len(channels) > 0
    for ch in channels[:5]:
        # every channel must have these base fields
        assert "key" in ch
        assert "title" in ch
        assert "source" in ch
        assert ch["source"] in ("plex", "iptv")


def test_iptv_channels_have_country_and_genre(channels):
    iptv = [c for c in channels if c.get("source") == "iptv"]
    if not iptv:
        pytest.skip("no IPTV channels configured on this environment")
    missing_country, missing_genre, bad = [], [], []
    for c in iptv:
        country = c.get("country")
        genre = c.get("genre")
        if country is None:
            missing_country.append(c.get("key"))
        elif not isinstance(country, str) or not country.strip():
            bad.append(("country", c.get("key"), country))
        if genre is None:
            missing_genre.append(c.get("key"))
        elif not isinstance(genre, str) or not genre.strip():
            bad.append(("genre", c.get("key"), genre))
    assert not missing_country, f"{len(missing_country)} IPTV channels missing country (samples: {missing_country[:5]})"
    assert not missing_genre, f"{len(missing_genre)} IPTV channels missing genre (samples: {missing_genre[:5]})"
    assert not bad, f"non-string / empty values found: {bad[:5]}"


def test_iptv_channels_have_category_id_and_name(channels):
    iptv = [c for c in channels if c.get("source") == "iptv"]
    if not iptv:
        pytest.skip("no IPTV channels configured on this environment")
    # category_id may legitimately be None if the provider returns no category,
    # but the field itself must be present on the dict (backend explicitly sets it).
    for c in iptv[:20]:
        assert "category_id" in c, f"missing category_id key on channel {c.get('key')}"
        assert "category_name" in c, f"missing category_name key on channel {c.get('key')}"


def test_iptv_country_and_genre_are_from_known_vocabulary(channels):
    """
    The classifier only ever emits values from a fixed vocabulary
    (COUNTRY / GENRE patterns → labels, else 'Other' / 'General').
    """
    known_countries = {
        "USA", "UK", "Canada", "Australia", "Mexico", "India",
        "France", "Germany", "Spanish", "Italy", "Brazil",
        "Portugal", "Netherlands", "Arabic", "Japan", "China",
        "Korea", "Ireland", "Russia", "Turkey", "Other",
    }
    known_genres = {
        "Sports", "News", "Kids", "Movies", "Music", "Documentary",
        "Religion", "24/7", "PPV / Events", "Adult", "Entertainment",
        "General",
    }
    iptv = [c for c in channels if c.get("source") == "iptv"]
    if not iptv:
        pytest.skip("no IPTV channels configured")
    unknown_c = {c.get("country") for c in iptv} - known_countries
    unknown_g = {c.get("genre") for c in iptv} - known_genres
    assert not unknown_c, f"unexpected country labels: {unknown_c}"
    assert not unknown_g, f"unexpected genre labels: {unknown_g}"


def test_classification_matches_category_name(channels):
    """
    For channels whose category_name embeds a well-known token, verify the
    classifier picked the corresponding label.

    We do this in aggregate rather than picking specific channels because
    the provider catalog can change.
    """
    iptv = [c for c in channels if c.get("source") == "iptv"]
    if not iptv:
        pytest.skip("no IPTV channels configured")

    # Group by category_name (skip None)
    by_cat: dict[str, dict] = {}
    for c in iptv:
        name = c.get("category_name")
        if not name:
            continue
        if name not in by_cat:
            by_cat[name] = {"country": c.get("country"), "genre": c.get("genre")}

    # Country checks
    country_tokens = [
        (re.compile(r"\b(US|USA|UNITED\s*STATES|U\.S\.)\b", re.I), "USA"),
        (re.compile(r"\b(UK|UNITED\s*KINGDOM|GB|GREAT\s*BRITAIN|BRITAIN|BRIT)\b", re.I), "UK"),
        (re.compile(r"\b(CA|CAN|CANADA)\b", re.I), "Canada"),
    ]
    genre_tokens = [
        (re.compile(r"\b(SPORT(?:S)?|ESPN|NFL|NBA|MLB|NHL|SOCCER|FOOTBALL|UFC|BOXING|WWE)\b", re.I), "Sports"),
        (re.compile(r"\b(NEWS|CNN|FOX(?:\s*NEWS)?|MSNBC|CNBC|BBC)\b", re.I), "News"),
        (re.compile(r"\b(KIDS|CHILDREN|CARTOON|DISNEY|NICK(?:ELODEON)?)\b", re.I), "Kids"),
    ]

    mismatches: list[str] = []
    checked = 0
    for name, vals in by_cat.items():
        for pat, expected in country_tokens:
            if pat.search(name):
                checked += 1
                if vals["country"] != expected:
                    mismatches.append(f"country: {name!r} → expected {expected}, got {vals['country']}")
                break
        for pat, expected in genre_tokens:
            if pat.search(name):
                checked += 1
                if vals["genre"] != expected:
                    mismatches.append(f"genre: {name!r} → expected {expected}, got {vals['genre']}")
                break

    # We need to have actually exercised at least a few classifications.
    if checked == 0:
        pytest.skip("no recognizable category names in this catalog")
    assert not mismatches, f"{len(mismatches)} classification mismatches (first 10): {mismatches[:10]}"


def test_at_least_one_usa_category_present(channels):
    """
    Sanity: the provider almost always has *some* USA category. If not — soft skip.
    """
    iptv = [c for c in channels if c.get("source") == "iptv"]
    if not iptv:
        pytest.skip("no IPTV channels")
    usa = [c for c in iptv if c.get("country") == "USA"]
    if not usa:
        pytest.skip("no USA-classified channels in catalog")
    # confirm at least one channel with country USA has a plausible category name
    assert any(c.get("category_name") for c in usa), "USA channels should have category_name"


# ================================================================
# Regression: metadata + browse (untouched code paths)
# ================================================================
def test_browse_rows_still_works(h):
    r = requests.get(f"{BASE_URL}/api/browse/rows", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    rows = data.get("rows") if isinstance(data, dict) else data
    assert isinstance(rows, list)
    assert len(rows) > 0


def _first_container_rating_key(h) -> str | None:
    """Find a Plex container (show/season/artist/album) rating_key from /api/browse/rows."""
    r = requests.get(f"{BASE_URL}/api/browse/rows", headers=h, timeout=30)
    if r.status_code != 200:
        return None
    for row in (r.json().get("rows") or []):
        for it in (row.get("items") or []):
            t = (it.get("type") or "").lower()
            if t in ("show", "season", "artist", "album"):
                k = it.get("rating_key") or it.get("ratingKey") or it.get("key")
                if k:
                    return str(k)
    return None


def _first_non_iptv_rating_key(h) -> str | None:
    r = requests.get(f"{BASE_URL}/api/browse/rows", headers=h, timeout=30)
    if r.status_code != 200:
        return None
    for row in (r.json().get("rows") or []):
        for it in (row.get("items") or []):
            k = it.get("rating_key") or it.get("ratingKey") or it.get("key")
            if k and not str(k).startswith("iptv-"):
                return str(k)
    return None


def test_metadata_endpoint_regression(h):
    rk = _first_non_iptv_rating_key(h)
    if not rk:
        pytest.skip("no Plex items available to test metadata")
    r = requests.get(f"{BASE_URL}/api/metadata/{rk}", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, dict)
    assert any(k in data for k in ("title", "rating_key", "ratingKey", "key", "item"))


def test_metadata_children_endpoint_regression(h):
    rk = _first_container_rating_key(h)
    if not rk:
        pytest.skip("no Plex show/season container available in browse/rows")
    r = requests.get(f"{BASE_URL}/api/metadata/{rk}/children", headers=h, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, dict)
    assert "items" in data
    assert isinstance(data["items"], list)


# ================================================================
# Regression from iter11: /api/livetv/channels basic shape
# ================================================================
def test_livetv_channels_endpoint_still_works(channels):
    assert isinstance(channels, list)
    assert len(channels) > 0
