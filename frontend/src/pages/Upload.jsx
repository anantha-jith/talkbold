import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { UploadCloud, File, CheckCircle, AlertTriangle, Zap } from "lucide-react"
import { Card, CardContent } from "../components/ui/Card"
import { Button } from "../components/ui/Button"
import { uploadPresentation } from "../api/services"
import apiClient from "../api/client"
import toast from "react-hot-toast"
import { Loader } from "../components/ui/Loader"
import { useAppContext } from "../context/AppContext"
import { useAuth } from "../context/AuthContext"

const PPT_QUALITY_COLORS = {
  ALL_BLANK:      { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-600 dark:text-red-400" },
  NO_SLIDES:      { bg: "bg-red-500/10",    border: "border-red-500/30",    text: "text-red-600 dark:text-red-400" },
  EXTREMELY_POOR: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-600 dark:text-orange-400" },
  POOR:           { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-600 dark:text-yellow-400" },
  ACCEPTABLE:     { bg: "bg-green-500/10",  border: "border-green-500/30",  text: "text-green-600 dark:text-green-400" },
}

export function Upload() {
  const { file, setFile, setPptQuality, setTopic, resetAllData } = useAppContext()
  const { user } = useAuth()
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedQuality, setUploadedQuality] = useState(null)
  const navigate = useNavigate()
  const isGuest = user?.role === "guest"
  const [guestUsage, setGuestUsage] = useState({ used: 0, limit: 3, remaining: 3 })

  const fetchGuestUsage = () => {
    if (!isGuest) return
    apiClient.get("/auth/usage").then(r => setGuestUsage(r.data)).catch(() => {})
  }

  useEffect(() => {
    fetchGuestUsage()
  }, [])

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.endsWith('.pptx')) {
      setFile(droppedFile)
      setUploadedQuality(null)
    } else {
      toast.error("Only PPTX files are supported. Please upload a valid PowerPoint file.")
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setIsUploading(true)
    try {
      const response = await uploadPresentation(file)
      const quality = response.ppt_quality || null

      // Save quality to context so Analysis page can pass it to the backend
      setPptQuality(quality)
      setUploadedQuality(quality)

      // Save the auto-detected topic
      if (response.detected_topic) {
        setTopic(response.detected_topic)
      }

      if (quality?.verdict === "ALL_BLANK" || quality?.verdict === "NO_SLIDES") {
        toast.error("⚠️ Your PPT is completely blank! You can still proceed but the analysis will reflect this.", { duration: 5000 })
      } else if (quality?.verdict === "EXTREMELY_POOR" || quality?.verdict === "POOR") {
        toast("⚠️ Your PPT has very little content. Our system will flag this in the analysis.", { icon: "⚠️", duration: 4000 })
      } else {
        toast.success(`Presentation uploaded! ${response.slides} slide(s) detected.`)
      }

    } catch (error) {
      console.error(error)
      const errorMsg = error.response?.data?.detail || "Failed to upload presentation. Please ensure backend is running."
      toast.error(errorMsg)
    } finally {
      setIsUploading(false)
      fetchGuestUsage() // Refresh count after any attempt (success or fail)
    }
  }

  const qualityStyle = uploadedQuality ? (PPT_QUALITY_COLORS[uploadedQuality.verdict] || PPT_QUALITY_COLORS.ACCEPTABLE) : null

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-widest uppercase text-foreground drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          Upload <span className="neon-text">Presentation</span>
        </h1>
        <p className="text-muted-foreground mt-3 text-lg tracking-wide">
          Upload your PPTX presentation to initiate the analysis sequence.
        </p>
      </div>

      {/* Guest attempt counter */}
      {isGuest && (
        <div className={`flex items-center justify-between p-4 rounded-2xl border ${
          guestUsage.remaining === 0 
            ? "bg-red-500/10 border-red-500/30" 
            : guestUsage.remaining === 1
            ? "bg-yellow-500/10 border-yellow-500/30"
            : "bg-orange-500/10 border-orange-500/30"
        }`}>
          <div className="flex items-center gap-3">
            <Zap className={`w-5 h-5 ${
              guestUsage.remaining === 0 ? "text-red-400" 
              : guestUsage.remaining === 1 ? "text-yellow-400"
              : "text-orange-400"
            }`} />
            <div>
              <p className="text-sm font-bold text-white">
                {guestUsage.remaining === 0 
                  ? "No attempts remaining"
                  : `${guestUsage.remaining} upload attempt${guestUsage.remaining !== 1 ? "s" : ""} remaining`}
              </p>
              <p className="text-xs text-white/50">Guest accounts are limited to 3 session uploads</p>
            </div>
          </div>
          {/* Mini progress bar */}
          <div className="flex gap-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className={`w-3 h-3 rounded-full ${
                i < guestUsage.used ? "bg-white/20" : 
                  guestUsage.remaining === 0 ? "bg-red-400" :
                  guestUsage.remaining === 1 ? "bg-yellow-400" : "bg-orange-400"
              }`} />
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <input
            id="ppt-file-input"
            type="file"
            className="hidden"
            accept=".pptx"
            onChange={(e) => { setFile(e.target.files[0]); setUploadedQuality(null) }}
          />
          <label
            htmlFor={file ? undefined : "ppt-file-input"}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-3xl p-20 text-center transition-all duration-700 relative overflow-hidden group flex flex-col items-center ${
              file ? "border-primary bg-primary/10 shadow-[0_0_40px_rgba(0,240,255,0.3)] cursor-default" : "border-primary/40 bg-card/40 backdrop-blur-md hover:border-primary hover:bg-primary/5 hover:shadow-[0_0_30px_rgba(0,240,255,0.2)] cursor-pointer"
            }`}
          >
            {/* Holographic scanning line */}
            <motion.div
              className="absolute left-0 right-0 h-1 bg-primary/80 shadow-[0_0_20px_rgba(0,240,255,1)]"
              initial={{ top: "-10%" }}
              animate={{ top: "110%" }}
              transition={{ duration: 3, ease: "linear", repeat: Infinity }}
            />
            {file ? (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-6 relative z-10">
                <div className="mx-auto w-24 h-24 bg-primary/20 rounded-2xl flex items-center justify-center border border-primary/50 shadow-[0_0_30px_rgba(0,240,255,0.4)] relative">
                  <motion.div className="absolute inset-0 border-2 border-primary rounded-2xl" animate={{ scale: [1, 1.1, 1], opacity: [1, 0, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                  <File className="h-10 w-10 text-primary drop-shadow-[0_0_10px_rgba(0,240,255,1)]" />
                </div>
                <div>
                  <p className="font-bold text-2xl text-foreground tracking-widest">{file.name}</p>
                  <p className="text-sm text-primary font-semibold tracking-widest mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button variant="outline" onClick={() => { resetAllData(); setUploadedQuality(null); }}>
                  Abort & Remove
                </Button>
              </motion.div>
            ) : (
              <div className="space-y-4 relative z-10 pointer-events-none">
                <div className="mx-auto w-28 h-28 bg-background/80 backdrop-blur-md rounded-2xl flex items-center justify-center border-2 border-primary/30 shadow-[0_0_20px_rgba(0,240,255,0.1)] group-hover:scale-110 group-hover:border-primary/80 group-hover:shadow-[0_0_40px_rgba(0,240,255,0.5)] transition-all duration-700 relative">
                  <motion.div className="absolute inset-0 border-2 border-primary/50 rounded-2xl" animate={{ rotate: 360 }} transition={{ duration: 10, ease: "linear", repeat: Infinity }} style={{ borderStyle: 'dashed' }} />
                  <UploadCloud className="h-12 w-12 text-primary drop-shadow-[0_0_12px_rgba(0,240,255,1)] group-hover:scale-110 transition-transform duration-500" />
                </div>
                <div>
                  <p className="font-black text-3xl tracking-[0.2em] uppercase text-foreground group-hover:neon-text transition-colors duration-300">INITIATE UPLOAD</p>
                  <p className="text-sm text-primary/60 font-semibold tracking-widest mt-3 uppercase">Click or Drop PPTX File Here</p>
                </div>
              </div>
            )}
          </label>

          {/* PPT Quality Warning Banner */}
          {uploadedQuality && qualityStyle && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mt-6 rounded-lg border p-4 flex gap-3 items-start ${qualityStyle.bg} ${qualityStyle.border}`}
            >
              <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${qualityStyle.text}`} />
              <div>
                <p className={`text-sm font-semibold ${qualityStyle.text}`}>
                  PPT Quality: {uploadedQuality.verdict.replace("_", " ")}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{uploadedQuality.summary}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  📊 Slides: {uploadedQuality.total_slides} &nbsp;|&nbsp;
                  Blank: {uploadedQuality.blank_slides} &nbsp;|&nbsp;
                  Words: {uploadedQuality.total_words}
                </p>
              </div>
            </motion.div>
          )}

          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              {uploadedQuality ? "Review quality report above before proceeding." : ""}
            </div>
            <div className="flex gap-3">
              <Button
                size="lg"
                disabled={!file || isUploading}
                onClick={uploadedQuality ? () => navigate("/analysis") : handleUpload}
                className={isUploading ? "opacity-80" : "cyber-button px-8 h-12"}
              >
                {isUploading ? (
                  <><Loader className="mr-2 h-4 w-4 text-primary-foreground" />Uploading...</>
                ) : uploadedQuality ? (
                  <><CheckCircle className="mr-2 h-4 w-4" />Proceed to Analysis</>
                ) : (
                  <><UploadCloud className="mr-2 h-4 w-4" />Upload & Check Quality</>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
