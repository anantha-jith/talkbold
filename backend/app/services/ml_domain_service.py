"""
ml_domain_service.py — Domain alignment check using Gemini embeddings.
Uses google-genai SDK (same shared client as llm_service).
"""

import math


def check_domain_alignment(topic: str, script: str, ppt_context: str):
    """
    Returns a dictionary of alignment warnings based on cosine similarity
    between the inputs. Uses Gemini API to detect if the user
    is inputting a script completely unrelated to the PPT.
    """
    # We take a sample of the script and ppt to speed up embedding and avoid token limits
    script_sample = script[:2000] if script else ""
    ppt_sample = ppt_context[:2000] if ppt_context else ""

    if not script_sample or not ppt_sample:
        return {"error": "Missing script or PPT content to compare"}

    def cosine_similarity(v1, v2):
        dot_product = sum(a * b for a, b in zip(v1, v2))
        magnitude_v1 = math.sqrt(sum(a * a for a in v1))
        magnitude_v2 = math.sqrt(sum(b * b for b in v2))
        if magnitude_v1 == 0 or magnitude_v2 == 0:
            return 0.0
        return dot_product / (magnitude_v1 * magnitude_v2)

    try:
        from app.services.llm_service import _get_client
        client = _get_client()

        # Batch embed all three texts in one API call (zero local memory)
        result = client.models.embed_content(
            model="gemini-embedding-2",
            contents=[topic, script_sample, ppt_sample],
        )

        # Extract float vectors from the response
        embeddings = [e.values for e in result.embeddings]
        topic_emb  = embeddings[0]
        script_emb = embeddings[1]
        ppt_emb    = embeddings[2]

        # Calculate cosine similarities
        script_ppt_sim = cosine_similarity(script_emb, ppt_emb)
        topic_ppt_sim  = cosine_similarity(topic_emb, ppt_emb)

    except Exception as e:
        print(f"[ML Domain Check Error] {e}")
        return {}

    warnings = []

    is_script_mismatched = script_ppt_sim < 0.40
    is_topic_mismatched  = topic_ppt_sim  < 0.25

    if is_script_mismatched:
        warnings.append(
            "CRITICAL WARNING: The ML Alignment Model has detected that your Script content "
            "does not match the domain of the uploaded PPT. (E.g., You pasted a script for "
            "a different subject than the PPT you uploaded). The AI will likely heavily penalize this."
        )

    if is_topic_mismatched:
        warnings.append(
            f"WARNING: The provided topic '{topic}' does not seem to accurately match the actual content found in the PPT."
        )

    return {
        "script_ppt_similarity": script_ppt_sim,
        "topic_ppt_similarity":  topic_ppt_sim,
        "is_script_mismatched":  is_script_mismatched,
        "is_topic_mismatched":   is_topic_mismatched,
        "warnings":              warnings,
    }
