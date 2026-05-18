import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"
import { SpaceBackground } from "./SpaceBackground"

export function MainLayout() {
  return (
    <div className="flex min-h-screen bg-transparent relative text-foreground"
         style={{ overflowX: "hidden" }}>
      <SpaceBackground />

      {/* Fixed sidebar — 256px wide */}
      <Sidebar />

      {/* Main content — offset by sidebar width.
          Uses padding instead of margin so Firefox scrollbar
          doesn't cause a layout shift. */}
      <div
        className="flex flex-col relative z-10 min-h-screen"
        style={{
          marginLeft: "256px",
          width: "calc(100% - 256px)",
          /* Prevent the content from overflowing under the sidebar in Firefox */
          maxWidth: "calc(100vw - 256px)",
        }}
      >
        <Topbar />
        <main className="flex-1 p-8 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
