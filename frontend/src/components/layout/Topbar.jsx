import { Bell, User } from "lucide-react"

export function Topbar() {
  return (
    <div className="h-16 border-b border-primary/20 bg-background/40 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-10">
      <div className="text-lg font-bold tracking-widest uppercase text-foreground neon-text">Dashboard</div>
    </div>
  )
}
