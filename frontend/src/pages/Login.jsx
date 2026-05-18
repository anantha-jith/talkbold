import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { signInWithPopup } from "firebase/auth"
import { auth, googleProvider } from "../firebase"
import { BookOpen, Lock, Eye, EyeOff, ArrowRight, Loader2, Shield, User } from "lucide-react"
import { useAuth } from "../context/AuthContext"
import toast from "react-hot-toast"

// In production (Netlify): VITE_API_BASE_URL = full Render backend URL
// In local dev: '/api' goes through the Vite proxy → localhost:8000
const API = import.meta.env.VITE_API_BASE_URL || "/api"

async function apiPost(path, body) {
  const res = await fetch(`${API}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.detail || "Request failed")
  return data
}

import { SpaceBackground } from "../components/layout/SpaceBackground"

// ── Google Sign-In button ─────────────────────────────────────────────────────
function GoogleButton({ onClick, loading }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 py-4 rounded-xl
                 glass-panel text-white font-bold text-sm tracking-wider uppercase
                 hover:shadow-[0_0_25px_rgba(0,240,255,0.4)] transition-all duration-300
                 disabled:opacity-60 disabled:cursor-not-allowed
                 hover:scale-[1.02] active:scale-[0.98] border border-primary/40 relative overflow-hidden group"
    >
      <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      ) : (
        <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      )}
      {loading ? "Signing in…" : "Continue with Google"}
    </button>
  )
}

// ── Admin login panel ─────────────────────────────────────────────────────────
function AdminPanel({ onSuccess }) {
  const [email, setEmail]       = useState("admin@admin.com")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!password) { toast.error("Enter password"); return }
    setLoading(true)
    try {
      const data = await apiPost("/auth/login", { email, password })
      onSuccess(data)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-500/70" />
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5
                     text-xs text-white placeholder-white/30 focus:outline-none
                     focus:border-amber-500/50 transition-all"
        />
      </div>

      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-500/70" />
        <input
          type={showPass ? "text" : "password"}
          placeholder="Admin password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-9 py-2.5
                     text-xs text-white placeholder-white/30 focus:outline-none
                     focus:border-amber-500/50 transition-all"
        />
        <button type="button" onClick={() => setShowPass(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
          {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30
                   border border-amber-500/30 text-amber-400 font-semibold text-xs
                   transition-all flex items-center justify-center gap-2
                   disabled:opacity-50 disabled:cursor-not-allowed">
        {loading
          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Authenticating…</>
          : <><Shield className="h-3.5 w-3.5" /> Admin Sign In <ArrowRight className="h-3 w-3" /></>}
      </button>
    </form>
  )
}

// ── Main Login page ───────────────────────────────────────────────────────────
export function Login() {
  const { login } = useAuth()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showAdmin, setShowAdmin]         = useState(false)

  // ── Google sign-in flow ──────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      // 1. Firebase Google popup
      const result   = await signInWithPopup(auth, googleProvider)
      const fireUser = result.user
      const idToken  = await fireUser.getIdToken()

      // 2. Exchange Firebase token for internal JWT
      const data = await apiPost("/auth/google", { id_token: idToken })

      // 3. Store session
      login(data.token, data.role, data.email, data.name, data.picture, "google")
      toast.success(`Welcome, ${data.name || data.email.split("@")[0]}! 🎓`)
    } catch (err) {
      // User closed popup → no toast needed
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        setGoogleLoading(false)
        return
      }
      toast.error(err.message || "Google sign-in failed")
    } finally {
      setGoogleLoading(false)
    }
  }

  // ── Guest sign-in flow ───────────────────────────────────────────────────────
  const [guestLoading, setGuestLoading] = useState(false)

  const handleGuest = async () => {
    setGuestLoading(true)
    try {
      // Read permanent device UID (survives logouts)
      const deviceGuestUid = localStorage.getItem("viva_guest_uid") || null

      // Send UID to backend — if found, reuses same session & limits
      const data = await apiPost("/auth/guest", { guest_uid: deviceGuestUid })

      // Permanently store guest UID so next login reuses the same record
      if (data.guest_uid) {
        localStorage.setItem("viva_guest_uid", data.guest_uid)
      }

      login(data.token, data.role, data.email, data.name, data.picture, "guest")

      const isReturning = !!deviceGuestUid
      toast.success(isReturning ? "Welcome back, Guest!" : "Welcome, Guest! You have 3 attempts.")
    } catch (err) {
      toast.error(err.message || "Guest sign-in failed")
    } finally {
      setGuestLoading(false)
    }
  }

  const handleAdminSuccess = (data) => {
    login(data.token, data.role, data.email, data.name || "Admin", data.picture || "", "admin")
    toast.success("Admin access granted.")
  }

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center relative px-4 text-foreground">
      <SpaceBackground />

      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut", type: "spring", bounce: 0.4 }}
        className="relative w-full max-w-lg z-10"
      >
        {/* Holographic glowing backplate */}
        <div className="absolute -inset-1 bg-gradient-to-r from-primary/50 via-[#4a00ff]/50 to-primary/50 rounded-[2rem] blur-xl opacity-50 animate-pulse" />

        {/* Glass card */}
        <div className="relative glass-panel rounded-2xl overflow-hidden backdrop-blur-3xl bg-[#030508]/60 border border-primary/30"
             style={{ boxShadow: "0 0 100px rgba(0,240,255,0.1), inset 0 0 30px rgba(0,240,255,0.05)" }}>

          {/* Header */}
          <div className="px-10 pt-12 pb-8 border-b border-primary/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-60"></div>
            <div className="flex items-center gap-5 mb-10 relative z-10">
              <div className="h-16 w-16 rounded-2xl bg-primary/20 border-2 border-primary/60
                              flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.6)]">
                <BookOpen className="h-8 w-8 text-primary drop-shadow-[0_0_12px_rgba(0,240,255,1)]" />
              </div>
              <div>
                <div className="text-4xl font-extrabold text-white tracking-[0.2em] uppercase">
                  Talk<span className="neon-text">Bold</span>
                </div>
                <div className="text-[12px] text-primary/80 mt-1 tracking-[0.3em] uppercase font-semibold">Precision Presentation Intelligence</div>
              </div>
            </div>

            <h1 className="text-4xl font-black text-white mb-3 tracking-tighter drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] relative z-10">SYSTEM INITIALIZED</h1>
            <p className="text-base text-white/60 tracking-wide relative z-10">
              Sign in with your university Google account to continue.
            </p>
          </div>

          {/* Body */}
          <div className="px-10 py-8 space-y-6">

            {/* Google button — primary CTA */}
            <GoogleButton onClick={handleGoogle} loading={googleLoading} />

            {/* Guest button */}
            <button
              onClick={handleGuest}
              disabled={guestLoading || googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl
                         bg-white/5 text-white font-bold text-sm tracking-wider uppercase
                         hover:bg-white/10 transition-all duration-300 border border-white/10
                         disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {guestLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              ) : (
                <User className="h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />
              )}
              Continue as Guest
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[11px] text-white/20 uppercase tracking-widest">Students use Google</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {/* Feature bullets */}
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-6 space-y-4 shadow-[inset_0_0_30px_rgba(0,240,255,0.05)] backdrop-blur-md">
              {[
                "Precision presentation analysis",
                "Real-time acoustic confidence scoring",
                "Interactive mock examination",
              ].map(f => (
                <div key={f} className="flex items-center gap-4 text-sm text-white/70 tracking-wider">
                  <span className="text-primary flex-shrink-0 drop-shadow-[0_0_8px_rgba(0,240,255,1)]">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                  </span>
                  {f}
                </div>
              ))}
            </div>

            {/* Admin toggle */}
            <div className="pt-2">
              <button
                onClick={() => setShowAdmin(v => !v)}
                className="w-full text-center text-[11px] text-white/20 hover:text-white/40
                           transition-colors flex items-center justify-center gap-1.5"
              >
                <Shield size={11} />
                {showAdmin ? "Hide admin panel" : "Administrator access"}
              </button>

              <AnimatePresence>
                {showAdmin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden mt-4"
                  >
                    <div className="rounded-xl bg-amber-500/[0.05] border border-amber-500/[0.2] p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Shield className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs font-semibold text-amber-500/80 uppercase tracking-wider">
                          Admin Login
                        </span>
                      </div>
                      <AdminPanel onSuccess={handleAdminSuccess} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Footer */}
          <div className="px-10 pb-8 text-center relative z-10">
            <p className="text-xs text-white/20 tracking-widest uppercase">
              Secure encrypted connection established.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
