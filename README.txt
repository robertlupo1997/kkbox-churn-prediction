# KKBox Churn Prediction Project

This project analyzes the KKBox churn prediction dataset to forecast whether subscribers will renew or churn within 30 days after their membership expires. The project demonstrates my data engineering and analytics skills through SQL queries, visualizations in Power BI, and exploratory analysis in Python (Jupyter notebooks).

---

## Table of Contents
- [Overview](#overview)
- [Dataset Description](#dataset-description)
- [Files Included](#files-included)
- [Data Loading & Troubleshooting](#data-loading--troubleshooting)
  - [Initial Steps in SQL Server](#initial-steps-in-sql-server)
  - [Transition to PostgreSQL](#transition-to-postgresql)
- [Project Structure](#project-structure)
- [Usage](#usage)
- [Visualizations](#visualizations)
- [Credits & License](#credits--license)
- [Contact](#contact)

---

## Overview
This portfolio project uses historical user behavior data from KKBox to predict churn. The analysis covers:
- **SQL:** Data extraction and transformation.
- **Power BI:** Creating interactive dashboards for data visualization.
- **Python/Jupyter Notebooks:** Exploratory data analysis, cleaning, and generating insights.

The target audience for this README is potential employers interested in data-centric solutions and reproducible analytics workflows.

---

## Dataset Description
The dataset is from the **KKBOX Research Prediction Competition** (Late Submission for the WSDM - KKBox's Churn Prediction Challenge). The main challenge is to predict churn—defined as no new valid subscription within 30 days following the current membership expiration date.

### Key Points:
- **Churn Definition:**  
  A subscriber is considered to have churned if no new subscription transaction occurs within 30 days after membership expiration. Note that a cancellation (`is_cancel`) does not necessarily equate to churn since plan changes can also lead to renewal.
  
- **Data Overview:**  
  - **Training Data:**  
    - `train.csv` (and refreshed version `train_v2.csv`): Contains user IDs and churn labels.
  - **Test Data:**  
    - `sample_submission_zero.csv` (and refreshed version `sample_submission_v2.csv`): Contains user IDs for predictions.
  - **Transactional Data:**  
    - `transactions.csv` and `transactions_v2.csv`: Logs user transactions including payment method, plan details, transaction date, membership expiration date, and cancellation.
  - **User Behavior:**  
    - `user_logs.csv` and `user_logs_v2.csv`: Daily user logs showing listening behavior (e.g., song play counts, unique songs, total seconds played).
  - **User Profiles:**  
    - `members.csv` and updated `members_v3.csv`: User information with demographics, registration details, and membership expiration snapshots.

---

## Files Included
The dataset consists of 10 compressed files (7z archives), totaling approximately 8.95 GB. Key files include:
- **CSV Data Files:**  
  - `train.csv` / `train_v2.csv`
  - `sample_submission_zero.csv` / `sample_submission_v2.csv`
  - `transactions.csv` / `transactions_v2.csv`
  - `user_logs.csv` / `user_logs_v2.csv`
  - `members.csv` / `members_v3.csv`
  
- **Additional Files:**  
  - `WSDMChurnLabeller.scala` – Scala script used for generating churn labels.
  - Other supporting documentation and compressed files.

For the complete dataset download and details, visit the [Kaggle competition page](https://www.kaggle.com/c/kkbox-churn-prediction-challenge).

---

## Data Loading & Troubleshooting

### Initial Steps in SQL Server
Initially, I attempted to load the CSV files into **SQL Server** by:
1. **Extracting the 7z Files:** Using 7-Zip to extract the CSVs.
2. **Database & Table Creation:** Created the database `KKBoxAnalytics` and appropriate staging tables.
3. **Bulk Insert:** Using a `BULK INSERT` script for large files. For example:
    ```sql
    BULK INSERT stg_transactions
    FROM 'C:\Path\To\transactions.csv'
    WITH (
        FIELDTERMINATOR = ',',
        ROWTERMINATOR = '\n',
        FIRSTROW = 2,
        TABLOCK
    );
    ```
4. **Troubleshooting Issues:** Encountered issues with file permissions and server access.

### Transition to PostgreSQL
Due to compatibility and ease-of-use considerations, I transitioned to PostgreSQL:
1. **Database Setup:**  
   - Created the database using:
     ```sql
     CREATE DATABASE kkbox_analytics;
     ```
2. **Table Creation:**  
   - Defined staging tables (e.g., `stg_members_v3`) to mirror CSV structures:
     ```sql
     CREATE TABLE stg_members_v3 (
         msno VARCHAR(50),
         city INT,
         bd INT,
         gender VARCHAR(10),
         registered_via INT,
         registration_init_time VARCHAR(8)
     );
     ```
3. **Using COPY vs. \copy:**  
   - The PostgreSQL server’s `COPY` command raised permission issues on Windows.  
   - Switched to client-side `\copy` in psql:
     ```sql
     \copy stg_members_v3 FROM 'C:\Path\To\members_v3.csv' DELIMITER ',' CSV HEADER
     ```
   - Ensured connection to the correct database with:
     ```sql
     \c kkbox_analytics
     ```
4. **Final Verification:**  
   - Completed data import in pgAdmin 4.  
   - Verified row counts (e.g., `stg_members_v3` with 6,769,473 rows).

---

## Project Structure
A typical project folder structure:



---

## Usage
### Running SQL Scripts
Run the provided SQL scripts to set up the database schema and load the data:
- **Creating Tables:**  
  Use the `create_tables.sql` script to create staging tables.
- **Data Cleaning (Planned):**  
  Refer to `clean_data.sql` for converting VARCHAR date fields to PostgreSQL’s DATE type. For example:
  ```sql
  CREATE TABLE dim_transactions AS
  SELECT 
      msno,
      TO_DATE(transaction_date, 'YYYYMMDD') AS transaction_date,
      TO_DATE(membership_expire_date, 'YYYYMMDD') AS membership_expire_date,
      payment_method_id::INT,
      payment_plan_days::INT,
      plan_list_price::INT,
      actual_amount_paid::INT,
      is_auto_renew::INT,
      is_cancel::INT
  FROM stg_transactions;


KKBox-Churn-Prediction/
├── sql/
│   ├── 01_create_tables.sql
│   ├── 02_feature_engineering.sql
│   ├── 03_analysis_queries.sql
│   ├── 04_predictive_features.sql
│   ├── 05_churn_risk_scoring.sql
│   ├── 06_validation.sql
│   └── master.sql
├── README.md
└── [other files, e.g., Power BI reports]