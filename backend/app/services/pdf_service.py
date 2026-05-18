"""
pdf_service.py — Professional PDF report generator using fpdf2.
"""

from fpdf import FPDF
from fpdf.enums import XPos, YPos
import datetime
import re as _re


# ── Colour palette ──────────────────────────────────────────
PRIMARY   = (59,  130, 246)
SUCCESS   = (34,  197, 94)
WARNING   = (234, 179, 8)
DANGER    = (239, 68,  68)
MUTED     = (107, 114, 128)
BG_LIGHT  = (248, 250, 252)
BORDER    = (226, 232, 240)
TEXT_DARK = (15,  23,  42)
TEXT_MID  = (51,  65,  85)


# ── Unicode → ASCII sanitiser ────────────────────────────────
# fpdf2 Helvetica only covers Latin-1. Any char outside that range crashes.
_UNICODE_MAP = str.maketrans({
    "\u2014": "-",    # em dash  —
    "\u2013": "-",    # en dash  –
    "\u2012": "-",    # figure dash
    "\u2015": "-",    # horizontal bar
    "\u2018": "'",    # left single quotation
    "\u2019": "'",    # right single quotation / apostrophe
    "\u201c": '"',    # left double quotation
    "\u201d": '"',    # right double quotation
    "\u2026": "...",  # ellipsis
    "\u2192": "->",   # right arrow
    "\u2190": "<-",   # left arrow
    "\u2022": "-",    # bullet
    "\u25b6": ">",    # black right-pointing triangle
    "\u2714": "OK",   # check mark
    "\u2718": "X",    # cross mark
    "\u2713": "OK",   # check
    "\u26a0": "!",    # warning sign
    "\u2139": "i",    # information
    "\u24a7": "(i)",  # circled i
    "\u2460": "1.",   # circled 1
    "\u2461": "2.",   # circled 2
    "\u2462": "3.",   # circled 3
    "\u2463": "4.",   # circled 4
    "\u2464": "5.",   # circled 5
    "\u00d7": "x",    # multiplication sign (used as ×)
    "\u00b0": " deg", # degree sign
    "\u03b1": "alpha",
    "\u03b2": "beta",
    "\u03c0": "pi",
    "\u2248": "~",    # almost equal
    "\u2265": ">=",
    "\u2264": "<=",
    "\u2260": "!=",
    "\u00a9": "(c)",
    "\u00ae": "(R)",
    "\u2122": "(TM)",
    "\u00b7": ".",    # middle dot
    "\u00bb": ">>",
    "\u00ab": "<<",
})


def _s(text: str) -> str:
    """
    Sanitise text for Helvetica/Latin-1 fpdf output.
    1. Apply the known map for common Unicode chars.
    2. Drop (replace with '?') any remaining non-Latin-1 character.
    """
    if not text:
        return ""
    text = str(text).translate(_UNICODE_MAP)
    # Final safety: encode to latin-1, replacing unknowns
    return text.encode("latin-1", errors="replace").decode("latin-1")


def _score_color(score: int):
    if score >= 80:  return SUCCESS
    if score >= 60:  return PRIMARY
    if score >= 40:  return WARNING
    return DANGER


