# Final suite run at wave-3 landing HEAD 596aea21dec04a59c1de61a609d11508cfdf49b7
Date: 2026-08-24T00:16:32Z. Command: .venv/bin/python -m pytest tests/ -c pytest.ini

```
FAILED tests/test_labels.py::TestChurnLabels::test_malformed_dates - _duckdb....
FAILED tests/test_labels.py::TestChurnLabels::test_analyze_mismatches - KeyEr...
8 failed, 74 passed, 3 warnings in 2.50s
```

The 8 failures are exactly the pre-existing LIMITATIONS §8 label-boundary set:
tests/test_labels.py (6) and tests/test_feature_windows.py (2). Identical to the
baseline red set recorded at arrival (HEAD c8b60e0 + arriving WIP): 8 failed / 74 passed.
tests/test_artifact_contract.py: passing. No test weakened, skipped, or deleted.
