"""
robotic_detection_service.py — Detects robotic, memorized, or AI-generated scripted delivery.

Two detection layers:
  1. TEXT ANALYSIS: Vocabulary diversity, sentence uniformity, AI-phrase fingerprints,
     absence of natural disfluencies, repetitive phrasing, passive voice overuse.
  2. AUDIO SIGNAL (librosa): Monotone pitch, uniform speaking pace, energy flatness,
     absence of natural prosodic variation.

Returns a verdict dict with a robotic_score 0-100 (higher = more robotic/scripted).
"""

import re
import math
import numpy as np

# ──────────────────────────────────────────────────────────────
# TEXT-BASED DETECTION
# ──────────────────────────────────────────────────────────────

# Phrases that appear extremely frequently in AI-generated or memorized scripts
AI_SCRIPT_PHRASES = [
    "in conclusion", "to summarize", "as we can see", "it is important to note",
    "it is worth noting", "first and foremost", "in this presentation",
    "allow me to explain", "let me explain", "as mentioned earlier",
    "the purpose of this", "the main objective", "in today's world",
    "in the modern era", "plays a crucial role", "plays an important role",
    "with that being said", "having said that", "without further ado",
    "this slide covers", "this slide shows", "as shown in the slide",
    "moving on to", "the next slide", "turning our attention to",
    "i would like to", "i will now", "thank you for listening",
    "are you following", "does that make sense", "is that clear",
    "in layman's terms", "simply put", "in a nutshell",
    "needless to say", "it goes without saying",
    "last but not least", "to put it simply",
    "the following", "as follows", "as outlined",
]

# Starters that indicate rote memorization (presenter reading bullet points)
ROTE_STARTERS = [
    r"^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)[,\s]",
    r"^(firstly|secondly|thirdly)[,\s]",
    r"^(point (one|two|three|four|five|1|2|3|4|5))[,\s:]",
    r"^(number (one|two|three|four|five|1|2|3|4|5))[,\s:]",
    r"^(moving on|next up|next we have|the next topic)",
    r"^(so (as|we) (can see|discussed|mentioned))",
]

# Natural speech markers that scripted delivery lacks
NATURAL_SPEECH_MARKERS = [
    r"\buh\b", r"\bum\b", r"\blike\b", r"\byou know\b",
    r"\bi mean\b", r"\bactually\b", r"\bbasically\b",
    r"\bright\b", r"\bokay so\b", r"\bso yeah\b",
    r"\bwait\b", r"\bhold on\b", r"\blet me think\b",
    r"\bwell\b", r"\bhm+\b", r"\bah+\b",
]


def _sentences(text: str) -> list:
    """Split text into sentences."""
    raw = re.split(r"(?<=[.!?])\s+", text.strip())
    return [s.strip() for s in raw if len(s.strip()) > 5]


def _words(text: str) -> list:
    return re.findall(r"\b[a-zA-Z']+\b", text.lower())


def compute_type_token_ratio(words: list) -> float:
    """TTR: ratio of unique words to total words. Low TTR = repetitive vocabulary."""
    if not words:
        return 1.0
    return len(set(words)) / len(words)


def compute_sentence_length_uniformity(sentences: list) -> float:
    """
    How uniform are sentence lengths?
    High uniformity (low CV) → robotic / scripted.
    Returns a 0-1 score (1 = perfectly uniform = very robotic).
    """
    if len(sentences) < 3:
        return 0.0
    lengths = [len(s.split()) for s in sentences]
    mean = np.mean(lengths)
    std  = np.std(lengths)
    if mean == 0:
        return 0.0
    cv = std / mean  # coefficient of variation
    # CV < 0.2 → very uniform (robotic). CV > 0.7 → natural variation.
    uniformity = max(0.0, 1.0 - (cv / 0.7))
    return round(min(uniformity, 1.0), 3)


def count_ai_phrases(text: str) -> dict:
    """Count AI/scripted phrase fingerprints in the text."""
    lower = text.lower()
    hits = [phrase for phrase in AI_SCRIPT_PHRASES if phrase in lower]
    return {"count": len(hits), "phrases": hits[:10]}  # show top 10


def count_rote_starters(sentences: list) -> int:
    """Count sentences that start with memorized rote markers."""
    count = 0
    for sent in sentences:
        for pat in ROTE_STARTERS:
            if re.match(pat, sent.lower()):
                count += 1
                break
    return count


