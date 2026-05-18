from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.services.rag_service import retrieve_relevant
from app.services.llm_service import analyze_presentation
from app.services.db_service import reports_collection
from app.services.ml_domain_service import check_domain_alignment
from app.services.robotic_detection_service import analyze_text_robotics

router = APIRouter()


class AnalyzeRequest(BaseModel):
    topic: str
    slides: str
    script: str
    ppt_quality: Optional[dict] = None
    transcription: Optional[str] = None   # Whisper transcription of spoken audio
    audio_scores: Optional[dict] = None   # Confidence/fluency/pace scores


@router.post("/")
def analyze(data: AnalyzeRequest):

    # We now get the context directly from the injected field
    context = ""
    if data.ppt_quality:
        context = data.ppt_quality.get("extracted_text", "")

    # Build PPT quality warning
    ppt_warning = ""
    if data.ppt_quality:
        verdict = data.ppt_quality.get("verdict", "")
        summary = data.ppt_quality.get("summary", "")
        if verdict in ("ALL_BLANK", "NO_SLIDES", "EXTREMELY_POOR", "POOR"):
            ppt_warning = f"""
⚠️ AUTOMATED PPT QUALITY ALERT ⚠️
{summary}
You MUST explicitly call this out in your Presentation Analysis and Final Verdict.
Do NOT give the student the benefit of the doubt on PPT quality.
The student cannot score above 4/10 if the PPT is blank or nearly empty.
"""
    elif not context.strip() or context.strip() == "[No relevant PPT content found]":
        ppt_warning = """
⚠️ AUTOMATED PPT QUALITY ALERT ⚠️
No meaningful PPT content was extracted. The uploaded presentation appears to be blank or empty.
You MUST explicitly state this in your analysis. Do NOT fabricate PPT content.
The student cannot score above 4/10 if the PPT is blank.
"""

    # ML Domain Alignment Check
    alignment_data = check_domain_alignment(data.topic, data.script, context)
    if alignment_data.get("is_script_mismatched"):
        # FAST FAIL: Bypass LLM and return blocked analysis
        score = alignment_data.get('script_ppt_similarity', 0)
        blocked_analysis = f"""### Presentation Analysis
⚠️ **CRITICAL DOMAIN MISMATCH DETECTED** ⚠️

Our ML alignment models have detected that your provided script has absolutely no semantic relation to the uploaded presentation. 
(Similarity Score: {score:.2f})

Please verify your script and ensure you are discussing the concepts present in the uploaded PPT. The system cannot perform a valid evaluation until the script aligns with the presentation content.

### Missing Concepts
[BLOCKED] There is no relation between the script and the PPT.

### Suggestions
[BLOCKED] There is no relation between the script and the PPT.

### Viva Questions
[BLOCKED] There is no relation between the script and the PPT.

### Final Verdict
[BLOCKED] Score: 0/10 - Domain Mismatch
"""
        return {
            "analysis": blocked_analysis,
            "domain_mismatch": True
        }

    elif alignment_data.get("warnings"):
        ml_warning_str = "\n".join(alignment_data["warnings"])
        score_str = f"\n[ML Similarity Score (Script vs PPT): {alignment_data.get('script_ppt_similarity', 0):.2f}]"
        
        ppt_warning += f"""
⚠️ ML DOMAIN ALIGNMENT WARNING ⚠️
{ml_warning_str}
{score_str}
WARN THE USER ABOUT THIS IN THE FIRST PARAGRAPH OF YOUR ANALYSIS.
"""

    # ── Robotic / Scripted Delivery Detection ───────────────────
    effective_text = data.transcription.strip() if data.transcription and data.transcription.strip() else data.script
    robotic_result = analyze_text_robotics(effective_text)
    if robotic_result.get("available") and robotic_result["robotic_score"] >= 35:
        flags_str = "\n".join(f"  - {f}" for f in robotic_result["flags"])
        ppt_warning += f"""
⚠️ AUTOMATED ROBOTIC/SCRIPTED DELIVERY DETECTION ⚠️
Robotic Score: {robotic_result['robotic_score']}/100 — Verdict: {robotic_result['label']}
Detected Signals:
{flags_str}

YOU MUST EXPLICITLY FLAG THIS IN YOUR PRESENTATION ANALYSIS.
Tell the student their delivery appears memorized/scripted/AI-generated.
Cite specific evidence: vocabulary diversity ({robotic_result['ttr']:.2f} TTR),
AI-phrases found: {robotic_result['ai_phrase_count']}, natural speech markers: {robotic_result['natural_density']:.1f} per 100 words.
DO NOT give a high score if delivery appears robotic.
"""

    # Build enriched audio context including real signal features
    audio_context  = ""
    audio_metrics  = None

    if data.transcription and data.transcription.strip():
        audio_context = f"""
--------------------------------------------------
AUDIO TRANSCRIPTION (Whisper — student's actual spoken words)
--------------------------------------------------

{data.transcription}

"""
        if data.audio_scores:
            s = data.audio_scores
            af = s.get("audio_features", {})  # real librosa features
            fw = s.get("filler_words", {})
            u  = s.get("uncertainty", {})
            pace = s.get("pace", {})
            st = s.get("stuttering", {})
            rp = s.get("phrase_repetitions", {})

            audio_context += f"""
--------------------------------------------------
AUTOMATED SPEECH ANALYSIS (computed — do NOT alter these numbers)
--------------------------------------------------

Confidence Score  : {s.get('confidence_score', 'N/A')}%
Fluency Score     : {s.get('fluency_score', 'N/A')}%
Technical Score   : {s.get('technical_confidence_score', 'N/A')}%
Speaking Pace     : {pace.get('wpm', 'N/A')} WPM — {pace.get('label', '')}
Filler Words      : {fw.get('total', 0)} (hesitations: {fw.get('hesitation_count', 0)}, discourse: {fw.get('discourse_count', 0)})
Stutters          : {st.get('count', 0)} events
Phrase Repeats    : {rp.get('count', 0)} repeated 3-grams
Uncertain Phrases : {u.get('uncertainty_total', 0)}
Confidence Phrases: {u.get('confidence_total', 0)}
Sentence Restarts : {s.get('restarts', 0)}
"""
            if af.get("available"):
                audio_context += f"""
REAL AUDIO SIGNAL METRICS (librosa):
  Silence Ratio   : {af.get('silence_ratio', 'N/A')} (fraction of recording that is silent)
  Pause Count     : {af.get('pause_count', 'N/A')} pauses ≥250ms
  Avg Pause       : {af.get('avg_pause_s', 'N/A')}s
  Max Pause       : {af.get('max_pause_s', 'N/A')}s
  Pause Density   : {af.get('pause_density', 'N/A')} pauses/10s
  Energy CV       : {af.get('energy_cv', 'N/A')} (vocal energy consistency)
  Speech Continuity: {af.get('speech_continuity', 'N/A')} (0=fragmented, 1=smooth)
  Pitch Stability : {af.get('pitch_stability', 'N/A')}
  Spectral Clarity: {af.get('spectral_clarity', 'N/A')}
"""

            audio_context += """
INSTRUCTION: Ground your speech evaluation on the above computed metrics.
Do NOT generate your own scores. Reference specific numbers in your feedback.
Penalise appropriately for: fillers, hesitations, pauses, uncertainty language, and rote delivery.
"""

            # Pass the full scores dict as structured metrics to the LLM
            audio_metrics = {
                "confidence_score":           s.get("confidence_score"),
                "fluency_score":              s.get("fluency_score"),
                "technical_score":            s.get("technical_confidence_score"),
                "wpm":                        pace.get("wpm"),
                "pace_label":                 pace.get("label"),
                "filler_total":               fw.get("total", 0),
                "hesitation_count":           fw.get("hesitation_count", 0),
                "stutter_count":              st.get("count", 0),
                "phrase_repetitions":         rp.get("count", 0),
                "uncertain_phrases":          u.get("uncertainty_total", 0),
                "sentence_restarts":          s.get("restarts", 0),
                "silence_ratio":              af.get("silence_ratio") if af.get("available") else None,
                "pause_count":                af.get("pause_count") if af.get("available") else None,
                "speech_continuity":          af.get("speech_continuity") if af.get("available") else None,
                "pitch_stability":            af.get("pitch_stability") if af.get("available") else None,
            }

    # Only treat as audio mode if the user actually recorded AND transcribed audio
    has_audio = bool(data.transcription and data.transcription.strip() and data.audio_scores)

    analysis = analyze_presentation(
        data.topic,
        data.slides,
        data.script,
        context,
        ppt_warning=ppt_warning,
        audio_context=audio_context,
        audio_metrics=audio_metrics,
        has_audio=has_audio,
    )

    report = {
        "topic":         data.topic,
        "slides":        data.slides,
        "script":        data.script,
        "transcription": data.transcription or "",
        "audio_scores":  data.audio_scores or {},
        "analysis":      analysis,
    }


    reports_collection.insert_one(report)

    return {
        "analysis": analysis,
        "domain_mismatch": False
    }