---
name: seed-go
description: Select the next valid SEED workflow action from repository and task state.
---

# SEED go

Read repository state, the memory bank, the current task and its phase. Infer
the next valid workflow action only from those facts. If initialization or a
specification is missing, stop at that prerequisite. Never skip approval,
verification, review or shipping gates because a later action looks obvious.
