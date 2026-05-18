"""
audio_service.py — Production-grade speech analysis engine.

Scoring philosophy (strict examiner model):
  - Average real speakers score 50–70 on fluency.
  - A perfect score (92+) requires genuinely clean, confident, well-paced delivery.
  - All penalties are additive and grounded in observed linguistic patterns.
"""

import re
import math

# ══════════════════════════════════════════════════════════════
# LEXICONS
# ══════════════════════════════════════════════════════════════

# Core hesitation vocalisations (pattern-based — catches "uhhhh", "ummmm", etc.)
HESITATION_PATTERNS = [
    r'\buh+\b', r'\bum+\b', r'\bah+\b', r'\beh+\b',
    r'\bhmm+\b', r'\bhm+\b', r'\berr+\b', r'\bemm+\b',
]

# Discourse fillers (plain word match)
DISCOURSE_FILLERS = [
    "like", "basically", "actually", "literally", "you know",
    "i mean", "so", "well", "right", "okay", "kind of",
    "sort of", "honestly", "essentially", "technically",
    "and uh", "so uh", "you see", "i guess", "just",
    "anyway", "i suppose", "to be honest", "at the end of the day",
]

# Uncertainty / low-confidence phrases
UNCERTAINTY_PHRASES = [
    "i think", "i believe", "maybe", "probably", "perhaps",
    "not sure", "i'm not sure", "something like", "kind of like",
    "not exactly", "i don't know", "i'm not certain",
    "it might be", "could be", "i guess", "i suppose",
    "sort of", "more or less", "roughly",
]

# Strong-confidence indicators
CONFIDENCE_PHRASES = [
    "therefore", "consequently", "as a result", "this demonstrates",
    "specifically", "in summary", "to conclude", "for example",
    "for instance", "in other words", "this means that",
    "we implemented", "our system", "the algorithm", "the architecture",
    "this proves", "this shows", "clearly", "the result is",
    "the output", "the implementation", "we designed",
]

# ── Technical vocabulary lexicon ───────────────────────────────────────────────
# Used by compute_technical_score to detect genuine domain knowledge
TECHNICAL_VOCAB = frozenset({
    # CS / Software
    "algorithm", "complexity", "implementation", "architecture", "protocol",
    "database", "interface", "framework", "compiler", "runtime", "execution",
    "optimization", "recursion", "iteration", "polymorphism", "inheritance",
    "encapsulation", "abstraction", "decomposition", "modular", "scalable",
    "latency", "throughput", "bandwidth", "concurrency", "synchronization",
    "asynchronous", "distributed", "encryption", "authentication", "authorization",
    "validation", "serialization", "dependency", "integration", "deployment",
    "microservice", "container", "virtualization", "neural", "gradient",
    "convolution", "backpropagation", "tokenization", "embedding", "inference",
    "heuristic", "traversal", "parsing", "lexical", "semantic", "syntax",
    "heap", "stack", "queue", "graph", "tree", "hash", "cache", "buffer",
    "mutex", "semaphore", "thread", "process", "socket", "endpoint",
    "pipeline", "scheduler", "kernel", "overhead", "bottleneck",
    # ML / Data
    "classification", "regression", "clustering", "dimensionality",
    "hyperparameter", "overfitting", "underfitting", "precision", "recall",
    "accuracy", "dataset", "preprocessing", "normalisation", "augmentation",
    "epoch", "batch", "loss", "activation", "pooling", "dropout",
    # Science / Engineering general
    "methodology", "hypothesis", "empirical", "quantitative", "qualitative",
    "evaluation", "benchmark", "simulation", "parameter", "variable",
    "coefficient", "derivative", "differential", "correlation", "oscillation",
    "modulation", "frequency", "amplitude", "threshold", "constraint",
    # Explanation depth markers (technical discourse)
    "demonstrates", "illustrates", "precisely", "fundamentally",
    "theoretically", "systematically", "hierarchically", "iteratively",
})

# Vague / surface-level words — signal shallow understanding
VAGUE_SURFACE = frozenset({
    "stuff", "things", "something", "anything", "everything",
    "somehow", "whatever", "etc", "kind", "sort", "type",
    "basically", "generally", "normally", "usually",
    "kinda", "sorta", "thingy", "whatnot", "blah",
})

