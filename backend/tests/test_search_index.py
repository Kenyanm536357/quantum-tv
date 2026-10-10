import asyncio
import base64
import os

os.environ["MONGO_URL"] = "mongodb://localhost:27017"
os.environ["DB_NAME"] = "quantum_tv_test"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["FERNET_KEY"] = base64.urlsafe_b64encode(b"0" * 32).decode()
os.environ["ADMIN_USERNAME"] = "admin"
os.environ["ADMIN_PASSWORD"] = "admin"

import server


def indexed_item(title, media_type="movie", metadata=""):
    return {
        "title": title,
        "type": media_type,
        "_title_search": server._normalize_search_text(title),
        "_search_text": server._normalize_search_text(f"{title} {metadata}"),
    }


def test_normalizes_accents_and_punctuation():
    assert server._normalize_search_text("Amélie: Spider-Man") == "amelie spider man"


def test_matches_multiword_queries_out_of_order_and_partial_words():
    item = indexed_item("Star Wars: A New Hope")
    assert server._score_search_item(item, "wars sta", ["wars", "sta"]) is not None


def test_matches_genre_and_category_metadata():
    item = indexed_item("ESPN 2", media_type="live", metadata="US Sports")
    assert server._score_search_item(item, "espn sports", ["espn", "sports"]) is not None


def test_exact_title_ranks_before_prefix_match():
    exact = indexed_item("The Matrix")
    prefix = indexed_item("The Matrix Reloaded")
    exact_score = server._score_search_item(exact, "the matrix", ["the", "matrix"])
    prefix_score = server._score_search_item(prefix, "the matrix", ["the", "matrix"])
    assert exact_score is not None and prefix_score is not None
    assert exact_score < prefix_score


def test_requires_every_query_term():
    item = indexed_item("The Matrix Reloaded")
    assert server._score_search_item(item, "matrix star", ["matrix", "star"]) is None


def test_search_filters_by_media_type(monkeypatch):
    items = [
        indexed_item("The Matrix", media_type="movie"),
        indexed_item("Matrix", media_type="show"),
        indexed_item("Matrix TV", media_type="live"),
    ]
    monkeypatch.setattr(server, "_SEARCH_INDEX", {"items": items, "updated_at": "now", "source_cache_updated_at": {}})

    result = asyncio.run(server.search("matrix", user={}, media_type="show"))

    assert [item["type"] for item in result["items"]] == ["show"]
    assert "_title_search" not in result["items"][0]


def test_index_rebuild_indexes_sports_and_catalog_metadata(monkeypatch):
    documents = {
        "live": {
            "updated_at": "live-1",
            "cat_by_id": {"1": "USA NFL Sports"},
            "streams": [{"stream_id": 11, "name": "ESPN 2", "category_id": "1"}],
        },
        "vod": {
            "updated_at": "vod-1",
            "cat_by_id": {"2": "Action Movies"},
            "streams": [{"stream_id": 22, "name": "Café Racer", "category_id": "2", "year": 2024}],
        },
        "series": {
            "updated_at": "series-1",
            "cat_by_id": {"3": "Drama"},
            "streams": [{"series_id": 33, "name": "The Example Show", "category_id": "3", "release_date": "2025-01-01"}],
        },
    }

    async def get_cached_document(kind):
        return documents[kind]

    monkeypatch.setattr(server, "_iptv_cache_get_doc", get_cached_document)
    monkeypatch.setattr(server, "_SEARCH_INDEX", {"items": [], "updated_at": None, "source_cache_updated_at": {}})

    asyncio.run(server._rebuild_search_index_once())

    items = server._SEARCH_INDEX["items"]
    sports = next(item for item in items if item["type"] == "live")
    movie = next(item for item in items if item["type"] == "movie")
    show = next(item for item in items if item["type"] == "show")
    assert sports["genre"] == "Sports"
    assert server._score_search_item(sports, "sports", ["sports"]) is not None
    assert server._score_search_item(movie, "2024", ["2024"]) is not None
    assert server._score_search_item(show, "2025", ["2025"]) is not None