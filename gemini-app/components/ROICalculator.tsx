import React, { useMemo } from "react"
import {
  Calculator,
  TrendingUp,
  DollarSign,
  Users,
  Target,
  BarChart as ChartIcon,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Slider } from "./ui/slider"

const roiFormSchema = z.object({
  subs: z.number().min(10000).max(1000000),
  arpu: z.number().min(1).max(10000),
  churn: z.number().min(0.5).max(25),
  reduction: z.number().min(1).max(50),
})

type ROIFormData = z.infer<typeof roiFormSchema>

const ROICalculator: React.FC = () => {
  const { watch, setValue } = useForm<ROIFormData>({
    resolver: zodResolver(roiFormSchema),
    defaultValues: {
      subs: 100000,
      arpu: 149,
      churn: 5.5,
      reduction: 15,
    },
  })

  const subs = watch("subs")
  const arpu = watch("arpu")
  const churn = watch("churn")
  const reduction = watch("reduction")

  const results = useMemo(() => {
    const monthlyChurnCount = subs * (churn / 100)
    const lostRevenue = monthlyChurnCount * arpu
    const usersSaved = monthlyChurnCount * (reduction / 100)
    const revenueSaved = usersSaved * arpu
    const yearlySavings = revenueSaved * 12
    const projectedChurnCount = monthlyChurnCount - usersSaved

    return {
      monthlyChurnCount: Math.round(monthlyChurnCount),
      projectedChurnCount: Math.round(projectedChurnCount),
      lostRevenue: Math.round(lostRevenue),
      usersSaved: Math.round(usersSaved),
      revenueSaved: Math.round(revenueSaved),
      yearlySavings: Math.round(yearlySavings),
    }
  }, [subs, arpu, churn, reduction])

  const chartData = [
    { name: "Before", value: results.monthlyChurnCount, color: "var(--muted-foreground)" },
    { name: "After", value: results.projectedChurnCount, color: "var(--primary)" },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ROI Calculator</h1>
        <p className="text-muted-foreground">
          Modeling the financial impact of predictive retention strategies.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Simulation Parameters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Total Subscribers */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <Label className="text-sm font-medium">Total Subscriber Base</Label>
                <span className="text-primary font-bold">
                  {subs.toLocaleString()}
                </span>
              </div>
              <Slider
                value={[subs]}
                min={10000}
                max={1000000}
                step={10000}
                onValueChange={(value) => setValue("subs", value[0])}
              />
            </div>

            {/* ARPU and Churn Rate */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground block mb-2">
                  Monthly ARPU (NTD)
                </Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="number"
                    className="pl-10"
                    value={arpu}
                    onChange={(e) => setValue("arpu", Number(e.target.value))}
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground block mb-2">
                  Monthly Churn Rate
                </Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[churn]}
                    min={0.5}
                    max={25}
                    step={0.1}
                    onValueChange={(value) => setValue("churn", value[0])}
                    className="flex-1"
                  />
                  <span className="text-primary font-bold min-w-[3rem]">
                    {churn}%
                  </span>
                </div>
              </div>
            </div>

            {/* Model Impact */}
            <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
              <CardContent className="pt-4">
                <div className="flex justify-between items-center mb-3">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Model Precision Impact
                  </Label>
                  <span className="text-green-600 font-bold">
                    {reduction}% Saving
                  </span>
                </div>
                <Slider
                  value={[reduction]}
                  min={1}
                  max={50}
                  step={1}
                  onValueChange={(value) => setValue("reduction", value[0])}
                />
              </CardContent>
            </Card>
          </CardContent>
        </Card>

        {/* Results Section */}
        <div className="space-y-6">
          {/* Main Result Card */}
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-6 relative overflow-hidden">
              <TrendingUp className="absolute top-4 right-4 h-32 w-32 opacity-10" />
              <div className="relative z-10">
                <p className="text-xs text-primary-foreground/70 mb-2">
                  Projected Annual Saved Revenue
                </p>
                <p className="text-5xl font-bold mb-1">
                  ${results.yearlySavings.toLocaleString()}
                </p>
                <p className="text-xs text-primary-foreground/60">NTD / Year</p>

                <div className="grid grid-cols-2 gap-6 mt-8 pt-6 border-t border-primary-foreground/20">
                  <div>
                    <p className="text-xs text-primary-foreground/70 flex items-center gap-1 mb-1">
                      <Users className="h-3 w-3" />
                      Subscribers Saved
                    </p>
                    <p className="text-2xl font-bold">
                      {results.usersSaved.toLocaleString()}
                    </p>
                    <p className="text-xs text-primary-foreground/50">per month</p>
                  </div>
                  <div>
                    <p className="text-xs text-primary-foreground/70 flex items-center gap-1 mb-1">
                      <DollarSign className="h-3 w-3" />
                      Revenue Recovered
                    </p>
                    <p className="text-2xl font-bold">
                      ${results.revenueSaved.toLocaleString()}
                    </p>
                    <p className="text-xs text-primary-foreground/50">per month</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <ChartIcon className="h-4 w-4 text-primary" />
                Before vs After Churn Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={60}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList
                        dataKey="value"
                        position="top"
                        fontSize={11}
                        fontWeight={600}
                        formatter={(val: number) => val.toLocaleString()}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Monthly Churn Count
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ROICalculator
