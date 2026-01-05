"""Pytest configuration for KKBOX tests."""

import os
import sys
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

# Change working directory to project root for data file access
os.chdir(project_root)
