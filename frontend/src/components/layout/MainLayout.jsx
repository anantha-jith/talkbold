import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { SpaceBackground } from "./SpaceBackground"

export function MainLayout() {
  return (
    <div className="flex min-h-screen bg-transparent relative overflow-hidden text-foreground">
      <SpaceBackground />
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col relative z-10">
        <Topbar />
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
