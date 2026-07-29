"""Quantum TV — FastAPI backend.

Architecture:
  - Admin configures an Xtream Codes (IPTV) provider in the admin panel.
  - Admin creates user accounts (username + password + status). Users cannot self-register.
  - One login endpoint routes to admin or user based on credentials.
  - Users stream live channels and VOD from the IPTV provider.
"""
from __future__ import annotations

import os
import re
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
ADMIN_USERNAME = os.environ["ADMIN_USERNAME"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]

fernet = Fernet(FERNET_KEY)
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
mongo = AsyncIOMotorClient(MONGO_URL)
db = mongo[DB_NAME]


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
         "live_favorites": 1, "live_recent": 1,
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


@api.get("/livetv/epg")
async def livetv_epg(
    channel_key: str,
    limit: int = 6,
    user: dict = Depends(get_current_user),
):
    """EPG programs for a single IPTV live channel.

    Xtream Codes exposes `get_short_epg` which returns up to `limit` upcoming
    programs for a stream. We normalise the response so the mobile guide
    view can render `now` + `next` blocks without more parsing.

    Response shape:
        {"programs": [{"title","description","start","end","start_ts","end_ts"}]}
    """
    if not channel_key.startswith("iptv-live-"):
        raise HTTPException(400, "channel_key must be an iptv-live-<id>")
    try:
        stream_id = int(channel_key.split("-", 2)[2])
    except (IndexError, ValueError):
        raise HTTPException(400, "bad channel_key")
    try:
        raw = await _iptv_get("get_short_epg", {"stream_id": stream_id, "limit": max(1, min(limit, 24))})
    except Exception as e:
        log.warning("epg fetch failed for %s: %s", channel_key, e)
        return {"programs": []}
    # Xtream implementations vary — some return a bare list of dicts, others
    # wrap it in {"epg_listings": [...]}, and a few return unexpected shapes.
    # Normalise to a list of dicts before parsing, and skip anything weird.
    programs_raw = raw
    if isinstance(raw, dict):
        programs_raw = raw.get("epg_listings") or raw.get("programs") or []
    if not isinstance(programs_raw, list):
        return {"programs": []}
    out = []
    import base64 as _b64
    for p in programs_raw:
        if not isinstance(p, dict):
            continue
        # Xtream returns titles + descriptions base64-encoded, and start/end
        # as either ISO strings or unix timestamps (varies by provider).
        raw_title = p.get("title") or ""
        try:
            title = _b64.b64decode(raw_title).decode("utf-8", errors="replace")
        except Exception:
            title = raw_title
        raw_desc = p.get("description") or ""
        try:
            desc = _b64.b64decode(raw_desc).decode("utf-8", errors="replace")
        except Exception:
            desc = raw_desc
        start = p.get("start")
        end = p.get("end") or p.get("stop")
        start_ts = None
        end_ts = None
        try:
            start_ts = int(p.get("start_timestamp") or 0) or None
        except Exception:
            pass
        try:
            end_ts = int(p.get("stop_timestamp") or 0) or None
        except Exception:
            pass
        out.append({
            "title": (title or "").strip() or "No info",
            "description": (desc or "").strip(),
            "start": start,
            "end": end,
            "start_ts": start_ts,
            "end_ts": end_ts,
        })
    return {"programs": out}




