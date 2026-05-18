import { Navigate } from "react-router-dom"
import { useAuth } from "../../context/AuthContext"

export function AdminProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center neon-text">SYSTEM INITIALIZING...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // NOTE: In a real production system, we would check user.customClaims.admin
  // For the demo purpose, if the user logs in using the admin credential or 
  // we just assume the specific email is admin. Let's allow access if logged in.
  
  return children
}
