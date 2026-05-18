import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { 
  Users, FileText, Mic, Activity, Zap, ShieldAlert, Cpu
} from "lucide-react"
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from "recharts"
import { getAdminOverview } from "../../api/adminServices"
import { Card, CardContent } from "../../components/ui/Card"
import { Loader } from "../../components/ui/Loader"

const MOCK_TREND_DATA = [
  { name: 'Mon', reports: 12, viva: 8 },
  { name: 'Tue', reports: 19, viva: 15 },
  { name: 'Wed', reports: 15, viva: 12 },
  { name: 'Thu', reports: 22, viva: 18 },
  { name: 'Fri', reports: 28, viva: 24 },
  { name: 'Sat', reports: 35, viva: 30 },
  { name: 'Sun', reports: 42, viva: 38 },
]

function MetricCard({ title, value, icon: Icon, color, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="relative overflow-hidden group">
        <div className={`absolute top-0 right-0 w-32 h-32 bg-${color}-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-${color}-500/20`} />
        <CardContent className="p-6 relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground tracking-widest uppercase mb-1">{title}</p>
              <h3 className={`text-4xl font-black text-${color}-400 drop-shadow-[0_0_10px_currentColor]`}>{value}</h3>
            </div>
            <div className={`p-3 rounded-2xl bg-${color}-500/10 border border-${color}-500/30`}>
              <Icon className={`w-6 h-6 text-${color}-400`} />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export function AdminDashboard() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminOverview()
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader /></div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-widest uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary" />
          Global <span className="neon-text">Analytics</span>
        </h1>
        <p className="text-muted-foreground mt-2">Real-time platform monitoring and intelligence.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard title="Total Users" value={metrics?.total_users || 0} icon={Users} color="primary" delay={0.1} />
        <MetricCard title="Reports Generated" value={metrics?.total_reports || 0} icon={FileText} color="green" delay={0.2} />
        <MetricCard title="Audio Recordings" value={metrics?.total_audio || 0} icon={Mic} color="purple" delay={0.3} />
        <MetricCard title="Active Today" value={metrics?.active_today || 0} icon={Zap} color="orange" delay={0.4} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <Card className="lg:col-span-2 border-primary/20 bg-card/40 backdrop-blur-md">
          <CardContent className="p-6">
            <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-6">Platform Activity Trend</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={MOCK_TREND_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', borderColor: 'rgba(0,240,255,0.3)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="reports" stroke="#00f0ff" strokeWidth={3} dot={{ fill: '#00f0ff', r: 4 }} activeDot={{ r: 6, fill: '#fff' }} />
                  <Line type="monotone" dataKey="viva" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6', r: 4 }} activeDot={{ r: 6, fill: '#fff' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Average Scores Panel */}
        <Card className="border-primary/20 bg-card/40 backdrop-blur-md">
          <CardContent className="p-6 space-y-6">
            <h3 className="text-sm font-bold tracking-widest uppercase text-muted-foreground mb-4">Global Averages</h3>
            
            {[
              { label: "Confidence", val: metrics?.avg_confidence, color: "text-green-400", bg: "bg-green-400" },
              { label: "Fluency", val: metrics?.avg_fluency, color: "text-primary", bg: "bg-primary" },
              { label: "Technical", val: metrics?.avg_technical, color: "text-purple-400", bg: "bg-purple-400" },
              { label: "Speaking Pace (WPM)", val: metrics?.avg_wpm, color: "text-yellow-400", bg: "bg-yellow-400", suffix: "" }
            ].map((stat, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-semibold">{stat.label}</span>
                  <span className={`text-xl font-black ${stat.color}`}>{stat.val || 0}{stat.suffix ?? "%"}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(stat.val || 0, 100)}%` }}
                    transition={{ duration: 1, delay: 0.5 + (i * 0.1) }}
                    className={`h-full ${stat.bg} shadow-[0_0_10px_currentColor]`}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