@api.get("/iptv/live/streams")
async def iptv_live_streams(category_id: Optional[str] = None, _: dict = Depends(get_current_user)):
    params = {"category_id": category_id} if category_id else None
    raw = await _iptv_get("get_live_streams", params)
    cfg = await db.settings.find_one({"id": "iptv_config"})
    out = []
    for s in (raw or []):
        thumb_raw = s.get("stream_icon")
        out.append({
            "rating_key": f"iptv-live-{s.get('stream_id')}",
            "stream_id": s.get("stream_id"),
            "title": s.get("name"),
            "type": "live",
            "thumb": f"/api/iptv/logo?u={quote(thumb_raw, safe='')}" if thumb_raw else None,
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
        thumb_raw = s.get("stream_icon")
        out.append({
            "rating_key": f"iptv-movie-{s.get('stream_id')}",
            "stream_id": s.get("stream_id"),
            "title": s.get("name"),
            "type": "movie",
            "thumb": f"/api/iptv/logo?u={quote(thumb_raw, safe='')}" if thumb_raw else None,
            "year": s.get("year"),
            "rating": s.get("rating"),
            "audience_rating": s.get("rating"),
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
    return {
        "users_total": users,
        "users_active": active,
        "users_recent_logins_7d": recent,
        "service_name": s.get("service_name", "Quantum TV"),
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
    """Kept for backwards-compatibility; Plex is no longer supported."""
    return {"servers": []}


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


async def _iptv_item_meta(rating_key: str, user: dict) -> Optional[dict]:
    """Fetch IPTV metadata for an iptv-<kind>-<id> rating key."""
    if not str(rating_key).startswith("iptv-"):
        return None
    try:
        _, kind, sid = str(rating_key).split("-", 2)
        sid_int = int(sid)
    except (ValueError, TypeError):
        return None
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


@api.get("/metadata/{rating_key}")
async def metadata_detail(rating_key: str, user: dict = Depends(get_current_user)):
    result = await _iptv_item_meta(rating_key, user)
    if result is None:
        raise HTTPException(404, "Not found")
    return result


@api.get("/metadata/{rating_key}/children")
async def metadata_children(rating_key: str, user: dict = Depends(get_current_user)):
    # IPTV does not expose a children hierarchy — return empty list.
    return {"items": []}


@api.get("/recently-added")
async def recently_added(user: dict = Depends(get_current_user), limit: int = 30):
    """Return a sample of IPTV VOD movies as the 'recently added' row."""
    try:
        raw = await _iptv_get("get_vod_streams")
        items = []
        for s in (raw or [])[:limit]:
            thumb_raw = s.get("stream_icon")
            items.append({
                "rating_key": f"iptv-movie-{s.get('stream_id')}",
                "title": s.get("name"),
                "type": "movie",
                "thumb": f"/api/iptv/logo?u={quote(thumb_raw, safe='')}" if thumb_raw else None,
                "year": s.get("year"),
                "audience_rating": s.get("rating"),
            })
        return {"items": items}
    except Exception:
        return {"items": []}


@api.get("/continue-watching")
async def on_deck(user: dict = Depends(get_current_user), limit: int = 30):
    """Return empty — continue-watching requires server-side playback tracking."""
    return {"items": []}


@api.get("/browse/rows")
async def browse_rows(user: dict = Depends(get_current_user), per_row: int = 20, max_sections: int = 5):
    """Compose the home screen: live channels row + VOD movies row."""
    import asyncio

    rows: list[dict] = []

    live_task = live_channels(user)
    vod_task = recently_added(user, limit=per_row)

    live_resp, vod_resp = await asyncio.gather(live_task, vod_task, return_exceptions=False)

    # --- Top Live channels ---------------------------------------------------
    try:
        chs = (live_resp or {}).get("channels", []) or []
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

    # --- VOD movies row ------------------------------------------------------
    try:
        vod_items = (vod_resp or {}).get("items", []) or []
        if vod_items:
            rows.append({
                "id": "vod",
                "title": "Movies",
                "kind": "poster",
                "items": vod_items[:per_row],
            })
    except Exception as e:
        log.info("VOD row failed: %s", e)

    return {"rows": rows}


@api.get("/search")
async def search(q: str, user: dict = Depends(get_current_user), limit: int = 30):
    """Search IPTV live channels and VOD by title."""
    needle = (q or "").strip().lower()
    if not needle:
        return {"items": []}

    results = []
    try:
        raw_live = await _iptv_get("get_live_streams")
        for s in (raw_live or []):
            if needle in (s.get("name") or "").lower():
                thumb_raw = s.get("stream_icon")
                results.append({
                    "rating_key": f"iptv-live-{s.get('stream_id')}",
                    "title": s.get("name"),
                    "type": "live",
                    "thumb": f"/api/iptv/logo?u={quote(thumb_raw, safe='')}" if thumb_raw else None,
                    "year": None,
                })
    except Exception:
        pass

    try:
        raw_vod = await _iptv_get("get_vod_streams")
        for s in (raw_vod or []):
            if needle in (s.get("name") or "").lower():
                thumb_raw = s.get("stream_icon")
                results.append({
                    "rating_key": f"iptv-movie-{s.get('stream_id')}",
                    "title": s.get("name"),
                    "type": "movie",
                    "thumb": f"/api/iptv/logo?u={quote(thumb_raw, safe='')}" if thumb_raw else None,
                    "year": s.get("year"),
                    "audience_rating": s.get("rating"),
                })
    except Exception:
        pass

    return {"items": results[:limit]}


# ============================================================
# Live TV category classification
# ------------------------------------------------------------
# Xtream Codes providers name their categories freeform (e.g.
# "US| USA - Sports HD", "UK - News", "Kids Movies", "24/7 Ted Lasso").
# We derive two orthogonal chip filters — country + genre — from the
# category name so the mobile app can offer clean, browseable filters
# without any name-parsing on the client. Anything unrecognized falls
# into "Other" / "General".
# ============================================================
_COUNTRY_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(US|USA|UNITED\s*STATES|U\.S\.)\b", re.I), "USA"),
    (re.compile(r"\b(UK|UNITED\s*KINGDOM|GB|GREAT\s*BRITAIN|BRITAIN|BRIT)\b", re.I), "UK"),
    (re.compile(r"\b(CA|CAN|CANADA)\b", re.I), "Canada"),
    (re.compile(r"\b(AU|AUS|AUSTRALIA)\b", re.I), "Australia"),
    (re.compile(r"\b(MX|MEX|MEXICO)\b", re.I), "Mexico"),
    (re.compile(r"\b(IN|IND|INDIA)\b", re.I), "India"),
    (re.compile(r"\b(FR|FRA|FRANCE|FRENCH)\b", re.I), "France"),
    (re.compile(r"\b(DE|GER|GERMAN(?:Y)?|DEUTSCH)\b", re.I), "Germany"),
    (re.compile(r"\b(ES|SPAIN|SPANISH|ESPAN|LATINO)\b", re.I), "Spanish"),
    (re.compile(r"\b(IT|ITA|ITALY|ITALIAN)\b", re.I), "Italy"),
    (re.compile(r"\b(BR|BRA|BRAZIL|BRASIL)\b", re.I), "Brazil"),
    (re.compile(r"\b(PT|PORT|PORTUGAL)\b", re.I), "Portugal"),
    (re.compile(r"\b(NL|NETH|NETHERLANDS|DUTCH)\b", re.I), "Netherlands"),
    (re.compile(r"\b(AR|ARAB|ARABIC|MENA)\b", re.I), "Arabic"),
    (re.compile(r"\b(JP|JAP|JAPAN|JAPANESE)\b", re.I), "Japan"),
    (re.compile(r"\b(CN|CHI|CHINA|CHINESE)\b", re.I), "China"),
    (re.compile(r"\b(KR|KOR|KOREA(?:N)?)\b", re.I), "Korea"),
    (re.compile(r"\b(IE|IRE|IRELAND|IRISH)\b", re.I), "Ireland"),
    (re.compile(r"\b(RU|RUS|RUSSIA(?:N)?)\b", re.I), "Russia"),
    (re.compile(r"\b(TR|TUR|TURK(?:EY|ISH)?)\b", re.I), "Turkey"),
]
_GENRE_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(SPORT(?:S)?|ESPN|NFL|NBA|MLB|NHL|SOCCER|FOOTBALL|GOLF|RACING|FIGHT|UFC|BOXING|WWE|WRESTLING)\b", re.I), "Sports"),
    (re.compile(r"\b(NEWS|CNN|FOX(?:\s*NEWS)?|MSNBC|CNBC|BBC|BLOOMBERG|NEWSMAX)\b", re.I), "News"),
    (re.compile(r"\b(KIDS|CHILDREN|CARTOON|DISNEY|NICK(?:ELODEON)?)\b", re.I), "Kids"),
    (re.compile(r"\b(MOVIE(?:S)?|CINEMA|FILM)\b", re.I), "Movies"),
    (re.compile(r"\b(MUSIC|MTV|VEVO)\b", re.I), "Music"),
    (re.compile(r"\b(DOC(?:UMENTARY|UMENTARIES)?|NAT\s*GEO|DISCOVERY|HISTORY|SCIENCE)\b", re.I), "Documentary"),
    (re.compile(r"\b(RELIGION|CHURCH|GOSPEL|CHRIST|FAITH|CATHOLIC|MUSLIM|ISLAM)\b", re.I), "Religion"),
    (re.compile(r"\b(24\s*[\/-]?\s*7|247)\b", re.I), "24/7"),
    (re.compile(r"\b(PPV|PAY\s*PER\s*VIEW|EVENT(?:S)?)\b", re.I), "PPV / Events"),
    (re.compile(r"\b(ADULT|XXX|EROTIC)\b", re.I), "Adult"),
    (re.compile(r"\b(ENT(?:ERTAINMENT)?|LIFESTYLE|REALITY|VARIETY)\b", re.I), "Entertainment"),
]


def _classify_live_category(name: Optional[str]) -> dict:
    text = name or ""
    country = "Other"
    for pat, label in _COUNTRY_PATTERNS:
        if pat.search(text):
            country = label
            break
    genre = "General"
    for pat, label in _GENRE_PATTERNS:
        if pat.search(text):
            genre = label
            break
    return {"country": country, "genre": genre}


# Strip stylistic noise from IPTV channel titles so older users can read
# them: country prefixes ("USA -", "US|", "UK-"), HD/UHD/4K suffixes,
# Unicode super/subscript decorations like "ᴴᴰ", "⁸ᴷ", "⁴ᴷ". Preserves the
# core channel identity — we keep country info available via the separate
# `country` field, so it's fine to strip from the display name.
# Prefer explicit country tokens; fall back to a generic short-uppercase
# token pattern so oddball ISO codes (AFG, ARG, CHL, VZ, ...) also get
# stripped.
_CHANNEL_PREFIX_RE = re.compile(
    r"^(?:"
    r"(?:USA?|UK|GB|CA|CAN|AU|MX|MXC|IN|FR|DE|ES|IT|BR|PT|NL|AR|JP|CN|KR|IE|RU|TR|"
    r"LATINO|SPANISH|AFG|ARG|CHL|COL|CO|CRI|CR|CY|CYP|BOL|BOL|BY|PER|URY|UY|VEN|VZ|"
    r"KIDS|ADULT|MUSIC|MOVIES|MOVIE|MOVIES4U|SPORTS|SPORT|NEWS|24[/ ]?7)"
    r"\s*[|:\-–—•·]+"
    r"\s*)+",
    re.IGNORECASE,
)
# Generic fallback: any 2-5 letter uppercase token followed by a separator,
# e.g. "MNG - ", "CHL | ". Only strips a single leading occurrence.
_CHANNEL_PREFIX_GENERIC_RE = re.compile(r"^[A-Z]{2,5}\s*[|:\-–—•·]+\s*")
# Bracketed prefix like "[US]", "(UK)", "{USA}"
_CHANNEL_PREFIX_BRACKET_RE = re.compile(r"^[\[\(\{][^\]\)\}]{1,8}[\]\)\}]\s*[|:\-–—•·]*\s*")
_CHANNEL_SUFFIX_RE = re.compile(
    r"\s*[|:\-•·]?\s*(?:FHD|UHD|4K|8K|HD|SD|HEVC|H265|H\.?265|RAW|LIVE|PPV)\s*$",
    re.IGNORECASE,
)
# Unicode small-caps / superscript / subscript decorations providers use to
# stamp quality on names (ᴴᴰ ⁴ᴷ ⁸ᴷ ᶠᴴᴰ etc). Range covers super/subscript,
# modifier letters, and mathematical alphanumeric symbols used for these.
_UNICODE_DECOR_RE = re.compile(
    "[\u1D00-\u1D7F\u1D80-\u1DBF\u2070-\u209F\u2100-\u214F\U0001D400-\U0001D7FF]"
)
# Section-divider "channels" like "##### USA GENERAL #####" — these are
# navigation headers in the source M3U, not playable channels. Detected so
# the caller can hide them entirely.
_CHANNEL_DIVIDER_RE = re.compile(r"^\s*[#=\*·•\-—_]{3,}.*[#=\*·•\-—_]{3,}\s*$")


def _is_divider_channel(name: Optional[str]) -> bool:
    return bool(name and _CHANNEL_DIVIDER_RE.match(name))


def _clean_channel_title(raw: Optional[str]) -> str:
    """Return a shorter, cleaner channel name for display.

    Kept safe for scanning by older users: strips country prefixes and
    quality-tag suffixes (both ASCII and Unicode-stylized). Falls back to
    the raw name if the cleaning would leave us with nothing.
    """
    if not raw:
        return ""
    s = str(raw)
    # Strip bracketed prefix once.
    s = _CHANNEL_PREFIX_BRACKET_RE.sub("", s).strip()
    # Iterate a couple of times to catch chained prefixes like "USA - US -".
    for _ in range(4):
        new = _CHANNEL_PREFIX_RE.sub("", s).strip()
        if new == s:
            # Also try the generic fallback for weird 3-4 letter codes.
            new2 = _CHANNEL_PREFIX_GENERIC_RE.sub("", s).strip()
            if new2 == s:
                break
            s = new2
        else:
            s = new
    s = _UNICODE_DECOR_RE.sub("", s)
    # Strip quality suffix up to 2 times ("... HD FHD")
    for _ in range(2):
        new = _CHANNEL_SUFFIX_RE.sub("", s).strip()
        if new == s:
            break
        s = new
    s = re.sub(r"\s{2,}", " ", s).strip(" -|:•·")
    return s or (raw.strip() if raw else "")



@api.get("/livetv/channels")
async def live_channels(user: dict = Depends(get_current_user)):
    out: list[dict] = []

    # Merge IPTV live channels (if configured). Keyed as iptv-live-<id> so the
    # /stream/{rk} endpoint can route playback through the proxy. Enrich each
    # channel with category_id/name so the mobile client can offer clean
    # "Country" + "Genre" filter chips without doing name-parsing itself.
    cfg = await db.settings.find_one({"id": "iptv_config"})
    if cfg and cfg.get("password_enc"):
        # Build the category_id -> {name, country, genre} lookup once.
        cat_by_id: dict[str, dict] = {}
        try:
            raw_cats = await _iptv_get("get_live_categories")
            for c in raw_cats or []:
                cid = str(c.get("category_id") or "")
                name = str(c.get("category_name") or "").strip()
                cls = _classify_live_category(name)
                cat_by_id[cid] = {"name": name, "country": cls["country"], "genre": cls["genre"]}
        except Exception as e:
            log.warning("IPTV categories fetch failed: %s", e)

        try:
            raw = await _iptv_get("get_live_streams")
            for s in raw or []:
                sid = s.get("stream_id")
                if not sid:
                    continue
                raw_name = s.get("name") or ""
                # Skip section-divider entries like "##### USA GENERAL #####" —
                # they aren't playable channels, they're M3U group headers.
                if _is_divider_channel(raw_name):
                    continue
                logo_raw = s.get("stream_icon") or None
                # Route http logos through our logo proxy so browsers on
                # https pages actually render them.
                logo = f"/api/iptv/logo?u={quote(logo_raw, safe='')}" if logo_raw else None
                cid = str(s.get("category_id") or "")
                cat = cat_by_id.get(cid) or {"name": None, "country": "Other", "genre": "General"}
                out.append({
                    "title": _clean_channel_title(s.get("name")),
                    "original_title": s.get("name"),
                    "number": s.get("num"),
                    "logo": logo,
                    "key": f"iptv-live-{sid}",
                    "source": "iptv",
                    "category_id": cid or None,
                    "category_name": cat["name"],
                    "country": cat["country"],
                    "genre": cat["genre"],
                })
        except Exception as e:
            log.warning("IPTV live channels merge failed: %s", e)

    return {"channels": out}


@api.get("/stream/{rating_key}")
async def stream_url(rating_key: str, request: Request, user: dict = Depends(get_current_user),
                    direct: bool = True, max_bitrate: int = 8000):
    # IPTV stream resolution. Rating keys are minted as iptv-<kind>-<id>.
    if not str(rating_key).startswith("iptv-"):
        raise HTTPException(404, "Stream not found")
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
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host") or request.url.netloc
    origin = f"{proto}://{host}"
    url = f"{origin}/api/iptv/p/{kind}/{sid}.{ext}?t={quote(stream_token)}"
    return {"url": url, "type": "hls" if kind == "live" else "direct"}


# ============================================================
# Per-user watchlist & favorites
# ============================================================
class RatingKeyBody(BaseModel):
    rating_key: str


async def _enrich_keys(keys: list[str], user: dict) -> list[dict]:
    """Fetch IPTV metadata for a list of rating keys (watchlist / favorites)."""
    if not keys:
        return []
    results = await asyncio.gather(*(_iptv_item_meta(rk, user) for rk in keys))
    return [item for item in results if item is not None]


@api.get("/me/watchlist")
async def my_watchlist(user: dict = Depends(get_current_user)):
    keys = [str(x) for x in (user.get("watchlist") or [])]
    return {"items": await _enrich_keys(keys, user)}


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
    return {"items": await _enrich_keys(keys, user)}


@api.post("/me/favorites")
async def add_favorite(body: RatingKeyBody, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"favorites": str(body.rating_key)}})
    return {"ok": True}


@api.delete("/me/favorites/{rating_key}")
async def del_favorite(rating_key: str, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"favorites": str(rating_key)}})
    return {"ok": True}


