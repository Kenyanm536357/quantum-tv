"""Quantum TV — FastAPI backend.

Architecture:
  - Admin links their Plex account ONCE in the admin panel.
  - Admin creates user accounts (username + password + status). Users cannot self-register.
  - One login endpoint routes to admin or user based on credentials.
  - Users see the admin's Plex libraries; each user has private watchlist + favorites.
"""
from __future__ import annotations

import os
import uuid
import asyncio
import base64
import logging
import hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional, Any
from urllib.parse import urlencode

import httpx
import xmltodict
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Response, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel
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


def hash_password(p: str) -> str:
    return pwd_ctx.hash(p)


def verify_password(p: str, h: str) -> bool:
    try:
        return pwd_ctx.verify(p, h)
    except Exception:
        return False


# ---------------------------------------------------------------------------
# JWT helpers
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
    if not user_id or payload.get("role") != "user":
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one(
        {"id": user_id},
        {"id": 1, "username": 1, "display_name": 1, "status": 1, "avatar": 1,
         "watchlist": 1, "favorites": 1, "password_hash": 1},
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Account not activated")
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


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------
app = FastAPI(title="Quantum TV API", version="1.1.0")
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
# Unified login
# ============================================================
class LoginBody(BaseModel):
    username: str
    password: str


@api.post("/auth/login")
async def login(body: LoginBody):
    """Unified login. If credentials match admin in env -> admin token.
    Otherwise looks up user in DB. Inactive / not-found returns generic error."""
    # Admin path
    if body.username == ADMIN_USERNAME and body.password == ADMIN_PASSWORD:
        token = create_jwt({"sub": "admin", "role": "admin"}, expires_hours=24 * 7)
        return {"token": token, "role": "admin", "username": ADMIN_USERNAME}

    # User path
    user = await db.users.find_one({"username": body.username})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Account is not registered or not activated")
    if user.get("status") != "active":
        raise HTTPException(403, "Account is not registered or not activated")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Account is not registered or not activated")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": now_iso()}})
    token = create_jwt({"sub": user["id"], "role": "user", "username": user["username"]})
    return {
        "token": token,
        "role": "user",
        "username": user["username"],
        "display_name": user.get("display_name") or user["username"],
        "avatar": user.get("avatar"),
    }


# Backwards-compat alias (web admin panel uses /admin/login)
@api.post("/admin/login")
async def admin_login_compat(body: LoginBody):
    if body.username != ADMIN_USERNAME or body.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Invalid admin credentials")
    token = create_jwt({"sub": "admin", "role": "admin"}, expires_hours=24 * 7)
    return {"token": token, "username": ADMIN_USERNAME, "role": "admin"}


# ============================================================
# Admin: link Plex account (system-wide Plex token)
# ============================================================
@api.post("/admin/plex/link/start")
async def admin_plex_link_start(admin: dict = Depends(get_current_admin)):
    client_id = str(uuid.uuid4())
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.post(
            f"{PLEX_AUTH_BASE}/pins?strong=true",
            headers={**plex_headers(client_id=client_id), "Content-Type": "application/json"},
        )
        r.raise_for_status()
        d = r.json()
    pin_id = d["id"]; code = d["code"]
    params = {
        "clientID": client_id, "code": code,
        "context[device][product]": PLEX_PRODUCT,
        "context[device][version]": PLEX_VERSION,
        "context[device][platform]": PLEX_PLATFORM,
    }
    auth_url = f"https://app.plex.tv/auth#?{urlencode(params)}"
    await db.plex_pins.insert_one({
        "pin_id": pin_id, "code": code, "client_identifier": client_id,
        "purpose": "admin_link", "created_at": now_iso(),
    })
    return {"pin_id": pin_id, "code": code, "auth_url": auth_url, "client_identifier": client_id}


