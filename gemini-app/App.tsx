import React, { useState, useEffect, createContext, useContext } from "react"
import { HashRouter, Routes, Route, useLocation } from "react-router-dom"
import { QueryProvider } from "./providers/QueryProvider"
import { ErrorBoundary } from "./components/ui/ErrorBoundary"
import { AppSidebar } from "./components/AppSidebar"
import { CommandMenu } from "./components/CommandMenu"
import { Toaster } from "@/components/ui/sonner"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import Dashboard from "./components/Dashboard"
import MemberLookup from "./components/MemberLookup"
import ModelPerformance from "./components/ModelPerformance"
import FeatureImportanceView from "./components/FeatureImportanceView"
import ROICalculator from "./components/ROICalculator"
import About from "./components/About"

// Global Context for Theme and Loading
const AppContext = createContext({
  isDark: false,
  toggleTheme: () => {},
  isLoading: false,
  setLoading: (_v: boolean) => {},
})

export const useApp = () => useContext(AppContext)

// Breadcrumb mapping
const breadcrumbMap: Record<string, { label: string; parent?: string }> = {
  "/": { label: "Dashboard" },
  "/lookup": { label: "Member Lookup", parent: "Analytics" },
  "/performance": { label: "Performance", parent: "Analytics" },
  "/features": { label: "Features", parent: "Analytics" },
  "/roi": { label: "ROI Calculator", parent: "Tools" },
  "/about": { label: "Documentation", parent: "Help" },
}

function AppBreadcrumb() {
  const location = useLocation()
  const currentPath = location.pathname || "/"
  const current = breadcrumbMap[currentPath] || { label: "Dashboard" }

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {current.parent && (
          <>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="#">{current.parent}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
          </>
        )}
        <BreadcrumbItem>
          <BreadcrumbPage>{current.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

// Inner component to safely use router hooks
function AppContent() {
  const location = useLocation()
  const { isDark, toggleTheme, isLoading } = useApp()

  return (
    <SidebarProvider>
      <AppSidebar isDark={isDark} toggleTheme={toggleTheme} />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center justify-between w-full px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <AppBreadcrumb />
            </div>
            <CommandMenu isDark={isDark} toggleTheme={toggleTheme} />
          </div>
        </header>

        {/* Loading bar */}
        {isLoading && (
          <div className="fixed top-0 left-0 right-0 h-1 z-50">
            <div className="h-full bg-primary animate-progress origin-left w-full" />
          </div>
        )}

        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/lookup" element={<MemberLookup />} />
            <Route path="/performance" element={<ModelPerformance />} />
            <Route path="/features" element={<FeatureImportanceView />} />
            <Route path="/roi" element={<ROICalculator />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme") === "dark")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }, [isDark])

  return (
    <QueryProvider>
      <AppContext.Provider
        value={{
          isDark,
          toggleTheme: () => setIsDark((prev) => !prev),
          isLoading,
          setLoading: setIsLoading,
        }}
      >
        <ErrorBoundary>
          <HashRouter>
            <AppContent />
          </HashRouter>
        </ErrorBoundary>
        <Toaster richColors position="bottom-right" />
      </AppContext.Provider>
    </QueryProvider>
  )
}
