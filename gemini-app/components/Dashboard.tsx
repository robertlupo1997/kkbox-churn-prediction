import React, { useState, useMemo } from "react"
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
import { useMembers } from "../hooks/useApi"
import type { Member } from "../types"
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

interface KPICardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  trend: string
  isPositive: boolean
  loading?: boolean
}

const KPICard: React.FC<KPICardProps> = ({
  label,
  value,
  icon,
  trend,
  isPositive,
  loading,
}) => {
  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-32 mb-1" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">
          {label}
        </CardTitle>
        <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground">
          {icon}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold tracking-tight">{value}</div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className={`inline-flex items-center gap-0.5 font-medium ${
            isPositive ? "text-emerald-500" : "text-rose-500"
          }`}>
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {trend}
          </span>
          <span className="text-muted-foreground/70">from last month</span>
        </div>
      </CardContent>
    </Card>
  )
}

const Dashboard: React.FC = () => {
  const [selectedRange, setSelectedRange] = useState<{
    range: string
    min: number
    max: number
  } | null>(null)
  const [selectedTier, setSelectedTier] = useState<string | null>(null)

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
  }

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
    return filtered.slice(0, 50)
  }, [members, selectedTier])

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
        <KPICard
          label="Total Subscribers"
          value={kpiData?.total || "—"}
          icon={<Users className="h-4 w-4" />}
          trend="+2.4%"
          isPositive={true}
          loading={loading}
        />
        <KPICard
          label="High Risk Users"
          value={kpiData?.highRisk || "—"}
          icon={<AlertTriangle className="h-4 w-4" />}
          trend="+1.2%"
          isPositive={false}
          loading={loading}
        />
        <KPICard
          label="Avg Risk Score"
          value={kpiData?.avgRisk || "—"}
          icon={<Activity className="h-4 w-4" />}
          trend="-0.5%"
          isPositive={true}
          loading={loading}
        />
        <KPICard
          label="Revenue at Risk"
          value={kpiData?.revenueAtRisk || "—"}
          icon={<DollarSign className="h-4 w-4" />}
          trend="+3.1%"
          isPositive={false}
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
                  margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="range"
                    tickLine={false}
                    tickMargin={8}
                    axisLine={false}
                    fontSize={10}
                    tick={{ fill: 'var(--muted-foreground)' }}
                  />
                  <YAxis tickLine={false} axisLine={false} fontSize={10} tick={{ fill: 'var(--muted-foreground)' }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="count"
                    fill="var(--color-count)"
                    radius={[3, 3, 0, 0]}
                    className="cursor-pointer transition-opacity hover:opacity-80"
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
                    cy="45%"
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
                  {priorityMembers.map((member) => (
                    <TableRow key={member.msno}>
                      <TableCell className="font-mono text-xs">
                        {member.msno.slice(0, 16)}...
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-bold ${
                              member.risk_score > 0.7
                                ? "text-destructive"
                                : "text-yellow-600"
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
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
