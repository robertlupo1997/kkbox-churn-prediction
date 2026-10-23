# Legacy SQL-era files

These files come from the project's first version (spring 2025): SQL Server, then PostgreSQL,
with Power BI dashboards. `master.sql` hard-codes Windows paths from that machine and does not run
as-is. They are kept for history; the current pipeline is DuckDB SQL under `features/` and `sql/`,
driven from Python (see the main README).
