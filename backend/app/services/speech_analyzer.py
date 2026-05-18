"""
speech_analyzer.py — Real audio feature extraction using librosa.

Computes DETERMINISTIC, signal-based metrics from recorded audio.
These metrics drive the scoring engine — nothing is random.

Metrics extracted:
    - Silence / pause analysis (count, duration, density)
    - Energy consistency (RMS variance, energy drops)
    - Speaking rate estimation (from non-silent segments + word count)
    - Spectral clarity (brightness, stability)
    - Pitch stability (voiced frame analysis)
    - Speech continuity score (aggregate)
"""

import numpy as np
import os

# ── Safe imports ─────────────────────────────────────────────
try:
    import librosa
    LIBROSA_OK = True
except ImportError:
    LIBROSA_OK = False


SR          = 16000      # sample rate for all processing
HOP         = 512        # hop length for frame-level features
FRAME_LEN   = 2048       # FFT frame length
MIN_PAUSE_S = 0.25       # minimum silence to be counted as a pause (seconds)
SILENCE_THR = 0.12       # fraction of mean RMS below which frames are silent


def _rms_silence_analysis(y: np.ndarray, sr: int) -> dict:
    """Compute silence ratio, pause count, and pause durations from RMS energy."""
    import librosa

    rms        = librosa.feature.rms(y=y, frame_length=FRAME_LEN, hop_length=HOP)[0]
    threshold  = np.mean(rms) * SILENCE_THR
    is_speech  = rms > threshold

    silence_ratio = 1.0 - float(np.sum(is_speech) / max(len(is_speech), 1))

    # Walk frames to collect pause segments
    frame_dur = HOP / sr
    pauses: list[float] = []
    in_pause = False
    pause_start = 0.0

    for i, speaking in enumerate(is_speech):
        t = i * frame_dur
        if not speaking and not in_pause:
            in_pause = True
            pause_start = t
        elif speaking and in_pause:
            dur = t - pause_start
            if dur >= MIN_PAUSE_S:
                pauses.append(dur)
            in_pause = False

    duration_s     = librosa.get_duration(y=y, sr=sr)
    pause_count    = len(pauses)
    avg_pause      = float(np.mean(pauses)) if pauses else 0.0
    max_pause      = float(np.max(pauses))  if pauses else 0.0
    pause_density  = pause_count / max(duration_s / 10.0, 1.0)   # pauses per 10 s

    # Energy inconsistency — high CV = unsteady delivery
    energy_cv      = float(np.std(rms)) / max(float(np.mean(rms)), 1e-8)
    energy_drops   = int(np.sum(rms < threshold * 0.5))
    energy_drop_r  = energy_drops / max(len(rms), 1)

    return {
        "silence_ratio":      round(silence_ratio, 4),
        "pause_count":        pause_count,
        "avg_pause_s":        round(avg_pause, 3),
        "max_pause_s":        round(max_pause, 3),
        "pause_density":      round(pause_density, 3),
        "energy_cv":          round(energy_cv, 4),
        "energy_drop_ratio":  round(energy_drop_r, 4),
        "non_silence_ratio":  round(1.0 - silence_ratio, 4),
    }


def _spectral_analysis(y: np.ndarray, sr: int) -> dict:
    """Spectral centroid and zero-crossing rate as proxies for clarity."""
    import librosa

    centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=HOP)[0]
    zcr      = librosa.feature.zero_crossing_rate(y, hop_length=HOP)[0]

    # Normalise centroid to [0,1] range assuming 8000 Hz max useful range
    clarity   = float(np.mean(centroid)) / 8000.0
    clarity   = min(max(clarity, 0.0), 1.0)

    # Stability: low std relative to mean = stable spectral content
    stability = 1.0 - min(float(np.std(centroid)) / max(float(np.mean(centroid)), 1.0), 1.0)

    zcr_mean  = float(np.mean(zcr))

    return {
        "spectral_clarity":   round(clarity, 4),
        "spectral_stability": round(stability, 4),
        "zcr_mean":           round(zcr_mean, 6),
    }


