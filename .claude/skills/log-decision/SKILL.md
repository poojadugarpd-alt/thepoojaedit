---
name: log-decision
description: Append a new entry to docs/decisions.md in this project's exact established format. Use whenever a non-trivial decision, bug fix, or workflow change in PoojaEdit should be logged — the same way D-1 through D-127 already are.
---

# Logging a decision to docs/decisions.md

`docs/decisions.md` is PoojaEdit's real changelog — every non-trivial decision,
bug fix, or workflow change gets one row. It is read far more often than
`build-progress.md` or the handover doc, so consistency matters.

## Format

Every entry is one row in a single running Markdown table, appended under the
last `## ` section heading in the file (currently `## Post-Phase-12
decisions` — do not start a new section unless the user explicitly says
they're starting a new phase):

```
| D-<N> | **One-sentence bold headline stating the decision/fix as a fact.** Full body: what the problem/decision actually was, root cause if it's a bug, what changed concretely (files, functions), what was verified and how (`npm run check`, specific test names, live browser walkthrough), and what — if anything — is still open/deferred. | YYYY-MM-DD | Why this happened — the owner's report (quote it if they gave exact wording), or the reasoning that drove the decision. |
```

## Steps

1. Find the current highest `D-<N>` in `docs/decisions.md` (`grep -n '^| D-' docs/decisions.md | tail -1`) and use `N+1`.
2. Write the entry following the exact voice of existing entries: precise,
   factual, past-tense, no marketing language. Name real file paths and
   function names. If it's a bug fix, state the root cause, not just the
   symptom. If something was **not** verified (e.g. no live browser
   walkthrough, no e2e coverage), say so explicitly — this file's whole value
   is being trustworthy about what's actually been checked vs assumed.
3. If the fix/decision came from a direct owner report, quote their exact
   wording in the Reason column, the way D-123/D-126/D-127 do — precise
   phrasing there has repeatedly mattered for root-causing exactly what a
   "still broken" follow-up report meant.
4. Append the row as the last line of the table (end of file, since the
   `## Post-Phase-12 decisions` table runs to EOF). Do not repeat the
   `| ID | Decision | Date | Reason |` header — it's a single continuous
   table.
5. Use today's real date (check the environment/system date, not a guess).