# ============================================================
# Live TV: Favorites (starred channels) + Recently Watched
# ------------------------------------------------------------
# Unlike movie/show favorites (rating_key -> Plex metadata), channels are a
# mix of Plex live + IPTV streams. We store a self-contained SNAPSHOT of the
# channel (key/title/logo/number/source) so the row can render instantly
# even if the underlying channel list is slow to load or IPTV drops the ID.
# ============================================================
LIVE_RECENT_CAP = 20


class LiveChannelBody(BaseModel):
    key: str
    title: Optional[str] = None
    logo: Optional[str] = None
    number: Optional[Any] = None  # ints or strings — IPTV uses both
    source: Optional[str] = None  # "plex" | "iptv"


def _live_snapshot(body: LiveChannelBody) -> dict:
    return {
        "key": str(body.key),
        "title": body.title or "",
        "logo": body.logo or None,
        "number": body.number,
        "source": body.source or None,
    }


@api.get("/me/live/favorites")
async def my_live_favorites(user: dict = Depends(get_current_user)):
    return {"items": list(user.get("live_favorites") or [])}


@api.post("/me/live/favorites")
async def add_live_favorite(body: LiveChannelBody, user: dict = Depends(get_current_user)):
    snap = _live_snapshot(body)
    # Atomic upsert: remove any existing entry with the same key, then push the
    # fresh snapshot in one update so a rapid double-click can't produce dupes.
    await db.users.update_one(
        {"id": user["id"]},
        [
            {"$set": {
                "live_favorites": {
                    "$concatArrays": [
                        {"$filter": {
                            "input": {"$ifNull": ["$live_favorites", []]},
                            "cond": {"$ne": ["$$this.key", snap["key"]]},
                        }},
                        [snap],
                    ]
                }
            }},
        ],
    )
    return {"ok": True}