def count_natural_markers(text: str) -> int:
    """Count natural speech disfluencies — their ABSENCE indicates scripted delivery."""
    lower = text.lower()
    count = 0
    for pat in NATURAL_SPEECH_MARKERS:
        count += len(re.findall(pat, lower))
    return count


def compute_phrase_repetition_score(sentences: list) -> float:
    """
    Detect repeated n-gram phrases across sentences.
    High repetition → memorized/scripted.
    Returns a 0-1 score (1 = heavily repetitive).
    """
    if len(sentences) < 3:
        return 0.0

    # Build 3-gram fingerprints from each sentence
    bigrams = []
    for sent in sentences:
        words = sent.lower().split()
        if len(words) >= 3:
            grams = [" ".join(words[i:i+3]) for i in range(len(words)-2)]
            bigrams.extend(grams)

    if not bigrams:
        return 0.0

    from collections import Counter
    freq = Counter(bigrams)
    repeated = sum(1 for v in freq.values() if v > 1)
    ratio = repeated / max(len(set(bigrams)), 1)
    return round(min(ratio * 2, 1.0), 3)  # scale up for sensitivity


def detect_passive_voice_ratio(text: str) -> float:
    """
    Passive voice is overused in scripted/AI content.
    Simple heuristic: 'is/are/was/were/been + past participle'
    """
    passive_pattern = r"\b(is|are|was|were|been|being)\s+\w+ed\b"
    passive_count = len(re.findall(passive_pattern, text.lower()))
    words = _words(text)
    if not words:
        return 0.0
    ratio = passive_count / max(len(words) / 10, 1)
    return round(min(ratio, 1.0), 3)


def analyze_text_robotics(text: str) -> dict:
    """
    Full text-based robotic/scripted delivery analysis.
    Returns a dict with individual scores and overall robotic_score (0-100).
    """
    if not text or len(text.strip()) < 30:
        return {"available": False, "robotic_score": 0}

    sentences = _sentences(text)
    words = _words(text)
    word_count = len(words)

    # Individual metrics
    ttr          = compute_type_token_ratio(words)
    uniformity   = compute_sentence_length_uniformity(sentences)
    ai_phrases   = count_ai_phrases(text)
    rote_count   = count_rote_starters(sentences)
    natural_count = count_natural_markers(text)
    repetition   = compute_phrase_repetition_score(sentences)
    passive_ratio = detect_passive_voice_ratio(text)

    # Naturalness density (natural markers per 100 words)
    natural_density = (natural_count / max(word_count, 1)) * 100

    # ── Scoring ───────────────────────────────────────────────
    # Each sub-score contributes to the final robotic_score (0-100)
    score = 0

    # Low TTR → repetitive vocab → +robotic
    if ttr < 0.35:
        score += 25
    elif ttr < 0.45:
        score += 15
    elif ttr < 0.55:
        score += 8

    # High sentence uniformity → scripted
    score += uniformity * 20

    # AI phrases (each one is a strong signal)
    score += min(ai_phrases["count"] * 5, 25)

    # Rote starters (enumerated bullet points)
    score += min(rote_count * 4, 20)

    # Absence of natural markers (≤ 0.5 per 100 words → suspicious)
    if natural_density < 0.5:
        score += 20
    elif natural_density < 1.5:
        score += 10
    elif natural_density < 3.0:
        score += 5

    # Phrase repetition
    score += repetition * 15

    # Passive voice overuse
    score += passive_ratio * 10

    score = min(round(score), 100)

    # Verdict label
    if score >= 70:
        label   = "Highly Robotic / AI-Generated"
        severity = "critical"
    elif score >= 50:
        label   = "Scripted / Memorized Delivery"
        severity = "high"
    elif score >= 35:
        label   = "Partially Scripted"
        severity = "medium"
    else:
        label   = "Natural Delivery"
        severity = "low"

    # Flags for LLM prompt injection
    flags = []
    if ai_phrases["count"] >= 3:
        flags.append(f"Used {ai_phrases['count']} AI-scripted phrases (e.g. '{ai_phrases['phrases'][0]}')")
    if uniformity > 0.6:
        flags.append("Sentence lengths are suspiciously uniform — indicates rote memorization")
    if ttr < 0.45:
        flags.append(f"Vocabulary diversity is low (TTR={ttr:.2f}) — repetitive word usage")
    if natural_density < 1.0:
        flags.append("Almost no natural speech disfluencies detected — sounds like reading a script")
    if rote_count >= 3:
        flags.append(f"{rote_count} sentences start with enumeration markers (First/Second/Moving on…)")
    if repetition > 0.3:
        flags.append("Repeated phrases across sentences detected — memorized delivery pattern")

    return {
        "available":         True,
        "robotic_score":     score,
        "label":             label,
        "severity":          severity,
        "ttr":               round(ttr, 3),
        "sentence_uniformity": uniformity,
        "ai_phrase_count":   ai_phrases["count"],
        "ai_phrases_found":  ai_phrases["phrases"],
        "rote_starter_count": rote_count,
        "natural_marker_count": natural_count,
        "natural_density":   round(natural_density, 2),
        "phrase_repetition": repetition,
        "passive_ratio":     passive_ratio,
        "flags":             flags,
    }


