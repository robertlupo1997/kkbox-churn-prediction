import React from "react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { Card, CardContent, CardHeader } from "./ui/card"
import { Skeleton } from "./ui/skeleton"
import { cn } from "@/lib/utils"

interface EnhancedKPICardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  trend: {
    value: string
    isPositive: boolean
  }
  vsTarget?: string
  sparklineData?: number[]
  status?: "on-track" | "at-risk" | "critical"
  loading?: boolean
}

export const EnhancedKPICard: React.FC<EnhancedKPICardProps> = ({
  label,
  value,
  icon,
  trend,
  vsTarget,
  sparklineData,
  status,
  loading,
}) => {
  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative overflow-hidden group hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-start justify-between pb-1 pt-4 px-4">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg bg-muted/60 flex items-center justify-center text-muted-foreground">
            {icon}
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
        </div>
        {status && (
          <span
            className={cn(
              "text-[10px] font-medium px-2 py-0.5 rounded-full",
              status === "on-track" && "bg-success/10 text-success",
              status === "at-risk" && "bg-warning/10 text-warning",
              status === "critical" && "bg-destructive/10 text-destructive"
            )}
          >
            {status === "on-track"
              ? "On Track"
              : status === "at-risk"
              ? "At Risk"
              : "Critical"}
          </span>
        )}
      </CardHeader>

      <CardContent className="space-y-1 px-4 pb-3">
        <div className="flex items-baseline gap-2.5">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </span>
          <span
            className={cn(
              "text-xs font-medium flex items-center gap-0.5",
              trend.isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
            )}
          >
            {trend.isPositive ? (
              <ArrowUpRight className="size-3.5" />
            ) : (
              <ArrowDownRight className="size-3.5" />
            )}
            {trend.value}
          </span>
        </div>

        {vsTarget && (
          <p className="text-[10px] text-muted-foreground">{vsTarget}</p>
        )}

        {sparklineData && sparklineData.length > 0 && (
          <div className="h-10 w-full pt-1 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sparklineData.map((v, i) => ({ i, v }))}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id={`sparkGradient-${label.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--primary)"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--primary)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke="var(--primary)"
                  strokeWidth={1.5}
                  fill={`url(#sparkGradient-${label.replace(/\s/g, '')})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