@api.get("/admin/plex/link/check/{pin_id}")
async def admin_plex_link_check(pin_id: int, admin: dict = Depends(get_current_admin)):
    pin_doc = await db.plex_pins.find_one({"pin_id": pin_id})
    if not pin_doc:
        raise HTTPException(404, "Pin not found")
    client_id = pin_doc["client_identifier"]
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(f"{PLEX_AUTH_BASE}/pins/{pin_id}", headers=plex_headers(client_id=client_id))
        r.raise_for_status()
        data = r.json()
    auth_token = data.get("authToken")
    if not auth_token:
        return {"linked": False}
    # Fetch profile
    info = await plex_get(f"{PLEX_AUTH_BASE}/user", token=auth_token)
    await db.system.update_one(
        {"id": "plex"},
        {"$set": {
            "id": "plex",
            "plex_token_enc": encrypt_token(auth_token),
            "client_identifier": client_id,
            "plex_username": info.get("username") or info.get("title"),
            "plex_email": info.get("email"),
            "avatar": info.get("thumb"),
            "linked_at": now_iso(),
        }},
        upsert=True,
    )
    await db.plex_pins.delete_one({"pin_id": pin_id})
    return {"linked": True, "plex_username": info.get("username") or info.get("title"),
            "avatar": info.get("thumb")}


@api.get("/admin/plex/status")
async def admin_plex_status(admin: dict = Depends(get_current_admin)):
    s = await db.system.find_one({"id": "plex"})
    if not s or not s.get("plex_token_enc"):
        return {"linked": False}
    return {
        "linked": True,
        "plex_username": s.get("plex_username"),
        "plex_email": s.get("plex_email"),
        "avatar": s.get("avatar"),
        "linked_at": s.get("linked_at"),
        "selected_server": s.get("selected_server"),
    }


@api.delete("/admin/plex/link")
async def admin_plex_unlink(admin: dict = Depends(get_current_admin)):
    await db.system.delete_one({"id": "plex"})
    return {"ok": True}


# ============================================================
# System Plex context helpers
# ============================================================
async def _sys_plex():
    s = await db.system.find_one({"id": "plex"})
    if not s or not s.get("plex_token_enc"):
        raise HTTPException(503, "Plex is not connected. Ask the admin to link a Plex account.")
    return s


async def _sys_resources():
    s = await _sys_plex()
    token = decrypt_token(s["plex_token_enc"])
    cid = s["client_identifier"]
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(
            f"{PLEX_AUTH_BASE}/resources",
            headers=plex_headers(token=token, client_id=cid),
            params={"includeHttps": 1, "includeRelay": 1},
        )
        r.raise_for_status()
        return s, r.json()


def _pick_best_connection(resource: dict) -> Optional[str]:
    conns = resource.get("connections") or []
    locals_ = [c for c in conns if c.get("local") and not c.get("relay")]
    remotes = [c for c in conns if not c.get("local") and not c.get("relay")]
    relays = [c for c in conns if c.get("relay")]
    for group in (locals_, remotes, relays):
        for c in group:
            if c.get("uri"):
                return c["uri"]
    return None


async def _server_ctx() -> tuple[str, str]:
    """Return (server_uri, plex_token) for the admin-linked Plex account."""
    s, resources = await _sys_resources()
    sel = s.get("selected_server")
    chosen = None
    for r in resources:
        if "server" not in (r.get("provides") or ""):
            continue
        if sel and r.get("clientIdentifier") == sel.get("client_identifier"):
            chosen = r
            break
    if not chosen:
        # pick first owned, else first
        owned = [r for r in resources if "server" in (r.get("provides") or "") and r.get("owned")]
        any_ = [r for r in resources if "server" in (r.get("provides") or "")]
        chosen = (owned or any_ or [None])[0]
    if not chosen:
        raise HTTPException(404, "No Plex servers on linked account")
    uri = _pick_best_connection(chosen)
    if not uri:
        raise HTTPException(503, "Plex server has no reachable connection")
    token = chosen.get("accessToken") or decrypt_token(s["plex_token_enc"])
    return uri, token


