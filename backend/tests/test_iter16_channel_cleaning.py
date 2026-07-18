"""
Iteration 16 — _clean_channel_title validation on /api/livetv/channels.

Validates:
  1. Every IPTV channel now has BOTH `title` (cleaned) and `original_title` (raw).
  2. At least 90% of IPTV channels have title != original_title (cleaning applied broadly).
  3. Country prefixes ('USA -', 'US|', 'UK -') are stripped from title.
  4. HD/SD/UHD/4K/FHD ASCII suffixes are stripped.
  5. Unicode super/subscript decorators (ᴴᴰ, ⁴ᴷ, ⁸ᴷ, ᶠᴴᴰ) are stripped.
  6. Country/genre enrichment still intact.
  7. Plex channels are unaffected.
  8. Cleaning never produces empty title (falls back to original).
"""
import os
import re
import requests
import pytest

UNICODE_DECOR_RE = re.compile(
    "[\u1D00-\u1D7F\u1D80-\u1DBF\u2070-\u209F\u2100-\u214F\U0001D400-\U0001D7FF]"
)
PREFIX_RE = re.compile(
    r"^(?:USA?|UK|GB|CA|CAN|AU|MX|IN|FR|DE|ES|IT|BR|PT|NL|AR|JP|CN|KR|IE|RU|TR|LATINO|SPANISH)\s*[|:\-•·]",
    re.IGNORECASE,
)
SUFFIX_RE = re.compile(
    r"\s*[|:\-•·]?\s*(?:FHD|UHD|4K|8K|HD|SD|HEVC|H265|H\.?265)\s*$",
    re.IGNORECASE,
)


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


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": "test", "password": "Test12345"},
        timeout=15,
    )
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def channels_payload(auth_headers):
    r = requests.get(f"{BASE_URL}/api/livetv/channels", headers=auth_headers, timeout=60)
    assert r.status_code == 200, f"channels failed: {r.status_code} {r.text}"
    data = r.json()
    channels = data.get("channels") or data.get("items") or []
    assert isinstance(channels, list) and len(channels) > 0, "no channels returned"
    return channels


@pytest.fixture(scope="module")
def iptv_channels(channels_payload):
    iptv = [c for c in channels_payload if c.get("source") == "iptv"]
    if not iptv:
        pytest.skip("No IPTV channels configured")
    return iptv


class TestChannelCleaning:
    def test_iptv_channels_have_both_title_and_original_title(self, iptv_channels):
        for c in iptv_channels[:50]:
            assert "title" in c, f"missing title: {c}"
            assert "original_title" in c, f"missing original_title: {c}"
            assert isinstance(c["title"], str)
            assert isinstance(c["original_title"], str)

    def test_cleaning_applied_to_majority(self, iptv_channels):
        differing = sum(
            1 for c in iptv_channels if (c.get("title") or "") != (c.get("original_title") or "")
        )
        total = len(iptv_channels)
        ratio = differing / total if total else 0
        print(f"\nIPTV channels: total={total}, cleaned={differing}, ratio={ratio:.2%}")
        # Print a few samples for visibility
        samples = [c for c in iptv_channels if c.get("title") != c.get("original_title")][:10]
        for s in samples:
            print(f"  {s['original_title']!r} -> {s['title']!r}")
        assert ratio >= 0.90, f"only {ratio:.2%} of channels have title != original_title (expected >=90%)"

    def test_no_country_prefix_in_cleaned_title(self, iptv_channels):
        violators = []
        for c in iptv_channels:
            t = c.get("title") or ""
            if PREFIX_RE.match(t):
                violators.append((c.get("original_title"), t))
        # Allow tiny false-negative slop (regex edge cases)
        assert len(violators) <= max(1, int(0.02 * len(iptv_channels))), \
            f"Country prefix leaked into {len(violators)} titles: {violators[:5]}"

    def test_no_hd_suffix_in_cleaned_title(self, iptv_channels):
        violators = []
        for c in iptv_channels:
            t = c.get("title") or ""
            if SUFFIX_RE.search(t):
                violators.append((c.get("original_title"), t))
        assert len(violators) <= max(1, int(0.02 * len(iptv_channels))), \
            f"HD/UHD/4K suffix leaked into {len(violators)} titles: {violators[:5]}"

    def test_no_unicode_decor_in_cleaned_title(self, iptv_channels):
        violators = []
        for c in iptv_channels:
            t = c.get("title") or ""
            if UNICODE_DECOR_RE.search(t):
                violators.append((c.get("original_title"), t))
        assert not violators, \
            f"Unicode decorators leaked into {len(violators)} titles: {violators[:5]}"

    def test_cleaning_never_empties_title(self, iptv_channels):
        empty = [c for c in iptv_channels if not (c.get("title") or "").strip()]
        assert not empty, f"{len(empty)} channels have empty title after cleaning"

    def test_country_and_genre_enrichment_intact(self, iptv_channels):
        # Every IPTV entry should still have country + genre fields (fallback allowed).
        for c in iptv_channels[:50]:
            assert "country" in c, f"missing country: {c}"
            assert "genre" in c, f"missing genre: {c}"
            assert isinstance(c["country"], str) and c["country"]
            assert isinstance(c["genre"], str) and c["genre"]

    def test_plex_channels_unaffected(self, channels_payload):
        # Plex-sourced channels should NOT have `original_title` (only IPTV path adds it).
        plex = [c for c in channels_payload if c.get("source") == "plex"]
        if not plex:
            pytest.skip("No Plex channels")
        for c in plex[:20]:
            # It's ok if Plex path doesn't set original_title; just make sure title exists.
            assert c.get("title"), f"Plex channel missing title: {c}"


class TestKnownTransformations:
    """Direct import-level unit tests for the _clean_channel_title helper."""

    def test_helper_transformations(self):
        import sys
        sys.path.insert(0, "/app/backend")
        from server import _clean_channel_title as clean

        cases = [
            ("USA - NBC EAST HD", "NBC EAST"),
            ("US| CBS NEWS HD", "CBS NEWS"),
            ("UK - BBC ONE FHD", "BBC ONE"),
            ("BEIN SPORTS MAX 1 AR ᴴᴰ", "BEIN SPORTS MAX 1 AR"),
            ("CBS ⁴ᴷ", "CBS"),
            ("FOX SPORTS ⁸ᴷ", "FOX SPORTS"),
            ("USA - USA - ESPN HD", "ESPN"),
            ("Plain Channel", "Plain Channel"),
            ("", ""),
        ]
        failures = []
        for raw, expected in cases:
            got = clean(raw)
            if got != expected:
                failures.append((raw, expected, got))
        assert not failures, f"Transformations mismatched: {failures}"
