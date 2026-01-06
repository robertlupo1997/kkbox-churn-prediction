import React, { useState, useMemo, useEffect } from "react"
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  Legend,
} from "recharts"
import {
  Users,
  AlertTriangle,
  Activity,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  X,
  Search,
  Filter,
  ChevronRight,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"
import { useMembers } from "../hooks/useApi"
import type { Member } from "../types"
import { EnhancedKPICard } from "./EnhancedKPICard"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Skeleton } from "./ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"
import { Progress } from "./ui/progress"
import { QueryErrorFallback } from "./ui/ErrorBoundary"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "./ui/chart"

const RISK_COLORS = {
  low: "var(--risk-low)",
  medium: "var(--risk-medium)",
  high: "var(--risk-high)",
}

const barChartConfig = {
  count: {
    label: "Members",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

const pieChartConfig = {
  low: {
    label: "Low Risk",
    color: "var(--risk-low)",
  },
  medium: {
    label: "Medium Risk",
    color: "var(--risk-medium)",
  },
  high: {
    label: "High Risk",
    color: "var(--risk-high)",
  },
} satisfies ChartConfig

const Dashboard: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState<{
    range: string
    min: number
    max: number
  } | null>(null)
  const [selectedTier, setSelectedTier] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Load members from API using TanStack Query
  const {
    data: membersResponse,
    isLoading: loading,
    error,
    refetch,
  } = useMembers({ limit: 1000 })
  const members = membersResponse?.members ?? []
  const totalMembers = membersResponse?.total ?? 0

  // Calculate KPI values from real data
  const kpiData = useMemo(() => {
    if (!members.length) return null

    const highRiskCount = members.filter((m) => m.risk_tier === "High").length
    const avgRiskScore =
      members.reduce((sum, m) => sum + m.risk_score, 0) / members.length
    const revenueAtRisk = highRiskCount * 149 // ARPU = 149 NTD

    return {
      total: totalMembers.toLocaleString(),
      highRisk: highRiskCount.toLocaleString(),
      avgRisk: `${(avgRiskScore * 100).toFixed(1)}%`,
      revenueAtRisk: `$${revenueAtRisk.toLocaleString()}`,
    }
  }, [members, totalMembers])

  const exportToCSV = () => {
    const highRiskMembers = members.filter((m) => m.risk_score > 0.7)
    const headers = ["msno", "risk_score", "risk_tier", "action_recommendation"]
    const csvContent = [
      headers.join(","),
      ...highRiskMembers.map((m) =>
        [m.msno, m.risk_score, m.risk_tier, m.action_recommendation].join(",")
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute(
      "download",
      `kkbox_high_risk_export_${new Date().toISOString().split("T")[0]}.csv`
    )
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success("Export complete", {
      description: `${highRiskMembers.length} high-risk members exported to CSV`,
    })
  }

  // Listen for export command from CommandMenu
  useEffect(() => {
    const handleExportCommand = () => exportToCSV()
    window.addEventListener("export-csv", handleExportCommand)
    return () => window.removeEventListener("export-csv", handleExportCommand)
  }, [members])

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload
      setSelectedRange({ range: payload.range, min: payload.min, max: payload.max })
    }
  }

  const handlePieClick = (data: any) => {
    if (data && data.name) {
      setSelectedTier(data.name === selectedTier ? null : data.name)
    }
  }

  const filteredRangeMembers = selectedRange
    ? members.filter(
        (m) =>
          m.risk_score * 100 >= selectedRange.min &&
          m.risk_score * 100 < selectedRange.max
      )
    : []

  const priorityMembers = useMemo(() => {
    let filtered = members.filter((m) => m.risk_score > 0.4)
    if (selectedTier) {
      filtered = members.filter(
        (m) => m.risk_tier === selectedTier.split(" ")[0]
      )
    }
    return filtered
  }, [members, selectedTier])

  // Paginated members for the table
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return priorityMembers.slice(start, start + itemsPerPage)
  }, [priorityMembers, currentPage])

  const totalPages = Math.ceil(priorityMembers.length / itemsPerPage)

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedTier])

  // Calculate risk distribution from real data
  const riskDistData = useMemo(() => {
    const bins = [
      { range: "0-10%", count: 0, min: 0, max: 10 },
      { range: "10-20%", count: 0, min: 10, max: 20 },
      { range: "20-30%", count: 0, min: 20, max: 30 },
      { range: "30-40%", count: 0, min: 30, max: 40 },
      { range: "40-50%", count: 0, min: 40, max: 50 },
      { range: "50-60%", count: 0, min: 50, max: 60 },
      { range: "60-70%", count: 0, min: 60, max: 70 },
      { range: "70-80%", count: 0, min: 70, max: 80 },
      { range: "80-90%", count: 0, min: 80, max: 90 },
      { range: "90-100%", count: 0, min: 90, max: 100 },
    ]

    members.forEach((m) => {
      const score = m.risk_score * 100
      const binIndex = Math.min(Math.floor(score / 10), 9)
      bins[binIndex].count++
    })

    return bins
  }, [members])

  // Calculate pie data from real members
  const pieData = useMemo(() => {
    const counts = { Low: 0, Medium: 0, High: 0 }
    members.forEach((m) => {
      counts[m.risk_tier]++
    })
    const total = members.length || 1
    return [
      {
        name: "Low Risk",
        value: Math.round((counts.Low / total) * 100),
        fill: RISK_COLORS.low,
      },
      {
        name: "Medium Risk",
        value: Math.round((counts.Medium / total) * 100),
        fill: RISK_COLORS.medium,
      },
      {
        name: "High Risk",
        value: Math.round((counts.High / total) * 100),
        fill: RISK_COLORS.high,
      },
    ]
  }, [members])

  if (error) {
    return (
      <QueryErrorFallback
        error={error}
        onRetry={() => refetch()}
        title="Failed to Load Dashboard Data"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Executive Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Subscription health & risk distribution metrics
          </p>
        </div>
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
          <Button variant="secondary" size="sm" className="h-7 px-3 text-xs font-medium">
            30 Days
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-3 text-xs text-muted-foreground">
            Quarterly
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <EnhancedKPICard
          label="Total Subscribers"
          value={kpiData?.total || "—"}
          icon={<Users className="h-4 w-4" />}
          trend={{ value: "+2.4%", isPositive: true }}
          vsTarget="+1.2% vs target"
          sparklineData={[42, 45, 48, 47, 52, 55, 58, 56, 62, 65, 68, 72, 75, 78]}
          status="on-track"
          loading={loading}
        />
        <EnhancedKPICard
          label="High Risk Users"
          value={kpiData?.highRisk || "—"}
          icon={<AlertTriangle className="h-4 w-4" />}
          trend={{ value: "+1.2%", isPositive: false }}
          vsTarget="-0.8% vs target"
          sparklineData={[35, 38, 36, 42, 45, 48, 52, 55, 53, 58, 62, 60, 65, 68]}
          status="at-risk"
          loading={loading}
        />
        <EnhancedKPICard
          label="Avg Risk Score"
          value={kpiData?.avgRisk || "—"}
          icon={<Activity className="h-4 w-4" />}
          trend={{ value: "-0.5%", isPositive: true }}
          vsTarget="On target"
          sparklineData={[55, 52, 50, 48, 45, 43, 42, 40, 38, 36, 35, 33, 32, 30]}
          status="on-track"
          loading={loading}
        />
        <EnhancedKPICard
          label="Revenue at Risk"
          value={kpiData?.revenueAtRisk || "—"}
          icon={<DollarSign className="h-4 w-4" />}
          trend={{ value: "+3.1%", isPositive: false }}
          vsTarget="+$2.1K vs budget"
          sparklineData={[25, 28, 32, 35, 38, 42, 45, 48, 52, 55, 58, 62, 65, 70]}
          status="critical"
          loading={loading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium">Risk Distribution</CardTitle>
                <CardDescription className="text-xs">Member count by risk score range</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-dashed">
                Click to explore
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
              </div>
            ) : (
              <ChartContainer config={barChartConfig} className="h-64 w-full">
                <BarChart
                  data={riskDistData}
                  onClick={handleBarClick}
                  accessibilityLayer
                  margin={{ top: 16, right: 8, bottom: 0, left: -16 }}
                >
                  <defs>
                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    strokeDasharray="4 4"
                    stroke="var(--border)"
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    dataKey="range"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    fontSize={10}
                    tick={{ fill: 'var(--muted-foreground)' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    tick={{ fill: 'var(--muted-foreground)' }}
                    width={35}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.2 }}
                    content={<ChartTooltipContent />}
                  />
                  <Bar
                    dataKey="count"
                    fill="url(#barGradient)"
                    radius={[4, 4, 0, 0]}
                    className="cursor-pointer transition-opacity"
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-medium">Risk Tiers</CardTitle>
                <CardDescription className="text-xs">Distribution by tier classification</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground border-dashed">
                Click to filter
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/50" />
              </div>
            ) : (
              <ChartContainer config={pieChartConfig} className="h-64 w-full">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="42%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={handlePieClick}
                    className="cursor-pointer"
                    strokeWidth={0}
                  >
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.fill}
                        opacity={
                          selectedTier && entry.name !== selectedTier ? 0.25 : 1
                        }
                        className="transition-opacity duration-200"
                      />
                    ))}
                  </Pie>
                  {/* Center label showing total */}
                  <text
                    x="50%"
                    y="38%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-foreground text-xl font-semibold"
                  >
                    {members.length.toLocaleString()}
                  </text>
                  <text
                    x="50%"
                    y="48%"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    Total Members
                  </text>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend
                    verticalAlign="bottom"
                    height={32}
                    formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Range Explorer */}
      {selectedRange && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Filter className="h-5 w-5 text-primary" />
                <CardTitle>
                  Range Explorer:{" "}
                  <span className="text-primary">{selectedRange.range}</span>
                </CardTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedRange(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredRangeMembers.length > 0 ? (
                filteredRangeMembers.slice(0, 8).map((m) => (
                  <div
                    key={m.msno}
                    className="p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <code className="text-xs text-muted-foreground">
                        {m.msno.slice(0, 8)}...
                      </code>
                      <Badge
                        variant={
                          m.risk_tier.toLowerCase() as "low" | "medium" | "high"
                        }
                      >
                        {m.risk_tier}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {(m.risk_score * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Risk Score</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-12 flex flex-col items-center justify-center border-2 border-dashed rounded-lg">
                  <Search className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-sm">
                    No members match this bucket.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data Freshness Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Live data</span>
          <span className="text-muted-foreground/50">|</span>
          <span>Updated {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Intervention List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-medium">Intervention List</CardTitle>
                {selectedTier && (
                  <Badge variant="secondary" className="text-[10px] flex items-center gap-1 h-5">
                    {selectedTier}
                    <button
                      onClick={() => setSelectedTier(null)}
                      className="ml-0.5 hover:text-destructive transition-colors"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs">
                Prioritized subscribers for churn prevention
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportToCSV} className="h-8 text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export CSV
              </Button>
              <Button size="sm" className="h-8 text-xs">Contact CRM</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">User ID</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Risk Tier</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Recommendation
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMembers.map((member) => (
                    <TableRow key={member.msno} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="font-mono text-xs">
                        {member.msno.slice(0, 16)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold tabular-nums ${
                              member.risk_score > 0.7
                                ? "text-destructive"
                                : "text-yellow-600 dark:text-yellow-500"
                            }`}
                          >
                            {(member.risk_score * 100).toFixed(1)}%
                          </span>
                          <Progress
                            value={member.risk_score * 100}
                            className="w-16 h-2"
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.risk_tier.toLowerCase() as
                              | "low"
                              | "medium"
                              | "high"
                          }
                        >
                          {member.risk_tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[300px] truncate text-muted-foreground text-sm">
                        {member.action_recommendation}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          View
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {!loading && priorityMembers.length > 0 && (
            <div className="flex items-center justify-between px-2 pt-4">
              <p className="text-xs text-muted-foreground tabular-nums">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to{" "}
                {Math.min(currentPage * itemsPerPage, priorityMembers.length)} of{" "}
                {priorityMembers.length} members
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-8 text-xs"
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground tabular-nums">
                  Page {currentPage} of {totalPages || 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="h-8 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
