import { useState, useEffect } from "react"
import { NavLink, useNavigate, useLocation } from "react-router-dom"
import { Home, UploadCloud, Activity, Mic, FileText, Settings, BookOpen, LogOut, Shield, User, Zap } from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import apiClient from "../../api/client"

const GUEST_LIMIT = 3

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isAdmin = user?.role === "admin"
  const isGuest = user?.role === "guest"

  const [guestUsage, setGuestUsage] = useState({ used: 0, remaining: GUEST_LIMIT })

  // Fetch live usage every time the user navigates + poll every 5s while guest
  useEffect(() => {
    if (!isGuest) return
    
    const fetchUsage = () => {
      apiClient.get("/auth/usage")
        .then(res => setGuestUsage(res.data))
        .catch(() => {})
    }
    
    fetchUsage() // immediate on mount/route change
    const interval = setInterval(fetchUsage, 5000)
    return () => clearInterval(interval)
  }, [isGuest, location.pathname])

  const adminLinks = [
    { name: "Admin Panel", to: "/admin",      icon: Shield,      admin: true },
  ]

  const userLinks = [
    { name: "Upload",    to: "/upload",    icon: UploadCloud },
    { name: "Analysis",  to: "/analysis",  icon: Activity },
    { name: "Viva Exam",  to: "/mock-viva", icon: Mic },
    { name: "Report",    to: "/report",    icon: FileText },
    { name: "Settings",  to: "/settings",  icon: Settings },
  ]

  // Guests get the same full access as regular users; 3-attempt limit enforced at backend upload level
  const links = isAdmin ? [...adminLinks, ...userLinks] : userLinks

  const handleLogout = () => {
    logout()
    navigate("/login")
  }

  return (
    <div className="w-64 h-screen border-r border-primary/20 bg-background/40 backdrop-blur-md flex flex-col fixed left-0 top-0 z-20 shadow-[0_0_30px_rgba(0,240,255,0.05)]">
      {/* Logo */}
      <div className="h-20 flex items-center px-6 border-b border-primary/20">
        <div className="bg-primary/20 p-2 rounded-lg mr-3 shadow-[0_0_15px_rgba(0,240,255,0.3)] border border-primary/50">
          <BookOpen className="h-6 w-6 text-primary drop-shadow-[0_0_8px_rgba(0,240,255,1)]" />
        </div>
        <span className="font-bold text-2xl tracking-widest uppercase">
          Talk<span className="neon-text">Bold</span>
        </span>
      </div>

      {/* User badge */}
      {user && (
        <div className="px-4 py-4 border-b border-primary/20 bg-primary/5">
          <div className="flex items-center gap-3">
            {/* Avatar — Google photo or initial */}
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name || user.email}
                referrerPolicy="no-referrer"
                className={`h-7 w-7 rounded-full object-cover border ${
                  isAdmin ? "border-amber-500/40" : "border-indigo-500/30"
                }`}
              />
            ) : (
              <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isAdmin
                  ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                  : "bg-primary/20 text-primary border border-primary/20"
              }`}>
                {isAdmin ? <Shield size={13} /> : (user.name || user.email)[0].toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate tracking-wider text-foreground">
                {user.name || user.email.split("@")[0]}
              </p>
              <p className={`text-[11px] font-bold uppercase tracking-widest ${
                isAdmin 
                  ? "text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]" 
                  : isGuest
                  ? "text-orange-400 drop-shadow-[0_0_5px_rgba(251,146,60,0.8)]"
                  : "text-primary drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]"
              }`}>
                {isAdmin ? "Administrator" : isGuest ? `Guest · ${guestUsage.remaining} left` : "Student"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav links */}
      <div className="flex-1 min-h-0 py-4 px-4 space-y-1 overflow-y-auto">
        {/* Admin section header */}
        {isAdmin && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-4 pt-1 pb-2">
            Admin
          </p>
        )}
        {isAdmin && (
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 relative group overflow-hidden ${
                isActive
                  ? "bg-amber-500/20 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.1)] border border-amber-500/30"
                  : "text-muted-foreground hover:bg-amber-500/10 hover:text-amber-500 hover:border hover:border-amber-500/20 border border-transparent"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)]" />
                )}
                <Home className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(245,158,11,0.8)] ${isActive ? "drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" : ""}`} />
                <span className="tracking-wide relative z-10">Dashboard</span>
              </>
            )}
          </NavLink>
        )}

        {/* User section header */}
        {isAdmin && (
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-4 pt-4 pb-2">
            Platform
          </p>
        )}

        {userLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 relative group overflow-hidden ${
                isActive
                  ? "bg-primary/20 text-primary shadow-[0_0_15px_rgba(0,240,255,0.1)] border border-primary/30"
                  : "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:border hover:border-primary/20 border border-transparent"
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary shadow-[0_0_10px_rgba(0,240,255,0.8)]" />
                )}
                <link.icon className={`h-5 w-5 transition-transform duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(0,240,255,0.8)] ${isActive ? "drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" : ""}`} />
                <span className="tracking-wide relative z-10">{link.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* Guest Upgrade Banner */}
      {isGuest && (
        <div className="px-4 pb-3">
          <div className="rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 border border-orange-500/30 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                <span className="text-xs font-bold text-orange-400 uppercase tracking-widest">Guest Mode</span>
              </div>
              <span className={`text-xs font-black ${
                guestUsage.remaining === 0 ? "text-red-400" 
                : guestUsage.remaining === 1 ? "text-yellow-400" 
                : "text-orange-400"
              }`}>
                {guestUsage.remaining}/{GUEST_LIMIT}
              </span>
            </div>

            {/* Attempts progress bar */}
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  guestUsage.remaining === 0 ? "bg-red-500" 
                  : guestUsage.remaining === 1 ? "bg-yellow-500" 
                  : "bg-orange-400"
                }`}
                style={{ width: `${(guestUsage.remaining / GUEST_LIMIT) * 100}%` }}
              />
            </div>

            <p className="text-xs text-white/60 mb-3">
              {guestUsage.remaining === 0
                ? "You've used all 3 attempts. Sign in to continue."
                : `${guestUsage.remaining} attempt${guestUsage.remaining !== 1 ? "s" : ""} remaining. Sign in for unlimited access.`
              }
            </p>
            <button 
              onClick={() => { logout(); navigate("/login") }}
              className="w-full py-2 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-400 font-bold text-xs uppercase tracking-wider hover:bg-orange-500/30 transition-all"
            >
              Upgrade → Sign In with Google
            </button>
          </div>
        </div>
      )}

      {/* Logout */}
      <div className="p-4 border-t border-primary/20 bg-background/50">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium tracking-wide uppercase transition-all duration-300 text-muted-foreground border border-transparent hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] group"
        >
          <LogOut className="h-5 w-5 transition-transform group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
          Sign out
        </button>
      </div>
    </div>
  )
}
