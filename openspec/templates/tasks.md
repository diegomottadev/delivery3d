# Tasks: <change-name>

## The 5 Criteria for an Executable Task

Every task in any section must satisfy these five rules. The `analyze` step checks them strictly:

| # | Criterion | Violations occur when... |
|---|---|---|
| **1** | **Atomic** — a single unit of work | Contains "and also", or chains two steps that can be verified separately |
| **2** | **Binary Done** — clear yes/no state | Says "improve", "review", "refactor nicely", "take into account" |
| **3** | **Concrete Action Verb** | *"add guard clause at `X:120`"* ✅ · *"handle authorization"* ❌ |
| **4** | **Names the Target File** | Cannot verify if done, cannot check if high-risk file |
| **5** | **Traceable to a Story** in `stories.md` | And that story traces to delta requirements. A task without a story is scope creep |

> Scope guards (*"Do NOT touch X"*) are the exception: they do not trace to a user story; they explicitly define boundaries.

## Apply — Implementation

Use either of these two structures (or both):

### Option A — By Technical Tickets (derived from requirements pipeline)

> Each item is checked by `/feature` after completing the ticket with green tests.

- [ ] [<PREFIX>-<NN> · <Title>](../../../docs/tickets/<PREFIX>-<NN>-<slug>.md)
- [ ] [<PREFIX>-<NN> · <Title>](../../../docs/tickets/<PREFIX>-<NN>-<slug>.md)

### Option B — Granular Tasks (manual change)

- [ ] Read analogous files and copy pattern (skill `architecture-first`)
- [ ] <concrete task 1>
- [ ] <concrete task 2>

## Verify — Verification (Show real console output)
- [ ] Run project linter (`{{LINT_COMMAND}}`)
- [ ] Clear cache / build assets if applicable (`{{CACHE_CLEAR_CMD}}`)
- [ ] Unit and integration tests (`{{TEST_COMMAND}}`) — TDD cycle (`tdd-test-writer` → `tdd-implementer` → `tdd-refactorer`)
- [ ] Code review & database query check (`spec-reviewer` ∥ `dba-optimizer`)
- [ ] Test coverage: Completeness check matches each requirement against tests; 0% coverage on new logic blocks progression

## Sync — Persist Truth
- [ ] Merge delta spec into `openspec/specs/<domain>/spec.md` (the WHAT)
- [ ] Update technical flow in `openspec/specs/<domain>/circuit.md` (the HOW)
- [ ] Record database migrations if applicable
- [ ] Update technical documentation if needed

## Closure
- [ ] Prepare commit message (`commit-message-writer`) — DO NOT commit automatically
- [ ] Archive: move change to `openspec/archive/YYYY-MM-DD-<name>/` and set status: done
