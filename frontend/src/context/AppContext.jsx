import { createContext, useContext, useState } from "react"

const AppContext = createContext()

export function AppProvider({ children }) {
  const [topic, setTopic] = useState("")
  const [slides, setSlides] = useState("")
  const [script, setScript] = useState("")
  const [file, setFile] = useState(null)
  const [pptQuality, setPptQuality] = useState(null)
  const [transcription, setTranscription] = useState("")
  const [audioScores, setAudioScores] = useState(null)
  
  // Analysis results
  const [results, setResults] = useState(null)
  const [scores, setScores] = useState({
    confidence: 88,
    readiness: 84,
    viva: 79
  })

  // Viva Interactive state
  const [vivaMessages, setVivaMessages] = useState([])
  const [vivaAnalysis, setVivaAnalysis] = useState(null)
  const [vivaScore, setVivaScore] = useState(null)
  const [domainMismatch, setDomainMismatch] = useState(false)

  const resetAllData = () => {
    setTopic("")
    setSlides("")
    setScript("")
    setFile(null)
    setPptQuality(null)
    setTranscription("")
    setAudioScores(null)
    setResults(null)
    setScores({ confidence: 88, readiness: 84, viva: 79 })
    setVivaMessages([])
    setVivaAnalysis(null)
    setVivaScore(null)
    setDomainMismatch(false)
  }

  const value = {
    topic, setTopic,
    slides, setSlides,
    script, setScript,
    file, setFile,
    pptQuality, setPptQuality,
    transcription, setTranscription,
    audioScores, setAudioScores,
    results, setResults,
    scores, setScores,
    vivaMessages, setVivaMessages,
    vivaAnalysis, setVivaAnalysis,
    vivaScore, setVivaScore,
    domainMismatch, setDomainMismatch,
    resetAllData
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider")
  }
  return context
}
