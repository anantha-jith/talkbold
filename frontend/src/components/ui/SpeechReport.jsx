import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { AlertTriangle, Info, Zap, CheckCircle, ChevronDown, ChevronUp, Mic } from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, Cell
} from "recharts"

const SEVERITY = {
  high:   { bg: "bg-red-500/10",    border: "border-red-500/20",    text: "text-red-600 dark:text-red-400",    badge: "bg-red-500",    icon: AlertTriangle,  label: "CRITICAL" },
  medium: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-600 dark:text-yellow-400", badge: "bg-yellow-500", icon: Zap,            label: "MEDIUM"   },
  low:    { bg: "bg-blue-500/10",   border: "border-blue-500/20",   text: "text-blue-600 dark:text-blue-400",   badge: "bg-blue-500",   icon: CheckCircle,    label: "MINOR"    },
  info:   { bg: "bg-primary/5",     border: "border-primary/20",    text: "text-primary",                       badge: "bg-primary",    icon: Info,           label: "TIP"      },
}

function AdviceCard({ item, index }) {
  const [open, setOpen] = useState(index < 2)
  const s    = SEVERITY[item.severity] || SEVERITY.info
  const Icon = s.icon
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`rounded-lg border overflow-hidden ${s.bg} ${s.border}`}
    >
      <button className="w-full flex items-start gap-3 p-3 text-left" onClick={() => setOpen(o => !o)}>
        <span className={`mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded text-white shrink-0 ${s.badge}`}>
          {s.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${s.text}`}>{item.category}</p>
          <p className="text-sm text-foreground mt-0.5 leading-snug">{item.issue}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
               : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />}
      </button>
      <AnimatePresence>
        {open && item.fix && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pl-10 border-t border-current/10 pt-2">
              <p className="text-xs text-muted-foreground leading-relaxed">💡 {item.fix}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function MiniBar({ label, value, max, color = "bg-primary" }) {
  const pct = Math.round((value / Math.max(max, 1)) * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </div>
  )
}

function ScoreMeter({ score, label, color }) {
  const ringColor = score >= 80 ? "text-green-500" : score >= 60 ? "text-primary" : score >= 40 ? "text-yellow-500" : "text-red-500"
  const circumference = 2 * Math.PI * 20
  const dash = (score / 100) * circumference
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 50 50" className="w-full h-full -rotate-90">
          <circle cx="25" cy="25" r="20" fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
          <motion.circle
            cx="25" cy="25" r="20" fill="none"
            stroke="currentColor" strokeWidth="4"
            strokeLinecap="round"
            className={ringColor}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${dash} ${circumference}` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold">{score}%</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center leading-tight w-16">{label}</p>
    </div>
  )
}

