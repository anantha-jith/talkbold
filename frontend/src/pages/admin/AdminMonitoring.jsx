import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Server, Activity, Database, Cpu, HardDrive, RefreshCw, TerminalSquare } from "lucide-react"
import { getSystemHealth } from "../../api/adminServices"
import { Card, CardContent } from "../../components/ui/Card"

function StatusBadge({ status }) {
  const isOnline = status === "Online" || status === "Operational"
  return (
    <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 ${
      isOnline ? "bg-green-500/10 text-green-400 border border-green-500/30" : "bg-red-500/10 text-red-400 border border-red-500/30"
    }`}>
      <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
      {status}
    </div>
  )
}

function MetricRing({ title, percentage, icon: Icon, color }) {
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center relative group">
      <div className={`absolute inset-0 bg-${color}-500/5 rounded-full blur-xl group-hover:bg-${color}-500/20 transition-all`} />
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="64"
            cy="64"
            r={radius}
            className="stroke-muted/20"
            strokeWidth="8"
            fill="none"
          />
          {/* Progress circle */}
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            className={`stroke-${color}-500 drop-shadow-[0_0_8px_currentColor]`}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Icon className={`w-5 h-5 text-${color}-400 mb-1`} />
          <span className="text-xl font-black text-foreground">{percentage}%</span>
        </div>
      </div>
      <span className="mt-4 text-xs font-bold tracking-widest uppercase text-muted-foreground">{title}</span>
    </div>
  )
}

export function AdminMonitoring() {
  const [health, setHealth] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const fetchData = () => {
    getSystemHealth().then(data => {
      setHealth(data)
      setLastUpdated(new Date())
    })
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000) // Live update every 5 seconds
    return () => clearInterval(interval)
  }, [])

  if (!health) return null

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-widest uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] flex items-center gap-3">
            <Server className="w-8 h-8 text-primary" />
            System <span className="neon-text">Health</span>
          </h1>
          <p className="text-muted-foreground mt-2">Live monitoring of infrastructure and system models.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Last Sync</p>
          <div className="flex items-center gap-2 text-sm font-mono text-primary bg-primary/10 px-3 py-1 rounded-md border border-primary/20">
            <RefreshCw className="w-3 h-3 animate-spin" />
            {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 md:col-span-3 border-primary/20 bg-card/40 backdrop-blur-md">
          <CardContent className="p-8">
            <div className="flex justify-around items-center">
              <MetricRing title="CPU Usage" percentage={health.cpu_usage} icon={Cpu} color="primary" />
              <MetricRing title="Memory" percentage={health.memory_usage} icon={Activity} color="purple" />
              <MetricRing title="Disk I/O" percentage={health.disk_usage} icon={HardDrive} color="green" />
            </div>
          </CardContent>
        </Card>

        {/* Services Status */}
        <Card className="md:col-span-2 border-primary/20 bg-card/40 backdrop-blur-md">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-6 flex items-center gap-2">
              <Database className="w-4 h-4" /> Core Services
            </h3>
            <div className="space-y-4">
              {Object.entries(health.services).map(([service, status]) => (
                <div key={service} className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-white/5">
                  <div className="flex items-center gap-3">
                    <TerminalSquare className="w-5 h-5 text-muted-foreground" />
                    <span className="font-mono font-bold text-sm tracking-wider uppercase">{service}</span>
                  </div>
                  <StatusBadge status={status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Network & API */}
        <Card className="border-primary/20 bg-card/40 backdrop-blur-md">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-6">Network</h3>
            
            <div className="space-y-6">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">API Latency</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-green-400 drop-shadow-[0_0_10px_rgba(74,222,128,0.5)]">{health.api_latency_ms}</span>
                  <span className="text-sm text-green-400 font-bold">ms</span>
                </div>
              </div>
              
              <div className="h-px bg-white/5" />
              
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Active Websocket / Viva Sessions</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-primary drop-shadow-[0_0_10px_rgba(0,240,255,0.5)]">{health.active_sessions}</span>
                </div>
              </div>

              <div className="h-px bg-white/5" />
              
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Server Uptime</p>
                <div className="text-lg font-mono text-white/80">
                  {Math.floor(health.uptime_seconds / 3600)}h {Math.floor((health.uptime_seconds % 3600) / 60)}m {health.uptime_seconds % 60}s
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
