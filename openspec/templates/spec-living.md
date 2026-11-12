# Living Specification: <domain>

> **The source of truth for what this domain does right now.**
> Every requirement is written in declarative business language.
> Updated automatically at the end of each `/change` during the **sync** step.

## Purpose
<High-level summary of the domain's responsibility in the system and business value provided.>

---

## Active Requirements

### Requirement: <Requirement Name>
The system MUST <describe expected behavior>.

#### Scenarios
```gherkin
Scenario: <Descriptive scenario name>
  GIVEN <known initial state>
  WHEN <action or event occurs>
  THEN <observable outcome>
```

#### Example Matrix (Specification by Example)
| ID | Case | Input | Expected Output |
|---|---|---|---|
| EX-01 | Standard case | Valid values | Success result |
| EX-02 | Edge case | Minimum limit | Success result |
| EX-03 | Rejection | Invalid values | Validation error |
