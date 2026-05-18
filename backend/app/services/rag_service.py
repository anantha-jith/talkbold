"""
rag_service.py — Lazy-loading RAG service for cloud deployment.

Models are loaded on first use (not at import time) to stay within
the 512MB RAM limit of Render's free tier.
"""

from pptx import Presentation

# ── All Heavy ML dependencies removed to save memory ──────────────────────────
# Vector DB and local embedding models have been completely eliminated.
# Presentation context is now injected directly into the Gemini prompt.


def extract_ppt_text(file_path):
    presentation = Presentation(file_path)
    slides = []

    for i, slide in enumerate(presentation.slides):
        text = ""
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                text += shape.text + " "

        slides.append({
            "slide_number": i + 1,
            "content": text.strip()
        })

    return slides


def assess_ppt_quality(slides):
    """
    Inspect the extracted slides and return a quality report dict.
    Determines whether the PPT has meaningful content or is blank/poor.
    """
    total_slides = len(slides)
    blank_slides = [s for s in slides if len(s["content"].strip()) < 5]
    total_words = sum(len(s["content"].split()) for s in slides)
    non_blank = total_slides - len(blank_slides)

    has_content = total_words >= 20 and non_blank > 0

    if total_slides == 0:
        verdict = "NO_SLIDES"
        summary = "The uploaded file contains no slides at all. The PPT is completely empty."
    elif len(blank_slides) == total_slides:
        verdict = "ALL_BLANK"
        summary = (
            f"The uploaded PPT has {total_slides} slide(s) but ALL are blank with no text content. "
            "This is an unacceptable presentation file. There is nothing to evaluate from the PPT side."
        )
    elif total_words < 20:
        verdict = "EXTREMELY_POOR"
        summary = (
            f"The uploaded PPT has {total_slides} slide(s) with only {total_words} total words. "
            "This is an extremely poor and insufficient presentation with almost no content."
        )
    elif non_blank < 3:
        verdict = "POOR"
        summary = (
            f"The uploaded PPT has {total_slides} slide(s) but only {non_blank} contain actual text. "
            f"The total word count is {total_words}. This is a weak presentation."
        )
    else:
        verdict = "ACCEPTABLE"
        summary = (
            f"The PPT has {total_slides} slides with {total_words} total words across {non_blank} non-blank slides."
        )

    return {
        "verdict": verdict,
        "summary": summary,
        "total_slides": total_slides,
        "blank_slides": len(blank_slides),
        "total_words": total_words,
        "has_content": has_content
    }


def store_embeddings(session_id, slides):
    # DEPRECATED: We no longer store embeddings in ChromaDB to save memory.
    # Text is now injected directly into the ppt_quality dict.
    pass

def retrieve_relevant(query):
    # DEPRECATED: RAG is now handled by passing the full PPT text to Gemini.
    return ["[No relevant PPT content found]"]