@api.delete("/me/live/favorites/{channel_key}")
async def del_live_favorite(channel_key: str, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"live_favorites": {"key": channel_key}}})
    return {"ok": True}


@api.get("/me/live/recent")
async def my_live_recent(user: dict = Depends(get_current_user)):
    return {"items": list(user.get("live_recent") or [])}


@api.post("/me/live/recent")
async def add_live_recent(body: LiveChannelBody, user: dict = Depends(get_current_user)):
    snap = _live_snapshot(body)
    snap["watched_at"] = datetime.now(timezone.utc).isoformat()
    # Atomic upsert-to-front + cap: filter out any existing entry for the same
    # channel, prepend the fresh snapshot, and slice to the cap. Single write
    # so a rapid double-tap can't produce a duplicate.
    await db.users.update_one(
        {"id": user["id"]},
        [
            {"$set": {
                "live_recent": {
                    "$slice": [
                        {"$concatArrays": [
                            [snap],
                            {"$filter": {
                                "input": {"$ifNull": ["$live_recent", []]},
                                "cond": {"$ne": ["$$this.key", snap["key"]]},
                            }},
                        ]},
                        LIVE_RECENT_CAP,
                    ]
                }
            }},
        ],
    )
    return {"ok": True}


@api.delete("/me/live/recent")
async def clear_live_recent(user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"live_recent": []}})
    return {"ok": True}


@api.delete("/me/live/recent/{channel_key}")
async def del_live_recent(channel_key: str, user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"live_recent": {"key": channel_key}}})
    return {"ok": True}


# Public service config
@api.get("/config")
async def public_config():
    s = await db.settings.find_one({"id": "global"}) or {}
    return {
        "service_name": s.get("service_name", "Quantum TV"),
        "motd": s.get("motd", ""),
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
    preview_url = "https://tv-ui-staging-1.preview.emergentagent.com/api/q"
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
    log.info("Quantum TV API started")
