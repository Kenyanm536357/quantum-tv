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
from urllib.parse import urlencode, urljoin, urlparse, quote

import httpx
import xmltodict
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Response, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
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
         "watchlist": 1, "favorites": 1, "password_hash": 1,
         "account_number": 1, "subscription_months": 1, "expires_at": 1,
         "max_devices": 1, "devices": 1},
    )
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if user.get("status") != "active":
        raise HTTPException(status_code=403, detail="Account not activated")
    return user


async def get_user_flex(
    authorization: Optional[str] = Header(None),
    t: Optional[str] = None,
) -> dict:
    """Variant of get_current_user that ALSO accepts a JWT via the `?t=` query
    string. Required for <video>/<img> element URLs (which can't carry an
    Authorization header)."""
    tok: Optional[str] = None
    if authorization and authorization.lower().startswith("bearer "):
        tok = authorization.split(None, 1)[1]
    elif t:
        tok = t
    if not tok:
        raise HTTPException(401, "Missing token")
    payload = decode_jwt(tok)
    if payload.get("role") != "user":
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload.get("sub")}, {"id": 1, "status": 1})
    if not user or user.get("status") != "active":
        raise HTTPException(403, "Account inactive")
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
    device_id: Optional[str] = None     # stable per-install ID from the mobile app
    device_model: Optional[str] = None  # e.g. "AFTKA" (Fire TV Stick) / "iPhone15,2"
    device_name: Optional[str] = None   # friendly name


@api.post("/auth/login")
async def login(body: LoginBody):
    """Unified login. If credentials match admin in env -> admin token.
    Otherwise looks up user in DB.

    - Case-insensitive username matching (Fire TV keyboard autocaps the first letter).
    - Enforces subscription expiration with a specific message.
    - Auto-registers the calling device into the user's device slots (up to max_devices).
    - Returns 403 with a clear message when slots are exhausted.
    """
    raw_username = (body.username or "").strip()
    # Admin path (also case-insensitive on the username)
    if raw_username.lower() == ADMIN_USERNAME.lower() and body.password == ADMIN_PASSWORD:
        token = create_jwt({"sub": "admin", "role": "admin"}, expires_hours=24 * 7)
        return {"token": token, "role": "admin", "username": ADMIN_USERNAME}

    # User path — case-insensitive exact match
    import re as _re
    user = await db.users.find_one({
        "username": {"$regex": f"^{_re.escape(raw_username)}$", "$options": "i"}
    })
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Incorrect username or password. Please try again.")
    if user.get("status") != "active":
        raise HTTPException(403, "This account has been disabled. Contact the admin.")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Incorrect username or password. Please try again.")

    # --- Subscription expiry check ---
    sub = _subscription_view(user)
    if sub["status"] == "expired":
        raise HTTPException(403, "Your subscription has expired. Contact the admin to renew.")

    # --- Device slot management (auto-register on first login) ---
    devices = list(user.get("devices") or [])
    max_devices = int(user.get("max_devices", 3))
    dev_id = (body.device_id or "").strip()
    now = now_iso()
    if dev_id:
        existing = next((d for d in devices if d.get("id") == dev_id), None)
        if existing:
            existing["last_seen"] = now
            if body.device_model:
                existing["model"] = body.device_model
            if body.device_name:
                existing["name"] = body.device_name
        else:
            if len(devices) >= max_devices:
                raise HTTPException(
                    403,
                    f"Device limit reached ({max_devices}). Ask the admin to remove an old device first.",
                )
            devices.append({
                "id": dev_id,
                "model": body.device_model or "Unknown",
                "name": body.device_name or "Device",
                "primary": len(devices) == 0,  # first device becomes primary
                "registered_at": now,
                "last_seen": now,
            })

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": now, "devices": devices}},
    )
    token = create_jwt({"sub": user["id"], "role": "user", "username": user["username"]})
    return {
        "token": token,
        "role": "user",
        "username": user["username"],
        "display_name": user.get("display_name") or user["username"],
        "avatar": user.get("avatar"),
        "subscription": sub,
        "account_number": user.get("account_number"),
    }


# Quick endpoint for the mobile app to check its subscription state
@api.get("/me/subscription")
async def me_subscription(current: dict = Depends(get_current_user)):
    return {
        "account_number": current.get("account_number"),
        "subscription": _subscription_view(current),
        "max_devices": current.get("max_devices", 3),
        "devices_count": len(current.get("devices") or []),
    }


# Backwards-compat alias (web admin panel uses /admin/login)
@api.post("/admin/login")
async def admin_login_compat(body: LoginBody):
    if body.username != ADMIN_USERNAME or body.password != ADMIN_PASSWORD:
        raise HTTPException(401, "Invalid admin credentials")
    token = create_jwt({"sub": "admin", "role": "admin"}, expires_hours=24 * 7)
    return {"token": token, "username": ADMIN_USERNAME, "role": "admin"}


# ============================================================
# IPTV / Xtream Codes integration
# ============================================================
class IptvConnectBody(BaseModel):
    url: str            # e.g. http://line.2tvusa.xyz
    username: str
    password: str


async def _iptv_get(action: Optional[str] = None, params: Optional[dict] = None) -> Any:
    """Call the configured Xtream Codes provider. Returns parsed JSON.
    Raises HTTPException if no provider is configured."""
    cfg = await db.settings.find_one({"id": "iptv_config"})
    if not cfg or not cfg.get("password_enc"):
        raise HTTPException(404, "No IPTV provider configured. Add one in Admin → IPTV.")
    base = cfg["url"].rstrip("/")
    qp = {"username": cfg["username"], "password": decrypt_token(cfg["password_enc"])}
    if action:
        qp["action"] = action
    if params:
        qp.update(params)
    async with httpx.AsyncClient(timeout=20.0) as c:
        r = await c.get(f"{base}/player_api.php", params=qp)
        r.raise_for_status()
        return r.json()


