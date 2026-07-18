"""
Iteration 17 — expanded _clean_channel_title regex coverage + divider filter.

Validates iteration_17 changes on top of iter_16:
  1. Cleaning coverage on live /api/livetv/channels is now >= 80% (was 59%).
  2. No section-divider entries ('##### ... #####') leak through.
  3. Bracketed prefixes '[US] Fox Sports 1' -> 'Fox Sports 1'.
  4. Generic uppercase fallback 'MNG - Ariana TV' -> 'Ariana TV'.
  5. Chained quality suffixes 'CBS HD FHD' -> 'CBS'.
  6. All previous helper transformations still work (regression).
"""
import os
import re
import sys
import requests
import pytest

sys.path.insert(0, "/app/backend")

DIVIDER_RE = re.compile(r"^\s*[#=\*·•\-—_]{3,}.*[#=\*·•\-—_]{3,}\s*$")


def _base_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _base_url()


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "test", "password": "Test12345", "device_id": "iter17-test"},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def channels_payload(auth_headers):
    r = requests.get(f"{BASE_URL}/api/livetv/channels", headers=auth_headers, timeout=90)
    assert r.status_code == 200, f"channels failed: {r.status_code} {r.text}"
    data = r.json()
    channels = data.get("channels") or data.get("items") or []
    assert isinstance(channels, list) and len(channels) > 0
    return channels


@pytest.fixture(scope="module")
def iptv_channels(channels_payload):
    iptv = [c for c in channels_payload if c.get("source") == "iptv"]
    if not iptv:
        pytest.skip("No IPTV channels configured")
    return iptv


class TestIter17Coverage:
    def test_cleaning_coverage_at_least_80pct(self, iptv_channels):
        differing = sum(
            1 for c in iptv_channels if (c.get("title") or "") != (c.get("original_title") or "")
        )
        total = len(iptv_channels)
        ratio = differing / total if total else 0
        print(f"\nIter17 coverage: total={total}, cleaned={differing}, ratio={ratio:.2%}")
        assert ratio >= 0.80, f"Only {ratio:.2%} cleaned; expected >=80%"

    def test_no_divider_entries_in_channels(self, iptv_channels):
        leaks = [
            c for c in iptv_channels
            if DIVIDER_RE.match(c.get("original_title") or "")
        ]
        assert not leaks, f"{len(leaks)} divider entries leaked: {[c.get('original_title') for c in leaks[:5]]}"


class TestIter17HelperCases:
    def test_bracketed_prefix(self):
        from server import _clean_channel_title as clean
        assert clean("[US] Fox Sports 1") == "Fox Sports 1"
        assert clean("(UK) BBC One") == "BBC One"
        assert clean("{USA} ESPN") == "ESPN"

    def test_generic_uppercase_fallback(self):
        from server import _clean_channel_title as clean
        assert clean("MNG - Ariana TV") == "Ariana TV"
        assert clean("CHL | Some Channel") == "Some Channel"
        assert clean("VZ - Venevision") == "Venevision"

    def test_chained_suffix_strip(self):
        from server import _clean_channel_title as clean
        assert clean("CBS HD FHD") == "CBS"
        assert clean("Fox HD UHD") == "Fox"

    def test_divider_helper(self):
        from server import _is_divider_channel as div
        assert div("##### USA GENERAL #####")
        assert div("===== SPORTS =====")
        assert div("----- NEWS -----")
        assert not div("USA - CBS HD")
        assert not div("BBC One")

    def test_regression_iter16_cases(self):
        from server import _clean_channel_title as clean
        assert clean("USA - NBC EAST HD") == "NBC EAST"
        assert clean("US| CBS NEWS HD") == "CBS NEWS"
        assert clean("UK - BBC ONE FHD") == "BBC ONE"
        assert clean("BEIN SPORTS MAX 1 AR ᴴᴰ") == "BEIN SPORTS MAX 1 AR"
        assert clean("CBS ⁴ᴷ") == "CBS"
        assert clean("USA - USA - ESPN HD") == "ESPN"
        assert clean("Plain Channel") == "Plain Channel"
        assert clean("") == ""

    def test_never_empty(self):
        from server import _clean_channel_title as clean
        # Even if a name is ONLY a prefix, we should fall back to raw rather than empty.
        result = clean("USA -")
        assert result, f"cleaner produced empty string for 'USA -': {result!r}"