# Explanation-depth phrases — signal structured thinking
DEPTH_PHRASES = [
    # Cause-effect
    "because", "therefore", "hence", "thus", "as a result", "consequently",
    # Definition
    "refers to", "is defined as", "means that", "is known as",
    # Structured delivery
    "for example", "for instance", "specifically", "in particular",
    "first", "secondly", "finally", "in summary", "to conclude",
    # Technical assertion
    "the algorithm", "the implementation", "the system", "the architecture",
    "the process", "the output", "the input", "the result", "the model",
    # Comparative
    "compared to", "unlike", "whereas", "however", "on the other hand",
    "this approach", "this method", "this technique",
]

# Sentence-restart markers (sign of broken flow)
RESTART_MARKERS = [
    r'\bi mean\b', r'\bwhere was i\b', r'\bas i was saying\b',
    r'\blet me rephrase\b', r'\bactually wait\b', r'\bno wait\b',
    r'\bsorry\b', r'\blet me start again\b',
]

# Elongated non-filler words (e.g., "sooooo", "reallyyy") — noted but not counted as fillers
ELONGATED_PATTERN = re.compile(r'\b(\w+?)(\w)\2{3,}\b')   # 4+ repeated char at end

# Pace thresholds (words per minute)
PACE_BANDS = [
    (0,   90,  "Too Slow",    "too_slow"),
    (90,  115, "Slow",        "slow"),
    (115, 155, "Optimal",     "optimal"),
    (155, 185, "Fast",        "fast"),
    (185, 999, "Too Fast",    "too_fast"),
]


# ══════════════════════════════════════════════════════════════
# NORMALISATION
# ══════════════════════════════════════════════════════════════

def normalise_elongations(text: str) -> str:
    """
    Collapse elongated speech tokens to their base form.
    'uhhhhhh' → 'uh'   'ahhhhh' → 'ah'   'sooooo' → 'soo' (kept for pace)
    """
    def _collapse(m):
        base = m.group(1) + m.group(2)
        return base  # keep first two chars of repeated suffix

    return ELONGATED_PATTERN.sub(_collapse, text)


# ══════════════════════════════════════════════════════════════
# DETECTION FUNCTIONS
# ══════════════════════════════════════════════════════════════

def detect_fillers(text: str) -> dict:
    """Detect and quantify all filler patterns."""
    normalised = normalise_elongations(text.lower())

    hesitation_matches: dict[str, int] = {}
    for pat in HESITATION_PATTERNS:
        hits = re.findall(pat, normalised)
        if hits:
            # store under canonical key (first 2 chars)
            key = re.sub(r'[+\\b]', '', pat).strip('\\').replace('\\b', '').replace('+', '').replace('\\','')
            # simpler: use first non-regex char sequence
            key = re.sub(r'\\[bBwW]|\[.*?\]|[+*?^${}()|]', '', pat).strip()
            hesitation_matches[key] = hesitation_matches.get(key, 0) + len(hits)

    discourse_matches: dict[str, int] = {}
    for filler in DISCOURSE_FILLERS:
        pat = r'\b' + re.escape(filler) + r'\b'
        count = len(re.findall(pat, normalised))
        if count:
            discourse_matches[filler] = count

    all_matches = {**hesitation_matches, **discourse_matches}
    total = sum(all_matches.values())

    # Elongation events (non-filler but noteworthy)
    elongation_count = len(ELONGATED_PATTERN.findall(text.lower()))

    return {
        "total":              total,
        "hesitation_count":   sum(hesitation_matches.values()),
        "discourse_count":    sum(discourse_matches.values()),
        "elongation_count":   elongation_count,
        "breakdown":          dict(sorted(all_matches.items(), key=lambda x: -x[1])),
    }