def _iptv_stream_url(cfg: dict, kind: str, stream_id: int, ext: str = "ts") -> str:
    """Build the direct stream URL. For live we use /live/<u>/<p>/<id>.ts (most
    compatible); for VOD/series we use the container extension provided by the
    API (e.g. mp4, mkv)."""
    base = cfg["url"].rstrip("/")
    pw = decrypt_token(cfg["password_enc"])
    if kind == "live":
        return f"{base}/live/{cfg['username']}/{pw}/{stream_id}.{ext}"
    if kind == "movie":
        return f"{base}/movie/{cfg['username']}/{pw}/{stream_id}.{ext}"
    if kind == "series":
        return f"{base}/series/{cfg['username']}/{pw}/{stream_id}.{ext}"
    raise HTTPException(400, "Invalid stream kind")


@api.post("/admin/iptv/connect")
async def admin_iptv_connect(body: IptvConnectBody, admin: dict = Depends(get_current_admin)):
    """Validate Xtream credentials and persist them (password encrypted)."""
    url = (body.url or "").strip().rstrip("/")
    if not url.startswith("http"):
        url = "http://" + url
    user = (body.username or "").strip()
    pw = (body.password or "").strip()
    if not (url and user and pw):
        raise HTTPException(400, "url, username, password required")
    # Probe the provider
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(f"{url}/player_api.php", params={"username": user, "password": pw})
            r.raise_for_status()
            d = r.json()
    except Exception as e:
        raise HTTPException(502, f"Could not reach IPTV provider: {e}")
    ui = (d or {}).get("user_info") or {}
    if str(ui.get("auth", 1)) == "0" or ui.get("status") not in {"Active", "active"}:
        raise HTTPException(401, f"IPTV provider rejected credentials (status={ui.get('status')!r})")
    await db.settings.update_one(
        {"id": "iptv_config"},
        {"$set": {
            "id": "iptv_config",
            "url": url,
            "username": user,
            "password_enc": encrypt_token(pw),
            "user_info": ui,
            "server_info": (d or {}).get("server_info") or {},
            "connected_at": now_iso(),
        }},
        upsert=True,
    )
    return {"ok": True, "status": ui.get("status"), "exp_date": ui.get("exp_date"),
            "max_connections": ui.get("max_connections"), "active_cons": ui.get("active_cons")}


@api.get("/admin/iptv/status")
async def admin_iptv_status(admin: dict = Depends(get_current_admin)):
    cfg = await db.settings.find_one({"id": "iptv_config"})
    if not cfg:
        return {"configured": False}
    return {
        "configured": True,
        "url": cfg.get("url"),
        "username": cfg.get("username"),
        "user_info": cfg.get("user_info") or {},
        "server_info": cfg.get("server_info") or {},
        "connected_at": cfg.get("connected_at"),
    }


@api.delete("/admin/iptv")
async def admin_iptv_delete(admin: dict = Depends(get_current_admin)):
    await db.settings.delete_one({"id": "iptv_config"})
    return {"ok": True}


@api.get("/iptv/live/categories")
async def iptv_live_categories(_: dict = Depends(get_current_user)):
    return await _iptv_get("get_live_categories")


@api.get("/iptv/live/streams")
async def iptv_live_streams(category_id: Optional[str] = None, _: dict = Depends(get_current_user)):
    params = {"category_id": category_id} if category_id else None
    raw = await _iptv_get("get_live_streams", params)
    cfg = await db.settings.find_one({"id": "iptv_config"})
    out = []
    for s in (raw or []):
        out.append({
            "rating_key": f"iptv-live-{s.get('stream_id')}",
            "stream_id": s.get("stream_id"),
            "title": s.get("name"),
            "type": "live",
            "thumb": s.get("stream_icon") or None,
            "category_id": s.get("category_id"),
            "epg_channel_id": s.get("epg_channel_id"),
            "number": s.get("num"),
            "source": "iptv",
            "stream_url": _iptv_stream_url(cfg, "live", s.get("stream_id")),
        })
    return {"items": out, "total": len(out)}


@api.get("/iptv/vod/streams")
async def iptv_vod_streams(category_id: Optional[str] = None, _: dict = Depends(get_current_user)):
    params = {"category_id": category_id} if category_id else None
    raw = await _iptv_get("get_vod_streams", params)
    cfg = await db.settings.find_one({"id": "iptv_config"})
    out = []
    for s in (raw or [])[:500]:  # cap for first page
        ext = s.get("container_extension") or "mp4"
        out.append({
            "rating_key": f"iptv-movie-{s.get('stream_id')}",
            "stream_id": s.get("stream_id"),
            "title": s.get("name"),
            "type": "movie",
            "thumb": s.get("stream_icon") or None,
            "year": s.get("year"),
            "rating": s.get("rating"),
            "category_id": s.get("category_id"),
            "source": "iptv",
            "stream_url": _iptv_stream_url(cfg, "movie", s.get("stream_id"), ext),
        })
    return {"items": out, "total": len(out)}


@api.get("/iptv/logo")
async def iptv_logo(u: str):
    """Fetch and re-serve an IPTV channel logo. Needed because upstream logos
    are almost always http:// which browsers refuse to embed in an https page.
    Public (no auth) since these are just cosmetic art. Cached aggressively.

    NOTE: This is intentionally a permissive image proxy — Xtream lines
    frequently serve channel picons from a wholly separate CDN (often bare
    IPs), so we can't safely restrict to the configured line's hostname.
    Content is passed through untouched; we never relay auth/cookies to the
    upstream, so at worst this is a bandwidth-consuming HTTP GET proxy."""
    parsed = urlparse(u)
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(400, "bad url")
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as c:
            r = await c.get(u, headers={"User-Agent": IPTV_UA})
            r.raise_for_status()
    except Exception:
        raise HTTPException(404, "logo unreachable")
    return Response(
        r.content,
        media_type=r.headers.get("content-type") or "image/png",
        headers={"Cache-Control": "public, max-age=86400, immutable"},
    )


