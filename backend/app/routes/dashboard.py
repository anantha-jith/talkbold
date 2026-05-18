from fastapi import APIRouter
from app.services.db_service import reports_collection

router = APIRouter()

@router.get("/")
def get_dashboard_stats():
    # Count total documents
    total_presentations = reports_collection.count_documents({})

    # Fetch last 5 documents, assuming natural order (no timestamp field exists currently)
    # We will grab all and just slice the last 5 since there's no _id sorting by default on small datasets
    # or better, sort by _id descending to get the latest
    cursor = reports_collection.find({}, {"_id": 0, "topic": 1, "slides": 1}).sort("_id", -1).limit(5)
    
    recent_analyses = []
    for doc in cursor:
        recent_analyses.append({
            "topic": doc.get("topic", "Untitled Presentation"),
            "status": "Completed",
            "score": 100 # Mock score until backend implements real grading logic
        })

    return {
        "total_presentations": total_presentations,
        "recent_analyses": recent_analyses
    }
