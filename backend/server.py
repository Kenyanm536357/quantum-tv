"""Quantum TV — FastAPI backend.

Plex authentication (PIN flow), library/movies/shows/live TV listing,
streaming URL generation, image proxy, and admin panel APIs.
"""
from __future__ import annotations

import os
import uuid
import base64
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Optional, Any
from urllib.parse import urlencode

import httpx
import xmltodict
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, RedirectResponse, Response
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from cryptography.fernet import Fernet
from jose import jwt, JWTError
from passlib.context import CryptContext
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------
load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s :: %(message)s")
log = logging.getLogger("quantum_tv")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
FERNET_KEY = os.environ["FERNET_KEY"].encode()
PLEX_PRODUCT = os.environ["PLEX_PRODUCT"]
PLEX_VERSION = os.environ["PLEX_VERSION"]
PLEX_PLATFORM = os.environ["PLEX_PLATFORM"]
PLEX_CLIENT_IDENTIFIER = os.environ["PLEX_CLIENT_IDENTIFIER"]
ADMIN_USERNAME = os.environ["ADMIN_USERNAME"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

fernet = Fernet(FERNET_KEY)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

mongo = AsyncIOMotorClient(MONGO_URL)
db = mongo[DB_NAME]


def plex_headers(token: Optional[str] = None, client_id: Optional[str] = None) -> dict:
    h = {
        "X-Plex-Product": PLEX_PRODUCT,
        "X-Plex-Version": PLEX_VERSION,
        "X-Plex-Client-Identifier": client_id or PLEX_CLIENT_IDENTIFIER,
        "X-Plex-Platform": PLEX_PLATFORM,
        "X-Plex-Device": PLEX_PRODUCT,
        "X-Plex-Device-Name": PLEX_PRODUCT,
        "Accept": "application/json",
    }
    if token:
        h["X-Plex-Token"] = token
    return h


def encrypt_token(token: str) -> str:
    return fernet.encrypt(token.encode()).decode()


def decrypt_token(enc: str) -> str:
    return fernet.decrypt(enc.encode()).decode()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Auth helpers (JWT for our app users + admin)
# ---------------------------------------------------------------------------

def create_jwt(payload: dict, expires_hours: int = 24 * 30) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    return jwt.encode(data, JWT_SECRET, algorithm="HS256")


def decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    payload = decode_jwt(authorization.split(None, 1)[1])
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_current_admin(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    payload = decode_jwt(authorization.split(None, 1)[1])
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin required")
    return payload


# ---------------------------------------------------------------------------
# Plex HTTP helpers
# ---------------------------------------------------------------------------

PLEX_AUTH_BASE = "https://plex.tv/api/v2"


async def plex_get(url: str, token: Optional[str] = None, params: Optional[dict] = None) -> Any:
    async with httpx.AsyncClient(timeout=20.0, verify=False, follow_redirects=True) as c:
        r = await c.get(url, headers=plex_headers(token), params=params)
        r.raise_for_status()
        ct = r.headers.get("content-type", "")
        if "json" in ct:
            return r.json()
        return xmltodict.parse(r.text)


async def plex_post(url: str, token: Optional[str] = None, params: Optional[dict] = None) -> Any:
    async with httpx.AsyncClient(timeout=20.0, verify=False, follow_redirects=True) as c:
        r = await c.post(url, headers=plex_headers(token), params=params)
        r.raise_for_status()
        return r.json()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Quantum TV API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


# ============================================================
# Health
# ============================================================
@api.get("/")
async def root():
    return {"service": "quantum-tv", "status": "ok", "time": now_iso()}


# ============================================================
# Plex PIN OAuth Flow
# ============================================================
class PinResponse(BaseModel):
    pin_id: int
    code: str
    auth_url: str
    client_identifier: str


@api.post("/plex/pin", response_model=PinResponse)
async def create_plex_pin():
    """Create a Plex auth pin. The mobile client opens auth_url in a browser,
    user signs in, then we poll /plex/pin/{id} for the authToken."""
    client_id = str(uuid.uuid4())
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(
            f"{PLEX_AUTH_BASE}/pins?strong=true",
            headers={**plex_headers(client_id=client_id), "Content-Type": "application/json"},
        )
        r.raise_for_status()
        data = r.json()
    pin_id = data["id"]
    code = data["code"]
    params = {
        "clientID": client_id,
        "code": code,
        "context[device][product]": PLEX_PRODUCT,
        "context[device][version]": PLEX_VERSION,
        "context[device][platform]": PLEX_PLATFORM,
    }
    auth_url = f"https://app.plex.tv/auth#?{urlencode(params)}"
    await db.plex_pins.insert_one({
        "pin_id": pin_id,
        "code": code,
        "client_identifier": client_id,
        "created_at": now_iso(),
    })
    return PinResponse(pin_id=pin_id, code=code, auth_url=auth_url, client_identifier=client_id)


class PinCheckResponse(BaseModel):
    linked: bool
    token: Optional[str] = None  # our JWT (only after linking + user created)
    plex_username: Optional[str] = None
    plex_email: Optional[str] = None
    avatar: Optional[str] = None


@api.get("/plex/pin/{pin_id}", response_model=PinCheckResponse)
async def check_plex_pin(pin_id: int):
    pin_doc = await db.plex_pins.find_one({"pin_id": pin_id})
    if not pin_doc:
        raise HTTPException(404, "Pin not found")
    client_id = pin_doc["client_identifier"]
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(
            f"{PLEX_AUTH_BASE}/pins/{pin_id}",
            headers=plex_headers(client_id=client_id),
        )
        r.raise_for_status()
        data = r.json()
    auth_token = data.get("authToken")
    if not auth_token:
        return PinCheckResponse(linked=False)
    # Fetch user profile
    user_info = await plex_get(f"{PLEX_AUTH_BASE}/user", token=auth_token)
    plex_user_id = str(user_info.get("id"))
    username = user_info.get("username") or user_info.get("title")
    email = user_info.get("email")
    thumb = user_info.get("thumb")

    existing = await db.users.find_one({"plex_user_id": plex_user_id})
    if existing:
        await db.users.update_one(
            {"id": existing["id"]},
            {"$set": {
                "plex_token_enc": encrypt_token(auth_token),
                "plex_client_identifier": client_id,
                "username": username,
                "email": email,
                "avatar": thumb,
                "updated_at": now_iso(),
                "last_login": now_iso(),
            }},
        )
        user_id = existing["id"]
    else:
        user_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": user_id,
            "plex_user_id": plex_user_id,
            "plex_token_enc": encrypt_token(auth_token),
            "plex_client_identifier": client_id,
            "username": username,
            "email": email,
            "avatar": thumb,
            "status": "active",
            "created_at": now_iso(),
            "updated_at": now_iso(),
            "last_login": now_iso(),
        })
    our_jwt = create_jwt({"sub": user_id, "role": "user", "plex_user_id": plex_user_id})
    # delete pin
    await db.plex_pins.delete_one({"pin_id": pin_id})
    return PinCheckResponse(linked=True, token=our_jwt, plex_username=username,
                            plex_email=email, avatar=thumb)