# ----- Stream proxy --------------------------------------------------------
# We proxy IPTV bytes through our backend for three reasons:
#  1. Browsers refuse to embed http:// streams inside an https:// page
#     (mixed-content). Our backend is https, so the <video> tag sees an https
#     origin and is happy.
#  2. Subscriber credentials never leave the server.
#  3. The IPTV server's CORS headers (often missing) become irrelevant.
#
# We accept the user's JWT either as `Authorization: Bearer` (regular API
# calls) or as `?t=` query param (for <video> element src URLs).

IPTV_UA = "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 QuantumTV/1.0"


async def _stream_upstream(upstream: str, request: Request) -> StreamingResponse:
    """Open a streaming GET to `upstream` and pipe bytes back to the client.
    Forwards Range so the player can seek (VOD). Lifecycle of the upstream
    httpx client/response is tied to the StreamingResponse via aclose()."""
    headers = {"User-Agent": IPTV_UA}
    if "range" in request.headers:
        headers["Range"] = request.headers["range"]

    client = httpx.AsyncClient(timeout=None)
    try:
        req = client.build_request("GET", upstream, headers=headers)
        upstream_resp = await client.send(req, stream=True, follow_redirects=True)
    except Exception as e:
        await client.aclose()
        raise HTTPException(502, f"IPTV upstream error: {e}")

    async def body_iter():
        try:
            async for chunk in upstream_resp.aiter_raw():
                yield chunk
        finally:
            await upstream_resp.aclose()
            await client.aclose()

    forward = {}
    for k in ("content-length", "content-range", "accept-ranges"):
        v = upstream_resp.headers.get(k)
        if v:
            forward[k] = v
    media_type = upstream_resp.headers.get("content-type") or "video/MP2T"
    return StreamingResponse(
        body_iter(),
        status_code=upstream_resp.status_code,
        headers=forward,
        media_type=media_type,
    )


def _rewrite_m3u8(text: str, upstream_url: str, token: str) -> str:
    """Rewrite segment URLs inside an HLS manifest so the browser pulls them
    back through our proxy (preserving HTTPS + auth). We wrap each upstream
    URL in a Fernet ciphertext so the pass-through endpoint doesn't need a
    host allow-list (upstream may 302 to a different CDN host)."""
    out: list[str] = []
    for line in text.splitlines():
        if not line or line.startswith("#"):
            out.append(line)
            continue
        # Segment / sub-playlist URI
        abs_url = line if line.startswith(("http://", "https://")) else urljoin(upstream_url, line)
        k = fernet.encrypt(abs_url.encode()).decode()
        out.append(f"/api/iptv/pass?k={quote(k)}&t={quote(token)}")
    return "\n".join(out)


@api.get("/iptv/p/{kind}/{stream_id}.{ext}")
async def iptv_proxy(
    kind: str,
    stream_id: int,
    ext: str,
    request: Request,
    t: Optional[str] = None,
    _: dict = Depends(get_user_flex),
):
    """Primary stream proxy. `kind` is live|movie|series. For .m3u8 we fetch
    the manifest and rewrite segment URLs; everything else streams bytes."""
    if kind not in {"live", "movie", "series"}:
        raise HTTPException(400, "bad kind")
    if ext.lower() not in {"m3u8", "ts", "mp4", "mkv"}:
        raise HTTPException(400, "bad ext")
    cfg = await db.settings.find_one({"id": "iptv_config"})
    if not cfg or not cfg.get("password_enc"):
        raise HTTPException(404, "IPTV not configured")
    pw = decrypt_token(cfg["password_enc"])
    base = cfg["url"].rstrip("/")
    upstream = f"{base}/{kind}/{cfg['username']}/{pw}/{stream_id}.{ext}"

    if ext.lower() == "m3u8":
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as c:
                r = await c.get(upstream, headers={"User-Agent": IPTV_UA})
                r.raise_for_status()
                # Use the FINAL URL (after any 302 redirects) as the base for
                # resolving relative segment paths — Xtream lines commonly
                # redirect from lb → edge, and the segments live on the edge.
                final_url = str(r.url)
                text = r.text
        except Exception as e:
            raise HTTPException(502, f"IPTV manifest error: {e}")
        return Response(
            _rewrite_m3u8(text, final_url, t or ""),
            media_type="application/vnd.apple.mpegurl",
        )
    return await _stream_upstream(upstream, request)


@api.get("/iptv/pass")
async def iptv_passthrough(
    k: str,
    request: Request,
    t: Optional[str] = None,
    _: dict = Depends(get_user_flex),
):
    """Generic byte-passthrough for media segments / sub-manifests referenced
    inside an HLS manifest. `k` is a Fernet-encrypted upstream URL — this
    makes it impossible for a client to point us at an arbitrary host."""
    try:
        upstream_url = fernet.decrypt(k.encode()).decode()
    except Exception:
        raise HTTPException(400, "bad segment token")
    # Sub-manifest: rewrite child segment URLs so they keep flowing through us.
    path_lower = urlparse(upstream_url).path.lower()
    if path_lower.endswith(".m3u8"):
        try:
            async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as c:
                r = await c.get(upstream_url, headers={"User-Agent": IPTV_UA})
                r.raise_for_status()
                return Response(
                    _rewrite_m3u8(r.text, str(r.url), t or ""),
                    media_type="application/vnd.apple.mpegurl",
                )
        except Exception as e:
            raise HTTPException(502, f"IPTV sub-manifest error: {e}")
    return await _stream_upstream(upstream_url, request)


