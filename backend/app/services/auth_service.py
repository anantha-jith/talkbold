"""
auth_service.py — JWT + bcrypt user auth with OTP email verification.

User store: backend/users.json (simple JSON file, no DB setup needed)
Admin:      admin@admin.com / admin  (hardcoded, always valid)
OTP:        6-digit code, 10-minute expiry, in-memory store
"""

import json, os, random, time, logging, hashlib
from pathlib import Path

import jwt
import bcrypt
from fastapi import Request, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY        = "mock-viva-secret-jwt-key-2026-secure-abc"
ALGORITHM         = "HS256"
TOKEN_EXPIRE_SEC  = 7 * 24 * 3600   # 1 week

ADMIN_EMAIL = "admin@admin.com"
ADMIN_PASS  = "admin"

USER_DB_PATH = Path(__file__).parent.parent.parent / "users.json"

# In-memory OTP store: { email: { code: str, expires: float } }
_OTP_STORE: dict = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _load_users() -> dict:
    if not USER_DB_PATH.exists():
        return {}
    try:
        with open(USER_DB_PATH, "r") as f:
            return json.load(f)
    except Exception:
        return {}

def _save_users(users: dict) -> None:
    with open(USER_DB_PATH, "w") as f:
        json.dump(users, f, indent=2)

def _hash(password: str) -> str:
    """
    SHA-256 pre-hash then bcrypt.
    SHA-256 step collapses any length to 32 bytes,
    avoiding bcrypt's 72-byte truncation limit.
    """
    pre = hashlib.sha256(password.encode("utf-8")).hexdigest().encode("utf-8")
    return bcrypt.hashpw(pre, bcrypt.gensalt(12)).decode("utf-8")

def _verify(password: str, hashed: str) -> bool:
    pre = hashlib.sha256(password.encode("utf-8")).hexdigest().encode("utf-8")
    return bcrypt.checkpw(pre, hashed.encode("utf-8"))

def create_token(email: str, role: str) -> str:
    payload = {
        "sub":  email,
        "role": role,
        "exp":  int(time.time()) + TOKEN_EXPIRE_SEC,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    """Raises jwt.ExpiredSignatureError / jwt.InvalidTokenError on failure."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

security = HTTPBearer(auto_error=False)

def get_current_user(credentials: HTTPAuthorizationCredentials = None):
    # This dependency reads the token from the request header manually
    pass

async def get_optional_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    try:
        payload = decode_token(token)
        return payload
    except:
        return None

async def get_current_user_req(request: Request):
    user = await get_optional_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ── OTP ───────────────────────────────────────────────────────────────────────

def generate_otp(email: str) -> str:
    code = str(random.randint(100000, 999999))
    _OTP_STORE[email] = {"code": code, "expires": time.time() + 600}
    # Use print() — logger.info is filtered by uvicorn's log level
    print(f"\n{'='*50}")
    print(f"[OTP] Email : {email}")
    print(f"[OTP] Code  : {code}")
    print(f"{'='*50}\n", flush=True)
    return code

def validate_otp(email: str, code: str) -> bool:
    stored = _OTP_STORE.get(email)
    if not stored:
        return False
    if time.time() > stored["expires"]:
        _OTP_STORE.pop(email, None)
        return False
    if stored["code"] != str(code).strip():
        return False
    _OTP_STORE.pop(email, None)
    return True


# ── Auth actions ──────────────────────────────────────────────────────────────

def signup(email: str, password: str) -> dict:
    if email.lower() == ADMIN_EMAIL:
        return {"ok": False, "error": "Cannot register with this email."}

    users = _load_users()
    if email in users:
        return {"ok": False, "error": "Email already registered. Please log in."}

    users[email] = {
        "email":    email,
        "password": _hash(password),
        "verified": False,
        "role":     "user",
        "created":  int(time.time()),
    }
    _save_users(users)
    otp = generate_otp(email)
    return {"ok": True, "otp": otp}   # otp returned so caller can email it


def login(email: str, password: str) -> dict:
    # Admin shortcut
    if email.lower() == ADMIN_EMAIL:
        if password == ADMIN_PASS:
            token = create_token(ADMIN_EMAIL, "admin")
            return {"ok": True, "token": token, "role": "admin", "email": ADMIN_EMAIL}
        return {"ok": False, "error": "Incorrect password."}

    users = _load_users()
    user  = users.get(email)

    if not user:
        return {"ok": False, "error": "No account found with this email."}
    if not _verify(password, user["password"]):
        return {"ok": False, "error": "Incorrect password."}
    if not user.get("verified"):
        # Resend OTP automatically
        otp = generate_otp(email)
        return {"ok": False, "error": "Email not verified.", "needs_verify": True,
                "email": email, "otp": otp}

    token = create_token(email, user["role"])
    return {"ok": True, "token": token, "role": user["role"], "email": email}


def verify_email(email: str, code: str) -> dict:
    if not validate_otp(email, code):
        return {"ok": False, "error": "Invalid or expired code. Try again."}

    users = _load_users()
    if email not in users:
        return {"ok": False, "error": "User not found."}

    users[email]["verified"] = True
    _save_users(users)

    token = create_token(email, users[email]["role"])
    return {"ok": True, "token": token, "role": users[email]["role"], "email": email}


def resend_otp(email: str) -> dict:
    users = _load_users()
    if email not in users:
        return {"ok": False, "error": "No account found."}
    otp = generate_otp(email)
    return {"ok": True, "otp": otp}


def get_all_users() -> list:
    """Admin-only: return list of users (no passwords)."""
    users = _load_users()
    return [
        {"email": u["email"], "verified": u["verified"],
         "role": u["role"], "created": u.get("created", 0)}
        for u in users.values()
    ]