# ============================================================
# User endpoints
# ============================================================
@api.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "username": user.get("username"),
        "email": user.get("email"),
        "avatar": user.get("avatar"),
        "plex_user_id": user.get("plex_user_id"),
    }


# ---- Plex Resources (servers) ----
async def _resources(user: dict) -> list[dict]:
    token = decrypt_token(user["plex_token_enc"])
    client_id = user.get("plex_client_identifier", PLEX_CLIENT_IDENTIFIER)
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(
            f"{PLEX_AUTH_BASE}/resources",
            headers=plex_headers(token=token, client_id=client_id),
            params={"includeHttps": 1, "includeRelay": 1},
        )
        r.raise_for_status()
        return r.json()


def _pick_best_connection(resource: dict) -> Optional[str]:
    conns = resource.get("connections") or []
    # Prefer local non-relay https
    locals_ = [c for c in conns if c.get("local") and not c.get("relay")]
    remotes = [c for c in conns if not c.get("local") and not c.get("relay")]
    relays = [c for c in conns if c.get("relay")]
    for group in (locals_, remotes, relays):
        for c in group:
            uri = c.get("uri")
            if uri:
                return uri
    return None


@api.get("/servers")
async def list_servers(user: dict = Depends(get_current_user)):
    resources = await _resources(user)
    servers = []
    for r in resources:
        if "server" not in (r.get("provides") or ""):
            continue
        servers.append({
            "name": r.get("name"),
            "client_identifier": r.get("clientIdentifier"),
            "product": r.get("product"),
            "version": r.get("productVersion"),
            "platform": r.get("platform"),
            "owned": r.get("owned"),
            "home": r.get("home"),
            "uri": _pick_best_connection(r),
            "access_token": r.get("accessToken"),
            "public_address": r.get("publicAddress"),
        })
    return {"servers": servers}