class VivaPDF(FPDF):
    def __init__(self):
        super().__init__()
        self.set_auto_page_break(auto=True, margin=18)
        self.set_margins(18, 18, 18)

    # ── Header ──────────────────────────────────────────────
    def header(self):
        self.set_fill_color(*PRIMARY)
        self.rect(0, 0, 210, 12, "F")
        self.set_y(3)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(255, 255, 255)
        self.cell(0, 6, _s("Mock Viva AI - Performance Report"), align="C",
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*TEXT_DARK)
        self.ln(6)

    # ── Footer ──────────────────────────────────────────────
    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 7)
        self.set_text_color(*MUTED)
        self.cell(0, 5,
                  _s(f"Generated {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}  |  Page {self.page_no()}"),
                  align="C")
        self.set_text_color(*TEXT_DARK)

    # ── Helpers ─────────────────────────────────────────────
    def section_title(self, title: str):
        self.ln(4)
        self.set_font("Helvetica", "B", 12)
        self.set_text_color(*PRIMARY)
        self.cell(0, 7, _s(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_draw_color(*PRIMARY)
        self.set_line_width(0.4)
        self.line(self.get_x(), self.get_y(), self.get_x() + 174, self.get_y())
        self.set_draw_color(*BORDER)
        self.set_text_color(*TEXT_DARK)
        self.ln(2)

    def body_text(self, text: str):
        self.set_font("Helvetica", "", 9)
        self.set_text_color(*TEXT_MID)
        self.multi_cell(0, 5, _s(text), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*TEXT_DARK)
        self.ln(1)

    def score_bar(self, label: str, score: int, width: int = 130):
        """Horizontal progress bar with label and percentage."""
        color = _score_color(score)
        y = self.get_y()
        x = self.get_x()

        self.set_font("Helvetica", "", 9)
        self.set_text_color(*TEXT_MID)
        self.cell(44, 6, _s(label), new_x=XPos.RIGHT, new_y=YPos.TOP)

        self.set_fill_color(*BORDER)
        self.rect(x + 44, y + 1, width, 4, "F")

        filled = int((score / 100) * width)
        self.set_fill_color(*color)
        self.rect(x + 44, y + 1, filled, 4, "F")

        self.set_xy(x + 44 + width + 3, y)
        self.set_font("Helvetica", "B", 9)
        self.set_text_color(*color)
        self.cell(16, 6, f"{score}%", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*TEXT_DARK)
        self.ln(2)

    def bullet(self, text: str, indent: int = 6):
        self.set_x(self.get_x() + indent)
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(*TEXT_MID)
        self.multi_cell(0, 5, _s(f"- {text}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_text_color(*TEXT_DARK)

    def advice_block(self, item: dict):
        sev   = item.get("severity", "info")
        color = DANGER if sev == "high" else (WARNING if sev == "medium" else (PRIMARY if sev == "low" else MUTED))
        sev_label = {"high": "[!!] HIGH", "medium": "[!] MEDIUM", "low": "[OK] LOW", "info": "[i] TIP"}.get(sev, "INFO")

        y_start = self.get_y()
        self.set_fill_color(*color)
        self.rect(self.l_margin, y_start, 2, 18, "F")

        self.set_x(self.l_margin + 5)
        self.set_font("Helvetica", "B", 7.5)
        self.set_text_color(*color)
        self.cell(0, 5, _s(f"{sev_label}  {item.get('category', '')}"),
                  new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.set_x(self.l_margin + 5)
        self.set_font("Helvetica", "", 8.5)
        self.set_text_color(*TEXT_MID)
        self.multi_cell(160, 5, _s(item.get("issue", "")),
                        new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        if item.get("fix"):
            self.set_x(self.l_margin + 5)
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(*MUTED)
            self.multi_cell(160, 4.5, _s(f"> {item['fix']}"),
                            new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        self.set_text_color(*TEXT_DARK)
        self.ln(2)

    def filler_tags(self, breakdown: dict):
        """Render filler word tags in a flow layout."""
        if not breakdown:
            self.body_text("No significant filler words detected.")
            return

        x_start = self.get_x()
        x       = x_start
        max_x   = 190

        for word, count in list(breakdown.items())[:12]:
            tag   = _s(f'"{word}" x{count}')
            width = self.get_string_width(tag) + 6
            y     = self.get_y()

            if x + width > max_x:
                x = x_start
                self.ln(7)
                y = self.get_y()

            self.set_xy(x, y)
            self.set_fill_color(254, 226, 226)
            self.set_draw_color(*DANGER)
            self.set_line_width(0.2)
            self.rect(x, y, width, 5.5, "FD")
            self.set_xy(x + 1, y + 0.5)
            self.set_font("Helvetica", "", 7.5)
            self.set_text_color(*DANGER)
            self.cell(width - 2, 5, tag)
            x += width + 3

        self.set_text_color(*TEXT_DARK)
        self.ln(10)


# ══════════════════════════════════════════════════════════════
# MAIN BUILD FUNCTION
# ══════════════════════════════════════════════════════════════

def build_report_pdf(report_data: dict) -> bytes:
    """
    Build a professional PDF report from the analysis data.
    Returns raw PDF bytes.
    """
    topic        = report_data.get("topic", "Unknown Topic")
    analysis     = report_data.get("analysis_sections", {})
    audio_scores = report_data.get("audio_scores") or {}
    ppt_quality  = report_data.get("ppt_quality") or {}

    pdf = VivaPDF()
    pdf.add_page()

    # ── Cover block ──────────────────────────────────────────
    pdf.set_fill_color(*BG_LIGHT)
    pdf.rect(pdf.l_margin, pdf.get_y(), 174, 30, "F")
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(*TEXT_DARK)
    pdf.cell(0, 9, _s("Mock Viva Performance Report"), align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*MUTED)
    pdf.cell(0, 6, _s(f"Topic: {topic}"), align="C",
             new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 8)
    pdf.cell(0, 5, _s(f"Generated on {datetime.datetime.now().strftime('%d %B %Y, %H:%M')}"),
             align="C", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_text_color(*TEXT_DARK)
    pdf.ln(8)

    # ── Score overview ───────────────────────────────────────
    if audio_scores:
        pdf.section_title("Score Overview")
        pdf.score_bar("Confidence",           audio_scores.get("confidence_score", 0))
        pdf.score_bar("Fluency",              audio_scores.get("fluency_score", 0))
        pdf.score_bar("Technical Confidence", audio_scores.get("technical_confidence_score", 0))
        pdf.ln(2)

        # Quick stats row
        pace = audio_scores.get("pace", {})
        fw   = audio_scores.get("filler_words", {})
        st   = audio_scores.get("stuttering", {})
        un   = audio_scores.get("uncertainty", {})

        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(*MUTED)
        stats = [
            ("Speaking Pace",     _s(f"{pace.get('wpm', 'N/A')} WPM ({pace.get('label', 'N/A')})") ),
            ("Filler Words",      str(fw.get("total", 0))),
            ("Hesitations",       str(fw.get("hesitation_count", 0))),
            ("Stutters",          str(st.get("count", 0))),
            ("Uncertain Phrases", str(un.get("uncertainty_total", 0))),
            ("Phrase Repeats",    str(audio_scores.get("phrase_repetitions", {}).get("count", 0))),
        ]
        col_w = 87
        for i, (k, v) in enumerate(stats):
            if i % 2 == 0:
                pdf.set_x(pdf.l_margin)
            else:
                pdf.set_x(pdf.l_margin + col_w)

            pdf.set_font("Helvetica", "B", 8)
            pdf.set_text_color(*MUTED)
            pdf.cell(30, 5, _s(k + ":"), new_x=XPos.RIGHT, new_y=YPos.TOP)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*TEXT_DARK)
            pdf.cell(50, 5, _s(v),
                     new_x=XPos.LMARGIN if i % 2 == 1 else XPos.RIGHT,
                     new_y=YPos.NEXT if i % 2 == 1 else YPos.TOP)
            if i % 2 == 1:
                pdf.ln(0)
        pdf.set_text_color(*TEXT_DARK)
        pdf.ln(4)

    # ── PPT Quality ──────────────────────────────────────────
    if ppt_quality:
        pdf.section_title("PPT Quality Assessment")
        pdf.set_font("Helvetica", "B", 9)
        verdict_color = DANGER if ppt_quality.get("verdict") in ("ALL_BLANK", "NO_SLIDES", "EXTREMELY_POOR") else (WARNING if ppt_quality.get("verdict") == "POOR" else SUCCESS)
        pdf.set_text_color(*verdict_color)
        pdf.cell(0, 5, f"Verdict: {ppt_quality.get('verdict', 'N/A').replace('_', ' ')}",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_text_color(*TEXT_DARK)
        pdf.body_text(ppt_quality.get("summary", ""))
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(*MUTED)
        pdf.cell(0, 5, f"Slides: {ppt_quality.get('total_slides',0)}  |  Blank: {ppt_quality.get('blank_slides',0)}  |  Words: {ppt_quality.get('total_words',0)}",
                 new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_text_color(*TEXT_DARK)
        pdf.ln(2)

    # ── Filler words ─────────────────────────────────────────
    if audio_scores and audio_scores.get("filler_words", {}).get("total", 0) > 0:
        pdf.section_title("Filler Word Breakdown")
        pdf.filler_tags(audio_scores["filler_words"].get("breakdown", {}))

    # ── Presentation analysis ─────────────────────────────────
    if analysis.get("analysis"):
        pdf.section_title("Presentation Analysis")
        pdf.body_text(analysis["analysis"][:2000])   # cap to avoid overflow

    # ── Missing concepts ─────────────────────────────────────
    if analysis.get("missing"):
        pdf.section_title("Missing Concepts")
        pdf.body_text(analysis["missing"][:1200])

    # ── Suggestions ──────────────────────────────────────────
    if analysis.get("suggestions"):
        pdf.section_title("Suggestions")
        pdf.body_text(analysis["suggestions"][:1200])

    # ── Viva questions ───────────────────────────────────────
    if analysis.get("viva"):
        pdf.section_title("Viva Questions")
        # Split by numbered list items
        import re as _re
        questions = _re.split(r'\d+\.\s+', analysis["viva"])
        for q in questions:
            q = q.strip()
            if q:
                pdf.bullet(q[:300])

    # ── Professor advice ─────────────────────────────────────
    if audio_scores and audio_scores.get("advice"):
        pdf.section_title("Speech & Delivery Advice")
        for item in audio_scores["advice"]:
            pdf.advice_block(item)

    # ── Final verdict ─────────────────────────────────────────
    if analysis.get("verdict"):
        pdf.section_title("Final Verdict")
        pdf.set_fill_color(*BG_LIGHT)
        y = pdf.get_y()
        pdf.rect(pdf.l_margin, y, 174, 2, "F")
        pdf.ln(2)
        pdf.body_text(analysis["verdict"][:800])

        # Try to extract score
        import re as _re
        m = _re.search(r'(\d[\d.]*)[\s]*/[\s]*10', analysis.get("verdict", ""))
        if m:
            score_10 = float(m.group(1))
            pct      = int((score_10 / 10) * 100)
            pdf.ln(2)
            pdf.score_bar("Overall Score (out of 10)", pct)

    return pdf.output()
