"""Iteration 8 backend tests:
- POST /api/admin/users response includes account_number + expires_at
- GET /api/me/subscription works with a freshly-created user token
- GET /api/metadata/{show_rk}/children returns seasons; season -> episodes
- _normalize_item exposes index, parent_index, parent_rating_key, grandparent_rating_key, grandparent_thumb, parent_thumb
"""
import os
import re
import time
import pytest
import requests
from datetime import datetime, timezone

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://stream-plex-mobile.preview.emergentagent.com").rstrip("/")
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "Quantum2024"


@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


# ============== POST /api/admin/users — must return account_number + expires_at
class TestCreateUserResponse:
    def test_create_user_returns_account_number_and_expires_at(self, admin_headers):
        username = f"TEST_iter8_{int(time.time())}"
        payload = {
            "username": username,
            "password": "TempPass!23",
            "subscription_months": 2,
            "max_devices": 3,
            "status": "active",
        }
        r = requests.post(f"{BASE_URL}/api/admin/users", json=payload, headers=admin_headers, timeout=15)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        # account_number present and KS-XXX-XXX
        assert "account_number" in data, data
        assert re.match(r"^KS-\d{3}-\d{3}$", data["account_number"]), data["account_number"]
        # expires_at present and roughly 60 days in the future
        assert "expires_at" in data
        # parse ISO
        exp_str = data["expires_at"]
        exp_dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        delta_days = (exp_dt - now).days
        assert 55 <= delta_days <= 65, f"expires_at delta_days={delta_days} (expected ~60)"
        # cleanup
        user_id = data["id"]
        rd = requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers, timeout=15)
        assert rd.status_code in (200, 204)


# ============== GET /api/me/subscription — fresh user can call it
class TestMeSubscription:
    def test_me_subscription_with_fresh_user(self, admin_headers):
        username = f"TEST_iter8_sub_{int(time.time())}"
        password = "TempPass!23"
        # create user
        r = requests.post(
            f"{BASE_URL}/api/admin/users",
            json={
                "username": username,
                "password": password,
                "subscription_months": 1,
                "max_devices": 3,
                "status": "active",
            },
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        user = r.json()
        user_id = user["id"]
        try:
            # login as user
            rl = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"username": username, "password": password},
                timeout=15,
            )
            assert rl.status_code == 200, rl.text
            tok = rl.json()["token"]
            # call me/subscription
            rs = requests.get(
                f"{BASE_URL}/api/me/subscription",
                headers={"Authorization": f"Bearer {tok}"},
                timeout=15,
            )
            assert rs.status_code == 200, rs.text
            d = rs.json()
            assert d.get("account_number"), d
            assert re.match(r"^KS-\d{3}-\d{3}$", d["account_number"])
            sub = d.get("subscription")
            assert isinstance(sub, dict)
            assert "status" in sub
            assert "days_left" in sub
            assert "expires_at" in sub
            assert "max_devices" in d
            assert "devices_count" in d
            assert d["devices_count"] == 0
        finally:
            requests.delete(f"{BASE_URL}/api/admin/users/{user_id}", headers=admin_headers, timeout=15)