# ============================================================
# Device pairing (Fire TV "type a code on your phone" flow)
# ============================================================
PAIR_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # no I/O/0/1
PAIR_CODE_LEN = 6
PAIR_EXPIRY_SEC = 600  # 10 minutes


def _gen_pair_code() -> str:
    return "".join(_random.choices(PAIR_CODE_CHARS, k=PAIR_CODE_LEN))


class PairStartBody(BaseModel):
    device_id: Optional[str] = None
    device_model: Optional[str] = None
    device_name: Optional[str] = None


@api.post("/auth/pair/start")
async def auth_pair_start(body: PairStartBody):
    """Fire TV calls this. Returns a short user_code to display on TV +
    a long device_code that the TV polls with. The user types user_code on
    their phone at /activate while signed in; that links this record."""
    device_code = uuid.uuid4().hex + uuid.uuid4().hex  # 64 chars
    # Generate a code that doesn't collide with any live pending record.
    for _ in range(8):
        code = _gen_pair_code()
        existing = await db.pair_codes.find_one({"user_code": code, "user_id": None})
        if not existing:
            break
    expires_at = (datetime.now(timezone.utc) + timedelta(seconds=PAIR_EXPIRY_SEC)).isoformat()
    await db.pair_codes.insert_one({
        "user_code": code,
        "device_code": device_code,
        "user_id": None,
        "created_at": now_iso(),
        "expires_at": expires_at,
        "device_id": (body.device_id or "").strip() or None,
        "device_model": body.device_model or "Unknown",
        "device_name": body.device_name or "Device",
    })
    return {
        "user_code": code,
        "device_code": device_code,
        "expires_in": PAIR_EXPIRY_SEC,
        "interval": 5,
        "activate_url": "https://quantumtv.app/activate",
    }


class PairVerifyBody(BaseModel):
    user_code: str


@api.post("/auth/pair/verify")
async def auth_pair_verify(body: PairVerifyBody, current: dict = Depends(get_current_user)):
    """The signed-in phone/web user enters the user_code shown on the TV.
    We attach this user to the pending pair record."""
    code = (body.user_code or "").strip().upper()
    if not code:
        raise HTTPException(400, "Code required")
    rec = await db.pair_codes.find_one({"user_code": code, "user_id": None})
    if not rec:
        raise HTTPException(404, "Invalid or already-used code. Generate a fresh one on the Fire Stick.")
    # Check expiry
    try:
        exp_dt = datetime.fromisoformat(rec["expires_at"].replace("Z", "+00:00"))
        if exp_dt < datetime.now(timezone.utc):
            raise HTTPException(410, "Code has expired. Generate a fresh one on the Fire Stick.")
    except HTTPException:
        raise
    except Exception:
        pass
    # Check subscription is OK for the verifying user
    sub = _subscription_view(current)
    if sub["status"] == "expired":
        raise HTTPException(403, "Your subscription has expired. Contact the admin to renew.")
    # Attach
    await db.pair_codes.update_one(
        {"_id": rec["_id"]},
        {"$set": {"user_id": current["id"], "verified_at": now_iso()}},
    )
    return {"ok": True, "username": current.get("username")}


class PairPollBody(BaseModel):
    device_code: str


