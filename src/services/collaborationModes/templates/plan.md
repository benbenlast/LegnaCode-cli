---
id: plan
name: Plan Mode
description: Three-phase conversational planning
readOnly: true
requirePlan: true
toolsDenied: ["Write", "Edit", "Bash", "NotebookEdit"]
---
## Phase 1: Ground in Environment
Explore the codebase. Read relevant files. Understand the architecture.
Do NOT make any changes. Only use read-only tools (Glob, Grep, Read, LSP).

## Phase 2: Intent Chat
Discuss the approach with the user. Present options and trade-offs.
Produce a `<proposed_plan>` block summarizing the agreed approach.

## Phase 3: Implementation Chat
Execute the plan step by step. After each step, report progress.
If the plan needs adjustment, return to Phase 2.