# ──────────────────────────────────────────────────────────────
# AUDIO SIGNAL–BASED DETECTION (via librosa)
# ──────────────────────────────────────────────────────────────

def analyze_audio_robotics(audio_path: str) -> dict:
    """
    Uses librosa to detect monotone/robotic audio delivery.
    Checks: pitch variance, energy variance, speaking pace uniformity.
    Returns a dict with audio_robotic_score (0-100).
    """
    try:
        import librosa
    except ImportError:
        return {"available": False}

    try:
        y, sr = librosa.load(audio_path, sr=16000, mono=True, duration=120)
    except Exception:
        return {"available": False}

    results = {"available": True}

    # ── 1. Pitch (F0) variance ────────────────────────────────
    # Monotone = low pitch variance → robotic
    try:
        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=librosa.note_to_hz("C2"),
            fmax=librosa.note_to_hz("C7"),
            sr=sr
        )
        voiced_f0 = f0[voiced_flag & (f0 > 0)] if voiced_flag is not None else np.array([])
        if len(voiced_f0) > 10:
            pitch_cv = float(np.std(voiced_f0) / (np.mean(voiced_f0) + 1e-6))
            results["pitch_cv"] = round(pitch_cv, 4)
            # CV < 0.05 → extremely monotone
            results["monotone_pitch"] = pitch_cv < 0.05
        else:
            results["pitch_cv"] = None
            results["monotone_pitch"] = False
    except Exception:
        results["pitch_cv"] = None
        results["monotone_pitch"] = False

    # ── 2. Energy (RMS) variance ──────────────────────────────
    # Flat energy = robotic, no emotional dynamics
    try:
        rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=512)[0]
        nonzero_rms = rms[rms > 0.001]
        if len(nonzero_rms) > 10:
            energy_cv = float(np.std(nonzero_rms) / (np.mean(nonzero_rms) + 1e-6))
            results["energy_cv"] = round(energy_cv, 4)
            results["flat_energy"] = energy_cv < 0.25
        else:
            results["energy_cv"] = None
            results["flat_energy"] = False
    except Exception:
        results["energy_cv"] = None
        results["flat_energy"] = False

    # ── 3. Speaking rate uniformity (chunk-level RMS) ─────────
    # Scripted speakers tend to have very consistent pace with no rushes or slowdowns
    try:
        chunk_size = sr * 5  # 5-second chunks
        chunks = [y[i:i+chunk_size] for i in range(0, len(y)-chunk_size, chunk_size)]
        if len(chunks) >= 3:
            chunk_rms = [float(np.sqrt(np.mean(c**2))) for c in chunks]
            pace_cv = float(np.std(chunk_rms) / (np.mean(chunk_rms) + 1e-6))
            results["pace_cv"] = round(pace_cv, 4)
            results["uniform_pace"] = pace_cv < 0.20
        else:
            results["pace_cv"] = None
            results["uniform_pace"] = False
    except Exception:
        results["pace_cv"] = None
        results["uniform_pace"] = False

    # ── 4. Compute audio robotic score ────────────────────────
    audio_score = 0
    if results.get("monotone_pitch"):
        audio_score += 40
    elif results.get("pitch_cv") is not None and results["pitch_cv"] < 0.10:
        audio_score += 20

    if results.get("flat_energy"):
        audio_score += 35
    elif results.get("energy_cv") is not None and results["energy_cv"] < 0.40:
        audio_score += 15

    if results.get("uniform_pace"):
        audio_score += 25

    results["audio_robotic_score"] = min(audio_score, 100)

    return results
