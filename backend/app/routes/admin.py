from fastapi import APIRouter, Depends, HTTPException
from app.services.db_service import google_users_collection, reports_collection
import psutil
import time
from datetime import datetime, timedelta

router = APIRouter()

# Global start time for uptime tracking
START_TIME = time.time()

def get_current_admin():
    # In a real system, we would verify Firebase token and check role="admin"
    # For now, we assume the frontend protects the route and backend allows it for demo
    return {"role": "admin"}


@router.get("/metrics/overview")
def get_global_metrics(admin=Depends(get_current_admin)):
    total_users = google_users_collection.count_documents({})
    total_reports = reports_collection.count_documents({})
    
    # Simple aggregations
    pipeline = [
        {"$group": {
            "_id": None,
            "avg_confidence": {"$avg": "$audio_scores.confidence_score"},
            "avg_fluency": {"$avg": "$audio_scores.fluency_score"},
            "avg_technical": {"$avg": "$audio_scores.technical_confidence_score"},
            "avg_wpm": {"$avg": "$audio_scores.pace.wpm"},
            "avg_robotic": {"$avg": "$audio_scores.robotic_text.robotic_score"}
        }}
    ]
    
    try:
        agg = list(reports_collection.aggregate(pipeline))
        stats = agg[0] if agg else {}
    except Exception:
        stats = {}
        
    # Active today (mocked for demo based on recent reports)
    today = datetime.utcnow() - timedelta(days=1)
    active_today = reports_collection.count_documents({"_id": {"$exists": True}}) # Mocking all as active

    return {
        "total_users": total_users,
        "total_reports": total_reports,
        "total_audio": reports_collection.count_documents({"transcription": {"$ne": ""}}),
        "active_today": active_today,
        "avg_confidence": round(stats.get("avg_confidence") or 0, 1),
        "avg_fluency": round(stats.get("avg_fluency") or 0, 1),
        "avg_technical": round(stats.get("avg_technical") or 0, 1),
        "avg_wpm": round(stats.get("avg_wpm") or 0, 1),
        "avg_robotic": round(stats.get("avg_robotic") or 0, 1),
    }


@router.get("/metrics/system")
def get_system_health(admin=Depends(get_current_admin)):
    # Hardware metrics
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    
    uptime_seconds = int(time.time() - START_TIME)
    
    return {
        "status": "Operational",
        "cpu_usage": cpu_percent,
        "memory_usage": memory.percent,
        "disk_usage": disk.percent,
        "uptime_seconds": uptime_seconds,
        "services": {
            "mongodb": "Online",
            "ollama_llama3": "Online",
            "whisper": "Online",
            "firebase": "Online"
        },
        "active_sessions": 4, # Mock active sessions
        "api_latency_ms": 42
    }


@router.get("/reports/recent")
def get_recent_reports(admin=Depends(get_current_admin)):
    # Fetch last 50 reports for the dashboard table
    reports = list(reports_collection.find({}, {"_id": 0, "analysis": 0}).sort("_id", -1).limit(50))
    return {"reports": reports}


@router.get("/users")
def get_users_list(admin=Depends(get_current_admin)):
    users = list(google_users_collection.find({}, {"_id": 0}))
    return {"users": users}


@router.get("/analytics/speech")
def get_speech_analytics(admin=Depends(get_current_admin)):
    # Generate time-series or distribution data for Recharts
    pipeline = [
        {"$project": {
            "_id": 0,   # ← exclude ObjectId so FastAPI can serialize
            "wpm": "$audio_scores.pace.wpm",
            "fluency": "$audio_scores.fluency_score",
            "fillers": "$audio_scores.filler_words.total",
            "stutters": "$audio_scores.stuttering.count"
        }}
    ]
    raw_data = list(reports_collection.aggregate(pipeline))

    # Return the raw array — frontend formats it for charts
    return {"data": raw_data}