def _pitch_analysis(y: np.ndarray, sr: int) -> dict:
    """Voiced pitch statistics using pyin — skipped if too slow."""
    try:
        import librosa
        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'),
            sr=sr, hop_length=HOP
        )
        voiced = f0[voiced_flag & ~np.isnan(f0)]
        if len(voiced) < 10:
            raise ValueError("Too few voiced frames")

        mean_f0   = float(np.mean(voiced))
        std_f0    = float(np.std(voiced))
        variation = std_f0 / max(mean_f0, 1.0)
        stability = max(0.0, 1.0 - variation * 3)

        return {
            "pitch_mean_hz":   round(mean_f0, 1),
            "pitch_std_hz":    round(std_f0, 1),
            "pitch_variation": round(variation, 4),
            "pitch_stability": round(stability, 4),
        }
    except Exception:
        return {
            "pitch_mean_hz":   0.0,
            "pitch_std_hz":    0.0,
            "pitch_variation": 0.3,
            "pitch_stability": 0.5,
        }


def _speech_continuity(silence_ratio, energy_cv, pause_density, energy_drop_ratio) -> float:
    """
    Aggregate speech continuity score [0..1].
    1.0 = perfectly continuous delivery.
    """
    score = 1.0
    score -= silence_ratio * 0.5
    score -= min(energy_cv * 0.3, 0.25)
    score -= min(pause_density * 0.05, 0.15)
    score -= energy_drop_ratio * 0.2
    return round(max(0.0, min(1.0, score)), 4)


def _prosody_features(y: np.ndarray, sr: int) -> dict:
    """
    Professional acoustic prosody features used in clinical speech analysis.

    Jitter  – pitch period irregularity (nervousness / inconsistency).
              Typical normal range: < 1 %  (relative)
    Shimmer – amplitude cycle irregularity (vocal strain).
              Typical normal range: < 6 %  (relative)
    HNR     – harmonics-to-noise ratio proxy via spectral flatness.
              High HNR ≈ clean, harmonic voice.  Low HNR ≈ breathy/noisy.
    """
    try:
        import librosa

        # ── F0 extraction ─────────────────────────────────────
        f0, voiced_flag, _ = librosa.pyin(
            y, fmin=librosa.note_to_hz('C2'), fmax=librosa.note_to_hz('C7'),
            sr=sr, hop_length=HOP
        )
        voiced_f0 = f0[voiced_flag & ~np.isnan(f0)]

        if len(voiced_f0) >= 10:
            # Jitter (local relative): mean |ΔT| / mean T  (as percentage)
            periods    = 1.0 / np.maximum(voiced_f0, 1.0)
            jitter_rel = float(np.mean(np.abs(np.diff(periods))) / np.mean(periods))
        else:
            jitter_rel = 0.02   # neutral default

        # ── Shimmer from RMS ──────────────────────────────────
        rms = librosa.feature.rms(y=y, frame_length=FRAME_LEN, hop_length=HOP)[0]
        if len(rms) >= 4:
            shimmer_rel = float(np.mean(np.abs(np.diff(rms))) / max(np.mean(rms), 1e-8))
        else:
            shimmer_rel = 0.05

        # ── HNR proxy via spectral flatness ───────────────────
        # Spectral flatness: 0 = tonal/harmonic, 1 = pure noise
        flatness   = librosa.feature.spectral_flatness(y=y, hop_length=HOP)[0]
        flat_mean  = float(np.mean(flatness))
        # Convert to dB-like HNR: high flatness → low HNR
        hnr_proxy  = max(0.0, -10.0 * np.log10(flat_mean + 1e-8))  # 0–40 dB range

        # ── Voice quality composite [0..1] ────────────────────
        j_ok = jitter_rel  < 0.01      # < 1% jitter
        s_ok = shimmer_rel < 0.06      # < 6% shimmer
        h_ok = hnr_proxy   > 15.0      # > 15 dB HNR
        voice_quality = (int(j_ok) + int(s_ok) + int(h_ok)) / 3.0

        return {
            "jitter_rel":    round(jitter_rel * 100, 3),   # convert to %
            "shimmer_rel":   round(shimmer_rel * 100, 3),  # convert to %
            "hnr_db":        round(hnr_proxy, 2),
            "voice_quality": round(voice_quality, 3),
        }
    except Exception:
        return {
            "jitter_rel":    2.0,
            "shimmer_rel":   5.0,
            "hnr_db":        15.0,
            "voice_quality": 0.5,
        }


# ══════════════════════════════════════════════════════════════
# MASTER EXTRACTION FUNCTION
# ══════════════════════════════════════════════════════════════

