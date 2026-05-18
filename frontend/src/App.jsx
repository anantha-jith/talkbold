import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom"
import { Toaster } from "react-hot-toast"
import { AppProvider } from "./context/AppContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import { MainLayout } from "./components/layout/MainLayout"
import { Dashboard } from "./pages/Dashboard"
import { Upload } from "./pages/Upload"
import { Analysis } from "./pages/Analysis"
import { MockViva } from "./pages/MockViva"
import { Report } from "./pages/Report"
import { Settings } from "./pages/Settings"
import { Login } from "./pages/Login"

// Admin Panel Imports
import { AdminLayout } from "./components/admin/AdminLayout"
import { AdminProtectedRoute } from "./components/admin/AdminProtectedRoute"
import { AdminDashboard } from "./pages/admin/AdminDashboard"
import { AdminStudents } from "./pages/admin/AdminStudents"
import { AdminReports } from "./pages/admin/AdminReports"
import { AdminSpeech } from "./pages/admin/AdminSpeech"
import { AdminMonitoring } from "./pages/admin/AdminMonitoring"

// ── Protected route wrapper ───────────────────────────────────────────────────
function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-muted-foreground text-sm">Loading…</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

// ── Admin-only guard ──────────────────────────────────────────────────────────
function RequireAdmin({ children }) {
  const { user } = useAuth()
  if (user?.role !== "admin") {
    return <Navigate to="/upload" replace />
  }
  return children
}

// ── Root redirect based on role ───────────────────────────────────────────────
function RootRedirect() {
  const { user } = useAuth()
  // If admin, send to the enterprise admin panel
  if (user?.role === "admin") return <Navigate to="/admin" replace />
  return <Navigate to="/upload" replace />
}

// ── App shell ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <Toaster
            position="top-right"
            toastOptions={{
              className: "dark:bg-muted dark:text-foreground border border-border shadow-sm rounded-lg",
              duration: 3000,
            }}
          />
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginRedirect />} />

            {/* Protected Student Layout */}
            <Route
              path="/"
              element={
                <RequireAuth>
                  <MainLayout />
                </RequireAuth>
              }
            >
              {/* "/" → Admin goes to /admin, others to /upload */}
              <Route index element={<RootRedirect />} />

              {/* All users */}
              <Route path="upload"    element={<Upload />} />
              <Route path="analysis"  element={<Analysis />} />
              <Route path="mock-viva" element={<MockViva />} />
              <Route path="report"    element={<Report />} />
              <Route path="settings"  element={<Settings />} />
              {/* Keep old dashboard as a fallback but admin should use /admin */}
              <Route path="dashboard" element={<RequireAdmin><Dashboard /></RequireAdmin>} />
            </Route>

            {/* Enterprise Admin Panel Layout */}
            <Route 
              path="/admin" 
              element={
                <AdminProtectedRoute>
                  <AdminLayout />
                </AdminProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="students" element={<AdminStudents />} />
              <Route path="reports" element={<AdminReports />} />
              <Route path="speech" element={<AdminSpeech />} />
              <Route path="system" element={<AdminMonitoring />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  )
}

// Redirect already-logged-in users away from /login
function LoginRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
  return <Login />
}

export default App