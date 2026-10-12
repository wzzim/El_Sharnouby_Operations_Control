# El-Sharnouby Operations Control

AI-powered executive operations platform for the HVIA Task 02 challenge. The system analyzes El-Sharnouby Group / Leo Moda operational CSVs across sales, inventory, suppliers, production, quality, marketing, customers, and service, then turns the data into ranked business actions, executive dashboards, and an auditable decision workflow.

## Data note

This public-safe copy excludes the `data/` folder for confidentiality. To run locally, place the provided CSV files inside `data/` at the project root.

The CSV files were provided for the HVIA internship task. Some tables are marked as modeled/training operational data in the dataset, so the results should be treated as a business-intelligence and decision-intelligence exercise, not audited financial statements.

**Do not publish the `data/` folder publicly.** For GitHub or LinkedIn, use a public-safe copy of the project without `data/` and include the note: “The `/data` folder is excluded for confidentiality. To run locally, place the provided CSV files inside `/data` at the project root.”

## Project structure

```text
backend/   FastAPI + pandas decision engine and analytics API
frontend/  Next.js + Tailwind executive UI
data/      Provided operational CSVs for private HVIA review
```

## Quick Start on Windows

### 1. Requirements

Install:

- Python 3.11 or newer
- Node.js 20 LTS or newer

Check in PowerShell:

```powershell
python --version
node --version
npm --version
```

### 2. Run the backend

Open PowerShell in the project folder:

```powershell
cd path\to\El_Sharnouby_Ops_Intelligence_Submission\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python -m uvicorn main:app --port 8001
```

Backend:

```text
http://localhost:8001
```

API docs:

```text
http://localhost:8001/docs
```

Quick API check:

```text
http://localhost:8001/api/overview
```

### 3. Run the frontend

Open a second PowerShell window:

```powershell
cd path\to\El_Sharnouby_Ops_Intelligence_Submission\frontend
npm install
$env:NEXT_PUBLIC_API_URL="http://localhost:8001"
npm run dev
```

Frontend:

```text
http://localhost:3000
```

If port 3000 is busy, Next.js may use another port such as `http://localhost:3001`.

## Quick Start on macOS / Linux

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --port 8001
```

Frontend:

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8001 npm run dev
```

For fish shell:

```fish
cd backend
python -m venv .venv
source .venv/bin/activate.fish
pip install -r requirements.txt
python -m uvicorn main:app --port 8001
```

Frontend in fish:

```fish
cd frontend
npm install
env NEXT_PUBLIC_API_URL=http://localhost:8001 npm run dev
```

## Main features

- Executive Command Center with revenue, gross margin, trapped capital, and risk KPIs
- Decision Control Room Kanban board with ranked AI recommendations
- Action approval/defer/start workflow with backend audit trail
- Profit leakage analysis
- Channels, customers, inventory/forecast, marketing, operations, quality, supply chain, method, and data-health pages
- Honest modeled-data labeling and formula/source notes

## Generated folders intentionally excluded from clean source control

These folders/files are generated locally and should not be committed to GitHub:

```text
frontend/node_modules/
frontend/.next/
backend/.venv/
backend/__pycache__/
backend/.pytest_cache/
backend/warroom.db
data/
```

This public-safe zip excludes `data/`. Add the private CSVs to `data/` locally before running the backend.