def detect_uncertainty(text: str) -> dict:
    """Count uncertainty and confidence phrases."""
    lower = text.lower()
    uncertainty_hits = {}
    for phrase in UNCERTAINTY_PHRASES:
        count = len(re.findall(r'\b' + re.escape(phrase) + r'\b', lower))
        if count:
            uncertainty_hits[phrase] = count

    confidence_hits = {}
    for phrase in CONFIDENCE_PHRASES:
        count = len(re.findall(r'\b' + re.escape(phrase) + r'\b', lower))
        if count:
            confidence_hits[phrase] = count

    return {
        "uncertainty_total":   sum(uncertainty_hits.values()),
        "confidence_total":    sum(confidence_hits.values()),
        "uncertainty_phrases": uncertainty_hits,
        "confidence_phrases":  confidence_hits,
    }


def detect_stuttering(text: str) -> dict:
    """Detect consecutive word repetitions (stuttering)."""
    words = re.sub(r'[^\w\s]', '', text.lower()).split()
    events = []
    i = 0
    while i < len(words) - 1:
        if words[i] == words[i + 1] and len(words[i]) > 1:
            run = 2
            while i + run < len(words) and words[i + run] == words[i]:
                run += 1
            events.append({"word": words[i], "repetitions": run})
            i += run
        else:
            i += 1
    return {"count": len(events), "events": events[:8]}


def detect_phrase_repetition(text: str) -> dict:
    """Detect 3-gram phrase repetition (memorised delivery signal)."""
    words   = re.sub(r'[^\w\s]', '', text.lower()).split()
    phrases = [" ".join(words[i:i + 3]) for i in range(len(words) - 2)]
    freq: dict[str, int] = {}
    for p in phrases:
        freq[p] = freq.get(p, 0) + 1
    repeated = {p: c for p, c in freq.items() if c > 1 and len(p) > 10}
    return {
        "count": len(repeated),
        "top":   dict(sorted(repeated.items(), key=lambda x: -x[1])[:5]),
    }


def detect_restarts(text: str) -> int:
    """Count broken sentence restarts."""
    count = 0
    for pat in RESTART_MARKERS:
        count += len(re.findall(pat, text.lower()))
    return count


def estimate_pace(text: str, duration_seconds: float = None) -> dict:
    word_count = len(text.split())
    if duration_seconds and duration_seconds > 5:
        wpm = (word_count / duration_seconds) * 60
    else:
        wpm = 130   # neutral default when no real duration
    wpm = round(wpm, 1)
    for lo, hi, label, key in PACE_BANDS:
        if lo <= wpm < hi:
            return {"wpm": wpm, "label": label, "key": key}
    return {"wpm": wpm, "label": "Unknown", "key": "unknown"}


def lexical_diversity(text: str) -> float:
    words = [re.sub(r'[^a-z]', '', w) for w in text.lower().split() if w.isalpha()]
    if len(words) < 5:
        return 0.0
    return round(len(set(words)) / len(words), 4)


# ══════════════════════════════════════════════════════════════
# SCORING ENGINE  (strict examiner model)
# ══════════════════════════════════════════════════════════════

def _clamp(v: float, lo=0, hi=100) -> int:
    return int(max(lo, min(hi, round(v))))


def compute_fluency(word_count, filler_data, stutter_data, rep_data, restarts, pace) -> int:
    """
    Strict examiner model.
    Baseline 72 — most real speakers land 55–75.
    Scores above 88 require genuinely clean, well-paced delivery.
    """
    score = 72.0

    # Filler penalty — each percentage point above 1.5% costs 5.5 points
    filler_density_pct = (filler_data["total"] / max(word_count, 1)) * 100
    if filler_density_pct > 1.5:
        score -= (filler_density_pct - 1.5) * 5.5

    # Hesitation vocalisation penalty (stricter than general fillers)
    hes_density_pct = (filler_data["hesitation_count"] / max(word_count, 1)) * 100
    score -= hes_density_pct * 4

    # Stutter penalty
    score -= stutter_data["count"] * 5

    # Phrase repetition penalty (memorised delivery)
    rep_ratio = rep_data["count"] / max(word_count / 10, 1)   # repeats per 10 words
    score -= min(rep_ratio * 8, 20)

    # Sentence restart penalty
    score -= min(restarts * 3.5, 14)

    # Elongation penalty
    score -= min(filler_data["elongation_count"] * 2, 10)

    # Pace penalty
    pace_key = pace.get("key", "")
    if pace_key == "too_slow":   score -= 12
    elif pace_key == "too_fast": score -= 9
    elif pace_key == "slow":     score -= 5
    elif pace_key == "fast":     score -= 3

    return _clamp(score, 15, 94)


