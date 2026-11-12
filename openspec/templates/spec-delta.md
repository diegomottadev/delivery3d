# Delta Specification: <change-name>

> **Specifies only what changes.** Used during the proposal phase and merged into `openspec/specs/<domain>/spec.md` during `sync`.

## ADDED Requirements

### Requirement: <Requirement Name>
The system MUST <describe expected observable behavior in declarative business language>.

#### Scenarios (SBE Example Matrix)
| ID | Type | Input (Concrete business data) | Initial State | Trigger / Action | Expected Observable Result |
|---|---|---|---|---|---|
| EX-01 | Happy Path | valid input values | Active user | Submits request | 200 OK, entity status becomes 'Confirmed' |
| EX-02 | Boundary | exact limit value | Active user | Submits request | Allowed with maximum threshold warning |
| EX-03 | Error Case | negative or invalid value | Active user | Submits request | Rejected with 422 Unprocessable Entity |

---

## MODIFIED Requirements

### Requirement: <Existing Requirement Name>
**Previous Behavior:**
The system previously <old behavior>.

**New Behavior:**
The system MUST now <new behavior>.

---

## REMOVED Requirements

### Requirement: <Discontinued Requirement Name>
**Reason for removal:** <rationale>

---

## SBE Quality Checklist (Gojko Adzic Principles)
- [ ] **Pure Domain Language:** Free of UI clicks, modal references, or internal framework classes.
- [ ] **The Tester Test:** Can a QA engineer verify PASS/FAIL without looking at internal code?
- [ ] **Concrete Example Table:** Includes happy path, boundaries, and negative cases.
- [ ] **Atomicity:** One requirement = one business rule.
