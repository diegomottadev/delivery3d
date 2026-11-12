# Delta Specification: order-lifecycle

> Depends on `quote-calculation` — every scenario below assumes the order already exists with status `presupuestado` (or later) and a populated `order_status_history` row for that initial transition. Business domain terms follow `Project.md` §3; technical identifiers follow `design.md`'s `OrderStatus` enum (`nuevo`, `presupuestado`, `aprobado`, `imprimiendo`, `listo`, `entregado`) and its strict 1-to-1 `VALID_TRANSITIONS` map.
>
> **Updated for normalized schema:** `deposit_amount` is not persisted as a column on `Order` (3FN). When provided with value `> 0` upon approval, it records an atomic entry in `cash_movements` (`type="ingreso"`, `category="seña"`).

## ADDED Requirements

### Requirement: Approve a quoted order with optional deposit
The system MUST allow an authenticated operator to transition an order from `presupuestado` to `aprobado`, optionally recording a `deposit_amount` (monto de seña). This transition MUST be the only one that accepts `deposit_amount`. If `deposit_amount > 0`, the system MUST create an entry in `cash_movements` linked to the order within the same atomic transaction. If `deposit_amount` is omitted or 0, no cash movement is created.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | `order_id=101`, no `deposit_amount` | `presupuestado` | `POST /api/orders/101/approve` (body: `{}`) | 200 OK; `order.status = aprobado`; no cash movement; new `order_status_history` row (`presupuestado→aprobado`, actor, timestamp) |
| EX-02 | Happy Path | `order_id=102`, `deposit_amount=1500.00` | `presupuestado` | `POST /api/orders/102/approve` (body: `{"deposit_amount": 1500.00}`) | 200 OK; `order.status = aprobado`; creates `CashMovement(type="ingreso", category="seña", amount=1500.00, order_id=102)`; history row recorded |
| EX-03 | Boundary Case | `deposit_amount = 0.00` | `presupuestado` | `POST /api/orders/103/approve` (body: `{"deposit_amount": 0.00}`) | 200 OK; no cash movement created |
| EX-04 | Boundary Case | `deposit_amount` equal to full quoted price | `presupuestado` | `POST /api/orders/104/approve` | 200 OK per current spec (no upper-bound rule defined) |
| EX-05 | Boundary −1 | `deposit_amount = -0.01` | `presupuestado` | `POST /api/orders/105/approve` (body: `{"deposit_amount": -0.01}`) | 422 Unprocessable Entity; `order.status` unchanged, no cash movement |
| EX-06 | Negative / Unauthorized | Order already `aprobado` | `aprobado` | `POST /api/orders/106/approve` | 409 Conflict; `order.status` unchanged; no history row appended |
| EX-07 | Negative / Unauthorized | Order in `imprimiendo` | `imprimiendo` | `POST /api/orders/107/approve` | 409 Conflict; only `presupuestado → aprobado` is legal; `order.status` unchanged |
| EX-08 | Negative / Unauthorized | No/expired JWT | `presupuestado` | `POST /api/orders/108/approve` | 401 Unauthorized; no state or history change |
| EX-09 | Technical Database Limit | `deposit_amount = 100000000.00` (exceeds `DECIMAL(10,2)` capacity) | `presupuestado` | `POST /api/orders/109/approve` | 422 Unprocessable Entity; rejected before persistence attempt |
| EX-10 | Technical Database Limit | `deposit_amount = 1500.999` (3 decimal places) | `presupuestado` | `POST /api/orders/110/approve` | 422 Unprocessable Entity; system MUST reject silent rounding/truncation |
| EX-11 | Negative / Unauthorized | Order still `nuevo` (not yet quoted) | `nuevo` | `POST /api/orders/111/approve` | 409 Conflict; `order.status` unchanged |
| EX-12 | Negative / Unauthorized | Order already `entregado` (terminal state) | `entregado` | `POST /api/orders/112/approve` | 409 Conflict; `order.status` unchanged |

---

### Requirement: Start printing an approved order
The system MUST allow an authenticated operator to transition an order from `aprobado` to `imprimiendo`. This transition MUST NOT accept any `deposit_amount` value.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | `order_id=201` | `aprobado` | `POST /api/orders/201/start-printing` | 200 OK; `order.status = imprimiendo`; history row `aprobado→imprimiendo` recorded |
| EX-02 | Negative / Unauthorized | `order_id=202`, sends `{"deposit_amount": 5000.00}` on this endpoint | `aprobado` | `POST /api/orders/202/start-printing` | 422 Unprocessable Entity; request rejected outright |
| EX-03 | Negative / Unauthorized | Skipping a state: order still `presupuestado` | `presupuestado` | `POST /api/orders/203/start-printing` | 409 Conflict; no history row |
| EX-04 | Negative / Unauthorized | Order already `imprimiendo` (idempotent re-submit) | `imprimiendo` | `POST /api/orders/204/start-printing` | 409 Conflict |
| EX-05 | Negative / Unauthorized | Order does not exist | n/a | `POST /api/orders/9999/start-printing` | 404 Not Found |
| EX-06 | Negative / Unauthorized | Order still `nuevo` | `nuevo` | `POST /api/orders/205/start-printing` | 409 Conflict; `order.status` unchanged |
| EX-07 | Negative / Unauthorized | Order already `entregado` (terminal state) | `entregado` | `POST /api/orders/206/start-printing` | 409 Conflict |

