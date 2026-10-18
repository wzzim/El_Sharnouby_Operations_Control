# El-Sharnouby Operations Control

## From operational data to evidence-backed management decisions

**El-Sharnouby Operations Control** is an end-to-end operations and decision-intelligence platform developed for the **HVIA Data & AI Solutions — El-Sharnouby Group Challenge**.

Rather than treating the challenge as a dashboarding exercise, the project approaches the provided operational data as a connected business system.

It brings together sales, inventory, procurement, suppliers, production, printing, quality, marketing, customers, and service data to answer a more useful question:

> **What should management know, investigate, and act on next?**

The platform combines deterministic analytics, decision engines, explainable recommendations, and a fully local AI analyst into one executive workspace.

---

## What the Platform Does

```text
Operational Data
       ↓
Analytics & KPI Engine
       ↓
Risk / Leakage Detection
       ↓
Decision Engine
       ↓
Local AI Intelligence
       ↓
Management Review
       ↓
Human-Controlled Execution
       ↓
Audit Trail
```

Instead of stopping at:

Data → Dashboard

Operations Control is designed around:

Data → Insight → Decision → Investigation → Execution → Review

---

## Executive Snapshot

Analysis of the provided project datasets surfaced metrics including:

| Metric | Result |
| --- | ---: |
| Recorded Net Sales | **EGP 421.3M** |
| Recorded Gross Profit | **EGP 64.9M** |
| Gross Margin | **15.4%** |
| Idle / Trapped Inventory Capital | **~EGP 10.7M** |
| Product-Location Stockout Risks | **41** |
| Conservative Operational Leakage Estimate | **~EGP 46.7M** |

> These figures are derived from the provided project operational/training datasets. Estimated leakage, exposure, and decision-impact values are analytical estimates and should not be interpreted as audited financial results or guaranteed recoverable savings.

---

## Core Platform

### Executive Command Center

A management-level view of the business combining financial performance, operational signals, risk indicators, and urgent actions.

Designed to answer:

- What is happening?
- Where is value being lost?
- What needs attention now?
- Which areas deserve deeper investigation?

---

### Decision Execution Room

The platform converts analytical findings into ranked management decisions instead of leaving them as isolated charts.

Decision cards can include:

- Priority
- Department
- Recommended action
- Business rationale
- Suggested owner
- Estimated financial impact
- Confidence
- Evidence
- Formula
- Inputs
- Assumptions
- Execution time window
- Current workflow status

The goal is to make recommendations **inspectable and actionable**, not black-box outputs.

---

### Action Center

Recommended actions move through a human-controlled workflow.

```text
Awaiting
   ↓
Approved / Deferred
   ↓
In Progress
```

Role-aware controls demonstrate how recommendations could move from analysis into operational execution while keeping management in control.

---

### Time Machine / Audit Trail

Decision transitions are recorded so management can review:

- what changed,
- when it changed,
- who changed it,
- and how the decision progressed.

This creates an auditable layer between AI recommendations and business execution.

---

## Local AI Decision Intelligence

One of the major extensions to Operations Control is a **fully local AI intelligence layer**.

The AI does not replace the analytics engine.

Instead:

```text
Pandas / Decision Engine
        ↓
Verified Business Facts
        ↓
Local Qwen Model
        ↓
Explanation / Investigation / Advice
```

The deterministic backend remains the authority for business metrics.

The language model acts as the reasoning and explanation layer.

### Ask Analyst

A conversational interface for asking natural-language questions about the business.

Examples:

- Why is gross margin 15.4%?
- Where is capital trapped?
- How are suppliers performing?
- What are the largest inventory risks?
- What should management focus on?
- How does this issue affect profitability?

Suggested questions in the interface are only examples — the analyst accepts **free-form business questions**.

Conversation context is preserved for follow-up questions while company-specific facts remain grounded in backend evidence.

---

### Root Cause Investigator

A dedicated investigation mode for operational problems.

It can examine evidence across:

- Inventory
- Procurement
- Suppliers
- Production
- Printing
- Quality
- Channels
- Financial leakage
- Other relevant operational modules

The investigator is intentionally conservative:

- it does not invent causes,
- it does not treat correlation as causation,
- it does not introduce unsupported industry benchmarks,
- and it identifies when additional validation is required.

Responses separate:

> Root Cause Summary → Likely Drivers → Evidence → Recommended Check → Confidence

---

### Action Advisor

A management-prioritization layer built on top of the platform's **existing decision cards**.

It evaluates available recommendations using supplied information such as:

- Priority
- Estimated impact
- Confidence
- Evidence
- Owner
- Status
- Time window
- Assumptions

It can recommend which existing action deserves management attention first while explaining trade-offs and alternatives.

The AI cannot invent or execute decisions.

---

## Private by Design

The current AI implementation uses:

Ollama + Qwen 2.5 3B

Inference runs locally.

```text
Business Context
      ↓
FastAPI
      ↓
Ollama
      ↓
Qwen 2.5 3B
      ↓
Grounded Response
```

No external LLM API is required for the AI Analyst.

The AI layer is also **read-only**:

> It can explain, investigate, and advise — but it cannot approve, defer, start, or execute management decisions.

Human control remains part of the architecture.

---

## Business Intelligence Modules

Operations Control includes dedicated analysis for:

### Sales & Channels

Channel performance, revenue mix, geographic performance, and pricing exposure.

### Customers

Customer behavior, segmentation, repeat behavior, and concentration analysis.

### Inventory & Forecasting

Inventory position, stock classification, trapped capital, stockout exposure, and demand signals.

### Marketing

Campaign and platform performance with efficiency and reallocation analysis.

### Operations

Production and printing performance, attainment, capacity, and operational loss signals.

### Quality & Returns

Defects, quality losses, rejection/acceptance signals, returns, and related operational exposure.

### Supply Chain

Supplier performance, delivery reliability, material performance, procurement risk, and supplier escalation signals.

### Profit Leakage

A consolidated view of modeled operational leakage and financial exposure.

### Data Health

Validation and quality checks for the underlying analytical inputs.

### Method & Coverage

Transparency into calculations, assumptions, coverage, and analytical methodology.

---

## Explainability

A core design principle of the project is:

> **No important recommendation should exist without evidence.**

Where available, decision outputs expose:

```text
Recommendation
├── Business reason
├── Estimated impact
├── Confidence
├── Evidence
├── Formula
├── Inputs
├── Assumptions
├── Owner
└── Time window
```

The AI layer follows the same principle by receiving compact, backend-verified fact sheets rather than being asked to calculate authoritative KPIs itself.

---

## Technology Stack

### Backend

- Python
- FastAPI
- Pandas
- NumPy
- Scikit-learn
- LightGBM
- SQLite
- Pydantic
- Uvicorn

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- Recharts
- Lucide Icons

### Local AI

- Ollama
- Qwen 2.5 3B
- Evidence-aware context routing
- Local inference
- Conversation-aware follow-ups
- Read-only AI architecture

---

## Architecture

```text
┌──────────────────────────────────────────────┐
│              Operational CSVs                │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│          Python / Pandas Analytics           │
│  KPIs · Leakage · Inventory · Supply · etc.  │
└──────────────────────┬───────────────────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
┌──────────────────────┐  ┌──────────────────────┐
│   Decision Engine    │  │   Analytics Service  │
│ Ranked recommendations│ │ Business intelligence│
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           └────────────┬────────────┘
                        ▼
              ┌──────────────────┐
              │     FastAPI      │
              └────────┬─────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌───────────────────┐      ┌────────────────────┐
│ Next.js Executive │      │ Local AI Analyst   │
│       UI          │      │ Ollama + Qwen      │
└───────────────────┘      └────────────────────┘
```

---

## Project Structure