# Server selection (per-user)
class SelectServerBody(BaseModel):
    client_identifier: str


@api.post("/servers/select")
async def select_server(body: SelectServerBody, user: dict = Depends(get_current_user)):
    servers = (await list_servers(user))["servers"]
    chosen = next((s for s in servers if s["client_identifier"] == body.client_identifier), None)
    if not chosen:
        raise HTTPException(404, "Server not found")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "selected_server": {
                "client_identifier": chosen["client_identifier"],
                "uri": chosen["uri"],
                "name": chosen["name"],
                "access_token_enc": encrypt_token(chosen["access_token"]) if chosen.get("access_token") else None,
            }
        }},
    )
    return {"ok": True, "server": chosen}


async def _server_ctx(user: dict) -> tuple[str, str]:
    sel = user.get("selected_server")
    if not sel:
        # Auto-pick first owned server
        servers = (await list_servers(user))["servers"]
        if not servers:
            raise HTTPException(404, "No Plex servers found on this account")
        chosen = next((s for s in servers if s.get("owned")), servers[0])
        await db.users.update_one(
            {"id": user["id"]},
            {"$set": {"selected_server": {
                "client_identifier": chosen["client_identifier"],
                "uri": chosen["uri"],
                "name": chosen["name"],
                "access_token_enc": encrypt_token(chosen["access_token"]) if chosen.get("access_token") else None,
            }}},
        )
        sel = {
            "uri": chosen["uri"],
            "access_token_enc": encrypt_token(chosen["access_token"]) if chosen.get("access_token") else None,
        }
    token = decrypt_token(sel["access_token_enc"]) if sel.get("access_token_enc") else decrypt_token(user["plex_token_enc"])
    return sel["uri"], token


# ---- Libraries ----
@api.get("/libraries")
async def list_libraries(user: dict = Depends(get_current_user)):
    uri, token = await _server_ctx(user)
    data = await plex_get(f"{uri}/library/sections", token=token)
    dirs = data.get("MediaContainer", {}).get("Directory", []) or []
    return {"libraries": [
        {
            "key": d.get("key"),
            "title": d.get("title"),
            "type": d.get("type"),  # movie, show, photo, music
            "agent": d.get("agent"),
            "scanner": d.get("scanner"),
            "uuid": d.get("uuid"),
        }
        for d in dirs
    ]}


@api.get("/libraries/{key}/items")
async def library_items(
    key: str,
    user: dict = Depends(get_current_user),
    offset: int = 0,
    limit: int = 50,
    sort: str = "addedAt:desc",
):
    uri, token = await _server_ctx(user)
    data = await plex_get(
        f"{uri}/library/sections/{key}/all",
        token=token,
        params={
            "X-Plex-Container-Start": offset,
            "X-Plex-Container-Size": limit,
            "sort": sort,
        },
    )
    mc = data.get("MediaContainer", {})
    items = mc.get("Metadata", []) or []
    return {"total": mc.get("totalSize", len(items)), "items": [_normalize_item(uri, token, i) for i in items]}


def _normalize_item(uri: str, token: str, m: dict) -> dict:
    rk = m.get("ratingKey")
    return {
        "rating_key": rk,
        "title": m.get("title"),
        "type": m.get("type"),
        "summary": m.get("summary"),
        "year": m.get("year"),
        "duration": m.get("duration"),
        "rating": m.get("rating"),
        "audience_rating": m.get("audienceRating"),
        "studio": m.get("studio"),
        "added_at": m.get("addedAt"),
        "thumb": _proxy_image(uri, token, m.get("thumb")) if m.get("thumb") else None,
        "art": _proxy_image(uri, token, m.get("art")) if m.get("art") else None,
        "grandparent_title": m.get("grandparentTitle"),
        "parent_title": m.get("parentTitle"),
        "leaf_count": m.get("leafCount"),
        "viewed_leaf_count": m.get("viewedLeafCount"),
        "view_offset": m.get("viewOffset"),
    }