@api.post("/auth/pair/poll")
async def auth_pair_poll(body: PairPollBody):
    """Fire TV polls this every ~5s with its device_code. Returns either
    pending, expired, or {token, user info} once the phone has linked it."""
    rec = await db.pair_codes.find_one({"device_code": body.device_code})
    if not rec:
        raise HTTPException(404, "Unknown device code. Restart the activation on Fire Stick.")
    # Expired?
    try:
        exp_dt = datetime.fromisoformat(rec["expires_at"].replace("Z", "+00:00"))
        if exp_dt < datetime.now(timezone.utc) and not rec.get("user_id"):
            return {"status": "expired"}
    except Exception:
        pass
    if not rec.get("user_id"):
        return {"status": "pending"}
    # Done — load the user, run the same device-registration flow as /auth/login
    user = await db.users.find_one({"id": rec["user_id"]})
    if not user or user.get("status") != "active":
        return {"status": "expired"}
    sub = _subscription_view(user)
    if sub["status"] == "expired":
        await db.pair_codes.delete_one({"_id": rec["_id"]})
        raise HTTPException(403, "Your subscription has expired. Contact the admin to renew.")

    # Auto-register the device into a slot (same as normal /auth/login)
    devices = list(user.get("devices") or [])
    max_devices = int(user.get("max_devices", 3))
    dev_id = (rec.get("device_id") or "").strip()
    now = now_iso()
    if dev_id:
        existing = next((d for d in devices if d.get("id") == dev_id), None)
        if existing:
            existing["last_seen"] = now
            if rec.get("device_model"):
                existing["model"] = rec["device_model"]
            if rec.get("device_name"):
                existing["name"] = rec["device_name"]
        else:
            if len(devices) >= max_devices:
                await db.pair_codes.delete_one({"_id": rec["_id"]})
                raise HTTPException(
                    403,
                    f"Device limit reached ({max_devices}). Ask the admin to remove an old device first.",
                )
            devices.append({
                "id": dev_id,
                "model": rec.get("device_model") or "Unknown",
                "name": rec.get("device_name") or "Device",
                "primary": len(devices) == 0,
                "registered_at": now,
                "last_seen": now,
            })

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"last_login": now, "devices": devices}},
    )
    await db.pair_codes.delete_one({"_id": rec["_id"]})  # one-shot
    token = create_jwt({"sub": user["id"], "role": "user", "username": user["username"]})
    return {
        "status": "verified",
        "token": token,
        "role": "user",
        "username": user["username"],
        "display_name": user.get("display_name") or user["username"],
        "avatar": user.get("avatar"),
        "subscription": sub,
        "account_number": user.get("account_number"),
    }


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
    """Return the best publicly reachable Plex connection URI.

    Priority for a CLOUD backend like ours:
      1. Public (non-local, non-relay) — fastest, direct.
      2. Relay (plex.tv relay) — works when port-forwarding isn't set up.
      3. Local (192.168.x / 172.x / 10.x) — only useful when we're literally
         on the same LAN as the Plex server (we're not), and is the WRONG
         pick for shared/non-owned servers.
    """
    conns = resource.get("connections") or []
    publics = [c for c in conns if not c.get("local") and not c.get("relay")]
    relays = [c for c in conns if c.get("relay")]
    locals_ = [c for c in conns if c.get("local")]
    for group in (publics, relays, locals_):
        for c in group:
            uri = c.get("uri")
            if uri:
                return uri
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
        owned = [r for r in resources if "server" in (r.get("provides") or "") and r.get("owned")]
        any_ = [r for r in resources if "server" in (r.get("provides") or "")]
        chosen = (owned or any_ or [None])[0]
    if not chosen:
        raise HTTPException(404, "No Plex servers on linked account")
    # Try every connection in priority order (public, relay, local), falling
    # back to the next if one times out. This is what fixes shared/non-owned
    # servers whose "local" address is the owner's LAN.
    conns = chosen.get("connections") or []
    publics = [c for c in conns if not c.get("local") and not c.get("relay") and c.get("uri")]
    relays = [c for c in conns if c.get("relay") and c.get("uri")]
    locals_ = [c for c in conns if c.get("local") and c.get("uri")]
    ordered = publics + relays + locals_
    if not ordered:
        raise HTTPException(503, "Plex server has no reachable connection")
    token = chosen.get("accessToken") or decrypt_token(s["plex_token_enc"])

    # Probe each URI quickly to find one that actually responds. Cache the
    # winner in the system doc so subsequent requests are instant.
    cache_key = f"reachable_uri_{chosen.get('clientIdentifier')}"
    cached = s.get(cache_key)
    if cached:
        return cached, token

    async with httpx.AsyncClient(timeout=5.0, verify=False) as c:
        for conn in ordered:
            uri = conn["uri"]
            try:
                r = await c.get(f"{uri}/identity", headers=plex_headers(token=token))
                if r.status_code < 500:
                    await db.system.update_one({"id": "plex"}, {"$set": {cache_key: uri}})
                    return uri, token
            except Exception:
                continue
    raise HTTPException(503, "Could not reach Plex server on any connection (check Plex Remote Access)")


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
    # Clear cached reachable URI when switching servers
    await db.system.update_one(
        {"id": "plex"},
        {"$set": {"selected_server": {
            "client_identifier": chosen["client_identifier"],
            "name": chosen["name"],
            "uri": chosen["uri"],
        }}, "$unset": {f"reachable_uri_{chosen['client_identifier']}": ""}},
    )
    return {"ok": True}


# ============================================================
# Admin: user management with password
# ============================================================
import random as _random
import string as _string


def _generate_account_number() -> str:
    """KS-XXX-XXX (matches the Setplex/Nora-style account numbers)."""
    p1 = "".join(_random.choices(_string.digits, k=3))
    p2 = "".join(_random.choices(_string.digits, k=3))
    return f"KS-{p1}-{p2}"


def _add_months(iso_dt: str, months: int) -> str:
    """Add N calendar months to an ISO datetime, returning ISO."""
    from dateutil.relativedelta import relativedelta
    dt = datetime.fromisoformat(iso_dt.replace("Z", "+00:00"))
    return (dt + relativedelta(months=months)).isoformat()


