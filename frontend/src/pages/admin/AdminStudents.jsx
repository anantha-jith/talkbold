import { useState, useEffect } from "react"
import { Users, Search, Filter, Mail, Calendar, Shield } from "lucide-react"
import { getUsersList } from "../../api/adminServices"
import { Card, CardContent } from "../../components/ui/Card"
import { Loader } from "../../components/ui/Loader"

export function AdminStudents() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  useEffect(() => {
    getUsersList()
      .then(setUsers)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Loader /></div>
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-widest uppercase text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            Student <span className="neon-text">Directory</span>
          </h1>
          <p className="text-muted-foreground mt-2">Manage all registered users and their platform access.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-card/40 backdrop-blur-md border border-primary/20 p-2 rounded-xl">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search name or email..." 
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
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Last Login</th>
                <th className="p-4">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((u, i) => {
                const isAdmin = u.role === "admin"
                
                return (
                  <tr key={i} className="hover:bg-white/5 transition-colors group cursor-pointer">
                    <td className="p-4 flex items-center gap-3">
                      {u.picture ? (
                        <img src={u.picture} alt="Avatar" className="w-8 h-8 rounded-full border border-primary/30" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center text-xs font-bold text-primary">
                          {u.name?.charAt(0) || u.email?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-sm text-foreground">{u.name || "Unknown User"}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {u.email}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">
                      {isAdmin ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold uppercase tracking-wider">
                          <Shield className="w-3 h-3" /> Admin
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 border border-primary/20 text-primary text-xs font-bold uppercase tracking-wider">
                          <Users className="w-3 h-3" /> Student
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-white/80">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "N/A"}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    No users found matching your search.
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