def extract_audio_features(audio_path: str, word_count: int = 0) -> dict:
    """
    Extract all audio features from a file path.
    Returns a structured dict of real signal-based metrics.
    Falls back gracefully if librosa is unavailable.
    """
    if not LIBROSA_OK:
        return {"available": False, "reason": "librosa not installed"}

    if not os.path.exists(audio_path):
        return {"available": False, "reason": "audio file not found"}

    try:
        import librosa

        # Load audio — librosa handles webm via ffmpeg/audioread
        y, sr = librosa.load(audio_path, sr=SR, mono=True)
        duration_s = librosa.get_duration(y=y, sr=sr)

        if duration_s < 1.0:
            return {"available": False, "reason": "audio too short"}

        # Run all analyses
        silence  = _rms_silence_analysis(y, sr)
        spectral = _spectral_analysis(y, sr)
        pitch    = _pitch_analysis(y, sr)
        prosody  = _prosody_features(y, sr)

        continuity = _speech_continuity(
            silence["silence_ratio"],
            silence["energy_cv"],
            silence["pause_density"],
            silence["energy_drop_ratio"]
        )

        # Speaking rate (WPM) from actual audio duration and word count
        if word_count > 0 and duration_s > 0:
            # Use non-silent speech duration for more accurate WPM
            net_speech_s = duration_s * silence["non_silence_ratio"]
            wpm_actual   = round((word_count / max(net_speech_s, 1.0)) * 60.0, 1)
        else:
            wpm_actual = None

        return {
            "available":        True,
            "duration_s":       round(duration_s, 2),
            "wpm_audio":        wpm_actual,

            # Silence / pause
            "silence_ratio":    silence["silence_ratio"],
            "pause_count":      silence["pause_count"],
            "avg_pause_s":      silence["avg_pause_s"],
            "max_pause_s":      silence["max_pause_s"],
            "pause_density":    silence["pause_density"],

            # Energy
            "energy_cv":            silence["energy_cv"],
            "energy_drop_ratio":    silence["energy_drop_ratio"],
            "non_silence_ratio":    silence["non_silence_ratio"],

            # Spectral
            "spectral_clarity":   spectral["spectral_clarity"],
            "spectral_stability": spectral["spectral_stability"],
            "zcr_mean":           spectral["zcr_mean"],

            # Pitch
            "pitch_mean_hz":   pitch["pitch_mean_hz"],
            "pitch_std_hz":    pitch["pitch_std_hz"],
            "pitch_variation": pitch["pitch_variation"],
            "pitch_stability": pitch["pitch_stability"],

            # Aggregate
            "speech_continuity": continuity,

            # Prosody (clinical-grade acoustic features)
            "jitter_rel":    prosody["jitter_rel"],    # % pitch period irregularity
            "shimmer_rel":   prosody["shimmer_rel"],   # % amplitude irregularity
            "hnr_db":        prosody["hnr_db"],        # harmonics-to-noise ratio dB
            "voice_quality": prosody["voice_quality"], # composite [0-1]
        }

    except Exception as e:
        return {"available": False, "reason": str(e)}


# ══════════════════════════════════════════════════════════════
# SCORING USING AUDIO FEATURES
# ══════════════════════════════════════════════════════════════

