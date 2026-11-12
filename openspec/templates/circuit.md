# Technical Circuit: <domain>

> **Living Technical Memory: How work runs and where execution flows.**
> While `spec.md` defines the WHAT (business behavior), `circuit.md` defines the HOW (code path, method calls, cuts).
> It allows anyone to recover full context months later without re-reading thousands of lines of code.
>
> Updated during the **sync** step with real file paths and lines once code is implemented and verified.
> This document is cumulative across changes touching this domain.

**Last Updated:** YYYY-MM-DD · **Changes that shaped this:** `<change-name>`

---

## Entry Points

How the circuit is triggered (HTTP, CLI, Worker). Specify whether it is manual or automatic.

| Entry Point | Trigger Mechanism | File:Line |
|---|---|---|
| <e.g. REST API> | HTTP POST /orders | `src/controllers/order.controller.ts:45` |
| <e.g. Cron Job> | Scheduled job by OS/Worker | `src/jobs/cleanup.job.ts:12` |
| <e.g. UI Button> | User clicks submit | `src/views/checkout.component.tsx:88` |

---

## Execution Path

A trace for each flow showing method calls and, crucially, **where execution cuts off** early.

```
<Trigger>
  → <Service>::<method>()                   line NNN
      → [condition 1 true]?   → if false, exits
      → [condition 2 true]?   → if false, exits
      → <Helper>::<businessRule>()          ← CORE LOGIC
      → <side effect: database write / email / event dispatch>
```

Add brief prose below describing **why it is built this way** (transaction boundaries, idempotency, failure behavior).

---

## File Map

Every file that participates, with **what value it provides**.

| File | Responsibility |
|---|---|
| `src/services/<X>Service` | Core business logic and calculations |
| `src/controllers/<X>Controller` | Request validation and response formatting |
| `src/models/<X>Model` | Database entity mapping and persistence |
| `src/views/<X>` | User interface presentation |

---

## Shared Dependencies

Points of contact with other domains or modules that risk regression if changed.

| Shared Component | Shared With | Impact If Changed |
|---|---|---|
| `<Service>::<method>()` | <Other Domain / Flow> | <Concrete regression risk> |

---

## Feature Flags and Configuration Keys

| Key | Default Value | Defined In |
|---|---|---|
| `FLAG_NAME` | `false` | `.env` / Configuration service |
| `STATUS_ID` | `1` | Constants / Database lookup |

---

## Known Gotchas / Traps Verified

Only record **proven, verified gotchas** with date.

- ⚠️ <gotcha description> — verified on YYYY-MM-DD.

---

## How to Test Manually

Reproducible manual steps: prepare fixtures, trigger execution, observe output, **restore test state**.