@api.get("/admin/plex/servers")
async def admin_list_plex_servers(admin: dict = Depends(get_current_admin)):
    s, resources = await _sys_resources()
    out = []
    for r in resources:
        if "server" not in (r.get("provides") or ""):
            continue
        out.append({
            "name": r.get("name"),
            "client_identifier": r.get("clientIdentifier"),
            "owned": r.get("owned"),
            "product": r.get("product"),
            "version": r.get("productVersion"),
            "uri": _pick_best_connection(r),
        })
    return {"servers": out, "selected": (s.get("selected_server") or {}).get("client_identifier")}


class SelectServerBody(BaseModel):
    client_identifier: str


@api.post("/admin/plex/servers/select")
async def admin_select_server(body: SelectServerBody, admin: dict = Depends(get_current_admin)):
    servers = (await admin_list_plex_servers(admin))["servers"]
    chosen = next((x for x in servers if x["client_identifier"] == body.client_identifier), None)
    if not chosen:
        raise HTTPException(404, "Server not found")
    await db.system.update_one(
        {"id": "plex"},
        {"$set": {"selected_server": {
            "client_identifier": chosen["client_identifier"],
            "name": chosen["name"],
            "uri": chosen["uri"],
        }}},
    )
    return {"ok": True}


# ============================================================
# Admin: user management with password
# ============================================================
class CreateUserBody(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    status: Optional[str] = "active"


@api.post("/admin/users")
async def admin_create_user(body: CreateUserBody, admin: dict = Depends(get_current_admin)):
    if not body.username or not body.password:
        raise HTTPException(400, "username and password required")
    existing = await db.users.find_one({"username": body.username})
    if existing:
        raise HTTPException(409, "Username already exists")
    user_id = str(uuid.uuid4())
    await db.users.insert_one({
        "id": user_id,
        "username": body.username,
        "password_hash": hash_password(body.password),
        "display_name": body.display_name or body.username,
        "status": body.status if body.status in {"active", "disabled"} else "active",
        "watchlist": [],
        "favorites": [],
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "last_login": None,
    })
    return {"id": user_id, "username": body.username, "status": body.status}


class UpdateUserBody(BaseModel):
    password: Optional[str] = None
    display_name: Optional[str] = None
    status: Optional[str] = None  # active | disabled


@api.patch("/admin/users/{user_id}")
async def admin_update_user(user_id: str, body: UpdateUserBody, admin: dict = Depends(get_current_admin)):
    update: dict = {}
    if body.password:
        update["password_hash"] = hash_password(body.password)
    if body.display_name is not None:
        update["display_name"] = body.display_name
    if body.status is not None:
        if body.status not in {"active", "disabled"}:
            raise HTTPException(400, "Invalid status")
        update["status"] = body.status
    if not update:
        return {"ok": True}
    update["updated_at"] = now_iso()
    r = await db.users.update_one({"id": user_id}, {"$set": update})
    if r.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@api.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: dict = Depends(get_current_admin)):
    r = await db.users.delete_one({"id": user_id})
    if r.deleted_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}


