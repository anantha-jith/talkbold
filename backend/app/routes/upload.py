from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
import uuid
import os

from app.services.rag_service import extract_ppt_text, store_embeddings, assess_ppt_quality
from app.services.llm_service import auto_detect_topic
from app.services.auth_service import get_current_user_req
from app.services.db_service import google_users_collection

router = APIRouter()

UPLOAD_DIR = "uploads"


@router.post("/")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_current_user_req)):
    if user.get("role") == "guest":
        guest_rec = google_users_collection.find_one({"email": user["sub"]})
        if guest_rec and guest_rec.get("usageCount", 0) >= 3:
            raise HTTPException(status_code=403, detail="Guest limit reached. Please sign in with Google to continue using Mock Viva.")
        
        # Increment usage
        google_users_collection.update_one({"email": user["sub"]}, {"$inc": {"usageCount": 1}})

    if not file.filename.lower().endswith('.pptx'):
        raise HTTPException(status_code=400, detail="Only PPTX files are supported. Please upload a valid PowerPoint (.pptx) file.")

    os.makedirs(UPLOAD_DIR, exist_ok=True)

    session_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{session_id}_{file.filename}")

    with open(file_path, "wb") as f:
        f.write(await file.read())

    # Extract text and assess quality
    slides = extract_ppt_text(file_path)
    quality = assess_ppt_quality(slides)

    # Auto-detect topic from the extracted text
    full_text = " ".join([s["content"] for s in slides])
    
    # INJECT the text into quality so the frontend sends it back to us!
    # This completely eliminates the need for ChromaDB / local memory storage.
    quality["extracted_text"] = full_text

    detected_topic = auto_detect_topic(full_text) if quality["has_content"] else "Unknown Topic"

    return {
        "session_id": session_id,
        "slides": len(slides),
        "ppt_quality": quality,
        "detected_topic": detected_topic
    }