"""
confidence_ml.py — SpeechBrain emotion-based ML confidence analysis.

Model : speechbrain/emotion-recognition-wav2vec2-IEMOCAP
Size  : ~400 MB (downloaded once, cached in pretrained_models/)
Input : audio file path (any format librosa can load)
Output: emotion label + confidence/fluency score adjustments

Emotion → score mapping (IEMOCAP labels: ang, hap, neu, sad):
  hap → +18 conf, +5 fluency   (confident/positive)
  neu →  +2 conf, +2 fluency   (neutral/calm)
  ang →  +6 conf, -3 fluency   (assertive/tense)
  sad → -22 conf, -8 fluency   (low energy)
"""

import os
import logging
import tempfile
import numpy as np

logger = logging.getLogger(__name__)

# ── Optional dependency flags ─────────────────────────────────────────────────
try:
    import torch
    _TORCH_OK = True
except ImportError:
    _TORCH_OK = False

try:
    import speechbrain  # noqa – just checking it's installed
    _SB_OK = True
except ImportError:
    _SB_OK = False

# ── Model config ──────────────────────────────────────────────────────────────
_MODEL_SOURCE  = "speechbrain/emotion-recognition-wav2vec2-IEMOCAP"
_MODEL_DIR     = os.path.join(
    os.path.dirname(__file__), "..", "..", "pretrained_models", "emotion"
)
_MAX_SEC       = 20     # only analyse first 20 s (speed / memory)
_TARGET_SR     = 16000

# ── Emotion → score mapping ───────────────────────────────────────────────────
_EMOTION_MAP = {
    # short IEMOCAP codes
    "ang": dict(label="Assertive/Tense",    conf_adj=+6,  flu_adj=-3,
                note="Assertive vocal tone — shows engagement, but relax for smoother delivery."),
    "hap": dict(label="Confident/Positive", conf_adj=+18, flu_adj=+5,
                note="Strong positive vocal energy — excellent confident delivery."),
    "neu": dict(label="Neutral/Calm",       conf_adj=+2,  flu_adj=+2,
                note="Neutral, controlled vocal delivery — consistent and professional."),
    "sad": dict(label="Low Energy",         conf_adj=-22, flu_adj=-8,
                note="Low vocal energy — delivery sounds uncertain or fatigued."),
    # full-word fallbacks
    "angry":    dict(label="Assertive/Tense",    conf_adj=+6,  flu_adj=-3,  note="Assertive tone."),
    "happy":    dict(label="Confident/Positive", conf_adj=+18, flu_adj=+5,  note="Strong positive energy."),
    "neutral":  dict(label="Neutral/Calm",       conf_adj=+2,  flu_adj=+2,  note="Controlled delivery."),
    "fearful":  dict(label="Nervous/Anxious",    conf_adj=-25, flu_adj=-10, note="Nervous vocal tone detected."),
    "disgust":  dict(label="Flat/Disengaged",    conf_adj=-10, flu_adj=-5,  note="Flat vocal tone detected."),
    "surprised":dict(label="Uncertain",          conf_adj=-5,  flu_adj=-2,  note="Uncertain vocal inflection."),
}

# ── Singleton model cache ─────────────────────────────────────────────────────
_model = None


def _load_model():
    global _model
    if _model is not None:
        return _model
    if not (_SB_OK and _TORCH_OK):
        return None
    try:
        os.makedirs(_MODEL_DIR, exist_ok=True)
        try:
            from speechbrain.inference.classifiers import EncoderClassifier
        except ImportError:
            from speechbrain.pretrained import EncoderClassifier

        logger.info("Loading SpeechBrain emotion model (first run ~400 MB download)…")
        _model = EncoderClassifier.from_hparams(
            source=_MODEL_SOURCE,
            savedir=_MODEL_DIR,
            run_opts={"device": "cpu"},
        )
        logger.info("SpeechBrain model ready.")
        return _model
    except Exception as exc:
        logger.warning(f"SpeechBrain model load failed: {exc}")
        return None


def _prepare_wav(audio_path: str):
    """Trim to _MAX_SEC, resample to 16 kHz, save as temp wav. Returns (path, is_temp)."""
    try:
        import librosa
        import soundfile as sf
        y, _ = librosa.load(audio_path, sr=_TARGET_SR, mono=True, duration=_MAX_SEC)
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        sf.write(tmp.name, y, _TARGET_SR)
        return tmp.name, True
    except Exception as exc:
        logger.warning(f"Audio prep failed: {exc}")
        return audio_path, False


def analyse_emotion(audio_path: str) -> dict:
    """
    Run the SpeechBrain emotion classifier on an audio file.

    Returns a dict with:
        available (bool)
        emotion       – raw label  (hap / neu / ang / sad)
        emotion_label – human label
        emotion_score – model probability [0-1]
        conf_adj      – integer to ADD to confidence_score
        fluency_adj   – integer to ADD to fluency_score
        note          – coaching note for this emotion
        model         – model identifier string
    """
    if not (_SB_OK and _TORCH_OK):
        return {"available": False, "reason": "speechbrain/torch not installed"}
    if not os.path.exists(audio_path):
        return {"available": False, "reason": "audio file missing"}

    model = _load_model()
    if model is None:
        return {"available": False, "reason": "model failed to load"}

    tmp_path = None
    try:
        wav_path, is_temp = _prepare_wav(audio_path)
        if is_temp:
            tmp_path = wav_path

        out_prob, score, index, text_lab = model.classify_file(wav_path)

        raw   = (text_lab[0] if text_lab else "neu").lower().strip()
        prob  = float(score[0]) if score is not None else 0.5
        entry = _EMOTION_MAP.get(raw, _EMOTION_MAP["neu"])

        return {
            "available":     True,
            "emotion":       raw,
            "emotion_label": entry["label"],
            "emotion_score": round(prob, 3),
            "conf_adj":      entry["conf_adj"],
            "fluency_adj":   entry["flu_adj"],
            "note":          entry["note"],
            "model":         "SpeechBrain wav2vec2-IEMOCAP",
        }

    except Exception as exc:
        logger.warning(f"SpeechBrain inference error: {exc}")
        return {"available": False, "reason": str(exc)}
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
