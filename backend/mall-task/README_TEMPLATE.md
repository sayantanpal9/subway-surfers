# Mall Operations Optimiser — Submission README

> **Submission Note:** Fill in every section below. This document forms the basis of your **Engineering Review (6 points)** and will be used as the syllabus during your **live technical interview defense**.

---

## 1. System Architecture & Data Model

### 1.1 Tech Stack Justification
- **Backend:** `[e.g., Go 1.22 / FastAPI / Node.js 20 with TypeScript]`
  - *Rationale:* Why did you choose this language and framework? What characteristics (throughput, memory safety, concurrency model) make it appropriate for processing high-frequency sequential events?
- **Database:** `[e.g., PostgreSQL 16 / MongoDB 7 / SQLite WAL / Redis]`
  - *Rationale:* Why SQL vs NoSQL? How does your chosen database handle high-frequency writes during the live event stream?
- **Frontend:** `[e.g., React with Zustand / SolidJS / Svelte / Vanilla TS]`
  - *Rationale:* How does your frontend UI ensure that rapid state updates do not choke the browser DOM or drop data frames?

### 1.2 Database Schema & Ledger Storage
- **Schema Overview:** Detail your tables/collections (e.g., `days`, `items`, `events_ledger`, `day_summaries`).
- **High-Throughput Write Strategy:** During a 60,000-event day, how are event records persisted? (e.g., buffered batch inserts, asynchronous queue, background worker, or direct indexed writes).
- **Ledger Retrieval (`GET /api/v1/day/:day_id/events`):** What indexes exist to allow instant pagination or scrolling across past days?

### 1.3 High-Rate UI State Management (50 events/s)
- **State Architecture:** Explain how incoming event data updates the dashboard state (polling vs WebSocket/SSE vs internal client loop).
- **Rendering & Throttling:** How do you throttle or batch DOM/canvas renders (e.g., `requestAnimationFrame`, throttled Redux/Zustand selectors, Virtualized table for 50 items and event feed)?

---

## 2. Algorithmic Decision Policy (Core Defense)

### 2.1 Problem Formulation
- What exact optimization problem did you formulate for the planning phase (`POST /api/v1/day/load`)?
- *Example approaches:*
  - Offline dynamic programming / backwards induction with perfect foresight.
  - Lookahead heuristic with dynamic safety stock reservation.
  - Min-cost circulation / network flow.
  - Real-time predictive thresholding based on item demand velocity.
- Explain the formal mathematical objective or heuristic function your algorithm optimizes.

### 2.2 Decision Rule & Invariant
- For an online line $(item\_id, qty)$, how does your system decide the exact value of `from_shelf`?
- **The Core Trade-off:** Explain how your decision policy balances:
  1. Saving immediate warehouse pull cost (`online_pull_cost_per_unit_paise`) by consuming shelf stock.
  2. Preserving shelf stock to prevent catastrophic walk-in lost sales (`unit_price_paise`).
  3. Timing shelf depletion to trigger refills ($S=0$) at favorable moments vs avoiding premature refill penalties.

### 2.3 Algorithmic Complexity Analysis
- **Planning Phase (`POST /day/load`):**
  - Time Complexity: $\mathcal{O}(\dots)$
  - Space Complexity: $\mathcal{O}(\dots)$
  - Parameter breakdown (e.g., $N$ events, $M$ items, $S_{\max}$ shelf capacity).
- **Real-Time Event Dispatch (`POST /day/events`):**
  - Time Complexity per event: $\mathcal{O}(\dots)$
  - Space Complexity: $\mathcal{O}(\dots)$

---

## 3. Empirical Benchmark Results

Run your backend against both sample days using the authoritative harness at maximum speed (`--rate 0`):

```bash
python harness/run_day.py --base-url http://localhost:8080 --items data/items.csv --day days/sample_day_1.json --rate 0
python harness/run_day.py --base-url http://localhost:8080 --items data/items.csv --day days/sample_day_2.json --rate 0
```

### 3.1 Results Comparison Table

| Metric | Sample Day 1 (30k events, 50% online) | Sample Day 2 (35k events, 35% online) |
|---|:---:|:---:|
| **Total Cost ($C$)** | `[your value]` paise | `[your value]` paise |
| **Refill Cost** | `[...]` paise | `[...]` paise |
| **Online Pull Cost** | `[...]` paise | `[...]` paise |
| **Lost Revenue** | `[...]` paise | `[...]` paise |
| **Cheaper Baseline ($C_{\text{base}}$)** | 2,485,934,450 paise | 4,431,194,650 paise |
| **Reference Optimal ($C_{\text{opt}}$)** | 973,284,900 paise | 1,353,975,950 paise |
| **Net Savings ($C_{\text{base}} - C$)** | `[...]` paise | `[...]` paise |
| **Day Score (0 – 100)** | **`[...]` / 100** | **`[...]` / 100** |
| **Planning Time (`/day/load`)** | `[...]` seconds | `[...]` seconds |
| **Throughput (`/day/events`)** | `[...]` events/sec | `[...]` events/sec |
| **Clamped Lines Count** | `0` *(must be 0)* | `0` *(must be 0)* |

### 3.2 Performance Commentary
- Briefly explain why your score performed higher or lower across Day 1 vs Day 2 (e.g., impact of higher walk-in ratio on Day 2).
- Note any bottlenecks identified during profiling.

---

## 4. Modularity & Live Interview Defense (R1 & R5)

### 4.1 Architecture & Policy Decoupling (R1 Compliance)
- **Policy Interface Location:** Path: `[e.g., backend/src/policy/policy.interface.ts]`
- **Implementation File:** Path: `[e.g., backend/src/policy/optimal_dp_policy.ts]`
- **Simulation Mirror Location:** Path: `[e.g., backend/src/simulation/mall_sim.ts]`
- Explain how a different decision policy (e.g., baseline `ShelfFirstPolicy`) can be substituted with zero changes to the HTTP or DB layers.

### 4.2 Live Code Modification Readiness
*During your interview, you will be given a live variation of the problem statement and asked to implement it in your codebase within 15–20 minutes.*

Briefly explain which specific files and functions you would modify if:
1. **Refill Threshold Change:** Refill triggered at $S \le 2$ instead of $S = 0$:
   - *Files / Functions to change:* `[...]`
2. **Partial Online Fulfillment:** Online orders could be partially dropped if pull cost exceeded margin:
   - *Files / Functions to change:* `[...]`
3. **Variable Batch Refill:** Instead of restoring to `initial_shelf_qty`, refills delivered a fixed 50 units:
   - *Files / Functions to change:* `[...]`

---

## 5. Deployment Information (Optional Bonus)

- **Live Frontend URL:** `[e.g., https://my-mall-dashboard.vercel.app]`
- **Live Backend API URL:** `[e.g., https://api.my-mall-sim.com]`
- **Cloud Provider / Hosting:** `[e.g., Render, Railway, Fly.io, Vercel, Supabase]`
- *(Ensure no "InterIIT" keywords appear in URLs or domain names).*