def _proxy_image(uri: str, token: str, path: str) -> str:
    """Return our proxied image URL so the client never needs Plex token."""
    # We'll create /api/image proxy that takes encrypted server+path
    payload = base64.urlsafe_b64encode(f"{uri}|{path}|{token}".encode()).decode()
    return f"/api/image?p={payload}"


@api.get("/image")
async def image_proxy(p: str, w: int = 400, h: int = 600):
    try:
        decoded = base64.urlsafe_b64decode(p.encode()).decode()
        srv, path, tok = decoded.split("|", 2)
    except Exception:
        raise HTTPException(400, "Bad image token")
    target = f"{srv}/photo/:/transcode"
    params = {"width": w, "height": h, "url": path, "X-Plex-Token": tok, "minSize": 1, "upscale": 1}
    async with httpx.AsyncClient(timeout=20.0, verify=False) as c:
        r = await c.get(target, params=params)
        return Response(content=r.content, media_type=r.headers.get("content-type", "image/jpeg"))


# ---- Metadata details ----
@api.get("/metadata/{rating_key}")
async def metadata_detail(rating_key: str, user: dict = Depends(get_current_user)):
    uri, token = await _server_ctx(user)
    data = await plex_get(f"{uri}/library/metadata/{rating_key}", token=token)
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    if not items:
        raise HTTPException(404, "Not found")
    item = items[0]
    norm = _normalize_item(uri, token, item)
    # Include media parts for direct play hints
    medias = []
    for media in item.get("Media", []) or []:
        for part in media.get("Part", []) or []:
            medias.append({
                "id": part.get("id"),
                "key": part.get("key"),
                "duration": part.get("duration"),
                "size": part.get("size"),
                "container": part.get("container"),
                "video_codec": media.get("videoCodec"),
                "audio_codec": media.get("audioCodec"),
                "resolution": media.get("videoResolution"),
                "bitrate": media.get("bitrate"),
            })
    norm["media"] = medias
    return norm


# ---- Children (seasons / episodes) ----
@api.get("/metadata/{rating_key}/children")
async def metadata_children(rating_key: str, user: dict = Depends(get_current_user)):
    uri, token = await _server_ctx(user)
    data = await plex_get(f"{uri}/library/metadata/{rating_key}/children", token=token)
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    return {"items": [_normalize_item(uri, token, i) for i in items]}


# ---- Recently added ----
@api.get("/recently-added")
async def recently_added(user: dict = Depends(get_current_user), limit: int = 30):
    uri, token = await _server_ctx(user)
    data = await plex_get(
        f"{uri}/library/recentlyAdded",
        token=token,
        params={"X-Plex-Container-Size": limit, "X-Plex-Container-Start": 0},
    )
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    return {"items": [_normalize_item(uri, token, i) for i in items]}


# ---- Continue watching (onDeck) ----
@api.get("/continue-watching")
async def on_deck(user: dict = Depends(get_current_user), limit: int = 30):
    uri, token = await _server_ctx(user)
    data = await plex_get(
        f"{uri}/library/onDeck",
        token=token,
        params={"X-Plex-Container-Size": limit},
    )
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    return {"items": [_normalize_item(uri, token, i) for i in items]}


# ---- Search ----
@api.get("/search")
async def search(q: str, user: dict = Depends(get_current_user), limit: int = 30):
    uri, token = await _server_ctx(user)
    data = await plex_get(
        f"{uri}/search",
        token=token,
        params={"query": q, "limit": limit},
    )
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    return {"items": [_normalize_item(uri, token, i) for i in items]}


