import React from "react"
import {
  Database,
  ShieldCheck,
  Clock,
  Layers,
  BookOpen,
  ExternalLink,
  Download,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Badge } from "./ui/badge"

interface DocCardProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}

const DocCard: React.FC<DocCardProps> = ({ icon, title, children }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardHeader>
      <CardTitle className="flex items-center gap-3 text-base">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="text-sm text-muted-foreground space-y-3">
      {children}
    </CardContent>
  </Card>
)

const About: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <section className="text-center space-y-4">
        <Badge variant="secondary" className="gap-2">
          <BookOpen className="h-3 w-3" />
          Technical Documentation
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight">
          The Science Behind ChurnPro
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Deep-dive into the machine learning architecture and feature
          engineering strategies developed for the KKBox Churn Challenge.
        </p>
      </section>

      {/* Documentation Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DocCard
          icon={<Layers className="h-5 w-5" />}
          title="Architecture & Modeling"
        >
          <p>
            The core engine utilizes a weighted ensemble of{" "}
            <strong>XGBoost</strong> and <strong>LightGBM</strong>. XGBoost
            excels at capturing complex interactions in playlogs, while LightGBM
            offers better generalization for sparse transactional data.
          </p>
          <p>
            Raw probabilities are transformed via{" "}
            <strong>Isotonic Regression</strong> to map model scores to
            real-world churn frequencies.
          </p>
        </DocCard>

        <DocCard
          icon={<Database className="h-5 w-5" />}
          title="Engineered Feature Space"
        >
          <p>Our pipeline extracts 99 predictors categorized by:</p>
          <ul className="space-y-2 mt-2">
            {[
              { label: "User Logs", desc: "30-day play history, skip rates" },
              { label: "Transactions", desc: "Auto-renew toggles, payment methods" },
              { label: "Identity", desc: "City, age, registration source tenure" },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                <span>
                  <strong>{item.label}:</strong> {item.desc}
                </span>
              </li>
            ))}
          </ul>
        </DocCard>

        <DocCard
          icon={<Clock className="h-5 w-5" />}
          title="Temporal Windows"
        >
          <p>
            Churn is rarely a static event; it's a behavioral trend. We
            calculate features over <strong>1, 3, 7, 14, and 30-day</strong>{" "}
            rolling windows.
          </p>
          <p>
            This multi-scale approach allows the model to distinguish between a{" "}
            <em>"slow decay"</em> in interest versus a <em>"sudden shock"</em>{" "}
            due to payment failure.
          </p>
        </DocCard>

        <DocCard
          icon={<ShieldCheck className="h-5 w-5" />}
          title="Data Integrity & Safety"
        >
          <p>
            To avoid <strong>Data Leakage</strong>, we implemented a strict
            temporal split. Features are calculated strictly from activity
            before the prediction date (Day T).
          </p>
          <p>
            Labels (Churn/No Churn) are derived from activity in the following
            month (T+1), ensuring metrics are realistic and deployable.
          </p>
        </DocCard>
      </div>

      {/* Project Context Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-2xl font-bold">Project Context</h3>
              <p className="text-muted-foreground">
                This dashboard is a visualization suite for the{" "}
                <strong>WSDM - KKBox's Churn Prediction Challenge</strong>.
                KKBox, Asia's leading music provider, faces massive churn
                pressure. By predicting churn 30 days in advance, the business
                can shift from reactive retention to proactive engagement.
              </p>
              <div className="flex flex-wrap gap-3 pt-4">
                <Button asChild>
                  <a
                    href="https://www.kaggle.com/c/kkbox-churn-prediction-challenge"
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on Kaggle
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </a>
                </Button>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Technical PDF
                </Button>
              </div>
            </div>

            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm">Training Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Train Samples", value: "2.8M" },
                  { label: "Validation ROC-AUC", value: "0.912" },
                  { label: "Feature Count", value: "99" },
                ].map((stat, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center py-2 border-b last:border-0"
                  >
                    <span className="text-xs text-muted-foreground">
                      {stat.label}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {stat.value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default About
