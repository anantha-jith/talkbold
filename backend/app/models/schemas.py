from pydantic import BaseModel
from typing import Optional, List

class UploadResponse(BaseModel):
    session_id: str
    slides_extracted: int
    message: str

class AnalyzeRequest(BaseModel):
    session_id: str
    transcript: str
    domain: str = "computer science"

class EvaluationResult(BaseModel):
    session_id: str
    relevance_score: float
    coverage_score: float
    confidence_score: float
    clarity_score: float
    overall_score: float
    feedback: List[str]
    skipped_slides: List[int]

class VivaRequest(BaseModel):
    session_id: str
    weak_areas: List[str]
    domain: str = "computer science"

class VivaResponse(BaseModel):
    questions: List[str]