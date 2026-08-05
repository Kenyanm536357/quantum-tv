"""Unit coverage for trusted public IPTV-Org M3U ingestion."""
import os

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "quantum_tv_test")
os.environ.setdefault("JWT_SECRET", "test-secret")
os.environ.setdefault("FERNET_KEY", "dGVzdC1mZXJuZXQta2V5LTEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI=")
os.environ.setdefault("ADMIN_USERNAME", "admin")
os.environ.setdefault("ADMIN_PASSWORD", "admin")

from server import _parse_public_m3u


def test_parse_public_m3u_preserves_metadata_and_headers():
	channels = _parse_public_m3u(
		"""#EXTM3U
#EXTINF:-1 tvg-logo="https://images.example/logo.png" group-title="News",Example News
#EXTVLCOPT:http-user-agent=ExampleTV/1.0
https://stream.example/live.m3u8
"""
	)

	assert len(channels) == 1
	channel = channels[0]
	assert channel["title"] == "Example News"
	assert channel["logo"] == "https://images.example/logo.png"
	assert channel["category_name"] == "News"
	assert channel["url"] == "https://stream.example/live.m3u8"
	assert channel["headers"] == {"User-Agent": "ExampleTV/1.0"}
	assert len(channel["id"]) == 20


def test_parse_public_m3u_ignores_non_http_entries():
	channels = _parse_public_m3u(
		"""#EXTM3U
#EXTINF:-1,Unsupported
udp://239.1.1.1:1234
#EXTINF:-1,Working
https://stream.example/working.m3u8
"""
	)

	assert [channel["title"] for channel in channels] == ["Working"]


def test_parse_public_m3u_uses_url_for_stable_identity():
	first = _parse_public_m3u("#EXTM3U\n#EXTINF:-1,First Name\nhttps://stream.example/live.m3u8\n")[0]
	renamed = _parse_public_m3u("#EXTM3U\n#EXTINF:-1,Renamed\nhttps://stream.example/live.m3u8\n")[0]

	assert first["id"] == renamed["id"]