def compute_confidence(word_count, uncertainty_data, filler_data, stutter_data, pace) -> int:
    """
    Baseline 48 — below average. Real confident speakers must actively earn points.
    Max achievable without strong confidence indicators: ~68.
    """
    score = 48.0

    # Uncertainty penalty — each percentage point above 2% costs 6 points
    u_density = (uncertainty_data["uncertainty_total"] / max(word_count, 1)) * 100
    score -= max(0, u_density - 1) * 6

    # Confidence phrase bonus (hard cap)
    conf_bonus = min(uncertainty_data["confidence_total"] * 3.5, 28)
    score += conf_bonus

    # Filler penalty
    filler_density_pct = (filler_data["total"] / max(word_count, 1)) * 100
    score -= filler_density_pct * 3

    # Hesitation penalty (worse than general fillers for confidence)
    hes_density = (filler_data["hesitation_count"] / max(word_count, 1)) * 100
    score -= hes_density * 4

    # Stutter penalty
    score -= stutter_data["count"] * 4

    # Pace bonus/penalty
    pace_key = pace.get("key", "")
    if pace_key == "optimal":    score += 9
    elif pace_key == "fast":     score += 4
    elif pace_key == "too_fast": score -= 7
    elif pace_key == "too_slow": score -= 10

    return _clamp(score, 10, 92)


def compute_technical_score(text: str, uncertainty_data: dict, rep_data: dict) -> int:
    """
    Strict technical knowledge assessment.

    Scoring philosophy:
      Baseline  40  — strict. Most real speakers start here.
      Max       88  — requires dense technical vocabulary + structured explanation.
      Minimum    8  — for incoherent / purely vague speech.

    Components:
      +25  Technical vocabulary ratio (real domain-specific terms)
      +20  Explanation depth (cause-effect, definitions, structured discourse)
      +15  Lexical diversity above 0.55 threshold
      - 0  Uncertainty language (density-weighted, cap -32)
      - 0  Memorised/repeated delivery (cap -22)
      - 0  Vague surface words (cap -15)
      - 0  Word count too short penalty (cap -12)
    """
    words = [re.sub(r'[^a-z]', '', w) for w in text.lower().split() if w.isalpha()]
    word_count = len(words)
    if word_count < 15:
        return 15   # too short — cannot assess technical depth

    lower        = text.lower()
    unique_words = set(words)

    # ── Component 1: Technical vocabulary (max +25) ──────────────────────────
    # Count unique recognised technical/domain terms in the transcript
    tech_hits  = len(unique_words & TECHNICAL_VOCAB)
    tech_ratio = tech_hits / max(len(unique_words), 1)
    tech_bonus = min(tech_ratio * 220, 25)   # ~11% tech ratio needed for max

    # ── Component 2: Explanation depth (max +20) ──────────────────────────────
    depth_hits  = sum(1 for phrase in DEPTH_PHRASES if phrase in lower)
    depth_bonus = min(depth_hits * 2.2, 20)

    # ── Component 3: Lexical diversity above threshold (max +15) ─────────────
    lex_div   = len(unique_words) / word_count
    # Only reward diversity above 0.55 — below that is repetitive / monotone
    lex_bonus = min(max(lex_div - 0.55, 0) * 80, 15)

    # ── Penalty 1: Uncertainty language (max -32) ─────────────────────────────
    u_total   = uncertainty_data["uncertainty_total"]
    u_density = (u_total / max(word_count, 1)) * 100
    # Both density and raw count contribute — density catches short vague answers
    u_penalty = min(u_density * 9 + u_total * 1.2, 32)

    # ── Penalty 2: Memorised delivery — phrase repetition (max -22) ──────────
    rep_count   = rep_data["count"]
    mem_penalty = min(rep_count * 5, 22)

    # ── Penalty 3: Vague surface language (max -15) ───────────────────────────
    vague_hits    = sum(1 for v in VAGUE_SURFACE if v in unique_words)
    vague_penalty = min(vague_hits * 3.5, 15)

    # ── Penalty 4: Too short — shallow coverage (max -12) ─────────────────────
    # A proper technical explanation needs at least 100 words
    if word_count < 100:
        length_penalty = (100 - word_count) / 100 * 12
    elif word_count < 50:
        length_penalty = 12
    else:
        length_penalty = 0

    raw = (40.0
           + tech_bonus
           + depth_bonus
           + lex_bonus
           - u_penalty
           - mem_penalty
           - vague_penalty
           - length_penalty)

    return _clamp(raw, 8, 88)


