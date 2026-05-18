import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Play, FileText, CheckCircle, AlertTriangle, Award, Mic, Volume2 } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card"
import { Button } from "../components/ui/Button"
import { Input } from "../components/ui/Input"
import { Textarea } from "../components/ui/Textarea"
import { Loader } from "../components/ui/Loader"
import { AudioRecorder } from "../components/ui/AudioRecorder"
import { SpeechReport } from "../components/ui/SpeechReport"
import { analyzePresentation } from "../api/services"
import toast from "react-hot-toast"
import { useAppContext } from "../context/AppContext"
import { useNavigate } from "react-router-dom"
import { useEffect } from "react"

export function Analysis() {
  const { file, topic, setTopic, slides, setSlides, script, setScript, results, setResults, setVivaMessages, pptQuality, transcription, setTranscription, audioScores, setAudioScores, domainMismatch, setDomainMismatch } = useAppContext()
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [activeTab, setActiveTab] = useState("analysis")
  const [inputMode, setInputMode] = useState("script") // "script" | "audio"
  const navigate = useNavigate()

  useEffect(() => {
    if (!file && !topic) {
      navigate("/upload", { replace: true })
    }
  }, [file, topic, navigate])

  const parseAnalysisText = (text) => {
    const sections = { analysis: "", missing: "", suggestions: "", viva: "", verdict: "" }

    // ── Exhaustive header patterns for each section ──────────────────
    const HEADERS = [
      {
        key: "analysis",
        patterns: [
          /\*\*\s*Presentation\s+Analysis\s*\*\*/i,
          /#{1,3}\s*Presentation\s+Analysis/i,
          /^Presentation\s+Analysis\s*:?\s*$/im,
        ]
      },
      {
        key: "missing",
        patterns: [
          /\*\*\s*Missing\s+Concepts\s*\*\*/i,
          /#{1,3}\s*Missing\s+Concepts/i,
          /^Missing\s+Concepts\s*:?\s*$/im,
          /#{1,3}\s*Missing\s+Topics/i,
          /\*\*\s*Missing\s+Topics\s*\*\*/i,
        ]
      },
      {
        key: "suggestions",
        patterns: [
          /\*\*\s*Suggestions?\s*\*\*/i,
          /#{1,3}\s*Suggestions?/i,
          /^Suggestions?\s*:?\s*$/im,
          /#{1,3}\s*Recommendations?/i,
          /\*\*\s*Recommendations?\s*\*\*/i,
        ]
      },
      {
        key: "viva",
        patterns: [
          /\*\*\s*Viva\s+Questions?\s*\*\*/i,
          /#{1,3}\s*Viva\s+Questions?/i,
          /^Viva\s+Questions?\s*:?\s*$/im,
        ]
      },
      {
        key: "verdict",
        patterns: [
          /\*\*\s*Final\s+Verdict\s*\*\*/i,
          /#{1,3}\s*Final\s+Verdict/i,
          /^Final\s+Verdict\s*:?\s*$/im,
          /#{1,3}\s*Verdict/i,
          /#{1,3}\s*Overall\s+Assessment/i,
          /\*\*\s*Verdict\s*\*\*/i,
        ]
      },
    ]

    // Find the earliest match position for each section header
    const positions = {}
    for (const { key, patterns } of HEADERS) {
      let found = -1
      for (const pat of patterns) {
        const m = text.search(pat)
        if (m !== -1 && (found === -1 || m < found)) found = m
      }
      positions[key] = found
    }

    // Sort found sections by their position in the text
    const ordered = Object.entries(positions)
      .filter(([, pos]) => pos !== -1)
      .sort((a, b) => a[1] - b[1])

    if (ordered.length >= 2) {
      for (let i = 0; i < ordered.length; i++) {
        const [key, start] = ordered[i]
        const end = i + 1 < ordered.length ? ordered[i + 1][1] : undefined
        let chunk = text.substring(start, end).trim()
        // Strip the header line itself (the first line)
        chunk = chunk.replace(/^[^\n]+\n/, "").trim()
        sections[key] = chunk
      }
      // Fill placeholders for any sections the LLM skipped
      if (!sections.analysis)    sections.analysis    = "_No general analysis was generated._"
      if (!sections.missing)     sections.missing     = "_No missing concepts flagged._"
      if (!sections.suggestions) sections.suggestions = "_No suggestions provided._"
      if (!sections.viva)        sections.viva        = "_No viva questions generated._"
      if (!sections.verdict)     sections.verdict     = "_No final verdict provided._"
    } else {
      // Total fallback — dump full text into General Analysis only
      sections.analysis    = text.trim()
      sections.missing     = "_Our system did not produce separate sections. See General Analysis tab._"
      sections.suggestions = "_Our system did not produce separate sections. See General Analysis tab._"
      sections.viva        = "_Our system did not produce separate sections. See General Analysis tab._"
      sections.verdict     = "_Our system did not produce separate sections. See General Analysis tab._"
    }

    return sections
  }

  const handleAnalyze = async () => {
    // In audio mode, require transcription. In script mode, require script.
    if (inputMode === "script" && !script) {
      toast.error("Please paste your presentation script")
      return
    }
    if (inputMode === "audio" && !transcription) {
      toast.error("Please record and transcribe your audio first")
      return
    }

    // When in audio mode, use transcription as the script passed to the backend
    const effectiveScript = inputMode === "audio" ? transcription : script

    setIsAnalyzing(true)
    // Reset viva chat so new questions are used
    setVivaMessages([])

    try {
      const response = await analyzePresentation({ topic, slides, script: effectiveScript, ppt_quality: pptQuality, transcription: transcription || "", audio_scores: audioScores || null })
      const text = response.analysis || ""

      if (text.toLowerCase().startsWith("ollama error")) {
        throw new Error(text)
      }

      setResults(parseAnalysisText(text))
      setDomainMismatch(response.domain_mismatch || false)
      
      if (response.domain_mismatch) {
        toast.error("Analysis blocked due to Domain Mismatch.", { duration: 5000 })
      } else {
        toast.success("Analysis complete! Head to Viva Exam to practice.")
      }
    } catch (error) {
      console.error(error)
      const errorMsg = error.message || error.response?.data?.detail || "Analysis failed. Please check your backend connection."
      toast.error(errorMsg.substring(0, 120))
    } finally {
      setIsAnalyzing(false)
    }
  }

  const tabs = [
    { id: "analysis",     label: "General Analysis",  icon: FileText },
    { id: "missing",      label: "Missing Concepts",  icon: AlertTriangle },
    { id: "suggestions",  label: "Suggestions",       icon: CheckCircle },
    { id: "viva",         label: "Viva Questions",    icon: Mic },
    { id: "verdict",      label: "Final Verdict",     icon: Award },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-widest uppercase text-foreground drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          Presentation <span className="neon-text">Analysis</span>
        </h1>
        <p className="text-muted-foreground mt-3 text-lg tracking-wide">
          {file ? "Enter your script or record audio to generate strict academic feedback." : "System requires a presentation upload to proceed."}
        </p>
      </div>

      {!file ? (
        <Card className="max-w-3xl mx-auto mt-12 bg-primary/5 border-primary/20 backdrop-blur-md">
          <CardContent className="flex flex-col items-center justify-center p-16 space-y-6 text-center">
            <AlertTriangle className="h-20 w-20 text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
            <h2 className="text-3xl font-black tracking-widest uppercase text-white">ACCESS DENIED</h2>
            <p className="text-muted-foreground text-lg">You must upload a PPTX or PDF presentation in the Upload Chamber before accessing the Analysis Interface.</p>
            <Button size="lg" onClick={() => navigate("/upload")} className="mt-4 px-8 cyber-button">
              Proceed to Upload Chamber
            </Button>
          </CardContent>
        </Card>
      ) : !results && !isAnalyzing ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-4">
          {/* Input Panel */}
          <Card>
            <CardHeader>
              <CardTitle>Input Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-primary flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Auto-detected Topic
                </label>
                <div className="px-4 py-3 bg-muted/30 border rounded-lg text-foreground font-semibold flex items-center justify-between">
                  <span>{topic || "Topic not detected"}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-2 py-1 rounded">From PPT</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Slides (Optional)</label>
                <Input
                  placeholder="E.g. 1-10"
                  value={slides}
                  onChange={(e) => setSlides(e.target.value)}
                />
              </div>
              {/* Script / Audio Mode Toggle */}
              <div className="flex rounded-lg border overflow-hidden relative z-20">
                <button
                  onClick={() => setInputMode("script")}
                  className={`flex-1 py-3 text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 ${
                    inputMode === "script"
                      ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                      : "bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  <FileText className="h-3.5 w-3.5" /> Type Script
                </button>
                <button
                  onClick={() => setInputMode("audio")}
                  className={`flex-1 py-3 text-sm font-bold tracking-wider uppercase transition-all duration-300 flex items-center justify-center gap-2 ${
                    inputMode === "audio"
                      ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(0,240,255,0.4)]"
                      : "bg-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  <Mic className="h-3.5 w-3.5" /> Record Audio
                </button>
              </div>

              {/* Script input — only in script mode */}
              {inputMode === "script" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Script</label>
                  <Textarea
                    placeholder="Paste your full presentation script here..."
                    className="min-h-[200px]"
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                  />
                </div>
              )}

              {/* Audio recorder — only in audio mode */}
              {inputMode === "audio" && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Record yourself giving the presentation. Whisper will transcribe it and use it as your script.</p>
                  <AudioRecorder
                    onTranscription={(text, scores) => {
                      setTranscription(text)
                      setAudioScores(scores)
                    }}
                  />

                  {transcription && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-lg border bg-primary/5 border-primary/20 p-3"
                    >
                      <p className="text-xs font-medium text-primary flex items-center gap-1.5 mb-1">
                        <Volume2 className="h-3 w-3" /> Whisper Transcription (used as script)
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-5 leading-relaxed">{transcription}</p>
                      {audioScores && (
                        <div className="flex gap-3 mt-2 pt-2 border-t border-primary/10">
                          <span className="text-xs"><span className="font-semibold text-foreground">{audioScores.confidence_score}%</span> Confidence</span>
                          <span className="text-xs"><span className="font-semibold text-foreground">{audioScores.fluency_score}%</span> Fluency</span>
                          <span className="text-xs"><span className="font-semibold text-foreground">{audioScores.pace?.wpm}</span> WPM</span>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {/* Show full speech report after transcription */}
                  {audioScores && <SpeechReport audioScores={audioScores} />}
                </div>
              )}

              <Button 
                className="w-full" 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || (inputMode === "script" && !script.trim()) || (inputMode === "audio" && !transcription)}
              >
                {isAnalyzing
                  ? <><Loader className="mr-2" size={16} /> Analyzing...</>
                  : <><Play className="mr-2 h-4 w-4" /> Run Analysis</>}
              </Button>

              {results && !domainMismatch && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/mock-viva")}
                >
                  <Mic className="mr-2 h-4 w-4" />
                  Start Mock Viva
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Verdict quick badge omitted in step 1 */}
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-6xl mx-auto space-y-6">
          {/* Back button if results are shown */}
          {results && (
            <Button variant="outline" onClick={() => setResults(null)} className="mb-4">
              ← Edit Input Details
            </Button>
          )}

          {/* Results Panel */}
          {isAnalyzing ? (
            <Card className="h-full flex flex-col items-center justify-center p-12 gap-4">
              <Loader size={40} />
              <p className="text-muted-foreground font-medium animate-pulse">System is reviewing your presentation...</p>
            </Card>
          ) : results ? (
            <Card className="h-full flex flex-col">
              {/* Tabs */}
              <div className="flex border-b px-4 pt-4 gap-1 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 pb-3 text-sm font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all duration-300 ${
                      activeTab === tab.id
                        ? "border-primary text-primary drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]"
                        : "border-transparent text-muted-foreground hover:text-primary hover:border-primary/50"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              <CardContent className="flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                    className="prose prose-base max-w-none text-white"
                  >
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => <p className="mb-6 leading-relaxed whitespace-pre-wrap text-white">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-6 space-y-3 mb-6 text-white">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-6 space-y-4 mb-6 text-white">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed pl-2 text-white">{children}</li>,
                        h1: ({ children }) => <h1 className="text-2xl font-bold mb-6 text-white">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-bold mb-4 mt-8 text-white">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-bold mb-4 mt-6 text-white">{children}</h3>,
                        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                      }}
                    >
                      {(() => {
                        let text = results[activeTab] || "_No content for this section._"
                        
                        // Force spacing: ensure at least double newlines between blocks
                        text = text.replace(/\n(?!\n)/g, "\n\n")

                        // If it's the viva questions tab, try to enforce numbering
                        if (activeTab === "viva") {
                          const lines = text.split("\n\n").filter(l => l.trim().length > 0)
                          // If lines don't start with numbers, prepend them
                          const formattedLines = lines.map((line, i) => {
                            if (/^\d+\./.test(line.trim())) {
                              return line.trim()
                            }
                            // Strip any bullet points or dashes first
                            const cleanLine = line.replace(/^[-*•]\s*/, "").trim()
                            return `${i + 1}. ${cleanLine}`
                          })
                          text = formattedLines.join("\n\n")
                        }

                        return text
                      })()}
                    </ReactMarkdown>
                  </motion.div>
                </AnimatePresence>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center p-12 bg-background/40 backdrop-blur-md border-dashed border-primary/20">
              <div className="text-center text-muted-foreground space-y-4">
                <FileText className="h-16 w-16 mx-auto opacity-20 text-primary drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]" />
                <p className="font-bold tracking-wider uppercase text-lg">No analysis yet</p>
                <p className="text-sm">Fill in the topic and script, then hit <strong className="text-primary">Run Analysis</strong> to get deep feedback.</p>
              </div>
            </Card>
          )}
        </motion.div>
      )}
    </div>
  )
}
