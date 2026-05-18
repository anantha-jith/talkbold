import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Send, User } from "lucide-react"
import ReactMarkdown from "react-markdown"
import { Card, CardContent } from "../components/ui/Card"
import { Button } from "../components/ui/Button"
import { Textarea } from "../components/ui/Textarea"
import { useAppContext } from "../context/AppContext"
import { useNavigate } from "react-router-dom"
import { sendVivaMessage } from "../api/services"

// Checks whether a string looks like an actual question (not a fallback/error message)
const FALLBACK_PHRASES = [
  "could not auto-parse", "see general analysis", "see **general analysis**",
  "combined all analysis", "see general analysis tab", "no final verdict",
]
function isValidQuestion(text) {
  if (!text || text.trim().length < 12) return false
  const lower = text.toLowerCase()
  return !FALLBACK_PHRASES.some(p => lower.includes(p))
}

function cleanQuestion(text) {
  if (!text) return ""
  // Only strip lines that are PURELY a meta-commentary header (nothing after the colon)
  const metaLine = /^(here are|below are|the following|these are|here is|let me|i will|i'll|question\s*\d+\s*:?\s*)$/i
  const lines = text.split("\n").filter(l => !metaLine.test(l.trim()))
  return lines.join("\n").trim()
}

function extractQuestions(vivaText) {
  if (!vivaText || !isValidQuestion(vivaText)) return []
  // Split on numbered list items: "1. " "2. " etc.
  const parts = vivaText.split(/(?:^|\n)\s*\d+\.\s+/m).map(q => q.trim()).filter(q => q.length > 12)
  // Keep items that contain a "?" or are long enough to be a real question
  const questions = parts.filter(q => q.includes("?") || q.split(" ").length > 8)
  return questions
}

function MarkdownBubble({ text, isUser }) {
  return (
    <div
      className={`max-w-[80%] rounded-2xl px-5 py-4 text-sm leading-relaxed shadow-[0_0_15px_rgba(0,0,0,0.2)]
        ${isUser
          ? "bg-primary/20 border border-primary/40 text-primary-foreground rounded-tr-sm backdrop-blur-md shadow-[0_0_15px_rgba(0,240,255,0.15)]"
          : "bg-card/60 backdrop-blur-md border border-primary/20 text-foreground rounded-tl-sm prose prose-sm dark:prose-invert max-w-none"
        }`}
    >
      {isUser ? (
        <span className="whitespace-pre-wrap">{text}</span>
      ) : (
        <ReactMarkdown
          components={{
            p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
            em:     ({ children }) => <em className="italic">{children}</em>,
            ul:     ({ children }) => <ul className="list-disc pl-4 space-y-1 mb-2">{children}</ul>,
            ol:     ({ children }) => <ol className="list-decimal pl-4 space-y-1 mb-2">{children}</ol>,
            li:     ({ children }) => <li>{children}</li>,
            code:   ({ children }) => <code className="bg-black/10 dark:bg-white/10 rounded px-1 py-0.5 font-mono text-xs">{children}</code>,
          }}
        >
          {text}
        </ReactMarkdown>
      )}
    </div>
  )
}

export function MockViva() {
  const { topic, results, vivaMessages, setVivaMessages, setVivaAnalysis, setVivaScore, domainMismatch } = useAppContext()
  const [input, setInput]         = useState("")
  const [questions, setQuestions] = useState([])
  const [isTyping, setIsTyping]   = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [q1Ready, setQ1Ready]     = useState(false)
  const bottomRef = useRef(null)
  const navigate  = useNavigate()
  
  const userMessageCount = vivaMessages.filter(m => m.type === "user").length

  useEffect(() => {
    if (!results) {
      navigate("/upload", { replace: true })
    }
  }, [results, navigate])

  // Extract viva questions from analysis results
  useEffect(() => {
    if (results?.viva) {
      setQuestions(extractQuestions(results.viva))
    }
  }, [results])

  // Kick off with Question 1
  useEffect(() => {
    if (vivaMessages.length > 0 || q1Ready) return  // already initialised

    const openingLine = `Good ${getTimeOfDay()}. I am your viva examiner today. We will be evaluating your understanding of **${topic || "your topic"}**.\n\nLet us begin.\n\n`

    // ── Path A: extracted questions are valid ──────────────────────────────
    if (questions.length > 0) {
      const q1 = cleanQuestion(questions[0])
      if (isValidQuestion(q1)) {
        setQ1Ready(true)
        setVivaMessages([{
          id: 1, type: "bot",
          text: openingLine + `**Question 1:** ${q1}`,
        }])
        return
      }
    }

    // ── Path B: questions missing / invalid → generate via LLM ────────────
    if (!topic) return  // nothing to generate without a topic
    setQ1Ready(true)
    setIsTyping(true)

    const greeting = [{
      id: 1, type: "bot",
      text: openingLine + "_(Generating first question…)_",
    }]
    setVivaMessages(greeting)

    const seed = [{
      role: "user",
      content: `I am ready to begin the viva on the topic "${topic}". Please ask me your first question.`,
    }]

    sendVivaMessage(topic, seed)
      .then(res => {
        const q = res?.viva?.trim() || ""
        setVivaMessages([{
          id: 1, type: "bot",
          text: openingLine + (q || "Let us begin. What can you tell me about the core concepts of this topic?"),
        }])
      })
      .catch(() => {
        setVivaMessages([{
          id: 1, type: "bot",
          text: openingLine + "Could not reach the examiner. Please check your backend connection.",
        }])
      })
      .finally(() => setIsTyping(false))

  }, [questions, topic]) // eslint-disable-line

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [vivaMessages, isTyping])

  if (!results) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center gap-6 glass-panel rounded-2xl p-12 mt-12">
        <span className="text-7xl drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">🎓</span>
        <h2 className="text-3xl font-bold tracking-widest uppercase text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">No Analysis <span className="neon-text">Found</span></h2>
        <p className="text-muted-foreground max-w-sm">
          Please run the Presentation Analysis first so the examiner can ask you relevant viva questions.
        </p>
        <Button onClick={() => navigate("/analysis")}>Go to Analysis</Button>
      </div>
    )
  }

  if (domainMismatch) {
    return (
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center gap-6 glass-panel rounded-2xl p-12 mt-12 border-red-500/30">
        <span className="text-7xl drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">🛑</span>
        <h2 className="text-3xl font-bold tracking-widest uppercase text-white drop-shadow-[0_0_10px_rgba(255,0,0,0.4)]">VIVA <span className="text-red-500">BLOCKED</span></h2>
        <p className="text-red-400/80 max-w-md">
          Your uploaded script completely failed the domain alignment check against the PPT. You cannot take a Viva Exam until you provide a relevant script.
        </p>
        <Button onClick={() => navigate("/analysis")} className="bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/50">Return to Analysis</Button>
      </div>
    )
  }

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    const userMsg = { id: Date.now(), type: "user", text: input.trim() }
    const updated = [...vivaMessages, userMsg]
    setVivaMessages(updated)
    setInput("")
    setIsTyping(true)

    const history = updated.map(m => ({
      role:    m.type === "user" ? "user" : "assistant",
      content: m.text,
    }))

    try {
      const response = await sendVivaMessage(topic || "General Topic", history)
      const reply    = response.viva || ""

      if (reply.toLowerCase().startsWith("ollama error")) throw new Error(reply)

      setVivaMessages(prev => [...prev, { id: Date.now() + 1, type: "bot", text: reply }])
    } catch (err) {
      console.error(err)
      setVivaMessages(prev => [...prev, {
        id:   Date.now() + 1,
        type: "bot",
        text: `⚠️ ${err.message || "Failed to reach the examiner. Please check your backend."}`,
      }])
    } finally {
      setIsTyping(false)
    }
  }

  const handleEndViva = async () => {
    if (isEvaluating) return
    setIsEvaluating(true)
    setIsTyping(true)

    const history = vivaMessages.map(m => ({
      role:    m.type === "user" ? "user" : "assistant",
      content: m.text,
    }))

    try {
      setVivaMessages(prev => [...prev, { id: Date.now(), type: "bot", text: "_(Evaluating your viva performance...)_" }])
      const response = await sendVivaMessage(topic || "General Topic", history, true)
      
      let evalData;
      try {
        evalData = JSON.parse(response.viva);
      } catch(e) {
        throw new Error("Failed to parse evaluation response")
      }
      
      setVivaScore(evalData.score || 0)
      setVivaAnalysis(evalData.analysis || "No analysis generated.")
      navigate("/report")
    } catch (err) {
      console.error(err)
      setVivaMessages(prev => [...prev, {
        id:   Date.now() + 1,
        type: "bot",
        text: `⚠️ Evaluation failed: ${err.message}`,
      }])
      setIsTyping(false)
      setIsEvaluating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-widest uppercase text-foreground drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
            Interactive <span className="neon-text">Viva Exam</span>
          </h1>
          <p className="text-muted-foreground mt-3 text-lg tracking-wide">
            Topic: <span className="font-bold text-primary drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]">{topic || "General"}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium border border-green-500/20">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          Session Active
        </div>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden glass-panel border-primary/30">
        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-5">
          <AnimatePresence initial={false}>
            {vivaMessages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${msg.type === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold shadow-[0_0_15px_rgba(0,240,255,0.2)] border ${
                  msg.type === "user"
                    ? "bg-primary/20 text-primary border-primary/50"
                    : "bg-background/80 text-foreground border-primary/30 backdrop-blur-md"
                }`}>
                  {msg.type === "user" ? <User size={14} /> : "Prof"}
                </div>

                {/* Bubble with markdown */}
                <MarkdownBubble text={msg.text} isUser={msg.type === "user"} />
              </motion.div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <motion.div
                key="typing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  Prof
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 border flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={bottomRef} />
        </CardContent>

        {/* Input */}
        <div className="p-5 border-t border-primary/20 bg-background/40 backdrop-blur-md">
          {userMessageCount >= 5 && !isEvaluating && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
              <Button 
                onClick={handleEndViva} 
                className="w-full bg-primary/20 hover:bg-primary/40 text-primary border border-primary/50 py-6 font-bold tracking-widest uppercase transition-all duration-300 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
              >
                Conclude Viva & Get Analysis
              </Button>
            </motion.div>
          )}
          <div className="flex gap-4">
            <div className="flex-1 relative group">
              <Textarea
                placeholder={isTyping ? "Examiner is evaluating your answer..." : "Type your answer and press Enter…"}
                className="min-h-[52px] max-h-[140px] resize-none pr-14 rounded-xl py-3.5 text-sm"
                value={input}
                disabled={isTyping}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />
              <Button
                size="icon"
                className="absolute right-3 bottom-3 h-10 w-10 rounded-lg cyber-button"
                onClick={handleSend}
                disabled={isTyping || !input.trim()}
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 ml-1">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </Card>
    </div>
  )
}

function getTimeOfDay() {
  const h = new Date().getHours()
  if (h < 12) return "morning"
  if (h < 17) return "afternoon"
  return "evening"
}