export function SpeechReport({ audioScores }) {
  if (!audioScores) return null

  const {
    confidence_score, fluency_score, technical_confidence_score,
    filler_words = {}, stuttering = {}, phrase_repetitions = {},
    restarts = 0, uncertainty = {}, pace = {}, advice = [], summary,
    ml_emotion, audio_features: af,
    robotic_text: rt, robotic_audio: ra,
  } = audioScores

  const highCount  = advice.filter(a => a.severity === "high").length
  const totalWords = filler_words.total || 0

  // Emotion badge colour
  const emotionColor = ml_emotion?.available
    ? (ml_emotion.conf_adj >= 10 ? "text-green-600 bg-green-500/10 border-green-500/30"
      : ml_emotion.conf_adj >= 0 ? "text-blue-600 bg-blue-500/10 border-blue-500/30"
      : ml_emotion.conf_adj >= -10 ? "text-yellow-600 bg-yellow-500/10 border-yellow-500/30"
      : "text-red-600 bg-red-500/10 border-red-500/30")
    : ""


  return (
    <div className="space-y-4">
      {/* Score rings */}
      <div className="flex justify-around py-2">
        <ScoreMeter score={confidence_score}           label="Confidence" />
        <ScoreMeter score={fluency_score}              label="Fluency" />
        <ScoreMeter score={technical_confidence_score} label="Technical" />
      </div>

      {/* ML Emotion Badge (SpeechBrain) */}
      {ml_emotion?.available && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-between rounded-lg border px-3 py-2 ${emotionColor}`}
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-wide">🧠 Vocal Emotion Analysis — SpeechBrain Model</p>
            <p className="text-sm font-semibold mt-0.5">{ml_emotion.emotion_label}</p>
            <p className="text-xs opacity-80 mt-0.5">{ml_emotion.note}</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <p className="text-xs opacity-60">Model confidence</p>
            <p className="text-lg font-bold">{Math.round(ml_emotion.emotion_score * 100)}%</p>
          </div>
        </motion.div>
      )}

      {/* Robotic / Scripted Detection Panel */}
      {(rt?.available && rt.robotic_score >= 25) && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-lg border p-3 space-y-2 ${
            rt.robotic_score >= 70 ? "border-red-500/50 bg-red-500/10"
            : rt.robotic_score >= 50 ? "border-orange-500/50 bg-orange-500/10"
            : "border-yellow-500/40 bg-yellow-500/10"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className={`text-xs font-bold uppercase tracking-wide ${
              rt.robotic_score >= 70 ? "text-red-500"
              : rt.robotic_score >= 50 ? "text-orange-500"
              : "text-yellow-500"
            }`}>
              🤖 Delivery Analysis — {rt.label}
            </p>
            <span className={`text-lg font-black ${
              rt.robotic_score >= 70 ? "text-red-500" : rt.robotic_score >= 50 ? "text-orange-500" : "text-yellow-500"
            }`}>{rt.robotic_score}<span className="text-xs font-normal">/100</span></span>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${rt.robotic_score}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${
                rt.robotic_score >= 70 ? "bg-red-500" : rt.robotic_score >= 50 ? "bg-orange-500" : "bg-yellow-500"
              }`}
            />
          </div>
          {/* Detected flags */}
          {rt.flags?.length > 0 && (
            <ul className="space-y-1">
              {rt.flags.map((f, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-orange-400 mt-0.5">▸</span>{f}
                </li>
              ))}
            </ul>
          )}
          {/* Audio robotic signals */}
          {ra?.available && ra.audio_robotic_score >= 30 && (
            <div className="pt-2 border-t border-current/10">
              <p className="text-xs font-semibold text-muted-foreground mb-1">🔊 Audio Signal Flags:</p>
              <div className="flex flex-wrap gap-2">
                {ra.monotone_pitch && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">Monotone Pitch</span>}
                {ra.flat_energy    && <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">Flat Energy</span>}
                {ra.uniform_pace   && <span className="text-[10px] bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">Uniform Pace</span>}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Prosody panel (jitter / shimmer / HNR) */}
      {af?.available && af.jitter_rel != null && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">🎵 Prosody Analysis (Clinical Acoustic Features)</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { label: "Jitter",         val: `${af.jitter_rel?.toFixed(2)}%`,  good: af.jitter_rel < 1.5,   bad: af.jitter_rel > 3, desc: "Pitch irregularity" },
              { label: "Shimmer",        val: `${af.shimmer_rel?.toFixed(1)}%`, good: af.shimmer_rel < 6,    bad: af.shimmer_rel > 10, desc: "Amplitude instability" },
              { label: "HNR",            val: `${af.hnr_db?.toFixed(0)} dB`,   good: af.hnr_db > 15,        bad: af.hnr_db < 8, desc: "Voice clarity" },
              { label: "Voice Quality",  val: `${Math.round((af.voice_quality||0)*100)}%`, good: af.voice_quality > 0.6, bad: af.voice_quality < 0.3, desc: "Composite" },
            ].map(({ label, val, good, bad, desc }) => (
              <div key={label} className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-muted-foreground" style={{fontSize:"9px"}}>{desc}</p>
                </div>
                <span className={`font-bold ${good ? "text-green-600 dark:text-green-400" : bad ? "text-red-500" : "text-yellow-500"}`}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 border p-2.5 space-y-2">
          <MiniBar label="Filler Words"  value={totalWords}                        max={30}  color="bg-red-500" />
          <MiniBar label="Hesitations"   value={filler_words.hesitation_count || 0} max={20} color="bg-orange-500" />
          <MiniBar label="Discourse"     value={filler_words.discourse_count || 0}  max={20} color="bg-yellow-500" />
        </div>
        <div className="rounded-lg bg-muted/40 border p-2.5 space-y-2">
          <MiniBar label="Stutters"      value={stuttering.count || 0}                    max={10} color="bg-purple-500" />
          <MiniBar label="Phrase Repeats" value={phrase_repetitions.count || 0}           max={10} color="bg-blue-500" />
          <MiniBar label="Uncertain Phrases" value={uncertainty.uncertainty_total || 0}   max={15} color="bg-pink-500" />
        </div>
      </div>

      {/* Pace badge */}
      <div className="flex items-center gap-3 rounded-lg bg-muted/30 border p-2.5">
        <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Speaking Pace</p>
          <p className="text-sm font-semibold">{pace.wpm ?? "—"} WPM — {pace.label ?? "Unknown"}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full text-white ${
          pace.key === "optimal" ? "bg-green-500"
          : pace.key === "too_slow" || pace.key === "too_fast" ? "bg-red-500"
          : "bg-yellow-500"
        }`}>{pace.label ?? "?"}</span>
      </div>

      {/* Real audio signal metrics (librosa) */}
      {audioScores.audio_features?.available && (() => {
        const af = audioScores.audio_features
        const continuityPct   = Math.round((af.speech_continuity ?? 0) * 100)
        const pitchStabPct    = Math.round((af.pitch_stability ?? 0) * 100)
        const silencePct      = Math.round((af.silence_ratio ?? 0) * 100)
        const clarityPct      = Math.round((af.spectral_clarity ?? 0) * 100)
        return (
          <div className="rounded-lg border bg-primary/5 border-primary/20 p-3 space-y-2">
            <p className="text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
              <span>📡</span> Real Audio Signal Analysis
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="flex justify-between text-muted-foreground mb-0.5"><span>Speech Continuity</span><span>{continuityPct}%</span></div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:`${continuityPct}%`}} transition={{duration:1}} className={`h-full rounded-full ${continuityPct > 70 ? "bg-green-500" : continuityPct > 45 ? "bg-yellow-500" : "bg-red-500"}`}/></div>
              </div>
              <div>
                <div className="flex justify-between text-muted-foreground mb-0.5"><span>Pitch Stability</span><span>{pitchStabPct}%</span></div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:`${pitchStabPct}%`}} transition={{duration:1,delay:0.1}} className={`h-full rounded-full ${pitchStabPct > 65 ? "bg-green-500" : "bg-yellow-500"}`}/></div>
              </div>
              <div>
                <div className="flex justify-between text-muted-foreground mb-0.5"><span>Silence Ratio</span><span>{silencePct}%</span></div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:`${silencePct}%`}} transition={{duration:1,delay:0.2}} className={`h-full rounded-full ${silencePct < 20 ? "bg-green-500" : silencePct < 40 ? "bg-yellow-500" : "bg-red-500"}`}/></div>
              </div>
              <div>
                <div className="flex justify-between text-muted-foreground mb-0.5"><span>Spectral Clarity</span><span>{clarityPct}%</span></div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden"><motion.div initial={{width:0}} animate={{width:`${clarityPct}%`}} transition={{duration:1,delay:0.3}} className="h-full rounded-full bg-blue-500"/></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 border-t border-primary/10">
              {af.pause_count != null && <span className="text-xs text-muted-foreground">Pauses: <span className="font-medium text-foreground">{af.pause_count}</span></span>}
              {af.avg_pause_s != null && <span className="text-xs text-muted-foreground">Avg pause: <span className="font-medium text-foreground">{af.avg_pause_s}s</span></span>}
              {af.max_pause_s != null && <span className="text-xs text-muted-foreground">Max pause: <span className="font-medium text-foreground">{af.max_pause_s}s</span></span>}
              {af.energy_cv != null && <span className="text-xs text-muted-foreground">Energy CV: <span className="font-medium text-foreground">{af.energy_cv}</span></span>}
            </div>
          </div>
        )
      })()}

      {/* Charts row */}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Filler bar chart */}
        {filler_words.breakdown && Object.keys(filler_words.breakdown).length > 0 && (
          <div className="rounded-lg bg-muted/30 border p-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Filler Distribution</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={Object.entries(filler_words.breakdown).slice(0, 6).map(([w, c]) => ({ word: `"${w}"`, count: c }))} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="word" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 10 }} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {Object.entries(filler_words.breakdown).slice(0, 6).map((_, i) => (
                    <Cell key={i} fill={`hsl(${0 + i * 15}, 70%, 55%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Radar skill overview */}
        <div className="rounded-lg bg-muted/30 border p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Skill Overview</p>
          <ResponsiveContainer width="100%" height={100}>
            <RadarChart data={[
              { metric: "Confidence", score: confidence_score },
              { metric: "Fluency",    score: fluency_score },
              { metric: "Technical",  score: technical_confidence_score },
              { metric: "Pace",       score: pace.key === "optimal" ? 90 : pace.key === "slow" || pace.key === "fast" ? 65 : 40 },
              { metric: "Clarity",    score: Math.max(0, 100 - (uncertainty?.uncertainty_total || 0) * 8) },
            ]} margin={{ top: 4, right: 12, bottom: 4, left: 12 }}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 8 }} />
              <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Filler word tags */}

      {filler_words.breakdown && Object.keys(filler_words.breakdown).length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Filler Words Detected</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(filler_words.breakdown).slice(0, 12).map(([word, count]) => (
              <span key={word} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 font-medium">
                "{word}" <span className="font-bold">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Uncertainty phrases */}
      {uncertainty.uncertainty_total > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Uncertain Phrases</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(uncertainty.uncertainty_phrases || {}).slice(0, 8).map(([phrase, count]) => (
              <span key={phrase} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/20 text-xs text-pink-600 dark:text-pink-400">
                "{phrase}" ×{count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stutter events */}
      {stuttering.events?.length > 0 && (
        <div className="rounded-lg border bg-purple-500/5 border-purple-500/20 p-3">
          <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-1">Stuttering Detected</p>
          <div className="flex flex-wrap gap-2">
            {stuttering.events.slice(0, 6).map((e, i) => (
              <span key={i} className="text-xs bg-purple-500/10 border border-purple-500/20 rounded px-2 py-0.5">
                "{e.word}" ×{e.repetitions}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Advice cards */}
      {advice.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Professor's Advice</p>
            {highCount > 0 && (
              <span className="text-xs bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
                {highCount} critical
              </span>
            )}
          </div>
          {advice.map((item, i) => <AdviceCard key={i} item={item} index={i} />)}
        </div>
      )}
    </div>
  )
}
