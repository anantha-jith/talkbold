import { useState, useEffect } from "react"
import { Search, Filter, ShieldAlert, Award, FileText } from "lucide-react"
import { getRecentReports } from "../../api/adminServices"
import { Card, CardContent } from "../../components/ui/Card"
import { Loader } from "../../components/ui/Loader"

export function AdminReports() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    getRecentReports()
      .then(setReports)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = reports.filter(r => 
    r.topic?.toLowerCase().includes(search.toLowerCase()) || 
    r.analysis?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader /></div>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-widest uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            Report <span className="neon-text">Hub</span>
          </h1>
          <p className="text-muted-foreground mt-2">Monitor all platform presentations, scores, and system flags.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card/40 backdrop-blur-md border border-primary/20 p-2 rounded-xl">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search topic..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-background/50 border border-white/5 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50 transition-all w-64"
            />
          </div>
          <button className="p-2 hover:bg-white/5 rounded-lg transition-all">
            <Filter className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <Card className="border-primary/20 bg-card/40 backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-background/50 text-xs tracking-widest uppercase text-muted-foreground font-bold">
                <th className="p-4">Topic</th>
                <th className="p-4">Confidence</th>
                <th className="p-4">Fluency</th>
                <th className="p-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((r, i) => {
                const conf = r.audio_scores?.confidence_score || 0
                const flu = r.audio_scores?.fluency_score || 0
                const robotic = r.audio_scores?.robotic_text?.robotic_score || 0
                const isSuspicious = robotic > 40

                return (
                  <tr key={i} className="hover:bg-white/5 transition-colors group cursor-pointer">
                    <td className="p-4">
                      <p className="font-bold text-sm text-foreground">{r.topic || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1 max-w-xs">
                        {r.transcription ? "Audio Recorded" : "Text Script Only"}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${conf >= 80 ? 'text-green-400' : conf >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {conf}%
                        </span>
                        <div className="w-16 h-1.5 bg-background rounded-full overflow-hidden">
                          <div className={`h-full ${conf >= 80 ? 'bg-green-400' : conf >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${conf}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-mono text-white/80">{flu}%</span>
                    </td>
                    <td className="p-4">
                      {isSuspicious ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider">
                          <ShieldAlert className="w-3 h-3" /> Flagged
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-bold uppercase tracking-wider">
                          <Award className="w-3 h-3" /> Clean
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No reports found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