# ---- Live TV ----
@api.get("/livetv/channels")
async def live_channels(user: dict = Depends(get_current_user)):
    uri, token = await _server_ctx(user)
    # Try /livetv/dvrs/<dvr>/channels (Plex Pass DVR) and /tv.plex.providers.epg.cloud sections
    out: list[dict] = []
    try:
        dvrs = await plex_get(f"{uri}/livetv/dvrs", token=token)
        for d in dvrs.get("MediaContainer", {}).get("Dvr", []) or []:
            for ch in d.get("ChannelMapping", []) or []:
                out.append({
                    "title": ch.get("channelTitle") or ch.get("name"),
                    "number": ch.get("channelNumber"),
                    "logo": ch.get("channelThumb"),
                    "key": ch.get("channelKey"),
                    "source": "dvr",
                })
    except Exception as e:
        log.info("No DVR or fetch failed: %s", e)
    # Cloud EPG (Plex's free live TV) — list as a section if present
    try:
        secs = await plex_get(f"{uri}/library/sections", token=token)
        for d in secs.get("MediaContainer", {}).get("Directory", []) or []:
            if d.get("type") == "livetv":
                items = await plex_get(f"{uri}/library/sections/{d.get('key')}/all", token=token,
                                       params={"X-Plex-Container-Size": 500})
                for it in items.get("MediaContainer", {}).get("Metadata", []) or []:
                    out.append({
                        "title": it.get("title"),
                        "number": it.get("index"),
                        "logo": _proxy_image(uri, token, it.get("thumb")) if it.get("thumb") else None,
                        "key": it.get("ratingKey"),
                        "source": "section",
                    })
    except Exception as e:
        log.info("Live section fetch failed: %s", e)
    return {"channels": out}


# ---- Streaming URLs ----
@api.get("/stream/{rating_key}")
async def stream_url(
    rating_key: str,
    user: dict = Depends(get_current_user),
    direct: bool = False,
    max_bitrate: int = 8000,
):
    """Return a playable URL for the given item. If direct=True returns the
    raw Plex part URL; otherwise returns an HLS transcode URL."""
    uri, token = await _server_ctx(user)
    if direct:
        meta = await plex_get(f"{uri}/library/metadata/{rating_key}", token=token)
        items = meta.get("MediaContainer", {}).get("Metadata", []) or []
        if not items:
            raise HTTPException(404, "Not found")
        part = items[0]["Media"][0]["Part"][0]
        url = f"{uri}{part['key']}?X-Plex-Token={token}"
        return {"url": url, "type": "direct"}

    session = str(uuid.uuid4())
    params = {
        "path": f"/library/metadata/{rating_key}",
        "mediaIndex": 0,
        "partIndex": 0,
        "protocol": "hls",
        "fastSeek": 1,
        "directPlay": 0,
        "directStream": 1,
        "subtitleSize": 100,
        "audioBoost": 100,
        "session": session,
        "maxVideoBitrate": max_bitrate,
        "videoQuality": 100,
        "videoResolution": "1920x1080",
        "X-Plex-Token": token,
        "X-Plex-Client-Identifier": user.get("plex_client_identifier", PLEX_CLIENT_IDENTIFIER),
        "X-Plex-Product": PLEX_PRODUCT,
        "X-Plex-Version": PLEX_VERSION,
        "X-Plex-Platform": PLEX_PLATFORM,
    }
    hls = f"{uri}/video/:/transcode/universal/start.m3u8?{urlencode(params)}"
    return {"url": hls, "type": "hls", "session": session}


# ============================================================
# Admin Panel
# ============================================================
class AdminLoginBody(BaseModel):
    username: str
    password: str


@api.post("/admin/login")
async def admin_login(body: AdminLoginBody):
    if body.username != ADMIN_USERNAME or body.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Invalid admin credentials")
    token = create_jwt({"sub": "admin", "role": "admin"}, expires_hours=24 * 7)
    return {"token": token, "username": ADMIN_USERNAME}


@api.get("/admin/me")
async def admin_me(admin: dict = Depends(get_current_admin)):
    return {"username": admin.get("sub"), "role": admin.get("role")}


