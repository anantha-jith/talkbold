import { motion } from "framer-motion"
import { Award, Target, Brain, AlertCircle, Mic, Zap, BookOpen, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card"
import { PieChart, Pie, Cell, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts"
import { useAppContext } from "../context/AppContext"
import { useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { SpeechReport } from "../components/ui/SpeechReport"

function ScoreRing({ value, label, color }) {
  const data = [
    { value, fill: color },
    { value: 100 - value, fill: "hsl(var(--muted))" }
  ]
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-[90px] w-[90px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} innerRadius={30} outerRadius={42} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
              {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-bold">{value}%</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center leading-tight">{label}</p>
    </div>
  )
}

function MetricBar({ label, score, icon: Icon, delay }) {
  const color = score >= 80 ? "bg-green-500" : score >= 60 ? "bg-primary" : score >= 40 ? "bg-yellow-500" : "bg-red-500"
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between text-sm font-medium">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </div>
        <span className={score >= 80 ? "text-green-600 dark:text-green-400" : score >= 60 ? "text-primary" : "text-yellow-600"}>{score}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, delay: 0.3 + delay }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
    </motion.div>
  )
}

export function Report() {
  const { scores, audioScores, topic, results, vivaScore, vivaAnalysis, domainMismatch } = useAppContext()
  const navigate = useNavigate()

  useEffect(() => {
    if (!results) {
      navigate("/upload", { replace: true })
    }
  }, [results, navigate])

  if (!results) return null;

  if (domainMismatch) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center gap-6 glass-panel rounded-2xl p-12 mt-12 border-red-500/30">
        <span className="text-7xl drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">🛑</span>
        <h2 className="text-3xl font-bold tracking-widest uppercase text-white drop-shadow-[0_0_10px_rgba(255,0,0,0.4)]">REPORT <span className="text-red-500">BLOCKED</span></h2>
        <p className="text-red-400/80 max-w-md">
          Your uploaded script completely failed the domain alignment check against the PPT. You cannot view an evaluation report until you provide a relevant script.
        </p>
        <a href="/analysis" className="inline-flex h-10 items-center justify-center rounded-md bg-red-500/20 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/30 border border-red-500/50 transition-colors">
          Return to Analysis
        </a>
      </div>
    )
  }

  // Only use audio scores when audio was actually recorded
  const hasAudio = !!audioScores

  const confidenceScore  = hasAudio ? audioScores.confidence_score           : scores.confidence
  const technicalScore   = hasAudio ? audioScores.technical_confidence_score  : scores.readiness
  const fluencyScore     = hasAudio ? audioScores.fluency_score               : null   // null when no audio

  // Overall: include fluency only when audio was recorded
  const overallScore = hasAudio
    ? Math.round((confidenceScore + fluencyScore + technicalScore) / 3)
    : Math.round((confidenceScore + technicalScore) / 2)

  const pieData = [
    { value: overallScore,       fill: "hsl(var(--primary))" },
    { value: 100 - overallScore, fill: "hsl(var(--muted))" }
  ]

  const radarData = [
    { metric: "Confidence", score: confidenceScore },
    ...(hasAudio ? [{ metric: "Fluency", score: fluencyScore }] : []),
    { metric: "Technical",  score: technicalScore },
    ...(vivaScore !== null ? [{ metric: "Viva Ready", score: vivaScore }] : []),
    { metric: "Accuracy",   score: 78 },
  ]

  const metrics = [
    { label: "Technical Depth",     score: technicalScore,  icon: Brain },
    ...(hasAudio ? [{ label: "Fluency", score: fluencyScore, icon: Mic }] : []),
    { label: "Confidence",          score: confidenceScore, icon: Zap },
    { label: "Conceptual Accuracy", score: 78,              icon: Award },
    ...(vivaScore !== null ? [{ label: "Viva Readiness", score: vivaScore, icon: AlertCircle }] : []),
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-widest uppercase text-foreground drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          Performance <span className="neon-text">Report</span>
        </h1>
        <p className="text-muted-foreground mt-3 text-lg tracking-wide">
          {topic ? `Topic: ${topic}` : "Comprehensive analysis of your latest presentation."}
        </p>
      </div>

      {/* Top Row: Overall Score + Score Rings */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Overall Donut */}
        <Card className="lg:col-span-1 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-medium text-muted-foreground mb-2">Overall Score</p>
          <div className="relative h-[140px] w-[140px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={50} outerRadius={68} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-5xl font-bold text-primary drop-shadow-[0_0_10px_rgba(0,240,255,0.8)]">{overallScore}%</span>
            </div>
          </div>
          <p className="text-sm font-semibold tracking-wider text-muted-foreground mt-4 uppercase">
            {overallScore >= 80 ? "Excellent preparation!" : overallScore >= 60 ? "Good — review weak spots." : "Needs significant improvement."}
          </p>
        </Card>

        {/* Score Rings card */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4 text-primary" />
              {hasAudio ? "Speech Analysis Scores" : "Presentation Scores"}
              {!hasAudio && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  (record audio to unlock fluency analysis)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`grid gap-4 mb-4 ${hasAudio ? "grid-cols-3" : "grid-cols-2 max-w-xs mx-auto"}`}>
              <ScoreRing value={confidenceScore} label="Confidence"          color="hsl(221.2 83.2% 53.3%)" />
              {hasAudio && (
                <ScoreRing value={fluencyScore}  label="Fluency"             color="hsl(142, 71%, 45%)" />
              )}
              <ScoreRing value={technicalScore}  label="Technical Confidence" color="hsl(38, 92%, 50%)" />
            </div>

            {/* Audio summary — only when audio was recorded */}
            {hasAudio && (
              <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground space-y-1">
                <p>🎙️ <strong>Speaking Pace:</strong> {audioScores.pace?.wpm} WPM — {audioScores.pace?.label}</p>
                <p>💬 <strong>Filler Words:</strong> {audioScores.filler_words?.total} instances detected</p>
                <p>🔁 <strong>Phrase Repetitions:</strong> {audioScores.phrase_repetitions?.count ?? 0}</p>
                <p>📝 {audioScores.summary}</p>
              </div>
            )}

            {/* No-audio prompt */}
            {!hasAudio && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
                <p>🎙️ Record your audio on the <strong>Analysis</strong> page to get fluency, filler, hesitation and pace scores.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Radar + Metric Bars */}
      <div className="grid lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Skill Radar</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Radar name="Score" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Detailed Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {metrics.map((m, i) => (
              <MetricBar key={m.label} {...m} delay={i * 0.1} />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Speech Analysis — only when audio recorded */}
      {hasAudio && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-primary" />
              Detailed Speech Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SpeechReport audioScores={audioScores} />
          </CardContent>
        </Card>
      )}

      {/* Key Takeaways */}
      <Card>
        <CardHeader>
          <CardTitle>Key Takeaways</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {results?.verdict ? (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-sm text-muted-foreground">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Examiner's Final Verdict</h3>
              <p>{results.verdict}</p>
            </div>
          ) : (
            <>
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <h3 className="font-semibold text-green-700 dark:text-green-400 mb-1">Strengths</h3>
                <p className="text-sm text-muted-foreground">Run a full analysis to see your strengths here.</p>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <h3 className="font-semibold text-yellow-700 dark:text-yellow-400 mb-1">Areas to Improve</h3>
                <p className="text-sm text-muted-foreground">Run a full analysis to see improvement areas.</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Viva Analysis Panel */}
      {vivaAnalysis && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/40 shadow-[0_0_20px_rgba(0,240,255,0.1)]">
            <CardHeader className="bg-primary/10 border-b border-primary/20">
              <CardTitle className="text-xl tracking-widest uppercase neon-text flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Mock Viva Post-Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{vivaAnalysis}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Warning for pending viva analysis */}
      {vivaScore === null && (
        <Card className="border-dashed border-muted-foreground/30 bg-muted/10">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="bg-muted p-3 rounded-full">
              <AlertCircle className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Viva Readiness Pending</p>
              <p className="text-sm text-muted-foreground">Complete the Mock Viva (answer at least 5 questions) to generate your Viva Readiness score and analysis.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