def audio_feature_score_adjustments(features: dict) -> dict:
    """
    Returns score ADJUSTMENTS (positive or negative) based on audio features.
    These are added on top of the text-based scores in audio_service.py.
    """
    if not features.get("available"):
        return {"fluency_adj": 0, "confidence_adj": 0, "technical_adj": 0, "notes": []}

    fluency_adj    = 0.0
    confidence_adj = 0.0
    technical_adj  = 0.0
    notes          = []

    sr  = features.get("silence_ratio",    0.0)
    pd  = features.get("pause_density",    0.0)
    ecv = features.get("energy_cv",        0.0)
    edr = features.get("energy_drop_ratio", 0.0)
    con = features.get("speech_continuity", 0.5)
    ps  = features.get("pitch_stability",   0.5)
    ss  = features.get("spectral_stability", 0.5)

    # ── Fluency adjustments (audio-driven) ──────────────────
    # High silence ratio → fragmented delivery
    if sr > 0.40:
        fluency_adj -= 12
        notes.append(f"High silence ratio ({sr:.0%}) — delivery is heavily fragmented.")
    elif sr > 0.28:
        fluency_adj -= 6
        notes.append(f"Elevated silence ratio ({sr:.0%}) — noticeable pauses in delivery.")
    elif sr < 0.12:
        fluency_adj += 4    # smooth, near-continuous speech

    # High pause density
    if pd > 4.0:
        fluency_adj -= 10
        notes.append(f"Very high pause density ({pd:.1f}/10s) — speech is fragmented.")
    elif pd > 2.5:
        fluency_adj -= 5
        notes.append(f"High pause density ({pd:.1f}/10s).")
    elif pd < 1.0:
        fluency_adj += 3

    # Energy inconsistency
    if ecv > 1.0:
        fluency_adj -= 8
        notes.append("Highly inconsistent vocal energy — unsteady delivery.")
    elif ecv > 0.6:
        fluency_adj -= 4
    elif ecv < 0.3:
        fluency_adj += 3   # consistent energy

    # Energy drops (hesitation proxy)
    if edr > 0.35:
        fluency_adj -= 6
    elif edr > 0.20:
        fluency_adj -= 3

    # ── Confidence adjustments (audio-driven) ─────────────────
    # Low speech continuity
    if con < 0.40:
        confidence_adj -= 14
        notes.append("Very low speech continuity — delivery signals high uncertainty.")
    elif con < 0.55:
        confidence_adj -= 7
    elif con > 0.75:
        confidence_adj += 8

    # Pitch stability
    if ps > 0.75:
        confidence_adj += 8
        notes.append("Stable vocal pitch — confident delivery tone.")
    elif ps < 0.35:
        confidence_adj -= 8
        notes.append("Unstable pitch — voice sounds anxious or unsure.")
    elif ps < 0.5:
        confidence_adj -= 4

    # Spectral stability
    if ss > 0.70:
        confidence_adj += 4
    elif ss < 0.35:
        confidence_adj -= 4

    # ── Technical adjustments ─────────────────────────────────────────────
    # Audio can only reflect ARTICULATION quality, not knowledge depth.
    # Keep adjustments small — text-based scoring carries the primary weight.
    sc = features.get("spectral_clarity", 0)
    if sc > 0.55:
        technical_adj += 3   # clear articulation → slight positive
    elif sc < 0.20:
        technical_adj -= 3   # very muddy / unclear speech

    # ── Prosody (jitter / shimmer / HNR) adjustments ─────────
    jitter  = features.get("jitter_rel",  2.0)   # %
    shimmer = features.get("shimmer_rel", 5.0)   # %
    hnr     = features.get("hnr_db",     15.0)
    vq      = features.get("voice_quality", 0.5)

    # Jitter → fluency (irregular pitch = nervous/hesitant)
    if jitter < 0.8:
        fluency_adj += 5
        notes.append(f"Very low pitch jitter ({jitter:.2f}%) — extremely smooth vocal delivery.")
    elif jitter < 1.5:
        fluency_adj += 2
    elif jitter > 3.0:
        fluency_adj -= 8
        notes.append(f"High pitch jitter ({jitter:.2f}%) — irregular pitch, may signal nervousness.")
    elif jitter > 2.0:
        fluency_adj -= 4

    # Shimmer → confidence (amplitude instability = shaky delivery)
    if shimmer < 3.0:
        confidence_adj += 6
        notes.append(f"Very stable vocal amplitude (shimmer {shimmer:.1f}%) — composed delivery.")
    elif shimmer < 6.0:
        confidence_adj += 2
    elif shimmer > 10.0:
        confidence_adj -= 10
        notes.append(f"High shimmer ({shimmer:.1f}%) — vocal amplitude is unstable, signals anxiety.")
    elif shimmer > 7.0:
        confidence_adj -= 5

    # HNR → confidence + technical (clear voice = authoritative)
    if hnr > 25:
        confidence_adj += 6
        technical_adj  += 4
        notes.append(f"Excellent voice clarity (HNR {hnr:.0f} dB) — authoritative, clean delivery.")
    elif hnr > 15:
        confidence_adj += 2
        technical_adj  += 2
    elif hnr < 8:
        confidence_adj -= 8
        notes.append(f"Low HNR ({hnr:.0f} dB) — voice sounds breathy or noisy.")
    elif hnr < 12:
        confidence_adj -= 4

    return {
        "fluency_adj":    int(round(fluency_adj)),
        "confidence_adj": int(round(confidence_adj)),
        "technical_adj":  int(round(technical_adj)),
        "notes":          notes,
    }