@api.get("/admin/stats")
async def admin_stats(admin: dict = Depends(get_current_admin)):
    users = await db.users.count_documents({})
    active = await db.users.count_documents({"status": "active"})
    recent = await db.users.count_documents({
        "last_login": {"$gte": (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()}
    })
    pins = await db.plex_pins.count_documents({})
    settings = await db.settings.find_one({"id": "global"}) or {}
    return {
        "users_total": users,
        "users_active": active,
        "users_recent_logins_7d": recent,
        "open_pins": pins,
        "service_name": settings.get("service_name", "Quantum TV"),
    }


@api.get("/admin/users")
async def admin_list_users(admin: dict = Depends(get_current_admin), q: Optional[str] = None):
    query: dict = {}
    if q:
        query["$or"] = [
            {"username": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.users.find(query).sort("created_at", -1).limit(200)
    users = []
    async for u in cursor:
        users.append({
            "id": u.get("id"),
            "username": u.get("username"),
            "email": u.get("email"),
            "avatar": u.get("avatar"),
            "status": u.get("status", "active"),
            "selected_server": (u.get("selected_server") or {}).get("name"),
            "created_at": u.get("created_at"),
            "last_login": u.get("last_login"),
            "plex_user_id": u.get("plex_user_id"),
        })
    return {"users": users}


class UserStatusBody(BaseModel):
    status: str  # active | banned | revoked


@api.patch("/admin/users/{user_id}")
async def admin_set_user_status(user_id: str, body: UserStatusBody, admin: dict = Depends(get_current_admin)):
    if body.status not in {"active", "banned", "revoked"}:
        raise HTTPException(400, "Invalid status")
    r = await db.users.update_one({"id": user_id}, {"$set": {"status": body.status, "updated_at": now_iso()}})
    if r.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@api.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(get_current_admin)):
    r = await db.users.delete_one({"id": user_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@api.get("/admin/servers")
async def admin_list_servers(admin: dict = Depends(get_current_admin)):
    """Aggregate all Plex servers across users."""
    seen: dict[str, dict] = {}
    async for u in db.users.find({}):
        sel = u.get("selected_server") or {}
        if sel.get("client_identifier"):
            cid = sel["client_identifier"]
            seen.setdefault(cid, {
                "client_identifier": cid,
                "name": sel.get("name"),
                "uri": sel.get("uri"),
                "users": [],
            })
            seen[cid]["users"].append(u.get("username"))
    return {"servers": list(seen.values())}


class SettingsBody(BaseModel):
    service_name: Optional[str] = None
    allow_new_signups: Optional[bool] = None
    require_invite: Optional[bool] = None
    motd: Optional[str] = None


@api.get("/admin/settings")
async def admin_get_settings(admin: dict = Depends(get_current_admin)):
    s = await db.settings.find_one({"id": "global"}) or {}
    return {
        "service_name": s.get("service_name", "Quantum TV"),
        "allow_new_signups": s.get("allow_new_signups", True),
        "require_invite": s.get("require_invite", False),
        "motd": s.get("motd", ""),
    }


@api.put("/admin/settings")
async def admin_update_settings(body: SettingsBody, admin: dict = Depends(get_current_admin)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        return {"ok": True}
    update["updated_at"] = now_iso()
    await db.settings.update_one({"id": "global"}, {"$set": update, "$setOnInsert": {"id": "global"}}, upsert=True)
    return {"ok": True}


@api.get("/admin/activity")
async def admin_activity(admin: dict = Depends(get_current_admin), limit: int = 50):
    """Return recent user activity (logins). For MVP we synthesize from users."""
    cursor = db.users.find({}).sort("last_login", -1).limit(limit)
    out = []
    async for u in cursor:
        out.append({
            "id": u.get("id"),
            "username": u.get("username"),
            "avatar": u.get("avatar"),
            "action": "login",
            "at": u.get("last_login"),
            "server": (u.get("selected_server") or {}).get("name"),
        })
    return {"activity": out}


# Public service config (for mobile app branding)
@api.get("/config")
async def public_config():
    s = await db.settings.find_one({"id": "global"}) or {}
    return {
        "service_name": s.get("service_name", "Quantum TV"),
        "motd": s.get("motd", ""),
    }


app.include_router(api)


@app.on_event("startup")
async def startup():
    await db.users.create_index("id", unique=True)
    await db.users.create_index("plex_user_id")
    await db.plex_pins.create_index("pin_id", unique=True)
    log.info("Quantum TV API started")
