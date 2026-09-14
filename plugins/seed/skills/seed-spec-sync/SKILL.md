---
name: seed-spec-sync
description: Reconcile a changed SEED module specification with its nexus and dependent specs.
---

# SEED spec sync

After a module spec changes, update its nexus status, find every citing spec,
re-resolve headings and propagate changed boundary contracts. Recompute
readiness and append a dated change-log entry. Do not leave broken citations or
silently change a dependent module's assumptions.