---

### Requirement: Mark a printing order as ready
The system MUST allow an authenticated operator to transition an order from `imprimiendo` to `listo`.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | `order_id=301` | `imprimiendo` | `POST /api/orders/301/mark-ready` | 200 OK; `order.status = listo`; history row `imprimiendo→listo` recorded |
| EX-02 | Negative / Unauthorized | Skipping a state: order in `aprobado` | `aprobado` | `POST /api/orders/302/mark-ready` | 409 Conflict |
| EX-03 | Negative / Unauthorized | Order already `entregado` (final state) | `entregado` | `POST /api/orders/303/mark-ready` | 409 Conflict |
| EX-04 | Negative / Unauthorized | No/expired JWT | `imprimiendo` | `POST /api/orders/304/mark-ready` | 401 Unauthorized |
| EX-05 | Negative / Unauthorized | Order already `listo` (self-loop, idempotent re-submit) | `listo` | `POST /api/orders/305/mark-ready` | 409 Conflict |

---

### Requirement: Deliver a ready order
The system MUST allow an authenticated operator to transition an order from `listo` to `entregado`. `entregado` MUST be a terminal state — no further transition is permitted from it.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | `order_id=401` | `listo` | `POST /api/orders/401/deliver` | 200 OK; `order.status = entregado`; history row `listo→entregado` recorded |
| EX-02 | Negative / Unauthorized | Skipping straight from `presupuestado` to `entregado` | `presupuestado` | `POST /api/orders/402/deliver` | 409 Conflict |
| EX-03 | Negative / Unauthorized | Order already `entregado` | `entregado` | `POST /api/orders/403/deliver` | 409 Conflict |
| EX-04 | Negative / Unauthorized | Order does not exist | n/a | `POST /api/orders/9999/deliver` | 404 Not Found |
| EX-05 | Negative / Unauthorized | Order still `aprobado` (skip imprimiendo and listo) | `aprobado` | `POST /api/orders/404/deliver` | 409 Conflict |
| EX-06 | Negative / Unauthorized | Order still `imprimiendo` (skip listo) | `imprimiendo` | `POST /api/orders/405/deliver` | 409 Conflict |

---

### Requirement: Query current status and transition history of an order
The system MUST allow an authenticated operator to retrieve an order's current `status` and its full ordered `order_status_history`.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | `order_id=501`, has gone `presupuestado→aprobado→imprimiendo` | `imprimiendo` | `GET /api/orders/501/history` | 200 OK; `status = imprimiendo`; history contains exactly 3 chronologically ordered entries, each with actor and timestamp |
| EX-02 | Boundary Case | Only the initial history row exists, no lifecycle transition yet | `presupuestado` | `GET /api/orders/502/history` | 200 OK; history contains exactly 2 entries (intake + quote confirm) |
| EX-03 | Negative / Unauthorized | No/expired JWT | any | `GET /api/orders/503/history` | 401 Unauthorized |
| EX-04 | Negative / Unauthorized | Order does not exist | n/a | `GET /api/orders/9999/history` | 404 Not Found |

---

## Detailed Acceptance Criteria (Tester Test style)

1. **AC-1 — Sequential enforcement.** Any status other than the immediate predecessor of a target transition endpoint MUST return `409 Conflict` and MUST NOT alter `order.status` or append to `order_status_history`.
2. **AC-2 — Deposit scoping.** Only `/approve` accepts `deposit_amount`; sending it to `/start-printing`, `/mark-ready`, or `/deliver` MUST be rejected with `422`.
3. **AC-3 — Terminal state.** Once `order.status = entregado`, every lifecycle endpoint MUST return `409 Conflict`.
4. **AC-4 — History append-only, one row per successful transition.** Ascending chronological order with actor attribution.
5. **AC-5 — Deposit validation.** `deposit_amount < 0` or invalid precision MUST always be rejected with `422` on `/approve`.
6. **AC-6 — Authorization parity.** All endpoints enforce `@login_required` (unauthenticated returns `401`).
7. **AC-7 — Seña cash integration.** When `deposit_amount > 0` on approval, a `CashMovement(type="ingreso", category="seña")` is atomically created.