@api.get("/admin/users")
async def admin_list_users(admin: dict = Depends(get_current_admin), q: Optional[str] = None):
    query: dict = {}
    if q:
        query["$or"] = [
            {"username": {"$regex": q, "$options": "i"}},
            {"display_name": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.users.find(
        query,
        {"id": 1, "username": 1, "display_name": 1, "status": 1,
         "created_at": 1, "last_login": 1, "watchlist": 1, "favorites": 1},
    ).sort("created_at", -1).limit(500)
    out = []
    async for u in cursor:
        out.append({
            "id": u.get("id"),
            "username": u.get("username"),
            "display_name": u.get("display_name") or u.get("username"),
            "status": u.get("status", "active"),
            "created_at": u.get("created_at"),
            "last_login": u.get("last_login"),
            "watchlist_count": len(u.get("watchlist") or []),
            "favorites_count": len(u.get("favorites") or []),
        })
    return {"users": out}


# ============================================================
# Admin: stats, settings, activity
# ============================================================
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
    s = await db.settings.find_one({"id": "global"}) or {}
    plex = await db.system.find_one({"id": "plex"}) or {}
    return {
        "users_total": users,
        "users_active": active,
        "users_recent_logins_7d": recent,
        "service_name": s.get("service_name", "Quantum TV"),
        "plex_linked": bool(plex.get("plex_token_enc")),
        "plex_username": plex.get("plex_username"),
    }


@api.get("/admin/activity")
async def admin_activity(admin: dict = Depends(get_current_admin), limit: int = 50):
    cursor = db.users.find(
        {"last_login": {"$ne": None}},
        {"id": 1, "username": 1, "display_name": 1, "last_login": 1},
    ).sort("last_login", -1).limit(limit)
    out = []
    async for u in cursor:
        out.append({
            "id": u.get("id"),
            "username": u.get("username"),
            "display_name": u.get("display_name") or u.get("username"),
            "action": "login",
            "at": u.get("last_login"),
        })
    return {"activity": out}


class SettingsBody(BaseModel):
    service_name: Optional[str] = None
    motd: Optional[str] = None


@api.get("/admin/settings")
async def admin_get_settings(admin: dict = Depends(get_current_admin)):
    s = await db.settings.find_one({"id": "global"}) or {}
    return {"service_name": s.get("service_name", "Quantum TV"), "motd": s.get("motd", "")}


@api.put("/admin/settings")
async def admin_update_settings(body: SettingsBody, admin: dict = Depends(get_current_admin)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        return {"ok": True}
    update["updated_at"] = now_iso()
    await db.settings.update_one({"id": "global"}, {"$set": update, "$setOnInsert": {"id": "global"}}, upsert=True)
    return {"ok": True}


@api.get("/admin/servers")
async def admin_servers_aggregate(admin: dict = Depends(get_current_admin)):
    """Same shape as before — but driven by the admin-linked Plex account."""
    plex = await db.system.find_one({"id": "plex"})
    if not plex:
        return {"servers": []}
    try:
        s, resources = await _sys_resources()
    except HTTPException:
        return {"servers": []}
    out = []
    for r in resources:
        if "server" not in (r.get("provides") or ""):
            continue
        out.append({
            "name": r.get("name"),
            "client_identifier": r.get("clientIdentifier"),
            "uri": _pick_best_connection(r),
            "owned": r.get("owned"),
            "users": [],
        })
    return {"servers": out}


# ============================================================
# User endpoints (mobile app)
# ============================================================
@api.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "username": user["username"],
        "display_name": user.get("display_name") or user["username"],
        "avatar": user.get("avatar"),
        "watchlist_count": len(user.get("watchlist") or []),
        "favorites_count": len(user.get("favorites") or []),
    }


def _proxy_image(uri: str, token: str, path: str) -> str:
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


def _normalize_item(uri: str, token: str, m: dict) -> dict:
    return {
        "rating_key": m.get("ratingKey"),
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


@api.get("/libraries")
async def list_libraries(user: dict = Depends(get_current_user)):
    uri, token = await _server_ctx()
    data = await plex_get(f"{uri}/library/sections", token=token)
    dirs = data.get("MediaContainer", {}).get("Directory", []) or []
    return {"libraries": [
        {"key": d.get("key"), "title": d.get("title"), "type": d.get("type"),
         "agent": d.get("agent"), "uuid": d.get("uuid")}
        for d in dirs
    ]}


@api.get("/libraries/{key}/items")
async def library_items(key: str, user: dict = Depends(get_current_user),
                        offset: int = 0, limit: int = 50, sort: str = "addedAt:desc"):
    uri, token = await _server_ctx()
    data = await plex_get(
        f"{uri}/library/sections/{key}/all",
        token=token,
        params={"X-Plex-Container-Start": offset, "X-Plex-Container-Size": limit, "sort": sort},
    )
    mc = data.get("MediaContainer", {})
    items = mc.get("Metadata", []) or []
    return {"total": mc.get("totalSize", len(items)), "items": [_normalize_item(uri, token, i) for i in items]}


@api.get("/metadata/{rating_key}")
async def metadata_detail(rating_key: str, user: dict = Depends(get_current_user)):
    uri, token = await _server_ctx()
    data = await plex_get(f"{uri}/library/metadata/{rating_key}", token=token)
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    if not items:
        raise HTTPException(404, "Not found")
    item = items[0]
    norm = _normalize_item(uri, token, item)
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
    norm["in_watchlist"] = str(rating_key) in [str(x) for x in (user.get("watchlist") or [])]
    norm["in_favorites"] = str(rating_key) in [str(x) for x in (user.get("favorites") or [])]
    return norm


@api.get("/metadata/{rating_key}/children")
async def metadata_children(rating_key: str, user: dict = Depends(get_current_user)):
    uri, token = await _server_ctx()
    data = await plex_get(f"{uri}/library/metadata/{rating_key}/children", token=token)
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    return {"items": [_normalize_item(uri, token, i) for i in items]}


@api.get("/recently-added")
async def recently_added(user: dict = Depends(get_current_user), limit: int = 30):
    uri, token = await _server_ctx()
    data = await plex_get(f"{uri}/library/recentlyAdded", token=token,
                          params={"X-Plex-Container-Size": limit, "X-Plex-Container-Start": 0})
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    return {"items": [_normalize_item(uri, token, i) for i in items]}


@api.get("/continue-watching")
async def on_deck(user: dict = Depends(get_current_user), limit: int = 30):
    uri, token = await _server_ctx()
    data = await plex_get(f"{uri}/library/onDeck", token=token, params={"X-Plex-Container-Size": limit})
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    return {"items": [_normalize_item(uri, token, i) for i in items]}


@api.get("/search")
async def search(q: str, user: dict = Depends(get_current_user), limit: int = 30):
    uri, token = await _server_ctx()
    data = await plex_get(f"{uri}/search", token=token, params={"query": q, "limit": limit})
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    return {"items": [_normalize_item(uri, token, i) for i in items]}


@api.get("/livetv/channels")
async def live_channels(user: dict = Depends(get_current_user)):
    uri, token = await _server_ctx()
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
        log.info("No DVR: %s", e)
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


@api.get("/stream/{rating_key}")
async def stream_url(rating_key: str, user: dict = Depends(get_current_user),
                    direct: bool = True, max_bitrate: int = 8000):
    uri, token = await _server_ctx()
    if direct:
        meta = await plex_get(f"{uri}/library/metadata/{rating_key}", token=token)
        items = meta.get("MediaContainer", {}).get("Metadata", []) or []
        if not items:
            raise HTTPException(404, "Not found")
        try:
            part = items[0]["Media"][0]["Part"][0]
            url = f"{uri}{part['key']}?X-Plex-Token={token}"
            return {"url": url, "type": "direct"}
        except Exception:
            pass
    # fallback HLS
    session = str(uuid.uuid4())
    params = {
        "path": f"/library/metadata/{rating_key}",
        "mediaIndex": 0, "partIndex": 0, "protocol": "hls",
        "fastSeek": 1, "directPlay": 0, "directStream": 1,
        "session": session, "maxVideoBitrate": max_bitrate,
        "videoQuality": 100, "videoResolution": "1920x1080",
        "X-Plex-Token": token,
        "X-Plex-Client-Identifier": PLEX_CLIENT_IDENTIFIER,
        "X-Plex-Product": PLEX_PRODUCT, "X-Plex-Version": PLEX_VERSION, "X-Plex-Platform": PLEX_PLATFORM,
    }
    return {"url": f"{uri}/video/:/transcode/universal/start.m3u8?{urlencode(params)}", "type": "hls", "session": session}


# ============================================================
# Per-user watchlist & favorites
# ============================================================
class RatingKeyBody(BaseModel):
    rating_key: str


async def _enrich_keys(keys: list[str]) -> list[dict]:
    if not keys:
        return []
    uri, token = await _server_ctx()

    async def fetch_one(rk: str) -> Optional[dict]:
        try:
            data = await plex_get(f"{uri}/library/metadata/{rk}", token=token)
            md = (data.get("MediaContainer", {}).get("Metadata") or [None])[0]
            return _normalize_item(uri, token, md) if md else None
        except Exception:
            return None

    results = await asyncio.gather(*(fetch_one(rk) for rk in keys))
    return [item for item in results if item is not None]


@api.get("/me/watchlist")
async def my_watchlist(user: dict = Depends(get_current_user)):
    keys = [str(x) for x in (user.get("watchlist") or [])]
    return {"items": await _enrich_keys(keys)}


@api.post("/me/watchlist")
async def add_watchlist(body: RatingKeyBody, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"watchlist": str(body.rating_key)}})
    return {"ok": True}


@api.delete("/me/watchlist/{rating_key}")
async def del_watchlist(rating_key: str, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"watchlist": str(rating_key)}})
    return {"ok": True}


