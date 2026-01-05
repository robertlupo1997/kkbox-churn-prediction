import React from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Info, Book, Target, Loader2 } from "lucide-react"
import { useMetrics, useCalibration } from "../hooks/useApi"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Skeleton } from "./ui/skeleton"
import { Progress } from "./ui/progress"
import { QueryErrorFallback } from "./ui/ErrorBoundary"

const ModelPerformance: React.FC = () => {
  const {
    data: metrics,
    isLoading: metricsLoading,
    error: metricsError,
    refetch: refetchMetrics,
  } = useMetrics()

  const {
    data: calibration,
    isLoading: calibrationLoading,
    error: calibrationError,
    refetch: refetchCalibration,
  } = useCalibration()

  const loading = metricsLoading || calibrationLoading
  const error = metricsError || calibrationError

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Skeleton className="h-[400px]" />
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !metrics || !calibration) {
    return (
      <QueryErrorFallback
        error={error || new Error("No data available")}
        onRetry={() => {
          refetchMetrics()
          refetchCalibration()
        }}
        title="Failed to Load Performance Data"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Model Performance</h1>
        <p className="text-sm text-muted-foreground">
          Predictive reliability and calibration quality
        </p>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <Target className="h-4 w-4 text-muted-foreground" />
            Reliability & Calibration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart Section */}
            <div className="space-y-4">
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 flex gap-3">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">What is Model Calibration?</p>
                  <p className="text-muted-foreground">
                    For a well-calibrated model, if we predict a 70% churn risk
                    for 100 users, approximately 70 should actually churn.
                  </p>
                </div>
              </div>

              <div className="h-[350px] p-4 border rounded-lg">
                <p className="text-xs font-medium text-muted-foreground text-center mb-4">
                  Reliability Diagram (Binned)
                </p>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      label={{
                        value: "Mean Predicted Risk",
                        position: "bottom",
                        offset: 0,
                        fontSize: 10,
                      }}
                      type="number"
                      domain={[0, 1]}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      label={{
                        value: "Fraction of Positives",
                        angle: -90,
                        position: "insideLeft",
                        fontSize: 10,
                      }}
                      type="number"
                      domain={[0, 1]}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip />
                    <Legend verticalAlign="top" height={36} />
                    <Line
                      name="Perfect"
                      type="monotone"
                      data={[
                        { mean_predicted: 0, fraction_of_positives: 0 },
                        { mean_predicted: 1, fraction_of_positives: 1 },
                      ]}
                      dataKey="fraction_of_positives"
                      stroke="var(--muted-foreground)"
                      strokeDasharray="5 5"
                      dot={false}
                      strokeWidth={1}
                    />
                    <Line
                      name="Uncalibrated"
                      type="monotone"
                      data={calibration.uncalibrated}
                      dataKey="fraction_of_positives"
                      stroke="var(--chart-5)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      name="Calibrated"
                      type="monotone"
                      data={calibration.calibrated}
                      dataKey="fraction_of_positives"
                      stroke="var(--chart-3)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Metrics Section */}
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    label: "Log Loss",
                    value: metrics.log_loss.toFixed(4),
                    progress: Math.max(0, 100 - metrics.log_loss * 100),
                  },
                  {
                    label: "AUC Score",
                    value: metrics.auc.toFixed(4),
                    progress: metrics.auc * 100,
                  },
                  {
                    label: "ECE Error",
                    value: metrics.ece?.toFixed(4) || "N/A",
                    progress: metrics.ece
                      ? Math.max(0, 100 - metrics.ece * 100)
                      : 70,
                  },
                  {
                    label: "Brier Score",
                    value: metrics.brier_score?.toFixed(4) || "N/A",
                    progress: metrics.brier_score
                      ? Math.max(0, 100 - metrics.brier_score * 100)
                      : 70,
                  },
                ].map((m, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="pt-4 pb-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 mb-1">
                        {m.label}
                      </p>
                      <p className="text-xl font-semibold tracking-tight text-foreground">
                        {m.value}
                      </p>
                      <Progress value={m.progress} className="mt-2.5 h-0.5" />
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="border-dashed">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Book className="h-3.5 w-3.5" />
                    Understanding Brier Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <p className="text-xs text-muted-foreground">
                    The <span className="text-foreground font-medium">Brier Score</span> is the Mean Squared Error
                    applied to probability forecasts, measuring both calibration
                    and refinement.
                  </p>

                  <div className="p-3 bg-muted/30 rounded-md border border-dashed text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1">
                      Formula
                    </p>
                    <code className="text-xs text-foreground font-medium">
                      BS = 1/N Σ (f_t - o_t)²
                    </code>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { val: "0.00", lab: "Perfect", color: "text-emerald-500/90" },
                      { val: "0.25", lab: "Random", color: "text-amber-500/90" },
                      { val: "1.00", lab: "Failure", color: "text-rose-500/90" },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="p-2 bg-muted/30 rounded-md border border-dashed text-center"
                      >
                        <p className={`text-sm font-semibold ${item.color}`}>{item.val}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.lab}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default ModelPerformance
