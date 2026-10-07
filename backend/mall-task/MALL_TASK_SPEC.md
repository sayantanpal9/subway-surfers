# Mall Operations Optimiser

**Developers Selection Task**

Submission deadline: `7th October 11:59PM IST`

---

## 1. Overview

You are the software developer of a shopping mall. The mall sells 50 products. Each product has a **shelf** (small, limited stock) and a **warehouse** (effectively unlimited stock).

Customers arrive in two ways:

- **Walk-in customers** buy at the in-mall counter. They can only buy from the shelf, and they buy an item **only if the shelf can cover the full quantity they want**. If it cannot, they buy none of that item and take their money elsewhere: the whole line is a **lost sale**.
- **Online customers** place multi-item orders. Your system decides, per item, how many units come from the shelf and how many are sent from the warehouse. Online orders are never lost, but warehouse units cost money.
- When a shelf runs empty it is **refilled** from the warehouse, which also costs money.

You are given an entire trading day up front: every walk-in order and every online order, in order. Your job is to make decisions that **minimise the mall's total cost** over that day, store the processed data robustly in a database, and show the mall owner a dashboard to replay live simulations and review historical days.

You will build:

1. A **backend service** that loads a day's JSON file, tracks shelf state, decides how each online order is split, and stores the historical ledger in a database.
2. An **owner dashboard** (web UI) that shows costs live while a day is being simulated, and allows the owner to click into past days to view their full order sequence and KPI summary.
3. A **Docker packaging** so that `docker compose up --build` starts everything.

**Evaluation:** We run your system on **7 unseen days** with different traffic patterns. Each day is scored by how low your total cost is compared with reference values. **There is no "wrong" answer**: every valid response produces a cost, and a lower cost scores higher.

---

## 2. The Mall — Simulation Rules (normative)

This section is the single source of truth. If anything elsewhere appears to conflict with it, this section wins.

### 2.1 Units and money

- All money is an **integer number of paise** (1 rupee = 100 paise). No floating-point money anywhere in requests or responses.
- All quantities are positive integers.
- Day totals can exceed 2³¹. Use 64-bit integers (or equivalent) for totals.

### 2.2 Items and state

Each item has the following parameters (from `items.csv`, see §3):

| Parameter | Meaning |
|---|---|
| `unit_price_paise` | Selling price of one unit (same for walk-in and online) |
| `initial_shelf_qty` | Shelf stock at the start of every day. Also the amount the shelf is restored to on refill |
| `refill_cost_per_unit_paise` | Cost to move one unit from warehouse to shelf during a refill |
| `online_pull_cost_per_unit_paise` | Cost to send one unit from the warehouse to an online customer |

For every item, `S` denotes the **current shelf quantity**. The warehouse is unlimited and is never tracked.

At the start of every day (a fresh start): `S = initial_shelf_qty` for every item. Nothing carries over from a previous day.

### 2.3 Processing order

Events are processed **strictly in ascending `seq`**. One event completes entirely (including any refills it triggers) before the next begins.

### 2.4 Walk-in event

A walk-in event has a list of lines `(item_id, qty)`. Lines are independent of each other. Each line is processed as follows:

- **If `qty ≤ S` (the shelf can cover it):** the customer buys the full quantity. `S ← S − qty`; `walk_in_revenue_captured += qty × unit_price_paise`; then apply the **refill rule** (§2.6) to this item.
- **If `qty > S` (the shelf cannot cover it):** the customer buys **none** of that line and goes to another mall. `lost_revenue += qty × unit_price_paise`; `units_lost += qty`; `S` is **unchanged** (nothing is taken, so no refill is triggered).

This is decided per line, not per order: a customer who cannot get one item still buys the other lines the shelf can cover. The customer never waits for a refill. A lost line is permanently lost.

### 2.5 Online event

An online event has a list of lines `(item_id, qty)`. For each line, **your backend returns an integer `from_shelf`**. The harness then computes:

1. `shelf_units = clamp(from_shelf, 0, min(qty, S))`
2. `inventory_units = qty − shelf_units`
3. `S ← S − shelf_units`
4. `online_pull_cost += inventory_units × online_pull_cost_per_unit_paise`
5. `online_revenue += qty × unit_price_paise` (online orders are always fully served)
6. Apply the **refill rule** (§2.6) to this item.

Clamping rules for `from_shelf`: missing, `null`, non-integer → treated as `0`; negative → `0`; greater than `min(qty, S)` → `min(qty, S)`. Each clamped line is counted in the harness diagnostics (`clamped_lines`). Clamping is not penalised directly; it simply means the harness used a different split than you intended.

### 2.6 Refill rule

After **every line** (walk-in or online) is applied, if that item's `S == 0`:

- `refill_count += 1`
- `refill_cost += initial_shelf_qty × refill_cost_per_unit_paise`
- `S ← initial_shelf_qty` (instantly)

The refill threshold is exactly **zero**. Because a refill only happens at `S == 0`, it always moves exactly `initial_shelf_qty` units.

Consequence: at the start of every line, `1 ≤ S ≤ initial_shelf_qty`. A walk-in therefore never meets an empty shelf, but can meet a shelf with fewer units than they want, in which case the whole line is lost (§2.4).

### 2.7 End of day

After the last event nothing else happens. Leftover shelf stock has no value and no cost.

### 2.8 Objective

```
TotalCost = refill_cost + online_pull_cost + lost_revenue
```

**Lower is better.**

For the dashboard also define:

```
gross_revenue = walk_in_revenue_captured + online_revenue
```