# ══════════════════════════════════════════════════════════════
# PROFESSOR ADVICE GENERATOR
# ══════════════════════════════════════════════════════════════

def _advice(severity, category, issue, fix):
    return {"severity": severity, "category": category, "issue": issue, "fix": fix}


def generate_advice(filler_data, stutter_data, rep_data, restarts,
                    uncertainty_data, pace, confidence_score, fluency_score) -> list:
    advice = []

    # ── Pace ──
    pk = pace.get("key", "")
    wpm = pace.get("wpm", 130)
    if pk == "too_slow":
        advice.append(_advice("high", "Speaking Pace",
            f"You spoke at {wpm} WPM — far too slow. Examiners interpret this as uncertainty.",
            "Target 120–150 WPM. Record yourself with a metronome app. "
            "Slow delivery signals memorised, unnatural recitation."))
    elif pk == "slow":
        advice.append(_advice("medium", "Speaking Pace",
            f"Pace of {wpm} WPM is below optimal. Your delivery sounds rehearsed.",
            "Add energy to your delivery. Think of explaining to a colleague, not reciting."))
    elif pk == "too_fast":
        advice.append(_advice("high", "Speaking Pace",
            f"You spoke at {wpm} WPM — dangerously fast. Examiners cannot follow.",
            "Slow down deliberately. Pause for 1 full second after every key claim. "
            "Speed is not confidence — it reads as anxiety."))
    elif pk == "fast":
        advice.append(_advice("low", "Speaking Pace",
            f"Pace of {wpm} WPM is slightly above ideal.",
            "Insert deliberate pauses after stating a key technical fact."))

    # ── Fillers ──
    total_f = filler_data["total"]
    top3 = list(filler_data["breakdown"].items())[:3]
    top3_str = ", ".join([f'"{w}" ×{c}' for w, c in top3]) if top3 else ""

    if total_f >= 20:
        advice.append(_advice("high", "Filler Words — Critical",
            f"{total_f} filler words detected. {top3_str}. This severely damages credibility.",
            "Replace every filler with a 0.5-second silence. Silence is powerful — "
            "it signals you are thinking, not panicking. Record yourself and count fillers daily."))
    elif total_f >= 10:
        advice.append(_advice("high", "Filler Words",
            f"{total_f} filler words found. {top3_str}.",
            "Practice 'clean' speaking. After each sentence, pause — do not fill the gap with 'um'. "
            "A viva examiner notices every filler."))
    elif total_f >= 5:
        advice.append(_advice("medium", "Filler Words",
            f"{total_f} fillers: {top3_str}.",
            "You have a moderate filler habit. Stay conscious of it, especially under pressure."))
    elif total_f > 0:
        advice.append(_advice("low", "Filler Words",
            f"{total_f} minor fillers. Minimal impact.",
            "Good filler control overall. Keep monitoring under exam pressure."))

    # ── Hesitation vocalisations ──
    hes = filler_data["hesitation_count"]
    if hes >= 8:
        advice.append(_advice("high", "Hesitation Vocalisations",
            f"{hes} 'um/uh/ah/err' sounds detected.",
            "These are the most damaging filler type in a viva. "
            "Practice the pause-instead-of-vocalise technique: "
            "when you feel an 'um' coming, close your mouth and breathe for 1 second."))
    elif hes >= 3:
        advice.append(_advice("medium", "Hesitation Vocalisations",
            f"{hes} hesitation sounds detected.",
            "Work on replacing vocal hesitations with deliberate silent pauses."))

    # ── Uncertainty phrases ──
    u = uncertainty_data["uncertainty_total"]
    u_phrases = list(uncertainty_data["uncertainty_phrases"].keys())[:4]
    if u >= 8:
        advice.append(_advice("high", "Weak / Uncertain Language",
            f"{u} uncertainty phrases detected: {', '.join(u_phrases[:3])}.",
            "NEVER say 'I think' or 'maybe' in a viva. "
            "Replace with direct statements: 'The system uses X because Y.' "
            "Uncertainty language drops your grade immediately."))
    elif u >= 4:
        advice.append(_advice("medium", "Uncertain Language",
            f"{u} uncertain expressions: {', '.join(u_phrases[:3])}.",
            "Replace 'I think the output is...' with 'The output is...' — own your knowledge."))
    elif u > 0:
        advice.append(_advice("low", "Uncertain Language",
            f"{u} minor uncertain phrases.",
            "Watch for 'I think' and 'maybe' — replace with direct statements."))

    # ── Stuttering ──
    if stutter_data["count"] >= 4:
        ex = [f'"{e["word"]}" ×{e["repetitions"]}' for e in stutter_data["events"][:3]]
        advice.append(_advice("high", "Stuttering / Word Repetition",
            f"Detected {stutter_data['count']} stutter events: {', '.join(ex)}.",
            "Stuttering under pressure is common. Technique: before answering, "
            "take ONE deliberate breath, then speak. Do not rush. The examiner respects composure."))
    elif stutter_data["count"] > 0:
        advice.append(_advice("medium", "Minor Stuttering",
            f"{stutter_data['count']} repeated word(s) detected.",
            "Breathe before each new point. Slow deliberate starts prevent stutters."))

    # ── Phrase repetition ──
    if rep_data["count"] >= 6:
        advice.append(_advice("high", "Memorised Delivery Detected",
            f"{rep_data['count']} repeated phrase sequences — strong sign of rote memorisation.",
            "The examiner will probe you on these repeated areas to test genuine understanding. "
            "Instead of memorising sentences, understand the concept and explain it fresh each time."))
    elif rep_data["count"] >= 3:
        advice.append(_advice("medium", "Phrase Repetition",
            f"{rep_data['count']} phrases repeated.",
            "Vary your sentence construction. Rephrase concepts in multiple ways."))

    # ── Restarts ──
    if restarts >= 3:
        advice.append(_advice("medium", "Sentence Restarts / Broken Flow",
            f"{restarts} sentence restarts detected.",
            "Plan your explanation structure before speaking. "
            "Use: Point → Reason → Example. This prevents mid-sentence corrections."))

    # ── Overall confidence ──
    if confidence_score < 40:
        advice.append(_advice("high", "Overall Confidence Level",
            f"Confidence score: {confidence_score}% — below acceptable level for a viva.",
            "Your language patterns suggest significant uncertainty. "
            "Practise explaining your project to a friend without notes. "
            "If you cannot explain it simply, you do not know it well enough."))
    elif confidence_score < 60:
        advice.append(_advice("medium", "Confidence Level",
            f"Confidence score {confidence_score}% indicates moderate uncertainty.",
            "Stand tall, speak directly, and trust your preparation."))

    return advice


