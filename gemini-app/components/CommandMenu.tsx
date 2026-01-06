import * as React from "react"
import { useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  UserSearch,
  BarChart3,
  Target,
  Calculator,
  BookOpen,
  Moon,
  Sun,
  Download,
} from "lucide-react"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"

interface CommandMenuProps {
  isDark: boolean
  toggleTheme: () => void
}

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, description: "Overview & KPIs" },
  { title: "Member Lookup", url: "/lookup", icon: UserSearch, description: "Search members" },
  { title: "Performance", url: "/performance", icon: BarChart3, description: "Model metrics" },
  { title: "Features", url: "/features", icon: Target, description: "Feature importance" },
  { title: "ROI Calculator", url: "/roi", icon: Calculator, description: "Business impact" },
  { title: "Documentation", url: "/about", icon: BookOpen, description: "User guide" },
]

export function CommandMenu({ isDark, toggleTheme }: CommandMenuProps) {
  const [open, setOpen] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false)
    command()
  }, [])

  return (
    <>
      {/* Keyboard shortcut hint in header */}
      <button
        onClick={() => setOpen(true)}
        className="hidden md:inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border bg-muted/30 hover:bg-muted/50"
      >
        <span>Search...</span>
        <kbd className="pointer-events-none h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, actions..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigation">
            {navItems.map((item) => (
              <CommandItem
                key={item.url}
                onSelect={() => runCommand(() => navigate(item.url))}
                className="flex items-center gap-3"
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                <div className="flex flex-col">
                  <span>{item.title}</span>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => runCommand(() => {
                const event = new CustomEvent('export-csv')
                window.dispatchEvent(event)
              })}
            >
              <Download className="mr-2 h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>Export High-Risk CSV</span>
                <span className="text-xs text-muted-foreground">Download intervention list</span>
              </div>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Settings">
            <CommandItem onSelect={() => runCommand(toggleTheme)}>
              {isDark ? (
                <>
                  <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>Light Mode</span>
                    <span className="text-xs text-muted-foreground">Switch to light theme</span>
                  </div>
                </>
              ) : (
                <>
                  <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span>Dark Mode</span>
                    <span className="text-xs text-muted-foreground">Switch to dark theme</span>
                  </div>
                </>
              )}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
