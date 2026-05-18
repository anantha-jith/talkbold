import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card"
import { Activity, BookOpen, Clock, FileText } from "lucide-react"
import { getDashboardStats } from "../api/services"
import { Skeleton } from "../components/ui/Skeleton"
import toast from "react-hot-toast"

export function Dashboard() {
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats()
        setStats(data)
      } catch (error) {
        console.error(error)
        toast.error("Failed to load dashboard statistics.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchStats()
  }, [])

  const statCards = [
    { title: "Total Presentations", value: stats?.total_presentations || "0", icon: BookOpen },
    { title: "Avg. Confidence Score", value: "88%", icon: Activity },
    { title: "Mock Vivas Taken", value: stats?.total_presentations || "0", icon: FileText },
    { title: "Hours Practiced", value: `${(stats?.total_presentations || 0) * 2}h`, icon: Clock },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-widest uppercase text-foreground drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
          Welcome back, <span className="neon-text">Administrator</span>
        </h1>
        <p className="text-muted-foreground mt-3 text-lg tracking-wide">System overview of your presentation readiness parameters.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-primary/10">
                <CardTitle className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-5 w-5 text-primary drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold mt-4 text-foreground drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{stat.value}</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Analyses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 text-sm">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
              ) : stats?.recent_analyses?.length > 0 ? (
                stats.recent_analyses.map((analysis, i) => (
                  <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-primary/20 bg-background/50 hover:bg-primary/10 transition-colors shadow-[0_0_10px_rgba(0,240,255,0.05)]">
                    <span className="font-semibold tracking-wide truncate mr-4">{analysis.topic}</span>
                    <span className="text-primary font-bold shrink-0 drop-shadow-[0_0_5px_rgba(0,240,255,0.8)]">{analysis.score}%</span>
                  </div>
                ))
              ) : (
                <div className="text-muted-foreground text-center py-4">No recent analyses found.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-primary/10 border-primary/30 shadow-[inset_0_0_30px_rgba(0,240,255,0.1)] relative overflow-hidden group">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50"></div>
          <CardHeader>
            <CardTitle className="text-xl tracking-widest uppercase neon-text">Quick Start Sequence</CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-base text-muted-foreground mb-6">
              Initialize a new presentation upload to acquire instant feedback and prepare for your next simulation.
            </p>
            <a href="/upload" className="cyber-button inline-flex items-center justify-center rounded-md px-6 py-3 w-full sm:w-auto">
              INITIALIZE UPLOAD
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