def _subscription_view(user: dict) -> dict:
    """Compute live subscription view (status, days_left) from stored fields."""
    now = datetime.now(timezone.utc)
    expires = user.get("expires_at")
    if not expires:
        return {"status": "inactive", "days_left": 0, "expires_at": None}
    try:
        exp_dt = datetime.fromisoformat(expires.replace("Z", "+00:00"))
    except Exception:
        return {"status": "inactive", "days_left": 0, "expires_at": expires}
    delta = exp_dt - now
    days_left = int(delta.total_seconds() // 86400) + (1 if delta.total_seconds() % 86400 > 0 else 0)
    if delta.total_seconds() <= 0:
        status = "expired"
    elif days_left <= 7:
        status = "expiring"
    else:
        status = "active"
    return {"status": status, "days_left": max(0, days_left), "expires_at": expires}


class CreateUserBody(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None
    status: Optional[str] = "active"
    subscription_months: Optional[int] = 1   # 1..12
    max_devices: Optional[int] = 3           # number of simultaneous devices


@api.post("/admin/users")
async def admin_create_user(body: CreateUserBody, admin: dict = Depends(get_current_admin)):
    if not body.username or not body.password:
        raise HTTPException(400, "username and password required")
    import re as _re
    username = body.username.strip()
    if not username:
        raise HTTPException(400, "username and password required")
    existing = await db.users.find_one({
        "username": {"$regex": f"^{_re.escape(username)}$", "$options": "i"}
    })
    if existing:
        raise HTTPException(409, "Username already exists")
    sub_months = max(1, min(12, int(body.subscription_months or 1)))
    max_devices = max(1, min(20, int(body.max_devices or 3)))
    user_id = str(uuid.uuid4())
    account_number = _generate_account_number()
    now = now_iso()
    expires_at = _add_months(now, sub_months)
    await db.users.insert_one({
        "id": user_id,
        "account_number": account_number,
        "username": username,
        "password_hash": hash_password(body.password),
        "display_name": body.display_name or username,
        "status": body.status if body.status in {"active", "disabled"} else "active",
        # Subscription
        "subscription_months": sub_months,
        "activated_at": now,
        "expires_at": expires_at,
        # Devices
        "max_devices": max_devices,
        "devices": [],            # list of {id, model, name, primary, registered_at, last_seen}
        # Misc
        "notes": [],              # list of {id, text, created_at, author}
        "watchlist": [],
        "favorites": [],
        "created_at": now,
        "updated_at": now,
        "last_login": None,
    })
    return {
        "id": user_id,
        "account_number": account_number,
        "username": username,
        "status": body.status,
        "subscription_months": sub_months,
        "expires_at": expires_at,
        "max_devices": max_devices,
    }


class UpdateUserBody(BaseModel):
    password: Optional[str] = None
    display_name: Optional[str] = None
    status: Optional[str] = None  # active | disabled
    # subscription
    extend_months: Optional[int] = None      # add N months to expires_at (1..12)
    set_subscription_months: Optional[int] = None  # set the "current plan" length
    set_expires_at: Optional[str] = None     # ISO datetime override
    max_devices: Optional[int] = None


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
    if body.set_subscription_months is not None:
        update["subscription_months"] = max(1, min(12, int(body.set_subscription_months)))
    if body.max_devices is not None:
        update["max_devices"] = max(1, min(20, int(body.max_devices)))
    if body.extend_months is not None:
        n = max(1, min(24, int(body.extend_months)))
        user = await db.users.find_one({"id": user_id})
        if not user:
            raise HTTPException(404, "User not found")
        # Extend from current expires_at if still in the future, else from now.
        base = user.get("expires_at") or now_iso()
        try:
            base_dt = datetime.fromisoformat(base.replace("Z", "+00:00"))
            if base_dt < datetime.now(timezone.utc):
                base = now_iso()
        except Exception:
            base = now_iso()
        update["expires_at"] = _add_months(base, n)
    if body.set_expires_at is not None:
        update["expires_at"] = body.set_expires_at
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
            {"account_number": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.users.find(query).sort("created_at", -1).limit(500)
    out = []
    async for u in cursor:
        sub = _subscription_view(u)
        devices = u.get("devices") or []
        out.append({
            "id": u.get("id"),
            "account_number": u.get("account_number"),
            "username": u.get("username"),
            "display_name": u.get("display_name") or u.get("username"),
            "status": u.get("status", "active"),
            "subscription_months": u.get("subscription_months"),
            "activated_at": u.get("activated_at"),
            "expires_at": sub["expires_at"],
            "subscription_status": sub["status"],
            "days_left": sub["days_left"],
            "max_devices": u.get("max_devices", 3),
            "devices_count": len(devices),
            "created_at": u.get("created_at"),
            "last_login": u.get("last_login"),
            "watchlist_count": len(u.get("watchlist") or []),
            "favorites_count": len(u.get("favorites") or []),
            "notes_count": len(u.get("notes") or []),
        })
    return {"users": out}


@api.get("/admin/users/{user_id}")
async def admin_get_user(user_id: str, admin: dict = Depends(get_current_admin)):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(404, "User not found")
    sub = _subscription_view(u)
    return {
        "id": u.get("id"),
        "account_number": u.get("account_number"),
        "username": u.get("username"),
        "display_name": u.get("display_name") or u.get("username"),
        "status": u.get("status", "active"),
        "subscription_months": u.get("subscription_months"),
        "activated_at": u.get("activated_at"),
        "expires_at": sub["expires_at"],
        "subscription_status": sub["status"],
        "days_left": sub["days_left"],
        "max_devices": u.get("max_devices", 3),
        "devices": u.get("devices") or [],
        "notes": u.get("notes") or [],
        "created_at": u.get("created_at"),
        "last_login": u.get("last_login"),
    }


# ----- Devices -----
class DeviceUpdateBody(BaseModel):
    primary: Optional[bool] = None
    name: Optional[str] = None


@api.patch("/admin/users/{user_id}/devices/{device_id}")
async def admin_update_device(user_id: str, device_id: str, body: DeviceUpdateBody,
                              admin: dict = Depends(get_current_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    devices = user.get("devices") or []
    found = False
    if body.primary is True:
        # only one device can be primary
        for d in devices:
            d["primary"] = d.get("id") == device_id
            if d.get("id") == device_id:
                found = True
    else:
        for d in devices:
            if d.get("id") == device_id:
                found = True
                if body.name is not None:
                    d["name"] = body.name
                if body.primary is False:
                    d["primary"] = False
    if not found:
        raise HTTPException(404, "Device not found")
    await db.users.update_one({"id": user_id}, {"$set": {"devices": devices, "updated_at": now_iso()}})
    return {"ok": True}


@api.delete("/admin/users/{user_id}/devices/{device_id}")
async def admin_delete_device(user_id: str, device_id: str, admin: dict = Depends(get_current_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    devices = [d for d in (user.get("devices") or []) if d.get("id") != device_id]
    await db.users.update_one({"id": user_id}, {"$set": {"devices": devices, "updated_at": now_iso()}})
    return {"ok": True, "remaining": len(devices)}


# ----- Notes -----
class CreateNoteBody(BaseModel):
    text: str


@api.post("/admin/users/{user_id}/notes")
async def admin_add_note(user_id: str, body: CreateNoteBody, admin: dict = Depends(get_current_admin)):
    if not (body.text or "").strip():
        raise HTTPException(400, "Note text required")
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    note = {"id": str(uuid.uuid4()), "text": body.text.strip(),
            "created_at": now_iso(), "author": "admin"}
    notes = (user.get("notes") or []) + [note]
    await db.users.update_one({"id": user_id}, {"$set": {"notes": notes, "updated_at": now_iso()}})
    return note


@api.delete("/admin/users/{user_id}/notes/{note_id}")
async def admin_delete_note(user_id: str, note_id: str, admin: dict = Depends(get_current_admin)):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(404, "User not found")
    notes = [n for n in (user.get("notes") or []) if n.get("id") != note_id]
    await db.users.update_one({"id": user_id}, {"$set": {"notes": notes, "updated_at": now_iso()}})
    return {"ok": True}


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
    """List every Plex server the admin's account can reach, mark which one is
    selected as Active (the one all users stream from), and attach the active
    user list to it."""
    plex = await db.system.find_one({"id": "plex"})
    if not plex:
        return {"servers": []}
    try:
        s, resources = await _sys_resources()
    except HTTPException:
        return {"servers": []}
    active_cid = (s.get("selected_server") or {}).get("client_identifier")
    # All active users follow the active server
    active_user_names: list[str] = []
    async for u in db.users.find({"status": "active"}, {"username": 1, "display_name": 1}):
        active_user_names.append(u.get("display_name") or u.get("username"))
    out = []
    for r in resources:
        if "server" not in (r.get("provides") or ""):
            continue
        is_active = r.get("clientIdentifier") == active_cid
        out.append({
            "name": r.get("name"),
            "client_identifier": r.get("clientIdentifier"),
            "uri": _pick_best_connection(r),
            "owned": r.get("owned"),
            "active": is_active,
            "users": active_user_names if is_active else [],
            "user_count": len(active_user_names) if is_active else 0,
        })
    # Sort active first
    out.sort(key=lambda x: (not x["active"], x["name"] or ""))
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
        "grandparent_thumb": _proxy_image(uri, token, m.get("grandparentThumb")) if m.get("grandparentThumb") else None,
        "parent_thumb": _proxy_image(uri, token, m.get("parentThumb")) if m.get("parentThumb") else None,
        "index": m.get("index"),                  # season # for season, episode # for episode
        "parent_index": m.get("parentIndex"),     # season # for an episode
        "parent_rating_key": m.get("parentRatingKey"),
        "grandparent_rating_key": m.get("grandparentRatingKey"),
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
    # IPTV stub: front-end queries metadata for every playable item; we
    # synthesise just enough so the player UI shows a title instead of "—".
    if str(rating_key).startswith("iptv-"):
        try:
            _, kind, sid = rating_key.split("-", 2)
            sid_int = int(sid)
        except (ValueError, TypeError):
            raise HTTPException(404, "Not found")
        try:
            action = "get_live_streams" if kind == "live" else "get_vod_streams"
            raw = await _iptv_get(action)
            hit = next((s for s in (raw or []) if int(s.get("stream_id", -1)) == sid_int), None)
        except Exception:
            hit = None
        title = (hit or {}).get("name") or ("Live Channel" if kind == "live" else "Movie")
        thumb_raw = (hit or {}).get("stream_icon")
        thumb = f"/api/iptv/logo?u={quote(thumb_raw, safe='')}" if thumb_raw else None
        return {
            "rating_key": rating_key,
            "title": title,
            "type": "live" if kind == "live" else "movie",
            "thumb": thumb,
            "art": None,
            "year": (hit or {}).get("year"),
            "summary": None,
            "audience_rating": (hit or {}).get("rating"),
            "in_watchlist": str(rating_key) in [str(x) for x in (user.get("watchlist") or [])],
            "in_favorites": str(rating_key) in [str(x) for x in (user.get("favorites") or [])],
        }

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


@api.get("/browse/rows")
async def browse_rows(user: dict = Depends(get_current_user), per_row: int = 20, max_sections: int = 5):
    """Compose the mobile app's Netflix-style home screen in ONE request:
       - Continue Watching   (Plex on-deck)
       - Recently Added      (all libraries, cross-section)
       - Top Live Channels   (Plex + IPTV mix, top 20)
       - Up to `max_sections` Plex library sections, sorted by size (biggest
         libraries first). Each capped at `per_row`.

       All library fetches run in parallel via asyncio.gather so the total
       latency is roughly the slowest single call (≈2 s), not the sum
       (which was ≈30 s and hit Cloudflare's 60 s ceiling)."""
    import asyncio

    rows: list[dict] = []

    # --- Plex-backed rows -------------------------------------------------
    uri: Optional[str] = None
    token: Optional[str] = None
    try:
        uri, token = await _server_ctx()
    except Exception as e:
        log.info("Browse rows: Plex not connected (%s) — skipping Plex sections", e)

    async def _plex_metadata(path: str, params: Optional[dict] = None) -> list[dict]:
        if not (uri and token):
            return []
        try:
            data = await plex_get(f"{uri}{path}", token=token, params=params or {})
            return data.get("MediaContainer", {}).get("Metadata", []) or []
        except Exception as e:
            log.info("Plex fetch failed %s: %s", path, e)
            return []

    async def _plex_directories(path: str) -> list[dict]:
        if not (uri and token):
            return []
        try:
            data = await plex_get(f"{uri}{path}", token=token)
            return data.get("MediaContainer", {}).get("Directory", []) or []
        except Exception as e:
            log.info("Plex directories fetch failed %s: %s", path, e)
            return []

    plex_page = {"X-Plex-Container-Start": 0, "X-Plex-Container-Size": per_row}

    on_deck_task = _plex_metadata("/library/onDeck", plex_page) if uri and token else None
    recent_task = _plex_metadata("/library/recentlyAdded", plex_page) if uri and token else None
    sections_task = _plex_directories("/library/sections") if uri and token else None
    live_task = live_channels(user)

    on_deck, recent, sec_dirs, live_resp = await asyncio.gather(
        on_deck_task or asyncio.sleep(0, result=[]),
        recent_task or asyncio.sleep(0, result=[]),
        sections_task or asyncio.sleep(0, result=[]),
        live_task,
        return_exceptions=False,
    )

    if on_deck:
        rows.append({
            "id": "continue",
            "title": "Continue Watching",
            "kind": "poster",
            "items": [_normalize_item(uri, token, i) for i in on_deck[:per_row]],
        })
    if recent:
        rows.append({
            "id": "recent",
            "title": "Recently Added",
            "kind": "poster",
            "items": [_normalize_item(uri, token, i) for i in recent[:per_row]],
        })

    # --- Top Live channels (Plex + IPTV) ---------------------------------
    try:
        chs = (live_resp or {}).get("channels", []) or []
        # Prefer channels with logos for a prettier row
        chs.sort(key=lambda c: (0 if c.get("logo") else 1, str(c.get("title") or "")))
        top_live = chs[:per_row]
        if top_live:
            rows.append({
                "id": "live",
                "title": "Top Live Channels",
                "kind": "live",
                "items": [
                    {
                        "rating_key": c["key"],
                        "title": c.get("title"),
                        "thumb": c.get("logo"),
                        "type": "live",
                        "number": c.get("number"),
                        "source": c.get("source"),
                    }
                    for c in top_live
                ],
            })
    except Exception as e:
        log.info("Live row failed: %s", e)

    # --- One row per Plex library section (parallel, capped) -------------
    if uri and token and sec_dirs:
        libs = [d for d in sec_dirs if d.get("type") in {"movie", "show"}]
        # Order so movies come before shows (matches Netflix's typical layout)
        libs.sort(key=lambda d: (0 if d.get("type") == "movie" else 1, str(d.get("title") or "")))
        libs = libs[:max_sections]

        section_results = await asyncio.gather(*[
            _plex_metadata(
                f"/library/sections/{d.get('key')}/all",
                {"X-Plex-Container-Start": 0, "X-Plex-Container-Size": per_row, "sort": "addedAt:desc"},
            )
            for d in libs
        ])
        for d, items in zip(libs, section_results):
            if not items:
                continue
            rows.append({
                "id": f"section-{d.get('key')}",
                "title": d.get("title") or "Library",
                "kind": "poster",
                "items": [_normalize_item(uri, token, i) for i in items[:per_row]],
            })

    return {"rows": rows}


@api.get("/search")
async def search(q: str, user: dict = Depends(get_current_user), limit: int = 30):
    uri, token = await _server_ctx()
    data = await plex_get(f"{uri}/search", token=token, params={"query": q, "limit": limit})
    items = data.get("MediaContainer", {}).get("Metadata", []) or []
    return {"items": [_normalize_item(uri, token, i) for i in items]}


@api.get("/livetv/channels")
async def live_channels(user: dict = Depends(get_current_user)):
    uri, token = None, None
    try:
        uri, token = await _server_ctx()
    except Exception as e:
        log.info("Plex not connected for live: %s", e)
    out: list[dict] = []
    if uri and token:
        try:
            dvrs = await plex_get(f"{uri}/livetv/dvrs", token=token)
            for d in dvrs.get("MediaContainer", {}).get("Dvr", []) or []:
                for ch in d.get("ChannelMapping", []) or []:
                    out.append({
                        "title": ch.get("channelTitle") or ch.get("name"),
                        "number": ch.get("channelNumber"),
                        "logo": ch.get("channelThumb"),
                        "key": ch.get("channelKey"),
                        "source": "plex",
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
                            "source": "plex",
                        })
        except Exception as e:
            log.info("Live section fetch failed: %s", e)

    # Merge IPTV live channels (if configured). Keyed as iptv-live-<id> so the
    # /stream/{rk} endpoint can route playback through the proxy.
    cfg = await db.settings.find_one({"id": "iptv_config"})
    if cfg and cfg.get("password_enc"):
        try:
            raw = await _iptv_get("get_live_streams")
            for s in raw or []:
                sid = s.get("stream_id")
                if not sid:
                    continue
                logo_raw = s.get("stream_icon") or None
                # Route http logos through our logo proxy so browsers on
                # https pages actually render them.
                logo = f"/api/iptv/logo?u={quote(logo_raw, safe='')}" if logo_raw else None
                out.append({
                    "title": s.get("name"),
                    "number": s.get("num"),
                    "logo": logo,
                    "key": f"iptv-live-{sid}",
                    "source": "iptv",
                })
        except Exception as e:
            log.warning("IPTV live channels merge failed: %s", e)

    return {"channels": out}


@api.get("/stream/{rating_key}")
async def stream_url(rating_key: str, request: Request, user: dict = Depends(get_current_user),
                    direct: bool = True, max_bitrate: int = 8000):
    # IPTV stream resolution. Rating keys are minted as iptv-<kind>-<id> in
    # the live/vod endpoints above. We mint a short-lived stream token so
    # the <video> element (which can't send Authorization) can still
    # authenticate against the proxy via ?t=.
    if str(rating_key).startswith("iptv-"):
        try:
            _, kind, sid = rating_key.split("-", 2)
        except ValueError:
            raise HTTPException(400, "bad iptv key")
        if kind not in {"live", "movie", "series"}:
            raise HTTPException(400, "bad iptv kind")
        # Live → m3u8 for HLS.js / expo-video; VOD → mp4 direct
        ext = "m3u8" if kind == "live" else "mp4"
        stream_token = create_jwt(
            {"sub": user["id"], "role": "user", "username": user.get("username")},
            expires_hours=6,
        )
        # Build an absolute URL pointing at THIS backend so <video> tags on
        # https sites don't hit mixed-content rules.
        proto = request.headers.get("x-forwarded-proto") or request.url.scheme
        host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
        origin = f"{proto}://{host}"
        url = f"{origin}/api/iptv/p/{kind}/{sid}.{ext}?t={quote(stream_token)}"
        return {"url": url, "type": "hls" if kind == "live" else "direct"}

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
