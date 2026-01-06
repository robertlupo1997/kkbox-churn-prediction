"use client"

import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
  LayoutDashboard,
  UserSearch,
  BarChart3,
  Target,
  Calculator,
  BookOpen,
  Moon,
  Sun,
  ChevronUp,
  Activity,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Member Lookup", url: "/lookup", icon: UserSearch },
  { title: "Performance", url: "/performance", icon: BarChart3 },
  { title: "Features", url: "/features", icon: Target },
  { title: "ROI Calculator", url: "/roi", icon: Calculator },
  { title: "Documentation", url: "/about", icon: BookOpen },
]

interface AppSidebarProps {
  isDark: boolean
  toggleTheme: () => void
}

export function AppSidebar({ isDark, toggleTheme }: AppSidebarProps) {
  const location = useLocation()
  const currentPath = location.pathname || "/"

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <span className="font-black text-lg italic">K</span>
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold">
                    Churn<span className="text-primary">Pro</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    Analysis Suite
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={currentPath === item.url}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider">Status</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-2.5 py-2.5 rounded-md border border-border/50 bg-card/30">
              <div className="flex items-center gap-2">
                <div className="size-1.5 rounded-full bg-emerald-500/80" />
                <span className="text-[11px] font-medium text-foreground/90">Operational</span>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Activity className="size-3 text-muted-foreground/70" />
                <span className="text-[10px] text-muted-foreground">
                  XGBoost v1.0
                </span>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
                      CP
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">ChurnPro</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isDark ? "Dark Mode" : "Light Mode"}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="bottom"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem onClick={toggleTheme}>
                  {isDark ? (
                    <>
                      <Sun className="mr-2 size-4" />
                      Light Mode
                    </>
                  ) : (
                    <>
                      <Moon className="mr-2 size-4" />
                      Dark Mode
                    </>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