@api.get("/me/favorites")
async def my_favorites(user: dict = Depends(get_current_user)):
    keys = [str(x) for x in (user.get("favorites") or [])]
    return {"items": await _enrich_keys(keys)}


@api.post("/me/favorites")
async def add_favorite(body: RatingKeyBody, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"favorites": str(body.rating_key)}})
    return {"ok": True}


@api.delete("/me/favorites/{rating_key}")
async def del_favorite(rating_key: str, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"favorites": str(rating_key)}})
    return {"ok": True}


# Public service config
@api.get("/config")
async def public_config():
    s = await db.settings.find_one({"id": "global"}) or {}
    plex = await db.system.find_one({"id": "plex"})
    return {
        "service_name": s.get("service_name", "Quantum TV"),
        "motd": s.get("motd", ""),
        "plex_linked": bool(plex and plex.get("plex_token_enc")),
    }


app.include_router(api)


# ============================================================
# Fire TV / Android APK hosting (Downloader-friendly)
# ============================================================
APK_DIR = Path(__file__).parent / "storage"
APK_DIR.mkdir(parents=True, exist_ok=True)
APK_PATH = APK_DIR / "quantum-tv.apk"


async def _apk_meta_doc():
    return await db.apk.find_one({"id": "current"}) or {}


@app.post("/api/admin/apk/upload")
async def upload_apk(
    file: UploadFile = File(...),
    version: Optional[str] = None,
    admin: dict = Depends(get_current_admin),
):
    fn = (file.filename or "").lower()
    if not fn.endswith(".apk"):
        raise HTTPException(400, "File must be an .apk")
    data = await file.read()
    if len(data) < 1024:
        raise HTTPException(400, "APK looks empty")
    APK_PATH.write_bytes(data)
    sha = hashlib.sha256(data).hexdigest()
    await db.apk.update_one(
        {"id": "current"},
        {"$set": {
            "id": "current",
            "filename": file.filename,
            "size": len(data),
            "sha256": sha,
            "version": version or "1.0.0",
            "uploaded_at": now_iso(),
        }},
        upsert=True,
    )
    return {"ok": True, "size": len(data), "sha256": sha[:12], "version": version or "1.0.0"}


