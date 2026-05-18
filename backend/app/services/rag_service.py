"""
rag_service.py — Lazy-loading RAG service for cloud deployment.

Models are loaded on first use (not at import time) to stay within
the 512MB RAM limit of Render's free tier.
"""

from pptx import Presentation

# ── Lazy globals (loaded on first use) ────────────────────────────────────────
_model = None
_client = None
_collection = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _get_collection():
    global _client, _collection
    if _collection is None:
        import chromadb
        _client = chromadb.Client()
        _collection = _client.get_or_create_collection("slides")
    return _collection


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
    # Filter out blank slides before storing so the vector store stays clean
    meaningful = [s for s in slides if len(s["content"].strip()) >= 5]

    if not meaningful:
        return  # nothing to store

    model = _get_model()
    collection = _get_collection()

    docs = [s["content"] for s in meaningful]
    ids = [f"{session_id}_{i}" for i in range(len(meaningful))]

    embeddings = model.encode(docs).tolist()

    collection.add(
        documents=docs,
        embeddings=embeddings,
        ids=ids
    )


def retrieve_relevant(query):
    model = _get_model()
    collection = _get_collection()

    query_embedding = model.encode([query]).tolist()

    try:
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=3
        )
        docs = results["documents"][0]
        # Filter out empty strings returned from blank-slide collections
        return [d for d in docs if d.strip()] or ["[No relevant PPT content found]"]
    except Exception:
        return ["[No PPT content available — the uploaded file may have been blank]"]