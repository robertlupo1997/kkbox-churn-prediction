# Running KKBOX Pipeline in WSL

## Quick Start

```bash
# Open WSL and navigate to project
cd /mnt/c/Users/Trey/Downloads/KKBOX_PROJECT

# Install dependencies (if needed)
pip install -r requirements.txt

# Run temporal training
python3 train_temporal.py

# Or use make
make backtest
make psi
make app
```

## Why WSL?

1. `make` command works natively
2. No Unicode/emoji encoding issues
3. Unix-style paths work consistently
4. Matches production Linux deployment

## Full Pipeline

```bash
# 1. Generate features (if not done)
make features

# 2. Train with temporal splits
python3 train_temporal.py

# 3. Run backtests
make backtest

# 4. Run PSI drift analysis
make psi

# 5. Start the web app
make app
```

## Troubleshooting

### Python not found
```bash
sudo apt update && sudo apt install python3 python3-pip
```

### Missing packages
```bash
pip3 install pandas numpy scikit-learn xgboost duckdb shap
```

### Permission issues
```bash
chmod +x ship.sh
```