@app.delete("/api/admin/apk")
async def delete_apk(admin: dict = Depends(get_current_admin)):
    if APK_PATH.exists():
        APK_PATH.unlink()
    await db.apk.delete_one({"id": "current"})
    return {"ok": True}


@app.get("/api/admin/apk/info")
async def apk_info(admin: dict = Depends(get_current_admin)):
    meta = await _apk_meta_doc()
    s = await db.settings.find_one({"id": "short_urls"}) or {}
    return {
        "available": APK_PATH.exists(),
        "size": meta.get("size"),
        "version": meta.get("version"),
        "uploaded_at": meta.get("uploaded_at"),
        "sha256": (meta.get("sha256") or "")[:12],
        "filename": meta.get("filename"),
        "short_preview": s.get("preview"),
        "short_production": s.get("production"),
    }


async def _shorten(url: str) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get("https://is.gd/create.php", params={"format": "simple", "url": url})
            short = r.text.strip()
            if short.startswith("http"):
                return short
    except Exception as e:
        log.info("shorten failed: %s", e)
    return None


@app.post("/api/admin/apk/shorten")
async def regenerate_short_urls(admin: dict = Depends(get_current_admin)):
    """Generate/refresh short URLs (is.gd) for the APK download endpoint."""
    preview_url = "https://stream-plex-mobile.preview.emergentagent.com/api/q"
    prod_url = "https://stream-plex-mobile.emergent.host/api/q"
    p_short = await _shorten(preview_url)
    pr_short = await _shorten(prod_url)
    await db.settings.update_one(
        {"id": "short_urls"},
        {"$set": {"id": "short_urls", "preview": p_short, "production": pr_short, "updated_at": now_iso()}},
        upsert=True,
    )
    return {"preview": p_short, "production": pr_short}