# ══════════════════════════════════════════════════════════════
# MASTER ANALYSIS FUNCTION
# ══════════════════════════════════════════════════════════════

def score_confidence(text: str, duration_seconds: float = None) -> dict:
    """
    Full production-grade speech analysis.
    Returns scores, breakdown, and ranked professor advice.
    """
    if not text or not text.strip():
        return {
            "confidence_score":           0,
            "fluency_score":              0,
            "technical_confidence_score": 0,
            "summary":                    "No transcription provided.",
            "filler_words":               {"total": 0, "hesitation_count": 0, "discourse_count": 0, "elongation_count": 0, "breakdown": {}},
            "stuttering":                 {"count": 0, "events": []},
            "phrase_repetitions":         {"count": 0, "top": {}},
            "restarts":                   0,
            "uncertainty":                {"uncertainty_total": 0, "confidence_total": 0, "uncertainty_phrases": {}, "confidence_phrases": {}},
            "pace":                       {"wpm": 0, "label": "Unknown", "key": "unknown"},
            "advice":                     [],
        }

    word_count    = len(text.split())
    filler_data   = detect_fillers(text)
    stutter_data  = detect_stuttering(text)
    rep_data      = detect_phrase_repetition(text)
    restarts      = detect_restarts(text)
    uncertainty   = detect_uncertainty(text)
    pace          = estimate_pace(text, duration_seconds)
    lex_div       = lexical_diversity(text)

    fluency_score    = compute_fluency(word_count, filler_data, stutter_data, rep_data, restarts, pace)
    confidence_score = compute_confidence(word_count, uncertainty, filler_data, stutter_data, pace)
    technical_score  = compute_technical_score(text, uncertainty, rep_data)

    advice = generate_advice(filler_data, stutter_data, rep_data, restarts,
                             uncertainty, pace, confidence_score, fluency_score)

    # Summary string
    issues = []
    if filler_data["total"] > 5:
        issues.append(f"{filler_data['total']} fillers")
    if stutter_data["count"] > 1:
        issues.append(f"{stutter_data['count']} stutters")
    if uncertainty["uncertainty_total"] > 4:
        issues.append(f"{uncertainty['uncertainty_total']} uncertain phrases")
    if pace["key"] in ("too_slow", "too_fast"):
        issues.append(f"pace {pace['label']} ({pace['wpm']} WPM)")

    summary = (
        f"Pace: {pace['wpm']} WPM ({pace['label']}). "
        f"Fillers: {filler_data['total']} (hesitations: {filler_data['hesitation_count']}). "
        f"Stutters: {stutter_data['count']}. "
        f"Uncertain phrases: {uncertainty['uncertainty_total']}. "
        f"Phrase repeats: {rep_data['count']}."
        + (f" Issues: {'; '.join(issues)}." if issues else " Delivery broadly acceptable.")
    )

    return {
        "confidence_score":           confidence_score,
        "fluency_score":              fluency_score,
        "technical_confidence_score": technical_score,
        "summary":                    summary,
        "filler_words":               filler_data,
        "stuttering":                 stutter_data,
        "phrase_repetitions":         rep_data,
        "restarts":                   restarts,
        "uncertainty":                uncertainty,
        "pace":                       pace,
        "advice":                     advice,
    }


