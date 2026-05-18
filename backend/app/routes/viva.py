from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict

from app.services.llm_service import chat_viva, evaluate_viva

router = APIRouter()


class VivaRequest(BaseModel):
    topic: str
    messages: List[Dict[str, str]]
    evaluate: bool = False


@router.post("/")
def viva(data: VivaRequest):
    if data.evaluate:
        result = evaluate_viva(data.topic, data.messages)
    else:
        result = chat_viva(data.topic, data.messages)

    return {
        "viva": result
    }