# ============== GET /api/metadata/{show_rk}/children — seasons and episodes
class TestShowSeasonsEpisodes:
    @pytest.fixture(scope="class")
    def user_token(self):
        # create a temp user
        ar = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": ADMIN_USERNAME, "password": ADMIN_PASSWORD},
            timeout=15,
        )
        assert ar.status_code == 200
        adm_tok = ar.json()["token"]
        adm_headers = {"Authorization": f"Bearer {adm_tok}", "Content-Type": "application/json"}
        username = f"TEST_iter8_show_{int(time.time())}"
        password = "TempPass!23"
        r = requests.post(
            f"{BASE_URL}/api/admin/users",
            json={"username": username, "password": password, "subscription_months": 1, "max_devices": 3, "status": "active"},
            headers=adm_headers,
            timeout=15,
        )
        assert r.status_code in (200, 201), r.text
        uid = r.json()["id"]
        rl = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"username": username, "password": password},
            timeout=15,
        )
        assert rl.status_code == 200
        yield rl.json()["token"]
        requests.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=adm_headers, timeout=15)

    def _find_show_rk(self, user_token):
        h = {"Authorization": f"Bearer {user_token}"}
        # try recently-added
        r = requests.get(f"{BASE_URL}/api/recently-added?limit=50", headers=h, timeout=20)
        if r.status_code == 200:
            for it in r.json().get("items", []):
                if it.get("type") == "show":
                    return it.get("rating_key")
        # fallback: libraries
        rl = requests.get(f"{BASE_URL}/api/libraries", headers=h, timeout=20)
        if rl.status_code == 200:
            for lib in rl.json().get("libraries", []):
                if lib.get("type") == "show":
                    key = lib.get("key")
                    ri = requests.get(f"{BASE_URL}/api/libraries/{key}/items?limit=20", headers=h, timeout=20)
                    if ri.status_code == 200:
                        for it in ri.json().get("items", []):
                            if it.get("type") == "show":
                                return it.get("rating_key")
        return None

    def test_show_seasons_and_episodes(self, user_token):
        show_rk = self._find_show_rk(user_token)
        if not show_rk:
            pytest.skip("No show found on the Plex server")
        h = {"Authorization": f"Bearer {user_token}"}
        # GET seasons
        rs = requests.get(f"{BASE_URL}/api/metadata/{show_rk}/children", headers=h, timeout=20)
        assert rs.status_code == 200, rs.text
        seasons = rs.json().get("items", [])
        assert len(seasons) > 0, "Expected at least 1 season for the show"
        season = next((s for s in seasons if s.get("type") == "season"), None)
        assert season is not None, f"No season type found in {seasons}"
        assert season.get("type") == "season"
        assert season.get("parent_rating_key") == show_rk or str(season.get("parent_rating_key")) == str(show_rk)
        assert season.get("rating_key")
        assert season.get("title")
        # leaf_count may be None on some seasons, just assert key is present
        assert "leaf_count" in season

        # GET episodes
        season_rk = season["rating_key"]
        re_resp = requests.get(f"{BASE_URL}/api/metadata/{season_rk}/children", headers=h, timeout=20)
        assert re_resp.status_code == 200, re_resp.text
        episodes = re_resp.json().get("items", [])
        assert len(episodes) > 0, "Expected at least 1 episode for the season"
        ep = next((e for e in episodes if e.get("type") == "episode"), None)
        assert ep is not None
        assert ep.get("type") == "episode"
        assert ep.get("index") is not None  # episode #
        assert ep.get("parent_index") is not None  # season #
        assert ep.get("parent_rating_key") is not None
        assert ep.get("grandparent_rating_key") is not None
        assert str(ep.get("grandparent_rating_key")) == str(show_rk)
        assert "duration" in ep
        # thumb / parent_thumb / grandparent_thumb may be present (image proxy URLs)
        # ensure the normalize keys are present (may be None for some)
        for k in ("index", "parent_index", "parent_rating_key", "grandparent_rating_key", "grandparent_thumb", "parent_thumb"):
            assert k in ep, f"Missing key {k} in episode response"


# ============== _normalize_item exposes new fields for movies too (may be None)
class TestNormalizeMovieFields:
    def test_movie_has_new_keys(self, admin_headers):
        # use admin login - admin can also call /me but not user content; switch to creating user
        username = f"TEST_iter8_mov_{int(time.time())}"
        password = "TempPass!23"
        r = requests.post(
            f"{BASE_URL}/api/admin/users",
            json={"username": username, "password": password, "subscription_months": 1, "max_devices": 3, "status": "active"},
            headers=admin_headers,
            timeout=15,
        )
        assert r.status_code in (200, 201)
        uid = r.json()["id"]
        try:
            rl = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={"username": username, "password": password},
                timeout=15,
            )
            tok = rl.json()["token"]
            h = {"Authorization": f"Bearer {tok}"}
            rec = requests.get(f"{BASE_URL}/api/recently-added?limit=20", headers=h, timeout=20)
            assert rec.status_code == 200
            items = rec.json().get("items", [])
            if not items:
                pytest.skip("No items in recently-added")
            sample = items[0]
            for k in (
                "index", "parent_index", "parent_rating_key",
                "grandparent_rating_key", "grandparent_thumb", "parent_thumb",
            ):
                assert k in sample, f"Missing key {k} in normalized item: {list(sample.keys())}"
        finally:
            requests.delete(f"{BASE_URL}/api/admin/users/{uid}", headers=admin_headers, timeout=15)
