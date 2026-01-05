import React, { useState, useEffect } from "react"
import {
  Search,
  Loader2,
  AlertCircle,
  UserSearch,
  Sparkles,
  BrainCircuit,
} from "lucide-react"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { useMember, useShapExplanation } from "../hooks/useApi"
import { getRiskExplanation } from "../services/geminiService"
import { useApp } from "../App"
import ShapWaterfall from "./ShapWaterfall"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Skeleton } from "./ui/skeleton"

const MemberLookup: React.FC = () => {
  const { setLoading: setGlobalLoading } = useApp()
  const [searchId, setSearchId] = useState("")
  const [searchedMsno, setSearchedMsno] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false)

  // Use TanStack Query hooks for data fetching
  const {
    data: selectedMember,
    isLoading: memberLoading,
    error: memberError,
    isFetching: memberFetching,
  } = useMember(searchedMsno)

  const { data: shapData, isLoading: shapLoading } =
    useShapExplanation(searchedMsno)

  const localLoading =
    memberLoading || memberFetching || shapLoading || isLoadingExplanation
  const error = memberError?.message || null

  // Update global loading state
  useEffect(() => {
    setGlobalLoading(localLoading)
  }, [localLoading, setGlobalLoading])

  // Fetch Gemini explanation when member data is loaded
  useEffect(() => {
    if (selectedMember && !explanation) {
      const fetchExplanation = async () => {
        setIsLoadingExplanation(true)
        try {
          const riskText = await getRiskExplanation({
            msno: selectedMember.msno,
            risk_score: selectedMember.risk_score,
            risk_tier: selectedMember.risk_tier,
            is_churn: selectedMember.is_churn,
            top_risk_factors: [],
            action_recommendation: selectedMember.action.recommendation,
          })
          setExplanation(riskText || null)
        } catch (err) {
          console.warn("Failed to get AI explanation:", err)
          setExplanation(null)
        } finally {
          setIsLoadingExplanation(false)
        }
      }
      fetchExplanation()
    }
  }, [selectedMember, explanation])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedId = searchId.trim()
    if (trimmedId) {
      setExplanation(null)
      setSearchedMsno(trimmedId)
    }
  }

  const getGaugeColor = (score: number) => {
    if (score < 0.4) return "var(--chart-3)"
    if (score < 0.7) return "var(--chart-4)"
    return "var(--chart-5)"
  }

  const gaugeData = selectedMember
    ? [
        { name: "Risk", value: selectedMember.risk_score * 100 },
        { name: "Stability", value: 100 - selectedMember.risk_score * 100 },
      ]
    : []

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Member Profiler</h1>
        <p className="text-muted-foreground">
          Deep-dive into individual subscriber risk drivers.
        </p>
      </div>

      {/* Search Card */}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search User ID (e.g., u12345)..."
                className="pl-10"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={!searchId || localLoading}>
              {localLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Analyze"
              )}
            </Button>
          </form>
          {error && (
            <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedMember ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Risk Gauge */}
            <Card>
              <CardContent className="pt-6">
                <p className="text-xs font-medium text-muted-foreground text-center mb-4">
                  Risk Probability
                </p>
                <div className="h-48 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gaugeData}
                        cx="50%"
                        cy="80%"
                        startAngle={180}
                        endAngle={0}
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={0}
                        dataKey="value"
                        stroke="none"
                      >
                        <Cell fill={getGaugeColor(selectedMember.risk_score)} />
                        <Cell fill="var(--muted)" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-x-0 bottom-4 flex flex-col items-center">
                    <span className="text-4xl font-bold">
                      {(selectedMember.risk_score * 100).toFixed(1)}%
                    </span>
                    <Badge
                      variant={
                        selectedMember.risk_tier.toLowerCase() as
                          | "low"
                          | "medium"
                          | "high"
                      }
                      className="mt-1"
                    >
                      {selectedMember.risk_tier} Risk
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Parameters */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  User Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "User ID", value: selectedMember.msno, mono: true },
                  {
                    label: "Risk Score",
                    value: `${(selectedMember.risk_score * 100).toFixed(1)}%`,
                  },
                  {
                    label: "Risk Tier",
                    value: selectedMember.risk_tier,
                    highlight: true,
                    pos: selectedMember.risk_tier === "Low",
                  },
                  {
                    label: "Churn Status",
                    value: selectedMember.is_churn ? "Churned" : "Active",
                    highlight: true,
                    pos: !selectedMember.is_churn,
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center py-2 border-b last:border-0"
                  >
                    <span className="text-xs text-muted-foreground">
                      {item.label}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        item.mono ? "font-mono" : ""
                      } ${
                        item.highlight
                          ? item.pos
                            ? "text-green-600"
                            : "text-red-600"
                          : ""
                      }`}
                    >
                      {item.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Analysis */}
            <Card className="min-h-[400px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Analysis & Strategy
                </CardTitle>
              </CardHeader>
              <CardContent>
                {localLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 gap-4">
                    <Skeleton className="w-16 h-16 rounded-full" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                ) : explanation ? (
                  <div className="p-4 bg-muted/50 rounded-lg text-sm leading-relaxed">
                    {explanation}
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-muted-foreground italic">
                    Awaiting analysis...
                  </div>
                )}
              </CardContent>
            </Card>

            {/* SHAP Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BrainCircuit className="h-4 w-4 text-primary" />
                  SHAP Feature Impact
                </CardTitle>
              </CardHeader>
              <CardContent>
                {shapData ? (
                  <ShapWaterfall
                    riskFactors={shapData.explanation.top_risk_factors}
                    protectiveFactors={shapData.explanation.top_protective_factors}
                    baseValue={shapData.explanation.base_value}
                    prediction={selectedMember.risk_score}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <Skeleton className="h-48 w-full" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-20 flex flex-col items-center text-center">
            <div className="w-20 h-20 bg-muted rounded-2xl flex items-center justify-center mb-6">
              <UserSearch className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Select User to Profile</h3>
            <p className="text-muted-foreground max-w-sm">
              Generate an individual risk strategy powered by XGBoost ensemble
              and Gemini AI synthesis.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default MemberLookup
