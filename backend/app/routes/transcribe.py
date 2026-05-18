"""
transcribe.py — Audio transcription + hybrid speech analysis endpoint.

Pipeline:
  1. Save audio file
  2. Run Whisper transcription (+ language detection)
  3. English-only gate
  4. Run librosa audio feature extraction (REAL signal metrics)
  5. Run text-based analysis on transcription
  6. Merge audio features into final scores
  7. Delete audio file
  8. Return comprehensive metrics
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import uuid

from app.services.audio_service    import score_confidence, transcribe_with_whisper
from app.services.speech_analyzer  import extract_audio_features, audio_feature_score_adjustments
from app.services.confidence_ml    import analyse_emotion
from app.services.robotic_detection_service import analyze_text_robotics, analyze_audio_robotics

def _clamp(v, lo=0, hi=100):
    return int(max(lo, min(hi, round(v))))

router = APIRouter()

AUDIO_DIR = "uploads/audio"

# Only English is accepted
SUPPORTED_LANGUAGES = {"en"}

LANGUAGE_NAMES = {
    "ta": "Tamil",     "hi": "Hindi",      "te": "Telugu",    "kn": "Kannada",
    "ml": "Malayalam", "mr": "Marathi",    "gu": "Gujarati",  "pa": "Punjabi",
    "bn": "Bengali",   "ur": "Urdu",       "ar": "Arabic",    "zh": "Chinese",
    "fr": "French",    "de": "German",     "es": "Spanish",   "ja": "Japanese",
    "ko": "Korean",    "ru": "Russian",    "pt": "Portuguese","it": "Italian",
}


@router.post("/")
async def transcribe_audio(file: UploadFile = File(...)):
    """
    Full hybrid analysis:
      text analysis (filler/uncertainty/pace detection)
      + real audio signal analysis (librosa features)
      → merged deterministic scores
    """
    os.makedirs(AUDIO_DIR, exist_ok=True)

    audio_id   = str(uuid.uuid4())
    ext        = file.filename.split(".")[-1] if "." in file.filename else "webm"
    audio_path = os.path.join(AUDIO_DIR, f"{audio_id}.{ext}")

    with open(audio_path, "wb") as f:
        f.write(await file.read())

    # ── 1. Whisper transcription ──────────────────────────────
    whisper_result = transcribe_with_whisper(audio_path)

    if not whisper_result["success"]:
        _cleanup(audio_path)
        raise HTTPException(
            status_code=500,
            detail=f"Transcription failed: {whisper_result.get('error', 'Unknown')}"
        )

    # ── 2. English-only gate ──────────────────────────────────
    detected_lang = (whisper_result.get("language") or "unknown").lower().strip()
    if detected_lang not in SUPPORTED_LANGUAGES:
        _cleanup(audio_path)
        lang_name = LANGUAGE_NAMES.get(detected_lang, detected_lang.upper())
        raise HTTPException(
            status_code=422,
            detail={
                "error":         "language_not_supported",
                "detected":      detected_lang,
                "detected_name": lang_name,
                "message": (
                    f"Only English speech is supported. "
                    f"Detected: {lang_name}. Please re-record in English."
                ),
            }
        )

    # ── 2b. Mixed-language / code-switching detection ─────────
    # Whisper returns per-segment language probabilities. Check each segment.
    segments = whisper_result.get("segments", [])
    for seg in segments:
        seg_lang = (seg.get("language") or detected_lang).lower().strip()
        if seg_lang not in SUPPORTED_LANGUAGES:
            _cleanup(audio_path)
            lang_name = LANGUAGE_NAMES.get(seg_lang, seg_lang.upper())
            raise HTTPException(
                status_code=422,
                detail={
                    "error":         "mixed_language_detected",
                    "detected":      seg_lang,
                    "detected_name": lang_name,
                    "message": (
                        f"Mixed language detected in your speech. "
                        f"Found '{lang_name}' words within your English recording. "
                        f"Please speak only in English throughout your entire presentation."
                    ),
                }
            )

    transcription = whisper_result["transcription"].strip()
    duration      = whisper_result.get("duration_seconds")

    if not transcription or len(transcription) < 8:
        _cleanup(audio_path)
        raise HTTPException(
            status_code=422,
            detail={
                "error":   "empty_transcription",
                "message": "No speech detected. Please speak clearly and try again."
            }
        )

    # ── 3. Real audio feature extraction (librosa) ────────────
    word_count      = len(transcription.split())
    audio_features  = extract_audio_features(audio_path, word_count=word_count)

    # ── 4. ML emotion analysis (SpeechBrain) ────────────────
    #    Runs BEFORE cleanup so file still exists
    ml_emotion = analyse_emotion(audio_path)

    # ── 5. Audio Robotic Detection (librosa) ─────────────────
    audio_robotic = analyze_audio_robotics(audio_path)

    # NOW safe to delete — all audio processing done
    _cleanup(audio_path)

    # ── 6. Text-based robotic detection ──────────────────────
    text_robotic = analyze_text_robotics(transcription)

    # ── 4. Text-based speech analysis ─────────────────────────
    audio_scores = score_confidence(transcription, duration_seconds=duration)

    # ── 5. Merge audio feature adjustments into scores ────────
    if audio_features.get("available"):
        adjs = audio_feature_score_adjustments(audio_features)

        audio_scores["fluency_score"]              = _clamp(
            audio_scores["fluency_score"]              + adjs["fluency_adj"])
        audio_scores["confidence_score"]           = _clamp(
            audio_scores["confidence_score"]           + adjs["confidence_adj"])
        audio_scores["technical_confidence_score"] = _clamp(
            audio_scores["technical_confidence_score"] + adjs["technical_adj"])

        for note in adjs.get("notes", []):
            audio_scores["advice"].insert(0, {
                "severity": "medium",
                "category": "Audio Signal Analysis",
                "issue":    note,
                "fix": "Measured from your actual voice recording. Practice smooth, continuous delivery."
            })

        if audio_features.get("wpm_audio"):
            audio_scores["pace"]["wpm"] = audio_features["wpm_audio"]

    # ── 6. Apply ML emotion adjustments ──────────────────────
    if ml_emotion.get("available"):
        audio_scores["confidence_score"] = _clamp(
            audio_scores["confidence_score"] + ml_emotion["conf_adj"])
        audio_scores["fluency_score"]     = _clamp(
            audio_scores["fluency_score"]     + ml_emotion["fluency_adj"])
        # Inject emotion note as a high-priority advice item
        audio_scores["advice"].insert(0, {
            "severity": "medium" if ml_emotion["conf_adj"] >= 0 else "high",
            "category": f"AI Vocal Emotion: {ml_emotion['emotion_label']}",
            "issue":    ml_emotion["note"],
            "fix":      "SpeechBrain wav2vec2 neural model detected this from your actual voice recording."
        })

    # Attach raw features + ML result for frontend display
    audio_scores["audio_features"]  = audio_features
    audio_scores["ml_emotion"]      = ml_emotion
    audio_scores["robotic_text"]    = text_robotic
    audio_scores["robotic_audio"]   = audio_robotic

    # ── Inject robotic detection penalties ───────────────────
    combined_robotic = 0
    if text_robotic.get("available"):
        combined_robotic += text_robotic["robotic_score"] * 0.6
    if audio_robotic.get("available"):
        combined_robotic += audio_robotic.get("audio_robotic_score", 0) * 0.4

    if combined_robotic >= 50:
        # Penalise confidence for sounding robotic
        audio_scores["confidence_score"] = _clamp(
            audio_scores["confidence_score"] - int(combined_robotic * 0.15))
        audio_scores["fluency_score"] = _clamp(
            audio_scores["fluency_score"] - int(combined_robotic * 0.10))

    if text_robotic.get("available") and text_robotic["robotic_score"] >= 35:
        severity = text_robotic["severity"]
        flags_str = "; ".join(text_robotic["flags"][:3]) if text_robotic["flags"] else "Scripted patterns detected"
        audio_scores["advice"].insert(0, {
            "severity": severity if severity != "low" else "medium",
            "category": f"🤖 Delivery Analysis: {text_robotic['label']}",
            "issue":    f"Robotic/Scripted Score: {text_robotic['robotic_score']}/100. {flags_str}.",
            "fix":      "Speak from understanding, not memory. Vary sentence structure, use natural pauses, and demonstrate conceptual thinking rather than reciting prepared text."
        })

    if audio_robotic.get("available") and audio_robotic.get("audio_robotic_score", 0) >= 40:
        issues = []
        if audio_robotic.get("monotone_pitch"):  issues.append("monotone pitch (no vocal variation)")
        if audio_robotic.get("flat_energy"):      issues.append("flat vocal energy (no dynamics)")
        if audio_robotic.get("uniform_pace"):     issues.append("uniform speaking pace (no natural acceleration/slowdown)")
        audio_scores["advice"].insert(0, {
            "severity": "high",
            "category": "🔊 Audio Robotic Signal Analysis",
            "issue":    f"Audio signals indicate robotic delivery: {', '.join(issues)}.",
            "fix":      "Add natural pitch variation, emphasize key words, and vary your speaking pace to sound more engaged and confident."
        })

    return {
        "transcription":    transcription,
        "duration_seconds": duration,
        "language":         detected_lang,
        "audio_scores":     audio_scores,
    }


def _cleanup(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
    except Exception:
        pass
