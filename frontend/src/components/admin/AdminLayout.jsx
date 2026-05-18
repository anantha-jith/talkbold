import { useState } from "react"
import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { motion } from "framer-motion"
import { 
  Activity, Users, Mic, BarChart2, Server, LogOut, FileText, ChevronRight
} from "lucide-react"
import { useAuth } from "../../context/AuthContext"
import toast from "react-hot-toast"

export function AdminLayout() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  
  const handleLogout = async () => {
    try {
      await logout()
      navigate("/login")
    } catch (error) {
      toast.error("Logout failed")
    }
  }

  const navItems = [
    { name: "Platform Overview", path: "/admin", icon: Activity, exact: true },
    { name: "Student Analytics", path: "/admin/students", icon: Users },
    { name: "Speech Intelligence", path: "/admin/speech", icon: Mic },
    { name: "Report Hub", path: "/admin/reports", icon: FileText },
    { name: "System Monitor", path: "/admin/system", icon: Server },
  ]

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-primary/20 bg-card/40 backdrop-blur-xl flex flex-col relative z-20">
        <div className="p-6 border-b border-primary/20">
          <h2 className="text-xl font-black tracking-widest text-primary drop-shadow-[0_0_10px_rgba(0,240,255,0.8)] uppercase">
            Admin <span className="text-white">Panel</span>
          </h2>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold tracking-wide text-sm ${
                  isActive
                    ? "bg-primary/20 text-primary border border-primary/50 shadow-[0_0_15px_rgba(0,240,255,0.2)]"
                    : "text-muted-foreground hover:bg-white/5 hover:text-white border border-transparent"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.name}
              <ChevronRight className="w-4 h-4 ml-auto opacity-50" />
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-primary/20">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-red-500/40 text-red-500 font-bold uppercase tracking-wider hover:bg-red-500/10 transition-all text-sm"
          >
            <LogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background">
        {/* Animated grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none" />
        
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        
        <div className="h-full overflow-y-auto p-8 relative z-10 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
