import React, { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts"
import { Search, Info, SlidersHorizontal } from "lucide-react"
import { useFeatureImportance } from "../hooks/useApi"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Skeleton } from "./ui/skeleton"
import { Progress } from "./ui/progress"
import { QueryErrorFallback } from "./ui/ErrorBoundary"

const FeatureImportanceView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState("")

  const {
    data: featuresResponse,
    isLoading: loading,
    error,
    refetch,
  } = useFeatureImportance()
  const features = featuresResponse?.features ?? []

  const filteredFeatures = features
    .filter((f) => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .slice(0, 20)

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <Skeleton className="lg:col-span-3 h-[600px]" />
              <div className="lg:col-span-2 space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-24" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <QueryErrorFallback
        error={error}
        onRetry={() => refetch()}
        title="Failed to Load Feature Importance"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Feature Importance</h1>
        <p className="text-sm text-muted-foreground">
          Model drivers and variable contribution rankings (Top 20)
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              Predictor Rankings
            </CardTitle>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search features..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Chart */}
            <div className="lg:col-span-3 h-[600px] p-4 border rounded-lg">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={filteredFeatures}
                  margin={{ left: 40, right: 60, top: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    fontSize={10}
                    width={120}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="importance"
                    fill="var(--chart-1)"
                    radius={[0, 3, 3, 0]}
                    barSize={18}
                  >
                    {filteredFeatures.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fillOpacity={0.9 - index * 0.025}
                      />
                    ))}
                    <LabelList
                      dataKey="importance"
                      position="right"
                      formatter={(val: number) => `${(val * 100).toFixed(1)}%`}
                      fontSize={9}
                      offset={6}
                      fill="var(--muted-foreground)"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Feature List */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-xs font-medium text-muted-foreground">
                  Detailed Definitions
                </h4>
              </div>
              <div className="space-y-2.5 max-h-[550px] overflow-y-auto pr-2 custom-scrollbar">
                {filteredFeatures.length > 0 ? (
                  filteredFeatures.map((f, i) => (
                    <Card key={i} className="hover:bg-muted/30 transition-colors border-border/50">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start mb-1.5">
                          <p className="text-sm font-medium text-foreground">
                            {f.name}
                          </p>
                          <Badge variant="outline" className="text-[10px] h-5 font-normal text-muted-foreground">#{f.rank}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground/80 mb-2.5">
                          {f.description || "No description available"}
                        </p>
                        <div className="flex items-center gap-2.5">
                          <Progress
                            value={f.importance * 100}
                            className="flex-1 h-1"
                          />
                          <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
                            {(f.importance * 100).toFixed(1)}%
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="py-16 text-center border-2 border-dashed rounded-lg">
                    <Search className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground italic">
                      No features matching your search.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default FeatureImportanceView
