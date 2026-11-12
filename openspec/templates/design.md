# Design: <change-name>

## Involved Files (real paths)
- `src/...` or `app/...`
- `controllers/...`
- `models/...` or `entities/...`
- `views/...` or `components/...`
- `tests/...`

## Technical Approach
<How this is resolved, following an analogous pattern that ALREADY exists in the codebase. Do not reinvent architecture.>

## Constants / Enums / Magic IDs
- Define any necessary constants, status enums, or configuration keys.
- Clarify origin table or module for each ID.

## Security & Permissions
- Existing permission to check, or definition of the new access control rule.

## ⚠️ High-Risk Files / Modules
- Identify if this change touches heavily coupled or critical modules.
- Add specific warnings if applicable.

## Impact on Data / Integraciones
- Database (Existing data impact? Backfill required? Migration?).
- External services / Third-party APIs / Queues / Emails.

## Schema Changes / Migrations
```sql
-- Proposed DDL or migration script
```

## Decisions (Short ADR)
- **Decision:** ...
- **Discarded alternative:** ...
- **Reason:** ...

---

## Inventory of Built Artifacts

> **Goes at the end, not at the beginning.** This list names concrete artifacts built or updated,
> grouped by architectural layer.

### Database
- [ ] **Create / Modify** table `<table_name>` — purpose and indexes *(→ R...)*

### Backend
- [ ] **Create** `<Service>::<method>(<signature>)` — what it provides *(→ R...)*
- [ ] **Modify** `<Controller>::<action>()` — what changes and what stays unchanged *(→ US-..., AC-...)*

### Frontend
- [ ] **Modify / Create** component or view `<ViewName>` — UI changes *(→ R...)*

### Configuration
- [ ] **Modify** `.env` or config files — keys and default values *(→ R...)*

### Tests
- [ ] **Create** `<TestSuite>` — acceptance criteria covered *(→ AC-...)*

**What this change explicitly does NOT touch** is declared here when scope protection matters.
