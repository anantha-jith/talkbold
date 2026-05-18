import os


# Load model lazily to save startup time
_model = None

def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    return _model

def check_domain_alignment(topic: str, script: str, ppt_context: str):
    """
    Returns a dictionary of alignment warnings based on cosine similarity
    between the inputs. Uses an ML embedding model to detect if the user
    is inputting a script completely unrelated to the PPT.
    """
    model = get_model()
    from sentence_transformers import util

    # We take a sample of the script and ppt to speed up embedding and avoid token limits
    script_sample = script[:2000] if script else ""
    ppt_sample = ppt_context[:2000] if ppt_context else ""
    
    if not script_sample or not ppt_sample:
        return {"error": "Missing script or PPT content to compare"}

    # Compute embeddings
    embeddings = model.encode([topic, script_sample, ppt_sample], convert_to_tensor=True)
    
    topic_emb = embeddings[0]
    script_emb = embeddings[1]
    ppt_emb = embeddings[2]
    
    # Calculate Cosine Similarities
    # 1. How well does the script match the PPT?
    script_ppt_sim = util.pytorch_cos_sim(script_emb, ppt_emb).item()
    
    # 2. How well does the topic match the PPT?
    topic_ppt_sim = util.pytorch_cos_sim(topic_emb, ppt_emb).item()

    warnings = []
    
    # Threshold tuning for all-MiniLM-L6-v2: 
    # To differentiate between two Computer Science topics (like Compilers vs Networks),
    # the threshold must be strict because they share a lot of common vocabulary.
    
    is_script_mismatched = script_ppt_sim < 0.40
    is_topic_mismatched = topic_ppt_sim < 0.25

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
        "topic_ppt_similarity": topic_ppt_sim,
        "is_script_mismatched": is_script_mismatched,
        "is_topic_mismatched": is_topic_mismatched,
        "warnings": warnings
    }
