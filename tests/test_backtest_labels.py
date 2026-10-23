"""The backtest labeler must agree with src/labels.py at both ends of the 30-day window.

src/labels.py is the labeler validated against the official labels: a renewal
transacted on the expiry day (day 0) through day 30 inclusive counts as retained,
day 31 is churn. These tests run the backtest labeler's SQL on fabricated
transactions and assert the same answers.
"""

from datetime import date, timedelta

import duckdb
import pytest

from src.backtest import labels_for_expire_month

EXPIRY = date(2017, 3, 10)


def _write_transactions(path, renewal_offset_days):
    rows = [
        "msno,transaction_date,membership_expire_date,is_cancel",
        # The qualifying transaction: placed before March, expires in March.
        f"u,20170215,{EXPIRY:%Y%m%d},0",
    ]
    if renewal_offset_days is not None:
        renewed_on = EXPIRY + timedelta(days=renewal_offset_days)
        extends_to = renewed_on + timedelta(days=30)
        rows.append(f"u,{renewed_on:%Y%m%d},{extends_to:%Y%m%d},0")
    path.write_text("\n".join(rows) + "\n")


@pytest.mark.parametrize(
    "offset,expected_churn",
    [
        (0, 0),  # renewed on the expiry day itself
        (29, 0),
        (30, 0),  # the boundary: day 30 is still inside the window
        (31, 1),
        (None, 1),  # never renewed
    ],
)
def test_backtest_label_matches_labels_py_boundary(tmp_path, offset, expected_churn):
    tx = tmp_path / "transactions.csv"
    _write_transactions(tx, offset)
    labels = labels_for_expire_month(duckdb.connect(), tx, "2017-03")
    assert labels.set_index("msno").loc["u", "is_churn"] == expected_churn
