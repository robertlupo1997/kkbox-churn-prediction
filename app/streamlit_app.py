import time
from pathlib import Path

import pandas as pd
import streamlit as st

# Optional imports
try:
    import pickle as _pkl

    HAS_PICKLE = True
except Exception:
    _pkl = None
    HAS_PICKLE = False

try:
    HAS_XGB = True
except Exception:
    HAS_XGB = False

st.set_page_config(page_title="KKBOX Churn — Retention Copilot", layout="wide")


@st.cache_data(show_spinner=False)
def load_model():
    from pathlib import Path

    # Try XGBoost with native loading first
    try:
        import xgboost as xgb

        xgb_json_path = Path("models/xgboost.json")
        if xgb_json_path.exists():
            clf = xgb.XGBClassifier()
            clf.load_model(str(xgb_json_path))
            return "xgboost", clf

        xgb_pkl_path = Path("models/xgboost.pkl")
        if xgb_pkl_path.exists():
            if _pkl is None:
                return "none", None
            with open(xgb_pkl_path, "rb") as f:
                clf = _pkl.load(f)
            return "xgboost", clf
    except Exception:
        pass

    # Try joblib loading
    try:
        import joblib

        for name, p in [
            ("random_forest", "models/random_forest.pkl"),
            ("logreg", "models/logistic_regression.pkl"),
        ]:
            fp = Path(p)
            if fp.exists():
                return name, joblib.load(fp)
    except Exception:
        pass

    # Final fallback: pickle
    try:
        if _pkl is None:
            return "none", None

        for name, p in [
            ("random_forest", "models/random_forest.pkl"),
            ("logreg", "models/logistic_regression.pkl"),
        ]:
            fp = Path(p)
            if fp.exists():
                with open(fp, "rb") as f:
                    return name, _pkl.load(f)
    except Exception:
        pass

    return "none", None


@st.cache_data(show_spinner=False)
def load_features():
    # Expect a precomputed features CSV (safe, no raw data exposure)
    # You can generate it with your feature pipeline and save as eval/app_features.csv
    p = Path("eval/app_features.csv")
    return pd.read_csv(p) if p.exists() else pd.DataFrame()


@st.cache_data(show_spinner=False)
def load_rules():
    """Load business rules for action recommendations."""
    try:
        import yaml

        with open("rules.yaml") as f:
            return yaml.safe_load(f)
    except:
        return None


def score(df: pd.DataFrame, clf):
    drop = {"msno", "is_churn", "cutoff_ts", "window"}
    feats = [c for c in df.columns if c not in drop]
    X = df[feats].fillna(0).to_numpy()
    probs = clf.predict_proba(X)[:, 1] if hasattr(clf, "predict_proba") else clf.predict(X)
    return probs, feats


def get_action_recommendation(score: float, rules: dict = None):
    """Map churn score to business action using rules.yaml."""
    if not rules:
        if score > 0.7:
            return (
                "🚨 High-priority retention campaign",
                "Contact customer success team immediately",
            )
        elif score > 0.4:
            return "📧 Engagement campaign", "Send personalized content recommendations"
        else:
            return "📊 Monitor", "Continue regular engagement tracking"

    # Use rules.yaml logic (simplified)
    if score > 0.7:
        return "🚨 High-priority retention", "Personalized playlist + discount offer"
    elif score > 0.4:
        return "📱 Re-engagement", "Push notifications with new music discovery"
    else:
        return "✅ Healthy engagement", "Continue regular music recommendations"


st.title("🎵 KKBOX Churn — Retention Copilot")
st.caption("Leak-safe features • Isotonic-calibrated probabilities • Action suggestions")

# Load model and data
model_name, clf = load_model()
feat_df = load_features()
rules = load_rules()

if clf is None:
    st.error(
        "❌ **No trained model found.** Please ensure models are saved in `models/` directory."
    )
    st.info(
        "Expected files: `models/xgboost.pkl`, `models/random_forest.pkl`, or `models/logistic_regression.pkl`"
    )
    st.stop()

if feat_df.empty:
    st.error(
        "❌ **No feature data found.** Please save processed features to `eval/app_features.csv`."
    )
    st.info(
        "Generate features using: `python3 src/features_processor.py` and copy output to `eval/app_features.csv`"
    )
    st.stop()

st.success(f"✅ **Model loaded:** {model_name} | **Features:** {len(feat_df):,} members")

