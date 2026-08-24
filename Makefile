# KKBOX Churn Prediction - Production Makefile
.PHONY: all clean test lint format install dev docker-build docker-run features labels models calibrate evaluate backtest backtest-ci fixtures psi app

VENV ?= .venv

# Interpreter resolution: an activated virtualenv wins; otherwise a local
# $(VENV) is used if it exists; otherwise the system python3.
ifeq ($(VIRTUAL_ENV),)
  ifneq ($(wildcard $(VENV)/bin/python3),)
    PY := $(VENV)/bin/python3
  else
    PY := python3
  endif
else
  PY := python3
endif

# Ensure a usable interpreter target exists (PEP 668: on current Debian/Ubuntu
# a bare `pip install` into the system Python fails with
# externally-managed-environment). `make install` creates $(VENV) when run
# outside any virtualenv, then installs into it. Inside a virtualenv the
# behavior is unchanged.
define ensure_venv
	if [ -z "$$VIRTUAL_ENV" ] && [ ! -f "$(VENV)/pyvenv.cfg" ]; then 		echo "No virtualenv active; creating $(VENV) (PEP 668 safe install)..."; 		python3 -m venv $(VENV); 	fi
endef

# Default target - one command to rule them all
all: install lint test features models calibrate evaluate

# Installation
define pip_install
	if [ -n "$$VIRTUAL_ENV" ]; then 		$(PY) -m pip install $(1); 	else 		$(VENV)/bin/python3 -m pip install $(1); 	fi
endef

install:
	$(ensure_venv)
	$(call pip_install,-r requirements.txt)

dev:
	$(ensure_venv)
	$(call pip_install,-r requirements-dev.txt)

# Code quality
lint:
	@echo "🔍 Running code quality checks..."
	$(PY) -m ruff check src/ tests/ || true
	$(PY) -m black --check src/ tests/ || true

format:
	@echo "🎨 Formatting code..."
	$(PY) -m black src/ tests/
	$(PY) -m ruff --fix src/ tests/ || true

# Testing
test:
	@echo "🧪 Running tests..."
	$(PY) -m pytest tests/ -v --tb=short -c pytest.ini

test-ci:
	@echo "🧪 Running CI tests..."
	$(PY) -m pytest tests/ -q --tb=line -c pytest.ini

# Pipeline stages
features:
	@echo "🔧 Generating features with synthetic data..."
	python3 src/features_processor.py

# Comprehensive features from real Kaggle data (100+ features)
features-real:
	@echo "🔧 Generating comprehensive features from real KKBOX data..."
	@echo "⚠️  This will process 30GB of data and may take 10-30 minutes..."
	python3 src/features_comprehensive_processor.py

# Full pipeline with real data
all-real: install features-real models-real calibrate
	@echo "✅ Full pipeline with real data complete!"

# Train models on comprehensive features
models-real:
	@echo "🤖 Training models on comprehensive features..."
	python3 train_models.py --features features/features_comprehensive.parquet

labels:
	@echo "🏷️  Validating churn labels (requires real KKBOX data)..."
	@echo "Note: Run 'python3 src/labels.py --transactions <path> --train-labels <path>' with real data"

models:
	@echo "🤖 Training models..."
	python3 train_models.py

calibrate:
	@echo "🎯 Calibrating models..."
	python3 src/calibration.py

evaluate:
	@echo "📊 Evaluating models..."
	python3 src/evaluate.py

backtest:
	@echo "⏱ Rolling backtests (requires real KKBOX data)..."
	python3 src/backtest.py --transactions kkbox-churn-prediction-challenge/data/churn_comp_refresh/transactions_v2.csv \
	  --user-logs kkbox-churn-prediction-challenge/data/churn_comp_refresh/user_logs_v2.csv \
	  --members kkbox-churn-prediction-challenge/members_v3.csv \
	  --train-placeholder kkbox-churn-prediction-challenge/data/churn_comp_refresh/train_v2.csv \
	  --features-sql features/features_comprehensive.sql \
	  --windows "2017-01:2017-02,2017-02:2017-03,2017-03:2017-04" \
	  --out eval/backtests.csv

# CI-friendly backtest using synthetic data
backtest-ci:
	@echo "⏱ Rolling backtests (synthetic data)..."
	python3 src/backtest.py \
	  --transactions tests/fixtures/transactions_synthetic.csv \
	  --user-logs tests/fixtures/user_logs_synthetic.csv \
	  --members tests/fixtures/members_synthetic.csv \
	  --train-placeholder tests/fixtures/train_synthetic.csv \
	  --features-sql features/features_simple.sql \
	  --windows "2017-01:2017-02,2017-02:2017-03" \
	  --out eval/backtests.csv

# Generate synthetic test fixtures (run before CI tests)
fixtures:
	@echo "🔧 Generating synthetic test fixtures..."
	python3 tests/fixtures/generate_synthetic.py

psi:
	@echo "📈 PSI drift (using features_* CSVs with 'window' col)..."
	python3 src/psi.py --features "eval/features_*.csv" --out eval/psi_features.csv
	python3 scripts/psi_scores.py

app-features:
	@echo "📊 Generating app features (10,000 users)..."
	python3 scripts/generate_app_features.py

app:
	@echo "🚀 Starting ChurnPro (FastAPI + React)..."
	docker-compose up -d --build
	@echo "✅ Frontend: http://localhost:3000"
	@echo "✅ API: http://localhost:8000/api/health"

# Docker operations
docker-build:
	docker build -t kkbox-churn:latest .

docker-run:
	docker run --rm -it kkbox-churn:latest

docker-test:
	docker run --rm kkbox-churn:latest make test-ci

# Cleanup
clean:
	@echo "🧹 Cleaning up..."
	find . -type f -name "*.pyc" -delete
	find . -type d -name "__pycache__" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	rm -rf .pytest_cache
	rm -rf .mypy_cache
	rm -rf .ruff_cache
	rm -rf dist/
	rm -rf build/

# Data pipeline validation
validate-pipeline: clean test features
	@echo "✅ Pipeline validation complete"

# Production readiness check
production-check: lint test validate-pipeline
	@echo "🚀 Production readiness confirmed"

# Development setup
setup-dev: dev
	@echo "Setting up development environment..."
	@echo "Run 'make test' to verify setup"
