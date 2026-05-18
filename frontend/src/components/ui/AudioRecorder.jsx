import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Mic, Square, Play, Trash2, Loader2, CheckCircle } from "lucide-react"
import { Button } from "./Button"
import { transcribeAudio } from "../../api/services"
import { cn } from "../../utils/cn"
import toast from "react-hot-toast"

const STATE = {
  IDLE: "idle",
  RECORDING: "recording",
  RECORDED: "recorded",
  TRANSCRIBING: "transcribing",
  DONE: "done",
  LANGUAGE_BLOCKED: "language_blocked", // Hard lock — no operations allowed
}

export function AudioRecorder({ onTranscription, disabled = false }) {
  const [status, setStatus]           = useState(STATE.IDLE)
  const [audioUrl, setAudioUrl]       = useState(null)
  const [seconds, setSeconds]         = useState(0)
  const [waveform, setWaveform]       = useState(Array(20).fill(3))
  const [langError, setLangError]     = useState(null)   // { detected_name, message }

  const mediaRecorderRef = useRef(null)
  const streamRef        = useRef(null)
  const chunksRef        = useRef([])
  const audioBlobRef     = useRef(null)
  const timerRef         = useRef(null)
  const waveRef          = useRef(null)
  const analyserRef      = useRef(null)
  const audioCtxRef      = useRef(null)

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      cancelAnimationFrame(waveRef.current)
      audioCtxRef.current?.close()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const animateWaveform = (analyser) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const draw = () => {
      analyser.getByteFrequencyData(dataArray)
      const bars = Array.from({ length: 20 }, (_, i) => {
        const idx = Math.floor((i / 20) * dataArray.length)
        return Math.max(3, Math.floor((dataArray[idx] / 255) * 40))
      })
      setWaveform(bars)
      waveRef.current = requestAnimationFrame(draw)
    }
    draw()
  }

  const startRecording = async () => {
    // Clean up any previous session first
    clearInterval(timerRef.current)
    cancelAnimationFrame(waveRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    chunksRef.current = []
    setLangError(null)
    setAudioUrl(null)
    setSeconds(0)
    setWaveform(Array(20).fill(3))

    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const source   = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      source.connect(analyser)
      analyserRef.current = analyser
      animateWaveform(analyser)

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        audioBlobRef.current = blob
        setAudioUrl(URL.createObjectURL(blob))
        setStatus(STATE.RECORDED)
        stream.getTracks().forEach(t => t.stop())
        cancelAnimationFrame(waveRef.current)
        audioCtx.close()
        setWaveform(Array(20).fill(3))
      }

      mediaRecorder.start(250)
      setStatus(STATE.RECORDING)
      timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } catch (err) {
      toast.error("Microphone access denied. Please allow mic permissions.")
      console.error(err)
    }
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  const handleTranscribe = async () => {
    if (!audioBlobRef.current) return
    setStatus(STATE.TRANSCRIBING)
    setLangError(null)
    try {
      const result = await transcribeAudio(audioBlobRef.current)
      onTranscription(result.transcription, result.audio_scores)
      setStatus(STATE.DONE)
      toast.success("Transcription complete! Language: English ✓")
    } catch (err) {
      console.error(err)
      const detail = err?.response?.data?.detail
      if (detail?.error === "language_not_supported" || detail?.error === "mixed_language_detected") {
        // HARD LOCK — block all further operations
        setLangError(detail)
        setStatus(STATE.LANGUAGE_BLOCKED)
        setAudioUrl(null)
        audioBlobRef.current = null
        onTranscription("", null)
        toast.error(`🚫 ${detail.detected_name || "Non-English"} speech detected. Recording blocked.`, { duration: 5000 })
      } else if (detail?.error === "empty_transcription") {
        toast.error("No speech detected. Please speak clearly into the mic.")
        setStatus(STATE.RECORDED)
      } else {
        toast.error("Transcription failed. Is the backend running?")
        setStatus(STATE.RECORDED)
      }
    }
  }

  const handleDelete = () => {
    setStatus(STATE.IDLE)
    setAudioUrl(null)
    setSeconds(0)
    setLangError(null)
    audioBlobRef.current = null
    onTranscription("", null)
  }

  const handleLangReset = () => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(waveRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    audioBlobRef.current = null
    chunksRef.current = []
    setStatus(STATE.IDLE)
    setAudioUrl(null)
    setSeconds(0)
    setLangError(null)
    onTranscription("", null)
  }

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`


  return (
    <div className="glass-panel rounded-2xl p-6 space-y-5 border-primary/30 relative overflow-hidden group">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent opacity-50"></div>
      <div className="flex items-center justify-between relative z-10">
        <p className="text-base font-semibold uppercase tracking-widest flex items-center gap-3">
          <Mic className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(0,240,255,1)]" />
          Audio <span className="neon-text">Recording</span>
          <span className="text-xs text-muted-foreground font-normal tracking-normal">(optional)</span>
        </p>
        {status === STATE.RECORDING && (
          <span className="text-xs font-mono text-red-500 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            {formatTime(seconds)}
          </span>
        )}
        {status === STATE.DONE && (
          <span className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" /> Transcribed
          </span>
        )}
      </div>

      {/* Language rejection error banner */}
      <AnimatePresence>
        {langError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-red-500/60 bg-red-500/10 p-4"
          >
            <div className="flex items-start gap-2">
              <span className="text-red-500 text-xl mt-0.5">🚫</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-500 uppercase tracking-wider">
                  {langError.error === "mixed_language_detected" ? "Mixed Language Detected" : "Non-English Speech Detected"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Detected: <span className="font-semibold text-red-400">{langError.detected_name}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {langError.error === "mixed_language_detected"
                    ? "You spoke a non-English word/phrase within your recording. Only pure English speech is allowed."
                    : "Only English speech is supported for analysis. Please re-record entirely in English."
                  }
                </p>
                {status === STATE.LANGUAGE_BLOCKED && (
                  <button
                    onClick={handleLangReset}
                    className="mt-3 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 transition-all"
                  >
                    Reset & Re-record in English
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Waveform visualizer */}
      <AnimatePresence>
        {status === STATE.RECORDING && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-end justify-center gap-0.5 h-10 px-2"
          >
            {waveform.map((h, i) => (
              <motion.div
                key={i}
                animate={{ height: h }}
                transition={{ duration: 0.1 }}
                className="w-1.5 bg-primary rounded-full shadow-[0_0_10px_rgba(0,240,255,0.8)]"
                style={{ height: h }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audio playback */}
      {audioUrl && status !== STATE.RECORDING && (
        <audio controls src={audioUrl} className="w-full h-8 rounded-lg" />
      )}

      {/* Controls — show Re-record even when language blocked so user can try again */}
      <div className={`flex items-center gap-3 flex-wrap relative z-10 ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
        {status === STATE.IDLE && (
          <Button size="sm" variant="outline" className="gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={startRecording} disabled={disabled}>
            <Mic className="h-4 w-4" /> Start Recording
          </Button>
        )}

        {status === STATE.RECORDING && (
          <Button size="sm" variant="outline" className="gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={stopRecording}>
            <Square className="h-4 w-4 fill-red-500" /> Stop Recording
          </Button>
        )}

        {(status === STATE.RECORDED || status === STATE.DONE || status === STATE.LANGUAGE_BLOCKED) && (
          <>
            <Button size="sm" variant="outline" className="gap-2" onClick={startRecording} disabled={disabled}>
              <Mic className="h-4 w-4" /> Re-record
            </Button>
            {status !== STATE.LANGUAGE_BLOCKED && (
              <Button size="sm" variant="outline" className="gap-2 text-red-500 border-red-500/30 hover:bg-red-500/10" onClick={handleDelete} disabled={disabled}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </>
        )}

        {status === STATE.RECORDED && (
          <Button size="sm" className="gap-2 ml-auto" onClick={handleTranscribe} disabled={disabled}>
            <Play className="h-4 w-4" /> Transcribe with Whisper
          </Button>
        )}

        {status === STATE.TRANSCRIBING && (
          <Button size="sm" disabled className="gap-2 ml-auto">
            <Loader2 className="h-4 w-4 animate-spin" /> Transcribing...
          </Button>
        )}
      </div>
    </div>
  )
}