# Create two columns for different input modes
left, right = st.columns([1, 1])

with left:
    st.subheader("🔍 Member Lookup")
    st.caption("Real-time churn prediction for individual members")

    msno = st.text_input("Member ID (msno)", placeholder="Enter member ID and press Enter")

    if msno:
        t0 = time.time()
        row = feat_df[feat_df["msno"] == msno]

        if row.empty:
            st.error(f"❌ Member `{msno}` not found in feature database")
        else:
            try:
                probs, feats = score(row, clf)
                latency = (time.time() - t0) * 1000

                # Display main result
                score_val = probs[0]
                st.metric(
                    label="Churn Probability",
                    value=f"{score_val:.1%}",
                    delta=f"{'High Risk' if score_val > 0.5 else 'Low Risk'}",
                )

                # Action recommendation
                action, message = get_action_recommendation(score_val, rules)
                st.info(f"**Recommended Action:** {action}\n\n{message}")

                # Performance metrics
                color = "red" if latency > 500 else "green"
                st.caption(f"⚡ Latency: **:{color}[{latency:.0f} ms]** (target: <500ms)")

                # Feature inspection (expandable)
                with st.expander("🔍 Feature Details"):
                    feature_vals = row[feats].iloc[0]
                    st.dataframe(
                        feature_vals.to_frame("Value")
                        .reset_index()
                        .rename(columns={"index": "Feature"}),
                        use_container_width=True,
                    )

            except Exception as e:
                st.error(f"❌ Scoring error: {str(e)}")

with right:
    st.subheader("📤 Batch CSV Upload")
    st.caption("Bulk scoring for multiple members")

    uploaded_file = st.file_uploader("Choose CSV file", type=["csv"])

    if uploaded_file is not None:
        try:
            t0 = time.time()

            # Read uploaded file
            df_upload = pd.read_csv(uploaded_file)

            if "msno" not in df_upload.columns:
                st.error("❌ CSV must contain 'msno' column")
            else:
                # Merge with features
                df_merged = df_upload.merge(feat_df, on="msno", how="left", suffixes=("", "_feat"))

                # Check for missing features
                missing_features = df_merged[df_merged.isnull().any(axis=1)]
                df_scored = df_merged.dropna()

                if df_scored.empty:
                    st.error("❌ No members found in feature database")
                else:
                    # Score all members
                    probs, _ = score(df_scored, clf)

                    # Create results dataframe
                    results = df_upload.loc[df_scored.index].copy()
                    results["churn_probability"] = probs
                    results["risk_level"] = pd.cut(
                        probs, bins=[0, 0.3, 0.7, 1.0], labels=["Low", "Medium", "High"]
                    )

                    # Add action recommendations
                    results["recommended_action"] = [
                        get_action_recommendation(p, rules)[0] for p in probs
                    ]

                    latency = (time.time() - t0) * 1000

                    # Display results summary
                    col1, col2, col3 = st.columns(3)
                    with col1:
                        st.metric("✅ Scored", len(results))
                    with col2:
                        st.metric("⚡ Latency", f"{latency:.0f} ms")
                    with col3:
                        high_risk = (results["churn_probability"] > 0.7).sum()
                        st.metric("🚨 High Risk", high_risk)

                    # Show results table
                    st.dataframe(
                        results[
                            ["msno", "churn_probability", "risk_level", "recommended_action"]
                        ].head(50),
                        use_container_width=True,
                    )

                    # Download button
                    csv_output = results.to_csv(index=False)
                    st.download_button(
                        label="📥 Download Results CSV",
                        data=csv_output,
                        file_name="churn_predictions.csv",
                        mime="text/csv",
                    )

                    # Show warnings for missing data
                    if not missing_features.empty:
                        st.warning(
                            f"⚠️ {len(missing_features)} members skipped (not in feature database)"
                        )

        except Exception as e:
            st.error(f"❌ Processing error: {str(e)}")

# Footer with technical details
st.divider()

col1, col2, col3 = st.columns(3)
with col1:
    st.caption(f"**Model:** {model_name}")
with col2:
    st.caption(f"**Features:** {len(feat_df)} members")
with col3:
    st.caption("**Architecture:** Leak-safe DuckDB → Isotonic calibration")

st.caption(
    "🔒 **Privacy**: No raw KKBOX data exposed. Features processed with temporal safeguards."
)