def _serve_apk():
    if not APK_PATH.exists():
        return HTMLResponse(
            content=(
                "<html><body style='background:#060714;color:#fff;font-family:sans-serif;"
                "display:flex;align-items:center;justify-content:center;height:100vh;text-align:center'>"
                "<div><h1 style='font-size:28px;margin:0'>Quantum TV</h1>"
                "<p style='color:#A1A1AA;margin-top:14px'>APK not uploaded yet.<br/>"
                "The admin must upload the .apk in the Control Panel → Fire TV.</p></div></body></html>"
            ),
            status_code=404,
        )
    return FileResponse(
        path=str(APK_PATH),
        media_type="application/vnd.android.package-archive",
        filename="quantum-tv.apk",
        headers={
            "Content-Disposition": 'attachment; filename="quantum-tv.apk"',
            "Cache-Control": "no-cache",
        },
    )


# Short URLs for the Downloader app on Fire TV — these must live under /api
# because the kubernetes ingress only routes /api/* to the backend.
@app.get("/api/q")
async def short_apk():
    return _serve_apk()


@app.get("/api/quantum-tv.apk")
async def named_apk():
    return _serve_apk()


@app.get("/api/install")
async def install_landing(request: Request):
    """A friendly landing page when users hit /install on the Fire TV browser
    (so even if they typed the long URL, they get a clear download button)."""
    meta = await _apk_meta_doc()
    host = str(request.base_url).rstrip("/")
    ver = meta.get("version") or ""
    short = f"{host}/api/q"
    return HTMLResponse(
        content=f"""
<!doctype html><html><head><meta charset=utf-8><title>Install Quantum TV</title>
<meta name=viewport content="width=device-width,initial-scale=1">
<style>
  body{{margin:0;background:#060714;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
       min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}}
  .card{{background:rgba(13,14,35,0.7);border:1px solid rgba(255,255,255,0.08);border-radius:24px;
        padding:32px;max-width:520px;text-align:center}}
  h1{{margin:0;background:linear-gradient(135deg,#8B5CF6,#06B6D4);
      -webkit-background-clip:text;background-clip:text;color:transparent;font-size:36px}}
  p{{color:#A1A1AA;line-height:1.6}}
  a.btn{{display:inline-block;margin-top:18px;padding:16px 32px;border-radius:9999px;
       background:linear-gradient(135deg,#8B5CF6,#06B6D4);color:#fff;text-decoration:none;font-weight:700;
       box-shadow:0 6px 22px rgba(139,92,246,0.35)}}
  code{{display:block;margin-top:18px;background:rgba(255,255,255,0.05);padding:12px;border-radius:10px;
       color:#06B6D4;font-size:14px;word-break:break-all}}
</style></head><body><div class=card>
<h1>Quantum TV</h1>
<p>Install the Quantum TV Fire TV / Android app{f' (v{ver})' if ver else ''}.</p>
<a class=btn href="/api/q">Download APK</a>
<p style="font-size:13px;margin-top:24px">In the <b>Downloader</b> app on Fire TV, enter:</p>
<code>{short}</code>
</div></body></html>""",
        media_type="text/html",
    )


@app.on_event("startup")
async def startup():
    await db.users.create_index("id", unique=True)
    await db.users.create_index("username", unique=True, sparse=True)
    await db.plex_pins.create_index("pin_id", unique=True)
    log.info("Quantum TV API started")
