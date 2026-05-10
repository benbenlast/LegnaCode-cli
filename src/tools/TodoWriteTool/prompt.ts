import { FILE_EDIT_TOOL_NAME } from '../FileEditTool/constants.js'

export const PROMPT = `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress and organize complex tasks.

## When to Use
- Complex multi-step tasks (3+ distinct steps)
- User provides multiple tasks (numbered or comma-separated)
- After receiving new instructions — capture requirements as todos
- When starting a task — mark as in_progress BEFORE beginning work
- After completing a task — mark as completed

## When NOT to Use
- Single, straightforward tasks
- Trivial tasks completable in <3 steps
- Purely conversational or informational requests

## Task States
- pending: Not yet started
- in_progress: Currently working on (limit to ONE at a time)
- completed: Finished successfully

Task descriptions must have two forms:
- content: Imperative form (e.g., "Run tests")
- activeForm: Present continuous form (e.g., "Running tests")

## Task Management Rules
- Update status in real-time as you work
- Mark tasks complete IMMEDIATELY after finishing
- Exactly ONE task must be in_progress at any time
- ONLY mark completed when FULLY accomplished — not if tests fail, implementation is partial, or errors are unresolved
- When blocked, create a new task describing what needs resolution
- Break complex tasks into smaller, actionable steps
`

export const DESCRIPTION =
  'Update the todo list for the current session. To be used proactively and often to track progress and pending tasks. Make sure that at least one task is in_progress at all times. Always provide both content (imperative) and activeForm (present continuous) for each task.'
