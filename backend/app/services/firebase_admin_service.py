"""
firebase_admin_service.py — Firebase Admin SDK wrapper.

Verifies Google ID tokens issued by Firebase Authentication.
Supports two credential sources (in priority order):
  1. FIREBASE_ADMIN_JSON env var — JSON string (used on Render / cloud)
  2. firebase-admin.json file    — local dev fallback
"""

import os
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_app = None

CRED_PATH = Path(__file__).parent.parent.parent / "firebase-admin.json"


def _init():
    """Lazy init — only runs once. Safe to call multiple times."""
    global _app
    if _app is not None:
        return

    import firebase_admin
    from firebase_admin import credentials

    # ── Priority 1: JSON string from environment variable (cloud deployment) ──
    # 1. Try Base64 encoded JSON first (most robust against formatting issues)
    env_b64 = os.getenv("FIREBASE_ADMIN_BASE64", "").strip()
    if env_b64:
        import base64
        try:
            decoded = base64.b64decode(env_b64).decode("utf-8")
            data = json.loads(decoded)
            cred = credentials.Certificate(data)
            _app = firebase_admin.initialize_app(cred)
            logger.info(f"[Firebase] Admin SDK initialized from BASE64 env var — project: {data.get('project_id')}")
            return
        except Exception as e:
            raise ValueError(f"FIREBASE_ADMIN_BASE64 is invalid: {e}")

    # 2. Fallback to raw JSON string
    env_json = os.getenv("FIREBASE_ADMIN_JSON", "").strip()
    if env_json:
        try:
            data = json.loads(env_json)
            if data.get("project_id", "").startswith("YOUR_"):
                raise ValueError("FIREBASE_ADMIN_JSON contains placeholder values.")

            if "private_key" in data:
                data["private_key"] = data["private_key"].replace("\\n", "\n")

            cred  = credentials.Certificate(data)
            _app  = firebase_admin.initialize_app(cred)
            logger.info(f"[Firebase] Admin SDK initialized from env var — project: {data['project_id']}")
            return
        except json.JSONDecodeError as e:
            raise ValueError(f"FIREBASE_ADMIN_JSON is not valid JSON: {e}")

    # ── Priority 2: Local file (development) ──────────────────────────────────
    if not CRED_PATH.exists():
        raise FileNotFoundError(
            "Firebase Admin credentials not found. Either:\n"
            "  • Set the FIREBASE_ADMIN_JSON environment variable (for cloud), OR\n"
            "  • Place firebase-admin.json in the backend/ directory (for local dev).\n"
            "Download the service account key from Firebase Console → Project Settings → Service accounts."
        )

    with open(CRED_PATH) as f:
        data = json.load(f)

    if data.get("project_id", "").startswith("YOUR_"):
        raise ValueError(
            "firebase-admin.json still contains placeholder values. "
            "Replace it with the real service account key from Firebase Console."
        )

    cred = credentials.Certificate(str(CRED_PATH))
    _app = firebase_admin.initialize_app(cred)
    logger.info(f"[Firebase] Admin SDK initialized from file — project: {data['project_id']}")


def verify_google_token(id_token: str) -> dict:
    """
    Verify a Firebase ID token and return decoded user info.

    Returns:
        { uid, email, name, picture, email_verified }

    Raises:
        ValueError  — token invalid / expired
        FileNotFoundError / ValueError — SDK not configured
    """
    _init()

    from firebase_admin import auth as firebase_auth

    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except firebase_auth.ExpiredIdTokenError:
        raise ValueError("Google session expired. Please sign in again.")
    except firebase_auth.InvalidIdTokenError:
        raise ValueError("Invalid Google token. Please sign in again.")
    except Exception as exc:
        raise ValueError(f"Token verification failed: {exc}")

    return {
        "uid":            decoded.get("uid", ""),
        "email":          decoded.get("email", ""),
        "name":           decoded.get("name", ""),
        "picture":        decoded.get("picture", ""),
        "email_verified": decoded.get("email_verified", False),
    }