```text
El_Sharnouby_Operations_Control/
│
├── backend/
│   ├── ai/
│   │   ├── __init__.py
│   │   ├── context.py
│   │   ├── prompts.py
│   │   └── service.py
│   ├── analytics/
│   ├── tests/
│   ├── decision_engine.py
│   ├── main.py
│   ├── store.py
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── ai-analyst/
│   │   │   ├── action-center/
│   │   │   ├── audit/
│   │   │   ├── channels/
│   │   │   ├── customers/
│   │   │   ├── data-health/
│   │   │   ├── inventory/
│   │   │   ├── marketing/
│   │   │   ├── operations/
│   │   │   ├── profit-leakage/
│   │   │   ├── quality/
│   │   │   ├── supply/
│   │   │   └── war-room/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── package.json
│   └── package-lock.json
│
└── data/  # Private — not included in the public repository
```

---

## Running Locally

### Requirements

For the complete application:

- **Python 3.11+**
- **Node.js 20+**
- **npm**
- **Ollama** — required only for the local AI features

The core analytics platform can operate independently of the AI layer.

---

### 1. Data

The public repository intentionally excludes the private project datasets.

Place the provided CSV files inside:

```text
data/
```

at the project root.

> **Do not publish the `data/` directory publicly.**

---

### 2. Backend — Windows PowerShell

From the project root:

```powershell
cd backend

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

API documentation:

```text
http://localhost:8001/docs
```

---

### 3. Frontend — Windows PowerShell

Open another PowerShell window:

```powershell
cd frontend

npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

If port 3000 is already occupied, Next.js may select another available port.

---

## Running the Local AI

Install Ollama separately, then obtain the model:

```bash
ollama pull qwen2.5:3b
```

Verify:

```bash
ollama list
```

The backend expects Ollama at:

```text
http://127.0.0.1:11434
```

With Ollama running, Operations Control automatically exposes the local AI functionality through the backend.

AI status endpoint:

```text
GET /api/ai/status
```

AI Analyst:

```text
POST /api/ai/chat
```

Root Cause Investigator:

```text
POST /api/ai/root-cause
```

Action Advisor:

```text
POST /api/ai/action-advisor
```

---

## macOS / Linux

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
npm run dev
```

For Fish shell:

```fish
cd backend
python -m venv .venv
source .venv/bin/activate.fish
pip install -r requirements.txt
python -m uvicorn main:app --port 8001
```

---

## Repository & Data Policy

The following are intentionally excluded from source control:

```text
data/
backend/.venv/
backend/__pycache__/
backend/.pytest_cache/
backend/warroom.db

frontend/node_modules/
frontend/.next/
frontend/tsconfig.tsbuildinfo

*.pyc
.DS_Store
```

The project datasets were provided for the HVIA internship challenge and are not included in the public repository.

---

## Design Philosophy

This project was built around three ideas.

### 1. Analytics should lead somewhere

A chart showing a problem is useful.

A system that identifies the problem, explains its impact, recommends an action, assigns ownership, and tracks execution is more useful.

### 2. AI should be grounded

The language model is not responsible for calculating authoritative company metrics.

The deterministic backend calculates them.

The AI explains them.

### 3. Humans remain in control

AI can:

- analyze,
- explain,
- investigate,
- compare,
- and advise.

Management still decides what gets executed.

---

## Project Context

Developed as part of the **HVIA Data & AI Solutions internship — El-Sharnouby Group Challenge**.

The challenge required working with interconnected operational datasets and developing solutions to business problems across the group.

This implementation focused on creating a unified operations-intelligence and decision-support environment rather than a collection of disconnected analyses.

---

## Disclaimer

This project is an analytical prototype built from provided project operational/training datasets.

Some figures represent modeled estimates, scenarios, exposure calculations, or decision-support assumptions.

They should not be interpreted as:

- audited financial statements,
- guaranteed recoverable savings,
- production financial advice,
- or autonomous management decisions.

---

## Built With

Python · FastAPI · Pandas · Next.js · TypeScript · Tailwind CSS · Recharts · SQLite · Ollama · Qwen

> See the business. Understand the problem. Decide what happens next.
