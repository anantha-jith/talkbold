import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth"
import { auth } from "../firebase"

const AuthContext = createContext(null)

// In production (Netlify): VITE_API_BASE_URL = full Render backend URL
// In local dev: '/api' goes through the Vite proxy → localhost:8000
const API = import.meta.env.VITE_API_BASE_URL || "/api"

export function AuthProvider({ children }) {
  // { email, role, token, name, picture, authMethod: "google" | "admin" }
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)   // true until auth state resolved

  // ── Restore session from localStorage on mount ──────────────────────────────
  useEffect(() => {
    const token   = localStorage.getItem("viva_token")
    const role    = localStorage.getItem("viva_role")
    const email   = localStorage.getItem("viva_email")
    const name    = localStorage.getItem("viva_name")    || ""
    const picture = localStorage.getItem("viva_picture") || ""
    const method  = localStorage.getItem("viva_method")  || "admin"

    if (token && role && email) {
      setUser({ token, role, email, name, picture, authMethod: method })
    }
    // Don't set loading=false yet — wait for Firebase state
  }, [])

  // ── Firebase auth state listener ────────────────────────────────────────────
  // Handles: page refresh, session expiry, Google sign-out
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Firebase says user is logged in — check if we already have a valid session
        const existingToken = localStorage.getItem("viva_token")
        const existingEmail = localStorage.getItem("viva_email")
        const existingMethod = localStorage.getItem("viva_method")

        // Guest sessions don't go through Firebase — skip re-exchange
        if (existingMethod === "guest" && existingToken) {
          setLoading(false)
          return
        }

        if (existingToken && existingEmail === firebaseUser.email) {
          // Session already valid — nothing to do
          setLoading(false)
          return
        }

        // Firebase user exists but no local session → re-exchange for JWT
        try {
          const idToken = await firebaseUser.getIdToken()
          const res = await fetch(`${API}/auth/google`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ id_token: idToken }),
          })
          if (res.ok) {
            const data = await res.json()
            _persist(data.token, data.role, data.email, data.name, data.picture, "google")
          }
        } catch {
          // Backend unreachable — silent fail, user will need to sign in manually
        }
      } else {
        // Firebase signed out — only clear if auth method was google
        const method = localStorage.getItem("viva_method")
        if (method === "google") {
          _clear()
        }
      }
      setLoading(false)
    })

    return unsubscribe   // cleanup on unmount
  }, []) // eslint-disable-line

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const _persist = (token, role, email, name = "", picture = "", method = "google") => {
    localStorage.setItem("viva_token",   token)
    localStorage.setItem("viva_role",    role)
    localStorage.setItem("viva_email",   email)
    localStorage.setItem("viva_name",    name)
    localStorage.setItem("viva_picture", picture)
    localStorage.setItem("viva_method",  method)
    setUser({ token, role, email, name, picture, authMethod: method })
  }

  const _clear = () => {
    // Preserve the guest device UID so re-login reuses the same session/limits
    const guestUid = localStorage.getItem("viva_guest_uid")
    ;["viva_token","viva_role","viva_email","viva_name","viva_picture","viva_method"]
      .forEach(k => localStorage.removeItem(k))
    // Restore guest UID if it existed
    if (guestUid) localStorage.setItem("viva_guest_uid", guestUid)
    setUser(null)
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /** Called by Login page after receiving JWT from backend */
  const login = useCallback((token, role, email, name = "", picture = "", method = "google") => {
    _persist(token, role, email, name, picture, method)
  }, [])

  /** Sign out — clears Firebase session + local storage */
  const logout = useCallback(async () => {
    const method = localStorage.getItem("viva_method")
    _clear()
    // Only call Firebase signOut for Google users (guests bypass Firebase entirely)
    if (method === "google") {
      try { await firebaseSignOut(auth) } catch { /* ignore */ }
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
