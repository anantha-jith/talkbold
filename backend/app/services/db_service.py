from pymongo import MongoClient
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))

db = client["mock_viva_ai"]

reports_collection = db["reports"]
google_users_collection = db["google_users"]


def upsert_google_user(uid: str, email: str, name: str, picture: str) -> dict:
    """
    Create or update a Google-authenticated user in MongoDB.
    Returns the stored user document (without _id).
    """
    now = datetime.now(timezone.utc)

    google_users_collection.update_one(
        {"email": email},
        {
            "$set": {
                "uid":       uid,
                "email":     email,
                "name":      name,
                "picture":   picture,
                "role":      "user",
                "lastLogin": now,
            },
            "$setOnInsert": {
                "createdAt": now,
            },
        },
        upsert=True,
    )

    doc = google_users_collection.find_one({"email": email}, {"_id": 0})
    return doc or {"email": email, "role": "user", "name": name, "picture": picture}