# Learner's Guide: KKBOX Churn Prediction Excellence

This guide summarizes the key insights from the Kaggle winning solutions (specifically 1st place by Bryan Gregory and top solutions like InfiniteWing) and how they compare to our current "Production-Ready" implementation.

## 1. Key Winner Strategies

### A. Temporal Feature Engineering (The Game Changer)
The top solutions didn't just look at a single snapshot. They looked at **trends over time**.
- **Aggregates**: Sums, means, and counts of events (logs, plays, transactions) over the last 7, 30, 60, and 90 days.
- **Trend Features**: Ratios like `(last 7 days plays) / (average daily plays last 30 days)`.
- **Velocity**: Change in auto-renewal status or payment method over time.

### B. Historical Churn Tracking
InfiniteWing utilized features that tracked a user's *past* behavior with churn:
- `last_is_churn`: Was their previous membership a churn?
- `churn_count`: How many times have they churned in total?
- `churn_rate`: Percentage of their total transactions that resulted in churn.

### C. The "Stacking" Ensemble
Winning scores (~0.07 log loss) were achieved by blending multiple models:
- **Primary**: XGBoost (weight 0.8-0.9)
- **Secondary**: LightGBM (weight 0.1-0.2)
- **Deep Learning**: Denoising Autoencoders were used by the 1st place team to extract features from sparse user log data.

## 2. Our Current Architecture vs. Winners

| Feature | Our Implementation | Winner Solution | Why it matters |
| :--- | :--- | :--- | :--- |
| **Validation** | Temporal Splits (Mar 2017) | Random Splits / Cross-Val | Ours is more **honest** for production; theirs captures every bit of score. |
| **Churn History** | Not yet implemented | Central to logic | Users who churn once are likely to do it again. |
| **Model Diversity** | XGBoost (Primary) | XGB + LGBM + CatBoost | Diversification reduces variance and catches different patterns. |
| **Pipeline** | One-command `make` | Fragmented Kernels | Ours is **maintainable**; theirs is optimized for a static leaderboard. |

## 3. How to Enhance Your Portfolio

If you want to move from "Good" (AUC 0.70) to "Excellent" (AUC 0.85+):

1.  **Implement historical churn features**: Update the SQL features to calculate `previous_churn_count` for each user.
2.  **Add LightGBM to the mix**: It catches different interactions than XGBoost.
3.  **Create "Trend" Ratios**: Add features that compare the last 14 days of listening to the last 90 days.
4.  **Use WSL for everything**: It manages the `make` pipeline and DuckDB memory much more efficiently than raw Windows PowerShell.

## 4. The "One-Command" Dream
In WSL, you can run the entire "Honest Production" pipeline like this:

```bash
# Clean, Feature Engineer, Train, and Backtest in one go
make clean features-real train-temporal backtest
```

---
> [!TIP]
> **Why 0.70 AUC is actually good:** In the competition, models were evaluated on a single month (March 2017). Our 0.70 AUC on a true temporal holdout is a very strong, defensible production result. Don't chase the 0.99 AUC—that's usually a sign of leakage!
