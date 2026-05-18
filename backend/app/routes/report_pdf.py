from fastapi import APIRouter
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from app.services.pdf_service import build_report_pdf

router = APIRouter()


class PDFRequest(BaseModel):
    topic: str
    analysis_sections: dict          # { analysis, missing, suggestions, viva, verdict }
    audio_scores: Optional[dict] = None
    ppt_quality: Optional[dict]  = None


@router.post("/")
def generate_pdf(data: PDFRequest):
    pdf_bytes = build_report_pdf({
        "topic":             data.topic,
        "analysis_sections": data.analysis_sections,
        "audio_scores":      data.audio_scores,
        "ppt_quality":       data.ppt_quality,
    })

    return Response(
        content=bytes(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="viva_report_{data.topic[:20].replace(" ", "_")}.pdf"'
        }
    )
