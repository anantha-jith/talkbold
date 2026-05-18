from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from app.services import auth_service, email_service, firebase_admin_service
from app.services.db_service import upsert_google_user

router = APIRouter()


# ── Request models ─────────────────────────────────────────────────────────────

class SignupReq(BaseModel):
    email:    str
    password: str

class LoginReq(BaseModel):
    email:    str
    password: str

class VerifyReq(BaseModel):
    email: str
    code:  str

class ResendReq(BaseModel):
    email: str

class GoogleLoginReq(BaseModel):
    id_token: str   # Firebase ID token from signInWithPopup()


# ── Google OAuth endpoint ──────────────────────────────────────────────────────

@router.post("/google")
def google_login(data: GoogleLoginReq):
    """
    Verify a Firebase Google ID token, upsert user in MongoDB,
    and return an internal JWT for use across all other API routes.
    """
    try:
        user_info = firebase_admin_service.verify_google_token(data.id_token)
    except FileNotFoundError as e:
        raise HTTPException(503, str(e))
    except ValueError as e:
        raise HTTPException(401, str(e))

    if not user_info.get("email"):
        raise HTTPException(400, "Google account has no email address.")

    # Upsert into MongoDB
    email   = user_info["email"]
    name    = user_info.get("name", "")
    picture = user_info.get("picture", "")
    uid     = user_info.get("uid", "")

    upsert_google_user(uid=uid, email=email, name=name, picture=picture)

    # Issue internal JWT (same mechanism as admin JWT — consistent for all API routes)
    token = auth_service.create_token(email, "user")

    return {
        "token":   token,
        "role":    "user",
        "email":   email,
        "name":    name,
        "picture": picture,
    }


# ── Guest Auth endpoint ────────────────────────────────────────────────────────

import uuid
from typing import Optional

class GuestLoginReq(BaseModel):
    guest_uid: Optional[str] = None  # device-stored UID to resume same session

@router.post("/guest")
def guest_login(data: GuestLoginReq = None):
    """
    Native guest login that bypasses Firebase.
    If guest_uid is supplied (same device), reuse the existing record.
    Otherwise generate a new guest session.
    """
    from app.services.db_service import google_users_collection

    supplied_uid = (data.guest_uid or "").strip() if data else ""

    if supplied_uid:
        # Try to find existing guest by UID
        existing = google_users_collection.find_one({"uid": supplied_uid})
        if existing:
            uid   = existing["uid"]
            email = existing["email"]
            token = auth_service.create_token(email, "guest")
            return {
                "token":     token,
                "role":      "guest",
                "email":     email,
                "name":      "Guest User",
                "picture":   "",
                "guest_uid": uid,
            }

    # New guest — generate fresh UID
    uid   = f"anon_{uuid.uuid4().hex[:12]}"
    email = f"{uid}@talkbold.local"

    google_users_collection.update_one(
        {"uid": uid},
        {
            "$setOnInsert": {
                "uid":        uid,
                "email":      email,
                "role":       "guest",
                "usageCount": 0
            }
        },
        upsert=True
    )

    token = auth_service.create_token(email, "guest")

    return {
        "token":     token,
        "role":      "guest",
        "email":     email,
        "name":      "Guest User",
        "picture":   "",
        "guest_uid": uid,   # frontend stores this permanently
    }


# ── Guest usage check ─────────────────────────────────────────────────────────

@router.get("/usage")
async def get_guest_usage(request: Request):
    """
    Returns the current usageCount for a guest user based on their JWT.
    Returns {used: N, limit: 3, remaining: X} for guests.
    Returns {used: 0, limit: -1, remaining: -1} for full users (unlimited).
    """
    from app.services.db_service import google_users_collection
    from app.services.auth_service import get_optional_user

    user = await get_optional_user(request)
    if not user or user.get("role") != "guest":
        return {"used": 0, "limit": -1, "remaining": -1}

    email = user.get("sub")
    rec = google_users_collection.find_one({"email": email}, {"_id": 0, "usageCount": 1})
    used = rec.get("usageCount", 0) if rec else 0
    return {"used": used, "limit": 3, "remaining": max(0, 3 - used)}


# ── Admin / legacy custom auth endpoints ──────────────────────────────────────

@router.post("/signup")
def signup(data: SignupReq):
    result = auth_service.signup(data.email.strip().lower(), data.password)
    if not result["ok"]:
        raise HTTPException(400, result["error"])
    email_service.send_otp(data.email.strip().lower(), result["otp"])
    return {"message": "OTP sent. Please check your email (or backend console)."}


@router.post("/login")
def login(data: LoginReq):
    result = auth_service.login(data.email.strip().lower(), data.password)
    if not result["ok"]:
        if result.get("needs_verify"):
            email_service.send_otp(result["email"], result["otp"])
        raise HTTPException(
            403 if result.get("needs_verify") else 401,
            result["error"]
        )
    return {
        "token":   result["token"],
        "role":    result["role"],
        "email":   result["email"],
        "name":    result["email"].split("@")[0],
        "picture": "",
    }


@router.post("/verify")
def verify(data: VerifyReq):
    result = auth_service.verify_email(data.email.strip().lower(), data.code.strip())
    if not result["ok"]:
        raise HTTPException(400, result["error"])
    return {
        "token":   result["token"],
        "role":    result["role"],
        "email":   result["email"],
        "name":    result["email"].split("@")[0],
        "picture": "",
    }


@router.post("/resend")
def resend(data: ResendReq):
    result = auth_service.resend_otp(data.email.strip().lower())
    if not result["ok"]:
        raise HTTPException(400, result["error"])
    email_service.send_otp(data.email.strip().lower(), result["otp"])
    return {"message": "OTP resent."}


@router.get("/users")
def list_users():
    """Admin-only: returns all custom-auth users."""
    return {"users": auth_service.get_all_users()}