(Minimising `TotalCost` is equivalent to maximising the mall's net position, because the revenue the mall would earn if nothing were ever lost is fixed by the day.)

### 2.9 Baseline policies

Two simple reference policies are defined. Neither is meant to be good; they are yardsticks.

- **Shelf-First:** for every online line, `from_shelf = min(qty, S)`. It is cheap per order but drains the shelf that walk-ins depend on.
- **Inventory-Only:** for every online line, `from_shelf = 0`. It never touches the shelf but pays the warehouse price on every online unit.

Neither policy dominates the other; which is cheaper depends on the day. The baseline cost is the better of the two:

```
C_base = min( C_shelf_first, C_inventory_only )
```

The dashboard must show both costs and the baseline (§4.2). "Savings" means `C_base − your cost`.

### 2.10 Worked example

One item: `unit_price = 100`, `initial_shelf_qty = 5`, `refill_cost_per_unit = 10`, `online_pull_cost_per_unit = 15`.

| seq | Event | Action | S after | Cost added |
|---|---|---|---|---|
| — | start | — | 5 | — |
| 1 | walk-in, qty 3 | taken 3, shortfall 0 | 2 | — |
| 2 | online, qty 4, `from_shelf = 2` | shelf 2, inventory 2 → pull cost 2×15 = 30. S hits 0 → refill: 5×10 = 50 | 5 | 80 |
| 3 | walk-in, qty 6 | 6 > S = 5, so the customer buys none → lost 6×100 = 600. S unchanged | 5 | 600 |
| 4 | walk-in, qty 5 | 5 ≤ S, sold. S hits 0 → refill 5×10 = 50 | 5 | 50 |

Totals: `refill_cost = 100`, `refill_count = 2`, `online_pull_cost = 30`, `lost_revenue = 600`, `TotalCost = 730`, `units_lost = 6`, `units_pulled_from_inventory = 2`, `walk_in_revenue_captured = 800`, `online_revenue = 400`, `gross_revenue = 1200`.

Note event 3: the shelf held 5 units, yet none were sold, because the customer needed 6.

### 2.11 Guarantees about the input

- Every `item_id` in an event exists in the day's `items`.
- Within one event, each `item_id` appears **at most once**.
- All `qty` are integers ≥ 1. `seq` runs 1..N with no gaps. `ts` is a non-decreasing integer (seconds since opening).
- Numeric bounds are in §6.
- For every item: `unit_price_paise > online_pull_cost_per_unit_paise > refill_cost_per_unit_paise ≥ 1`.

---

## 3. Files You Receive

```
mall-task/
├── MALL_TASK_SPEC.md                  this document
├── README_TEMPLATE.md                 structured template for your submission README (R5)
├── data/
│   └── items.csv                      the 40–50 items (same for every day)
├── days/
│   ├── sample_day_1.json              sample day (full events)
│   ├── sample_day_1.meta.json         reference numbers for the sample day
│   ├── sample_day_2.json
│   └── sample_day_2.meta.json
├── harness/
│   ├── run_day.py                     replays a day against your backend
│   └── requirements.txt
└── schemas/                           JSON Schemas for the load request, event,
                                       event response and summary
```

The 7 official days are **not** included. They use the same `items.csv` and the same file format, and are produced by the same generator with different seeds and traffic profiles.

### 3.1 `data/items.csv`

UTF-8, comma-separated, header row, one row per item.

| Column | Type | Description |
|---|---|---|
| `item_id` | string | Unique id, e.g. `I001` |
| `name` | string | Display name |
| `category` | string | Display category |
| `unit_price_paise` | int | Selling price per unit |
| `initial_shelf_qty` | int | Starting shelf stock and refill target |
| `refill_cost_per_unit_paise` | int | Cost per unit moved warehouse → shelf |
| `online_pull_cost_per_unit_paise` | int | Cost per unit sent from warehouse to an online customer |

Example:

```csv
item_id,name,category,unit_price_paise,initial_shelf_qty,refill_cost_per_unit_paise,online_pull_cost_per_unit_paise
I001,Basmati Rice 5kg,Grocery,64900,60,2500,4200
I002,Toothpaste 150g,Personal Care,9500,120,400,700
I003,USB-C Cable 1m,Electronics,24900,40,900,1500
```

### 3.2 Day file (`days/<day_id>.json`)

```json
{
  "day_id": "sample_day_1",
  "schema_version": 1,
  "events": [
    { "seq": 1, "ts": 0,  "type": "walk_in", "order_id": "W000001",
      "lines": [ { "item_id": "I007", "qty": 2 }, { "item_id": "I012", "qty": 1 } ] },
    { "seq": 2, "ts": 3,  "type": "online",  "order_id": "O000001",
      "lines": [ { "item_id": "I001", "qty": 4 } ] }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `day_id` | string | Identifier |
| `schema_version` | int | Currently `1` |
| `events[].seq` | int | 1..N, contiguous, processing order |
| `events[].ts` | int | Seconds since opening (0 – 43 200). Informational and for chart axes |
| `events[].type` | string | `"walk_in"` or `"online"` |
| `events[].order_id` | string | Unique within the day |
| `events[].lines[]` | array | 1–6 lines; `{ "item_id": string, "qty": int }` |

### 3.3 Meta file (sample days only)

```json
{
  "day_id": "sample_day_1",
  "event_count": 31842,
  "walk_in_events": 15210,
  "online_events": 16632,
  "baseline_shelf_first_cost": 0,
  "baseline_inventory_only_cost": 0,
  "baseline_total_cost": 0,
  "reference_optimal_cost": 0
}
```

`baseline_total_cost` is `C_base` (the cheaper of the two baseline policies in §2.9) and `reference_optimal_cost` is the lowest cost achievable under §2. Use them to check how close you are on the sample days. (Real values are filled in by the organisers.) Official days have no meta file.

### 3.4 The harness (`harness/run_day.py`)

```
python harness/run_day.py \
  --base-url http://localhost:8080 \
  --items data/items.csv \
  --day days/sample_day_1.json \
  --rate 0 \
  --out results/
```

- `--rate N`: events per second to send; `0` means as fast as possible. Use e.g. `--rate 50` to watch your dashboard update live.
- Requires Python 3.10+ and `requests`.
- The harness holds its **own authoritative simulation** (§2). All costs are computed by the harness from your responses. Totals reported by your backend are never used for scoring.
- It writes `results/<day_id>.result.json` containing the authoritative totals, `failures`, `clamped_lines`, and, if a meta file sits next to the day file, `day_score`.

---

## 4. What You Must Build

### 4.1 Backend API Design

The backend is completely **language and framework agnostic** (JavaScript, TypeScript, Python, Go, Java, etc., are all heavily encouraged). It must listen on port **8080**. All bodies are JSON (UTF-8). All paths are under `/api/v1`. Error bodies look like `{ "error": "<code>", "message": "<text>" }`.

#### 4.1.1 `GET /api/v1/health`

`200 { "status": "ok" }` once the service is ready to accept a load.

#### 4.1.2 `POST /api/v1/day/load` (Day Initialization)

Accepts the full JSON file content representing the entire day. Your algorithm processes this data to form a strategy. Request body:

```json
{
  "day_id": "day_3",
  "items":  [ { "item_id": "I001", "name": "...", "category": "...",
                "unit_price_paise": 64900, "initial_shelf_qty": 60,
                "refill_cost_per_unit_paise": 2500,
                "online_pull_cost_per_unit_paise": 4200 } ],
  "events": [ /* every event of the day, same objects as the day file */ ]
}
```

Required behaviour:

- Discard all current-day state and start fresh (`S = initial_shelf_qty` for all items).
- The `items` array in the request is the **only** source of item parameters. Do not read `items.csv` from disk.
- You receive the whole day, so you may analyse **all events, including future ones**, before replying. Any planning must be finished before you respond.
- Reply `200 { "day_id": "...", "status": "ready", "event_count": N }` within **300 seconds**.
- Request bodies up to 25 MB must be accepted.

#### 4.1.3 `POST /api/v1/day/events` (Live Simulation Processing)

The harness sends the events of the loaded day one at a time to evaluate your backend's routing decisions and simulate live traffic. Request body: one event object, exactly as in the day file.

Rules:

- The expected `seq` is `last_processed + 1`. Otherwise reply `409 { "error": "out_of_order", "expected": <int> }`.
- Your backend must **apply every event to its own mirror of the shelf state using exactly the rules in §2**, persist the transaction in the database, and return the routing split.

Responses:

Walk-in:

```json
{ "seq": 41, "type": "walk_in", "status": "ok" }
```

Online (one entry per request line; match by `item_id`):

```json
{ "seq": 42, "type": "online",
  "lines": [ { "item_id": "I001", "from_shelf": 3 },
             { "item_id": "I019", "from_shelf": 0 } ] }
```

When the last event (`seq == event_count`) has been processed the day's status becomes `finished`.

#### 4.1.4 `GET /api/v1/days` (History List)

Returns a high-level summary of all past simulated days stored in your database to populate the History Table on the dashboard.

```json
[
  { "day_id": "sample_day_1", "total_cost": 75000, "lost_revenue": 12000, "savings_vs_baseline": 5000 },
  { "day_id": "day_3", "total_cost": 105000, "lost_revenue": 8000, "savings_vs_baseline": 15000 }
]
```

#### 4.1.5 `GET /api/v1/day/:day_id/summary` (Specific Day KPIs)

Returns the detailed KPIs and items table for a specific `day_id`. This API is called by the dashboard both during a live simulation and when the owner clicks a past day in the History list.

```json
{
  "day_id": "day_3",
  "status": "idle | ready | running | finished",
  "events_processed": 12000,
  "events_total": 31842,
  "totals": {
    "refill_cost": 0,
    "online_pull_cost": 0,
    "lost_revenue": 0,
    "total_cost": 0,
    "refill_count": 0,
    "units_lost": 0,
    "units_pulled_from_inventory": 0,
    "walk_in_revenue_captured": 0,
    "online_revenue": 0,
    "gross_revenue": 0
  },
  "baseline": { "shelf_first_cost": 0, "inventory_only_cost": 0, "total_cost": 0 },
  "savings_vs_baseline": 0,
  "items": [
    { "item_id": "I001", "shelf_qty": 0, "refill_count": 0, "units_lost": 0,
      "lost_revenue": 0, "units_pulled": 0, "pull_cost": 0, "refill_cost": 0 }
  ]
}
```

#### 4.1.6 `GET /api/v1/day/:day_id/events` (Specific Day Ledger)

Returns the full chronological ledger of all processed events for a specific `day_id` from the database, including the algorithm's routing decisions (e.g., how many items were allocated to `from_shelf`). Used to populate the event feed when viewing a historical day.

### 4.2 Owner Dashboard

A web app served on port **3000** (route `/`). Any framework. It is for the **mall owner only**; no customer-facing UI is required or wanted.

Every element below must carry the given `data-testid`. For numeric elements, set a `data-value` attribute containing the **raw integer** (paise for money, plain count otherwise); the visible text may be formatted any way (e.g. `₹1,234.50`). Automated tests read `data-value`.

**Header**

| `data-testid` | Content |
|---|---|
| `day-id` | Current day id (text) |
| `run-status` | `idle`, `ready`, `running` or `finished` (text) |
| `progress` | `data-value` = integer percentage 0–100 of events processed |

**KPI cards** (`data-value` = integer)

| `data-testid` | Value |
|---|---|
| `kpi-total-cost` | `totals.total_cost` |
| `kpi-refill-cost` | `totals.refill_cost` |
| `kpi-online-pull-cost` | `totals.online_pull_cost` |
| `kpi-lost-revenue` | `totals.lost_revenue` |
| `kpi-gross-revenue` | `totals.gross_revenue` |
| `kpi-baseline-cost` | `baseline.total_cost` (the cheaper of the two) |
| `kpi-baseline-shelf-first` | `baseline.shelf_first_cost` |
| `kpi-baseline-inventory-only` | `baseline.inventory_only_cost` |
| `kpi-savings` | `savings_vs_baseline` |
| `kpi-refill-count` | `totals.refill_count` |
| `kpi-units-lost` | `totals.units_lost` |

**Items table** (`data-testid="items-table"`): one row per item with `data-testid="item-row-<item_id>"`, containing cells with `data-value`:

| `data-testid` | Value |
|---|---|
| `item-shelf-<item_id>` | current shelf quantity |
| `item-lost-<item_id>` | lost revenue (paise) |
| `item-refills-<item_id>` | refill count |
| `item-pulled-<item_id>` | units pulled from inventory |

It must have a text input `data-testid="item-search"` that filters rows by item id or name, and a control `data-testid="sort-lost"` that sorts rows by lost revenue, descending.

**Cost chart** (`data-testid="cost-chart"`): cumulative total cost of your system and of the baseline (`baseline.total_cost`, i.e. the cheaper of the two baseline policies at each point) against event progress (or `ts`). Updates live.

**Event feed** (`data-testid="event-feed"`): the event sequence. During a live run, it shows the latest 50 events, newest first. When viewing a historical day, it allows scrolling/paginating through that day's full ledger (utilizing the `/api/v1/day/:day_id/events` API).

**History** (`data-testid="history-table"`): one row per completed day retrieved from the database, with `data-testid="history-row-<day_id>"` and cells `history-cost-<day_id>`, `history-lost-<day_id>`, `history-savings-<day_id>` (`data-value` integers). **Interaction:** Clicking on any row in this history table must fetch and load that specific past day's full order sequence and KPI summary into the dashboard, transitioning the view from the live simulation to the historical recap.

**Behaviour**

- **State Management & Rendering:** Because the harness can send up to 50 events per second, you must utilize wise frontend state management (e.g., React Context, Redux, Zustand) to avoid lag. The UI must render smoothly without throttling the browser or dropping data frames.
- Live: while a day runs, KPI values must update at least once per second without a manual refresh.
- Reload-safe: reloading the page mid-day restores the current state (fetched from the backend).
- Final accuracy: within 2 seconds after the last event, all values equal the final backend values.
- Responsive: at maximum replay speed the page must remain interactive (rendering must be throttled or batched; do not re-render the whole page per event).

### 4.3 Architecture, Database & Deployment

- **Full Architectural Freedom:** You have complete autonomy over your programming languages, backend frameworks, and database technology (PostgreSQL, MySQL, MongoDB, Redis, SQLite, etc.). Choose whichever stack you believe delivers the best throughput, low latency, and clean code.
- **Database Integration (Highly Encouraged):** Rather than saving day states only in-memory or in raw flat files, you are strongly encouraged to use a proper database (SQL or NoSQL) to store items, daily history, and the event-by-event ledger to power the `:day_id` historical APIs reliably.
- **Docker Packaging:** You must provide your own `docker-compose.yml` at the repository root. A single command — `docker compose up --build` — must start your entire system (backend, frontend dashboard, and any database services) without manual intervention.
- **Port Contracts:**
  - Backend API must listen on port **8080** (under `/api/v1`).
  - Owner dashboard must be served on port **3000** (route `/`).
- **Configuration & Defaults:** If your services require environment variables, provide a `.env.example` at your repository root. All services must be configured with sensible defaults so that `docker compose up --build` starts cleanly out of the box without requiring manual `.env` file configuration.
- **Health Check:** `/api/v1/health` must return `200` within **120 seconds** of `docker compose up` finishing building.
- **Self-Contained:** No external network access and no paid APIs may be needed at runtime (except for your deployed version, if applicable).
- **Deployment (Bonus):** Deploying your backend, frontend, and database to free cloud tiers is highly encouraged to showcase full-stack capabilities. If you deploy, attaching a free custom domain to your frontend is a significant plus.
- **Anonymity:** Ensure your custom domains, URLs, and deployed interfaces do **not** contain "InterIIT" or any identifying competition terms.

---

## 5. How We Run and Score Your Submission

### 5.1 Procedure

Only **organiser runs** are scored. For each submission:

1. Fresh clone, then `docker compose up --build`.
2. Wait for `/api/v1/health`.
3. Run the 7 official days one after another with the harness at `--rate 0`, **without restarting** your services between days (history must accumulate).
4. After each day, run automated dashboard checks against the live UI and verify historical day switching.
5. Run a separate live-viewing check with a sample day at `--rate 50`.

### 5.2 Harness behaviour and failure handling

- The harness is single-threaded: one request in flight at a time.
- `POST /day/load`: timeout **300 s**. A non-200 or timeout means that day scores **0**.
- `POST /day/events`: timeout **15 s** per request. A non-200, a timeout, or an unparseable body is a **failure** for that event. For a failed online event the harness applies the fallback `from_shelf = 0` for every line (everything from the warehouse). The harness keeps going and does **not** resynchronise your mirror.
- 20 consecutive event failures abort the day: score **0**.
- Wall-clock cap per day (load plus all events): **60 minutes**; exceeding it aborts the day: score **0**.
- The harness's own simulation is the single source of truth for cost.

### 5.3 Per-day backend score

For each day, with `C` = the harness-computed total cost of your run, `C_base` = the cheaper of the two baseline policies' costs (§2.9), and `C_opt` = the reference optimum (lowest achievable cost under §2, computed by the organisers):

```
day_score = 100 × clamp( (C_base − C) / (C_base − C_opt), 0, 1 )
```

- Matching the cheaper baseline policy scores 0; reaching the reference optimum scores 100; being worse than the baseline scores 0.
- We guarantee `C_base > C_opt` on every official day.
- Aborted days score 0.

### 5.4 Final score (100 points)

| Component | Points | How |
|---|---|---|
| Backend cost score | 40 | `0.40 × mean(day_score over the 7 days)` |
| Dashboard UI | 30 | Rubric below |
| Engineering review | 30 | Rubric below |

Tie-break: lower sum of `C` across the 7 days.

**Dashboard rubric (30)**

| Area | Pts | Check |
|---|---|---|
| Numerical correctness | 12 | After each day: the 11 KPI cards and 3 randomly chosen item rows (4 cells each) are compared with the harness's authoritative values. Score = fraction exactly equal, averaged over days |
| Live & Historical behaviour | 6 | At `--rate 50`: KPIs change smoothly. Clicking a past day successfully populates the historical KPI summary and ledger. |
| Items table | 5 | All items present; `item-search` and `sort-lost` work |
| History | 4 | After 7 days `history-table` lists all 7 with correct cost, lost revenue and savings via the `/days` API |
| Robustness and performance | 3 | At `--rate 0` the page stays interactive (a click responds in < 500 ms) and shows no console errors |

**Engineering review (30)**

| Area | Pts |
|---|---|
| Structure and modularity (§7 R1–R3) | 10 |
| Database usage & Deployment bonus | 8 |
| README quality & Algorithm explanation (§7 R5) | 6 |
| Automated tests (§7 R4) | 4 |
| Code clarity and readability | 2 |

---

## 6. Limits and Input Bounds

Every official day satisfies all of these:

| Quantity | Bound |
|---|---|
| Items | 50 (same `items.csv` for every day) |
| Events per day | 20 000 – 60 000 |
| Share of online events | 20% – 80% (varies by day) |
| Lines per event | 1–6, distinct items |
| Walk-in `qty` per line | 1–8 |
| Online `qty` per line | 1–15 |
| `initial_shelf_qty` | 20–300 |
| `ts` | 0 – 43 200 |
| Item popularity | Skewed: a few items account for a large share of demand |
| Request body for `/day/load` | ≤ 25 MB |
| Any day total | < 9 × 10¹⁵ paise |

Traffic **shape** differs between days (overall volume, online/walk-in mix, bursts and which items are hot). Do not assume any of these are the same across days.

---

## 7. Engineering Requirements

These are reviewed (§5.4) and also prepare you for the next stage: **shortlisted candidates will be asked to make a change to their own submission live, under time pressure.** Build so that you can change the rules quickly and confidently.

- **R1: Layering.** Keep these concerns in separate modules: HTTP/API layer, simulation (shelf state and the rules of §2), decision policy (how online lines are split), metrics/aggregation, and database storage. The decision policy must sit behind an interface so it can be swapped without touching the HTTP layer or the simulation.
- **R2: No hard-coded data.** Item ids, prices, costs, capacities and thresholds come only from the load payload. Assume organisers may change parameter values.
- **R3: One source of truth for the rules.** The mirror state, the baselines and any planning you do must reuse the same simulation code, not re-implement it.
- **R4: Tests.** Automated tests that cover at least the rules in §2, including the worked example in §2.10 and the clamping rules.
- **R5: README & Interview Defense.** Your `README.md` is the primary artifact evaluated in the Engineering Review (6 points) and forms the blueprint for your technical interview defense. Rather than a generic overview, your README must systematically address the following 4 sections:
  1. **System Architecture & Data Model:**
     - **Stack Rationale:** Justify your chosen programming languages, backend frameworks, and database engine (SQL vs NoSQL).
     - **Database Design & Indexing:** Detail your schema, indexing strategy for high-throughput writes (20,000–60,000 events), and how the historical ledger is stored and queried for `/api/v1/day/:day_id/events`.
     - **Frontend Rendering Strategy:** Explain how your dashboard state management and rendering pipeline handle 50 events/second without browser lag, memory leaks, or dropped frames.
  2. **Algorithmic Decision Policy (Core Defense):**
     - **Problem Formulation:** What exact mathematical or heuristic optimization problem did you formulate during `POST /day/load`? (e.g., offline dynamic programming, lookahead heuristic, predictive inventory buffers, min-cost flow).
     - **Decision Rule:** When an online order arrives, how does your system decide `from_shelf` vs warehouse? Why does this reduce total cost ($C$) compared to the baseline ($C_{\text{base}}$)?
     - **Complexity Analysis:** State the formal Big-$O$ time and space complexity for both the initialization/planning phase (`/day/load`) and the real-time event dispatch (`/day/events`).
  3. **Empirical Benchmark Results:**
     - Provide a benchmark table reporting your results against both sample days using `harness/run_day.py --rate 0`:
       | Metric | Sample Day 1 | Sample Day 2 |
       |---|---|---|
       | Total Cost (paise) | ... | ... |
       | Baseline Cost ($C_{\text{base}}$) | 2,485,934,450 | 4,431,194,650 |
       | Reference Optimal ($C_{\text{opt}}$) | 973,284,900 | 1,353,975,950 |
       | Total Savings vs Baseline | ... | ... |
       | Final Day Score (/100) | ... | ... |
       | Planning Time (`/day/load`) | ... s | ... s |
       | Real-Time Throughput | ... events/s | ... events/s |
  4. **Modularity & Live Interview Preparedness:**
     - **Policy Decoupling (R1):** Point to the exact file and interface where your decision policy is isolated from the simulation engine.
     - **Live Modification Defense:** *You will be asked to modify your code live during the interview.* Explain which exact functions and lines in your codebase would change if rules were modified (e.g., refill threshold changed from $S=0$ to $S \le K$, or variable refill batch sizes).
- **R6: Determinism.** The same input must produce the same decisions and the same cost.

---

## 8. Submission and Rules

- Submit a **.zip file** before the deadline.
- If you successfully deploy your application, include the live URLs prominently at the top of your README.
- Ensure you keep your code in a **private repository** and don't mention Inter IIT at all anywhere in the repository, documentation, deployment domains, or **.zip** file.
- AI assistants and any other tools are permitted. You are fully responsible for every line you submit and will be asked to explain and modify any part of it live.
- Collaboration or copying between candidates is not permitted and leads to disqualification.
- Do not write code that detects the harness or the official days, or that returns different results based on the caller. Do not call external services at runtime (unless for your deployed version).

---

## Appendix: Formula Sheet

```
/* -------------------------------------------------------------
 * 1. Walk-In Event (per line)
 * ------------------------------------------------------------- */
if qty <= S:
    S -= qty
    walk_in_revenue_captured += qty * unit_price_paise
else:
    lost_revenue += qty * unit_price_paise
    units_lost   += qty
    // S remains unchanged

/* -------------------------------------------------------------
 * 2. Online Event (per line)
 * ------------------------------------------------------------- */
shelf_units      = clamp(from_shelf, 0, min(qty, S))
inventory_units  = qty - shelf_units
S               -= shelf_units

online_pull_cost += inventory_units * online_pull_cost_per_unit_paise
online_revenue   += qty * unit_price_paise
units_pulled     += inventory_units

/* -------------------------------------------------------------
 * 3. Refill Rule (evaluated immediately after EVERY line)
 * ------------------------------------------------------------- */
if S == 0:
    refill_count += 1
    refill_cost  += initial_shelf_qty * refill_cost_per_unit_paise
    S             = initial_shelf_qty

/* -------------------------------------------------------------
 * 4. Objectives & Benchmarks
 * ------------------------------------------------------------- */
TotalCost     = refill_cost + online_pull_cost + lost_revenue
gross_revenue = walk_in_revenue_captured + online_revenue

C_base        = min( C_shelf_first, C_inventory_only )
Savings       = C_base - TotalCost
day_score     = 100 * clamp( (C_base - C) / (C_base - C_opt), 0, 1 )
```