# ══════════════════════════════════════════════════════════════
# WHISPER TRANSCRIPTION
# ══════════════════════════════════════════════════════════════

def transcribe_with_whisper(audio_path: str) -> dict:
    """Try openai-whisper first, fall back to faster-whisper."""
    try:
        import whisper
        model    = whisper.load_model("tiny")
        result   = model.transcribe(audio_path, task="transcribe", language=None)  # auto-detect language
        text     = result.get("text", "").strip()
        segments = result.get("segments", [])
        duration = segments[-1].get("end") if segments else None
        detected_lang = result.get("language", "unknown")
        # Build segment list with language. openai-whisper doesn't per-seg lang by default,
        # but we can use avg_logprob to flag very uncertain segments as potentially mixed.
        seg_list = []
        for seg in segments:
            seg_list.append({
                "text":     seg.get("text", ""),
                "language": detected_lang,  # openai-whisper detects at file level
                "avg_logprob": seg.get("avg_logprob", 0),
            })
        return {
            "success": True,
            "transcription": text,
            "duration_seconds": duration,
            "language": detected_lang,
            "segments": seg_list,
        }
    except ImportError:
        pass
    except Exception as e:
        return {"success": False, "transcription": "", "error": f"openai-whisper: {str(e)}"}

    try:
        from faster_whisper import WhisperModel
        model      = WhisperModel("tiny", device="cpu", compute_type="int8")
        segs, info = model.transcribe(audio_path, beam_size=5, language=None, vad_filter=True)
        seg_objects = list(segs)  # consume generator
        text       = " ".join(s.text.strip() for s in seg_objects)
        detected_lang = getattr(info, "language", "unknown")
        # faster-whisper provides language per segment via info.language_probability
        seg_list = [{
            "text":     s.text.strip(),
            "language": detected_lang,
            "avg_logprob": getattr(s, "avg_logprob", 0),
        } for s in seg_objects]
        return {
            "success": True,
            "transcription": text,
            "duration_seconds": getattr(info, "duration", None),
            "language": detected_lang,
            "segments": seg_list,
        }
    except Exception as e:
        return {"success": False, "transcription": "", "error": f"Whisper error: {str(e)}"}

